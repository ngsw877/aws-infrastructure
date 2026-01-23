output "public_subnet_1a_id" {
  value = aws_subnet.public_subnet_1a.id
}

output "public_subnet_1c_id" {
  value = aws_subnet.public_subnet_1c.id
}

output "private_subnet_1a_id" {
  value = aws_subnet.private_subnet_1a.id
}

output "private_subnet_1c_id" {
  value = aws_subnet.private_subnet_1c.id
}

output "cidr_block_private_1a" {
  value = aws_subnet.private_subnet_1a.cidr_block
}

output "cidr_block_private_1c" {
  value = aws_subnet.private_subnet_1c.cidr_block
}
