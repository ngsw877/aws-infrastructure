resource "aws_instance" "this" {
  ami           = "ami-07b3f199a3bed006a" # Ubuntu Server 22.04 LTS (HVM), SSD Volume Type
  instance_type = "t2.micro"

  tags = {
    Name = "workshop-instance"
  }

}