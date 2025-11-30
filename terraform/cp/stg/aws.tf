# module "ecr_sample" {
#   source               = "../modules/aws/ecr_unit"
#   name                 = "cp-test-ecr-stg"
#   image_tag_mutability = "IMMUTABLE"
# }

# module "ecr_sample_2" {
#   source               = "../modules/aws/ecr_unit"
#   name                 = "cp-test-ecr-2-stg"
#   image_tag_mutability = "IMMUTABLE"
# }

module "vpc" {
  source = "../modules/aws/vpc"
  env    = "stg"
}

import {
  to = aws_subnet.tmp
  id = "subnet-0ab04c255c12ed5f3"
}

resource "aws_subnet" "tmp" {
  cidr_block        = "10.0.128.0/18"
  availability_zone = "ap-northeast-1a"
  tags = {
    Name = "private-subnet-1a-stg"
  }
  vpc_id = "vpc-092b7ae2d585fb553"
}
