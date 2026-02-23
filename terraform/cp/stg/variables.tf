locals {
  env                    = "stg"
  account_id             = "374146079343"
  region                 = "ap-northeast-1"
  base_host              = "stg.ngsw-app.click"
  slack_metrics_host     = "sm.${local.base_host}"
  slack_metrics_api_host = "sm-api.${local.base_host}"
  cost_api_host          = "cost-api.${local.base_host}"
  public_subnet_ids = [
    module.subnet.id_public_1a,
    module.subnet.id_public_1c
  ]
  private_subnet_ids = [
    module.subnet.id_private_1a,
    module.subnet.id_private_1c
  ]
  private_subnet_cidr_blocks = [
    module.subnet.cidr_block_private_1a,
    module.subnet.cidr_block_private_1c,
  ]

  // retrieve from secret manager
  # datadog_keys = jsondecode(
  #   data.aws_secretsmanager_secret_version.datadog_keys.secret_string
  # )
  datadog_apm_view_url_cost_provider = "https://ap1.datadoghq.com/apm/entity/service%3Acost-provider?dependencyMap.showNetworkMetrics=false&deployments=qson%3A%28data%3A%28hits%3A%28selected%3Aversion_count%29%2Cerrors%3A%28selected%3Aversion_count%29%2Clatency%3A%28selected%3Ap95%29%2CtopN%3A%2110%29%2Cversion%3A%210%29&env=stg&fromUser=false&graphType=flamegraph&groupMapByOperation=null&operationName=http.request&panels=qson%3A%28data%3A%28%29%2Cversion%3A%210%29&shouldShowLegend=true&spanKind=server&traceQuery=&start=1762381862440&end=1762385462440&paused=false"
}

# data "aws_secretsmanager_secret_version" "datadog_keys" {
#   secret_id = "datadog-keys-${local.env}"
# }
