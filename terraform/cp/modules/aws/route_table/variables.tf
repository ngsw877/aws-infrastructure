variable "env" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "internet_gateway_id" {
  type = string
}

variable "nat_gateway_id" {
  type = string
}

variable "public_subnets" {
  description = "Map of public subnet IDs (key: subnet name, value: subnet ID)"
  type        = list(string)
}

variable "private_subnets" {
  description = "Map of private subnet IDs (key: subnet name, value: subnet ID)"
  type        = list(string)
}
