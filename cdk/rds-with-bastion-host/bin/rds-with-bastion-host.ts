#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { RdsWithBastionHostStack } from '../lib/rds-with-bastion-host-stack';

const app = new cdk.App();
new RdsWithBastionHostStack(app, 'RdsWithBastionHost', {});