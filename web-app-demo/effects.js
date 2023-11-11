class Effects extends React.Component {
  constructor(props) {
    super(props);
    this.collectEffects = this.collectEffects.bind(this);
    this.state = {
      effectsIds: new Set(),
      effects: [],
    }
  }

  componentDidMount() {
    setInterval(this.collectEffects, 1000);
  }

  async collectEffects() {
    const resp = await (await fetch(`${this.props.horizonUrl}/effects?order=desc&limit=200`)).json();
    this.setState((prevState, props) => {
      const effectsIds = prevState.effectsIds;
      const effects = prevState.effects;
      for (const r of resp._embedded.records) {
        if (r.contract === undefined || r.contract != this.props.accountContractId) {
          continue;
        }
        if (effectsIds.has(r.id)) {
          continue;
        }
        effectsIds.add(r.id);
        effects.push(r);
      }
      return {...prevState, effectsIds, effects};
    });
  }

  render() {
    const effectsRendered = this.state.effects.toReversed().map((e) => {
    });
    return (
      <div>
        <fieldset>
          <legend>Balance Effects (from Horizon)</legend>
          <ul>
            {this.state.effects.toReversed().map((e, i) => {
              if (e.type == "contract_credited") {
                return <li key={i}>➕ {e.amount} (received from <Account {...this.props} id={e.account} />)</li>;
              } else if (e.type == "contract_debited") {
                return <li key={i}>➖ {e.amount} (sent to <Account {...this.props} id={e.account} />)</li>;
              }
              return <li key={i}>{e.type}</li>;
            })}
          </ul>
        </fieldset>
      </div>
    );
  }
}
