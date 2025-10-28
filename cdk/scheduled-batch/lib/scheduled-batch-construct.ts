import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import { Schedule, ScheduleExpression } from "aws-cdk-lib/aws-scheduler";
import { LambdaInvoke } from "aws-cdk-lib/aws-scheduler-targets";
import { TimeZone } from "aws-cdk-lib/core";
import * as iam from "aws-cdk-lib/aws-iam";
import { Runtime } from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import type { ScheduleOption } from "../types/params";

export interface BatchConfig {
  lambdaEntry: string;
  environment: Record<string, string>;
  scheduleOption: ScheduleOption;
  batchSuccessWebhookParameterStoreName: string;
  batchFailureWebhookParameterStoreName: string;
}

export class ScheduledBatchConstruct extends Construct {
  public readonly lambdaRole: iam.Role;

  constructor(scope: Construct, id: string, config: BatchConfig) {
    super(scope, id);

    const stack = Stack.of(this);

    // Lambda用Role（基本的なSSMポリシーのみ）
    this.lambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
    });

    // 共通のSSMポリシーを追加
    this.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ssm:GetParameter"],
        resources: [
          `arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${config.batchSuccessWebhookParameterStoreName}`,
          `arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${config.batchFailureWebhookParameterStoreName}`,
        ],
      })
    );

    // Lambda
    const lambda = new NodejsFunction(this, "Lambda", {
      entry: config.lambdaEntry,
      handler: "handler",
      runtime: Runtime.NODEJS_18_X,
      role: this.lambdaRole,
      environment: {
        BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME: config.batchSuccessWebhookParameterStoreName,
        BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME: config.batchFailureWebhookParameterStoreName,
        ...config.environment,
      },
    });

    // Lambdaのロググループ
    new logs.LogGroup(this, `${lambda.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${lambda.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // スケジュール
    new Schedule(this, "Schedule", {
      schedule: ScheduleExpression.cron({
        ...config.scheduleOption.scheduleCron,
        timeZone: TimeZone.of("Asia/Tokyo"),
      }),
      target: new LambdaInvoke(lambda),
      enabled: config.scheduleOption.isScheduleEnabled,
    });
  }
}