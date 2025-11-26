# DynamoDB Migration Test

DynamoDBのテーブル間データ移行を検証するためのCDKプロジェクト。

## 構成

### DynamoDBテーブル

| テーブル名 | 用途 |
|-----------|------|
| SourceTable | データ移行元 |
| DestinationTable | データ移行先 |

両テーブルとも同じスキーマ：

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

### 2. SourceTableにデータ挿入
```bash
./scripts/seed-data.sh
```

### 3. データ確認
```bash
aws dynamodb scan --table-name SourceTable --select COUNT
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

## スクリプト一覧

| スクリプト | 説明 |
|-----------|------|
| `seed-data.sh` | SourceTableに400件のサンプルデータを挿入 |
| `migrate-table.py` | SourceTable → DestinationTable にデータ移行 |
