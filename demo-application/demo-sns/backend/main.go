package main

import (
	"demo-sns-backend/config"
	"demo-sns-backend/database"
	"demo-sns-backend/database/seeders"
	"demo-sns-backend/routes"
	"flag"
	"log"

	"github.com/labstack/echo/v4"
	"github.com/labstack/echo/v4/middleware"
)

func main() {
	seed := flag.Bool("seed", false, "Run database seeder")
	flag.Parse()

	cfg := config.LoadConfig()

	if err := database.Connect(cfg); err != nil {
		log.Fatal("Failed to connect to database:", err)
	}

	if err := database.AutoMigrate(); err != nil {
		log.Fatal("Failed to run auto migration:", err)
	}

	if *seed {
		log.Println("Running database seeder...")
		if err := seeders.RunDemoSeeder(); err != nil {
			log.Fatal("Failed to run seeder:", err)
		}
		log.Println("Seeder completed successfully!")
		return
	}

	e := echo.New()

	// CORS middleware
	e.Use(middleware.CORSWithConfig(middleware.CORSConfig{
		AllowOrigins:     []string{"http://localhost:3000", "http://localhost:8000", "http://localhost:8080"},
		AllowMethods:     []string{echo.GET, echo.POST, echo.PUT, echo.DELETE, echo.OPTIONS},
		AllowHeaders:     []string{echo.HeaderOrigin, echo.HeaderContentType, echo.HeaderAuthorization},
		AllowCredentials: true,
	}))

	// Health check endpoint
	e.GET("/", func(c echo.Context) error {
		return c.JSON(200, map[string]string{
			"status":  "ok",
			"message": "Demo SNS API is running",
			"version": "1.0.0",
		})
	})

	e.GET("/health", func(c echo.Context) error {
		return c.JSON(200, map[string]string{"status": "healthy"})
	})

	// Setup routes
	routes.SetupRoutes(e, cfg)

	// Start server
	port := ":" + cfg.Port
	log.Printf("Server starting on port %s", cfg.Port)
	if err := e.Start(port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
