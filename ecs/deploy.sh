#!/bin/bash

PROFILE="$1"

if [[ "$2" = "fargate" ]]; then
  STACK_NAME="sample-fargate"
  TEMPLATE="fargate.yml"
  PARAMETERS_FILE="fargate.json"

elif [[ "$2" = "spot-instance" ]]; then
  STACK_NAME="sample-spot-instance"
  TEMPLATE="spot-instance.yml"
  PARAMETERS_FILE="spot-instance.json"

else
  echo "ERROR: 第2引数が不正です。"
  exit 1
fi

# 引数がある場合、STACK_NAMEに代入する
if [[ "$3" != "" ]]; then
  STACK_NAME="$3"
fi

aws cloudformation \
  deploy \
  --profile "${PROFILE}" \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME}  \
  --parameter-overrides "file://${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
