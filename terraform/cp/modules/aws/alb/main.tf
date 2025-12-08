/************************************************************
CP main ALB
************************************************************/
resource "aws_lb" "cp" {
  name               = "cp-alb-${var.env}"
  idle_timeout       = 120
  internal           = false
  ip_address_type    = "ipv4"
  load_balancer_type = "application"
  security_groups    = var.cp.security_group_ids
  subnets            = var.cp.subnet_ids
}

resource "aws_lb_listener" "cp_https" {
  certificate_arn   = var.cp.certificate_arn
  load_balancer_arn = aws_lb.cp.arn
  port              = 443
  protocol          = "HTTPS"

  default_action {
    order = 1
    type  = "fixed-response"
    fixed_response {
      content_type = "text/plain"
      status_code  = "403"
      message_body = "403 forbidden"
    }
  }
}

resource "aws_lb_listener_rule" "slack_metrics_api" {
  listener_arn = aws_lb_listener.cp_https.arn

  action {
    type             = "forward"
    order            = 1
    target_group_arn = var.cp.target_group_arn_slack_metrics_api
  }

  condition {
    host_header {
      values = [var.cp.slack_metrics_api_host]
    }
  }

  tags = {
    Name = "slack-metrics-api"
  }
}