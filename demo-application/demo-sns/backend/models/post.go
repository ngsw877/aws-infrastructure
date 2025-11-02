package models

import (
	"time"

	"gorm.io/gorm"
)

type Post struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"not null;index" json:"user_id"`
	Content   string         `gorm:"type:text;not null" json:"content" binding:"required"`
	ImageURL  string         `gorm:"type:varchar(500)" json:"image_url"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	User       User   `gorm:"foreignKey:UserID" json:"user"`
	Likes      []Like `gorm:"foreignKey:PostID" json:"-"`
	LikesCount int    `gorm:"-" json:"likes_count"`
	IsLiked    bool   `gorm:"-" json:"is_liked"`
}
