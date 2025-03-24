import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { GlobalStack } from '../lib/global-stack';
import { MainStack } from '../lib/main-stack';
import { params } from '../params/dev';

// アプリケーションとスタックの生成
const app = new App();
const globalStack = new GlobalStack(app, 'TestGlobalStack', params.globalStackProps);
const mainStack = new MainStack(app, 'TestMainStack', {
  ...params.mainStackProps,
  cloudfrontCertificate: globalStack.cloudfrontCertificate,
  cloudFrontWebAcl: globalStack.cloudFrontWebAcl,
});
const template = Template.fromStack(mainStack);

describe('MainStack', () => {
  // 必須のインフラ要素が正しく作成されているか確認
  test('基本インフラストラクチャが正しく作成されている', () => {
    // VPCとネットワーク
    template.resourceCountIs('AWS::EC2::VPC', 1);
    template.resourceCountIs('AWS::EC2::Subnet', 4); // 2つのAZにPublicとPrivateのサブネット

    // フロントエンド用リソース
    template.resourceCountIs('AWS::CloudFront::Distribution', 1);

    // バックエンド用リソース
    template.resourceCountIs('AWS::ElasticLoadBalancingV2::LoadBalancer', 1);
    template.resourceCountIs('AWS::ECS::Cluster', 1);
    template.resourceCountIs('AWS::ECS::Service', 1);
    template.resourceCountIs('AWS::ECS::TaskDefinition', 1);

    // データベース関連
    template.resourceCountIs('AWS::RDS::DBCluster', 1);
  });

  // 条件分岐テスト: Aurora削除保護設定
  test('Auroraの削除保護設定がpropsを反映している', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      DeletionProtection: params.mainStackProps.auroraDeletionProtection,
    });
  });

  // 条件分岐テスト: ALB削除保護設定
  test('ALBの削除保護設定がpropsを反映している', () => {
    template.hasResourceProperties('AWS::ElasticLoadBalancingV2::LoadBalancer', {
      LoadBalancerAttributes: Match.arrayWith([
        Match.objectLike({
          Key: 'deletion_protection.enabled',
          Value: String(params.mainStackProps.albDeletionProtection),
        }),
      ]),
    });
  });

  // ループや動的生成テスト: ECSタスク定義のコンテナ
  test('ECSタスク定義に必要なコンテナが含まれている', () => {
    template.hasResourceProperties('AWS::ECS::TaskDefinition', {
      ContainerDefinitions: Match.arrayWith([
        Match.objectLike({
          Name: 'web',
          Essential: true,
        }),
        Match.objectLike({
          Name: 'app',
          Essential: true,
        }),
        Match.objectLike({
          Name: 'log-router',
        }),
      ]),
    });
  });

  // 重要な設定テスト: S3バケットのセキュリティ設定
  test('S3バケットは安全に構成されている', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
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
              SSEAlgorithm: Match.anyValue(),
            }),
          }),
        ]),
      }),
    });
  });

  // フロントエンドのデプロイアーキテクチャテスト
  test('フロントエンドがS3+CloudFrontのアーキテクチャになっている', () => {
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Origins: Match.arrayWith([
          Match.objectLike({
            S3OriginConfig: Match.anyValue(),
          }),
        ]),
      }),
    });
  });

  // ECSサービスのCapacityProviderStrategyを確認
  test('ECSサービスがFARGATEを使用している', () => {
    template.hasResourceProperties('AWS::ECS::Service', {
      CapacityProviderStrategy: [
        {
          CapacityProvider: 'FARGATE',
          Weight: 1,
        },
      ],
    });
  });

  // ドメイン名とURLの伝播テスト
  test('ドメイン名がCloudFrontとALBに正しく伝播されている', () => {
    const appDomainName = params.mainStackProps.appDomainName;
    const apiDomainName = `api.${appDomainName}`;

    // CloudFrontのドメイン設定
    template.hasResourceProperties('AWS::CloudFront::Distribution', {
      DistributionConfig: Match.objectLike({
        Aliases: Match.arrayWith([appDomainName]),
      }),
    });

    // Route53のALBレコード
    template.hasResourceProperties('AWS::Route53::RecordSet', {
      Name: Match.stringLikeRegexp(`${apiDomainName}\\.`),
      Type: 'A',
    });
  });

  // セキュリティテスト: WAF連携
  test('ALBにWAFが関連付けられている', () => {
    template.resourceCountIs('AWS::WAFv2::WebACLAssociation', 1);
  });

  // Auroraのプロパティテスト
  test('Auroraのプロパティが正しく設定されている', () => {
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      // エンジンバージョン
      Engine: 'aurora-postgresql',
      EngineVersion: params.mainStackProps.postgresVersion.auroraPostgresFullVersion,
      
      // ServerlessV2の設定
      ServerlessV2ScalingConfiguration: {
        MinCapacity: params.mainStackProps.auroraServerlessV2MinCapacity,
        MaxCapacity: params.mainStackProps.auroraServerlessV2MaxCapacity,
      },
      
      // バックアップ設定
      BackupRetentionPeriod: 7,
      PreferredBackupWindow: '16:00-17:00',
      
      // メンテナンスウィンドウ
      PreferredMaintenanceWindow: 'Sun:13:00-Sun:13:30',

      // セキュリティ設定
      StorageEncrypted: true,
      EnableIAMDatabaseAuthentication: true,

      // Data APIの設定
      EnableHttpEndpoint: true,
    });
  });

}); 