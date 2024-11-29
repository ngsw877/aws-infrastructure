import {
  Duration,
  Stack,
  PhysicalName,
  RemovalPolicy,
  aws_ec2 as ec2,
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_route53_targets as targets,
  aws_certificatemanager as acm,
  aws_elasticloadbalancingv2 as elbv2,
  aws_ecs as ecs,
  aws_s3 as s3,
  aws_iam as iam,
  aws_applicationautoscaling as applicationautoscaling,
  aws_cloudwatch as cloudwatch,
  aws_ecr as ecr,
  aws_logs as logs,
  region_info as ri,
  aws_kms as kms,
  aws_kinesisfirehose as firehose,
  aws_ssm as ssm,
  aws_cloudformation as cfn,
  aws_scheduler as scheduler,
  CfnOutput,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";
import type { MainStackProps } from "../types/params";

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    if (!props.cloudfrontCertificate || !props.hostedZone) {
      throw new Error(
        "GlobalStackから取得した、cloudfrontCertificateとhostedZoneの両方が必須です。",
      );
    }

    const appDomain = props.hostedZone.zoneName;
    const apiDomain = `api.${appDomain}`;

    new CfnOutput(this, "FrontendAppUrl", {
      value: `https://${appDomain}`,
    });
    new CfnOutput(this, "BackendApiUrl", {
      value: `https://${apiDomain}`,
    });

    // 集約ログ用S3バケット
    const logsBucket = new s3.Bucket(this, "LogsBucket", {
      lifecycleRules: [
        {
          id: "log-expiration",
          enabled: true,
          expiration: Duration.days(
            props?.logRetentionDays ?? logs.RetentionDays.THREE_MONTHS,
          ),
        },
      ],
      accessControl: s3.BucketAccessControl.PRIVATE,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    /*************************************
     * ネットワークリソース
     *************************************/
    // VPCとサブネット
    const vpc = new ec2.Vpc(this, "Vpc", {
      maxAzs: 2,
      subnetConfiguration: [
        {
          cidrMask: 24,
          name: "Public",
          subnetType: ec2.SubnetType.PUBLIC,
        },
        {
          cidrMask: 24,
          name: "Private",
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
        },
      ],
      natGateways: props.natGatewaysCount,
    });

    /*************************************
     * フロントエンド用リソース
     *************************************/
    // フロントエンド用S3バケット
    const frontendBucket = new s3.Bucket(this, "FrontendBucket", {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // アップロードされたファイル用S3バケット
    const uploadedFilesBucket = new s3.Bucket(this, "UploadedFilesBucket", {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // CloudFrontログ用S3バケット
    const cloudFrontLogsBucket = new s3.Bucket(this, "CloudFrontLogsBucket", {
      lifecycleRules: [
        {
          id: "cloudfront-logs-expiration",
          enabled: true,
          expiration: Duration.days(
            props?.logRetentionDays ?? logs.RetentionDays.THREE_MONTHS,
          ),
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      accessControl: s3.BucketAccessControl.LOG_DELIVERY_WRITE,
    });

    // CloudFrontFunction Frontendリクエスト用
    const frontendIndexPageFunction = new cloudfront.Function(
      this,
      "FrontendIndexPageFunction",
      {
        functionName: `${this.stackName}-FrontendIndexPageFunction`,
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        code: cloudfront.FunctionCode.fromFile({
          filePath: "cloudfront-functions/FrontendIndexPageFunction.js",
        }),
      },
    );

    // CloudFront Function レスポンスセキュリティヘッダー設定用
    const frontendHttpSecurityHeaderFunction = new cloudfront.Function(
      this,
      "FrontendHttpSecurityHeaderFunction",
      {
        functionName: `${this.stackName}-FrontendHttpSecurityHeaderFunction`,
        runtime: cloudfront.FunctionRuntime.JS_2_0,
        code: cloudfront.FunctionCode.fromFile({
          filePath: "cloudfront-functions/FrontendHttpSecurityHeaderFunction.js",
        }),
      },
    );

    // フロントエンド用CloudFront
    const frontendCloudFront = new CloudFrontToS3(this, "FrontendCloudFront", {
      existingBucketObj: frontendBucket,
      cloudFrontDistributionProps: {
        certificate: props.cloudfrontCertificate,
        domainNames: [appDomain],
        webAclId: props.cloudFrontWebAcl?.attrArn,
        defaultBehavior: {
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              function: frontendIndexPageFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
            {
              function: frontendHttpSecurityHeaderFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_RESPONSE,
            },
          ],
          // オリジンリクエストポリシー
          originRequestPolicy: new cloudfront.OriginRequestPolicy(
            this,
            "FrontendOriginRequestPolicy",
            {
              originRequestPolicyName: `${this.stackName}-FrontendOriginRequestPolicy`,
              comment: "FrontendOriginRequestPolicy",
            },
          ),
          // キャッシュポリシー
          cachePolicy: new cloudfront.CachePolicy(this, "FrontendCachePolicy", {
            cachePolicyName: `${this.stackName}-FrontendCachePolicy`,
            comment: "FrontendCachePolicy",
            // キャッシュ期間
            defaultTtl: props.defaultTtl,
            maxTtl: props.maxTtl,
            minTtl: props.minTtl,
            // 圧縮サポート
            enableAcceptEncodingBrotli: true,
            enableAcceptEncodingGzip: true,
          }),
        },
        priceClass: cloudfront.PriceClass.PRICE_CLASS_200,
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        logBucket: cloudFrontLogsBucket,
        logFilePrefix: "FrontendCloudFront/",
        defaultRootObject: "index.html",
        errorResponses: [
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: Duration.seconds(10),
          },
        ],
      },
    });

    // フロントエンド用CloudFrontのエイリアスレコード
    new route53.ARecord(this, "CloudFrontAliasRecord", {
      zone: props.hostedZone,
      recordName: appDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.CloudFrontTarget(
          frontendCloudFront.cloudFrontWebDistribution,
        ),
      ),
    });

    /*************************************
     * バックエンド用リソース
     *************************************/
    // ALB用ACM証明書
    const albCertificate = new acm.Certificate(this, "AlbCertificate", {
      certificateName: `${this.stackName}-alb-certificate`,
      domainName: appDomain,
      subjectAlternativeNames: [`*.${appDomain}`],
      validation: acm.CertificateValidation.fromDns(props.hostedZone),
    });

    // ALBセキュリティグループ
    const backendAlbSecurityGroup = new ec2.SecurityGroup(
      this,
      "BackendAlbSecurityGroup",
      {
        vpc,
        description: "Security group for Backend ALB",
        allowAllOutbound: true,
      },
    );

    // ALB
    const backendAlb = new elbv2.ApplicationLoadBalancer(this, "BackendAlb", {
      vpc,
      internetFacing: true,
      dropInvalidHeaderFields: true,
      securityGroup: backendAlbSecurityGroup,
      vpcSubnets: vpc.selectSubnets({
        subnetGroupName: "Public",
      }),
    });

    // logsBucketおよびバケットポリシーの作成が完了してからALBを作成する（でないと権限エラーになりスタックデプロイに失敗する）
    backendAlb.node.addDependency(logsBucket);

    // ALBアクセスログ用S3バケットの設定
    backendAlb.setAttribute("access_logs.s3.enabled", "true");
    backendAlb.setAttribute("access_logs.s3.bucket", logsBucket.bucketName);

    // Permissions for Access Logging
    //    Why don't use alb.logAccessLogs(albLogBucket); ?
    //    Because logAccessLogs method adds wider permission to other account (PutObject*). S3 will become Noncompliant on Security Hub [S3.6]
    //    See: https://docs.aws.amazon.com/securityhub/latest/userguide/securityhub-standards-fsbp-controls.html#fsbp-s3-6
    //    See: https://docs.aws.amazon.com/elasticloadbalancing/latest/application/load-balancer-access-logs.html#access-logging-bucket-permissions
    logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:PutObject"],
        // ALB access logging needs S3 put permission from ALB service account for the region
        principals: [
          new iam.AccountPrincipal(
            ri.RegionInfo.get(Stack.of(this).region).elbv2Account,
          ),
        ],
        resources: [
          logsBucket.arnForObjects(`AWSLogs/${Stack.of(this).account}/*`),
        ],
      }),
    );
    logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:PutObject"],
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
        resources: [
          logsBucket.arnForObjects(`AWSLogs/${Stack.of(this).account}/*`),
        ],
        conditions: {
          StringEquals: {
            "s3:x-amz-acl": "bucket-owner-full-control",
          },
        },
      }),
    );
    logsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["s3:GetBucketAcl"],
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
        resources: [logsBucket.bucketArn],
      }),
    );

    backendAlb.addListener("HttpListener", {
      port: 80,
      protocol: elbv2.ApplicationProtocol.HTTP,
      defaultAction: elbv2.ListenerAction.redirect({
        protocol: elbv2.ApplicationProtocol.HTTPS,
        port: "443",
        permanent: true,
      }),
    });

    const httpsListener = backendAlb.addListener("HttpsListener", {
      port: 443,
      protocol: elbv2.ApplicationProtocol.HTTPS,
      certificates: [albCertificate],
    });

    // ALB用のエイリアスレコード
    new route53.ARecord(this, "AlbAliasRecord", {
      zone: props.hostedZone,
      recordName: apiDomain,
      target: route53.RecordTarget.fromAlias(
        new targets.LoadBalancerTarget(backendAlb),
      ),
    });

    // ALB用WAF WebACL
    const albWebAcl = new wafv2.CfnWebACL(this, "AlbWebACL", {
      defaultAction: { allow: {} },  // デフォルトで許可
      scope: "REGIONAL",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "AlbWebACL",
        sampledRequestsEnabled: true,
      },
      rules: [
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: 1,
          overrideAction: { none: {} },
          statement: {
            managedRuleGroupStatement: {
              name: "AWSManagedRulesCommonRuleSet",
              vendorName: "AWS",
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AWSManagedRulesCommonRuleSet",
            sampledRequestsEnabled: true,
          },
        },
      ],
    });

    // WAF用ログバケット
    const albWafLogsBucket = new s3.Bucket(this, "AlbWafLogsBucket", {
      // WAFのログは"aws-waf-logs-"で始まるバケット名にする必要がある
      bucketName: `aws-waf-logs-${this.account}-${albWebAcl.node.id.toLowerCase()}`,
      versioned: false,
      lifecycleRules: [
        {
          id: "alb-waf-log-expiration",
          enabled: true,
          expiration: Duration.days(props?.logRetentionDays ?? 90),
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // WAFログ出力設定
    new wafv2.CfnLoggingConfiguration(this, "AlbWafLogConfig", {
      logDestinationConfigs: [albWafLogsBucket.bucketArn],
      resourceArn: albWebAcl.attrArn,
      loggingFilter: {
        DefaultBehavior: "DROP",
        Filters: [
          {
            Behavior: "KEEP",
            Conditions: [
              {
                ActionCondition: {
                  Action: "BLOCK",
                },
              },
            ],
            Requirement: "MEETS_ALL",
          },
        ],
      },
    });

    // ALBにWAFを関連付け
    new wafv2.CfnWebACLAssociation(this, "AlbWafAssociation", {
      resourceArn: backendAlb.loadBalancerArn,
      webAclArn: albWebAcl.attrArn,
    });

    // WAFログバケット用のポリシー @see https://repost.aws/ja/knowledge-center/waf-turn-on-logging
    albWafLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AWSLogDeliveryAclCheck",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
        actions: ["s3:GetBucketAcl"],
        resources: [albWafLogsBucket.bucketArn],
        conditions: {
          StringEquals: {
            "aws:SourceAccount": [this.account]
          },
          ArnLike: {
            "aws:SourceArn": [`arn:aws:logs:${this.region}:${this.account}:*`]
          }
        }
      })
    );
    albWafLogsBucket.addToResourcePolicy(
      new iam.PolicyStatement({
        sid: "AWSLogDeliveryWrite",
        effect: iam.Effect.ALLOW,
        principals: [new iam.ServicePrincipal("delivery.logs.amazonaws.com")],
        actions: ["s3:PutObject"],
        resources: [albWafLogsBucket.arnForObjects("AWSLogs/*")],
        conditions: {
          StringEquals: {
            "s3:x-amz-acl": "bucket-owner-full-control",
            "aws:SourceAccount": [this.account]
          },
          ArnLike: {
            "aws:SourceArn": [`arn:aws:logs:${this.region}:${this.account}:*`]
          }
        }
      })
    );

    /*************************************
     * ECSリソース（バックエンド用）
     *************************************/
    // ECR
    const backendEcrRepository = new ecr.Repository(
      this,
      "BackendNginxECRRepository",
      {
        removalPolicy: RemovalPolicy.DESTROY,
        lifecycleRules: [
          {
            rulePriority: 10,
            description: "app Delete more than 3 images",
            tagStatus: ecr.TagStatus.TAGGED,
            tagPatternList: ["*app*"],
            maxImageCount: 3,
          },
          {
            rulePriority: 20,
            description: "web Delete more than 3 images",
            tagStatus: ecr.TagStatus.TAGGED,
            tagPatternList: ["*web*"],
            maxImageCount: 3,
          },
          {
            rulePriority: 30,
            description: "log Delete more than 3 images",
            tagStatus: ecr.TagStatus.TAGGED,
            tagPatternList: ["*log*"],
            maxImageCount: 3,
          },
          {
            rulePriority: 80,
            description: "All Tagged Delete more than 3 images",
            tagStatus: ecr.TagStatus.TAGGED,
            tagPatternList: ["*"],
            maxImageCount: 3,
          },
          {
            rulePriority: 90,
            description: "All Untagged Delete more than 3 images",
            tagStatus: ecr.TagStatus.UNTAGGED,
            maxImageCount: 3,
          },
        ],
      },
    );

    // ECSクラスター
    const ecsCluster = new ecs.Cluster(this, "EcsCluster", {
      vpc,
      containerInsights: true,
      enableFargateCapacityProviders: true,
      clusterName: PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReferences
    });

    // タスク実行ロール
    const taskExecutionRole = new iam.Role(this, "EcsTaskExecutionRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonECSTaskExecutionRolePolicy",
        ),
      ],
      inlinePolicies: {
        taskExecutionPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ssm:GetParameters", "secretsmanager:GetSecretValue"],
              resources: [
                `arn:${this.partition}:ssm:${this.region}:${this.account}:parameter/*`,
                `arn:${this.partition}:secretsmanager:${this.region}:${this.account}:secret/*`,
              ],
            }),
          ],
        }),
      },
    });

    // タスクロール
    const taskRole = new iam.Role(this, "EcsTaskRole", {
      assumedBy: new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      // TODO: アプリケーションに合わせたポリシーを追加する
    });

    // Data Firehose関係
    // ロググループ
    const backendKinesisErrorLogGroup = new logs.LogGroup(
      this,
      "BackendKinesisErrorLogGroup",
      {
        logGroupName: "/aws/kinesisfirehose/backend-error-logs",
        retention: props.logRetentionDays,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );
    // ログストリーム
    const backendKinesisErrorAppLogStream = new logs.LogStream(
      this,
      "BackendKinesisErrorAppLogStream",
      {
        logStreamName: "backend_kinesis_s3_delivery_app_error",
        logGroup: backendKinesisErrorLogGroup,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );
    const backendKinesisErrorWebLogStream = new logs.LogStream(
      this,
      "BackendKinesisErrorWebLogStream",
      {
        logStreamName: "backend_kinesis_s3_delivery_web_error",
        logGroup: backendKinesisErrorLogGroup,
        removalPolicy: RemovalPolicy.DESTROY,
      },
    );

    // Firehose用のIAMロール
    const firehoseRole = new iam.Role(this, "FirehoseRole", {
      assumedBy: new iam.ServicePrincipal("firehose.amazonaws.com"),
    });
    // S3バケットへのアクセス権限を付与
    logsBucket.grantReadWrite(firehoseRole);
    // CloudWatch Logsへのアクセス権限を付与
    backendKinesisErrorLogGroup.grantWrite(firehoseRole);
    // KMSキーの使用権限を付与（AWSマネージド型キーを参照）
    const kmsKey = kms.Key.fromLookup(this, "S3KmsKey", {
      aliasName: "alias/aws/s3",
    });
    kmsKey.grantDecrypt(firehoseRole);
    kmsKey.grantEncrypt(firehoseRole);

    // appコンテナログ配信設定
    const backendAppLogDeliveryStream = new firehose.CfnDeliveryStream(
      this,
      "BackendAppLogDeliveryStream",
      {
        deliveryStreamName: `${this.stackName}-backend-app-log`,
        deliveryStreamType: "DirectPut",
        deliveryStreamEncryptionConfigurationInput: {
          keyType: "AWS_OWNED_CMK",
        },
        s3DestinationConfiguration: {
          bucketArn: logsBucket.bucketArn,
          compressionFormat: "GZIP",
          encryptionConfiguration: {
            kmsEncryptionConfig: {
              awskmsKeyArn: kmsKey.keyArn,
            },
          },
          prefix: "backend/app/",
          roleArn: firehoseRole.roleArn,
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: backendKinesisErrorLogGroup.logGroupName,
            logStreamName: backendKinesisErrorAppLogStream.logStreamName,
          },
        },
      },
    );

    // webコンテナログ配信設定
    const backendWebLogDeliveryStream = new firehose.CfnDeliveryStream(
      this,
      "BackendWebLogDeliveryStream",
      {
        deliveryStreamName: `${this.stackName}-backend-web-log`,
        deliveryStreamType: "DirectPut",
        deliveryStreamEncryptionConfigurationInput: {
          keyType: "AWS_OWNED_CMK",
        },
        s3DestinationConfiguration: {
          bucketArn: logsBucket.bucketArn,
          compressionFormat: "GZIP",
          encryptionConfiguration: {
            kmsEncryptionConfig: {
              awskmsKeyArn: kmsKey.keyArn,
            },
          },
          prefix: "backend/web/",
          roleArn: firehoseRole.roleArn,
          cloudWatchLoggingOptions: {
            enabled: true,
            logGroupName: backendKinesisErrorLogGroup.logGroupName,
            logStreamName: backendKinesisErrorWebLogStream.logStreamName,
          },
        },
      },
    );

    // タスク定義
    const backendEcsTask = new ecs.FargateTaskDefinition(
      this,
      "BackendEcsTask",
      {
        family: `${this.stackName}-backend`,
        taskRole: taskRole,
        executionRole: taskExecutionRole,
        cpu: props.backendEcsTaskCpu,
        memoryLimitMiB: props.backendEcsTaskMemory,
        runtimePlatform: {
          cpuArchitecture: ecs.CpuArchitecture.ARM64,
          operatingSystemFamily: ecs.OperatingSystemFamily.LINUX,
        },
      },
    );
    // webコンテナ
    backendEcsTask.addContainer("web", {
      image: ecs.ContainerImage.fromEcrRepository(backendEcrRepository, "web"),
      portMappings: [{ containerPort: 80, hostPort: 80 }],
      readonlyRootFilesystem: false,
      logging: ecs.LogDrivers.firelens({}),
    });
    // appコンテナ
    backendEcsTask.addContainer("app", {
      image: ecs.ContainerImage.fromEcrRepository(backendEcrRepository, "app"),
      environment: {
        TZ: "Asia/Tokyo",
        APP_ENV: props.envName,
        APP_DEBUG: String(props.appDebug),
      },
      secrets: {
        APP_KEY: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "AppKeyParam",
            { parameterName: `/${this.stackName}/app_key` },
          ),
        ),
      },
      readonlyRootFilesystem: false,
      logging: ecs.LogDrivers.firelens({}),
    });

    backendEcsTask.addFirelensLogRouter("log", {
      image: ecs.ContainerImage.fromEcrRepository(backendEcrRepository, "log"),
      environment: {
        KINESIS_APP_DELIVERY_STREAM: backendAppLogDeliveryStream.ref,
        KINESIS_WEB_DELIVERY_STREAM: backendWebLogDeliveryStream.ref,
        AWS_REGION: this.region,
      },
      secrets: {
        SLACK_WEBHOOK_URL_LOG: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "SlackWebhookUrlParam",
            { parameterName: `/${this.stackName}/slack/webhook_url` },
          ),
        ),
      },
      user: "0",
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "firelens",
        logGroup: new logs.LogGroup(this, "BackendLogRouterLogGroup", {
          logGroupName: "backend-logrouter-logs",
          retention: props.logRetentionDays,
          removalPolicy: RemovalPolicy.DESTROY,
        }),
      }),
      firelensConfig: {
        type: ecs.FirelensLogRouterType.FLUENTBIT,
        options: {
          configFileType: ecs.FirelensConfigFileType.FILE,
          configFileValue: "/fluent-bit.conf",
          enableECSLogMetadata: false,
        },
      },
    });

    // ECSサービス用セキュリティグループ
    const appSecurityGroup = new ec2.SecurityGroup(this, "AppSecurityGroup", {
      vpc,
      description: "Security group for Backend ECS Service",
      allowAllOutbound: true, // for AWS APIs
    });

    // ECSサービス
    const backendEcsService = new ecs.FargateService(
      this,
      "BackendEcsService",
      {
        cluster: ecsCluster,
        taskDefinition: backendEcsTask,
        desiredCount: props.backendDesiredCount,
        enableExecuteCommand: true,
        platformVersion: ecs.FargatePlatformVersion.LATEST,
        // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#fargate-capacity-providers
        capacityProviderStrategies: [
          {
            capacityProvider: "FARGATE",
            weight: 1,
          },
        ],
        securityGroups: [appSecurityGroup],
        serviceName: PhysicalName.GENERATE_IF_NEEDED,
      },
    );
    const ecsServiceName = backendEcsService.serviceName;

    // ALBのターゲットグループ
    const appTargetGroup = httpsListener.addTargets("AppTargetGroup", {
      protocol: elbv2.ApplicationProtocol.HTTP,
      targets: [backendEcsService],
      deregistrationDelay: Duration.seconds(30),
    });
    appTargetGroup.configureHealthCheck({
      path: "/api/hc",
      enabled: true,
      healthyThresholdCount: 2,
      unhealthyThresholdCount: 2,
      timeout: Duration.seconds(2),
      interval: Duration.seconds(10),
      healthyHttpCodes: "200",
    });

    // スケーラブルターゲット
    const backendScalableTarget = new applicationautoscaling.ScalableTarget(
      this,
      "BackendScalableTarget",
      {
        serviceNamespace: applicationautoscaling.ServiceNamespace.ECS,
        maxCapacity: props.backendMaxTaskCount,
        minCapacity: props.backendMinTaskCount,
        resourceId: `service/${ecsCluster.clusterName}/${ecsServiceName}`,
        scalableDimension: "ecs:service:DesiredCount",
      },
    );

    // ステップスケーリングアウトポリシーの定義
    const backendStepScaleOutPolicy =
      new applicationautoscaling.StepScalingPolicy(
        this,
        "BackendStepScaleOutPolicy",
        {
          scalingTarget: backendScalableTarget,
          adjustmentType:
            applicationautoscaling.AdjustmentType.PERCENT_CHANGE_IN_CAPACITY,
          metricAggregationType:
            applicationautoscaling.MetricAggregationType.MAXIMUM,
          // クールダウン期間
          cooldown: Duration.seconds(180),
          // 評価ポイント数
          evaluationPeriods: props.backendEcsScaleOutEvaluationPeriods,
          // ステップの定義
          scalingSteps: [
            { lower: 0, upper: 80, change: 0 }, // CPU使用率が80%未満の場合、スケールインは行わない
            { lower: 80, change: 50 }, // CPU使用率が80%を超えた場合、タスク数を50%増加させる
          ],
          metric: new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "CPUUtilization",
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsServiceName,
            },
            statistic: "Maximum",
            // 評価期間
            period: props.backendEcsScaleOutPeriod,
          }),
        },
      );

    // ステップスケーリングインポリシーの定義
    const stepScaleInBackendPolicy =
      new applicationautoscaling.StepScalingPolicy(
        this,
        "StepScalingInBackendPolicy",
        {
          scalingTarget: backendScalableTarget,
          adjustmentType:
            applicationautoscaling.AdjustmentType.PERCENT_CHANGE_IN_CAPACITY,
          metricAggregationType:
            applicationautoscaling.MetricAggregationType.MAXIMUM,
          // クールダウン期間
          cooldown: Duration.seconds(300),
          // 評価ポイント数
          evaluationPeriods: props.backendEcsScaleInEvaluationPeriods,
          // ステップの定義
          scalingSteps: [
            { upper: 60, change: -20 }, // CPU使用率が60%未満の場合、タスク数を20%減少させる
            { lower: 60, change: 0 }, // CPU使用率が60%以上80%未満の場合、タスク数は変更しない
          ],
          metric: new cloudwatch.Metric({
            namespace: "AWS/ECS",
            metricName: "CPUUtilization",
            dimensionsMap: {
              ClusterName: ecsCluster.clusterName,
              ServiceName: ecsServiceName,
            },
            statistic: "Maximum",
            // 評価期間
            period: props.backendEcsScaleInPeriod,
          }),
        },
      );

    // ECSタスク自動開始・停止設定 //
    const ecsSchedulerExecutionRole = new iam.Role(
      this,
      "EcsSchedulerExecutionRole",
      {
        assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      },
    );
    ecsSchedulerExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["ecs:UpdateService"],
        resources: [backendEcsService.serviceArn],
      }),
    );
    // タスク開始スケジュール
    new scheduler.CfnSchedule(this, "EcsStartSchedule", {
      state: props.ecsStartSchedulerState,
      scheduleExpression: "cron(0 8 ? * MON-FRI *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:ecs:updateService",
        roleArn: ecsSchedulerExecutionRole.roleArn,
        input: JSON.stringify({
          Cluster: ecsCluster.clusterName,
          Service: ecsServiceName,
          DesiredCount: props.backendDesiredCount,
        }),
      },
    });
    // タスク停止スケジュール
    new scheduler.CfnSchedule(this, "EcsStopSchedule", {
      state: props.ecsStopSchedulerState,
      scheduleExpression: "cron(0 21 ? * MON-FRI *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:ecs:updateService",
        roleArn: ecsSchedulerExecutionRole.roleArn,
        input: JSON.stringify({
          Cluster: ecsCluster.clusterName,
          Service: ecsServiceName,
          DesiredCount: 0,
        }),
      },
    });

    // GitHub Actions用のOIDCプロバイダー
    const githubActionsOidcProvider = new iam.OpenIdConnectProvider(this, "GitHubActionsOidcProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
        thumbprints: ["ffffffffffffffffffffffffffffffffffffffff"],
      },
    );

    //GitHub Actions用のIAMロールとポリシー
    new iam.Role(this, "GitHubActionsRole", {
      roleName: `${this.stackName}-GitHubActionsRole`,
      assumedBy: new iam.WebIdentityPrincipal(
        githubActionsOidcProvider.openIdConnectProviderArn,
        {
          StringLike: {
            'token.actions.githubusercontent.com:sub': `repo:${props.githubOrgName}/${props.githubRepositoryName}:*`
          }
        }
      ),
      inlinePolicies: {
        GitHubActionsPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "ecr:GetAuthorizationToken",
                "ecs:ListServices",
                "sts:GetCallerIdentity",
              ],
              resources: ["*"],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["cloudformation:DescribeStacks"],
              resources: [
                `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${this.stackName}/*`,
              ],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "ecr:BatchCheckLayerAvailability",
                "ecr:BatchGetImage",
                "ecr:CompleteLayerUpload",
                "ecr:InitiateLayerUpload",
                "ecr:PutImage",
                "ecr:UploadLayerPart",
              ],
              resources: [backendEcrRepository.repositoryArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ecs:DescribeClusters"],
              resources: [ecsCluster.clusterArn],
            }),
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ecs:UpdateService"],
              resources: [backendEcsService.serviceArn],
            }),
          ],
        }),
      },
    });

    // GitHub Actions用のOutputs
    new CfnOutput(this, "EcrRepositoryUri", {
      value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/${backendEcrRepository.repositoryName}`,
    });
    new CfnOutput(this, "EcsClusterArn", {
      value: ecsCluster.clusterArn,
    });
    new CfnOutput(this, "BackendEcsServiceName", {
      value: ecsServiceName,
    });

  }
}
