#!/bin/bash
# S3バックアップバケット作成スクリプト
# - バージョニング有効化
# - パブリックアクセスはデフォルトでブロック

set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUCKET_LIST="${SCRIPT_DIR}/bucket-names.txt"

while read -r BUCKET_NAME; do
  # 空行とコメント行をスキップ
  [[ -z "${BUCKET_NAME}" || "${BUCKET_NAME}" =~ ^# ]] && continue
  echo "Creating bucket: ${BUCKET_NAME}"
  
  # バケット作成（既に存在する場合はスキップ）
  aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}" 2>/dev/null || true
  
  # バージョニング有効化
  aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled \
    --region "${REGION}"
done < "${BUCKET_LIST}"

echo "Done!"
