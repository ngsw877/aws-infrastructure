locals {
  env        = "stg"
  account_id = "374146079343"
  region     = "ap-northeast-1"
  base_host = "stg.ngsw-app.click"
  slack_metrics_host     = "sm.${local.base_host}"
  slack_metrics_api_host = "sm-api.${local.base_host}"
  public_subnet_ids = [
    module.subnet.public_subnet_1a_id,
    module.subnet.public_subnet_1c_id
  ]
  private_subnet_ids = [
    module.subnet.private_subnet_1a_id,
    module.subnet.private_subnet_1c_id
  ]
  private_subnet_cidr_blocks = [
    module.subnet.cidr_block_private_1a,
    module.subnet.cidr_block_private_1c,
  ]
}
