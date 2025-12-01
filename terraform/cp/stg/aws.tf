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
  env    = local.env
}
module "subnet" {
  source = "../modules/aws/subnet"
  env    = local.env
  vpc_id = module.vpc.cp_vpc_id
}

module "internet_gateway" {
  source = "../modules/aws/internet_gateway"
  env    = local.env
  vpc_id = module.vpc.cp_vpc_id
}

import {
  to = module.route_table.aws_route_table.public
  id = "rtb-0a0762ccb0d3e0fdf"
}

import {
  to = module.route_table.aws_route_table_association.public["subnet-095a60362edd6c77c"]
  id = "subnet-095a60362edd6c77c/rtb-0a0762ccb0d3e0fdf"
}

import {
  to = module.route_table.aws_route_table_association.public["subnet-07330fbaec4138aa2"]
  id = "subnet-07330fbaec4138aa2/rtb-0a0762ccb0d3e0fdf"
}
module "route_table" {
  source              = "../modules/aws/route_table"
  env                 = local.env
  vpc_id              = module.vpc.cp_vpc_id
  internet_gateway_id = module.internet_gateway.cp_internet_gateway_id
  public_subnet_ids   = local.public_subnet_ids
}
