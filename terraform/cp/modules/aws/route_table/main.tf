resource "aws_route_table" "public" {
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = var.internet_gateway_id
  }
  tags = {
    Name = "cp-rtb-public-${var.env}"
  }
  vpc_id = var.vpc_id
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnets)
  route_table_id = aws_route_table.public.id
  subnet_id      = var.public_subnets[count.index]
}

# resource "aws_route_table" "private" {
#   route {
#     cidr_block     = "0.0.0.0/0"
#     nat_gateway_id = var.nat_gateway_id
#   }
#   tags = {
#     Name = "cp-rtb-private-${var.env}"
#   }
#   vpc_id = var.vpc_id
# }

# resource "aws_route_table_association" "private" {
#   count          = length(var.private_subnets)
#   route_table_id = aws_route_table.private.id
#   subnet_id      = var.private_subnets[count.index]
# }
