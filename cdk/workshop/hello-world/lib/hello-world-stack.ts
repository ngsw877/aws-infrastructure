import { Stack, type StackProps } from "aws-cdk-lib";
import type { Construct } from "constructs";
import { HelloWorld } from "./hello-world";

export class HelloWorldStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);
    new HelloWorld(this, "Resource");
  }
}
