import { Aws, Duration, aws_logs as logs } from "aws-cdk-lib";
import type { GlobalStackProps, MainStackProps, Params } from "../types/params";

const globalStackProps: GlobalStackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "us-east-1",
  },
  crossRegionReferences: true,
  hostedZoneId: "Z03555611YEKDMTHN9OGE",
  appDomain: "dev.s3-ecs-web-service.kk-study.click",
  allowedIpAddresses: [
    "192.0.2.1/32",
    "192.0.2.2/32"
  ],
};

const mainStackProps: MainStackProps = {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: "ap-northeast-1",
  },
  crossRegionReferences: true,
  envName: "dev",
  natGatewaysCount: 1,
  logRetentionDays: logs.RetentionDays.ONE_MONTH,
  defaultTtl: Duration.days(1),
  maxTtl: Duration.days(365),
  minTtl: Duration.seconds(0),
  backendEcsTaskCpu: 1024,
  backendEcsTaskMemory: 2048,
  backendMaxTaskCount: 1,
  backendMinTaskCount: 1,
  backendDesiredCount: 0,
  backendEcsScaleOutPeriod: Duration.seconds(300),
  backendEcsScaleOutEvaluationPeriods: 3,
  backendEcsScaleInPeriod: Duration.seconds(300),
  backendEcsScaleInEvaluationPeriods: 3,
  appDebug: true,
  ecsStartSchedulerState: "ENABLED",
  ecsStopSchedulerState: "ENABLED",
  githubOrgName: "hoge",
  githubRepositoryName: "s3-ecs-web-service",
};

export const params: Params = {
  globalStackProps: globalStackProps,
  mainStackProps: mainStackProps,
};
