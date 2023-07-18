package main

import (
	"bytes"
	"fmt"
	"log"
	"net/http"
	"os"

	"github.com/gin-contrib/cors"
	"github.com/gin-contrib/sessions"
	gormsessions "github.com/gin-contrib/sessions/gorm"
	"github.com/gin-gonic/gin"
	_ "github.com/heroku/x/hmetrics/onload"
	"github.com/joho/godotenv"
	"github.com/pkg/errors"
	"github.com/tidwall/gjson"
	"github.com/tkhq/demo-passkey-wallet/internal/db"
	"github.com/tkhq/demo-passkey-wallet/internal/models"
	"github.com/tkhq/demo-passkey-wallet/internal/turnkey"
	"github.com/tkhq/demo-passkey-wallet/internal/types"
)

const SESSION_NAME = "demo_session"
const SESSION_SALT = "demo_session_salt"
const SESSION_USER_ID_KEY = "user_id"

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
		fmt.Printf("Internal error served: %s (status: %d)\n", blw.body.String(), statusCode)
	}
}

func main() {
	loadEnv()
	loadDatabase()

	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("$PORT must be set")
	}

	router := gin.New()
	router.Use(gin.Recovery())

	router.Use(gin.Logger())
	router.Use(ginErrorLogMiddleware)

	router.Use(cors.New(cors.Config{
		AllowOrigins:     []string{"http://localhost:3000", "https://wallet.tx.xyz"},
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
		log.Fatalf("Unable to initialize Turnkey client: %+v", err)
	}
	fmt.Printf("Initialized Turnkey client successfully. Turnkey API User UUID: %s\n", userID)

	router.GET("/", func(ctx *gin.Context) {
		ctx.String(http.StatusOK, "This is the Demo Passkey Wallet backend. Welcome I guess? Head to https://wallet.tx.xyz if you're lost.")
	})

	router.GET("/api/whoami", func(ctx *gin.Context) {
		user := getCurrentUser(ctx)
		if user != nil {
			ctx.JSON(http.StatusOK, user)
		} else {
			// Empty response when there is no current user
			ctx.JSON(http.StatusNoContent, nil)
		}
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
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		user, err := models.CreateUser(requestBody.Email)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, err)
			return
		}

		subOrganizationId, err := turnkey.Client.CreateUserSubOrganization(requestBody.Email, requestBody.Attestation, requestBody.Challenge)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		if _, err = models.UpdateUserTurnkeySubOrganization(user.ID, subOrganizationId); err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		startUserLoginSession(ctx, user.ID)
		ctx.String(http.StatusOK, "Account successfully created")
	})

	router.POST("/api/authenticate", func(ctx *gin.Context) {
		var req types.AuthenticationRequest
		if err := ctx.BindJSON(&req); err != nil {
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}
		fmt.Printf("Forwarding: %s, %s, %s\n", req.SignedWhoamiRequest.Url, req.SignedWhoamiRequest.Body, req.SignedWhoamiRequest.Stamp)
		// var decodedStamp map[string]interface{}
		// err = json.Unmarshal([]byte(req.SignedWhoamiRequest.Stamp), &decodedStamp)
		status, bodyBytes, err := turnkey.Client.ForwardSignedRequest(req.SignedWhoamiRequest.Url, req.SignedWhoamiRequest.Body, req.SignedWhoamiRequest.Stamp, true)
		if err != nil {
			err = errors.Wrap(err, "error while forwarding signed whoami request")
			ctx.JSON(http.StatusInternalServerError, err.Error())
			return
		}

		if status != 200 {
			ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("expected 200 when forwarding whoami request. Got %d", status))
			return
		}

		subOrganizationId := gjson.Get(string(bodyBytes), "organizationId").String()
		user, err := models.FindUserBySubOrganizationId(subOrganizationId)
		if err != nil {
			ctx.JSON(http.StatusInternalServerError, fmt.Sprintf("Unable to find user for suborg ID %s", subOrganizationId))
			return
		}

		startUserLoginSession(ctx, user.ID)
		ctx.String(http.StatusOK, "Successful login")
	})

	router.POST("/api/logout", func(ctx *gin.Context) {
		endUserSession(ctx)
		ctx.String(http.StatusNoContent, "")
	})

	router.GET("/api/suborganization", func(ctx *gin.Context) {
		user := getCurrentUser(ctx)
		if user == nil {
			ctx.String(http.StatusForbidden, "no current user")
			return
		}

		if !user.SubOrganizationId.Valid {
			ctx.String(http.StatusInternalServerError, "null sub-organization id for current user")
		} else {
			subOrganization, err := turnkey.Client.GetSubOrganization(user.SubOrganizationId.String)
			if err != nil {
				ctx.String(http.StatusInternalServerError, err.Error())
				return
			}
			ctx.Data(http.StatusOK, "application/json", subOrganization)
		}
	})

	router.Run(":" + port)
}

func getCurrentUser(ctx *gin.Context) *models.User {
	session := sessions.Default(ctx)

	// Session.Get returns nil if the session doesn't have a given key
	userIdOrNil := session.Get(SESSION_USER_ID_KEY)
	if userIdOrNil == nil {
		fmt.Println("session.Get returned nil; no session provided?")
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
	session := sessions.Default(ctx)

	session.Set(SESSION_USER_ID_KEY, userId)
	err := session.Save()
	if err != nil {
		log.Printf("error while saving session for user %d: %+v", userId, err)
	}
}

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
	db.Database.AutoMigrate(&models.User{}, &models.TurnkeyPrivateKey{})
}

func loadEnv() {
	err := godotenv.Load(".env")

	// Error out if we're in local. Heroku sets DATABASE_URL automatically.
	// When the app runs on Heroku, no .env file is expected.
	if err != nil && os.Getenv("DATABASE_URL") == "" {
		log.Fatalf("Error loading .env file: %s", err.Error())
	}
}
