#!/bin/bash

PROFILE="$1"

if [[ "$2" = "fargate" ]]; then
  BASE_STACK_NAME="fargate"
  TEMPLATE="fargate.yml"
  PARAMETERS_FILE="fargate.json"

elif [[ "$2" = "spot" ]]; then
  BASE_STACK_NAME="spot-instance"
  TEMPLATE="spot-instance.yml"

  # GPUインスタンスの使用を尋ねる
  echo "Use GPU instance? (y/n)"
  read -r USE_GPU
  if [[ "$USE_GPU" = "y" ]]; then
    PARAMETERS_FILE="spot-instance-for-gpu.json"
  else
    PARAMETERS_FILE="spot-instance.json"
  fi

else
  echo "ERROR: 第2引数が不正です。"
  exit 1
fi

# 環境を選択してください (dev/stg/prod): 
echo "環境を選択してください (dev/stg/prod): "
read -r ENV_NAME

# 環境のバリデーション
if [[ "$ENV_NAME" != "dev" && "$ENV_NAME" != "stg" && "$ENV_NAME" != "prod" ]]; then
  echo "ERROR: 不正な環境名です。dev、stg、またはprodを選択してください。"
  exit 1
fi

STACK_NAME="${ENV_NAME}-${BASE_STACK_NAME}"

aws cloudformation \
  deploy \
  --profile "${PROFILE}" \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME} \
  --parameter-overrides "file://parameters/${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
