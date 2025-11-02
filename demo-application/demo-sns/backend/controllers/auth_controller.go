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

const GuestUserID = 1

type AuthController struct {
	cfg *config.Config
}

func NewAuthController(cfg *config.Config) *AuthController {
	return &AuthController{cfg: cfg}
}

type RegisterRequest struct {
	Name                 string `json:"name" validate:"required,max=255"`
	Email                string `json:"email" validate:"required,email,max=255"`
	Password             string `json:"password" validate:"required,min=8"`
	PasswordConfirmation string `json:"password_confirmation" validate:"required"`
}

type LoginRequest struct {
	Email    string `json:"email" validate:"required,email"`
	Password string `json:"password" validate:"required"`
}

func (ac *AuthController) Register(c echo.Context) error {
	var req RegisterRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	if req.Password != req.PasswordConfirmation {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Password confirmation does not match"})
	}

	var existingUser models.User
	if err := database.DB.Where("email = ?", req.Email).First(&existingUser).Error; err == nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Email already exists"})
	}

	hashedPassword, err := utils.HashPassword(req.Password)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to hash password"})
	}

	user := models.User{
		Name:     req.Name,
		Email:    req.Email,
		Password: hashedPassword,
	}

	if err := database.DB.Create(&user).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create user"})
	}

	token, err := utils.GenerateToken(user.ID, user.Email, ac.cfg.JWTSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	return c.JSON(http.StatusCreated, map[string]interface{}{
		"user":  user,
		"token": token,
	})
}

func (ac *AuthController) Login(c echo.Context) error {
	var req LoginRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	var user models.User
	if err := database.DB.Where("email = ?", req.Email).First(&user).Error; err != nil {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "The provided credentials are incorrect."})
	}

	if !utils.CheckPassword(user.Password, req.Password) {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "The provided credentials are incorrect."})
	}

	token, err := utils.GenerateToken(user.ID, user.Email, ac.cfg.JWTSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user":  user,
		"token": token,
	})
}

func (ac *AuthController) GuestLogin(c echo.Context) error {
	var user models.User
	if err := database.DB.First(&user, GuestUserID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Guest user not found. Please run database seeder."})
	}

	token, err := utils.GenerateToken(user.ID, user.Email, ac.cfg.JWTSecret)
	if err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to generate token"})
	}

	return c.JSON(http.StatusOK, map[string]interface{}{
		"user":  user,
		"token": token,
	})
}

func (ac *AuthController) Logout(c echo.Context) error {
	return c.JSON(http.StatusOK, map[string]string{"message": "Logged out successfully"})
}

func (ac *AuthController) Me(c echo.Context) error {
	user, exists := middleware.GetCurrentUser(c)
	if !exists {
		return c.JSON(http.StatusUnauthorized, map[string]string{"error": "Unauthorized"})
	}
	return c.JSON(http.StatusOK, user)
}
