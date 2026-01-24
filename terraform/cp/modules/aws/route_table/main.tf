/************************************************************
public route table
************************************************************/
resource "aws_route_table" "public" {
  vpc_id = var.vpc_id
  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = var.internet_gateway_id
  }
  tags = {
    Name = "cp-rtb-public-${var.env}"
  }
}

resource "aws_route_table_association" "public" {
  count          = length(var.public_subnets)
  route_table_id = aws_route_table.public.id
  subnet_id      = var.public_subnets[count.index]
}

/************************************************************
private route table
************************************************************/
resource "aws_route_table" "private" {
  vpc_id = var.vpc_id

  // MEMO: ネットワークインターフェースが存在しない場合はインターネットへのルートを作成しない
  dynamic "route" {
    for_each = var.nat_network_interface_id != null ? [1] : []
    content {
      cidr_block           = "0.0.0.0/0"
      network_interface_id = var.nat_network_interface_id
    }
  }

  tags = {
    Name = "cp-rtb-private-${var.env}"
  }
}

resource "aws_route_table_association" "private" {
  count          = length(var.private_subnets)
  route_table_id = aws_route_table.private.id
  subnet_id      = var.private_subnets[count.index]
}
