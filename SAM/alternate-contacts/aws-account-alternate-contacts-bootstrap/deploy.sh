#!/bin/bash
set -eo pipefail

# 設定ファイルから変数の読み込み
source ../security_contact_config.sh

ARTIFACT_BUCKET=$(cat bucket-name.txt)
TEMPLATE=aws-account-contact-bootstrap-template.yaml

sam build -t ${TEMPLATE}
cd .aws-sam/build

sam package --debug \
    --profile ${MASTER_ACCOUNT_PROFILE} \
    --region ${REGION} \
    --s3-bucket ${ARTIFACT_BUCKET} \
    --output-template-file aws-account-contact-bootstrap-template-cf.yml

sam deploy --debug \
    --profile ${MASTER_ACCOUNT_PROFILE} \
    --region ${REGION} \
    --template-file aws-account-contact-bootstrap-template-cf.yml \
    --stack-name aws-account-contact-bootstrap \
    --capabilities CAPABILITY_NAMED_IAM \
    --parameter-overrides "SecurityContactName=\"${SECURITY_CONTACT_NAME}\" SecurityContactTitle=\"${SECURITY_CONTACT_TITLE}\" SecurityContactEmail=${SECURITY_CONTACT_EMAIL} SecurityContactPhone=${SECURITY_CONTACT_PHONE}"
