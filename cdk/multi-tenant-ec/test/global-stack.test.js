"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const aws_cdk_lib_1 = require("aws-cdk-lib");
const assertions_1 = require("aws-cdk-lib/assertions");
const global_stack_1 = require("../lib/global-stack");
const dev_1 = require("../params/dev");
// アプリケーションとスタックの生成
const app = new aws_cdk_lib_1.App();
const stack = new global_stack_1.GlobalStack(app, "TestGlobalStack", dev_1.params.globalStackProps);
const template = assertions_1.Template.fromStack(stack);
describe("GlobalStack", () => {
    // IP制限があるテナントを特定
    const tenantsWithIpAddresses = dev_1.params.globalStackProps.tenants.filter((tenant) => tenant.allowedIpAddresses && tenant.allowedIpAddresses.length > 0);
    test("各リソースの個数が正しいこと", () => {
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
        const primaryDomain = dev_1.params.globalStackProps.tenants[0].appDomainName;
        const alternativeDomains = dev_1.params.globalStackProps.tenants
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
                Rules: assertions_1.Match.arrayWith([
                    assertions_1.Match.objectLike({
                        Name: ruleName,
                        Action: { Block: {} },
                    }),
                ]),
            });
        }
    });
    test("IP制限の除外パスが正しく適用されている", () => {
        // テストの前提条件：IP制限除外パスが設定されていること
        if (!dev_1.params.globalStackProps.ipRestrictionExcludedPaths ||
            dev_1.params.globalStackProps.ipRestrictionExcludedPaths.length === 0) {
            console.warn("テスト対象のプロパティ ipRestrictionExcludedPaths が設定されていません");
            return;
        }
        if (tenantsWithIpAddresses.length === 0) {
            console.warn("IP制限を設定しているテナントが存在しないため、除外パスのテストをスキップします");
            return;
        }
        // 各テナントのIP制限ルールに対して、除外パスが正しく設定されていることを確認
        for (const tenant of tenantsWithIpAddresses) {
            const ruleName = `IPRestriction-${tenant.appDomainName.replace(/\./g, "-")}`;
            // 各除外パスについて検証
            for (const path of dev_1.params.globalStackProps.ipRestrictionExcludedPaths) {
                template.hasResourceProperties("AWS::WAFv2::WebACL", {
                    Rules: assertions_1.Match.arrayWith([
                        assertions_1.Match.objectLike({
                            Name: ruleName,
                            Statement: assertions_1.Match.objectLike({
                                AndStatement: assertions_1.Match.objectLike({
                                    Statements: assertions_1.Match.arrayWith([
                                        assertions_1.Match.objectLike({
                                            NotStatement: assertions_1.Match.objectLike({
                                                Statement: assertions_1.Match.objectLike({
                                                    OrStatement: assertions_1.Match.objectLike({
                                                        Statements: assertions_1.Match.arrayWith([
                                                            assertions_1.Match.objectLike({
                                                                ByteMatchStatement: assertions_1.Match.objectLike({
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
            BucketName: assertions_1.Match.stringLikeRegexp("^aws-waf-logs-.*"),
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
//# sourceMappingURL=data:application/json;base64,eyJ2ZXJzaW9uIjozLCJmaWxlIjoiZ2xvYmFsLXN0YWNrLnRlc3QuanMiLCJzb3VyY2VSb290IjoiIiwic291cmNlcyI6WyJnbG9iYWwtc3RhY2sudGVzdC50cyJdLCJuYW1lcyI6W10sIm1hcHBpbmdzIjoiOztBQUFBLDZDQUFrQztBQUNsQyx1REFBeUQ7QUFDekQsc0RBQWtEO0FBQ2xELHVDQUF1QztBQUV2QyxtQkFBbUI7QUFDbkIsTUFBTSxHQUFHLEdBQUcsSUFBSSxpQkFBRyxFQUFFLENBQUM7QUFDdEIsTUFBTSxLQUFLLEdBQUcsSUFBSSwwQkFBVyxDQUFDLEdBQUcsRUFBRSxpQkFBaUIsRUFBRSxZQUFNLENBQUMsZ0JBQWdCLENBQUMsQ0FBQztBQUMvRSxNQUFNLFFBQVEsR0FBRyxxQkFBUSxDQUFDLFNBQVMsQ0FBQyxLQUFLLENBQUMsQ0FBQztBQUUzQyxRQUFRLENBQUMsYUFBYSxFQUFFLEdBQUcsRUFBRTtJQUMzQixpQkFBaUI7SUFDakIsTUFBTSxzQkFBc0IsR0FBRyxZQUFNLENBQUMsZ0JBQWdCLENBQUMsT0FBTyxDQUFDLE1BQU0sQ0FDbkUsQ0FBQyxNQUFNLEVBQUUsRUFBRSxDQUNULE1BQU0sQ0FBQyxrQkFBa0IsSUFBSSxNQUFNLENBQUMsa0JBQWtCLENBQUMsTUFBTSxHQUFHLENBQUMsQ0FDcEUsQ0FBQztJQUVGLElBQUksQ0FBQyxnQkFBZ0IsRUFBRSxHQUFHLEVBQUU7UUFDMUIsbUJBQW1CO1FBQ25CLFFBQVEsQ0FBQyxlQUFlLENBQUMsc0NBQXNDLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFcEUsbUJBQW1CO1FBQ25CLFFBQVEsQ0FBQyxlQUFlLENBQUMsb0JBQW9CLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFbEQsMEJBQTBCO1FBQzFCLFFBQVEsQ0FBQyxlQUFlLENBQUMsaUJBQWlCLEVBQUUsQ0FBQyxDQUFDLENBQUM7UUFFL0MsaUJBQWlCO1FBQ2pCLFFBQVEsQ0FBQyxlQUFlLENBQUMsa0NBQWtDLEVBQUUsQ0FBQyxDQUFDLENBQUM7SUFDbEUsQ0FBQyxDQUFDLENBQUM7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QUcsRUFBRTtRQUN2QyxRQUFRLENBQUMscUJBQXFCLENBQUMsa0NBQWtDLEVBQUU7WUFDakUsYUFBYSxFQUFFO2dCQUNiLGVBQWUsRUFBRSxNQUFNO2dCQUN2QixPQUFPLEVBQUU7b0JBQ1A7d0JBQ0UsUUFBUSxFQUFFLE1BQU07d0JBQ2hCLFVBQVUsRUFBRTs0QkFDVjtnQ0FDRSxlQUFlLEVBQUU7b0NBQ2YsTUFBTSxFQUFFLE9BQU87aUNBQ2hCOzZCQUNGO3lCQUNGO3dCQUNELFdBQVcsRUFBRSxXQUFXO3FCQUN6QjtpQkFDRjthQUNGO1NBQ0YsQ0FBQyxDQUFDO0lBQ0wsQ0FBQyxDQUFDLENBQUM7QUFDTCxDQUFDLENBQUMsQ0FBQyIsInNvdXJjZXNDb250ZW50IjpbImltcG9ydCB7IEFwcCB9IGZyb20gXCJhd3MtY2RrLWxpYlwiO1xuaW1wb3J0IHsgTWF0Y2gsIFRlbXBsYXRlIH0gZnJvbSBcImF3cy1jZGstbGliL2Fzc2VydGlvbnNcIjtcbmltcG9ydCB7IEdsb2JhbFN0YWNrIH0gZnJvbSBcIi4uL2xpYi9nbG9iYWwtc3RhY2tcIjtcbmltcG9ydCB7IHBhcmFtcyB9IGZyb20gXCIuLi9wYXJhbXMvZGV2XCI7XG5cbi8vIOOCouODl+ODquOCseODvOOCt+ODp+ODs+OBqOOCueOCv+ODg+OCr+OBrueUn+aIkFxuY29uc3QgYXBwID0gbmV3IEFwcCgpO1xuY29uc3Qgc3RhY2sgPSBuZXcgR2xvYmFsU3RhY2soYXBwLCBcIlRlc3RHbG9iYWxTdGFja1wiLCBwYXJhbXMuZ2xvYmFsU3RhY2tQcm9wcyk7XG5jb25zdCB0ZW1wbGF0ZSA9IFRlbXBsYXRlLmZyb21TdGFjayhzdGFjayk7XG5cbmRlc2NyaWJlKFwiR2xvYmFsU3RhY2tcIiwgKCkgPT4ge1xuICAvLyBJUOWItumZkOOBjOOBguOCi+ODhuODiuODs+ODiOOCkueJueWumlxuICBjb25zdCB0ZW5hbnRzV2l0aElwQWRkcmVzc2VzID0gcGFyYW1zLmdsb2JhbFN0YWNrUHJvcHMudGVuYW50cy5maWx0ZXIoXG4gICAgKHRlbmFudCkgPT5cbiAgICAgIHRlbmFudC5hbGxvd2VkSXBBZGRyZXNzZXMgJiYgdGVuYW50LmFsbG93ZWRJcEFkZHJlc3Nlcy5sZW5ndGggPiAwLFxuICApO1xuXG4gIHRlc3QoXCLlkITjg6rjgr3jg7zjgrnjga7lgIvmlbDjgYzmraPjgZfjgYTjgZPjgahcIiwgKCkgPT4ge1xuICAgIC8vIEFDTeiovOaYjuabuOOBrzHjgaTjgaDjgZHkvZzmiJDjgZXjgozjgotcbiAgICB0ZW1wbGF0ZS5yZXNvdXJjZUNvdW50SXMoXCJBV1M6OkNlcnRpZmljYXRlTWFuYWdlcjo6Q2VydGlmaWNhdGVcIiwgMSk7XG5cbiAgICAvLyBXZWJBQ0zjga8x44Gk44Gg44GR5L2c5oiQ44GV44KM44KLXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKFwiQVdTOjpXQUZ2Mjo6V2ViQUNMXCIsIDEpO1xuXG4gICAgLy8gV0FG44Ot44Kw55So44GuUzPjg5DjgrHjg4Pjg4jjga8x44Gk44Gg44GR5L2c5oiQ44GV44KM44KLXG4gICAgdGVtcGxhdGUucmVzb3VyY2VDb3VudElzKFwiQVdTOjpTMzo6QnVja2V0XCIsIDEpO1xuXG4gICAgLy8g44Ot44Kw6Kit5a6a44KCMeOBpOOBoOOBkeS9nOaIkOOBleOCjOOCi1xuICAgIHRlbXBsYXRlLnJlc291cmNlQ291bnRJcyhcIkFXUzo6V0FGdjI6OkxvZ2dpbmdDb25maWd1cmF0aW9uXCIsIDEpO1xuICB9KTtcblxuICB0ZXN0KFwiQUNN6Ki85piO5pu444Gr44OX44Op44Kk44Oe44Oq44OJ44Oh44Kk44Oz44Go5Luj5pu/44OJ44Oh44Kk44Oz44GM5q2j44GX44GP6Kit5a6a44GV44KM44Gm44GE44KLXCIsICgpID0+IHtcbiAgICAvLyDjg5fjg6njgqTjg57jg6rjg4njg6HjgqTjg7PjgahTQU7jg4njg6HjgqTjg7PjgYzmraPjgZfjgY/oqK3lrprjgZXjgozjgabjgYTjgovjgZPjgajjgpLnorroqo1cbiAgICBjb25zdCBwcmltYXJ5RG9tYWluID0gcGFyYW1zLmdsb2JhbFN0YWNrUHJvcHMudGVuYW50c1swXS5hcHBEb21haW5OYW1lO1xuICAgIGNvbnN0IGFsdGVybmF0aXZlRG9tYWlucyA9IHBhcmFtcy5nbG9iYWxTdGFja1Byb3BzLnRlbmFudHNcbiAgICAgIC5zbGljZSgxKVxuICAgICAgLm1hcCgodGVuYW50KSA9PiB0ZW5hbnQuYXBwRG9tYWluTmFtZSk7XG5cbiAgICB0ZW1wbGF0ZS5oYXNSZXNvdXJjZVByb3BlcnRpZXMoXCJBV1M6OkNlcnRpZmljYXRlTWFuYWdlcjo6Q2VydGlmaWNhdGVcIiwge1xuICAgICAgRG9tYWluTmFtZTogcHJpbWFyeURvbWFpbixcbiAgICAgIFN1YmplY3RBbHRlcm5hdGl2ZU5hbWVzOiBhbHRlcm5hdGl2ZURvbWFpbnMsXG4gICAgICBWYWxpZGF0aW9uTWV0aG9kOiBcIkROU1wiLFxuICAgIH0pO1xuICB9KTtcblxuICB0ZXN0KFwi44OG44OK44Oz44OI44GU44Go44GuSVDliLbpmZDjgYzmraPjgZfjgY/oqK3lrprjgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIC8vIOWQhOODhuODiuODs+ODiOOBrklQU2V044GM44GC44KL44GT44Go44KS56K66KqNXG4gICAgZm9yIChjb25zdCB0ZW5hbnQgb2YgdGVuYW50c1dpdGhJcEFkZHJlc3Nlcykge1xuICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpXQUZ2Mjo6SVBTZXRcIiwge1xuICAgICAgICBBZGRyZXNzZXM6IHRlbmFudC5hbGxvd2VkSXBBZGRyZXNzZXMsXG4gICAgICAgIFNjb3BlOiBcIkNMT1VERlJPTlRcIixcbiAgICAgIH0pO1xuICAgIH1cblxuICAgIC8vIFdBRiBXZWJBQ0zjgavlkITjg4bjg4rjg7Pjg4jjga5JUOWItumZkOODq+ODvOODq+OBjOWQq+OBvuOCjOOBpuOBhOOCi+OBk+OBqOOCkueiuuiqjVxuICAgIGZvciAoY29uc3QgdGVuYW50IG9mIHRlbmFudHNXaXRoSXBBZGRyZXNzZXMpIHtcbiAgICAgIGNvbnN0IHJ1bGVOYW1lID0gYElQUmVzdHJpY3Rpb24tJHt0ZW5hbnQuYXBwRG9tYWluTmFtZS5yZXBsYWNlKC9cXC4vZywgXCItXCIpfWA7XG5cbiAgICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6V0FGdjI6OldlYkFDTFwiLCB7XG4gICAgICAgIFJ1bGVzOiBNYXRjaC5hcnJheVdpdGgoW1xuICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgICAgTmFtZTogcnVsZU5hbWUsXG4gICAgICAgICAgICBBY3Rpb246IHsgQmxvY2s6IHt9IH0sXG4gICAgICAgICAgfSksXG4gICAgICAgIF0pLFxuICAgICAgfSk7XG4gICAgfVxuICB9KTtcblxuICB0ZXN0KFwiSVDliLbpmZDjga7pmaTlpJbjg5HjgrnjgYzmraPjgZfjgY/pgannlKjjgZXjgozjgabjgYTjgotcIiwgKCkgPT4ge1xuICAgIC8vIOODhuOCueODiOOBruWJjeaPkOadoeS7tu+8mklQ5Yi26ZmQ6Zmk5aSW44OR44K544GM6Kit5a6a44GV44KM44Gm44GE44KL44GT44GoXG4gICAgaWYgKFxuICAgICAgIXBhcmFtcy5nbG9iYWxTdGFja1Byb3BzLmlwUmVzdHJpY3Rpb25FeGNsdWRlZFBhdGhzIHx8XG4gICAgICBwYXJhbXMuZ2xvYmFsU3RhY2tQcm9wcy5pcFJlc3RyaWN0aW9uRXhjbHVkZWRQYXRocy5sZW5ndGggPT09IDBcbiAgICApIHtcbiAgICAgIGNvbnNvbGUud2FybihcbiAgICAgICAgXCLjg4bjgrnjg4jlr77osaHjga7jg5fjg63jg5Hjg4bjgqMgaXBSZXN0cmljdGlvbkV4Y2x1ZGVkUGF0aHMg44GM6Kit5a6a44GV44KM44Gm44GE44G+44Gb44KTXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIGlmICh0ZW5hbnRzV2l0aElwQWRkcmVzc2VzLmxlbmd0aCA9PT0gMCkge1xuICAgICAgY29uc29sZS53YXJuKFxuICAgICAgICBcIklQ5Yi26ZmQ44KS6Kit5a6a44GX44Gm44GE44KL44OG44OK44Oz44OI44GM5a2Y5Zyo44GX44Gq44GE44Gf44KB44CB6Zmk5aSW44OR44K544Gu44OG44K544OI44KS44K544Kt44OD44OX44GX44G+44GZXCIsXG4gICAgICApO1xuICAgICAgcmV0dXJuO1xuICAgIH1cblxuICAgIC8vIOWQhOODhuODiuODs+ODiOOBrklQ5Yi26ZmQ44Or44O844Or44Gr5a++44GX44Gm44CB6Zmk5aSW44OR44K544GM5q2j44GX44GP6Kit5a6a44GV44KM44Gm44GE44KL44GT44Go44KS56K66KqNXG4gICAgZm9yIChjb25zdCB0ZW5hbnQgb2YgdGVuYW50c1dpdGhJcEFkZHJlc3Nlcykge1xuICAgICAgY29uc3QgcnVsZU5hbWUgPSBgSVBSZXN0cmljdGlvbi0ke3RlbmFudC5hcHBEb21haW5OYW1lLnJlcGxhY2UoL1xcLi9nLCBcIi1cIil9YDtcblxuICAgICAgLy8g5ZCE6Zmk5aSW44OR44K544Gr44Gk44GE44Gm5qSc6Ki8XG4gICAgICBmb3IgKGNvbnN0IHBhdGggb2YgcGFyYW1zLmdsb2JhbFN0YWNrUHJvcHMuaXBSZXN0cmljdGlvbkV4Y2x1ZGVkUGF0aHMpIHtcbiAgICAgICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpXQUZ2Mjo6V2ViQUNMXCIsIHtcbiAgICAgICAgICBSdWxlczogTWF0Y2guYXJyYXlXaXRoKFtcbiAgICAgICAgICAgIE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgICAgICBOYW1lOiBydWxlTmFtZSxcbiAgICAgICAgICAgICAgU3RhdGVtZW50OiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICAgICAgICBBbmRTdGF0ZW1lbnQ6IE1hdGNoLm9iamVjdExpa2Uoe1xuICAgICAgICAgICAgICAgICAgU3RhdGVtZW50czogTWF0Y2guYXJyYXlXaXRoKFtcbiAgICAgICAgICAgICAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgICAgICAgICAgICAgICAgTm90U3RhdGVtZW50OiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgIFN0YXRlbWVudDogTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgIE9yU3RhdGVtZW50OiBNYXRjaC5vYmplY3RMaWtlKHtcbiAgICAgICAgICAgICAgICAgICAgICAgICAgICBTdGF0ZW1lbnRzOiBNYXRjaC5hcnJheVdpdGgoW1xuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIEJ5dGVNYXRjaFN0YXRlbWVudDogTWF0Y2gub2JqZWN0TGlrZSh7XG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgU2VhcmNoU3RyaW5nOiBwYXRoLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIFBvc2l0aW9uYWxDb25zdHJhaW50OiBcIlNUQVJUU19XSVRIXCIsXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgICAgICAgXSksXG4gICAgICAgICAgICAgICAgfSksXG4gICAgICAgICAgICAgIH0pLFxuICAgICAgICAgICAgfSksXG4gICAgICAgICAgXSksXG4gICAgICAgIH0pO1xuICAgICAgfVxuICAgIH1cbiAgfSk7XG5cbiAgdGVzdChcIldBRuODreOCsOODkOOCseODg+ODiOOBr+mBqeWIh+OBquWQjeWJjeW9ouW8j+OBqOOCu+OCreODpeODquODhuOCo+ioreWumuOCkuaMgeOBpFwiLCAoKSA9PiB7XG4gICAgdGVtcGxhdGUuaGFzUmVzb3VyY2VQcm9wZXJ0aWVzKFwiQVdTOjpTMzo6QnVja2V0XCIsIHtcbiAgICAgIEJ1Y2tldE5hbWU6IE1hdGNoLnN0cmluZ0xpa2VSZWdleHAoXCJeYXdzLXdhZi1sb2dzLS4qXCIpLFxuICAgICAgUHVibGljQWNjZXNzQmxvY2tDb25maWd1cmF0aW9uOiB7XG4gICAgICAgIEJsb2NrUHVibGljQWNsczogdHJ1ZSxcbiAgICAgICAgQmxvY2tQdWJsaWNQb2xpY3k6IHRydWUsXG4gICAgICAgIElnbm9yZVB1YmxpY0FjbHM6IHRydWUsXG4gICAgICAgIFJlc3RyaWN0UHVibGljQnVja2V0czogdHJ1ZSxcbiAgICAgIH0sXG4gICAgICBCdWNrZXRFbmNyeXB0aW9uOiB7XG4gICAgICAgIFNlcnZlclNpZGVFbmNyeXB0aW9uQ29uZmlndXJhdGlvbjogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIFNlcnZlclNpZGVFbmNyeXB0aW9uQnlEZWZhdWx0OiB7XG4gICAgICAgICAgICAgIFNTRUFsZ29yaXRobTogXCJBRVMyNTZcIixcbiAgICAgICAgICAgIH0sXG4gICAgICAgICAgfSxcbiAgICAgICAgXSxcbiAgICAgIH0sXG4gICAgfSk7XG4gIH0pO1xuXG4gIHRlc3QoXCJXQUbjg63jgrDoqK3lrprjga/jg5bjg63jg4Pjgq/jgZXjgozjgZ/jg6rjgq/jgqjjgrnjg4jjga7jgb/jgpLoqJjpjLLjgZnjgotcIiwgKCkgPT4ge1xuICAgIHRlbXBsYXRlLmhhc1Jlc291cmNlUHJvcGVydGllcyhcIkFXUzo6V0FGdjI6OkxvZ2dpbmdDb25maWd1cmF0aW9uXCIsIHtcbiAgICAgIExvZ2dpbmdGaWx0ZXI6IHtcbiAgICAgICAgRGVmYXVsdEJlaGF2aW9yOiBcIkRST1BcIixcbiAgICAgICAgRmlsdGVyczogW1xuICAgICAgICAgIHtcbiAgICAgICAgICAgIEJlaGF2aW9yOiBcIktFRVBcIixcbiAgICAgICAgICAgIENvbmRpdGlvbnM6IFtcbiAgICAgICAgICAgICAge1xuICAgICAgICAgICAgICAgIEFjdGlvbkNvbmRpdGlvbjoge1xuICAgICAgICAgICAgICAgICAgQWN0aW9uOiBcIkJMT0NLXCIsXG4gICAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgICAgfSxcbiAgICAgICAgICAgIF0sXG4gICAgICAgICAgICBSZXF1aXJlbWVudDogXCJNRUVUU19BTExcIixcbiAgICAgICAgICB9LFxuICAgICAgICBdLFxuICAgICAgfSxcbiAgICB9KTtcbiAgfSk7XG59KTtcbiJdfQ==