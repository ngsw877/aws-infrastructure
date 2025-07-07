import * as path from "node:path";
import type { ScheduledBatchStackParams } from "../types/params";

// ECS設定
const ecsClusterName = "hgoe-ecs-cluster";
const ecsServiceName = "hoge-ecs-service";

// 全てのバッチ処理共通の設定
const commonBatchSettings = {
  batchSuccessWebhookParameterStoreName:
    "/scheduled-batch-dev/notifications/success-webhook-url", // バッチ処理成功の通知先チャンネルのwebhookURLが保存されているパラメータストア名
  batchFailureWebhookParameterStoreName:
    "/scheduled-batch-dev/notifications/failure-webhook-url", // バッチ処理失敗の通知先チャンネルのwebhookURLが保存されているパラメータストア名
};

export const devParams: ScheduledBatchStackParams = {
  // テストバッチ用設定
  helloWorldBatchConfig: {
    ...commonBatchSettings,
    lambdaEntry: path.join(__dirname, "../lambda/hello-world/index.ts"),
    environment: {
      TEST_MESSAGE: "hello world!",
    },
    scheduleOption: {
      scheduleCron: {
        minute: "0",
        hour: "9",
        weekDay: "*",
        month: "*",
        year: "*",
      }, // 日本時間の9時に毎日実行
      isScheduleEnabled: true,
    },
  },

  // ECSタスク再起動バッチ用設定
  restartEcsTasksBatchConfig: {
    ...commonBatchSettings,
    lambdaEntry: path.join(__dirname, "../lambda/restart-ecs-tasks/index.ts"),
    environment: {
      ECS_CLUSTER_NAME: ecsClusterName,
      ECS_SERVICE_NAME: ecsServiceName,
    },
    scheduleOption: {
      scheduleCron: {
        minute: "0",
        hour: "6",
        weekDay: "MON,FRI",
        month: "*",
        year: "*",
      }, // 日本時間で6:00に、月曜と金曜にバッチ実行
      isScheduleEnabled: false,
    },
  },
};
