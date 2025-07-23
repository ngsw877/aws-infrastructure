import * as path from "node:path";
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import { Construct } from 'constructs';
import { CanaryMonitor } from './constructs/canary-monitor';

export class SyntheticsCanariesStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // S3バケット（アーティファクト保存用）
    const bucket = new s3.Bucket(this, 'CanaryArtifactsBucket', {
      lifecycleRules: [
        {
          id: '30DaysExpiration',
          expiration: Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Canary共通のIAMポリシー（S3アーティファクト保存、CloudWatch Logs書き込み権限）
    const canaryPolicy = new iam.Policy(this, 'CanaryPolicy', {
      statements: [
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:PutObject', 's3:GetObject'],
          resources: [`${bucket.bucketArn}/*`],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:GetBucketLocation'],
          resources: [bucket.bucketArn],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: [
            'logs:CreateLogStream',
            'logs:PutLogEvents',
            'logs:CreateLogGroup',
          ],
          resources: [
            `arn:aws:logs:${this.region}:${this.account}:log-group:/aws/lambda/cwsyn-*`,
          ],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['s3:ListAllMyBuckets'],
          resources: ['*'],
        }),
        new iam.PolicyStatement({
          effect: iam.Effect.ALLOW,
          actions: ['cloudwatch:PutMetricData'],
          resources: ['*'],
          conditions: {
            StringEquals: {
              'cloudwatch:namespace': 'CloudWatchSynthetics',
            },
          },
        }),
      ],
    });

    // ====================================
    // 通知設定（SNS、Lambda）
    // ====================================

    // SNSトピック（Slack通知用・共通利用）
    const alarmTopic = new sns.Topic(this, 'CanaryAlarmTopic');

    // Parameter StoreからSlack Webhook URLを取得（デプロイ時）
    const slackWebhookUrlParameterName = `/${this.stackName}/slack-webhook-url`;
    const slackWebhookUrl = ssm.StringParameter.valueForStringParameter(
      this,
      slackWebhookUrlParameterName
    );

    // Slack通知用Lambda関数
    const slackNotifierFunction = new lambda.Function(this, 'SlackNotifierFunction', {
      runtime: lambda.Runtime.PYTHON_3_13,
      handler: 'slack_notifier.lambda_handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
      environment: {
        SLACK_WEBHOOK_URL: slackWebhookUrl,
      },
      timeout: Duration.seconds(30),
      role: new iam.Role(this, 'SlackNotifierRole', {
        assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
        managedPolicies: [
          iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSLambdaBasicExecutionRole'),
        ],
      }),
    });

    // Lambda関数にSNSからの実行権限を付与
    slackNotifierFunction.addPermission('AllowSNS', {
      principal: new iam.ServicePrincipal('sns.amazonaws.com'),
      sourceArn: alarmTopic.topicArn,
    });

    // SNSトピックからLambda関数をトリガー
    alarmTopic.addSubscription(
      new sns_subscriptions.LambdaSubscription(slackNotifierFunction)
    );

    // ====================================
    // Canaryモニターの作成
    // ====================================

    // Example.comアクセステスト用Canaryモニター
    new CanaryMonitor(this, 'ExampleAccessMonitor', {
      canaryName: 'example-access',
      schedule: synthetics.Schedule.rate(Duration.minutes(5)),
      alarmDescription: 'Example.com アクセス監視失敗',
      bucket,
      alarmTopic,
      canaryPolicy,
    });

    // ログインテスト用Canaryモニター
    new CanaryMonitor(this, 'LoginTestMonitor', {
      canaryName: 'login-test',
      schedule: synthetics.Schedule.rate(Duration.minutes(10)),
      alarmDescription: 'ログインテスト監視失敗',
      bucket,
      alarmTopic,
      canaryPolicy,
    });
  }
}
