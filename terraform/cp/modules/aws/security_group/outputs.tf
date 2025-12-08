output "id_bastion" {
  value = aws_security_group.bastion.id
}

output "id_rds" {
  value = aws_security_group.db.id
}

output "id_slack_metrics_backend" {
  value = aws_security_group.slack_metrics_backend.id
}

output "id_alb_cp" {
  value = aws_security_group.alb_cp.id
}