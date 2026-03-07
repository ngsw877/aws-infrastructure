# ------------------------------------------------------------------------------
# IAM Role for EventBridge to trigger SSM Automation
# ------------------------------------------------------------------------------

# EventBridgeがSSM Automationを実行するために引き受けるIAMロール
resource "aws_iam_role" "eventbridge_to_ssm" {
  name = "${var.name_prefix}-rds-autostop-role"

  assume_role_policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      {
        Effect    = "Allow",
        Principal = {
          Service = "events.amazonaws.com"
        },
        Action    = "sts:AssumeRole"
      }
    ]
  })
}

# 上記ロールにアタッチするIAMポリシー
resource "aws_iam_policy" "eventbridge_to_ssm_policy" {
  name        = "${var.name_prefix}-rds-autostop-policy"
  description = "Allows EventBridge to trigger SSM Automation to stop RDS instance."

  policy = jsonencode({
    Version   = "2012-10-17",
    Statement = [
      # SSM Automationの実行を許可
      {
        Effect   = "Allow",
        Action   = "ssm:StartAutomationExecution",
        Resource = local.automation_definition_arn
      },
      # RDSインスタンスの停止と状態確認を許可
      {
        Effect   = "Allow",
        Action = [
          "rds:StopDBInstance",
          "rds:DescribeDBInstances"
        ],
        Resource = var.target_rds_instance_arn
      }
    ]
  })
}

# ロールとポリシーをアタッチ
resource "aws_iam_role_policy_attachment" "eventbridge_to_ssm_attach" {
  role       = aws_iam_role.eventbridge_to_ssm.name
  policy_arn = aws_iam_policy.eventbridge_to_ssm_policy.arn
}


# ------------------------------------------------------------------------------
# EventBridge Rule & Target
# ------------------------------------------------------------------------------

# RDSインスタンスが起動したイベントを検知するEventBridgeルール
resource "aws_cloudwatch_event_rule" "rds_started" {
  name        = "${var.name_prefix}-rds-started-rule"
  description = "Fires when the target RDS instance is started."

  event_pattern = jsonencode({
    source      = ["aws.rds"],
    "detail-type" = ["RDS DB Instance Event"],
    detail      = {
      EventID     = ["RDS-EVENT-0004"], # DB instance started
      SourceArn   = [var.target_rds_instance_arn]
    }
  })
}

# ルールのターゲットとしてSSM Automationを設定
resource "aws_cloudwatch_event_target" "stop_rds_automation" {
  rule      = aws_cloudwatch_event_rule.rds_started.name
  target_id = "${var.name_prefix}-stop-rds-automation"
  arn       = local.automation_definition_arn
  role_arn  = aws_iam_role.eventbridge_to_ssm.arn

  # イベントのペイロードからRDSのARNを抽出し、SSM Automationが要求する形式に変換して渡す
  input_transformer {
    input_paths = {
      "instance_arn" = "$.detail.SourceArn"
    }
    # AWS-StopRdsInstanceは `InstanceId` というキーでARNの配列を受け取る
    input_template = <<JSON
{
  "InstanceId": ["<instance_arn>"]
}
JSON
  }
}
