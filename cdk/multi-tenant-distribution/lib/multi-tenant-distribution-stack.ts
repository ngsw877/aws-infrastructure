import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import {
  aws_cloudfront as cloudfront,
  aws_route53 as route53,
  aws_s3 as s3,
  aws_certificatemanager as acm,
  Fn,
} from 'aws-cdk-lib';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';

export interface MultiTenantDistributionStackProps extends cdk.StackProps {
  readonly tenants: Array<{
    domainName: string; // 例: "test.sample-app.click"
    hostedZoneId: string; // 事前に作成済みのパブリックHosted ZoneのID
  }>;
}

export class MultiTenantDistributionStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: MultiTenantDistributionStackProps) {
    super(scope, id, props);

    if (!props || !props.tenants || props.tenants.length === 0) {
      throw new Error('tenants is required');
    }

    // フロントエンドのオリジン用S3バケット
    const originBucket = new s3.Bucket(this, 'OriginBucket', {
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // 各テナントのドメインに対応するHosted Zoneをインポート（事前作成が必要）
    const hostedZones: Record<string, route53.IHostedZone> = {};
    for (const tenant of props.tenants) {
      hostedZones[tenant.domainName] = route53.HostedZone.fromHostedZoneAttributes(
        this,
        `HostedZone-${tenant.domainName.replace(/\./g, '-')}`,
        {
          hostedZoneId: tenant.hostedZoneId,
          zoneName: tenant.domainName,
        },
      );
    }

    // 各テナント用のACM証明書（us-east-1）を個別に作成
    const tenantCertificates: Record<string, acm.Certificate> = {};
    for (const tenant of props.tenants) {
      const domain = tenant.domainName;
      tenantCertificates[domain] = new acm.Certificate(this, `CloudFrontCertificate-${domain.replace(/\./g, '-')}`, {
        certificateName: `${this.stackName}-cloudfront-certificate-${domain}`,
        domainName: domain,
        validation: acm.CertificateValidation.fromDns(hostedZones[domain]),
      });
    }

    // CloudFrontディストリビューション（マルチテナント・最小設定）
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(originBucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      defaultRootObject: 'index.html',
      httpVersion: cloudfront.HttpVersion.HTTP2_AND_3,
    });

    // ディストリビューションをマルチテナントモードに変更し、非対応プロパティを削除
    const cfnDistribution = distribution.node.defaultChild as cloudfront.CfnDistribution;
    cfnDistribution.addPropertyDeletionOverride('DistributionConfig.IPV6Enabled');
    cfnDistribution.addPropertyOverride('DistributionConfig.ConnectionMode', 'tenant-only');

    // テナント用のConnection Groupを作成
    const connectionGroup = new cloudfront.CfnConnectionGroup(this, 'ConnectionGroup', {
      name: `${this.stackName}-ConnectionGroup`,
      enabled: true,
      ipv6Enabled: false,
    });

    // 各ドメイン向けにDistributionTenantを作成
    for (const tenant of props.tenants) {
      const domain = tenant.domainName;
      const tenantId = tenant.domainName.replace(/\./g, '-');
      new cloudfront.CfnDistributionTenant(this, `DistributionTenant-${tenantId}`, {
        distributionId: distribution.distributionId,
        connectionGroupId: connectionGroup.attrId,
        name: `${this.stackName}-tenant-${tenantId}`,
        domains: [domain],
        enabled: true,
        customizations: {
          certificate: { arn: tenantCertificates[domain].certificateArn },
        },
      });

      // Connection GroupのRoutingEndpointに向けたRoute53のエイリアスレコード
      new route53.ARecord(this, `AliasRecord-${tenantId}`, {
        zone: hostedZones[tenant.domainName],
        recordName: tenant.domainName,
        target: route53.RecordTarget.fromAlias({
          bind: () => ({
            dnsName: Fn.getAtt(connectionGroup.logicalId, 'RoutingEndpoint').toString(),
            hostedZoneId: 'Z2FDTNDATAQYW2', // CloudFrontの固定ゾーンID
          }),
        }),
      });
    }

    // 初期コンテンツとして index.html を自動アップロード
    new s3deploy.BucketDeployment(this, 'DeployIndexHtml', {
      destinationBucket: originBucket,
      sources: [
        s3deploy.Source.data(
          'index.html',
          `<!doctype html><html><head><meta charset="utf-8"><title>Hello</title></head><body><h1>Hello World!</h1></body></html>`
        ),
      ],
    });
  }
}
