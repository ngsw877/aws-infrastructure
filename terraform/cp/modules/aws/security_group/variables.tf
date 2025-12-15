variable "env" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "security_group_id_cp_k8s_cluster" {
  type    = string
  default = null
}

locals {
  default_egress = [
    {
      description = ""
      cidr_blocks = ["0.0.0.0/0"]
      protocol    = "-1"
      from_port   = 0
      to_port     = 0
      ipv6_cidr_blocks = []
      prefix_list_ids = []
      security_groups = []
      self        = false
    }
  ]
}