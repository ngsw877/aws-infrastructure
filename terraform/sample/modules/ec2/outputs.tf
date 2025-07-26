output "instance_id" {
  value = aws_instance.this.id
}

output "instance_security_group_id" {
  value = aws_security_group.this.id
}