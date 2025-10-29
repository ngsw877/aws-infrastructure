output "lambda_function_arn" {
  description = "ARN of the Lambda function"
  value       = aws_lambda_function.sample_lambda.arn
}

output "lambda_function_name" {
  description = "Name of the Lambda function"
  value       = aws_lambda_function.sample_lambda.function_name
}

output "lambda_invoke_arn" {
  description = "Invoke ARN of the Lambda function"
  value       = aws_lambda_function.sample_lambda.invoke_arn
}