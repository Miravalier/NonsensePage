# Overview
Nonsense Page is a self-hosted tabletop RPG server written in TS and Python.

# Testing Locally
- Install dependencies
  - Docker Engine (https://docs.docker.com/engine/install/)
- Create .env file
  - Copy example.env to .env and edit it, pick a random admin key
- Build the frontend dependencies (needed for `make frontend`)
  - `make frontend-deps`
- Start services
  - `make frontend`
  - `make backend`
- Install dependencies for the admin tool: `pip install -r tools/requirements.txt`
- Create an admin user: `python3 tools/admin.py -h`
- Open http://localhost:8080/ in a browser (or whichever HTTP port you picked in .env)
- Right click on the background to get a context menu to open windows
