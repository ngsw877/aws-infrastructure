terraform {
  required_version = "~> 1.11.0" // 1.11.0 以上 1.12.0 未満 を許容

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 6.5.0" // 6.5.0 以上 6.6.0 未満 を許容
    }
  }
}

provider "aws" {
  region  = "ap-northeast-1"
  profile = "study"

  default_tags {
    tags = {
      Env = "stg"
    }
  }
}

provider "aws" {
  region  = "us-east-1"
  profile = "study"
  alias   = "us_east_1"

  default_tags {
    tags = {
      Env = "stg"
    }
  }
}
