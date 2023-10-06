package main

import (
	"crypto/ed25519"
	"crypto/sha256"
	"crypto/x509"
	"encoding/base64"
	"encoding/json"
	"fmt"
)

const (
	challenge           = "authchallenge000"
	pk64                = "MCowBQYDK2VwAyEAuzNZ+sja1z74SJo4lACGRFIhJFcDHzaoKrCpo+Hje1Q="
	authenticatorData64 = "SZYN5YgOjGh0NBcPZHZgW4/krrmihjLHmVzzuoMdl2MBAAAABQ=="
	clientDataJSON64    = "eyJ0eXBlIjoid2ViYXV0aG4uZ2V0IiwiY2hhbGxlbmdlIjoiWVhWMGFHTm9ZV3hzWlc1blpUQXdNQSIsIm9yaWdpbiI6Imh0dHA6Ly9sb2NhbGhvc3Q6NDUwNyIsImNyb3NzT3JpZ2luIjpmYWxzZX0="
	signature64         = "kHu+Nt8plRV4URk0XGMjz8nRFUumsTorL+bb76EWJQlGkXuszJ6Mv2xSQ4X3KWioSovnZgOzCQWfRUH/imkOCw=="
)

func main() {
	fmt.Println("Expected Challenge:", challenge)

	msg := []byte{}
	authenticatorData, err := base64.StdEncoding.DecodeString(authenticatorData64)
	if err != nil {
		panic(err)
	}
	msg = append(msg, authenticatorData...)
	clientDataJSON, err := base64.StdEncoding.DecodeString(clientDataJSON64)
	if err != nil {
		panic(err)
	}
	clientData := struct {
		Challenge string `json:"challenge"`
	}{}
	err = json.Unmarshal(clientDataJSON, &clientData)
	if err != nil {
		panic(err)
	}
	challengeDecoded, err := base64.RawURLEncoding.DecodeString(clientData.Challenge)
	if err != nil {
		panic(err)
	}
	fmt.Println("Challenge:", string(challengeDecoded))
	clientDataHash := sha256.Sum256(clientDataJSON)
	msg = append(msg, clientDataHash[:]...)

	pkBytes, err := base64.StdEncoding.DecodeString(pk64)
	if err != nil {
		panic(err)
	}
	pkUntyped, err := x509.ParsePKIXPublicKey(pkBytes)
	if err != nil {
		panic(err)
	}
	pk := pkUntyped.(ed25519.PublicKey)
	fmt.Printf("PK: %02x\n", pk)

	sig, err := base64.StdEncoding.DecodeString(signature64)
	if err != nil {
		panic(err)
	}
	fmt.Println("Sig len:", len(sig))
	verified := ed25519.Verify(pk, msg[:], sig)
	fmt.Println(verified)
}
