package models

import (
	"github.com/tkhq/demo-passkey-wallet/internal/db"
	"gorm.io/gorm"
)

// Represents a Turnkey private key, created by our backend on behalf of a user
// This private key is bound to a user via Turnkey Policies.
type TurnkeyPrivateKey struct {
	gorm.Model
	User            User
	UserID          int
	Name            string `gorm:"size:255; not null;"`
	TurnkeyUUID     string `gorm:"size:255; not null"`
	EthereumAddress string `gorm:"size:255; not null"`
}

func (key *TurnkeyPrivateKey) Save() (*TurnkeyPrivateKey, error) {
	err := db.Database.Create(&key).Error
	if err != nil {
		return &TurnkeyPrivateKey{}, err
	}
	return key, nil
}

func GetPrivateKeyForUser(u User) (*TurnkeyPrivateKey, error) {
	var privateKey TurnkeyPrivateKey
	err := db.Database.Where("user_id=?", u.ID).Find(&privateKey).Error
	if err != nil {
		return nil, err
	}
	return &privateKey, nil
}
