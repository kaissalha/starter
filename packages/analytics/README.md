# @starter/analytics

Tinybird customer analytics shared by the server, the webapp dashboard, and the public websites renderer.

| Entry point                   | Runtime           | Contents                                                         |
| ----------------------------- | ----------------- | ---------------------------------------------------------------- |
| `@starter/analytics`          | Client-safe (zod) | Event, filter, and result contracts plus `resolveAnalyticsDates` |
| `@starter/analytics/tinybird` | Server            | Datasources, endpoints, the configured client, and row types     |

`src/resources.ts` and `src/endpoints.ts` are the Tinybird source of truth; `tinybird.config.json` and
`scripts/tinybird.ts` build them from this package. Collection, rate limiting, and organization-scoped queries stay
in `@starter/server`. See [docs/analytics.md](../../docs/analytics.md).
