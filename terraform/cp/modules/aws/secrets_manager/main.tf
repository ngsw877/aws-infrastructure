# valueはコンソールから入れるので、ここでは箱だけ登録する
resource "aws_secretsmanager_secret" "db_main_instance" {
  name        = "db-main-instance-${var.env}"
  description = "RDS cp main instance"
}

resource "aws_secretsmanager_secret" "datadog_keys" {
  count       = var.enable_datadog_keys ? 1 : 0
  name        = "datadog-keys-${var.env}"
  description = "Datadog credentials for Integration"
}
