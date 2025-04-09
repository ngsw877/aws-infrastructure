import { App } from "aws-cdk-lib";
import { Match, Template } from "aws-cdk-lib/assertions";
import { GlobalStack } from "../lib/global-stack";
import { params } from "../params/dev";

// アプリケーションとスタックの生成
const app = new App();
const stack = new GlobalStack(app, "TestGlobalStack", params.globalStackProps);
const template = Template.fromStack(stack);

describe("GlobalStack", () => {
  // IP制限があるテナントを特定
  const tenantsWithIpAddresses = params.globalStackProps.tenants.filter(
    (tenant) =>
      tenant.allowedIpAddresses && tenant.allowedIpAddresses.length > 0,
  );

  test("必要なリソースが作成される", () => {
    // ACM証明書は1つだけ作成される
    template.resourceCountIs("AWS::CertificateManager::Certificate", 1);

    // WebACLは1つだけ作成される
    template.resourceCountIs("AWS::WAFv2::WebACL", 1);

    // WAFログ用のS3バケットは1つだけ作成される
    template.resourceCountIs("AWS::S3::Bucket", 1);

    // ログ設定も1つだけ作成される
    template.resourceCountIs("AWS::WAFv2::LoggingConfiguration", 1);
  });

  test("ACM証明書にプライマリドメインと代替ドメインが正しく設定されている", () => {
    // プライマリドメインとSANドメインが正しく設定されていることを確認
    const primaryDomain = params.globalStackProps.tenants[0].appDomainName;
    const alternativeDomains = params.globalStackProps.tenants
      .slice(1)
      .map((tenant) => tenant.appDomainName);

    template.hasResourceProperties("AWS::CertificateManager::Certificate", {
      DomainName: primaryDomain,
      SubjectAlternativeNames: alternativeDomains,
      ValidationMethod: "DNS",
    });
  });

  test("テナントごとのIP制限が正しく設定されている", () => {
    // 各テナントのIPSetがあることを確認
    for (const tenant of tenantsWithIpAddresses) {
      template.hasResourceProperties("AWS::WAFv2::IPSet", {
        Addresses: tenant.allowedIpAddresses,
        Scope: "CLOUDFRONT",
      });
    }

    // WAF WebACLに各テナントのIP制限ルールが含まれていることを確認
    for (const tenant of tenantsWithIpAddresses) {
      const ruleName = `IPRestriction-${tenant.appDomainName.replace(/\./g, "-")}`;

      template.hasResourceProperties("AWS::WAFv2::WebACL", {
        Rules: Match.arrayWith([
          Match.objectLike({
            Name: ruleName,
            Action: { Block: {} },
          }),
        ]),
      });
    }
  });

  test("IP制限の除外パスが正しく適用されている", () => {
    // テストの前提条件：IP制限除外パスが設定されていること
    if (
      !params.globalStackProps.ipRestrictionExcludedPaths ||
      params.globalStackProps.ipRestrictionExcludedPaths.length === 0
    ) {
      console.warn(
        "テスト対象のプロパティ ipRestrictionExcludedPaths が設定されていません",
      );
      return;
    }

    if (tenantsWithIpAddresses.length === 0) {
      console.warn(
        "IP制限を設定しているテナントが存在しないため、除外パスのテストをスキップします",
      );
      return;
    }

    // 各テナントのIP制限ルールに対して、除外パスが正しく設定されていることを確認
    for (const tenant of tenantsWithIpAddresses) {
      const ruleName = `IPRestriction-${tenant.appDomainName.replace(/\./g, "-")}`;

      // 各除外パスについて検証
      for (const path of params.globalStackProps.ipRestrictionExcludedPaths) {
        template.hasResourceProperties("AWS::WAFv2::WebACL", {
          Rules: Match.arrayWith([
            Match.objectLike({
              Name: ruleName,
              Statement: Match.objectLike({
                AndStatement: Match.objectLike({
                  Statements: Match.arrayWith([
                    Match.objectLike({
                      NotStatement: Match.objectLike({
                        Statement: Match.objectLike({
                          OrStatement: Match.objectLike({
                            Statements: Match.arrayWith([
                              Match.objectLike({
                                ByteMatchStatement: Match.objectLike({
                                  SearchString: path,
                                  PositionalConstraint: "STARTS_WITH",
                                }),
                              }),
                            ]),
                          }),
                        }),
                      }),
                    }),
                  ]),
                }),
              }),
            }),
          ]),
        });
      }
    }
  });

  test("WAFログバケットは適切な名前形式とセキュリティ設定を持つ", () => {
    template.hasResourceProperties("AWS::S3::Bucket", {
      BucketName: Match.stringLikeRegexp("^aws-waf-logs-.*"),
      PublicAccessBlockConfiguration: {
        BlockPublicAcls: true,
        BlockPublicPolicy: true,
        IgnorePublicAcls: true,
        RestrictPublicBuckets: true,
      },
      BucketEncryption: {
        ServerSideEncryptionConfiguration: [
          {
            ServerSideEncryptionByDefault: {
              SSEAlgorithm: "AES256",
            },
          },
        ],
      },
    });
  });

  test("WAFログ設定はブロックされたリクエストのみを記録する", () => {
    template.hasResourceProperties("AWS::WAFv2::LoggingConfiguration", {
      LoggingFilter: {
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
  });
});
