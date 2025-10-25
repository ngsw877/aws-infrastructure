variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-northeast-1"
}

variable "project_name" {
  description = "Project name used for resource naming"
  type        = string
  default     = "spot-instance-fis-test"
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24"]
}

variable "slack_workspace_id" {
  description = "Slack Workspace ID for AWS Chatbot"
  type        = string
}

variable "slack_channel_id" {
  description = "Slack Channel ID for notifications"
  type        = string
}

variable "fis_resource_tag_value" {
  description = "Tag value for FIS experiment to target specific instances"
  type        = string
  default     = "interrupt-me"
}

variable "asg_min_size" {
  description = "Minimum size of Auto Scaling Group"
  type        = number
  default     = 1
}

variable "asg_max_size" {
  description = "Maximum size of Auto Scaling Group"
  type        = number
  default     = 2
}

variable "asg_desired_capacity" {
  description = "Desired capacity of Auto Scaling Group"
  type        = number
  default     = 1
}

variable "spot_instance_types" {
  description = "List of instance types for spot instances"
  type        = list(string)
  default     = ["t3.micro", "t3a.micro", "t4g.micro", "t2.micro"]
}

variable "fis_interruption_duration" {
  description = "Duration before spot instance interruption in FIS experiment (e.g., PT3M for 3 minutes)"
  type        = string
  default     = "PT3M"
}

variable "cloudwatch_log_retention_days" {
  description = "CloudWatch Logs retention period in days"
  type        = number
  default     = 7
}