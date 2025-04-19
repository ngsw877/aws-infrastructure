#!/bin/bash

# ヘルプメッセージを表示
usage() {
  echo "使用方法:"
  echo "  $0 [-P <aws-profile>] [-S <stack-name> | -c <cluster-name> -s <service-name>] [-t <container-name>]"
  echo ""
  echo "オプション:"
  echo "  -P : AWS プロファイル名（任意）"
  echo "  -S : CloudFormation スタック名（任意）"
  echo "  -c : ECS クラスター名（-S が指定されていない場合に必須）"
  echo "  -s : ECS サービス名（-S が指定されていない場合に必須）"
  echo "  -t : コンテナ名（デフォルト: app）"
  echo "  -h : このヘルプメッセージを表示"
  echo ""
  echo "例:"
  echo "  $0 -P myprofile -S my-stack"
  echo "  $0 -P myprofile -c my-cluster -s my-service"
  exit 1
}

# パラメータを初期化
PROFILE=""
STACK_NAME=""
CLUSTER_NAME=""
SERVICE_NAME=""
CONTAINER_NAME="app"

# オプション引数を処理
while getopts "P:S:c:s:t:h" opt; do
  case $opt in
    P) PROFILE="$OPTARG" ;;
    S) STACK_NAME="$OPTARG" ;;
    c) CLUSTER_NAME="$OPTARG" ;;
    s) SERVICE_NAME="$OPTARG" ;;
    t) CONTAINER_NAME="$OPTARG" ;;
    h) usage ;;
    *) usage ;;
  esac
done

# スタック名が指定されている場合、クラスターとサービスを自動検出
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
  
elif [ -z "$CLUSTER_NAME" ] || [ -z "$SERVICE_NAME" ]; then
  echo "エラー: スタック名が指定されていない場合は、クラスター名 (-c) とサービス名 (-s) が必須です"
  usage
fi

# プロファイルオプションを準備
PROFILE_OPT=""
if [ -n "$PROFILE" ]; then
  PROFILE_OPT="--profile $PROFILE"
fi

# タスクIDを取得
TASK_ID=$(aws ecs list-tasks \
  --cluster "$CLUSTER_NAME" \
  --service-name "$SERVICE_NAME" \
  $PROFILE_OPT \
  --query 'taskArns[0]' \
  --output text)

if [ -z "$TASK_ID" ] || [ "$TASK_ID" == "None" ]; then
  echo "エラー: クラスター '$CLUSTER_NAME' のサービス '$SERVICE_NAME' で実行中のタスクが見つかりませんでした"
  exit 1
fi

echo "実行中のタスク: $TASK_ID"
echo "コンテナ '$CONTAINER_NAME' に接続しています..."

# タスクにexecコマンドを実行
aws ecs execute-command \
  --region ap-northeast-1 \
  --cluster "$CLUSTER_NAME" \
  --task "$TASK_ID" \
  --container "$CONTAINER_NAME" \
  --interactive \
  --command "/bin/bash" \
  $PROFILE_OPT