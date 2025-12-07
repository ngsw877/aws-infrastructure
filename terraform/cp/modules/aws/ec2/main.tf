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