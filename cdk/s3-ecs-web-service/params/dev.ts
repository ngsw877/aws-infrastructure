import {aws_logs as logs, aws_rds as rds, Duration} from "aws-cdk-lib";
import type {CommonStackProps, GlobalStackProps, MainStackProps, Params, Tenant,} from "../types/params";
import {devSecrets} from "./secrets";
// スナップショットテスト用
const dummyAccountId = "123456789012";

// 共通のIP制限除外パス
const commonIpRestrictionExcludedPaths = [
    "/sample",
    "/product",
    "/login",
    "/register",
    "/_nuxt/", // Nuxt.jsのアセット
];

// マルチドメイン対応のテナント設定
const tenants: Tenant[] = [
    // テナント1
    {
        route53HostedZoneId: "Z0201048170ZNG2QS3LN1",
        appDomainName: "dev.s3-ecs-web-service.sample-app.click",
        allowedIpAddresses: devSecrets.allowedIpAddresses,
        ipRestrictionExcludedPaths: commonIpRestrictionExcludedPaths,
        isSesEnabled: true,
    },
    // テナント2
    {
        route53HostedZoneId: "Z01140211URKT1J60WTA5",
        appDomainName: "dev.s3-ecs-web-service.hoge-app.click",
        // IP制限なし
        isSesEnabled: true,
    },
    // テナント3
    {
        route53HostedZoneId: "Z10072973EOGDWG5ZALL3",
        appDomainName: "dev.s3-ecs-web-service.example.click",
        // IP制限なし
        isSesEnabled: false,
    },
];

const commonStackProps: CommonStackProps = {
    crossRegionReferences: true,
    envName: "dev",
    tenants: tenants,
    logRetentionDays: logs.RetentionDays.THREE_MONTHS,
};

const globalStackProps: GlobalStackProps = {
    ...commonStackProps,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT || dummyAccountId,
        region: "us-east-1",
    },
};

const mainStackProps: MainStackProps = {
    ...commonStackProps,
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT || dummyAccountId,
        region: "ap-northeast-1",
    },
    natGatewaysCount: 1,
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
    isReadReplicaEnabled: false,
    auroraServerlessV2MinCapacity: 0.5,
    auroraServerlessV2MaxCapacity: 4,
    ecsSchedulerState: "ENABLED",
    auroraSchedulerState: "ENABLED",
    dmarcReportEmail: devSecrets.dmarcReportEmail,
    slackWorkspaceId: devSecrets.slack.workspaceId,
    warningSlackChannelId: devSecrets.slack.warningChannelId,
    githubOrgName: "ngsw877",
    githubRepositoryName: "aws-infrastructure",
    albDeletionProtection: false,
    auroraDeletionProtection: false,
};

export const params: Params = {
    globalStackProps: globalStackProps,
    mainStackProps: mainStackProps,
};
