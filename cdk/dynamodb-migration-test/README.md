# DynamoDB Migration Test

DynamoDBのテーブル間データ移行を検証するためのCDKプロジェクト。

## 構成

### DynamoDBテーブル

| テーブル名 | 用途 |
|-----------|------|
| SourceTable | データ移行元 |
| DestinationTable | データ移行先 |
| SampleTable | スタック再作成での移行検証用 |

全テーブル共通のスキーマ：

| 項目 | 値 |
|------|-----|
| パーティションキー | id (String) |
| ソートキー | type (String) |
| 課金モード | オンデマンド |
| PITR | 有効 |

### サンプルデータ構造

ユーザー100人 × (PROFILE 1件 + ORDER 3件) = 400件

```
id: USER#001, type: PROFILE      ← ユーザー基本情報
id: USER#001, type: ORDER#001    ← 注文1
id: USER#001, type: ORDER#002    ← 注文2
id: USER#001, type: ORDER#003    ← 注文3
```

## 使い方

### 1. デプロイ
```bash
cdk deploy
```

### 2. テーブルにデータ挿入
```bash
./scripts/seed-data.sh
```
SourceTableとSampleTableの両方に400件ずつデータが挿入される。

### 3. データ確認
```bash
aws dynamodb scan --table-name SourceTable --select COUNT
aws dynamodb scan --table-name SampleTable --select COUNT
```

### 4. テーブル間データ移行
```bash
# AWS SSOを使っている場合
AWS_PROFILE=study python scripts/migrate-table.py

# または
python scripts/migrate-table.py
```

### 5. 移行結果確認
```bash
aws dynamodb scan --table-name DestinationTable --select COUNT
```

## スタック再作成時のデータ移行

SampleTableのデータを保持したままスタックを再作成する場合の手順。

### 1. データをエクスポート（cdk destroy前）
```bash
AWS_PROFILE=study python scripts/old-sample-table-to-new-sample-table/export-old-sample-table.py
```
`backup.json` にデータが保存される。

### 2. スタック削除・再作成
```bash
cdk destroy
cdk deploy
```

### 3. データをインポート（cdk deploy後）
```bash
AWS_PROFILE=study python scripts/old-sample-table-to-new-sample-table/import-new-sample-table.py
```

## スクリプト一覧

| スクリプト | 説明 |
|-----------|------|
| `seed-data.sh` | SourceTableとSampleTableに400件ずつサンプルデータを挿入 |
| `migrate-table.py` | SourceTable → DestinationTable にデータ移行 |
| `old-sample-table-to-new-sample-table/export-old-sample-table.py` | SampleTableのデータをJSONファイルにエクスポート |
| `old-sample-table-to-new-sample-table/import-new-sample-table.py` | JSONファイルからSampleTableにデータをインポート |
