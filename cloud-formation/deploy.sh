#!/bin/bash

usage() {
  echo "Usage: $0 [-p AWS_PROFILE] -t TEMPLATE_FILE -s STACK_NAME [-e]" >&2
  exit 1
}

# 初期値設定
EXECUTE_CHANGES="false"

# オプション解析
while getopts "p:t:s:e" opt; do
  case $opt in
    p)
      AWS_PROFILE="${OPTARG}"
      ;;
    t)
      TEMPLATE="${OPTARG}"
      ;;
    s)
      STACK_NAME="${OPTARG}"
      ;;
    e)
      EXECUTE_CHANGES="true"
      ;;
    *)
      usage
      ;;
  esac
done

# 必須パラメータが未設定の場合は入力を促す

if [ -z "$TEMPLATE" ]; then
  read -rp "デプロイするCFnテンプレートのパスを指定してください: " TEMPLATE
fi

if [ -z "$STACK_NAME" ]; then
  read -rp "スタック名を指定してください: " STACK_NAME
fi

if [ -z "$AWS_PROFILE" ]; then
  # 環境変数にも設定が無ければ入力を促す
  read -rp "AWS_PROFILEを指定してください: " AWS_PROFILE
fi

# オプション処理：-e が指定されていれば、変更セット実行（自動実行）となる
changeset_option="--no-execute-changeset"
if [ "$EXECUTE_CHANGES" = "true" ]; then
  changeset_option=""
fi

# AWS CloudFormation deploy を実行
aws cloudformation deploy \
  --profile "$AWS_PROFILE" \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  $changeset_option