# Website lifecycle

This is the authoritative host-level description of Starter's website lifecycle: loading, generation, workflow
streaming, editing, previewing, persistence, publication, and public rendering. The
[`@starter/infinite-website` README](../packages/infinite-website/README.md) is the source of truth for the document and
renderer contract; this guide explains how the applications and server use that contract.

## Invariants

- `@starter/infinite-website` owns the versioned `SiteDocument`, pure edit functions, workflow event contracts, preview
  renderer, and production renderer. It does not own authentication, persistence, model calls, media providers, or
  Workflow runs.
- The server owns organization authorization, model/provider calls, durable orchestration, revision checks,
  persistence, and publication. The dashboard never writes website rows directly.
- `SiteDocument` is the canonical renderable representation. The editor and public application render the same
  document; there is no editor-only page tree or second public renderer.
- Brand and asset bindings are stored beside the document in `WebsiteSnapshotV1`. Content nodes reference asset IDs;
  provider URLs never enter the document.
- IDs are assigned when a section or template is instantiated and then persisted. Rendering never regenerates IDs.
- Untrusted JSON is parsed at API, authoring, workflow, and persistence-write boundaries. Read paths trust stored rows
  that passed those boundaries.
- `documentVersion: 1` and `schemaVersion: 1` are the only pre-release contracts. There is no compatibility reader for
  abandoned development shapes.

## Ownership map

| Concern                                                               | Owner                                            |
| --------------------------------------------------------------------- | ------------------------------------------------ |
| Document, editing, generation-event, preview, and rendering contracts | `packages/infinite-website`                      |
| Prompts and prompt-owned output schemas                               | `packages/server/src/ai`                         |
| Model calls, media providers, and website domain services             | `packages/server/src/services/websites`          |
| Durable generation, section-addition, and layout workflows            | `packages/server/src/workflows`                  |
| Authenticated website API and workflow stream                         | `packages/server/src/api/routers/websites.ts`    |
| Dashboard state, controls, previews, and AI sidebar                   | `apps/webapp/src/app/[locale]/dashboard/website` |
| Published route resolution, metadata, cache, and rendering            | `apps/websites`                                  |
| Website/version columns and relations                                 | `packages/db`                                    |

Use the package subpaths to keep these boundaries visible:

- package root: stored document and production rendering;
- `@starter/infinite-website/editing`: pure edits and authoring contracts;
- `@starter/infinite-website/generation`: generation profiles, persisted snapshots, and workflow events;
- `@starter/infinite-website/preview`: editor-only render hooks and targets.

## Lifecycle at a glance

```text
three-field brief
  -> authenticated API reserves the organization website
  -> durable generation creates a bilingual draft
  -> replayable events build the dashboard preview
  -> atomic workflow save installs the authoritative draft
  -> direct edits or mutation workflows create later draft revisions
  -> publish advances the published-version pointer
  -> apps/websites reads that immutable version and renders SiteRenderer
```

The `websites` row is the mutable ownership record. It holds the organization, brief, draft and published version
pointers, optimistic revision timestamp, and at most one attached Workflow run ID. A `website_versions` row holds one
complete snapshot split into structure, content, logic, Brand, asset bindings, and template ID.

## Dashboard load and state

The dashboard route starts the current-website and website-agent-chat queries on the server and dehydrates them into the
client. `WebsitePage` then chooses the matching state:

1. query pending: show the stable canvas skeleton;
2. query failure: show the localized retry state;
3. no draft: link to business onboarding, or retry generation from the saved brief;
4. attached initial generation without a snapshot: keep the stable canvas skeleton;
5. recognized attached workflow with a snapshot: resume its stream and show the appropriate optimistic preview;
6. idle draft: mount the full editor.

The client store contains only view/workflow state: the current snapshot, stream cursor, applied event keys, per-section
readiness, active operation, and rollback snapshot. The query cache holds the current server projection and temporarily
carries optimistic direct edits. On mount, persisted state either recovers the draft or resumes the attached run. An
unrecognized attached Workflow keeps editing blocked.

