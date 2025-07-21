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
      bucketName: `${this.stackName.toLowerCase()}-artifacts`,
      lifecycleRules: [
        {
          id: '30DaysExpiration',
          expiration: Duration.days(30),
        },
      ],
      removalPolicy: cdk.RemovalPolicy.DESTROY,
      autoDeleteObjects: true,
    });

    // Canary実行用のIAMロール
    const canaryRole = new iam.Role(this, 'CanaryRole', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
      roleName: `${this.stackName}-CanaryRole`,
    });

    // Canaryロールのポリシー
    const canaryPolicy = new iam.Policy(this, 'CanaryPolicy', {
      policyName: `${this.stackName}-CanaryPolicy`,
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
    canaryRole.attachInlinePolicy(canaryPolicy);

    // Canaryの設定
    const canary = new synthetics.Canary(this, 'ExampleAccessCanary', {
      canaryName: 'example-access-monitor',
      artifactsBucketLocation: {
        bucket: bucket,
      },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(path.join(__dirname, '../canary')),
        handler: 'index.handler',
      }),
      role: canaryRole,
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PLAYWRIGHT_2_0,
      schedule: synthetics.Schedule.rate(Duration.minutes(5)), // 5分ごとに実行
      successRetentionPeriod: Duration.days(7),
      failureRetentionPeriod: Duration.days(7),
      startAfterCreation: true,
    });

    // SNSトピック（Slack通知用）
    const alarmTopic = new sns.Topic(this, 'CanaryAlarmTopic', {
      topicName: `${this.stackName}-CanaryAlarmTopic`,
    });

    // Parameter StoreからSlack Webhook URLを取得（デプロイ時）
    const slackWebhookUrlParameterName = `/${this.stackName}/slack-webhook-url`;
    const slackWebhookUrl = ssm.StringParameter.valueForStringParameter(
      this,
      slackWebhookUrlParameterName
    );

    // Slack通知用Lambda関数
    const slackNotifierFunction = new lambda.Function(this, 'SlackNotifierFunction', {
      functionName: `${this.stackName}-SlackNotifier`,
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

    // CloudWatchアラーム（Canary失敗時）
    const canaryFailureAlarm = new cloudwatch.Alarm(this, 'CanaryFailureAlarm', {
      alarmName: `${canary.canaryName}-failure-alarm`,
      alarmDescription: `Example.com アクセス監視失敗`,
      metric: canary.metricFailed().with({ 
        period: Duration.seconds(300) 
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    // アラームアクションの追加
    canaryFailureAlarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(alarmTopic)
    );
  }
}
