import {
  Stack,
  Duration,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import type { GlobalStackProps } from "../types/params";

export class GlobalStack extends Stack {
  public readonly hostedZone: route53.IHostedZone;
  public readonly cloudfrontCertificate: acm.ICertificate;
  public readonly cloudFrontWebAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    // Route53ホストゾーンの定義
    this.hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: props.hostedZoneId,
        zoneName: props.appDomain,
      },
    );

    // CloudFront用のACM証明書
    this.cloudfrontCertificate = new acm.Certificate(
      this,
      "CloudFrontCertificate",
      {
        certificateName: `${this.stackName}-cloudfront-certificate`,
        domainName: props.appDomain,
        validation: acm.CertificateValidation.fromDns(this.hostedZone),
      },
    );

    // 許可IPアドレスが指定されている場合のみIPセットを作成
    const allowedIpSet = props.allowedIpAddresses?.length
      ? new wafv2.CfnIPSet(this, "AllowedIPSet", {
          scope: "CLOUDFRONT",
          ipAddressVersion: "IPV4",
          addresses: props.allowedIpAddresses,
          name: "AllowedIPs",
        })
      : undefined;

    // CloudFront用WAF WebACL
    this.cloudFrontWebAcl = new wafv2.CfnWebACL(this, "CloudFrontWebACL", {
      defaultAction: 
        props.allowedIpAddresses?.length 
          ? { block: {} }  // 許可IPアドレスが指定されている場合はブロック
          : { allow: {} }, // 許可IPアドレスが指定されていない場合は許可
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "CloudFrontWebACL",
        sampledRequestsEnabled: true,
      },
      rules: [
        // 許可IPアドレスが指定されている場合のみ、許可ルールを追加
        ...(allowedIpSet ? [{
          name: "AllowSpecificIPs",
          priority: 1,
          action: { allow: {} },
          statement: {
            ipSetReferenceStatement: {
              arn: allowedIpSet.attrArn,
            },
          },
          visibilityConfig: {
            cloudWatchMetricsEnabled: true,
            metricName: "AllowSpecificIPs",
            sampledRequestsEnabled: true,
          },
        }] : []),
        // AWSマネージドルールは常に追加
        {
          name: "AWSManagedRulesCommonRuleSet",
          priority: allowedIpSet ? 2 : 1,
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
    const cloudFrontWafLogsBucket = new s3.Bucket(
      this,
      "CloudFrontWafLogsBucket",
      {
        // WAFのログは"aws-waf-logs-"で始まるバケット名にする必要がある
        bucketName: `aws-waf-logs-${this.account}-${this.cloudFrontWebAcl.node.id.toLowerCase()}`,
        versioned: false,
        lifecycleRules: [
        {
          id: "cloudfront-waf-log-expiration",
          enabled: true,
          expiration: Duration.days(props?.logRetentionDays ?? 90),
        },
      ],
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      encryption: s3.BucketEncryption.S3_MANAGED,
      enforceSSL: true,
    });

    // WAFログ出力設定
    // Blockしたリクエストのみログ出力する
    new wafv2.CfnLoggingConfiguration(
      this,
      "CloudFrontWafLogConfig",
      {
        logDestinationConfigs: [cloudFrontWafLogsBucket.bucketArn],
        resourceArn: this.cloudFrontWebAcl.attrArn,
        loggingFilter: {
          DefaultBehavior: "DROP",
          // BLOCKした場合のみKEEPの設定とする
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
              Requirement: "MEETS_ALL", // 条件全てに合致した場合
            },
          ],
        },
      },
    );
  }
}
