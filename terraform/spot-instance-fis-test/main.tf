# ==============================================================================
# Data Sources
# ==============================================================================

# 最新のAmazon Linux 2023 AMI IDを取得
data "aws_ssm_parameter" "amazon_linux_2023" {
  name = "/aws/service/ami-amazon-linux-latest/al2023-ami-kernel-6.1-x86_64"
}

# Availability Zonesを取得
data "aws_availability_zones" "available" {
  state = "available"
}

# ==============================================================================
# VPC & Network
# ==============================================================================

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_support   = true
  enable_dns_hostnames = true

  tags = {
    Name = "${var.project_name}-vpc"
  }
}

resource "aws_subnet" "private" {
  count             = length(var.private_subnet_cidrs)
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = data.aws_availability_zones.available.names[count.index]

  tags = {
    Name = "${var.project_name}-private-subnet-${count.index + 1}"
  }
}

resource "aws_security_group" "isolated" {
  name_prefix = "${var.project_name}-isolated-"
  description = "Security group for isolated spot instances"
  vpc_id      = aws_vpc.main.id

  # Egressルールなし = 完全隔離

  tags = {
    Name = "${var.project_name}-isolated-sg"
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ==============================================================================
# IAM Roles & Policies
# ==============================================================================

# AWS Chatbot用IAMロール
resource "aws_iam_role" "chatbot" {
  name = "${var.project_name}-chatbot-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "chatbot.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  tags = {
    Name = "${var.project_name}-chatbot-role"
  }
}

resource "aws_iam_role_policy" "chatbot" {
  name = "ChatbotPolicy"
  role = aws_iam_role.chatbot.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "cloudwatch:Describe*",
          "cloudwatch:Get*",
          "cloudwatch:List*"
        ]
        Resource = "*"
      }
    ]
  })
}

# FIS実行用のIAMロール
resource "aws_iam_role" "fis" {
  name = "${var.project_name}-fis-role"
  path = "/service-role/"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Principal = {
          Service = "fis.amazonaws.com"
        }
        Action = "sts:AssumeRole"
      }
    ]
  })

  max_session_duration = 3600

  tags = {
    Name = "${var.project_name}-fis-role"
  }
}

resource "aws_iam_role_policy_attachment" "fis_ec2_access" {
  role       = aws_iam_role.fis.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSFaultInjectionSimulatorEC2Access"
}

resource "aws_iam_role_policy" "fis_cloudwatch_logs" {
  name = "CustomCloudWatchLogsPolicyForFIS"
  role = aws_iam_role.fis.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogDelivery",
          "logs:PutResourcePolicy",
          "logs:DescribeResourcePolicies",
          "logs:DescribeLogGroups"
        ]
        Resource = "*"
      }
    ]
  })
}

# ==============================================================================
# EC2 & Auto Scaling
# ==============================================================================

resource "aws_launch_template" "spot" {
  name_prefix   = "${var.project_name}-"
  image_id      = data.aws_ssm_parameter.amazon_linux_2023.value
  instance_type = "t3.micro"

  vpc_security_group_ids = [aws_security_group.isolated.id]

  tag_specifications {
    resource_type = "instance"

    tags = {
      Name         = var.project_name
      Test         = var.fis_resource_tag_value
      SpotInstance = "true"
    }
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_autoscaling_group" "spot" {
  name                      = "${var.project_name}-asg"
  vpc_zone_identifier       = aws_subnet.private[*].id
  min_size                  = var.asg_min_size
  max_size                  = var.asg_max_size
  desired_capacity          = var.asg_desired_capacity
  health_check_type         = "EC2"
  health_check_grace_period = 300
  capacity_rebalance        = true

  mixed_instances_policy {
    launch_template {
      launch_template_specification {
        launch_template_id = aws_launch_template.spot.id
        version            = "$Latest"
      }

      dynamic "override" {
        for_each = var.spot_instance_types
        content {
          instance_type     = override.value
          weighted_capacity = 1
        }
      }
    }

    instances_distribution {
      on_demand_percentage_above_base_capacity = 0
      spot_allocation_strategy                 = "price-capacity-optimized"
    }
  }

  tag {
    key                 = "Name"
    value               = "${var.project_name}-auto-scaling-group"
    propagate_at_launch = false
  }

  lifecycle {
    create_before_destroy = true
  }
}

# ==============================================================================
# Monitoring & Notifications
# ==============================================================================

resource "aws_sns_topic" "spot_interruption" {
  name         = "spot-interruption-notifications"
  display_name = "Spot Instance Interruption Notifications"

  tags = {
    Name = "${var.project_name}-spot-interruption-topic"
  }
}

resource "aws_sns_topic_policy" "spot_interruption" {
  arn = aws_sns_topic.spot_interruption.arn

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid    = "AllowEventBridgeToPublish"
        Effect = "Allow"
        Principal = {
          Service = "events.amazonaws.com"
        }
        Action   = "SNS:Publish"
        Resource = aws_sns_topic.spot_interruption.arn
      }
    ]
  })
}

