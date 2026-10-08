# Customer analytics

Website, Links and Blog use `@tinybirdco/sdk` **0.0.84**. Resource definitions in
`packages/analytics/src/resources.ts` and `endpoints.ts` are the source of truth.
The US East workspace is `kaiss_salha_workspace` (`https://api.us-east.tinybird.co`).
There is no Postgres migration or DurableHub import. History begins at launch. PostHog product analytics and
existing Google Analytics integrations continue independently.

## Cloud development

Keep the management `TINYBIRD_TOKEN` and `TINYBIRD_URL` in `apps/webapp/.env.local` for local CLI use only,
or in CI secrets. The Makefile runs root `scripts/tinybird.ts` through `dotenv-cli`, loading that file when present. Never use the management token in an app deployment.

```sh
make tinybird-sync BRANCH=dev
make tinybird-dev BRANCH=dev
# To create a separate branch explicitly:
make tinybird-preview BRANCH=starter_dev_your_name
```

`preview` explicitly creates an empty Cloud branch if missing; subsequent runs reuse it. `sync` and the
`dev` watcher require it to exist. They use the SDK resource generator and Cloud build API; they do not build
an application. Resource changes synchronize as a batch. Do not use the SDK's automatic preview discovery in
application code. `devMode` is explicitly false at runtime.

After synchronization, `.tinybird/` contains ignored files with mode 0600:

| File in `.tinybird/` | Use                                                                       |
| -------------------- | ------------------------------------------------------------------------- |
| `reporting.env`      | Webapp: endpoint-read token for this branch                               |
| `collection.env`     | Websites: append-only token for this branch                               |
| `testing.env`        | Synthetic fixture tests: branch management token, never an app credential |

Use the exported reporting token in Vercel's Development/Preview Config variables and pull the webapp env
with `make env`. Copy the collection token into the ignored `apps/websites/.env`. Production uses its own
scoped tokens with the same variable names. The exports are temporary management artifacts, not app env files.

```sh
bunx dotenv-cli -e .tinybird/testing.env -- bun run test packages/analytics/tests/analytics-cloud.test.ts
make tinybird-clean BRANCH=starter_dev_your_name
```

Check the app's port before starting it. In local development, `localhost` and `127.0.0.1` can collect published
pages selected by their `<website-id>.localhost` hostname, but only with explicit Cloud branch credentials. Both apps must use
the same branch. Hosted preview origins and editor previews never collect. Production collection uses a connected,
ownership-verified domain and a published resource. The fixture suite ingests synthetic data directly; it refuses
a non-branch workspace. It polls for
materialized results because ingestion acknowledgement does not imply immediate endpoint visibility.

## Runtime configuration

| Environment variable    | Where                                                                        |
| ----------------------- | ---------------------------------------------------------------------------- |
| `TINYBIRD_URL`          | Both apps; US East API URL                                                   |
| `TINYBIRD_READ_TOKEN`   | Webapp in every environment; environment-specific `analytics_read` token     |
| `TINYBIRD_APPEND_TOKEN` | Websites in every environment; environment-specific `analytics_append` token |
| `TINYBIRD_BRANCH_NAME`  | Management scripts and CI only; never required by the apps                   |
| `TINYBIRD_TOKEN`        | Management operations in local development and CI only                       |
| `TINYBIRD_TEST_TOKEN`   | Isolated Cloud fixture tests only                                            |

The token variable names are the same in every environment. Development and Preview use branch-scoped
values; Production uses main-workspace values. Vercel manages webapp credentials; websites currently uses
its ignored `apps/websites/.env`. The runtime rejects the SDK-specific `TINYBIRD_BRANCH_TOKEN` override.
Apps require only the API URL and their purpose-scoped token; the token selects the workspace or branch. There is no automatic runtime branch
creation or production fallback. Never put a Tinybird credential in a `NEXT_PUBLIC_` variable.

## Deployment and CI

