package main

import (
	"bytes"
	"encoding/hex"
	"fmt"
	"log"
	"math/big"
	"net/http"
	"os"
	"strconv"
	"strings"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/sessions"
	gormsessions "github.com/gin-contrib/sessions/gorm"
	"github.com/gin-gonic/gin"
	_ "github.com/heroku/x/hmetrics/onload"
	"github.com/joho/godotenv"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
	"github.com/tkhq/demo-passkey-wallet/internal/alchemy"
	"github.com/tkhq/demo-passkey-wallet/internal/db"
	"github.com/tkhq/demo-passkey-wallet/internal/ethereum"
	"github.com/tkhq/demo-passkey-wallet/internal/models"
	"github.com/tkhq/demo-passkey-wallet/internal/turnkey"
	"github.com/tkhq/demo-passkey-wallet/internal/types"
)

const SESSION_NAME = "demo_session"
const SESSION_SALT = "demo_session_salt"
const SESSION_USER_ID_KEY = "user_id"

const DROP_AMOUNT_IN_WEI = 50000000000000000
const ONE_ETH_IN_WEI = int64(1000000000000000000)

type bodyLogWriter struct {
	gin.ResponseWriter
	body *bytes.Buffer
}

func (w bodyLogWriter) Write(b []byte) (int, error) {
	w.body.Write(b)
	return w.ResponseWriter.Write(b)
}

func ginErrorLogMiddleware(c *gin.Context) {
	blw := &bodyLogWriter{body: bytes.NewBufferString(""), ResponseWriter: c.Writer}
	c.Writer = blw
	c.Next()
	statusCode := c.Writer.Status()
	if statusCode >= 500 {
		//ok this is an request with error, let's make a record for it
		// now print body (or log in your preferred way)
		log.Printf("Internal error served: %s (status: %d)\n", blw.body.String(), statusCode)
	}
}

