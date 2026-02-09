variable "env" {
  type = string
}

locals {
  // EKSのPod Identityを使うためのStatement
  pod_identity_statement = {
    Effect = "Allow"
    Principal = {
      Service = "pods.eks.amazonaws.com"
    }
    Action = [
      "sts:AssumeRole",
      "sts:TagSession"
    ]
  }
}

variable "datadog_aws_integration_external_id" {
  type    = string
  default = null
}
