locals {
  subnet_args = {
    "ap-northeast-1a" = "10.0.0.0/24"
    "ap-northeast-1c" = "10.0.1.0/24"
    "ap-northeast-1d" = "10.0.2.0/24"
  }
}

resource "aws_vpc" "this" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "sample-vpc"
  }
}

resource "aws_subnet" "public" {
  for_each = local.subnet_args

  vpc_id     = aws_vpc.this.id
  cidr_block = each.value
  availability_zone = each.key

}