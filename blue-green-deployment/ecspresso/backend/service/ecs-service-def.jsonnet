local subnets = import '../lib/subnets.libsonnet';
local tags = import '../lib/tags.libsonnet';
local env = import '../outputs/env.json';

{
  deploymentConfiguration: {
    maximumPercent: 200,
    minimumHealthyPercent: 100,
  },
  deploymentController: {
    type: 'CODE_DEPLOY',
  },
  // desiredCount: {{ must_env `BACKEND_ECS_TASK_DESIRED_COUNT` }}   もしくは
  // desiredCount: '{{ must_env `BACKEND_ECS_TASK_DESIRED_COUNT` }}' と設定したいところだが、型エラーとなるため回避策としてjsonファイルから環境変数を読み込ませる
  desiredCount: std.parseInt(env.BACKEND_ECS_TASK_DESIRED_COUNT),
  enableECSManagedTags: true,
  enableExecuteCommand: true,
  healthCheckGracePeriodSeconds: 300,
  launchType: 'FARGATE',
  loadBalancers: [
    {
      containerName: 'web',
      containerPort: 80,
      targetGroupArn: '{{ must_env `TargetGroupArn` }}',
    },
  ],
  networkConfiguration: {
    awsvpcConfiguration: {
      assignPublicIp: 'DISABLED',
      securityGroups: [
        '{{ must_env `BackendSecurityGroup` }}',
      ],
      subnets: subnets,
    },
  },
  platformFamily: 'Linux',
  platformVersion: '1.4.0',
  propagateTags: 'TASK_DEFINITION',
  schedulingStrategy: 'REPLICA',
  serviceName: '{{ must_env `ECS_SERVICE_NAME` }}',
  tags: tags,
}
