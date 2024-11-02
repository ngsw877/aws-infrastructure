#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { ScheduledBatchStack } from "../lib/scheduled-batch-stack";
import { devParams } from "../params/dev";

const app = new cdk.App();

// 開発環境用
new ScheduledBatchStack(app, "Dev-ScheduledBatchStack", {
  ...devParams,
  env: {
    region: "ap-northeast-1",
  },
});