output "id_bastion" {
  value = aws_security_group.bastion.id
}

output "id_rds" {
  value = aws_security_group.db.id
}