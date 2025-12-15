data "aws_eks_cluster" "cp" {
  name = "cp-${var.env}"
}