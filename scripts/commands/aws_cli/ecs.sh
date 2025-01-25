#!/bin/zsh

cluster_name=
task_definition=
task_arn=
subnet_id=
security_group_id=

# FARGATEタスクを起動する
aws ecs run-task \                                                                                      
  --cluster ${cluster_name} \          
  --launch-type FARGATE \             
  --task-definition ${task_definition} \
  --network-configuration "awsvpcConfiguration={subnets=[${subnet_id}],securityGroups=[${security_group_id}],assignPublicIp=DISABLED}"

## FARGATEタスクのアプリコンテナで任意のコマンドを実行し、タスクARNを取得する
## NOTE: appコンテナのコンテナ定義にて、essential:trueに設定すると、appコンテナが終了したらタスクが全体が終了する
task_arn=$(aws ecs run-task \                                                                                      
  --cluster ${cluster_name} \          
  --launch-type FARGATE \             
  --task-definition ${task_definition} \
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
aws ecs wait tasks-stopped \
  --cluster ${cluster_name} \
  --tasks ${task_arn}
