"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.GlobalStack = void 0;
const aws_cdk_lib_1 = require("aws-cdk-lib");
const acm = require("aws-cdk-lib/aws-certificatemanager");
const route53 = require("aws-cdk-lib/aws-route53");
class GlobalStack extends aws_cdk_lib_1.Stack {
    constructor(scope, id, props) {
        super(scope, id, props);
        this.cloudFrontTenantCertificates = {};
        // マルチドメイン対応のDNS検証用ホストゾーンマッピング
        const hostedZoneMap = {};
        // 各テナントのホストゾーンをマッピング
        for (const tenant of props.tenants) {
            hostedZoneMap[tenant.appDomainName] =
                route53.HostedZone.fromHostedZoneAttributes(this, `HostedZone-${tenant.appDomainName.replace(/\./g, "-")}`, {
                    hostedZoneId: tenant.route53HostedZoneId,
                    zoneName: tenant.appDomainName,
                });
        }
        // デモテナント用ワイルドカード証明書を作成
        const demoTenants = props.tenants.filter(tenant => tenant.isDemo);
        let wildcardCertificate;
        if (demoTenants.length > 0) {
            // デモテナント用のベースドメインを動的に取得
            const firstDemoTenant = demoTenants[0];
            const demoBaseDomain = firstDemoTenant.appDomainName.split('.').slice(1).join('.'); // demo1.multi-tenant.hoge-app.click → multi-tenant.hoge-app.click
            const wildcardDomain = `*.${demoBaseDomain}`;
            wildcardCertificate = new acm.Certificate(this, "CloudFrontWildcardCertificate", {
                certificateName: `${this.stackName}-cloudfront-wildcard-certificate`,
                domainName: wildcardDomain,
                validation: acm.CertificateValidation.fromDns(route53.HostedZone.fromHostedZoneAttributes(this, "WildcardHostedZone", {
                    hostedZoneId: firstDemoTenant.route53HostedZoneId, // デモテナントのHostedZoneIdを使用
                    zoneName: demoBaseDomain,
                })),
            });
            // ワイルドカード証明書をエクスポート
            new aws_cdk_lib_1.CfnOutput(this, "FrontendWildcardCertificateArn", {
                value: wildcardCertificate.certificateArn,
                exportName: `${props.envName}-frontend-wildcard-cert-arn`,
            });
        }
        // テナントごとにACM証明書を作成または割り当て
        for (const tenant of props.tenants) {
            const tenantId = tenant.appDomainName.replace(/\./g, "-");
            if (tenant.isDemo && wildcardCertificate) {
                // デモテナントはワイルドカード証明書を使用
                this.cloudFrontTenantCertificates[tenant.appDomainName] = wildcardCertificate;
                // デモテナント用の証明書参照をエクスポート
                new aws_cdk_lib_1.CfnOutput(this, `FrontendCertificateArn-${tenantId}`, {
                    value: wildcardCertificate.certificateArn,
                    exportName: `${props.envName}-frontend-cert-arn-${tenantId}`,
                });
            }
            else {
                // 通常テナントは個別にACM証明書を発行
                const certificate = new acm.Certificate(this, `CloudFrontCertificate-${tenantId}`, {
                    certificateName: `${this.stackName}-cloudfront-certificate-${tenantId}`,
                    domainName: tenant.appDomainName,
                    validation: acm.CertificateValidation.fromDns(hostedZoneMap[tenant.appDomainName]),
                });
                // テナントドメインとACM証明書のマッピングを保存
                this.cloudFrontTenantCertificates[tenant.appDomainName] = certificate;
                // テナントごとの証明書をエクスポート
                new aws_cdk_lib_1.CfnOutput(this, `FrontendCertificateArn-${tenantId}`, {
                    value: certificate.certificateArn,
                    exportName: `${props.envName}-frontend-cert-arn-${tenantId}`,
                });
            }
        }
        // WAF用のルール配列を作成
        const wafRules = [
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
                const ipSet = new aws_cdk_lib_1.aws_wafv2.CfnIPSet(this, `AllowedIpSet-${tenant.appDomainName.replace(/\./g, '-')}`, {
                    scope: "CLOUDFRONT",
                    ipAddressVersion: "IPV4",
                    addresses: tenant.allowedIpAddresses,
                });
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
        this.cloudFrontWebAcl = new aws_cdk_lib_1.aws_wafv2.CfnWebACL(this, "CloudFrontWebACL", {
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
        const cloudFrontWafLogsBucket = new aws_cdk_lib_1.aws_s3.Bucket(this, "CloudFrontWafLogsBucket", {
            // WAFのログは"aws-waf-logs-"で始まるバケット名にする必要がある
            bucketName: `aws-waf-logs-${props.envName}-${this.account}-${this.cloudFrontWebAcl.node.id.toLowerCase()}`,
            versioned: false,
            lifecycleRules: [
                {
                    id: "cloudfront-waf-log-expiration",
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
        // WAFログ出力設定（Blockしたリクエストのみログ出力）
        const wafLogConfig = new aws_cdk_lib_1.aws_wafv2.CfnLoggingConfiguration(this, "CloudFrontWafLogConfig", {
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
        });
        // ログバケットの作成が完了してからWAFログ出力設定を作成する（でないとバケットポリシー関連のエラーが発生してスタックデプロイに失敗することがある）
        wafLogConfig.node.addDependency(cloudFrontWafLogsBucket);
    }
}
exports.GlobalStack = GlobalStack;
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXN0YWNrLmpzIiwic291cmNlUm9vdCI6IiIsInNvdXJjZXMiOlsiZ2xvYmFsLXN0YWNrLnRzIl0sIm5hbWVzIjpbXSwibWFwcGluZ3MiOiI7OztBQUFBLDZDQU9xQjtBQUNyQiwwREFBMEQ7QUFDMUQsbURBQW1EO0FBSW5ELE1BQWEsV0FBWSxTQUFRLG1CQUFLO0lBSXBDLFlBQVksS0FBZ0IsRUFBRSxFQUFVLEVBQUUsS0FBdUI7UUFDL0QsS0FBSyxDQUFDLEtBQUssRUFBRSxFQUFFLEVBQUUsS0FBSyxDQUFDLENBQUM7UUFKVixpQ0FBNEIsR0FBcUMsRUFBRSxDQUFDO1FBTWxGLDhCQUE4QjtRQUM5QixNQUFNLGFBQWEsR0FBd0MsRUFBRSxDQUFDO1FBRTlELHFCQUFxQjtRQUNyQixLQUFLLE1BQU0sTUFBTSxJQUFJLEtBQUssQ0FBQyxPQUFPLEVBQUUsQ0FBQztZQUNuQyxhQUFhLENBQUMsTUFBTSxDQUFDLGFBQWEsQ0FBQztnQkFDakMsT0FBTyxDQUFDLFVBQVUsQ0FBQyx3QkFBd0IsQ0FDekMsSUFBSSxFQUNKLGNBQWMsTUFBTSxDQUFDLGFBQWEsQ0FBQyxPQUFPLENBQUMsS0FBSyxFQUFFLEdBQUcsQ0FBQyxFQUFFLEVBQ3hEO29CQUNFLFlBQVksRUFBRSxNQUFNLENBQUMsbUJBQW1CO29CQUN4QyxRQUFRLEVBQUUsTUFBTSxDQUFDLGFBQWE7aUJBQy9CLENBQ0YsQ0FBQztRQUNOLENBQUM7UUFFRCx1QkFBdUI7UUFDdkIsTUFBTSxXQUFXLEdBQUcsS0FBSyxDQUFDLE9BQU8sQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLEVBQUUsQ0FBQyxNQUFNLENBQUMsTUFBTSxDQUFDLENBQUM7UUFDbEUsSUFBSSxtQkFBaUQsQ0FBQztRQUV0RCxJQUFJLFdBQVcsQ0FBQyxNQUFNLEdBQUcsQ0FBQyxFQUFFLENBQUM7WUFDM0Isd0JBQXdCO1lBQ3hCLE1BQU0sZUFBZSxHQUFHLFdBQVcsQ0FBQyxDQUFDLENBQUMsQ0FBQztZQUN2QyxNQUFNLGNBQWMsR0FB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Q0FBQyxTQUFTO1lBQ2pELFVBQVUsRUFBRSxvQkFBRSxDQUFDLGdCQUFnQixDQUFDLFVBQVU7WUFDMUMsVUFBVSxFQUFFLElBQUk7WUFDaEIsYUFBYSxFQUFFLDJCQUFhLENBQUMsT0FBTztZQUNwQyxpQkFBaUIsRUFBRSxJQUFJO1NBQ3hCLENBQ0YsQ0FBQztRQUVGLGdDQUFnQztRQUNoQyxNQUFNLFlBQVksR0FBRyxJQUFJLHVCQUFLLENBQUMsdUJBQXVCLENBQ3BELElBQUksRUFDSix3QkFBd0IsRUFDeEI7WUFDRSxxQkFBcUIsRUFBRSxDQUFDLHVCQUF1QixDQUFDLFNBQVMsQ0FBQztZQUMxRCxXQUFXLEVBQUUsSUFBSSxDQUFDLGdCQUFnQixDQUFDLE9BQU87WUFDMUMsYUFBYSxFQUFFO2dCQUNiLGVBQWUsRUFBRSxNQUFNO2dCQUN2QixPQUFPLEVBQUU7b0JBQ1A7d0JBQ0UsUUFBUSxFQUFFLE1BQU07d0JBQ2hCLFVBQVUsRUFBRTs0QkFDVjtnQ0FDRSxlQUFlLEVBQUU7b0NBQ2YsTUFBTSxFQUFFLE9BQU87aUNBQ2hCOzZCQUNGO3lCQUNGO3dCQUNELFdBQVcsRUFBRSxXQUFXO3FCQUN6QjtpQkFDRjthQUNGO1NBQ0YsQ0FDRixDQUFDO1FBRUYsNEVBQTRFO1FBQzVFLFlBQVksQ0FBQyxJQUFJLENBQUMsYUFBYSxDQUFDLHVCQUF1QixDQUFDLENBQUM7SUFDM0QsQ0FBQztDQUNGO0FBNVNELGtDQTRTQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7XG4gIER1cmF0aW9uLFxuICBSZW1vdmFsUG9saWN5LFxuICBTdGFjayxcbiAgQ2ZuT3V0cHV0LFxuICBhd3NfczMgYXMgczMsXG4gIGF3c193YWZ2MiBhcyB3YWZ2Mixcbn0gZnJvbSBcImF3cy1jZGstbGliXCI7XG5pbXBvcnQgKiBhcyBhY20gZnJvbSBcImF3cy1jZGstbGliL2F3cy1jZXJ0aWZpY2F0ZW1hbmFnZXJcIjtcbmltcG9ydCAqIGFzIHJvdXRlNTMgZnJvbSBcImF3cy1jZGstbGliL2F3cy1yb3V0ZTUzXCI7XG5pbXBvcnQgdHlwZSB7IENvbnN0cnVjdCB9IGZyb20gXCJjb25zdHJ1Y3RzXCI7XG5pbXBvcnQgdHlwZSB7IEdsb2JhbFN0YWNrUHJvcHMgfSBmcm9tIFwiLi4vdHlwZXMvcGFyYW1zXCI7XG5cbmV4cG9ydCBjbGFzcyBHbG9iYWxTdGFjayBleHRlbmRzIFN0YWNrIHtcbiAgcHVibGljIHJlYWRvbmx5IGNsb3VkRnJvbnRUZW5hbnRDZXJ0aWZpY2F0ZXM6IFJlY29yZDxzdHJpbmcsIGFjbS5JQ2VydGlmaWNhdGU+ID0ge307XG4gIHB1YmxpYyByZWFkb25seSBjbG91ZEZyb250V2ViQWNsOiB3YWZ2Mi5DZm5XZWJBQ0w7XG5cbiAgY29uc3RydWN0b3Ioc2NvcGU6IENvbnN0cnVjdCwgaWQ6IHN0cmluZywgcHJvcHM6IEdsb2JhbFN0YWNrUHJvcHMpIHtcbiAgICBzdXBlcihzY29wZSwgaWQsIHByb3BzKTtcblxuICAgIC8vIOODnuODq+ODgeODieODoeOCpOODs+WvvuW/nOOBrkROU+aknOiovOeUqOODm+OCueODiOOCvuODvOODs+ODnuODg+ODlOODs+OCsFxuICAgIGNvbnN0IGhvc3RlZFpvbmVNYXA6IFJlY29yZDxzdHJpbmcsIHJvdXRlNTMuSUhvc3RlZFpvbmU+ID0ge307XG5cbiAgICAvLyDlkITjg4bjg4rjg7Pjg4jjga7jg5vjgrnjg4jjgr7jg7zjg7PjgpLjg57jg4Pjg5Tjg7PjgrBcbiAgICBmb3IgKGNvbnN0IHRlbmFudCBvZiBwcm9wcy50ZW5hbnRzKSB7XG4gICAgICBob3N0ZWRab25lTWFwW3RlbmFudC5hcHBEb21haW5OYW1lXSA9XG4gICAgICAgIHJvdXRlNTMuSG9zdGVkWm9uZS5mcm9tSG9zdGVkWm9uZUF0dHJpYnV0ZXMoXG4gICAgICAgICAgdGhpcyxcbiAgICAgICAgICBgSG9zdGVkWm9uZS0ke3RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCBcIi1cIil9YCxcbiAgICAgICAgICB7XG4gICAgICAgICAgICBob3N0ZWRab25lSWQ6IHRlbmFudC5yb3V0ZTUzSG9zdGVkWm9uZUlkLFxuICAgICAgICAgICAgem9uZU5hbWU6IHRlbmFudC5hcHBEb21haW5OYW1lLFxuICAgICAgICAgIH0sXG4gICAgICAgICk7XG4gICAgfVxuXG4gICAgLy8g44OH44Oi44OG44OK44Oz44OI55So44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444KS5L2c5oiQXG4gICAgY29uc3QgZGVtb1RlbmFudHMgPSBwcm9wcy50ZW5hbnRzLmZpbHRlcih0ZW5hbnQgPT4gdGVuYW50LmlzRGVtbyk7XG4gICAgbGV0IHdpbGRjYXJkQ2VydGlmaWNhdGU6IGFjbS5JQ2VydGlmaWNhdGUgfCB1bmRlZmluZWQ7XG4gICAgXG4gICAgaWYgKGRlbW9UZW5hbnRzLmxlbmd0aCA+IDApIHtcbiAgICAgIC8vIOODh+ODouODhuODiuODs+ODiOeUqOOBruODmeODvOOCueODieODoeOCpOODs+OCkuWLleeahOOBq+WPluW+l1xuICAgICAgY29uc3QgZmlyc3REZW1vVGVuYW50ID0gZGVtb1RlbmFudHNbMF07XG4gICAgICBjb25zdCBkZW1vQmFzZURvbWFpbiA9IGZpcnN0RGVtb1RlbmFudC5hcHBEb21haW5OYW1lLnNwbGl0KCcuJykuc2xpY2UoMSkuam9pbignLicpOyAvLyBkZW1vMS5tdWx0aS10ZW5hbnQuaG9nZS1hcHAuY2xpY2sg4oaSIG11bHRpLXRlbmFudC5ob2dlLWFwcC5jbGlja1xuICAgICAgY29uc3Qgd2lsZGNhcmREb21haW4gPSBgKi4ke2RlbW9CYXNlRG9tYWlufWA7XG4gICAgICBcbiAgICAgIHdpbGRjYXJkQ2VydGlmaWNhdGUgPSBuZXcgYWNtLkNlcnRpZmljYXRlKFxuICAgICAgICB0aGlzLFxuICAgICAgICBcIkNsb3VkRnJvbnRXaWxkY2FyZENlcnRpZmljYXRlXCIsXG4gICAgICAgIHtcbiAgICAgICAgICBjZXJ0aWZpY2F0ZU5hbWU6IGAke3RoaXMuc3RhY2tOYW1lfS1jbG91ZGZyb250LXdpbGRjYXJkLWNlcnRpZmljYXRlYCxcbiAgICAgICAgICBkb21haW5OYW1lOiB3aWxkY2FyZERvbWFpbixcbiAgICAgICAgICB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoXG4gICAgICAgICAgICByb3V0ZTUzLkhvc3RlZFpvbmUuZnJvbUhvc3RlZFpvbmVBdHRyaWJ1dGVzKHRoaXMsIFwiV2lsZGNhcmRIb3N0ZWRab25lXCIsIHtcbiAgICAgICAgICAgICAgaG9zdGVkWm9uZUlkOiBmaXJzdERlbW9UZW5hbnQucm91dGU1M0hvc3RlZFpvbmVJZCwgLy8g44OH44Oi44OG44OK44Oz44OI44GuSG9zdGVkWm9uZUlk44KS5L2/55SoXG4gICAgICAgICAgICAgIHpvbmVOYW1lOiBkZW1vQmFzZURvbWFpbixcbiAgICAgICAgICAgIH0pXG4gICAgICAgICAgKSxcbiAgICAgICAgfVxuICAgICAgKTtcbiAgICAgIFxuICAgICAgLy8g44Ov44Kk44Or44OJ44Kr44O844OJ6Ki85piO5pu444KS44Ko44Kv44K544Od44O844OIXG4gICAgICBuZXcgQ2ZuT3V0cHV0KHRoaXMsIFwiRnJvbnRlbmRXaWxkY2FyZENlcnRpZmljYXRlQXJuXCIsIHtcbiAgICAgICAgdmFsdWU6IHdpbGRjYXJkQ2VydGlmaWNhdGUuY2VydGlmaWNhdGVBcm4sXG4gICAgICAgIGV4cG9ydE5hbWU6IGAke3Byb3BzLmVudk5hbWV9LWZyb250ZW5kLXdpbGRjYXJkLWNlcnQtYXJuYCxcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIOODhuODiuODs+ODiOOBlOOBqOOBq0FDTeiovOaYjuabuOOCkuS9nOaIkOOBvuOBn+OBr+WJsuOCiuW9k+OBplxuICAgIGZvciAoY29uc3QgdGVuYW50IG9mIHByb3BzLnRlbmFudHMpIHtcbiAgICAgIGNvbnN0IHRlbmFudElkID0gdGVuYW50LmFwcERvbWFpbk5hbWUucmVwbGFjZSgvXFwuL2csIFwiLVwiKTtcbiAgICAgIFxuICAgICAgaWYgKHRlbmFudC5pc0RlbW8gJiYgd2lsZGNhcmRDZXJ0aWZpY2F0ZSkge1xuICAgICAgICAvLyDjg4fjg6Ljg4bjg4rjg7Pjg4jjga/jg6/jgqTjg6vjg4njgqvjg7zjg4noqLzmmI7mm7jjgpLkvb/nlKhcbiAgICAgICAgdGhpcy5jbG91ZEZyb250VGVuYW50Q2VydGlmaWNhdGVzW3RlbmFudC5hcHBEb21haW5OYW1lXSA9IHdpbGRjYXJkQ2VydGlmaWNhdGU7XG4gICAgICAgIFxuICAgICAgICAvLyDjg4fjg6Ljg4bjg4rjg7Pjg4jnlKjjga7oqLzmmI7mm7jlj4LnhafjgpLjgqjjgq/jgrnjg53jg7zjg4hcbiAgICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCBgRnJvbnRlbmRDZXJ0aWZpY2F0ZUFybi0ke3RlbmFudElkfWAsIHtcbiAgICAgICAgICB2YWx1ZTogd2lsZGNhcmRDZXJ0aWZpY2F0ZS5jZXJ0aWZpY2F0ZUFybixcbiAgICAgICAgICBleHBvcnROYW1lOiBgJHtwcm9wcy5lbnZOYW1lfS1mcm9udGVuZC1jZXJ0LWFybi0ke3RlbmFudElkfWAsXG4gICAgICAgIH0pO1xuICAgICAgfSBlbHNlIHtcbiAgICAgICAgLy8g6YCa5bi444OG44OK44Oz44OI44Gv5YCL5Yil44GrQUNN6Ki85piO5pu444KS55m66KGMXG4gICAgICAgIGNvbnN0IGNlcnRpZmljYXRlID0gbmV3IGFjbS5DZXJ0aWZpY2F0ZShcbiAgICAgICAgICB0aGlzLFxuICAgICAgICAgIGBDbG91ZEZyb250Q2VydGlmaWNhdGUtJHt0ZW5hbnRJZH1gLFxuICAgICAgICAgIHtcbiAgICAgICAgICAgIGNlcnRpZmljYXRlTmFtZTogYCR7dGhpcy5zdGFja05hbWV9LWNsb3VkZnJvbnQtY2VydGlmaWNhdGUtJHt0ZW5hbnRJZH1gLFxuICAgICAgICAgICAgZG9tYWluTmFtZTogdGVuYW50LmFwcERvbWFpbk5hbWUsXG4gICAgICAgICAgICB2YWxpZGF0aW9uOiBhY20uQ2VydGlmaWNhdGVWYWxpZGF0aW9uLmZyb21EbnMoaG9zdGVkWm9uZU1hcFt0ZW5hbnQuYXBwRG9tYWluTmFtZV0pLFxuICAgICAgICAgIH1cbiAgICAgICAgKTtcbiAgICAgICAgXG4gICAgICAgIC8vIOODhuODiuODs+ODiOODieODoeOCpOODs+OBqEFDTeiovOaYjuabuOOBruODnuODg+ODlOODs+OCsOOCkuS/neWtmFxuICAgICAgICB0aGlzLmNsb3VkRnJvbnRUZW5hbnRDZXJ0aWZpY2F0ZXNbdGVuYW50LmFwcERvbWFpbk5hbWVdID0gY2VydGlmaWNhdGU7XG4gICAgICAgIFxuICAgICAgICAvLyDjg4bjg4rjg7Pjg4jjgZTjgajjga7oqLzmmI7mm7jjgpLjgqjjgq/jgrnjg53jg7zjg4hcbiAgICAgICAgbmV3IENmbk91dHB1dCh0aGlzLCBgRnJvbnRlbmRDZXJ0aWZpY2F0ZUFybi0ke3RlbmFudElkfWAsIHtcbiAgICAgICAgICB2YWx1ZTogY2VydGlmaWNhdGUuY2VydGlmaWNhdGVBcm4sXG4gICAgICAgICAgZXhwb3J0TmFtZTogYCR7cHJvcHMuZW52TmFtZX0tZnJvbnRlbmQtY2VydC1hcm4tJHt0ZW5hbnRJZH1gLFxuICAgICAgICB9KTtcbiAgICAgIH1cbiAgICB9XG5cbiAgICAvLyBXQUbnlKjjga7jg6vjg7zjg6vphY3liJfjgpLkvZzmiJBcbiAgICBjb25zdCB3YWZSdWxlczogd2FmdjIuQ2ZuV2ViQUNMLlJ1bGVQcm9wZXJ0eVtdID0gW1xuICAgICAgLy8gQVdT44Oe44ON44O844K444OJ44Or44O844Or77yI5YSq5YWI5bqmMTog5pyA5Yid44Gr6KmV5L6h77yJXG4gICAgICB7XG4gICAgICAgIG5hbWU6IFwiQ29tbW9uU2VjdXJpdHlQcm90ZWN0aW9uXCIsXG4gICAgICAgIHByaW9yaXR5OiAxLFxuICAgICAgICBvdmVycmlkZUFjdGlvbjogeyBub25lOiB7fSB9LFxuICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICBtYW5hZ2VkUnVsZUdyb3VwU3RhdGVtZW50OiB7XG4gICAgICAgICAgICBuYW1lOiBcIkFXU01hbmFnZWRSdWxlc0NvbW1vblJ1bGVTZXRcIixcbiAgICAgICAgICAgIHZlbmRvck5hbWU6IFwiQVdTXCIsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSxcbiAgICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICAgIG1ldHJpY05hbWU6IFwiQ29tbW9uU2VjdXJpdHlQcm90ZWN0aW9uXCIsXG4gICAgICAgICAgY2xvdWRXYXRjaE1ldHJpY3NFbmFibGVkOiB0cnVlLFxuICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgIF07XG5cbiAgICAvLyDjg4bjg4rjg7Pjg4jjgZTjgajjga7jg6vjg7zjg6vjgpLov73liqBcbiAgICBwcm9wcy50ZW5hbnRzLmZvckVhY2goKHRlbmFudCwgaW5kZXgpID0+IHtcbiAgICAgIC8vIOODhuODiuODs+ODiOOBlOOBqOOBq+WEquWFiOW6puOBrjEw44Gu5L2N44KS5aSJ44GI44KL77yI44OG44OK44Oz44OIQeOBrzEw5Y+w44CB44OG44OK44Oz44OIQuOBrzIw5Y+wLi4u77yJXG4gICAgICBjb25zdCB0ZW5hbnRCYXNlUHJpb3JpdHkgPSAxMCAqIChpbmRleCArIDEpO1xuICAgICAgbGV0IHRlbmFudFByaW9yaXR5ID0gMDsgLy8g44OG44OK44Oz44OI5YaF44Gn44Gu5YSq5YWI5bqm44Kr44Km44Oz44K/44O8XG5cbiAgICAgIC8vIDHjgaTnm67jga7jg6vjg7zjg6vvvIjoqLHlj6/jg5Hjgrnjg6vjg7zjg6vvvIlcbiAgICAgIGlmICh0ZW5hbnQuaXBSZXN0cmljdGlvbkV4Y2x1ZGVkUGF0aHMgJiYgdGVuYW50LmlwUmVzdHJpY3Rpb25FeGNsdWRlZFBhdGhzLmxlbmd0aCA+IDApIHtcbiAgICAgICAgd2FmUnVsZXMucHVzaCh7XG4gICAgICAgICAgbmFtZTogYEFsbG93ZWRQYXRocy0ke3RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCAnLScpfWAsXG4gICAgICAgICAgcHJpb3JpdHk6IHRlbmFudEJhc2VQcmlvcml0eSwgLy8gMTAsIDIwLCAzMC4uLlxuICAgICAgICAgIGFjdGlvbjogeyBhbGxvdzoge30gfSxcbiAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIGFuZFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgLy8g54m55a6a44Gu44OJ44Oh44Kk44Oz44G444Gu44Oq44Kv44Ko44K544OI44KS6K2Y5YilXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgYnl0ZU1hdGNoU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkVG9NYXRjaDoge1xuICAgICAgICAgICAgICAgICAgICAgIHNpbmdsZUhlYWRlcjogeyBOYW1lOiBcImhvc3RcIiB9XG4gICAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgICAgIHBvc2l0aW9uYWxDb25zdHJhaW50OiBcIkVYQUNUTFlcIixcbiAgICAgICAgICAgICAgICAgICAgc2VhcmNoU3RyaW5nOiB0ZW5hbnQuYXBwRG9tYWluTmFtZSxcbiAgICAgICAgICAgICAgICAgICAgdGV4dFRyYW5zZm9ybWF0aW9uczogW3sgcHJpb3JpdHk6IDAsIHR5cGU6IFwiTk9ORVwiIH1dXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAvLyDjg5HjgrnmnaHku7ZcbiAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICBvclN0YXRlbWVudDoge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiB0ZW5hbnQuaXBSZXN0cmljdGlvbkV4Y2x1ZGVkUGF0aHMubWFwKHBhdGggPT4gKHtcbiAgICAgICAgICAgICAgICAgICAgICBieXRlTWF0Y2hTdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICAgIGZpZWxkVG9NYXRjaDogeyB1cmlQYXRoOiB7fSB9LFxuICAgICAgICAgICAgICAgICAgICAgICAgcG9zaXRpb25hbENvbnN0cmFpbnQ6IFwiU1RBUlRTX1dJVEhcIixcbiAgICAgICAgICAgICAgICAgICAgICAgIHNlYXJjaFN0cmluZzogcGF0aCxcbiAgICAgICAgICAgICAgICAgICAgICAgIHRleHRUcmFuc2Zvcm1hdGlvbnM6IFt7IHByaW9yaXR5OiAwLCB0eXBlOiBcIk5PTkVcIiB9XVxuICAgICAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICAgICAgfSkpXG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBgQWxsb3dlZFBhdGhzLSR7dGVuYW50LmFwcERvbWFpbk5hbWUucmVwbGFjZSgvXFwuL2csICctJyl9YCxcbiAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG5cbiAgICAgIC8vIDLjgaTnm67ku6XpmY3jga7jg6vjg7zjg6vvvIhJUOWItumZkOODq+ODvOODq+OBquOBqe+8iVxuICAgICAgaWYgKHRlbmFudC5hbGxvd2VkSXBBZGRyZXNzZXMgJiYgdGVuYW50LmFsbG93ZWRJcEFkZHJlc3Nlcy5sZW5ndGggPiAwKSB7XG4gICAgICAgIC8vIElQ44K744OD44OI44KS55u05o6l5L2c5oiQXG4gICAgICAgIGNvbnN0IGlwU2V0ID0gbmV3IHdhZnYyLkNmbklQU2V0KFxuICAgICAgICAgIHRoaXMsXG4gICAgICAgICAgYEFsbG93ZWRJcFNldC0ke3RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCAnLScpfWAsXG4gICAgICAgICAge1xuICAgICAgICAgICAgc2NvcGU6IFwiQ0xPVURGUk9OVFwiLFxuICAgICAgICAgICAgaXBBZGRyZXNzVmVyc2lvbjogXCJJUFY0XCIsXG4gICAgICAgICAgICBhZGRyZXNzZXM6IHRlbmFudC5hbGxvd2VkSXBBZGRyZXNzZXMsXG4gICAgICAgICAgfVxuICAgICAgICApO1xuXG4gICAgICAgIHdhZlJ1bGVzLnB1c2goe1xuICAgICAgICAgIG5hbWU6IGBJUFJlc3RyaWN0aW9uLSR7dGVuYW50LmFwcERvbWFpbk5hbWUucmVwbGFjZSgvXFwuL2csICctJyl9YCxcbiAgICAgICAgICBwcmlvcml0eTogdGVuYW50QmFzZVByaW9yaXR5ICsgKyt0ZW5hbnRQcmlvcml0eSwgLy8gMTEsIDIxLCAzMS4uLlxuICAgICAgICAgIGFjdGlvbjogeyBcbiAgICAgICAgICAgIGJsb2NrOiB7IFxuICAgICAgICAgICAgICAvLyBXQUbjg5bjg63jg4Pjgq/mmYLjga80MDPjgafjga/jgarjgY80MDTjgpLov5TjgZnjgojjgYbjgavjgZfjgabjgYTjgb7jgZlcbiAgICAgICAgICAgICAgLy8gTk9URTpcbiAgICAgICAgICAgICAgLy8gV0FG44OW44Ot44OD44Kv5pmC44Gr44OH44OV44Kp44Or44OI44GuNDAz44Ko44Op44O844KS55m655Sf44GV44Gb44KL44Go44CBXG4gICAgICAgICAgICAgIC8vIENsb3VkRnJvbnTlgbTjga5lcnJvclJlc3BvbnNlc+ioreWumuOBq+OCiOOCiuOAgeOCueODhuODvOOCv+OCueOCs+ODvOODiTIwMOOBp1wiL1wi44Gr6Lui6YCB44GV44KM44G+44GZ44CCXG4gICAgICAgICAgICAgIC8vIOOBk+OBruaMmeWLleOBq+OCiOOCiuS7peS4i+OBruS6i+ixoeOBjOeZuueUn+OBl+OBvuOBmTpcbiAgICAgICAgICAgICAgLy9cbiAgICAgICAgICAgICAgLy8gLSDoqLHlj69JUOS7peWkluOBruS8gealreODpuODvOOCtuODvOOBjOODreOCsOOCpOODs+eUu+mdolwiL2xvZ2luXCLjgavjgqLjgq/jgrvjgrnjgZfjgIHjg63jgrDjgqTjg7PmiJDlip/jgIJcbiAgICAgICAgICAgICAgLy8gLSDmnJ/lvoXlgKQ6IOODreOCsOOCpOODs+aIkOWKn+W+jOOBq1dBRuODluODreODg+OCr+OBleOCjOOCi++8iOODreOCsOOCpOODs+W+jOOBq+mBt+enu+OBmeOCi+ODiOODg+ODl+ODmuODvOOCuFwiL1wi44GvSVDliLbpmZDlr77osaHjga7jgZ/jgoHvvIlcbiAgICAgICAgICAgICAgLy8gLSDlrp/pmps6IOODreOCsOOCpOODs+aIkOWKnyDihpIgV0FG44OW44Ot44OD44KvIOKGkiA0MDPjgqjjg6njg7wg4oaSIDIwMOOBp1wiL1wi44Gr6Lui6YCBIOKGkiBfbnV4dOOBjOiqreOBv+i+vOOBvuOCjOOCi+OBi+OCieOBi+WVj+mhjOOBquOBj+ODiOODg+ODl+ODmuODvOOCuOOBjOmWi+OBkeOBpuOBl+OBvuOBhiDihpIg5pu044Gr44OI44OD44OX44Oa44O844K444Gu44Oh44OL44Ol44O844GL44KJ5LuW44Gu44Oa44O844K444Gr44KC6YG356e744Gn44GN44Gm44GX44G+44GG44CCXG4gICAgICAgICAgICAgIGN1c3RvbVJlc3BvbnNlOiB7XG4gICAgICAgICAgICAgICAgcmVzcG9uc2VDb2RlOiA0MDQsXG4gICAgICAgICAgICAgICAgcmVzcG9uc2VIZWFkZXJzOiBbXG4gICAgICAgICAgICAgICAgICB7XG4gICAgICAgICAgICAgICAgICAgIG5hbWU6IFwieC13YWYtYmxvY2tlZFwiLFxuICAgICAgICAgICAgICAgICAgICB2YWx1ZTogXCJ0cnVlXCJcbiAgICAgICAgICAgICAgICAgIH1cbiAgICAgICAgICAgICAgICBdXG4gICAgICAgICAgICAgIH0gXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgIGFuZFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICBzdGF0ZW1lbnRzOiBbXG4gICAgICAgICAgICAgICAgLy8g54m55a6a44Gu44OJ44Oh44Kk44Oz44G444Gu44Oq44Kv44Ko44K544OI44KS6K2Y5YilXG4gICAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgICAgYnl0ZU1hdGNoU3RhdGVtZW50OiB7XG4gICAgICAgICAgICAgICAgICAgIGZpZWxkVG9NYXRjaDoge1xuICAgICAgICAgICAgICAgICAgICAgIHNpbmdsZUhlYWRlcjogeyBOYW1lOiBcImhvc3RcIiB9LFxuICAgICAgICAgICAgICAgICAgICB9LFxuICAgICAgICAgICAgICAgICAgICBwb3NpdGlvbmFsQ29uc3RyYWludDogXCJFWEFDVExZXCIsXG4gICAgICAgICAgICAgICAgICAgIHNlYXJjaFN0cmluZzogdGVuYW50LmFwcERvbWFpbk5hbWUsXG4gICAgICAgICAgICAgICAgICAgIHRleHRUcmFuc2Zvcm1hdGlvbnM6IFt7IHByaW9yaXR5OiAwLCB0eXBlOiBcIk5PTkVcIiB9XSxcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgICAvLyDoqLHlj69JUOODquOCueODiOS7peWkluOBi+OCieOBruOCouOCr+OCu+OCueOCkuWItumZkFxuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIG5vdFN0YXRlbWVudDoge1xuICAgICAgICAgICAgICAgICAgICBzdGF0ZW1lbnQ6IHtcbiAgICAgICAgICAgICAgICAgICAgICBpcFNldFJlZmVyZW5jZVN0YXRlbWVudDoge1xuICAgICAgICAgICAgICAgICAgICAgICAgYXJuOiBpcFNldC5hdHRyQXJuXG4gICAgICAgICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgICB9XG4gICAgICAgICAgICAgICAgfVxuICAgICAgICAgICAgICBdXG4gICAgICAgICAgICB9XG4gICAgICAgICAgfSxcbiAgICAgICAgICB2aXNpYmlsaXR5Q29uZmlnOiB7XG4gICAgICAgICAgICBtZXRyaWNOYW1lOiBgSVBSZXN0cmljdGlvbi0ke3RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCBcIi1cIil9YCxcbiAgICAgICAgICAgIGNsb3VkV2F0Y2hNZXRyaWNzRW5hYmxlZDogdHJ1ZSxcbiAgICAgICAgICAgIHNhbXBsZWRSZXF1ZXN0c0VuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgfSxcbiAgICAgICAgfSk7XG4gICAgICB9XG4gICAgfSk7XG5cbiAgICAvLyBDbG91ZEZyb25055SoV0FGIFdlYkFDTFxuICAgIHRoaXMuY2xvdWRGcm9udFdlYkFjbCA9IG5ldyB3YWZ2Mi5DZm5XZWJBQ0wodGhpcywgXCJDbG91ZEZyb250V2ViQUNMXCIsIHtcbiAgICAgIGRlZmF1bHRBY3Rpb246IHsgYWxsb3c6IHt9IH0sIC8vIOODh+ODleOCqeODq+ODiOOBr+ioseWPr1xuICAgICAgc2NvcGU6IFwiQ0xPVURGUk9OVFwiLFxuICAgICAgdmlzaWJpbGl0eUNvbmZpZzoge1xuICAgICAgICBjbG91ZFdhdGNoTWV0cmljc0VuYWJsZWQ6IHRydWUsXG4gICAgICAgIG1ldHJpY05hbWU6IFwiQ2xvdWRGcm9udFdlYkFDTFwiLFxuICAgICAgICBzYW1wbGVkUmVxdWVzdHNFbmFibGVkOiB0cnVlLFxuICAgICAgfSxcbiAgICAgIHJ1bGVzOiB3YWZSdWxlcyxcbiAgICB9KTtcblxuICAgIC8vIFdBRueUqOODreOCsOODkOOCseODg+ODiFxuICAgIGNvbnN0IGNsb3VkRnJvbnRXYWZMb2dzQnVja2V0ID0gbmV3IHMzLkJ1Y2tldChcbiAgICAgIHRoaXMsXG4gICAgICBcIkNsb3VkRnJvbnRXYWZMb2dzQnVja2V0XCIsXG4gICAgICB7XG4gICAgICAgIC8vIFdBRuOBruODreOCsOOBr1wiYXdzLXdhZi1sb2dzLVwi44Gn5aeL44G+44KL44OQ44Kx44OD44OI5ZCN44Gr44GZ44KL5b+F6KaB44GM44GC44KLXG4gICAgICAgIGJ1Y2tldE5hbWU6IGBhd3Mtd2FmLWxvZ3MtJHtwcm9wcy5lbnZOYW1lfS0ke3RoaXMuYWNjb3VudH0tJHt0aGlzLmNsb3VkRnJvbnRXZWJBY2wubm9kZS5pZC50b0xvd2VyQ2FzZSgpfWAsXG4gICAgICAgIHZlcnNpb25lZDogZmFsc2UsXG4gICAgICAgIGxpZmVjeWNsZVJ1bGVzOiBbXG4gICAgICAgICAge1xuICAgICAgICAgICAgaWQ6IFwiY2xvdWRmcm9udC13YWYtbG9nLWV4cGlyYXRpb25cIixcbiAgICAgICAgICAgIGVuYWJsZWQ6IHRydWUsXG4gICAgICAgICAgICBleHBpcmF0aW9uOiBEdXJhdGlvbi5kYXlzKHByb3BzPy5sb2dSZXRlbnRpb25EYXlzID8/IDkwKSxcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgICBibG9ja1B1YmxpY0FjY2VzczogczMuQmxvY2tQdWJsaWNBY2Nlc3MuQkxPQ0tfQUxMLFxuICAgICAgICBlbmNyeXB0aW9uOiBzMy5CdWNrZXRFbmNyeXB0aW9uLlMzX01BTkFHRUQsXG4gICAgICAgIGVuZm9yY2VTU0w6IHRydWUsXG4gICAgICAgIHJlbW92YWxQb2xpY3k6IFJlbW92YWxQb2xpY3kuREVTVFJPWSxcbiAgICAgICAgYXV0b0RlbGV0ZU9iamVjdHM6IHRydWUsXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyBXQUbjg63jgrDlh7rlipvoqK3lrprvvIhCbG9ja+OBl+OBn+ODquOCr+OCqOOCueODiOOBruOBv+ODreOCsOWHuuWKm++8iVxuICAgIGNvbnN0IHdhZkxvZ0NvbmZpZyA9IG5ldyB3YWZ2Mi5DZm5Mb2dnaW5nQ29uZmlndXJhdGlvbihcbiAgICAgIHRoaXMsXG4gICAgICBcIkNsb3VkRnJvbnRXYWZMb2dDb25maWdcIixcbiAgICAgIHtcbiAgICAgICAgbG9nRGVzdGluYXRpb25Db25maWdzOiBbY2xvdWRGcm9udFdhZkxvZ3NCdWNrZXQuYnVja2V0QXJuXSxcbiAgICAgICAgcmVzb3VyY2VBcm46IHRoaXMuY2xvdWRGcm9udFdlYkFjbC5hdHRyQXJuLFxuICAgICAgICBsb2dnaW5nRmlsdGVyOiB7XG4gICAgICAgICAgRGVmYXVsdEJlaGF2aW9yOiBcIkRST1BcIixcbiAgICAgICAgICBGaWx0ZXJzOiBbXG4gICAgICAgICAgICB7XG4gICAgICAgICAgICAgIEJlaGF2aW9yOiBcIktFRVBcIixcbiAgICAgICAgICAgICAgQ29uZGl0aW9uczogW1xuICAgICAgICAgICAgICAgIHtcbiAgICAgICAgICAgICAgICAgIEFjdGlvbkNvbmRpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgICBBY3Rpb246IFwiQkxPQ0tcIixcbiAgICAgICAgICAgICAgICAgIH0sXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgXSxcbiAgICAgICAgICAgICAgUmVxdWlyZW1lbnQ6IFwiTUVFVFNfQUxMXCIsXG4gICAgICAgICAgICB9LFxuICAgICAgICAgIF0sXG4gICAgICAgIH0sXG4gICAgICB9LFxuICAgICk7XG5cbiAgICAvLyDjg63jgrDjg5DjgrHjg4Pjg4jjga7kvZzmiJDjgYzlrozkuobjgZfjgabjgYvjgolXQUbjg63jgrDlh7rlipvoqK3lrprjgpLkvZzmiJDjgZnjgovvvIjjgafjgarjgYTjgajjg5DjgrHjg4Pjg4jjg53jg6rjgrfjg7zplqLpgKPjga7jgqjjg6njg7zjgYznmbrnlJ/jgZfjgabjgrnjgr/jg4Pjgq/jg4fjg5fjg63jgqTjgavlpLHmlZfjgZnjgovjgZPjgajjgYzjgYLjgovvvIlcbiAgICB3YWZMb2dDb25maWcubm9kZS5hZGREZXBlbmRlbmN5KGNsb3VkRnJvbnRXYWZMb2dzQnVja2V0KTtcbiAgfVxufVxuIl19