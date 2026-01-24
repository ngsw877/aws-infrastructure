module "vpc" {
  source = "../modules/aws/vpc"
  env    = local.env
}