data "datadog_integration_aws_iam_permissions" "datadog_permissions" {}

locals {
  all_permissions = data.datadog_integration_aws_iam_permissions.datadog_permissions.iam_permissions

  max_policy_size = 6144
  target_chunk_size = 5900

  permission_sizes = [
    for perm in local.all_permissions :
    length(perm) + 3
  ]
  cumulative_sizes = [
    for i in range(length(local.permission_sizes)) :
    sum(slice(local.permission_sizes, 0, i + 1))
  ]

  chunk_assignments = [
    for cumulative_size in local.cumulative_sizes :
    floor(cumulative_size / local.target_chunk_size)
  ]
  chunk_numbers = distinct(local.chunk_assignments)
  permission_chunks = [
    for chunk_num in local.chunk_numbers : [
      for i, perm in local.all_permissions :
      perm if local.chunk_assignments[i] == chunk_num
    ]
  ]
}

resource "datadog_integration_aws_account" "datadog_integration" {
  account_tags   = []
  aws_account_id = "374146079343"
  aws_partition  = "aws"
  aws_regions {
    include_all = true
  }
  auth_config {
    aws_auth_config_role {
      role_name = "DatadogIntegrationRole"
    }
  }
  resources_config {
    cloud_security_posture_management_collection = true
    extended_collection                          = true
  }
  traces_config {
    xray_services {
    }
  }
  logs_config {
    lambda_forwarder {
      lambdas = [module.datadog_log_forwarder.datadog_forwarder_arn]
    }
  }
  metrics_config {
    namespace_filters {
    }
  }
}

module "datadog_log_forwarder" {
  source  = "DataDog/log-lambda-forwarder-datadog/aws"

  dd_api_key = "5f6ffc036b32a7aae40ef4fc96b2466e"
  dd_site    = "ap1.datadoghq.com"

  tags = {
    Terraform = "true"
  }
}