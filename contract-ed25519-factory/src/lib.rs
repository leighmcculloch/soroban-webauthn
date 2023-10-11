#![no_std]
use soroban_sdk::{contract, contractimpl, symbol_short, vec, Address, BytesN, Env};

#[contract]
pub struct Contract;

#[contractimpl]
impl Contract {
    pub fn deploy(e: Env, pk: BytesN<32>, wasm_hash: BytesN<32>) -> Address {
        let address = e
            .deployer()
            .with_current_contract(pk.clone())
            .deploy(wasm_hash);
        let () = e.invoke_contract(&address, &symbol_short!("init"), vec![&e, pk.to_val()]);
        address
    }
}
