serve:
	deno run --allow-net --allow-read https://deno.land/std/http/file_server.ts

build:
	cd contract && soroban contract build
