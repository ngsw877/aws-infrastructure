#!/bin/bash

PROFILE="$1"
STACK_NAME="$2"

# 特定のタグに一致するバケットのリストを取得
buckets=$(aws resourcegroupstaggingapi --profile "${PROFILE}" get-resources --resource-type-filters s3:bucket --tag-filters Key=aws:cloudformation:stack-name,Values=${STACK_NAME} | jq -r '.ResourceTagMappingList[].ResourceARN' | sed 's/arn:aws:s3::://')

# バケットをループして削除
for bucket in $buckets; do
    echo "============ Checking bucket versioning: ${bucket} ============"
    versioning_status=$(aws s3api get-bucket-versioning --bucket "${bucket}" --profile "${PROFILE}" | jq -r '.Status')

    if [ "$versioning_status" == "Enabled" ]; then
        echo "Disabling versioning for bucket: ${bucket}"
        aws s3api put-bucket-versioning --bucket "${bucket}" --versioning-configuration Status=Suspended --profile "${PROFILE}"
    fi

    echo "============ Deleting all objects from bucket: ${bucket} ============"
    aws s3 rm "s3://${bucket}" --recursive --profile "${PROFILE}"

    echo "============ Deleting all versions and markers from bucket: ${bucket} ============"
    versions=$(aws s3api list-object-versions --bucket "${bucket}" --profile "${PROFILE}")

    echo "$versions" | jq -r '.Versions[]? | .Key + " " + .VersionId' | while read key version; do
        aws s3api delete-object --bucket "${bucket}" --key "$key" --version-id "$version" --profile "${PROFILE}"
    done

    echo "$versions" | jq -r '.DeleteMarkers[]? | .Key + " " + .VersionId' | while read key version; do
        aws s3api delete-object --bucket "${bucket}" --key "$key" --version-id "$version" --profile "${PROFILE}"
    done

    echo "============ Deleting bucket: ${bucket} ============"
    aws s3 rb "s3://${bucket}" --force --profile "${PROFILE}"
done
