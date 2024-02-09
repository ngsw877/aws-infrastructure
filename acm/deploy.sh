#!/bin/bash

PROFILE="$1"
STACK_NAME="$2"
TEMPLATE="acm.yml"
PARAMETERS_FILE="acm.json"

aws cloudformation \
  deploy \
  --profile "${PROFILE}" \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME} \
  --parameter-overrides "file://${PARAMETERS_FILE}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
