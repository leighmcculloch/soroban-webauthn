export SOROBAN_RPC_URL=http://localhost:8000/soroban/rpc
export SOROBAN_NETWORK_PASSPHRASE=Standalone Network ; February 2017
# export SOROBAN_NETWORK_PASSPHRASE=Test SDF Network ; September 2015

serve:
	deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts

build:
	@cd contract-factory && soroban contract build --out-dir ../out
	@cd contract-ed25519 && soroban contract build --out-dir ../out
	@cd contract-secp256r1 && soroban contract build --out-dir ../out
	soroban contract optimize --wasm ./out/webauthn_account_ed25519.wasm
	soroban contract optimize --wasm ./out/webauthn_account_secp256r1.wasm
	soroban contract optimize --wasm ./out/webauthn_factory.wasm
	ls -lah out/*.wasm

deploy:
	soroban contract install --wasm out/webauthn_factory_ed25519.optimized.wasm
	soroban contract deploy --wasm out/webauthn_factory_ed25519.optimized.wasm
	soroban contract install --wasm out/webauthn_account_ed25519.optimized.wasm
	soroban contract install --wasm out/webauthn_account_secp256r1.optimized.wasm

restore:
	soroban contract restore --id CDMLFMKMMD7MWZP3FKUBZPVHTUEDLSX4BYGYKH4GCESXYHS3IHQ4EIG4 || true
	soroban contract restore --id CDZVBAAGIBC2AZ4SH6HITPS3UOFMOCBC5BTTY7LY6WCNOQ747HGW6RXK || true
	soroban contract restore --wasm-hash 4c8fa1392a052d344401ad8da9a99a66c57cbfd3871f2a2de98daa325f45512e || true
	soroban contract restore --wasm-hash a40cbcffa428add4f2ada31d904c5c03a4921e84b652b2351106f424e4aaf786 || true
	soroban contract restore --wasm-hash 1323c94e1b86558f3c08199fb3c2552121cf3b68d6d06e7987689183cac6dc5d || true
