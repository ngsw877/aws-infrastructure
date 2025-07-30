#!/bin/bash

PROFILE="$1"

elif [[ "$2" = "vpc" ]]; then
  STACK_NAME="common-vpc"
  TEMPLATE="vpc.yml"

elif [[ "$2" = "oidc" ]]; then
  STACK_NAME="github-actions-oidc-provider"
  TEMPLATE="github-actions-oidc-provider.yml"

else
  echo "引数にvpc, oidc のいずれかを指定してください"
  exit 1
fi

# 引数がある場合、STACK_NAMEに代入する
if [[ "$3" != "" ]]; then
  STACK_NAME="$3"
fi

aws cloudformation \
  --profile "${PROFILE}" \
  deploy \
  --template-file ${TEMPLATE} \
  --stack-name ${STACK_NAME}  \
  --capabilities CAPABILITY_NAMED_IAM \
  --no-execute-changeset
