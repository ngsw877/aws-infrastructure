import * as path from "path";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { Construct } from "constructs";

export class HelloWorld extends Construct {
  constructor(scope: Construct, id: string) {
    super(scope, id);

    const helloFunction = new NodejsFunction(this, "Lambda", {
      entry: path.join(__dirname, "..", "lambda", "hallo-world", "index.ts"),
    });

    new LambdaRestApi(this, "ApiGateway", {
      handler: helloFunction,
    });
  }
}
