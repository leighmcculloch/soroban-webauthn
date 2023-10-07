use crate::{Contract, ContractClient};
use soroban_sdk::{contract, contractimpl, xdr, Address, BytesN, Env, IntoVal};

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
    let id = e.register_contract(&Address::from_contract_id(&[0; 32].into_val(&e)), Contract);

    {
        let client = ContractClient::new(&e, &id);
        let pk = BytesN::from_array(
            &e,
            &[
                254, 153, 90, 181, 75, 206, 112, 18, 179, 230, 212, 90, 176, 82, 167, 183, 153,
                224, 3, 155, 234, 214, 55, 115, 103, 58, 229, 127, 169, 242, 32, 27,
            ],
        );
        client.init(&pk);
    }

    let contract_id = e.register_contract(
        &Address::from_contract_id(&[1; 32].into_val(&e)),
        RequireAuthContract,
    );
    let client = RequireAuthContractClient::new(&e, &contract_id);
    client
        .set_auths(&[xdr::SorobanAuthorizationEntry {
            credentials: xdr::SorobanCredentials::Address(xdr::SorobanAddressCredentials {
                address: (&id).try_into().unwrap(),
                nonce: 0,
                signature_expiration_ledger: 1,
                signature: xdr::ScVal::Vec(Some(xdr::ScVec(
                    [xdr::ScVal::Map(Some(xdr::ScMap(
                        [
                            xdr::ScMapEntry {
                                key: xdr::ScVal::Symbol("authenticator_data".try_into().unwrap()),
                                val: xdr::ScVal::Bytes(xdr::ScBytes(
                                    [
                                        73, 150, 13, 229, 136, 14, 140, 104, 116, 52, 23, 15, 100,
                                        118, 96, 91, 143, 228, 174, 185, 162, 134, 50, 199, 153,
                                        92, 243, 186, 131, 29, 151, 99, 1, 0, 0, 0, 4,
                                    ]
                                    .try_into()
                                    .unwrap(),
                                )),
                            },
                            xdr::ScMapEntry {
                                key: xdr::ScVal::Symbol("client_data_json".try_into().unwrap()),
                                val: xdr::ScVal::Bytes(xdr::ScBytes(
                                    [
                                        123, 34, 116, 121, 112, 101, 34, 58, 34, 119, 101, 98, 97,
                                        117, 116, 104, 110, 46, 103, 101, 116, 34, 44, 34, 99, 104,
                                        97, 108, 108, 101, 110, 103, 101, 34, 58, 34, 98, 69, 109,
                                        103, 110, 84, 118, 82, 100, 118, 70, 57, 76, 114, 82, 65,
                                        118, 88, 74, 116, 69, 99, 121, 77, 75, 54, 109, 116, 107,
                                        114, 81, 120, 117, 76, 67, 83, 79, 50, 113, 71, 77, 57, 56,
                                        34, 44, 34, 111, 114, 105, 103, 105, 110, 34, 58, 34, 104,
                                        116, 116, 112, 58, 47, 47, 108, 111, 99, 97, 108, 104, 111,
                                        115, 116, 58, 52, 53, 48, 55, 34, 44, 34, 99, 114, 111,
                                        115, 115, 79, 114, 105, 103, 105, 110, 34, 58, 102, 97,
                                        108, 115, 101, 125,
                                    ]
                                    .try_into()
                                    .unwrap(),
                                )),
                            },
                            xdr::ScMapEntry {
                                key: xdr::ScVal::Symbol("signature".try_into().unwrap()),
                                val: xdr::ScVal::Bytes(xdr::ScBytes(
                                    [
                                        46, 146, 83, 205, 69, 37, 94, 181, 136, 231, 112, 215, 249,
                                        149, 112, 3, 232, 23, 105, 101, 199, 63, 99, 56, 251, 112,
                                        169, 81, 241, 162, 77, 116, 110, 109, 20, 71, 82, 122, 115,
                                        92, 114, 178, 59, 3, 244, 82, 234, 70, 105, 191, 56, 73,
                                        157, 209, 33, 0, 168, 130, 231, 136, 16, 66, 87, 15,
                                    ]
                                    .try_into()
                                    .unwrap(),
                                )),
                            },
                        ]
                        .try_into()
                        .unwrap(),
                    )))]
                    .try_into()
                    .unwrap(),
                ))),
            }),
            root_invocation: xdr::SorobanAuthorizedInvocation {
                // This invocation tree results in a signature payload of
                // 6c49a09d3bd176f17d2eb440bd726d11cc8c2ba9ad92b431b8b0923b6a8633df.
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
