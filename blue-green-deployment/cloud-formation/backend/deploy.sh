#!/bin/bash

set -euo pipefail

# 引数チェック
if [ $# -ne 2 ]; then
    echo "Usage: $0 <profile> <environment>"
    echo "Example: $0 study dev"
    exit 1
fi

PROFILE="$1"
ENV="$2"
STACK_NAME="${ENV}-bg-backend"

# スクリプトのディレクトリを取得
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
TEMPLATE_FILE="${SCRIPT_DIR}/template.yml"
PARAMS_FILE="${SCRIPT_DIR}/params/${ENV}.json"

# パラメータファイルの存在確認
if [ ! -f "$PARAMS_FILE" ]; then
    echo "Error: Parameter file not found: $PARAMS_FILE"
    exit 1
fi

# 変更セットの作成（実行はしない）
echo "Creating change set..."
echo "Stack Name: $STACK_NAME"
echo "Template: $TEMPLATE_FILE"
echo "Parameters: $PARAMS_FILE"

aws cloudformation deploy \
    --stack-name "$STACK_NAME" \
    --template-file "$TEMPLATE_FILE" \
    --parameter-overrides "file://${PARAMS_FILE}" \
    --capabilities CAPABILITY_NAMED_IAM \
    --no-execute-changeset \
    --profile "$PROFILE"