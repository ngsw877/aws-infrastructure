package models

import (
	"time"

	"gorm.io/gorm"
)

type User struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	Name      string         `gorm:"type:varchar(255);not null" json:"name" binding:"required,max=255"`
	Email     string         `gorm:"type:varchar(255);uniqueIndex;not null" json:"email" binding:"required,email,max=255"`
	Password  string         `gorm:"type:varchar(255);not null" json:"-"`
	Bio       string         `gorm:"type:text" json:"bio"`
	AvatarURL string         `gorm:"type:varchar(500)" json:"avatar_url"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Posts     []Post   `gorm:"foreignKey:UserID" json:"posts,omitempty"`
	Likes     []Like   `gorm:"foreignKey:UserID" json:"-"`
	Followers []Follow `gorm:"foreignKey:FollowingID" json:"-"`
	Following []Follow `gorm:"foreignKey:FollowerID" json:"-"`
}