The server derives the deterministic agent chat ID from the authenticated user and website and returns it with the
stored messages. Chat identity is a server concern; neither the renderer nor Infinite Website depends on users or chat.

## Initial generation

Onboarding collects the business name, location, and type in three steps, creates and activates the organization,
then starts this same generation flow and opens the Website editor directly, without a setup checklist. The submit
button stays busy during the handoff. Activation or startup retries reuse the created
organization. Invited members continue into the existing workspace without generating new content.

The first successful website generation also creates a matching Links draft in the same transaction. It reuses the
website's bilingual name and short description, uses code-owned destination labels instead of SEO titles, links to the
generated pages, and inherits its Brand and button style. Its header layout, wallpaper style, and button shadow are
drawn per organization from combinations that work without a profile photo. The generated description is capped at 100 characters and avoids repeating
the business name. AI Links edits allow 40-character labels, 100-character bios, 60-character headings/titles, and
240-character text blocks; manually authored document limits remain independent. Existing
Links drafts are preserved. Later website edits and template changes never replace Links content. Both drafts remain
unpublished until the user publishes them through their editors.

`POST /websites` accepts `{ brief: { name, type, location, schemaVersion: 1 } }`; the form exposes only the three
business fields and the client supplies the schema version. The server validates the brief, inserts or reuses the one
organization website row, rejects an existing draft, and atomically claims a new run. Claiming is compare-and-set on
the expected previous run ID, so a stale request cannot take ownership from a live operation.

The durable workflow then performs this sequence:

1. Bind the run to the database row; the Brand step emits `planning`.
2. Compose a selection from the generation-safe section catalog while English and Arabic page plans and the Brand
   direction run concurrently. Initial generation uses no named template; `templateId: "custom"` records that origin.
   Explicit template changes retain their selected profile and its Brand.
3. Start one site-wide media resolution branch as soon as the profile and Brand are known.
4. Instantiate the selected page shell with stable IDs, English as the default locale, and matching Arabic content.
   The default pages are home, about, services, FAQ, and contact. Supplied menu items replace Services with Menu;
   supplied portfolio descriptions replace FAQ with Our work. A business type alone never creates a menu or portfolio.
   Custom generation uses shorter, purpose-specific recipes and a required working contact form.
5. Emit `prepared` with the shell and every section slot, then emit `writing`.
6. Start one durable step per slot, all at once. Each step writes every locale in parallel, so each added language
   adds parallel calls rather than time; slots containing only code-owned text, such as the header, need no model call.
7. Repair only the invalid locale once. A required slot failure fails the run; an optional slot emits
   `section-skipped` and is removed.
8. Materialize each successful section in the same step and emit it as soon as its locales finish.
9. Settle media, assemble and validate the complete snapshot, emit `saving`, and atomically save the draft while
   clearing the attached run ID.
10. Emit `completed` with the persisted snapshot.

Each slot runs in one Workflow step that calls its writer for every locale; a retry rewrites that slot's locales.
Step DTOs contain serializable profile references, plans, fields, and asset intents—not registry objects,
functions, Maps, or Zod schemas. A step resolves the current shipped pattern from its identifier.
After binding the run, generation has a five-minute durable deadline. A stranded step emits the normal failure
event through that deadline; late generation results cannot reach the draft-save step.

### Model boundary

The selected sections own page structure, patterns, IDs, asset intents, settings, and typed link destinations. Custom
sites take one reviewed template Brand: Jev ranks the template Brands against the brief, and a draw seeded by the
website ID picks among those within half of the best probability, so similar businesses do not all share one look.
When ranking is unavailable, the site keeps the neutral palette and minimal bilingual typography. Every business can
use photo sections; galleries are reserved for visual businesses. The
model writes visible text only. Navigation and CTA labels are code-owned English/Arabic copy derived from their actual
destinations; header actions target Contact independently of navigation order. Layout generation preserves existing
label/link pairs and derives new labels from the bound link. Text regeneration uses safe alternatives for the link type,
including booking copy only for a configured booking link. Prompt fields use compact keys such as `f0`; the server maps them back to declared
content pointers after exact structured-output validation. The model cannot choose routes, links, assets, CSS, colors,
fonts, settings, provider IDs, or document structure.

