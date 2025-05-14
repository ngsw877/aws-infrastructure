#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { GlobalStack } from "../lib/global-stack";
import { MainStack } from "../lib/main-stack";

const app = new cdk.App();

const envName = app.node.tryGetContext("env");

if (!envName) {
  console.error(
    "-cオプションでデプロイ先環境を指定してください。\n 例: cdk deploy -c env=<環境名>",
  );
  process.exit(1);
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
  cloudFrontTenantCertificates: globalStack.cloudFrontTenantCertificates,
  cloudFrontWebAcl: globalStack.cloudFrontWebAcl,
});

function getParams(envName: string) {
  try {
    const params = require(`../params/${envName}`).params;
    return params;
  } catch (error) {
    console.error(
      `環境 "${envName}" のパラメータ読み込みに失敗しました:`,
      error,
    );
    process.exit(1);
  }
}
