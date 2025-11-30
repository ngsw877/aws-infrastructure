# module "ecr_sample" {
#   source               = "../modules/aws/ecr_unit"
#   name                 = "cp-test-ecr-stg"
#   image_tag_mutability = "IMMUTABLE"
# }

# module "ecr_sample_2" {
#   source               = "../modules/aws/ecr_unit"
#   name                 = "cp-test-ecr-2-stg"
#   image_tag_mutability = "IMMUTABLE"
# }

module "vpc" {
  source = "../modules/aws/vpc"
  env    = "stg"
}
module "subnet" {
  source = "../modules/aws/subnet"
  env    = "stg"
  vpc_id = module.vpc.cp_vpc_id
}
