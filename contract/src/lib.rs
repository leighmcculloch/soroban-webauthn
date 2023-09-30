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
    use soroban_sdk::Env;

    use crate::{Contract, ContractClient};

    #[test]
    fn test_hello() {
        let e = Env::default();
        let contract_id = e.register_contract(None, Contract);
        let client = ContractClient::new(&e, &contract_id);

        client.empty();
    }
}
