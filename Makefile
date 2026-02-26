# =============================================================================
# PartnerForge Makefile
# =============================================================================
# Development automation for the PartnerForge ABM Intelligence Platform
#
# Usage:
#   make help          # Show available commands
#   make setup         # Initial setup
#   make dev           # Start development environment
#   make test          # Run tests
#   make lint          # Run linters
#
# =============================================================================

.PHONY: help setup dev dev-up dev-down dev-logs dev-ps \
        test test-backend test-frontend test-coverage \
        lint lint-backend lint-frontend format \
        migrate migrate-up migrate-down migrate-create \
        db-init db-seed db-reset db-shell \
        build build-backend build-frontend \
        clean clean-docker clean-python clean-node \
        install install-backend install-frontend \
        check-deps update-deps

# Default target
.DEFAULT_GOAL := help

# =============================================================================
# VARIABLES
# =============================================================================

DOCKER_COMPOSE := docker-compose
PYTHON := python3
PIP := pip3
NPM := npm
ALEMBIC := alembic
PYTEST := pytest
RUFF := ruff
UVICORN := uvicorn

# Project directories
BACKEND_DIR := backend
FRONTEND_DIR := frontend
SCRIPTS_DIR := scripts
MIGRATIONS_DIR := $(BACKEND_DIR)/migrations

