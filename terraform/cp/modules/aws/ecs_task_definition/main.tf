/************************************************************
slack metrics api
************************************************************/
resource "aws_ecs_task_definition" "slack_metrics_api" {
  family                   = "slack-metrics-api-${var.env}"
  cpu                      = var.ecs_task_specs.slack_metrics_api.cpu
  memory                   = var.ecs_task_specs.slack_metrics_api.memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn_slack_metrics
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]

  container_definitions = jsonencode([
    {
      name      = "api"
      image     = var.ecr_url_slack_metrics
      essential = true
      portMappings = [
        {
          hostPort      = 8080
          containerPort = 8080
        }
      ]
      secrets = [
        {
          name      = "POSTGRES_MAIN_HOST"
          valueFrom = "${var.secrets_manager_arn_db_main_instance}:host::"
        },
        {
          name      = "POSTGRES_MAIN_USER"
          valueFrom = "${var.secrets_manager_arn_db_main_instance}:slack_metrics_user::"
        },
        {
          name      = "POSTGRES_MAIN_PASSWORD"
          valueFrom = "${var.secrets_manager_arn_db_main_instance}:slack_metrics_password::"
        },
      ]
      environmentFiles = [
        {
          type  = "s3"
          value = "${var.arn_cp_config_bucket}/slack-metrics-${var.env}.env"
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/api/health || exit 1"]
        interval    = 30
        timeout     = 5
        startPeriod = 0
        retries     = 3
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-create-group  = "true"
          awslogs-group         = "/ecs/slack-metrics-api-${var.env}"
          awslogs-stream-prefix = "ecs"
          awslogs-region        = "ap-northeast-1"
        }
      }
      readonlyRootFilesystem = true
    },
  ])
  lifecycle {
    ignore_changes = [container_definitions]
  }
}

/************************************************************
DB Migration
************************************************************/
resource "aws_ecs_task_definition" "db_migrator" {
  family                   = "db-migrator-${var.env}"
  cpu                      = var.ecs_task_specs.db_migrator.cpu
  memory                   = var.ecs_task_specs.db_migrator.memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn_db_migrator
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]

  container_definitions = jsonencode([
    {
      name      = "app"
      image     = var.ecr_url_db_migrator
      essential = true
      secrets = [
        {
          name      = "DB_HOST"
          valueFrom = "${var.secrets_manager_arn_db_main_instance}:host::"
        },
        {
          name      = "DB_USER"
          valueFrom = "${var.secrets_manager_arn_db_main_instance}:operator_user::"
        },
        {
          name      = "DB_PASSWORD"
          valueFrom = "${var.secrets_manager_arn_db_main_instance}:operator_password::"
        },
      ]
      environmentFiles = [
        {
          type  = "s3"
          value = "${var.arn_cp_config_bucket}/db-migrator-${var.env}.env"
        }
      ]
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-create-group  = "true"
          awslogs-group         = "/ecs/db-migrator-${var.env}"
          awslogs-stream-prefix = "ecs"
          awslogs-region        = "ap-northeast-1"
        }
      }
      readonlyRootFilesystem = true
    }
  ])
  lifecycle {
    ignore_changes = [container_definitions]
  }
}

