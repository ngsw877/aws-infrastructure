package database

import (
	"demo-sns-backend/config"
	"demo-sns-backend/models"
	"fmt"
	"log"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
	"gorm.io/gorm/logger"
)

var DB *gorm.DB

func Connect(cfg *config.Config) error {
	dsn := fmt.Sprintf(
		"host=%s user=%s password=%s dbname=%s port=%s sslmode=disable TimeZone=Asia/Tokyo",
		cfg.DBHost,
		cfg.DBUsername,
		cfg.DBPassword,
		cfg.DBDatabase,
		cfg.DBPort,
	)

	db, err := gorm.Open(postgres.Open(dsn), &gorm.Config{
		Logger: logger.Default.LogMode(logger.Info),
	})
	if err != nil {
		return fmt.Errorf("failed to connect database: %w", err)
	}

	DB = db
	log.Println("Database connection established")

	return nil
}

func AutoMigrate() error {
	err := DB.AutoMigrate(
		&models.User{},
		&models.Post{},
		&models.Like{},
		&models.Follow{},
		&models.Comment{},
		&models.CommentLike{},
	)
	if err != nil {
		return fmt.Errorf("failed to auto migrate: %w", err)
	}

	log.Println("Database auto migration completed")
	return nil
}
