package models

import (
	"github.com/tkhq/demo-passkey-wallet/internal/db"
	"gorm.io/gorm"
)

// Represents a Turnkey private key, created by our backend on behalf of a user
// This private key is bound to a user via Turnkey Policies.
type PrivateKey struct {
	gorm.Model
	User            User
	UserID          int
	TurnkeyUUID     string `gorm:"size:255; not null"`
	EthereumAddress string `gorm:"size:255; not null"`
}

func SavePrivateKeyForUser(u *User, privateKeyId, address string) (*PrivateKey, error) {
	pk := PrivateKey{
		User:            *u,
		TurnkeyUUID:     privateKeyId,
		EthereumAddress: address,
	}
	err := db.Database.Create(&pk).Error
	if err != nil {
		return nil, err
	}
	return &pk, err
}

func GetPrivateKeyForUser(u User) (*PrivateKey, error) {
	var privateKey PrivateKey
	err := db.Database.Where("user_id=?", u.ID).Find(&privateKey).Error
	if err != nil {
		return nil, err
	}
	return &privateKey, nil
}
