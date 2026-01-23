resource "aws_security_group" "alb_cp" {
  name        = "cp-alb-${var.env}"
  description = "cp-alb-${var.env}"
  vpc_id      = var.vpc_id
  egress = local.default_egress
  ingress = [
    {
      cidr_blocks = ["0.0.0.0/0"]
      description = ""
      protocol    = "tcp"
      from_port   = 443
      to_port     = 443
      ipv6_cidr_blocks = []
      prefix_list_ids = []
      security_groups = []
      self        = false
    }
  ]
}

resource "aws_security_group" "bastion" {
  name        = "cp-bastion-${var.env}"
  description = "cp-bastion-${var.env}"
  vpc_id      = var.vpc_id
  egress = local.default_egress
  ingress = []
}

resource "aws_security_group" "slack_metrics_backend" {
  name        = "slack-metrics-backend-${var.env}"
  description = "slack-metrics-backend-${var.env}"
  vpc_id      = var.vpc_id
  egress = local.default_egress
  ingress = [
    {
      cidr_blocks = []
      description = ""
      protocol    = "tcp"
      from_port   = 8080
      to_port     = 8080
      ipv6_cidr_blocks = []
      prefix_list_ids = []
      security_groups = [
        aws_security_group.alb_cp.id
      ]
      self = false
    }
  ]
}

resource "aws_security_group" "db_migrator" {
  name        = "cp-db-migrator-${var.env}"
  description = "cp-db-migrator-${var.env}"
  vpc_id      = var.vpc_id
  egress = local.default_egress
  ingress = []
}

resource "aws_security_group" "db" {
  name        = "cp-db-${var.env}"
  description = "cp-db-${var.env}"
  vpc_id      = var.vpc_id
  egress = local.default_egress
  ingress = [
    {
      cidr_blocks = []
      description = ""
      protocol    = "tcp"
      from_port   = 5432
      to_port     = 5432
      ipv6_cidr_blocks = []
      prefix_list_ids = []
      security_groups = compact([
        aws_security_group.bastion.id,
        aws_security_group.slack_metrics_backend.id,
        aws_security_group.db_migrator.id,
        var.security_group_id_cp_k8s_cluster
      ])
      self = false
    }
  ]
}

resource "aws_security_group" "nat" {
  name = "cp-nat-${var.env}"
  tags = {
    "Name" = "cp-nat-${var.env}"
  }
  vpc_id = var.vpc_id
}

resource "aws_vpc_security_group_ingress_rule" "nat" {
  for_each = toset(var.private_subnet_cidr_blocks)

  security_group_id = aws_security_group.nat.id
  description       = "Allow traffic from private subnets"
  cidr_ipv4         = each.value
  ip_protocol       = "-1"
}

resource "aws_vpc_security_group_egress_rule" "nat" {
  security_group_id = aws_security_group.nat.id
  cidr_ipv4         = "0.0.0.0/0"
  ip_protocol       = "-1"
}