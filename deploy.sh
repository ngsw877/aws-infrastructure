#!/bin/bash

echo "profileを指定してください"
read -r PROFILE

echo "デプロイするCFnテンプレートのパスを指定してください"
read -r TEMPLATE

echo "スタック名を指定してください"
read -r STACK_NAME

aws cloudformation \
  --profile "${PROFILE}" \
  deploy \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}"  \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
