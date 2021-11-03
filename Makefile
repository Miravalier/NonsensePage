DOMAIN = townhall.local

.PHONY: help nginx server client pfx

help:
	@echo "make help"
	@echo "  Display this message"
	@echo
	@echo "make server"
	@echo "  Start the server (requires docker and docker-compose)"
	@echo
	@echo "make client"
	@echo "  Run the client in DEBUG mode"
	@echo
	@echo "sudo make nginx"
	@echo "  Serve the application on the domain $(DOMAIN)"
	@echo
	@echo "make pfx"
	@echo "  Create a self-signed pfx file for windows"

server:
	@if [ ! -f .env ]; then \
			echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
			exit 1; \
		fi
	docker-compose down
	docker-compose build
	docker-compose up -d

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
	@echo "Townhall reachable at http://$(DOMAIN)/"

pfx:
	openssl req -x509 -newkey rsa:4096 -keyout townhall.key -out townhall.crt -sha256 -days 3650 -nodes
	openssl pkcs12 -export -in townhall.crt -inkey townhall.key -out townhall.pfx
