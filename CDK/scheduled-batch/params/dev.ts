import type {
  CommonBatchProps,
  ScheduledBatchStackParams,
} from "../types/params";

// 全てのバッチ処理共通の設定
const commonBatchProps: CommonBatchProps = {
  batchSuccessWebhookParameterStoreName:
    "/scheduled-batch-dev/notifications/success-webhook-url", // バッチ処理成功の通知先チャンネルのwebhookURLが保存されているパラメータストア名
  batchFailureWebhookParameterStoreName:
    "/scheduled-batch-dev/notifications/failure-webhook-url", // バッチ処理失敗の通知先チャンネルのwebhookURLが保存されているパラメータストア名
};

export const devParams: ScheduledBatchStackParams = {
  // テストバッチ用Props
  helloWorldBatchProps: {
    ...commonBatchProps,
    testMessage: "hello world!",
    scheduleOption: {
      scheduleCron: {
        minute: "0",
        hour: "0",
        weekDay: "*",
        month: "*",
        year: "*",
      }, // 日本時間の9時に毎日実行（UTC 0時）
      isScheduleEnabled: true,
    },
  },

  // ECSタスク再起動バッチ用Props
  restartEcsTasksBatchProps: {
    ...commonBatchProps,
    ecsClusterName: "hgoe-ecs-cluster",
    ecsServiceName: "hoge-ecs-service",
    scheduleOption: {
      scheduleCron: {
        minute: "0",
        hour: "21",
        weekDay: "SUN,THU",
        month: "*",
        year: "*",
      }, // UTC時間で21:00（日本時間で翌日6:00）に、月曜と金曜にバッチ実行
      isScheduleEnabled: false,
    },
  },
};
