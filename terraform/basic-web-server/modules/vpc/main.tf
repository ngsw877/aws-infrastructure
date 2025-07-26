locals {
  public_subnet_args = {
    "ap-northeast-1a" = "10.0.0.0/24"
    "ap-northeast-1c" = "10.0.1.0/24"
    "ap-northeast-1d" = "10.0.2.0/24"
  }
  
  private_subnet_args = {
    "ap-northeast-1a" = "10.0.10.0/24"
    "ap-northeast-1c" = "10.0.11.0/24"
    "ap-northeast-1d" = "10.0.12.0/24"
  }
}

resource "aws_vpc" "this" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "basic-web-server-vpc"
  }
}

resource "aws_subnet" "public" {
  for_each = local.public_subnet_args

  vpc_id     = aws_vpc.this.id
  cidr_block = each.value
  availability_zone = each.key
  map_public_ip_on_launch = true
  
  tags = {
    Name = "basic-web-server-public-${each.key}"
  }
}

resource "aws_subnet" "private" {
  for_each = local.private_subnet_args

  vpc_id     = aws_vpc.this.id
  cidr_block = each.value
  availability_zone = each.key
  
  tags = {
    Name = "basic-web-server-private-${each.key}"
  }
}

resource "aws_internet_gateway" "this" {
  vpc_id = aws_vpc.this.id
  
  tags = {
    Name = "basic-web-server-igw"
  }
}

resource "aws_eip" "nat" {
  vpc = true
  
  tags = {
    Name = "basic-web-server-nat-eip"
  }
}

resource "aws_nat_gateway" "this" {
  allocation_id = aws_eip.nat.id
  subnet_id     = aws_subnet.public["ap-northeast-1a"].id
  
  tags = {
    Name = "basic-web-server-nat"
  }
  
  depends_on = [aws_internet_gateway.this]
}

resource "aws_route_table" "public" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.this.id
  }
  
  tags = {
    Name = "basic-web-server-public-rtb"
  }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.this.id

  route {
    cidr_block = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.this.id
  }
  
  tags = {
    Name = "basic-web-server-private-rtb"
  }
}

resource "aws_route_table_association" "public" {
  for_each = aws_subnet.public

  subnet_id = each.value.id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  for_each = aws_subnet.private

  subnet_id = each.value.id
  route_table_id = aws_route_table.private.id
}
