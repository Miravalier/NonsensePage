DOMAIN = nonsense.local

.PHONY: help frontend frontend-deps backend nginx

help:
	@echo "make help"
	@echo "  Display this message"
	@echo
	@echo "make frontend-deps"
	@echo "  Download frontend dependencies and build frontend compiler container"
	@echo
	@echo "make frontend"
	@echo "  Compile the front-end and deploy dist files"
	@echo
	@echo "make backend"
	@echo "  Start the backend in DEBUG mode (requires docker and docker-compose)"
	@echo
	@echo "sudo make nginx"
	@echo "  Serve the application on the provided DOMAIN."


frontend-deps:
	./tools/nonsense-frontend-compiler/build.sh
	docker run --rm --user $(shell id -u):$(shell id -g) -w /app/frontend -v $(CURDIR):/app nonsense-frontend-compiler npm install

frontend:
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	sudo mkdir -p /var/www/nonsense/ /var/www/nonsense/files/ /var/www/nonsense/thumbnails/
	docker run --rm --user $(shell id -u):$(shell id -g) -w /app/frontend -v $(CURDIR):/app nonsense-frontend-compiler npx vite build
	sudo cp -r frontend/dist/* /var/www/nonsense
	rm -rf frontend/dist

backend:
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	docker-compose down
	docker-compose build
	docker-compose up -d

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
	@echo "Nonsense Page reachable at http://$(DOMAIN)/"
