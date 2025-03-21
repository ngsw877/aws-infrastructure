import { 
  Duration,
  aws_logs as logs,
  aws_rds as rds
} from "aws-cdk-lib";
import type { AppDomainProps, GlobalStackProps, MainStackProps, Params } from "../types/params";

const appDomainProps: AppDomainProps = {
  route53HostedZoneId: "Z0201048170ZNG2QS3LN1",
  appDomainName: "dev.s3-ecs-web-service.sample-app.click",
};

// スナップショットテスト用
const dummyAccountId = "123456789012";

const globalStackProps: GlobalStackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || dummyAccountId,
    region: "us-east-1",
  },
  crossRegionReferences: true,
  ...appDomainProps,
  // allowedIpAddresses: [
  //   "192.0.2.1/32",
  //   "192.0.2.2/32"
  // ],
};

const mainStackProps: MainStackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT || dummyAccountId,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
  ...appDomainProps,
  envName: "dev",
  natGatewaysCount: 1,
  logRetentionDays: logs.RetentionDays.ONE_MONTH,
  defaultTtl: Duration.days(1),
  maxTtl: Duration.days(365),
  minTtl: Duration.seconds(0),
  healthCheckPath: "/",
  backendEcsTaskCpu: 1024,
  backendEcsTaskMemory: 2048,
  backendMaxTaskCount: 1,
  backendMinTaskCount: 1,
  backendDesiredCount: 1,
  backendEcsScaleOutPeriod: Duration.seconds(300),
  backendEcsScaleOutEvaluationPeriods: 3,
  backendEcsScaleInPeriod: Duration.seconds(300),
  backendEcsScaleInEvaluationPeriods: 3,
  appDebug: true,
  postgresVersion: rds.AuroraPostgresEngineVersion.VER_16_3,
  postgresClientVersion: 16,
  auroraServerlessV2MinCapacity: 0.5,
  auroraServerlessV2MaxCapacity: 4,
  ecsSchedulerState: "DISABLED",
  auroraSchedulerState: "DISABLED",
  slackWorkspaceId: "T0xxxxxxxx",
  warningSlackChannelId: "C0xxxxxxxx",
  githubOrgName: "ngsw877",
  githubRepositoryName: "aws-infrastructure",
  albDeletionProtection: false,
  auroraDeletionProtection: false,
};

export const params: Params = {
  globalStackProps: globalStackProps,
  mainStackProps: mainStackProps,
};
