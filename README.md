# Overview
The townhall project is a tabletop RPG web server, similar to Roll20, but designed to be more modular and API friendly.

# Testing the public server
https://nonsense.page

# Running the server locally
 - Host an Ubuntu 18.04 (or equivalent) VM
 - Clone this repository on the VM
 - Run `sudo local/install.sh` (FROM THE SAME DIRECTORY AS THIS README)
 - Run `make local`
 - Navigate to dnd.local in a browser and bypass the self signed certificate warning

## Notes
 - The dependency install script (local/install.sh) only needs to be run once. To effect changes to the running server after modifiying the code, you only need to run `make local`.
 - The install script will add the [deadsnakes repository](https://launchpad.net/~deadsnakes/+archive/ubuntu/ppa) to your system. You should be running this on a VM anyway, but if you don't trust that repository consider installing python3.7 from another source.

## Dependencies
 - [nginx](https://www.nginx.com/)
 - [python 3.7](https://www.python.org/downloads/)
 - [postgreSQL](https://www.postgresql.org/)
 - [websockets](https://pypi.org/project/websockets/)
 - [psycopg2](https://pypi.org/project/psycopg2/)
