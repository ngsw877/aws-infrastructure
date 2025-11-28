#!/bin/bash
# S3バケット間コピースクリプト
# bucket-pairs.csvに定義されたペアでコピーを実行

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
BUCKET_PAIRS="${SCRIPT_DIR}/bucket-pairs.csv"

while IFS=',' read -r SOURCE_BUCKET DEST_BUCKET; do
  [[ -z "${SOURCE_BUCKET}" || "${SOURCE_BUCKET}" =~ ^# ]] && continue
  echo "Copying: ${SOURCE_BUCKET} -> ${DEST_BUCKET}"
  aws s3 sync "s3://${SOURCE_BUCKET}" "s3://${DEST_BUCKET}"
done < "${BUCKET_PAIRS}"

echo "Done!"

