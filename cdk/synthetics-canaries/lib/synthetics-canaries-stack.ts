import * as path from "node:path";
import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as sns_subscriptions from 'aws-cdk-lib/aws-sns-subscriptions';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import { Construct } from 'constructs';

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

    // ====================================
    // Example.comアクセステスト用Canary
    // ====================================

    // Example.comテスト用のIAMロール
    const exampleAccessCanaryRole = new iam.Role(this, 'ExampleAccessCanaryRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
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
    exampleAccessCanaryRole.attachInlinePolicy(canaryPolicy);

    // Example.comアクセステスト用Canaryの設定
    const exampleAccessCanary = new synthetics.Canary(this, 'ExampleAccessCanary', {
      canaryName: 'example-access',
      artifactsBucketLocation: {
        bucket: bucket,
      },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname, '../canary/example-access')),
        handler: 'index.handler',
      }),
      role: exampleAccessCanaryRole,
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PLAYWRIGHT_2_0,
      schedule: synthetics.Schedule.rate(Duration.minutes(5)), // 5分ごとに実行
      successRetentionPeriod: Duration.days(7),
      failureRetentionPeriod: Duration.days(7),
      startAfterCreation: true,
    });

    // ====================================
    // 通知設定（SNS、Lambda、CloudWatchアラーム）
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

    // Example.comアクセステスト用のCloudWatchアラーム
    const exampleAccessCanaryFailureAlarm = new cloudwatch.Alarm(this, 'ExampleAccessCanaryFailureAlarm', {
      alarmDescription: `Example.com アクセス監視失敗`,
      metric: exampleAccessCanary.metricFailed().with({ 
        period: Duration.seconds(300) 
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // アラームアクションの追加
    exampleAccessCanaryFailureAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(alarmTopic)
    );

    // ====================================
    // ログインテスト用Canaryの追加
    // ====================================

    // ログインCanary用のIAMロール（セキュリティ分離のため別ロール）
    const loginCanaryRole = new iam.Role(this, 'LoginCanaryRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });

    // 既存のcanaryPolicyをアタッチ（S3とCloudWatch Logsアクセス権限を再利用）
    loginCanaryRole.attachInlinePolicy(canaryPolicy);

    // ログインテスト用Canary
    const loginCanary = new synthetics.Canary(this, 'LoginTestCanary', {
      canaryName: 'login-test',
      artifactsBucketLocation: {
        bucket: bucket,  // 既存のS3バケットを共通利用
      },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname, '../canary/login-test')),
        handler: 'index.handler',
      }),
      role: loginCanaryRole,
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PLAYWRIGHT_2_0,
      schedule: synthetics.Schedule.rate(Duration.minutes(10)), // 10分ごとに実行（既存は5分ごと）
      successRetentionPeriod: Duration.days(7),
      failureRetentionPeriod: Duration.days(7),
      startAfterCreation: true,
    });

    // ログインCanary用のCloudWatchアラーム
    const loginCanaryFailureAlarm = new cloudwatch.Alarm(this, 'LoginCanaryFailureAlarm', {
      alarmDescription: `ログインテスト監視失敗`,
      metric: loginCanary.metricFailed().with({ 
        period: Duration.seconds(300) 
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // 既存のSNSトピックとLambda関数を再利用してSlack通知
    loginCanaryFailureAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(alarmTopic)  // 既存のSNSトピックを共通利用
    );
  }
}
