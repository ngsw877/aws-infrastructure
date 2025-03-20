import { App } from 'aws-cdk-lib';
import { Template, Match } from 'aws-cdk-lib/assertions';
import { GlobalStack } from '../lib/global-stack';
import { params } from '../params/dev';

// アプリケーションとスタックの生成
const app = new App();
const stack = new GlobalStack(app, 'TestGlobalStack', params.globalStackProps);
const template = Template.fromStack(stack);

describe('GlobalStack', () => {
  // 必要なリソースが作成されることを確認
  test('必要なリソースが作成される', () => {
    template.resourceCountIs('AWS::CertificateManager::Certificate', 1);
    template.resourceCountIs('AWS::WAFv2::IPSet', 1);
    template.resourceCountIs('AWS::WAFv2::WebACL', 1);
    template.resourceCountIs('AWS::S3::Bucket', 1);
    template.resourceCountIs('AWS::WAFv2::LoggingConfiguration', 1);
  });

  // propsから渡された値が正しくリソースに反映されているかテスト
  test('props値が正しくリソースに反映される', () => {
    // ドメイン名がACM証明書とホストゾーン参照に反映されている
    template.hasResourceProperties('AWS::CertificateManager::Certificate', {
      DomainName: params.globalStackProps.appDomainName,
      ValidationMethod: 'DNS',
    });
    
    // 許可IPアドレスがIPSetに反映されている
    template.hasResourceProperties('AWS::WAFv2::IPSet', {
      Addresses: params.globalStackProps.allowedIpAddresses || [],
    });
    
    // ログ保持期間がバケットのライフサイクルルールに反映されている
    const expectedDays = params.globalStackProps.logRetentionDays ?? 90;
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: Match.arrayWith([
          Match.objectLike({
            ExpirationInDays: expectedDays,
          })
        ])
      }
    });
  });

  // 条件分岐テスト: IPアドレスリストの有無によるWAFルール設定
  test('IPアドレスリストの有無によって適切なWAFルール設定がされる', () => {
    const hasIpAddresses = params.globalStackProps.allowedIpAddresses && 
                          params.globalStackProps.allowedIpAddresses.length > 0;
    
    const expectedAction = hasIpAddresses ? { Block: {} } : { Count: {} };
    
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'BlockNonAllowedIPs',
          Priority: 1,
          Action: expectedAction,
        })
      ])
    });
  });
  
  // WAFログバケットの重要なセキュリティ設定をテスト
  test('WAFログバケットは適切な名前形式とセキュリティ設定を持つ', () => {
    template.hasResourceProperties('AWS::S3::Bucket', {
      BucketName: Match.stringLikeRegexp('^aws-waf-logs-.*'),
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
              SSEAlgorithm: 'AES256',
            },
          },
        ],
      },
    });
  });

  // WAF WebACLが特定のパスを除外する設定を持つことをテスト
  test('WAF WebACLが除外パスの設定を持つ', () => {
    template.hasResourceProperties('AWS::WAFv2::WebACL', {
      Rules: Match.arrayWith([
        Match.objectLike({
          Name: 'BlockNonAllowedIPs',
          Statement: Match.objectLike({
            NotStatement: Match.objectLike({
              Statement: Match.objectLike({
                OrStatement: Match.objectLike({
                  Statements: Match.arrayWith([
                    Match.objectLike({
                      ByteMatchStatement: Match.objectLike({
                        SearchString: '/sample',
                      })
                    }),
                    Match.objectLike({
                      ByteMatchStatement: Match.objectLike({
                        SearchString: '/product',
                      })
                    })
                  ])
                })
              })
            })
          })
        })
      ])
    });
  });

  // ログフィルタの設定をテスト
  test('WAFログ設定はブロックされたリクエストのみを記録する', () => {
    template.hasResourceProperties('AWS::WAFv2::LoggingConfiguration', {
      LoggingFilter: {
        DefaultBehavior: 'DROP',
        Filters: [
          {
            Behavior: 'KEEP',
            Conditions: [
              {
                ActionCondition: {
                  Action: 'BLOCK',
                },
              },
            ],
            Requirement: 'MEETS_ALL',
          },
        ],
      },
    });
  });
});