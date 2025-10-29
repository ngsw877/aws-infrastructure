# Hello World Lambda Function

シンプルな「Hello World」を返すLambda関数のTerraformサンプル

## ディレクトリ構造

```
terraform/
├── main.tf           # メインのTerraform設定
├── variables.tf      # 変数定義
├── outputs.tf        # 出力定義
├── .gitignore       # Git除外設定
└── lambda/
    └── hello/
        └── index.py  # Lambda関数のコード
```

## 使い方

### 1. 初期化

```bash
cd terraform
terraform init
```

### 2. プラン確認

```bash
terraform plan
```

### 3. デプロイ

```bash
terraform apply
```

### 4. Lambda関数を実行してテスト

AWS CLIを使ってテスト:

```bash
aws lambda invoke \
  --function-name hello-world-function \
  --region ap-northeast-1 \
  response.json

cat response.json
```

### 5. 削除

```bash
terraform destroy
```

## Lambda関数のコードについて

`lambda/hello/index.py`にPythonコードが格納されています。
Terraformの`archive_file`データソースが自動的にzip化してくれます。

コードを変更した場合は、`terraform apply`を実行するだけで自動的に新しいコードがデプロイされます。