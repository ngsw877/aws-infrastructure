import * as cdk from "aws-cdk-lib";
import type { Construct } from "constructs";
import { HelloWorldBatch } from "./batches/hello-world";
import { RestartEcsTasksBatch } from "./batches/restart-ecs-tasks-batch";
import type { ScheduledBatchStackParams } from "../types/params";

export class ScheduledBatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ScheduledBatchStackParams) {
    super(scope, id, props);

    // テストバッチ
    new HelloWorldBatch(
      this,
      "HelloWorldBatch",
      props.helloWorldBatchProps,
    );

    // 指定したECSタスクの再起動バッチ
    new RestartEcsTasksBatch(
      this,
      "RestartEcsTasksBatch",
      props.restartEcsTasksBatchProps,
    );
  }
}
