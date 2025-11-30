resource "aws_ecr_repository" "sample" {
  name                 = "cp-test-ecr-stg"
  image_tag_mutability = "IMMUTABLE"
}

resource "aws_ecr_repository" "sample_2" {
  name                 = "cp-test-ecr-2-stg"
  image_tag_mutability = "IMMUTABLE"
}

resource "aws_ecr_repository" "sample_3" {
  count                = 1
  name                 = "cp-test-ecr-3-stg"
  image_tag_mutability = "MUTABLE"
}
