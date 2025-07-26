terraform {
  backend "s3" {
    bucket = "ngsw-terraform-s3"
    key    = "dev/terraform.tfstate"
    region = "ap-northeast-1"
  }
}
