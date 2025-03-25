import {
  Stack,
  Duration,
  aws_s3 as s3,
  aws_wafv2 as wafv2,
  RemovalPolicy,
} from "aws-cdk-lib";
import * as acm from "aws-cdk-lib/aws-certificatemanager";
import * as route53 from "aws-cdk-lib/aws-route53";
import type { Construct } from "constructs";
import type { GlobalStackProps } from "../types/params";

export class GlobalStack extends Stack {
  public readonly cloudfrontCertificate: acm.ICertificate;
  public readonly cloudFrontWebAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    // マルチドメイン対応のDNS検証用ホストゾーンマッピング
    const hostedZoneMap: Record<string, route53.IHostedZone> = {};
    
    // 各テナントのホストゾーンをマッピング
    for (const tenant of props.tenants) {
      hostedZoneMap[tenant.appDomainName] = route53.HostedZone.fromHostedZoneAttributes(
        this,
        `HostedZone-${tenant.appDomainName.replace(/\./g, '-')}`,
        {
          hostedZoneId: tenant.route53HostedZoneId,
          zoneName: tenant.appDomainName,
        }
      );
    }

    // CloudFront用のACM証明書（複数ドメイン対応）
    this.cloudfrontCertificate = new acm.Certificate(
      this,
      "CloudFrontCertificate",
      {
        certificateName: `${this.stackName}-cloudfront-certificate`,
        domainName: props.tenants[0].appDomainName, // プライマリドメイン
        subjectAlternativeNames: props.tenants.slice(1).map(d => d.appDomainName), // 追加ドメイン
        validation: acm.CertificateValidation.fromDnsMultiZone(hostedZoneMap),
      },
    );

    // WAF用のルール配列を作成
    const wafRules: wafv2.CfnWebACL.RuleProperty[] = [
      // AWSマネージドルール
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

    // テナントごとのIP制限ルールを追加 - 修正後のコード
    props.tenants.forEach((tenant, index) => {
      if (tenant.allowedIpAddresses && tenant.allowedIpAddresses.length > 0) {
        // IPセットを直接作成
        const ipSet = new wafv2.CfnIPSet(
          this,
          `AllowedIpSet-${tenant.appDomainName.replace(/\./g, '-')}`,
          {
            scope: "CLOUDFRONT",
            ipAddressVersion: "IPV4",
            addresses: tenant.allowedIpAddresses,
          }
        );

        // IP制限がある場合のルール
        const rule: wafv2.CfnWebACL.RuleProperty = {
          name: `IPRestriction-${tenant.appDomainName.replace(/\./g, '-')}`,
          priority: 10 + index,
          action: { block: {} },
          statement: {
            andStatement: {
              statements: [
                // 特定のドメインへのリクエストを識別
                {
                  byteMatchStatement: {
                    fieldToMatch: {
                      singleHeader: { name: "host" }
                    },
                    positionalConstraint: "EXACTLY",
                    searchString: tenant.appDomainName,
                    textTransformations: [{ priority: 0, type: "NONE" }]
                  }
                },
                // 許可IPリスト以外からのアクセスを制限
                {
                  notStatement: {
                    statement: {
                      ipSetReferenceStatement: {
                        arn: ipSet.attrArn
                      }
                    }
                  }
                },
                // /sampleまたは/productで始まるパスではない
                {
                  notStatement: {
                    statement: {
                      orStatement: {
                        statements: [
                          {
                            byteMatchStatement: {
                              fieldToMatch: {
                                uriPath: {}
                              },
                              positionalConstraint: "STARTS_WITH",
                              searchString: "/sample",
                              textTransformations: [{ priority: 0, type: "NONE" }]
                            }
                          },
                          { 
                            byteMatchStatement: {
                              fieldToMatch: {
                                uriPath: {}
                              },
                              positionalConstraint: "STARTS_WITH",
                              searchString: "/product",
                              textTransformations: [{ priority: 0, type: "NONE" }]
                            }
                          },
                          {
                            byteMatchStatement: {
                              fieldToMatch: { uriPath: {} },
                              positionalConstraint: "STARTS_WITH",
                              searchString: "/_nuxt/",
                              textTransformations: [{ priority: 0, type: "NONE" }]
                            }
                          }
                        ]
                      }
                    }
                  }
                }
              ]
            }
          },
          visibilityConfig: {
            metricName: `IPRestriction-${tenant.appDomainName.replace(/\./g, '-')}`,
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
          },
        };
        
        wafRules.push(rule);
      }
    });

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
        bucketName: `aws-waf-logs-${this.stackName.toLowerCase()}-${this.cloudFrontWebAcl.node.id.toLowerCase()}`,
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
      }
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
      }
    );

    // ログバケットの作成が完了してからWAFログ出力設定を作成する（でないとバケットポリシー関連のエラーが発生してスタックデプロイに失敗することがある）
    wafLogConfig.node.addDependency(cloudFrontWafLogsBucket);
  }
}
