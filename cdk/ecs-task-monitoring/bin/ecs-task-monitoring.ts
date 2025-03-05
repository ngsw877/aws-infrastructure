#!/usr/bin/env node
import {
  App,
  Fn,
  aws_logs as logs,
} from "aws-cdk-lib";
import { EcsTaskMonitoringStack } from "../lib/ecs-task-monitoring-stack";

const app = new App();

const clusterArn = Fn.importValue("EcsClusterArn");

new EcsTaskMonitoringStack(app, "EcsTaskMonitoring", {
  clusterArn: clusterArn,
  slackWebhookUrlParameterPath: "/cdk/ecs-task-monitoring/slackWebhookUrl",
  logRetentionDays: logs.RetentionDays.THREE_MONTHS,
  environment: "production",
  isDebug: true,
});
