import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { GlobalStack } from "../lib/global-stack";
import { MainStack } from "../lib/main-stack";
import { params } from "../params/dev";

// アプリケーションとスタックの生成
const app = new App();
const globalStack = new GlobalStack(
  app,
  "TestGlobalStack",
  params.globalStackProps,
);
const mainStack = new MainStack(app, "TestMainStack", {
  ...params.mainStackProps,
  cloudfrontCertificate: globalStack.cloudfrontCertificate,
  cloudFrontWebAcl: globalStack.cloudFrontWebAcl,
});
const template = Template.fromStack(mainStack);

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
      DeletionProtection: params.mainStackProps.auroraDeletionProtection,
    });
  });

  // 条件分岐テスト: ALB削除保護設定
  test("ALBの削除保護設定がpropsを反映している", () => {
    template.hasResourceProperties(
      "AWS::ElasticLoadBalancingV2::LoadBalancer",
      {
        LoadBalancerAttributes: Match.arrayWith([
          Match.objectLike({
            Key: "deletion_protection.enabled",
            Value: String(params.mainStackProps.albDeletionProtection),
          }),
        ]),
      },
    );
  });

  test("ECSタスク定義に必要なコンテナが含まれている", () => {
    template.hasResourceProperties("AWS::ECS::TaskDefinition", {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: "web",
          Essential: true,
        }),
        Match.objectLike({
          Name: "app",
          Essential: true,
        }),
        Match.objectLike({
          Name: "log-router",
        }),
      ]),
    });
  });

  test("ECSタスク定義に環境変数とシークレットが適切に設定されていること", () => {
    // appコンテナの環境変数とシークレットを確認
    template.hasResourceProperties("AWS::ECS::TaskDefinition", {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: "app",
          Environment: [
            {
              Name: "TZ",
              Value: "Asia/Tokyo",
            },
            {
              Name: "APP_ENV",
              Value: params.mainStackProps.envName,
            },
            {
              Name: "APP_DEBUG",
              Value: String(params.mainStackProps.appDebug),
            },
            {
              Name: "AWS_BUCKET",
              Value: Match.anyValue(),
            },
            {
              Name: "AWS_URL",
              Value: Match.anyValue(),
            },
            {
              Name: "MAIL_MAILER",
              Value: "ses",
            },
          ],
          Secrets: [
            {
              Name: "DB_HOST",
              ValueFrom: Match.anyValue(),
            },
            {
              Name: "DB_PORT",
              ValueFrom: Match.anyValue(),
            },
            {
              Name: "DB_USERNAME",
              ValueFrom: Match.anyValue(),
            },
            {
              Name: "DB_DATABASE",
              ValueFrom: Match.anyValue(),
            },
            {
              Name: "DB_PASSWORD",
              ValueFrom: Match.anyValue(),
            },
            {
              Name: "APP_KEY",
              ValueFrom: Match.anyValue(),
            },
          ],
        }),
      ]),
    });

    // log-routerコンテナの環境変数とシークレットを確認
    template.hasResourceProperties("AWS::ECS::TaskDefinition", {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: "log-router",
          Environment: [
            {
              Name: "KINESIS_APP_DELIVERY_STREAM",
              Value: Match.anyValue(),
            },
            {
              Name: "KINESIS_WEB_DELIVERY_STREAM",
              Value: Match.anyValue(),
            },
            {
              Name: "AWS_REGION",
              Value: Match.anyValue(),
            },
          ],
          Secrets: [
            {
              Name: "APP_LOG_SLACK_WEBHOOK_URL",
              ValueFrom: Match.anyValue(),
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
      BucketEncryption: Match.objectLike({
        ServerSideEncryptionConfiguration: Match.arrayWith([
          Match.objectLike({
            ServerSideEncryptionByDefault: Match.objectLike({
              SSEAlgorithm: "AES256",
            }),
          }),
        ]),
      }),
    });
  });

  test("フロントエンドがS3+CloudFrontのアーキテクチャになっている", () => {
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Origins: Match.arrayWith([
          Match.objectLike({
            S3OriginConfig: Match.anyValue(),
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
    // CloudFrontが1つだけ存在することを確認
    template.resourceCountIs("AWS::CloudFront::Distribution", 1);

    // CloudFrontリソースのLogicalID取得
    const cfResources = template.findResources("AWS::CloudFront::Distribution");
    const cloudFrontId = Object.keys(cfResources)[0];

    // 各テナントのドメイン名を取得
    const tenantDomains = params.mainStackProps.tenants.map(
      (tenant) => tenant.appDomainName,
    );

    // CloudFrontのドメイン設定 - 全テナントが含まれているか確認
    template.hasResourceProperties("AWS::CloudFront::Distribution", {
      DistributionConfig: Match.objectLike({
        Aliases: Match.arrayWith(tenantDomains),
      }),
    });

    // Route53レコード設定の確認
    for (const tenant of params.mainStackProps.tenants) {
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: `${tenant.appDomainName}.`,
        Type: "A",
        HostedZoneId: tenant.route53HostedZoneId,
        // CloudFrontドメインの参照確認
        AliasTarget: Match.objectLike({
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
    const albResources = template.findResources(
      "AWS::ElasticLoadBalancingV2::LoadBalancer",
    );
    const albId = Object.keys(albResources)[0];

    // 各テナントのAPIドメインに対するRoute53レコードを確認
    for (const tenant of params.mainStackProps.tenants) {
      const apiDomainName = `api.${tenant.appDomainName}`;

      // ALBドメインとRoute53レコードの設定確認
      template.hasResourceProperties("AWS::Route53::RecordSet", {
        Name: `${apiDomainName}.`,
        Type: "A",
        HostedZoneId: tenant.route53HostedZoneId,
        // ALBのドメイン参照パターン確認
        AliasTarget: Match.objectLike({
          // dualstack形式のDNS名参照を確認
          DNSName: Match.objectLike({
            "Fn::Join": Match.arrayEquals([
              "",
              Match.arrayWith([
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
    const acmResources = template.findResources(
      "AWS::CertificateManager::Certificate",
    );
    const acmCertId = Object.keys(acmResources)[0];

    // 各テナントのAPIドメインを取得
    const apiDomains = params.mainStackProps.tenants.map(
      (tenant) => `api.${tenant.appDomainName}`,
    );

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
      Certificates: Match.arrayWith([
        Match.objectLike({
          CertificateArn: {
            Ref: acmCertId,
          },
        }),
      ]),
    });
  });

  test("各テナントのメール設定が正しく構成されている", () => {
    for (const tenant of params.mainStackProps.tenants) {
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
          `"v=DMARC1; p=none; rua=mailto:${params.mainStackProps.dmarcReportEmail}"`,
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
      EngineVersion:
        params.mainStackProps.postgresVersion.auroraPostgresFullVersion,

      // ServerlessV2の設定
      ServerlessV2ScalingConfiguration: {
        MinCapacity: params.mainStackProps.auroraServerlessV2MinCapacity,
        MaxCapacity: params.mainStackProps.auroraServerlessV2MaxCapacity,
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
      LifecyclePolicy: Match.objectLike({
        LifecyclePolicyText: Match.anyValue(),
      }),
    });
  });
});
