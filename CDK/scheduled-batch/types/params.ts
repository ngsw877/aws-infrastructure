import type * as cdk from "aws-cdk-lib";
import type * as events from "aws-cdk-lib/aws-events";

export interface ScheduleOption {
  scheduleCron: events.CronOptions;
  isScheduleEnabled: boolean;
}

// 全てのバッチ処理共通の設定
export interface CommonBatchProps {
  batchSuccessWebhookParameterStoreName: string;
  batchFailureWebhookParameterStoreName: string;
}

// ECSタスク再起動バッチ用Props
export interface RestartEcsTasksBatchProps extends CommonBatchProps {
  ecsClusterName: string;
  ecsServiceName: string;
  scheduleOption: ScheduleOption;
}

// スタック用のパラメータ
export interface ScheduledBatchStackParams extends cdk.StackProps {
  restartEcsTasksBatchProps: RestartEcsTasksBatchProps;
}
