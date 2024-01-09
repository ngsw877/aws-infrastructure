#!/bin/bash

PROFILE="$1"

if [[ "$2" = "vpc" ]]; then
  STACK_NAME="common-vpc"
  TEMPLATE="VPC.yml"

elif [[ "$2" = "ecr" ]]; then
  STACK_NAME="common-ecr"
  TEMPLATE="ECR.yml"

elif [[ "$2" = "sg" ]]; then
  STACK_NAME="common-sg"
  TEMPLATE="SecurityGroup.yml"

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
