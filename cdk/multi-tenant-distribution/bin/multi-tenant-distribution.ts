#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { MultiTenantDistributionStack } from '../lib/multi-tenant-distribution-stack';

const app = new cdk.App();
new MultiTenantDistributionStack(app, 'MultiTenantDistributionStack', {
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  tenants: [
    { domainName: 'test.sample-app.click', hostedZoneId: "Z0372426ZZN6ZE3955PX" },
    { domainName: 'test.hoge-app.click',  hostedZoneId: "Z0115196QYID03JYBNOI" },
  ],
});