#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GlobalStack } from '../lib/global-stack';
import { globalStackProps as devGlobalStackProps } from '../params/dev';
import { globalStackProps as stgGlobalStackProps } from '../params/stg';
import { globalStackProps as prodGlobalStackProps } from '../params/prod';

const app = new cdk.App();

const envName = app.node.tryGetContext('env');

if (!["dev", "stg", "prod"].includes(envName)) {
	throw new Error(`無効な環境です。デプロイ時には 'dev', 'stg', または 'prod' を指定してください。\n例: cdk deploy -c env=dev`);
}

new GlobalStack(app, `${envName}-S3EcsWebServiceGlobal`, getGlobalStackProps(envName));

function getGlobalStackProps(envName: "dev" | "stg" | "prod") {
	switch (envName) {
		case "dev":
			return devGlobalStackProps;
		case "stg":
			return stgGlobalStackProps;
		case "prod":
			return prodGlobalStackProps;
	}
}
