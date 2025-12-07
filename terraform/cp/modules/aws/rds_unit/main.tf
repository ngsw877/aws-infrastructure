resource "aws_db_subnet_group" "subnet_group" {
  name        = var.subnet_group_name
  description = var.subnet_group_name
  subnet_ids  = var.private_subnet_ids
  tags = {
    "Name" = var.subnet_group_name
  }
}

resource "aws_db_parameter_group" "parameter_group" {
  name        = var.parameter_group_name
  description = var.parameter_group_name
  family      = var.family
}

resource "aws_db_instance" "main" {
  engine                              = "postgres"
  identifier                          = var.identifier
  db_name                             = var.db_name
  engine_version                      = var.engine_version
  instance_class                      = var.instance_class
  username                            = "postgres" // DB作成時のマスターユーザー名
  password                            = random_password.db.result
  ca_cert_identifier                  = "rds-ca-rsa2048-g1"
  max_allocated_storage               = 1000
  allocated_storage                   = 10
  apply_immediately                   = true
  copy_tags_to_snapshot               = true
  performance_insights_enabled        = true
  skip_final_snapshot                 = true
  storage_encrypted                   = true
  iam_database_authentication_enabled = var.iam_database_authentication_enabled
  vpc_security_group_ids              = var.security_group_ids
  db_subnet_group_name                = aws_db_subnet_group.subnet_group.name
  parameter_group_name                = aws_db_parameter_group.parameter_group.name

  lifecycle {
    ignore_changes = [password]
  }
}

resource "random_password" "db" {
  length  = 25
  special = false
}