#!/bin/bash
if [[ $EUID != 0 ]]; then
    echo -e "\x1B[31merror\x1B[0m: install.sh must be run as root"
    exit 1
fi

#add-apt-repository -y ppa:deadsnakes/ppa
#apt-get update

apt install -y cpp
apt install -y nginx
apt install -y make
apt install -y python3.7
