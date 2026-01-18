output "arn_slack_metrics_api" {
  # dataソース経由じゃなくて、リソースから直接ARNを参照するように変更してね！
  # ※ "aws_ecs_task_definition.slack_metrics_api" の部分は、
  #    main.tf で定義してるリソース名に合わせて書き換えてね🙏
  value = aws_ecs_task_definition.slack_metrics_api.arn
}