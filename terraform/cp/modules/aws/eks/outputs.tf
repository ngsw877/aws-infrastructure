output "cp_cluster_security_group_id" {
  value = aws_eks_cluster.cp.vpc_config[0].cluster_security_group_id
}