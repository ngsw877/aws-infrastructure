output "dns_name_cp" {
  value = aws_lb.cp.dns_name
}

// 東京リージョンのゾーンID(固定)
output "zone_id_ap_northeast_1" {
  value = "Z14GRHDCWA56QT"
}