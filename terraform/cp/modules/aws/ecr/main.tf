resource "aws_ecr_repository" "db_migrator" {
  name                 = "db-migrator-${var.env}"
  image_tag_mutability = "IMMUTABLE"
}

resource "aws_ecr_repository" "slack_metrics" {
  name                 = "slack-metrics-${var.env}"
  image_tag_mutability = "IMMUTABLE"
}