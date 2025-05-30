.PHONY: help frontend-deps frontend backend release down


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
	@echo "  Start the backend on localhost"
	@echo
	@echo "make release"
	@echo "  Run the frontend and backend in release configuration"
	@echo
	@echo "make down"
	@echo "  Remove all created containers"


frontend-deps:
	./tools/nonsense-frontend-compiler/build.sh
	docker run --rm --user $(shell id -u):$(shell id -g) -w /app/frontend -v $(CURDIR):/app nonsense-frontend-compiler yarn


frontend:
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	@. ./.env; sudo mkdir -p $$WEB_ROOT/files/ $$WEB_ROOT/thumbnails/
	docker run --rm --user $(shell id -u):$(shell id -g) -w /app/frontend -v $(CURDIR):/app nonsense-frontend-compiler yarn run vite build
	@. ./.env; sudo rm -rf $$WEB_ROOT/assets
	@. ./.env; sudo cp -r frontend/dist/* $$WEB_ROOT/
	@rm -rf frontend/dist


backend:
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	docker compose down
	docker compose build
	docker compose up -d
	@. ./.env; echo "[!] Debug server running on: http://127.0.0.1:$$HTTP_PORT"


release: frontend
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	docker compose -f docker-compose.release.yml down
	docker compose -f docker-compose.release.yml build
	docker compose -f docker-compose.release.yml up -d

down:
	@if [ ! -f .env ]; then \
		echo "No .env found in $$PWD; copy example.env to .env and edit it"; \
		exit 1; \
	fi
	docker compose down
