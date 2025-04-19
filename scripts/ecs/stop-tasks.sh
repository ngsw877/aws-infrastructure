#!/bin/bash

# --- ヘルプメッセージ ---
usage() {
  echo "Usage: $0 [-S <stack-name> | -c <ecs-cluster-name> -s <ecs-service-name>] [-P <aws-profile>]" >&2
  echo "  -S : CloudFormation スタック名（任意）" >&2
  echo "  -c : ECSクラスター名 (-S が指定されていない場合に必須)" >&2
  echo "  -s : ECSサービス名 (-S が指定されていない場合に必須)" >&2
  echo "  -P : AWSプロファイル (任意)" >&2
  exit 1
}

# --- 引数が1つも与えられなかった場合はusage関数を実行して終了 ---
if [ $# -eq 0 ]; then
  echo "エラー: 引数が指定されていません。" >&2
  usage
fi

# --- 変数初期化 ---
STACK_NAME=""
ECS_CLUSTER_NAME=""
ECS_SERVICE_NAME=""
PROFILE_OPT=""
PROFILE=""

# --- オプション解析 ---
while getopts "S:c:s:P:" opt; do
  case $opt in
    S) STACK_NAME="${OPTARG}" ;;
    c) ECS_CLUSTER_NAME="${OPTARG}" ;;
    s) ECS_SERVICE_NAME="${OPTARG}" ;;
    P) PROFILE="${OPTARG}"; PROFILE_OPT="--profile ${PROFILE}" ;;
    *) usage ;;
  esac
done

# プロファイルが指定されていない場合、環境変数から取得を試みる
if [ -z "$PROFILE" ] && [ -n "$AWS_PROFILE" ]; then
  PROFILE="$AWS_PROFILE"
  echo "環境変数 AWS_PROFILE の値 '$PROFILE' を使用します" >&2
  PROFILE_OPT="--profile ${PROFILE}"
fi

# --- スタック名が指定されている場合、クラスターとサービスを自動検出 ---
if [ -n "$STACK_NAME" ]; then
  echo "CloudFormation スタック '$STACK_NAME' からリソースを検出しています..."
  
  # スクリプトのディレクトリを取得
  SCRIPT_DIR=$(dirname "$0")
  
  # ヘルパースクリプトを呼び出してスタックからクラスターとサービスの情報を取得
  STACK_INFO=$("$SCRIPT_DIR"/_get-ecs-from-stack.sh "$STACK_NAME" "$PROFILE")
  
  # 呼び出し結果をチェック
  if [ $? -ne 0 ]; then
    # エラーメッセージはすでにヘルパースクリプトから出力されている
    exit 1
  fi
  
  # 取得した情報を変数に設定
  eval "$STACK_INFO"
  
  echo "検出されたクラスター: $CLUSTER_NAME"
  echo "検出されたサービス: $SERVICE_NAME"
  
  # 変数名を合わせる
  ECS_CLUSTER_NAME=$CLUSTER_NAME
  ECS_SERVICE_NAME=$SERVICE_NAME
  
elif [ -z "$ECS_CLUSTER_NAME" ] || [ -z "$ECS_SERVICE_NAME" ]; then
  echo "エラー: スタック名が指定されていない場合は、クラスター名 (-c) とサービス名 (-s) が必須です。" >&2
  usage
fi

# --- 必須パラメータチェック ---
if [ -z "$ECS_CLUSTER_NAME" ] || [ -z "$ECS_SERVICE_NAME" ]; then
  echo "エラー: ECSクラスター名とECSサービス名は必須です。" >&2
  usage
fi

# --- Fargate (ECSサービス) の停止 ---
echo "🚀 Fargate (ECSサービス: ${ECS_SERVICE_NAME}) のDesiredCountを0に設定します..."
if ! aws application-autoscaling register-scalable-target \
    ${PROFILE_OPT} \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id "service/${ECS_CLUSTER_NAME}/${ECS_SERVICE_NAME}" \
    --min-capacity 0 \
    --max-capacity 0; then
  echo "❌ Fargate (ECSサービス) の停止に失敗しました。" >&2
  exit 1
fi
echo "✅ Fargate (ECSサービス) のDesiredCountを0に設定しました。"
exit 0 