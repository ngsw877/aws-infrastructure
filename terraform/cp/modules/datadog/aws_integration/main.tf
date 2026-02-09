resource "datadog_integration_aws_account" "datadog_integration" {
  account_tags   = []
  aws_account_id = var.aws_account_id
  aws_partition  = "aws"
  aws_regions {
    include_all = true
  }
  auth_config {
    aws_auth_config_role {
      role_name = "DatadogIntegrationRole"
    }
  }
  resources_config {
    cloud_security_posture_management_collection = false
    extended_collection                          = false
  }
  traces_config {
    xray_services {
    }
  }
  logs_config {
    lambda_forwarder {
    }
  }
  metrics_config {
    namespace_filters {
      // MEMO: EC2, RDS, ECS以外は無効化
      exclude_only = [
        "AWS/ApiGateway",
        "AWS/AppRunner",
        "AWS/AppStream",
        "AWS/AppSync",
        "AWS/Athena",
        "AWS/AutoScaling",
        "AWS/Backup",
        "AWS/Bedrock",
        "AWS/Billing",
        "AWS/CertificateManager",
        "AWS/CloudFront",
        "AWS/CloudHSM",
        "AWS/CloudSearch",
        "AWS/Events",
        "AWS/EventBridge/Pipes",
        "AWS/Scheduler",
        "AWS/CodeBuild",
        "AWS/CodeWhisperer",
        "AWS/Cognito",
        "AWS/Config",
        "AWS/Connect",
        "AWS/DX",
        "AWS/DMS",
        "AWS/DocDB",
        "AWS/DynamoDB",
        "AWS/DAX",
        "AWS/EBS",
        "AWS/EC2/API",
        "AWS/EC2Spot",
        "AWS/ECR",
        "AWS/EFS",
        "AWS/ElastiCache",
        "AWS/ElasticBeanstalk",
        "AWS/ElasticTranscoder",
        "AWS/ElasticMapReduce",
        "AWS/ES",
        "AWS/Firehose",
        "AWS/FSx",
        "AWS/GameLift",
        "AWS/GlobalAccelerator",
        "Glue",
        "AWS/Inspector",
        "AWS/IoT",
        "AWS/Cassandra",
        "AWS/Kinesis",
        "AWS/KinesisAnalytics",
        "AWS/KMS",
        "AWS/Lex",
        "AWS/MediaConnect",
        "AWS/MediaConvert",
        "AWS/MediaLive",
        "AWS/MediaPackage",
        "AWS/MediaStore",
        "AWS/MediaTailor",
        "AWS/MemoryDB",
        "AWS/ML",
        "AWS/AmazonMQ",
        "AWS/Kafka",
        "AmazonMWAA",
        "AWS/NATGateway",
        "AWS/Neptune",
        "AWS/EC2/InfrastructurePerformance",
        "AWS/Network Manager",
        "AWS/NetworkFirewall",
        "AWS/NetworkMonitor",
        "AWS/AOSS",
        "AWS/PCS",
        "AWS/Polly",
        "AWS/PrivateLinkServices",
        "AWS/PrivateLinkEndpoints",
        "AWS/RDS/Proxy",
        "AWS/Redshift",
        "AWS/Rekognition",
        "AWS/Route53",
        "AWS/Route53Resolver",
        "AWS/S3",
        "AWS/S3/Storage-Lens",
        "AWS/SageMaker",
        "/aws/sagemaker/Endpoints",
        "AWS/Sagemaker/LabelingJobs",
        "AWS/Sagemaker/ModelBuildingPipeline",
        "/aws/sagemaker/ProcessingJobs",
        "/aws/sagemaker/TrainingJobs",
        "/aws/sagemaker/TransformJobs",
        "AWS/SageMaker/Workteam",
        "AWS/SES",
        "AWS/DDoSProtection",
        "AWS/SNS",
        "AWS/States",
        "AWS/StorageGateway",
        "AWS/SWF",
        "AWS/Textract",
        "AWS/TransitGateway",
        "AWS/Translate",
        "AWS/TrustedAdvisor",
        "AWS/VPN",
        "WAF",
        "AWS/WAFV2",
        "AWS/WorkSpaces",
        "AWS/X-Ray",
        "AWS/ApplicationELB",
        "AWS/ELB",
        "AWS/NetworkELB",
        "AWS/Lambda",
        "AWS/SQS",
        "AWS/Budgeting",
        "AWS/Logs",
        "AWS/ElasticInference",
        "AWS/Usage",
      ]
    }
  }
}
