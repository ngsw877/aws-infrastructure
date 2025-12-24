#!/bin/bash

# DynamoDBテーブルの削除保護をまとめて無効化するスクリプト

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
TABLES_FILE="${SCRIPT_DIR}/tables.txt"

# テーブルリストファイルの存在確認
if [[ ! -f "${TABLES_FILE}" ]]; then
    echo "エラー: ${TABLES_FILE} が見つかりません"
    exit 1
fi

# テーブルリストを読み込んで処理
while IFS= read -r table_name || [[ -n "${table_name}" ]]; do
    # 空行とコメント行をスキップ
    if [[ -z "${table_name}" || "${table_name}" =~ ^# ]]; then
        continue
    fi

    echo "処理中: ${table_name}"
    
    # 削除保護を無効化
    aws dynamodb update-table \
        --table-name "${table_name}" \
        --no-deletion-protection-enabled \
        --output text > /dev/null
    
    if [[ $? -eq 0 ]]; then
        echo "  ✓ ${table_name} の削除保護を無効化しました"
    else
        echo "  ✗ ${table_name} の削除保護の無効化に失敗しました"
    fi

done < "${TABLES_FILE}"

echo ""
echo "完了！"
