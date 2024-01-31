#!/bin/bash

PROFILE="$1"
KEY="$2"
VALUE="$3"

aws ssm \
  get-parameter \
  --profile "${PROFILE}" \
  --name "/${KEY}" \
  1>/dev/null 2>&1

# 254 = ParameterNotFound
if [ $? -eq 254 ]; then
  aws ssm \
    put-parameter \
    --profile "${PROFILE}" \
    --name "/${KEY}" \
    --value "${VALUE}" \
    --type SecureString
else
  echo "パラメータが既に存在します。"
  read -p "既存のパラメータを上書きしますか？(y/n): " overwrite
  if [[ $overwrite == "y" ]]; then
    aws ssm put-parameter \
      --profile "${PROFILE}" \
      --name "/${KEY}" \
      --value "${VALUE}" \
      --type SecureString \
      --overwrite
  else
    echo "パラメータの上書きはキャンセルされました。"
  fi
fi
