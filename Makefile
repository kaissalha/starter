# Help command
.PHONY: help
help: ## Show this help message
	@echo 'Usage: make [target]'
	@echo ''
	@echo 'Targets:'
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

VERCEL_SCOPE ?= kais-salhas-projects
ENV_FILE ?= apps/webapp/.env.local

.PHONY: env
env: ## Pull environment variables from Vercel
	cd apps/webapp && \
	bunx vercel link --yes --scope $(VERCEL_SCOPE) --project starter-webapp && \
	bunx vercel env pull --yes
	cd apps/websites && \
	bunx vercel link --yes --scope $(VERCEL_SCOPE) --project starter-websites && \
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

.PHONY: tinybird-dev tinybird-sync tinybird-preview tinybird-clean tinybird-check tinybird-deploy
tinybird-dev: ## Watch Tinybird resources on an existing branch (BRANCH=dev)
tinybird-sync: ## Sync Tinybird resources to an existing branch (BRANCH=dev)
tinybird-preview: ## Provision and sync a Tinybird branch (BRANCH=name)
tinybird-clean: ## Delete a Tinybird branch (BRANCH=name)
tinybird-check: ## Check Tinybird production resource compatibility
tinybird-deploy: ## Deploy Tinybird production resources
tinybird-dev tinybird-sync tinybird-preview tinybird-clean tinybird-check tinybird-deploy:
	bunx dotenv-cli@11.0.0 -e apps/webapp/.env.local -- bun scripts/tinybird.ts $(@:tinybird-%=%) $(BRANCH)
