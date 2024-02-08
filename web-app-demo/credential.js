class Credential extends React.Component {
  constructor(props) {
    super(props);
  }

  render() {
    let key = null;
    if (this.props.credential) {
      const resp = this.props.credential.response;
      key = {
        pk: [...new Uint8Array(resp.getPublicKey())].map(x => x.toString(16).padStart(2, '0')).join(''),
        pkAlg: resp.getPublicKeyAlgorithm()
      };
    }
    return (
      <code>
        {key && `${key.pk} (${this.algToName(key.pkAlg)})` || 'Not Created'}
      </code>
    );
  }

  algToName(alg) {
    switch (alg) {
      case -8: return "eddsa ed25519";
      case -7: return "ecdsa secp256r1"
    }
  }
}