Copy uses DeepSeek V4 Flash with thinking disabled, routed to DeepSeek first and Alibaba next, with Gemini 3.6 Flash at minimal thinking as the fallback model. Calls have no deadline of our own, so a slow provider fails over through the gateway instead of failing the run; the AI SDK retries transient errors and Workflow owns durable retries. Malformed
JSON receives local `jsonrepair`; schema-invalid output receives one explicit repair call. Section copy containing
numbers absent from the brief, in Western or Arabic-Indic digits, receives that same single repair; the current year is
allowed, and copy that still carries such numbers after the repair is kept rather than failing the run.

Initial generation makes one ranking call for the Brand and no layout model call. Section choices are stable for the same
business brief: each slot draws from its category with a seed derived from the brief, favouring patterns used by
templates that match the business type and damping patterns that most templates share. A pattern appears at most once
per site while its category has unused alternatives, so every page opens with a different hero. Header and footer are
drawn the same way from reviewed patterns whose copy is code-owned or fact-free, and blog feeds are left for explicit
addition. Generation-safe sections are the hero, content, features, gallery, FAQ, call-to-action, and `contact-form`
patterns whose text fields carry no facts (prices, numbered labels, addresses, hours, metrics, people, or quotes); other
categories stay reachable through templates and manual layout swaps. Navigation and dropdown labels, accessibility labels
(including carousel controls, named from the section category), and the business name are code-owned. Footer images are
searchable stock illustrations, and template palettes are reused without the template's example logo. The single-repair
policy and caller cancellation still apply.

The brief also accepts optional public business `details`, actual `menu` items, actual `portfolio` descriptions, and
`voice`. These are user-confirmed facts, never inferred from the business type. The required onboarding fields remain
name, type, and location. The server persists a shared writing voice with the brief, drawn from equally restrained
alternatives for its kind of business; generation, section addition, layout changes, and text rewrites reuse it in
either language. These inputs remain untrusted data in prompts.
Each generated section receives the page's outline and a heading approach rotated per website. Section insertion receives
bounded excerpts from the existing page so it can complement neighboring content. Contact form labels, validation
states, and submission messages use code-owned bilingual copy and do not require a model or promise a reply time.

Server and webapp pin the Mastra-compatible `ai@7.0.102`, with `@ai-sdk/react@4.0.105` in webapp.
Only Jev evaluation uses the unmodified `ai@7.0.106` release through the server's `ai-evaluation` alias, because its
evaluation API is newer than Mastra's compatible provider types. Generation, chat, and Mastra retain the main SDK;
no library patches are required.

### Media boundary

Every asset intent is seeded with a deterministic local placeholder before provider access. Stock queries combine the
business type with one of a few scenes of people and their work, rotated per business, and a wide or detail shot.
Resolution groups identical queries, limits stock searches and concurrency, searches Unsplash and Pexels together, records selection-time provider
download events, and persists intrinsic/responsive metadata. Provider errors, missing credentials, timeouts, empty results, and
unsafe hosts retain the placeholder; they do not invalidate an otherwise valid website.

Stock photos have one entry point in `packages/server/src/lib/stock-images.ts`: search returns normalized, interleaved
photos with opaque IDs, responsive sources, pagination, and partial availability. `getStockImage` resolves an
ID through its registered adapter; `bindStockImageCandidate` validates delivery hosts and runs selection tracking.
`stock-image-providers.ts` owns credentials, provider response schemas, request formats, and the adapter registry.
Adding or replacing a provider changes that module without changing services, RPC, agents, or editors. The optional
`findStockImage` agent tool combines search, a bounded metadata-only Jev choice, and the same trusted binding. It does
not inspect image pixels or accept generated provider URLs.

The shared media picker and agent tools use `media.searchStock` / `searchStockImages`, then
`media.selectStock` / `selectStockImage`. Selection resolves trusted provider data and registers an organization-owned
public media file; downstream edits continue to use the existing file ID or media URL. Website and blog
generation use the same library entry point. Search failures show a retry state in the picker; partial failures retain
available photos. Configure `UNSPLASH_ACCESS_KEY` and `PEXELS_API_KEY` to enable both adapters.

