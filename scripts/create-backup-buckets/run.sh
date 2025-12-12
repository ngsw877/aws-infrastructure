#!/bin/bash
# S3バックアップバケット作成スクリプト
# - バージョニング有効化
# - パブリックアクセスはデフォルトでブロック

set -euo pipefail

REGION="${AWS_REGION:-ap-northeast-1}"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUCKET_NAMES_FILE="${SCRIPT_DIR}/bucket-names.txt"

# バケット名を配列に読み込み
BUCKET_NAMES=()
while read -r BUCKET_NAME; do
  # 空行とコメント行をスキップ
  [[ -z "${BUCKET_NAME}" || "${BUCKET_NAME}" =~ ^# ]] && continue
  BUCKET_NAMES+=("${BUCKET_NAME}")
done < "${BUCKET_NAMES_FILE}"

# 事前チェック: 既存バケットの確認
echo "Checking for existing buckets..."
EXISTING_BUCKET_NAMES=()
for BUCKET_NAME in "${BUCKET_NAMES[@]}"; do
  if aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null; then
    EXISTING_BUCKET_NAMES+=("${BUCKET_NAME}")
  fi
done

# 既存バケットがあればエラー終了
if [[ ${#EXISTING_BUCKET_NAMES[@]} -gt 0 ]]; then
  echo "Error: The following buckets already exist:" >&2
  for BUCKET_NAME in "${EXISTING_BUCKET_NAMES[@]}"; do
    echo "  - ${BUCKET_NAME}" >&2
  done
  exit 1
fi

echo "All buckets are available. Proceeding with creation..."

# バケット作成
for BUCKET_NAME in "${BUCKET_NAMES[@]}"; do
  echo "Creating bucket: ${BUCKET_NAME}"
  
  # バケット作成
  aws s3 mb "s3://${BUCKET_NAME}" --region "${REGION}"
  
  # バージョニング有効化
  aws s3api put-bucket-versioning \
    --bucket "${BUCKET_NAME}" \
    --versioning-configuration Status=Enabled \
    --region "${REGION}"
done

echo "Done!"
