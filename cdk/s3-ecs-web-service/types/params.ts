import type {
  StackProps,
  Duration,
  aws_certificatemanager as acm,
  aws_logs as logs,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";

type SchedulerState = "ENABLED" | "DISABLED";

export interface AppDomainProps {
  route53HostedZoneId: string;
  appDomainName: string;
}

export interface GlobalStackProps extends StackProps, AppDomainProps {
  logRetentionDays?: logs.RetentionDays;
  allowedIpAddresses?: string[];
}

export interface MainStackProps extends StackProps, AppDomainProps {
  envName: string;
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
  // スケジューラ
  ecsStartSchedulerState: SchedulerState;
  ecsStopSchedulerState: SchedulerState;
  // GitHub Actions
  githubOrgName: string;
  githubRepositoryName: string;
  // 以下は、GlobalStackからインポートする
  cloudfrontCertificate?: acm.ICertificate;
  cloudFrontWebAcl?: wafv2.CfnWebACL;
}

export interface Params {
  globalStackProps: GlobalStackProps;
  mainStackProps: MainStackProps;
}
