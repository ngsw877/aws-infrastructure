local app_environment = import 'environment.libsonnet';
local app_secrets = import 'secrets.libsonnet';

{
  cpu: 0,
  dependsOn: [
    {
      condition: 'HEALTHY',
      containerName: 'log_router',
    },
  ],
  dockerLabels: {},
  environment: app_environment,
  secrets: app_secrets,
  essential: true,
  image: '{{ must_env `EcrRepositoryUri` }}:{{ must_env `APP_IMAGE_TAG` }}',
  logConfiguration: {
    logDriver: 'awsfirelens',
    options: {},
  },
  name: 'app',
  readonlyRootFilesystem: false,
}
