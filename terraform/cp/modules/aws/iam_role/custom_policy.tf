/************************************************************
Secrets Manager Read
************************************************************/
resource "aws_iam_policy" "secrets_manager_read" {
  name        = "secrets-manager-readonly-${var.env}"
  description = "secrets-manager-readonly-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = [
          "secretsmanager:GetSecretValue",
          "secretsmanager:DescribeSecret"
        ]
        Effect   = "Allow"
        Resource = "*"
      }
    ]
  })
}

/************************************************************
SQS Read and Write
************************************************************/
resource "aws_iam_policy" "sqs_read_write" {
  name = "sqs-read-write-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "sqs:SendMessage",
          "sqs:ReceiveMessage",
          "sqs:DeleteMessage",
          "sqs:GetQueueAttributes"
        ]
        Resource = "*"
      }
    ]
  })
}

/************************************************************
SES Send Email
************************************************************/
resource "aws_iam_policy" "ses_send_email" {
  name = "ses-send-email-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect   = "Allow"
        Action   = ["ses:SendEmail", "ses:SendRawEmail"]
        Resource = "*"
      }
    ]
  })
}

/************************************************************
S3 Read
************************************************************/
resource "aws_iam_policy" "s3_read" {
  name = "s3-read-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "s3:ListBucket",
          "s3:GetObject",
          "s3:GetObjectVersion"
        ]
        Resource = "*"
      }
    ]
  })
}

/************************************************************
CP ALB Controller
jsonファイルは公式Doc記載の以下のコマンドでダウンロード
curl -O https://raw.githubusercontent.com/kubernetes-sigs/aws-load-balancer-controller/v2.11.0/docs/install/iam_policy.json
************************************************************/
resource "aws_iam_policy" "cp_k8s_alb_controller" {
  name        = "cp-k8s-alb-controller-${var.env}"
  description = "Policy for ALB Controller"
  policy      = file("${path.module}/files/alb_controller_policy.json")
}

resource "aws_iam_policy" "read_cost_and_usage" {
  name = "read-cost-and-usage-${var.env}"
  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "ce:GetCostAndUsage"
        ]
        Resource = "*"
      }
    ]
  })
}