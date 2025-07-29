# シングルテナント ショッピングサイト

Amazon風のシングルテナント型ECサイトアプリケーションです。LaravelとNuxt.jsを使用して構築されています。

## アーキテクチャ

- **バックエンド**: Laravel 11 (PHP)
- **フロントエンド**: Nuxt.js 3 (Vue.js)
- **データベース**: PostgreSQL 17
- **ストレージ**: MinIO (S3互換)
- **コンテナ化**: Docker Compose

## 機能一覧

### 🛍️ 商品管理機能
- **商品一覧表示**: カテゴリー別フィルタリング、価格帯指定、在庫ありフィルタ
- **商品検索**: キーワード検索、並び替え（新着順、価格順、名前順）
- **商品詳細表示**: 商品画像、説明、価格、在庫状況
- **カテゴリー管理**: 8つの主要カテゴリー（電子機器、本・コミック、ファッション、家電、食品・飲料、スポーツ・アウトドア、おもちゃ・ゲーム、美容・健康）

### 🛒 ショッピングカート機能
- **カート追加**: 商品をカートに追加
- **カート管理**: 商品数量の変更、商品の削除
- **カートクリア**: 全商品を一括削除
- **セッション管理**: ユーザーセッション単位でのカート保持

### 🎨 ユーザーインターフェース
- **レスポンシブデザイン**: モバイル・デスクトップ対応
- **検索バー**: ヘッダーに統合された商品検索
- **カートバッジ**: カート内商品数の表示
- **ページネーション**: 商品一覧の分割表示
- **ローディング状態**: 非同期処理中の視覚的フィードバック

### 📱 ページ構成
- **ホームページ** (`/`): フィーチャー商品とカテゴリー一覧
- **商品一覧ページ** (`/products`): フィルタリング・検索機能付き商品一覧
- **商品詳細ページ** (`/products/[id]`): 個別商品の詳細情報
- **検索結果ページ** (`/search`): キーワード検索結果
- **カートページ** (`/cart`): ショッピングカート管理
- **アカウントページ** (`/account`): ユーザーアカウント情報

### 🖼️ 画像管理機能
- **SVG画像**: 軽量で高品質な商品画像
- **MinIOストレージ**: S3互換オブジェクトストレージによる画像管理
- **自動アップロード**: Seeder実行時の自動画像アップロード
- **フォールバック機能**: 画像未対応時のデフォルト画像表示

### 🔧 システム機能
- **ヘルスチェック**: アプリケーション稼働状況の監視
- **データベースシーディング**: サンプルデータの自動投入
- **エラーハンドリング**: 適切なエラー処理とユーザーフィードバック
- **CORS対応**: フロントエンド・バックエンド間の通信設定

## 技術仕様

### データベース設計
- **products**: 商品情報（名前、説明、価格、在庫等）
- **product_categories**: 商品カテゴリー
- **product_images**: 商品画像情報
- **carts**: ショッピングカート
- **cart_items**: カート内商品
- **users**: ユーザー情報

### API仕様
```
GET    /api/health_check           # ヘルスチェック
GET    /api/products               # 商品一覧取得
GET    /api/products/search        # 商品検索
GET    /api/products/{id}          # 商品詳細取得
GET    /api/categories             # カテゴリー一覧取得
GET    /api/cart                   # カート内容取得
POST   /api/cart/items             # カートに商品追加
PUT    /api/cart/items/{id}        # カート内商品更新
DELETE /api/cart/items/{id}        # カート内商品削除
DELETE /api/cart                   # カート全削除
```

## 環境構築

### 前提条件
- Docker Desktop
- Git

### セットアップ手順

1. **リポジトリのクローン**
   ```bash
   cd /path/to/your/workspace
   git clone <repository-url>
   cd single-tenant
   ```

2. **環境設定ファイルの準備**
   ```bash
   cd backend/src
   cp .env.example .env
   ```

3. **Docker Composeでサービス起動**
   ```bash
   cd backend
   docker-compose up -d
   ```

4. **依存関係のインストール**
   ```bash
   # バックエンド
   docker-compose exec app composer install
   
   # フロントエンド
   cd ../frontend
   npm install
   ```

5. **データベースセットアップ**
   ```bash
   # マイグレーション実行
   docker-compose exec app php artisan migrate
   
   # サンプルデータ投入
   docker-compose exec app php artisan db:seed
   ```

6. **フロントエンド起動**
   ```bash
   cd frontend
   npm run dev
   ```

### アクセス情報
- **フロントエンド**: http://localhost:3000
- **バックエンドAPI**: http://localhost:8080
- **MinIO管理コンソール**: http://localhost:9001 （minioadmin/minioadmin）
- **PostgreSQL**: localhost:15432 （webapp/webapp）

## 開発情報

### サンプルデータ
アプリケーションには以下のサンプルデータが含まれています：
- 17商品（各カテゴリー2-3商品）
- 8カテゴリー
- カテゴリー別SVG画像

### 設定可能な環境変数
```bash
# データベース設定
DB_CONNECTION=pgsql
DB_HOST=127.0.0.1
DB_PORT=5432
DB_DATABASE=shopping_site
DB_USERNAME=postgres

# MinIO設定
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
AWS_DEFAULT_REGION=us-east-1
AWS_BUCKET=shopping-site-assets
AWS_USE_PATH_STYLE_ENDPOINT=true
AWS_ENDPOINT=http://minio:9000

# アプリケーション設定
APP_URL=http://localhost:8080
FRONTEND_URL=http://localhost:3000
```

## 本番環境での考慮事項

### セキュリティ
- 環境変数の適切な設定
- データベース認証情報の保護
- CORS設定の見直し

### スケーラビリティ
- MinIOからAWS S3への移行対応
- データベース接続プールの設定
- キャッシュ機能の実装

### 監視・ログ
- アプリケーションログの設定
- エラー追跡システムの導入
- パフォーマンス監視

## 技術スタック詳細

### バックエンド (Laravel)
- **フレームワーク**: Laravel 11
- **データベースORM**: Eloquent
- **ストレージ**: Laravel Filesystem (S3ドライバー)
- **バリデーション**: Form Requestバリデーション
- **API**: RESTful API with resource controllers

### フロントエンド (Nuxt.js)
- **フレームワーク**: Nuxt.js 3
- **UIライブラリ**: カスタムSCSSスタイリング
- **状態管理**: Nuxt composables
- **HTTPクライアント**: Nuxt $fetch
- **ルーティング**: ファイルベースルーティング

### インフラストラクチャ
- **コンテナ化**: Docker & Docker Compose
- **Webサーバー**: Nginx (リバースプロキシ)
- **データベース**: PostgreSQL 17
- **オブジェクトストレージ**: MinIO (S3互換)
- **プロセスマネージャー**: PHP-FPM

## ライセンス

このプロジェクトはMITライセンスの下で公開されています。

## 貢献

プルリクエストやイシューの報告を歓迎しています。開発に参加される場合は、上記のセットアップ手順に従って開発環境を構築してください。