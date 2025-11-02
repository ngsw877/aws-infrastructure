package controllers

import (
	"demo-sns-backend/database"
	"demo-sns-backend/middleware"
	"demo-sns-backend/models"
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type FollowController struct{}

func NewFollowController() *FollowController {
	return &FollowController{}
}

func (fc *FollowController) Toggle(c echo.Context) error {
	userID := c.Param("id")
	currentUser, _ := middleware.GetCurrentUser(c)

	var targetUser models.User
	if err := database.DB.First(&targetUser, userID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	if targetUser.ID == currentUser.ID {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "You cannot follow yourself"})
	}

	var follow models.Follow
	err := database.DB.Where("follower_id = ? AND following_id = ?", currentUser.ID, targetUser.ID).First(&follow).Error

	if err == gorm.ErrRecordNotFound {
		follow = models.Follow{FollowerID: currentUser.ID, FollowingID: targetUser.ID}
		database.DB.Create(&follow)
		return c.JSON(http.StatusOK, map[string]interface{}{"message": "User followed", "following": true})
	} else if err == nil {
		database.DB.Delete(&follow)
		return c.JSON(http.StatusOK, map[string]interface{}{"message": "User unfollowed", "following": false})
	}
	return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
}
