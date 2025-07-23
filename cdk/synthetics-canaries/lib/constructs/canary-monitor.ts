import * as cdk from 'aws-cdk-lib';
import { Duration } from 'aws-cdk-lib';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as cloudwatch_actions from 'aws-cdk-lib/aws-cloudwatch-actions';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as synthetics from 'aws-cdk-lib/aws-synthetics';
import { Construct } from 'constructs';
import * as path from 'path';

export interface CanaryMonitorProps {
  canaryName: string;
  schedule: synthetics.Schedule;
  alarmDescription: string;
  bucket: s3.IBucket;
  alarmTopic: sns.ITopic;
  canaryPolicy: iam.Policy;
}

export class CanaryMonitor extends Construct {
  constructor(scope: Construct, id: string, props: CanaryMonitorProps) {
    super(scope, id);

    // IAMロール
    const role = new iam.Role(this, 'Role', {
      assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    });
    role.attachInlinePolicy(props.canaryPolicy);

    // Canary作成
    const codePath = path.join(__dirname, `../../canary/${props.canaryName}`);
    
    const canary = new synthetics.Canary(this, 'Canary', {
      canaryName: props.canaryName,
      artifactsBucketLocation: {
        bucket: props.bucket,
      },
      test: synthetics.Test.custom({
        code: synthetics.Code.fromAsset(codePath),
        handler: 'index.handler',
      }),
      role,
      runtime: synthetics.Runtime.SYNTHETICS_NODEJS_PLAYWRIGHT_2_0,
      schedule: props.schedule,
      successRetentionPeriod: Duration.days(7),
      failureRetentionPeriod: Duration.days(7),
      startAfterCreation: true,
    });

    // 自動リトライ機能
    const cfnCanary = canary.node.defaultChild as synthetics.CfnCanary;
    cfnCanary.addPropertyOverride('Schedule.RetryConfig', {
      MaxRetries: 2,
    });

    // CloudWatchアラーム
    const alarm = new cloudwatch.Alarm(this, 'Alarm', {
      alarmDescription: props.alarmDescription,
      metric: canary.metricFailed().with({ 
        period: Duration.seconds(300) 
      }),
      threshold: 1,
      evaluationPeriods: 1,
      comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
      treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
    });

    alarm.addAlarmAction(
      new cloudwatch_actions.SnsAction(props.alarmTopic)
    );
  }
}