import * as cdk from 'aws-cdk-lib';
import { Construct } from 'constructs';
import * as cognito from "aws-cdk-lib/aws-cognito";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as iam from "aws-cdk-lib/aws-iam";
import * as path from 'path';

export class CognitoStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);
    
    // Cognito User Pool
    const userPool = new cognito.UserPool(this, "MyUserPool", {
      userPoolName: "MyUserPool",
      selfSignUpEnabled: true,
      signInAliases: {
        email: false,
        username: true,
      },
      standardAttributes: {
        email: {
          required: false,
          mutable: true,
        },
      },
      passwordPolicy: {
        minLength: 8,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: true,
      },
      accountRecovery: cognito.AccountRecovery.NONE,
      removalPolicy: cdk.RemovalPolicy.RETAIN,
      mfa: cognito.Mfa.OFF,
      lambdaTriggers: {
        preSignUp: new lambda.Function(this, "PreSignUpAutoConfirmFunction", {
          runtime: lambda.Runtime.PYTHON_3_13,
          handler: 'pre_sign_up.lambda_handler',
          code: lambda.Code.fromAsset(path.join(__dirname, '../lambda')),
          timeout: cdk.Duration.seconds(3),
        }),
      },
    });

    // User Pool Client
    new cognito.UserPoolClient(
      this,
      "MyUserPoolClient",
      {
        userPool,
        generateSecret: true,
        authFlows: {
          adminUserPassword: true,
          userPassword: true,
          userSrp: true,
        },
        accessTokenValidity: cdk.Duration.days(1),
      }
    );

    // Cognito用のポリシー
    new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'cognito-idp:AdminSetUserPassword',
      ],
      resources: [userPool.userPoolArn],
    });

  }
}
