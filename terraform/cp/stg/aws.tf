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

import {
  to = module.secrets_manager.aws_secretsmanager_secret.db_main_instance
  id = "arn:aws:secretsmanager:ap-northeast-1:422752180329:secret:db-main-instance-stg-BgWwm3"
}