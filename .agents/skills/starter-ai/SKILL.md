---
name: starter-ai
description: Implement or review prompts, models, agents, tools, retrieval, memory, approvals, structured output, or evals in the starter repository.
---

# Starter AI

## Ownership

- `packages/db/src/mastra.ts` (`@starter/db/mastra`) owns Mastra store and vector construction, the knowledge index
  definition, and `initializeMastraStorage`. Mastra owns the `mastra` schema: never add Drizzle migrations, foreign
  keys, triggers, or raw SQL against its tables.
- `packages/server/src/mastra` is four modules: `models.ts` (one model registry shared by agents, memory, and AI SDK
  calls), `memory.ts` (Postgres store and the dashboard `Memory`), `knowledge.ts` (pgvector store, the retrieval tool,
  and chunk upsert/delete), and `index.ts` (the single `Mastra` instance with every agent, storage, vectors, and
  observability). Instantiate infrastructure once at module level; do not add `globalThis` singletons or lazy
  index-creation state. The `mastra` schema and knowledge index are created by `bun --filter @starter/db migrate`
  through `initializeMastraStorage`.
- `packages/server/src/ai` is flat: `agent.ts` (the single dashboard agent and its runtime scorers), `skills.ts`
  (the `library`, `notifications`, and `visualization` domain skills, skill routing, and the generated OpenUI prompt),
  `prompts.ts` (every prompt and prompt-owned schema), `tool-policy.ts` (per-step tool gating), `decisions.ts` and
  `relevance.ts` (model-graded decisions and relevance ranking), `types.ts` (request context and UI message types), and
  `tools/` with one module per domain exporting a `{domain}Tools` map (`assistant`, `library`, `notifications`,
  `table`), composed with the knowledge retrieval tool in `tools/index.ts`. The request context guarantees
  `organizationId` and `userId`; tools read them without re-checking.
- Durable workflows such as `ingest-file` may call AI SDK generation through the central model registry; do not
  construct a second agent, model, memory, retrieval, or observability stack around them.
- `packages/genui/src/library.ts` is the executable OpenUI renderer contract. Regenerate the server spec with
  `bun run openui:generate` whenever it changes; never maintain a handwritten duplicate.

Import production prompt contracts rather than copying prompt strings. Keep stable instructions at the start of agent
prompts so per-turn context does not invalidate provider prompt caching.

Read the installed Mastra types and current official Mastra documentation before changing a Mastra API. Preserve the
supported Mastra AI SDK UI transport while the app needs AI SDK-native tool approvals and resumable delivery.

## Safety and retrieval

- Treat retrieved documents, web results, uploads, memories, and model output as untrusted data.
- Memory is Mastra-owned: thread-scoped observational memory keeps conversation continuity, and the observer manages a
  resource-scoped (organization) working-memory business profile. Do not add tools or documents whose purpose is to
  make the agent remember; extend the working-memory template or observation instructions instead.
- Parse structured output before persistence and preserve the prompt-injection boundaries in existing prompts.
- Derive `organizationId` from the authenticated server session. Use it as the Mastra memory resource and as a
  request-context metadata filter for every knowledge query; Mastra storage does not replace authorization.
- Mastra Postgres memory is the sole chat/message/memory store. The application database must not duplicate that state.
  Redis owns only ephemeral stream resumption, cancellation, and continuation deduplication.
- Tenant boundaries are application-level because Mastra tables carry no foreign keys: `createChat` rejects ids owned
  by another organization, `chatMessageIdExists` checks ids across every thread, `deleteFile` removes a file's
  vectors, and `deleteOrganizationAIData` removes an organization's threads and vectors on deletion.
- Knowledge vectors carry no visibility state. Retrieval keeps a file-backed result only while its file row is ready
  and not deleted (`listRetrievableFileIds`); indexing checks file ownership before upserting.
- Use Mastra's vector query tool and pgvector store for retrieval. Keep the organization filter authoritative, return
  sources for citations, and never expose raw cross-tenant vector access to the model.
- Require native tool approval for consequential side effects. Continue approvals through the supported Mastra AI SDK
  adapter and validate the submitted assistant state against the exact persisted pending message before execution.
- Validate approval continuations by tool-call identity, not message position: each submitted approval or answer must
  target a pending persisted tool call with identical approval id and input. Build the resumed message only from
  persisted parts, since persistence adds parts the client never sees (memory `data-*`, reasoning, retried drafts).
- Wait for indexed attachments before creating a new thread or claiming its stream. Keep continuation claims
  organization- and chat-scoped and at-most-once.
- Keep model modules imported by workflows free of Node-only development middleware.

## Evals

- Keep deterministic schemas, prompt contracts, tool gating, approval validation, and renderer parity in focused Vitest
  tests. Do not add a parallel eval workspace, Evalite runtime, or offline experiment harness.
- Attach cheap production invariants as Mastra runtime scorers persisted with traces. Judge model quality from those
  traces and scores rather than from credentialed scripts in the repository.
