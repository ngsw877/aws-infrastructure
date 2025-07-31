#!/bin/bash

# 引数のチェック
if [ $# -lt 1 ]; then
    echo "使用方法:"
    echo "source $0 [環境名] [AWSプロファイル]"
    echo "例:"
    echo "source $0 dev  ---> ecs-params/{環境名}.env に定義されたkey=valueの値を環境変数にexportしてセット"
    echo " ※ sourceコマンド経由で当スクリプトを実行してください"
    return 1
fi

# 引数の設定
ENV="$1"

# AWS_PROFILEもしくはAWS_ACCESS_KEY_IDがセットされているかをチェック
if [ -z "$AWS_PROFILE" ] && [ -z "$AWS_ACCESS_KEY_ID" ]; then
    if [ $# -lt 2 ]; then
        echo "エラー: AWSプロファイルまたはAWSアクセスキーIDが指定されていません"
        return 1
    else
        # 上記環境変数がセットされていない場合は第二引数でprofileの指定が必要
        export AWS_PROFILE="$2"
    fi
fi

echo "環境変数のセットを開始します。"

# 変数の宣言（envファイルからではなく、aws cliで取得する必要がある環境変数）
declare WEB_IMAGE_TAG
declare APP_IMAGE_TAG
declare LOG_IMAGE_TAG
# CloudFormationスタックのOutputsから取得するキー
OUTPUT_KEYS=(
        "PrivateSubnet1"
        "PrivateSubnet2"
        "PrivateSubnet3"
        "TargetGroupArn"
        "BackendSecurityGroup"
        "ExecutionRoleArn"
        "TaskRoleArn"
        "EcrRepositoryUri"
        "KinesisAppDeliveryStream"
        "KinesisWebDeliveryStream"
    )

# 関数: envファイルで定義した値を環境変数にセット
set_env_vars() {
    local env_file="../ecs-params/${ENV}.env"
    if [ ! -f "$env_file" ]; then
        echo "エラー: ${env_file} が見つかりません"
        return 1
    fi

    while IFS='=' read -r key value; do
        if [[ ! -z "$key" && ! "$key" =~ ^#.* ]]; then
            export "$key=$value"
            echo "$key=$value"
        fi
    done < "$env_file"
}

# 関数: タスク定義のFAMILYを取得
get_task_definition_family() {
    local task_definition_family
    task_definition_family=$(ecspresso status | grep TaskDefinition | awk '{print $2}' | cut -d':' -f1)
    if [ -z "$task_definition_family" ]; then
        echo "エラー: タスク定義のFAMILYが取得できませんでした" >&2
        return 1
    fi
    echo "$task_definition_family" # 戻り値
}

# 関数: コンテナイメージのURIを取得
get_container_images() {
    local task_definition_family="$1"
    local container_images
    container_images=$(aws ecs describe-task-definition --task-definition "${task_definition_family}" --query "taskDefinition.containerDefinitions[*].image" --output json | jq -r '.[]')
    if [ -z "$container_images" ]; then
        echo "エラー: コンテナイメージのURIが取得できませんでした" >&2
        return 1
    fi
    echo "$container_images" # 戻り値
}

# 関数: コンテナイメージのタグをセット
set_image_tags() {
    local container_images="$1"
    echo "$container_images" | while IFS= read -r IMAGE; do
        local tag=${IMAGE##*:}
        if [[ $tag == *"web"* ]]; then
            export WEB_IMAGE_TAG=$tag
            echo "WEB_IMAGE_TAG = $WEB_IMAGE_TAG"
        elif [[ $tag == *"app"* ]]; then
            export APP_IMAGE_TAG=$tag
            echo "APP_IMAGE_TAG = $APP_IMAGE_TAG"
        elif [[ $tag == *"log"* ]]; then
            export LOG_IMAGE_TAG=$tag
            echo "LOG_IMAGE_TAG = $LOG_IMAGE_TAG"
        fi
    done
}

# 関数: CloudFormationのOutputsから環境変数を設定
set_cfn_outputs() {
    for output_key in "${OUTPUT_KEYS[@]}"; do
        local output_value=$(aws cloudformation describe-stacks --stack-name ${STACK_NAME} --output text --query "Stacks[].Outputs[?OutputKey=='${output_key}'].OutputValue")
        if [ -z "output_value" ]; then
            echo "エラー: ${output_key} の値が取得できませんでした" >&2
            return 1
        fi
        export "${output_key}=${output_value}"
        echo "${output_key}=${output_value}"
    done
}

# 関数: 環境変数をJSONファイルに書き出す
export_env_to_json() {
    # OSにセットされた環境変数をjsonファイルとして書き出す（Git管理外）
    # NOTE: ./ecs-service-def.jsonnet内で発生する、desiredCountの型エラー回避の際にjsonファイルから環境変数を読み込ませる必要があるため
    local output_dir="../outputs"
    mkdir -p "${output_dir}"
    jq -n env > "${output_dir}/env.json"
}

### メイン処理 ###
set_env_vars || return 1

task_definition_family=$(get_task_definition_family) || return 1
echo "task_definition_family = ${task_definition_family}"

container_images=$(get_container_images "$task_definition_family") || return 1

set_image_tags "$container_images" || return 1

set_cfn_outputs || return 1

export_env_to_json || return 1

echo "環境変数のセットが完了しました"
