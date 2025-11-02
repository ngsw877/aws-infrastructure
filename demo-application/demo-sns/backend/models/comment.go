package models

import (
	"time"
)

type Comment struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	PostID    uint      `gorm:"not null;index" json:"post_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	ParentID  *uint     `gorm:"index" json:"parent_id"` // nullableでトップレベルコメント
	Content   string    `gorm:"type:text;not null" json:"content"`
	CreatedAt time.Time `json:"created_at"`
	UpdatedAt time.Time `json:"updated_at"`

	// Relations
	User    User       `gorm:"foreignKey:UserID" json:"user"`
	Post    Post       `gorm:"foreignKey:PostID" json:"-"`
	Parent  *Comment   `gorm:"foreignKey:ParentID" json:"-"`
	Replies []Comment  `gorm:"foreignKey:ParentID" json:"replies,omitempty"`
	Likes   []CommentLike `gorm:"foreignKey:CommentID" json:"-"`
}

type CommentLike struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	CommentID uint      `gorm:"not null;index" json:"comment_id"`
	UserID    uint      `gorm:"not null;index" json:"user_id"`
	CreatedAt time.Time `json:"created_at"`

	// Relations
	Comment Comment `gorm:"foreignKey:CommentID" json:"-"`
	User    User    `gorm:"foreignKey:UserID" json:"-"`
}
