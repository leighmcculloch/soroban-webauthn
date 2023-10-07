use crate::{Contract, ContractClient};
use soroban_sdk::{contract, contractimpl, xdr, Address, BytesN, Env};

#[contract]
pub struct RequireAuthContract;

#[contractimpl]
impl RequireAuthContract {
    pub fn reqauth(a: Address) {
        a.require_auth();
    }
}

#[test]
fn test_custom_auth() {
    let e = Env::default();
    let id = e.register_contract(None, Contract);

    {
        let client = ContractClient::new(&e, &id);
        let pk = BytesN::from_array(
            &e,
            &[
                12, 240, 143, 208, 161, 74, 95, 35, 19, 113, 56, 111, 100, 231, 114, 209, 54, 72,
                84, 76, 111, 114, 137, 126, 176, 159, 163, 80, 59, 50, 15, 192,
            ],
        );
        client.init(&pk);
    }

    let contract_id = e.register_contract(None, RequireAuthContract);
    let client = RequireAuthContractClient::new(&e, &contract_id);
    client
        .set_auths(&[xdr::SorobanAuthorizationEntry {
            credentials: xdr::SorobanCredentials::Address(xdr::SorobanAddressCredentials {
                address: (&id).try_into().unwrap(),
                nonce: 0,
                signature_expiration_ledger: 1,
                signature: xdr::ScVal::Vec(Some(xdr::ScVec(xdr::VecM::default()))), // TODO: Set with actual signature.
            }),
            root_invocation: xdr::SorobanAuthorizedInvocation {
                function: xdr::SorobanAuthorizedFunction::ContractFn(xdr::InvokeContractArgs {
                    contract_address: contract_id.try_into().unwrap(),
                    function_name: "reqauth".try_into().unwrap(),
                    args: [(&id).try_into().unwrap()].try_into().unwrap(),
                }),
                sub_invocations: xdr::VecM::default(),
            },
        }])
        .reqauth(&id);
}
