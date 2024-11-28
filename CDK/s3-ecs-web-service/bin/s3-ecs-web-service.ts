#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GlobalStack } from "../lib/global-stack";
import { MainStack } from "../lib/main-stack";
import type { EnvName } from "../types/params";
import { params as devParams } from "../params/dev";
import { params as stgParams } from "../params/stg";
import { params as prodParams } from "../params/prod";

const app = new cdk.App();

const envName = app.node.tryGetContext("env");

if (!["dev", "stg", "prod"].includes(envName)) {
  throw new Error(
    `無効な環境です。デプロイ時には 'dev', 'stg', または 'prod' を指定してください。\n例: cdk deploy -c env=dev`,
  );
}

// パラメータを取得
const params = getParams(envName);

// バージニアリージョン用のスタック
const globalStack = new GlobalStack(
  app,
  `${envName}-S3EcsWebServiceGlobal`,
  params.globalStackProps,
);

// 東京リージョン用のスタック
new MainStack(app, `${envName}-S3EcsWebServiceMain`, {
  ...params.mainStackProps,
  hostedZone: globalStack.hostedZone,
  cloudfrontCertificate: globalStack.cloudfrontCertificate,
  cloudFrontWebAcl: globalStack.cloudFrontWebAcl,
});

function getParams(envName: EnvName) {
  switch (envName) {
    case "dev":
      return devParams;
    case "stg":
      return stgParams;
    case "prod":
      return prodParams;
  }
}
