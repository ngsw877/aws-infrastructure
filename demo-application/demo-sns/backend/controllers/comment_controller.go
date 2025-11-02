package controllers

import (
	"demo-sns-backend/config"
	"demo-sns-backend/database"
	"demo-sns-backend/middleware"
	"demo-sns-backend/models"
	"net/http"
	"strconv"

	"github.com/labstack/echo/v4"
)

type CommentController struct {
	cfg *config.Config
}

func NewCommentController(cfg *config.Config) *CommentController {
	return &CommentController{cfg: cfg}
}

type CommentRequest struct {
	Content  string `json:"content" validate:"required"`
	ParentID *uint  `json:"parent_id"`
}

type CommentResponse struct {
	ID         uint              `json:"id"`
	PostID     uint              `json:"post_id"`
	UserID     uint              `json:"user_id"`
	ParentID   *uint             `json:"parent_id"`
	Content    string            `json:"content"`
	User       models.User       `json:"user"`
	LikesCount int64             `json:"likes_count"`
	IsLiked    bool              `json:"is_liked"`
	Replies    []CommentResponse `json:"replies,omitempty"`
	CreatedAt  string            `json:"created_at"`
}

// コメント一覧取得（ネスト構造）
func (cc *CommentController) Index(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	postID := c.Param("postId")

	var comments []models.Comment
	// トップレベルのコメントのみ取得（ParentIDがnull）
	if err := database.DB.
		Where("post_id = ? AND parent_id IS NULL", postID).
		Preload("User").
		Order("created_at DESC").
		Find(&comments).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to fetch comments"})
	}

	// レスポンス構築（再帰的にRepliesを読み込む）
	var response []CommentResponse
	for _, comment := range comments {
		response = append(response, cc.buildCommentResponse(comment, currentUser.ID))
	}

	return c.JSON(http.StatusOK, response)
}

// コメント作成
func (cc *CommentController) Create(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	postID := c.Param("postId")

	var req CommentRequest
	if err := c.Bind(&req); err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": err.Error()})
	}

	postIDUint, err := strconv.ParseUint(postID, 10, 32)
	if err != nil {
		return c.JSON(http.StatusBadRequest, map[string]string{"error": "Invalid post ID"})
	}

	// 投稿が存在するか確認
	var post models.Post
	if err := database.DB.First(&post, postIDUint).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Post not found"})
	}

	// ParentIDが指定されている場合、親コメントが存在するか確認
	if req.ParentID != nil {
		var parentComment models.Comment
		if err := database.DB.First(&parentComment, *req.ParentID).Error; err != nil {
			return c.JSON(http.StatusNotFound, map[string]string{"error": "Parent comment not found"})
		}
	}

	comment := models.Comment{
		PostID:   uint(postIDUint),
		UserID:   currentUser.ID,
		ParentID: req.ParentID,
		Content:  req.Content,
	}

	if err := database.DB.Create(&comment).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to create comment"})
	}

	// Userをプリロード
	database.DB.Preload("User").First(&comment, comment.ID)

	response := cc.buildCommentResponse(comment, currentUser.ID)

	return c.JSON(http.StatusCreated, response)
}

// コメント削除
func (cc *CommentController) Delete(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	commentID := c.Param("id")

	var comment models.Comment
	if err := database.DB.First(&comment, commentID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Comment not found"})
	}

	// 本人のコメントのみ削除可能
	if comment.UserID != currentUser.ID {
		return c.JSON(http.StatusForbidden, map[string]string{"error": "You can only delete your own comments"})
	}

	// 子コメント（リプライ）も削除
	if err := database.DB.Where("parent_id = ?", commentID).Delete(&models.Comment{}).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete replies"})
	}

	// コメント削除
	if err := database.DB.Delete(&comment).Error; err != nil {
		return c.JSON(http.StatusInternalServerError, map[string]string{"error": "Failed to delete comment"})
	}

	return c.JSON(http.StatusOK, map[string]string{"message": "Comment deleted successfully"})
}

// コメントいいね/取り消し
func (cc *CommentController) ToggleLike(c echo.Context) error {
	currentUser, _ := middleware.GetCurrentUser(c)
	commentID := c.Param("id")

	var comment models.Comment
	if err := database.DB.First(&comment, commentID).Error; err != nil {
		return c.JSON(http.StatusNotFound, map[string]string{"error": "Comment not found"})
	}

	var like models.CommentLike
	err := database.DB.Where("comment_id = ? AND user_id = ?", commentID, currentUser.ID).First(&like).Error

	var liked bool
	if err == nil {
		// いいね済み → 取り消し
		database.DB.Delete(&like)
		liked = false
	} else {
		// いいね追加
		like = models.CommentLike{
			CommentID: comment.ID,
			UserID:    currentUser.ID,
		}
		database.DB.Create(&like)
		liked = true
	}

	// いいね数を取得
	var likesCount int64
	database.DB.Model(&models.CommentLike{}).Where("comment_id = ?", commentID).Count(&likesCount)

	return c.JSON(http.StatusOK, map[string]interface{}{
		"liked":       liked,
		"likes_count": likesCount,
	})
}

// 再帰的にコメントレスポンスを構築
func (cc *CommentController) buildCommentResponse(comment models.Comment, currentUserID uint) CommentResponse {
	// いいね数取得
	var likesCount int64
	database.DB.Model(&models.CommentLike{}).Where("comment_id = ?", comment.ID).Count(&likesCount)

	// 自分がいいねしているか
	var isLiked bool
	var like models.CommentLike
	err := database.DB.Where("comment_id = ? AND user_id = ?", comment.ID, currentUserID).First(&like).Error
	isLiked = (err == nil)

	// リプライを取得
	var replies []models.Comment
	database.DB.Where("parent_id = ?", comment.ID).
		Preload("User").
		Order("created_at DESC").
		Find(&replies)

	// 再帰的にリプライのレスポンスを構築
	var replyResponses []CommentResponse
	for _, reply := range replies {
		replyResponses = append(replyResponses, cc.buildCommentResponse(reply, currentUserID))
	}

	return CommentResponse{
		ID:         comment.ID,
		PostID:     comment.PostID,
		UserID:     comment.UserID,
		ParentID:   comment.ParentID,
		Content:    comment.Content,
		User:       comment.User,
		LikesCount: likesCount,
		IsLiked:    isLiked,
		Replies:    replyResponses,
		CreatedAt:  comment.CreatedAt.Format("2006-01-02T15:04:05Z07:00"),
	}
}
