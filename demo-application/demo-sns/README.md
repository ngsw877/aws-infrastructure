# Demo SNS - Twitter風SNSアプリケーション

シンプルなTwitter風SNSアプリケーション。学習・デモ用のプロジェクトです。

## 技術スタック

### バックエンド
- **Laravel 12** - PHPフレームワーク
- **PHP 8.3 FPM** - PHP実行環境
- **Nginx** - Webサーバー
- **PostgreSQL 16** - データベース
- **Laravel Sanctum** - API認証
- **MinIO** - S3互換ローカルストレージ

### フロントエンド
- **Nuxt 4** - Vue.jsフレームワーク
- **Vue 3** - UIフレームワーク
- **Vite 7** - ビルドツール
- **Node.js 22** - JavaScript実行環境
- **カスタムCSS** - スタイリング

### インフラ
- **Docker & Docker Compose** - コンテナ環境

## 機能一覧

- ✅ ユーザー登録・ログイン・ログアウト
- ✅ 投稿機能（テキスト + 画像）
- ✅ 投稿の削除
- ✅ いいね機能
- ✅ ユーザーフォロー機能
- ✅ プロフィール編集（名前、Bio、アバター画像）

---

## セットアップ手順

### 前提条件

- Docker Desktop for Mac がインストールされている
- Docker Desktop が起動している

### 1. プロジェクトディレクトリに移動

```bash
cd demo-application/demo-sns
```

### 2. Dockerコンテナをビルド＆起動

```bash
# 初回起動（ビルド含む）
docker compose up -d --build

# 起動確認
docker compose ps
```

### 3. データベースマイグレーション実行

```bash
# バックエンドコンテナに入る
docker compose exec backend sh

# マイグレーション実行
php artisan migrate

# コンテナから抜ける
exit
```

### 4. MinIOでバケット作成

1. MinIOコンソールにアクセス: http://localhost:9001
2. ログイン
   - Username: `minioadmin`
   - Password: `minioadmin`
3. 左メニューの「Buckets」をクリック
4. 「Create Bucket」をクリック
5. Bucket Name: `demo-sns` と入力
6. 「Create Bucket」をクリック
7. 作成したバケットをクリック
8. 「Anonymous」タブをクリック
9. 「Add Access Rule」で公開設定
   - Prefix: `*`
   - Access: `readonly`
10. 「Save」をクリック

### 5. アプリケーションにアクセス

- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8000/api
- **MinIOコンソール**: http://localhost:9001

---

## ディレクトリ構造

```
demo-sns/
├── compose.yml                # Docker Compose設定
├── .env.example               # 環境変数テンプレート
├── .gitignore                 # Git除外設定
├── README.md                  # このファイル
├── backend/                   # Laravel 12バックエンド
│   ├── docker/
│   │   ├── php/
│   │   │   └── Dockerfile     # PHPコンテナ設定
│   │   └── nginx/
│   │       └── default.conf   # Nginx設定
│   ├── app/
│   │   ├── Http/
│   │   │   └── Controllers/Api/  # APIコントローラー
│   │   ├── Models/              # Eloquentモデル
│   │   └── Policies/            # 認可ポリシー
│   ├── database/
│   │   └── migrations/          # データベースマイグレーション
│   ├── routes/
│   │   └── api.php              # APIルート定義
│   └── config/                  # Laravel設定ファイル
└── frontend/                  # Nuxt 4フロントエンド
    ├── docker/
    │   └── Dockerfile         # Nodeコンテナ設定
    ├── app/                   # Nuxt 4 appディレクトリ
    │   ├── app.vue            # ルートコンポーネント
    │   ├── assets/
    │   │   └── css/           # CSS
    │   ├── components/        # Vueコンポーネント
    │   ├── composables/       # コンポーザブル関数
    │   ├── layouts/           # レイアウトコンポーネント
    │   └── pages/             # ページコンポーネント
    ├── nuxt.config.ts         # Nuxt設定
    └── package.json           # npmパッケージ
```

### Nuxt 4の新しいディレクトリ構造

Nuxt 4では`app/`ディレクトリを使用する新構造が導入されました。

**メリット:**
- アプリケーションコードが明確に分離
- ファイルウォッチャーの高速化
- クライアント/サーバーコードの区別が容易

---

## データベーススキーマ

### users テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint | 主キー |
| name | string | ユーザー名 |
| email | string | メールアドレス（一意） |
| password | string | パスワード（ハッシュ化） |
| bio | text | 自己紹介 |
| avatar_url | string | アバター画像URL |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

### posts テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint | 主キー |
| user_id | bigint | ユーザーID（外部キー） |
| content | text | 投稿内容 |
| image_url | string | 画像URL |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

