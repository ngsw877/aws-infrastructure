import {
  Duration,
  RemovalPolicy,
  Stack,
  CfnOutput,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import type { GlobalStackProps } from "../types/params";

export class GlobalStack extends Stack {
  public readonly cloudFrontCertificate: acm.ICertificate;
  public readonly cloudFrontWebAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    // DNS検証用ホストゾーン
    const hostedZone = route53.HostedZone.fromHostedZoneAttributes(
      this,
      "HostedZone",
      {
        hostedZoneId: props.route53HostedZoneId,
        zoneName: props.appDomainName,
      },
    );

    // ACM証明書を作成
    this.cloudFrontCertificate = new acm.Certificate(
      this,
      "CloudFrontCertificate",
      {
        certificateName: `${this.stackName}-cloudfront-certificate`,
        domainName: props.appDomainName,
        validation: acm.CertificateValidation.fromDns(hostedZone),
      }
    );

    // 証明書をエクスポート
    new CfnOutput(this, "FrontendCertificateArn", {
      value: this.cloudFrontCertificate.certificateArn,
      exportName: `${props.envName}-frontend-cert-arn`,
    });

    // WAF用のルール配列を作成
    const wafRules: wafv2.CfnWebACL.RuleProperty[] = [
      // AWSマネージドルール（優先度1: 最初に評価）
      {
        name: "CommonSecurityProtection",
        priority: 1,
        overrideAction: { none: {} },
        statement: {
          managedRuleGroupStatement: {
            name: "AWSManagedRulesCommonRuleSet",
            vendorName: "AWS",
          },
        },
        visibilityConfig: {
          metricName: "CommonSecurityProtection",
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
        },
      },
    ];

    // IP制限の設定
    if (props.ipRestrictionExcludedPaths && props.ipRestrictionExcludedPaths.length > 0) {
      // 特定パスをIP制限から除外するルール
      wafRules.push({
        name: "AllowedPaths",
        priority: 10,
        action: { allow: {} },
        statement: {
          orStatement: {
            statements: props.ipRestrictionExcludedPaths.map(path => ({
              byteMatchStatement: {
                fieldToMatch: { uriPath: {} },
                positionalConstraint: "STARTS_WITH",
                searchString: path,
                textTransformations: [{ priority: 0, type: "NONE" }]
              }
            }))
          }
        },
        visibilityConfig: {
          metricName: "AllowedPaths",
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
        },
      });
    }

    if (props.allowedIpAddresses && props.allowedIpAddresses.length > 0) {
      // IPセットを作成
      const ipSet = new wafv2.CfnIPSet(
        this,
        "AllowedIpSet",
        {
          scope: "CLOUDFRONT",
          ipAddressVersion: "IPV4",
          addresses: props.allowedIpAddresses,
        }
      );

      // IP制限ルール
      wafRules.push({
        name: "IPRestriction",
        priority: 11,
        action: { 
          block: { 
            customResponse: {
              responseCode: 404,
              responseHeaders: [
                {
                  name: "x-waf-blocked",
                  value: "true"
                }
              ]
            } 
          }
        },
        statement: {
          notStatement: {
            statement: {
              ipSetReferenceStatement: {
                arn: ipSet.attrArn
              }
            }
          }
        },
        visibilityConfig: {
          metricName: "IPRestriction",
          cloudWatchMetricsEnabled: true,
          sampledRequestsEnabled: true,
        },
      });
    }

    // CloudFront用WAF WebACL
    this.cloudFrontWebAcl = new wafv2.CfnWebACL(this, "CloudFrontWebACL", {
      defaultAction: { allow: {} }, // デフォルトは許可
      scope: "CLOUDFRONT",
      visibilityConfig: {
        cloudWatchMetricsEnabled: true,
        metricName: "CloudFrontWebACL",
        sampledRequestsEnabled: true,
      },
      rules: wafRules,
    });

    // WAF用ログバケット
    const cloudFrontWafLogsBucket = new s3.Bucket(
      this,
      "CloudFrontWafLogsBucket",
      {
        // WAFのログは"aws-waf-logs-"で始まるバケット名にする必要がある
        bucketName: `aws-waf-logs-${props.envName}-${this.account}-${this.cloudFrontWebAcl.node.id.toLowerCase()}`,
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
        removalPolicy: RemovalPolicy.DESTROY,
        autoDeleteObjects: true,
      },
    );

    // WAFログ出力設定（Blockしたリクエストのみログ出力）
    const wafLogConfig = new wafv2.CfnLoggingConfiguration(
      this,
      "CloudFrontWafLogConfig",
      {
        logDestinationConfigs: [cloudFrontWafLogsBucket.bucketArn],
        resourceArn: this.cloudFrontWebAcl.attrArn,
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

    // ログバケットの作成が完了してからWAFログ出力設定を作成する
    wafLogConfig.node.addDependency(cloudFrontWafLogsBucket);
  }
}