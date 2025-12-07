/************************************************************
ECSタスク db-migrator
************************************************************/
resource "aws_iam_role" "cp_db_migrator" {
  name = "cp-db-migrator-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })
}

/************************************************************
EC2 bastion
************************************************************/
resource "aws_iam_role" "cp_bastion" {
  name = "cp-bastion-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cp_bastion" {
  for_each = {
    ssm_core = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }
  role       = aws_iam_role.cp_bastion.name
  policy_arn = each.value
}

resource "aws_iam_instance_profile" "cp_bastion_profile" {
  name = "cp-bastion-${var.env}"
  role = aws_iam_role.cp_bastion.name
}

/************************************************************
ECS Task Execution Role
************************************************************/
resource "aws_iam_role" "ecs_task_execution" {
  name = "ecs-task-execution-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "ecs_task_execution" {
  for_each = {
    task_execution  = "arn:aws:iam::aws:policy/service-role/AmazonECSTaskExecutionRolePolicy"
    s3              = "arn:aws:iam::aws:policy/AmazonS3ReadOnlyAccess"
    cloudwatch      = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
    secrets_manager = aws_iam_policy.secrets_manager_read.arn
  }
  role       = aws_iam_role.ecs_task_execution.name
  policy_arn = each.value
}

/************************************************************
slack-metrics-backend
************************************************************/
resource "aws_iam_role" "cp_slack_metrics_backend" {
  name = "cp-slack-metrics-backend-${var.env}"
  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ecs-tasks.amazonaws.com"
        }
      },
    ]
  })
}

resource "aws_iam_role_policy_attachment" "cp_slack_metrics_backend" {
  for_each = {
    cloudwatch = "arn:aws:iam::aws:policy/CloudWatchLogsFullAccess"
    ssm_core   = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
  }
  role       = aws_iam_role.cp_slack_metrics_backend.name
  policy_arn = each.value
}
