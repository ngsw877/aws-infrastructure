import { Stack, type StackProps, CfnOutput } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import type { Construct } from 'constructs';

export class OidcProvidersStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // GitHub Actions用のOIDCプロバイダー
    const githubActionsOidcProvider = new iam.OpenIdConnectProvider(this, "GitHubActionsOidcProvider", {
      url: "https://token.actions.githubusercontent.com",
      clientIds: ["sts.amazonaws.com"],
      thumbprints: ["ffffffffffffffffffffffffffffffffffffffff"],
    });

    new CfnOutput(this, "GitHubActionsOidcProviderArn", {
      value: githubActionsOidcProvider.openIdConnectProviderArn,
      exportName: "GitHubActionsOidcProviderArn",
    });
  }
} 