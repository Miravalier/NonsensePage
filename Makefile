DOMAIN = canonhead.local

.PHONY: help backend frontend client nginx pfx

help:
	@echo "make help"
	@echo "  Display this message"
	@echo
	@echo "make backend"
	@echo "  Start the backend in DEBUG mode (requires docker and docker-compose)"
	@echo
	@echo "make frontend"
	@echo "  Build and host the frontend"
	@echo
	@echo "make client"
	@echo "  Run the client in DEBUG mode and connect locally."
	@echo
	@echo "sudo make nginx"
	@echo "  Serve the application on the provided DOMAIN."
	@echo
	@echo "make pfx"
	@echo "  Create a self-signed pfx file for windows"

backend:
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	docker-compose down
	docker-compose build
	docker-compose up -d

frontend:
	npm run build
	npm run host

client:
	npm start

SITE_AVAILABLE := /etc/nginx/sites-available/$(DOMAIN)
SITE_ENABLED := /etc/nginx/sites-enabled/$(DOMAIN)
RAND_OCTET=$(shell python3 -c 'import secrets; print(secrets.randbelow(256))')
nginx:
	@if [ ! -f .env ]; then \
			echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
			exit 1; \
		fi
	@rm -f "$(SITE_ENABLED)"
	@if [ -z "$$(grep "$(DOMAIN)" /etc/hosts)" ]; then \
			echo "127.$(RAND_OCTET).$(RAND_OCTET).$(RAND_OCTET) $(DOMAIN)" >> /etc/hosts; \
		fi
	cp nginx.site "$(SITE_AVAILABLE)"
	. ./.env; sed -i "s/{HTTP_PORT}/$$HTTP_PORT/" "$(SITE_AVAILABLE)"
	sed -i "s/{DOMAIN}/$(DOMAIN)/" "$(SITE_AVAILABLE)"
	ln -s "$(SITE_AVAILABLE)" "$(SITE_ENABLED)"
	service nginx restart
	@echo "canonhead reachable at http://$(DOMAIN)/"

pfx:
	openssl req -x509 -newkey rsa:4096 -keyout canonhead.key -out canonhead.crt -sha256 -days 3650 -nodes
	openssl pkcs12 -export -in canonhead.crt -inkey canonhead.key -out canonhead.pfx
