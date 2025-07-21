# CloudWatch Synthetics Canaries CDK Project

AWS CDKを使用してCloudWatch Syntheticsによる死活監視を実装するプロジェクトです。

## 概要

このプロジェクトは、Example.com（https://example.com）への死活監視を行うCloudWatch Syntheticsカナリアを作成します。監視失敗時はSlackへ通知されます。

## 機能

- **死活監視**: 5分ごとにExample.comへのアクセスをチェック
- **アラート通知**: 監視失敗時にSlackへ自動通知
- **テスト内容**:
  - HTTPステータスコード200の確認
  - ページタイトルの存在確認
  - Example Domainページの内容確認
  - デバッグ用スクリーンショット撮影

## アーキテクチャ

- **CloudWatch Synthetics Canary**: Playwright/Node.jsベースのテストスクリプト
- **CloudWatch Alarm**: カナリア失敗時のアラーム
- **Amazon SNS**: Slack Webhookへの通知
- **Amazon S3**: テスト結果とスクリーンショットの保存（30日間保持）

## デプロイ方法

```bash
# 依存関係のインストール
npm install

# CloudFormationテンプレートの生成（確認用）
npx cdk synth

# AWSへのデプロイ
npx cdk deploy
```

## 監視設定

- **実行間隔**: 5分ごと
- **アラーム閾値**: 1回の失敗でアラーム発生
- **通知先**: Slack（設定済みWebhook URL使用）

## ファイル構成

- `lib/synthetics-canaries-stack.ts`: CDKスタック定義
- `canary/index.js`: Syntheticsカナリアのテストスクリプト（Playwrightベース）
- `bin/synthetics-canaries.ts`: CDKアプリケーションのエントリーポイント

## 注意事項

- デプロイ前にAWS認証情報が正しく設定されていることを確認してください
- Slack Webhook URLは本番環境では環境変数やSecrets Managerで管理することを推奨します
