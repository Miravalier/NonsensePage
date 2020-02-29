#!/bin/bash
if [[ $EUID != 0 ]]; then
    echo -e "\x1B[31merror\x1B[0m: install.sh must be run as root"
    exit 1
fi
