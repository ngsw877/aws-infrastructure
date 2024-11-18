#!/bin/bash

# 設定ファイルから変数の読み込み
source ../security_contact_config.sh

BUCKET_ID=$(dd if=/dev/random bs=8 count=1 2>/dev/null | od -An -tx1 | tr -d ' \t\n')
BUCKET_NAME=lambda-artifacts-${BUCKET_ID}
echo ${BUCKET_NAME} > bucket-name.txt
aws s3 mb s3://${BUCKET_NAME} --profile ${MASTER_ACCOUNT_PROFILE} --region ${REGION}
