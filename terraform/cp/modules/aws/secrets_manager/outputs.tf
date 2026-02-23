output "arn_db_main_instance" {
  value = aws_secretsmanager_secret.db_main_instance.arn
}

output "arn_datadog_keys" {
  value = var.enable_datadog_keys ? aws_secretsmanager_secret.datadog_keys[0].arn : null
}