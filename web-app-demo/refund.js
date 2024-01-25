class Refund extends React.Component {
  constructor(props) {
    super(props);
    this.handleRefund = this.handleRefund.bind(this);
  }

  async handleRefund() {
    this.props.onLog(<span>⏳ Refunding...</span>);

    const ledgerResp = await (await fetch(`${this.props.horizonUrl}/ledgers/?order=desc&limit=1`)).json();
    const lastLedger = ledgerResp._embedded.records[0].sequence;

    const key = this.props.bundlerKey;
    const accResp = await (await fetch(`${this.props.horizonUrl}/accounts/${key.publicKey()}`)).json();

    const fnName = "transfer";
    const argFrom = StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(this.props.accountContractId).toScAddress());
    const argTo = StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(this.props.bundlerKey.publicKey()).toScAddress());
    const argAmount = StellarSdk.nativeToScVal(1000000000, { type: 'i128' });
    const invocationArgs = new StellarSdk.xdr.InvokeContractArgs({
      contractAddress: StellarSdk.Address.fromString(this.props.nativeContractId).toScAddress(),
      functionName: fnName,
      args: [argFrom, argTo, argAmount],
    });
    const invocation = new StellarSdk.xdr.SorobanAuthorizedInvocation({
      function: StellarSdk.xdr.SorobanAuthorizedFunction.sorobanAuthorizedFunctionTypeContractFn(invocationArgs),
      subInvocations: [],
    });
    const nonce = new StellarSdk.xdr.Int64(Date.now());
    const signatureExpirationLedger = lastLedger + 100;

    const authHash = StellarSdk.hash(
      StellarSdk.xdr.HashIdPreimage.envelopeTypeSorobanAuthorization(
        new StellarSdk.xdr.HashIdPreimageSorobanAuthorization({
          networkId: StellarSdk.hash(this.props.networkPassphrase),
          invocation,
          nonce,
          signatureExpirationLedger,
        })
      ).toXDR()
    );

    const credentialAuth = await navigator.credentials.get({
      publicKey: {
        challenge: new Uint8Array(authHash),
        allowCredentials: [{ type: "public-key", id: this.props.credential.rawId }],
      },
    });

    const op = StellarSdk.Operation.invokeHostFunction({
      func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(invocationArgs),
      auth: [new StellarSdk.xdr.SorobanAuthorizationEntry({
        rootInvocation: invocation,
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(
          new StellarSdk.xdr.SorobanAddressCredentials({
            address: StellarSdk.Address.fromString(this.props.accountContractId).toScAddress(),
            nonce,
            signatureExpirationLedger,
            signature: StellarSdk.xdr.ScVal.scvVec([
              StellarSdk.xdr.ScVal.scvMap([
                new StellarSdk.xdr.ScMapEntry({
                  key: StellarSdk.xdr.ScVal.scvSymbol('authenticator_data'),
                  val: StellarSdk.xdr.ScVal.scvBytes(new Uint8Array(credentialAuth.response.authenticatorData)),
                }),
                new StellarSdk.xdr.ScMapEntry({
                  key: StellarSdk.xdr.ScVal.scvSymbol('client_data_json'),
                  val: StellarSdk.xdr.ScVal.scvBytes(new Uint8Array(credentialAuth.response.clientDataJSON)),
                }),
                new StellarSdk.xdr.ScMapEntry({
                  key: StellarSdk.xdr.ScVal.scvSymbol('signature'),
                  val: StellarSdk.xdr.ScVal.scvBytes(new Uint8Array(credentialAuth.response.signature)),
                }),
              ])
            ])
          })
        ),
      })],
    });

    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(key.publicKey(), accResp.sequence),
      { fee: 901919, networkPassphrase: this.props.networkPassphrase },
    )
      .addOperation(op)
      .setTimeout(30)
      .setSorobanData(new StellarSdk.SorobanDataBuilder()
        .setFootprint(
          // Read
          [
            // Contract instance for native asset contract being called.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.fromString(this.props.nativeContractId).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
            // Contract instance for account contract.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.fromString(this.props.accountContractId).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvLedgerKeyContractInstance(),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
            // Contract code for account contracts.
            StellarSdk.xdr.LedgerKey.contractCode(
              new StellarSdk.xdr.LedgerKeyContractCode({ hash: this.hexToUint8Array(this.wasmHash()) })
            ),
          ],
          // Write
          [
            // Sender's balance.
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.fromString(this.props.nativeContractId).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvVec([
                  StellarSdk.nativeToScVal("Balance", { type: 'symbol' }),
                  StellarSdk.xdr.ScVal.scvAddress(StellarSdk.Address.fromString(this.props.accountContractId).toScAddress()),
                ]),
                durability: StellarSdk.xdr.ContractDataDurability.persistent()
              })
            ),
            // Receiver account.
            StellarSdk.xdr.LedgerKey.account(
              new StellarSdk.xdr.LedgerKeyAccount({
                accountId: this.props.bundlerKey.xdrAccountId(),
              })
            ),
            // Auth nonce for the sender (account contract).
            StellarSdk.xdr.LedgerKey.contractData(
              new StellarSdk.xdr.LedgerKeyContractData({
                contract: StellarSdk.Address.fromString(this.props.accountContractId).toScAddress(),
                key: StellarSdk.xdr.ScVal.scvLedgerKeyNonce(
                  new StellarSdk.xdr.ScNonceKey({ nonce })
                ),
                durability: StellarSdk.xdr.ContractDataDurability.temporary()
              })
            ),
          ],
        )
        .setResources(
          3480449, // Instructions
          5396, // Read Bytes
          668, // Write Bytes
        )
        .setRefundableFee(20536)
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
          <legend>Refund</legend>
          <button onClick={this.handleRefund} disabled={this.props.accountContractId == null}>Refund 100 (Bundler 👈 Account)</button>
        </fieldset>
      </div>
    );
  }

  wasmHash() {
    switch (this.props.credential.response.getPublicKeyAlgorithm()) {
      case -8: return this.props.accountEd25519ContractWasm;
      case -7: return this.props.accountSecp256r1ContractWasm;
    }
  }

  hexToUint8Array(hex) {
    return Uint8Array.from(hex.match(/.{1,2}/g).map((byte) => parseInt(byte, 16)));
  }
}
