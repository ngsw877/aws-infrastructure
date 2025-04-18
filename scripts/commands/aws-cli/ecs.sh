#!/bin/zsh

# FARGATEタスクを起動する
cluster_name=
task_def_family=
subnet_id=
security_group_id=

aws ecs run-task \                                                                                      
  --cluster ${cluster_name} \          
  --launch-type FARGATE \             
  --task-definition ${task_def_family} \
  --network-configuration "awsvpcConfiguration={subnets=[${subnet_id}],securityGroups=[${security_group_id}],assignPublicIp=DISABLED}"

## FARGATEタスクのアプリコンテナで任意のコマンドを実行し、タスクARNを取得する
## NOTE: appコンテナのコンテナ定義にて、essential:trueに設定すると、appコンテナが終了したらタスクが全体が終了する

task_arn=$(aws ecs run-task \                                                                                      
  --cluster ${cluster_name} \          
  --launch-type FARGATE \             
  --task-definition ${task_def_family} \
  --network-configuration "awsvpcConfiguration={subnets=[${subnet_id}],securityGroups=[${security_group_id}],assignPublicIp=DISABLED}" \
  --overrides '{
    "containerOverrides": [
      {
        "name": "app",
        "command": ["sh", "-c", "echo \"start 🚀\"; sleep 30; echo \"finish ✅\""]
      }
    ]
  }' \
  --query 'tasks[0].taskArn' \
  --output text)

echo ${task_arn}

# タスクの詳細を取得する
cluster_name=
task_arn=

aws ecs describe-tasks \
  --cluster ${cluster_name} \
  --tasks ${task_arn}

## アプリコンテナの終了コードを取得する
app_exit_code=$(aws ecs describe-tasks \
  --cluster ${cluster_name} \
  --tasks ${task_arn} \
  --query 'tasks[0].containers[?name==`app`].exitCode' \
  --output text)

# タスクが終了するまで待機する
cluster_name=
task_arn=

aws ecs wait tasks-stopped \
  --cluster ${cluster_name} \
  --tasks ${task_arn}

# タスク定義情報を取得
task_def_family=

task_def=$(aws ecs describe-task-definition \
  --task-definition $task_def_family \
  --query 'taskDefinition' \
  --output json)

echo "${task_def}" | pbcopy

## 取得したタスク定義情報をもとに、パラメータの上書きと整形を行い新しいタスク定義用jsonを作成する
## 参考: https://qiita.com/moko_Swallows/items/f49052832e8db24286b8
image=
task_def_file_name="taskdef.json"

new_task_def=$(
  echo "${task_def}" |
  jq --arg IMAGE "${image}" \
  'del(
      .taskDefinitionArn,
      .revision,
      .status,
      .requiresAttributes,
      .compatibilities,
      .registeredAt,
      .registeredBy
    ) |
    .containerDefinitions[0].image = $IMAGE
  ')

echo "${new_task_def}" > ${task_def_file_name}

## 新しいタスク定義を作成する
new_task_def_family="new-task-def"

aws ecs register-task-definition \
  --family "${new_task_def_family}" \
  --cli-input-json file://${task_def_file_name}