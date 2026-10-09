# starter

A production-grade foundation for building new products. A Next.js 16 app and eleven workspace packages — auth, organizations, an AI assistant with retrieval and memory, a document library, a typed API, events and notifications, i18n, emails, PDFs, and the quality gates to keep it all honest — wired together so every new app starts at the interesting part.

Built as a Bun workspaces + Turborepo monorepo.

## What's inside

- **Auth & organizations** — Passwordless Better Auth with hashed email OTPs and Google sign-in, organizations with invitations and roles, and localized auth errors.
- **AI assistant** — A Mastra agent embedded in Next.js with organization-scoped request context, approval-gated mutations, web search, human-in-the-loop questions, generative UI charts, automatic vision-model switching, Postgres-backed memory and traces, and Redis-backed resumable delivery.
- **Library & knowledge** — A file and document library with PDF/DOCX/XLSX viewers, AI document and image/logo generation, durable ingestion (Vercel Workflow), Mastra pgvector retrieval and reranking, plus Mastra message history and observational memory.
- **Typed API** — oRPC procedures where zod validation and the OpenAPI 3.1 document share one definition, exposed three ways: an RPC transport for the webapp (`/api/rpc`, consumed through a typed TanStack Query client), a public REST API with API-key auth and a served spec (`/api/v1`, `/api/v1/openapi.json`), and an OAuth-protected MCP server (`/api/mcp`) whose tools are registered separately (currently notification settings).
- **Internationalization** — English and Arabic with full RTL support via next-intl, localized metadata, and an Accept-header markdown mode that serves any page as markdown to agents.
- **Events & notifications** — Transactional event log with a cron-recovered dispatcher, durable per-consumer executions, an in-app inbox, per-member preferences, and email delivery. The event catalog and notification registry start empty; see [events and notifications](docs/events-and-notifications.md).
- **Email & PDF** — React Email templates sent through Resend, and a React PDF design system with tables, charts, and form primitives.
- **Operations** — PostHog product analytics and error capture, structured logging with evlog, and Vercel Blob storage with client uploads.
- **Quality gates** — Mastra runtime scorers and trace storage, Vitest with Testcontainers (real Postgres + Redis), oxlint/oxfmt, konsistent structural conventions, jscpd duplication detection, react-doctor, and deterministic shadscan UI audits.

## Repo layout

