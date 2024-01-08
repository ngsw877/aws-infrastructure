#!/bin/bash

PROFILE="$1"

STACK_NAME="common-ecr"
TEMPLATE="ECR.yml"

aws cloudformation \
  --profile ${PROFILE} \
  deploy \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME}  \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
