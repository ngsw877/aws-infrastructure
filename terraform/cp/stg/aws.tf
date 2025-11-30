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
  to = module.subnet.aws_subnet.private_subnet_1c
  id = "subnet-0b2da9f839075af0e"
}

import {
  to = module.subnet.aws_subnet.public_subnet_1a
  id = "subnet-095a60362edd6c77c"
}

import {
  to = module.subnet.aws_subnet.public_subnet_1c
  id = "subnet-07330fbaec4138aa2"
}
