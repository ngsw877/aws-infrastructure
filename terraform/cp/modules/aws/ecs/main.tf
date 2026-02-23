resource "aws_ecs_cluster" "cp_backend" {
  name = "cp-backend-${var.env}"

  configuration {
    execute_command_configuration {
      logging = "DEFAULT"
    }
  }

  setting {
    name  = "containerInsights"
    value = "disabled"
  }
}

resource "aws_ecs_cluster_capacity_providers" "cp_backend" {
  capacity_providers = ["FARGATE", "FARGATE_SPOT"]
  cluster_name       = aws_ecs_cluster.cp_backend.name
}

resource "aws_ecs_service" "slack_metrics_api" {
  cluster                            = aws_ecs_cluster.cp_backend.arn
  name                               = var.slack_metrics_api.name
  task_definition                    = var.slack_metrics_api.task_definition
  desired_count                      = 1
  enable_execute_command             = var.slack_metrics_api.enable_execute_command
  enable_ecs_managed_tags            = true
  health_check_grace_period_seconds  = 0
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  capacity_provider_strategy {
    base              = 0
    capacity_provider = var.slack_metrics_api.capacity_provider
    weight            = 1
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_controller {
    type = "ECS"
  }
  dynamic "load_balancer" {
    for_each = var.slack_metrics_api.target_group_arn != null ? [1] : []
    content {
      container_name   = "api"
      container_port   = 8080
      target_group_arn = var.slack_metrics_api.target_group_arn
    }
  }
  network_configuration {
    assign_public_ip = false
    security_groups  = var.slack_metrics_api.security_group_ids
    subnets          = var.slack_metrics_api.subnet_ids
  }
  lifecycle {
    ignore_changes = [
      # MEMO: コスト削減で落とすタイミングがあるため
      desired_count,
      # MEMO: ecspressoからタスク定義のリビジョンを更新するため
      task_definition,
    ]
  }
}

resource "aws_appautoscaling_target" "slack_metrics_api" {
  service_namespace  = "ecs"
  resource_id        = "service/${aws_ecs_cluster.cp_backend.name}/${var.slack_metrics_api.name}"
  scalable_dimension = "ecs:service:DesiredCount"
  min_capacity       = 1
  max_capacity       = 2
  depends_on         = [aws_ecs_service.slack_metrics_api]
}

resource "aws_appautoscaling_policy" "slack_metrics_api_cpu" {
  name               = "target-tracking-cpu"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.slack_metrics_api.resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  target_tracking_scaling_policy_configuration {
    disable_scale_in   = false
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
    target_value       = 70

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageCPUUtilization"
    }
  }
}

resource "aws_appautoscaling_policy" "slack_metrics_api_memory" {
  name               = "target-tracking-memory"
  policy_type        = "TargetTrackingScaling"
  resource_id        = aws_appautoscaling_target.slack_metrics_api.resource_id
  scalable_dimension = "ecs:service:DesiredCount"
  service_namespace  = "ecs"

  target_tracking_scaling_policy_configuration {
    disable_scale_in   = false
    scale_out_cooldown = 60
    scale_in_cooldown  = 300
    target_value       = 70

    predefined_metric_specification {
      predefined_metric_type = "ECSServiceAverageMemoryUtilization"
    }
  }
}

/************************************************************
Datadogコースで使用 cost-api用のECS Service
************************************************************/
resource "aws_ecs_service" "cost_api" {
  count                              = var.cost_api != null ? 1 : 0
  cluster                            = aws_ecs_cluster.cp_backend.arn
  name                               = "cost-api-${var.env}"
  task_definition                    = var.cost_api.task_definition
  desired_count                      = 1
  enable_execute_command             = false
  enable_ecs_managed_tags            = true
  health_check_grace_period_seconds  = 0
  deployment_maximum_percent         = 200
  deployment_minimum_healthy_percent = 100
  capacity_provider_strategy {
    base              = 0
    capacity_provider = var.cost_api.capacity_provider
    weight            = 1
  }
  deployment_circuit_breaker {
    enable   = true
    rollback = true
  }
  deployment_controller {
    type = "ECS"
  }
  dynamic "load_balancer" {
    for_each = var.cost_api.target_group_arn != null ? [1] : []
    content {
      container_name   = "cost-aggregator"
      container_port   = 8080
      target_group_arn = var.cost_api.target_group_arn
    }
  }
  network_configuration {
    assign_public_ip = false
    security_groups  = var.cost_api.security_group_ids
    subnets          = var.cost_api.subnet_ids
  }
  lifecycle {
    ignore_changes = [
      # MEMO: コスト削減で落とすタイミングがあるため
      desired_count,
      # MEMO: マネジメントコンソールからタスク定義のリビジョンを更新するため
      task_definition,
    ]
  }
}
