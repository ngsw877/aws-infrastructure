locals {
  env        = "prd"
  account_id = "612822777442"
  region     = "ap-northeast-1"
  base_host              = "ngsw-app.click"
  private_subnet_ids = [
    module.subnet.id_private_1a,
    module.subnet.id_private_1c,
  ]
  public_subnet_ids = [
    module.subnet.id_public_1a,
    module.subnet.id_public_1c,
  ]
  private_subnet_cidr_blocks = [
    module.subnet.cidr_block_private_1a,
    module.subnet.cidr_block_private_1c,
  ]
}
