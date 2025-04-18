#!/bin/bash

PROFILE="$1"
CLUSTER_NAME="$2"
SERVICE_NAME="$3"
CONTAINER_NAME="${4:-app}"

aws ecs execute-command \
  --region ap-northeast-1 \
  --cluster ${CLUSTER_NAME} \
  --task $(aws ecs list-tasks --cluster ${CLUSTER_NAME} --service ${SERVICE_NAME} --profile ${PROFILE} | jq '.taskArns[0]' -r) \
  --container ${CONTAINER_NAME} \
  --interactive \
  --command "/bin/bash" \
  --profile ${PROFILE}