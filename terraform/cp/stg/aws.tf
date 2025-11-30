resource "aws_ecr_repository" "sample" {
  name                 = "cp-test-ecr-stg"
  image_tag_mutability = "IMMUTABLE"
}

resource "aws_ecr_lifecycle_policy" "lifecycle_policy_sample" {
  repository = aws_ecr_repository.sample.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "最新の3つのイメージのみを保持"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

resource "aws_ecr_repository" "sample_2" {
  name                 = "cp-test-ecr-2-stg"
  image_tag_mutability = "IMMUTABLE"
}

resource "aws_ecr_lifecycle_policy" "lifecycle_policy_sample_2" {
  repository = aws_ecr_repository.sample_2.name
  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "最新の3つのイメージのみを保持"
        selection = {
          tagStatus   = "any"
          countType   = "imageCountMoreThan"
          countNumber = 3
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}
