# Spot Instance FIS Test Infrastructure

このTerraformプロジェクトは、EC2スポットインスタンスの中断をテストするためのインフラストラクチャを構築します。

## 概要

以下のリソースを作成します：

- **VPC**: 隔離された仮想プライベートクラウド
- **プライベートサブネット**: 2つのAZに配置
- **セキュリティグループ**: 完全隔離（Egressルールなし）
- **Launch Template**: EC2インスタンス起動テンプレート
- **Auto Scaling Group**: スポットインスタンス100%構成
- **SNS Topic**: スポット中断通知用
- **EventBridge Rules**: スポット中断イベント検知
- **AWS Chatbot**: Slack通知設定
- **FIS Experiment Template**: スポット中断テスト用
- **IAM Roles**: Chatbot用、FIS用
- **CloudWatch Logs**: FIS実験ログ

## 前提条件

- Terraform >= 1.0
- AWS CLI設定済み
- Slack Workspace IDとChannel IDを取得済み
- AWS Chatbotの初期設定が完了していること

## セットアップ

### 1. 変数ファイルの作成

```bash
cp terraform.tfvars.example terraform.tfvars
```

### 2. terraform.tfvarsの編集

```hcl
slack_workspace_id = "T0XXXXXXXXX"  # あなたのSlack Workspace ID
slack_channel_id   = "C0XXXXXXXXX"  # あなたのSlack Channel ID
```

### 3. Terraformの初期化

```bash
terraform init
```

### 4. プランの確認

```bash
terraform plan
```

### 5. インフラのデプロイ

```bash
terraform apply
```

## FIS実験の実行

インフラのデプロイ後、AWS FISを使用してスポットインスタンスの中断をテストできます。

### AWS CLIで実行する場合

```bash
# FIS実験テンプレートIDを取得
terraform output fis_experiment_template_id

# 実験を開始
aws fis start-experiment \
  --experiment-template-id <template-id> \
  --region ap-northeast-1
```

### AWS Management Consoleで実行する場合

1. FIS → 実験テンプレート → `spot-instance-fis-test-interrupt-spot-instance-test`
2. 「実験を開始」ボタンをクリック
3. 実験が開始され、3分後にスポットインスタンスが中断されます

## 通知について

スポットインスタンスの中断に関する以下のイベントがSlackに通知されます：

1. **EC2 Instance Rebalance Recommendation**: 中断リスク上昇の早期警告
2. **EC2 Spot Instance Interruption Warning**: 終了2分前の最終警告（回避不可）
3. **BidEvictedEvent**: 実際にスポットインスタンスが中断された（CloudTrail有効化が必要）

## 重要な注意事項

- **BidEvictedEvent**の検知にはCloudTrailの有効化が必要です
- セキュリティグループは完全隔離設定（Egressルールなし）のため、インターネット通信はできません
- スポットインスタンスは100%構成のため、コストが最小化されます
- FIS実験の実行には追加の料金がかかります

## クリーンアップ

インフラを削除する場合：

```bash
terraform destroy
```

## ファイル構成

Terraformの基本的な4ファイル構成を採用しています：

```
.
├── README.md                      # このファイル
├── versions.tf                    # Terraformとプロバイダーのバージョン
├── variables.tf                   # 入力変数定義
├── main.tf                        # すべてのリソース定義
│                                  # - VPC & Network
│                                  # - IAM Roles & Policies
│                                  # - EC2 & Auto Scaling
│                                  # - Monitoring & Notifications
│                                  # - AWS Chatbot
│                                  # - FIS Experiment Template
├── outputs.tf                     # 出力値
├── terraform.tfvars.example       # 変数ファイルの例
└── .gitignore                     # Git除外設定
```

main.tfは論理的なセクションに分かれており、コメントで区切られています。

## 参考リンク

- [AWS FIS Actions Reference](https://docs.aws.amazon.com/fis/latest/userguide/fis-actions-reference.html#send-spot-instance-interruptions)
- [AWS FIS Monitoring and Logging](https://docs.aws.amazon.com/fis/latest/userguide/monitoring-logging.html)
- [EC2 Spot Instance Interruptions](https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/spot-interruptions.html)