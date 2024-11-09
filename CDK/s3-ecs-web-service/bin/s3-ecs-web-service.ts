#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { GlobalStack } from '../lib/global-stack';
import { globalStackProps } from '../params/dev';

const app = new cdk.App();
new GlobalStack(app, 'S3EcsWebServiceGlobal', globalStackProps);
