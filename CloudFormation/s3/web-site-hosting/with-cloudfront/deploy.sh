#!/bin/bash

PROFILE=$1
TEMPLATE_FILE=$2
STACK_NAME=$3

# TEMPLATE_FILEの値から".yml"を".json"に置換してPARAMETERS_FILE変数を作成
PARAMETERS_FILE="${TEMPLATE_FILE/.yml/.json}"

aws cloudformation deploy \
  --profile "${PROFILE}" \
  --template-file "${TEMPLATE_FILE}" \
  --stack-name "${STACK_NAME}"  \
  --parameter-overrides "file://parameters/${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
