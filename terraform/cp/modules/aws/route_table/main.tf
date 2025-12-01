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

resource "aws_route_table_association" "public_subnet_1a" {
  subnet_id      = "subnet-095a60362edd6c77c"
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "public_subnet_1c" {
  subnet_id      = "subnet-07330fbaec4138aa2"
  route_table_id = aws_route_table.public.id
}