resource "aws_cloudwatch_event_rule" "spot_interruption" {
  name        = "spot-interruption-notification-rule"
  description = "EC2スポットインスタンスのリバランス推奨通知と中断警告をSNSに送信するルール"

  event_pattern = jsonencode({
    source = ["aws.ec2"]
    detail-type = [
      "EC2 Instance Rebalance Recommendation",
      "EC2 Spot Instance Interruption Warning"
    ]
  })

  state = "ENABLED"

  tags = {
    Name = "${var.project_name}-spot-interruption-rule"
  }
}

resource "aws_cloudwatch_event_target" "spot_interruption_sns" {
  rule      = aws_cloudwatch_event_rule.spot_interruption.name
  target_id = "SpotInterruptionSNSTarget"
  arn       = aws_sns_topic.spot_interruption.arn
}

resource "aws_cloudwatch_event_rule" "bid_evicted" {
  name        = "spot-bid-evicted-rule"
  description = "AWS側によるスポットインスタンス中断を検知"

  event_pattern = jsonencode({
    source      = ["aws.ec2"]
    detail-type = ["AWS Service Event via CloudTrail"]
    detail = {
      eventName = ["BidEvictedEvent"]
    }
  })

  state = "ENABLED"

  tags = {
    Name = "${var.project_name}-bid-evicted-rule"
  }
}

resource "aws_cloudwatch_event_target" "bid_evicted_sns" {
  rule      = aws_cloudwatch_event_rule.bid_evicted.name
  target_id = "BidEvictedTarget"
  arn       = aws_sns_topic.spot_interruption.arn

  input_transformer {
    input_paths = {
      eventName = "$.detail.eventName"
      time      = "$.time"
      region    = "$.region"
      account   = "$.account"
    }

    input_template = <<-EOT
    {
      "version": "1.0",
      "source": "custom",
      "content": {
        "description": "⚠️ Spot Instance Actually Interrupted\n\nEvent: <eventName>\nAccount: <account>\nRegion: <region>\nTime: <time>\n\nNote: Spot instance was actually interrupted due to AWS resource shortage"
      }
    }
    EOT
  }
}

resource "aws_cloudwatch_log_group" "fis" {
  name              = "${var.project_name}/interrupt-spot-instance-fis"
  retention_in_days = var.cloudwatch_log_retention_days
  log_group_class   = "STANDARD"

  tags = {
    Name = "${var.project_name}-fis-log-group"
  }
}

# ==============================================================================
# AWS Chatbot
# ==============================================================================

resource "aws_chatbot_slack_channel_configuration" "spot_interruption" {
  configuration_name = "spot-interruption-slack-channel"
  slack_team_id      = var.slack_workspace_id
  slack_channel_id   = var.slack_channel_id
  iam_role_arn       = aws_iam_role.chatbot.arn
  sns_topic_arns     = [aws_sns_topic.spot_interruption.arn]
  logging_level      = "INFO"

  tags = {
    Name = "${var.project_name}-chatbot-config"
  }
}

# ==============================================================================
# FIS Experiment Template
# ==============================================================================

resource "aws_fis_experiment_template" "interrupt_spot_instance" {
  description = "interrupt-spot-instance-test"
  role_arn    = aws_iam_role.fis.arn

  action {
    name      = "interruptSpotInstance"
    action_id = "aws:ec2:send-spot-instance-interruptions"

    target {
      key   = "SpotInstances"
      value = "oneSpotInstance"
    }

    parameter {
      key   = "durationBeforeInterruption"
      value = var.fis_interruption_duration
    }
  }

  target {
    name           = "oneSpotInstance"
    resource_type  = "aws:ec2:spot-instance"
    selection_mode = "COUNT(1)"

    resource_tag {
      key   = "Test"
      value = var.fis_resource_tag_value
    }

    filter {
      path   = "State.Name"
      values = ["running"]
    }
  }

  stop_condition {
    source = "none"
  }

  log_configuration {
    cloudwatch_logs_configuration {
      log_group_arn = "${aws_cloudwatch_log_group.fis.arn}:*"
    }
    log_schema_version = 2
  }

  experiment_options {
    empty_target_resolution_mode = "fail"
    account_targeting            = "single-account"
  }

  tags = {
    Name = "${var.project_name}-interrupt-spot-instance-test"
  }
}