An `asset-settled` event distinguishes `provider` from `placeholder`. Placeholders are immediately visually ready.
Provider assets become ready when the browser loads them; an image load failure swaps back to the deterministic
placeholder.

## Events, recovery, and cancellation

All stream messages use the version-1 discriminated union:

| Event             | Meaning                                               |
| ----------------- | ----------------------------------------------------- |
| `status`          | `planning`, `writing`, or `saving`                    |
| `prepared`        | authoritative shell and complete slot list            |
| `section`         | one final section plus localized content delta        |
| `asset-settled`   | provider or placeholder asset result                  |
| `section-skipped` | remove one optional placeholder                       |
| `completed`       | authoritative persisted snapshot                      |
| `failed`          | typed generation, section, layout, or generic failure |
| `cancelled`       | attached run was cancelled                            |

The Workflow stream index is the cursor. Reconnection sends `afterCursor`; the store also ignores an already applied
`eventKey`. The browser buffers envelopes until the next animation frame and applies the batch in one Zustand update.
`prepared` and `completed` parse full snapshots; section and asset events apply bounded local deltas.

On completion, the editor stays locked while the controller refetches the saved website revision, even if the stream
subscription has already closed. Canvas and sidebar controls share the same workflow lock. A failed modification rolls
the editor back and the failure step compare-and-set clears the run's database ownership before it emits `failed`, so
editing and publishing continue immediately. Reads, direct edits, and publishes also release a run that is failed,
cancelled, completed, or missing while still attached to a website that has a draft; initial generation has no draft and
keeps its failed run attached until it is retried. A run that is still active fifteen minutes after its claim is
cancelled and released the next time the website is read, edited, or published. Links refreshes run independently and do
not block website editing.

When a stream ends without completion, the controller also refetches instead of assuming success. It adopts a persisted draft,
shows a recorded failure, or marks a recoverable disconnection. `NOT_FOUND` reconciles immediately. Initial-generation
failure has no partial draft; section addition, layout generation, and template change retain a rollback snapshot.

The editors let generation finish without a cancellation button. Internal cancellation requires the exact website and
run IDs. The server cancels the Workflow run if it still exists and then
compare-and-set clears only that run's database ownership. A late completion cannot overwrite a newer owner.

## Editing

There are two mutation paths, selected by whether model/provider work is required.

### Immediate revision-safe edits

Text, typed links, menu items, repeatable disclosure items, section order/removal, and Brand edits from the dashboard use
`PATCH /websites/{websiteId}`. Approved AI edits call the same atomic server service directly. The editor:

1. applies the package-owned pure edit locally;
2. places the optimistic snapshot in the query cache and generation store;
3. sends the edit with the current `updatedAt` revision;
4. replaces the optimistic state with the server response, or rolls back and refetches on failure.

The server locks the organization draft, rejects an active workflow or stale revision, prepares behavior programs,
applies the same pure edit functions, validates the complete result, prunes unused asset bindings, and writes the draft
atomically. If the current draft was already published, persistence creates the next version rather than modifying the
published row. A template change or restyle that changes the draft's template also creates the next version and leaves
the previous unpublished draft in place as a restore point; there is no user-facing restore and no automatic cleanup yet.

Main-language text edits translate every other website locale concurrently before the transaction. A translation
failure rejects the whole edit with `SERVICE_UNAVAILABLE` and saves nothing.

Publishing waits for any direct edit already in flight, rereads the resulting query-cache revision, and publishes only
when that revision still has unpublished changes and no workflow is active.

The advisory publish review includes shared header/footer copy on each page and checks unsupported business claims and
CTA promises against the brief and actual link destinations, alongside localization and placeholder checks. An
unavailable review remains unavailable rather than reporting a clean result.

Clicking or pressing Enter on a navigation item opens the dedicated menu-item editor directly. A save atomically
updates its localized label and fallback destination, converts direct-link/dropdown structure, edits dropdown entries,
or removes the item. Dropdown controls are not routed through the ordinary link popover.

