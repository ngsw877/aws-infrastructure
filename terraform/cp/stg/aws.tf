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
  public_subnets      = local.public_subnet_ids
  private_subnets     = local.private_subnet_ids
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

module "rds_cp" {
  source                              = "../modules/aws/rds_unit"
  identifier                          = "cp-${local.env}"
  db_name                             = "slack_metrics"
  family                              = "postgres16"
  engine_version                      = "16.8"
  instance_class                      = "db.t3.micro"
  subnet_group_name                   = "cp-db-subnet-group-${local.env}"
  parameter_group_name                = "cp-db-parameter-group-${local.env}"
  security_group_ids                  = [module.security_group.id_rds]
  private_subnet_ids                  = local.private_subnet_ids
  iam_database_authentication_enabled = true
}

module "acm_sample_app_click_ap_northeast_1" {
  source      = "../modules/aws/acm_unit"
  domain_name = "*.${local.base_host}"
  providers = {
    aws = aws
  }
}

module "ecs" {
  source = "../modules/aws/ecs"
  env = local.env
}

import {
  to = module.ecs.aws_ecs_cluster.cp_backend
  id = "cp-backend-stg"
}

import {
  to = module.ecs.aws_ecs_cluster_capacity_providers.cp_backend
  id = "cp-backend-stg"
}