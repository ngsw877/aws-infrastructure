#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MaintenancePageStack } from '../lib/maintenance-page-stack';

const app = new cdk.App();
new MaintenancePageStack(app, 'MaintenancePageStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: 'us-east-1',
  },
});