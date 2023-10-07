#![no_std]
use microjson::JSONValue;
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
        let challenge_decoded =
            base64_url::decode_to_slice(challenge, &mut challenge_decoded_buffer)
                .map_err(|_| Error::ClientDataJsonChallengeInvalidBase64Url)?;
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
mod test {
    use crate::{Contract, ContractClient, Error, Signature};
    use soroban_sdk::{testutils::Address, vec, Bytes, BytesN, Env, IntoVal};

    #[test]
    fn test_hello() {
        let e = Env::default();
        let contract_id = e.register_contract(None, Contract);
        let client = ContractClient::new(&e, &contract_id);

        let signature_payload = BytesN::from_array(&e, &[0u8; 32]);
        let pk = BytesN::from_array(
            &e,
            &[
                12, 240, 143, 208, 161, 74, 95, 35, 19, 113, 56, 111, 100, 231, 114, 209, 54, 72,
                84, 76, 111, 114, 137, 126, 176, 159, 163, 80, 59, 50, 15, 192,
            ],
        );

        client.init(&pk);

        let authenticator_data = Bytes::from_array(
            &e,
            &[
                73, 150, 13, 229, 136, 14, 140, 104, 116, 52, 23, 15, 100, 118, 96, 91, 143, 228,
                174, 185, 162, 134, 50, 199, 153, 92, 243, 186, 131, 29, 151, 99, 1, 0, 0, 0, 5,
            ],
        );
        let client_data_json = Bytes::from_array(
            &e,
            &[
                123, 34, 116, 121, 112, 101, 34, 58, 34, 119, 101, 98, 97, 117, 116, 104, 110, 46,
                103, 101, 116, 34, 44, 34, 99, 104, 97, 108, 108, 101, 110, 103, 101, 34, 58, 34,
                65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
                65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
                65, 34, 44, 34, 111, 114, 105, 103, 105, 110, 34, 58, 34, 104, 116, 116, 112, 58,
                47, 47, 108, 111, 99, 97, 108, 104, 111, 115, 116, 58, 52, 53, 48, 55, 34, 44, 34,
                99, 114, 111, 115, 115, 79, 114, 105, 103, 105, 110, 34, 58, 102, 97, 108, 115,
                101, 125,
            ],
        );
        let signature = BytesN::from_array(
            &e,
            &[
                142, 91, 250, 143, 24, 242, 153, 104, 6, 133, 198, 70, 76, 100, 165, 36, 124, 203,
                190, 127, 99, 233, 21, 209, 107, 10, 120, 53, 103, 210, 42, 248, 14, 156, 229, 165,
                134, 33, 2, 15, 117, 234, 252, 4, 26, 149, 5, 146, 120, 22, 91, 135, 235, 227, 65,
                105, 104, 24, 40, 241, 200, 215, 218, 5,
            ],
        );

        let signature = Signature {
            authenticator_data,
            client_data_json,
            signature,
        };

        let result: Result<(), Result<Error, _>> = e.try_invoke_contract_check_auth(
            &contract_id.contract_id(),
            &signature_payload,
            &vec![&e, signature.into_val(&e)],
            &vec![&e],
        );
        assert_eq!(result, Ok(()));
    }
}
