#!/usr/bin/env node
import { App } from "aws-cdk-lib";
import { EcsTaskMonitoringStack } from "../lib/ecs-task-monitoring-stack";
import { getEcsTaskMonitoringStackProps } from "../props";

const app = new App();

const accountName = app.node.tryGetContext("account");
const stackProps = getEcsTaskMonitoringStackProps(accountName);

// スタックを作成
new EcsTaskMonitoringStack(app, "EcsTaskMonitoring", stackProps);
