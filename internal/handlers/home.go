package handlers

import (
	"fmt"
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/r-n-o/piggybank/internal/auth"
)

func HandleHome(c *gin.Context) {
	status, err := auth.GetAuthStatus(c)
	if err != nil {
		c.JSON(http.StatusInternalServerError, map[string]interface{}{"error": fmt.Sprintf("%+v", err)})
	} else {
		c.HTML(http.StatusOK, "index.tmpl.html", gin.H{
			"loggedIn": status.LoggedIn,
			"username": status.Username,
		})
	}
}
