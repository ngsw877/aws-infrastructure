#!/bin/bash

PROFILE="$1"

if [[ "$2" = "vpc" ]]; then
  STACK_NAME="common-vpc"
  TEMPLATE="vpc.yml"

elif [[ "$2" = "ecr" ]]; then
  STACK_NAME="common-ecr"
  TEMPLATE="ecr.yml"

elif [[ "$2" = "sg" ]]; then
  STACK_NAME="common-sg"
  TEMPLATE="security-group.yml"

else
  echo "引数に vpc, ecr, sg のいずれかを指定してください"
  exit 1
fi

aws cloudformation \
  --profile "${PROFILE}" \
  deploy \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME}  \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
