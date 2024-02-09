package main

import (
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"os"
	"strconv"

	"github.com/joho/godotenv"
	"github.com/pkg/errors"
	"github.com/tkhq/demo-passkey-wallet/internal/ethereum"
	"github.com/tkhq/demo-passkey-wallet/internal/turnkey"
)

func main() {
	err := godotenv.Load(".env")
	if err != nil {
		log.Fatalf("Error loading .env file: %s", err.Error())
	}

	ethereum.Init()

	err = turnkey.Init(
		os.Getenv("TURNKEY_API_HOST"),
		os.Getenv("TURNKEY_API_PRIVATE_KEY"),
		os.Getenv("TURNKEY_ORGANIZATION_ID"),
	)
	if err != nil {
		log.Fatalf("Unable to initialize Turnkey client: %+v", err)
	}

	userID, err := turnkey.Client.Whoami()
	if err != nil {
		log.Fatalf("Unable to use Turnkey client for whoami request: %+v", err)
	}

	turnkeyWarchestOrganizationId := os.Getenv("TURNKEY_WARCHEST_ORGANIZATION_ID")
	turnkeyWarchestPrivateKeyId := os.Getenv("TURNKEY_WARCHEST_PRIVATE_KEY_ID")
	if turnkeyWarchestOrganizationId == "" || turnkeyWarchestPrivateKeyId == "" || err != nil {
		log.Fatal("Cannot find configuration for Turnkey Warchest org or private key ID! Drop functionality depends on it")
	}
	turnkeyWarchestPrivateKeyAddress, err := turnkey.Client.GetEthereumAddress(turnkeyWarchestOrganizationId, turnkeyWarchestPrivateKeyId)
	if err != nil {
		log.Fatalf("Unable to get Turnkey Warchest address: %s", err.Error())
	}

	fmt.Printf("Initialized Turnkey client successfully. Turnkey API User UUID: %s\n", userID)

	desiredNonce := os.Args[1]
	nonce, err := strconv.ParseUint(desiredNonce, 10, 64)
	if err != nil {
		log.Fatalf(errors.Wrap(err, "unable to parse nonce").Error())
	}

	// Self-transfer
	zeroValueTx, err := ethereum.ConstructTransfer(turnkeyWarchestPrivateKeyAddress, turnkeyWarchestPrivateKeyAddress, big.NewInt(0), &nonce)
	if err != nil {
		log.Fatalf(errors.Wrap(err, "unable to construct dummy transfer").Error())
	}

	signedTx, err := turnkey.Client.SignTransaction(turnkeyWarchestOrganizationId, turnkeyWarchestPrivateKeyId, hex.EncodeToString(zeroValueTx))
	if err != nil {
		log.Fatalf(errors.Wrap(err, "unable to sign dummy transfer").Error())
		return
	}

	txHash, err := ethereum.BroadcastTransaction(signedTx)
	if err != nil {
		log.Fatalf(errors.Wrap(err, "unable to broadcast dummy transfer").Error())
	}

	fmt.Printf("broadcasted tx: %v\n", txHash)
}
