variable "env" {
  type = string
}
variable "public_subnet_id" {
  type = string
}

variable "bastion" {
  type = object({
    # デフォルト値は、Amazon Linux 2023 の AMI ID
    ami_id = optional(string, "ami-03852a41f1e05c8e4")
    iam_instance_profile = string
    security_group_id    = string
    volume_size          = optional(number, 8)
  })
}