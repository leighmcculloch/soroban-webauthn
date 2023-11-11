class CredentialCreate extends React.Component {
  constructor(props) {
    super(props);
    this.handleCreateKey = this.handleCreateKey.bind(this);
    this.state = {
      credential: null,
    };
  }

  async handleCreateKey() {
    this.props.onLog(`⏳ Requesting credential...`);
    try {
      const credential = await navigator.credentials.create({
        publicKey: {
          challenge: new TextEncoder().encode("createchallenge"),
          rp: {
            name: "Passkey Test",
          },
          user: {
            id: new TextEncoder().encode("Soroban Test"),
            name: "Soroban Test",
            displayName: "Soroban Test",
          },
          pubKeyCredParams: [
            { alg: -8, type: "public-key" }, // eddsa ed25519
            { alg: -7, type: "public-key" }, // ecdsa secp256r1
          ],
        },
      });
      this.props.onLog(<span>✅ Credential created: <Credential credential={credential} /></span>);
      this.setState({ credential: credential });
      this.props.onCredential(credential);
    } catch(err) {
      this.props.onLog(`❌ Error: ${err}`);
    }
  }

  render() {
    return (
      <div>
        <fieldset>
          <legend>Credential</legend>
          {this.state.credential
            ? <span>Public Key: <Credential credential={this.state.credential} /></span>
            : <span><button onClick={this.handleCreateKey}>Create Credential</button></span>}
        </fieldset>
      </div>
    );
  }
}
