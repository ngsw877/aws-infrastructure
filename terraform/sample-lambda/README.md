# Sample Lambda Functions

3つのシンプルなLambda関数のTerraformサンプル

## Lambda関数の種類

1. **Hello World Lambda** - シンプルに「Hello World」を返す
2. **Timestamp Lambda** - 現在時刻を日本時間（JST）で返す
3. **Event Echo Lambda** - 受け取ったイベントとコンテキスト情報をそのまま返す（デバッグ用）

## ディレクトリ構造

```
terraform/sample-lambda/
├── main.tf           # メインのTerraform設定
├── outputs.tf        # 出力定義
├── .gitignore       # Git除外設定
├── README.md        # このファイル
└── lambda/
    ├── hello-world/
    │   └── index.py  # Hello World Lambda関数
    ├── timestamp/
    │   └── index.py  # Timestamp Lambda関数
    └── event-echo/
        └── index.py  # Event Echo Lambda関数
```

## 使い方

### 1. 初期化

```bash
cd terraform/sample-lambda
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

#### Hello World Lambdaのテスト

```bash
aws lambda invoke \
  --function-name sample-lambda-function \
  --region ap-northeast-1 \
  response.json

cat response.json
# {"statusCode": 200, "body": "{\"message\": \"Hello World\"}"}
```

#### Timestamp Lambdaのテスト

```bash
aws lambda invoke \
  --function-name timestamp-lambda-function \
  --region ap-northeast-1 \
  response.json

cat response.json
# {"statusCode": 200, "body": "{\"timestamp\": \"2025-10-31T12:34:56+09:00\", ...}"}
```

#### Event Echo Lambdaのテスト

```bash
# カスタムイベントを渡してテスト
aws lambda invoke \
  --function-name event-echo-lambda-function \
  --region ap-northeast-1 \
  --payload '{"test_key": "test_value", "user_id": 123}' \
  response.json

cat response.json
# 受け取ったイベントとコンテキスト情報が返ってくる
```

### 5. 削除

```bash
terraform destroy
```

## Lambda関数のコードについて

- `lambda/hello-world/index.py` - Hello World Lambda関数
- `lambda/timestamp/index.py` - 日本時間タイムスタンプLambda関数
- `lambda/event-echo/index.py` - イベントエコーLambda関数（デバッグ用）

各Lambda関数のコードはPythonで記述されており、Terraformの`archive_file`データソースが自動的にzip化してくれます。

コードを変更した場合は、`terraform apply`を実行するだけで自動的に新しいコードがデプロイされます。