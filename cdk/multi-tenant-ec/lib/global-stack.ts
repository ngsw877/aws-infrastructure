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
  public readonly cloudFrontTenantCertificates: Record<string, acm.ICertificate> = {};
  public readonly cloudFrontWebAcl: wafv2.CfnWebACL;

  constructor(scope: Construct, id: string, props: GlobalStackProps) {
    super(scope, id, props);

    // マルチドメイン対応のDNS検証用ホストゾーンマッピング
    const hostedZoneMap: Record<string, route53.IHostedZone> = {};

    // 各テナントのホストゾーンをマッピング
    for (const tenant of props.tenants) {
      hostedZoneMap[tenant.appDomainName] =
        route53.HostedZone.fromHostedZoneAttributes(
          this,
          `HostedZone-${tenant.appDomainName.replace(/\./g, "-")}`,
          {
            hostedZoneId: tenant.route53HostedZoneId,
            zoneName: tenant.appDomainName,
          },
        );
    }

    // trialテナント用ワイルドカード証明書を作成
    const trialTenants = props.tenants.filter(tenant => tenant.isTrial);
    let wildcardCertificate: acm.ICertificate | undefined;
    
    if (trialTenants.length > 0) {
      // trialテナント用のベースドメインを動的に取得
      const firstTrialTenant = trialTenants[0];
      const trialBaseDomain = firstTrialTenant.appDomainName.split('.').slice(1).join('.'); // trial1.multi-tenant.hoge-app.click → multi-tenant.hoge-app.click
      const wildcardDomain = `*.${trialBaseDomain}`;
      
      wildcardCertificate = new acm.Certificate(
        this,
        "CloudFrontWildcardCertificate",
        {
          certificateName: `${this.stackName}-cloudfront-wildcard-certificate`,
          domainName: wildcardDomain,
          validation: acm.CertificateValidation.fromDns(
            route53.HostedZone.fromHostedZoneAttributes(this, "WildcardHostedZone", {
              hostedZoneId: firstTrialTenant.route53HostedZoneId, // trialテナントのHostedZoneIdを使用
              zoneName: trialBaseDomain,
            })
          ),
        }
      );
      
      // ワイルドカード証明書をエクスポート
      new CfnOutput(this, "FrontendWildcardCertificateArn", {
        value: wildcardCertificate.certificateArn,
        exportName: `${props.envName}-frontend-wildcard-cert-arn`,
      });
    }

    // テナントごとにACM証明書を作成または割り当て
    for (const tenant of props.tenants) {
      const tenantId = tenant.appDomainName.replace(/\./g, "-");
      
      if (tenant.isTrial && wildcardCertificate) {
        // trialテナントはワイルドカード証明書を使用
        this.cloudFrontTenantCertificates[tenant.appDomainName] = wildcardCertificate;
        
        // trialテナント用の証明書参照をエクスポート
        new CfnOutput(this, `FrontendCertificateArn-${tenantId}`, {
          value: wildcardCertificate.certificateArn,
          exportName: `${props.envName}-frontend-cert-arn-${tenantId}`,
        });
      } else {
        // 通常テナントは個別にACM証明書を発行
        const certificate = new acm.Certificate(
          this,
          `CloudFrontCertificate-${tenantId}`,
          {
            certificateName: `${this.stackName}-cloudfront-certificate-${tenantId}`,
            domainName: tenant.appDomainName,
            validation: acm.CertificateValidation.fromDns(hostedZoneMap[tenant.appDomainName]),
          }
        );
        
        // テナントドメインとACM証明書のマッピングを保存
        this.cloudFrontTenantCertificates[tenant.appDomainName] = certificate;
        
        // テナントごとの証明書をエクスポート
        new CfnOutput(this, `FrontendCertificateArn-${tenantId}`, {
          value: certificate.certificateArn,
          exportName: `${props.envName}-frontend-cert-arn-${tenantId}`,
        });
      }
    }

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

    // テナントごとのルールを追加
    props.tenants.forEach((tenant, index) => {
      // テナントごとに優先度の10の位を変える（テナントAは10台、テナントBは20台...）
      const tenantBasePriority = 10 * (index + 1);
      let tenantPriority = 0; // テナント内での優先度カウンター

      // 1つ目のルール（許可パスルール）
      if (tenant.ipRestrictionExcludedPaths && tenant.ipRestrictionExcludedPaths.length > 0) {
        wafRules.push({
          name: `AllowedPaths-${tenant.appDomainName.replace(/\./g, '-')}`,
          priority: tenantBasePriority, // 10, 20, 30...
          action: { allow: {} },
          statement: {
            andStatement: {
              statements: [
                // 特定のドメインへのリクエストを識別
                {
                  byteMatchStatement: {
                    fieldToMatch: {
                      singleHeader: { Name: "host" }
                    },
                    positionalConstraint: "EXACTLY",
                    searchString: tenant.appDomainName,
                    textTransformations: [{ priority: 0, type: "NONE" }]
                  }
                },
                // パス条件
                {
                  orStatement: {
                    statements: tenant.ipRestrictionExcludedPaths.map(path => ({
                      byteMatchStatement: {
                        fieldToMatch: { uriPath: {} },
                        positionalConstraint: "STARTS_WITH",
                        searchString: path,
                        textTransformations: [{ priority: 0, type: "NONE" }]
                      }
                    }))
                  }
                }
              ]
            }
          },
          visibilityConfig: {
            metricName: `AllowedPaths-${tenant.appDomainName.replace(/\./g, '-')}`,
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
          },
        });
      }

      // 2つ目以降のルール（IP制限ルールなど）
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

        wafRules.push({
          name: `IPRestriction-${tenant.appDomainName.replace(/\./g, '-')}`,
          priority: tenantBasePriority + ++tenantPriority, // 11, 21, 31...
          action: { 
            block: { 
              // WAFブロック時は403ではなく404を返すようにしています
              // NOTE:
              // WAFブロック時にデフォルトの403エラーを発生させると、
              // CloudFront側のerrorResponses設定により、ステータスコード200で"/"に転送されます。
              // この挙動により以下の事象が発生します:
              //
              // - 許可IP以外の企業ユーザーがログイン画面"/login"にアクセスし、ログイン成功。
              // - 期待値: ログイン成功後にWAFブロックされる（ログイン後に遷移するトップページ"/"はIP制限対象のため）
              // - 実際: ログイン成功 → WAFブロック → 403エラー → 200で"/"に転送 → _nuxtが読み込まれるからか問題なくトップページが開けてしまう → 更にトップページのメニューから他のページにも遷移できてしまう。
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
            andStatement: {
              statements: [
                // 特定のドメインへのリクエストを識別
                {
                  byteMatchStatement: {
                    fieldToMatch: {
                      singleHeader: { Name: "host" },
                    },
                    positionalConstraint: "EXACTLY",
                    searchString: tenant.appDomainName,
                    textTransformations: [{ priority: 0, type: "NONE" }],
                  },
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
                }
              ]
            }
          },
          visibilityConfig: {
            metricName: `IPRestriction-${tenant.appDomainName.replace(/\./g, "-")}`,
            cloudWatchMetricsEnabled: true,
            sampledRequestsEnabled: true,
          },
        });
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

    // ログバケットの作成が完了してからWAFログ出力設定を作成する（でないとバケットポリシー関連のエラーが発生してスタックデプロイに失敗することがある）
    wafLogConfig.node.addDependency(cloudFrontWafLogsBucket);
  }
}
