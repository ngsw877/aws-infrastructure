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
module "hello_world_lambda" {
  source = "./modules/lambda-function"

  function_name = "sample-lambda-function"
  source_dir    = "${path.module}/lambda/hello-world"
  build_dir     = "${path.module}/build"
  role_arn      = aws_iam_role.lambda_role.arn

  tags = {
    Name      = "sample-lambda"
    Project   = "terraform-sample-lambda"
    ManagedBy = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution
  ]
}

# Lambda関数（日本時間タイムスタンプ）
module "timestamp_lambda" {
  source = "./modules/lambda-function"

  function_name = "timestamp-lambda-function"
  source_dir    = "${path.module}/lambda/timestamp"
  build_dir     = "${path.module}/build"
  role_arn      = aws_iam_role.lambda_role.arn

  tags = {
    Name      = "timestamp-lambda"
    Project   = "terraform-sample-lambda"
    ManagedBy = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution
  ]
}

# Lambda関数（イベントエコー）
module "event_echo_lambda" {
  source = "./modules/lambda-function"

  function_name = "event-echo-lambda-function"
  source_dir    = "${path.module}/lambda/event-echo"
  build_dir     = "${path.module}/build"
  role_arn      = aws_iam_role.lambda_role.arn

  tags = {
    Name      = "event-echo-lambda"
    Project   = "terraform-sample-lambda"
    ManagedBy = "Terraform"
  }

  depends_on = [
    aws_iam_role_policy_attachment.lambda_basic_execution
  ]
}

# リソースグループ
resource "aws_resourcegroups_group" "sample_lambda" {
  name = "terraform-sample-lambda"

  resource_query {
    query = jsonencode({
      ResourceTypeFilters = ["AWS::AllSupported"]
      TagFilters = [
        {
          Key    = "Project"
          Values = ["terraform-sample-lambda"]
        }
      ]
    })
  }

  tags = {
    Name      = "terraform-sample-lambda-resource-group"
    Project   = "terraform-sample-lambda"
    ManagedBy = "Terraform"
  }
}