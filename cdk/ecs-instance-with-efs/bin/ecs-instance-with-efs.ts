#!/usr/bin/env node
import * as cdk from 'aws-cdk-lib';
import { EcsInstanceWithEfsStack } from '../lib/ecs-instance-with-efs-stack';

const app = new cdk.App();
new EcsInstanceWithEfsStack(app, 'EcsInstanceWithEfs', {});