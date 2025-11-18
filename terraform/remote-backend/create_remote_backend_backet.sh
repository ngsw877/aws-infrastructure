#!/bin/bash

# Bucket name
BUCKET_NAME="remote-backend-ngsw877"
REGION="ap-northeast-1"

echo "Creating S3 bucket: ${BUCKET_NAME} in ${REGION}..."

# Create S3 bucket
aws s3api create-bucket \
    --bucket ${BUCKET_NAME} \
    --region ${REGION} \
    --create-bucket-configuration LocationConstraint=${REGION}

if [ $? -eq 0 ]; then
    echo "✓ Bucket created successfully"
else
    echo "✗ Failed to create bucket"
    exit 1
fi

echo "Enabling versioning on bucket: ${BUCKET_NAME}..."

# Enable versioning
aws s3api put-bucket-versioning \
    --bucket ${BUCKET_NAME} \
    --versioning-configuration Status=Enabled

if [ $? -eq 0 ]; then
    echo "✓ Versioning enabled successfully"
else
    echo "✗ Failed to enable versioning"
    exit 1
fi

echo ""
echo "=========================================="
echo "Bucket setup completed!"
echo "Bucket name: ${BUCKET_NAME}"
echo "Region: ${REGION}"
echo "Versioning: Enabled"
echo "=========================================="