```text
.
|-- apps/
|   `-- webapp/              # Authenticated Next.js 16 product app
|-- packages/
|   |-- cache/               # Redis clients, TTL cache, rate-limit utilities
|   |-- db/                  # Drizzle application schema and migrations
|   |-- documents/           # File formats, upload rules, extraction, PDF/DOCX/XLSX viewers
|   |-- email/               # React Email templates + Resend
|   |-- genui/               # OpenUI Lang contract, parsing, and chat GenUI library
|   |-- observability/       # evlog drains, sampling, error serialization
|   |-- pdf/                 # React PDF design system and helpers
|   |-- server/              # oRPC API, auth, AI agents/tools, services
|   |-- tsconfig/            # Shared TypeScript configs
|   |-- ui/                  # Design system: Tailwind v4, Base UI, charts
|   `-- utils/               # Shared utilities
|-- Makefile                 # Env, database, and maintenance helpers
|-- docker-compose.yml       # Local Postgres service
`-- turbo.json               # Turborepo task graph
```

## Stack

Next.js 16 · React 19 · TypeScript · Mastra · AI SDK UI · Better Auth · oRPC + OpenAPI · Drizzle ORM · Postgres + pgvector · Redis · TanStack Query · Tailwind CSS v4 · Base UI · next-intl · Vercel (Workflow, Blob, AI Gateway) · Bun · Turborepo · Vitest

## Organization permissions

Better Auth organization access control defines three roles in `packages/server/src/utils/permissions.ts`: Owner can
read, modify, and delete; Admin can read and modify; Member can read. Settings → Team manages invitations
and member access, including pending and expired invitations, resending, role changes, and removal. Invitation links
return recipients to acceptance after passwordless sign-in and activate the joined organization. Only owners can
remove members, cancel invitations, revoke API keys, or delete content. Personal account settings remain available to each user.
Owner memberships are fixed: they cannot be edited or removed, and invitations and role changes offer only Admin
and Member.

Organization RPC procedures verify current membership in `authedWithOrganization`; mutations additionally use
`organizationPermission("write")` or `organizationPermission("delete")`. Media, MCP, and agent execution enforce
the same policy, including resumed approvals and credentials issued before a role change. Document saves check
embedded deletions. The client-safe `@starter/server/permissions` entrypoint supplies UI permissions without importing
the server runtime. UI controls are supplementary; authorization is enforced on the server.

## AI architecture

`packages/server/src/mastra` is the single runtime for agents, model routing, Postgres memory, pgvector knowledge,
observability, and scoring. Mastra owns the `mastra` Postgres schema and initializes it itself: the repository adds no
migrations, foreign keys, or triggers to Mastra tables. `@starter/db/mastra` constructs the Postgres store and vector
store and exposes `initializeMastraStorage`, which the expand-migration script and the test bootstrap run before any
application migration touches Mastra data. Tenant boundaries that a foreign key would otherwise enforce live in
application services: chats are owned by their organization, message ids are unique across threads, deleting a file
removes its knowledge vectors, and deleting an organization removes its threads and vectors through Mastra's APIs.
Application tables do not duplicate Mastra-owned messages or memory; Redis stores only each chat's short-lived active
stream id, used to resume and stop it. Observational memory remains thread-scoped so one organization
member's personal profile is never promoted into shared working memory.

The dashboard streams that agent through Mastra's supported
[AI SDK UI adapter](https://mastra.ai/integrations/agentic-ui/ai-sdk-ui), preserving the product's native approvals,
attachments, and resumable delivery. OpenUI Lang is rendered inline with the official React runtime from one generated
component contract. The [OpenUI AG-UI guide](https://mastra.ai/integrations/agentic-ui/openui) demonstrates a complete
replacement chat surface; this repository does not add that second transport or duplicate conversation state.

## Getting started

Prerequisites: Bun 1.4.2 (`packageManager`), Node.js from `.nvmrc`, Docker (local Postgres and the Testcontainers-backed
tests), and optionally `ngrok` for Blob upload callbacks in development.

```sh
bun install
cp apps/webapp/.env.example apps/webapp/.env   # then fill in the values
docker compose up -d       # local Postgres and Redis (loopback only)
make migrate               # applies migrations to DATABASE_URL from ENV_FILE (default apps/webapp/.env); pass ENV_FILE=<path> to target another database
bun dev
```

`make migrate` targets the `DATABASE_URL` in `ENV_FILE` (default `apps/webapp/.env`); pass `ENV_FILE=<path>` to migrate another database. Production requires the variables marked "Required in production" in `apps/webapp/.env.example`.

`bun dev` also starts Drizzle Studio at `https://local.drizzle.studio` (port `4983`, using `DATABASE_URL` from `apps/webapp/.env`) and the AI SDK DevTools viewer at `http://localhost:4984` (`AI_SDK_DEVTOOLS_PORT`, set for both the viewer and the webapp dev server). The webapp registers its telemetry
integration only during Node development and writes captures to `apps/webapp/.devtools` (gitignored). Run the viewer
alone with `bun --cwd apps/webapp run dev:ai`. Mastra agent traces remain available in Mastra Studio.
DevTools registers through the application’s `ai` package. The webapp TypeScript path pins its undeclared `ai` type import
to that same package so Bun hoisting cannot select a different SDK version.
Model-graded decisions and runtime scorers use Mastra classifiers over the gateway's decision model.

## Commands

| Command                | Description                                      |
| ---------------------- | ------------------------------------------------ |
| `bun dev`              | Start the webapp and local development services  |
| `bun run test`         | Run the Vitest suite (Testcontainers-backed)     |
| `bun typecheck`        | TypeScript check across the workspace            |
| `bun check`            | Run all quality gates, including duplication     |
| `bun run jscpd`        | Reject new duplicate blocks against the baseline |
| `bun run jscpd:report` | Generate full duplication reports and summary    |
| `bun run jscpd:mcp`    | Start the duplication MCP server over stdio      |
| `bun lint`             | Oxlint + Oxfmt + konsistent                      |
| `bun run lint:fix`     | Apply lint fixes and format                      |
| `bun react-doctor`     | React health check across the repo               |
| `bun shadscan`         | Enforce webapp and shared-UI audit baselines     |
| `bun evlog:check`      | Enforce the webapp observability baseline        |
| `make migrate`         | Generate and apply database migrations locally   |
| `make studio`          | Open Drizzle Studio                              |
| `make update-deps`     | Update dependencies across the monorepo          |

## Production origin

`getBaseURL()` in `packages/utils/src/url.ts` is the single source for the webapp's public origin (Better Auth, OAuth/MCP identifiers, invitation links, OpenAPI, `metadataBase`).

- Production builds (`NEXT_PUBLIC_VERCEL_ENV=production`, or a `main`/`master` commit ref) use `NEXT_PUBLIC_BASE_URL` when it is a full `https://` origin, otherwise `NEXT_PUBLIC_VERCEL_PROJECT_PRODUCTION_URL`. With neither, or an invalid `NEXT_PUBLIC_BASE_URL`, the build fails.
- Set `NEXT_PUBLIC_BASE_URL` for the Production environment only and redeploy, since `NEXT_PUBLIC_*` values are inlined at build time. Previews use the branch URL, then the deployment URL; the browser uses `window.location.origin`.
- Vercel needs "Automatically expose System Environment Variables" enabled.
- When the production domain changes, add `https://<domain>/api/auth/callback/google` to the Google OAuth redirect URIs and redirect the old host. MCP/OAuth clients must consent again.

