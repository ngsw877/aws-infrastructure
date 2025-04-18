#!/bin/bash

# --- ヘルプメッセージ ---
usage() {
  echo "Usage: $0 -c <ecs-cluster-name> -s <ecs-service-name> [-m <min-capacity>] [-M <max-capacity>] [-P <aws-profile>]" >&2
  echo "  -c : ECSクラスター名" >&2
  echo "  -s : ECSサービス名" >&2
  echo "  -m : 最小キャパシティ (デフォルト: 1)" >&2
  echo "  -M : 最大キャパシティ (デフォルト: 2)" >&2
  echo "  -P : AWSプロファイル (任意)" >&2
  exit 1
}

# --- 引数が1つも与えられなかった場合はusage関数を実行して終了 ---
if [ $# -eq 0 ]; then
  echo "エラー: 引数が指定されていません。" >&2
  usage
fi

# --- 変数初期化 ---
ECS_CLUSTER_NAME=""
ECS_SERVICE_NAME=""
MIN_CAPACITY="1"
MAX_CAPACITY="2"
PROFILE_OPT=""

# --- オプション解析 ---
while getopts "c:s:m:M:P:" opt; do
  case $opt in
    c) ECS_CLUSTER_NAME="${OPTARG}" ;;
    s) ECS_SERVICE_NAME="${OPTARG}" ;;
    m) MIN_CAPACITY="${OPTARG}" ;;
    M) MAX_CAPACITY="${OPTARG}" ;;
    P) AWS_PROFILE="${OPTARG}"; PROFILE_OPT="--profile ${AWS_PROFILE}" ;;
    *) usage ;;
  esac
done

# --- 必須パラメータチェック ---
if [ -z "$ECS_CLUSTER_NAME" ] || [ -z "$ECS_SERVICE_NAME" ]; then
  echo "エラー: ECSクラスター名とECSサービス名は必須です。" >&2
  usage
fi

# --- Fargate (ECSサービス) の起動 ---
echo "🚀 Fargate (ECSサービス: ${ECS_SERVICE_NAME}) のDesiredCountを${MIN_CAPACITY}～${MAX_CAPACITY}に設定します..."
if ! aws application-autoscaling register-scalable-target \
    ${PROFILE_OPT} \
    --service-namespace ecs \
    --scalable-dimension ecs:service:DesiredCount \
    --resource-id "service/${ECS_CLUSTER_NAME}/${ECS_SERVICE_NAME}" \
    --min-capacity ${MIN_CAPACITY} \
    --max-capacity ${MAX_CAPACITY}; then
  echo "❌ Fargate (ECSサービス) の起動に失敗しました。" >&2
  exit 1
fi
echo "✅ Fargate (ECSサービス) のDesiredCountを設定しました。サービスが起動中です。"
exit 0 