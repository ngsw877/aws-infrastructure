{
  cpu: 0,
  dockerLabels: {},
  environment: [
    {
      name: 'KINESIS_APP_DELIVERY_STREAM',
      value: '{{ must_env `KinesisAppDeliveryStream` }}',
    },
    {
      name: 'KINESIS_WEB_DELIVERY_STREAM',
      value: '{{ must_env `KinesisWebDeliveryStream` }}',
    },
  ],
  essential: true,
  firelensConfiguration: {
    options: {
      'config-file-type': 'file',
      'config-file-value': '/fluent-bit.conf',
      'enable-ecs-log-metadata': 'true',
    },
    type: 'fluentbit',
  },
  healthCheck: {
    command: [
      'CMD-SHELL',
      "echo '{\"health\": \"check\"}' | nc 127.0.0.1 8877 || exit 1",
    ],
    interval: 5,
    retries: 10,
    timeout: 2,
  },
  image: '{{ must_env `EcrRepositoryUri` }}:{{ must_env `LOG_IMAGE_TAG` }}',
  logConfiguration: {
    logDriver: 'awslogs',
    options: {
      'awslogs-create-group': 'true',
      'awslogs-group': '{{ must_env `STACK_NAME` }}',
      'awslogs-region': 'ap-northeast-1',
      'awslogs-stream-prefix': 'web-backend',
    },
  },
  name: 'log_router',
  readonlyRootFilesystem: false,
  secrets: [
    {
      name: 'SLACK_WEBHOOK_URL_LOG',
      valueFrom: '/{{ must_env `STACK_NAME` }}/log_router/slack_webhook_url',
    },
  ],
  user: '0',
}
