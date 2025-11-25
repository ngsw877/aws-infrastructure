# DynamoDB Migration Test

DynamoDBのS3 Export/Import機能を使ったデータ移行を検証するためのCDKプロジェクト。

## 構成

### DynamoDBテーブル
| 項目 | 値 |
|------|-----|
| テーブル名 | SampleTable |
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

### 2. S3バケット作成
```bash
./scripts/create-backup-bucket.sh
# または、バケット名を指定
./scripts/create-backup-bucket.sh my-bucket-name
```

### 3. データ挿入
```bash
./scripts/seed-data.sh
```

### 4. データ確認
```bash
aws dynamodb scan --table-name SampleTable --select COUNT
```

### 5. S3エクスポート（マネジメントコンソール）
1. DynamoDBコンソールを開く
2. 左メニューから「Exports to S3」を選択
3. 「Export to S3」ボタンをクリック
4. ソーステーブル: SampleTable
5. S3バケット: 作成したバケットを指定
6. エクスポート形式: DynamoDB JSON
7. 「Export」をクリック

### 6. テーブル削除
```bash
cdk destroy
```

### 7. 再デプロイ
```bash
cdk deploy
```

### 8. S3インポート（マネジメントコンソール）
1. DynamoDBコンソールを開く
2. 左メニューから「Import from S3」を選択
3. 「Import from S3」ボタンをクリック
4. S3ソースURL: `s3://bucket/prefix/AWSDynamoDB/<export-id>/data/`
5. インポートファイル形式: DynamoDB JSON
6. テーブル名やキー設定を入力
7. 「Import」をクリック

## 注意事項

- S3エクスポートにはPITR（ポイントインタイムリカバリ）が有効である必要がある
- エクスポート/インポートには時間がかかる場合がある（データ量による）
- インポート時は新しいテーブルが作成される（既存テーブルへの追加ではない）

## 参考

- [Migrate a table using export to S3 and import from S3 - AWS Documentation](https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/bp-migrating-table-between-accounts-s3.html)
