terraform {
  required_version = ">= 1.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.0"
    }
  }
}

provider "aws" {
  region = "ap-northeast-1"
}

# Lambda関数のコードをzip化
data "archive_file" "sample_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/hello-world"
  output_path = "${path.module}/build/sample-lambda.zip"
}

data "archive_file" "timestamp_lambda" {
  type        = "zip"
  source_dir  = "${path.module}/lambda/timestamp"
  output_path = "${path.module}/build/timestamp-lambda.zip"
}

# Lambda実行用のIAMロール
resource "aws_iam_role" "lambda_role" {
  name = "sample-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "lambda.amazonaws.com"
        }
      }
    ]
  })
}

# CloudWatch Logsへの書き込み権限を付与
resource "aws_iam_role_policy_attachment" "lambda_basic_execution" {
  role       = aws_iam_role.lambda_role.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaBasicExecutionRole"
}

# Lambda関数（Hello World）
resource "aws_lambda_function" "sample_lambda" {
  filename         = data.archive_file.sample_lambda.output_path
  function_name    = "sample-lambda-function"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.sample_lambda.output_base64sha256
  runtime         = "python3.12"

  tags = {
    Name        = "sample-lambda"
    Environment = "development"
  }
}

# Lambda関数（日本時間タイムスタンプ）
resource "aws_lambda_function" "timestamp_lambda" {
  filename         = data.archive_file.timestamp_lambda.output_path
  function_name    = "timestamp-lambda-function"
  role            = aws_iam_role.lambda_role.arn
  handler         = "index.handler"
  source_code_hash = data.archive_file.timestamp_lambda.output_base64sha256
  runtime         = "python3.12"

  tags = {
    Name        = "timestamp-lambda"
    Environment = "development"
  }
}