resource "aws_lb_target_group" "slack_metrics_api" {
  vpc_id               = var.vpc_id
  name                 = "slack-metrics-api-${var.env}"
  deregistration_delay = "115"
  port                 = 80
  protocol             = "HTTP"
  target_type          = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 3
    interval            = 10
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}

/************************************************************
Datadogコースで使用
************************************************************/
resource "aws_lb_target_group" "cost_api" {
  vpc_id               = var.vpc_id
  name                 = "cost-api-${var.env}"
  deregistration_delay = "115"
  port                 = 80
  protocol             = "HTTP"
  target_type          = "ip"

  health_check {
    enabled             = true
    healthy_threshold   = 3
    interval            = 10
    matcher             = "200"
    path                = "/api/health"
    port                = "traffic-port"
    protocol            = "HTTP"
    timeout             = 5
    unhealthy_threshold = 2
  }
}
