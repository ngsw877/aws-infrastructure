#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GlobalStack } from '../lib/global-stack';
import { MainStack } from '../lib/main-stack';
import { params as devParams } from '../params/dev';
import { params as stgParams } from '../params/stg';
import { params as prodParams } from '../params/prod';

const app = new cdk.App();

const envName = app.node.tryGetContext('env');

if (!["dev", "stg", "prod"].includes(envName)) {
	throw new Error(`無効な環境です。デプロイ時には 'dev', 'stg', または 'prod' を指定してください。\n例: cdk deploy -c env=dev`);
}

const params = getParams(envName);

const globalStack = new GlobalStack(app, `${envName}-S3EcsWebServiceGlobal`, params.globalStackProps);

new MainStack(app, `${envName}-S3EcsWebServiceMain`, {
  ...params.mainStackProps,
  cloudfrontCertificate: globalStack.cloudfrontCertificate,
  hostedZone: globalStack.hostedZone,
});

function getParams(envName: "dev" | "stg" | "prod") {
	switch (envName) {
		case "dev":
			return devParams;
		case "stg":
			return stgParams;
		case "prod":
			return prodParams;
	}
}
