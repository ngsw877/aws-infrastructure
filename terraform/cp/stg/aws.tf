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

module "route_table" {
  source              = "../modules/aws/route_table"
  env                 = local.env
  vpc_id              = module.vpc.cp_vpc_id
  internet_gateway_id = module.internet_gateway.cp_internet_gateway_id
  nat_gateway_id      = "nat-04bc5c17546fc8eb6"
  public_subnets      = local.public_subnets
  private_subnets     = local.private_subnets
}

module "security_group" {
  source = "../modules/aws/security_group"
  env    = local.env
  vpc_id = module.vpc.cp_vpc_id
}

import {
  to = module.security_group.aws_security_group.alb_cp
  id = "sg-040d898742c6ef80a"
}

import {
  to = module.security_group.aws_security_group.bastion
  id = "sg-0809731f682d5b4ae"
}

import {
  to = module.security_group.aws_security_group.slack_metrics_backend
  id = "sg-0efb3107ca24f4c6c"
}

import {
  to = module.security_group.aws_security_group.db_migrator
  id = "sg-04961f409d0fcf9ad"
}

import {
  to = module.security_group.aws_security_group.db
  id = "sg-0f13fac5306891bc8"
}
