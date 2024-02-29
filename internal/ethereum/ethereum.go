package ethereum

import (
	"context"
	"encoding/hex"
	"fmt"
	"math/big"
	"os"

	"github.com/pkg/errors"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/params"
	"github.com/ethereum/go-ethereum/rlp"
)

var Client *ethclient.Client

func Init() {
	var err error
	infuraApiKey := os.Getenv("INFURA_API_KEY")
	infuraUrl := fmt.Sprintf("https://sepolia.infura.io/v3/%s", infuraApiKey)

	Client, err = ethclient.Dial(infuraUrl)
	if err != nil {
		panic(err)
	} else {
		fmt.Println("Successfully connected to Infura")
	}
}

func GetBalance(addressString string) (*big.Int, error) {
	address := parseAddress(addressString)
	ctx := context.Background()
	balance, err := Client.BalanceAt(ctx, address, nil)
	if err != nil {
		return nil, errors.Wrap(err, "error while fetching balance from Infura")
	}
	return balance, nil
}

func ConstructTransfer(from string, to string, amount *big.Int, nonce *uint64) ([]byte, error) {
	ctx := context.Background()
	fromAddress := parseAddress(from)
	toAddress := parseAddress(to)

	// Additional context on gas parameters can be found here:
	// https://github.com/ethereum/pm/issues/328#issuecomment-853612573
	gasPrice, err := Client.SuggestGasPrice(ctx)
	if err != nil {
		return []byte{}, errors.Wrapf(err, "cannot fetch suggested gas price")
	}

	gasTipCap, err := Client.SuggestGasTipCap(ctx)
	if err != nil {
		return []byte{}, errors.Wrapf(err, "cannot fetch suggested gas tip cap")
	}

	// Double both the gas price and tip for timely execution
	multipliedGasPrice := new(big.Int).Mul(gasPrice, big.NewInt(2))
	multipliedGasTip := new(big.Int).Mul(gasTipCap, big.NewInt(2))

	// Ensure gas price >= gas tip
	if multipliedGasTip.Cmp(multipliedGasPrice) == 1 {
		multipliedGasPrice = multipliedGasTip
	}

	var suggestedNonce uint64
	if nonce != nil {
		suggestedNonce = *nonce
	} else {
		suggestedNonce, err = Client.PendingNonceAt(ctx, fromAddress)
		if err != nil {
			return []byte{}, errors.Wrapf(err, "cannot fetch nonce for address %s", from)
		}
	}

	gasLimit := uint64(21000)

	return messageToSign(types.NewTx(&types.DynamicFeeTx{
		ChainID:   params.SepoliaChainConfig.ChainID,
		Nonce:     suggestedNonce,
		GasFeeCap: multipliedGasPrice,
		GasTipCap: multipliedGasTip,
		Gas:       gasLimit,
		To:        &toAddress,
		Value:     amount,
		Data:      []byte{},
	})), nil
}

// Broadcasts a signed transaction and returns the transaction hash.
// (or an error if something goes awry)
// This function expects a hex-encoded string as input.
func BroadcastTransaction(signedTx string) (string, error) {
	signedTxBytes, err := hex.DecodeString(signedTx)
	if err != nil {
		return "", errors.Wrapf(err, "cannot decode signed tx %s", signedTx)
	}

	tx := new(types.Transaction)
	err = tx.UnmarshalBinary(signedTxBytes)
	if err != nil {
		return "", errors.Wrap(err, "cannot parse signed transaction bytes")
	}

	err = Client.SendTransaction(context.Background(), tx)
	if err != nil {
		return "", errors.Wrap(err, "error while broadcasting transaction")
	}

	return tx.Hash().Hex(), nil
}

func parseAddress(s string) common.Address {
	return common.BytesToAddress(common.FromHex(s))
}

// See https://github.com/ethereum/go-ethereum/issues/26199#issuecomment-1318777575
// Unfortunately go-ethereum does not make it easy to get the message to sign.
func messageToSign(unsignedTx *types.Transaction) []byte {
	innerRLP, _ := rlp.EncodeToBytes(
		[]interface{}{
			unsignedTx.ChainId(),
			unsignedTx.Nonce(),
			unsignedTx.GasTipCap(),
			unsignedTx.GasFeeCap(),
			unsignedTx.Gas(),
			unsignedTx.To(),
			unsignedTx.Value(),
			unsignedTx.Data(),
			unsignedTx.AccessList(),
		},
	)
	messageToSign := []byte{unsignedTx.Type()}
	messageToSign = append(messageToSign, innerRLP...)
	return messageToSign
}
