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

import {
  to = aws_vpc.tmp
  id = "vpc-092b7ae2d585fb553"
}

resource "aws_vpc" "tmp" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "cp-stg"
  }
}

