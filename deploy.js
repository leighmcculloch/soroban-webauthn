class Deploy extends React.Component {
  constructor(props) {
    super(props);
    this.handleDeploy = this.handleDeploy.bind(this);
    this.state = {
      accountContractId: null,
    }
  }

  async handleDeploy() {
    const argWasmHash = this.hexToUint8Array(this.props.accountContractWasm);
    const argPk = new Uint8Array(this.props.credential.response.getPublicKey()).slice(12);

    const deployee = StellarSdk.StrKey.encodeContract(StellarSdk.hash(StellarSdk.xdr.HashIdPreimage.envelopeTypeContractId(
      new StellarSdk.xdr.HashIdPreimageContractId({
        networkId: StellarSdk.hash(this.props.networkPassphrase),
        contractIdPreimage: StellarSdk.xdr.ContractIdPreimage.contractIdPreimageFromAddress(
          new StellarSdk.xdr.ContractIdPreimageFromAddress({
            address: StellarSdk.Address.fromString(this.props.factoryContractId).toScAddress(),
            salt: argPk,
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
      { fee: 11055000, networkPassphrase: this.props.networkPassphrase },
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
          4535694, // Instructions
          3472, // Read Bytes
          160, // Write Bytes
        )
        .setRefundableFee(20058)
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
          Account Contract WASM Hash: <Hash {...this.props} id={this.props.accountContractWasm} /><br/>
          {this.state.accountContractId
            && <span>Account Contract ID: <Contract {...this.props} id={this.state.accountContractId} /></span>
            || <button onClick={this.handleDeploy} disabled={this.props.bundlerKey == null || this.props.credential == null}>Deploy</button>}
        </fieldset>
      </div>
    );
  }

  hexToUint8Array(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  }
}
