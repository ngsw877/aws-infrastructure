import { Construct } from "constructs";
import { NodejsFunction } from "aws-cdk-lib/aws-lambda-nodejs";
import { LambdaRestApi } from "aws-cdk-lib/aws-apigateway";
import * as path from "path";

export class HelloWorld extends Construct {
	constructor(scope: Construct, id: string) {
		super(scope, id);

		const helloFunction = new NodejsFunction(this, "function", {
			entry: path.join(__dirname, "..", "lambda", "hallo-world", "index.ts"),
		});

		new LambdaRestApi(this, "apigw", {
			handler: helloFunction,
		});
	}
}
