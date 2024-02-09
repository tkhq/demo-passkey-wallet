# Override nonce

This is a utility script for internal usage that can help unblock the warchest wallet in cases of high transaction volume on Sepolia.

## Usage

First, copy `.env.example` as `.env`, and fill in the required variables.

`go run internal/scripts/override_nonce/main.go <desired nonce>`

In other words, if a transaction with the nonce 5 is stuck, you would run `go run internal/scripts/override_nonce/main.go 5`
