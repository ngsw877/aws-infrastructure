package controllers

import (
	"demo-sns-backend/database"
	"demo-sns-backend/middleware"
	"demo-sns-backend/models"
	"net/http"

	"github.com/labstack/echo/v4"
	"gorm.io/gorm"
)

type LikeController struct{}

func NewLikeController() *LikeController {
	return &LikeController{}
}

func (lc *LikeController) Toggle(c echo.Context) error {
	postID := c.Param("id")
	currentUser, _ := middleware.GetCurrentUser(c)

	var post models.Post
	if err := database.DB.First(&post, postID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Post not found"})
	}

	var like models.Like
	err := database.DB.Where("user_id = ? AND post_id = ?", currentUser.ID, post.ID).First(&like).Error

	if err == gorm.ErrRecordNotFound {
		like = models.Like{UserID: currentUser.ID, PostID: post.ID}
		database.DB.Create(&like)
		return c.JSON(http.StatusOK, map[string]interface{}{"message": "Post liked", "liked": true})
	} else if err == nil {
		database.DB.Delete(&like)
		return c.JSON(http.StatusOK, map[string]interface{}{"message": "Post unliked", "liked": false})
	}
	return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Database error"})
}
