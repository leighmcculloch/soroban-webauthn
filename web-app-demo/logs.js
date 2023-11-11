class Logs extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    return (
      <div>
        <fieldset>
          <legend>Logs</legend>
          <ul>
            {this.props.logs.map((l, i) => <li key={i}>{l}</li>)}
          </ul>
        </fieldset>
      </div>
    );
  }
}
