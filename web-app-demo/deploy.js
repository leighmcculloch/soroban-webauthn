class Deploy extends React.Component {
  constructor(props) {
    super(props);
    this.handleDeploy = this.handleDeploy.bind(this);
    this.state = {
      accountContractId: null,
    }
  }

  async handleDeploy() {
    const argWasmHash = this.hexToUint8Array(this.wasmHash());

    // This logic is what happens for ed25519 public keys.
    const argPk = this.pk();

    const salt = new Uint8Array(await crypto.subtle.digest("SHA-256", argPk));
    const deployee = StellarSdk.StrKey.encodeContract(StellarSdk.hash(StellarSdk.xdr.HashIdPreimage.envelopeTypeContractId(
      new StellarSdk.xdr.HashIdPreimageContractId({
        networkId: StellarSdk.hash(this.props.networkPassphrase),
        contractIdPreimage: StellarSdk.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new StellarSdk.xdr.ContractIdPreimageFromAddress({
            address: StellarSdk.Address.fromString(this.props.factoryContractId).toScAddress(),
            salt,
          })
       )
      })
    ).toXDR()));

    this.props.onLog(<span>⏳ Deploying account contract: <Contract id={deployee} />...</span>);

    const key = this.props.bundlerKey;
    const accResp = await (await fetch(`${this.props.horizonUrl}/accounts/${key.publicKey()}`)).json();

    const contract = new StellarSdk.Contract(this.props.factoryContractId);

    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(key.publicKey(), accResp.sequence),
      { fee: 21055000, networkPassphrase: this.props.networkPassphrase },
    ).addOperation(contract.call(
      "deploy",
      StellarSdk.xdr.ScVal.scvBytes(argPk),
      StellarSdk.xdr.ScVal.scvBytes(argWasmHash),
    )).setTimeout(30)
      .setSorobanData(new StellarSdk.SorobanDataBuilder()
        .setFootprint(
          [
            // Contract code for contract being called.
            StellarSdk.xdr.LedgerKey.contractCode(
              new StellarSdk.xdr.LedgerKeyContractCode({ hash: this.hexToUint8Array(this.props.factoryContractWasm) })
            ),
            // Contract instance for contract being called.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.contract(StellarSdk.StrKey.decodeContract(this.props.factoryContractId)).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
            // Contract code for contract being deployed.
            StellarSdk.xdr.LedgerKey.contractCode(
              new StellarSdk.xdr.LedgerKeyContractCode({ hash: argWasmHash })
            ),
          ],
          [
            // Contract instance for contract being deployed.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.contract(StellarSdk.StrKey.decodeContract(deployee)).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
          ],
        )
        .setResources(
          // 16535694, // Instructions
          1885923, // Instructions
          // 50472, // Read Bytes
          6324,
          // 1060, // Write Bytes
          196,
        )
        .setResourceFee(5908186)
        .build())
      .build();

    transaction.sign(key);
    const signed = transaction.toXDR();
    this.props.onLog(<span>ℹ️ Signed tx invoking deploy: <code>{signed}</code></span>);

    const hash = transaction.hash();
    this.props.onLog(<span>⏳ Submitting tx: <Tx {...this.props} id={hash} /></span>);
    const txResp = await (await fetch(`${this.props.horizonUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'tx': signed }),
    })).json();
    if (txResp.successful) {
      this.props.onLog(<span>✅ Transaction result: <Tx {...this.props} id={hash} /></span>);
      this.setState((prevState, props) => {
        return {...prevState, accountContractId: deployee};
      });
      this.props.onAccountContractCreated(deployee);
    } else {
      this.props.onLog(<span>❌ Transaction result: <code>{JSON.stringify(txResp, null, 2)}</code></span>);
    }
  }

  render() {
    return (
      <div>
        <fieldset>
          <legend>Account Contract</legend>
          Factory Contract WASM Hash: <Hash {...this.props} id={this.props.factoryContractWasm} /><br/>
          Factory Contract ID: <Contract {...this.props} id={this.props.factoryContractId} /><br/>
          Account Contract WASM Hash: <Hash {...this.props} id={this.wasmHash()} /><br/>
          {this.state.accountContractId
            && <span>Account Contract ID: <Contract {...this.props} id={this.state.accountContractId} /></span>
            || <button onClick={this.handleDeploy} disabled={this.props.bundlerKey == null || this.props.credential == null}>Deploy</button>}
        </fieldset>
      </div>
    );
  }

  pk() {
    const pk = new Uint8Array(this.props.credential.response.getPublicKey());
    // Strip of ASN1 DER encoding header for each key type.
    // This could do propr DER decoding, but since the header lengths are
    // predictable, it is simply truncating the prefix.
    switch (this.props.credential?.response?.getPublicKeyAlgorithm()) {
      case -8: return pk.slice(12); // ed25519 has 12 bytes of DER stuff at the start
      case -7: return pk.slice(26); // ecdsa keys have 26 bytes of DER stuff at the start
    }
  }

  wasmHash() {
    switch (this.props.credential?.response?.getPublicKeyAlgorithm()) {
      case -8: return this.props.accountEd25519ContractWasm;
      case -7: return this.props.accountSecp256r1ContractWasm;
    }
  }

  hexToUint8Array(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  }
}
