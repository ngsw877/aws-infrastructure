variable "function_name" {
  description = "Lambda function name"
  type        = string
}

variable "source_dir" {
  description = "Source code directory path"
  type        = string
}

variable "build_dir" {
  description = "Build directory path for zip files"
  type        = string
}

variable "role_arn" {
  description = "IAM role ARN for Lambda function"
  type        = string
}

variable "tags" {
  description = "Tags to apply to the Lambda function"
  type        = map(string)
  default     = {}
}