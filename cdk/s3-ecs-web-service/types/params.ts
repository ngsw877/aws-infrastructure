import type {
  Duration,
  StackProps,
  aws_certificatemanager as acm,
  aws_logs as logs,
  aws_rds as rds,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";

type SchedulerState = "ENABLED" | "DISABLED";

// テナント情報
export interface Tenant {
  route53HostedZoneId: string;
  appDomainName: string;
  allowedIpAddresses?: string[]; // IP制限を適用する場合の許可IPアドレス一覧
  isSesEnabled: boolean;
}

// CommonStackProps インターフェースを定義
export interface CommonStackProps extends StackProps {
  envName: string; // 環境名
  tenants: Tenant[]; // テナント情報
}

// GlobalStackProps は CommonStackProps を継承
export interface GlobalStackProps extends CommonStackProps {
  logRetentionDays?: logs.RetentionDays;
  // IP制限の対象外とするパスのリスト
  ipRestrictionExcludedPaths?: string[];
}

// MainStackProps も CommonStackProps を継承
export interface MainStackProps extends CommonStackProps {
  natGatewaysCount: number;
  logRetentionDays?: logs.RetentionDays;
  defaultTtl?: Duration;
  maxTtl?: Duration;
  minTtl?: Duration;
  healthCheckPath: string;
  // ECS
  backendEcsTaskCpu: number;
  backendEcsTaskMemory: number;
  backendMaxTaskCount: number;
  backendMinTaskCount: number;
  backendDesiredCount: number;
  backendEcsScaleOutPeriod: Duration;
  backendEcsScaleOutEvaluationPeriods: number;
  backendEcsScaleInPeriod: Duration;
  backendEcsScaleInEvaluationPeriods: number;
  // appコンテナ環境変数
  appDebug: boolean;
  // DB関係
  postgresVersion: rds.AuroraPostgresEngineVersion;
  postgresClientVersion: number; // 踏み台サーバーにインストールするPostgreSQLのバージョン
  isReadReplicaEnabled?: boolean;
  auroraServerlessV2MinCapacity: number;
  auroraServerlessV2MaxCapacity: number;
  // スケジューラ
  ecsSchedulerState: SchedulerState;
  auroraSchedulerState: SchedulerState;
  // メール関係
  dmarcReportEmail: string;
  // アラート関係
  slackWorkspaceId: string;
  warningSlackChannelId: string;
  // GitHub Actions
  githubOrgName: string;
  githubRepositoryName: string;
  // 以下は、GlobalStackからインポートする
  cloudfrontCertificate?: acm.ICertificate;
  cloudFrontWebAcl?: wafv2.CfnWebACL;
  // 削除保護のプロパティ
  albDeletionProtection: boolean;
  auroraDeletionProtection: boolean;
}

export interface Params {
  globalStackProps: GlobalStackProps;
  mainStackProps: MainStackProps;
}
