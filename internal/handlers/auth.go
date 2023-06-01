package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/r-n-o/piggybank/internal/models"
)

func HandleGetLogin(c *gin.Context) {
	c.HTML(http.StatusOK, "login.tmpl.html", gin.H{})
}

func HandleGetSignup(c *gin.Context) {
	c.HTML(http.StatusOK, "signup.tmpl.html", gin.H{})
}

func HandlePostSignup(c *gin.Context) {
	username := c.PostForm("username")
	password := c.PostForm("password")
	newUser := &models.User{
		Username: username,
		Password: password,
	}
	_, err := newUser.Save()

	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
		return
	}
	loginAndRedirect(c, username, "/wallet")
}

func HandlePostLogin(c *gin.Context) {
	username := c.PostForm("username")
	password := c.PostForm("password")

	user, err := models.FindUserByName(username)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
		return
	}

	err = user.CheckPassword(password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
		return
	}
	loginAndRedirect(c, username, "/wallet")
}

func HandlePostLogout(c *gin.Context) {
	c.SetCookie("auth", "", -1, "/", "localhost", false, false)
	c.Redirect(http.StatusFound, "/")
}

// TODO: this is obviously insecure. Replace with JWT or something more robust (gorilla sessions?)
func loginAndRedirect(c *gin.Context, username, redirectUrl string) {
	c.SetCookie("auth", username, 3600, "/", "localhost", false, false)
	c.Redirect(http.StatusFound, redirectUrl)
}
