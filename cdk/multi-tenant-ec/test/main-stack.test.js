"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws_cdk_lib_1 = require("aws-cdk-lib");
const assertions_1 = require("aws-cdk-lib/assertions");
const global_stack_1 = require("../lib/global-stack");
const main_stack_1 = require("../lib/main-stack");
const dev_1 = require("../params/dev");
// アプリケーションとスタックの生成
const app = new aws_cdk_lib_1.App();
const globalStack = new global_stack_1.GlobalStack(app, "TestGlobalStack", dev_1.params.globalStackProps);
const mainStack = new main_stack_1.MainStack(app, "TestMainStack", {
    ...dev_1.params.mainStackProps,
    cloudfrontCertificate: globalStack.cloudfrontCertificate,
    cloudFrontWebAcl: globalStack.cloudFrontWebAcl,
});
const template = assertions_1.Template.fromStack(mainStack);
describe("MainStack", () => {
    test("各リソースの個数が正しいこと", () => {
        // VPCとネットワーク
        template.resourceCountIs("AWS::EC2::VPC", 1);
        template.resourceCountIs("AWS::EC2::Subnet", 4); // 2つのAZにPublicとPrivateのサブネット
        // フロントエンド用リソース
        template.resourceCountIs("AWS::CloudFront::Distribution", 1);
        // バックエンド用リソース
        template.resourceCountIs("AWS::ElasticLoadBalancingV2::LoadBalancer", 1);
        template.resourceCountIs("AWS::CertificateManager::Certificate", 1);
        template.resourceCountIs("AWS::ECS::Cluster", 1);
        template.resourceCountIs("AWS::ECS::Service", 1);
        template.resourceCountIs("AWS::ECS::TaskDefinition", 1);
        template.resourceCountIs("AWS::ECR::Repository", 1);
        // データベース関連
        template.resourceCountIs("AWS::RDS::DBCluster", 1);
    });
    // 条件分岐テスト: Aurora削除保護設定
    test("Auroraの削除保護設定がpropsを反映している", () => {
        template.hasResourceProperties("AWS::RDS::DBCluster", {
            DeletionProtection: dev_1.params.mainStackProps.auroraDeletionProtection,
        });
    });
    // 条件分岐テスト: ALB削除保護設定
    test("ALBの削除保護設定がpropsを反映している", () => {
        template.hasResourceProperties("AWS::ElasticLoadBalancingV2::LoadBalancer", {
            LoadBalancerAttributes: assertions_1.Match.arrayWith([
                assertions_1.Match.objectLike({
                    Key: "deletion_protection.enabled",
                    Value: String(dev_1.params.mainStackProps.albDeletionProtection),
                }),
            ]),
        });
    });
    test("ECSタスク定義に必要なコンテナが含まれている", () => {
        template.hasResourceProperties("AWS::ECS::TaskDefinition", {
            ContainerDefinitions: assertions_1.Match.arrayWith([
                assertions_1.Match.objectLike({
                    Name: "web",
                    Essential: true,
                }),
                assertions_1.Match.objectLike({
                    Name: "app",
                    Essential: true,
                }),
                assertions_1.Match.objectLike({
                    Name: "log-router",
                }),
            ]),
        });
    });
    test("ECSタスク定義に環境変数とシークレットが適切に設定されていること", () => {
        // appコンテナの環境変数とシークレットを確認
        template.hasResourceProperties("AWS::ECS::TaskDefinition", {
            ContainerDefinitions: assertions_1.Match.arrayWith([
                assertions_1.Match.objectLike({
                    Name: "app",
                    Environment: [
                        {
                            Name: "TZ",
                            Value: "Asia/Tokyo",
                        },
                        {
                            Name: "APP_ENV",
                            Value: dev_1.params.mainStackProps.envName,
                        },
                        {
                            Name: "APP_DEBUG",
                            Value: String(dev_1.params.mainStackProps.appDebug),
                        },
                        {
                            Name: "AWS_BUCKET",
                            Value: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "AWS_URL",
                            Value: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "MAIL_MAILER",
                            Value: "ses",
                        },
                    ],
                    Secrets: [
                        {
                            Name: "DB_HOST",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "DB_PORT",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "DB_USERNAME",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "DB_DATABASE",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "DB_PASSWORD",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "APP_KEY",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                    ],
                }),
            ]),
        });
        // log-routerコンテナの環境変数とシークレットを確認
        template.hasResourceProperties("AWS::ECS::TaskDefinition", {
            ContainerDefinitions: assertions_1.Match.arrayWith([
                assertions_1.Match.objectLike({
                    Name: "log-router",
                    Environment: [
                        {
                            Name: "KINESIS_APP_DELIVERY_STREAM",
                            Value: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "KINESIS_WEB_DELIVERY_STREAM",
                            Value: assertions_1.Match.anyValue(),
                        },
                        {
                            Name: "AWS_REGION",
                            Value: assertions_1.Match.anyValue(),
                        },
                    ],
                    Secrets: [
                        {
                            Name: "APP_LOG_SLACK_WEBHOOK_URL",
                            ValueFrom: assertions_1.Match.anyValue(),
                        },
                    ],
                }),
            ]),
        });
    });
    test("全てのS3バケットは安全に構成されている", () => {
        template.allResourcesProperties("AWS::S3::Bucket", {
            PublicAccessBlockConfiguration: {
                BlockPublicAcls: true,
                BlockPublicPolicy: true,
                IgnorePublicAcls: true,
                RestrictPublicBuckets: true,
            },
            BucketEncryption: assertions_1.Match.objectLike({
                ServerSideEncryptionConfiguration: assertions_1.Match.arrayWith([
                    assertions_1.Match.objectLike({
                        ServerSideEncryptionByDefault: assertions_1.Match.objectLike({
                            SSEAlgorithm: "AES256",
                        }),
                    }),
                ]),
            }),
        });
    });
    test("フロントエンドがS3+CloudFrontのアーキテクチャになっている", () => {
        template.hasResourceProperties("AWS::CloudFront::Distribution", {
            DistributionConfig: assertions_1.Match.objectLike({
                Origins: assertions_1.Match.arrayWith([
                    assertions_1.Match.objectLike({
                        S3OriginConfig: assertions_1.Match.anyValue(),
                    }),
                ]),
            }),
        });
    });
    test("ECSサービスがFARGATEを使用している", () => {
        template.hasResourceProperties("AWS::ECS::Service", {
            CapacityProviderStrategy: [
                {
                    CapacityProvider: "FARGATE",
                    Weight: 1,
                },
            ],
        });
    });
    test("各テナントのドメイン名がCloudFrontに正しく伝播されている", () => {
        // CloudFrontリソースのLogicalID取得
        const cfResources = template.findResources("AWS::CloudFront::Distribution");
        const cloudFrontId = Object.keys(cfResources)[0];
        // 各テナントのドメイン名を取得
        const tenantDomains = dev_1.params.mainStackProps.tenants.map((tenant) => tenant.appDomainName);
        // CloudFrontのドメイン設定 - 全テナントが含まれているか確認
        template.hasResourceProperties("AWS::CloudFront::Distribution", {
            DistributionConfig: assertions_1.Match.objectLike({
                Aliases: assertions_1.Match.arrayWith(tenantDomains),
            }),
        });
        // Route53レコード設定の確認
        for (const tenant of dev_1.params.mainStackProps.tenants) {
            template.hasResourceProperties("AWS::Route53::RecordSet", {
                Name: `${tenant.appDomainName}.`,
                Type: "A",
                HostedZoneId: tenant.route53HostedZoneId,
                // CloudFrontドメインの参照確認
                AliasTarget: assertions_1.Match.objectLike({
                    DNSName: {
                        "Fn::GetAtt": [cloudFrontId, "DomainName"],
                    },
                }),
            });
        }
    });
    test("各テナントのドメイン名がALBに正しく伝播されている", () => {
        // ALBが1つだけ存在することを確認
        template.resourceCountIs("AWS::ElasticLoadBalancingV2::LoadBalancer", 1);
        // ALBリソースのLogicalID取得
        const albResources = template.findResources("AWS::ElasticLoadBalancingV2::LoadBalancer");
        const albId = Object.keys(albResources)[0];
        // 各テナントのAPIドメインに対するRoute53レコードを確認
        for (const tenant of dev_1.params.mainStackProps.tenants) {
            const apiDomainName = `api.${tenant.appDomainName}`;
            // ALBドメインとRoute53レコードの設定確認
            template.hasResourceProperties("AWS::Route53::RecordSet", {
                Name: `${apiDomainName}.`,
                Type: "A",
                HostedZoneId: tenant.route53HostedZoneId,
                // ALBのドメイン参照パターン確認
                AliasTarget: assertions_1.Match.objectLike({
                    // dualstack形式のDNS名参照を確認
                    DNSName: assertions_1.Match.objectLike({
                        "Fn::Join": assertions_1.Match.arrayEquals([
                            "",
                            assertions_1.Match.arrayWith([
                                "dualstack.",
                                {
                                    "Fn::GetAtt": [albId, "DNSName"],
                                },
                            ]),
                        ]),
                    }),
                }),
            });
        }
    });
    test("ALB用のACM証明書が正しく設定されている", () => {
        // ACM証明書のリソース取得とLogicalID取得
        const acmResources = template.findResources("AWS::CertificateManager::Certificate");
        const acmCertId = Object.keys(acmResources)[0];
        // 各テナントのAPIドメインを取得
        const apiDomains = dev_1.params.mainStackProps.tenants.map((tenant) => `api.${tenant.appDomainName}`);
        // ACM証明書の設定を確認
        template.hasResourceProperties("AWS::CertificateManager::Certificate", {
            DomainName: apiDomains[0], // プライマリドメイン
            SubjectAlternativeNames: apiDomains.slice(1), // 代替ドメイン
            ValidationMethod: "DNS",
        });
        // ALBリスナーに証明書が設定されていることを確認
        template.hasResourceProperties("AWS::ElasticLoadBalancingV2::Listener", {
            Protocol: "HTTPS",
            Port: 443,
            Certificates: assertions_1.Match.arrayWith([
                assertions_1.Match.objectLike({
                    CertificateArn: {
                        Ref: acmCertId,
                    },
                }),
            ]),
        });
    });
    test("各テナントのメール設定が正しく構成されている", () => {
        for (const tenant of dev_1.params.mainStackProps.tenants) {
            // SESのドメイン検証設定
            template.hasResourceProperties("AWS::SES::EmailIdentity", {
                EmailIdentity: tenant.appDomainName,
                MailFromAttributes: {
                    MailFromDomain: `bounce.${tenant.appDomainName}`,
                },
            });
            // DMARCレコードの設定
            template.hasResourceProperties("AWS::Route53::RecordSet", {
                Name: `_dmarc.${tenant.appDomainName}.`,
                Type: "TXT",
                TTL: "3600",
                ResourceRecords: [
                    `"v=DMARC1; p=none; rua=mailto:${dev_1.params.mainStackProps.dmarcReportEmail}"`,
                ],
            });
        }
    });
    test("ALBにWAFが関連付けられている", () => {
        template.resourceCountIs("AWS::WAFv2::WebACLAssociation", 1);
    });
    test("Auroraのプロパティが正しく設定されている", () => {
        template.hasResourceProperties("AWS::RDS::DBCluster", {
            // エンジンバージョン
            Engine: "aurora-postgresql",
            EngineVersion: dev_1.params.mainStackProps.postgresVersion.auroraPostgresFullVersion,
            // ServerlessV2の設定
            ServerlessV2ScalingConfiguration: {
                MinCapacity: dev_1.params.mainStackProps.auroraServerlessV2MinCapacity,
                MaxCapacity: dev_1.params.mainStackProps.auroraServerlessV2MaxCapacity,
            },
            // バックアップ設定
            BackupRetentionPeriod: 7,
            PreferredBackupWindow: "16:00-17:00",
            // メンテナンスウィンドウ
            PreferredMaintenanceWindow: "Sun:13:00-Sun:13:30",
            // セキュリティ設定
            StorageEncrypted: true,
            EnableIAMDatabaseAuthentication: true,
            // Data APIの設定
            EnableHttpEndpoint: true,
        });
    });
    test("ECRリポジトリのライフサイクルルールが定義されている", () => {
        template.hasResourceProperties("AWS::ECR::Repository", {
            LifecyclePolicy: assertions_1.Match.objectLike({
                LifecyclePolicyText: assertions_1.Match.anyValue(),
            }),
        });
    });
});
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoibWFpbi1zdGFjay50ZXN0LmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsibWFpbi1zdGFjay50ZXN0LnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7O0FBQUEsNkNBQWtDO0FBQ2xDLHVEQUF5RDtBQUN6RCxzREFBa0Q7QUFDbEQsa0RBQThDO0FBQzlDLHVDQUF1QztBQUV2QyxtQkFBbUI7QUFDbkIsTUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBRyxFQUFFLENBQUM7QUFDdEIsTUFBTSxXQUFXLEdBQUcsSUFBSSwwQkFBVyxDQUNqQyxHQUFHLEVBQ0gsaUJBQWlCLEVBQ2pCLFlBQU0sQ0FBQyxnQkFBZ0IsQ0FDeEIsQ0FBQztBQUNGLE1BQU0sU0FBUyxHQUFHLElBQUksc0JBQVMsQ0FBQyxHQUFHLEVBQUUsZUFBZSxFQUFFO0lBQ3BELEdBQUcsWUFBTSxDQUFDLGNBQWM7SUFDeEIscUJBQXFCLEVBQUUsV0FBVyxDQUFDLHFCQUFxQjtJQUN4RCxnQkFBZ0IsRUFBRSxXQUFXLENBQUMsZ0JBQWdCO0NBQy9DLENBQUMsQ0FBQztBQUNILE1BQU0sUUFBUSxHQUFHLHFCQUFRLENBQUMsU0FBUyxDQUFDLFNBQVMsQ0FBQyxDQUFDO0FBRS9DLFFBQVEsQ0FBQyxXQUFXLEVBQUUsR0FBRyxFQUFFO0lBQ3pCLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7UUFDMUIsYUFBYTtRQUNiLFFBQVEsQ0FBQyxlQUFlLENBQUMsZUFBZSxFQUFFLENBQUMsQ0FBQyxDQUFDO1FBQzdDLFFBQVEsQ0FBQyxlQUFlLENBQUMsa0JBQWtCLEVBQUUsQ0FBQyxDQUFDLENBQUMsQ0FBQyw2QkFBNkI7UUFFOUUsZUFBZTtRQUNmLFFBQVEsQ0FBQyxlQUFlLENBQUMsK0JBQStCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFN0QsY0FBYztRQUNkLFFBQVEsQ0FBQyxlQUFlLENBQUMsMkNBQTJDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFDekUsUUFBUSxDQUFDLGVBQWUsQ0FBQyxz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QUVqRCxXQUFXO1lBQ1gsZ0JBQWdCLEVBQUUsSUFBSTtZQUN0QiwrQkFBK0IsRUFBRSxJQUFJO1lBRXJDLGNBQWM7WUFDZCxrQkFBa0IsRUFBRSxJQUFJO1NBQ3pCLENBQUMsQ0FBQztJQUNMLENBQUMsQ0FBQyxDQUFDO0lBRUgsSUFBSSxDQUFDLDZCQUE2QixFQUFFLEdBQUcsRUFBRTtRQUN2QyxRQUFRLENBQUMscUJBQXFCLENBQUMsc0JBQXNCLEVBQUU7WUFDckQsZUFBZSxFQUFFLGtCQUFLLENBQUMsVUFBVSxDQUFDO2dCQUNoQyxtQkFBbUIsRUFBRSxrQkFBSyxDQUFDLFFBQVEsRUFBRTthQUN0QyxDQUFDO1NBQ0gsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcCB9IGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgTWF0Y2gsIFRlbXBsYXRlIH0gZnJvbSBcImF3cy1jZGstbGliL2Fzc2VydGlvbnNcIjtcbmltcG9ydCB7IEdsb2JhbFN0YWNrIH0gZnJvbSBcIi4uL2xpYi9nbG9iYWwtc3RhY2tcIjtcbmltcG9ydCB7IE1haW5TdGFjayB9IGZyb20gXCIuLi9saWIvbWFpbi1zdGFja1wiO1xuaW1wb3J0IHsgcGFyYW1zIH0gZnJvbSBcIi4uL3BhcmFtcy9kZXZcIjtcblxuLy8g44Ki44OX44Oq44Kx44O844K344On44Oz44Go44K544K/44OD44Kv44Gu55Sf5oiQXG5jb25zdCBhcHAgPSBuZXcgQXBwKCk7XG5jb25zdCBnbG9iYWxTdGFjayA9IG5ldyBHbG9iYWxTdGFjayhcbiAgYXBwLFxuICBcIlRlc3RHbG9iYWxTdGFja1wiLFxuICBwYXJhbXMuZ2xvYmFsU3RhY2tQcm9wcyxcbik7XG5jb25zdCBtYWluU3RhY2sgPSBuZXcgTWFpblN0YWNrKGFwcCwgXCJUZXN0TWFpblN0YWNrXCIsIHtcbiAgLi4ucGFyYW1zLm1haW5TdGFja1Byb3BzLFxuICBjbG91ZGZyb250Q2VydGlmaWNhdGU6IGdsb2JhbFN0YWNrLmNsb3VkZnJvbnRDZXJ0aWZpY2F0ZSxcbiAgY2xvdWRGcm9udFdlYkFjbDogZ2xvYmFsU3RhY2suY2xvdWRGcm9udFdlYkFjbCxcbn0pO1xuY29uc3QgdGVtcGxhdGUgPSBUZW1wbGF0ZS5mcm9tU3RhY2sobWFpblN0YWNrKTtcblxuZGVzY3JpYmUoXCJNYWluU3RhY2tcIiwgKCkgPT4ge1xuICB0ZXN0KFwi5ZCE44Oq44K944O844K544Gu5YCL5pWw44GM5q2j44GX44GE44GT44GoXCIsICgpID0+IHtcbiAgICAvLyBWUEPjgajjg43jg4Pjg4jjg6/jg7zjgq9cbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoXCJBV1M6OkVDMjo6VlBDXCIsIDEpO1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6RUMyOjpTdWJuZXRcIiwgNCk7IC8vIDLjgaTjga5BWuOBq1B1YmxpY+OBqFByaXZhdGXjga7jgrXjg5bjg43jg4Pjg4hcblxuICAgIC8vIOODleODreODs+ODiOOCqOODs+ODieeUqOODquOCveODvOOCuVxuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6Q2xvdWRGcm9udDo6RGlzdHJpYnV0aW9uXCIsIDEpO1xuXG4gICAgLy8g44OQ44OD44Kv44Ko44Oz44OJ55So44Oq44K944O844K5XG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKFwiQVdTOjpFbGFzdGljTG9hZEJhbGFuY2luZ1YyOjpMb2FkQmFsYW5jZXJcIiwgMSk7XG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKFwiQVdTOjpDZXJ0aWZpY2F0ZU1hbmFnZXI6OkNlcnRpZmljYXRlXCIsIDEpO1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6RUNTOjpDbHVzdGVyXCIsIDEpO1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6RUNTOjpTZXJ2aWNlXCIsIDEpO1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6RUNTOjpUYXNrRGVmaW5pdGlvblwiLCAxKTtcbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoXCJBV1M6OkVDUjo6UmVwb3NpdG9yeVwiLCAxKTtcblxuICAgIC8vIOODh+ODvOOCv+ODmeODvOOCuemWoumAo1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6UkRTOjpEQkNsdXN0ZXJcIiwgMSk7XG4gIH0pO1xuXG4gIC8vIOadoeS7tuWIhuWykOODhuOCueODiDogQXVyb3Jh5YmK6Zmk5L+d6K236Kit5a6aXG4gIHRlc3QoXCJBdXJvcmHjga7liYrpmaTkv53orbfoqK3lrprjgYxwcm9wc+OCkuWPjeaYoOOBl+OBpuOBhOOCi1wiLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpSRFM6OkRCQ2x1c3RlclwiLCB7XG4gICAgICBEZWxldGlvblByb3RlY3Rpb246IHBhcmFtcy5tYWluU3RhY2tQcm9wcy5hdXJvcmFEZWxldGlvblByb3RlY3Rpb24sXG4gICAgfSk7XG4gIH0pO1xuXG4gIC8vIOadoeS7tuWIhuWykOODhuOCueODiDogQUxC5YmK6Zmk5L+d6K236Kit5a6aXG4gIHRlc3QoXCJBTELjga7liYrpmaTkv53orbfoqK3lrprjgYxwcm9wc+OCkuWPjeaYoOOBl+OBpuOBhOOCi1wiLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFxuICAgICAgXCJBV1M6OkVsYXN0aWNMb2FkQmFsYW5jaW5nVjI6OkxvYWRCYWxhbmNlclwiLFxuICAgICAge1xuICAgICAgICBMb2FkQmFsYW5jZXJBdHRyaWJ1dGVzOiBNYXRjaC5hcnJheVdpdGgoW1xuICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgICAgS2V5OiBcImRlbGV0aW9uX3Byb3RlY3Rpb24uZW5hYmxlZFwiLFxuICAgICAgICAgICAgVmFsdWU6IFN0cmluZyhwYXJhbXMubWFpblN0YWNrUHJvcHMuYWxiRGVsZXRpb25Qcm90ZWN0aW9uKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSksXG4gICAgICB9LFxuICAgICk7XG4gIH0pO1xuXG4gIHRlc3QoXCJFQ1Pjgr/jgrnjgq/lrprnvqnjgavlv4XopoHjgarjgrPjg7Pjg4bjg4rjgYzlkKvjgb7jgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6RUNTOjpUYXNrRGVmaW5pdGlvblwiLCB7XG4gICAgICBDb250YWluZXJEZWZpbml0aW9uczogTWF0Y2guYXJyYXlXaXRoKFtcbiAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgICAgTmFtZTogXCJ3ZWJcIixcbiAgICAgICAgICBFc3NlbnRpYWw6IHRydWUsXG4gICAgICAgIH0pLFxuICAgICAgICBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICBOYW1lOiBcImFwcFwiLFxuICAgICAgICAgIEVzc2VudGlhbDogdHJ1ZSxcbiAgICAgICAgfSksXG4gICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgIE5hbWU6IFwibG9nLXJvdXRlclwiLFxuICAgICAgICB9KSxcbiAgICAgIF0pLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KFwiRUNT44K/44K544Kv5a6a576p44Gr55Kw5aKD5aSJ5pWw44Go44K344O844Kv44Os44OD44OI44GM6YGp5YiH44Gr6Kit5a6a44GV44KM44Gm44GE44KL44GT44GoXCIsICgpID0+IHtcbiAgICAvLyBhcHDjgrPjg7Pjg4bjg4rjga7nkrDlooPlpInmlbDjgajjgrfjg7zjgq/jg6zjg4Pjg4jjgpLnorroqo1cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoXCJBV1M6OkVDUzo6VGFza0RlZmluaXRpb25cIiwge1xuICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IE1hdGNoLmFycmF5V2l0aChbXG4gICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgIE5hbWU6IFwiYXBwXCIsXG4gICAgICAgICAgRW52aXJvbm1lbnQ6IFtcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJUWlwiLFxuICAgICAgICAgICAgICBWYWx1ZTogXCJBc2lhL1Rva3lvXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBOYW1lOiBcIkFQUF9FTlZcIixcbiAgICAgICAgICAgICAgVmFsdWU6IHBhcmFtcy5tYWluU3RhY2tQcm9wcy5lbnZOYW1lLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJBUFBfREVCVUdcIixcbiAgICAgICAgICAgICAgVmFsdWU6IFN0cmluZyhwYXJhbXMubWFpblN0YWNrUHJvcHMuYXBwRGVidWcpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJBV1NfQlVDS0VUXCIsXG4gICAgICAgICAgICAgIFZhbHVlOiBNYXRjaC5hbnlWYWx1ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJBV1NfVVJMXCIsXG4gICAgICAgICAgICAgIFZhbHVlOiBNYXRjaC5hbnlWYWx1ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJNQUlMX01BSUxFUlwiLFxuICAgICAgICAgICAgICBWYWx1ZTogXCJzZXNcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgICBTZWNyZXRzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIE5hbWU6IFwiREJfSE9TVFwiLFxuICAgICAgICAgICAgICBWYWx1ZUZyb206IE1hdGNoLmFueVZhbHVlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBOYW1lOiBcIkRCX1BPUlRcIixcbiAgICAgICAgICAgICAgVmFsdWVGcm9tOiBNYXRjaC5hbnlWYWx1ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJEQl9VU0VSTkFNRVwiLFxuICAgICAgICAgICAgICBWYWx1ZUZyb206IE1hdGNoLmFueVZhbHVlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBOYW1lOiBcIkRCX0RBVEFCQVNFXCIsXG4gICAgICAgICAgICAgIFZhbHVlRnJvbTogTWF0Y2guYW55VmFsdWUoKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIE5hbWU6IFwiREJfUEFTU1dPUkRcIixcbiAgICAgICAgICAgICAgVmFsdWVGcm9tOiBNYXRjaC5hbnlWYWx1ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJBUFBfS0VZXCIsXG4gICAgICAgICAgICAgIFZhbHVlRnJvbTogTWF0Y2guYW55VmFsdWUoKSxcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgXSxcbiAgICAgICAgfSksXG4gICAgICBdKSxcbiAgICB9KTtcblxuICAgIC8vIGxvZy1yb3V0ZXLjgrPjg7Pjg4bjg4rjga7nkrDlooPlpInmlbDjgajjgrfjg7zjgq/jg6zjg4Pjg4jjgpLnorroqo1cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoXCJBV1M6OkVDUzo6VGFza0RlZmluaXRpb25cIiwge1xuICAgICAgQ29udGFpbmVyRGVmaW5pdGlvbnM6IE1hdGNoLmFycmF5V2l0aChbXG4gICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgIE5hbWU6IFwibG9nLXJvdXRlclwiLFxuICAgICAgICAgIEVudmlyb25tZW50OiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIE5hbWU6IFwiS0lORVNJU19BUFBfREVMSVZFUllfU1RSRUFNXCIsXG4gICAgICAgICAgICAgIFZhbHVlOiBNYXRjaC5hbnlWYWx1ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgTmFtZTogXCJLSU5FU0lTX1dFQl9ERUxJVkVSWV9TVFJFQU1cIixcbiAgICAgICAgICAgICAgVmFsdWU6IE1hdGNoLmFueVZhbHVlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBOYW1lOiBcIkFXU19SRUdJT05cIixcbiAgICAgICAgICAgICAgVmFsdWU6IE1hdGNoLmFueVZhbHVlKCksXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgICAgU2VjcmV0czogW1xuICAgICAgICAgICAge1xuICAgICAgICAgICAgICBOYW1lOiBcIkFQUF9MT0dfU0xBQ0tfV0VCSE9PS19VUkxcIixcbiAgICAgICAgICAgICAgVmFsdWVGcm9tOiBNYXRjaC5hbnlWYWx1ZSgpLFxuICAgICAgICAgICAgfSxcbiAgICAgICAgICBdLFxuICAgICAgICB9KSxcbiAgICAgIF0pLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KFwi5YWo44Gm44GuUzPjg5DjgrHjg4Pjg4jjga/lronlhajjgavmp4vmiJDjgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmFsbFJlc291cmNlc1Byb3BlcnRpZXMoXCJBV1M6OlMzOjpCdWNrZXRcIiwge1xuICAgICAgUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIEJsb2NrUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgQmxvY2tQdWJsaWNQb2xpY3k6IHRydWUsXG4gICAgICAgIElnbm9yZVB1YmxpY0FjbHM6IHRydWUsXG4gICAgICAgIFJlc3RyaWN0UHVibGljQnVja2V0czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBCdWNrZXRFbmNyeXB0aW9uOiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgU2VydmVyU2lkZUVuY3J5cHRpb25Db25maWd1cmF0aW9uOiBNYXRjaC5hcnJheVdpdGgoW1xuICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgICAgU2VydmVyU2lkZUVuY3J5cHRpb25CeURlZmF1bHQ6IE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgICAgICBTU0VBbGdvcml0aG06IFwiQUVTMjU2XCIsXG4gICAgICAgICAgICB9KSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSksXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdChcIuODleODreODs+ODiOOCqOODs+ODieOBjFMzK0Nsb3VkRnJvbnTjga7jgqLjg7zjgq3jg4bjgq/jg4Hjg6PjgavjgarjgaPjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6Q2xvdWRGcm9udDo6RGlzdHJpYnV0aW9uXCIsIHtcbiAgICAgIERpc3RyaWJ1dGlvbkNvbmZpZzogTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgIE9yaWdpbnM6IE1hdGNoLmFycmF5V2l0aChbXG4gICAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgICAgICBTM09yaWdpbkNvbmZpZzogTWF0Y2guYW55VmFsdWUoKSxcbiAgICAgICAgICB9KSxcbiAgICAgICAgXSksXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdChcIkVDU+OCteODvOODk+OCueOBjEZBUkdBVEXjgpLkvb/nlKjjgZfjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6RUNTOjpTZXJ2aWNlXCIsIHtcbiAgICAgIENhcGFjaXR5UHJvdmlkZXJTdHJhdGVneTogW1xuICAgICAgICB7XG4gICAgICAgICAgQ2FwYWNpdHlQcm92aWRlcjogXCJGQVJHQVRFXCIsXG4gICAgICAgICAgV2VpZ2h0OiAxLFxuICAgICAgICB9LFxuICAgICAgXSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdChcIuWQhOODhuODiuODs+ODiOOBruODieODoeOCpOODs+WQjeOBjENsb3VkRnJvbnTjgavmraPjgZfjgY/kvJ3mkq3jgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIC8vIENsb3VkRnJvbnTjg6rjgr3jg7zjgrnjga5Mb2dpY2FsSUTlj5blvpdcbiAgICBjb25zdCBjZlJlc291cmNlcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoXCJBV1M6OkNsb3VkRnJvbnQ6OkRpc3RyaWJ1dGlvblwiKTtcbiAgICBjb25zdCBjbG91ZEZyb250SWQgPSBPYmplY3Qua2V5cyhjZlJlc291cmNlcylbMF07XG5cbiAgICAvLyDlkITjg4bjg4rjg7Pjg4jjga7jg4njg6HjgqTjg7PlkI3jgpLlj5blvpdcbiAgICBjb25zdCB0ZW5hbnREb21haW5zID0gcGFyYW1zLm1haW5TdGFja1Byb3BzLnRlbmFudHMubWFwKFxuICAgICAgKHRlbmFudCkgPT4gdGVuYW50LmFwcERvbWFpbk5hbWUsXG4gICAgKTtcblxuICAgIC8vIENsb3VkRnJvbnTjga7jg4njg6HjgqTjg7PoqK3lrpogLSDlhajjg4bjg4rjg7Pjg4jjgYzlkKvjgb7jgozjgabjgYTjgovjgYvnorroqo1cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoXCJBV1M6OkNsb3VkRnJvbnQ6OkRpc3RyaWJ1dGlvblwiLCB7XG4gICAgICBEaXN0cmlidXRpb25Db25maWc6IE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICBBbGlhc2VzOiBNYXRjaC5hcnJheVdpdGgodGVuYW50RG9tYWlucyksXG4gICAgICB9KSxcbiAgICB9KTtcblxuICAgIC8vIFJvdXRlNTPjg6zjgrPjg7zjg4noqK3lrprjga7norroqo1cbiAgICBmb3IgKGNvbnN0IHRlbmFudCBvZiBwYXJhbXMubWFpblN0YWNrUHJvcHMudGVuYW50cykge1xuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpSb3V0ZTUzOjpSZWNvcmRTZXRcIiwge1xuICAgICAgICBOYW1lOiBgJHt0ZW5hbnQuYXBwRG9tYWluTmFtZX0uYCxcbiAgICAgICAgVHlwZTogXCJBXCIsXG4gICAgICAgIEhvc3RlZFpvbmVJZDogdGVuYW50LnJvdXRlNTNIb3N0ZWRab25lSWQsXG4gICAgICAgIC8vIENsb3VkRnJvbnTjg4njg6HjgqTjg7Pjga7lj4Lnhafnorroqo1cbiAgICAgICAgQWxpYXNUYXJnZXQ6IE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgIEROU05hbWU6IHtcbiAgICAgICAgICAgIFwiRm46OkdldEF0dFwiOiBbY2xvdWRGcm9udElkLCBcIkRvbWFpbk5hbWVcIl0sXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICB9KTtcbiAgICB9XG4gIH0pO1xuXG4gIHRlc3QoXCLlkITjg4bjg4rjg7Pjg4jjga7jg4njg6HjgqTjg7PlkI3jgYxBTELjgavmraPjgZfjgY/kvJ3mkq3jgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIC8vIEFMQuOBjDHjgaTjgaDjgZHlrZjlnKjjgZnjgovjgZPjgajjgpLnorroqo1cbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoXCJBV1M6OkVsYXN0aWNMb2FkQmFsYW5jaW5nVjI6OkxvYWRCYWxhbmNlclwiLCAxKTtcblxuICAgIC8vIEFMQuODquOCveODvOOCueOBrkxvZ2ljYWxJROWPluW+l1xuICAgIGNvbnN0IGFsYlJlc291cmNlcyA9IHRlbXBsYXRlLmZpbmRSZXNvdXJjZXMoXG4gICAgICBcIkFXUzo6RWxhc3RpY0xvYWRCYWxhbmNpbmdWMjo6TG9hZEJhbGFuY2VyXCIsXG4gICAgKTtcbiAgICBjb25zdCBhbGJJZCA9IE9iamVjdC5rZXlzKGFsYlJlc291cmNlcylbMF07XG5cbiAgICAvLyDlkITjg4bjg4rjg7Pjg4jjga5BUEnjg4njg6HjgqTjg7Pjgavlr77jgZnjgotSb3V0ZTUz44Os44Kz44O844OJ44KS56K66KqNXG4gICAgZm9yIChjb25zdCB0ZW5hbnQgb2YgcGFyYW1zLm1haW5TdGFja1Byb3BzLnRlbmFudHMpIHtcbiAgICAgIGNvbnN0IGFwaURvbWFpbk5hbWUgPSBgYXBpLiR7dGVuYW50LmFwcERvbWFpbk5hbWV9YDtcblxuICAgICAgLy8gQUxC44OJ44Oh44Kk44Oz44GoUm91dGU1M+ODrOOCs+ODvOODieOBruioreWumueiuuiqjVxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpSb3V0ZTUzOjpSZWNvcmRTZXRcIiwge1xuICAgICAgICBOYW1lOiBgJHthcGlEb21haW5OYW1lfS5gLFxuICAgICAgICBUeXBlOiBcIkFcIixcbiAgICAgICAgSG9zdGVkWm9uZUlkOiB0ZW5hbnQucm91dGU1M0hvc3RlZFpvbmVJZCxcbiAgICAgICAgLy8gQUxC44Gu44OJ44Oh44Kk44Oz5Y+C54Wn44OR44K/44O844Oz56K66KqNXG4gICAgICAgIEFsaWFzVGFyZ2V0OiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICAvLyBkdWFsc3RhY2vlvaLlvI/jga5ETlPlkI3lj4LnhafjgpLnorroqo1cbiAgICAgICAgICBETlNOYW1lOiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICAgIFwiRm46OkpvaW5cIjogTWF0Y2guYXJyYXlFcXVhbHMoW1xuICAgICAgICAgICAgICBcIlwiLFxuICAgICAgICAgICAgICBNYXRjaC5hcnJheVdpdGgoW1xuICAgICAgICAgICAgICAgIFwiZHVhbHN0YWNrLlwiLFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIFwiRm46OkdldEF0dFwiOiBbYWxiSWQsIFwiRE5TTmFtZVwiXSxcbiAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICBdKSxcbiAgICAgICAgICAgIF0pLFxuICAgICAgICAgIH0pLFxuICAgICAgICB9KSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgdGVzdChcIkFMQueUqOOBrkFDTeiovOaYjuabuOOBjOato+OBl+OBj+ioreWumuOBleOCjOOBpuOBhOOCi1wiLCAoKSA9PiB7XG4gICAgLy8gQUNN6Ki85piO5pu444Gu44Oq44K944O844K55Y+W5b6X44GoTG9naWNhbElE5Y+W5b6XXG4gICAgY29uc3QgYWNtUmVzb3VyY2VzID0gdGVtcGxhdGUuZmluZFJlc291cmNlcyhcbiAgICAgIFwiQVdTOjpDZXJ0aWZpY2F0ZU1hbmFnZXI6OkNlcnRpZmljYXRlXCIsXG4gICAgKTtcbiAgICBjb25zdCBhY21DZXJ0SWQgPSBPYmplY3Qua2V5cyhhY21SZXNvdXJjZXMpWzBdO1xuXG4gICAgLy8g5ZCE44OG44OK44Oz44OI44GuQVBJ44OJ44Oh44Kk44Oz44KS5Y+W5b6XXG4gICAgY29uc3QgYXBpRG9tYWlucyA9IHBhcmFtcy5tYWluU3RhY2tQcm9wcy50ZW5hbnRzLm1hcChcbiAgICAgICh0ZW5hbnQpID0+IGBhcGkuJHt0ZW5hbnQuYXBwRG9tYWluTmFtZX1gLFxuICAgICk7XG5cbiAgICAvLyBBQ03oqLzmmI7mm7jjga7oqK3lrprjgpLnorroqo1cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoXCJBV1M6OkNlcnRpZmljYXRlTWFuYWdlcjo6Q2VydGlmaWNhdGVcIiwge1xuICAgICAgRG9tYWluTmFtZTogYXBpRG9tYWluc1swXSwgLy8g44OX44Op44Kk44Oe44Oq44OJ44Oh44Kk44OzXG4gICAgICBTdWJqZWN0QWx0ZXJuYXRpdmVOYW1lczogYXBpRG9tYWlucy5zbGljZSgxKSwgLy8g5Luj5pu/44OJ44Oh44Kk44OzXG4gICAgICBWYWxpZGF0aW9uTWV0aG9kOiBcIkROU1wiLFxuICAgIH0pO1xuXG4gICAgLy8gQUxC44Oq44K544OK44O844Gr6Ki85piO5pu444GM6Kit5a6a44GV44KM44Gm44GE44KL44GT44Go44KS56K66KqNXG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpFbGFzdGljTG9hZEJhbGFuY2luZ1YyOjpMaXN0ZW5lclwiLCB7XG4gICAgICBQcm90b2NvbDogXCJIVFRQU1wiLFxuICAgICAgUG9ydDogNDQzLFxuICAgICAgQ2VydGlmaWNhdGVzOiBNYXRjaC5hcnJheVdpdGgoW1xuICAgICAgICBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICBDZXJ0aWZpY2F0ZUFybjoge1xuICAgICAgICAgICAgUmVmOiBhY21DZXJ0SWQsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSksXG4gICAgICBdKSxcbiAgICB9KTtcbiAgfSk7XG5cbiAgdGVzdChcIuWQhOODhuODiuODs+ODiOOBruODoeODvOODq+ioreWumuOBjOato+OBl+OBj+ani+aIkOOBleOCjOOBpuOBhOOCi1wiLCAoKSA9PiB7XG4gICAgZm9yIChjb25zdCB0ZW5hbnQgb2YgcGFyYW1zLm1haW5TdGFja1Byb3BzLnRlbmFudHMpIHtcbiAgICAgIC8vIFNFU+OBruODieODoeOCpOODs+aknOiovOioreWumlxuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpTRVM6OkVtYWlsSWRlbnRpdHlcIiwge1xuICAgICAgICBFbWFpbElkZW50aXR5OiB0ZW5hbnQuYXBwRG9tYWluTmFtZSxcbiAgICAgICAgTWFpbEZyb21BdHRyaWJ1dGVzOiB7XG4gICAgICAgICAgTWFpbEZyb21Eb21haW46IGBib3VuY2UuJHt0ZW5hbnQuYXBwRG9tYWluTmFtZX1gLFxuICAgICAgICB9LFxuICAgICAgfSk7XG5cbiAgICAgIC8vIERNQVJD44Os44Kz44O844OJ44Gu6Kit5a6aXG4gICAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoXCJBV1M6OlJvdXRlNTM6OlJlY29yZFNldFwiLCB7XG4gICAgICAgIE5hbWU6IGBfZG1hcmMuJHt0ZW5hbnQuYXBwRG9tYWluTmFtZX0uYCxcbiAgICAgICAgVHlwZTogXCJUWFRcIixcbiAgICAgICAgVFRMOiBcIjM2MDBcIixcbiAgICAgICAgUmVzb3VyY2VSZWNvcmRzOiBbXG4gICAgICAgICAgYFwidj1ETUFSQzE7IHA9bm9uZTsgcnVhPW1haWx0bzoke3BhcmFtcy5tYWluU3RhY2tQcm9wcy5kbWFyY1JlcG9ydEVtYWlsfVwiYCxcbiAgICAgICAgXSxcbiAgICAgIH0pO1xuICAgIH1cbiAgfSk7XG5cbiAgdGVzdChcIkFMQuOBq1dBRuOBjOmWoumAo+S7mOOBkeOCieOCjOOBpuOBhOOCi1wiLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKFwiQVdTOjpXQUZ2Mjo6V2ViQUNMQXNzb2NpYXRpb25cIiwgMSk7XG4gIH0pO1xuXG4gIHRlc3QoXCJBdXJvcmHjga7jg5fjg63jg5Hjg4bjgqPjgYzmraPjgZfjgY/oqK3lrprjgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6UkRTOjpEQkNsdXN0ZXJcIiwge1xuICAgICAgLy8g44Ko44Oz44K444Oz44OQ44O844K444On44OzXG4gICAgICBFbmdpbmU6IFwiYXVyb3JhLXBvc3RncmVzcWxcIixcbiAgICAgIEVuZ2luZVZlcnNpb246XG4gICAgICAgIHBhcmFtcy5tYWluU3RhY2tQcm9wcy5wb3N0Z3Jlc1ZlcnNpb24uYXVyb3JhUG9zdGdyZXNGdWxsVmVyc2lvbixcblxuICAgICAgLy8gU2VydmVybGVzc1Yy44Gu6Kit5a6aXG4gICAgICBTZXJ2ZXJsZXNzVjJTY2FsaW5nQ29uZmlndXJhdGlvbjoge1xuICAgICAgICBNaW5DYXBhY2l0eTogcGFyYW1zLm1haW5TdGFja1Byb3BzLmF1cm9yYVNlcnZlcmxlc3NWMk1pbkNhcGFjaXR5LFxuICAgICAgICBNYXhDYXBhY2l0eTogcGFyYW1zLm1haW5TdGFja1Byb3BzLmF1cm9yYVNlcnZlcmxlc3NWMk1heENhcGFjaXR5LFxuICAgICAgfSxcblxuICAgICAgLy8g44OQ44OD44Kv44Ki44OD44OX6Kit5a6aXG4gICAgICBCYWNrdXBSZXRlbnRpb25QZXJpb2Q6IDcsXG4gICAgICBQcmVmZXJyZWRCYWNrdXBXaW5kb3c6IFwiMTY6MDAtMTc6MDBcIixcblxuICAgICAgLy8g44Oh44Oz44OG44OK44Oz44K544Km44Kj44Oz44OJ44KmXG4gICAgICBQcmVmZXJyZWRNYWludGVuYW5jZVdpbmRvdzogXCJTdW46MTM6MDAtU3VuOjEzOjMwXCIsXG5cbiAgICAgIC8vIOOCu+OCreODpeODquODhuOCo+ioreWumlxuICAgICAgU3RvcmFnZUVuY3J5cHRlZDogdHJ1ZSxcbiAgICAgIEVuYWJsZUlBTURhdGFiYXNlQXV0aGVudGljYXRpb246IHRydWUsXG5cbiAgICAgIC8vIERhdGEgQVBJ44Gu6Kit5a6aXG4gICAgICBFbmFibGVIdHRwRW5kcG9pbnQ6IHRydWUsXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoXCJFQ1Ljg6rjg53jgrjjg4jjg6rjga7jg6njgqTjg5XjgrXjgqTjgq/jg6vjg6vjg7zjg6vjgYzlrprnvqnjgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6RUNSOjpSZXBvc2l0b3J5XCIsIHtcbiAgICAgIExpZmVjeWNsZVBvbGljeTogTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgIExpZmVjeWNsZVBvbGljeVRleHQ6IE1hdGNoLmFueVZhbHVlKCksXG4gICAgICB9KSxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==