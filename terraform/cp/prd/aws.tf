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
  nat_network_interface_id = null
  public_subnets      = local.public_subnet_ids
  private_subnets     = local.private_subnet_ids
}