Set GitHub secret `TINYBIRD_TOKEN` to the workspace management token. The existing Vercel access secret and team
variable are also used. Set `VERCEL_PROJECT_ID` for webapp and, once hosted on Vercel,
`VERCEL_WEBSITES_PROJECT_ID` for websites. Preview configuration skips apps without a project ID.

`Tinybird previews` owns `starter_pr_<number>` branches. Per-PR jobs are serialized: create once, synchronize,
load uniquely named synthetic fixtures, assert reports, check production compatibility, then install separate
branch credentials as Config variables into configured Vercel projects for the PR's Git branch. Fork PRs cannot access credentials.
Closing a PR deletes its Tinybird branch and invalidates its tokens. Never let either app provision this branch.
Vercel deployments must start after this job, or be redeployed after its first successful run, to receive the
new environment. Environment changes do not retroactively change existing deployments.

The `Prepare production` job in the Production workflow deploys resources only after the whole quality gate (checks, tests and builds) succeeds on master. For the initial rollout:

1. Run focused tests, the Cloud fixture suite, `bun check`, and `git diff --check`.
2. Run `make tinybird-check`, then `make tinybird-deploy` to create the initial resources.
3. Install the generated `analytics_read` and `analytics_append` scoped tokens in the appropriate production
   apps, remove management credentials from app deployments, and redeploy the apps.
4. Visit a published page and confirm its event appears in the dashboard before enabling broader traffic.

Collection stays disabled until its scoped runtime credential is configured. Future resource changes must be
backward compatible with deployed collectors and reports. Deployment forbids destructive resource removal;
use additive columns/resources and a staged rollout for breaking changes. Do not reset PR branches on every
commit or copy production data into them. `tinybird-clean` only accepts `dev` and Starter-owned branch names.

## Collection and privacy

A single tracker mounts only after a published page is successfully resolved. Browser effects count committed
navigation, including back/forward and Blog pagination; prefetches and server rendering cannot emit pageviews.
Editor previews, Brand Guidelines, missing/unpublished pages and redirect-only Links responses are excluded.
Core Web Vitals stay attached to the original document navigation, even after client navigation.

The same-origin collector accepts at most 32 events and 64 KiB per request. The request host resolves a verified
website; the database supplies its organization. Paths, locales, published content, enabled Links IDs and
contact section IDs are checked against published resources. Browsers cannot submit tenant IDs or contact
conversion events. Contact conversion is scheduled only after a successful persistence result.

Visitor IDs are random, first-party, website-scoped and expire 365 days after creation. Sessions expire after
30 minutes without traffic activity. Storage failure uses an in-memory identity for that document. DNT and
Global Privacy Control suppress storage and events. Bot user agents and mismatched origins are rejected.
Stored dimensions contain no raw IP, full user agent, contact contents, arbitrary query strings or URL fragments.
Referrers become hostnames; destination URLs omit query/fragment and mail/telephone/SMS destinations store only their
scheme. Only `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` and `utm_term` are accepted, each bounded to
64 characters. Geographic enrichment uses the Vercel country, city and coordinate headers only on Vercel; coordinates are rounded to
one decimal (city level) and kept only on raw events for the live view. Otherwise location is unknown. Operating
systems are stored as families (Windows, macOS, iOS, Android, ChromeOS, Linux, Other), never versions.

Besides pageviews, the tracker records clicks on call, email, SMS, external and download links (`outbound_click`,
sanitized to a destination label) and engaged time (`engagement`): visible time on a page that stops counting after
60 seconds without input, reported with the page's own session when the page is hidden or left.
All client analytics is best effort. Provider failures cannot block page navigation or successful contact submission.

## Metric definitions

Dates are inclusive UTC calendar days. The default is today and the preceding 29 days; the maximum lookback is
13 months. The comparison is the immediately preceding range with the same number of days. Comparisons outside
retention are explicitly unavailable. Filters apply to organization-owned traffic across all surfaces, or to one
surface, domain and/or locale.

- **Visitors:** distinct visitor IDs with a pageview. New visitors were first seen during the selected period;
  returning visitors were first seen before it. These categories partition visitors for the period.
