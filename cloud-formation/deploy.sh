#!/bin/bash

usage() {
  echo "Usage: $0 [-t TEMPLATE_FILE] [-s STACK_NAME] [-p PARAMETER_FILE] [-P AWS_PROFILE] [-e]" >&2
  exit 1
}

if [ $# -eq 0 ]; then
  echo "エラー: 引数が指定されていません。" >&2
  usage
fi

# オプション解析
while getopts "t:s:p:eP:" opt; do
  case $opt in
    t)
      TEMPLATE="${OPTARG}"
      ;;
    s)
      STACK_NAME="${OPTARG}"
      ;;
    p)
      PARAMETER_FILE="${OPTARG}"
      ;;
    P)
      AWS_PROFILE="${OPTARG}"
      ;;
    e)
      EXECUTE_CHANGES="true"
      ;;
    *)
      usage
      ;;
  esac
done

# 必須パラメータが未設定の場合はエラー
if [ -z "$TEMPLATE" ]; then
  read -rp "デプロイするCFnテンプレートのパスを指定してください: " TEMPLATE
fi

if [ -z "$STACK_NAME" ]; then
  read -rp "スタック名を指定してください: " STACK_NAME
fi

# AWS_PROFILEが未設定の場合は入力を促す
if [ -z "$AWS_PROFILE" ]; then
  read -rp "AWS_PROFILEを指定してください: " AWS_PROFILE
fi

# オプション処理：-e が指定されていれば、変更セット実行（自動実行）となる
changeset_option="--no-execute-changeset"
if [ "$EXECUTE_CHANGES" = "true" ]; then
  changeset_option=""
fi

# パラメータファイルオプション設定
parameter_override_option=""
if [ -n "$PARAMETER_FILE" ]; then
  parameter_override_option="--parameter-overrides file://$PARAMETER_FILE"
fi

# AWS CloudFormation deploy を実行
aws cloudformation deploy \
  --profile "${AWS_PROFILE}" \
  --template-file "$TEMPLATE" \
  --stack-name "$STACK_NAME" \
  --capabilities CAPABILITY_NAMED_IAM \
  $changeset_option \
  $parameter_override_option