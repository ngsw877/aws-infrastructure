#!/usr/bin/env node
import * as cdk from "aws-cdk-lib";
import { OidcProvidersStack } from "../lib/oidc-providers-stack";

const app = new cdk.App();

new OidcProvidersStack(app, "OidcProviders");
