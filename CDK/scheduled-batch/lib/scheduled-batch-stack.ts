import * as cdk from 'aws-cdk-lib';
import * as lambda from 'aws-cdk-lib/aws-lambda-nodejs';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as path from 'path';
import { Construct } from 'constructs';

export class ScheduledBatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Slack通知用のLambda関数を作成
    const slackNotifierFunction = new lambda.NodejsFunction(this, 'SlackNotifier', {
      runtime: cdk.aws_lambda.Runtime.NODEJS_18_X,
      handler: 'handler',
      entry: path.join(__dirname, '../lambda/slack-notifier/index.ts'),
    });

    // Systems Manager Parameter StoreからSecureStringを取得する権限を付与
    slackNotifierFunction.addToRolePolicy(new cdk.aws_iam.PolicyStatement({
      actions: ['ssm:GetParameter'],
      resources: [ssm.StringParameter.fromSecureStringParameterAttributes(this, 'SlackWebhookUrl', {
        parameterName: '/scheduled-batch/slack-webhook-url',
      }).parameterArn],
    }));

    // CloudWatch Logsのロググループを作成
    new logs.LogGroup(this, `${slackNotifierFunction.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${slackNotifierFunction.functionName}`,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // EventBridgeルールを作成して、Lambdaを定期実行
    new events.Rule(this, 'ScheduleRule', {
      schedule: events.Schedule.cron({ minute: '0', hour: '0', weekDay: 'MON-FRI' }), // 日本時間の平日朝9時に実行（UTC 0時）
      targets: [new targets.LambdaFunction(slackNotifierFunction)],
    });
  }
}
