#!/bin/bash

# 引数の数をチェック
if [ "$#" -eq 0 ]; then
  echo "profileを指定してください"
  read -r PROFILE

  echo "デプロイするCFnテンプレートのパスを指定してください"
  read -r TEMPLATE

  echo "スタック名を指定してください"
  read -r STACK_NAME
else
  # コマンドライン引数から値を割り当て
  PROFILE=$1
  TEMPLATE=$2
  STACK_NAME=$3
fi

# AWS CloudFormationを使用してデプロイ
aws cloudformation \
  --profile "${PROFILE}" \
  deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}"  \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
