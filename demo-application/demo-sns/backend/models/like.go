package models

import (
	"time"

	"gorm.io/gorm"
)

type Like struct {
	ID        uint           `gorm:"primaryKey" json:"id"`
	UserID    uint           `gorm:"not null;index:idx_user_post" json:"user_id"`
	PostID    uint           `gorm:"not null;index:idx_user_post" json:"post_id"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	User User `gorm:"foreignKey:UserID" json:"-"`
	Post Post `gorm:"foreignKey:PostID" json:"-"`
}

func (Like) TableName() string {
	return "likes"
}

func (l *Like) BeforeMigrate(tx *gorm.DB) error {
	tx.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_likes_user_post ON likes(user_id, post_id) WHERE deleted_at IS NULL")
	return nil
}
