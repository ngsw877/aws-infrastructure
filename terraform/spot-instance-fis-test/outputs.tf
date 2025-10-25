output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "security_group_id" {
  description = "Security group ID"
  value       = aws_security_group.isolated.id
}

output "launch_template_id" {
  description = "Launch template ID"
  value       = aws_launch_template.spot.id
}

output "autoscaling_group_name" {
  description = "Auto Scaling Group name"
  value       = aws_autoscaling_group.spot.name
}

output "sns_topic_arn" {
  description = "SNS topic ARN for spot interruption notifications"
  value       = aws_sns_topic.spot_interruption.arn
}

output "fis_experiment_template_id" {
  description = "FIS experiment template ID"
  value       = aws_fis_experiment_template.interrupt_spot_instance.id
}

output "cloudwatch_log_group_name" {
  description = "CloudWatch Logs group name for FIS"
  value       = aws_cloudwatch_log_group.fis.name
}

output "chatbot_configuration_name" {
  description = "AWS Chatbot configuration name"
  value       = aws_chatbot_slack_channel_configuration.spot_interruption.configuration_name
}