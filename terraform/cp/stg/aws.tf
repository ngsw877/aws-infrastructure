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
  # nat_gateway_id      = "nat-0a439f47f1dda676e"
  public_subnets      = local.public_subnet_ids
  private_subnets     = local.private_subnet_ids
}

module "security_group" {
  source = "../modules/aws/security_group"
  env    = local.env
  vpc_id = module.vpc.id_cp
  # security_group_id_cp_k8s_cluster = module.eks.cp_cluster_security_group_id
}

module "ecr" {
  source = "../modules/aws/ecr"
  env    = local.env
}

module "secrets_manager" {
  source = "../modules/aws/secrets_manager"
  env    = local.env
}

import {
  to = module.iam_role.aws_iam_role.cp_nat
  id = "cp-nat-stg"
}

import {
  to = module.iam_role.aws_iam_role_policy_attachment.cp_nat["ssm_core"]
  id = "cp-nat-stg/arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

import {
  to = module.iam_role.aws_iam_instance_profile.cp_nat_profile
  id = "cp-nat-stg"
}

module "iam_role" {
  source = "../modules/aws/iam_role"
  env    = local.env
}

module "ec2" {
  source           = "../modules/aws/ec2"
  env              = local.env
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

module "acm_ngsw_app_click_ap_northeast_1" {
  source      = "../modules/aws/acm_unit"
  domain_name = "*.${local.base_host}"
  providers = {
    aws = aws
  }
}

module "s3" {
  source = "../modules/aws/s3"
  env    = local.env
}

module "ecs" {
  source = "../modules/aws/ecs"
  env    = local.env
  // cloud-pratica-backendクラスター
  slack_metrics_api = {
    name                   = "slack-metrics-api-${local.env}"
    task_definition        = module.ecs_task_definition.arn_slack_metrics_api
    enable_execute_command = true
    capacity_provider      = "FARGATE_SPOT"
    target_group_arn       = module.target_group.arn_slack_metrics_api
    security_group_ids     = [module.security_group.id_slack_metrics_backend]
    subnet_ids             = local.private_subnet_ids
  }
}

module "ecs_task_definition" {
  source                               = "../modules/aws/ecs_task_definition"
  env                                  = local.env
  ecr_url_slack_metrics                = "${module.ecr.url_slack_metrics}:53aae3e"
  ecr_url_db_migrator                  = "${module.ecr.url_db_migrator}:53aae3e"
  ecs_task_execution_role_arn          = module.iam_role.role_arn_ecs_task_execution
  ecs_task_role_arn_slack_metrics      = module.iam_role.role_arn_cp_slack_metrics_backend
  ecs_task_role_arn_db_migrator        = module.iam_role.role_arn_cp_db_migrator
  secrets_manager_arn_db_main_instance = module.secrets_manager.arn_db_main_instance
  arn_cp_config_bucket                 = module.s3.arn_cp_config_bucket
  ecs_task_specs = {
    slack_metrics_api = {
      cpu    = 256
      memory = 512
    }
    db_migrator = {
      cpu    = 256
      memory = 512
    }
  }
}

module "target_group" {
  source = "../modules/aws/target_group"
  env    = local.env
  vpc_id = module.vpc.id_cp
}

module "alb" {
  source = "../modules/aws/alb"
  env    = local.env
  cp = {
    security_group_ids                 = [module.security_group.id_alb_cp]
    subnet_ids                         = local.public_subnet_ids
    certificate_arn                    = module.acm_ngsw_app_click_ap_northeast_1.arn
    target_group_arn_slack_metrics_api = module.target_group.arn_slack_metrics_api
    slack_metrics_api_host             = local.slack_metrics_api_host
  }
}

# module "eks_pod_identity" {
#   source       = "../modules/aws/eks_pod_identity_unit"
#   cluster_name = "cp-${local.env}"
#   associations = [
#     {
#       namespace       = "app"
#       service_account = "db-migrator-sa"
#       role_arn        = module.iam_role.role_arn_cp_db_migrator
#     },
#     {
#       namespace       = "app"
#       service_account = "slack-metrics-sa"
#       role_arn        = module.iam_role.role_arn_cp_slack_metrics_backend
#     },
#     {
#       namespace       = "external-secrets"
#       service_account = "external-secrets-operator-sa"
#       role_arn        = module.iam_role.role_arn_cp_k8s_eso
#     },
#     {
#       namespace       = "kube-system"
#       service_account = "alb-controller-sa"
#       role_arn        = module.iam_role.role_arn_cp_k8s_alb_controller
#     },
#   ]
# }

# module "eks" {
#   source = "../modules/aws/eks"
#   env = local.env
# }
