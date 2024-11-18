#!/bin/bash
set -eo pipefail

# 設定ファイルから変数の読み込み
source ../security_contact_config.sh

STACK=aws-account-contact-bootstrap

FUNCTION=$(aws cloudformation describe-stack-resource \
    --stack-name ${STACK} \
    --logical-resource-id OrgCreateAccountContactBootstrapFunction \
    --query 'StackResourceDetail.PhysicalResourceId' \
    --output text \
    --region ${REGION} \
    --profile ${MASTER_ACCOUNT_PROFILE})

aws cloudformation delete-stack \
    --stack-name ${STACK} \
    --region ${REGION} \
    --profile ${MASTER_ACCOUNT_PROFILE}
echo "Deleted ${STACK} stack."

if [ -f bucket-name.txt ]; then
    ARTIFACT_BUCKET=$(cat bucket-name.txt)
    if [[ ! ${ARTIFACT_BUCKET} =~ lambda-artifacts-[a-z0-9]{16} ]] ; then
        echo "Bucket was not created by this application. Skipping."
    else
        while true; do
            read -p "Delete deployment artifacts and bucket (${ARTIFACT_BUCKET})? (y/n)" response
            case ${response} in
                [Yy]* ) aws s3 rb --force s3://${ARTIFACT_BUCKET} --region ${REGION} --profile ${MASTER_ACCOUNT_PROFILE}; rm bucket-name.txt; break;;
                [Nn]* ) break;;
                * ) echo "Response must start with y or n.";;
            esac
        done
    fi
fi

while true; do
    read -p "Delete function log group (/aws/lambda/${FUNCTION})? (y/n)" response
    case ${response} in
        [Yy]* ) aws logs delete-log-group --log-group-name /aws/lambda/${FUNCTION} --region ${REGION} --profile ${MASTER_ACCOUNT_PROFILE}; break;;
        [Nn]* ) break;;
        * ) echo "Response must start with y or n.";;
    esac
done
