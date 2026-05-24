variable "env" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}
variable "cp" {
  type = object({
    cluster_role_arn        = string
    node_role_arn           = string
    node_capacity_type      = string
    node_instance_type      = string
    ebs_csi_driver_role_arn = string
    node_desired_count      = number
  })
}