package seeders

import (
	"demo-sns-backend/database"
	"demo-sns-backend/models"
	"demo-sns-backend/utils"
	"log"
)

func RunDemoSeeder() error {
	database.DB.Exec("DELETE FROM comment_likes")
	database.DB.Exec("DELETE FROM comments")
	database.DB.Exec("DELETE FROM likes")
	database.DB.Exec("DELETE FROM follows")
	database.DB.Exec("DELETE FROM posts")
	database.DB.Exec("DELETE FROM users")
	database.DB.Exec("ALTER SEQUENCE users_id_seq RESTART WITH 1")
	database.DB.Exec("ALTER SEQUENCE posts_id_seq RESTART WITH 1")
	database.DB.Exec("ALTER SEQUENCE comments_id_seq RESTART WITH 1")

	users := []models.User{
		{Name: "Guest User", Email: "guest@example.com", Password: hashPassword("password"), Bio: "ゲストユーザーです。自由にお試しください。"},
		{Name: "Alice", Email: "alice@example.com", Password: hashPassword("password"), Bio: "Webエンジニアです。Laravel好き！"},
		{Name: "Bob", Email: "bob@example.com", Password: hashPassword("password"), Bio: "フロントエンドエンジニア。Vue.js使ってます。"},
		{Name: "Charlie", Email: "charlie@example.com", Password: hashPassword("password"), Bio: "インフラエンジニア。Dockerとk8sが好き。"},
		{Name: "Diana", Email: "diana@example.com", Password: hashPassword("password"), Bio: "デザイナー兼フロントエンド。"},
		{Name: "Eve", Email: "eve@example.com", Password: hashPassword("password"), Bio: "プロダクトマネージャー。"},
	}

	for _, user := range users {
		database.DB.Create(&user)
	}
	log.Printf("Created %d users", len(users))

	posts := []models.Post{
		{UserID: 1, Content: "ゲストユーザーとしてログインしました。お試しください！"},
		{UserID: 2, Content: "こんにちは！初めての投稿です 👋"},
		{UserID: 2, Content: "Laravel 12すごく使いやすい！"},
		{UserID: 3, Content: "Nuxt 4の新しいディレクトリ構造いいね"},
		{UserID: 3, Content: "Composition API最高！"},
		{UserID: 4, Content: "Docker Composeでサクッと環境構築"},
		{UserID: 4, Content: "MinIOでローカルS3環境構築した"},
		{UserID: 5, Content: "デザインシステム作ってます"},
		{UserID: 5, Content: "Figma便利すぎる"},
		{UserID: 6, Content: "新機能のリリース準備中！"},
		{UserID: 6, Content: "ユーザーフィードバック集めてます"},
		{UserID: 2, Content: "PHPカンファレンス行きたい"},
		{UserID: 3, Content: "Viteのビルド速度やばい"},
		{UserID: 4, Content: "k8s勉強中"},
	}

	for _, post := range posts {
		database.DB.Create(&post)
	}
	log.Printf("Created %d posts", len(posts))

	likes := []models.Like{
		{UserID: 2, PostID: 1}, {UserID: 3, PostID: 1}, {UserID: 4, PostID: 1}, {UserID: 5, PostID: 1},
		{UserID: 2, PostID: 4}, {UserID: 2, PostID: 5}, {UserID: 3, PostID: 6}, {UserID: 4, PostID: 8},
		{UserID: 5, PostID: 10}, {UserID: 6, PostID: 12},
	}

	for _, like := range likes {
		database.DB.Create(&like)
	}
	log.Printf("Created %d likes", len(likes))

	follows := []models.Follow{
		{FollowerID: 2, FollowingID: 1}, {FollowerID: 2, FollowingID: 3},
		{FollowerID: 3, FollowingID: 1}, {FollowerID: 3, FollowingID: 2},
		{FollowerID: 4, FollowingID: 2}, {FollowerID: 5, FollowingID: 2},
		{FollowerID: 5, FollowingID: 3}, {FollowerID: 6, FollowingID: 2}, {FollowerID: 6, FollowingID: 4},
	}

	for _, follow := range follows {
		database.DB.Create(&follow)
	}
	log.Printf("Created %d follows", len(follows))

	// コメント（トップレベル）
	comments := []models.Comment{
		{PostID: 2, UserID: 3, Content: "初投稿おめでとうございます！🎉"},
		{PostID: 2, UserID: 4, Content: "よろしくお願いします！"},
		{PostID: 3, UserID: 3, Content: "わかります！最新版は型推論も強化されましたよね"},
		{PostID: 4, UserID: 2, Content: "app/ディレクトリ便利ですよね〜"},
		{PostID: 5, UserID: 4, Content: "setup scriptの書き心地最高です"},
		{PostID: 6, UserID: 5, Content: "Docker便利ですよね！"},
		{PostID: 7, UserID: 6, Content: "MinIO使ったことないです。今度試してみます！"},
		{PostID: 8, UserID: 6, Content: "デザインシステム興味あります"},
	}

	for _, comment := range comments {
		database.DB.Create(&comment)
	}
	log.Printf("Created %d comments", len(comments))

	// コメントへのリプライ（ネスト）
	parentID1 := uint(1) // "初投稿おめでとうございます！"へのリプライ
	parentID3 := uint(3) // "わかります！最新版は型推論も..."へのリプライ
	parentID6 := uint(6) // "Docker便利ですよね！"へのリプライ

	replies := []models.Comment{
		{PostID: 2, UserID: 2, ParentID: &parentID1, Content: "ありがとうございます！Bobさん😊"},
		{PostID: 3, UserID: 2, ParentID: &parentID3, Content: "そうなんです！型安全性が向上して開発体験が良くなりました"},
		{PostID: 3, UserID: 4, ParentID: &parentID3, Content: "私もLaravel使ってみたいです"},
		{PostID: 6, UserID: 4, ParentID: &parentID6, Content: "docker-composeで全部まとまるから楽ですよね"},
	}

	for _, reply := range replies {
		database.DB.Create(&reply)
	}
	log.Printf("Created %d replies", len(replies))

	// コメントいいね
	commentLikes := []models.CommentLike{
		{CommentID: 1, UserID: 2}, {CommentID: 1, UserID: 4}, {CommentID: 1, UserID: 5},
		{CommentID: 3, UserID: 2}, {CommentID: 3, UserID: 4},
		{CommentID: 4, UserID: 3}, {CommentID: 5, UserID: 3},
		{CommentID: 9, UserID: 3}, {CommentID: 9, UserID: 4},
	}

	for _, commentLike := range commentLikes {
		database.DB.Create(&commentLike)
	}
	log.Printf("Created %d comment likes", len(commentLikes))

	log.Println("Demo data seeding completed!")
	log.Println("Test accounts: guest@example.com, alice@example.com, bob@example.com / password")

	return nil
}

func hashPassword(password string) string {
	hashed, _ := utils.HashPassword(password)
	return hashed
}
