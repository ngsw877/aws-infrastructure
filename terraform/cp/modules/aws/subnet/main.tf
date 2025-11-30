resource "aws_subnet" "public_subnet_1a" {
  cidr_block              = "10.0.0.0/18"
  availability_zone       = "ap-northeast-1a"
  map_public_ip_on_launch = true
  tags = {
    Name = "public-subnet-1a-${var.env}"
  }
  vpc_id = var.vpc_id
}

resource "aws_subnet" "public_subnet_1c" {
  cidr_block              = "10.0.64.0/18"
  availability_zone       = "ap-northeast-1c"
  map_public_ip_on_launch = true
  tags = {
    Name = "public-subnet-1c-${var.env}"
  }
  vpc_id = var.vpc_id
}
resource "aws_subnet" "private_subnet_1a" {
  cidr_block        = "10.0.128.0/18"
  availability_zone = "ap-northeast-1a"
  tags = {
    Name = "private-subnet-1a-${var.env}"
  }
  vpc_id = var.vpc_id
}

resource "aws_subnet" "private_subnet_1c" {
  cidr_block        = "10.0.192.0/18"
  availability_zone = "ap-northeast-1c"
  tags = {
    Name = "private-subnet-1c-${var.env}"
  }
  vpc_id = var.vpc_id
}
