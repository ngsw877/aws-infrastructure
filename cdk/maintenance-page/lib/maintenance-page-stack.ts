import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';
import * as origins from 'aws-cdk-lib/aws-cloudfront-origins';
import * as acm from 'aws-cdk-lib/aws-certificatemanager';
import * as route53 from 'aws-cdk-lib/aws-route53';
import * as targets from 'aws-cdk-lib/aws-route53-targets';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import { Construct } from 'constructs';
import { SiteParams } from '../types/params';

interface MaintenancePageStackProps extends cdk.StackProps, SiteParams {}

export class MaintenancePageStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: MaintenancePageStackProps) {
    super(scope, id, props);

    const { domainName, hostedZoneId, webpagePath } = props;

    // 既存のホストゾーンを参照
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(this, 'HostedZone', {
      hostedZoneId: hostedZoneId,
      zoneName: domainName,
    });

    // ACM証明書（us-east-1で作成）
    const certificate = new acm.Certificate(this, 'Certificate', {
      domainName: domainName,
      validation: acm.CertificateValidation.fromDns(hostedZone),
    });

    // S3バケット（メンテナンスページ用）
    const bucket = new s3.Bucket(this, 'MaintenancePageBucket', {
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // CloudFront Distribution
    const distribution = new cloudfront.Distribution(this, 'Distribution', {
      defaultBehavior: {
        origin: origins.S3BucketOrigin.withOriginAccessControl(bucket),
        viewerProtocolPolicy: cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
      },
      domainNames: [domainName],
      certificate: certificate,
      defaultRootObject: 'index.html',
      errorResponses: [
        {
          httpStatus: 404,
          responseHttpStatus: 200,
          responsePagePath: '/index.html',
        },
      ],
    });

    // Route 53 Aレコード
    new route53.ARecord(this, 'AliasRecord', {
      zone: hostedZone,
      target: route53.RecordTarget.fromAlias(new targets.CloudFrontTarget(distribution)),
    });

    // メンテナンスページをS3にデプロイ
    new s3deploy.BucketDeployment(this, 'DeployWebsite', {
      sources: [s3deploy.Source.asset(webpagePath)],
      destinationBucket: bucket,
      distribution: distribution,
      distributionPaths: ['/*'],
    });

    // 出力
    new cdk.CfnOutput(this, 'DistributionDomainName', {
      value: distribution.distributionDomainName,
    });

    new cdk.CfnOutput(this, 'WebsiteUrl', {
      value: `https://${domainName}`,
    });
  }
}
