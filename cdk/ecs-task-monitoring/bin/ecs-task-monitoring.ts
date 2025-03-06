#!/usr/bin/env node
import {
  App,
  aws_logs as logs,
} from "aws-cdk-lib";
import { EcsTaskMonitoringStack } from "../lib/ecs-task-monitoring-stack";

const app = new App();

new EcsTaskMonitoringStack(app, "EcsTaskMonitoring", {
  slackWebhookUrlParameterPath: "/cdk/ecs-task-monitoring/slackWebhookUrl",
  logRetentionDays: logs.RetentionDays.THREE_MONTHS,
  environment: "production",
  isDebug: true,
});
