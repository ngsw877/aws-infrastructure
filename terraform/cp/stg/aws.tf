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

module "ecr" {
  source = "../modules/aws/ecr"
  env = local.env
}

module "secrets_manager" {
  source = "../modules/aws/secrets_manager"
  env = local.env
}

module "iam_role" {
  source = "../modules/aws/iam_role"
  env = local.env
}

module "ec2" {
  source = "../modules/aws/ec2"
  env = local.env
  public_subnet_id = module.subnet.public_subnet_1a_id
  bastion = {
    iam_instance_profile = module.iam_role.instance_profile_cp_bastion
    security_group_id    = module.security_group.id_bastion
    volume_size          = 8
  }
}

import {
  to = module.ec2.aws_instance.bastion
  id = "i-026b02ab473538e15"
}