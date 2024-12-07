import type {
  StackProps,
  Duration,
  aws_certificatemanager as acm,
  aws_logs as logs,
  aws_wafv2 as wafv2,
} from "aws-cdk-lib";

export type EnvName = "dev" | "stg" | "prod";
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
  envName: EnvName;
  natGatewaysCount: number;
  logRetentionDays?: logs.RetentionDays;
  defaultTtl?: Duration;
  maxTtl?: Duration;
  minTtl?: Duration;
  backendEcsTaskCpu: number;
  backendEcsTaskMemory: number;
  backendMaxTaskCount: number;
  backendMinTaskCount: number;
  backendDesiredCount: number;
  backendEcsScaleOutPeriod: Duration;
  backendEcsScaleOutEvaluationPeriods: number;
  backendEcsScaleInPeriod: Duration;
  backendEcsScaleInEvaluationPeriods: number;
  appDebug: boolean;
  ecsStartSchedulerState: SchedulerState;
  ecsStopSchedulerState: SchedulerState;
  githubOrgName: string;
  githubRepositoryName: string;
  // 以下は、GlobalStackのスタックからインポートする
  cloudfrontCertificate?: acm.ICertificate;
  cloudFrontWebAcl?: wafv2.CfnWebACL;
}

export interface Params {
  globalStackProps: GlobalStackProps;
  mainStackProps: MainStackProps;
}
