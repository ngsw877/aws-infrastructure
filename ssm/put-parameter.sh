#!/bin/bash

PROFILE="$1"
KEY="$2"
VALUE="$3"

aws ssm \
  put-parameter \
  --profile "${PROFILE}" \
  --name "/${KEY}" \
  --value "${VALUE}" \
  --type SecureString
