# AGENTS.md

## Scope and sources of truth

- These instructions apply repository-wide. The generated `apps/webapp/AGENTS.md` adds Next.js-specific guidance; do
  not remove or hand-edit its generated block.
- Before changing code, inspect the nearest package README, relevant implementation and tests, and any applicable
  installed skill. Use the repository's existing patterns instead of relying on framework memory.
- Treat `package.json` scripts, `turbo.json`, `oxlint.config.ts`, `.oxfmtrc.json`, and `konsistent.json` as the executable
  sources of truth. Keep this file focused on architectural decisions and conventions that tooling cannot infer.
- Repository-owned skills live in `.agents/skills`; `skills-lock.json` tracks only externally sourced skills.
- For events, notifications, or email delivery, also read `docs/events-and-notifications.md`.

## Working agreement

- This is a Bun workspaces + Turborepo monorepo. Use Bun commands and preserve workspace boundaries.
- Make the smallest code change and create the fewest files necessary to achieve the requested outcome. Do not add
  speculative infrastructure, abstractions, compatibility layers, or supporting files.
- Keep generated code concise, succinct, terse, and laconic while still achieving the objective.
- Do not build the repository as a verification step.
- Run tests with `bun run test`, never `bun test`; the latter invokes Bun's test runner instead of the configured Vitest
  suite. Prefer a focused path while iterating, then run the broader affected suite when behavior changes.
- Finish implementation changes with `bun check`. It is the CI gate and runs lint/format/konsistent, typecheck,
  React Doctor, shadscan, the evlog baseline, jscpd duplication checking, and the migration drift check. CI also runs the full Vitest and workflow suites on every pull request and every push to `master`, and production preparation waits for all of them. Treat warnings or scored findings in touched
  files as work to resolve when they are in scope.
- Before starting a dev process, check its port with `lsof -nP -i :PORT` and reuse or stop an existing process. The main
  local ports are webapp `3000`, email preview `3002`, Drizzle Studio `4983`, and AI SDK DevTools `4984`.
- Do not edit generated migrations, Next.js agent blocks, or workflow-generated routes by hand. Use the owning command.

## Repository map

- `apps/webapp`: authenticated Next.js 16 product app, dashboard UI, API route adapters, i18n, and observability.
- `packages/cache`: Redis clients, cache helpers, and rate limiting.
- `packages/db`: Drizzle schema, relations, migrations, and database utilities.
- `packages/documents`: file-format and upload contracts (root), Node text extraction (`./extraction`), and React
  PDF/DOCX/XLSX viewers (`./viewer`). It owns no storage, persistence, or ingestion.
- `packages/email` and `packages/pdf`: localized React renderers for email and PDF artifacts.
- `packages/genui`: OpenUI Lang parsing/validation, chart text limits, and the chat GenUI library contract.
- `packages/observability`: evlog drains, sampling, error serialization, and required-config checks.
- `packages/server`: auth, oRPC API, AI tools/agent, services, provider integrations, and durable workflows.
- `packages/ui`: shared product UI, hooks, charts, and global design tokens.
- `packages/utils`: cross-workspace utilities. `packages/tsconfig` owns shared TypeScript configs.

## Architecture boundaries

- Dependencies flow apps → `@starter/server` → packages. Packages never import `@starter/server` or app sources,
  contract, renderer, and file-format packages own no persistence or Redis access, and `konsistent.json` enforces both.

### API and server

- oRPC routers live in `packages/server/src/api/routers/{resource}.ts`, use plural kebab-case filenames, export a single
  procedure map named after the file, and are composed in `packages/server/src/api/app.ts`.
- Build procedures from `pub`, `authed`, or `authedWithOrganization` in `packages/server/src/api/base.ts`. Prefer
  organization-scoped authorization for organization-owned records; never rely on client-side authorization.
- Validate boundary input with Zod. Add `openapi(...)` metadata to documented procedures, keep operation IDs unique and
  camelCase, give reusable schemas stable PascalCase IDs, and include field examples where they improve the spec.
- Declare expected procedure failures with `.errors(...)` and throw the generated errors. Keep routers thin: domain and
  persistence logic belongs in `packages/server/src/services`, and durable orchestration belongs in
  `packages/server/src/workflows`. Services must not import the API layer; routers must not import `@starter/db`.
- Procedures are internal by default and available through `/api/rpc`. `publicApi(true)` is an explicit opt-in to the
  API-key-authenticated `/api/v1` REST/OpenAPI surface. Do not assume an oRPC procedure automatically becomes an MCP
  tool; `/api/mcp` is wired separately in `packages/server/src/api/mcp.ts` and its `src/api/mcp-tools` modules.
