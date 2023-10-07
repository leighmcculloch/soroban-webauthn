serve:
	deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts

build:
	@cd contract-ed25519 \
		&& soroban contract build --out-dir ./out \
		&& soroban contract optimize --wasm ./out/webauthn_account_ed25519.wasm \
		&& ls -lah ./out/*.wasm
