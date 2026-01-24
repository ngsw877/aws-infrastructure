output "id_public_1a" {
  value = aws_subnet.public_subnet_1a.id
}

output "id_public_1c" {
  value = aws_subnet.public_subnet_1c.id
}

output "id_private_1a" {
  value = aws_subnet.private_subnet_1a.id
}

output "id_private_1c" {
  value = aws_subnet.private_subnet_1c.id
}

output "cidr_block_private_1a" {
  value = aws_subnet.private_subnet_1a.cidr_block
}

output "cidr_block_private_1c" {
  value = aws_subnet.private_subnet_1c.cidr_block
}
