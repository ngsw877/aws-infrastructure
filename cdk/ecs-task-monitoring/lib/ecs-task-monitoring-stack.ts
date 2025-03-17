import {
  Stack,
  aws_events as events,
  aws_events_targets as events_targets,
  aws_lambda as lambda,
  aws_logs as logs,
  Duration,
  RemovalPolicy,
  aws_logs_destinations as logs_destinations,
  aws_iam as iam,
  aws_ssm as ssm,
} from "aws-cdk-lib";
import type { Construct } from "constructs";
import type { EcsTaskMonitoringStackProps } from "../props";

export class EcsTaskMonitoringStack extends Stack {
  constructor(scope: Construct, id: string, props: EcsTaskMonitoringStackProps) {
    super(scope, id, props);

    // パラメータストアの存在をチェックしつつ代入
    // もし存在しない場合はcdk deploy実行時にエラーが発生する
    const slackWebhookUrl = ssm.StringParameter.valueForStringParameter(
      this,
      props.slackWebhookUrlParameterPath,
    )

    // CloudWatch Logsグループ（ログ保存用）
    const taskStopEventLogGroup = new logs.LogGroup(this, "TaskStopEventLogGroup", {
      retention: props.logRetentionDays,
      removalPolicy: RemovalPolicy.DESTROY,
    });

    // タスク異常終了を通知するLambda
    const taskStopNotificationLambdaFunction = new lambda.Function(
      this,
      "TaskStopNotificationLambdaFunction",
      {
        runtime: lambda.Runtime.PYTHON_3_13,
        handler: "task-stop-notification.lambda_handler",
        code: lambda.Code.fromAsset("lambda"),
        timeout: Duration.seconds(300),
        environment: {
          SLACK_WEBHOOK_URL: slackWebhookUrl,
          LOG_GROUP_NAME: taskStopEventLogGroup.logGroupName,
          IS_ALERT_ENABLED: props.isProduction.toString(),
        },
        logGroup: new logs.LogGroup(
          this, "TaskStopNotificationLambdaLogGroup",
          {
            retention: props.logRetentionDays,
            removalPolicy: RemovalPolicy.DESTROY,
          },
        ),
      },
    );

    taskStopEventLogGroup.grantRead(taskStopNotificationLambdaFunction);

    // CloudWatch LogsからLambdaへのサブスクリプションフィルターを作成
    taskStopEventLogGroup.addSubscriptionFilter('TaskStopEventSubscription', {
      destination: new logs_destinations.LambdaDestination(taskStopNotificationLambdaFunction),
      filterPattern: logs.FilterPattern.allEvents(), // すべてのログイベントを対象とする
    });

    // EventBridgeルール（CloudWatch Logsにのみ配信）
    const eventRule = new events.Rule(this, "TaskStopEventRule", {
      eventPattern: {
        source: ["aws.ecs"],
        detailType: ["ECS Task State Change"],
        detail: {
          desiredStatus: ["STOPPED"],
          lastStatus: ["STOPPED"],
          // 以下の2つの条件のいずれかを満たす場合に通知する ($orを使用)
          // 
          // 条件 A:
          //   - コンテナの exitCode が 0 ではない、または exitCode が存在しない
          //   - かつ、タスクの停止理由が以下のいずれでもない
          //     - オートスケーリングによる終了
          //     - コンテナインスタンスのDRAININGによる終了
          //     - ECSによるインフラメンテナンスによる終了
          //
          // 条件 B:
          //   - タスクの停止理由が、ELB ヘルスチェックの失敗による終了である
          $or: [
            // 条件 Aのフィルター
            {
              containers: {
                exitCode: [
                  { "anything-but": [0] },
                  { exists: false },
                ],
              },
              stoppedReason: [
                {
                  "anything-but": {
                    wildcard: [
                      "Scaling activity initiated by*",
                      "*container instance is in DRAINING state*",
                      "*ECS is performing maintenance on the underlying infrastructure hosting the task*",
                    ],
                  },
                },
              ],
            },
            // 条件 Bのフィルター
            // NOTE: ELBヘルスチェックに失敗してタスク終了したが、コンテナのexitCodeが0であるケースもあるため
            {
              stoppedReason: [
                {
                  wildcard: "Task failed ELB health checks in*",
                },
              ],
            },
          ],
        },
      },
    });

    // ターゲット: CloudWatch Logs（タスク終了イベントをログに保存）
    eventRule.addTarget(new events_targets.CloudWatchLogGroup(taskStopEventLogGroup));

    // デバッグ用のEventBridgeルールを作成
    if (props.isDebug) {
      // CloudWatch Logsグループ（すべてのタスク停止イベントを保存）
      const debugTaskStopEventLogGroup = new logs.LogGroup(this, "DebugTaskStopEventLogGroup", {
        retention: props.logRetentionDays,
        removalPolicy: RemovalPolicy.DESTROY,
      });
      // EventBridgeルール（すべてのタスク停止イベントをCloudWatch Logsに送信）
      const debugEventRule = new events.Rule(this, "DebugTaskStopEventRule", {
        eventPattern: {
          source: ["aws.ecs"],
          detailType: ["ECS Task State Change"],
          detail: {
            lastStatus: ["STOPPED"],
          },
        },
      });
      debugEventRule.addTarget(new events_targets.CloudWatchLogGroup(debugTaskStopEventLogGroup));
    }
  }
}
