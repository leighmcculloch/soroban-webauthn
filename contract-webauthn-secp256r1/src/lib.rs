#![no_std]
use core::ops::Range;

use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, symbol_short, Bytes, BytesN, Env, Symbol,
    Vec,
};

mod base64_url;
mod secp256r1;

#[cfg(test)]
mod test;

#[contract]
pub struct Contract;

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum Error {
    NotInited = 1,
    AlreadyInited = 2,
    ClientDataJsonChallengeIncorrect = 3,
    Secp256r1PublicKeyParse = 4,
    Secp256r1SignatureParse = 5,
    Secp256r1VerifyFailed = 6,
}

const STORAGE_KEY_PK: Symbol = symbol_short!("pk");

#[contractimpl]
impl Contract {
    pub fn init(env: Env, pk: BytesN<65>) -> Result<(), Error> {
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

fn to_buffered_slice<const B: usize>(b: &Bytes) -> ([u8; B], Range<usize>) {
    let mut buf = [0u8; B];
    let slice = &mut buf[0..b.len() as usize];
    b.copy_into_slice(slice);
    (buf, 0..slice.len())
}

#[contractimpl]
impl CustomAccountInterface for Contract {
    type Error = Error;
    type Signature = Signature;
    #[allow(non_snake_case)]
    fn __check_auth(
        e: Env,
        signature_payload: BytesN<32>,
        signature: Signature,
        _auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        // Verify that the public key produced the signature.
        let pk = e
            .storage()
            .instance()
            .get(&STORAGE_KEY_PK)
            .ok_or(Error::NotInited)?;
        let mut payload = Bytes::new(&e);
        payload.append(&signature.authenticator_data);
        payload.append(&e.crypto().sha256(&signature.client_data_json).into());
        let payload = e.crypto().sha256(&payload);
        secp256r1::verify(&pk, &payload, &signature.signature)?;

        let (buf, rng) = to_buffered_slice::<1024>(&signature.client_data_json);
        let cdj = &buf[rng];
        let cdj = core::str::from_utf8(cdj).unwrap();
        let cdj = lite_json::parse_json(cdj).unwrap();

        // Build what is expected to be the beginning of the client data to
        // contain, including the challenge value, which is expected to be the
        // signature payload base64 URL encoded. The most resilient thing to do
        // here would be to decode the JSON and extract the "challenge" key's
        // value, then base64 URL decode the value and compare the result.
        // However, even with lightweight JSON and base64 dependencies the
        // contract comes out a little large. Doing the base64 encode in a
        // minimal fashion and comparing the prefix requires less resources and
        // should be as safe, albeit not as resilient if a client ever produces
        // valid JSON that just happens to have different prefix.
        let mut expected_prefix = *b"{\"type\":\"webauthn.get\",\"challenge\":\"___________________________________________\"";
        base64_url::encode(&mut expected_prefix[36..79], &signature_payload.to_array());
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
