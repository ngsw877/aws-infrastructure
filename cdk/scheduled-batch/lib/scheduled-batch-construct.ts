import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
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
  public readonly lambda: NodejsFunction;
  public readonly lambdaRole: iam.Role;
  public readonly rule: events.Rule;

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
    this.lambda = new NodejsFunction(this, "Lambda", {
      entry: config.lambdaEntry,
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      role: this.lambdaRole,
      environment: {
        BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME: config.batchSuccessWebhookParameterStoreName,
        BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME: config.batchFailureWebhookParameterStoreName,
        ...config.environment,
      },
    });

    // Lambdaのロググループ
    new logs.LogGroup(this, `${this.lambda.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${this.lambda.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // スケジュール
    this.rule = new events.Rule(this, "ScheduleRule", {
      enabled: config.scheduleOption.isScheduleEnabled,
      schedule: events.Schedule.cron(config.scheduleOption.scheduleCron),
    });
    this.rule.addTarget(new targets.LambdaFunction(this.lambda));
  }
}