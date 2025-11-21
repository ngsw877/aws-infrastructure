-- ====================================
-- データベース初期化SQL（シンプル版）
-- ====================================

-- 既存テーブルを削除（冪等性のため）
DROP TABLE IF EXISTS posts CASCADE;
DROP TABLE IF EXISTS users CASCADE;

-- ====================================
-- テーブル作成
-- ====================================

-- ユーザーテーブル
CREATE TABLE users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    full_name VARCHAR(100),
    password_hash VARCHAR(255) NOT NULL,
    bio TEXT,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 投稿テーブル
CREATE TABLE posts (
    id SERIAL PRIMARY KEY,
    user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL,
    slug VARCHAR(200) NOT NULL UNIQUE,
    content TEXT NOT NULL,
    status VARCHAR(20) DEFAULT 'published',
    view_count INTEGER DEFAULT 0,
    like_count INTEGER DEFAULT 0,
    published_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- ====================================
-- インデックス作成
-- ====================================

CREATE INDEX idx_posts_user_id ON posts(user_id);
CREATE INDEX idx_posts_status ON posts(status);
CREATE INDEX idx_posts_published_at ON posts(published_at);
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_username ON users(username);

-- ====================================
-- サンプルデータ生成
-- ====================================

-- ユーザーデータ生成（1000件）
INSERT INTO users (username, email, full_name, password_hash, bio, is_active, created_at)
SELECT
    'user' || i,
    'user' || i || '@example.com',
    'User ' || i || ' Full Name',
    md5(random()::text),
    'Bio for user ' || i || '. ' || md5(random()::text),
    random() < 0.95,
    CURRENT_TIMESTAMP - (random() * interval '365 days')
FROM generate_series(1, 1000) AS i;

-- 投稿データ生成（1000件）
INSERT INTO posts (user_id, title, slug, content, status, view_count, like_count, published_at, created_at, updated_at)
SELECT
    (random() * 999 + 1)::INTEGER,
    'Post Title ' || i || ': ' || md5(random()::text)::text,
    'post-' || i || '-' || md5(i::text)::text,
    'This is the content for post ' || i || '. ' || repeat(md5(random()::text) || ' ', 20),
    CASE
        WHEN random() < 0.8 THEN 'published'
        WHEN random() < 0.9 THEN 'draft'
        ELSE 'archived'
    END,
    (random() * 5000)::INTEGER,
    (random() * 200)::INTEGER,
    CURRENT_TIMESTAMP - (random() * interval '365 days'),
    CURRENT_TIMESTAMP - (random() * interval '365 days'),
    CURRENT_TIMESTAMP - (random() * interval '180 days')
FROM generate_series(1, 1000) AS i;

-- ====================================
-- 統計情報を更新
-- ====================================

ANALYZE users;
ANALYZE posts;

-- ====================================
-- 初期化完了メッセージ
-- ====================================

DO $$
DECLARE
    user_count INTEGER;
    post_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO post_count FROM posts;

    RAISE NOTICE '====================================';
    RAISE NOTICE 'Database initialization completed!';
    RAISE NOTICE '====================================';
    RAISE NOTICE 'Users: %', user_count;
    RAISE NOTICE 'Posts: %', post_count;
    RAISE NOTICE '====================================';
END $$;
