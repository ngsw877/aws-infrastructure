{
  region: 'ap-northeast-1',
  cluster: '{{ must_env `ECS_CLUSTER_NAME` }}',
  service: '{{ must_env `ECS_SERVICE_NAME` }}',
  service_definition: 'ecs-service-def.jsonnet',
  task_definition: 'ecs-task-def.jsonnet',
  timeout: '10m0s',
  codedeploy: {
    application_name: '{{ must_env `CODE_DEPLOY_APPLICATION_NAME` }}',
    deployment_group_name: '{{ must_env `CODE_DEPLOY_DEPLOYMENT_GROUP_NAME` }}',
  },
}
