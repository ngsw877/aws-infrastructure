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
	var user models.User
	if err := database.DB.First(&user, c.Param("id")).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "User not found"})
	}
	return c.JSON(http.StatusOK, user)
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
