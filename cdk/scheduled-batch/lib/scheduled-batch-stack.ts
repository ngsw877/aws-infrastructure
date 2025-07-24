import * as cdk from "aws-cdk-lib";
import * as iam from "aws-cdk-lib/aws-iam";
import type { Construct } from "constructs";
import type { ScheduledBatchStackParams } from "../types/params";
import { ScheduledBatchConstruct } from "./scheduled-batch-construct";

export class ScheduledBatchStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: ScheduledBatchStackParams) {
    super(scope, id, props);

    // テストバッチ
    new ScheduledBatchConstruct(this, "HelloWorldBatch", props.helloWorldBatchConfig);

    // 指定したECSタスクの再起動バッチ
    const restartEcsBatch = new ScheduledBatchConstruct(
      this,
      "RestartEcsTasksBatch", 
      props.restartEcsTasksBatchConfig,
    );

    // ECS固有のポリシーを追加
    restartEcsBatch.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: ["ecs:UpdateService"],
        resources: [
          `arn:aws:ecs:${this.region}:${this.account}:service/${props.restartEcsTasksBatchConfig.environment.ECS_CLUSTER_NAME}/${props.restartEcsTasksBatchConfig.environment.ECS_SERVICE_NAME}`,
        ],
      })
    );

    // CloudFormationスタック削除バッチ
    const cleanupCfnStacksBatch = new ScheduledBatchConstruct(
      this,
      "CleanupCfnStacksBatch",
      props.cleanupCfnStacksConfig,
    );

    // CloudFormation操作のポリシーを追加
    cleanupCfnStacksBatch.lambdaRole.addToPolicy(
      new iam.PolicyStatement({
        actions: [
          "cloudformation:ListStacks",
          "cloudformation:DeleteStack",
        ],
        resources: ["*"], // ListStacksは全リソースが必要
      })
    );
  }
}
