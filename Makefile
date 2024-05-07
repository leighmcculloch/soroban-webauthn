# Usage:
#
# Set the following env vars with appropriate values before running the deploy
# command.
#
# export SOROBAN_RPC_URL=http://localhost:8000/soroban/rpc
# export SOROBAN_NETWORK_PASSPHRASE=Standalone Network ; February 2017
# export SOROBAN_ACCOUNT=me

serve:
	cd web-app-demo && deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts

build:
	@cd contract-webauthn-factory && soroban contract build --out-dir ../out
	@cd contract-webauthn-ed25519 && soroban contract build --out-dir ../out
	@cd contract-webauthn-secp256r1 && soroban contract build --out-dir ../out

	soroban contract optimize --wasm ./out/webauthn_factory.wasm
	soroban contract optimize --wasm ./out/webauthn_account_ed25519.wasm
	soroban contract optimize --wasm ./out/webauthn_account_secp256r1.wasm

	@ls -lah out/*.optimized.wasm
	@shasum -a 256 ./out/*.optimized.wasm

deploy:
	soroban contract deploy --wasm out/webauthn_factory.optimized.wasm
	soroban contract install --wasm out/webauthn_account_ed25519.optimized.wasm
	soroban contract install --wasm out/webauthn_account_secp256r1.optimized.wasm