func main() {
	loadEnv()
	loadDatabase()
	ethereum.Init()

	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("$PORT must be set")
	}

	// Note: primary origin should come first (e.g. wallet.tx.xyz)
	clientOrigins := os.Getenv("CLIENT_ORIGINS")
	if clientOrigins == "" {
		log.Fatal("$CLIENT_ORIGINS must be set")
	}
	origins := strings.Split(clientOrigins, ",")

	router := gin.New()
	router.Use(gin.Recovery())

	router.Use(gin.Logger())
	router.Use(ginErrorLogMiddleware)

	router.Use(cors.New(cors.Config{
		AllowOrigins:     origins,
		AllowMethods:     []string{"GET", "POST"},
		AllowHeaders:     []string{"content-type"},
		AllowCredentials: true,
		MaxAge:           600,
	}))

	store := gormsessions.NewStore(db.Database, true, []byte(SESSION_SALT))
	store.Options(sessions.Options{MaxAge: 60 * 60 * 24}) // sessions expire daily
	router.Use(sessions.Sessions(SESSION_NAME, store))

	err := turnkey.Init(
		os.Getenv("TURNKEY_API_HOST"),
		os.Getenv("TURNKEY_API_PRIVATE_KEY"),
		os.Getenv("TURNKEY_ORGANIZATION_ID"),
	)
	if err != nil {
		log.Fatalf("Unable to initialize Turnkey client: %+v", err)
	}

	userID, err := turnkey.Client.Whoami()
	if err != nil {
		log.Fatalf("Unable to use Turnkey client for whoami request: %+v", err)
	}

	turnkeyWarchestOrganizationId := os.Getenv("TURNKEY_WARCHEST_ORGANIZATION_ID")
	turnkeyWarchestPrivateKeyId := os.Getenv("TURNKEY_WARCHEST_PRIVATE_KEY_ID")
	if turnkeyWarchestOrganizationId == "" || turnkeyWarchestPrivateKeyId == "" || err != nil {
		log.Fatal("Cannot find configuration for Turnkey Warchest org or private key ID! Drop functionality depends on it")
	}
	turnkeyWarchestPrivateKeyAddress, err := turnkey.Client.GetEthereumAddress(turnkeyWarchestOrganizationId, turnkeyWarchestPrivateKeyId)
	if err != nil {
		log.Fatalf("Unable to get Turnkey Warchest address: %s", err.Error())
	}

	log.Printf("Initialized Turnkey client successfully. Turnkey API User UUID: %s\n", userID)

	router.GET("/", func(ctx *gin.Context) {
		ctx.String(http.StatusOK, fmt.Sprintf("This is the Demo Passkey Wallet backend. Welcome I guess? Head to %s if you're lost.", origins[0]))
	})

	router.GET("/api/whoami", func(ctx *gin.Context) {
		user := getCurrentUser(ctx)
		if user != nil {
			var subOrganizationId *string
			if user.SubOrganizationId.Valid {
				subOrganizationId = &user.SubOrganizationId.String
			}
			ctx.JSON(http.StatusOK, map[string]interface{}{
				"userId":            user.ID,
				"email":             user.Email,
				"subOrganizationId": subOrganizationId,
			})
		} else {
			// Empty response when there is no current user
			ctx.JSON(http.StatusNoContent, nil)
		}
	})

	// Whereas the above performs a "local" whoami in the context of this demo app,
	// this endpoint forwards a stamped whoami request to Turnkey.
	router.POST("/api/turnkey-whoami", func(ctx *gin.Context) {
		var req types.WhoamiRequest
		err := ctx.BindJSON(&req)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		status, bodyBytes, err := turnkey.Client.ForwardSignedRequest(req.SignedWhoamiRequest.Url, req.SignedWhoamiRequest.Body, req.SignedWhoamiRequest.Stamp)
		if err != nil {
			err = errors.Wrap(err, "error while forwarding signed send transaction request")
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		if status != 200 {
			ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("expected 200 when forwarding signed transaction request. Got %d", status))
			return
		}

		subOrganizationId := gjson.Get(string(bodyBytes), "organizationId").String()
		subOrganizationName := gjson.Get(string(bodyBytes), "organizationName").String()
		userId := gjson.Get(string(bodyBytes), "userId").String()
		username := gjson.Get(string(bodyBytes), "username").String()

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"subOrganizationId":   subOrganizationId,
			"subOrganizationName": subOrganizationName,
			"userId":              userId,
			"username":            username,
		})
	})

	router.GET("/api/registration/:email", func(ctx *gin.Context) {
		email := ctx.Param("email")
		user, err := models.FindUserByEmail(email)
		if err == nil {
			ctx.JSON(http.StatusOK, map[string]interface{}{
				"userId":            user.ID,
				"subOrganizationId": user.SubOrganizationId.String,
			})
		} else {
			ctx.JSON(http.StatusNoContent, nil)
		}
	})

	router.POST("/api/register", func(ctx *gin.Context) {
		var requestBody types.RegistrationRequest
		if err := ctx.BindJSON(&requestBody); err != nil {
			ctx.JSON(http.StatusBadRequest, err.Error())
			return
		}

		user, err := models.CreateUser(requestBody.Email)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, err)
			return
		}

		subOrgResult, err := turnkey.Client.CreateUserSubOrganization(requestBody.Email, requestBody.Attestation, requestBody.Challenge)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		if _, err = models.UpdateUserTurnkeySubOrganization(user.ID, subOrgResult.SubOrganizationId); err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		pk, err := models.SaveWalletForUser(user, subOrgResult.WalletId, subOrgResult.EthereumAddress)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}
		log.Printf("Wallet account successfully saved: %+v", pk)

		startUserLoginSession(ctx, user.ID)
		ctx.String(http.StatusOK, "Account successfully created")
	})

	router.POST("/api/authenticate", func(ctx *gin.Context) {
		var req types.AuthenticationRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusBadRequest, err.Error())
			return
		}

		log.Printf("Current request: %v\n", req)

		var subOrganizationId string

		if req.SubOrganizationId != "" {
			subOrganizationId = req.SubOrganizationId
		} else {
			status, bodyBytes, err := turnkey.Client.ForwardSignedRequest(req.SignedWhoamiRequest.Url, req.SignedWhoamiRequest.Body, req.SignedWhoamiRequest.Stamp)
			if err != nil {
				err = errors.Wrap(err, "error while forwarding signed whoami request")
				ctx.JSON(http.StatusInternalServerError, err.Error())
				return
			}

			if status != 200 {
				ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("expected 200 when forwarding whoami request. Got %d", status))
				return
			}

			subOrganizationId = gjson.Get(string(bodyBytes), "organizationId").String()
		}

		log.Printf("Suborganization ID: %v\n", subOrganizationId)

		user, err := models.FindUserBySubOrganizationId(subOrganizationId)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("Unable to find user for suborg ID %s", subOrganizationId))
			return
		}

		log.Printf("Current user: %v\n", user)

		startUserLoginSession(ctx, user.ID)
		ctx.String(http.StatusOK, "Successful login")
	})

	router.POST("/api/logout", func(ctx *gin.Context) {
		endUserSession(ctx)
		ctx.String(http.StatusNoContent, "")
	})

	router.GET("/api/wallet", func(ctx *gin.Context) {
		user := getCurrentUser(ctx)
		if user == nil {
			ctx.String(http.StatusForbidden, "no current user")
			return
		}
		wallet, err := models.GetWalletForUser(*user)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to retrieve key for current user").Error())
			return
		}

		balance, err := ethereum.GetBalance(wallet.EthereumAddress)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to retrieve balance").Error())
			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"address":     wallet.EthereumAddress,
			"turnkeyUuid": wallet.TurnkeyUUID,
			"balance":     formatBalance(balance),
			"dropsLeft":   wallet.DropsLeft(),
		})
	})

	router.POST("api/wallet/drop", func(ctx *gin.Context) {
		user := getCurrentUser(ctx)
		if user == nil {
			ctx.String(http.StatusForbidden, "no current user")
			return
		}
		wallet, err := models.GetWalletForUser(*user)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to retrieve key for current user").Error())
			return
		}

		if wallet.DropsLeft() <= 0 {
			ctx.String(http.StatusForbidden, "No more drops left!")
			return
		}

		unsignedDropTx, err := ethereum.ConstructTransfer(turnkeyWarchestPrivateKeyAddress, wallet.EthereumAddress, big.NewInt(DROP_AMOUNT_IN_WEI), nil)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to construct drop transfer").Error())
			return
		}

		signedDropTx, err := turnkey.Client.SignTransaction(turnkeyWarchestOrganizationId, turnkeyWarchestPrivateKeyId, hex.EncodeToString(unsignedDropTx))
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to sign drop transfer").Error())
			return
		}

		txHash, err := ethereum.BroadcastTransaction(signedDropTx)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to broadcast drop transfer").Error())
			return
		}

		err = models.RecordDropForWallet(wallet)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to persist drop in DB").Error())
			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"hash": txHash,
		})
	})

	// This handler builds a valid Ethereum transaction from the params passed in.
	// Aside from checking for a valid session, nothing "stateful" happens here.
	// We could (potentially!) even open this as a public endpoint. No real security risk.
	// But we need to authenticate users to retrieve their private key and associated address.
	router.POST("api/wallet/construct-tx", func(ctx *gin.Context) {
		var params types.ConstructTxParams
		err := ctx.BindJSON(&params)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		user := getCurrentUser(ctx)
		if user == nil {
			ctx.String(http.StatusForbidden, "no current user")
			return
		}

		wallet, err := models.GetWalletForUser(*user)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to retrieve key for current user").Error())
			return
		}

		amount, err := strconv.ParseFloat(params.Amount, 64)
		if err != nil {
			ctx.String(http.StatusBadRequest, errors.Wrapf(err, "unable to convert amount (%q) to float", params.Amount).Error())
			return
		}

		unsignedTransaction, err := ethereum.ConstructTransfer(wallet.EthereumAddress, params.Destination, big.NewInt(int64(amount*float64(ONE_ETH_IN_WEI))), nil)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to construct transaction").Error())
			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"unsignedTransaction": hex.EncodeToString(unsignedTransaction),
			"address":             wallet.EthereumAddress,
			"organizationId":      user.SubOrganizationId.String,
		})
	})

	router.POST("/api/wallet/send-tx", func(ctx *gin.Context) {
		var params types.SendTxParams
		err := ctx.BindJSON(&params)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		user := getCurrentUser(ctx)
		if user == nil {
			ctx.String(http.StatusForbidden, "no current user")
			return
		}

		status, responseBytes, err := turnkey.Client.ForwardSignedRequest(
			params.SignedSendTx.Url, params.SignedSendTx.Body, params.SignedSendTx.Stamp)

		if err != nil {
			err = errors.Wrap(err, "error while forwarding signed send transaction request")
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		if status != 200 {
			ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("expected 200 when forwarding signed transaction request. Got %d", status))
			return
		}

		signedTransaction := gjson.Get(string(responseBytes), "activity.result.signTransactionResult.signedTransaction").String()

		hash, err := ethereum.BroadcastTransaction(signedTransaction)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("error while broadcasting signed transaction %q", signedTransaction))
			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"hash": hash,
		})
	})

	router.GET("/api/wallet/history", func(ctx *gin.Context) {
		user := getCurrentUser(ctx)
		if user == nil {
			ctx.String(http.StatusForbidden, "no current user")
			return
		}

		wallet, err := models.GetWalletForUser(*user)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to retrieve wallet for current user").Error())
			return
		}

		history, err := alchemy.TransactionHistory(wallet.EthereumAddress)
		if err != nil {
			ctx.String(http.StatusInternalServerError, errors.Wrap(err, "unable to get transaction history").Error())
			return
		}
		ctx.JSON(http.StatusOK, history)
	})

	router.POST("/api/wallet/export", func(ctx *gin.Context) {
		var req types.ExportRequest
		err = ctx.BindJSON(&req)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		bodyBytes, err := turnkey.Client.ForwardSignedActivity(req.SignedExportRequest.Url, req.SignedExportRequest.Body, req.SignedExportRequest.Stamp)
		if err != nil {
			err = errors.Wrap(err, "error while forwarding signed EXPORT_WALLET activity")
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}
		exportBundle := gjson.Get(string(bodyBytes), "activity.result.exportWalletResult.exportBundle").String()

		ctx.JSON(http.StatusOK, exportBundle)
	})

	router.POST("/api/init-recovery", func(ctx *gin.Context) {
		var params types.RecoveryParams
		err := ctx.BindJSON(&params)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		user, err := models.FindUserByEmail(params.Email)
		if err != nil {
			ctx.String(http.StatusForbidden, "no user found")
			return
		}
		subOrganizationId := user.SubOrganizationId.String

		turnkeyUserUuid, err := turnkey.Client.InitRecovery(subOrganizationId, user.Email, params.TargetPublicKey)
		if err != nil {
			ctx.String(http.StatusInternalServerError, fmt.Sprintf("error while initializing recovery: %s", err.Error()))
			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"userId":         turnkeyUserUuid,
			"organizationId": subOrganizationId,
		})
	})

	router.POST("/api/recover", func(ctx *gin.Context) {
		var req types.RecoverRequest
		err := ctx.BindJSON(&req)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		_, err = turnkey.Client.ForwardSignedActivity(req.SignedRecoverRequest.Url, req.SignedRecoverRequest.Body, req.SignedRecoverRequest.Stamp)
		if err != nil {
			if strings.Contains(err.Error(), "no valid user found for authenticator") && strings.Contains(err.Error(), "Got status 401") {
				// This is a tad weird, but while forwarding `RECOVER_USER`` activities, the "success" indicator isn't the usual "ACTIVITY_STATUS_COMPLETE",
				// because the credential used to authenticate the request (in the stamp) is the _temporary_ recovery credential.
				// The `RECOVER_USER` activity deletes this temporary credential and adds the new passkey instead, which means it loses any privileges on the org,
				// which includes having read access to anything! Hence we expect this authentication error to happen when the activity completes.
				// Another, less awkward way to ensure the activity is actually complete would be to poll with our backend API key since it has read permissions.
				ctx.JSON(http.StatusOK, map[string]interface{}{})
				return
			}
			err = errors.Wrap(err, "error while forwarding signed RECOVER_USER activity")
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{})
	})

	router.POST("/api/email-auth", func(ctx *gin.Context) {
		var params types.EmailAuthParams
		err := ctx.BindJSON(&params)
		if err != nil {
			ctx.String(http.StatusBadRequest, err.Error())
			return
		}

		user, err := models.FindUserByEmail(params.Email)
		if err != nil {
			ctx.String(http.StatusForbidden, "no user found")
			return
		}
		subOrganizationId := user.SubOrganizationId.String

		turnkeyUserUuid, turnkeyUserApiKeyId, err := turnkey.Client.EmailAuth(subOrganizationId, user.Email, params.TargetPublicKey)
		if err != nil {
			ctx.String(http.StatusInternalServerError, fmt.Sprintf("error while performing email auth: %s", err.Error()))

			return
		}

		ctx.JSON(http.StatusOK, map[string]interface{}{
			"userId":         turnkeyUserUuid,
			"organizationId": subOrganizationId,
			"apiKeyId":       turnkeyUserApiKeyId,
		})
	})

	router.Run(":" + port)
}

