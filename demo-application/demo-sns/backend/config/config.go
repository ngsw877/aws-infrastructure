package config

import (
	"os"

	"github.com/joho/godotenv"
)

type Config struct {
	DBHost     string
	DBPort     string
	DBDatabase string
	DBUsername string
	DBPassword string

	AWSAccessKeyID     string
	AWSSecretAccessKey string
	AWSRegion          string
	AWSBucket          string
	AWSEndpoint        string

	JWTSecret string
	Port      string
}

func LoadConfig() *Config {
	// Load .env file if exists
	_ = godotenv.Load()

	return &Config{
		DBHost:     getEnv("DB_HOST", "localhost"),
		DBPort:     getEnv("DB_PORT", "5432"),
		DBDatabase: getEnv("DB_DATABASE", "demo_sns"),
		DBUsername: getEnv("DB_USERNAME", "demo_sns_user"),
		DBPassword: getEnv("DB_PASSWORD", "demo_sns_password"),

		AWSAccessKeyID:     getEnv("AWS_ACCESS_KEY_ID", "minioadmin"),
		AWSSecretAccessKey: getEnv("AWS_SECRET_ACCESS_KEY", "minioadmin"),
		AWSRegion:          getEnv("AWS_DEFAULT_REGION", "ap-northeast-1"),
		AWSBucket:          getEnv("AWS_BUCKET", "demo-sns"),
		AWSEndpoint:        getEnv("AWS_ENDPOINT", "http://minio:9000"),

		JWTSecret: getEnv("JWT_SECRET", "your-secret-key-change-this"),
		Port:      getEnv("PORT", "8080"),
	}
}

func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}
