#!/bin/bash

# 引数チェック
if [ $# -lt 1 ]; then
  echo "使用方法: $0 <stack-name> [aws-profile]"
  echo "説明: 指定したCloudFormationスタックからECSクラスターとサービス情報を取得するヘルパースクリプト"
  exit 1
fi

STACK_NAME="$1"
PROFILE="$2"

# プロファイルオプションを準備
PROFILE_OPT=""
if [ -n "$PROFILE" ]; then
  PROFILE_OPT="--profile $PROFILE"
fi

# スタックからクラスター名を取得（複数ある場合は明示的に最初のものを取得）
CLUSTER_NAMES=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  $PROFILE_OPT \
  --query "StackResources[?ResourceType=='AWS::ECS::Cluster'].PhysicalResourceId" \
  --output text)

# 改行で分割してクラスター名の配列を作成
IFS=$'\n' read -r -a CLUSTER_ARRAY <<< "$CLUSTER_NAMES"

# クラスターが見つからない場合はエラー
if [ ${#CLUSTER_ARRAY[@]} -eq 0 ] || [ -z "${CLUSTER_ARRAY[0]}" ]; then
  echo "エラー: スタック '$STACK_NAME' から ECS クラスターを検出できませんでした" >&2
  exit 1
fi

# 複数のクラスターがある場合は警告を表示
if [ ${#CLUSTER_ARRAY[@]} -gt 1 ]; then
  echo "警告: スタック '$STACK_NAME' に複数のECSクラスターが見つかりました。最初のクラスターを使用します:" >&2
  for (( i=0; i<${#CLUSTER_ARRAY[@]}; i++ )); do
    if [ $i -eq 0 ]; then
      echo " * ${CLUSTER_ARRAY[$i]} (使用するクラスター)" >&2
    else
      echo " * ${CLUSTER_ARRAY[$i]}" >&2
    fi
  done
fi

# 最初のクラスターを使用
CLUSTER_NAME="${CLUSTER_ARRAY[0]}"

# スタックからサービス名を取得（サービスの物理IDからサービス名を抽出）
SERVICE_RESOURCES=$(aws cloudformation describe-stack-resources \
  --stack-name "$STACK_NAME" \
  $PROFILE_OPT \
  --query "StackResources[?ResourceType=='AWS::ECS::Service'].PhysicalResourceId" \
  --output text)

# 改行で分割してサービス名の配列を作成
IFS=$'\n' read -r -a SERVICE_ARRAY <<< "$SERVICE_RESOURCES"

# サービスが見つからない場合はエラー
if [ ${#SERVICE_ARRAY[@]} -eq 0 ] || [ -z "${SERVICE_ARRAY[0]}" ]; then
  echo "エラー: スタック '$STACK_NAME' から ECS サービスを検出できませんでした" >&2
  exit 1
fi

# サービス名を抽出（形式: arn:aws:ecs:REGION:ACCOUNT:service/CLUSTER/SERVICE_NAME）
SERVICE_NAME=$(echo "${SERVICE_ARRAY[0]}" | awk -F'/' '{print $NF}')

# 複数のサービスがある場合は警告を表示
if [ ${#SERVICE_ARRAY[@]} -gt 1 ]; then
  FIRST_SERVICE=$SERVICE_NAME
  echo "警告: スタック '$STACK_NAME' に複数のECSサービスが見つかりました。最初のサービスを使用します:" >&2
  for (( i=0; i<${#SERVICE_ARRAY[@]}; i++ )); do
    SERVICE=$(echo "${SERVICE_ARRAY[$i]}" | awk -F'/' '{print $NF}')
    if [ $i -eq 0 ]; then
      echo " * $SERVICE (使用するサービス)" >&2
    else
      echo " * $SERVICE" >&2
    fi
  done
fi

# 取得した情報を出力
echo "CLUSTER_NAME=$CLUSTER_NAME"
echo "SERVICE_NAME=$SERVICE_NAME" 