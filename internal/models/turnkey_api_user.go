package models

import (
	"github.com/tkhq/piggybank/internal/db"
	"gorm.io/gorm"
)

// Represents a Turnkey API user.
// Each API user has API credentials (public/private key pair), created by Piggybank users in their browsers.
// These API credentials are encrypted to a user password. Piggybank cannot decrypt `EncryptedPrivateKey`s.
type TurnkeyApiUser struct {
	gorm.Model
	User                User
	UserId              int
	PublicKey           string `gorm:"size:255;not null;"`
	EncryptedPrivateKey string `gorm:"size:1023;not null;"`
	TurnkeyUUID         string `gorm:"size:255;"`
}

func (apiKey *TurnkeyApiUser) Save() (*TurnkeyApiUser, error) {
	err := db.Database.Create(&apiKey).Error
	if err != nil {
		return &TurnkeyApiUser{}, err
	}
	return apiKey, nil
}

func FindApiUser(u User) (*TurnkeyApiUser, error) {
	var apiUser TurnkeyApiUser
	err := db.Database.Where("user_id=?", u.ID).Find(&apiUser).Error
	if err != nil {
		return nil, err
	}
	return &apiUser, nil
}
