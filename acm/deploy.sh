#!/bin/bash

PROFILE="$1"
STACK_NAME="$2"
TEMPLATE="acm.yml"
PARAMETERS_FILE="acm.json"

echo "バージニアリージョンを利用しますか？ (y/n)"
read -r USE_VIRGINIA
if [[ "$USE_VIRGINIA" = "y" ]]; then
  REGION="us-east-1"
else
  REGION="ap-northeast-1"
fi

aws cloudformation deploy \
  --profile "${PROFILE}" \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}" \
  --parameter-overrides "file://${PARAMETERS_FILE}" \
  --region "${REGION}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
