# Overview
The townhall project is a tabletop RPG web server, similar to Roll20, but designed to be more modular and API friendly.

# Running the server
## Dependencies
 - A web server (apt install nginx)
 - Valid SSL/TLS certificate (https://certbot.eff.org/)
 - Python 3.7 (apt install python3.7)
 - PostgreSQL (https://www.postgresql.org/)
 - websockets (python3.7 -m pip install websockets)
 - psycopg2 (python3.7 -m pip install psycopg2)

## Setup
 - Configure your web server and update the targets.json to make your web server's file structure.
 - Run `sudo python3.7 installer.py` to move the resources to their proper directories.

# Details
## installer.py
The installer reads from targets.json and copies files from the project source directory to their destinations on the web server. Similar to make, the modified timestamp is checked so that files that haven't changed since the last run of installer.py aren't copied. An example targets.json is provided.
