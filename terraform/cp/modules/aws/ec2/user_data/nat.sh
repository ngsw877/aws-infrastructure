#!/bin/bash
sudo dnf update -y
sudo dnf install iptables-services -y

sudo systemctl enable iptables
sudo systemctl start iptables

echo "net.ipv4.ip_forward=1" >> /etc/sysctl.d/custom-ip-forwarding.conf

sudo sysctl -p /etc/sysctl.d/custom-ip-forwarding.conf

sudo /sbin/iptables -t nat -A POSTROUTING -o enX0 -j MASQUERADE
sudo /sbin/iptables -F FORWARD
sudo service iptables save