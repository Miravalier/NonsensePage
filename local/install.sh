#!/bin/bash
if [[ $EUID != 0 ]]; then
    echo -e "\x1B[31merror\x1B[0m: install.sh must be run as root"
    exit 1
fi

apt install -y gcc nginx make postgresql postgresql-server-dev-all

python3.7 --version
if [[ $? != 0 ]]; then
	add-apt-repository -y ppa:deadsnakes/ppa
	apt-get update
	apt install -y python3.7
fi

python3.7 -m pip --version
if [[ $? != 0 ]]; then
	curl https://bootstrap.pypa.io/get-pip.py -o get-pip.py
	python3.7 get-pip.py
	rm get-pip.py
fi

python3.7 -m pip install websockets psycopg2-binary

sudo -u postgres createuser root
sudo -u postgres createdb -O root root
sudo -u postgres createdb -O root dnd
psql dnd -f sql/attr_schema.sql
psql dnd -f sql/entity_schema.sql
psql dnd -f sql/file_schema.sql
psql dnd -f sql/message_schema.sql
psql dnd -f sql/user_schema.sql
