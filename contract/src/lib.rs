#![no_std]
use soroban_sdk::{
    auth::{Context, CustomAccountInterface},
    contract, contracterror, contractimpl, contracttype, symbol_short, Bytes, BytesN, Env, Symbol,
    Vec,
};

#[contract]
pub struct Contract;

#[contracterror]
#[derive(Copy, Clone, Eq, PartialEq)]
pub enum Error {
    AlreadyInited = 1,
}

#[contracttype]
#[derive(Clone, Eq, PartialEq)]
pub struct Signature {
    pub authenticatorData: Bytes,
    pub clientDataJSON: Bytes,
    pub signature: Bytes,
}

const STORAGE_KEY_PUBLIC_KEY: Symbol = symbol_short!("pk");

#[contractimpl]
impl Contract {
    fn init(env: Env, public_key: Bytes) -> Result<(), Error> {
        if env.storage().instance().has(&STORAGE_KEY_PUBLIC_KEY) {
            return Err(Error::AlreadyInited);
        }
        env.storage()
            .instance()
            .set(&STORAGE_KEY_PUBLIC_KEY, &public_key);
        Ok(())
    }
}

#[contractimpl]
impl CustomAccountInterface for Contract {
    type Error = Error;
    type Signature = Signature;
    fn __check_auth(
        env: Env,
        signature_payload: BytesN<32>,
        signatures: Vec<Signature>,
        auth_contexts: Vec<Context>,
    ) -> Result<(), Error> {
        Ok(())
    }
}

#[cfg(test)]
mod test {
    use soroban_sdk::{Env, Bytes};

    use crate::{Contract, ContractClient};
    use p256::ecdsa::{signature::Verifier, VerifyingKey};

    #[test]
    fn test_hello() {
        let e = Env::default();
        let contract_id = e.register_contract(None, Contract);
        let client = ContractClient::new(&e, &contract_id);

        let challenge = Bytes::from_array(&e, b"authchallenge000");
        let pk = Bytes::from_array(&e, b"");
        let authenticatorData = Bytes::from_array(&e, b"");
        let clientDataJSON = Bytes::from_array(&e, b"");
        let signature = Bytes::from_array(&e, b"");

        let mut payload = Bytes::new(&e);
        payload.append(&authenticatorData);
        payload.append(&e.crypto().sha256(&clientDataJSON).into());

        let verifying_key = VerifyingKey::from(value);
        verifying_key.verify(message, &signature);
    }
}
