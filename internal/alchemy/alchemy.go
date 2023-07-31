package alchemy

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sort"
	"strconv"
	"strings"

	"github.com/pkg/errors"
)

type Transfer struct {
	Type        string `json:"type"`
	Source      string `json:"source"`
	Destination string `json:"destination"`
	Amount      string `json:"amount"`
	Hash        string `json:"hash"`
	Block       int64  `json:"block"`
}

// Sample result:
//
//	{
//	 "jsonrpc": "2.0",
//	 "id": 0,
//	 "result": {
//	   "transfers": [
//	     {
//	       "blockNum": "0x3c5dc2",
//	       "uniqueId": "0xe80924bdd25694c272eebbfb5f1566c26dcca4c79260124e5b2a10c9872a41c3:external",
//	       "hash": "0xe80924bdd25694c272eebbfb5f1566c26dcca4c79260124e5b2a10c9872a41c3",
//	       "from": "0x12e59115191d91e6e901645cfc8b7686bb7c7dfe",
//	       "to": "0x08d2b0a37f869ff76bacb5bab3278e26ab7067b7",
//	       "value": 0.02,
//	       "erc721TokenId": null,
//	       "erc1155Metadata": null,
//	       "tokenId": null,
//	       "asset": "ETH",
//	       "category": "external",
//	       "rawContract": {
//	         "value": "0x470de4df820000",
//	         "address": null,
//	         "decimal": "0x12"
//	       }
//	     }
//	   ]
//	 }
//	}
type AlchemyResult struct {
	Result AlchemyTransfers
}

type AlchemyTransfers struct {
	Transfers []*AlchemyTransaction
}

type AlchemyTransaction struct {
	Hash     string
	From     string
	To       string
	Value    float32
	BlockNum string
}

func TransactionHistory(address string) ([]*Transfer, error) {
	deposits, err := listTransfers("", address)
	if err != nil {
		return []*Transfer{}, errors.Wrapf(err, "error while listing deposits for address %s", address)
	}

	withdrawals, err := listTransfers(address, "")
	if err != nil {
		return []*Transfer{}, errors.Wrapf(err, "error while listing withdrawals for address %s", address)
	}

	// Merge deposits and withdrawals, and sort them by block number
	transfersList := append(deposits, withdrawals...)
	sort.Slice(transfersList, func(i, j int) bool {
		return transfersList[i].Block < transfersList[j].Block
	})

	return transfersList, nil
}

func listTransfers(from, to string) ([]*Transfer, error) {
	alchemyApiKey := os.Getenv("ALCHEMY_API_KEY")
	if alchemyApiKey == "" {
		log.Fatal("ALCHEMY_API_KEY is not set")
	}
	url := fmt.Sprintf("https://eth-sepolia.g.alchemy.com/v2/%s", alchemyApiKey)

	var body string
	if from != "" {
		body = strings.TrimSpace(fmt.Sprintf(`{
			"jsonrpc": "2.0",
			"id": 0,
			"method": "alchemy_getAssetTransfers",
			"params": [
			  {
				"fromAddress": %q,
				"category": ["external"]
			  }
			]
		}`, from))
	}
	if to != "" {
		body = strings.TrimSpace(fmt.Sprintf(`{
			"jsonrpc": "2.0",
			"id": 0,
			"method": "alchemy_getAssetTransfers",
			"params": [
			  {
				"toAddress": %q,
				"category": ["external"]
			  }
			]
		}`, to))
	}

	req, err := http.NewRequest("POST", url, bytes.NewBuffer([]byte(body)))
	if err != nil {
		return []*Transfer{}, errors.Wrap(err, "error while creating http POST request for tx history")
	}
	req.Header.Set("Content-Type", "application/json")

	client := &http.Client{}
	resp, err := client.Do(req)
	if err != nil {
		return []*Transfer{}, errors.Wrap(err, "error while requesting tx history")
	}
	defer resp.Body.Close()

	responseBody, _ := io.ReadAll(resp.Body)
	if resp.StatusCode != 200 {
		return []*Transfer{}, fmt.Errorf("expected OK status. Got %s (%s)", resp.Status, responseBody)

	}

	var parsedResult AlchemyResult
	err = json.Unmarshal(responseBody, &parsedResult)
	if err != nil {
		return []*Transfer{}, errors.Wrapf(err, "cannot unmarshal response body: %s", responseBody)
	}

	var transactionList []*Transfer

	for _, tx := range parsedResult.Result.Transfers {
		block, err := strconv.ParseInt(tx.BlockNum[2:], 16, 64)
		if err != nil {
			return []*Transfer{}, errors.Wrapf(err, "cannot parse block number %s", tx.BlockNum)
		}

		var txType string
		if from != "" {
			// from address specified: we're looking for withdrawals
			txType = "withdrawal"
		} else {
			// to address is not empty, which means we looked for deposits
			txType = "deposit"
		}

		transactionList = append(transactionList, &Transfer{
			Source:      tx.From,
			Destination: tx.To,
			Amount:      fmt.Sprintf("%.2f", tx.Value),
			Hash:        tx.Hash,
			Block:       block,
			Type:        txType,
		})
	}
	return transactionList, nil
}