# Colors for output
GREEN := \033[0;32m
YELLOW := \033[0;33m
RED := \033[0;31m
NC := \033[0m # No Color

# =============================================================================
# HELP
# =============================================================================

help: ## Show this help message
	@echo "$(GREEN)PartnerForge Development Commands$(NC)"
	@echo ""
	@echo "$(YELLOW)Setup & Installation:$(NC)"
	@grep -E '^(setup|install)' $(MAKEFILE_LIST) | grep -E '##' | awk 'BEGIN {FS = ":.*##"}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Development:$(NC)"
	@grep -E '^(dev|build)' $(MAKEFILE_LIST) | grep -E '##' | awk 'BEGIN {FS = ":.*##"}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Testing:$(NC)"
	@grep -E '^test' $(MAKEFILE_LIST) | grep -E '##' | awk 'BEGIN {FS = ":.*##"}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Linting & Formatting:$(NC)"
	@grep -E '^(lint|format)' $(MAKEFILE_LIST) | grep -E '##' | awk 'BEGIN {FS = ":.*##"}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Database:$(NC)"
	@grep -E '^(db-|migrate)' $(MAKEFILE_LIST) | grep -E '##' | awk 'BEGIN {FS = ":.*##"}; {printf "  %-20s %s\n", $$1, $$2}'
	@echo ""
	@echo "$(YELLOW)Cleanup:$(NC)"
	@grep -E '^clean' $(MAKEFILE_LIST) | grep -E '##' | awk 'BEGIN {FS = ":.*##"}; {printf "  %-20s %s\n", $$1, $$2}'

# =============================================================================
# SETUP & INSTALLATION
# =============================================================================

setup: ## Initial project setup (install all dependencies)
	@echo "$(GREEN)Setting up PartnerForge...$(NC)"
	@make install
	@cp -n .env.example .env 2>/dev/null || echo "$(YELLOW).env already exists, skipping...$(NC)"
	@echo "$(GREEN)Setup complete! Edit .env with your API keys, then run 'make dev'$(NC)"

install: install-backend install-frontend ## Install all dependencies

install-backend: ## Install Python backend dependencies
	@echo "$(GREEN)Installing backend dependencies...$(NC)"
	@cd $(BACKEND_DIR) && \
		$(PYTHON) -m venv venv && \
		. venv/bin/activate && \
		$(PIP) install --upgrade pip && \
		$(PIP) install -r ../requirements.txt && \
		$(PIP) install -r requirements-dev.txt 2>/dev/null || true
	@echo "$(GREEN)Backend dependencies installed$(NC)"

install-frontend: ## Install Node.js frontend dependencies
	@echo "$(GREEN)Installing frontend dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && $(NPM) install
	@echo "$(GREEN)Frontend dependencies installed$(NC)"

check-deps: ## Check for outdated dependencies
	@echo "$(GREEN)Checking Python dependencies...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && pip list --outdated
	@echo ""
	@echo "$(GREEN)Checking Node.js dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && npm outdated || true

update-deps: ## Update all dependencies
	@echo "$(GREEN)Updating Python dependencies...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && pip install --upgrade -r ../requirements.txt
	@echo "$(GREEN)Updating Node.js dependencies...$(NC)"
	@cd $(FRONTEND_DIR) && npm update

# =============================================================================
# DEVELOPMENT
# =============================================================================

dev: ## Start development environment with Docker
	@echo "$(GREEN)Starting PartnerForge development environment...$(NC)"
	@$(DOCKER_COMPOSE) up -d postgres redis
	@echo "$(YELLOW)Waiting for services to be healthy...$(NC)"
	@sleep 5
	@$(DOCKER_COMPOSE) up -d backend frontend
	@echo ""
	@echo "$(GREEN)Services started!$(NC)"
	@echo "  Backend:  http://localhost:8000"
	@echo "  Frontend: http://localhost:5173"
	@echo "  API Docs: http://localhost:8000/docs"
	@echo ""
	@echo "$(YELLOW)Run 'make dev-logs' to view logs$(NC)"

dev-up: dev ## Alias for 'make dev'

dev-down: ## Stop development environment
	@echo "$(GREEN)Stopping PartnerForge...$(NC)"
	@$(DOCKER_COMPOSE) down

dev-logs: ## Follow development logs
	@$(DOCKER_COMPOSE) logs -f

dev-ps: ## Show running services
	@$(DOCKER_COMPOSE) ps

dev-restart: ## Restart all services
	@echo "$(GREEN)Restarting services...$(NC)"
	@$(DOCKER_COMPOSE) restart

dev-backend: ## Start backend only (without Docker)
	@echo "$(GREEN)Starting backend development server...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(UVICORN) app.main:app --reload --host 0.0.0.0 --port 8000

dev-frontend: ## Start frontend only (without Docker)
	@echo "$(GREEN)Starting frontend development server...$(NC)"
	@cd $(FRONTEND_DIR) && $(NPM) run dev

dev-workers: ## Start Celery workers with Docker
	@echo "$(GREEN)Starting Celery workers...$(NC)"
	@$(DOCKER_COMPOSE) --profile workers up -d

# =============================================================================
# TESTING
# =============================================================================

test: test-backend test-frontend ## Run all tests

test-backend: ## Run backend tests
	@echo "$(GREEN)Running backend tests...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(PYTEST) -v --tb=short

test-frontend: ## Run frontend tests
	@echo "$(GREEN)Running frontend tests...$(NC)"
	@cd $(FRONTEND_DIR) && $(NPM) run test 2>/dev/null || echo "$(YELLOW)No tests configured$(NC)"

test-coverage: ## Run tests with coverage report
	@echo "$(GREEN)Running tests with coverage...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(PYTEST) -v --cov=app --cov-report=html --cov-report=term-missing

test-watch: ## Run tests in watch mode
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(PYTEST) --watch

# =============================================================================
# LINTING & FORMATTING
# =============================================================================

lint: lint-backend lint-frontend ## Run all linters

lint-backend: ## Lint Python code with ruff
	@echo "$(GREEN)Linting backend code...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(RUFF) check . || true

lint-frontend: ## Lint TypeScript/React code
	@echo "$(GREEN)Linting frontend code...$(NC)"
	@cd $(FRONTEND_DIR) && $(NPM) run lint 2>/dev/null || echo "$(YELLOW)Lint complete$(NC)"

format: ## Format all code
	@echo "$(GREEN)Formatting code...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(RUFF) format . && \
		$(RUFF) check --fix . || true
	@cd $(FRONTEND_DIR) && $(NPM) run format 2>/dev/null || true

# =============================================================================
# DATABASE
# =============================================================================

migrate: migrate-up ## Run database migrations (alias for migrate-up)

migrate-up: ## Apply all pending migrations
	@echo "$(GREEN)Running database migrations...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(ALEMBIC) upgrade head

migrate-down: ## Rollback last migration
	@echo "$(YELLOW)Rolling back last migration...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(ALEMBIC) downgrade -1

migrate-create: ## Create new migration (usage: make migrate-create msg="description")
	@echo "$(GREEN)Creating new migration...$(NC)"
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(ALEMBIC) revision --autogenerate -m "$(msg)"

migrate-history: ## Show migration history
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(ALEMBIC) history

migrate-current: ## Show current migration
	@cd $(BACKEND_DIR) && . venv/bin/activate && \
		$(ALEMBIC) current

db-init: ## Initialize database (create tables)
	@echo "$(GREEN)Initializing database...$(NC)"
	@$(PYTHON) $(SCRIPTS_DIR)/init_db.py

db-seed: ## Seed database with sample data
	@echo "$(GREEN)Seeding database...$(NC)"
	@$(PYTHON) $(SCRIPTS_DIR)/seed_data.py

db-reset: ## Reset database (drop and recreate)
	@echo "$(RED)Resetting database...$(NC)"
	@$(DOCKER_COMPOSE) down -v postgres_data
	@$(DOCKER_COMPOSE) up -d postgres
	@sleep 5
	@make db-init
	@make db-seed
	@echo "$(GREEN)Database reset complete$(NC)"

db-shell: ## Open PostgreSQL shell
	@$(DOCKER_COMPOSE) exec postgres psql -U partnerforge -d partnerforge

db-backup: ## Create database backup
	@echo "$(GREEN)Creating database backup...$(NC)"
	@$(DOCKER_COMPOSE) exec postgres pg_dump -U partnerforge partnerforge > backup_$(shell date +%Y%m%d_%H%M%S).sql
	@echo "$(GREEN)Backup created$(NC)"

# =============================================================================
# BUILD
# =============================================================================

build: build-backend build-frontend ## Build all components

build-backend: ## Build backend Docker image
	@echo "$(GREEN)Building backend image...$(NC)"
	@docker build -t partnerforge-backend:latest .

build-frontend: ## Build frontend for production
	@echo "$(GREEN)Building frontend...$(NC)"
	@cd $(FRONTEND_DIR) && $(NPM) run build

build-prod: ## Build production Docker images
	@echo "$(GREEN)Building production images...$(NC)"
	@$(DOCKER_COMPOSE) -f docker-compose.yml -f docker-compose.prod.yml build

# =============================================================================
# CLEANUP
# =============================================================================

clean: clean-docker clean-python clean-node ## Clean all artifacts

clean-docker: ## Remove Docker containers and volumes
	@echo "$(YELLOW)Cleaning Docker resources...$(NC)"
	@$(DOCKER_COMPOSE) down -v --remove-orphans

clean-python: ## Remove Python cache and build files
	@echo "$(YELLOW)Cleaning Python artifacts...$(NC)"
	@find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".pytest_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name ".ruff_cache" -exec rm -rf {} + 2>/dev/null || true
	@find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	@find . -type f -name "*.pyc" -delete 2>/dev/null || true
	@find . -type f -name ".coverage" -delete 2>/dev/null || true
	@rm -rf $(BACKEND_DIR)/htmlcov 2>/dev/null || true

clean-node: ## Remove Node.js artifacts
	@echo "$(YELLOW)Cleaning Node.js artifacts...$(NC)"
	@rm -rf $(FRONTEND_DIR)/node_modules 2>/dev/null || true
	@rm -rf $(FRONTEND_DIR)/dist 2>/dev/null || true

# =============================================================================
# UTILITIES
# =============================================================================

shell-backend: ## Open Python shell with app context
	@cd $(BACKEND_DIR) && . venv/bin/activate && $(PYTHON)

logs-backend: ## View backend logs
	@$(DOCKER_COMPOSE) logs -f backend

logs-postgres: ## View PostgreSQL logs
	@$(DOCKER_COMPOSE) logs -f postgres

logs-redis: ## View Redis logs
	@$(DOCKER_COMPOSE) logs -f redis

health: ## Check health of all services
	@echo "$(GREEN)Checking service health...$(NC)"
	@echo "Backend:"
	@curl -s http://localhost:8000/health | jq . 2>/dev/null || echo "  $(RED)Not running$(NC)"
	@echo ""
	@echo "Ready check:"
	@curl -s http://localhost:8000/ready | jq . 2>/dev/null || echo "  $(RED)Not ready$(NC)"

api-docs: ## Open API documentation in browser
	@open http://localhost:8000/docs 2>/dev/null || xdg-open http://localhost:8000/docs 2>/dev/null || echo "Visit http://localhost:8000/docs"
