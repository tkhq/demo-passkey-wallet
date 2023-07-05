package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/tkhq/piggybank/internal/auth"
	"github.com/tkhq/piggybank/internal/models"
	"github.com/tkhq/piggybank/internal/turnkey"
)

func HandleGetWallet(c *gin.Context) {
	status, err := auth.GetAuthStatus(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
		return
	}
	if status.LoggedIn {
		user, err := models.FindUserByName(status.Username)
		if err != nil {
			c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
			return
		}
		apiUser, err := models.FindApiUser(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
			return
		}
		privateKey, err := models.FindPrivateKey(user)
		if err != nil {
			c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
			return
		}

		c.HTML(http.StatusOK, "wallet.tmpl.html", gin.H{
			"loggedIn":            status.LoggedIn,
			"username":            status.Username,
			"privateKeyId":        privateKey.TurnkeyUUID,
			"ethereumAddress":     privateKey.EthereumAddress,
			"encryptedPrivateKey": apiUser.EncryptedPrivateKey,
		})
	} else {
		c.Redirect(http.StatusTemporaryRedirect, "/")
	}
}

func HandlePostWalletCreate(c *gin.Context) {
	status, err := auth.GetAuthStatus(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
		return
	}

	publicKey := c.PostForm("publicKey")
	encryptedPrivateKey := c.PostForm("encryptedPrivateKey")

	if status.LoggedIn {
		err := setupTurnkeyWallet(status.Username, publicKey, encryptedPrivateKey)
		if err != nil {
			c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
			return
		}

		c.JSON(http.StatusOK, map[string]interface{}{})
	} else {
		// User isn't logged in, simply error out
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": "user is not logged in"})
	}
}

// Helper function to create a new API user and set them up with Turnkey.
// This inserts a new record in the Piggy bank DB and creates a new Turnkey API user
// The Turnkey API user ID is persisted in the PiggyBank DB.
// We then create a private key for this user, linked via Turnkey policies
func setupTurnkeyWallet(username, publicKey, encryptedPrivateKey string) error {
	user, err := models.FindUserByName(username)
	if err != nil {
		return err
	}

	turnkeyApiUserID, err := turnkey.Client.CreateApiUser(user.TurnkeyName(), publicKey)
	if err != nil {
		return err
	}

	apiUser := models.TurnkeyApiUser{
		User:                user,
		PublicKey:           publicKey,
		EncryptedPrivateKey: encryptedPrivateKey,
		TurnkeyUUID:         turnkeyApiUserID,
	}
	_, err = apiUser.Save()
	if err != nil {
		return err
	}

	privateKeyName := fmt.Sprintf("Private key for user %s", username)
	privateKeyId, err := turnkey.Client.CreatePrivateKey(privateKeyName)
	if err != nil {
		return err
	}
	ethereumAddress, err := turnkey.Client.GetEthereumAddress(privateKeyId)
	if err != nil {
		return err
	}

	policyId, err := turnkey.Client.BindUserToPrivateKey(turnkeyApiUserID, privateKeyId)
	if err != nil {
		return err
	}

	privateKey := models.TurnkeyPrivateKey{
		User:              user,
		Name:              privateKeyName,
		TurnkeyUUID:       privateKeyId,
		TurnkeyPolicyUUID: policyId,
		EthereumAddress:   ethereumAddress,
	}
	_, err = privateKey.Save()
	if err != nil {
		return err
	}

	return nil
}
