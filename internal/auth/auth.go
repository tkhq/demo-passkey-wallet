package auth

import (
	"strings"

	"github.com/gin-gonic/gin"
)

type AuthStatus struct {
	Username string
	LoggedIn bool
}

func GetAuthStatus(c *gin.Context) (*AuthStatus, error) {
	cookie, err := c.Cookie("auth")
	if err != nil {
		if !strings.Contains(err.Error(), "named cookie not present") {
			return nil, err
		}
	}

	return &AuthStatus{
		Username: cookie,
		LoggedIn: cookie != "",
	}, nil
}
