# data "aws_ecs_task_definition" "latest_slack_metrics_api" {
#   task_definition = "slack-metrics-api-${var.env}"
# }

output "arn_slack_metrics_api" {
  # value = data.aws_ecs_task_definition.latest_slack_metrics_api.arn
  value = aws_ecs_task_definition.slack_metrics_api.arn
}

output "arn_cost_api" {
  value = aws_ecs_task_definition.cost_api.arn
}