- **Visits:** distinct sessions with pageviews. Sessions and visitors merge across dates and surfaces; daily uniques
  must not be added together to obtain period totals.
- **Pageviews:** distinct pageview event IDs. Retried event IDs do not increase counts.
- **Conversions (actions):** distinct Links click, outbound/call/email/download click and committed contact
  submission event IDs. The actions report groups them into calls, emails, messages, WhatsApp, directions,
  downloads, social profiles, other links and form enquiries. Conversion rate is the fraction
  of visits with at least one conversion, rather than conversions divided by pageviews.
- **Bounce rate:** fraction of visits with exactly one pageview and no conversion.
- **Observed duration:** average first-to-last traffic activity within the selected window for visits. It includes
  clicks and conversions, excludes Web Vitals, and is zero when only one activity is observed. It is not dwell time.
- **Engaged time:** total reported engaged milliseconds divided by visits. The dashboard falls back to observed
  duration only when no engagement was reported.
- **Channels:** derived at query time from referrer, AI source and UTM source/medium into search, social, AI,
  email, ads, campaign links, other websites and direct.
- **Entry/exit pages:** the first/last page by activity time within each visit.
- **Active visitors:** distinct visitors with traffic activity in the last five minutes. Date filters do not change
  this live window; surface, locale and domain filters still apply.
- **Web Vitals:** p75 of the latest sample per metric ID, with counts and device breakdowns. LCP and INP use
  milliseconds; CLS is unitless. A missing metric means no observations, never zero performance cost.

Raw events expire after 90 days. Tenant-first AggregatingMergeTree tables retain mergeable distinct event/session
states and latest Vital states for 13 months. Reports use these states, not sums of daily uniques or averages of
daily rates. The Cloud fixture covers midnight and cross-surface sessions, retries, weighted rates, previous
periods, latest Vital samples, tenant isolation and reports older than raw retention.

## Reports and operational checks

The dashboard is `/dashboard/analytics`. Reports refresh every minute while open; active visitors refresh every
30 seconds. The shared organization-authorized operations are:

| oRPC                  | REST (API key)                     | Read-only MCP / assistant                            |
| --------------------- | ---------------------------------- | ---------------------------------------------------- |
| `analytics.overview`  | `GET /api/v1/analytics/overview`   | `get_analytics_overview` / `getAnalyticsOverview`    |
| `analytics.breakdown` | `GET /api/v1/analytics/breakdowns` | `get_analytics_breakdown` / `getAnalyticsBreakdown`  |
| `analytics.realtime`  | `GET /api/v1/analytics/realtime`   | `get_analytics_realtime` / `getAnalyticsRealtime`    |
| `analytics.live`      | `GET /api/v1/analytics/live`       | `get_analytics_live` / `getAnalyticsLive`            |
| `analytics.webVitals` | `GET /api/v1/analytics/web-vitals` | `get_analytics_web_vitals` / `getAnalyticsWebVitals` |

The assistant analytics skill uses the same services and existing chart renderer. Each report rechecks live
membership, including calls from already authenticated MCP or assistant contexts. Inputs accept bounded date,
surface, domain and locale filters; breakdowns additionally accept an allowlisted dimension, limit and offset.
No caller-supplied organization ID is accepted. Empty data is distinct from unavailable configuration/provider
failures. API failures are `SERVICE_UNAVAILABLE`; dashboards and the assistant do not substitute zero totals.

Use evlog events `Analytics ingestion failed`, `Analytics query failed`, and `Contact analytics failed` to locate
provider/configuration failures without logging event bodies or credentials. Check Tinybird's service metrics
and datasource quarantine for ingestion failures, endpoint error rates, query latency and scan volume. Confirm
that raw TTL and both aggregate TTLs remain present after deployments. Test each scoped token independently:
collection must be unable to read reports; reporting must be unable to append or query arbitrary SQL. Watch the
five-minute count during a real visit and compare the corresponding daily/report total after materialization.
