variable "subnet_group_name" {
  type        = string
  description = "DBサブネットグループ名"
}
variable "family" {
  type        = string
  description = "エンジンバージョン"
}
variable "parameter_group_name" {
  type        = string
  description = "DBパラメータグループ名"
}
variable "engine_version" {
  type        = string
  description = "エンジンバージョン"
}
variable "identifier" {
  type        = string
  description = "RDSインスタンス名"
}
variable "db_name" {
  type        = string
  description = "DB名"
}
variable "instance_class" {
  type        = string
  description = "RDSインスタンスクラス"
}
variable "security_group_ids" {
  type        = list(string)
  description = "RDSインスタンスに紐づけるセキュリティグループID"
}
variable "private_subnet_ids" {
  type        = list(string)
  description = "RDSインスタンスに紐づけるプライベートサブネットIDs"
}
variable "iam_database_authentication_enabled" {
  type        = bool
  description = "IAMデータベース認証を有効にするかどうか"
  default     = false
}