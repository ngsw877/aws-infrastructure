#!/bin/bash

# Bucket name
BUCKET_NAME="remote-backend-ngsw877"
REGION="ap-northeast-1"

echo "=========================================="
echo "WARNING: This will permanently delete"
echo "Bucket: ${BUCKET_NAME}"
echo "=========================================="
read -p "Are you sure? (yes/no): " confirmation

if [ "$confirmation" != "yes" ]; then
    echo "Deletion cancelled."
    exit 0
fi

echo ""
echo "Starting bucket deletion process..."

# Delete all object versions
echo "Deleting all object versions..."
versions=$(aws s3api list-object-versions \
    --bucket ${BUCKET_NAME} \
    --query 'Versions[].{Key:Key,VersionId:VersionId}' \
    --output json)

if [ "$versions" != "null" ] && [ "$versions" != "[]" ]; then
    echo "$versions" | jq -c '.[]' | while read -r obj; do
        key=$(echo "$obj" | jq -r '.Key')
        versionId=$(echo "$obj" | jq -r '.VersionId')
        echo "Deleting: $key (version: $versionId)"
        aws s3api delete-object \
            --bucket ${BUCKET_NAME} \
            --key "$key" \
            --version-id "$versionId" > /dev/null
    done
    echo "✓ All object versions deleted"
else
    echo "No object versions found"
fi

# Delete all delete markers
echo "Deleting all delete markers..."
markers=$(aws s3api list-object-versions \
    --bucket ${BUCKET_NAME} \
    --query 'DeleteMarkers[].{Key:Key,VersionId:VersionId}' \
    --output json)

if [ "$markers" != "null" ] && [ "$markers" != "[]" ]; then
    echo "$markers" | jq -c '.[]' | while read -r obj; do
        key=$(echo "$obj" | jq -r '.Key')
        versionId=$(echo "$obj" | jq -r '.VersionId')
        echo "Deleting marker: $key (version: $versionId)"
        aws s3api delete-object \
            --bucket ${BUCKET_NAME} \
            --key "$key" \
            --version-id "$versionId" > /dev/null
    done
    echo "✓ All delete markers deleted"
else
    echo "No delete markers found"
fi

# Delete the bucket
echo "Deleting bucket: ${BUCKET_NAME}..."
aws s3api delete-bucket \
    --bucket ${BUCKET_NAME} \
    --region ${REGION}

if [ $? -eq 0 ]; then
    echo "✓ Bucket deleted successfully"
    echo ""
    echo "=========================================="
    echo "Bucket deletion completed!"
    echo "Bucket name: ${BUCKET_NAME}"
    echo "=========================================="
else
    echo "✗ Failed to delete bucket"
    exit 1
fi