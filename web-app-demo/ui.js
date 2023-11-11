class Ui extends React.Component {
  constructor(props) {
    super(props);
    this.onLog = this.onLog.bind(this);
    this.onCredential = this.onCredential.bind(this);
    this.onBundlerAccountCreated = this.onBundlerAccountCreated.bind(this);
    this.onAccountContractCreated = this.onAccountContractCreated.bind(this);
    this.state = {
      logs: [],
      bundlerKey: null,
      credential: null,
      accountContractId: null,
    };
  }

  async componentDidMount() {
    if (
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      PublicKeyCredential.isConditionalMediationAvailable
    ) {
      const results = await Promise.all([
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        PublicKeyCredential.isConditionalMediationAvailable(),
      ]);
      if (!results.every((r) => r === true)) {
        this.onLog("❌ Webauthn support not available")
      }
    }
  }

  onLog(l) {
    this.setState((prevState, props) => {
      return {...prevState, logs: [l].concat(prevState.logs)};
    });
  }

  onBundlerAccountCreated(key) {
    this.setState((prevState, props) => {
      return {...prevState, bundlerKey: key};
    });
  }

  onCredential(credential) {
    this.setState((prevState, props) => {
      return {...prevState, credential: credential};
    });
  }

  onAccountContractCreated(contract) {
    this.setState((prevState, props) => {
      return {...prevState, accountContractId: contract};
    });
  }

  render() {
      return (
        <div>
          <Bundler {...this.props}
            onLog={this.onLog}
            onBundlerAccountCreated={this.onBundlerAccountCreated}
            />
          <CredentialCreate {...this.props}
            onLog={this.onLog}
            onCredential={this.onCredential}
            />
          <Deploy {...this.props}
            onLog={this.onLog}
            credential={this.state.credential}
            bundlerKey={this.state.bundlerKey}
            onAccountContractCreated={this.onAccountContractCreated}
            />
          <Fund {...this.props}
            onLog={this.onLog}
            bundlerKey={this.state.bundlerKey}
            accountContractId={this.state.accountContractId}
            />
          <Refund {...this.props}
            onLog={this.onLog}
            bundlerKey={this.state.bundlerKey}
            accountContractId={this.state.accountContractId}
            credential={this.state.credential}
            />
          <div className="row">
            <div className="effects">
              <Effects {...this.props}
                accountContractId={this.state.accountContractId}
                />
            </div>
            <div className="logs">
              <Logs {...this.props} logs={this.state.logs} />
            </div>
          </div>
        </div>
      );
  }
}
