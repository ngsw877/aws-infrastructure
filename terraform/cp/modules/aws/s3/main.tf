module "cp_config" {
  source  = "terraform-aws-modules/s3-bucket/aws"
  version = "5.7.0"
  bucket  = "cp-ngsw-config-${var.env}"
  versioning = {
    enabled = true
  }
  server_side_encryption_configuration = {
    rule = {
      apply_server_side_encryption_by_default = {
        sse_algorithm = "AES256"
      }
      bucket_key_enabled = true
    }
  }
}