class Fund extends React.Component {
  constructor(props) {
    super(props);
    this.handleFund = this.handleFund.bind(this);
  }

  async handleFund() {
    this.props.onLog(<span>⏳ Funding account contract: <Contract id={this.props.accountContractId} />...</span>);

    const ledgerResp = await (await fetch(`${this.props.horizonUrl}/ledgers/?order=desc&limit=1`)).json();

    const key = this.props.bundlerKey;
    const accResp = await (await fetch(`${this.props.horizonUrl}/accounts/${key.publicKey()}`)).json();

    const fnName = "transfer";
    const argFrom = StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(this.props.bundlerKey.publicKey()).toScAddress());
    const argTo = StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(this.props.accountContractId).toScAddress());
    const argAmount = StellarSdk.nativeToScVal(10000000000, { type: 'i128' });
    const invocation = new StellarSdk.xdr.InvokeContractArgs({
      contractAddress: StellarSdk.Address.fromString(this.props.nativeContractId).toScAddress(),
      functionName: fnName,
      args: [argFrom, argTo, argAmount],
    });
    const op = StellarSdk.Operation.invokeHostFunction({
      func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(invocation),
      auth: [new StellarSdk.xdr.SorobanAuthorizationEntry({
        rootInvocation: new StellarSdk.xdr.SorobanAuthorizedInvocation({
          function: StellarSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(invocation),
          subInvocations: [],
        }),
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsSourceAccount(),
      })],
    });

    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(key.publicKey(), accResp.sequence),
      { fee: 9737765, networkPassphrase: this.props.networkPassphrase },
    )
      .addOperation(op)
      .setTimeout(30)
      .setSorobanData(new StellarSdk.SorobanDataBuilder()
        .setFootprint(
          // Read
          [
            // Contract instance for contract being called.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.fromString(this.props.nativeContractId).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
          ],
          // Write
          [
            // Sender account.
            StellarSdk.xdr.LedgerKey.account(
              new StellarSdk.xdr.LedgerKeyAccount({
                accountId: this.props.bundlerKey.xdrAccountId(),
              })
            ),
            // Receiver balance.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.contract(StellarSdk.StrKey.decodeContract(this.props.nativeContractId)).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvVec([
                  StellarSdk.nativeToScVal("Balance", { type: 'symbol' }),
                  StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(this.props.accountContractId).toScAddress()),
                ]),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
          ],
        )
        .setResources(
          253289, // Instructions
          392, // Read Bytes
          368, // Write Bytes
        )
        .setResourceFee(6737765)
        .build())
      .build();

    transaction.sign(key);
    const signed = transaction.toXDR();
    this.props.onLog(<span>ℹ️ Signed tx invoking transfer: <code>{signed}</code></span>);

    const hash = transaction.hash();
    this.props.onLog(<span>⏳ Submitting tx: <Tx {...this.props} id={hash} /></span>);
    const txResp = await (await fetch(`${this.props.horizonUrl}/transactions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ 'tx': signed }),
    })).json();
    if (txResp.successful) {
      this.props.onLog(<span>✅ Transaction result: <Tx {...this.props} id={hash} /></span>);
    } else {
      this.props.onLog(<span>❌ Transaction result: <code>{JSON.stringify(txResp, null, 2)}</code></span>);
    }
  }

  render() {
    return (
      <div>
        <fieldset>
          <legend>Fund</legend>
          <button onClick={this.handleFund} disabled={this.props.accountContractId == null}>Fund 1000 (Bundler 👉 Account)</button>
        </fieldset>
      </div>
    );
  }

  hexToUint8Array(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  }
}