In edit mode, the dashed header plus opens a menu panel for adding links and moving navigation items earlier or later.
The control measures the available space beside the navigation and falls below the header when neither side fits.
Insertion and reordering use the same revision-safe edit path; new destinations are seeded in the selected
and default locales. The server translates added or edited navigation and header button labels into the other website
locales before committing the edit. Translation runs outside the database transaction, and the revision is checked again
before persistence. Explicit translations submitted together are preserved. Existing items remain directly editable on
the canvas.

### Workflow-backed mutations

- Section addition validates the page, insertion index, and globally safe pattern; emits an optimistic placeholder;
  generates English and Arabic copy while media resolves; then saves the entire draft atomically.
- Layout generation targets one exact section. Compatible layouts reuse content without model work. A layout with new
  text pointers generates only those missing fields; media resolves concurrently.
- Template change reuses the initial generation workflow with a fixed template and a rollback snapshot. Nothing is
  persisted until the complete replacement passes validation.

Only the current row owner can complete one of these workflows. A failed addition/layout/template operation leaves the
stored draft unchanged and the client restores its pre-operation snapshot.

### AI editor

The website chat agent loads the website skill, inspects the current organization draft, and receives revision-scoped
handles (`pN`, `sN`, `tN`, `lN`) rather than persisted UUIDs or raw trees. Read tools stay available until the requested
scope is inspected. Mutations require approval and close the website tool surface for that turn.

Copy and link edits use the immediate edit path. `composeWebsiteSection` and `buildWebsite` author or modify the three
independent layers—flat primitive structure, bilingual semantic copy/typed links, and optional bounded logic—then use
the same atomic edit service. They do not start a generation Workflow. Images are bounded search intents resolved by the
server; the model cannot provide URLs. Registered pattern structure is changed through catalog/layout operations, not
the composed-section tool.

Before composing, `inspectWebsite` scope `reference` asks Jev for the nearest reviewed catalog layout, excluding the
insertion point's neighbors and heroes below the top, and returns its keyless structure without copy. The agent adapts it, or adds the reviewed
pattern with `addWebsiteSection` when it satisfies the request unchanged. The agent's `website-authoring` output
processor checks `composeWebsiteSection` and `buildWebsite` drafts before execution or approval: exact contract
validation first, then one Jev question per copy key for business facts nobody supplied. A rejected draft is replayed
once with targeted feedback and its previous input, so the model repairs only the named parts. The Jev check fails open,
and a second rejection falls through to the tool's normal validation error.

Composed sections may use `carousel`, `tabs`, `disclosure` (accordion), `embed` (Google map and contact form), box
`reveal`, and text `scrollReveal` through bounded flat props; the composition validator blocks empty or blank collections,
blank contact-form labels, and maps without a location. Catalog references flatten these nodes, so the only remaining
reference stubs are `masonry`.

The complete authoring grammar, behavior profiles, and sandbox limits live in the package README and the Mastra skill
contracts in `packages/server/src/ai/website-contracts.ts`; they are intentionally not duplicated here.

## Preview modes

All visual modes consume a `WebsiteSnapshotV1`; none invent a separate page model.

| Mode                      | Source and renderer                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| Pre-`prepared` generation | fixed dashboard canvas skeleton                                                                                   |
| Streaming generation      | `SitePreviewRenderer` with a lean section boundary and readiness placeholders                                     |
| Edit mode                 | `SitePreviewRenderer` with section controls, insertion gaps, inline text/link/menu targets, and behavior sessions |
| Preview toggle            | production `SiteRenderer` without editor controls                                                                 |
| Layout picker             | immediate section layout with shimmer for missing text, followed by generated copy in the selected locale         |
| Section catalog           | deterministic bilingual preview document, loaded as cards approach the viewport                                   |
| Template picker           | immediate homepage skeleton followed by a bounded generated homepage preview; failure keeps the latest preview    |
| Published application     | `SiteRenderer` over the immutable published snapshot                                                              |

The streaming renderer subscribes each section boundary only to the assets it references, so one image settlement does
not rerender every section. After completion the dashboard swaps to the full editor. Locale and page selection always
resolve against the document's localized routes, with default-locale content fallback.

