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
module "subnet" {
  source = "../modules/aws/subnet"
  env    = "stg"
  vpc_id = module.vpc.cp_vpc_id
}

import {
  to = aws_internet_gateway.tmp
  id = "igw-0e3198982b74c7dd8"
}

resource "aws_internet_gateway" "tmp" {
  tags = {
    Name = "cp-igw-stg"
  }
  vpc_id = "vpc-092b7ae2d585fb553"
}
