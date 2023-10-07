#![no_std]
use base64::Engine;
use microjson::JSONValue;
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, log, symbol_short, Bytes, BytesN, Env,
    Symbol, Vec,
};

#[contract]
pub struct Contract;

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq, Debug)]
pub enum Error {
    NotInited = 1,
    AlreadyInited = 2,
    ClientDataJsonExceedsSizeLimit = 3,
    ClientDataJsonInvalidUtf8 = 4,
    ClientDataJsonInvalidJson = 5,
    ClientDataJsonChallengeInvalidJsonType = 6,
    ClientDataJsonChallengeInvalidBase64Url = 7,
    ClientDataJsonChallengeIncorrectLength = 8,
    ClientDataJsonChallengeIncorrect = 9,

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
#[derive(Clone, Eq, PartialEq)]
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
        log!(&e, "leigh");
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

        // Parse the clientDataJson and extract the challenge.
        let mut client_data_json_buffer = [0u8; 256];
        let client_data_json_slice = client_data_json_buffer
            .get_mut(..signature.client_data_json.len() as usize)
            .ok_or(Error::ClientDataJsonExceedsSizeLimit)?;
        signature
            .client_data_json
            .copy_into_slice(client_data_json_slice);
        let client_data_json_str = core::str::from_utf8(client_data_json_slice)
            .map_err(|_| Error::ClientDataJsonInvalidUtf8)?;
        let client_data =
            JSONValue::parse(client_data_json_str).map_err(|_| Error::ClientDataJsonInvalidJson)?;
        let challenge_value = client_data
            .get_key_value("challenge")
            .map_err(|_| Error::ClientDataJsonInvalidJson)?;
        let challenge = challenge_value
            .read_string()
            .map_err(|_| Error::ClientDataJsonChallengeInvalidJsonType)?;

        // Decode the challenge, which should be a 32-byte value encoded as a
        // 64-character hex string that is base64 url encoded. Note: The
        // base64url lib needs 33 bytes allocated because the maximum possible
        // output with the length of the base64url that'll be passed in will be
        // 33 bytes, even though our value will only ever be 32 bytes.
        let mut challenge_decoded_buffer = [0u8; 33];
        let challenge_decoded_len = base64::engine::general_purpose::URL_SAFE_NO_PAD
            .decode_slice(challenge, &mut challenge_decoded_buffer)
            .map_err(|_| Error::ClientDataJsonChallengeInvalidBase64Url)?;
        let challenge_decoded = &challenge_decoded_buffer[..challenge_decoded_len];
        let challenge: BytesN<32> = Bytes::from_slice(&e, challenge_decoded)
            .try_into()
            .map_err(|_| Error::ClientDataJsonChallengeIncorrectLength)?;

        // Check that the challenge is the signature payload hash, to check
        // that the public key's signature included the Soroban Auth
        // payload.
        if challenge != signature_payload {
            return Err(Error::ClientDataJsonChallengeIncorrect);
        }

        Ok(())
    }
}

#[cfg(test)]
mod test;
