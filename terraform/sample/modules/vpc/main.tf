locals {
  availability_zones = [
    "ap-northeast-1a",
    "ap-northeast-1c",
    "ap-northeast-1d"
  ]
  subnet_cidr_blocks = [
    "10.0.0.0/24",
    "10.0.1.0/24",
    "10.0.2.0/24"
  ]
}

resource "aws_vpc" "this" {
  cidr_block = "10.0.0.0/16"

  tags = {
    Name = "sample-vpc"
  }
}

resource "aws_subnet" "public" {
  count = length(local.availability_zones)

  vpc_id     = aws_vpc.this.id
  cidr_block = local.subnet_cidr_blocks[count.index]
  availability_zone = local.availability_zones[count.index]

}