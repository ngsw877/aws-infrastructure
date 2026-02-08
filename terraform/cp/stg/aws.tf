module "route53_ngsw_app_click" {
  source    = "../modules/aws/route53_unit"
  zone_name = local.base_host
  records = [
    // Slack Metrics API
    {
      name = local.slack_metrics_api_host
      type = "A"
      alias = {
        zone_id                = module.alb.zone_id_ap_northeast_1
        name                   = "dualstack.${module.alb.dns_name_cp}"
        evaluate_target_health = true
      }
    },
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
  id = "Z07198773KPDUER7543R7"
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

module "iam_role" {
  source = "../modules/aws/iam_role"
  env    = local.env
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
  // cp-backendクラスター
  slack_metrics_api = {
    name                   = "slack-metrics-api-${local.env}"
    task_definition        = module.ecs_task_definition.arn_slack_metrics_api
    enable_execute_command = true
    capacity_provider      = "FARGATE_SPOT"
    target_group_arn       = module.target_group.arn_slack_metrics_api
    security_group_ids     = [module.security_group.id_slack_metrics_backend]
    subnet_ids             = local.private_subnet_ids
  }
  // MEMO: Datadogコースで使用
  cost_api = {
    task_definition    = "arn:aws:ecs:ap-northeast-1:374146079343:task-definition/cost-api-stg:1"
    # task_definition    = module.ecs_task_definition.arn_cost_api
    capacity_provider  = "FARGATE_SPOT"
    # target_group_arn   = module.target_group.arn_cost_api
    security_group_ids = [module.security_group.id_cost_api]
    subnet_ids         = local.private_subnet_ids
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
