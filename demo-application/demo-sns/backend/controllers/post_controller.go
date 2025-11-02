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

type PostController struct {
	s3Uploader *utils.S3Uploader
}

func NewPostController(cfg *config.Config) *PostController {
	uploader, _ := utils.NewS3Uploader(cfg)
	return &PostController{s3Uploader: uploader}
}

func (pc *PostController) Index(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	var posts []models.Post
	database.DB.Preload("User").Order("created_at DESC").Find(&posts)

	for i := range posts {
		var likesCount int64
		database.DB.Model(&models.Like{}).Where("post_id = ?", posts[i].ID).Count(&likesCount)
		posts[i].LikesCount = int(likesCount)
		var like models.Like
		err := database.DB.Where("user_id = ? AND post_id = ?", currentUser.ID, posts[i].ID).First(&like).Error
		posts[i].IsLiked = err == nil
	}
	return c.JSON(http.StatusOK, posts)
}

func (pc *PostController) Show(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	var post models.Post
	if err := database.DB.Preload("User").First(&post, c.Param("id")).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Post not found"})
	}
	var likesCount int64
	database.DB.Model(&models.Like{}).Where("post_id = ?", post.ID).Count(&likesCount)
	post.LikesCount = int(likesCount)
	var like models.Like
	err := database.DB.Where("user_id = ? AND post_id = ?", currentUser.ID, post.ID).First(&like).Error
	post.IsLiked = err == nil
	return c.JSON(http.StatusOK, post)
}

func (pc *PostController) Create(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	content := c.FormValue("content")
	if content == "" {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "content is required"})
	}

	post := models.Post{UserID: currentUser.ID, Content: content}
	file, err := c.FormFile("image")
	if err == nil && file != nil {
		imageURL, _ := pc.s3Uploader.UploadFile(file, "posts")
		post.ImageURL = imageURL
	}
	database.DB.Create(&post)
	database.DB.Preload("User").First(&post, post.ID)
	return c.JSON(http.StatusCreated, post)
}

func (pc *PostController) Update(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	var post models.Post
	if err := database.DB.First(&post, c.Param("id")).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Post not found"})
	}
	if post.UserID != currentUser.ID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Forbidden"})
	}
	post.Content = c.FormValue("content")
	file, err := c.FormFile("image")
	if err == nil && file != nil {
		imageURL, _ := pc.s3Uploader.UploadFile(file, "posts")
		post.ImageURL = imageURL
	}
	database.DB.Save(&post)
	database.DB.Preload("User").First(&post, post.ID)
	return c.JSON(http.StatusOK, post)
}

func (pc *PostController) Delete(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	var post models.Post
	if err := database.DB.First(&post, c.Param("id")).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Post not found"})
	}
	if post.UserID != currentUser.ID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "Forbidden"})
	}
	database.DB.Delete(&post)
	return c.JSON(http.StatusOK, map[string]string{"message": "Post deleted successfully"})
}
