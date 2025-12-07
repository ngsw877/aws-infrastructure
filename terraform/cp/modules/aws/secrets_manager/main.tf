# valueはコンソールから入れるので、ここでは箱だけ登録する
resource "aws_secretsmanager_secret" "db_main_instance" {
  name        = "db-main-instance-${var.env}"
  description = "RDS cp main instance"
}