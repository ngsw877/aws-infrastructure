import type * as cdk from "aws-cdk-lib";
import type * as events from "aws-cdk-lib/aws-events";

export interface ScheduleOption {
  scheduleCron: events.CronOptions;
  isScheduleEnabled: boolean;
}

// バッチ設定
export interface BatchConfig {
  lambdaEntry: string;
  environment: Record<string, string>;
  scheduleOption: ScheduleOption;
  batchSuccessWebhookParameterStoreName: string;
  batchFailureWebhookParameterStoreName: string;
}

// スタック用のパラメータ
export interface ScheduledBatchStackParams extends cdk.StackProps {
  helloWorldBatchConfig: BatchConfig;
  restartEcsTasksBatchConfig: BatchConfig;
}
