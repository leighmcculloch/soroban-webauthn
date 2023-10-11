class Hash extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    if (this.props.id) {
      return <code>{this.props.id}</code>;
    } else {
      return "...";
    }
  }
}
