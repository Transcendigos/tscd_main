DOCKER_COMPOSE=docker-compose -f infra/prod/docker-compose.yml
DOCKER_COMPOSE_DEV=docker-compose -f infra/dev/docker-compose.yml
PROJECT_DIR = $(shell pwd)

build:
	$(DOCKER_COMPOSE) build

up:
	$(DOCKER_COMPOSE) up

run: clean build up 

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f

clean:
	$(DOCKER_COMPOSE) down -v

# -------------------- DEV --------------------
dev_init:
	@if [ ! -f frontend/dev/package.json ]; then \
		echo "Error: package.json not found. Please create it first."; \
		exit 1; \
	fi
	@rm -f "$(PROJECT_DIR)/frontend/dev/package-lock.json"
	@touch "$(PROJECT_DIR)/frontend/dev/package-lock.json"
	@docker run --rm \
		-v "$(PROJECT_DIR)/frontend/dev/package.json:/app/package.json" \
		-v "$(PROJECT_DIR)/frontend/dev/package-lock.json:/app/package-lock.json" \
		-v "$(PROJECT_DIR)/frontend/dev/node_modules:/app/node_modules" \
		-w /app node:20 \
		npm install --no-audit --no-progress
	@echo "Host node_modules and package-lock.json are ready."

dev_up:
	$(DOCKER_COMPOSE_DEV) up --build -d

dev_down:
	$(DOCKER_COMPOSE_DEV) down --remove-orphans

dev_logs:
	$(DOCKER_COMPOSE_DEV) logs -f web

dev_shell:
	$(DOCKER_COMPOSE_DEV) exec web sh

dev_clean:
	$(DOCKER_COMPOSE_DEV) down -v --rmi local # -v removes volumes, --rmi local removes images for services without custom names
	rm -rf "$(PROJECT_DIR)/frontend/dev/node_modules"
	rm -f "$(PROJECT_DIR)/frontend/dev/package-lock.json"
	rm -f "$(PROJECT_DIR)/logs/backend.log"

dev_restart: dev_down dev_clean dev_init dev_up



.PHONY: build up down logs clean dev_init dev_up dev_down dev_logs dev_shell dev_clean dev_restart