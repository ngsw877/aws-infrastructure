resource "aws_eks_cluster" "cp" {
  # クラスター設定
  name                          = "cp-${var.env}"
  role_arn                      = var.cp.cluster_role_arn
  bootstrap_self_managed_addons = false

  # Kubernetes バージョン設定
  version = "1.33"
  upgrade_policy {
    support_type = "STANDARD"
  }

  # クラスターアクセス
  access_config {
    # クラスター管理者アクセスを許可
    bootstrap_cluster_creator_admin_permissions = true
    # クラスター認証モード
    authentication_mode = "API"
  }

  # ARCゾーンシフト
  zonal_shift_config {
    enabled = false
  }

  # ネットワーキング
  vpc_config {
    subnet_ids              = var.private_subnet_ids
    public_access_cidrs     = ["0.0.0.0/0"]
    endpoint_private_access = true
    endpoint_public_access  = true
  }
  kubernetes_network_config {
    ip_family         = "ipv4"
    service_ipv4_cidr = "172.20.0.0/16"
    elastic_load_balancing {
      enabled = false
    }
  }

  # コントロールプレーンのログ
  enabled_cluster_log_types = []
}

resource "aws_eks_node_group" "cp" {
  cluster_name    = aws_eks_cluster.cp.name
  node_group_name = "cp-app-${var.env}"
  node_role_arn   = var.cp.node_role_arn

  subnet_ids = var.private_subnet_ids
  scaling_config {
    desired_size = var.cp.node_desired_count
    min_size     = 0
    max_size     = var.cp.node_desired_count
  }

  ami_type       = "AL2023_x86_64_STANDARD"
  capacity_type  = var.cp.node_capacity_type
  instance_types = [var.cp.node_instance_type]

  disk_size = 20

  # ノード自動修復を無効化
  update_config {
    max_unavailable = 1
  }
}
