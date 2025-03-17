import { aws_logs as logs, type StackProps } from "aws-cdk-lib";

export interface EcsTaskMonitoringStackProps extends StackProps {
  logRetentionDays: logs.RetentionDays;
  slackWebhookUrlParameterPath: string;
  isProduction: boolean;
  isDebug?: boolean;
}

// アカウントごとのEcsTaskMonitoringStackPropsを定義
export const accountStackPropsMap: Record<string, EcsTaskMonitoringStackProps> = {
  // 開発系アカウント
  "aws-dev-account": {
    env: {
      account: "111111111111",
      region: "ap-northeast-1",
    },
    slackWebhookUrlParameterPath: "/cdk/ecs-task-monitoring/slackWebhookUrl",
    logRetentionDays: logs.RetentionDays.THREE_MONTHS,
    isProduction: false,
    isDebug: true,
  },
  "aws-stg-account": {
    env: {
      account: "222222222222",
      region: "ap-northeast-1",
    },
    slackWebhookUrlParameterPath: "/cdk/ecs-task-monitoring/slackWebhookUrl",
    logRetentionDays: logs.RetentionDays.THREE_MONTHS,
    isProduction: false,
    isDebug: true,
  },
  
  // 本番系アカウント
  "aws-prod-account": {
    env: {
      account: "333333333333",
      region: "ap-northeast-1",
    },
    slackWebhookUrlParameterPath: "/cdk/ecs-task-monitoring/slackWebhookUrl",
    logRetentionDays: logs.RetentionDays.ONE_YEAR,
    isProduction: true,
    isDebug: false,
  },

  // 必要に応じて他のアカウントも追加
  
};

// アカウント名からスタックプロパティを取得する関数（アロー関数版）
export const getEcsTaskMonitoringStackProps = (accountName: string): EcsTaskMonitoringStackProps => {
  // 指定されたアカウント名が存在するかチェック
  const stackProps = accountStackPropsMap[accountName];
  if (!stackProps) {
    const errorMessage = !accountName 
      ? "アカウント名を指定してください。例: npx cdk deploy --c account=aws-dev-account" 
      : `不明なアカウント: ${accountName}`;
    
    console.error(errorMessage);
    console.error(`利用可能なアカウント: ${Object.keys(accountStackPropsMap).join(", ")}`);
    process.exit(1);
  }
  
  return stackProps;
};