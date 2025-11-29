resource "aws_ecr_repository" "sample" {
  name = "cp-test-ecr-stg"
}

resource "aws_ecr_repository" "sample_2" {
  name = "cp-test-ecr-2-stg"
}