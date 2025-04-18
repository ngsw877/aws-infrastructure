#!/bin/bash

PROFILE="$1"
REPOSITORY_NAME="$2"
REGION="${3:-ap-northeast-1}"

ACCOUNT_ID=$(aws sts get-caller-identity --profile ${PROFILE} --query "Account" --output text)

# ECRにログイン
aws ecr get-login-password \
  --region ${REGION} \
  --profile ${PROFILE} | \
docker login \
  --username AWS \
  --password-stdin ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com

# appイメージのビルドとプッシュ
docker build -t ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:app \
  -f docker/php/Dockerfile . && \
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:app

# webイメージのビルドとプッシュ
docker build -t ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:web \
  docker/nginx \
  --build-arg BACKEND_APP_DOMAIN=127.0.0.1 \
  --build-arg RESOLVER=169.254.169.253 && \
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:web

# logイメージのビルドとプッシュ
docker build -t ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:log \
  docker/fluentbit && \
docker push ${ACCOUNT_ID}.dkr.ecr.${REGION}.amazonaws.com/${REPOSITORY_NAME}:log
