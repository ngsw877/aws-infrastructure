package routes

import (
	"demo-sns-backend/config"
	"demo-sns-backend/controllers"
	"demo-sns-backend/middleware"

	"github.com/labstack/echo/v4"
)

func SetupRoutes(e *echo.Echo, cfg *config.Config) {
	authController := controllers.NewAuthController(cfg)
	postController := controllers.NewPostController(cfg)
	likeController := controllers.NewLikeController()
	followController := controllers.NewFollowController()
	profileController := controllers.NewProfileController(cfg)
	commentController := controllers.NewCommentController(cfg)

	api := e.Group("/api")

	// Public routes
	api.POST("/register", authController.Register)
	api.POST("/login", authController.Login)
	api.POST("/guest-login", authController.GuestLogin)

	// Protected routes
	authorized := api.Group("")
	authorized.Use(middleware.AuthMiddleware(cfg))
	{
		// Auth
		authorized.POST("/logout", authController.Logout)
		authorized.GET("/me", authController.Me)

		// Posts
		authorized.GET("/posts", postController.Index)
		authorized.POST("/posts", postController.Create)
		authorized.GET("/posts/:id", postController.Show)
		authorized.PUT("/posts/:id", postController.Update)
		authorized.DELETE("/posts/:id", postController.Delete)

		// Likes
		authorized.POST("/posts/:id/like", likeController.Toggle)

		// Follows
		authorized.POST("/users/:id/follow", followController.Toggle)

		// Profile
		authorized.GET("/users/:id", profileController.Show)
		authorized.PUT("/profile", profileController.Update)
		authorized.POST("/profile", profileController.Update)

		// Comments
		authorized.GET("/posts/:postId/comments", commentController.Index)
		authorized.POST("/posts/:postId/comments", commentController.Create)
		authorized.DELETE("/comments/:id", commentController.Delete)
		authorized.POST("/comments/:id/like", commentController.ToggleLike)
	}
}
