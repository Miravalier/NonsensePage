# Overview
Nonsense Page is a self-hosted tabletop RPG server written in vanilla JS and Python.

# Testing Locally
- Install dependencies
  - docker
  - docker-compose
  - nginx
- Create .env file
  - Copy example.env to .env and edit it, pick a random admin key
- Build the frontend compiler container (needed for `make frontend`)
  - `tools/nonsense-frontend-compiler/build.sh`
- Start services
  - `sudo make nginx`
  - `make frontend`
  - `make backend`
- Create an admin user: `python3 tools/admin.py -h`
- Open http://nonsense.local/ in a browser
- Right click on the background to get a context menu to open windows
