module "route53_ngsw_app_click" {
  source    = "../modules/aws/route53_unit"
  zone_name = local.base_host
  records = [
    // ACMの検証用
    {
      name   = module.acm_ngsw_app_click_ap_northeast_1.validation_record_name
      values = [module.acm_ngsw_app_click_ap_northeast_1.validation_record_value]
      type   = "CNAME"
      ttl    = "300"
    },
  ]
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
  nat_network_interface_id = module.ec2.network_interface_id_nat_1a
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

module "secrets_manager" {
  source = "../modules/aws/secrets_manager"
  env    = local.env
}

module "acm_ngsw_app_click_ap_northeast_1" {
  source      = "../modules/aws/acm_unit"
  domain_name = "*.${local.base_host}"
  providers = {
    aws = aws
  }
}

module "ec2" {
  source           = "../modules/aws/ec2"
  env              = local.env
  public_subnet_id = module.subnet.id_public_1a
  bastion = {
    iam_instance_profile = module.iam_role.instance_profile_cp_bastion
    security_group_id    = module.security_group.id_bastion
    volume_size          = 8
  }
  nat_1a = {
    iam_instance_profile = module.iam_role.instance_profile_cp_nat
    security_group_id    = module.security_group.id_nat
    volume_size          = 8
  }
}