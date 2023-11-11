# Soroban Webauthn Account Contract

| :warning: Code in this repo is demo material only. It has not been audited. Do not use to hold, protect, or secure anything. |
|-----------------------------------------|

This repo contains [Soroban] contracts that demonstrate account abstraction on [Stellar], by supporting [Webauthn].

Contracts:

- `contract-factory` – A Soroban factory contract that deploys and initializes new deployments of webauthn contract accounts.
- `contract-ed25519` – A Soroban account contract that is initialized with a ed25519 public key for a Webauthn device (passkey from a browser, computer, phone, Yubikey, etc). This contract acts as an account on network, holding assets, etc, and is controlled by the Webauthn device's signatures.


In the root of the repository is a demo web application deployed at https://leighmcculloch.github.io/soroban-webauthn. The demo interacts with the Stellar Test Network. The demo registers a device for webauthn, deploys an account contract for the device, and performs some transactions with it.

https://github.com/leighmcculloch/soroban-webauthn/assets/351529/b326562a-cadf-40db-aa75-f2823c8d2554

[Stellar]: https://stellar.org
[Soroban]: https://soroban.stellar.org
[Webauthn]: https://www.w3.org/TR/webauthn-2/
