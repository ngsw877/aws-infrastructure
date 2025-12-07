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

import {
  to = module.iam_role.aws_iam_role.cp_db_migrator
  id = "cp-db-migrator-stg"
}

import {
  to = module.iam_role.aws_iam_role.cp_bastion
  id = "cp-bastion-stg"
}

import {
  to = module.iam_role.aws_iam_role_policy_attachment.cp_bastion["ssm_core"]
  id = "cp-bastion-stg/arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

import {
  to = module.iam_role.aws_iam_instance_profile.cp_bastion_profile
  id = "cp-bastion-stg"
}

import {
  to = module.iam_role.aws_iam_role.ecs_task_execution
  id = "ecs-task-execution-stg"
}

import {
  to = module.iam_role.aws_iam_policy.secrets_manager_read
  id = "arn:aws:iam::422752180329:policy/secrets-manager-readonly-stg"
}

import {
  for_each = {
    task_execution  = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    s3              = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
    cloudwatch      = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
    secrets_manager = "arn:aws:iam::422752180329:policy/secrets-manager-readonly-stg"
  }
  to = module.iam_role.aws_iam_role_policy_attachment.ecs_task_execution[each.key]
  id = "ecs-task-execution-stg/${each.value}"
}

import {
  to = module.iam_role.aws_iam_role.cp_slack_metrics_backend
  id = "cp-slack-metrics-backend-stg"
}

import {
  for_each = {
    cloudwatch = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
    ssm_core   = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }
  to = module.iam_role.aws_iam_role_policy_attachment.cp_slack_metrics_backend[each.key]
  id = "cp-slack-metrics-backend-stg/${each.value}"
}