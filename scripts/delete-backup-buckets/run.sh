#!/bin/bash
# S3バケット完全削除スクリプト
# - バージョニングが有効なバケットも完全に削除
# - すべてのオブジェクトバージョンと削除マーカーを削除してからバケットを削除

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

if [[ ${#BUCKET_NAMES[@]} -eq 0 ]]; then
  echo "No buckets specified in ${BUCKET_NAMES_FILE}"
  exit 0
fi

# 事前チェック: 存在しないバケットの確認
echo "Checking for existing buckets..."
MISSING_BUCKET_NAMES=()
EXISTING_BUCKET_NAMES=()
for BUCKET_NAME in "${BUCKET_NAMES[@]}"; do
  if aws s3api head-bucket --bucket "${BUCKET_NAME}" 2>/dev/null; then
    EXISTING_BUCKET_NAMES+=("${BUCKET_NAME}")
  else
    MISSING_BUCKET_NAMES+=("${BUCKET_NAME}")
  fi
done

# 存在しないバケットがあれば警告
if [[ ${#MISSING_BUCKET_NAMES[@]} -gt 0 ]]; then
  echo "Warning: The following buckets do not exist (will be skipped):"
  for BUCKET_NAME in "${MISSING_BUCKET_NAMES[@]}"; do
    echo "  - ${BUCKET_NAME}"
  done
fi

# 削除対象がなければ終了
if [[ ${#EXISTING_BUCKET_NAMES[@]} -eq 0 ]]; then
  echo "No buckets to delete."
  exit 0
fi

# 削除確認
echo ""
echo "The following buckets will be PERMANENTLY DELETED:"
for BUCKET_NAME in "${EXISTING_BUCKET_NAMES[@]}"; do
  echo "  - ${BUCKET_NAME}"
done
echo ""
read -p "Are you sure you want to delete these buckets? (yes/no): " CONFIRM
if [[ "${CONFIRM}" != "yes" ]]; then
  echo "Aborted."
  exit 1
fi

# バケット削除関数
delete_bucket() {
  local BUCKET_NAME="$1"

  echo "Deleting bucket: ${BUCKET_NAME}"
  echo "  Deleting all object versions and delete markers..."

  # 削除対象がなくなるまでループ（シンプルなアプローチ）
  while true; do
    # 最大1000件のオブジェクトバージョンを取得
    local RESPONSE
    RESPONSE=$(aws s3api list-object-versions \
      --bucket "${BUCKET_NAME}" \
      --max-keys 1000 \
      --output json 2>/dev/null || echo '{}')

    # VersionsとDeleteMarkersのカウントを取得
    local VERSION_COUNT
    local MARKER_COUNT
    VERSION_COUNT=$(echo "${RESPONSE}" | jq '[.Versions // [] | length] | add // 0')
    MARKER_COUNT=$(echo "${RESPONSE}" | jq '[.DeleteMarkers // [] | length] | add // 0')

    # 削除対象がなければループ終了
    if [[ "${VERSION_COUNT}" -eq 0 && "${MARKER_COUNT}" -eq 0 ]]; then
      break
    fi

    # Versionsを削除
    if [[ "${VERSION_COUNT}" -gt 0 ]]; then
      echo "${RESPONSE}" | jq -c '{Objects: [.Versions[] | {Key, VersionId}]}' | \
        aws s3api delete-objects \
          --bucket "${BUCKET_NAME}" \
          --delete file:///dev/stdin \
          --region "${REGION}" > /dev/null
      echo "    Deleted ${VERSION_COUNT} object versions..."
    fi

    # DeleteMarkersを削除
    if [[ "${MARKER_COUNT}" -gt 0 ]]; then
      echo "${RESPONSE}" | jq -c '{Objects: [.DeleteMarkers[] | {Key, VersionId}]}' | \
        aws s3api delete-objects \
          --bucket "${BUCKET_NAME}" \
          --delete file:///dev/stdin \
          --region "${REGION}" > /dev/null
      echo "    Deleted ${MARKER_COUNT} delete markers..."
    fi
  done

  # バケット削除
  echo "  Removing bucket..."
  aws s3 rb "s3://${BUCKET_NAME}" --region "${REGION}"

  echo "  Done: ${BUCKET_NAME}"
}

# バケット削除実行
for BUCKET_NAME in "${EXISTING_BUCKET_NAMES[@]}"; do
  delete_bucket "${BUCKET_NAME}"
done

echo ""
echo "All specified buckets have been deleted!"
