#!/bin/bash

# DynamoDB エクスポート用 S3 バケットを作成するスクリプト
# 使用方法: ./create-backup-bucket.sh [バケット名]

BUCKET_NAME="${1:-dynamodb-backup-$(date +%Y%m%d)}"
REGION="${AWS_DEFAULT_REGION:-ap-northeast-1}"

echo "S3 バケットを作成します..."
echo "  バケット名: ${BUCKET_NAME}"
echo "  リージョン: ${REGION}"

aws s3 mb "s3://${BUCKET_NAME}" --region "$REGION"

if [ $? -ne 0 ]; then
  echo "エラー: バケットの作成に失敗しました"
  exit 1
fi

echo ""
echo "完了！バケットURL: s3://${BUCKET_NAME}"
