# AWS Infrastructure

AWSインフラストラクチャの学習・検証用リポジトリ。複数のIaCツールを使用したインフラ構築パターンを含みます。

## 📁 主要ディレクトリ

### IaCツール
- **cloud-formation/** - CloudFormationテンプレート集（EC2、ECS、Lambda、RDS、S3など）
- **cdk/** - AWS CDKプロジェクト（TypeScript）
- **sam/** - AWS SAMプロジェクト
- **terraform/** - Terraformプロジェクト

### その他
- **blue-green-deployment/** - Blue/Greenデプロイメント実装例
- **demo-application/** - デモアプリケーション

## 🛠️ 基本的な使い方

```bash
# CloudFormation
cd cloud-formation
./deploy.sh -t <template-file> -s <stack-name> -P <aws-profile>

# CDK
cd cdk/<project-name>
npm install
npx cdk deploy

# SAM
cd sam/<project-name>
sam build
sam deploy --guided

# Terraform
cd terraform/<project-name>
terraform init
terraform apply
```

## 📝 主な学習トピック

- コンピューティング（EC2、ECS、Lambda）
- データベース（RDS、DynamoDB）
- ストレージ・配信（S3、CloudFront）
- 監視（CloudWatch、Synthetics）
- FIS（障害注入テスト）
- Blue/Greenデプロイメント
- マルチテナントアーキテクチャ
