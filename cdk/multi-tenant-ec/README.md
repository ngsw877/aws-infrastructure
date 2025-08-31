# Multi-Tenant EC

このプロジェクトは、AWSのCDK（Cloud Development Kit）を使用してインフラストラクチャをコードとして管理するためのリポジトリです。S3によるフロントエンドホスティングとECSによるバックエンドサービスを組み合わせたマルチテナント型ウェブアプリケーション基盤を提供します。

## インフラ構成概要

このプロジェクトのインフラは、AWS上にCDK（TypeScript）で構築されています。以下に全体像と主要な構成要素をまとめています。

### 技術スタック
- AWS CDK（TypeScript）を利用
- スタックは2つに分割されています：
  - **バージニア北部リージョン用スタック**（`global-stack.ts`）
    - CloudFront用ACM証明書やCloudFront用WAFなど、us-east-1（バージニア北部）に作成が必要なリソースを管理
  - **東京リージョン用スタック**（`main-stack.ts`）
    - 上記以外の全リソースをap-northeast-1（東京）で管理

### 環境構成
- 展開環境は複数あり：prd（本番）、stg、dev、testなど
- 環境ごとのパラメータは`params`ディレクトリに定義されています

### 主なリソース構成
- **ウェブサービス全体をAWS上に展開**
- **フロントエンド**
  - Nuxt.jsアプリをS3にホスト
  - CloudFrontを前段に配置し、WAFをアタッチ
  - Nuxt.jsのフロントエンドは、バックエンドAPIのLaravelアプリへリクエストして通信
- **バックエンドAPI**
  - LaravelアプリをFargate（appコンテナ）でホスト
  - ALBを前段に配置し、WAFをアタッチ
- **データベース**
  - Aurora Serverless v2 for PostgreSQL v16を利用

### CloudFront用WAFのIP制限
- CloudFront用のAWS WAFでは、テナントごとにIPアドレス制限の設定が可能
  - IP制限をかけているテナントについては、パラメータファイルで指定したIPアドレスだけを許可する、そのテナント用のWAFルールを作成
  - また、IPアドレス制限を除外するパスもテナントごとに指定でき、指定したパスをIP制限から除外するWAFルールも作成

### マルチテナント構成
- ウェブアプリはマルチテナント方式
- テナントごとに独自ドメインを割り当て
- CloudFront用ACM・ALB用ACMともに、1つの証明書に複数テナントのドメインを登録
- ECS、S3、Auroraなどのリソースは複数テナントで共有
- Aurora内の論理DBは1つのみ（テナントごとにDBを分割していない）

## プロジェクト構造

```
cdk/multi-tenant-ec/
├── bin/                    # CDKアプリケーションのエントリーポイント
├── lib/                    # スタック定義
│   ├── global-stack.ts     # バージニア北部リージョン用スタック
│   └── main-stack.ts       # 東京リージョン用スタック
├── params/                 # 環境別パラメータ
│   ├── dev.ts              # 開発環境用パラメータ
│   ├── prod.ts             # 本番環境用パラメータ
│   ├── stg.ts              # ステージング環境用パラメータ
│   └── secrets.ts          # シークレット設定
├── types/                  # 型定義
├── test/                   # テストコード
└── cloudfront-functions/   # CloudFront Functionsのコード
```

## 使用方法

### 前提条件
- Node.js とnpm がインストールされていること
- AWS CDK CLIがインストールされていること
- AWSアカウントの認証情報が設定されていること

### 一般的なコマンド

* `npm run build`   TypeScriptコードをJSにコンパイル
* `npm run watch`   変更を監視して自動コンパイル
* `npm run test`    Jestによるユニットテストを実行
* `npx cdk deploy`  スタックをデフォルトのAWSアカウント/リージョンにデプロイ
* `npx cdk diff`    デプロイ済みスタックと現在の状態を比較
* `npx cdk synth`   CloudFormationテンプレートを生成

## 環境別デプロイ

特定の環境にデプロイする場合は、以下のようにパラメータを指定します：

```bash
npx cdk deploy --context env=dev   # 開発環境へのデプロイ
npx cdk deploy --context env=stg   # ステージング環境へのデプロイ
npx cdk deploy --context env=prod  # 本番環境へのデプロイ
```

## 補足

インフラ構成の詳細や運用ルールは本READMEを参照してください。CDKコードの具体的な実装は各スタックファイル（`global-stack.ts`および`main-stack.ts`）を確認してください。
