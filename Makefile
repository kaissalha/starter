# Help command
.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

VERCEL_SCOPE ?= kais-salhas-projects
ENV_FILE ?= apps/webapp/.env

.PHONY: env
env: ## Pull environment variables from Vercel
	cd apps/webapp && \
	bunx vercel link --yes --scope $(VERCEL_SCOPE) --project starter-webapp && \
	bunx vercel env pull --yes


.PHONY: migrate
migrate: ## Generate and apply database migrations locally
	bunx dotenv-cli -e $(ENV_FILE) -- bun --filter @starter/db migrate:dev

.PHONY: studio
studio: ## Open Drizzle Studio
	bunx dotenv-cli -e $(ENV_FILE) -- bun --filter @starter/db studio

.PHONY: update-deps
update-deps: ## Update dependencies to latest (including patch) across monorepo
	bunx taze latest -r -wi && \
	npx skills@latest update
