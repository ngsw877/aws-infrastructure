#!/usr/bin/env node
import "source-map-support/register";
import * as cdk from "aws-cdk-lib";
import { LambdaCollectionStack } from "../lib/lambda-collection-stack";

const app = new cdk.App();
new LambdaCollectionStack(app, "LambdaCollection", {});
