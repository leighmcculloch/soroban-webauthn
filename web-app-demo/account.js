class Account extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (this.props.id && this.props.explorerAccountBaseUrl != "") {
      return <code><a
          href={`${this.props.explorerAccountBaseUrl}/${this.props.id}`}
          target="_blank"
          rel="noopener noreferrer">
            {this.props.id.slice(0,4)}
        </a></code>;
    } else if (this.props.id) {
      return <code>{this.props.id}</code>
    } else {
      return <code>...</code>;
    }
  }
}
