package models

import (
	"database/sql"
	"fmt"

	"github.com/pkg/errors"
	"github.com/tkhq/demo-passkey-wallet/internal/db"
	"gorm.io/gorm"
)

type User struct {
	gorm.Model
	Email             string         `gorm:"size:255;not null;unique" json:"email"`
	SubOrganizationId sql.NullString `gorm:"size:255;unique;default:null" json:"subOrganizationId"`
}

func CreateUser(email string) (*User, error) {
	if email == "" {
		return nil, errors.New("expected non-empty email to create user")
	}

	user := User{
		Email: email,
	}

	err := db.Database.Create(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

func FindUserByEmail(email string) (User, error) {
	var user User
	err := db.Database.Where("email=?", email).First(&user).Error
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func FindUserById(userId uint) (User, error) {
	var user User
	err := db.Database.Where("id=?", userId).Find(&user).Error
	if err != nil {
		return User{}, err
	}
	return user, nil
}

func FindUserBySubOrganizationId(subOrganizationId string) (User, error) {
	var user User
	err := db.Database.Where("sub_organization_id=?", subOrganizationId).Find(&user).Error
	if err != nil {
		return User{}, err
	}
	return user, nil
}

// Given an internal user name, return the name of that user on the Turnkey side
// We prefix all end-users with "wallet-user-" for convenience
func (user *User) TurnkeyName() string {
	return fmt.Sprintf("wallet-user-%s", user.Email)
}

func UpdateUserTurnkeySubOrganization(userId uint, subOrganizationId string) (*User, error) {
	if subOrganizationId == "" {
		return nil, errors.New("cannot update turnkey sub-organization to an empty ID")
	}

	user, err := FindUserById(userId)
	if err != nil {
		return nil, errors.Wrapf(err, "cannot find user with ID %q for update", userId)
	}

	user.SubOrganizationId = sql.NullString{
		String: subOrganizationId,
		Valid:  true,
	}
	err = db.Database.Save(&user).Error
	if err != nil {
		return nil, errors.Wrapf(err, "error while updating Turnkey SubOrganization to \"%s\"", subOrganizationId)
	}
	return &user, nil
}
