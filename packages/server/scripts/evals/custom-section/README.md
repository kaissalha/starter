# Custom-section composition eval

Repeatable live eval for the AI-composed custom section (`composeWebsiteSection`). It drives the production
`dashboardChatAgent` with the production model (`models.websiteAuthoring`, through the AI gateway), the routed
`website-compose` skill reference, the real tool policy, `inspectWebsite`/`getBrand`/`composeWebsiteSection` tools and the
real `websiteAuthoringProcessor`, then renders the accepted section and lints the result. Judge deterministic behavior in
Vitest and runtime quality from Mastra traces; this harness exists only to compare two revisions of the composer.

## Run

```sh
bun run --cwd packages/server eval:custom-section run --label my-change
bun run --cwd packages/server eval:custom-section run --cases pricing,faq-1 --limit 6 --concurrency 3
bun run --cwd packages/server eval:custom-section compare baseline-head my-change
bun run --cwd packages/server eval:custom-section compare baseline-head my-change --judge --max-usd 3
```

- Credentials: `AI_GATEWAY_API_KEY` from the environment or `apps/webapp/.env.local`. Nothing else is read from that
  file and no database, Redis or storage connection is made. Keys are never printed.
- Playwright Chromium must be installed (`bunx playwright install chromium`). The website stylesheet must exist
  (`bun --filter @starter/infinite-website build`).
- Output is gitignored under `packages/server/.evals/custom-section/<run-id>/`: `results.json`, `summary.md`, and per
  case `case.json` (processor trace, accepted draft, checks), `page.html`, `section-{390,834,1440}.png` and
  `context-{390,834,1440}.png` (section plus neighbors). `compare` writes `compare-<A>-vs-<B>/compare.md`.
- A full run is 41 cases and takes roughly 10 to 20 minutes at concurrency 4 to 5. Agent-model cost is a few cents.

To measure a revision other than the working tree, check it out in a git worktree, link `node_modules` the way the
primary checkout has them, copy this folder and `vitest.eval.config.mts` in, symlink `apps/webapp/.env.local`, and pass
`--output-dir` so results land in the shared output directory.

## What is exercised and what differs from production

Same code: `dashboardChatAgent` (instructions, `prepareStep` tool gating, `maxProcessorRetries`), `skills.ts` references,
`loadChatTurnContext` and `resolveDashboardRoute` for the routed `website-compose` context, `inspectWebsite` including
reference retrieval and Jev, `getBrand`, the `composeWebsiteSection` provider schema, exact validation, the
`websiteAuthoringProcessor` (Jev unsupported-copy check and replay), the real `composeWebsiteSection` execute, and the
edit pipeline (`prepareWebsiteEditInputs`, `editWebsiteSnapshots`).

Replaced (via `vi.mock` in `custom-section.eval.ts`, state in `in-memory-website.ts`):

- `getWebsite`/`editWebsite` are an in-memory store seeded from a template preview document and its template brand;
  no Postgres. Stale-revision conflicts still apply.
- Permissions always resolve to owner; Mastra memory is absent (single user turn, no history, no working memory).
- Image search is a deterministic placeholder (`resolveWebsiteAuthoringMedia`): broken-image checks only catch missing
  bindings, and images carry no semantic content.
- The route classifier is skipped: every case is routed to `website-compose`, with the website editor bound to the home
  page and the section before the insertion point selected (the middle of the page).
- Approval: the agent suspends on the approval request. The harness treats a processor-accepted, exactly valid last
  attempt as approved and runs the real tool `execute`.
- If the agent answers without composing (asks a question or replies in prose), one follow-up turn says
  "decide the details yourself, no questions" and the case is marked as nudged (`composed without clarification`).
- Existing home-page sections matching the case intent are removed from the seeded template so the agent does not
  correctly answer that the page already has one.

## What is measured

Per case: processor-accepted and schema-valid first attempt, compose attempts and processor replays, final validity (a
draft that materializes into the template document), tool errors, latency, tokens and agent-model cost (excludes Jev
calls, which go through the evaluation gateway), insertion at the selected position, intent traits (minimum repeated
items, media, actions, fields, supplied facts preserved), tools called.

Authored graph: node count, primitives used, share of lengths using `sp`, share of text nodes using `appearance`.

Rendered (static SSR of the full page with `SiteRenderer` plus package CSS and brand fonts, headless Chromium at 390, 834
and 1440 px), scoped to the composed section: text contrast against the composed background (large text 3:1, other 4.5:1;
text over an image, gradient or overlapping media is counted as N/A and excluded), elements overflowing the viewport
without a clipping ancestor, page-level horizontal overflow, clipped text, broken or missing images, interactive targets
under 44 px (and 24 px), and empty flex/grid containers.

Judge (optional, `--judge`): pairwise, order-swapped comparison of the rendered context screenshots (1440 then 390) by a
strong model (`--judge-model`, default `anthropic/claude-opus-5.5`). Only cases composed in both runs are judged; a pair
counts only when both orders agree, a disagreement or a tie is no preference. Reports suite-level wins, win rate among
decided pairs with a sign-test p-value and n, stops at `--max-usd` (default 3; roughly $0.09 per pair, so about $2.7 for 29 pairs), and never reports per-case verdicts.

## Limitations

- One sample per case from a stochastic model: differences below the printed noise half-width at n=41 (about 15 points
  for rates near 50 percent) are not distinguishable; rerun both sides before trusting a small gap.
- The renderer is static SSR: carousels, tabs, disclosure and scripted behavior are not hydrated or interacted with.
- Contrast ignores image and gradient backgrounds, blend modes and backdrop filters; opacity is composited.
- The corpus holds terse requests on three templates (`pure-vitality`, `heritage-drive`, `sparkle-home`) at one
  mid-page position with default site facts; it does not cover editing existing sections (`buildWebsite`).
- Intent traits are coarse structural counts, not a quality score.
