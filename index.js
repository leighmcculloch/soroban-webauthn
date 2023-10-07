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
          id: new TextEncoder().encode("Soroban Test"),
          name: "Soroban Test",
          displayName: "Soroban Test",
        },
        pubKeyCredParams: [{ alg: -8, type: "public-key" }],
      },
    });
    const response = credObj.response;
    const pk = response.getPublicKey();
    const clientDataJSON = response.clientDataJSON;
    const authenticatorData = response.authenticatorData;
    const signature = response.signature;

    console.log("cred", {
      pk: new Uint8Array(pk).join(","),
    });
    cred = credObj;
  }

  async function authPasskey() {
    console.log("authing passkey");
    const authObj = await navigator.credentials.get({
      publicKey: {
        challenge: Uint8Array.from("6c49a09d3bd176f17d2eb440bd726d11cc8c2ba9ad92b431b8b0923b6a8633df".match(/.{1,2}/g).map((b) => parseInt(b, 16))),
        rpId: "localhost",
        allowCredentials: [{ type: "public-key", id: cred.rawId }],
      },
    });
    const response = authObj.response;
    const clientDataJSON = response.clientDataJSON;
    const authenticatorData = response.authenticatorData;
    const signature = response.signature;

    console.log("auth", {
      authenticatorData: new Uint8Array(authenticatorData).join(","),
      clientDataJSON: new Uint8Array(clientDataJSON).join(","),
      signature: new Uint8Array(signature).join(","),
    });
  }

  main();
})();
