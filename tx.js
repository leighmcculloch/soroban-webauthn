class Tx extends React.Component {
  constructor(props) {
    super(props);
    this.state = {
      id: props.id,
    }
    if (this.state.id instanceof Uint8Array) {
      this.state.id = [...this.state.id].map(x => x.toString(16).padStart(2, '0')).join('');
    }
  }

  render() {
    if (this.props.id && this.props.explorerTxBaseUrl != "") {
      return <code><a
          href={`${this.props.explorerTxBaseUrl}/${this.state.id}`}
          target="_blank"
          rel="noopener noreferrer">
            {this.state.id.slice(0, 6)}
        </a></code>;
    } else if (this.state.id) {
      return <code>{this.state.id}</code>
    } else {
      return null;
    }
  }
}

