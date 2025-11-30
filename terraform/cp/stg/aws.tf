module "ecr_sample" {
  source               = "../modules/aws/ecr_unit"
  name                 = "cp-test-ecr-stg"
  image_tag_mutability = "IMMUTABLE"
}

module "ecr_sample_2" {
  source               = "../modules/aws/ecr_unit"
  name                 = "cp-test-ecr-2-stg"
  image_tag_mutability = "IMMUTABLE"
}
