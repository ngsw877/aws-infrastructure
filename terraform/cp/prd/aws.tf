module "route53_ngsw_app_click" {
  source    = "../modules/aws/route53_unit"
  zone_name = local.base_host
  records = []
}

import {
  to = module.route53_ngsw_app_click.aws_route53_zone.zone
  id = "Z01861951HBKW5N9CDYG4"
}

module "vpc" {
  source = "../modules/aws/vpc"
  env    = local.env
}

module "subnet" {
  source = "../modules/aws/subnet"
  env    = local.env
  vpc_id = module.vpc.id_cp
}

module "internet_gateway" {
  source = "../modules/aws/internet_gateway"
  env    = local.env
  vpc_id = module.vpc.id_cp
}

module "route_table" {
  source              = "../modules/aws/route_table"
  env                 = local.env
  vpc_id              = module.vpc.id_cp
  internet_gateway_id = module.internet_gateway.cp_internet_gateway_id
  nat_network_interface_id = null
  public_subnets      = local.public_subnet_ids
  private_subnets     = local.private_subnet_ids
}

module "security_group" {
  source = "../modules/aws/security_group"
  env    = local.env
  vpc_id = module.vpc.id_cp
  private_subnet_cidr_blocks = local.private_subnet_cidr_blocks
}

module "iam_role" {
  source = "../modules/aws/iam_role"
  env    = local.env
}

module "s3" {
  source = "../modules/aws/s3"
  env    = local.env
}

module "ecr" {
  source = "../modules/aws/ecr"
  env    = local.env
}