package ethereum

import (
	"context"
	"fmt"
	"github.com/pkg/errors"
	"math/big"
	"os"

	"github.com/ethereum/go-ethereum/common"
	"github.com/ethereum/go-ethereum/core/types"
	"github.com/ethereum/go-ethereum/ethclient"
	"github.com/ethereum/go-ethereum/params"
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

func ConstructTransfer(from string, to string, amount *big.Int) (*types.Transaction, error) {
	ctx := context.Background()
	fromAddress := parseAddress(from)
	toAddress := parseAddress(to)

	nonce, err := Client.PendingNonceAt(ctx, fromAddress)
	if err != nil {
		return nil, errors.Wrapf(err, "cannot fetch nonce for address %s", from)
	}

	gasLimit := uint64(21000)
	// maxPriorityFeePerGas = 2 Gwei
	tip := big.NewInt(2000000000)
	// maxFeePerGas = 20 Gwei
	feeCap := big.NewInt(20000000000)

	return types.NewTx(&types.DynamicFeeTx{
		ChainID:   params.SepoliaChainConfig.ChainID,
		Nonce:     nonce,
		GasFeeCap: feeCap,
		GasTipCap: tip,
		Gas:       gasLimit,
		To:        &toAddress,
		Value:     amount,
		Data:      []byte{},
	}), nil
}

// Broadcasts a signed transaction and returns the transaction hash.
// (or an error if something goes awry)
func BroadcastTransaction(signedTx *types.Transaction) (string, error) {
	err := Client.SendTransaction(context.Background(), signedTx)
	if err != nil {
		return "", errors.Wrap(err, "error while broadcasting transaction")
	}

	return signedTx.Hash().Hex(), nil
}

func parseAddress(s string) common.Address {
	return common.BytesToAddress(common.FromHex(s))
}
