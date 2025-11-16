module "web" {
  source = "../../modules/web"

  myip = var.myip
  env = var.env
}