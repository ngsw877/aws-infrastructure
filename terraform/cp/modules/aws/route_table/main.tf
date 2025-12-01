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
  for_each       = toset(var.public_subnet_ids)
  route_table_id = aws_route_table.public.id
  subnet_id      = each.value
}

resource "aws_route_table" "private" {
  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = var.nat_gateway_id
  }
  tags = {
    Name = "cp-rtb-private-${var.env}"
  }
  vpc_id = var.vpc_id
}

resource "aws_route_table_association" "private" {
  for_each       = toset(var.private_subnet_ids)
  route_table_id = aws_route_table.private.id
  subnet_id      = each.value
}
