resource "aws_instance" "bastion" {
  tags = {
    "Name" = "cp-bastion-${var.env}"
  }
  ami                    = var.bastion.ami_id
  iam_instance_profile   = var.bastion.iam_instance_profile
  instance_type          = "t2.micro"
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [var.bastion.security_group_id]
  source_dest_check      = true
  root_block_device {
    delete_on_termination = true
    volume_size           = var.bastion.volume_size
    volume_type           = "gp3"
  }
}

resource "aws_instance" "nat_1a" {
  tags = {
    "Name" = "cp-nat-1a-${var.env}"
  }
  ami                    = var.nat_1a.ami_id
  instance_type          = "t2.micro"
  iam_instance_profile   = var.nat_1a.iam_instance_profile
  subnet_id              = var.public_subnet_id
  vpc_security_group_ids = [var.nat_1a.security_group_id]
  source_dest_check      = false
  root_block_device {
    delete_on_termination = true
    volume_size           = 8
    volume_type           = "gp3"
  }
}