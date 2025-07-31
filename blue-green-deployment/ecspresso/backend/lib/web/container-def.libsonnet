{
  cpu: 0,
  dependsOn: [
    {
      condition: 'HEALTHY',
      containerName: 'log_router',
    },
  ],
  dockerLabels: {},
  essential: true,
  image: '{{ must_env `EcrRepositoryUri` }}:{{ must_env `WEB_IMAGE_TAG` }}',
  logConfiguration: {
    logDriver: 'awsfirelens',
    options: {},
  },
  name: 'web',
  portMappings: [
    {
      appProtocol: '',
      containerPort: 80,
      hostPort: 80,
      protocol: 'tcp',
    },
  ],
}
