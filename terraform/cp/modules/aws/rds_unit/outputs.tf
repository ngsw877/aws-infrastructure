output "db_instance_arn" {
  description = "The ARN of the DB instance."
  value       = aws_db_instance.main.arn
}
