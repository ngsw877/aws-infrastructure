resource "aws_route53_zone" "zone" {
  name = var.zone_name
}

resource "aws_route53_record" "record" {
  for_each = { for r in var.records : "${r.name}-${r.type}" => r }

  zone_id = aws_route53_zone.zone.id
  name    = each.value.name
  type    = each.value.type
  ttl     = lookup(each.value, "ttl", null)
  records = lookup(each.value, "values", null)
  dynamic "alias" {
    for_each = each.value.alias != null ? [each.value.alias] : []
    content {
      zone_id                = each.value.alias.zone_id
      name                   = each.value.alias.name
      evaluate_target_health = each.value.alias.evaluate_target_health
    }
  }
}