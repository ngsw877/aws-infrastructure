import type * as cdk from "aws-cdk-lib";
import type { CronOptions } from "aws-cdk-lib/aws-events";

export interface ScheduleOption {
  scheduleCron: CronOptions;
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
  cleanupCfnStacksBatchConfig: BatchConfig;
}
