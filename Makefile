DOCKER_COMPOSE_PROD=docker-compose -f infra/prod/docker-compose.yml
DOCKER_COMPOSE_DEV=docker-compose -f infra/dev/docker-compose.yml
PROJECT_DIR = $(shell pwd)

# ==================== PRODUCTION ====================
build:
	$(DOCKER_COMPOSE_PROD) build

up:
	$(DOCKER_COMPOSE_PROD) up

run: clean build up 

down:
	$(DOCKER_COMPOSE_PROD) down

logs:
	$(DOCKER_COMPOSE_PROD) logs -f

clean:
	$(DOCKER_COMPOSE_PROD) down -v

# ==================== DEVELOPMENT ====================
dev_up:
	$(DOCKER_COMPOSE_DEV) up --build -d

dev_down:
	$(DOCKER_COMPOSE_DEV) down --remove-orphans

dev_logs_front:
	$(DOCKER_COMPOSE_DEV) logs -f frontend

dev_logs_back:
	$(DOCKER_COMPOSE_DEV) logs -f backend

dev_logs_all:
	$(DOCKER_COMPOSE_DEV) logs -f

dev_shell_front:
	$(DOCKER_COMPOSE_DEV) exec frontend sh

dev_shell_back:
	$(DOCKER_COMPOSE_DEV) exec backend sh

dev_status:
	$(DOCKER_COMPOSE_DEV) ps

dev_rebuild:
	$(DOCKER_COMPOSE_DEV) up --build --force-recreate -d

dev_clean:
	$(DOCKER_COMPOSE_DEV) down -v --rmi local
	rm -rf "$(PROJECT_DIR)/frontend/dev/node_modules"
	rm -rf "$(PROJECT_DIR)/backend/node_modules"
	rm -f "$(PROJECT_DIR)/logs/backend.log"

dev_restart: dev_down dev_clean dev_up


.PHONY: build up down logs clean dev_up dev_down dev_logs_front dev_logs_back dev_logs_all dev_shell_front dev_shell_back dev_status dev_rebuild dev_clean dev_restart