package models

import (
	"time"

	"gorm.io/gorm"
)

type Follow struct {
	ID          uint           `gorm:"primaryKey" json:"id"`
	FollowerID  uint           `gorm:"not null;index:idx_follower_following" json:"follower_id"`
	FollowingID uint           `gorm:"not null;index:idx_follower_following" json:"following_id"`
	CreatedAt   time.Time      `json:"created_at"`
	UpdatedAt   time.Time      `json:"updated_at"`
	DeletedAt   gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Follower  User `gorm:"foreignKey:FollowerID" json:"-"`
	Following User `gorm:"foreignKey:FollowingID" json:"-"`
}

func (Follow) TableName() string {
	return "follows"
}

func (f *Follow) BeforeMigrate(tx *gorm.DB) error {
	tx.Exec("CREATE UNIQUE INDEX IF NOT EXISTS idx_follows_follower_following ON follows(follower_id, following_id) WHERE deleted_at IS NULL")
	return nil
}
