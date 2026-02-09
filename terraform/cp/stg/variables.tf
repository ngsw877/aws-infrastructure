locals {
  env                    = "stg"
  account_id             = "374146079343"
  region                 = "ap-northeast-1"
  base_host              = "stg.ngsw-app.click"
  slack_metrics_host     = "sm.${local.base_host}"
  slack_metrics_api_host = "sm-api.${local.base_host}"
  cost_api_host          = "cost-api.${local.base_host}"
  public_subnet_ids = [
    module.subnet.id_public_1a,
    module.subnet.id_public_1c
  ]
  private_subnet_ids = [
    module.subnet.id_private_1a,
    module.subnet.id_private_1c
  ]
  private_subnet_cidr_blocks = [
    module.subnet.cidr_block_private_1a,
    module.subnet.cidr_block_private_1c,
  ]

  // retrieve from secret manager
  datadog_keys = jsondecode(
    data.aws_secretsmanager_secret_version.datadog_keys.secret_string
  )
}

data "aws_secretsmanager_secret_version" "datadog_keys" {
  secret_id = "datadog-keys-${local.env}"
}
