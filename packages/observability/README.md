# @starter/observability

Shared [evlog](https://www.npmjs.com/package/evlog) configuration for every runtime in the monorepo.

- `createEvlogOptions(service)`: one batched, retried drain pipeline (local files in development, PostHog Logs,
  OTLP), Vercel geo/user-agent/trace enrichment, and tail sampling that always keeps cron events.
    - OpenTelemetry: request events carry the active `@vercel/otel` span's `traceId`/`spanId`, and the OTLP drain emits
      compact records with semantic-convention attributes. It honors the standard `OTEL_EXPORTER_OTLP_*`,
      `OTEL_SERVICE_NAME`, and `OTEL_RESOURCE_ATTRIBUTES` variables.
    - PostHog: the browser SDK's `x-posthog-distinct-id`/`x-posthog-session-id` tracing headers are recorded under
      `posthog.*`, linking server logs to the person and session replay.
- `getRequestLogger()`: the active `withEvlog` request logger, or `undefined` outside a request. The server uses it to
  wrap every registry language model with `evlog/ai`, so token usage, models, and tool calls land on the request event.
  oRPC procedures receive the same logger as `context.log` (`evlog/orpc`'s `EvlogOrpcContext`), tag events with their
  `operation`, and identify the user with `evlog/better-auth` (id only) and the active organization.
- `log` and `serializeLogError`: the structured logger and an `Error` serializer that survives JSON drains.
- `assertRequiredConfig({ app, enforce, names })`: logs missing configuration and throws in production when enforced.

Each app binds these options to its framework adapter (`evlog/next`) and passes its own required environment names.
