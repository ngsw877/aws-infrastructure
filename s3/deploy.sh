#!/bin/bash

PROFILE=$1
TEMPLATE=$2
STACK_NAME=$3
BUCKET_NAME=$4

aws cloudformation deploy \
  --profile "${PROFILE}" \
  --template-file "${TEMPLATE}" \
  --stack-name "${STACK_NAME}"  \
  --parameter-overrides BucketName="${BUCKET_NAME}" \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
