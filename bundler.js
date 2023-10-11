class Bundler extends React.Component {
  constructor(props) {
    super(props);
    this.onLog = props.onLog;
    this.componentDidMount = this.componentDidMount.bind(this);
    this.createBundler = this.createBundler.bind(this);
    this.updateBalance = this.updateBalance.bind(this);
    this.state = {
      key: null,
      balance: null,
    };
  }

  async componentDidMount() {
    await this.createBundler();
    setInterval(this.updateBalance, 1000);
  }

  async createBundler() {
    const key = StellarSdk.Keypair.random();
    this.onLog(<span>ℹ️ Generated bundler key: <Account {...this.props} id={key.publicKey()} /></span>)
    this.onLog("⏳ Creating bundler account...")
    const resp = await (await fetch(`${this.props.friendbotUrl}/?addr=${key.publicKey()}`)).json();
    this.onLog(<span>ℹ️ Created bundler: <Account {...this.props} id={key.publicKey()} /> with tx: <Tx id={resp.id} /></span>)
    this.setState({ ...this.state, key });
    this.props.onBundlerAccountCreated(key);
  }

  async updateBalance() {
    const resp = await (await fetch(`${this.props.horizonUrl}/accounts/${this.state.key.publicKey()}`)).json();
    this.setState({ ...this.state, balance: resp.balances[0].balance });
  }

  render() {
    return (
      <div>
        <fieldset>
          <legend>Bundler</legend>
          Account: <Account {...this.props} id={this.state.key?.publicKey()} /><br/>
          Balance: <code>{this.state.balance || "..."}</code>
        </fieldset>
      </div>
    );
  }
}
