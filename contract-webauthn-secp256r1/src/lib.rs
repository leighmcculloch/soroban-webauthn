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

#[derive(serde::Deserialize)]
struct ClientDataJson<'a> {
    challenge: &'a str,
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
        let (cdj, _): (ClientDataJson, _) = serde_json_core::de::from_slice(cdj).unwrap();

        let mut expected_challenge = *b"___________________________________________";
        base64_url::encode(&mut expected_challenge, &signature_payload.to_array());
        let expected_challenge = unsafe { core::str::from_utf8_unchecked(&expected_challenge) };

        // Check that the prefix containing the challenge/signature-payload is
        // the prefix expected.
        if cdj.challenge != expected_challenge {
            return Err(Error::ClientDataJsonChallengeIncorrect);
        }

        Ok(())
    }
}

fn to_buffered_slice<const B: usize>(b: &Bytes) -> ([u8; B], Range<usize>) {
    let mut buf = [0u8; B];
    let len = b.len() as usize;
    {
        let slice = &mut buf[0..len];
        b.copy_into_slice(slice);
    }
    (buf, 0..len)
}