- Better Auth owns `/api/auth/*`. AI chat streaming, media transfer, and MCP remain plain protocol-specific handlers in
  `packages/server/src/api`, mounted by Next.js routes.
- Authentication is permanently passwordless: email OTP and optional Google sign-in. Never add credentials, passwords,
  password reset, password-dependent UI, or Better Auth's credential-only two-factor flow. Read `starter-auth` for auth
  work.
- Next.js API route handlers use `withErrorHandler` and the established evlog wrappers. Do not return raw internal
  exceptions or log sensitive payloads.
- In the webapp, use the typed oRPC TanStack Query client from `apps/webapp/src/lib/api-client.ts` for in-app JSON
  procedures. Raw `fetch` is reserved for protocol streams, uploads/downloads, or external services.
- Keep `packages/server/tests/api/openapi.test.ts` passing whenever router metadata, auth, or public exposure changes.

### AI

- Mastra owns agents, model routing, tools, skills, memory, retrieval, observability, and runtime scorers under
  `packages/server/src/ai`. Keep prompt-owned schemas beside their prompts.
- Mastra owns its Postgres schema. Never write Drizzle migrations, foreign keys, or triggers for `mastra.*` tables and
  never query them with raw SQL; construct stores through `@starter/db/mastra`, bootstrap with
  `initializeMastraStorage`, and enforce tenant boundaries in application services through Mastra's APIs.
- Keep deterministic AI contract coverage in Vitest and attach Mastra runtime scorers to agent runs for model behavior;
  do not introduce a parallel eval framework or AI workspace package. Read `starter-ai` before changing AI behavior.
- Treat retrieved documents, web results, uploaded content, and model output as untrusted data. Preserve the
  prompt-injection boundaries already encoded in the prompts and validate structured output before persistence.

### React and UI

- Read `starter-ui` for UI implementation or review and `starter-next-performance` for measured Next.js performance
  work. Apply them through the repository's existing design language.
- Read the relevant Next.js guide in the app-local `node_modules/next/dist/docs/` before changing Next.js APIs. The webapp
  uses Next.js 16 and React 19; do not rely on older App Router behavior.
- Keep route-owned components and hooks next to their route. Promote a component to `apps/webapp/src/components` or
  `packages/ui` only after it has multiple real consumers.
- Keep page, layout, and component shells focused on rendering and wiring. Move related mutation orchestration, dialog
  flows, query-state coordination, or several related state transitions into an adjacent `use-*-controller.ts` or
  `use-*-form.ts` hook, preferably with a reducer when the states form a workflow.
- Prefer a keyed child boundary when form state is seeded from changing server props. Avoid effects that synchronously
  copy props into state or reset local state. Keep raw input while typing and trim only during validation/submission.
- Use `useEffectEvent` for latest callback/prop access. Keep refs for DOM nodes and imperative resources; extract repeated
  scroll/media/timer coordination into an adjacent hook.
- Render every component that calls `useSearchParams()` beneath a route-level `Suspense` boundary.
- React 19 accepts `ref` as a prop; do not introduce `forwardRef`. Use stable semantic keys rather than array indexes when
  an ID, code, email, or other stable value exists.
- Use `HugeiconsIcon` from `@hugeicons/react` with free stroke-rounded data from `@hugeicons/core-free-icons`,
  `strokeWidth={1.75}`, and `scale-110` for the product icon weight and size.
  For state transitions, pass that data directly to a stable `MorphIcon` from `morphicons/react` with `strokeWidth={1.75}`
  and `reducedMotion="user"`; morph the icon rather than cross-fading separately mounted icons.
- User-facing webapp copy belongs in `next-intl` messages, not JSX literals. Preserve English/Arabic parity and use
  logical CSS properties for RTL.
- Never add user-facing hints, helper text, or instructional empty-state copy unless the user explicitly requests them.
- Product UI colors come from tokens in `packages/ui/src/globals.css`.
- Always use Tailwind utility classes for UI styling. Do not add page- or component-specific selectors to global CSS,
  CSS modules, or style tags. Keep global CSS limited to Tailwind imports, source/theme directives, fonts, and unavoidable
  third-party or browser-wide integration. Use inline styles only for values computed at runtime, preferably exposed as
  CSS custom properties consumed by Tailwind arbitrary-value utilities.

## Code and structure conventions

