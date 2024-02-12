#!/bin/bash

PROFILE="$1"
BASE_STACK_NAME="common-acm"
TEMPLATE="acm.yml"
PARAMETERS_FILE="acm.json"

# 引数がある場合、STACK_NAMEに代入する
if [[ "$2" != "" ]]; then
  BASE_STACK_NAME="$2"
fi

echo "バージニア北部リージョンを利用しますか？ (y/n)"
read -r USE_VIRGINIA_REGION
if [[ "$USE_VIRGINIA_REGION" = "y" ]]; then
  REGION="us-east-1"
  STACK_NAME="${BASE_STACK_NAME}-for-cloudfront"
else
  REGION="ap-northeast-1"
  STACK_NAME="${BASE_STACK_NAME}-for-alb"
fi

aws cloudformation deploy \
  --profile "${PROFILE}" \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides "file://${PARAMETERS_FILE}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
