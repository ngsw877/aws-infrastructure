import * as path from "node:path";
import * as cdk from "aws-cdk-lib";
import { Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import * as logs from "aws-cdk-lib/aws-logs";
import { Construct } from "constructs";
import type { HelloWorldBatchProps } from "../../types/params";

// テスト用バッチ
export class HelloWorldBatch extends Construct {
  constructor(scope: Construct, id: string, props: HelloWorldBatchProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // Lambda用Role
    const helloWorldLambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
      inlinePolicies: {
        HelloWorldPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ssm:GetParameter"],
              resources: [
                `arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${props.batchSuccessWebhookParameterStoreName}`,
                `arn:${stack.partition}:ssm:${stack.region}:${stack.account}:parameter${props.batchFailureWebhookParameterStoreName}`,
              ],
            }),
          ],
        }),
      },
    });

    // Lambda
    const helloWorldLambda = new NodejsFunction(this, "Lambda", {
      entry: path.join(__dirname, "../../lambda/hello-world/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      role: helloWorldLambdaRole,
      environment: {
        TEST_MESSAGE: props.testMessage,
        BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME:
          props.batchSuccessWebhookParameterStoreName,
        BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME:
          props.batchFailureWebhookParameterStoreName,
      },
    });

    // Lambdaのロググループ
    new logs.LogGroup(this, `${helloWorldLambda.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${helloWorldLambda.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // スケジュール
    const rule = new events.Rule(this, "ScheduleRule", {
      enabled: props.scheduleOption.isScheduleEnabled,
      schedule: events.Schedule.cron(props.scheduleOption.scheduleCron),
    });
    rule.addTarget(new targets.LambdaFunction(helloWorldLambda));
  }
}
