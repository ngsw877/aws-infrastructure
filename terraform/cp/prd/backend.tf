terraform {
  backend "s3" {
    bucket  = "cp-terraform-ngsw-prd"
    key     = "main.tfstate"
    region  = "ap-northeast-1"
    profile = "cp-terraform-prd"
  }
}
