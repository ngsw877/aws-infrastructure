import * as cdk from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import * as DbEtlLambda from '../lib/db-etl-lambda-stack';

describe('DbEtlLambdaStack', () => {
  test('VPC Created with correct configuration', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // VPCが作成されることを確認
    template.hasResourceProperties('AWS::EC2::VPC', {
      EnableDnsHostnames: true,
      EnableDnsSupport: true,
    });

    // 3種類のサブネットが作成されることを確認
    template.resourceCountIs('AWS::EC2::Subnet', 6); // 2 AZ x 3 types
  });

  test('Databases Created', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // RDS PostgreSQLインスタンスが作成されることを確認
    template.hasResourceProperties('AWS::RDS::DBInstance', {
      Engine: 'postgres',
      DBName: 'sourcedb',
    });

    // Aurora Serverless v2クラスターが作成されることを確認
    template.hasResourceProperties('AWS::RDS::DBCluster', {
      Engine: 'aurora-postgresql',
      DBClusterIdentifier: {
        'Fn::Join': ['', [
          'dbetllambdastack-targetdatabase',
          { 'Fn::Select': [4, { 'Fn::Split': ['-', { 'Fn::Select': [2, { 'Fn::Split': ['/', { 'Ref': 'AWS::StackId' }] }] }] }] },
        ]],
      },
    });
  });

  test('Lambda Functions Created', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // 3つのLambda関数が作成されることを確認
    const lambdaFunctions = template.findResources('AWS::Lambda::Function');
    const functionKeys = Object.keys(lambdaFunctions);
    
    // Extract-Transform, Load, DB Initializer の3つ
    expect(functionKeys.length).toBeGreaterThanOrEqual(3);
  });

  test('Lambda Layers Created', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // 2つのLambda Layerが作成されることを確認
    template.resourceCountIs('AWS::Lambda::LayerVersion', 2);
  });

  test('S3 Bucket Created with Lifecycle Rule', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // S3バケットが作成され、ライフサイクルルールが設定されることを確認
    template.hasResourceProperties('AWS::S3::Bucket', {
      LifecycleConfiguration: {
        Rules: [{
          ExpirationInDays: 30,
          Status: 'Enabled',
        }],
      },
    });
  });

  test('EventBridge Rule Created', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // EventBridgeルールが作成されることを確認
    template.hasResourceProperties('AWS::Events::Rule', {
      ScheduleExpression: 'cron(0 2 * * ? *)',
    });
  });

  test('Secrets Created', () => {
    const app = new cdk.App();
    const stack = new DbEtlLambda.DbEtlLambdaStack(app, 'TestStack');
    const template = Template.fromStack(stack);

    // 2つのシークレットが作成されることを確認
    template.resourceCountIs('AWS::SecretsManager::Secret', 2);
  });
});