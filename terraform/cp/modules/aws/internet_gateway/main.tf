resource "aws_internet_gateway" "cp" {
  tags = {
    Name = "cp-igw-${var.env}"
  }
  vpc_id = var.vpc_id
}