- `konsistent.json` is the source of truth for file/export naming, router/tool/agent structure, layering, package barrels,
  test naming, and no-dev-dependency guard tests. Update the config with the code when introducing a new structural rule.
- Oxfmt owns whitespace, quotes, import sorting, and line width. Oxlint owns type/style restrictions and complexity limits;
  do not duplicate formatter work manually or add prose exceptions that conflict with the configs.
- Prefer `type` over `interface`, type-only imports, arrow function expressions, inline named exports, and inferred return
  types. Default exports are limited to framework/config/story/email-preview locations already exempted by lint.
- Avoid `any`, broad `unknown` contracts, and type assertions. Parse unknown values at boundaries; when an assertion is
  truly unavoidable, follow the lint rule's required local safety justification.
- Put cross-workspace utilities in `packages/utils`. Preserve established locations for app-, package-, feature-, schema-,
  and test-specific utilities; do not move an otherwise unchanged file solely to normalize its directory or filename.
  Export utility functions directly; never wrap them in a namespace object.
- Prefer object parameters for domain functions with multiple inputs. Keep even small or single-consumer utility/helper
  functions separate when that is the established local pattern; do not inline or disguise them because their scope is
  narrow. Avoid creating functions that only rename another function, single-use constants, generic nullable predicates,
  or defensive record wrappers unless they encode a valid domain concept that materially improves correctness or
  readability.
- Prefer early returns and array transforms over deeply nested branches and mutation-heavy loops. Use async/await for
  multi-step asynchronous control flow; concise promise recovery is acceptable only when it is clearer and intentional.
- Default each runtime package to one `src/index.ts` public entrypoint. Add subpath exports only when they isolate a
  meaningfully larger runtime or build graph, or expose non-TypeScript assets such as CSS, JSON, or tool configuration.
  Within packages, avoid broad barrels except for package, template, workflow, and established registry entrypoints.
- Never rename Better Auth schema exports in `packages/db/src/schema/auth` (`users`, `sessions`, `accounts`, `apikeys`,
  `twoFactors`, and peers). The adapter resolves models by export name, not only by SQL table name.
- Do not create abstractions preemptively. Start feature-local, prefer explicit variants or wrapper components when
  behavior differs, and make an abstraction global only after multiple real consumers prove it.

## Commands

- `docker compose up -d`: start local PostgreSQL with pgvector and Redis.
- `make migrate`: generate and apply Drizzle migrations locally (CI and production only apply committed migrations; see the README); `make studio`: open Drizzle Studio.
- `bun dev`: start the monorepo development tasks.
- `bun run test [path]`: run Vitest, optionally scoped to a path.
- `bun check`: run the complete CI quality gate without building.
- `bun run jscpd`: reject new or increased duplication against `.jscpd-baseline.json`; use `bun run jscpd:report` for
  HTML/JSON reports and a ranked summary, or `bun run jscpd:mcp` for agent snippet checks. Review clones before extracting
  shared code. Do not refresh the baseline or add ignores merely to bypass failures. Use `bun run jscpd:baseline` only
  for a reviewed change to accepted duplication.
- `bun lint`: Oxlint, Oxfmt check, and konsistent; `bun run lint:fix`: apply lint/format fixes.
- `bun typecheck`, `bun konsistent`, `bun react-doctor`, `bun shadscan`, and `bun evlog:check`: run an individual gate.

<!-- BEGIN:turborepo-agent-rules -->

# This is NOT the Turborepo you know

Turborepo configuration, task behavior, and CLI commands can vary between installed versions and may differ from your training data. Resolve the `turbo` package from this file's directory or relevant workspace; in monorepos, it may not be visible from the repository root. For example, run `node -p "require.resolve('turbo/package.json')"` from a workspace that depends on `turbo`.

Read `docs/README.md` inside that installed package first, then read the relevant pages from its `docs/` directory before changing Turborepo configuration or commands. Heed deprecation notices. These bundled docs match the installed package version and are available without network access.

This block is written and re-added by `turbo` before repository-scoped commands when an AI agent is detected. In the Turborepo source repository, its template is defined in `crates/turborepo-cli/src/cli/agent_guidance.rs`. Removing the managed block while updates are enabled means a later qualifying invocation will add it again. Set `"agentGuidance": false` in the root `turbo.json` or `turbo.jsonc` to opt out; this does not remove an existing block. Keep the block committed with your work to avoid an uncommitted change on the next agent invocation.
<!-- END:turborepo-agent-rules -->