## Database migrations

`make migrate` generates and applies migrations locally; commit the generated `packages/db/src/db/migrations/<timestamp>_<name>/` folder and never edit it by hand. CI and production run only `bun --filter @starter/db migrate`, which applies committed folders in one transaction and records them in `public.drizzle_migrations`. `bun --filter @starter/db drift` fails when the schema and the latest snapshot differ; it runs in `bun check` and before any production change. Set `DATABASE_URL_UNPOOLED` to the direct endpoint wherever `DATABASE_URL` points at a pooler.

Migrations run before new code is promoted, so keep each one compatible with the previous deployment:

1. Add columns as nullable or with a default; make them NOT NULL in a later release.
2. Stop using a column, table, or type in one release and drop it in a later one; rename by add, backfill, switch, drop.
3. `CREATE INDEX CONCURRENTLY` is unavailable (one transaction); treat index builds on large tables as locking.
4. Rehearse migrations that touch populated tables against a production branch first.

If the production migration step fails, deployments stay blocked and nothing is applied; fix forward with a new migration.

## Conventions

Working agreements, API conventions, and code style live in [AGENTS.md](AGENTS.md). Structural rules (router and AI-tool exports, component/hook naming, package structure, test guards) are enforced by [konsistent.json](konsistent.json), and a Husky pre-commit hook runs jscpd, lint, konsistent, typecheck, the pinned shadscan baselines, and the evlog observability baseline.

## Testing and evals

`tools/testing/postgres-global-setup.ts` boots pgvector Postgres through Testcontainers, lets Mastra initialize its own schema, and runs real migrations, so integration tests exercise the actual schema. Deterministic behavior is covered by Vitest; Mastra scorers are attached to agent runs and persisted with traces. `.github/workflows/quality.yml` is reusable: pull requests run it directly, and pushes to `master` run it as the `Gate` job in `.github/workflows/production.yml`. `Prepare production` starts only after the whole gate passes and only while the pushed commit is still the head of `master`: it checks migration drift, runs migrations, then notifies Vercel (`Vercel - starter-webapp: prepare`). A `Quality checks` job in `production.yml` reports the gate result. Require `Vercel - starter-webapp: prepare` and `Quality checks` as production Deployment Checks on the webapp project (requires: none; blocks: deployment-alias; timeout: 3600 seconds). Preview deployments do not require these checks. When `SLACK_ALERT_WEBHOOK` is set, a failed pipeline on `master` posts to Slack.

With Docker running, use `bun run --cwd packages/server test:integration` for the Mastra persistence and server integration suite.

## Duplication detection

[jscpd](https://jscpd.dev/getting-started/configuration) scans apps, packages, tools, and
end-to-end tests together, including unit tests and stories. The native executable is built from upstream commit
`deb1db104f38692015acb750c96482570c98608f`, which fixes the overstretched clone ranges in the npm 5.2.0 release.
`tools/jscpd.sh` downloads a project-local Rust 1.96.0 toolchain on first use and installs that exact commit with its
locked dependencies. It requires Git, curl, and a native linker (Xcode Command Line Tools on macOS; the standard build
tools on Linux). Toolchain and binary caches live under ignored `node_modules/.cache`; subsequent scans use the cached
binary directly, and CI caches it by platform and script hash. No global toolchain or shell configuration is changed.
When a release contains the fix, replace this bootstrap with a pinned npm dependency and revalidate the detector before
reviewing a regenerated baseline.

`.jscpd.json` compares JavaScript/TypeScript across
extensions, ignores whitespace/comments, and detects blocks of at least 5 lines and 50 tokens. Generated migrations,
workflow routes, declarations, build outputs, and the vendored anti-slop plugin are excluded. Gitignored files are
also excluded. The larger file limits keep long source files in the scan.

`bun run jscpd` runs in `bun check`, Husky pre-commit, and the existing Quality checks workflow. It fails on any new
or increased duplication relative to the committed `.jscpd-baseline.json`; existing duplication remains visible.
HTML and JSON reports are written to `reports/jscpd/` and uploaded as a CI artifact even when the gate fails.
Use `bun run jscpd:report` for a full scan and ranked summary, or
`bun run jscpd:report --reporters ai` for compact agent output.

After reviewing an intentional change to accepted duplication, run `bun run jscpd:baseline` and review the baseline
diff before committing it. Do not refresh the baseline just to make a failing check pass. The initial baseline records
existing debt; it does not certify that the repository is duplication-free.

For an MCP client, set its working directory to the repository root, command to `bun`, and arguments to
`["run", "jscpd:mcp"]`. The server exposes snippet checks, file clones, statistics, and rescanning over stdio.
Run `check_current_directory` after edits to refresh its startup snapshot. This uses the same detection configuration
as CI; no globally installed executable is needed.
