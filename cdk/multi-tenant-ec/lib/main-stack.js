"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MainStack = void 0;
const aws_cloudfront_s3_1 = require("@aws-solutions-constructs/aws-cloudfront-s3");
const aws_cdk_lib_1 = require("aws-cdk-lib");
class MainStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        if (!props.cloudFrontTenantCertificates || !props.cloudFrontWebAcl) {
            throw new Error("GlobalStackから取得した、「cloudfrontCertificate」と「cloudFrontWebAcl」の両方が必須です。");
        }
        // ベースドメインとホストゾーンのマッピング
        const baseDomainZoneMap = {};
        for (const tenant of props.tenants) {
            baseDomainZoneMap[tenant.appDomainName] =
                aws_cdk_lib_1.aws_route53.HostedZone.fromHostedZoneAttributes(this, `HostedZone-${tenant.appDomainName.replace(/\./g, "-")}`, {
                    hostedZoneId: tenant.route53HostedZoneId,
                    zoneName: tenant.appDomainName,
                });
        }
        // APIドメインとホストゾーンのマッピング
        const apiDomainZoneMap = {};
        for (const tenant of props.tenants) {
            // 各テナントのAPIドメインをキーとして、対応するホストゾーンを設定
            const apiDomain = `api.${tenant.appDomainName}`;
            apiDomainZoneMap[apiDomain] = baseDomainZoneMap[tenant.appDomainName];
        }
        // 集約ログ用S3バケット
        const logsBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "LogsBucket", {
            lifecycleRules: [
                {
                    id: "log-expiration",
                    enabled: true,
                    expiration: aws_cdk_lib_1.Duration.days(props?.logRetentionDays ?? aws_cdk_lib_1.aws_logs.RetentionDays.THREE_MONTHS),
                },
            ],
            accessControl: aws_cdk_lib_1.aws_s3.BucketAccessControl.PRIVATE,
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            // スタック削除時にバケットも削除
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            // バケット内のオブジェクトも自動削除
            autoDeleteObjects: true,
        });
        /*************************************
         * ネットワークリソース
         *************************************/
        // VPCとサブネット
        const vpc = new aws_cdk_lib_1.aws_ec2.Vpc(this, "Vpc", {
            maxAzs: 2,
            subnetConfiguration: [
                {
                    cidrMask: 24,
                    name: "Public",
                    subnetType: aws_cdk_lib_1.aws_ec2.SubnetType.PUBLIC,
                },
                {
                    cidrMask: 24,
                    name: "Private",
                    subnetType: aws_cdk_lib_1.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
                },
            ],
            natGateways: props.natGatewaysCount,
        });
        /*************************************
         * フロントエンド用リソース
         *************************************/
        // フロントエンド用S3バケット
        const frontendBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "FrontendBucket", {
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // アップロードされたファイル用S3バケット
        const uploadedFilesBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "UploadedFilesBucket", {
            versioned: true,
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
            cors: [
                {
                    allowedMethods: [aws_cdk_lib_1.aws_s3.HttpMethods.GET],
                    // 全テナントドメイン
                    allowedOrigins: props.tenants.map((tenant) => `https://${tenant.appDomainName}`), // 全テナントドメイン
                    allowedHeaders: ["*"],
                    maxAge: 3600,
                },
            ],
        });
        // CloudFrontログ用S3バケット
        const cloudFrontLogsBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "CloudFrontLogsBucket", {
            lifecycleRules: [
                {
                    id: "cloudfront-logs-expiration",
                    enabled: true,
                    expiration: aws_cdk_lib_1.Duration.days(props?.logRetentionDays ?? aws_cdk_lib_1.aws_logs.RetentionDays.THREE_MONTHS),
                },
            ],
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            accessControl: aws_cdk_lib_1.aws_s3.BucketAccessControl.LOG_DELIVERY_WRITE,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // CloudFrontFunction Frontendリクエスト用
        const frontendIndexPageFunction = new aws_cdk_lib_1.aws_cloudfront.Function(this, "FrontendIndexPageFunction", {
            functionName: `${this.stackName}-FrontendIndexPageFunction`,
            runtime: aws_cdk_lib_1.aws_cloudfront.FunctionRuntime.JS_2_0,
            code: aws_cdk_lib_1.aws_cloudfront.FunctionCode.fromFile({
                filePath: "cloudfront-functions/FrontendIndexPageFunction.js",
            }),
        });
        // セキュリティヘッダーポリシーを作成
        const securityHeadersPolicy = new aws_cdk_lib_1.aws_cloudfront.ResponseHeadersPolicy(this, "SecurityHeadersPolicy", {
            securityHeadersBehavior: {
                contentSecurityPolicy: {
                    override: true,
                    contentSecurityPolicy: "default-src 'self' https:; " +
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
                    accessControlMaxAge: aws_cdk_lib_1.Duration.seconds(63072000),
                    includeSubdomains: true,
                    preload: true
                },
                contentTypeOptions: {
                    override: true
                },
                frameOptions: {
                    override: true,
                    frameOption: aws_cdk_lib_1.aws_cloudfront.HeadersFrameOption.DENY
                },
                xssProtection: {
                    override: true,
                    protection: true,
                    modeBlock: true
                }
            }
        });
        // CloudFrontToS3コンストラクトを使ってCloudFrontとS3を接続
        const cloudFrontToS3 = new aws_cloudfront_s3_1.CloudFrontToS3(this, "MultiTenantCloudFrontToS3", {
            existingBucketObj: frontendBucket,
            insertHttpSecurityHeaders: false, // カスタム関数で対応するため無効化
            cloudFrontDistributionProps: {
                webAclId: props.cloudFrontWebAcl?.attrArn,
                defaultBehavior: {
                    viewerProtocolPolicy: aws_cdk_lib_1.aws_cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                    functionAssociations: [
                        {
                            function: frontendIndexPageFunction,
                            eventType: aws_cdk_lib_1.aws_cloudfront.FunctionEventType.VIEWER_REQUEST,
                        },
                    ],
                    responseHeadersPolicy: securityHeadersPolicy,
                    // オリジンリクエストポリシー
                    originRequestPolicy: new aws_cdk_lib_1.aws_cloudfront.OriginRequestPolicy(this, "FrontendOriginRequestPolicy", {
                        originRequestPolicyName: `${this.stackName}-FrontendOriginRequestPolicy`,
                        comment: "FrontendOriginRequestPolicy",
                    }),
                    // キャッシュポリシー
                    cachePolicy: new aws_cdk_lib_1.aws_cloudfront.CachePolicy(this, "FrontendCachePolicy", {
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
                httpVersion: aws_cdk_lib_1.aws_cloudfront.HttpVersion.HTTP2_AND_3,
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
                        ttl: aws_cdk_lib_1.Duration.seconds(0),
                    },
                    {
                        httpStatus: 404,
                        responseHttpStatus: 404,
                        responsePagePath: "/404.html",
                        ttl: aws_cdk_lib_1.Duration.seconds(10),
                    },
                ],
            },
        });
        // 作成されたCloudFrontディストリビューションを取得
        const cloudFrontDistribution = cloudFrontToS3.cloudFrontWebDistribution;
        // L1リソースにアクセスしてマルチテナント設定を適用
        const cfnDistribution = cloudFrontDistribution.node.defaultChild;
        // マルチテナントでは使えないプロパティを削除
        cfnDistribution.addPropertyDeletionOverride("DistributionConfig.IPV6Enabled");
        // マルチテナント設定を追加
        cfnDistribution.addPropertyOverride('DistributionConfig.ConnectionMode', 'tenant-only');
        // コネクショングループの作成（CloudFormationリソースとして直接定義）
        const connectionGroup = new aws_cdk_lib_1.aws_cloudfront.CfnConnectionGroup(this, "FrontendConnectionGroup", {
            name: `${this.stackName}-FrontendConnectionGroup`,
            enabled: true,
            ipv6Enabled: false
        });
        // 通常テナントとデモテナントを分離
        const normalTenants = props.tenants.filter(tenant => !tenant.isDemo);
        const demoTenants = props.tenants.filter(tenant => tenant.isDemo);
        // 通常テナント用のDistributionTenantsを作成（個別）
        for (const tenant of normalTenants) {
            const tenantId = tenant.appDomainName.replace(/\./g, "-");
            // CloudFormationリソースとしてDistributionTenantを直接定義
            new aws_cdk_lib_1.aws_cloudfront.CfnDistributionTenant(this, `FrontendDistributionTenant${tenantId}`, {
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
            });
            // Route53レコードの作成（ConnectionGroupのドメインを使用）
            new aws_cdk_lib_1.aws_route53.ARecord(this, `CloudFrontAliasRecord${tenantId}`, {
                zone: baseDomainZoneMap[tenant.appDomainName],
                recordName: tenant.appDomainName,
                target: aws_cdk_lib_1.aws_route53.RecordTarget.fromAlias({
                    bind: () => ({
                        dnsName: aws_cdk_lib_1.Fn.getAtt(connectionGroup.logicalId, "RoutingEndpoint").toString(),
                        hostedZoneId: 'Z2FDTNDATAQYW2', // CloudFrontの固定ゾーンID
                    })
                })
            });
        }
        // デモテナント用に1つのDistributionTenantを作成（複数ドメインを登録）
        if (demoTenants.length > 0) {
            // デモテナント用のドメイン一覧を作成
            const demoDomains = demoTenants.map(tenant => tenant.appDomainName);
            // どのデモテナントの証明書も同じワイルドカード証明書なので、最初のものを使用
            const demoCertificateArn = props.cloudFrontTenantCertificates[demoTenants[0].appDomainName].certificateArn;
            // デモテナント用のDistributionTenantを作成
            new aws_cdk_lib_1.aws_cloudfront.CfnDistributionTenant(this, `FrontendDistributionTenantDemo`, {
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
            });
            // 各デモテナント用のRoute53レコードを作成
            for (const demoTenant of demoTenants) {
                const demoTenantId = demoTenant.appDomainName.replace(/\./g, "-");
                new aws_cdk_lib_1.aws_route53.ARecord(this, `CloudFrontAliasRecordDemo${demoTenantId}`, {
                    zone: baseDomainZoneMap[demoTenant.appDomainName],
                    recordName: demoTenant.appDomainName,
                    target: aws_cdk_lib_1.aws_route53.RecordTarget.fromAlias({
                        bind: () => ({
                            dnsName: aws_cdk_lib_1.Fn.getAtt(connectionGroup.logicalId, "RoutingEndpoint").toString(),
                            hostedZoneId: 'Z2FDTNDATAQYW2', // CloudFrontの固定ゾーンID
                        })
                    })
                });
            }
        }
        /*************************************
         * バックエンド用リソース
         *************************************/
        // ALB用ACM証明書（全テナントのAPIドメインに対応）
        const albCertificate = new aws_cdk_lib_1.aws_certificatemanager.Certificate(this, "AlbCertificate", {
            certificateName: `${this.stackName}-alb-certificate`,
            domainName: `api.${props.tenants[0].appDomainName}`, // プライマリドメインのAPIドメイン
            subjectAlternativeNames: [
                ...props.tenants
                    .slice(1)
                    .map((tenant) => `api.${tenant.appDomainName}`), // 他テナントのAPIドメイン
            ],
            validation: aws_cdk_lib_1.aws_certificatemanager.CertificateValidation.fromDnsMultiZone(apiDomainZoneMap),
        });
        // ALBセキュリティグループ
        const backendAlbSecurityGroup = new aws_cdk_lib_1.aws_ec2.SecurityGroup(this, "BackendAlbSecurityGroup", {
            vpc,
            description: "Security group for Backend ALB",
            allowAllOutbound: true,
        });
        // ALB
        const backendAlb = new aws_cdk_lib_1.aws_elasticloadbalancingv2.ApplicationLoadBalancer(this, "BackendAlb", {
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
            new aws_cdk_lib_1.aws_route53.ARecord(this, `AlbAliasRecord-${tenant.appDomainName.replace(/\./g, "-")}`, {
                zone: baseDomainZoneMap[tenant.appDomainName],
                recordName: `api.${tenant.appDomainName}`,
                target: aws_cdk_lib_1.aws_route53.RecordTarget.fromAlias(new aws_cdk_lib_1.aws_route53_targets.LoadBalancerTarget(backendAlb)),
            });
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
        logsBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            // ALB access logging needs S3 put permission from ALB service account for the region
            principals: [
                new aws_cdk_lib_1.aws_iam.AccountPrincipal(aws_cdk_lib_1.region_info.RegionInfo.get(aws_cdk_lib_1.Stack.of(this).region).elbv2Account),
            ],
            resources: [
                logsBucket.arnForObjects(`AWSLogs/${aws_cdk_lib_1.Stack.of(this).account}/*`),
            ],
        }));
        logsBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["s3:PutObject"],
            principals: [new aws_cdk_lib_1.aws_iam.ServicePrincipal("delivery.logs.amazonaws.com")],
            resources: [
                logsBucket.arnForObjects(`AWSLogs/${aws_cdk_lib_1.Stack.of(this).account}/*`),
            ],
            conditions: {
                StringEquals: {
                    "s3:x-amz-acl": "bucket-owner-full-control",
                },
            },
        }));
        logsBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["s3:GetBucketAcl"],
            principals: [new aws_cdk_lib_1.aws_iam.ServicePrincipal("delivery.logs.amazonaws.com")],
            resources: [logsBucket.bucketArn],
        }));
        backendAlb.addListener("HttpListener", {
            port: 80,
            protocol: aws_cdk_lib_1.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
            defaultAction: aws_cdk_lib_1.aws_elasticloadbalancingv2.ListenerAction.redirect({
                protocol: aws_cdk_lib_1.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
                port: "443",
                permanent: true,
            }),
        });
        const httpsListener = backendAlb.addListener("HttpsListener", {
            port: 443,
            protocol: aws_cdk_lib_1.aws_elasticloadbalancingv2.ApplicationProtocol.HTTPS,
            certificates: [albCertificate],
            sslPolicy: aws_cdk_lib_1.aws_elasticloadbalancingv2.SslPolicy.RECOMMENDED_TLS,
        });
        // ALB用WAF WebACL
        const albWebAcl = new aws_cdk_lib_1.aws_wafv2.CfnWebACL(this, "AlbWebACL", {
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
        const albWafLogsBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "AlbWafLogsBucket", {
            // WAFのログは"aws-waf-logs-"で始まるバケット名にする必要がある
            bucketName: `aws-waf-logs-${props.envName}-${this.account}-${albWebAcl.node.id.toLowerCase()}`,
            lifecycleRules: [
                {
                    id: "alb-waf-log-expiration",
                    enabled: true,
                    expiration: aws_cdk_lib_1.Duration.days(props?.logRetentionDays ?? 90),
                },
            ],
            blockPublicAccess: aws_cdk_lib_1.aws_s3.BlockPublicAccess.BLOCK_ALL,
            encryption: aws_cdk_lib_1.aws_s3.BucketEncryption.S3_MANAGED,
            enforceSSL: true,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            autoDeleteObjects: true,
        });
        // WAFログ出力設定
        const wafLogConfig = new aws_cdk_lib_1.aws_wafv2.CfnLoggingConfiguration(this, "AlbWafLogConfig", {
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
        // バケットポリシーが完全に作成された後にWAFログ設定を行うように依存関係を追加
        wafLogConfig.node.addDependency(albWafLogsBucket);
        // ALBにWAFを関連付け
        new aws_cdk_lib_1.aws_wafv2.CfnWebACLAssociation(this, "AlbWafAssociation", {
            resourceArn: backendAlb.loadBalancerArn,
            webAclArn: albWebAcl.attrArn,
        });
        // WAFログバケット用のポリシー @see https://repost.aws/ja/knowledge-center/waf-turn-on-logging
        albWafLogsBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            sid: "AWSLogDeliveryAclCheck",
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            principals: [new aws_cdk_lib_1.aws_iam.ServicePrincipal("delivery.logs.amazonaws.com")],
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
        }));
        albWafLogsBucket.addToResourcePolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            sid: "AWSLogDeliveryWrite",
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            principals: [new aws_cdk_lib_1.aws_iam.ServicePrincipal("delivery.logs.amazonaws.com")],
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
        }));
        // Data Firehose関係
        // ロググループ
        const backendKinesisErrorLogGroup = new aws_cdk_lib_1.aws_logs.LogGroup(this, "BackendKinesisErrorLogGroup", {
            logGroupName: `/aws/kinesisfirehose/${this.stackName}/backend-error-logs`,
            retention: props.logRetentionDays,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // ログストリーム
        const backendKinesisErrorAppLogStream = new aws_cdk_lib_1.aws_logs.LogStream(this, "BackendKinesisErrorAppLogStream", {
            logStreamName: "backend_kinesis_s3_delivery_app_error",
            logGroup: backendKinesisErrorLogGroup,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        const backendKinesisErrorWebLogStream = new aws_cdk_lib_1.aws_logs.LogStream(this, "BackendKinesisErrorWebLogStream", {
            logStreamName: "backend_kinesis_s3_delivery_web_error",
            logGroup: backendKinesisErrorLogGroup,
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // Firehose用のIAMロール
        const firehoseRole = new aws_cdk_lib_1.aws_iam.Role(this, "FirehoseRole", {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal("firehose.amazonaws.com"),
        });
        // S3バケットへのアクセス権限を付与
        logsBucket.grantReadWrite(firehoseRole);
        // CloudWatch Logsへのアクセス権限を付与
        backendKinesisErrorLogGroup.grantWrite(firehoseRole);
        // KMSキーの使用権限を付与（AWSマネージド型キーを参照）
        const kmsKey = aws_cdk_lib_1.aws_kms.Key.fromLookup(this, "S3KmsKey", {
            aliasName: "alias/aws/s3",
        });
        kmsKey.grantDecrypt(firehoseRole);
        kmsKey.grantEncrypt(firehoseRole);
        // appコンテナログ配信設定
        const backendAppLogDeliveryStream = new aws_cdk_lib_1.aws_kinesisfirehose.CfnDeliveryStream(this, "BackendAppLogDeliveryStream", {
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
        });
        // webコンテナログ配信設定
        const backendWebLogDeliveryStream = new aws_cdk_lib_1.aws_kinesisfirehose.CfnDeliveryStream(this, "BackendWebLogDeliveryStream", {
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
        });
        /*************************************
         * ECSリソース（バックエンド用）
         *************************************/
        // ECR
        const backendEcrRepository = new aws_cdk_lib_1.aws_ecr.Repository(this, "BackendEcrRepository", {
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
            lifecycleRules: [
                {
                    rulePriority: 10,
                    description: "app Delete more than 3 images",
                    tagStatus: aws_cdk_lib_1.aws_ecr.TagStatus.TAGGED,
                    tagPatternList: ["*app*"],
                    maxImageCount: 3,
                },
                {
                    rulePriority: 20,
                    description: "web Delete more than 3 images",
                    tagStatus: aws_cdk_lib_1.aws_ecr.TagStatus.TAGGED,
                    tagPatternList: ["*web*"],
                    maxImageCount: 3,
                },
                {
                    rulePriority: 30,
                    description: "log Delete more than 3 images",
                    tagStatus: aws_cdk_lib_1.aws_ecr.TagStatus.TAGGED,
                    tagPatternList: ["*log*"],
                    maxImageCount: 3,
                },
                {
                    rulePriority: 80,
                    description: "All Tagged Delete more than 3 images",
                    tagStatus: aws_cdk_lib_1.aws_ecr.TagStatus.TAGGED,
                    tagPatternList: ["*"],
                    maxImageCount: 3,
                },
                {
                    rulePriority: 90,
                    description: "All Untagged Delete more than 3 images",
                    tagStatus: aws_cdk_lib_1.aws_ecr.TagStatus.UNTAGGED,
                    maxImageCount: 3,
                },
            ],
        });
        // ECSクラスター
        const ecsCluster = new aws_cdk_lib_1.aws_ecs.Cluster(this, "EcsCluster", {
            vpc,
            enableFargateCapacityProviders: true,
            clusterName: aws_cdk_lib_1.PhysicalName.GENERATE_IF_NEEDED, // for crossRegionReferences
        });
        // タスク実行ロール
        const taskExecutionRole = new aws_cdk_lib_1.aws_iam.Role(this, "EcsTaskExecutionRole", {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com"),
            managedPolicies: [
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonECSTaskExecutionRolePolicy"),
            ],
            inlinePolicies: {
                taskExecutionPolicy: new aws_cdk_lib_1.aws_iam.PolicyDocument({
                    statements: [
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
        const taskRole = new aws_cdk_lib_1.aws_iam.Role(this, "EcsTaskRole", {
            assumedBy: new aws_cdk_lib_1.aws_iam.CompositePrincipal(new aws_cdk_lib_1.aws_iam.ServicePrincipal("ecs-tasks.amazonaws.com")),
            path: "/",
            managedPolicies: [
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("service-role/AmazonEC2ContainerServiceEventsRole"),
            ],
            inlinePolicies: {
                firehosePolicy: new aws_cdk_lib_1.aws_iam.PolicyDocument({
                    statements: [
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: ["firehose:PutRecordBatch"],
                            resources: [
                                `arn:aws:firehose:${this.region}:${this.account}:deliverystream/${backendAppLogDeliveryStream.ref}`,
                                `arn:aws:firehose:${this.region}:${this.account}:deliverystream/${backendWebLogDeliveryStream.ref}`,
                            ],
                        }),
                    ],
                }),
                // S3アップロード用の権限を追加
                s3UploadPolicy: new aws_cdk_lib_1.aws_iam.PolicyDocument({
                    statements: [
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
                sesPolicy: new aws_cdk_lib_1.aws_iam.PolicyDocument({
                    statements: [
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
        const dbSecret = new aws_cdk_lib_1.aws_secretsmanager.Secret(this, "AuroraSecret", {
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
        new aws_cdk_lib_1.aws_secretsmanager.Secret(this, "AuroraReadOnlySecret", {
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
        new aws_cdk_lib_1.aws_secretsmanager.Secret(this, "AuroraReadWriteSecret", {
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
        const backendEcsTask = new aws_cdk_lib_1.aws_ecs.FargateTaskDefinition(this, "BackendEcsTask", {
            family: `${this.stackName}-backend`,
            taskRole: taskRole,
            executionRole: taskExecutionRole,
            cpu: props.backendEcsTaskCpu,
            memoryLimitMiB: props.backendEcsTaskMemory,
            runtimePlatform: {
                cpuArchitecture: aws_cdk_lib_1.aws_ecs.CpuArchitecture.ARM64,
                operatingSystemFamily: aws_cdk_lib_1.aws_ecs.OperatingSystemFamily.LINUX,
            },
        });
        // webコンテナ
        backendEcsTask.addContainer("web", {
            image: aws_cdk_lib_1.aws_ecs.ContainerImage.fromEcrRepository(backendEcrRepository, "web"),
            portMappings: [{ containerPort: 80, hostPort: 80 }],
            readonlyRootFilesystem: false,
            logging: aws_cdk_lib_1.aws_ecs.LogDrivers.firelens({}),
        });
        // appコンテナ
        backendEcsTask.addContainer("app", {
            image: aws_cdk_lib_1.aws_ecs.ContainerImage.fromEcrRepository(backendEcrRepository, "app"),
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
                DB_HOST: aws_cdk_lib_1.aws_ecs.Secret.fromSecretsManager(dbSecret, "host"),
                DB_PORT: aws_cdk_lib_1.aws_ecs.Secret.fromSecretsManager(dbSecret, "port"),
                DB_USERNAME: aws_cdk_lib_1.aws_ecs.Secret.fromSecretsManager(dbSecret, "username"),
                DB_DATABASE: aws_cdk_lib_1.aws_ecs.Secret.fromSecretsManager(dbSecret, "dbname"),
                DB_PASSWORD: aws_cdk_lib_1.aws_ecs.Secret.fromSecretsManager(dbSecret, "password"),
                // SSMパラメータストアから取得した値
                APP_KEY: aws_cdk_lib_1.aws_ecs.Secret.fromSsmParameter(aws_cdk_lib_1.aws_ssm.StringParameter.fromSecureStringParameterAttributes(this, "AppContainerDefAppKeyParam", {
                    parameterName: `/${this.stackName}/ecs-task-def/app/env-vars/app-key`,
                })),
            },
            readonlyRootFilesystem: false,
            logging: aws_cdk_lib_1.aws_ecs.LogDrivers.firelens({}),
        });
        // log-routerコンテナ
        backendEcsTask.addFirelensLogRouter("log-router", {
            image: aws_cdk_lib_1.aws_ecs.ContainerImage.fromEcrRepository(backendEcrRepository, "log-router"),
            environment: {
                KINESIS_APP_DELIVERY_STREAM: backendAppLogDeliveryStream.ref,
                KINESIS_WEB_DELIVERY_STREAM: backendWebLogDeliveryStream.ref,
                AWS_REGION: this.region,
            },
            secrets: {
                APP_LOG_SLACK_WEBHOOK_URL: aws_cdk_lib_1.aws_ecs.Secret.fromSsmParameter(aws_cdk_lib_1.aws_ssm.StringParameter.fromSecureStringParameterAttributes(this, "LogRouterContainerDefAppLogSlackWebhookUrlParam", {
                    parameterName: `/${this.stackName}/ecs-task-def/log-router/env-vars/app-log-slack-webhook-url`,
                })),
            },
            user: "0",
            logging: aws_cdk_lib_1.aws_ecs.LogDrivers.awsLogs({
                streamPrefix: "firelens",
                logGroup: new aws_cdk_lib_1.aws_logs.LogGroup(this, "BackendLogRouterLogGroup", {
                    logGroupName: `/aws/ecs/${this.stackName}/backend-logrouter-logs`,
                    retention: props.logRetentionDays,
                    removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
                }),
            }),
            firelensConfig: {
                type: aws_cdk_lib_1.aws_ecs.FirelensLogRouterType.FLUENTBIT,
                options: {
                    configFileType: aws_cdk_lib_1.aws_ecs.FirelensConfigFileType.FILE,
                    configFileValue: "/fluent-bit.conf",
                    enableECSLogMetadata: false,
                },
            },
        });
        // ECSサービス用セキュリティグループ
        const backendEcsServiceSecurityGroup = new aws_cdk_lib_1.aws_ec2.SecurityGroup(this, "BackendEcsServiceSecurityGroup", {
            vpc,
            description: "Security group for Backend ECS Service",
            allowAllOutbound: true, // for AWS APIs
        });
        // ECSサービス
        const backendEcsService = new aws_cdk_lib_1.aws_ecs.FargateService(this, "BackendEcsService", {
            cluster: ecsCluster,
            taskDefinition: backendEcsTask,
            desiredCount: props.backendDesiredCount,
            enableExecuteCommand: true,
            platformVersion: aws_cdk_lib_1.aws_ecs.FargatePlatformVersion.LATEST,
            // https://docs.aws.amazon.com/cdk/api/latest/docs/aws-ecs-readme.html#fargate-capacity-providers
            capacityProviderStrategies: [
                {
                    capacityProvider: "FARGATE",
                    weight: 1,
                },
            ],
            minHealthyPercent: 100,
            maxHealthyPercent: 200,
            securityGroups: [backendEcsServiceSecurityGroup],
            serviceName: aws_cdk_lib_1.PhysicalName.GENERATE_IF_NEEDED,
        });
        const ecsServiceName = backendEcsService.serviceName;
        // ALBのターゲットグループ
        const appTargetGroup = httpsListener.addTargets("AppTargetGroup", {
            protocol: aws_cdk_lib_1.aws_elasticloadbalancingv2.ApplicationProtocol.HTTP,
            targets: [backendEcsService],
            deregistrationDelay: aws_cdk_lib_1.Duration.seconds(30),
        });
        appTargetGroup.configureHealthCheck({
            path: props.healthCheckPath,
            enabled: true,
            healthyThresholdCount: 2,
            unhealthyThresholdCount: 2,
            timeout: aws_cdk_lib_1.Duration.seconds(2),
            interval: aws_cdk_lib_1.Duration.seconds(10),
            healthyHttpCodes: "200",
        });
        // スケーラブルターゲット
        const backendScalableTarget = new aws_cdk_lib_1.aws_applicationautoscaling.ScalableTarget(this, "BackendScalableTarget", {
            serviceNamespace: aws_cdk_lib_1.aws_applicationautoscaling.ServiceNamespace.ECS,
            maxCapacity: props.backendMaxTaskCount,
            minCapacity: props.backendMinTaskCount,
            resourceId: `service/${ecsCluster.clusterName}/${ecsServiceName}`,
            scalableDimension: "ecs:service:DesiredCount",
        });
        // ステップスケーリングアウトポリシーの定義
        const backendStepScaleOutPolicy = new aws_cdk_lib_1.aws_applicationautoscaling.StepScalingPolicy(this, "BackendStepScaleOutPolicy", {
            scalingTarget: backendScalableTarget,
            adjustmentType: aws_cdk_lib_1.aws_applicationautoscaling.AdjustmentType.PERCENT_CHANGE_IN_CAPACITY,
            metricAggregationType: aws_cdk_lib_1.aws_applicationautoscaling.MetricAggregationType.MAXIMUM,
            // クールダウン期間
            cooldown: aws_cdk_lib_1.Duration.seconds(180),
            // 評価ポイント数
            evaluationPeriods: props.backendEcsScaleOutEvaluationPeriods,
            // ステップの定義
            scalingSteps: [
                { lower: 0, upper: 80, change: 0 }, // CPU使用率が80%未満の場合、スケールインは行わない
                { lower: 80, change: 50 }, // CPU使用率が80%を超えた場合、タスク数を50%増加させる
            ],
            metric: new aws_cdk_lib_1.aws_cloudwatch.Metric({
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
        });
        // ステップスケーリングインポリシーの定義
        const stepScaleInBackendPolicy = new aws_cdk_lib_1.aws_applicationautoscaling.StepScalingPolicy(this, "StepScalingInBackendPolicy", {
            scalingTarget: backendScalableTarget,
            adjustmentType: aws_cdk_lib_1.aws_applicationautoscaling.AdjustmentType.PERCENT_CHANGE_IN_CAPACITY,
            metricAggregationType: aws_cdk_lib_1.aws_applicationautoscaling.MetricAggregationType.MAXIMUM,
            // クールダウン期間
            cooldown: aws_cdk_lib_1.Duration.seconds(300),
            // 評価ポイント数
            evaluationPeriods: props.backendEcsScaleInEvaluationPeriods,
            // ステップの定義
            scalingSteps: [
                { upper: 60, change: -20 }, // CPU使用率が60%未満の場合、タスク数を20%減少させる
                { lower: 60, change: 0 }, // CPU使用率が60%以上80%未満の場合、タスク数は変更しない
            ],
            metric: new aws_cdk_lib_1.aws_cloudwatch.Metric({
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
        });
        // ECSタスクを自動停止・開始設定するためのIAMロール
        const autoScalingSchedulerExecutionRole = new aws_cdk_lib_1.aws_iam.Role(this, "AutoScalingSchedulerExecutionRole", {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal("scheduler.amazonaws.com"),
        });
        autoScalingSchedulerExecutionRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["application-autoscaling:RegisterScalableTarget"],
            resources: ["*"], // CDKではARNを取得できないため"*"を指定
        }));
        // ECSタスクを停止するスケジュール（スケーラブルターゲットの最小・最大タスク数を0に設定する）
        new aws_cdk_lib_1.aws_scheduler.CfnSchedule(this, "AutoScalingStopSchedule", {
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
        new aws_cdk_lib_1.aws_scheduler.CfnSchedule(this, "AutoScalingStartSchedule", {
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
        const parameterGroup = new aws_cdk_lib_1.aws_rds.ParameterGroup(this, "ParameterGroup", {
            engine: aws_cdk_lib_1.aws_rds.DatabaseClusterEngine.auroraPostgres({
                version: PostgresVersion,
            }),
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // サブネットグループ
        const subnetGroup = new aws_cdk_lib_1.aws_rds.SubnetGroup(this, "SubnetGroup", {
            description: "Subnet group for Aurora database",
            vpc: vpc,
            vpcSubnets: {
                subnetType: aws_cdk_lib_1.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
            removalPolicy: aws_cdk_lib_1.RemovalPolicy.DESTROY,
        });
        // KMSキー
        const auroraEncryptionKey = new aws_cdk_lib_1.aws_kms.Key(this, "AuroraStorageEncryptionKey", {
            enableKeyRotation: true,
            description: "KMS key for Aurora storage encryption",
        });
        // Aurora Serverless cluster
        const dbCluster = new aws_cdk_lib_1.aws_rds.DatabaseCluster(this, "AuroraServerlessCluster", {
            engine: aws_cdk_lib_1.aws_rds.DatabaseClusterEngine.auroraPostgres({
                version: PostgresVersion,
            }),
            credentials: aws_cdk_lib_1.aws_rds.Credentials.fromSecret(dbSecret),
            writer: aws_cdk_lib_1.aws_rds.ClusterInstance.serverlessV2("Writer", {
                performanceInsightRetention: aws_cdk_lib_1.aws_rds.PerformanceInsightRetention.DEFAULT, // Performance Insightsを7日間有効化
                autoMinorVersionUpgrade: false, // マイナーバージョンアップグレードを無効化
                preferredMaintenanceWindow: "Sun:13:30-Sun:14:00", // 日本時間の日曜22:30-23:00にメンテナンス実施
            }),
            readers: props.isReadReplicaEnabled
                ? [
                    aws_cdk_lib_1.aws_rds.ClusterInstance.serverlessV2("Reader", {
                        performanceInsightRetention: aws_cdk_lib_1.aws_rds.PerformanceInsightRetention.DEFAULT,
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
                retention: aws_cdk_lib_1.Duration.days(7), // バックアップ保持期間を7日に設定
                preferredWindow: "16:00-17:00", // 日本時間の01:00-02:00に自動バックアップ実施
            },
            preferredMaintenanceWindow: "Sun:13:00-Sun:13:30", // 日本時間の日曜22:00-22:30にメンテナンス実施
            deletionProtection: props.auroraDeletionProtection,
        });
        //ECSタスクロールにDBアクセス許可を追加
        taskExecutionRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["rds-db:connect", "rds:DescribeDBInstances"],
            resources: [dbCluster.clusterArn],
        }));
        // DBパスワードのローテーションを有効化
        dbCluster.addRotationSingleUser({
            automaticallyAfter: aws_cdk_lib_1.Duration.days(30),
            excludeCharacters: '"@/\\',
        });
        // DBの自動定期開始・停止設定
        // EventBridge Schedulerの実行ロール
        const auroraSchedulerExecutionRole = new aws_cdk_lib_1.aws_iam.Role(this, "AuroraSchedulerExecutionRole", {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal("scheduler.amazonaws.com"),
        });
        auroraSchedulerExecutionRole.addToPolicy(new aws_cdk_lib_1.aws_iam.PolicyStatement({
            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
            actions: ["rds:StopDBCluster", "rds:StartDBCluster"],
            resources: [dbCluster.clusterArn],
        }));
        // 開始スケジュール
        new aws_cdk_lib_1.aws_scheduler.CfnSchedule(this, "AuroraStartSchedule", {
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
        new aws_cdk_lib_1.aws_scheduler.CfnSchedule(this, "AuroraStopSchedule", {
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
        const bastionHost = new aws_cdk_lib_1.aws_ec2.BastionHostLinux(this, "BastionHost", {
            vpc,
            instanceType: aws_cdk_lib_1.aws_ec2.InstanceType.of(aws_cdk_lib_1.aws_ec2.InstanceClass.T2, aws_cdk_lib_1.aws_ec2.InstanceSize.NANO),
            machineImage: aws_cdk_lib_1.aws_ec2.MachineImage.latestAmazonLinux2023({
                cpuType: aws_cdk_lib_1.aws_ec2.AmazonLinuxCpuType.X86_64,
            }),
            subnetSelection: {
                subnetType: aws_cdk_lib_1.aws_ec2.SubnetType.PRIVATE_WITH_EGRESS,
            },
        });
        bastionHost.instance.userData.addCommands("sudo dnf update -y", `sudo dnf install -y postgresql${props.postgresClientVersion}`);
        // 踏み台サーバーからAuroraへのアクセスを許可
        dbCluster.connections.allowFrom(bastionHost, aws_cdk_lib_1.aws_ec2.Port.tcp(5432), "Allow access from Bastion host");
        // Backend ECS ServiceからAuroraへのアクセスを許可
        dbCluster.connections.allowFrom(backendEcsServiceSecurityGroup, aws_cdk_lib_1.aws_ec2.Port.tcp(5432), "Allow access from Backend ECS Service");
        /*************************************
         * メール送信機能
         *************************************/
        // 各テナントドメインのSES設定
        for (const tenant of props.tenants) {
            // SESの作成が有効な場合のみ実行
            if (tenant.isSesEnabled) {
                // SES ID
                new aws_cdk_lib_1.aws_ses.EmailIdentity(this, `EmailIdentity-${tenant.appDomainName.replace(/\./g, "-")}`, {
                    identity: aws_cdk_lib_1.aws_ses.Identity.publicHostedZone(baseDomainZoneMap[tenant.appDomainName]),
                    mailFromDomain: `bounce.${tenant.appDomainName}`,
                });
                // DMARC設定
                new aws_cdk_lib_1.aws_route53.TxtRecord(this, `DmarcRecord-${tenant.appDomainName.replace(/\./g, "-")}`, {
                    zone: baseDomainZoneMap[tenant.appDomainName],
                    recordName: `_dmarc.${tenant.appDomainName}`,
                    values: [`v=DMARC1; p=none; rua=mailto:${props.dmarcReportEmail}`],
                    ttl: aws_cdk_lib_1.Duration.hours(1),
                });
            }
            else {
                // SESの作成が無効な場合、スキップされたことをログに出力（CDK synth/deploy時に表示される）
                console.log(`Skipping SES Identity and DMARC Record creation for tenant: ${tenant.appDomainName} as isSesEnabled is false.`);
            }
        }
        /*************************************
         * SNSトピック・Chatbot
         *************************************/
        const warningSnsTopic = new aws_cdk_lib_1.aws_sns.Topic(this, "WarningSnsTopic", {});
        // Chatbot用IAMロール
        const slackChatbotRole = new aws_cdk_lib_1.aws_iam.Role(this, "SlackChatbotRole", {
            assumedBy: new aws_cdk_lib_1.aws_iam.ServicePrincipal("chatbot.amazonaws.com"),
            inlinePolicies: {
                SlackNotificationChatBotPolicy: new aws_cdk_lib_1.aws_iam.PolicyDocument({
                    statements: [
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
        new aws_cdk_lib_1.aws_chatbot.SlackChannelConfiguration(this, "WarningSlackChannelConfig", {
            slackChannelConfigurationName: `${this.stackName}-${this.node.id}`,
            slackChannelId: props.warningSlackChannelId,
            slackWorkspaceId: props.slackWorkspaceId,
            notificationTopics: [warningSnsTopic],
            loggingLevel: aws_cdk_lib_1.aws_chatbot.LoggingLevel.ERROR,
            guardrailPolicies: [
                aws_cdk_lib_1.aws_iam.ManagedPolicy.fromAwsManagedPolicyName("ReadOnlyAccess"),
            ],
            role: slackChatbotRole,
        });
        /*************************************
         * CloudWatchアラーム
         *************************************/
        // CPUUtilization
        const auroraCpuUtilizationAlarm = new aws_cdk_lib_1.aws_cloudwatch.Alarm(this, "AuroraCpuUtilizationAlarm", {
            alarmDescription: "Aurora CPU Utilization exceeds 80%",
            metric: new aws_cdk_lib_1.aws_cloudwatch.Metric({
                namespace: "AWS/RDS",
                metricName: "CPUUtilization",
                dimensionsMap: {
                    DBClusterIdentifier: dbCluster.clusterIdentifier,
                },
                statistic: "Average",
                period: aws_cdk_lib_1.Duration.seconds(300),
            }),
            evaluationPeriods: 1,
            threshold: 80,
            comparisonOperator: aws_cdk_lib_1.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: aws_cdk_lib_1.aws_cloudwatch.TreatMissingData.BREACHING,
        });
        // アラームアクションの設定
        auroraCpuUtilizationAlarm.addAlarmAction(new aws_cdk_lib_1.aws_cloudwatch_actions.SnsAction(warningSnsTopic));
        auroraCpuUtilizationAlarm.addOkAction(new aws_cdk_lib_1.aws_cloudwatch_actions.SnsAction(warningSnsTopic));
        // FreeableMemory
        const auroraFreeableMemoryAlarm = new aws_cdk_lib_1.aws_cloudwatch.Alarm(this, "AuroraFreeableMemoryAlarm", {
            alarmDescription: "Aurora FreeableMemory exceeds 95%",
            metric: new aws_cdk_lib_1.aws_cloudwatch.Metric({
                namespace: "AWS/RDS",
                metricName: "FreeableMemory",
                dimensionsMap: {
                    DBClusterIdentifier: dbCluster.clusterIdentifier,
                },
                statistic: "Average",
                period: aws_cdk_lib_1.Duration.seconds(300),
            }),
            evaluationPeriods: 1,
            // メモリ空き容量の閾値を設定...最大メモリ容量の5%
            // - 最大ACU数 × 2GB = 最大メモリ容量 (1ACUあたり2GBのメモリ)
            // - メモリ空き容量が最大メモリ容量の5%以下になったらアラート（メモリ使用量が95%以上になったらアラート）
            threshold: props.auroraServerlessV2MaxCapacity * 2 * 0.05,
            comparisonOperator: aws_cdk_lib_1.aws_cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            treatMissingData: aws_cdk_lib_1.aws_cloudwatch.TreatMissingData.BREACHING,
        });
        // アラームアクションの設定
        auroraFreeableMemoryAlarm.addAlarmAction(new aws_cdk_lib_1.aws_cloudwatch_actions.SnsAction(warningSnsTopic));
        auroraFreeableMemoryAlarm.addOkAction(new aws_cdk_lib_1.aws_cloudwatch_actions.SnsAction(warningSnsTopic));
        // ACUUtilization
        const auroraAcuUtilizationAlarm = new aws_cdk_lib_1.aws_cloudwatch.Alarm(this, "AuroraAcuUtilizationAlarm", {
            alarmDescription: "Aurora ACUUtilization exceeds 80%",
            metric: new aws_cdk_lib_1.aws_cloudwatch.Metric({
                namespace: "AWS/RDS",
                metricName: "ACUUtilization",
                dimensionsMap: {
                    DBClusterIdentifier: dbCluster.clusterIdentifier,
                },
                statistic: "Average",
                period: aws_cdk_lib_1.Duration.seconds(300),
            }),
            evaluationPeriods: 1,
            threshold: 80,
            comparisonOperator: aws_cdk_lib_1.aws_cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treatMissingData: aws_cdk_lib_1.aws_cloudwatch.TreatMissingData.BREACHING,
        });
        // アラームアクションの設定
        auroraAcuUtilizationAlarm.addAlarmAction(new aws_cdk_lib_1.aws_cloudwatch_actions.SnsAction(warningSnsTopic));
        auroraAcuUtilizationAlarm.addOkAction(new aws_cdk_lib_1.aws_cloudwatch_actions.SnsAction(warningSnsTopic));
        // GitHub Actions用のOIDCプロバイダー
        const githubActionsOidcProviderArn = aws_cdk_lib_1.Fn.importValue("GitHubActionsOidcProviderArn");
        //GitHub Actions用のIAMロールとポリシー
        new aws_cdk_lib_1.aws_iam.Role(this, "GitHubActionsRole", {
            roleName: `${this.stackName}-GitHubActionsRole`,
            assumedBy: new aws_cdk_lib_1.aws_iam.WebIdentityPrincipal(githubActionsOidcProviderArn, {
                StringLike: {
                    "token.actions.githubusercontent.com:sub": `repo:${props.githubOrgName}/${props.githubRepositoryName}:*`,
                },
            }),
            inlinePolicies: {
                GitHubActionsPolicy: new aws_cdk_lib_1.aws_iam.PolicyDocument({
                    // --- バックエンドアプリ用 ---
                    statements: [
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: [
                                "ecr:GetAuthorizationToken",
                                "ecs:ListServices",
                                "sts:GetCallerIdentity",
                            ],
                            resources: ["*"],
                        }),
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: ["cloudformation:DescribeStacks"],
                            resources: [
                                `arn:${this.partition}:cloudformation:${this.region}:${this.account}:stack/${this.stackName}/*`,
                            ],
                        }),
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: ["ecs:DescribeClusters"],
                            resources: [ecsCluster.clusterArn],
                        }),
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: ["ecs:UpdateService", "ecs:DescribeServices"],
                            resources: [backendEcsService.serviceArn],
                        }),
                        // --- フロントエンドアプリ用 ---
                        // S3バケットへのアクセス権限
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: [
                                // テナント一覧取得
                                "cloudfront:ListDistributionTenants",
                                // テナント単位でのキャッシュ無効化
                                "cloudfront:CreateInvalidationForDistributionTenant",
                                // キャッシュ無効化の状態確認（waitコマンドで必要）
                                "cloudfront:GetInvalidationForDistributionTenant",
                            ],
                            resources: ["*"]
                        }),
                        // ECSタスク関連の権限を追加
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: ["ecs:RunTask", "ecs:DescribeTasks", "ecs:ListTasks"],
                            resources: [
                                // タスク定義に対する権限
                                `arn:${this.partition}:ecs:${this.region}:${this.account}:task-definition/${this.stackName}-backend*`,
                                // タスクに対する権限
                                `arn:${this.partition}:ecs:${this.region}:${this.account}:task/${ecsCluster.clusterName}/*`,
                            ],
                        }),
                        // タスク定義関連の権限
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
                            actions: [
                                "ecs:DescribeTaskDefinition",
                                "ecs:RegisterTaskDefinition",
                                "ecs:DeregisterTaskDefinition",
                            ],
                            resources: ["*"], // これらのアクションはリソースレベルの制限をサポートしていない
                        }),
                        // タスク実行に必要なIAMロールのPassRole権限
                        new aws_cdk_lib_1.aws_iam.PolicyStatement({
                            effect: aws_cdk_lib_1.aws_iam.Effect.ALLOW,
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
        new aws_cdk_lib_1.CfnOutput(this, "EcrRepositoryUri", {
            value: `${this.account}.dkr.ecr.${this.region}.amazonaws.com/${backendEcrRepository.repositoryName}`,
        });
        new aws_cdk_lib_1.CfnOutput(this, "EcsClusterArn", {
            value: ecsCluster.clusterArn,
            exportName: "EcsClusterArn",
        });
        new aws_cdk_lib_1.CfnOutput(this, "BackendEcsServiceName", {
            value: ecsServiceName,
        });
        new aws_cdk_lib_1.CfnOutput(this, "BackendTaskDefinitionFamily", {
            value: backendEcsTask.family,
        });
        new aws_cdk_lib_1.CfnOutput(this, "BackendEcsServiceSecurityGroupId", {
            value: backendEcsServiceSecurityGroup.securityGroupId,
        });
        new aws_cdk_lib_1.CfnOutput(this, "PrivateSubnet1Id", {
            value: vpc.privateSubnets[0].subnetId,
        });
        // GitHub Actions用のOutputs（フロントエンドアプリ用）
        new aws_cdk_lib_1.CfnOutput(this, "FrontendBucketName", {
            value: frontendBucket.bucketName,
        });
        new aws_cdk_lib_1.CfnOutput(this, "FrontendCloudFrontDistributionId", {
            value: cloudFrontDistribution.distributionId,
        });
        // 通常テナントのディストリビューションテナントIDをエクスポート
        for (const tenant of normalTenants) {
            const tenantId = tenant.appDomainName.replace(/\./g, "-");
            new aws_cdk_lib_1.CfnOutput(this, `FrontendDistributionTenantId-${tenantId}`, {
                value: `DistributionTenant-${tenantId}`,
                description: `Frontend Distribution Tenant ID for ${tenant.appDomainName}`,
            });
        }
        // デモテナント用の共通ディストリビューションテナントIDをエクスポート
        if (demoTenants.length > 0) {
            new aws_cdk_lib_1.CfnOutput(this, "FrontendDistributionTenantIdDemo", {
                value: "DistributionTenant-Demo",
                description: "Frontend Distribution Tenant ID for demo tenants",
            });
        }
    }
}
exports.MainStack = MainStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi1zdGFjay5qcyIsInNvdXJjZVJvb3QiOiIiLCJzb3VyY2VzIjpbIm1haW4tc3RhY2sudHMiXSwibmFtZXMiOltdLCJtYXBwaW5ncyI6Ijs7O0FBQUEsbUZBQTZFO0FBQzdFLDZDQWdDcUI7QUFJckIsTUFBYSxTQUFVLFNBQVEsbUJBQUs7SUFDbEMsWUFBWSxLQUFnQixFQUFFLEVBQVUsRUFBRSxLQUFxQjtRQUM3RCxLQUFLLENBQUMsS0FBSyxFQUFFLEVBQUUsRUFBRSxLQUFLLENBQUMsQ0FBQztRQUV4QixJQUFJLENBQUMsS0FBSyxDQUFDLDRCQUE0QixJQUFJLENBQUMsS0FBSyxDQUFDLGdCQUFnQixFQUFFLENBQUM7WUFDbkUsTUFBTSxJQUFJLEtBQUssQ0FDYix1RUFBdUUsQ0FDeEUsQ0FBQztRQUNKLENBQUM7UUFFRCx1QkFBdUI7UUFDdkIsTUFBTSxpQkFBaUIsR0FBd0MsRUFBRSxDQUFDO1FBQ2xFLEtBQUssTUFBTSxNQUFNLElBQUksS0FBSyxDQUFDLE9BQU8sRUFBRSxDQUFDO1lBQ25DLGlCQUFpQixDQUFDLE1BQU0sQ0FBQyxhQUFhLENBQUM7Z0JBQ3JDLHlCQUFPLENBQUMsVUFBVSxDQUFDLHdCQUF3QixDQUN6QyxJQUFJLEVBQ0osY0FBYyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLEVBQUUsRUFDeEQ7b0JBQ0UsWUFBWSxFQUFFLE1BQU0sQ0FBQyxtQkFBbUI7b0JBQ3hDLFFBQVEsRUFBRSxNQUFNLENBQUMsYUFBYTtpQkFDL0IsQ0FDRixDQUFDO1FBQ04sQ0FBQztRQUVELHVCQUF1QjtRQUN2QixNQUFNLGdCQUFnQixHQUF3QyxFQUFFLENBQUM7UUFDakUsS0FBSyxNQUFNLE1BQU0sSUFBSSxLQUFLLENBQUMsT0FBTyxFQUFFLENBQUM7WUFDbkMsb0NBQW9DO1lBQ3BDLE1BQU0sU0FBUyxHQUFHLE9BQU8sTUFBTSxDQUFDLGFBQWEsRUFBRSxDQUFDO1lBQ2hELGdCQUFnQixDQUFDLFNBQVMs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QUMsQ0FBQyxDQUFDLENBQUMsUUFBUTtTQUN0QyxDQUFDLENBQUM7UUFFSCx1Q0FBdUM7UUFDdkMsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxvQkFBb0IsRUFBRTtZQUN4QyxLQUFLLEVBQUUsY0FBYyxDQUFDLFVBQVU7U0FDakMsQ0FBQyxDQUFDO1FBQ0gsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxrQ0FBa0MsRUFBRTtZQUN0RCxLQUFLLEVBQUUsc0JBQXNCLENBQUMsY0FBYztTQUM3QyxDQUFDLENBQUM7UUFDSCxrQ0FBa0M7UUFDbEMsS0FBSyxNQUFNLE1BQU0sSUFBSSxhQUFhLEVBQUUsQ0FBQztZQUNuQyxNQUFNLFFBQVEsR0FBRyxNQUFNLENBQUMsYUFBYSxDQUFDLE9BQU8sQ0FBQyxLQUFLLEVBQUUsR0FBRyxDQUFDLENBQUM7WUFDMUQsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxnQ0FBZ0MsUUFBUSxFQUFFLEVBQUU7Z0JBQzlELEtBQUssRUFBRSxzQkFBc0IsUUFBUSxFQUFFO2dCQUN2QyxXQUFXLEVBQUUsdUNBQXVDLE1BQU0sQ0FBQyxhQUFhLEVBQUU7YUFDM0UsQ0FBQyxDQUFDO1FBQ0wsQ0FBQztRQUVELHFDQUFxQztRQUNyQyxJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDM0IsSUFBSSx1QkFBUyxDQUFDLElBQUksRUFBRSxrQ0FBa0MsRUFBRTtnQkFDdEQsS0FBSyxFQUFFLHlCQUF5QjtnQkFDaEMsV0FBVyxFQUFFLGtEQUFrRDthQUNoRSxDQUFDLENBQUM7UUFDTCxDQUFDO0lBQ0gsQ0FBQztDQUNGO0FBam9ERCw4QkFpb0RDIiwic291cmNlc0NvbnRlbnQiOlsiaW1wb3J0IHsgQ2xvdWRGcm9udFRvUzMgfSBmcm9tIFwiQGF3cy1zb2x1dGlvbnMtY29uc3RydWN0cy9hd3MtY2xvdWRmcm9udC1zM1wiO1xuaW1wb3J0IHtcbiAgQ2ZuT3V0cHV0LFxuICBEdXJhdGlvbixcbiAgRm4sXG4gIFBoeXNpY2FsTmFtZSxcbiAgUmVtb3ZhbFBvbGljeSxcbiAgU3RhY2ssXG4gIGF3c19jZXJ0aWZpY2F0ZW1hbmFnZXIgYXMgYWNtLFxuICBhd3NfYXBwbGljYXRpb25hdXRvc2NhbGluZyBhcyBhcHBsaWNhdGlvbmF1dG9zY2FsaW5nLFxuICBhd3NfY2hhdGJvdCBhcyBjaGF0Ym90LFxuICBhd3NfY2xvdWRmcm9udCBhcyBjbG91ZGZyb250LFxuICBhd3NfY2xvdWR3YXRjaCBhcyBjdyxcbiAgYXdzX2Nsb3Vkd2F0Y2hfYWN0aW9ucyBhcyBjd19hY3Rpb25zLFxuICBhd3NfZWMyIGFzIGVjMixcbiAgYXdzX2VjciBhcyBlY3IsXG4gIGF3c19lY3MgYXMgZWNzLFxuICBhd3NfZWxhc3RpY2xvYWRiYWxhbmNpbmd2MiBhcyBlbGJ2MixcbiAgYXdzX2tpbmVzaXNmaXJlaG9zZSBhcyBmaXJlaG9zZSxcbiAgYXdzX2lhbSBhcyBpYW0sXG4gIGF3c19rbXMgYXMga21zLFxuICBhd3NfbG9ncyBhcyBsb2dzLFxuICBhd3NfcmRzIGFzIHJkcyxcbiAgcmVnaW9uX2luZm8gYXMgcmksXG4gIGF3c19yb3V0ZTUzIGFzIHJvdXRlNTMsXG4gIGF3c19zMyBhcyBzMyxcbiAgYXdzX3NjaGVkdWxlciBhcyBzY2hlZHVsZXIsXG4gIGF3c19zZWNyZXRzbWFuYWdlciBhcyBzZWNyZXRzbWFuYWdlcixcbiAgYXdzX3NlcyBhcyBzZXMsXG4gIGF3c19zbnMgYXMgc25zLFxuICBhd3Nfc3NtIGFzIHNzbSxcbiAgYXdzX3JvdXRlNTNfdGFyZ2V0cyBhcyB0YXJnZXRzLFxuICBhd3Nfd2FmdjIgYXMgd2FmdjIsXG59IGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHR5cGUgeyBDb25zdHJ1Y3QgfSBmcm9tIFwiY29uc3RydWN0c1wiO1xuaW1wb3J0IHR5cGUgeyBNYWluU3RhY2tQcm9wcyB9IGZyb20gXCIuLi90eXBlcy9wYXJhbXNcIjtcblxuZXhwb3J0IGNsYXNzIE1haW5TdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IE1haW5TdGFja1Byb3BzKSB7XG4gICAgc3VwZXIoc2NvcGUsIGlkLCBwcm9wcyk7XG5cbiAgICBpZiAoIXByb3BzLmNsb3VkRnJvbnRUZW5hbnRDZXJ0aWZpY2F0ZXMgfHwgIXByb3BzLmNsb3VkRnJvbnRXZWJBY2wpIHtcbiAgICAgIHRocm93IG5ldyBFcnJvcihcbiAgICAgICAgXCJHbG9iYWxTdGFja+OBi+OCieWPluW+l+OBl+OBn+OAgeOAjGNsb3VkZnJvbnRDZXJ0aWZpY2F0ZeOAjeOBqOOAjGNsb3VkRnJvbnRXZWJBY2zjgI3jga7kuKHmlrnjgYzlv4XpoIjjgafjgZnjgIJcIixcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g44OZ44O844K544OJ44Oh44Kk44Oz44Go44Ob44K544OI44K+44O844Oz44Gu44Oe44OD44OU44Oz44KwXG4gICAgY29uc3QgYmFzZURvbWFpblpvbmVNYXA6IFJlY29yZDxzdHJpbmcsIHJvdXRlNTMuSUhvc3RlZFpvbmU+ID0ge307XG4gICAgZm9yIChjb25zdCB0ZW5hbnQgb2YgcHJvcHMudGVuYW50cykge1xuICAgICAgYmFzZURvbWFpblpvbmVNYXBbdGVuYW50LmFwcERvbWFpbk5hbWVdID1cbiAgICAgICAgcm91dGU1My5Ib3N0ZWRab25lLmZyb21Ib3N0ZWRab25lQXR0cmlidXRlcyhcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGBIb3N0ZWRab25lLSR7dGVuYW50LmFwcERvbWFpbk5hbWUucmVwbGFjZSgvXFwuL2csIFwiLVwiKX1gLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGhvc3RlZFpvbmVJZDogdGVuYW50LnJvdXRlNTNIb3N0ZWRab25lSWQsXG4gICAgICAgICAgICB6b25lTmFtZTogdGVuYW50LmFwcERvbWFpbk5hbWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyBBUEnjg4njg6HjgqTjg7Pjgajjg5vjgrnjg4jjgr7jg7zjg7Pjga7jg57jg4Pjg5Tjg7PjgrBcbiAgICBjb25zdCBhcGlEb21haW5ab25lTWFwOiBSZWNvcmQ8c3RyaW5nLCByb3V0ZTUzLklIb3N0ZWRab25lPiA9IHt9O1xuICAgIGZvciAoY29uc3QgdGVuYW50IG9mIHByb3BzLnRlbmFudHMpIHtcbiAgICAgIC8vIOWQhOODhuODiuODs+ODiOOBrkFQSeODieODoeOCpOODs+OCkuOCreODvOOBqOOBl+OBpuOAgeWvvuW/nOOBmeOCi+ODm+OCueODiOOCvuODvOODs+OCkuioreWumlxuICAgICAgY29uc3QgYXBpRG9tYWluID0gYGFwaS4ke3RlbmFudC5hcHBEb21haW5OYW1lfWA7XG4gICAgICBhcGlEb21haW5ab25lTWFwW2FwaURvbWFpbl0gPSBiYXNlRG9tYWluWm9uZU1hcFt0ZW5hbnQuYXBwRG9tYWluTmFtZV07XG4gICAgfVxuXG4gICAgLy8g6ZuG57SE44Ot44Kw55SoUzPjg5DjgrHjg4Pjg4hcbiAgICBjb25zdCBsb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIkxvZ3NCdWNrZXRcIiwge1xuICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGlkOiBcImxvZy1leHBpcmF0aW9uXCIsXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBleHBpcmF0aW9uOiBEdXJhdGlvbi5kYXlzKFxuICAgICAgICAgICAgcHJvcHM/LmxvZ1JldGVudGlvbkRheXMgPz8gbG9ncy5SZXRlbnRpb25EYXlzLlRIUkVFX01PTlRIUyxcbiAgICAgICAgICApLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICAgIGFjY2Vzc0NvbnRyb2w6IHMzLkJ1Y2tldEFjY2Vzc0NvbnRyb2wuUFJJVkFURSxcbiAgICAgIGJsb2NrUHVibGljQWNjZXNzOiBzMy5CbG9ja1B1YmxpY0FjY2Vzcy5CTE9DS19BTEwsXG4gICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICBlbmZvcmNlU1NMOiB0cnVlLFxuICAgICAgLy8g44K544K/44OD44Kv5YmK6Zmk5pmC44Gr44OQ44Kx44OD44OI44KC5YmK6ZmkXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICAvLyDjg5DjgrHjg4Pjg4jlhoXjga7jgqrjg5bjgrjjgqfjgq/jg4jjgoLoh6rli5XliYrpmaRcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiDjg43jg4Pjg4jjg6/jg7zjgq/jg6rjgr3jg7zjgrlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAvLyBWUEPjgajjgrXjg5bjg43jg4Pjg4hcbiAgICBjb25zdCB2cGMgPSBuZXcgZWMyLlZwYyh0aGlzLCBcIlZwY1wiLCB7XG4gICAgICBtYXhBenM6IDIsXG4gICAgICBzdWJuZXRDb25maWd1cmF0aW9uOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogXCJQdWJsaWNcIixcbiAgICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QVUJMSUMsXG4gICAgICAgIH0sXG4gICAgICAgIHtcbiAgICAgICAgICBjaWRyTWFzazogMjQsXG4gICAgICAgICAgbmFtZTogXCJQcml2YXRlXCIsXG4gICAgICAgICAgc3VibmV0VHlwZTogZWMyLlN1Ym5ldFR5cGUuUFJJVkFURV9XSVRIX0VHUkVTUyxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBuYXRHYXRld2F5czogcHJvcHMubmF0R2F0ZXdheXNDb3VudCxcbiAgICB9KTtcblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICog44OV44Ot44Oz44OI44Ko44Oz44OJ55So44Oq44K944O844K5XG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgLy8g44OV44Ot44Oz44OI44Ko44Oz44OJ55SoUzPjg5DjgrHjg4Pjg4hcbiAgICBjb25zdCBmcm9udGVuZEJ1Y2tldCA9IG5ldyBzMy5CdWNrZXQodGhpcywgXCJGcm9udGVuZEJ1Y2tldFwiLCB7XG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgZW5mb3JjZVNTTDogdHJ1ZSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIGF1dG9EZWxldGVPYmplY3RzOiB0cnVlLFxuICAgIH0pO1xuXG4gICAgLy8g44Ki44OD44OX44Ot44O844OJ44GV44KM44Gf44OV44Kh44Kk44Or55SoUzPjg5DjgrHjg4Pjg4hcbiAgICBjb25zdCB1cGxvYWRlZEZpbGVzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIlVwbG9hZGVkRmlsZXNCdWNrZXRcIiwge1xuICAgICAgdmVyc2lvbmVkOiB0cnVlLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICAgIGNvcnM6IFtcbiAgICAgICAge1xuICAgICAgICAgIGFsbG93ZWRNZXRob2RzOiBbczMuSHR0cE1ldGhvZHMuR0VUXSxcbiAgICAgICAgICAvLyDlhajjg4bjg4rjg7Pjg4jjg4njg6HjgqTjg7NcbiAgICAgICAgICBhbGxvd2VkT3JpZ2luczogcHJvcHMudGVuYW50cy5tYXAoXG4gICAgICAgICAgICAodGVuYW50KSA9PiBgaHR0cHM6Ly8ke3RlbmFudC5hcHBEb21haW5OYW1lfWAsXG4gICAgICAgICAgKSwgLy8g5YWo44OG44OK44Oz44OI44OJ44Oh44Kk44OzXG4gICAgICAgICAgYWxsb3dlZEhlYWRlcnM6IFtcIipcIl0sXG4gICAgICAgICAgbWF4QWdlOiAzNjAwLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnTjg63jgrDnlKhTM+ODkOOCseODg+ODiFxuICAgIGNvbnN0IGNsb3VkRnJvbnRMb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIkNsb3VkRnJvbnRMb2dzQnVja2V0XCIsIHtcbiAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBpZDogXCJjbG91ZGZyb250LWxvZ3MtZXhwaXJhdGlvblwiLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogRHVyYXRpb24uZGF5cyhcbiAgICAgICAgICAgIHByb3BzPy5sb2dSZXRlbnRpb25EYXlzID8/IGxvZ3MuUmV0ZW50aW9uRGF5cy5USFJFRV9NT05USFMsXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgZW5jcnlwdGlvbjogczMuQnVja2V0RW5jcnlwdGlvbi5TM19NQU5BR0VELFxuICAgICAgZW5mb3JjZVNTTDogdHJ1ZSxcbiAgICAgIGFjY2Vzc0NvbnRyb2w6IHMzLkJ1Y2tldEFjY2Vzc0NvbnRyb2wuTE9HX0RFTElWRVJZX1dSSVRFLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb250RnVuY3Rpb24gRnJvbnRlbmTjg6rjgq/jgqjjgrnjg4jnlKhcbiAgICBjb25zdCBmcm9udGVuZEluZGV4UGFnZUZ1bmN0aW9uID0gbmV3IGNsb3VkZnJvbnQuRnVuY3Rpb24oXG4gICAgICB0aGlzLFxuICAgICAgXCJGcm9udGVuZEluZGV4UGFnZUZ1bmN0aW9uXCIsXG4gICAgICB7XG4gICAgICAgIGZ1bmN0aW9uTmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUZyb250ZW5kSW5kZXhQYWdlRnVuY3Rpb25gLFxuICAgICAgICBydW50aW1lOiBjbG91ZGZyb250LkZ1bmN0aW9uUnVudGltZS5KU18yXzAsXG4gICAgICAgIGNvZGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25Db2RlLmZyb21GaWxlKHtcbiAgICAgICAgICBmaWxlUGF0aDogXCJjbG91ZGZyb250LWZ1bmN0aW9ucy9Gcm9udGVuZEluZGV4UGFnZUZ1bmN0aW9uLmpzXCIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgLy8g44K744Kt44Ol44Oq44OG44Kj44OY44OD44OA44O844Od44Oq44K344O844KS5L2c5oiQXG4gICAgY29uc3Qgc2VjdXJpdHlIZWFkZXJzUG9saWN5ID0gbmV3IGNsb3VkZnJvbnQuUmVzcG9uc2VIZWFkZXJzUG9saWN5KHRoaXMsIFwiU2VjdXJpdHlIZWFkZXJzUG9saWN5XCIsIHtcbiAgICAgIHNlY3VyaXR5SGVhZGVyc0JlaGF2aW9yOiB7XG4gICAgICAgIGNvbnRlbnRTZWN1cml0eVBvbGljeToge1xuICAgICAgICAgIG92ZXJyaWRlOiB0cnVlLFxuICAgICAgICAgIGNvbnRlbnRTZWN1cml0eVBvbGljeTpcbiAgICAgICAgICAgIFwiZGVmYXVsdC1zcmMgJ3NlbGYnIGh0dHBzOjsgXCIgK1xuICAgICAgICAgICAgXCJzY3JpcHQtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZScgJ3Vuc2FmZS1ldmFsJyBodHRwczo7IFwiICtcbiAgICAgICAgICAgIFwic3R5bGUtc3JjICdzZWxmJyAndW5zYWZlLWlubGluZScgaHR0cHM6OyBcIiArXG4gICAgICAgICAgICBcImZvbnQtc3JjICdzZWxmJyBkYXRhOiBodHRwczo7IFwiICtcbiAgICAgICAgICAgIFwiaW1nLXNyYyAnc2VsZicgZGF0YTogaHR0cHM6OyBcIiArXG4gICAgICAgICAgICBcIm1lZGlhLXNyYyAnc2VsZicgaHR0cHM6OyBcIiArXG4gICAgICAgICAgICBcImNvbm5lY3Qtc3JjICdzZWxmJyBodHRwczo7IFwiICtcbiAgICAgICAgICAgIFwiZnJhbWUtc3JjICdzZWxmJyBodHRwczo7IFwiICtcbiAgICAgICAgICAgIFwiZnJhbWUtYW5jZXN0b3JzICdub25lJzsgXCIgK1xuICAgICAgICAgICAgXCJvYmplY3Qtc3JjICdub25lJztcIlxuICAgICAgICB9LFxuICAgICAgICBzdHJpY3RUcmFuc3BvcnRTZWN1cml0eToge1xuICAgICAgICAgIG92ZXJyaWRlOiB0cnVlLFxuICAgICAgICAgIGFjY2Vzc0NvbnRyb2xNYXhBZ2U6IER1cmF0aW9uLnNlY29uZHMoNjMwNzIwMDApLFxuICAgICAgICAgIGluY2x1ZGVTdWJkb21haW5zOiB0cnVlLFxuICAgICAgICAgIHByZWxvYWQ6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgY29udGVudFR5cGVPcHRpb25zOiB7XG4gICAgICAgICAgb3ZlcnJpZGU6IHRydWVcbiAgICAgICAgfSxcbiAgICAgICAgZnJhbWVPcHRpb25zOiB7XG4gICAgICAgICAgb3ZlcnJpZGU6IHRydWUsXG4gICAgICAgICAgZnJhbWVPcHRpb246IGNsb3VkZnJvbnQuSGVhZGVyc0ZyYW1lT3B0aW9uLkRFTllcbiAgICAgICAgfSxcbiAgICAgICAgeHNzUHJvdGVjdGlvbjoge1xuICAgICAgICAgIG92ZXJyaWRlOiB0cnVlLFxuICAgICAgICAgIHByb3RlY3Rpb246IHRydWUsXG4gICAgICAgICAgbW9kZUJsb2NrOiB0cnVlXG4gICAgICAgIH1cbiAgICAgIH1cbiAgICB9KTtcblxuICAgIC8vIENsb3VkRnJvbnRUb1Mz44Kz44Oz44K544OI44Op44Kv44OI44KS5L2/44Gj44GmQ2xvdWRGcm9udOOBqFMz44KS5o6l57aaXG4gICAgY29uc3QgY2xvdWRGcm9udFRvUzMgPSBuZXcgQ2xvdWRGcm9udFRvUzModGhpcywgXCJNdWx0aVRlbmFudENsb3VkRnJvbnRUb1MzXCIsIHtcbiAgICAgIGV4aXN0aW5nQnVja2V0T2JqOiBmcm9udGVuZEJ1Y2tldCxcbiAgICAgIGluc2VydEh0dHBTZWN1cml0eUhlYWRlcnM6IGZhbHNlLCAvLyDjgqvjgrnjgr/jg6DplqLmlbDjgaflr77lv5zjgZnjgovjgZ/jgoHnhKHlirnljJZcbiAgICAgIGNsb3VkRnJvbnREaXN0cmlidXRpb25Qcm9wczoge1xuICAgICAgICB3ZWJBY2xJZDogcHJvcHMuY2xvdWRGcm9udFdlYkFjbD8uYXR0ckFybixcbiAgICAgICAgZGVmYXVsdEJlaGF2aW9yOiB7XG4gICAgICAgICAgdmlld2VyUHJvdG9jb2xQb2xpY3k6XG4gICAgICAgICAgICBjbG91ZGZyb250LlZpZXdlclByb3RvY29sUG9saWN5LlJFRElSRUNUX1RPX0hUVFBTLFxuICAgICAgICAgIGZ1bmN0aW9uQXNzb2NpYXRpb25zOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIGZ1bmN0aW9uOiBmcm9udGVuZEluZGV4UGFnZUZ1bmN0aW9uLFxuICAgICAgICAgICAgICBldmVudFR5cGU6IGNsb3VkZnJvbnQuRnVuY3Rpb25FdmVudFR5cGUuVklFV0VSX1JFUVVFU1QsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgcmVzcG9uc2VIZWFkZXJzUG9saWN5OiBzZWN1cml0eUhlYWRlcnNQb2xpY3ksXG4gICAgICAgICAgLy8g44Kq44Oq44K444Oz44Oq44Kv44Ko44K544OI44Od44Oq44K344O8XG4gICAgICAgICAgb3JpZ2luUmVxdWVzdFBvbGljeTogbmV3IGNsb3VkZnJvbnQuT3JpZ2luUmVxdWVzdFBvbGljeShcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBcIkZyb250ZW5kT3JpZ2luUmVxdWVzdFBvbGljeVwiLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBvcmlnaW5SZXF1ZXN0UG9saWN5TmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUZyb250ZW5kT3JpZ2luUmVxdWVzdFBvbGljeWAsXG4gICAgICAgICAgICAgIGNvbW1lbnQ6IFwiRnJvbnRlbmRPcmlnaW5SZXF1ZXN0UG9saWN5XCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICksXG4gICAgICAgICAgLy8g44Kt44Oj44OD44K344Ol44Od44Oq44K344O8XG4gICAgICAgICAgY2FjaGVQb2xpY3k6IG5ldyBjbG91ZGZyb250LkNhY2hlUG9saWN5KHRoaXMsIFwiRnJvbnRlbmRDYWNoZVBvbGljeVwiLCB7XG4gICAgICAgICAgICBjYWNoZVBvbGljeU5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1Gcm9udGVuZENhY2hlUG9saWN5YCxcbiAgICAgICAgICAgIGNvbW1lbnQ6IFwiRnJvbnRlbmRDYWNoZVBvbGljeVwiLFxuICAgICAgICAgICAgLy8g44Kt44Oj44OD44K344Ol5pyf6ZaTXG4gICAgICAgICAgICBkZWZhdWx0VHRsOiBwcm9wcy5kZWZhdWx0VHRsLFxuICAgICAgICAgICAgbWF4VHRsOiBwcm9wcy5tYXhUdGwsXG4gICAgICAgICAgICBtaW5UdGw6IHByb3BzLm1pblR0bCxcbiAgICAgICAgICAgIC8vIOWcp+e4ruOCteODneODvOODiFxuICAgICAgICAgICAgZW5hYmxlQWNjZXB0RW5jb2RpbmdCcm90bGk6IHRydWUsXG4gICAgICAgICAgICBlbmFibGVBY2NlcHRFbmNvZGluZ0d6aXA6IHRydWUsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICAgIGh0dHBWZXJzaW9uOiBjbG91ZGZyb250Lkh0dHBWZXJzaW9uLkhUVFAyX0FORF8zLFxuICAgICAgICBsb2dCdWNrZXQ6IGNsb3VkRnJvbnRMb2dzQnVja2V0LFxuICAgICAgICBsb2dGaWxlUHJlZml4OiBcIkZyb250ZW5kQ2xvdWRGcm9udC9cIixcbiAgICAgICAgZGVmYXVsdFJvb3RPYmplY3Q6IFwiaW5kZXguaHRtbFwiLFxuICAgICAgICBlcnJvclJlc3BvbnNlczogW1xuICAgICAgICAgIC8vIC9ob2dlLzMg44Gu44KI44GG44Gq5YuV55qE44Or44O844OG44Kj44Oz44Kw44Gr5a++44GX44GmNDAz44Ko44Op44O844GM6L+U44GV44KM44KL5aC05ZCI44Gu5a++5b+cXG4gICAgICAgICAgLy8g5Y+C6ICDIGh0dHBzOi8vZGV2LmNsYXNzbWV0aG9kLmpwL2FydGljbGVzL3MzLWNsb3VkZnJvbnQtc3BhLWFuZ3VsYXItNDAzLWFjY2Vzcy1kZW5pZWQvXG4gICAgICAgICAge1xuICAgICAgICAgICAgaHR0cFN0YXR1czogNDAzLFxuICAgICAgICAgICAgcmVzcG9uc2VIdHRwU3RhdHVzOiAyMDAsXG4gICAgICAgICAgICByZXNwb25zZVBhZ2VQYXRoOiBcIi9cIixcbiAgICAgICAgICAgIHR0bDogRHVyYXRpb24uc2Vjb25kcygwKSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGh0dHBTdGF0dXM6IDQwNCxcbiAgICAgICAgICAgIHJlc3BvbnNlSHR0cFN0YXR1czogNDA0LFxuICAgICAgICAgICAgcmVzcG9uc2VQYWdlUGF0aDogXCIvNDA0Lmh0bWxcIixcbiAgICAgICAgICAgIHR0bDogRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gICAgXG4gICAgLy8g5L2c5oiQ44GV44KM44GfQ2xvdWRGcm9udOODh+OCo+OCueODiOODquODk+ODpeODvOOCt+ODp+ODs+OCkuWPluW+l1xuICAgIGNvbnN0IGNsb3VkRnJvbnREaXN0cmlidXRpb24gPSBjbG91ZEZyb250VG9TMy5jbG91ZEZyb250V2ViRGlzdHJpYnV0aW9uO1xuICAgIC8vIEwx44Oq44K944O844K544Gr44Ki44Kv44K744K544GX44Gm44Oe44Or44OB44OG44OK44Oz44OI6Kit5a6a44KS6YGp55SoXG4gICAgY29uc3QgY2ZuRGlzdHJpYnV0aW9uID0gY2xvdWRGcm9udERpc3RyaWJ1dGlvbi5ub2RlLmRlZmF1bHRDaGlsZCBhcyBjbG91ZGZyb250LkNmbkRpc3RyaWJ1dGlvbjtcbiAgICAvLyDjg57jg6vjg4Hjg4bjg4rjg7Pjg4jjgafjga/kvb/jgYjjgarjgYTjg5fjg63jg5Hjg4bjgqPjgpLliYrpmaRcbiAgICBjZm5EaXN0cmlidXRpb24uYWRkUHJvcGVydHlEZWxldGlvbk92ZXJyaWRlKFwiRGlzdHJpYnV0aW9uQ29uZmlnLklQVjZFbmFibGVkXCIpO1xuICAgIC8vIOODnuODq+ODgeODhuODiuODs+ODiOioreWumuOCkui/veWKoFxuICAgIGNmbkRpc3RyaWJ1dGlvbi5hZGRQcm9wZXJ0eU92ZXJyaWRlKCdEaXN0cmlidXRpb25Db25maWcuQ29ubmVjdGlvbk1vZGUnLCAndGVuYW50LW9ubHknKTtcblxuICAgIC8vIOOCs+ODjeOCr+OCt+ODp+ODs+OCsOODq+ODvOODl+OBruS9nOaIkO+8iENsb3VkRm9ybWF0aW9u44Oq44K944O844K544Go44GX44Gm55u05o6l5a6a576p77yJXG4gICAgY29uc3QgY29ubmVjdGlvbkdyb3VwID0gbmV3IGNsb3VkZnJvbnQuQ2ZuQ29ubmVjdGlvbkdyb3VwKFxuICAgICAgdGhpcyxcbiAgICAgIFwiRnJvbnRlbmRDb25uZWN0aW9uR3JvdXBcIixcbiAgICAgIHtcbiAgICAgICAgbmFtZTogYCR7dGhpcy5zdGFja05hbWV9LUZyb250ZW5kQ29ubmVjdGlvbkdyb3VwYCxcbiAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgaXB2NkVuYWJsZWQ6IGZhbHNlXG4gICAgICB9XG4gICAgKTtcblxuICAgIC8vIOmAmuW4uOODhuODiuODs+ODiOOBqOODh+ODouODhuODiuODs+ODiOOCkuWIhumbolxuICAgIGNvbnN0IG5vcm1hbFRlbmFudHMgPSBwcm9wcy50ZW5hbnRzLmZpbHRlcih0ZW5hbnQgPT4gIXRlbmFudC5pc0RlbW8pO1xuICAgIGNvbnN0IGRlbW9UZW5hbnRzID0gcHJvcHMudGVuYW50cy5maWx0ZXIodGVuYW50ID0+IHRlbmFudC5pc0RlbW8pO1xuXG4gICAgLy8g6YCa5bi444OG44OK44Oz44OI55So44GuRGlzdHJpYnV0aW9uVGVuYW50c+OCkuS9nOaIkO+8iOWAi+WIpe+8iVxuICAgIGZvciAoY29uc3QgdGVuYW50IG9mIG5vcm1hbFRlbmFudHMpIHtcbiAgICAgIGNvbnN0IHRlbmFudElkID0gdGVuYW50LmFwcERvbWFpbk5hbWUucmVwbGFjZSgvXFwuL2csIFwiLVwiKTtcbiAgICBcbiAgICAgIC8vIENsb3VkRm9ybWF0aW9u44Oq44K944O844K544Go44GX44GmRGlzdHJpYnV0aW9uVGVuYW5044KS55u05o6l5a6a576pXG4gICAgICBuZXcgY2xvdWRmcm9udC5DZm5EaXN0cmlidXRpb25UZW5hbnQoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGBGcm9udGVuZERpc3RyaWJ1dGlvblRlbmFudCR7dGVuYW50SWR9YCxcbiAgICAgICAge1xuICAgICAgICAgIGRpc3RyaWJ1dGlvbklkOiBjbG91ZEZyb250RGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgICAgICAgIGNvbm5lY3Rpb25Hcm91cElkOiBjb25uZWN0aW9uR3JvdXAuYXR0cklkLFxuICAgICAgICAgIG5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1mcm9udGVuZC10ZW5hbnQtJHt0ZW5hbnRJZH1gLFxuICAgICAgICAgIGRvbWFpbnM6IFt0ZW5hbnQuYXBwRG9tYWluTmFtZV0sXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBjdXN0b21pemF0aW9uczoge1xuICAgICAgICAgICAgY2VydGlmaWNhdGU6IHtcbiAgICAgICAgICAgICAgYXJuOiBwcm9wcy5jbG91ZEZyb250VGVuYW50Q2VydGlmaWNhdGVzW3RlbmFudC5hcHBEb21haW5OYW1lXS5jZXJ0aWZpY2F0ZUFybixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfVxuICAgICAgKTtcblxuICAgICAgLy8gUm91dGU1M+ODrOOCs+ODvOODieOBruS9nOaIkO+8iENvbm5lY3Rpb25Hcm91cOOBruODieODoeOCpOODs+OCkuS9v+eUqO+8iVxuICAgICAgbmV3IHJvdXRlNTMuQVJlY29yZChcbiAgICAgICAgdGhpcyxcbiAgICAgICAgYENsb3VkRnJvbnRBbGlhc1JlY29yZCR7dGVuYW50SWR9YCxcbiAgICAgICAge1xuICAgICAgICAgIHpvbmU6IGJhc2VEb21haW5ab25lTWFwW3RlbmFudC5hcHBEb21haW5OYW1lXSxcbiAgICAgICAgICByZWNvcmROYW1lOiB0ZW5hbnQuYXBwRG9tYWluTmFtZSxcbiAgICAgICAgICB0YXJnZXQ6IHJvdXRlNTMuUmVjb3JkVGFyZ2V0LmZyb21BbGlhcyh7XG4gICAgICAgICAgICBiaW5kOiAoKSA9PiAoe1xuICAgICAgICAgICAgICBkbnNOYW1lOiBGbi5nZXRBdHQoY29ubmVjdGlvbkdyb3VwLmxvZ2ljYWxJZCwgXCJSb3V0aW5nRW5kcG9pbnRcIikudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgaG9zdGVkWm9uZUlkOiAnWjJGRFROREFUQVFZVzInLCAvLyBDbG91ZEZyb25044Gu5Zu65a6a44K+44O844OzSURcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgfSlcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICB9XG5cbiAgICAvLyDjg4fjg6Ljg4bjg4rjg7Pjg4jnlKjjgasx44Gk44GuRGlzdHJpYnV0aW9uVGVuYW5044KS5L2c5oiQ77yI6KSH5pWw44OJ44Oh44Kk44Oz44KS55m76Yyy77yJXG4gICAgaWYgKGRlbW9UZW5hbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIOODh+ODouODhuODiuODs+ODiOeUqOOBruODieODoeOCpOODs+S4gOimp+OCkuS9nOaIkFxuICAgICAgY29uc3QgZGVtb0RvbWFpbnMgPSBkZW1vVGVuYW50cy5tYXAodGVuYW50ID0+IHRlbmFudC5hcHBEb21haW5OYW1lKTtcbiAgICAgIC8vIOOBqeOBruODh+ODouODhuODiuODs+ODiOOBruiovOaYjuabuOOCguWQjOOBmOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBquOBruOBp+OAgeacgOWIneOBruOCguOBruOCkuS9v+eUqFxuICAgICAgY29uc3QgZGVtb0NlcnRpZmljYXRlQXJuID0gcHJvcHMuY2xvdWRGcm9udFRlbmFudENlcnRpZmljYXRlc1tkZW1vVGVuYW50c1swXS5hcHBEb21haW5OYW1lXS5jZXJ0aWZpY2F0ZUFybjtcbiAgICAgIFxuICAgICAgLy8g44OH44Oi44OG44OK44Oz44OI55So44GuRGlzdHJpYnV0aW9uVGVuYW5044KS5L2c5oiQXG4gICAgICBuZXcgY2xvdWRmcm9udC5DZm5EaXN0cmlidXRpb25UZW5hbnQoXG4gICAgICAgIHRoaXMsXG4gICAgICAgIGBGcm9udGVuZERpc3RyaWJ1dGlvblRlbmFudERlbW9gLFxuICAgICAgICB7XG4gICAgICAgICAgZGlzdHJpYnV0aW9uSWQ6IGNsb3VkRnJvbnREaXN0cmlidXRpb24uZGlzdHJpYnV0aW9uSWQsXG4gICAgICAgICAgY29ubmVjdGlvbkdyb3VwSWQ6IGNvbm5lY3Rpb25Hcm91cC5hdHRySWQsXG4gICAgICAgICAgbmFtZTogYCR7dGhpcy5zdGFja05hbWV9LWZyb250ZW5kLXRlbmFudC1kZW1vYCxcbiAgICAgICAgICBkb21haW5zOiBkZW1vRG9tYWlucywgLy8g6KSH5pWw44Gu44OH44Oi44OJ44Oh44Kk44Oz44KS5oyH5a6aXG4gICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICBjdXN0b21pemF0aW9uczoge1xuICAgICAgICAgICAgY2VydGlmaWNhdGU6IHtcbiAgICAgICAgICAgICAgYXJuOiBkZW1vQ2VydGlmaWNhdGVBcm4sIC8vIOODr+OCpOODq+ODieOCq+ODvOODieiovOaYjuabuOOBrkFSTlxuICAgICAgICAgICAgfSxcbiAgICAgICAgICB9LFxuICAgICAgICB9XG4gICAgICApO1xuICAgICAgXG4gICAgICAvLyDlkITjg4fjg6Ljg4bjg4rjg7Pjg4jnlKjjga5Sb3V0ZTUz44Os44Kz44O844OJ44KS5L2c5oiQXG4gICAgICBmb3IgKGNvbnN0IGRlbW9UZW5hbnQgb2YgZGVtb1RlbmFudHMpIHtcbiAgICAgICAgY29uc3QgZGVtb1RlbmFudElkID0gZGVtb1RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCBcIi1cIik7XG4gICAgICAgIG5ldyByb3V0ZTUzLkFSZWNvcmQoXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBgQ2xvdWRGcm9udEFsaWFzUmVjb3JkRGVtbyR7ZGVtb1RlbmFudElkfWAsXG4gICAgICAgICAge1xuICAgICAgICAgICAgem9uZTogYmFzZURvbWFpblpvbmVNYXBbZGVtb1RlbmFudC5hcHBEb21haW5OYW1lXSxcbiAgICAgICAgICAgIHJlY29yZE5hbWU6IGRlbW9UZW5hbnQuYXBwRG9tYWluTmFtZSxcbiAgICAgICAgICAgIHRhcmdldDogcm91dGU1My5SZWNvcmRUYXJnZXQuZnJvbUFsaWFzKHtcbiAgICAgICAgICAgICAgYmluZDogKCkgPT4gKHtcbiAgICAgICAgICAgICAgICBkbnNOYW1lOiBGbi5nZXRBdHQoY29ubmVjdGlvbkdyb3VwLmxvZ2ljYWxJZCwgXCJSb3V0aW5nRW5kcG9pbnRcIikudG9TdHJpbmcoKSxcbiAgICAgICAgICAgICAgICBob3N0ZWRab25lSWQ6ICdaMkZEVE5EQVRBUVlXMicsIC8vIENsb3VkRnJvbnTjga7lm7rlrprjgr7jg7zjg7NJRFxuICAgICAgICAgICAgICB9KVxuICAgICAgICAgICAgfSlcbiAgICAgICAgICB9XG4gICAgICAgICk7XG4gICAgICB9XG4gICAgfVxuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiDjg5Djg4Pjgq/jgqjjg7Pjg4nnlKjjg6rjgr3jg7zjgrlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cblxuICAgIC8vIEFMQueUqEFDTeiovOaYjuabuO+8iOWFqOODhuODiuODs+ODiOOBrkFQSeODieODoeOCpOODs+OBq+WvvuW/nO+8iVxuICAgIGNvbnN0IGFsYkNlcnRpZmljYXRlID0gbmV3IGFjbS5DZXJ0aWZpY2F0ZSh0aGlzLCBcIkFsYkNlcnRpZmljYXRlXCIsIHtcbiAgICAgIGNlcnRpZmljYXRlTmFtZTogYCR7dGhpcy5zdGFja05hbWV9LWFsYi1jZXJ0aWZpY2F0ZWAsXG4gICAgICBkb21haW5OYW1lOiBgYXBpLiR7cHJvcHMudGVuYW50c1swXS5hcHBEb21haW5OYW1lfWAsIC8vIOODl+ODqeOCpOODnuODquODieODoeOCpOODs+OBrkFQSeODieODoeOCpOODs1xuICAgICAgc3ViamVjdEFsdGVybmF0aXZlTmFtZXM6IFtcbiAgICAgICAgLi4ucHJvcHMudGVuYW50c1xuICAgICAgICAgIC5zbGljZSgxKVxuICAgICAgICAgIC5tYXAoKHRlbmFudCkgPT4gYGFwaS4ke3RlbmFudC5hcHBEb21haW5OYW1lfWApLCAvLyDku5bjg4bjg4rjg7Pjg4jjga5BUEnjg4njg6HjgqTjg7NcbiAgICAgIF0sXG4gICAgICB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnNNdWx0aVpvbmUoYXBpRG9tYWluWm9uZU1hcCksXG4gICAgfSk7XG5cbiAgICAvLyBBTELjgrvjgq3jg6Xjg6rjg4bjgqPjgrDjg6vjg7zjg5dcbiAgICBjb25zdCBiYWNrZW5kQWxiU2VjdXJpdHlHcm91cCA9IG5ldyBlYzIuU2VjdXJpdHlHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICBcIkJhY2tlbmRBbGJTZWN1cml0eUdyb3VwXCIsXG4gICAgICB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJpdHkgZ3JvdXAgZm9yIEJhY2tlbmQgQUxCXCIsXG4gICAgICAgIGFsbG93QWxsT3V0Ym91bmQ6IHRydWUsXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyBBTEJcbiAgICBjb25zdCBiYWNrZW5kQWxiID0gbmV3IGVsYnYyLkFwcGxpY2F0aW9uTG9hZEJhbGFuY2VyKHRoaXMsIFwiQmFja2VuZEFsYlwiLCB7XG4gICAgICB2cGMsXG4gICAgICBpbnRlcm5ldEZhY2luZzogdHJ1ZSxcbiAgICAgIGRyb3BJbnZhbGlkSGVhZGVyRmllbGRzOiB0cnVlLFxuICAgICAgc2VjdXJpdHlHcm91cDogYmFja2VuZEFsYlNlY3VyaXR5R3JvdXAsXG4gICAgICB2cGNTdWJuZXRzOiB2cGMuc2VsZWN0U3VibmV0cyh7XG4gICAgICAgIHN1Ym5ldEdyb3VwTmFtZTogXCJQdWJsaWNcIixcbiAgICAgIH0pLFxuICAgICAgZGVsZXRpb25Qcm90ZWN0aW9uOiBwcm9wcy5hbGJEZWxldGlvblByb3RlY3Rpb24sXG4gICAgfSk7XG5cbiAgICAvLyDlkITjg4bjg4rjg7Pjg4jjg4njg6HjgqTjg7PjgatBTELjgqjjgqTjg6rjgqLjgrnjg6zjgrPjg7zjg4njgpLkvZzmiJBcbiAgICBmb3IgKGNvbnN0IHRlbmFudCBvZiBwcm9wcy50ZW5hbnRzKSB7XG4gICAgICBuZXcgcm91dGU1My5BUmVjb3JkKFxuICAgICAgICB0aGlzLFxuICAgICAgICBgQWxiQWxpYXNSZWNvcmQtJHt0ZW5hbnQuYXBwRG9tYWluTmFtZS5yZXBsYWNlKC9cXC4vZywgXCItXCIpfWAsXG4gICAgICAgIHtcbiAgICAgICAgICB6b25lOiBiYXNlRG9tYWluWm9uZU1hcFt0ZW5hbnQuYXBwRG9tYWluTmFtZV0sXG4gICAgICAgICAgcmVjb3JkTmFtZTogYGFwaS4ke3RlbmFudC5hcHBEb21haW5OYW1lfWAsXG4gICAgICAgICAgdGFyZ2V0OiByb3V0ZTUzLlJlY29yZFRhcmdldC5mcm9tQWxpYXMoXG4gICAgICAgICAgICBuZXcgdGFyZ2V0cy5Mb2FkQmFsYW5jZXJUYXJnZXQoYmFja2VuZEFsYiksXG4gICAgICAgICAgKSxcbiAgICAgICAgfSxcbiAgICAgICk7XG4gICAgfVxuXG4gICAgLy8gbG9nc0J1Y2tldOOBiuOCiOOBs+ODkOOCseODg+ODiOODneODquOCt+ODvOOBruS9nOaIkOOBjOWujOS6huOBl+OBpuOBi+OCiUFMQuOCkuS9nOaIkOOBmeOCi++8iOOBp+OBquOBhOOBqOaoqemZkOOCqOODqeODvOOBq+OBquOCiuOCueOCv+ODg+OCr+ODh+ODl+ODreOCpOOBq+WkseaVl+OBmeOCi++8iVxuICAgIGJhY2tlbmRBbGIubm9kZS5hZGREZXBlbmRlbmN5KGxvZ3NCdWNrZXQpO1xuXG4gICAgLy8gQUxC44Ki44Kv44K744K544Ot44Kw55SoUzPjg5DjgrHjg4Pjg4jjga7oqK3lrppcbiAgICBiYWNrZW5kQWxiLnNldEF0dHJpYnV0ZShcImFjY2Vzc19sb2dzLnMzLmVuYWJsZWRcIiwgXCJ0cnVlXCIpO1xuICAgIGJhY2tlbmRBbGIuc2V0QXR0cmlidXRlKFwiYWNjZXNzX2xvZ3MuczMuYnVja2V0XCIsIGxvZ3NCdWNrZXQuYnVja2V0TmFtZSk7XG5cbiAgICAvLyBQZXJtaXNzaW9ucyBmb3IgQWNjZXNzIExvZ2dpbmdcbiAgICAvLyAgICBXaHkgZG9uJ3QgdXNlIGFsYi5sb2dBY2Nlc3NMb2dzKGFsYkxvZ0J1Y2tldCk7ID9cbiAgICAvLyAgICBCZWNhdXNlIGxvZ0FjY2Vzc0xvZ3MgbWV0aG9kIGFkZHMgd2lkZXIgcGVybWlzc2lvbiB0byBvdGhlciBhY2NvdW50IChQdXRPYmplY3QqKS4gUzMgd2lsbCBiZWNvbWUgTm9uY29tcGxpYW50IG9uIFNlY3VyaXR5IEh1YiBbUzMuNl1cbiAgICAvLyAgICBTZWU6IGh0dHBzOi8vZG9jcy5hd3MuYW1hem9uLmNvbS9zZWN1cml0eWh1Yi9sYXRlc3QvdXNlcmd1aWRlL3NlY3VyaXR5aHViLXN0YW5kYXJkcy1mc2JwLWNvbnRyb2xzLmh0bWwjZnNicC1zMy02XG4gICAgLy8gICAgU2VlOiBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vZWxhc3RpY2xvYWRiYWxhbmNpbmcvbGF0ZXN0L2FwcGxpY2F0aW9uL2xvYWQtYmFsYW5jZXItYWNjZXNzLWxvZ3MuaHRtbCNhY2Nlc3MtbG9nZ2luZy1idWNrZXQtcGVybWlzc2lvbnNcbiAgICBsb2dzQnVja2V0LmFkZFRvUmVzb3VyY2VQb2xpY3koXG4gICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgYWN0aW9uczogW1wiczM6UHV0T2JqZWN0XCJdLFxuICAgICAgICAvLyBBTEIgYWNjZXNzIGxvZ2dpbmcgbmVlZHMgUzMgcHV0IHBlcm1pc3Npb24gZnJvbSBBTEIgc2VydmljZSBhY2NvdW50IGZvciB0aGUgcmVnaW9uXG4gICAgICAgIHByaW5jaXBhbHM6IFtcbiAgICAgICAgICBuZXcgaWFtLkFjY291bnRQcmluY2lwYWwoXG4gICAgICAgICAgICByaS5SZWdpb25JbmZvLmdldChTdGFjay5vZih0aGlzKS5yZWdpb24pLmVsYnYyQWNjb3VudCxcbiAgICAgICAgICApLFxuICAgICAgICBdLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBsb2dzQnVja2V0LmFybkZvck9iamVjdHMoYEFXU0xvZ3MvJHtTdGFjay5vZih0aGlzKS5hY2NvdW50fS8qYCksXG4gICAgICAgIF0sXG4gICAgICB9KSxcbiAgICApO1xuICAgIGxvZ3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJzMzpQdXRPYmplY3RcIl0sXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJkZWxpdmVyeS5sb2dzLmFtYXpvbmF3cy5jb21cIildLFxuICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICBsb2dzQnVja2V0LmFybkZvck9iamVjdHMoYEFXU0xvZ3MvJHtTdGFjay5vZih0aGlzKS5hY2NvdW50fS8qYCksXG4gICAgICAgIF0sXG4gICAgICAgIGNvbmRpdGlvbnM6IHtcbiAgICAgICAgICBTdHJpbmdFcXVhbHM6IHtcbiAgICAgICAgICAgIFwiczM6eC1hbXotYWNsXCI6IFwiYnVja2V0LW93bmVyLWZ1bGwtY29udHJvbFwiLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICAgIGxvZ3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJzMzpHZXRCdWNrZXRBY2xcIl0sXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJkZWxpdmVyeS5sb2dzLmFtYXpvbmF3cy5jb21cIildLFxuICAgICAgICByZXNvdXJjZXM6IFtsb2dzQnVja2V0LmJ1Y2tldEFybl0sXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgYmFja2VuZEFsYi5hZGRMaXN0ZW5lcihcIkh0dHBMaXN0ZW5lclwiLCB7XG4gICAgICBwb3J0OiA4MCxcbiAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFAsXG4gICAgICBkZWZhdWx0QWN0aW9uOiBlbGJ2Mi5MaXN0ZW5lckFjdGlvbi5yZWRpcmVjdCh7XG4gICAgICAgIHByb3RvY29sOiBlbGJ2Mi5BcHBsaWNhdGlvblByb3RvY29sLkhUVFBTLFxuICAgICAgICBwb3J0OiBcIjQ0M1wiLFxuICAgICAgICBwZXJtYW5lbnQ6IHRydWUsXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIGNvbnN0IGh0dHBzTGlzdGVuZXIgPSBiYWNrZW5kQWxiLmFkZExpc3RlbmVyKFwiSHR0cHNMaXN0ZW5lclwiLCB7XG4gICAgICBwb3J0OiA0NDMsXG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQUyxcbiAgICAgIGNlcnRpZmljYXRlczogW2FsYkNlcnRpZmljYXRlXSxcbiAgICAgIHNzbFBvbGljeTogZWxidjIuU3NsUG9saWN5LlJFQ09NTUVOREVEX1RMUyxcbiAgICB9KTtcblxuICAgIC8vIEFMQueUqFdBRiBXZWJBQ0xcbiAgICBjb25zdCBhbGJXZWJBY2wgPSBuZXcgd2FmdjIuQ2ZuV2ViQUNMKHRoaXMsIFwiQWxiV2ViQUNMXCIsIHtcbiAgICAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sIC8vIOODh+ODleOCqeODq+ODiOOBp+ioseWPr1xuICAgICAgc2NvcGU6IFwiUkVHSU9OQUxcIixcbiAgICAgIHZpc2liaWxpdHlDb25maWc6IHtcbiAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICBtZXRyaWNOYW1lOiBcIkFsYldlYkFDTFwiLFxuICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiBbXG4gICAgICAgIHtcbiAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgICAgICBwcmlvcml0eTogMSxcbiAgICAgICAgICBvdmVycmlkZUFjdGlvbjogeyBub25lOiB7fSB9LFxuICAgICAgICAgIHN0YXRlbWVudDoge1xuICAgICAgICAgICAgbWFuYWdlZFJ1bGVHcm91cFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgICAgICAgICAgdmVuZG9yTmFtZTogXCJBV1NcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBcIkFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgIF0sXG4gICAgfSk7XG5cbiAgICAvLyBXQUbnlKjjg63jgrDjg5DjgrHjg4Pjg4hcbiAgICBjb25zdCBhbGJXYWZMb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldCh0aGlzLCBcIkFsYldhZkxvZ3NCdWNrZXRcIiwge1xuICAgICAgLy8gV0FG44Gu44Ot44Kw44GvXCJhd3Mtd2FmLWxvZ3MtXCLjgaflp4vjgb7jgovjg5DjgrHjg4Pjg4jlkI3jgavjgZnjgovlv4XopoHjgYzjgYLjgotcbiAgICAgIGJ1Y2tldE5hbWU6IGBhd3Mtd2FmLWxvZ3MtJHtwcm9wcy5lbnZOYW1lfS0ke3RoaXMuYWNjb3VudH0tJHthbGJXZWJBY2wubm9kZS5pZC50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICBsaWZlY3ljbGVSdWxlczogW1xuICAgICAgICB7XG4gICAgICAgICAgaWQ6IFwiYWxiLXdhZi1sb2ctZXhwaXJhdGlvblwiLFxuICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgZXhwaXJhdGlvbjogRHVyYXRpb24uZGF5cyhwcm9wcz8ubG9nUmV0ZW50aW9uRGF5cyA/PyA5MCksXG4gICAgICAgIH0sXG4gICAgICBdLFxuICAgICAgYmxvY2tQdWJsaWNBY2Nlc3M6IHMzLkJsb2NrUHVibGljQWNjZXNzLkJMT0NLX0FMTCxcbiAgICAgIGVuY3J5cHRpb246IHMzLkJ1Y2tldEVuY3J5cHRpb24uUzNfTUFOQUdFRCxcbiAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICBhdXRvRGVsZXRlT2JqZWN0czogdHJ1ZSxcbiAgICB9KTtcblxuICAgIC8vIFdBRuODreOCsOWHuuWKm+ioreWumlxuICAgIGNvbnN0IHdhZkxvZ0NvbmZpZyA9IG5ldyB3YWZ2Mi5DZm5Mb2dnaW5nQ29uZmlndXJhdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICBcIkFsYldhZkxvZ0NvbmZpZ1wiLFxuICAgICAge1xuICAgICAgICBsb2dEZXN0aW5hdGlvbkNvbmZpZ3M6IFthbGJXYWZMb2dzQnVja2V0LmJ1Y2tldEFybl0sXG4gICAgICAgIHJlc291cmNlQXJuOiBhbGJXZWJBY2wuYXR0ckFybixcbiAgICAgICAgbG9nZ2luZ0ZpbHRlcjoge1xuICAgICAgICAgIERlZmF1bHRCZWhhdmlvcjogXCJEUk9QXCIsXG4gICAgICAgICAgRmlsdGVyczogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBCZWhhdmlvcjogXCJLRUVQXCIsXG4gICAgICAgICAgICAgIENvbmRpdGlvbnM6IFtcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBBY3Rpb25Db25kaXRpb246IHtcbiAgICAgICAgICAgICAgICAgICAgQWN0aW9uOiBcIkJMT0NLXCIsXG4gICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIFJlcXVpcmVtZW50OiBcIk1FRVRTX0FMTFwiLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgLy8g44OQ44Kx44OD44OI44Od44Oq44K344O844GM5a6M5YWo44Gr5L2c5oiQ44GV44KM44Gf5b6M44GrV0FG44Ot44Kw6Kit5a6a44KS6KGM44GG44KI44GG44Gr5L6d5a2Y6Zai5L+C44KS6L+95YqgXG4gICAgd2FmTG9nQ29uZmlnLm5vZGUuYWRkRGVwZW5kZW5jeShhbGJXYWZMb2dzQnVja2V0KTtcblxuICAgIC8vIEFMQuOBq1dBRuOCkumWoumAo+S7mOOBkVxuICAgIG5ldyB3YWZ2Mi5DZm5XZWJBQ0xBc3NvY2lhdGlvbih0aGlzLCBcIkFsYldhZkFzc29jaWF0aW9uXCIsIHtcbiAgICAgIHJlc291cmNlQXJuOiBiYWNrZW5kQWxiLmxvYWRCYWxhbmNlckFybixcbiAgICAgIHdlYkFjbEFybjogYWxiV2ViQWNsLmF0dHJBcm4sXG4gICAgfSk7XG5cbiAgICAvLyBXQUbjg63jgrDjg5DjgrHjg4Pjg4jnlKjjga7jg53jg6rjgrfjg7wgQHNlZSBodHRwczovL3JlcG9zdC5hd3MvamEva25vd2xlZGdlLWNlbnRlci93YWYtdHVybi1vbi1sb2dnaW5nXG4gICAgYWxiV2FmTG9nc0J1Y2tldC5hZGRUb1Jlc291cmNlUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBzaWQ6IFwiQVdTTG9nRGVsaXZlcnlBY2xDaGVja1wiLFxuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIHByaW5jaXBhbHM6IFtuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJkZWxpdmVyeS5sb2dzLmFtYXpvbmF3cy5jb21cIildLFxuICAgICAgICBhY3Rpb25zOiBbXCJzMzpHZXRCdWNrZXRBY2xcIl0sXG4gICAgICAgIHJlc291cmNlczogW2FsYldhZkxvZ3NCdWNrZXQuYnVja2V0QXJuXSxcbiAgICAgICAgY29uZGl0aW9uczoge1xuICAgICAgICAgIFN0cmluZ0VxdWFsczoge1xuICAgICAgICAgICAgXCJhd3M6U291cmNlQWNjb3VudFwiOiBbdGhpcy5hY2NvdW50XSxcbiAgICAgICAgICB9LFxuICAgICAgICAgIEFybkxpa2U6IHtcbiAgICAgICAgICAgIFwiYXdzOlNvdXJjZUFyblwiOiBbYGFybjphd3M6bG9nczoke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06KmBdLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9KSxcbiAgICApO1xuICAgIGFsYldhZkxvZ3NCdWNrZXQuYWRkVG9SZXNvdXJjZVBvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgc2lkOiBcIkFXU0xvZ0RlbGl2ZXJ5V3JpdGVcIixcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBwcmluY2lwYWxzOiBbbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiZGVsaXZlcnkubG9ncy5hbWF6b25hd3MuY29tXCIpXSxcbiAgICAgICAgYWN0aW9uczogW1wiczM6UHV0T2JqZWN0XCJdLFxuICAgICAgICByZXNvdXJjZXM6IFthbGJXYWZMb2dzQnVja2V0LmFybkZvck9iamVjdHMoXCJBV1NMb2dzLypcIildLFxuICAgICAgICBjb25kaXRpb25zOiB7XG4gICAgICAgICAgU3RyaW5nRXF1YWxzOiB7XG4gICAgICAgICAgICBcInMzOngtYW16LWFjbFwiOiBcImJ1Y2tldC1vd25lci1mdWxsLWNvbnRyb2xcIixcbiAgICAgICAgICAgIFwiYXdzOlNvdXJjZUFjY291bnRcIjogW3RoaXMuYWNjb3VudF0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBBcm5MaWtlOiB7XG4gICAgICAgICAgICBcImF3czpTb3VyY2VBcm5cIjogW2Bhcm46YXdzOmxvZ3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OipgXSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSksXG4gICAgKTtcblxuICAgIC8vIERhdGEgRmlyZWhvc2XplqLkv4JcbiAgICAvLyDjg63jgrDjgrDjg6vjg7zjg5dcbiAgICBjb25zdCBiYWNrZW5kS2luZXNpc0Vycm9yTG9nR3JvdXAgPSBuZXcgbG9ncy5Mb2dHcm91cChcbiAgICAgIHRoaXMsXG4gICAgICBcIkJhY2tlbmRLaW5lc2lzRXJyb3JMb2dHcm91cFwiLFxuICAgICAge1xuICAgICAgICBsb2dHcm91cE5hbWU6IGAvYXdzL2tpbmVzaXNmaXJlaG9zZS8ke3RoaXMuc3RhY2tOYW1lfS9iYWNrZW5kLWVycm9yLWxvZ3NgLFxuICAgICAgICByZXRlbnRpb246IHByb3BzLmxvZ1JldGVudGlvbkRheXMsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgIH0sXG4gICAgKTtcbiAgICAvLyDjg63jgrDjgrnjg4jjg6rjg7zjg6BcbiAgICBjb25zdCBiYWNrZW5kS2luZXNpc0Vycm9yQXBwTG9nU3RyZWFtID0gbmV3IGxvZ3MuTG9nU3RyZWFtKFxuICAgICAgdGhpcyxcbiAgICAgIFwiQmFja2VuZEtpbmVzaXNFcnJvckFwcExvZ1N0cmVhbVwiLFxuICAgICAge1xuICAgICAgICBsb2dTdHJlYW1OYW1lOiBcImJhY2tlbmRfa2luZXNpc19zM19kZWxpdmVyeV9hcHBfZXJyb3JcIixcbiAgICAgICAgbG9nR3JvdXA6IGJhY2tlbmRLaW5lc2lzRXJyb3JMb2dHcm91cCxcbiAgICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgICAgfSxcbiAgICApO1xuICAgIGNvbnN0IGJhY2tlbmRLaW5lc2lzRXJyb3JXZWJMb2dTdHJlYW0gPSBuZXcgbG9ncy5Mb2dTdHJlYW0oXG4gICAgICB0aGlzLFxuICAgICAgXCJCYWNrZW5kS2luZXNpc0Vycm9yV2ViTG9nU3RyZWFtXCIsXG4gICAgICB7XG4gICAgICAgIGxvZ1N0cmVhbU5hbWU6IFwiYmFja2VuZF9raW5lc2lzX3MzX2RlbGl2ZXJ5X3dlYl9lcnJvclwiLFxuICAgICAgICBsb2dHcm91cDogYmFja2VuZEtpbmVzaXNFcnJvckxvZ0dyb3VwLFxuICAgICAgICByZW1vdmFsUG9saWN5OiBSZW1vdmFsUG9saWN5LkRFU1RST1ksXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyBGaXJlaG9zZeeUqOOBrklBTeODreODvOODq1xuICAgIGNvbnN0IGZpcmVob3NlUm9sZSA9IG5ldyBpYW0uUm9sZSh0aGlzLCBcIkZpcmVob3NlUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImZpcmVob3NlLmFtYXpvbmF3cy5jb21cIiksXG4gICAgfSk7XG4gICAgLy8gUzPjg5DjgrHjg4Pjg4jjgbjjga7jgqLjgq/jgrvjgrnmqKnpmZDjgpLku5jkuI5cbiAgICBsb2dzQnVja2V0LmdyYW50UmVhZFdyaXRlKGZpcmVob3NlUm9sZSk7XG4gICAgLy8gQ2xvdWRXYXRjaCBMb2dz44G444Gu44Ki44Kv44K744K55qip6ZmQ44KS5LuY5LiOXG4gICAgYmFja2VuZEtpbmVzaXNFcnJvckxvZ0dyb3VwLmdyYW50V3JpdGUoZmlyZWhvc2VSb2xlKTtcbiAgICAvLyBLTVPjgq3jg7zjga7kvb/nlKjmqKnpmZDjgpLku5jkuI7vvIhBV1Pjg57jg43jg7zjgrjjg4nlnovjgq3jg7zjgpLlj4LnhafvvIlcbiAgICBjb25zdCBrbXNLZXkgPSBrbXMuS2V5LmZyb21Mb29rdXAodGhpcywgXCJTM0ttc0tleVwiLCB7XG4gICAgICBhbGlhc05hbWU6IFwiYWxpYXMvYXdzL3MzXCIsXG4gICAgfSk7XG4gICAga21zS2V5LmdyYW50RGVjcnlwdChmaXJlaG9zZVJvbGUpO1xuICAgIGttc0tleS5ncmFudEVuY3J5cHQoZmlyZWhvc2VSb2xlKTtcblxuICAgIC8vIGFwcOOCs+ODs+ODhuODiuODreOCsOmFjeS/oeioreWumlxuICAgIGNvbnN0IGJhY2tlbmRBcHBMb2dEZWxpdmVyeVN0cmVhbSA9IG5ldyBmaXJlaG9zZS5DZm5EZWxpdmVyeVN0cmVhbShcbiAgICAgIHRoaXMsXG4gICAgICBcIkJhY2tlbmRBcHBMb2dEZWxpdmVyeVN0cmVhbVwiLFxuICAgICAge1xuICAgICAgICBkZWxpdmVyeVN0cmVhbU5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1iYWNrZW5kLWFwcC1sb2dgLFxuICAgICAgICBkZWxpdmVyeVN0cmVhbVR5cGU6IFwiRGlyZWN0UHV0XCIsXG4gICAgICAgIGRlbGl2ZXJ5U3RyZWFtRW5jcnlwdGlvbkNvbmZpZ3VyYXRpb25JbnB1dDoge1xuICAgICAgICAgIGtleVR5cGU6IFwiQVdTX09XTkVEX0NNS1wiLFxuICAgICAgICB9LFxuICAgICAgICBzM0Rlc3RpbmF0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgIGJ1Y2tldEFybjogbG9nc0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgY29tcHJlc3Npb25Gb3JtYXQ6IFwiR1pJUFwiLFxuICAgICAgICAgIGVuY3J5cHRpb25Db25maWd1cmF0aW9uOiB7XG4gICAgICAgICAgICBrbXNFbmNyeXB0aW9uQ29uZmlnOiB7XG4gICAgICAgICAgICAgIGF3c2ttc0tleUFybjoga21zS2V5LmtleUFybixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgICBwcmVmaXg6IFwiYmFja2VuZC9hcHAvXCIsXG4gICAgICAgICAgcm9sZUFybjogZmlyZWhvc2VSb2xlLnJvbGVBcm4sXG4gICAgICAgICAgY2xvdWRXYXRjaExvZ2dpbmdPcHRpb25zOiB7XG4gICAgICAgICAgICBlbmFibGVkOiB0cnVlLFxuICAgICAgICAgICAgbG9nR3JvdXBOYW1lOiBiYWNrZW5kS2luZXNpc0Vycm9yTG9nR3JvdXAubG9nR3JvdXBOYW1lLFxuICAgICAgICAgICAgbG9nU3RyZWFtTmFtZTogYmFja2VuZEtpbmVzaXNFcnJvckFwcExvZ1N0cmVhbS5sb2dTdHJlYW1OYW1lLFxuICAgICAgICAgIH0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyB3ZWLjgrPjg7Pjg4bjg4rjg63jgrDphY3kv6HoqK3lrppcbiAgICBjb25zdCBiYWNrZW5kV2ViTG9nRGVsaXZlcnlTdHJlYW0gPSBuZXcgZmlyZWhvc2UuQ2ZuRGVsaXZlcnlTdHJlYW0oXG4gICAgICB0aGlzLFxuICAgICAgXCJCYWNrZW5kV2ViTG9nRGVsaXZlcnlTdHJlYW1cIixcbiAgICAgIHtcbiAgICAgICAgZGVsaXZlcnlTdHJlYW1OYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tYmFja2VuZC13ZWItbG9nYCxcbiAgICAgICAgZGVsaXZlcnlTdHJlYW1UeXBlOiBcIkRpcmVjdFB1dFwiLFxuICAgICAgICBkZWxpdmVyeVN0cmVhbUVuY3J5cHRpb25Db25maWd1cmF0aW9uSW5wdXQ6IHtcbiAgICAgICAgICBrZXlUeXBlOiBcIkFXU19PV05FRF9DTUtcIixcbiAgICAgICAgfSxcbiAgICAgICAgczNEZXN0aW5hdGlvbkNvbmZpZ3VyYXRpb246IHtcbiAgICAgICAgICBidWNrZXRBcm46IGxvZ3NCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgIGNvbXByZXNzaW9uRm9ybWF0OiBcIkdaSVBcIixcbiAgICAgICAgICBlbmNyeXB0aW9uQ29uZmlndXJhdGlvbjoge1xuICAgICAgICAgICAga21zRW5jcnlwdGlvbkNvbmZpZzoge1xuICAgICAgICAgICAgICBhd3NrbXNLZXlBcm46IGttc0tleS5rZXlBcm4sXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIH0sXG4gICAgICAgICAgcHJlZml4OiBcImJhY2tlbmQvd2ViL1wiLFxuICAgICAgICAgIHJvbGVBcm46IGZpcmVob3NlUm9sZS5yb2xlQXJuLFxuICAgICAgICAgIGNsb3VkV2F0Y2hMb2dnaW5nT3B0aW9uczoge1xuICAgICAgICAgICAgZW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIGxvZ0dyb3VwTmFtZTogYmFja2VuZEtpbmVzaXNFcnJvckxvZ0dyb3VwLmxvZ0dyb3VwTmFtZSxcbiAgICAgICAgICAgIGxvZ1N0cmVhbU5hbWU6IGJhY2tlbmRLaW5lc2lzRXJyb3JXZWJMb2dTdHJlYW0ubG9nU3RyZWFtTmFtZSxcbiAgICAgICAgICB9LFxuICAgICAgICB9LFxuICAgICAgfSxcbiAgICApO1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBFQ1Pjg6rjgr3jg7zjgrnvvIjjg5Djg4Pjgq/jgqjjg7Pjg4nnlKjvvIlcbiAgICAgKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKi9cbiAgICAvLyBFQ1JcbiAgICBjb25zdCBiYWNrZW5kRWNyUmVwb3NpdG9yeSA9IG5ldyBlY3IuUmVwb3NpdG9yeShcbiAgICAgIHRoaXMsXG4gICAgICBcIkJhY2tlbmRFY3JSZXBvc2l0b3J5XCIsXG4gICAgICB7XG4gICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgbGlmZWN5Y2xlUnVsZXM6IFtcbiAgICAgICAgICB7XG4gICAgICAgICAgICBydWxlUHJpb3JpdHk6IDEwLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiYXBwIERlbGV0ZSBtb3JlIHRoYW4gMyBpbWFnZXNcIixcbiAgICAgICAgICAgIHRhZ1N0YXR1czogZWNyLlRhZ1N0YXR1cy5UQUdHRUQsXG4gICAgICAgICAgICB0YWdQYXR0ZXJuTGlzdDogW1wiKmFwcCpcIl0sXG4gICAgICAgICAgICBtYXhJbWFnZUNvdW50OiAzLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcnVsZVByaW9yaXR5OiAyMCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIndlYiBEZWxldGUgbW9yZSB0aGFuIDMgaW1hZ2VzXCIsXG4gICAgICAgICAgICB0YWdTdGF0dXM6IGVjci5UYWdTdGF0dXMuVEFHR0VELFxuICAgICAgICAgICAgdGFnUGF0dGVybkxpc3Q6IFtcIip3ZWIqXCJdLFxuICAgICAgICAgICAgbWF4SW1hZ2VDb3VudDogMyxcbiAgICAgICAgICB9LFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIHJ1bGVQcmlvcml0eTogMzAsXG4gICAgICAgICAgICBkZXNjcmlwdGlvbjogXCJsb2cgRGVsZXRlIG1vcmUgdGhhbiAzIGltYWdlc1wiLFxuICAgICAgICAgICAgdGFnU3RhdHVzOiBlY3IuVGFnU3RhdHVzLlRBR0dFRCxcbiAgICAgICAgICAgIHRhZ1BhdHRlcm5MaXN0OiBbXCIqbG9nKlwiXSxcbiAgICAgICAgICAgIG1heEltYWdlQ291bnQ6IDMsXG4gICAgICAgICAgfSxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBydWxlUHJpb3JpdHk6IDgwLFxuICAgICAgICAgICAgZGVzY3JpcHRpb246IFwiQWxsIFRhZ2dlZCBEZWxldGUgbW9yZSB0aGFuIDMgaW1hZ2VzXCIsXG4gICAgICAgICAgICB0YWdTdGF0dXM6IGVjci5UYWdTdGF0dXMuVEFHR0VELFxuICAgICAgICAgICAgdGFnUGF0dGVybkxpc3Q6IFtcIipcIl0sXG4gICAgICAgICAgICBtYXhJbWFnZUNvdW50OiAzLFxuICAgICAgICAgIH0sXG4gICAgICAgICAge1xuICAgICAgICAgICAgcnVsZVByaW9yaXR5OiA5MCxcbiAgICAgICAgICAgIGRlc2NyaXB0aW9uOiBcIkFsbCBVbnRhZ2dlZCBEZWxldGUgbW9yZSB0aGFuIDMgaW1hZ2VzXCIsXG4gICAgICAgICAgICB0YWdTdGF0dXM6IGVjci5UYWdTdGF0dXMuVU5UQUdHRUQsXG4gICAgICAgICAgICBtYXhJbWFnZUNvdW50OiAzLFxuICAgICAgICAgIH0sXG4gICAgICAgIF0sXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyBFQ1Pjgq/jg6njgrnjgr/jg7xcbiAgICBjb25zdCBlY3NDbHVzdGVyID0gbmV3IGVjcy5DbHVzdGVyKHRoaXMsIFwiRWNzQ2x1c3RlclwiLCB7XG4gICAgICB2cGMsXG4gICAgICBlbmFibGVGYXJnYXRlQ2FwYWNpdHlQcm92aWRlcnM6IHRydWUsXG4gICAgICBjbHVzdGVyTmFtZTogUGh5c2ljYWxOYW1lLkdFTkVSQVRFX0lGX05FRURFRCwgLy8gZm9yIGNyb3NzUmVnaW9uUmVmZXJlbmNlc1xuICAgIH0pO1xuXG4gICAgLy8g44K/44K544Kv5a6f6KGM44Ot44O844OrXG4gICAgY29uc3QgdGFza0V4ZWN1dGlvblJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJFY3NUYXNrRXhlY3V0aW9uUm9sZVwiLCB7XG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uU2VydmljZVByaW5jaXBhbChcImVjcy10YXNrcy5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgbWFuYWdlZFBvbGljaWVzOiBbXG4gICAgICAgIGlhbS5NYW5hZ2VkUG9saWN5LmZyb21Bd3NNYW5hZ2VkUG9saWN5TmFtZShcbiAgICAgICAgICBcInNlcnZpY2Utcm9sZS9BbWF6b25FQ1NUYXNrRXhlY3V0aW9uUm9sZVBvbGljeVwiLFxuICAgICAgICApLFxuICAgICAgXSxcbiAgICAgIGlubGluZVBvbGljaWVzOiB7XG4gICAgICAgIHRhc2tFeGVjdXRpb25Qb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXCJzc206R2V0UGFyYW1ldGVyc1wiLCBcInNlY3JldHNtYW5hZ2VyOkdldFNlY3JldFZhbHVlXCJdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OnNzbToke3RoaXMucmVnaW9ufToke3RoaXMuYWNjb3VudH06cGFyYW1ldGVyLypgLFxuICAgICAgICAgICAgICAgIGBhcm46JHt0aGlzLnBhcnRpdGlvbn06c2VjcmV0c21hbmFnZXI6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnNlY3JldC8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEVDU+OCv+OCueOCr+ODreODvOODq1xuICAgIGNvbnN0IHRhc2tSb2xlID0gbmV3IGlhbS5Sb2xlKHRoaXMsIFwiRWNzVGFza1JvbGVcIiwge1xuICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLkNvbXBvc2l0ZVByaW5jaXBhbChcbiAgICAgICAgbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiZWNzLXRhc2tzLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICApLFxuICAgICAgcGF0aDogXCIvXCIsXG4gICAgICBtYW5hZ2VkUG9saWNpZXM6IFtcbiAgICAgICAgaWFtLk1hbmFnZWRQb2xpY3kuZnJvbUF3c01hbmFnZWRQb2xpY3lOYW1lKFxuICAgICAgICAgIFwic2VydmljZS1yb2xlL0FtYXpvbkVDMkNvbnRhaW5lclNlcnZpY2VFdmVudHNSb2xlXCIsXG4gICAgICAgICksXG4gICAgICBdLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgZmlyZWhvc2VQb2xpY3k6IG5ldyBpYW0uUG9saWN5RG9jdW1lbnQoe1xuICAgICAgICAgIHN0YXRlbWVudHM6IFtcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXCJmaXJlaG9zZTpQdXRSZWNvcmRCYXRjaFwiXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgYGFybjphd3M6ZmlyZWhvc2U6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OmRlbGl2ZXJ5c3RyZWFtLyR7YmFja2VuZEFwcExvZ0RlbGl2ZXJ5U3RyZWFtLnJlZn1gLFxuICAgICAgICAgICAgICAgIGBhcm46YXdzOmZpcmVob3NlOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpkZWxpdmVyeXN0cmVhbS8ke2JhY2tlbmRXZWJMb2dEZWxpdmVyeVN0cmVhbS5yZWZ9YCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuXG4gICAgICAgIC8vIFMz44Ki44OD44OX44Ot44O844OJ55So44Gu5qip6ZmQ44KS6L+95YqgXG4gICAgICAgIHMzVXBsb2FkUG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiczM6UHV0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgXCJzMzpHZXRPYmplY3RcIixcbiAgICAgICAgICAgICAgICBcInMzOkRlbGV0ZU9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwiczM6TGlzdEJ1Y2tldFwiLFxuICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0QWNsXCIsXG4gICAgICAgICAgICAgICAgXCJzMzpQdXRPYmplY3RBY2xcIixcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgdXBsb2FkZWRGaWxlc0J1Y2tldC5idWNrZXRBcm4sXG4gICAgICAgICAgICAgICAgYCR7dXBsb2FkZWRGaWxlc0J1Y2tldC5idWNrZXRBcm59LypgLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICAgIC8vIEXjg6Hjg7zjg6vpgIHkv6HnlKjjga7mqKnpmZBcbiAgICAgICAgc2VzUG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwic2VzOlNlbmRFbWFpbFwiLFxuICAgICAgICAgICAgICAgIFwic2VzOlNlbmRSYXdFbWFpbFwiLFxuICAgICAgICAgICAgICAgIFwic2VzOlNlbmRUZW1wbGF0ZWRFbWFpbFwiLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICBjb25zdCBkYk5hbWUgPSBcInNhbXBsZV9hcHBcIjtcblxuICAgIC8vIFNlY3JldHMgTWFuYWdlcu+8iERC6KqN6Ki85oOF5aCx44KS6Kit5a6a77yJXG4gICAgY29uc3QgZGJTZWNyZXQgPSBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIFwiQXVyb3JhU2VjcmV0XCIsIHtcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdXNlcm5hbWU6IFwid2ViYXBwXCIsXG4gICAgICAgICAgZGJuYW1lOiBkYk5hbWUsXG4gICAgICAgIH0pLFxuICAgICAgICBnZW5lcmF0ZVN0cmluZ0tleTogXCJwYXNzd29yZFwiLFxuICAgICAgICBleGNsdWRlQ2hhcmFjdGVyczogJ1wiQC9cXFxcJyxcbiAgICAgICAgZXhjbHVkZVB1bmN0dWF0aW9uOiB0cnVlLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIFJlYWRPbmx544Om44O844K244O855So44K344O844Kv44Os44OD44OIXG4gICAgbmV3IHNlY3JldHNtYW5hZ2VyLlNlY3JldCh0aGlzLCBcIkF1cm9yYVJlYWRPbmx5U2VjcmV0XCIsIHtcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdXNlcm5hbWU6IFwicmVhZG9ubHlfdXNlclwiLFxuICAgICAgICAgIGRibmFtZTogZGJOYW1lLFxuICAgICAgICB9KSxcbiAgICAgICAgZ2VuZXJhdGVTdHJpbmdLZXk6IFwicGFzc3dvcmRcIixcbiAgICAgICAgZXhjbHVkZUNoYXJhY3RlcnM6ICdcIkAvXFxcXCcsXG4gICAgICAgIGV4Y2x1ZGVQdW5jdHVhdGlvbjogdHJ1ZSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBSZWFkV3JpdGXjg6bjg7zjgrbjg7znlKjjgrfjg7zjgq/jg6zjg4Pjg4hcbiAgICBuZXcgc2VjcmV0c21hbmFnZXIuU2VjcmV0KHRoaXMsIFwiQXVyb3JhUmVhZFdyaXRlU2VjcmV0XCIsIHtcbiAgICAgIGdlbmVyYXRlU2VjcmV0U3RyaW5nOiB7XG4gICAgICAgIHNlY3JldFN0cmluZ1RlbXBsYXRlOiBKU09OLnN0cmluZ2lmeSh7XG4gICAgICAgICAgdXNlcm5hbWU6IFwicmVhZHdyaXRlX3VzZXJcIixcbiAgICAgICAgICBkYm5hbWU6IGRiTmFtZSxcbiAgICAgICAgfSksXG4gICAgICAgIGdlbmVyYXRlU3RyaW5nS2V5OiBcInBhc3N3b3JkXCIsXG4gICAgICAgIGV4Y2x1ZGVDaGFyYWN0ZXJzOiAnXCJAL1xcXFwnLFxuICAgICAgICBleGNsdWRlUHVuY3R1YXRpb246IHRydWUsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8g44K/44K544Kv5a6a576pXG4gICAgY29uc3QgYmFja2VuZEVjc1Rhc2sgPSBuZXcgZWNzLkZhcmdhdGVUYXNrRGVmaW5pdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICBcIkJhY2tlbmRFY3NUYXNrXCIsXG4gICAgICB7XG4gICAgICAgIGZhbWlseTogYCR7dGhpcy5zdGFja05hbWV9LWJhY2tlbmRgLFxuICAgICAgICB0YXNrUm9sZTogdGFza1JvbGUsXG4gICAgICAgIGV4ZWN1dGlvblJvbGU6IHRhc2tFeGVjdXRpb25Sb2xlLFxuICAgICAgICBjcHU6IHByb3BzLmJhY2tlbmRFY3NUYXNrQ3B1LFxuICAgICAgICBtZW1vcnlMaW1pdE1pQjogcHJvcHMuYmFja2VuZEVjc1Rhc2tNZW1vcnksXG4gICAgICAgIHJ1bnRpbWVQbGF0Zm9ybToge1xuICAgICAgICAgIGNwdUFyY2hpdGVjdHVyZTogZWNzLkNwdUFyY2hpdGVjdHVyZS5BUk02NCxcbiAgICAgICAgICBvcGVyYXRpbmdTeXN0ZW1GYW1pbHk6IGVjcy5PcGVyYXRpbmdTeXN0ZW1GYW1pbHkuTElOVVgsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICk7XG4gICAgLy8gd2Vi44Kz44Oz44OG44OKXG4gICAgYmFja2VuZEVjc1Rhc2suYWRkQ29udGFpbmVyKFwid2ViXCIsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoYmFja2VuZEVjclJlcG9zaXRvcnksIFwid2ViXCIpLFxuICAgICAgcG9ydE1hcHBpbmdzOiBbeyBjb250YWluZXJQb3J0OiA4MCwgaG9zdFBvcnQ6IDgwIH1dLFxuICAgICAgcmVhZG9ubHlSb290RmlsZXN5c3RlbTogZmFsc2UsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5maXJlbGVucyh7fSksXG4gICAgfSk7XG4gICAgLy8gYXBw44Kz44Oz44OG44OKXG4gICAgYmFja2VuZEVjc1Rhc2suYWRkQ29udGFpbmVyKFwiYXBwXCIsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoYmFja2VuZEVjclJlcG9zaXRvcnksIFwiYXBwXCIpLFxuICAgICAgZW52aXJvbm1lbnQ6IHtcbiAgICAgICAgVFo6IFwiQXNpYS9Ub2t5b1wiLFxuICAgICAgICBBUFBfRU5WOiBwcm9wcy5lbnZOYW1lLFxuICAgICAgICBBUFBfREVCVUc6IFN0cmluZyhwcm9wcy5hcHBEZWJ1ZyksXG4gICAgICAgIEFXU19CVUNLRVQ6IHVwbG9hZGVkRmlsZXNCdWNrZXQuYnVja2V0TmFtZSxcbiAgICAgICAgQVdTX1VSTDogYGh0dHBzOi8vJHt1cGxvYWRlZEZpbGVzQnVja2V0LmJ1Y2tldFJlZ2lvbmFsRG9tYWluTmFtZX1gLFxuICAgICAgICBNQUlMX01BSUxFUjogXCJzZXNcIixcbiAgICAgIH0sXG4gICAgICBzZWNyZXRzOiB7XG4gICAgICAgIC8vIFNlY3JldHNNYW5hZ2Vy44GL44KJ5Y+W5b6X44GX44Gf5YCkXG4gICAgICAgIERCX0hPU1Q6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGRiU2VjcmV0LCBcImhvc3RcIiksXG4gICAgICAgIERCX1BPUlQ6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGRiU2VjcmV0LCBcInBvcnRcIiksXG4gICAgICAgIERCX1VTRVJOQU1FOiBlY3MuU2VjcmV0LmZyb21TZWNyZXRzTWFuYWdlcihkYlNlY3JldCwgXCJ1c2VybmFtZVwiKSxcbiAgICAgICAgREJfREFUQUJBU0U6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGRiU2VjcmV0LCBcImRibmFtZVwiKSxcbiAgICAgICAgREJfUEFTU1dPUkQ6IGVjcy5TZWNyZXQuZnJvbVNlY3JldHNNYW5hZ2VyKGRiU2VjcmV0LCBcInBhc3N3b3JkXCIpLFxuICAgICAgICAvLyBTU03jg5Hjg6njg6Hjg7zjgr/jgrnjg4jjgqLjgYvjgonlj5blvpfjgZfjgZ/lgKRcbiAgICAgICAgQVBQX0tFWTogZWNzLlNlY3JldC5mcm9tU3NtUGFyYW1ldGVyKFxuICAgICAgICAgIHNzbS5TdHJpbmdQYXJhbWV0ZXIuZnJvbVNlY3VyZVN0cmluZ1BhcmFtZXRlckF0dHJpYnV0ZXMoXG4gICAgICAgICAgICB0aGlzLFxuICAgICAgICAgICAgXCJBcHBDb250YWluZXJEZWZBcHBLZXlQYXJhbVwiLFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBwYXJhbWV0ZXJOYW1lOiBgLyR7dGhpcy5zdGFja05hbWV9L2Vjcy10YXNrLWRlZi9hcHAvZW52LXZhcnMvYXBwLWtleWAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICksXG4gICAgICAgICksXG4gICAgICB9LFxuICAgICAgcmVhZG9ubHlSb290RmlsZXN5c3RlbTogZmFsc2UsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5maXJlbGVucyh7fSksXG4gICAgfSk7XG5cbiAgICAvLyBsb2ctcm91dGVy44Kz44Oz44OG44OKXG4gICAgYmFja2VuZEVjc1Rhc2suYWRkRmlyZWxlbnNMb2dSb3V0ZXIoXCJsb2ctcm91dGVyXCIsIHtcbiAgICAgIGltYWdlOiBlY3MuQ29udGFpbmVySW1hZ2UuZnJvbUVjclJlcG9zaXRvcnkoXG4gICAgICAgIGJhY2tlbmRFY3JSZXBvc2l0b3J5LFxuICAgICAgICBcImxvZy1yb3V0ZXJcIixcbiAgICAgICksXG4gICAgICBlbnZpcm9ubWVudDoge1xuICAgICAgICBLSU5FU0lTX0FQUF9ERUxJVkVSWV9TVFJFQU06IGJhY2tlbmRBcHBMb2dEZWxpdmVyeVN0cmVhbS5yZWYsXG4gICAgICAgIEtJTkVTSVNfV0VCX0RFTElWRVJZX1NUUkVBTTogYmFja2VuZFdlYkxvZ0RlbGl2ZXJ5U3RyZWFtLnJlZixcbiAgICAgICAgQVdTX1JFR0lPTjogdGhpcy5yZWdpb24sXG4gICAgICB9LFxuICAgICAgc2VjcmV0czoge1xuICAgICAgICBBUFBfTE9HX1NMQUNLX1dFQkhPT0tfVVJMOiBlY3MuU2VjcmV0LmZyb21Tc21QYXJhbWV0ZXIoXG4gICAgICAgICAgc3NtLlN0cmluZ1BhcmFtZXRlci5mcm9tU2VjdXJlU3RyaW5nUGFyYW1ldGVyQXR0cmlidXRlcyhcbiAgICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgICBcIkxvZ1JvdXRlckNvbnRhaW5lckRlZkFwcExvZ1NsYWNrV2ViaG9va1VybFBhcmFtXCIsXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIHBhcmFtZXRlck5hbWU6IGAvJHt0aGlzLnN0YWNrTmFtZX0vZWNzLXRhc2stZGVmL2xvZy1yb3V0ZXIvZW52LXZhcnMvYXBwLWxvZy1zbGFjay13ZWJob29rLXVybGAsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICksXG4gICAgICAgICksXG4gICAgICB9LFxuICAgICAgdXNlcjogXCIwXCIsXG4gICAgICBsb2dnaW5nOiBlY3MuTG9nRHJpdmVycy5hd3NMb2dzKHtcbiAgICAgICAgc3RyZWFtUHJlZml4OiBcImZpcmVsZW5zXCIsXG4gICAgICAgIGxvZ0dyb3VwOiBuZXcgbG9ncy5Mb2dHcm91cCh0aGlzLCBcIkJhY2tlbmRMb2dSb3V0ZXJMb2dHcm91cFwiLCB7XG4gICAgICAgICAgbG9nR3JvdXBOYW1lOiBgL2F3cy9lY3MvJHt0aGlzLnN0YWNrTmFtZX0vYmFja2VuZC1sb2dyb3V0ZXItbG9nc2AsXG4gICAgICAgICAgcmV0ZW50aW9uOiBwcm9wcy5sb2dSZXRlbnRpb25EYXlzLFxuICAgICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgfSksXG4gICAgICB9KSxcbiAgICAgIGZpcmVsZW5zQ29uZmlnOiB7XG4gICAgICAgIHR5cGU6IGVjcy5GaXJlbGVuc0xvZ1JvdXRlclR5cGUuRkxVRU5UQklULFxuICAgICAgICBvcHRpb25zOiB7XG4gICAgICAgICAgY29uZmlnRmlsZVR5cGU6IGVjcy5GaXJlbGVuc0NvbmZpZ0ZpbGVUeXBlLkZJTEUsXG4gICAgICAgICAgY29uZmlnRmlsZVZhbHVlOiBcIi9mbHVlbnQtYml0LmNvbmZcIixcbiAgICAgICAgICBlbmFibGVFQ1NMb2dNZXRhZGF0YTogZmFsc2UsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLy8gRUNT44K144O844OT44K555So44K744Kt44Ol44Oq44OG44Kj44Kw44Or44O844OXXG4gICAgY29uc3QgYmFja2VuZEVjc1NlcnZpY2VTZWN1cml0eUdyb3VwID0gbmV3IGVjMi5TZWN1cml0eUdyb3VwKFxuICAgICAgdGhpcyxcbiAgICAgIFwiQmFja2VuZEVjc1NlcnZpY2VTZWN1cml0eUdyb3VwXCIsXG4gICAgICB7XG4gICAgICAgIHZwYyxcbiAgICAgICAgZGVzY3JpcHRpb246IFwiU2VjdXJpdHkgZ3JvdXAgZm9yIEJhY2tlbmQgRUNTIFNlcnZpY2VcIixcbiAgICAgICAgYWxsb3dBbGxPdXRib3VuZDogdHJ1ZSwgLy8gZm9yIEFXUyBBUElzXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyBFQ1PjgrXjg7zjg5PjgrlcbiAgICBjb25zdCBiYWNrZW5kRWNzU2VydmljZSA9IG5ldyBlY3MuRmFyZ2F0ZVNlcnZpY2UoXG4gICAgICB0aGlzLFxuICAgICAgXCJCYWNrZW5kRWNzU2VydmljZVwiLFxuICAgICAge1xuICAgICAgICBjbHVzdGVyOiBlY3NDbHVzdGVyLFxuICAgICAgICB0YXNrRGVmaW5pdGlvbjogYmFja2VuZEVjc1Rhc2ssXG4gICAgICAgIGRlc2lyZWRDb3VudDogcHJvcHMuYmFja2VuZERlc2lyZWRDb3VudCxcbiAgICAgICAgZW5hYmxlRXhlY3V0ZUNvbW1hbmQ6IHRydWUsXG4gICAgICAgIHBsYXRmb3JtVmVyc2lvbjogZWNzLkZhcmdhdGVQbGF0Zm9ybVZlcnNpb24uTEFURVNULFxuICAgICAgICAvLyBodHRwczovL2RvY3MuYXdzLmFtYXpvbi5jb20vY2RrL2FwaS9sYXRlc3QvZG9jcy9hd3MtZWNzLXJlYWRtZS5odG1sI2ZhcmdhdGUtY2FwYWNpdHktcHJvdmlkZXJzXG4gICAgICAgIGNhcGFjaXR5UHJvdmlkZXJTdHJhdGVnaWVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgY2FwYWNpdHlQcm92aWRlcjogXCJGQVJHQVRFXCIsXG4gICAgICAgICAgICB3ZWlnaHQ6IDEsXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgICAgbWluSGVhbHRoeVBlcmNlbnQ6IDEwMCxcbiAgICAgICAgbWF4SGVhbHRoeVBlcmNlbnQ6IDIwMCxcbiAgICAgICAgc2VjdXJpdHlHcm91cHM6IFtiYWNrZW5kRWNzU2VydmljZVNlY3VyaXR5R3JvdXBdLFxuICAgICAgICBzZXJ2aWNlTmFtZTogUGh5c2ljYWxOYW1lLkdFTkVSQVRFX0lGX05FRURFRCxcbiAgICAgIH0sXG4gICAgKTtcbiAgICBjb25zdCBlY3NTZXJ2aWNlTmFtZSA9IGJhY2tlbmRFY3NTZXJ2aWNlLnNlcnZpY2VOYW1lO1xuXG4gICAgLy8gQUxC44Gu44K/44O844Ky44OD44OI44Kw44Or44O844OXXG4gICAgY29uc3QgYXBwVGFyZ2V0R3JvdXAgPSBodHRwc0xpc3RlbmVyLmFkZFRhcmdldHMoXCJBcHBUYXJnZXRHcm91cFwiLCB7XG4gICAgICBwcm90b2NvbDogZWxidjIuQXBwbGljYXRpb25Qcm90b2NvbC5IVFRQLFxuICAgICAgdGFyZ2V0czogW2JhY2tlbmRFY3NTZXJ2aWNlXSxcbiAgICAgIGRlcmVnaXN0cmF0aW9uRGVsYXk6IER1cmF0aW9uLnNlY29uZHMoMzApLFxuICAgIH0pO1xuICAgIGFwcFRhcmdldEdyb3VwLmNvbmZpZ3VyZUhlYWx0aENoZWNrKHtcbiAgICAgIHBhdGg6IHByb3BzLmhlYWx0aENoZWNrUGF0aCxcbiAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICBoZWFsdGh5VGhyZXNob2xkQ291bnQ6IDIsXG4gICAgICB1bmhlYWx0aHlUaHJlc2hvbGRDb3VudDogMixcbiAgICAgIHRpbWVvdXQ6IER1cmF0aW9uLnNlY29uZHMoMiksXG4gICAgICBpbnRlcnZhbDogRHVyYXRpb24uc2Vjb25kcygxMCksXG4gICAgICBoZWFsdGh5SHR0cENvZGVzOiBcIjIwMFwiLFxuICAgIH0pO1xuXG4gICAgLy8g44K544Kx44O844Op44OW44Or44K/44O844Ky44OD44OIXG4gICAgY29uc3QgYmFja2VuZFNjYWxhYmxlVGFyZ2V0ID0gbmV3IGFwcGxpY2F0aW9uYXV0b3NjYWxpbmcuU2NhbGFibGVUYXJnZXQoXG4gICAgICB0aGlzLFxuICAgICAgXCJCYWNrZW5kU2NhbGFibGVUYXJnZXRcIixcbiAgICAgIHtcbiAgICAgICAgc2VydmljZU5hbWVzcGFjZTogYXBwbGljYXRpb25hdXRvc2NhbGluZy5TZXJ2aWNlTmFtZXNwYWNlLkVDUyxcbiAgICAgICAgbWF4Q2FwYWNpdHk6IHByb3BzLmJhY2tlbmRNYXhUYXNrQ291bnQsXG4gICAgICAgIG1pbkNhcGFjaXR5OiBwcm9wcy5iYWNrZW5kTWluVGFza0NvdW50LFxuICAgICAgICByZXNvdXJjZUlkOiBgc2VydmljZS8ke2Vjc0NsdXN0ZXIuY2x1c3Rlck5hbWV9LyR7ZWNzU2VydmljZU5hbWV9YCxcbiAgICAgICAgc2NhbGFibGVEaW1lbnNpb246IFwiZWNzOnNlcnZpY2U6RGVzaXJlZENvdW50XCIsXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyDjgrnjg4bjg4Pjg5fjgrnjgrHjg7zjg6rjg7PjgrDjgqLjgqbjg4jjg53jg6rjgrfjg7zjga7lrprnvqlcbiAgICBjb25zdCBiYWNrZW5kU3RlcFNjYWxlT3V0UG9saWN5ID1cbiAgICAgIG5ldyBhcHBsaWNhdGlvbmF1dG9zY2FsaW5nLlN0ZXBTY2FsaW5nUG9saWN5KFxuICAgICAgICB0aGlzLFxuICAgICAgICBcIkJhY2tlbmRTdGVwU2NhbGVPdXRQb2xpY3lcIixcbiAgICAgICAge1xuICAgICAgICAgIHNjYWxpbmdUYXJnZXQ6IGJhY2tlbmRTY2FsYWJsZVRhcmdldCxcbiAgICAgICAgICBhZGp1c3RtZW50VHlwZTpcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uYXV0b3NjYWxpbmcuQWRqdXN0bWVudFR5cGUuUEVSQ0VOVF9DSEFOR0VfSU5fQ0FQQUNJVFksXG4gICAgICAgICAgbWV0cmljQWdncmVnYXRpb25UeXBlOlxuICAgICAgICAgICAgYXBwbGljYXRpb25hdXRvc2NhbGluZy5NZXRyaWNBZ2dyZWdhdGlvblR5cGUuTUFYSU1VTSxcbiAgICAgICAgICAvLyDjgq/jg7zjg6vjg4Djgqbjg7PmnJ/plpNcbiAgICAgICAgICBjb29sZG93bjogRHVyYXRpb24uc2Vjb25kcygxODApLFxuICAgICAgICAgIC8vIOipleS+oeODneOCpOODs+ODiOaVsFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiBwcm9wcy5iYWNrZW5kRWNzU2NhbGVPdXRFdmFsdWF0aW9uUGVyaW9kcyxcbiAgICAgICAgICAvLyDjgrnjg4bjg4Pjg5fjga7lrprnvqlcbiAgICAgICAgICBzY2FsaW5nU3RlcHM6IFtcbiAgICAgICAgICAgIHsgbG93ZXI6IDAsIHVwcGVyOiA4MCwgY2hhbmdlOiAwIH0sIC8vIENQVeS9v+eUqOeOh+OBjDgwJeacqua6gOOBruWgtOWQiOOAgeOCueOCseODvOODq+OCpOODs+OBr+ihjOOCj+OBquOBhFxuICAgICAgICAgICAgeyBsb3dlcjogODAsIGNoYW5nZTogNTAgfSwgLy8gQ1BV5L2/55So546H44GMODAl44KS6LaF44GI44Gf5aC05ZCI44CB44K/44K544Kv5pWw44KSNTAl5aKX5Yqg44GV44Gb44KLXG4gICAgICAgICAgXSxcbiAgICAgICAgICBtZXRyaWM6IG5ldyBjdy5NZXRyaWMoe1xuICAgICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9FQ1NcIixcbiAgICAgICAgICAgIG1ldHJpY05hbWU6IFwiQ1BVVXRpbGl6YXRpb25cIixcbiAgICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgICAgQ2x1c3Rlck5hbWU6IGVjc0NsdXN0ZXIuY2x1c3Rlck5hbWUsXG4gICAgICAgICAgICAgIFNlcnZpY2VOYW1lOiBlY3NTZXJ2aWNlTmFtZSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICBzdGF0aXN0aWM6IFwiTWF4aW11bVwiLFxuICAgICAgICAgICAgLy8g6KmV5L6h5pyf6ZaTXG4gICAgICAgICAgICBwZXJpb2Q6IHByb3BzLmJhY2tlbmRFY3NTY2FsZU91dFBlcmlvZCxcbiAgICAgICAgICB9KSxcbiAgICAgICAgfSxcbiAgICAgICk7XG5cbiAgICAvLyDjgrnjg4bjg4Pjg5fjgrnjgrHjg7zjg6rjg7PjgrDjgqTjg7Pjg53jg6rjgrfjg7zjga7lrprnvqlcbiAgICBjb25zdCBzdGVwU2NhbGVJbkJhY2tlbmRQb2xpY3kgPVxuICAgICAgbmV3IGFwcGxpY2F0aW9uYXV0b3NjYWxpbmcuU3RlcFNjYWxpbmdQb2xpY3koXG4gICAgICAgIHRoaXMsXG4gICAgICAgIFwiU3RlcFNjYWxpbmdJbkJhY2tlbmRQb2xpY3lcIixcbiAgICAgICAge1xuICAgICAgICAgIHNjYWxpbmdUYXJnZXQ6IGJhY2tlbmRTY2FsYWJsZVRhcmdldCxcbiAgICAgICAgICBhZGp1c3RtZW50VHlwZTpcbiAgICAgICAgICAgIGFwcGxpY2F0aW9uYXV0b3NjYWxpbmcuQWRqdXN0bWVudFR5cGUuUEVSQ0VOVF9DSEFOR0VfSU5fQ0FQQUNJVFksXG4gICAgICAgICAgbWV0cmljQWdncmVnYXRpb25UeXBlOlxuICAgICAgICAgICAgYXBwbGljYXRpb25hdXRvc2NhbGluZy5NZXRyaWNBZ2dyZWdhdGlvblR5cGUuTUFYSU1VTSxcbiAgICAgICAgICAvLyDjgq/jg7zjg6vjg4Djgqbjg7PmnJ/plpNcbiAgICAgICAgICBjb29sZG93bjogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgICAgIC8vIOipleS+oeODneOCpOODs+ODiOaVsFxuICAgICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiBwcm9wcy5iYWNrZW5kRWNzU2NhbGVJbkV2YWx1YXRpb25QZXJpb2RzLFxuICAgICAgICAgIC8vIOOCueODhuODg+ODl+OBruWumue+qVxuICAgICAgICAgIHNjYWxpbmdTdGVwczogW1xuICAgICAgICAgICAgeyB1cHBlcjogNjAsIGNoYW5nZTogLTIwIH0sIC8vIENQVeS9v+eUqOeOh+OBjDYwJeacqua6gOOBruWgtOWQiOOAgeOCv+OCueOCr+aVsOOCkjIwJea4m+WwkeOBleOBm+OCi1xuICAgICAgICAgICAgeyBsb3dlcjogNjAsIGNoYW5nZTogMCB9LCAvLyBDUFXkvb/nlKjnjofjgYw2MCXku6XkuIo4MCXmnKrmuoDjga7loLTlkIjjgIHjgr/jgrnjgq/mlbDjga/lpInmm7TjgZfjgarjgYRcbiAgICAgICAgICBdLFxuICAgICAgICAgIG1ldHJpYzogbmV3IGN3Lk1ldHJpYyh7XG4gICAgICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL0VDU1wiLFxuICAgICAgICAgICAgbWV0cmljTmFtZTogXCJDUFVVdGlsaXphdGlvblwiLFxuICAgICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgICBDbHVzdGVyTmFtZTogZWNzQ2x1c3Rlci5jbHVzdGVyTmFtZSxcbiAgICAgICAgICAgICAgU2VydmljZU5hbWU6IGVjc1NlcnZpY2VOYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHN0YXRpc3RpYzogXCJNYXhpbXVtXCIsXG4gICAgICAgICAgICAvLyDoqZXkvqHmnJ/plpNcbiAgICAgICAgICAgIHBlcmlvZDogcHJvcHMuYmFja2VuZEVjc1NjYWxlSW5QZXJpb2QsXG4gICAgICAgICAgfSksXG4gICAgICAgIH0sXG4gICAgICApO1xuXG4gICAgLy8gRUNT44K/44K544Kv44KS6Ieq5YuV5YGc5q2i44O76ZaL5aeL6Kit5a6a44GZ44KL44Gf44KB44GuSUFN44Ot44O844OrXG4gICAgY29uc3QgYXV0b1NjYWxpbmdTY2hlZHVsZXJFeGVjdXRpb25Sb2xlID0gbmV3IGlhbS5Sb2xlKFxuICAgICAgdGhpcyxcbiAgICAgIFwiQXV0b1NjYWxpbmdTY2hlZHVsZXJFeGVjdXRpb25Sb2xlXCIsXG4gICAgICB7XG4gICAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwic2NoZWR1bGVyLmFtYXpvbmF3cy5jb21cIiksXG4gICAgICB9LFxuICAgICk7XG4gICAgYXV0b1NjYWxpbmdTY2hlZHVsZXJFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcImFwcGxpY2F0aW9uLWF1dG9zY2FsaW5nOlJlZ2lzdGVyU2NhbGFibGVUYXJnZXRcIl0sXG4gICAgICAgIHJlc291cmNlczogW1wiKlwiXSwgLy8gQ0RL44Gn44GvQVJO44KS5Y+W5b6X44Gn44GN44Gq44GE44Gf44KBXCIqXCLjgpLmjIflrppcbiAgICAgIH0pLFxuICAgICk7XG5cbiAgICAvLyBFQ1Pjgr/jgrnjgq/jgpLlgZzmraLjgZnjgovjgrnjgrHjgrjjg6Xjg7zjg6vvvIjjgrnjgrHjg7zjg6njg5bjg6vjgr/jg7zjgrLjg4Pjg4jjga7mnIDlsI/jg7vmnIDlpKfjgr/jgrnjgq/mlbDjgpIw44Gr6Kit5a6a44GZ44KL77yJXG4gICAgbmV3IHNjaGVkdWxlci5DZm5TY2hlZHVsZSh0aGlzLCBcIkF1dG9TY2FsaW5nU3RvcFNjaGVkdWxlXCIsIHtcbiAgICAgIHN0YXRlOiBwcm9wcy5lY3NTY2hlZHVsZXJTdGF0ZSxcbiAgICAgIHNjaGVkdWxlRXhwcmVzc2lvbjogXCJjcm9uKDAgMjEgPyAqIE1PTi1GUkkgKilcIixcbiAgICAgIHNjaGVkdWxlRXhwcmVzc2lvblRpbWV6b25lOiBcIkFzaWEvVG9reW9cIixcbiAgICAgIGZsZXhpYmxlVGltZVdpbmRvdzoge1xuICAgICAgICBtb2RlOiBcIk9GRlwiLFxuICAgICAgfSxcbiAgICAgIHRhcmdldDoge1xuICAgICAgICBhcm46IFwiYXJuOmF3czpzY2hlZHVsZXI6Ojphd3Mtc2RrOmFwcGxpY2F0aW9uYXV0b3NjYWxpbmc6cmVnaXN0ZXJTY2FsYWJsZVRhcmdldFwiLFxuICAgICAgICByb2xlQXJuOiBhdXRvU2NhbGluZ1NjaGVkdWxlckV4ZWN1dGlvblJvbGUucm9sZUFybixcbiAgICAgICAgaW5wdXQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBTZXJ2aWNlTmFtZXNwYWNlOiBcImVjc1wiLFxuICAgICAgICAgIFNjYWxhYmxlRGltZW5zaW9uOiBcImVjczpzZXJ2aWNlOkRlc2lyZWRDb3VudFwiLFxuICAgICAgICAgIFJlc291cmNlSWQ6IGBzZXJ2aWNlLyR7ZWNzQ2x1c3Rlci5jbHVzdGVyTmFtZX0vJHtlY3NTZXJ2aWNlTmFtZX1gLFxuICAgICAgICAgIE1pbkNhcGFjaXR5OiAwLFxuICAgICAgICAgIE1heENhcGFjaXR5OiAwLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBFQ1Pjgr/jgrnjgq/jgpLplovlp4vjgZnjgovjgrnjgrHjgrjjg6Xjg7zjg6vvvIjjgrnjgrHjg7zjg6njg5bjg6vjgr/jg7zjgrLjg4Pjg4jjga7mnIDlsI/jg7vmnIDlpKfjgr/jgrnjgq/mlbDjgpLlhYPjgavmiLvjgZnvvIlcbiAgICBuZXcgc2NoZWR1bGVyLkNmblNjaGVkdWxlKHRoaXMsIFwiQXV0b1NjYWxpbmdTdGFydFNjaGVkdWxlXCIsIHtcbiAgICAgIHN0YXRlOiBwcm9wcy5lY3NTY2hlZHVsZXJTdGF0ZSxcbiAgICAgIHNjaGVkdWxlRXhwcmVzc2lvbjogXCJjcm9uKDAgOCA/ICogTU9OLUZSSSAqKVwiLFxuICAgICAgc2NoZWR1bGVFeHByZXNzaW9uVGltZXpvbmU6IFwiQXNpYS9Ub2t5b1wiLFxuICAgICAgZmxleGlibGVUaW1lV2luZG93OiB7XG4gICAgICAgIG1vZGU6IFwiT0ZGXCIsXG4gICAgICB9LFxuICAgICAgdGFyZ2V0OiB7XG4gICAgICAgIGFybjogXCJhcm46YXdzOnNjaGVkdWxlcjo6OmF3cy1zZGs6YXBwbGljYXRpb25hdXRvc2NhbGluZzpyZWdpc3RlclNjYWxhYmxlVGFyZ2V0XCIsXG4gICAgICAgIHJvbGVBcm46IGF1dG9TY2FsaW5nU2NoZWR1bGVyRXhlY3V0aW9uUm9sZS5yb2xlQXJuLFxuICAgICAgICBpbnB1dDogSlNPTi5zdHJpbmdpZnkoe1xuICAgICAgICAgIFNlcnZpY2VOYW1lc3BhY2U6IFwiZWNzXCIsXG4gICAgICAgICAgU2NhbGFibGVEaW1lbnNpb246IFwiZWNzOnNlcnZpY2U6RGVzaXJlZENvdW50XCIsXG4gICAgICAgICAgUmVzb3VyY2VJZDogYHNlcnZpY2UvJHtlY3NDbHVzdGVyLmNsdXN0ZXJOYW1lfS8ke2Vjc1NlcnZpY2VOYW1lfWAsXG4gICAgICAgICAgTWluQ2FwYWNpdHk6IHByb3BzLmJhY2tlbmRNaW5UYXNrQ291bnQsIC8vIOWFg+OBruacgOWwj+OCv+OCueOCr+aVsFxuICAgICAgICAgIE1heENhcGFjaXR5OiBwcm9wcy5iYWNrZW5kTWF4VGFza0NvdW50LCAvLyDlhYPjga7mnIDlpKfjgr/jgrnjgq/mlbBcbiAgICAgICAgfSksXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBEQumWouS/glxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuXG4gICAgLy8gQXVyb3Jh44GuUG9zdGdyZVNRTOODkOODvOOCuOODp+ODs+OCkuaMh+WumlxuICAgIGNvbnN0IFBvc3RncmVzVmVyc2lvbiA9IHByb3BzLnBvc3RncmVzVmVyc2lvbjtcblxuICAgIC8vIOODkeODqeODoeODvOOCv+OCsOODq+ODvOODl1xuICAgIGNvbnN0IHBhcmFtZXRlckdyb3VwID0gbmV3IHJkcy5QYXJhbWV0ZXJHcm91cCh0aGlzLCBcIlBhcmFtZXRlckdyb3VwXCIsIHtcbiAgICAgIGVuZ2luZTogcmRzLkRhdGFiYXNlQ2x1c3RlckVuZ2luZS5hdXJvcmFQb3N0Z3Jlcyh7XG4gICAgICAgIHZlcnNpb246IFBvc3RncmVzVmVyc2lvbixcbiAgICAgIH0pLFxuICAgICAgcmVtb3ZhbFBvbGljeTogUmVtb3ZhbFBvbGljeS5ERVNUUk9ZLFxuICAgIH0pO1xuXG4gICAgLy8g44K144OW44ON44OD44OI44Kw44Or44O844OXXG4gICAgY29uc3Qgc3VibmV0R3JvdXAgPSBuZXcgcmRzLlN1Ym5ldEdyb3VwKHRoaXMsIFwiU3VibmV0R3JvdXBcIiwge1xuICAgICAgZGVzY3JpcHRpb246IFwiU3VibmV0IGdyb3VwIGZvciBBdXJvcmEgZGF0YWJhc2VcIixcbiAgICAgIHZwYzogdnBjLFxuICAgICAgdnBjU3VibmV0czoge1xuICAgICAgICBzdWJuZXRUeXBlOiBlYzIuU3VibmV0VHlwZS5QUklWQVRFX1dJVEhfRUdSRVNTLFxuICAgICAgfSxcbiAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICB9KTtcblxuICAgIC8vIEtNU+OCreODvFxuICAgIGNvbnN0IGF1cm9yYUVuY3J5cHRpb25LZXkgPSBuZXcga21zLktleShcbiAgICAgIHRoaXMsXG4gICAgICBcIkF1cm9yYVN0b3JhZ2VFbmNyeXB0aW9uS2V5XCIsXG4gICAgICB7XG4gICAgICAgIGVuYWJsZUtleVJvdGF0aW9uOiB0cnVlLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJLTVMga2V5IGZvciBBdXJvcmEgc3RvcmFnZSBlbmNyeXB0aW9uXCIsXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyBBdXJvcmEgU2VydmVybGVzcyBjbHVzdGVyXG4gICAgY29uc3QgZGJDbHVzdGVyID0gbmV3IHJkcy5EYXRhYmFzZUNsdXN0ZXIodGhpcywgXCJBdXJvcmFTZXJ2ZXJsZXNzQ2x1c3RlclwiLCB7XG4gICAgICBlbmdpbmU6IHJkcy5EYXRhYmFzZUNsdXN0ZXJFbmdpbmUuYXVyb3JhUG9zdGdyZXMoe1xuICAgICAgICB2ZXJzaW9uOiBQb3N0Z3Jlc1ZlcnNpb24sXG4gICAgICB9KSxcbiAgICAgIGNyZWRlbnRpYWxzOiByZHMuQ3JlZGVudGlhbHMuZnJvbVNlY3JldChkYlNlY3JldCksXG4gICAgICB3cml0ZXI6IHJkcy5DbHVzdGVySW5zdGFuY2Uuc2VydmVybGVzc1YyKFwiV3JpdGVyXCIsIHtcbiAgICAgICAgcGVyZm9ybWFuY2VJbnNpZ2h0UmV0ZW50aW9uOiByZHMuUGVyZm9ybWFuY2VJbnNpZ2h0UmV0ZW50aW9uLkRFRkFVTFQsIC8vIFBlcmZvcm1hbmNlIEluc2lnaHRz44KSN+aXpemWk+acieWKueWMllxuICAgICAgICBhdXRvTWlub3JWZXJzaW9uVXBncmFkZTogZmFsc2UsIC8vIOODnuOCpOODiuODvOODkOODvOOCuOODp+ODs+OCouODg+ODl+OCsOODrOODvOODieOCkueEoeWKueWMllxuICAgICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogXCJTdW46MTM6MzAtU3VuOjE0OjAwXCIsIC8vIOaXpeacrOaZgumWk+OBruaXpeabnDIyOjMwLTIzOjAw44Gr44Oh44Oz44OG44OK44Oz44K55a6f5pa9XG4gICAgICB9KSxcbiAgICAgIHJlYWRlcnM6IHByb3BzLmlzUmVhZFJlcGxpY2FFbmFibGVkXG4gICAgICAgID8gW1xuICAgICAgICAgICAgcmRzLkNsdXN0ZXJJbnN0YW5jZS5zZXJ2ZXJsZXNzVjIoXCJSZWFkZXJcIiwge1xuICAgICAgICAgICAgICBwZXJmb3JtYW5jZUluc2lnaHRSZXRlbnRpb246XG4gICAgICAgICAgICAgICAgcmRzLlBlcmZvcm1hbmNlSW5zaWdodFJldGVudGlvbi5ERUZBVUxULFxuICAgICAgICAgICAgICBhdXRvTWlub3JWZXJzaW9uVXBncmFkZTogZmFsc2UsIC8vIOODnuOCpOODiuODvOODkOODvOOCuOODp+ODs+OCouODg+ODl+OCsOODrOODvOODieOCkueEoeWKueWMllxuICAgICAgICAgICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogXCJTdW46MTQ6MDAtU3VuOjE0OjMwXCIsIC8vIOaXpeacrOaZgumWk+OBruaXpeabnDIzOjAwLTIzOjMw44Gr44Oh44Oz44OG44OK44Oz44K55a6f5pa9XG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdXG4gICAgICAgIDogdW5kZWZpbmVkLFxuICAgICAgdnBjLFxuICAgICAgcGFyYW1ldGVyR3JvdXAsXG4gICAgICBzdWJuZXRHcm91cCxcbiAgICAgIHNlcnZlcmxlc3NWMk1pbkNhcGFjaXR5OiBwcm9wcy5hdXJvcmFTZXJ2ZXJsZXNzVjJNaW5DYXBhY2l0eSxcbiAgICAgIHNlcnZlcmxlc3NWMk1heENhcGFjaXR5OiBwcm9wcy5hdXJvcmFTZXJ2ZXJsZXNzVjJNYXhDYXBhY2l0eSxcbiAgICAgIGlhbUF1dGhlbnRpY2F0aW9uOiB0cnVlLCAvLyBJQU3jg4fjg7zjgr/jg5njg7zjgrnoqo3oqLzjgpLmnInlirnjgavjgZnjgotcbiAgICAgIGVuYWJsZURhdGFBcGk6IHRydWUsIC8vIERhdGEgQVBJ44KS5pyJ5Yq544Gr44GZ44KLXG4gICAgICBzdG9yYWdlRW5jcnlwdGlvbktleTogYXVyb3JhRW5jcnlwdGlvbktleSwgLy8g44K544OI44Os44O844K444Gu5pqX5Y+35YyW44Kt44O844KS5oyH5a6aXG4gICAgICBzdG9yYWdlRW5jcnlwdGVkOiB0cnVlLCAvLyDjgrnjg4jjg6zjg7zjgrjjga7mmpflj7fljJbjgpLmnInlirnljJZcbiAgICAgIGNsb3Vkd2F0Y2hMb2dzRXhwb3J0czogW1wicG9zdGdyZXNxbFwiXSwgLy8gUG9zdGdyZVNRTOODreOCsOOCkkNsb3VkV2F0Y2ggTG9nc+OBq+OCqOOCr+OCueODneODvOODiFxuICAgICAgY2xvdWR3YXRjaExvZ3NSZXRlbnRpb246IHByb3BzLmxvZ1JldGVudGlvbkRheXMsIC8vIENsb3VkV2F0Y2ggTG9nc+OBruS/neaMgeacn+mWk+OCkuaMh+WumlxuICAgICAgYmFja3VwOiB7XG4gICAgICAgIHJldGVudGlvbjogRHVyYXRpb24uZGF5cyg3KSwgLy8g44OQ44OD44Kv44Ki44OD44OX5L+d5oyB5pyf6ZaT44KSN+aXpeOBq+ioreWumlxuICAgICAgICBwcmVmZXJyZWRXaW5kb3c6IFwiMTY6MDAtMTc6MDBcIiwgLy8g5pel5pys5pmC6ZaT44GuMDE6MDAtMDI6MDDjgavoh6rli5Xjg5Djg4Pjgq/jgqLjg4Pjg5flrp/mlr1cbiAgICAgIH0sXG4gICAgICBwcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogXCJTdW46MTM6MDAtU3VuOjEzOjMwXCIsIC8vIOaXpeacrOaZgumWk+OBruaXpeabnDIyOjAwLTIyOjMw44Gr44Oh44Oz44OG44OK44Oz44K55a6f5pa9XG4gICAgICBkZWxldGlvblByb3RlY3Rpb246IHByb3BzLmF1cm9yYURlbGV0aW9uUHJvdGVjdGlvbixcbiAgICB9KTtcblxuICAgIC8vRUNT44K/44K544Kv44Ot44O844Or44GrRELjgqLjgq/jgrvjgrnoqLHlj6/jgpLov73liqBcbiAgICB0YXNrRXhlY3V0aW9uUm9sZS5hZGRUb1BvbGljeShcbiAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICBhY3Rpb25zOiBbXCJyZHMtZGI6Y29ubmVjdFwiLCBcInJkczpEZXNjcmliZURCSW5zdGFuY2VzXCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtkYkNsdXN0ZXIuY2x1c3RlckFybl0sXG4gICAgICB9KSxcbiAgICApO1xuXG4gICAgLy8gRELjg5Hjgrnjg6/jg7zjg4njga7jg63jg7zjg4bjg7zjgrfjg6fjg7PjgpLmnInlirnljJZcbiAgICBkYkNsdXN0ZXIuYWRkUm90YXRpb25TaW5nbGVVc2VyKHtcbiAgICAgIGF1dG9tYXRpY2FsbHlBZnRlcjogRHVyYXRpb24uZGF5cygzMCksXG4gICAgICBleGNsdWRlQ2hhcmFjdGVyczogJ1wiQC9cXFxcJyxcbiAgICB9KTtcblxuICAgIC8vIERC44Gu6Ieq5YuV5a6a5pyf6ZaL5aeL44O75YGc5q2i6Kit5a6aXG4gICAgLy8gRXZlbnRCcmlkZ2UgU2NoZWR1bGVy44Gu5a6f6KGM44Ot44O844OrXG4gICAgY29uc3QgYXVyb3JhU2NoZWR1bGVyRXhlY3V0aW9uUm9sZSA9IG5ldyBpYW0uUm9sZShcbiAgICAgIHRoaXMsXG4gICAgICBcIkF1cm9yYVNjaGVkdWxlckV4ZWN1dGlvblJvbGVcIixcbiAgICAgIHtcbiAgICAgICAgYXNzdW1lZEJ5OiBuZXcgaWFtLlNlcnZpY2VQcmluY2lwYWwoXCJzY2hlZHVsZXIuYW1hem9uYXdzLmNvbVwiKSxcbiAgICAgIH0sXG4gICAgKTtcbiAgICBhdXJvcmFTY2hlZHVsZXJFeGVjdXRpb25Sb2xlLmFkZFRvUG9saWN5KFxuICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgIGFjdGlvbnM6IFtcInJkczpTdG9wREJDbHVzdGVyXCIsIFwicmRzOlN0YXJ0REJDbHVzdGVyXCJdLFxuICAgICAgICByZXNvdXJjZXM6IFtkYkNsdXN0ZXIuY2x1c3RlckFybl0sXG4gICAgICB9KSxcbiAgICApO1xuICAgIC8vIOmWi+Wni+OCueOCseOCuOODpeODvOODq1xuICAgIG5ldyBzY2hlZHVsZXIuQ2ZuU2NoZWR1bGUodGhpcywgXCJBdXJvcmFTdGFydFNjaGVkdWxlXCIsIHtcbiAgICAgIHN0YXRlOiBwcm9wcy5hdXJvcmFTY2hlZHVsZXJTdGF0ZSxcbiAgICAgIHNjaGVkdWxlRXhwcmVzc2lvbjogXCJjcm9uKDIwIDcgPyAqIE1PTi1GUkkgKilcIiwgLy8gRELjga7otbfli5XjgavmmYLplpPjgYzjgYvjgYvjgovjgZ/jgoHjgIFFQ1Pjga7jgr/jgrnjgq/plovlp4vmmYLliLvjgojjgoo0MOWIhuaXqeOCgeOCi1xuICAgICAgc2NoZWR1bGVFeHByZXNzaW9uVGltZXpvbmU6IFwiQXNpYS9Ub2t5b1wiLFxuICAgICAgZmxleGlibGVUaW1lV2luZG93OiB7XG4gICAgICAgIG1vZGU6IFwiT0ZGXCIsXG4gICAgICB9LFxuICAgICAgdGFyZ2V0OiB7XG4gICAgICAgIGFybjogXCJhcm46YXdzOnNjaGVkdWxlcjo6OmF3cy1zZGs6cmRzOnN0YXJ0REJDbHVzdGVyXCIsXG4gICAgICAgIHJvbGVBcm46IGF1cm9yYVNjaGVkdWxlckV4ZWN1dGlvblJvbGUucm9sZUFybixcbiAgICAgICAgaW5wdXQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBEYkNsdXN0ZXJJZGVudGlmaWVyOiBkYkNsdXN0ZXIuY2x1c3RlcklkZW50aWZpZXIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcbiAgICAvLyDlgZzmraLjgrnjgrHjgrjjg6Xjg7zjg6tcbiAgICBuZXcgc2NoZWR1bGVyLkNmblNjaGVkdWxlKHRoaXMsIFwiQXVyb3JhU3RvcFNjaGVkdWxlXCIsIHtcbiAgICAgIHN0YXRlOiBwcm9wcy5hdXJvcmFTY2hlZHVsZXJTdGF0ZSxcbiAgICAgIHNjaGVkdWxlRXhwcmVzc2lvbjogXCJjcm9uKDAgMjEgPyAqIE1PTi1GUkkgKilcIixcbiAgICAgIHNjaGVkdWxlRXhwcmVzc2lvblRpbWV6b25lOiBcIkFzaWEvVG9reW9cIixcbiAgICAgIGZsZXhpYmxlVGltZVdpbmRvdzoge1xuICAgICAgICBtb2RlOiBcIk9GRlwiLFxuICAgICAgfSxcbiAgICAgIHRhcmdldDoge1xuICAgICAgICBhcm46IFwiYXJuOmF3czpzY2hlZHVsZXI6Ojphd3Mtc2RrOnJkczpzdG9wREJDbHVzdGVyXCIsXG4gICAgICAgIHJvbGVBcm46IGF1cm9yYVNjaGVkdWxlckV4ZWN1dGlvblJvbGUucm9sZUFybixcbiAgICAgICAgaW5wdXQ6IEpTT04uc3RyaW5naWZ5KHtcbiAgICAgICAgICBEYkNsdXN0ZXJJZGVudGlmaWVyOiBkYkNsdXN0ZXIuY2x1c3RlcklkZW50aWZpZXIsXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIOi4j+OBv+WPsOOCteODvOODkOODvFxuICAgIGNvbnN0IGJhc3Rpb25Ib3N0ID0gbmV3IGVjMi5CYXN0aW9uSG9zdExpbnV4KHRoaXMsIFwiQmFzdGlvbkhvc3RcIiwge1xuICAgICAgdnBjLFxuICAgICAgaW5zdGFuY2VUeXBlOiBlYzIuSW5zdGFuY2VUeXBlLm9mKFxuICAgICAgICBlYzIuSW5zdGFuY2VDbGFzcy5UMixcbiAgICAgICAgZWMyLkluc3RhbmNlU2l6ZS5OQU5PLFxuICAgICAgKSxcbiAgICAgIG1hY2hpbmVJbWFnZTogZWMyLk1hY2hpbmVJbWFnZS5sYXRlc3RBbWF6b25MaW51eDIwMjMoe1xuICAgICAgICBjcHVUeXBlOiBlYzIuQW1hem9uTGludXhDcHVUeXBlLlg4Nl82NCxcbiAgICAgIH0pLFxuICAgICAgc3VibmV0U2VsZWN0aW9uOiB7XG4gICAgICAgIHN1Ym5ldFR5cGU6IGVjMi5TdWJuZXRUeXBlLlBSSVZBVEVfV0lUSF9FR1JFU1MsXG4gICAgICB9LFxuICAgIH0pO1xuXG4gICAgYmFzdGlvbkhvc3QuaW5zdGFuY2UudXNlckRhdGEuYWRkQ29tbWFuZHMoXG4gICAgICBcInN1ZG8gZG5mIHVwZGF0ZSAteVwiLFxuICAgICAgYHN1ZG8gZG5mIGluc3RhbGwgLXkgcG9zdGdyZXNxbCR7cHJvcHMucG9zdGdyZXNDbGllbnRWZXJzaW9ufWAsXG4gICAgKTtcblxuICAgIC8vIOi4j+OBv+WPsOOCteODvOODkOODvOOBi+OCiUF1cm9yYeOBuOOBruOCouOCr+OCu+OCueOCkuioseWPr1xuICAgIGRiQ2x1c3Rlci5jb25uZWN0aW9ucy5hbGxvd0Zyb20oXG4gICAgICBiYXN0aW9uSG9zdCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg1NDMyKSxcbiAgICAgIFwiQWxsb3cgYWNjZXNzIGZyb20gQmFzdGlvbiBob3N0XCIsXG4gICAgKTtcbiAgICAvLyBCYWNrZW5kIEVDUyBTZXJ2aWNl44GL44KJQXVyb3Jh44G444Gu44Ki44Kv44K744K544KS6Kix5Y+vXG4gICAgZGJDbHVzdGVyLmNvbm5lY3Rpb25zLmFsbG93RnJvbShcbiAgICAgIGJhY2tlbmRFY3NTZXJ2aWNlU2VjdXJpdHlHcm91cCxcbiAgICAgIGVjMi5Qb3J0LnRjcCg1NDMyKSxcbiAgICAgIFwiQWxsb3cgYWNjZXNzIGZyb20gQmFja2VuZCBFQ1MgU2VydmljZVwiLFxuICAgICk7XG5cbiAgICAvKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKlxuICAgICAqIOODoeODvOODq+mAgeS/oeapn+iDvVxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIC8vIOWQhOODhuODiuODs+ODiOODieODoeOCpOODs+OBrlNFU+ioreWumlxuICAgIGZvciAoY29uc3QgdGVuYW50IG9mIHByb3BzLnRlbmFudHMpIHtcbiAgICAgIC8vIFNFU+OBruS9nOaIkOOBjOacieWKueOBquWgtOWQiOOBruOBv+Wun+ihjFxuICAgICAgaWYgKHRlbmFudC5pc1Nlc0VuYWJsZWQpIHtcbiAgICAgICAgLy8gU0VTIElEXG4gICAgICAgIG5ldyBzZXMuRW1haWxJZGVudGl0eShcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGBFbWFpbElkZW50aXR5LSR7dGVuYW50LmFwcERvbWFpbk5hbWUucmVwbGFjZSgvXFwuL2csIFwiLVwiKX1gLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGlkZW50aXR5OiBzZXMuSWRlbnRpdHkucHVibGljSG9zdGVkWm9uZShcbiAgICAgICAgICAgICAgYmFzZURvbWFpblpvbmVNYXBbdGVuYW50LmFwcERvbWFpbk5hbWVdLFxuICAgICAgICAgICAgKSxcbiAgICAgICAgICAgIG1haWxGcm9tRG9tYWluOiBgYm91bmNlLiR7dGVuYW50LmFwcERvbWFpbk5hbWV9YCxcbiAgICAgICAgICB9LFxuICAgICAgICApO1xuXG4gICAgICAgIC8vIERNQVJD6Kit5a6aXG4gICAgICAgIG5ldyByb3V0ZTUzLlR4dFJlY29yZChcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGBEbWFyY1JlY29yZC0ke3RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCBcIi1cIil9YCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICB6b25lOiBiYXNlRG9tYWluWm9uZU1hcFt0ZW5hbnQuYXBwRG9tYWluTmFtZV0sXG4gICAgICAgICAgICByZWNvcmROYW1lOiBgX2RtYXJjLiR7dGVuYW50LmFwcERvbWFpbk5hbWV9YCxcbiAgICAgICAgICAgIHZhbHVlczogW2B2PURNQVJDMTsgcD1ub25lOyBydWE9bWFpbHRvOiR7cHJvcHMuZG1hcmNSZXBvcnRFbWFpbH1gXSxcbiAgICAgICAgICAgIHR0bDogRHVyYXRpb24uaG91cnMoMSksXG4gICAgICAgICAgfSxcbiAgICAgICAgKTtcbiAgICAgIH0gZWxzZSB7XG4gICAgICAgIC8vIFNFU+OBruS9nOaIkOOBjOeEoeWKueOBquWgtOWQiOOAgeOCueOCreODg+ODl+OBleOCjOOBn+OBk+OBqOOCkuODreOCsOOBq+WHuuWKm++8iENESyBzeW50aC9kZXBsb3nmmYLjgavooajnpLrjgZXjgozjgovvvIlcbiAgICAgICAgY29uc29sZS5sb2coXG4gICAgICAgICAgYFNraXBwaW5nIFNFUyBJZGVudGl0eSBhbmQgRE1BUkMgUmVjb3JkIGNyZWF0aW9uIGZvciB0ZW5hbnQ6ICR7dGVuYW50LmFwcERvbWFpbk5hbWV9IGFzIGlzU2VzRW5hYmxlZCBpcyBmYWxzZS5gLFxuICAgICAgICApO1xuICAgICAgfVxuICAgIH1cblxuICAgIC8qKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqXG4gICAgICogU05T44OI44OU44OD44Kv44O7Q2hhdGJvdFxuICAgICAqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqL1xuICAgIGNvbnN0IHdhcm5pbmdTbnNUb3BpYyA9IG5ldyBzbnMuVG9waWModGhpcywgXCJXYXJuaW5nU25zVG9waWNcIiwge30pO1xuXG4gICAgLy8gQ2hhdGJvdOeUqElBTeODreODvOODq1xuICAgIGNvbnN0IHNsYWNrQ2hhdGJvdFJvbGUgPSBuZXcgaWFtLlJvbGUodGhpcywgXCJTbGFja0NoYXRib3RSb2xlXCIsIHtcbiAgICAgIGFzc3VtZWRCeTogbmV3IGlhbS5TZXJ2aWNlUHJpbmNpcGFsKFwiY2hhdGJvdC5hbWF6b25hd3MuY29tXCIpLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgU2xhY2tOb3RpZmljYXRpb25DaGF0Qm90UG9saWN5OiBuZXcgaWFtLlBvbGljeURvY3VtZW50KHtcbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiY2xvdWR3YXRjaDpEZXNjcmliZSpcIixcbiAgICAgICAgICAgICAgICBcImNsb3Vkd2F0Y2g6R2V0KlwiLFxuICAgICAgICAgICAgICAgIFwiY2xvdWR3YXRjaDpMaXN0KlwiLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcIipcIl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIH0sXG4gICAgfSk7XG5cbiAgICAvLyBTbGFja+ODgeODo+ODjeODq+ani+aIkOOBruS9nOaIkFxuICAgIG5ldyBjaGF0Ym90LlNsYWNrQ2hhbm5lbENvbmZpZ3VyYXRpb24odGhpcywgXCJXYXJuaW5nU2xhY2tDaGFubmVsQ29uZmlnXCIsIHtcbiAgICAgIHNsYWNrQ2hhbm5lbENvbmZpZ3VyYXRpb25OYW1lOiBgJHt0aGlzLnN0YWNrTmFtZX0tJHt0aGlzLm5vZGUuaWR9YCxcbiAgICAgIHNsYWNrQ2hhbm5lbElkOiBwcm9wcy53YXJuaW5nU2xhY2tDaGFubmVsSWQsXG4gICAgICBzbGFja1dvcmtzcGFjZUlkOiBwcm9wcy5zbGFja1dvcmtzcGFjZUlkLFxuICAgICAgbm90aWZpY2F0aW9uVG9waWNzOiBbd2FybmluZ1Nuc1RvcGljXSxcbiAgICAgIGxvZ2dpbmdMZXZlbDogY2hhdGJvdC5Mb2dnaW5nTGV2ZWwuRVJST1IsXG4gICAgICBndWFyZHJhaWxQb2xpY2llczogW1xuICAgICAgICBpYW0uTWFuYWdlZFBvbGljeS5mcm9tQXdzTWFuYWdlZFBvbGljeU5hbWUoXCJSZWFkT25seUFjY2Vzc1wiKSxcbiAgICAgIF0sXG4gICAgICByb2xlOiBzbGFja0NoYXRib3RSb2xlLFxuICAgIH0pO1xuXG4gICAgLyoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKipcbiAgICAgKiBDbG91ZFdhdGNo44Ki44Op44O844OgXG4gICAgICoqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKioqKiovXG4gICAgLy8gQ1BVVXRpbGl6YXRpb25cbiAgICBjb25zdCBhdXJvcmFDcHVVdGlsaXphdGlvbkFsYXJtID0gbmV3IGN3LkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgIFwiQXVyb3JhQ3B1VXRpbGl6YXRpb25BbGFybVwiLFxuICAgICAge1xuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBcIkF1cm9yYSBDUFUgVXRpbGl6YXRpb24gZXhjZWVkcyA4MCVcIixcbiAgICAgICAgbWV0cmljOiBuZXcgY3cuTWV0cmljKHtcbiAgICAgICAgICBuYW1lc3BhY2U6IFwiQVdTL1JEU1wiLFxuICAgICAgICAgIG1ldHJpY05hbWU6IFwiQ1BVVXRpbGl6YXRpb25cIixcbiAgICAgICAgICBkaW1lbnNpb25zTWFwOiB7XG4gICAgICAgICAgICBEQkNsdXN0ZXJJZGVudGlmaWVyOiBkYkNsdXN0ZXIuY2x1c3RlcklkZW50aWZpZXIsXG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0aXN0aWM6IFwiQXZlcmFnZVwiLFxuICAgICAgICAgIHBlcmlvZDogRHVyYXRpb24uc2Vjb25kcygzMDApLFxuICAgICAgICB9KSxcbiAgICAgICAgZXZhbHVhdGlvblBlcmlvZHM6IDEsXG4gICAgICAgIHRocmVzaG9sZDogODAsXG4gICAgICAgIGNvbXBhcmlzb25PcGVyYXRvcjogY3cuQ29tcGFyaXNvbk9wZXJhdG9yLkdSRUFURVJfVEhBTl9USFJFU0hPTEQsXG4gICAgICAgIHRyZWF0TWlzc2luZ0RhdGE6IGN3LlRyZWF0TWlzc2luZ0RhdGEuQlJFQUNISU5HLFxuICAgICAgfSxcbiAgICApO1xuICAgIC8vIOOCouODqeODvOODoOOCouOCr+OCt+ODp+ODs+OBruioreWumlxuICAgIGF1cm9yYUNwdVV0aWxpemF0aW9uQWxhcm0uYWRkQWxhcm1BY3Rpb24oXG4gICAgICBuZXcgY3dfYWN0aW9ucy5TbnNBY3Rpb24od2FybmluZ1Nuc1RvcGljKSxcbiAgICApO1xuICAgIGF1cm9yYUNwdVV0aWxpemF0aW9uQWxhcm0uYWRkT2tBY3Rpb24oXG4gICAgICBuZXcgY3dfYWN0aW9ucy5TbnNBY3Rpb24od2FybmluZ1Nuc1RvcGljKSxcbiAgICApO1xuXG4gICAgLy8gRnJlZWFibGVNZW1vcnlcbiAgICBjb25zdCBhdXJvcmFGcmVlYWJsZU1lbW9yeUFsYXJtID0gbmV3IGN3LkFsYXJtKFxuICAgICAgdGhpcyxcbiAgICAgIFwiQXVyb3JhRnJlZWFibGVNZW1vcnlBbGFybVwiLFxuICAgICAge1xuICAgICAgICBhbGFybURlc2NyaXB0aW9uOiBcIkF1cm9yYSBGcmVlYWJsZU1lbW9yeSBleGNlZWRzIDk1JVwiLFxuICAgICAgICBtZXRyaWM6IG5ldyBjdy5NZXRyaWMoe1xuICAgICAgICAgIG5hbWVzcGFjZTogXCJBV1MvUkRTXCIsXG4gICAgICAgICAgbWV0cmljTmFtZTogXCJGcmVlYWJsZU1lbW9yeVwiLFxuICAgICAgICAgIGRpbWVuc2lvbnNNYXA6IHtcbiAgICAgICAgICAgIERCQ2x1c3RlcklkZW50aWZpZXI6IGRiQ2x1c3Rlci5jbHVzdGVySWRlbnRpZmllcixcbiAgICAgICAgICB9LFxuICAgICAgICAgIHN0YXRpc3RpYzogXCJBdmVyYWdlXCIsXG4gICAgICAgICAgcGVyaW9kOiBEdXJhdGlvbi5zZWNvbmRzKDMwMCksXG4gICAgICAgIH0pLFxuICAgICAgICBldmFsdWF0aW9uUGVyaW9kczogMSxcbiAgICAgICAgLy8g44Oh44Oi44Oq56m644GN5a656YeP44Gu6Za+5YCk44KS6Kit5a6aLi4u5pyA5aSn44Oh44Oi44Oq5a656YeP44GuNSVcbiAgICAgICAgLy8gLSDmnIDlpKdBQ1XmlbAgw5cgMkdCID0g5pyA5aSn44Oh44Oi44Oq5a656YePICgxQUNV44GC44Gf44KKMkdC44Gu44Oh44Oi44OqKVxuICAgICAgICAvLyAtIOODoeODouODquepuuOBjeWuuemHj+OBjOacgOWkp+ODoeODouODquWuuemHj+OBrjUl5Lul5LiL44Gr44Gq44Gj44Gf44KJ44Ki44Op44O844OI77yI44Oh44Oi44Oq5L2/55So6YeP44GMOTUl5Lul5LiK44Gr44Gq44Gj44Gf44KJ44Ki44Op44O844OI77yJXG4gICAgICAgIHRocmVzaG9sZDogcHJvcHMuYXVyb3JhU2VydmVybGVzc1YyTWF4Q2FwYWNpdHkgKiAyICogMC4wNSxcbiAgICAgICAgY29tcGFyaXNvbk9wZXJhdG9yOiBjdy5Db21wYXJpc29uT3BlcmF0b3IuTEVTU19USEFOX1RIUkVTSE9MRCxcbiAgICAgICAgdHJlYXRNaXNzaW5nRGF0YTogY3cuVHJlYXRNaXNzaW5nRGF0YS5CUkVBQ0hJTkcsXG4gICAgICB9LFxuICAgICk7XG4gICAgLy8g44Ki44Op44O844Og44Ki44Kv44K344On44Oz44Gu6Kit5a6aXG4gICAgYXVyb3JhRnJlZWFibGVNZW1vcnlBbGFybS5hZGRBbGFybUFjdGlvbihcbiAgICAgIG5ldyBjd19hY3Rpb25zLlNuc0FjdGlvbih3YXJuaW5nU25zVG9waWMpLFxuICAgICk7XG4gICAgYXVyb3JhRnJlZWFibGVNZW1vcnlBbGFybS5hZGRPa0FjdGlvbihcbiAgICAgIG5ldyBjd19hY3Rpb25zLlNuc0FjdGlvbih3YXJuaW5nU25zVG9waWMpLFxuICAgICk7XG5cbiAgICAvLyBBQ1VVdGlsaXphdGlvblxuICAgIGNvbnN0IGF1cm9yYUFjdVV0aWxpemF0aW9uQWxhcm0gPSBuZXcgY3cuQWxhcm0oXG4gICAgICB0aGlzLFxuICAgICAgXCJBdXJvcmFBY3VVdGlsaXphdGlvbkFsYXJtXCIsXG4gICAgICB7XG4gICAgICAgIGFsYXJtRGVzY3JpcHRpb246IFwiQXVyb3JhIEFDVVV0aWxpemF0aW9uIGV4Y2VlZHMgODAlXCIsXG4gICAgICAgIG1ldHJpYzogbmV3IGN3Lk1ldHJpYyh7XG4gICAgICAgICAgbmFtZXNwYWNlOiBcIkFXUy9SRFNcIixcbiAgICAgICAgICBtZXRyaWNOYW1lOiBcIkFDVVV0aWxpemF0aW9uXCIsXG4gICAgICAgICAgZGltZW5zaW9uc01hcDoge1xuICAgICAgICAgICAgREJDbHVzdGVySWRlbnRpZmllcjogZGJDbHVzdGVyLmNsdXN0ZXJJZGVudGlmaWVyLFxuICAgICAgICAgIH0sXG4gICAgICAgICAgc3RhdGlzdGljOiBcIkF2ZXJhZ2VcIixcbiAgICAgICAgICBwZXJpb2Q6IER1cmF0aW9uLnNlY29uZHMoMzAwKSxcbiAgICAgICAgfSksXG4gICAgICAgIGV2YWx1YXRpb25QZXJpb2RzOiAxLFxuICAgICAgICB0aHJlc2hvbGQ6IDgwLFxuICAgICAgICBjb21wYXJpc29uT3BlcmF0b3I6IGN3LkNvbXBhcmlzb25PcGVyYXRvci5HUkVBVEVSX1RIQU5fVEhSRVNIT0xELFxuICAgICAgICB0cmVhdE1pc3NpbmdEYXRhOiBjdy5UcmVhdE1pc3NpbmdEYXRhLkJSRUFDSElORyxcbiAgICAgIH0sXG4gICAgKTtcbiAgICAvLyDjgqLjg6njg7zjg6DjgqLjgq/jgrfjg6fjg7Pjga7oqK3lrppcbiAgICBhdXJvcmFBY3VVdGlsaXphdGlvbkFsYXJtLmFkZEFsYXJtQWN0aW9uKFxuICAgICAgbmV3IGN3X2FjdGlvbnMuU25zQWN0aW9uKHdhcm5pbmdTbnNUb3BpYyksXG4gICAgKTtcbiAgICBhdXJvcmFBY3VVdGlsaXphdGlvbkFsYXJtLmFkZE9rQWN0aW9uKFxuICAgICAgbmV3IGN3X2FjdGlvbnMuU25zQWN0aW9uKHdhcm5pbmdTbnNUb3BpYyksXG4gICAgKTtcblxuICAgIC8vIEdpdEh1YiBBY3Rpb25z55So44GuT0lEQ+ODl+ODreODkOOCpOODgOODvFxuICAgIGNvbnN0IGdpdGh1YkFjdGlvbnNPaWRjUHJvdmlkZXJBcm4gPSBGbi5pbXBvcnRWYWx1ZShcbiAgICAgIFwiR2l0SHViQWN0aW9uc09pZGNQcm92aWRlckFyblwiLFxuICAgICk7XG5cbiAgICAvL0dpdEh1YiBBY3Rpb25z55So44GuSUFN44Ot44O844Or44Go44Od44Oq44K344O8XG4gICAgbmV3IGlhbS5Sb2xlKHRoaXMsIFwiR2l0SHViQWN0aW9uc1JvbGVcIiwge1xuICAgICAgcm9sZU5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1HaXRIdWJBY3Rpb25zUm9sZWAsXG4gICAgICBhc3N1bWVkQnk6IG5ldyBpYW0uV2ViSWRlbnRpdHlQcmluY2lwYWwoZ2l0aHViQWN0aW9uc09pZGNQcm92aWRlckFybiwge1xuICAgICAgICBTdHJpbmdMaWtlOiB7XG4gICAgICAgICAgXCJ0b2tlbi5hY3Rpb25zLmdpdGh1YnVzZXJjb250ZW50LmNvbTpzdWJcIjogYHJlcG86JHtwcm9wcy5naXRodWJPcmdOYW1lfS8ke3Byb3BzLmdpdGh1YlJlcG9zaXRvcnlOYW1lfToqYCxcbiAgICAgICAgfSxcbiAgICAgIH0pLFxuICAgICAgaW5saW5lUG9saWNpZXM6IHtcbiAgICAgICAgR2l0SHViQWN0aW9uc1BvbGljeTogbmV3IGlhbS5Qb2xpY3lEb2N1bWVudCh7XG4gICAgICAgICAgLy8gLS0tIOODkOODg+OCr+OCqOODs+ODieOCouODl+ODqueUqCAtLS1cbiAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiZWNyOkdldEF1dGhvcml6YXRpb25Ub2tlblwiLFxuICAgICAgICAgICAgICAgIFwiZWNzOkxpc3RTZXJ2aWNlc1wiLFxuICAgICAgICAgICAgICAgIFwic3RzOkdldENhbGxlcklkZW50aXR5XCIsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcImNsb3VkZm9ybWF0aW9uOkRlc2NyaWJlU3RhY2tzXCJdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICBgYXJuOiR7dGhpcy5wYXJ0aXRpb259OmNsb3VkZm9ybWF0aW9uOiR7dGhpcy5yZWdpb259OiR7dGhpcy5hY2NvdW50fTpzdGFjay8ke3RoaXMuc3RhY2tOYW1lfS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcImVjcjpCYXRjaENoZWNrTGF5ZXJBdmFpbGFiaWxpdHlcIixcbiAgICAgICAgICAgICAgICBcImVjcjpCYXRjaEdldEltYWdlXCIsXG4gICAgICAgICAgICAgICAgXCJlY3I6Q29tcGxldGVMYXllclVwbG9hZFwiLFxuICAgICAgICAgICAgICAgIFwiZWNyOkluaXRpYXRlTGF5ZXJVcGxvYWRcIixcbiAgICAgICAgICAgICAgICBcImVjcjpQdXRJbWFnZVwiLFxuICAgICAgICAgICAgICAgIFwiZWNyOlVwbG9hZExheWVyUGFydFwiLFxuICAgICAgICAgICAgICBdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtiYWNrZW5kRWNyUmVwb3NpdG9yeS5yZXBvc2l0b3J5QXJuXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcImVjczpEZXNjcmliZUNsdXN0ZXJzXCJdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtlY3NDbHVzdGVyLmNsdXN0ZXJBcm5dLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1wiZWNzOlVwZGF0ZVNlcnZpY2VcIiwgXCJlY3M6RGVzY3JpYmVTZXJ2aWNlc1wiXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbYmFja2VuZEVjc1NlcnZpY2Uuc2VydmljZUFybl0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIC8vIC0tLSDjg5Xjg63jg7Pjg4jjgqjjg7Pjg4njgqLjg5fjg6rnlKggLS0tXG4gICAgICAgICAgICAvLyBTM+ODkOOCseODg+ODiOOBuOOBruOCouOCr+OCu+OCueaoqemZkFxuICAgICAgICAgICAgbmV3IGlhbS5Qb2xpY3lTdGF0ZW1lbnQoe1xuICAgICAgICAgICAgICBlZmZlY3Q6IGlhbS5FZmZlY3QuQUxMT1csXG4gICAgICAgICAgICAgIGFjdGlvbnM6IFtcbiAgICAgICAgICAgICAgICBcInMzOlB1dE9iamVjdFwiLFxuICAgICAgICAgICAgICAgIFwiczM6R2V0T2JqZWN0XCIsXG4gICAgICAgICAgICAgICAgXCJzMzpMaXN0QnVja2V0XCIsXG4gICAgICAgICAgICAgICAgXCJzMzpEZWxldGVPYmplY3RcIixcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgZnJvbnRlbmRCdWNrZXQuYnVja2V0QXJuLFxuICAgICAgICAgICAgICAgIGAke2Zyb250ZW5kQnVja2V0LmJ1Y2tldEFybn0vKmAsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIC8vIE11bHRpLXRlbmFudOOCv+OCpOODl+OBrkNsb3VkRnJvbnTjga7jgq3jg6Pjg4Pjgrfjg6XliYrpmaTmqKnpmZBcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXG4gICAgICAgICAgICAgICAgLy8g44OG44OK44Oz44OI5LiA6Kan5Y+W5b6XXG4gICAgICAgICAgICAgICAgXCJjbG91ZGZyb250Okxpc3REaXN0cmlidXRpb25UZW5hbnRzXCIsXG4gICAgICAgICAgICAgICAgLy8g44OG44OK44Oz44OI5Y2Y5L2N44Gn44Gu44Kt44Oj44OD44K344Ol54Sh5Yq55YyWXG4gICAgICAgICAgICAgICAgXCJjbG91ZGZyb250OkNyZWF0ZUludmFsaWRhdGlvbkZvckRpc3RyaWJ1dGlvblRlbmFudFwiLFxuICAgICAgICAgICAgICAgIC8vIOOCreODo+ODg+OCt+ODpeeEoeWKueWMluOBrueKtuaFi+eiuuiqje+8iHdhaXTjgrPjg57jg7Pjg4njgaflv4XopoHvvIlcbiAgICAgICAgICAgICAgICBcImNsb3VkZnJvbnQ6R2V0SW52YWxpZGF0aW9uRm9yRGlzdHJpYnV0aW9uVGVuYW50XCIsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXVxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAvLyBFQ1Pjgr/jgrnjgq/plqLpgKPjga7mqKnpmZDjgpLov73liqBcbiAgICAgICAgICAgIG5ldyBpYW0uUG9saWN5U3RhdGVtZW50KHtcbiAgICAgICAgICAgICAgZWZmZWN0OiBpYW0uRWZmZWN0LkFMTE9XLFxuICAgICAgICAgICAgICBhY3Rpb25zOiBbXCJlY3M6UnVuVGFza1wiLCBcImVjczpEZXNjcmliZVRhc2tzXCIsIFwiZWNzOkxpc3RUYXNrc1wiXSxcbiAgICAgICAgICAgICAgcmVzb3VyY2VzOiBbXG4gICAgICAgICAgICAgICAgLy8g44K/44K544Kv5a6a576p44Gr5a++44GZ44KL5qip6ZmQXG4gICAgICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTplY3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhc2stZGVmaW5pdGlvbi8ke3RoaXMuc3RhY2tOYW1lfS1iYWNrZW5kKmAsXG4gICAgICAgICAgICAgICAgLy8g44K/44K544Kv44Gr5a++44GZ44KL5qip6ZmQXG4gICAgICAgICAgICAgICAgYGFybjoke3RoaXMucGFydGl0aW9ufTplY3M6JHt0aGlzLnJlZ2lvbn06JHt0aGlzLmFjY291bnR9OnRhc2svJHtlY3NDbHVzdGVyLmNsdXN0ZXJOYW1lfS8qYCxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgLy8g44K/44K544Kv5a6a576p6Zai6YCj44Gu5qip6ZmQXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1xuICAgICAgICAgICAgICAgIFwiZWNzOkRlc2NyaWJlVGFza0RlZmluaXRpb25cIixcbiAgICAgICAgICAgICAgICBcImVjczpSZWdpc3RlclRhc2tEZWZpbml0aW9uXCIsXG4gICAgICAgICAgICAgICAgXCJlY3M6RGVyZWdpc3RlclRhc2tEZWZpbml0aW9uXCIsXG4gICAgICAgICAgICAgIF0sXG4gICAgICAgICAgICAgIHJlc291cmNlczogW1wiKlwiXSwgLy8g44GT44KM44KJ44Gu44Ki44Kv44K344On44Oz44Gv44Oq44K944O844K544Os44OZ44Or44Gu5Yi26ZmQ44KS44K144Od44O844OI44GX44Gm44GE44Gq44GEXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICAgIC8vIOOCv+OCueOCr+Wun+ihjOOBq+W/heimgeOBqklBTeODreODvOODq+OBrlBhc3NSb2xl5qip6ZmQXG4gICAgICAgICAgICBuZXcgaWFtLlBvbGljeVN0YXRlbWVudCh7XG4gICAgICAgICAgICAgIGVmZmVjdDogaWFtLkVmZmVjdC5BTExPVyxcbiAgICAgICAgICAgICAgYWN0aW9uczogW1wiaWFtOlBhc3NSb2xlXCJdLFxuICAgICAgICAgICAgICByZXNvdXJjZXM6IFtcbiAgICAgICAgICAgICAgICB0YXNrUm9sZS5yb2xlQXJuLCAvLyDml6LlrZjjga7jgr/jgrnjgq/jg63jg7zjg6tcbiAgICAgICAgICAgICAgICB0YXNrRXhlY3V0aW9uUm9sZS5yb2xlQXJuLCAvLyDml6LlrZjjga7jgr/jgrnjgq/lrp/ooYzjg63jg7zjg6tcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgIH0pLFxuICAgICAgICAgIF0sXG4gICAgICAgIH0pLFxuICAgICAgfSxcbiAgICB9KTtcblxuICAgIC8vIEdpdEh1YiBBY3Rpb25z55So44GuT3V0cHV0c++8iOODkOODg+OCr+OCqOODs+ODieOCouODl+ODqueUqO+8iVxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJFY3JSZXBvc2l0b3J5VXJpXCIsIHtcbiAgICAgIHZhbHVlOiBgJHt0aGlzLmFjY291bnR9LmRrci5lY3IuJHt0aGlzLnJlZ2lvbn0uYW1hem9uYXdzLmNvbS8ke2JhY2tlbmRFY3JSZXBvc2l0b3J5LnJlcG9zaXRvcnlOYW1lfWAsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkVjc0NsdXN0ZXJBcm5cIiwge1xuICAgICAgdmFsdWU6IGVjc0NsdXN0ZXIuY2x1c3RlckFybixcbiAgICAgIGV4cG9ydE5hbWU6IFwiRWNzQ2x1c3RlckFyblwiLFxuICAgIH0pO1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJCYWNrZW5kRWNzU2VydmljZU5hbWVcIiwge1xuICAgICAgdmFsdWU6IGVjc1NlcnZpY2VOYW1lLFxuICAgIH0pO1xuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJCYWNrZW5kVGFza0RlZmluaXRpb25GYW1pbHlcIiwge1xuICAgICAgdmFsdWU6IGJhY2tlbmRFY3NUYXNrLmZhbWlseSxcbiAgICB9KTtcbiAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiQmFja2VuZEVjc1NlcnZpY2VTZWN1cml0eUdyb3VwSWRcIiwge1xuICAgICAgdmFsdWU6IGJhY2tlbmRFY3NTZXJ2aWNlU2VjdXJpdHlHcm91cC5zZWN1cml0eUdyb3VwSWQsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIlByaXZhdGVTdWJuZXQxSWRcIiwge1xuICAgICAgdmFsdWU6IHZwYy5wcml2YXRlU3VibmV0c1swXS5zdWJuZXRJZCxcbiAgICB9KTtcblxuICAgIC8vIEdpdEh1YiBBY3Rpb25z55So44GuT3V0cHV0c++8iOODleODreODs+ODiOOCqOODs+ODieOCouODl+ODqueUqO+8iVxuICAgIG5ldyBDZm5PdXRwdXQodGhpcywgXCJGcm9udGVuZEJ1Y2tldE5hbWVcIiwge1xuICAgICAgdmFsdWU6IGZyb250ZW5kQnVja2V0LmJ1Y2tldE5hbWUsXG4gICAgfSk7XG4gICAgbmV3IENmbk91dHB1dCh0aGlzLCBcIkZyb250ZW5kQ2xvdWRGcm9udERpc3RyaWJ1dGlvbklkXCIsIHtcbiAgICAgIHZhbHVlOiBjbG91ZEZyb250RGlzdHJpYnV0aW9uLmRpc3RyaWJ1dGlvbklkLFxuICAgIH0pO1xuICAgIC8vIOmAmuW4uOODhuODiuODs+ODiOOBruODh+OCo+OCueODiOODquODk+ODpeODvOOCt+ODp+ODs+ODhuODiuODs+ODiElE44KS44Ko44Kv44K544Od44O844OIXG4gICAgZm9yIChjb25zdCB0ZW5hbnQgb2Ygbm9ybWFsVGVuYW50cykge1xuICAgICAgY29uc3QgdGVuYW50SWQgPSB0ZW5hbnQuYXBwRG9tYWluTmFtZS5yZXBsYWNlKC9cXC4vZywgXCItXCIpO1xuICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCBgRnJvbnRlbmREaXN0cmlidXRpb25UZW5hbnRJZC0ke3RlbmFudElkfWAsIHtcbiAgICAgICAgdmFsdWU6IGBEaXN0cmlidXRpb25UZW5hbnQtJHt0ZW5hbnRJZH1gLFxuICAgICAgICBkZXNjcmlwdGlvbjogYEZyb250ZW5kIERpc3RyaWJ1dGlvbiBUZW5hbnQgSUQgZm9yICR7dGVuYW50LmFwcERvbWFpbk5hbWV9YCxcbiAgICAgIH0pO1xuICAgIH1cbiAgICBcbiAgICAvLyDjg4fjg6Ljg4bjg4rjg7Pjg4jnlKjjga7lhbHpgJrjg4fjgqPjgrnjg4jjg6rjg5Pjg6Xjg7zjgrfjg6fjg7Pjg4bjg4rjg7Pjg4hJROOCkuOCqOOCr+OCueODneODvOODiFxuICAgIGlmIChkZW1vVGVuYW50cy5sZW5ndGggPiAwKSB7XG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiRnJvbnRlbmREaXN0cmlidXRpb25UZW5hbnRJZERlbW9cIiwge1xuICAgICAgICB2YWx1ZTogXCJEaXN0cmlidXRpb25UZW5hbnQtRGVtb1wiLFxuICAgICAgICBkZXNjcmlwdGlvbjogXCJGcm9udGVuZCBEaXN0cmlidXRpb24gVGVuYW50IElEIGZvciBkZW1vIHRlbmFudHNcIixcbiAgICAgIH0pO1xuICAgIH1cbiAgfVxufVxuIl19