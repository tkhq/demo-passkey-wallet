package models

import (
	"fmt"
	"html"
	"strings"

	"github.com/r-n-o/piggybank/internal/db"
	"golang.org/x/crypto/bcrypt"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Username string `gorm:"size:255;not null;unique" json:"username"`
	Password string `gorm:"size:255;not null;" json:"-"`
}

func (user *User) Save() (*User, error) {
	err := db.Database.Create(&user).Error
	if err != nil {
		return &User{}, err
	}
	return user, nil
}

func (user *User) BeforeSave(*gorm.DB) error {
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
	if err != nil {
		return err
	}
	user.Password = string(passwordHash)
	user.Username = html.EscapeString(strings.TrimSpace(user.Username))
	return nil
}

func FindUserByName(username string) (User, error) {
	var user User
	err := db.Database.Where("username=?", username).Find(&user).Error
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func (user *User) CheckPassword(password string) error {
	return bcrypt.CompareHashAndPassword([]byte(user.Password), []byte(password))
}

// Given an internal Piggybank customer name, return the name of that user on the Turnkey side
// We prefix all end-users with "piggy-user-" for convenience
func (user *User) TurnkeyName() string {
	return fmt.Sprintf("piggy-user-%s", user.Username)
}
