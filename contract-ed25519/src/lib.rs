#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, symbol_short, Bytes, BytesN, Env, Symbol,
    Vec,
};

#[contract]
pub struct Contract;

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum Error {
    NotInited = 1,
    AlreadyInited = 2,
    ClientDataJsonChallengeIncorrect = 3,

    // TODO: Remove this error when changing Vec<Signature> to Signature, after
    // https://github.com/stellar/rs-soroban-sdk/pull/1110 is in use in this
    // contract.
    SignaturesIncorrectLength = 90,
}

const STORAGE_KEY_PK: Symbol = symbol_short!("pk");

#[contractimpl]
impl Contract {
    pub fn init(env: Env, pk: BytesN<32>) -> Result<(), Error> {
        if env.storage().instance().has(&STORAGE_KEY_PK) {
            return Err(Error::AlreadyInited);
        }
        env.storage().instance().set(&STORAGE_KEY_PK, &pk);
        Ok(())
    }
}

#[contracttype]
pub struct Signature {
    pub authenticator_data: Bytes,
    pub client_data_json: Bytes,
    pub signature: BytesN<64>,
}

#[contractimpl]
impl CustomAccountInterface for Contract {
    type Error = Error;
    type Signature = Signature;

    #[allow(non_snake_case)]
    fn __check_auth(
        e: Env,
        signature_payload: BytesN<32>,
        // TODO: Change Vec<Signaure> to Signature when
        // https://github.com/stellar/rs-soroban-sdk/pull/1110 is released.
        signatures: Vec<Signature>,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        let signature = signatures.first().ok_or(Error::SignaturesIncorrectLength)?;

        // Verify that the public key produced the signature.
        let pk = e
            .storage()
            .instance()
            .get(&STORAGE_KEY_PK)
            .ok_or(Error::NotInited)?;
        let mut payload = Bytes::new(&e);
        payload.append(&signature.authenticator_data);
        payload.append(&e.crypto().sha256(&signature.client_data_json).into());
        e.crypto()
            .ed25519_verify(&pk, &payload, &signature.signature);

        // Build what is expected to be the beginning of the client data to
        // contain, including the challenge value, which is expected to be the
        // signature payload base64 URL encoded. The most resilient thing to do
        // here would be to decode the JSON and extract the "challenge" key's
        // value, then base64 URL decode the value and compare the result.
        // However, even with "lightweight" JSON and base64 dependencies the
        // contract comes out a little large. Doing the base64 encode in a
        // minimal fashion and comparing the prefix requires less resources and
        // should be as safe, albeit not as resilient if a client ever produces
        // valid JSON that just happens to have different prefix.
        let mut expected_prefix = *b"{\"type\":\"webauthn.get\",\"challenge\":\"___________________________________________\"";
        base64_url_encode(&mut expected_prefix[36..79], &signature_payload.to_array());
        let expected_prefix = Bytes::from_slice(&e, &expected_prefix);

        // Check that the prefix containing the challenge/signature-payload is
        // the prefix expected.
        let prefix = signature.client_data_json.slice(..expected_prefix.len());
        if prefix != expected_prefix {
            return Err(Error::ClientDataJsonChallengeIncorrect);
        }

        Ok(())
    }
}

fn base64_url_encode(dst: &mut [u8], src: &[u8]) {
    // Ported from https://github.com/golang/go/blob/26b5783b72376acd0386f78295e678b9a6bff30e/src/encoding/base64/base64.go#L53-L192
    //
    // Modifications:
    //    * Removed logic supporting padding.
    //    * Hardcoded the Base64 URL alphabet.
    //    * Ported to Rust.
    //
    // Original Copyright notice:
    //
    // Copyright (c) 2009 The Go Authors. All rights reserved.
    // Redistribution and use in source and binary forms, with or without
    // modification, are permitted provided that the following conditions are
    // met:
    //
    //    * Redistributions of source code must retain the above copyright
    // notice, this list of conditions and the following disclaimer.
    //    * Redistributions in binary form must reproduce the above
    // copyright notice, this list of conditions and the following disclaimer
    // in the documentation and/or other materials provided with the
    // distribution.
    //    * Neither the name of Google Inc. nor the names of its
    // contributors may be used to endorse or promote products derived from
    // this software without specific prior written permission.
    //
    // THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS
    // "AS IS" AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT
    // LIMITED TO, THE IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR
    // A PARTICULAR PURPOSE ARE DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT
    // OWNER OR CONTRIBUTORS BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL,
    // SPECIAL, EXEMPLARY, OR CONSEQUENTIAL DAMAGES (INCLUDING, BUT NOT
    // LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR SERVICES; LOSS OF USE,
    // DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER CAUSED AND ON ANY
    // THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY, OR TORT
    // (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
    // OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.

    const ALPHABET: &[u8] = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";

    let mut di: usize = 0;
    let mut si: usize = 0;
    let n = (src.len() / 3) * 3;
    while si < n {
        let val = (src[si] as usize) << 16 | (src[si + 1] as usize) << 8 | (src[si + 2] as usize);
        dst[di] = ALPHABET[val >> 18 & 0x3F];
        dst[di + 1] = ALPHABET[val >> 12 & 0x3F];
        dst[di + 2] = ALPHABET[val >> 6 & 0x3F];
        dst[di + 3] = ALPHABET[val & 0x3F];
        si += 3;
        di += 4;
    }

    let remain = src.len() - si;
    if remain == 0 {
        return;
    }

    let mut val = (src[si] as usize) << 16;
    if remain == 2 {
        val |= (src[si + 1] as usize) << 8;
    }

    dst[di] = ALPHABET[val >> 18 & 0x3F];
    dst[di + 1] = ALPHABET[val >> 12 & 0x3F];

    if remain == 2 {
        dst[di + 2] = ALPHABET[val >> 6 & 0x3F];
    }
}

#[cfg(test)]
mod test;
