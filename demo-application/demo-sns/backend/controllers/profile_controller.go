package controllers

import (
	"demo-sns-backend/config"
	"demo-sns-backend/database"
	"demo-sns-backend/middleware"
	"demo-sns-backend/models"
	"demo-sns-backend/utils"
	"net/http"

	"github.com/labstack/echo/v4"
)

type ProfileController struct {
	s3Uploader *utils.S3Uploader
}

func NewProfileController(cfg *config.Config) *ProfileController {
	uploader, _ := utils.NewS3Uploader(cfg)
	return &ProfileController{s3Uploader: uploader}
}

func (pc *ProfileController) Show(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)

	var user models.User
	if err := database.DB.First(&user, c.Param("id")).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}

	// フォロワー数を計算
	var followersCount int64
	database.DB.Model(&models.Follow{}).Where("following_id = ?", user.ID).Count(&followersCount)

	// フォロー中数を計算
	var followingCount int64
	database.DB.Model(&models.Follow{}).Where("follower_id = ?", user.ID).Count(&followingCount)

	// 投稿数を計算
	var postsCount int64
	database.DB.Model(&models.Post{}).Where("user_id = ?", user.ID).Count(&postsCount)

	// 現在のユーザーがこのユーザーをフォローしているかチェック
	var follow models.Follow
	isFollowing := database.DB.Where("follower_id = ? AND following_id = ?", currentUser.ID, user.ID).First(&follow).Error == nil

	// レスポンスを構築
	response := map[string]interface{}{
		"id":              user.ID,
		"name":            user.Name,
		"email":           user.Email,
		"bio":             user.Bio,
		"avatar_url":      user.AvatarURL,
		"created_at":      user.CreatedAt,
		"updated_at":      user.UpdatedAt,
		"followers_count": followersCount,
		"following_count": followingCount,
		"posts_count":     postsCount,
		"is_following":    isFollowing,
	}

	return c.JSON(http.StatusOK, response)
}

func (pc *ProfileController) Update(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)

	if name := c.FormValue("name"); name != "" {
		currentUser.Name = name
	}
	if bio := c.FormValue("bio"); bio != "" {
		currentUser.Bio = bio
	}

	file, err := c.FormFile("avatar")
	if err == nil && file != nil {
		avatarURL, _ := pc.s3Uploader.UploadFile(file, "avatars")
		currentUser.AvatarURL = avatarURL
	}

	database.DB.Save(currentUser)
	return c.JSON(http.StatusOK, currentUser)
}
