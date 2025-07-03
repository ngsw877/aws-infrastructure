import { CloudFrontToS3 } from "@aws-solutions-constructs/aws-cloudfront-s3";
import {
  CfnOutput,
  Duration,
  Fn,
  PhysicalName,
  RemovalPolicy,
  Stack,
  aws_certificatemanager as acm,
  aws_applicationautoscaling as applicationautoscaling,
  aws_chatbot as chatbot,
  aws_cloudfront as cloudfront,
  aws_cloudwatch as cw,
  aws_cloudwatch_actions as cw_actions,
  aws_ec2 as ec2,
  aws_ecr as ecr,
  aws_ecs as ecs,
  aws_elasticloadbalancingv2 as elbv2,
  aws_kinesisfirehose as firehose,
  aws_iam as iam,
  aws_kms as kms,
  aws_logs as logs,
  aws_rds as rds,
  region_info as ri,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_scheduler as scheduler,
  aws_secretsmanager as secretsmanager,
  aws_ses as ses,
  aws_sns as sns,
  aws_ssm as ssm,
  aws_route53_targets as targets,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { MainStackProps } from "../types/params";

export class MainStack extends Stack {
  constructor(scope: Construct, id: string, props: MainStackProps) {
    super(scope, id, props);

    if (!props.cloudFrontTenantCertificates || !props.cloudFrontWebAcl) {
      throw new Error(
        "GlobalStackから取得した、「cloudfrontCertificate」と「cloudFrontWebAcl」の両方が必須です。",
      );
    }

    // ベースドメインとホストゾーンのマッピング
    const baseDomainZoneMap: Record<string, route53.IHostedZone> = {};
    for (const tenant of props.tenants) {
      baseDomainZoneMap[tenant.appDomainName] =
        route53.HostedZone.fromHostedZoneAttributes(
          this,
          `HostedZone-${tenant.appDomainName.replace(/\./g, "-")}`,
          {
            hostedZoneId: tenant.route53HostedZoneId,
            zoneName: tenant.appDomainName,
          },
        );
    }

    // APIドメインとホストゾーンのマッピング
    const apiDomainZoneMap: Record<string, route53.IHostedZone> = {};
    for (const tenant of props.tenants) {
      // 各テナントのAPIドメインをキーとして、対応するホストゾーンを設定
      const apiDomain = `api.${tenant.appDomainName}`;
      apiDomainZoneMap[apiDomain] = baseDomainZoneMap[tenant.appDomainName];
    }

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
      // スタック削除時にバケットも削除
      removalPolicy: RemovalPolicy.DESTROY,
      // バケット内のオブジェクトも自動削除
      autoDeleteObjects: true,
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
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // アップロードされたファイル用S3バケット
    const uploadedFilesBucket = new s3.Bucket(this, "UploadedFilesBucket", {
      versioned: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
      cors: [
        {
          allowedMethods: [s3.HttpMethods.GET],
          // 全テナントドメイン
          allowedOrigins: props.tenants.map(
            (tenant) => `https://${tenant.appDomainName}`,
          ), // 全テナントドメイン
          allowedHeaders: ["*"],
          maxAge: 3600,
        },
      ],
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
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
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

    // セキュリティヘッダーポリシーを作成
    const securityHeadersPolicy = new cloudfront.ResponseHeadersPolicy(this, "SecurityHeadersPolicy", {
      securityHeadersBehavior: {
        contentSecurityPolicy: {
          override: true,
          contentSecurityPolicy:
            "default-src 'self' https:; " +
            "script-src 'self' 'unsafe-inline' 'unsafe-eval' https:; " +
            "style-src 'self' 'unsafe-inline' https:; " +
            "font-src 'self' data: https:; " +
            "img-src 'self' data: https:; " +
            "media-src 'self' https:; " +
            "connect-src 'self' https:; " +
            "frame-src 'self' https:; " +
            "frame-ancestors 'none'; " +
            "object-src 'none';"
        },
        strictTransportSecurity: {
          override: true,
          accessControlMaxAge: Duration.seconds(63072000),
          includeSubdomains: true,
          preload: true
        },
        contentTypeOptions: {
          override: true
        },
        frameOptions: {
          override: true,
          frameOption: cloudfront.HeadersFrameOption.DENY
        },
        xssProtection: {
          override: true,
          protection: true,
          modeBlock: true
        }
      }
    });

    // CloudFrontToS3コンストラクトを使ってCloudFrontとS3を接続
    const cloudFrontToS3 = new CloudFrontToS3(this, "MultiTenantCloudFrontToS3", {
      existingBucketObj: frontendBucket,
      insertHttpSecurityHeaders: false, // カスタム関数で対応するため無効化
      cloudFrontDistributionProps: {
        webAclId: props.cloudFrontWebAcl?.attrArn,
        defaultBehavior: {
          viewerProtocolPolicy:
            cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
          functionAssociations: [
            {
              function: frontendIndexPageFunction,
              eventType: cloudfront.FunctionEventType.VIEWER_REQUEST,
            },
          ],
          responseHeadersPolicy: securityHeadersPolicy,
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
        httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
        logBucket: cloudFrontLogsBucket,
        logFilePrefix: "FrontendCloudFront/",
        defaultRootObject: "index.html",
        errorResponses: [
          // /hoge/3 のような動的ルーティングに対して403エラーが返される場合の対応
          // 参考 https://dev.classmethod.jp/articles/s3-cloudfront-spa-angular-403-access-denied/
          {
            httpStatus: 403,
            responseHttpStatus: 200,
            responsePagePath: "/",
            ttl: Duration.seconds(0),
          },
          {
            httpStatus: 404,
            responseHttpStatus: 404,
            responsePagePath: "/404.html",
            ttl: Duration.seconds(10),
          },
        ],
      },
    });
    
    // 作成されたCloudFrontディストリビューションを取得
    const cloudFrontDistribution = cloudFrontToS3.cloudFrontWebDistribution;
    // L1リソースにアクセスしてマルチテナント設定を適用
    const cfnDistribution = cloudFrontDistribution.node.defaultChild as cloudfront.CfnDistribution;
    // マルチテナントでは使えないプロパティを削除
    cfnDistribution.addPropertyDeletionOverride("DistributionConfig.IPV6Enabled");
    // マルチテナント設定を追加
    cfnDistribution.addPropertyOverride('DistributionConfig.ConnectionMode', 'tenant-only');

    // コネクショングループの作成（CloudFormationリソースとして直接定義）
    const connectionGroup = new cloudfront.CfnConnectionGroup(
      this,
      "FrontendConnectionGroup",
      {
        name: `${this.stackName}-FrontendConnectionGroup`,
        enabled: true,
        ipv6Enabled: false
      }
    );

    // 通常テナントとデモテナントを分離
    const normalTenants = props.tenants.filter(tenant => !tenant.isDemo);
    const demoTenants = props.tenants.filter(tenant => tenant.isDemo);

    // 通常テナント用のDistributionTenantsを作成（個別）
    for (const tenant of normalTenants) {
      const tenantId = tenant.appDomainName.replace(/\./g, "-");
    
      // CloudFormationリソースとしてDistributionTenantを直接定義
      new cloudfront.CfnDistributionTenant(
        this,
        `FrontendDistributionTenant${tenantId}`,
        {
          distributionId: cloudFrontDistribution.distributionId,
          connectionGroupId: connectionGroup.attrId,
          name: `${this.stackName}-frontend-tenant-${tenantId}`,
          domains: [tenant.appDomainName],
          enabled: true,
          customizations: {
            certificate: {
              arn: props.cloudFrontTenantCertificates[tenant.appDomainName].certificateArn,
            },
          },
        }
      );

      // Route53レコードの作成（ConnectionGroupのドメインを使用）
      new route53.ARecord(
        this,
        `CloudFrontAliasRecord${tenantId}`,
        {
          zone: baseDomainZoneMap[tenant.appDomainName],
          recordName: tenant.appDomainName,
          target: route53.RecordTarget.fromAlias({
            bind: () => ({
              dnsName: Fn.getAtt(connectionGroup.logicalId, "RoutingEndpoint").toString(),
              hostedZoneId: 'Z2FDTNDATAQYW2', // CloudFrontの固定ゾーンID
            })
          })
        }
      );
    }

    // デモテナント用に1つのDistributionTenantを作成（複数ドメインを登録）
    if (demoTenants.length > 0) {
      // デモテナント用のドメイン一覧を作成
      const demoDomains = demoTenants.map(tenant => tenant.appDomainName);
      // どのデモテナントの証明書も同じワイルドカード証明書なので、最初のものを使用
      const demoCertificateArn = props.cloudFrontTenantCertificates[demoTenants[0].appDomainName].certificateArn;
      
      // デモテナント用のDistributionTenantを作成
      new cloudfront.CfnDistributionTenant(
        this,
        `FrontendDistributionTenantDemo`,
        {
          distributionId: cloudFrontDistribution.distributionId,
          connectionGroupId: connectionGroup.attrId,
          name: `${this.stackName}-frontend-tenant-demo`,
          domains: demoDomains, // 複数のデモドメインを指定
          enabled: true,
          customizations: {
            certificate: {
              arn: demoCertificateArn, // ワイルドカード証明書のARN
            },
          },
        }
      );
      
      // 各デモテナント用のRoute53レコードを作成
      for (const demoTenant of demoTenants) {
        const demoTenantId = demoTenant.appDomainName.replace(/\./g, "-");
        new route53.ARecord(
          this,
          `CloudFrontAliasRecordDemo${demoTenantId}`,
          {
            zone: baseDomainZoneMap[demoTenant.appDomainName],
            recordName: demoTenant.appDomainName,
            target: route53.RecordTarget.fromAlias({
              bind: () => ({
                dnsName: Fn.getAtt(connectionGroup.logicalId, "RoutingEndpoint").toString(),
                hostedZoneId: 'Z2FDTNDATAQYW2', // CloudFrontの固定ゾーンID
              })
            })
          }
        );
      }
    }

    /*************************************
     * バックエンド用リソース
     *************************************/

    // ALB用ACM証明書（全テナントのAPIドメインに対応）
    const albCertificate = new acm.Certificate(this, "AlbCertificate", {
      certificateName: `${this.stackName}-alb-certificate`,
      domainName: `api.${props.tenants[0].appDomainName}`, // プライマリドメインのAPIドメイン
      subjectAlternativeNames: [
        ...props.tenants
          .slice(1)
          .map((tenant) => `api.${tenant.appDomainName}`), // 他テナントのAPIドメイン
      ],
      validation: acm.CertificateValidation.fromDnsMultiZone(apiDomainZoneMap),
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
      deletionProtection: props.albDeletionProtection,
    });

    // 各テナントドメインにALBエイリアスレコードを作成
    for (const tenant of props.tenants) {
      new route53.ARecord(
        this,
        `AlbAliasRecord-${tenant.appDomainName.replace(/\./g, "-")}`,
        {
          zone: baseDomainZoneMap[tenant.appDomainName],
          recordName: `api.${tenant.appDomainName}`,
          target: route53.RecordTarget.fromAlias(
            new targets.LoadBalancerTarget(backendAlb),
          ),
        },
      );
    }

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
      sslPolicy: elbv2.SslPolicy.RECOMMENDED_TLS,
    });

    // ALB用WAF WebACL
    const albWebAcl = new wafv2.CfnWebACL(this, "AlbWebACL", {
      defaultAction: { allow: {} }, // デフォルトで許可
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
      bucketName: `aws-waf-logs-${props.envName}-${this.account}-${albWebAcl.node.id.toLowerCase()}`,
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
      removalPolicy: RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // WAFログ出力設定
    const wafLogConfig = new wafv2.CfnLoggingConfiguration(
      this,
      "AlbWafLogConfig",
      {
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
      },
    );

    // バケットポリシーが完全に作成された後にWAFログ設定を行うように依存関係を追加
    wafLogConfig.node.addDependency(albWafLogsBucket);

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
            "aws:SourceAccount": [this.account],
          },
          ArnLike: {
            "aws:SourceArn": [`arn:aws:logs:${this.region}:${this.account}:*`],
          },
        },
      }),
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
            "aws:SourceAccount": [this.account],
          },
          ArnLike: {
            "aws:SourceArn": [`arn:aws:logs:${this.region}:${this.account}:*`],
          },
        },
      }),
    );

    // Data Firehose関係
    // ロググループ
    const backendKinesisErrorLogGroup = new logs.LogGroup(
      this,
      "BackendKinesisErrorLogGroup",
      {
        logGroupName: `/aws/kinesisfirehose/${this.stackName}/backend-error-logs`,
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

    /*************************************
     * ECSリソース（バックエンド用）
     *************************************/
    // ECR
    const backendEcrRepository = new ecr.Repository(
      this,
      "BackendEcrRepository",
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

    // ECSタスクロール
    const taskRole = new iam.Role(this, "EcsTaskRole", {
      assumedBy: new iam.CompositePrincipal(
        new iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
      ),
      path: "/",
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AmazonEC2ContainerServiceEventsRole",
        ),
      ],
      inlinePolicies: {
        firehosePolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["firehose:PutRecordBatch"],
              resources: [
                `arn:aws:firehose:${this.region}:${this.account}:deliverystream/${backendAppLogDeliveryStream.ref}`,
                `arn:aws:firehose:${this.region}:${this.account}:deliverystream/${backendWebLogDeliveryStream.ref}`,
              ],
            }),
          ],
        }),

        // S3アップロード用の権限を追加
        s3UploadPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObject",
                "s3:GetObject",
                "s3:DeleteObject",
                "s3:ListBucket",
                "s3:GetObjectAcl",
                "s3:PutObjectAcl",
              ],
              resources: [
                uploadedFilesBucket.bucketArn,
                `${uploadedFilesBucket.bucketArn}/*`,
              ],
            }),
          ],
        }),
        // Eメール送信用の権限
        sesPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "ses:SendEmail",
                "ses:SendRawEmail",
                "ses:SendTemplatedEmail",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    const dbName = "sample_app";

    // Secrets Manager（DB認証情報を設定）
    const dbSecret = new secretsmanager.Secret(this, "AuroraSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: "webapp",
          dbname: dbName,
        }),
        generateStringKey: "password",
        excludeCharacters: '"@/\\',
        excludePunctuation: true,
      },
    });

    // ReadOnlyユーザー用シークレット
    new secretsmanager.Secret(this, "AuroraReadOnlySecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: "readonly_user",
          dbname: dbName,
        }),
        generateStringKey: "password",
        excludeCharacters: '"@/\\',
        excludePunctuation: true,
      },
    });

    // ReadWriteユーザー用シークレット
    new secretsmanager.Secret(this, "AuroraReadWriteSecret", {
      generateSecretString: {
        secretStringTemplate: JSON.stringify({
          username: "readwrite_user",
          dbname: dbName,
        }),
        generateStringKey: "password",
        excludeCharacters: '"@/\\',
        excludePunctuation: true,
      },
    });

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
        AWS_BUCKET: uploadedFilesBucket.bucketName,
        AWS_URL: `https://${uploadedFilesBucket.bucketRegionalDomainName}`,
        MAIL_MAILER: "ses",
      },
      secrets: {
        // SecretsManagerから取得した値
        DB_HOST: ecs.Secret.fromSecretsManager(dbSecret, "host"),
        DB_PORT: ecs.Secret.fromSecretsManager(dbSecret, "port"),
        DB_USERNAME: ecs.Secret.fromSecretsManager(dbSecret, "username"),
        DB_DATABASE: ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
        DB_PASSWORD: ecs.Secret.fromSecretsManager(dbSecret, "password"),
        // SSMパラメータストアから取得した値
        APP_KEY: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "AppContainerDefAppKeyParam",
            {
              parameterName: `/${this.stackName}/ecs-task-def/app/env-vars/app-key`,
            },
          ),
        ),
      },
      readonlyRootFilesystem: false,
      logging: ecs.LogDrivers.firelens({}),
    });

    // log-routerコンテナ
    backendEcsTask.addFirelensLogRouter("log-router", {
      image: ecs.ContainerImage.fromEcrRepository(
        backendEcrRepository,
        "log-router",
      ),
      environment: {
        KINESIS_APP_DELIVERY_STREAM: backendAppLogDeliveryStream.ref,
        KINESIS_WEB_DELIVERY_STREAM: backendWebLogDeliveryStream.ref,
        AWS_REGION: this.region,
      },
      secrets: {
        APP_LOG_SLACK_WEBHOOK_URL: ecs.Secret.fromSsmParameter(
          ssm.StringParameter.fromSecureStringParameterAttributes(
            this,
            "LogRouterContainerDefAppLogSlackWebhookUrlParam",
            {
              parameterName: `/${this.stackName}/ecs-task-def/log-router/env-vars/app-log-slack-webhook-url`,
            },
          ),
        ),
      },
      user: "0",
      logging: ecs.LogDrivers.awsLogs({
        streamPrefix: "firelens",
        logGroup: new logs.LogGroup(this, "BackendLogRouterLogGroup", {
          logGroupName: `/aws/ecs/${this.stackName}/backend-logrouter-logs`,
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
    const backendEcsServiceSecurityGroup = new ec2.SecurityGroup(
      this,
      "BackendEcsServiceSecurityGroup",
      {
        vpc,
        description: "Security group for Backend ECS Service",
        allowAllOutbound: true, // for AWS APIs
      },
    );

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
        securityGroups: [backendEcsServiceSecurityGroup],
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
      path: props.healthCheckPath,
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
          metric: new cw.Metric({
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
          metric: new cw.Metric({
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

    // ECSタスクを自動停止・開始設定するためのIAMロール
    const autoScalingSchedulerExecutionRole = new iam.Role(
      this,
      "AutoScalingSchedulerExecutionRole",
      {
        assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      },
    );
    autoScalingSchedulerExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["application-autoscaling:RegisterScalableTarget"],
        resources: ["*"], // CDKではARNを取得できないため"*"を指定
      }),
    );

    // ECSタスクを停止するスケジュール（スケーラブルターゲットの最小・最大タスク数を0に設定する）
    new scheduler.CfnSchedule(this, "AutoScalingStopSchedule", {
      state: props.ecsSchedulerState,
      scheduleExpression: "cron(0 21 ? * MON-FRI *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:applicationautoscaling:registerScalableTarget",
        roleArn: autoScalingSchedulerExecutionRole.roleArn,
        input: JSON.stringify({
          ServiceNamespace: "ecs",
          ScalableDimension: "ecs:service:DesiredCount",
          ResourceId: `service/${ecsCluster.clusterName}/${ecsServiceName}`,
          MinCapacity: 0,
          MaxCapacity: 0,
        }),
      },
    });

    // ECSタスクを開始するスケジュール（スケーラブルターゲットの最小・最大タスク数を元に戻す）
    new scheduler.CfnSchedule(this, "AutoScalingStartSchedule", {
      state: props.ecsSchedulerState,
      scheduleExpression: "cron(0 8 ? * MON-FRI *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:applicationautoscaling:registerScalableTarget",
        roleArn: autoScalingSchedulerExecutionRole.roleArn,
        input: JSON.stringify({
          ServiceNamespace: "ecs",
          ScalableDimension: "ecs:service:DesiredCount",
          ResourceId: `service/${ecsCluster.clusterName}/${ecsServiceName}`,
          MinCapacity: props.backendMinTaskCount, // 元の最小タスク数
          MaxCapacity: props.backendMaxTaskCount, // 元の最大タスク数
        }),
      },
    });

    /*************************************
     * DB関係
     *************************************/

    // AuroraのPostgreSQLバージョンを指定
    const PostgresVersion = props.postgresVersion;

    // パラメータグループ
    const parameterGroup = new rds.ParameterGroup(this, "ParameterGroup", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: PostgresVersion,
      }),
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // サブネットグループ
    const subnetGroup = new rds.SubnetGroup(this, "SubnetGroup", {
      description: "Subnet group for Aurora database",
      vpc: vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // KMSキー
    const auroraEncryptionKey = new kms.Key(
      this,
      "AuroraStorageEncryptionKey",
      {
        enableKeyRotation: true,
        description: "KMS key for Aurora storage encryption",
      },
    );

    // Aurora Serverless cluster
    const dbCluster = new rds.DatabaseCluster(this, "AuroraServerlessCluster", {
      engine: rds.DatabaseClusterEngine.auroraPostgres({
        version: PostgresVersion,
      }),
      credentials: rds.Credentials.fromSecret(dbSecret),
      writer: rds.ClusterInstance.serverlessV2("Writer", {
        performanceInsightRetention: rds.PerformanceInsightRetention.DEFAULT, // Performance Insightsを7日間有効化
        autoMinorVersionUpgrade: false, // マイナーバージョンアップグレードを無効化
        preferredMaintenanceWindow: "Sun:13:30-Sun:14:00", // 日本時間の日曜22:30-23:00にメンテナンス実施
      }),
      readers: props.isReadReplicaEnabled
        ? [
            rds.ClusterInstance.serverlessV2("Reader", {
              performanceInsightRetention:
                rds.PerformanceInsightRetention.DEFAULT,
              autoMinorVersionUpgrade: false, // マイナーバージョンアップグレードを無効化
              preferredMaintenanceWindow: "Sun:14:00-Sun:14:30", // 日本時間の日曜23:00-23:30にメンテナンス実施
            }),
          ]
        : undefined,
      vpc,
      parameterGroup,
      subnetGroup,
      serverlessV2MinCapacity: props.auroraServerlessV2MinCapacity,
      serverlessV2MaxCapacity: props.auroraServerlessV2MaxCapacity,
      iamAuthentication: true, // IAMデータベース認証を有効にする
      enableDataApi: true, // Data APIを有効にする
      storageEncryptionKey: auroraEncryptionKey, // ストレージの暗号化キーを指定
      storageEncrypted: true, // ストレージの暗号化を有効化
      cloudwatchLogsExports: ["postgresql"], // PostgreSQLログをCloudWatch Logsにエクスポート
      cloudwatchLogsRetention: props.logRetentionDays, // CloudWatch Logsの保持期間を指定
      backup: {
        retention: Duration.days(7), // バックアップ保持期間を7日に設定
        preferredWindow: "16:00-17:00", // 日本時間の01:00-02:00に自動バックアップ実施
      },
      preferredMaintenanceWindow: "Sun:13:00-Sun:13:30", // 日本時間の日曜22:00-22:30にメンテナンス実施
      deletionProtection: props.auroraDeletionProtection,
    });

    //ECSタスクロールにDBアクセス許可を追加
    taskExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["rds-db:connect", "rds:DescribeDBInstances"],
        resources: [dbCluster.clusterArn],
      }),
    );

    // DBパスワードのローテーションを有効化
    dbCluster.addRotationSingleUser({
      automaticallyAfter: Duration.days(30),
      excludeCharacters: '"@/\\',
    });

    // DBの自動定期開始・停止設定
    // EventBridge Schedulerの実行ロール
    const auroraSchedulerExecutionRole = new iam.Role(
      this,
      "AuroraSchedulerExecutionRole",
      {
        assumedBy: new iam.ServicePrincipal("scheduler.amazonaws.com"),
      },
    );
    auroraSchedulerExecutionRole.addToPolicy(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        actions: ["rds:StopDBCluster", "rds:StartDBCluster"],
        resources: [dbCluster.clusterArn],
      }),
    );
    // 開始スケジュール
    new scheduler.CfnSchedule(this, "AuroraStartSchedule", {
      state: props.auroraSchedulerState,
      scheduleExpression: "cron(20 7 ? * MON-FRI *)", // DBの起動に時間がかかるため、ECSのタスク開始時刻より40分早める
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:rds:startDBCluster",
        roleArn: auroraSchedulerExecutionRole.roleArn,
        input: JSON.stringify({
          DbClusterIdentifier: dbCluster.clusterIdentifier,
        }),
      },
    });
    // 停止スケジュール
    new scheduler.CfnSchedule(this, "AuroraStopSchedule", {
      state: props.auroraSchedulerState,
      scheduleExpression: "cron(0 21 ? * MON-FRI *)",
      scheduleExpressionTimezone: "Asia/Tokyo",
      flexibleTimeWindow: {
        mode: "OFF",
      },
      target: {
        arn: "arn:aws:scheduler:::aws-sdk:rds:stopDBCluster",
        roleArn: auroraSchedulerExecutionRole.roleArn,
        input: JSON.stringify({
          DbClusterIdentifier: dbCluster.clusterIdentifier,
        }),
      },
    });

    // 踏み台サーバー
    const bastionHost = new ec2.BastionHostLinux(this, "BastionHost", {
      vpc,
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass.T2,
        ec2.InstanceSize.NANO,
      ),
      machineImage: ec2.MachineImage.latestAmazonLinux2023({
        cpuType: ec2.AmazonLinuxCpuType.X86_64,
      }),
      subnetSelection: {
        subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
      },
    });

    bastionHost.instance.userData.addCommands(
      "sudo dnf update -y",
      `sudo dnf install -y postgresql${props.postgresClientVersion}`,
    );

    // 踏み台サーバーからAuroraへのアクセスを許可
    dbCluster.connections.allowFrom(
      bastionHost,
      ec2.Port.tcp(5432),
      "Allow access from Bastion host",
    );
    // Backend ECS ServiceからAuroraへのアクセスを許可
    dbCluster.connections.allowFrom(
      backendEcsServiceSecurityGroup,
      ec2.Port.tcp(5432),
      "Allow access from Backend ECS Service",
    );

    /*************************************
     * メール送信機能
     *************************************/
    // 各テナントドメインのSES設定
    for (const tenant of props.tenants) {
      // SESの作成が有効な場合のみ実行
      if (tenant.isSesEnabled) {
        // SES ID
        new ses.EmailIdentity(
          this,
          `EmailIdentity-${tenant.appDomainName.replace(/\./g, "-")}`,
          {
            identity: ses.Identity.publicHostedZone(
              baseDomainZoneMap[tenant.appDomainName],
            ),
            mailFromDomain: `bounce.${tenant.appDomainName}`,
          },
        );

        // DMARC設定
        new route53.TxtRecord(
          this,
          `DmarcRecord-${tenant.appDomainName.replace(/\./g, "-")}`,
          {
            zone: baseDomainZoneMap[tenant.appDomainName],
            recordName: `_dmarc.${tenant.appDomainName}`,
            values: [`v=DMARC1; p=none; rua=mailto:${props.dmarcReportEmail}`],
            ttl: Duration.hours(1),
          },
        );
      } else {
        // SESの作成が無効な場合、スキップされたことをログに出力（CDK synth/deploy時に表示される）
        console.log(
          `Skipping SES Identity and DMARC Record creation for tenant: ${tenant.appDomainName} as isSesEnabled is false.`,
        );
      }
    }

    /*************************************
     * SNSトピック・Chatbot
     *************************************/
    const warningSnsTopic = new sns.Topic(this, "WarningSnsTopic", {});

    // Chatbot用IAMロール
    const slackChatbotRole = new iam.Role(this, "SlackChatbotRole", {
      assumedBy: new iam.ServicePrincipal("chatbot.amazonaws.com"),
      inlinePolicies: {
        SlackNotificationChatBotPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "cloudwatch:Describe*",
                "cloudwatch:Get*",
                "cloudwatch:List*",
              ],
              resources: ["*"],
            }),
          ],
        }),
      },
    });

    // Slackチャネル構成の作成
    new chatbot.SlackChannelConfiguration(this, "WarningSlackChannelConfig", {
      slackChannelConfigurationName: `${this.stackName}-${this.node.id}`,
      slackChannelId: props.warningSlackChannelId,
      slackWorkspaceId: props.slackWorkspaceId,
      notificationTopics: [warningSnsTopic],
      loggingLevel: chatbot.LoggingLevel.ERROR,
      guardrailPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess"),
      ],
      role: slackChatbotRole,
    });

    /*************************************
     * CloudWatchアラーム
     *************************************/
    // CPUUtilization
    const auroraCpuUtilizationAlarm = new cw.Alarm(
      this,
      "AuroraCpuUtilizationAlarm",
      {
        alarmDescription: "Aurora CPU Utilization exceeds 80%",
        metric: new cw.Metric({
          namespace: "AWS/RDS",
          metricName: "CPUUtilization",
          dimensionsMap: {
            DBClusterIdentifier: dbCluster.clusterIdentifier,
          },
          statistic: "Average",
          period: Duration.seconds(300),
        }),
        evaluationPeriods: 1,
        threshold: 80,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cw.TreatMissingData.BREACHING,
      },
    );
    // アラームアクションの設定
    auroraCpuUtilizationAlarm.addAlarmAction(
      new cw_actions.SnsAction(warningSnsTopic),
    );
    auroraCpuUtilizationAlarm.addOkAction(
      new cw_actions.SnsAction(warningSnsTopic),
    );

    // FreeableMemory
    const auroraFreeableMemoryAlarm = new cw.Alarm(
      this,
      "AuroraFreeableMemoryAlarm",
      {
        alarmDescription: "Aurora FreeableMemory exceeds 95%",
        metric: new cw.Metric({
          namespace: "AWS/RDS",
          metricName: "FreeableMemory",
          dimensionsMap: {
            DBClusterIdentifier: dbCluster.clusterIdentifier,
          },
          statistic: "Average",
          period: Duration.seconds(300),
        }),
        evaluationPeriods: 1,
        // メモリ空き容量の閾値を設定...最大メモリ容量の5%
        // - 最大ACU数 × 2GB = 最大メモリ容量 (1ACUあたり2GBのメモリ)
        // - メモリ空き容量が最大メモリ容量の5%以下になったらアラート（メモリ使用量が95%以上になったらアラート）
        threshold: props.auroraServerlessV2MaxCapacity * 2 * 0.05,
        comparisonOperator: cw.ComparisonOperator.LESS_THAN_THRESHOLD,
        treatMissingData: cw.TreatMissingData.BREACHING,
      },
    );
    // アラームアクションの設定
    auroraFreeableMemoryAlarm.addAlarmAction(
      new cw_actions.SnsAction(warningSnsTopic),
    );
    auroraFreeableMemoryAlarm.addOkAction(
      new cw_actions.SnsAction(warningSnsTopic),
    );

    // ACUUtilization
    const auroraAcuUtilizationAlarm = new cw.Alarm(
      this,
      "AuroraAcuUtilizationAlarm",
      {
        alarmDescription: "Aurora ACUUtilization exceeds 80%",
        metric: new cw.Metric({
          namespace: "AWS/RDS",
          metricName: "ACUUtilization",
          dimensionsMap: {
            DBClusterIdentifier: dbCluster.clusterIdentifier,
          },
          statistic: "Average",
          period: Duration.seconds(300),
        }),
        evaluationPeriods: 1,
        threshold: 80,
        comparisonOperator: cw.ComparisonOperator.GREATER_THAN_THRESHOLD,
        treatMissingData: cw.TreatMissingData.BREACHING,
      },
    );
    // アラームアクションの設定
    auroraAcuUtilizationAlarm.addAlarmAction(
      new cw_actions.SnsAction(warningSnsTopic),
    );
    auroraAcuUtilizationAlarm.addOkAction(
      new cw_actions.SnsAction(warningSnsTopic),
    );

    // GitHub Actions用のOIDCプロバイダー
    const githubActionsOidcProviderArn = Fn.importValue(
      "GitHubActionsOidcProviderArn",
    );

    //GitHub Actions用のIAMロールとポリシー
    new iam.Role(this, "GitHubActionsRole", {
      roleName: `${this.stackName}-GitHubActionsRole`,
      assumedBy: new iam.WebIdentityPrincipal(githubActionsOidcProviderArn, {
        StringLike: {
          "token.actions.githubusercontent.com:sub": `repo:${props.githubOrgName}/${props.githubRepositoryName}:*`,
        },
      }),
      inlinePolicies: {
        GitHubActionsPolicy: new iam.PolicyDocument({
          // --- バックエンドアプリ用 ---
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
            // --- フロントエンドアプリ用 ---
            // S3バケットへのアクセス権限
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "s3:PutObject",
                "s3:GetObject",
                "s3:ListBucket",
                "s3:DeleteObject",
              ],
              resources: [
                frontendBucket.bucketArn,
                `${frontendBucket.bucketArn}/*`,
              ],
            }),
            // Multi-tenantタイプのCloudFrontのキャッシュ削除権限
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                // テナント一覧取得
                "cloudfront:ListDistributionTenants",
                // テナント単位でのキャッシュ無効化
                "cloudfront:CreateInvalidationForDistributionTenant",
              ],
              resources: ["*"]
            }),
            // ECSタスク関連の権限を追加
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["ecs:RunTask", "ecs:DescribeTasks", "ecs:ListTasks"],
              resources: [
                // タスク定義に対する権限
                `arn:${this.partition}:ecs:${this.region}:${this.account}:task-definition/${this.stackName}-backend*`,
                // タスクに対する権限
                `arn:${this.partition}:ecs:${this.region}:${this.account}:task/${ecsCluster.clusterName}/*`,
              ],
            }),
            // タスク定義関連の権限
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: [
                "ecs:DescribeTaskDefinition",
                "ecs:RegisterTaskDefinition",
                "ecs:DeregisterTaskDefinition",
              ],
              resources: ["*"], // これらのアクションはリソースレベルの制限をサポートしていない
            }),
            // タスク実行に必要なIAMロールのPassRole権限
            new iam.PolicyStatement({
              effect: iam.Effect.ALLOW,
              actions: ["iam:PassRole"],
              resources: [
                taskRole.roleArn, // 既存のタスクロール
                taskExecutionRole.roleArn, // 既存のタスク実行ロール
              ],
            }),
          ],
        }),
      },
    });

    // GitHub Actions用のOutputs（バックエンドアプリ用）
    new CfnOutput(this, "EcrRepositoryUri", {
      value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/${backendEcrRepository.repositoryName}`,
    });
    new CfnOutput(this, "EcsClusterArn", {
      value: ecsCluster.clusterArn,
      exportName: "EcsClusterArn",
    });
    new CfnOutput(this, "BackendEcsServiceName", {
      value: ecsServiceName,
    });
    new CfnOutput(this, "BackendTaskDefinitionFamily", {
      value: backendEcsTask.family,
    });
    new CfnOutput(this, "BackendEcsServiceSecurityGroupId", {
      value: backendEcsServiceSecurityGroup.securityGroupId,
    });
    new CfnOutput(this, "PrivateSubnet1Id", {
      value: vpc.privateSubnets[0].subnetId,
    });

    // GitHub Actions用のOutputs（フロントエンドアプリ用）
    new CfnOutput(this, "FrontendBucketName", {
      value: frontendBucket.bucketName,
    });
    new CfnOutput(this, "FrontendCloudFrontDistributionId", {
      value: cloudFrontDistribution.distributionId,
    });
    // 通常テナントのディストリビューションテナントIDをエクスポート
    for (const tenant of normalTenants) {
      const tenantId = tenant.appDomainName.replace(/\./g, "-");
      new CfnOutput(this, `FrontendDistributionTenantId-${tenantId}`, {
        value: `DistributionTenant-${tenantId}`,
        description: `Frontend Distribution Tenant ID for ${tenant.appDomainName}`,
      });
    }
    
    // デモテナント用の共通ディストリビューションテナントIDをエクスポート
    if (demoTenants.length > 0) {
      new CfnOutput(this, "FrontendDistributionTenantIdDemo", {
        value: "DistributionTenant-Demo",
        description: "Frontend Distribution Tenant ID for demo tenants",
      });
    }
  }
}
