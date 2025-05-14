DOCKER_COMPOSE=docker-compose -f infra/docker-compose.yml

.PHONY: build up down logs clean

build:
	$(DOCKER_COMPOSE) build

up:
	$(DOCKER_COMPOSE) up

run: build up

down:
	$(DOCKER_COMPOSE) down

logs:
	$(DOCKER_COMPOSE) logs -f

clean:
	$(DOCKER_COMPOSE) down -v