### likes テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint | 主キー |
| user_id | bigint | ユーザーID（外部キー） |
| post_id | bigint | 投稿ID（外部キー） |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

**制約**: unique(user_id, post_id) - 同じ投稿に複数回いいねできない

### follows テーブル
| カラム | 型 | 説明 |
|--------|-----|------|
| id | bigint | 主キー |
| follower_id | bigint | フォローする人（外部キー） |
| following_id | bigint | フォローされる人（外部キー） |
| created_at | timestamp | 作成日時 |
| updated_at | timestamp | 更新日時 |

**制約**: unique(follower_id, following_id) - 同じ人を複数回フォローできない

---

## Docker構成

### コンテナ一覧

| サービス | コンテナ名 | 役割 | ポート |
|---------|-----------|------|--------|
| postgres | demo-sns-postgres | PostgreSQLデータベース | 5432 |
| backend | demo-sns-backend | PHP-FPM (Laravel 12) | 9000 |
| nginx | demo-sns-nginx | Webサーバー (Nginx) | 8000 |
| frontend | demo-sns-frontend | Nuxt 4開発サーバー | 3000 |
| minio | demo-sns-minio | S3互換ストレージ | 9000, 9001 |

### コンテナ間の通信フロー

```
Frontend (Nuxt)
    ↓ HTTP
Nginx (:8000)
    ↓ FastCGI (:9000)
Backend (PHP-FPM)
    ↓ PostgreSQL (:5432)
Database (PostgreSQL)
    ↓ S3 API (:9000)
MinIO (S3互換ストレージ)
```

**ネットワーク**: すべてのコンテナは`demo-sns-network`ブリッジネットワーク上で通信

---

## APIエンドポイント

### 認証
- `POST /api/register` - ユーザー登録
- `POST /api/login` - ログイン
- `POST /api/logout` - ログアウト（要認証）
- `GET /api/me` - 現在のユーザー情報取得（要認証）

### 投稿
- `GET /api/posts` - 投稿一覧取得（要認証）
- `POST /api/posts` - 投稿作成（要認証）
- `GET /api/posts/{id}` - 投稿詳細取得（要認証）
- `PUT /api/posts/{id}` - 投稿更新（要認証）
- `DELETE /api/posts/{id}` - 投稿削除（要認証）

### いいね
- `POST /api/posts/{id}/like` - いいねトグル（要認証）

### フォロー
- `POST /api/users/{id}/follow` - フォロートグル（要認証）

### プロフィール
- `GET /api/users/{id}` - ユーザー情報取得（要認証）
- `PUT /api/profile` - プロフィール更新（要認証）
- `POST /api/profile` - プロフィール更新（マルチパート対応、要認証）

---

## アーキテクチャ

### 認証フロー

1. ユーザーがログイン/登録リクエスト
2. Laravel Sanctumがトークン生成
3. フロントエンドがCookieにトークン保存
4. 以降のAPIリクエストに`Authorization: Bearer {token}`ヘッダーを含める
5. Sanctumミドルウェアでトークン検証
6. 認証成功でリクエスト処理

### 画像アップロードフロー

1. フロントエンドから`FormData`で画像送信
2. Laravelがバリデーション（ファイルサイズ、形式）
3. MinIO（S3互換）にアップロード
4. 公開URLをデータベースに保存
5. フロントエンドでMinIO URLから画像表示

---

## 開発コマンド

### Docker操作

```bash
# 起動
docker compose up -d

# 停止
docker compose stop

# 完全停止（コンテナ削除）
docker compose down

# ログ確認
docker compose logs -f

# 特定のコンテナのログ
docker compose logs -f frontend
docker compose logs -f backend
```

### バックエンド操作

```bash
# コンテナに入る
docker compose exec backend sh

# マイグレーション
php artisan migrate

# マイグレーションのリセット
php artisan migrate:fresh

# ルート一覧
php artisan route:list

# Tinker起動
php artisan tinker
```

### データベース操作

```bash
# PostgreSQLに接続
docker compose exec postgres psql -U demo_sns_user -d demo_sns

# テーブル一覧
\dt

# 終了
\q
```

---

## トラブルシューティング

### フロントエンドが起動しない

```bash
# コンテナ再起動
docker compose restart frontend

# ログ確認
docker compose logs -f frontend
```

### マイグレーションエラー

```bash
# データベース接続確認
docker compose exec backend php artisan db:show

# マイグレーションやり直し
docker compose exec backend php artisan migrate:fresh
```

### 画像アップロードできない

1. MinIOコンソール（http://localhost:9001）にアクセス
2. `demo-sns`バケットが存在するか確認
3. バケットが公開設定（Anonymous: readonly）か確認

---

## ライセンス

このプロジェクトは学習・デモ用です。
