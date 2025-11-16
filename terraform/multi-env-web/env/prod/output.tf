output "web_addr" {
  value = "http://${module.web.web_ec2_public_ip}"
}