# Hello World Lambda outputs
output "sample_lambda_arn" {
  description = "ARN of the Hello World Lambda function"
  value       = aws_lambda_function.sample_lambda.arn
}

output "sample_lambda_name" {
  description = "Name of the Hello World Lambda function"
  value       = aws_lambda_function.sample_lambda.function_name
}

output "sample_lambda_invoke_arn" {
  description = "Invoke ARN of the Hello World Lambda function"
  value       = aws_lambda_function.sample_lambda.invoke_arn
}

# Timestamp Lambda outputs
output "timestamp_lambda_arn" {
  description = "ARN of the Timestamp Lambda function"
  value       = aws_lambda_function.timestamp_lambda.arn
}

output "timestamp_lambda_name" {
  description = "Name of the Timestamp Lambda function"
  value       = aws_lambda_function.timestamp_lambda.function_name
}

output "timestamp_lambda_invoke_arn" {
  description = "Invoke ARN of the Timestamp Lambda function"
  value       = aws_lambda_function.timestamp_lambda.invoke_arn
}

# Event Echo Lambda outputs
output "event_echo_lambda_arn" {
  description = "ARN of the Event Echo Lambda function"
  value       = aws_lambda_function.event_echo_lambda.arn
}

output "event_echo_lambda_name" {
  description = "Name of the Event Echo Lambda function"
  value       = aws_lambda_function.event_echo_lambda.function_name
}

output "event_echo_lambda_invoke_arn" {
  description = "Invoke ARN of the Event Echo Lambda function"
  value       = aws_lambda_function.event_echo_lambda.invoke_arn
}