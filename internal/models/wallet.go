package models

import (
	"github.com/tkhq/demo-passkey-wallet/internal/db"
	"gorm.io/gorm"
)

const MAX_DROPS_PER_KEY uint8 = 10

// Represents a Turnkey private key, created by our backend on behalf of a user
// This private key is bound to a user via Turnkey Policies.
type Wallet struct {
	gorm.Model
	User            User
	UserID          int
	TurnkeyUUID     string `gorm:"size:255; not null"`
	EthereumAddress string `gorm:"size:255; not null"`
	Drops           uint8  `gorm:"default:0"`
}

func (pk *Wallet) DropsLeft() uint8 {
	if pk.Drops > MAX_DROPS_PER_KEY {
		return 0
	} else {
		return MAX_DROPS_PER_KEY - pk.Drops
	}
}

func SaveWalletForUser(u *User, walletId, address string) (*Wallet, error) {
	pk := Wallet{
		User:            *u,
		TurnkeyUUID:     walletId,
		EthereumAddress: address,
	}
	err := db.Database.Create(&pk).Error
	if err != nil {
		return nil, err
	}
	return &pk, err
}

func GetWalletForUser(u User) (*Wallet, error) {
	var wallet Wallet
	err := db.Database.Where("user_id=?", u.ID).Find(&wallet).Error
	if err != nil {
		return nil, err
	}
	return &wallet, nil
}

func RecordDropForWallet(pk *Wallet) error {
	dropsCount := pk.Drops + 1
	return db.Database.Find(pk).Update("drops", dropsCount).Error
}
