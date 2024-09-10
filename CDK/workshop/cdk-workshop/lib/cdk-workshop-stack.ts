import { Stack, StackProps } from 'aws-cdk-lib';
import { Code, Function, Runtime } from 'aws-cdk-lib/aws-lambda'
import { Construct } from 'constructs';
import { LambdaRestApi } from 'aws-cdk-lib/aws-apigateway'

export class CdkWorkshopStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // defines an AWS Lambda resource
    const hello = new Function(this, "HelloHandler", {
      runtime: Runtime.NODEJS_18_X,  // execution environment
      code: Code.fromAsset("lambda"), // code loaded from "lambda" directory
      handler: "hello.handler" // file is "hello", function is "handler"
    });

    // defines an API Gateway REST API resource backed by our "hello" function.
    const gateway = new LambdaRestApi(this, "Endpoint", {
      handler: hello,
    })

  }
}
