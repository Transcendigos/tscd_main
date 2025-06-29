DOCKER_COMPOSE_PROD=docker-compose -f infra/prod/docker-compose.yml
DOCKER_COMPOSE_DEV=docker-compose -f infra/dev/docker-compose.yml
PROJECT_DIR = $(shell pwd)

# ==================== PRODUCTION ====================
prod_build:
	$(DOCKER_COMPOSE_PROD) build

prod_up:
	$(DOCKER_COMPOSE_PROD) up -d

prod_run: prod_clean prod_build prod_up 

prod_down:
	$(DOCKER_COMPOSE_PROD) down

prod_down_all:
	$(DOCKER_COMPOSE_PROD) down
	docker-compose -f infra/prod/docker-compose.monitoring.yml down

prod_nuke:
	@echo "🧨 NUKE MODE: Shutting down and cleaning everything..."
	$(DOCKER_COMPOSE_PROD) down -v --rmi all --remove-orphans
	docker-compose -f infra/prod/docker-compose.monitoring.yml down -v --rmi all --remove-orphans
	docker system prune -f
	docker volume prune -f
	docker network prune -f
	@echo "✅ Everything has been nuked!"

prod_logs:
	$(DOCKER_COMPOSE_PROD) logs -f

prod_clean:
	$(DOCKER_COMPOSE_PROD) down -v

prod_status:
	$(DOCKER_COMPOSE_PROD) ps

prod_restart: prod_down prod_up

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

dev_nuke:
	@echo "🧨 DEV NUKE MODE: Shutting down and cleaning everything..."
	$(DOCKER_COMPOSE_DEV) down -v --rmi all --remove-orphans
	docker system prune -f
	docker volume prune -f
	docker network prune -f
	rm -rf "$(PROJECT_DIR)/frontend/dev/node_modules"
	rm -rf "$(PROJECT_DIR)/backend/node_modules"
	rm -f "$(PROJECT_DIR)/logs/backend.log"
	@echo "✅ Dev environment has been nuked!"

nuke_all:
	@echo "💥 TOTAL NUKE MODE: Cleaning everything (dev + prod)..."
	$(MAKE) dev_nuke
	$(MAKE) prod_nuke
	@echo "🔥 Everything has been completely nuked!"

.PHONY: prod_build prod_up prod_down prod_down_all prod_nuke prod_logs prod_clean prod_run prod_status prod_restart dev_up dev_down dev_logs_front dev_logs_back dev_logs_all dev_shell_front dev_shell_back dev_status dev_rebuild dev_clean dev_restart dev_nuke nuke_all