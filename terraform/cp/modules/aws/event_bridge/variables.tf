variable "name_prefix" {
  type        = string
  description = "リソース名に使用するプレフィックス (例: my-app-stg)"
}

variable "target_rds_instance_arn" {
  type        = string
  description = "自動停止の対象とするRDSインスタンスのARN"
}

variable "automation_name" {
  type        = string
  default     = "AWS-StopRdsInstance"
  description = "実行するSSM Automationドキュメント名"
}

data "aws_region" "current" {}
data "aws_caller_identity" "current" {}

locals {
  # AWS-StopRdsInstanceのARNを動的に構築
  automation_definition_arn = "arn:aws:ssm:${data.aws_region.current.name}:${data.aws_caller_identity.current.account_id}:automation-definition/${var.automation_name}"
}
