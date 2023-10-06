(async function () {
  let cred = undefined;

  async function main() {
    check();

    document.getElementById("create-passkey").addEventListener(
      "click",
      createPasskey,
    );
    document.getElementById("auth-with-passkey").addEventListener(
      "click",
      authPasskey,
    );
  }

  async function check() {
    if (
      window.PublicKeyCredential &&
      PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable &&
      PublicKeyCredential.isConditionalMediationAvailable
    ) {
      const results = await Promise.all([
        PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable(),
        PublicKeyCredential.isConditionalMediationAvailable(),
      ]);
      if (results.every((r) => r === true)) {
        console.log("passkey available");
      } else {
        console.error("passkey unavailable");
      }
    }
  }

  async function createPasskey() {
    console.log("creating passkey");
    const credObj = await navigator.credentials.create({
      publicKey: {
        challenge: new TextEncoder().encode("createchallenge"),
        rp: {
          name: "Passkey Test",
          id: "localhost",
        },
        user: {
          id: new TextEncoder().encode("test1"),
          name: "test1",
          displayName: "Test 1",
        },
        pubKeyCredParams: [{ alg: -8, type: "public-key" }],
      },
    });
    const response = credObj.response;
    const pk = response.getPublicKey();

    console.log("cred", {
      pk: btoa(
        String.fromCharCode.apply(null, new Uint8Array(pk)),
      ),
    });
    cred = credObj;
  }

  async function authPasskey() {
    console.log("authing passkey");
    const authObj = await navigator.credentials.get({
      publicKey: {
        challenge: new TextEncoder().encode("authchallenge000"),
        rpId: "localhost",
        allowCredentials: [{ type: "public-key", id: cred.rawId }],
      },
    });
    const response = authObj.response;
    const clientDataJSON = response.clientDataJSON;
    const authenticatorData = response.authenticatorData;
    const signature = response.signature;

    console.log("auth", {
      clientDataJSON,
      clientDataJSONBytes: btoa(
        String.fromCharCode.apply(null, new Uint8Array(clientDataJSON)),
      ),
      authenticatorData,
      authenticatorDataBytes: btoa(
        String.fromCharCode.apply(null, new Uint8Array(authenticatorData)),
      ),
      signature: btoa(
        String.fromCharCode.apply(null, new Uint8Array(signature)),
      ),
    });
  }

  main();
})();
