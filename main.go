package main

import (
	"fmt"
	"log"
	"os"

	"github.com/gin-gonic/gin"
	_ "github.com/heroku/x/hmetrics/onload"
	"github.com/joho/godotenv"
	"github.com/r-n-o/piggybank/internal/db"
	"github.com/r-n-o/piggybank/internal/handlers"
	"github.com/r-n-o/piggybank/internal/models"
	"github.com/r-n-o/piggybank/internal/turnkey"
)

func main() {
	loadEnv()
	loadDatabase()

	port := os.Getenv("PORT")
	if port == "" {
		log.Fatal("$PORT must be set")
	}

	router := gin.New()
	router.Use(gin.Logger())

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
	fmt.Printf("Initialized Turnkey client successfully. Whoami? %s\n", userID)

	// Load all templates
	router.LoadHTMLGlob("templates/*.tmpl.html")

	// Load static assets
	router.Static("/static", "static")

	// Load root static assets (must live at the root to be picked up
	router.StaticFile("/favicon.ico", "static/favicon.ico")
	router.StaticFile("/apple-touch-icon.png", "static/apple-touch-icon.ico")
	router.StaticFile("/site.webmanifest", "static/site.webmanifest")

	// Define webapp routes
	router.GET("/", handlers.HandleHome)
	router.GET("/wallet", handlers.HandleGetWallet)
	router.POST("/wallet/create", handlers.HandlePostWalletCreate)
	router.GET("/signup", handlers.HandleGetSignup)
	router.GET("/login", handlers.HandleGetLogin)
	router.POST("/signup", handlers.HandlePostSignup)
	router.POST("/login", handlers.HandlePostLogin)
	router.POST("/logout", handlers.HandlePostLogout)

	router.Run(":" + port)
}

func loadDatabase() {
	db.Connect()
	db.Database.AutoMigrate(&models.User{}, &models.TurnkeyApiUser{}, &models.TurnkeyPrivateKey{})
}

func loadEnv() {
	err := godotenv.Load(".env.local")
	if err != nil {
		log.Fatal("Error loading .env file")
	}
}
