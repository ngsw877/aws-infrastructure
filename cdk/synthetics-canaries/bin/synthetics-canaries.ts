#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { SyntheticsCanariesStack } from '../lib/synthetics-canaries-stack';

const app = new cdk.App();
new SyntheticsCanariesStack(app, 'SyntheticsCanariesStack', {
  env: { 
    account: process.env.CDK_DEFAULT_ACCOUNT, 
    region: process.env.CDK_DEFAULT_REGION 
  },
  description: 'CloudWatch Synthetics Canary for monitoring Example.com availability'
});