locals {
  env        = "stg"
  account_id = "422752180329"
  region     = "ap-northeast-1"
  public_subnets = {
    "1a" = module.subnet.public_subnet_1a_id
    "1c" = module.subnet.public_subnet_1c_id
  }
  private_subnets = {
    "1a" = module.subnet.private_subnet_1a_id
    "1c" = module.subnet.private_subnet_1c_id
  }
}
