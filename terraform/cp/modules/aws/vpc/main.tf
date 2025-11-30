resource "aws_vpc" "cp" {
  cidr_block = "10.0.0.0/16"
  tags = {
    Name = "cp-${var.env}"
  }
}
