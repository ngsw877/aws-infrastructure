import { 
  Stack, 
  type StackProps, 
  RemovalPolicy, 
  aws_iam as iam,
  aws_lambda as lambda,
  aws_logs as logs,
} from "aws-cdk-lib";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import type { Construct } from "constructs";
import * as path from "node:path";

export class LambdaCollectionStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const SLACK_CHANNEL_ID_PARAMETER_STORE_NAME = "/test_app/slack_channel_id";
    const SLACK_TOKEN_PARAMETER_STORE_NAME = "/test_app/slack_token";

        // Lambda
        const getSlackMessageLambda = new NodejsFunction(
          this,
          "GetSlackMessageLambda",
          {
            entry: path.join(
              __dirname,
              "../lambda/get-slack-message/index.ts",
            ),
            handler: "handler",
            runtime: lambda.Runtime.NODEJS_20_X,
            environment: {
              SLACK_CHANNEL_ID_PARAMETER_STORE_NAME,
              SLACK_TOKEN_PARAMETER_STORE_NAME,
            },
          },
        );

        // 権限を追加
        getSlackMessageLambda.addToRolePolicy(new iam.PolicyStatement({
          actions: ["ssm:GetParameter"],
          resources: [
            `arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${SLACK_CHANNEL_ID_PARAMETER_STORE_NAME}`,
            `arn:${this.partition}:ssm:${this.region}:${this.account}:parameter${SLACK_TOKEN_PARAMETER_STORE_NAME}`,
          ],
        }));
    
            // Lambdaのロググループ
            new logs.LogGroup(this, `${getSlackMessageLambda.node.id}LogGroup`, {
              logGroupName: `/aws/lambda/${getSlackMessageLambda.functionName}`,
              retention: logs.RetentionDays.THREE_MONTHS,
              removalPolicy: RemovalPolicy.DESTROY,
            });
  }
}
