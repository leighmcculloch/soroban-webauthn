use crate::{Contract, ContractClient, Error, Signature};
use soroban_sdk::{testutils::Address, vec, Bytes, BytesN, Env, IntoVal};

#[test]
fn test_init_and_check_auth() {
    let e = Env::default();
    let contract_id = e.register_contract(None, Contract);
    let client = ContractClient::new(&e, &contract_id);

    let signature_payload = BytesN::from_array(&e, &[0u8; 32]);
    let pk = BytesN::from_array(
        &e,
        &[
            12, 240, 143, 208, 161, 74, 95, 35, 19, 113, 56, 111, 100, 231, 114, 209, 54, 72, 84,
            76, 111, 114, 137, 126, 176, 159, 163, 80, 59, 50, 15, 192,
        ],
    );

    client.init(&pk);

    let authenticator_data = Bytes::from_array(
        &e,
        &[
            73, 150, 13, 229, 136, 14, 140, 104, 116, 52, 23, 15, 100, 118, 96, 91, 143, 228, 174,
            185, 162, 134, 50, 199, 153, 92, 243, 186, 131, 29, 151, 99, 1, 0, 0, 0, 5,
        ],
    );
    let client_data_json = Bytes::from_array(
        &e,
        &[
            123, 34, 116, 121, 112, 101, 34, 58, 34, 119, 101, 98, 97, 117, 116, 104, 110, 46, 103,
            101, 116, 34, 44, 34, 99, 104, 97, 108, 108, 101, 110, 103, 101, 34, 58, 34, 65, 65,
            65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65,
            65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 65, 34, 44, 34,
            111, 114, 105, 103, 105, 110, 34, 58, 34, 104, 116, 116, 112, 58, 47, 47, 108, 111, 99,
            97, 108, 104, 111, 115, 116, 58, 52, 53, 48, 55, 34, 44, 34, 99, 114, 111, 115, 115,
            79, 114, 105, 103, 105, 110, 34, 58, 102, 97, 108, 115, 101, 125,
        ],
    );
    let signature = BytesN::from_array(
        &e,
        &[
            142, 91, 250, 143, 24, 242, 153, 104, 6, 133, 198, 70, 76, 100, 165, 36, 124, 203, 190,
            127, 99, 233, 21, 209, 107, 10, 120, 53, 103, 210, 42, 248, 14, 156, 229, 165, 134, 33,
            2, 15, 117, 234, 252, 4, 26, 149, 5, 146, 120, 22, 91, 135, 235, 227, 65, 105, 104, 24,
            40, 241, 200, 215, 218, 5,
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