Layout previews generate only missing copy and reuse existing images. Template previews generate only the selected
locale and reuse exact matching pattern fields from the current snapshot; switching locale requests its corresponding
preview. Preview cancellation reaches queued work, provider calls, and media work. Layout failures
restore the baseline; template failures keep the latest valid preview. Late responses cannot replace a newer selection
or reopen a closed picker.

Successful validated preview fields enter a disposable, 30-minute server-side Redis cache scoped by organization,
website, source revision, target, section slot, and locale. Template/layout Apply reuses matching fields before calling
writers, and still validates and completes every required locale. Cache failure falls back to generation. Client
preview fixtures and failed writer fallbacks never become reusable generation output.

The Themes panel also offers **Keep my content**. Its model-free preview applies the selected Brand and only reviewed
layouts that preserve every existing content reference, link, media binding, section ID, and behavior. Sections without a compatible
layout keep their structure, including custom sections whose current fields cannot populate a reviewed layout. Apply uses a revision-checked atomic draft update; it does not start full
regeneration. The panel reports the number of changed and retained layouts before saving.

Draft previews are disposable. Closing a Brand/layout/template overlay restores its baseline unless the user applies
the change. Applying a compatible layout is an immediate edit; applying a generated layout or full template replacement starts the
corresponding atomic workflow. Keep-my-content restyling uses the immediate revision-safe path.

## Persistence and publication

The website row has nullable draft and published version pointers. A version stores a complete validated site:

- initial generation creates draft version 1 and does not publish it;
- after initial generation saves, a separate durable workflow writes one unpublished English/Arabic Blog draft from the business brief; template changes do not create another post;
- unpublished edits update the current draft row;
- the first edit after publication creates the next draft version;
- publishing marks the exact draft version published and advances the published pointer in one transaction;
- dashboard reads follow the draft pointer; public reads follow only the published pointer;
- every write removes asset bindings no longer referenced by section content or localized page SEO metadata.

`apps/websites` resolves the request Host through verified website domains, fetches the current published-version pointer, and caches the projected snapshot by
website ID plus immutable version ID with `cacheLife("max")`. Publishing changes the pointer, so a new request selects a
new cache key without invalidating an immutable prior version.

The catch-all public route resolves the locale, page slug, or noindex Brand Guidelines route. It builds localized
metadata and renders `SiteRenderer` with Next.js links and the language switcher. Unknown/unpublished routes call
`notFound`. Brand Guidelines and missing pages are always `noindex`.

Ordinary pages are indexable only when `WEBSITE_CRAWLER_POLICY=public` and the website has a connected primary domain. Local subdomain previews are always noindex. Public pages then receive canonical, locale-alternate, and `x-default` URLs; all other configurations remain
`noindex, nofollow`. Public pages also receive Open Graph/Twitter cards (falling back to the brand-colored `/api/og` card) and
Organization/WebSite/WebPage JSON-LD. Enabled `head` integrations are server-rendered through a tag and attribute
allow-list; body integrations still inject on the client.

## Validation and failure ownership

Validation is layered deliberately:

1. API schemas validate authenticated boundary input and translate expected stale/target failures to typed errors.
2. AI structured output validates every declared field before it can reach materialization.
3. Section materialization resolves the shipped pattern and validates content pointers, assets, links, settings, and
   collection identities.
4. `parseSiteDocument` validates the complete graph, cross-references, resource limits, and logic bindings.
5. Persistence validates Brand and split structure/content/logic columns and prunes assets.

Read paths do not repeatedly parse complete stored documents. A module-scoped leaf schema may recover the type of a
value reached through a dynamic JSON pointer. Corrupt persisted data, missing shipped profiles, and programming errors
propagate; they are not relabeled as user mistakes.

Expression logic is compiled to the package-owned exact-decimal/boolean IR. Script logic is test-executed before
persistence and runs in the browser through one reusable QuickJS session per mounted program. The host exposes no DOM,
network, timers, Date, Proxy, or randomness and accepts only declared outputs and bounded scroll commands.

## API inventory

