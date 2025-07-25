terraform {
  backend "s3" {
    bucket = "ngsw-terraform-s3"
    key    = "prod/terraform.tfstate"
    region = "ap-northeast-1"
  }
}