/************************************************************
cost-api (Datadogコースで使用)
************************************************************/
resource "aws_ecs_task_definition" "cost_api" {
  family                   = "cost-api-${var.env}"
  cpu                      = var.ecs_task_specs.cost_api.cpu
  memory                   = var.ecs_task_specs.cost_api.memory
  execution_role_arn       = var.ecs_task_execution_role_arn
  task_role_arn            = var.ecs_task_role_arn_cost_api
  network_mode             = "awsvpc"
  requires_compatibilities = ["FARGATE"]
  runtime_platform {
    cpu_architecture        = "X86_64"
    operating_system_family = "LINUX"
  }

  container_definitions = jsonencode([
    {
      name      = "cost-aggregator"
      image     = var.ecr_url_cost_aggregator
      essential = true
      cpu       = 102
      memory    = 614
      portMappings = [
        {
          appProtocol   = "http"
          containerPort = 8080
          hostPort      = 8080
          name          = "http"
          protocol      = "tcp"
        }
      ]
      environmentFiles = [
        {
          type  = "s3"
          value = "${var.arn_cp_config_bucket}/cost-aggregator-${var.env}.env"
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "curl -f http://localhost:8080/api/health || exit 1"]
        interval    = 30
        retries     = 3
        startPeriod = 0
        timeout     = 5
      }
      logConfiguration = {
        logDriver = "awsfirelens"
        options = {
          dd_message_key = "msg"
          provider       = "ecs"
          dd_service     = "cost-aggregator"
          Host           = "http-intake.logs.ap1.datadoghq.com"
          TLS            = "ON"
          dd_source      = "ecs"
          dd_tags        = "service:cost-aggregator,env:${var.env}"
          Name           = "datadog"
        }
        secretOptions = [
          {
            name      = "apikey"
            valueFrom = "${var.secrets_manager_arn_datadog_keys}:api_key::"
          }
        ]
      }
      readonlyRootFilesystem = false
    },
    {
      name      = "cost-provider"
      image     = var.ecr_url_cost_provider
      essential = true
      cpu       = 102
      memory    = 614
      portMappings = [
        {
          appProtocol   = "grpc"
          containerPort = 50051
          hostPort      = 50051
          name          = "grpc"
          protocol      = "tcp"
        }
      ]
      environmentFiles = [
        {
          type  = "s3"
          value = "${var.arn_cp_config_bucket}/cost-provider-${var.env}.env"
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "ps aux | grep main | grep -v grep || exit 1"]
        interval    = 30
        retries     = 3
        startPeriod = 0
        timeout     = 5
      }
      logConfiguration = {
        logDriver = "awsfirelens"
        options = {
          dd_message_key = "msg"
          provider       = "ecs"
          dd_service     = "cost-provider"
          Host           = "http-intake.logs.ap1.datadoghq.com"
          TLS            = "on"
          dd_source      = "ecs"
          dd_tags        = "service:cost-provider,env:${var.env}"
          Name           = "datadog"
        }
        secretOptions = [
          {
            name      = "apikey"
            valueFrom = "${var.secrets_manager_arn_datadog_keys}:api_key::"
          }
        ]
      }
    },
    {
      name      = "datadog-agent"
      image     = "public.ecr.aws/datadog/agent:latest"
      essential = true
      cpu       = 102
      memory    = 512
      environmentFiles = [
        {
          type  = "s3"
          value = "${var.arn_cp_config_bucket}/datadog-agent-${var.env}.env"
        }
      ]
      healthCheck = {
        command     = ["CMD-SHELL", "agent health"]
        interval    = 30
        retries     = 3
        startPeriod = 15
        timeout     = 5
      }
      logConfiguration = {
        logDriver = "awslogs"
        options = {
          awslogs-group         = "/ecs/cost-api-${var.env}"
          awslogs-create-group  = "true"
          awslogs-region        = "ap-northeast-1"
          awslogs-stream-prefix = "ecs"
        }
        secretOptions = []
      }
      secrets = [
        {
          name      = "DD_API_KEY"
          valueFrom = "${var.secrets_manager_arn_datadog_keys}:api_key::"
        }
      ]
    },
    {
      name              = "log-router"
      image             = "public.ecr.aws/aws-observability/aws-for-fluent-bit:stable"
      essential         = true
      cpu               = 0
      memoryReservation = 51
      user              = "0"
      firelensConfiguration = {
        type = "fluentbit"
        options = {
          config-file-type        = "file"
          config-file-value       = "/fluent-bit/configs/parse-json.conf"
          enable-ecs-log-metadata = "true"
        }
      }
    }
  ])
  lifecycle {
    ignore_changes = [container_definitions]
  }
}