The authenticated website router exposes the current state and agent chat; initial generation; section addition;
layout generation; template listing, preview, and change; direct edits; publication; event streaming; section catalog
and previews; and cancellation. These are internal oRPC procedures unless separately marked public. Public site reads use
the server's dedicated published-website service, not the dashboard router.

## Verification

Use real repository commands; there is no separate `verify:website` root script.

```bash
# Package contract and package tests
bun run --cwd packages/infinite-website verify

# Cross-boundary unit coverage
bun run test packages/server/tests/ai/website-generation-prompts.test.ts packages/server/tests/services/website-generation.test.ts apps/webapp/tests/app/website apps/websites/tests

# Database-backed website persistence coverage (requires the configured test containers)
bun run test --root packages/server --config vitest.integration.config.mts tests/services/websites.test.ts

# Durable Workflow suites
bun run test:workflow

# Relevant Playwright flows (requires the configured PostgreSQL/Redis test environment)
bun run test:e2e -- e2e/public-website.spec.ts e2e/website-generation.spec.ts e2e/custom-section-behavior.spec.ts

# Repository gates; do not use a build as verification
bun run test
bun check
```

Exact field contracts remain deterministic Vitest coverage. Production model quality is observed through Mastra trace
scorers rather than a second eval runtime.

## Blog publication

Organization-owned posts live in `blog_posts`, independently of website versions. Dashboard edits change the draft
only. Publication checks the exact saved revision and atomically captures both English and Arabic; the slug locks
after first publication. Unpublishing retains editable content. Published timestamps advance only on publication,
so draft saves cannot change article metadata or sitemap dates.

The dashboard at `/dashboard/blog` supports paginated search/status filtering, manual Tiptap editing, bilingual AI
drafts, missing-language translation, and generation progress. Durable workflow claims and revision checks
prevent stale completion from overwriting newer edits or recreating deleted posts. Assistant and MCP operations use
the same organization-scoped services and contracts; assistant mutations require approval.

Public `/blog` and `/blog/[slug]` routes follow the website locale convention and require a published website. They
read only published post snapshots, reuse the website shell and Brand, and provide canonical/alternate metadata and
sitemap entries under the existing crawler policy. Blog reads use request-level React deduplication, so publishing
a post updates routes and latest-post feeds without republishing the website. The sitemap is request-time.

“Add Blog to website” edits navigation in the website draft; the website must then be published normally. Add the
three- or six-post content pattern through the website section catalog for a live feed. These sections retain their
normal move/remove/layout controls and store localized headings, not article content.

The Blog browser test runs against the isolated PostgreSQL fixture and separate app/public dev directories:
`E2E_REUSE_STYLES=1 bun run test:e2e e2e/blog.spec.ts` reuses an existing stylesheet generated by the development
watcher, avoiding a build during verification.

## Contact form submissions

The Contact category in the section catalog includes `contact-form`. Adding it seeds complete English and Arabic
form copy without a model call. Headings and descriptions use the existing inline text editor. Preview and Storybook
forms stay disabled; the published app supplies the submission component through `SiteRenderer`.

The public app initializes BotID in `src/instrumentation-client.ts`, wraps its Next config with `withBotId`, and verifies
`POST /api/contact` before processing a bounded JSON body. The server resolves the organization from the verified request hostname and
requires the submitted section in the current published version. Contact IDs are assigned by the database.

Contact resolution and message creation share a transaction. Existing contact details remain unchanged, while each
message preserves the submitted name and phone. Organization members read paginated messages in Contacts → Activity.
Deleting a contact also deletes its messages. Apply the generated contact-messages migration before deployment.

BotID production classification requires a Vercel deployment; local development uses BotID’s development behavior.

## Custom domains

Every website gets a platform address, `<subdomain>.<WEBSITES_PLATFORM_DOMAIN>`, assigned at creation and editable in
Domains. A released platform address stays reserved for its previous website for 90 days, and generic infrastructure,
authentication and payment labels are reserved. Without that variable, sites resolve only through connected domains (and `<website-id>.localhost` in
development). Host lookups and primary hostnames are cached in Redis for five minutes and invalidated on every domain
change.

