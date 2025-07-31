local app = import '../lib/app/container-def.libsonnet';
local log_router = import '../lib/log-router/container-def.libsonnet';
local web = import '../lib/web/container-def.libsonnet';
local tags = import '../lib/tags.libsonnet';

{
  containerDefinitions: [
    app,
    log_router,
    web,
  ],
  family: '{{ must_env `STACK_NAME` }}-web-back',
  cpu: '{{ must_env `BACKEND_ECS_TASK_CPU` }}',
  memory: '{{ must_env `BACKEND_ECS_TASK_MEMORY` }}',
  executionRoleArn: '{{ must_env `ExecutionRoleArn` }}',
  taskRoleArn: '{{ must_env `TaskRoleArn` }}',
  ipcMode: '',
  networkMode: 'awsvpc',
  pidMode: '',
  requiresCompatibilities: [
    'FARGATE',
  ],
  tags: tags,
}
