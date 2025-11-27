terraform {
  backend "s3" {
    bucket = "cp-terraform-ngsw-stg"
    key    = "main.tfstate"
    region = "ap-northeast-1"
  }
}