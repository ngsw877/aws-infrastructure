import * as cdk from "aws-cdk-lib";
import * as path from "node:path";
import { Stack } from "aws-cdk-lib";
import * as events from "aws-cdk-lib/aws-events";
import * as targets from "aws-cdk-lib/aws-events-targets";
import * as iam from "aws-cdk-lib/aws-iam";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as logs from "aws-cdk-lib/aws-logs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";
import type { RestartEcsTasksBatchProps } from "../../types/params";

// 指定したECSタスクの再起動バッチ
export class RestartEcsTasksBatch extends Construct {
  constructor(scope: Construct, id: string, props: RestartEcsTasksBatchProps) {
    super(scope, id);

    const stack = Stack.of(this);

    // Lambda用Role
    const restartEcsTasksLambdaRole = new iam.Role(this, "LambdaRole", {
      assumedBy: new iam.ServicePrincipal("lambda.amazonaws.com"),
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName(
          "service-role/AWSLambdaBasicExecutionRole",
        ),
      ],
      inlinePolicies: {
        RestartEcsTasksPolicy: new iam.PolicyDocument({
          statements: [
            new iam.PolicyStatement({
              actions: ["ecs:UpdateService"],
              resources: [
                `arn:aws:ecs:${stack.region}:${stack.account}:service/${props.ecsClusterName}/${props.ecsServiceName}`,
              ],
            }),
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
    const restartEcsTasksLambda = new NodejsFunction(this, "Lambda", {
      entry: path.join(__dirname, "../../lambda/restart-ecs-tasks/index.ts"),
      handler: "handler",
      runtime: lambda.Runtime.NODEJS_18_X,
      role: restartEcsTasksLambdaRole,
      environment: {
        ECS_CLUSTER_NAME: props.ecsClusterName,
        ECS_SERVICE_NAME: props.ecsServiceName,
        BATCH_SUCCESS_WEBHOOK_PARAMETER_STORE_NAME:
          props.batchSuccessWebhookParameterStoreName,
        BATCH_FAILURE_WEBHOOK_PARAMETER_STORE_NAME:
          props.batchFailureWebhookParameterStoreName,
      },
    });

    // Lambdaのロググループ
    new logs.LogGroup(this, `${restartEcsTasksLambda.node.id}LogGroup`, {
      logGroupName: `/aws/lambda/${restartEcsTasksLambda.functionName}`,
      retention: logs.RetentionDays.THREE_MONTHS,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // スケジュール
    const rule = new events.Rule(this, "ScheduleRule", {
      enabled: props.scheduleOption.isScheduleEnabled,
      schedule: events.Schedule.cron(props.scheduleOption.scheduleCron),
    });
    rule.addTarget(new targets.LambdaFunction(restartEcsTasksLambda));
  }
}
