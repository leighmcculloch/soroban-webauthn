class Refund extends React.Component {
  constructor(props) {
    super(props);
    this.handleRefund = this.handleRefund.bind(this);
  }

  async handleRefund() {
    this.props.onLog(<span>⏳ Refunding...</span>);

    const argWasmHash = this.hexToUint8Array(this.wasmHash());

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

    const signatureRaw = new Uint8Array(credentialAuth.response.signature);
    this.props.onLog(<span>ℹ️ Signature (Raw): <code>{[...signatureRaw].map(x => x.toString(16).padStart(2, '0')).join('')}</code></span>);
    const signature = this.convertSignatureWebauthnToCompact(signatureRaw);
    this.props.onLog(<span>ℹ️ Signature (Compact): <code>{[...signature].map(x => x.toString(16).padStart(2, '0')).join('')}</code></span>);

    const op = StellarSdk.Operation.invokeHostFunction({
      func: StellarSdk.xdr.HostFunction.hostFunctionTypeInvokeContract(invocationArgs),
      auth: [new StellarSdk.xdr.SorobanAuthorizationEntry({
        rootInvocation: invocation,
        credentials: StellarSdk.xdr.SorobanCredentials.sorobanCredentialsAddress(
          new StellarSdk.xdr.SorobanAddressCredentials({
           address: StellarSdk.Address.fromString(this.props.accountContractId).toScAddress(),
            nonce,
            signatureExpirationLedger,
            signature: StellarSdk.xdr.ScVal.scvMap([
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
                val: StellarSdk.xdr.ScVal.scvBytes(signature),
              }),
            ])
          })
        ),
      })],
    });

    const transaction = new StellarSdk.TransactionBuilder(
      new StellarSdk.Account(key.publicKey(), accResp.sequence),
      { fee: 505851, networkPassphrase: this.props.networkPassphrase },
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
              new StellarSdk.xdr.LedgerKeyContractCode({ hash: argWasmHash })
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
          // 285068193, // Instructions
          5018531,
          // 34408, // Read Bytes
          6344,
          440, // Write Bytes
        )
        .setResourceFee(205851)
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

  convertSignatureWebauthnToCompact(sig) {
    // Webauthn provides the signature in different formats depending on the
    // algorithm in use.
    switch (this.props.credential.response.getPublicKeyAlgorithm()) {
      case -8:
        // Signature is the raw signature for ed25519.
        return sig;
      case -7:
        // Signature is the ASN encoded signature for ecdsa.
        return this.convertEcdsaSignatureAsnToCompact(sig);
    }
  }

  convertEcdsaSignatureAsnToCompact(sig) {
    // ASN Sequence
    let offset = 0;
    if (sig[offset] != 0x30) {
      throw "signature is not a sequence";
    }
    offset += 1;

    // ASN Sequence Byte Length
    offset += 1;

    // ASN Integer (R)
    if (sig[offset] != 0x02) {
      throw "first element in sequence is not an integer";
    }
    offset += 1;
    // ASN Integer (R) Byte Length
    const rLen = sig[offset];
    offset += 1;
    // ASN Integer (R) Byte Value
    if (rLen >= 33) {
      if (rLen != 33 || sig[offset] != 0x00) {
        throw "can only handle larger than 32 byte R's that are len 33 and lead with zero";
      }
      offset += 1;
    }
    const r = sig.slice(offset, offset+32);
    offset += 32;

    // ASN Integer (S)
    if (sig[offset] != 0x02) {
      throw "second element in sequence is not an integer";
    }
    offset += 1;
    // ASN Integer (S) Byte Length
    const sLen = sig[offset];
    offset += 1;
    // ASN Integer (S) Byte Value
    if (sLen >= 33) {
      if (sLen != 33 || sig[offset] != 0x00) {
        throw "can only handle larger than 32 byte R's that are len 33 and lead with zero";
      }
      offset += 1;
    }
    const s = sig.slice(offset, offset+32);
    offset += 32;

    const signature64 = new Uint8Array([...r, ...s]);
    return signature64;
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
