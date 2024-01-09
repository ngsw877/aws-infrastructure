#!/bin/bash

PROFILE="$1"

if [[ "$2" = "fargate" ]]; then
  STACK_NAME="sample-fargate"
  TEMPLATE="fargate.yml"
  PARAMETERS_FILE="fargate.json"
fi

aws cloudformation \
  deploy \
  --profile "${PROFILE}" \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME}  \
  --parameter-overrides "file://${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
