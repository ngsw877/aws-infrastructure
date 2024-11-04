#!/bin/bash

# 引数の数をチェック
if [ "$#" -lt 3 ]; then
  echo "profileを指定してください"
  read -r PROFILE

  echo "デプロイするCFnテンプレートのパスを指定してください"
  read -r TEMPLATE

  echo "スタック名を指定してください"
  read -r STACK_NAME
else
  # コマンドライン引数から値を割り当て
  PROFILE="$1"
  TEMPLATE="$2"
  STACK_NAME="$3"
fi

# デフォルトで --no-execute-changeset オプションを設定
changeset_option="--no-execute-changeset"

# 引数に -e(execute) が指定されている場合、オプションを外す
if [[ "$4" == "-e" ]]; then
  changeset_option=""
fi

# AWS CloudFormationを使用してデプロイ
aws cloudformation \
  --profile "${PROFILE}" \
  deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}"  \
  --capabilities CAPABILITY_NAMED_IAM \
  $changeset_option