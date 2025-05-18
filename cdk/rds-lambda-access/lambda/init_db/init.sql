-- 自動的にupdated_atを更新するための関数を作成
CREATE OR REPLACE FUNCTION trigger_set_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ユーザーテーブルの作成（存在しない場合のみ）
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    age INT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 更新時にupdated_atを自動更新するトリガー
DROP TRIGGER IF EXISTS set_timestamp ON users;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON users
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();

-- テーブルが空の場合のみデータを挿入するための工夫
DO $$
BEGIN
    IF (SELECT COUNT(*) FROM users) = 0 THEN
        -- サンプルデータを挿入
        INSERT INTO users (name, age) VALUES
        ('Alice', 25),
        ('Bob', 30),
        ('Charlie', 22),
        ('デイビッド', 28),
        ('エミリー', 24);
    END IF;
END $$;

-- コメント: 新しいテーブルを追加する場合は以下のようにします
-- 例: productsテーブルを追加する場合

/*
CREATE TABLE IF NOT EXISTS products (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 更新時にupdated_atを自動更新するトリガー
DROP TRIGGER IF EXISTS set_timestamp ON products;
CREATE TRIGGER set_timestamp
BEFORE UPDATE ON products
FOR EACH ROW
EXECUTE FUNCTION trigger_set_timestamp();
*/