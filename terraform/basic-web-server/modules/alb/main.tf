resource "aws_lb" "this" {
  name = "basic-web-server-alb"
  load_balancer_type = "application"
  security_groups = [aws_security_group.this.id]
  subnets = var.subnet_ids
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.this.arn
  port = 80
  protocol = "HTTP"

  default_action {
    type = "forward"
    target_group_arn = aws_lb_target_group.this.arn
  }
}

resource "aws_lb_target_group" "this" {
  port = 80
  protocol = "HTTP"
  vpc_id = data.aws_subnet.this.vpc_id
}

resource "aws_lb_target_group_attachment" "this" {
  target_group_arn = aws_lb_target_group.this.arn
  target_id = var.instance_id
}

resource "random_id" "this" {
  byte_length = 8
}

data "aws_subnet" "this" {
  id = var.subnet_ids[0]
}

resource "aws_security_group" "this" {
  vpc_id = data.aws_subnet.this.vpc_id
  name = "basic-web-server-alb-sg-${random_id.this.hex}"
}

resource "aws_security_group_rule" "http" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.this.id
}

resource "aws_security_group_rule" "egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.this.id
}

resource "aws_security_group_rule" "alb_to_instance" {
  type              = "ingress"
  from_port         = 80
  to_port           = 80
  protocol          = "tcp"
  source_security_group_id = aws_security_group.this.id
  security_group_id = var.instance_security_group_id
}
