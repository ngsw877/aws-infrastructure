#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import {MaintenancePageStack} from '../lib/maintenance-page-stack';
import {SiteParams} from '../types/params';

const app = new cdk.App();

// コンテキストからパラメータ名を取得
const paramsName = app.node.tryGetContext('params') as string | undefined;

if (!paramsName) {
  console.error('params コンテキストを指定してください。例: cdk deploy -c params=site-1');
  process.exit(1);
}

// パラメータを動的に取得
const siteParams = getParams(paramsName);

new MaintenancePageStack(app, `MaintenancePage${paramsName}`, {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
  ...siteParams,
});

function getParams(paramsName: string): SiteParams {
  try {
    return require(`../params/${paramsName}`).params;
  } catch (error) {
    console.error(`パラメータ "${paramsName}" の読み込みに失敗しました:`, error);
    process.exit(1);
  }
}