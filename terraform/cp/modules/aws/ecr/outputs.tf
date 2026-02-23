output "url_slack_metrics" {
  value = module.ecr_slack_metrics.repository_url
}

output "url_db_migrator" {
  value = module.ecr_db_migrator.repository_url
}

output "url_cost_aggregator" {
  value = module.ecr_cost_aggregator.repository_url
}
output "url_cost_provider" {
  value = module.ecr_cost_provider.repository_url
}