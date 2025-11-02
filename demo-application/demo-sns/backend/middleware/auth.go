package middleware

import (
	"demo-sns-backend/config"
	"demo-sns-backend/database"
	"demo-sns-backend/models"
	"demo-sns-backend/utils"
	"net/http"
	"strings"

	"github.com/labstack/echo/v4"
)

func AuthMiddleware(cfg *config.Config) echo.MiddlewareFunc {
	return func(next echo.HandlerFunc) echo.HandlerFunc {
		return func(c echo.Context) error {
			// Get token from Authorization header
			authHeader := c.Request().Header.Get("Authorization")
			if authHeader == "" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Authorization header required"})
			}

			// Extract Bearer token
			parts := strings.Split(authHeader, " ")
			if len(parts) != 2 || parts[0] != "Bearer" {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid authorization format"})
			}

			tokenString := parts[1]

			// Validate token
			claims, err := utils.ValidateToken(tokenString, cfg.JWTSecret)
			if err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Invalid or expired token"})
			}

			// Get user from database
			var user models.User
			if err := database.DB.First(&user, claims.UserID).Error; err != nil {
				return c.JSON(http.StatusUnauthorized, map[string]string{"error": "User not found"})
			}

			// Set user in context
			c.Set("user", &user)
			c.Set("user_id", user.ID)

			return next(c)
		}
	}
}

// GetCurrentUser gets the authenticated user from context
func GetCurrentUser(c echo.Context) (*models.User, bool) {
	user := c.Get("user")
	if user == nil {
		return nil, false
	}
	return user.(*models.User), true
}