// Transform a bigint (representing a wei amount) into a readable
// string ("1.23") representing an amount in ETH.
func formatBalance(balance *big.Int) string {
	b := big.NewRat(balance.Int64(), ONE_ETH_IN_WEI)
	return b.FloatString(2)
}

func getCurrentUser(ctx *gin.Context) *models.User {
	session := sessions.Default(ctx)

	// Session.Get returns nil if the session doesn't have a given key
	userIdOrNil := session.Get(SESSION_USER_ID_KEY)
	if userIdOrNil == nil {
		log.Println("session.Get returned nil; no session provided?")
		return nil
	}

	userId := userIdOrNil.(uint)
	user, err := models.FindUserById(userId)
	if err != nil {
		log.Print(fmt.Errorf("error while getting current user \"%d\": %w", userId, err))
		return nil
	}
	return &user
}

func startUserLoginSession(ctx *gin.Context, userId uint) {
	log.Println("Starting user session...")

	session := sessions.Default(ctx)

	session.Set(SESSION_USER_ID_KEY, userId)

	log.Printf("SESSION_USER_ID_KEY: %v\n", SESSION_USER_ID_KEY)
	log.Printf("User ID: %v\n", userId)

	err := session.Save()
	if err != nil {
		log.Printf("error while saving session for user %d: %+v", userId, err)
	}
}

// TODO: make sure iframe creds are cleared
func endUserSession(ctx *gin.Context) {
	session := sessions.Default(ctx)
	userIdOrNil := session.Get(SESSION_USER_ID_KEY)
	if userIdOrNil == nil {
		log.Printf("error: trying to end session but no user ID data")
		return
	}
	session.Options(sessions.Options{
		MaxAge: -1,
		Path:   "/",
	})
	session.Clear()
	err := session.Save()
	if err != nil {
		log.Printf("error while deleting current session: %+v", err)
	}
	log.Printf("Success: user %d was logged out", userIdOrNil.(uint))
}

func loadDatabase() {
	db.Connect()
	db.Database.AutoMigrate(&models.User{}, &models.Wallet{})
}

func loadEnv() {
	err := godotenv.Load(".env")

	// Error out if we're in local. Heroku sets DATABASE_URL automatically.
	// When the app runs on Heroku, no .env file is expected.
	if err != nil && os.Getenv("DATABASE_URL") == "" {
		log.Fatalf("Error loading .env file: %s", err.Error())
	}
}
