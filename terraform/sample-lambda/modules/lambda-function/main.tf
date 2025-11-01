# Lambda関数のコードをzip化
data "archive_file" "lambda" {
  type        = "zip"
  source_dir  = var.source_dir
  output_path = "${var.build_dir}/${var.function_name}.zip"
}

# CloudWatch Logs ロググループ
resource "aws_cloudwatch_log_group" "lambda" {
  name              = "/aws/lambda/${var.function_name}"
  retention_in_days = 7

  tags = var.tags
}

# Lambda関数
resource "aws_lambda_function" "this" {
  filename         = data.archive_file.lambda.output_path
  source_code_hash = data.archive_file.lambda.output_base64sha256
  function_name    = var.function_name
  role            = var.role_arn
  runtime         = "python3.12"
  handler         = "index.handler"

  depends_on = [
    aws_cloudwatch_log_group.lambda
  ]

  tags = var.tags
}