Search follows Durable's flow: the business name is searched on open, input is debounced, and results load in three
steps. `domains.suggest` returns candidates (the name on leading extensions, model suggestions on `.com`, then other
extensions), `domains.availability` checks them in bulk, and `domains.prices` prices only the displayed available names.
Every TLD Vercel Registrar sells is searchable and purchasable, including second-level suffixes such as `uk.com` and
`sa.com`; IDN TLDs are excluded. A zero Vercel price means the name cannot be bought.

Checkout collects the customer as registrant. `domains.quote` returns the price and the TLD's Vercel contact schema
(for example `.ca` legal type and `.us` nexus); extra fields are validated on submit and sent under
`contactInformation.additional.<tld>` through the raw buy endpoint, because the SDK strips them. Purchases run only when
`DOMAIN_PURCHASES_ENABLED=true`; there is no customer payment yet. The durable `registerDomainWorkflow` submits the order,
polls it, marks the registration active, and connects apex and `www` on Vercel nameservers.

Connecting an existing domain reserves apex and `www` as one group with one TXT proof at
`_starter-verification.<apex>`; both methods prove ownership with that record, and pointing nameservers to Vercel is
never proof. With the nameservers method the dashboard shows the TXT record first and reveals the Vercel nameservers once
ownership is verified. Hostnames on or above `WEBSITES_PLATFORM_DOMAIN` and hostnames under another organization's
registered domain cannot be connected; a subdomain of the organization's own registered domain is verified without a
TXT record. All required records are shown
up front with per-record status, conflicting A/AAAA/CNAME records to remove, and a CAA warning. The dashboard polls
while a domain settles and `/api/domains/reconcile` rechecks pending domains every minute with backoff, releasing
unverified reservations after 14 days. A verified claim (a proven TXT record or a registration) removes other
organizations' unverified reservations of the same hostname, a website holds at most 10 unverified hostnames, and only
one website can hold a verified hostname. The apex becomes primary automatically once live; other hostnames 308-redirect
to it. A connected domain is never demoted by a later failed check. Nameserver and purchased domains get a DNS editor
with the routing records locked; it opens only for the apex or `www` row of a zone the organization proved or
registered, never for a subdomain row, the platform domain, or a domain registered by another organization.

`/api/domains/registrations` runs daily: it syncs expiry and auto-renew from Vercel, marks expired registrations, and
emits expiry reminders at 30, 7, and 1 days when auto-renew is off. Domain connected, registered, failed, and expiring
events project into the notification inbox. Transfer-out auth codes require delete permission.

Configure `VERCEL_DOMAINS_TOKEN`, `VERCEL_DOMAINS_TEAM_ID`, `VERCEL_WEBSITES_PROJECT_ID`, `WEBSITES_PLATFORM_DOMAIN`
(with a wildcard domain on the websites project), and optionally `DOMAIN_PURCHASES_ENABLED`. Search rate limiting uses
`UPSTASH_URL`/`UPSTASH_TOKEN` when present.

### Website languages and site settings

The Website, Links, and Blog editors share the website document's enabled languages and main language.
The main language uses unprefixed routes; other languages use their ISO 639-1 prefix. Adding a Website
language translates text, SEO fields, and Blog interface labels while retaining entity IDs, media, links,
and page slugs. Language additions queue a durable translation workflow and return immediately. The
language appears in settings with a translating badge while the job runs. The website row keeps the
translation locale and workflow ID so progress survives refresh. Each translation step has
up to two retries; individual model calls allow 60 seconds. A failed job releases the row immediately so editing and
publishing are never blocked; the failure is shown in the session that started the job and the language can be added
again.
Website and Links translation runs in the job; Blog translation uses its existing post workflow.
Translation failures leave the existing website document unchanged. Main-language text edits
also translate their corresponding text fields; explicit target-language edits in the same batch win.
Links translation fills missing copy and Blog translation preserves rich-text structure and marks.
Text direction is inferred from the locale's maximized script, including explicit script overrides.

The shared Site settings Credenza uses the `websiteSettings` query parameter for Domains, Languages,
and Integrations. Integration settings are versioned with the document and become public when the
website is published. Domains retain their existing immediate connection and verification flow.
Integration snippets execute only on the public app.
