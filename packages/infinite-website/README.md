# @starter/infinite-website

Infinite Website is Starter's private document model and React runtime for localized small-business marketing sites. It
provides:

- one persisted website document;
- a closed set of generic layout, content, and interaction primitives;
- 138 reviewed section patterns: 135 catalog designs plus three host-rendered patterns;
- 23 complete example templates;
- runtime validation, localization, RTL layout, and scoped styles.

The package is original and does not depend on Puck. It is a website runtime and authoring library, not an editor,
publishing service, or persistence layer.

## Audited v1 snapshot

| Area                       | Current implementation                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------- |
| Package status             | Private workspace package, version `0.0.0`                                                |
| Persisted document         | `documentVersion: 1`                                                                      |
| Primitive node types       | Closed runtime set exported as `coreNodeTypes`                                            |
| Section categories         | 17 schema values; 15 currently used by shipped patterns                                   |
| Shipped section patterns   | 138 (135 catalog designs plus `contact-form`, `blog-latest-three`, `blog-latest-six`)     |
| Shipped templates          | 23; all currently single-page                                                             |
| Example locales            | English and Arabic for every shipped section fixture and template                         |
| Interactive primitives     | Base UI menus, disclosures, and tabs; Embla carousels                                     |
| Validation                 | Zod shape validation, package-registry graph validation, and generated Draft 2020-12 JSON |
| Styles                     | Tailwind CSS 4 compiled and scoped beneath `.website-container`                           |
| Automated package coverage | Vitest coverage for documents, rendering, generation, templates, and interactions         |

Document v1 includes bounded behavior plus `field`, `value`, and `trigger` primitives. Authors may provide named,
independently typed CEL expressions, which code compiles into the package-owned exact-decimal/boolean expression IR
before persistence. Decimal outputs bind `value` nodes; boolean outputs bind `visibleWhen` or `disabledWhen`. Named CEL
logic may also map declared trigger events directly to validated section anchors for host-mediated scrolling. The legacy
single-expression shape remains readable and produces the decimal output `result`. When logic
genuinely needs iteration, authors may instead provide a `custom-js-v1` script defining `calculate(inputs)`. It runs in
a QuickJS WebAssembly sandbox with no DOM, network, Date, Proxy, timers, or randomness, an 8 MB memory limit, and a 25ms
per-call interrupt deadline. Guest `eval` and `Function` remain available inside that isolated VM; they do not execute
in the host. A script may also define `interact(event)` and return a bounded command with an exact section anchor;
preparation records each validated event target and scripts never receive DOM access. Script insertion and replacement execute the
initial inputs and every declared event at the document persistence boundary as a
quality gate in one disposable session, then store `initialOutputs` for server rendering. The exact
`quickjs-emscripten` 0.32.0 dependency is part of the `custom-js-v1` execution contract. The browser lazily creates one session per script and
reuses it as fields change. This is the only pre-release document contract; earlier development shapes are rejected and
there is no compatibility adapter.

## Render a stored website

Build the package stylesheet before consuming it directly:

```bash
bun run --cwd packages/infinite-website build
```

The stylesheet contains no `@font-face` rules; hosts load fonts themselves. `apps/websites` links per-font stylesheets
generated from the Brand catalog, and other hosts import `@starter/infinite-brand/fonts.css`.

The root `bun dev` command runs the package's style watcher. Storybook compiles the source stylesheet live and does not
require a separate build.

```tsx
import type { BrandFoundationV1 } from "@starter/infinite-brand";
import { parseSiteDocument, SiteRenderer, type AssetMap } from "@starter/infinite-website";
import "@starter/infinite-brand/fonts.css";
import "@starter/infinite-website/styles.css";

export const WebsitePreview = ({
	input,
	brand,
	assets,
}: {
	input: unknown;
	brand: BrandFoundationV1;
	assets: AssetMap;
}) => {
	const document = parseSiteDocument(input);
	return <SiteRenderer document={document} brand={brand} assets={assets} />;
};
```

Parse untrusted JSON at its API or persistence-write boundary. Reads may trust documents that passed that write boundary.
`SiteRenderer` expects a complete, already validated
`SiteDocument` plus a validated `BrandFoundationV1` stored beside it in the website version; it does not accept a
template, section definition, or mixed structure/content object. Brand is not embedded in the website document.

`SiteRenderer`:

- uses `document.defaultLocale` unless `locale` is supplied;
- uses the page marked `home` unless `pageSlug` is supplied;
- returns `null` when no page matches;
- renders the global header, selected page, and global footer in that order;
- resolves missing localized values from the default locale;
- renders unresolved assets as labelled placeholders;
- renders image, direct-video, and YouTube assets through the same `media` primitive.

`AssetMap` keeps media delivery outside the persisted document. Existing image assets remain `{ src }` and render with
`loading="lazy"` plus `decoding="async"`. A host may add paired intrinsic `width`/`height`, up to six unique ascending
`sources: Array<{ src, width }>`, a bounded `sizes` hint, and explicit `loading`/`decoding` policy. The generic renderer
projects those fields to ordinary image markup; responsive delivery metadata is never stored in section nodes. Hosts
should mark likely above-the-fold imagery eager and leave other imagery lazy. Video assets use
`{ type: "video", src, poster? }`; `src` may be a direct or signed video URL, a root-relative URL, or YouTube.
Set media playback to `"background"` for a muted, looping, autoplaying, non-interactive video with no player chrome.
Player mode is the default and shows controls. YouTube uses a lazy, privacy-enhanced embed and derives a poster when one is
not supplied. Direct videos should supply `poster` so the first frame remains useful while loading and if playback fails.
Failed media without a poster renders as a labelled placeholder.

Callers should pass a locale listed in `document.locales`. The renderer does not independently validate its props or
revalidate the document.

## Create a website from a shipped template

Template definitions and their example content are separate exports:

```ts
import { instantiateTemplate, parseSiteDocument } from "@starter/infinite-website";
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";

export const createWebsite = () => {
	return parseSiteDocument(
		instantiateTemplate({
			definition: nordicEdgeTemplate,
			content: nordicEdgeContent,
			createId: () => crypto.randomUUID(),
			path: "/website",
		})
	);
};
```

`instantiateTemplate` creates a candidate document. Keep the final `parseSiteDocument` call: template instantiation
validates its content and node shapes, but the complete graph validation happens at the document boundary.

`entityIdFromSeed` is available for deterministic stories, tests, and temporary demos. Production creation should inject
the host application's UUID generator. Instantiate once, persist the result, and load that same document for rendering;
do not regenerate identities on every request.

The dashboard generation and editor flow is owned by the webapp and server packages. See the
[generation and editor guide](../../docs/website-generation.md). This package supplies the validated document,
generation contracts, and renderers; it does not own persistence or workflow state.

## Host lifecycle

This package owns pure document, editing, generation-event, preview, and rendering contracts. The webapp owns editor
state and controls; the server owns model and provider calls, Workflow orchestration, authorization, persistence, and
publication; `apps/websites` owns public route resolution. See the
[authoritative website lifecycle](../../docs/website-generation.md) for the complete generation-to-public-render flow.

Use `@starter/infinite-website/editing` for authoring and pure document edits,
`@starter/infinite-website/generation` for server/client workflow contracts, and
`@starter/infinite-website/preview` for editor-only renderer hooks. Normal stored-site rendering imports the package root.

## Data flow

```text
TemplateDefinition + TemplateContent + UUID factory
  -> instantiateTemplate
  -> candidate SiteDocument v1
  -> parseSiteDocument
  -> validated SiteDocument v1
  -> persistence

Validated SiteDocument
  -> persistence
  -> trusted stored JSON
  -> SiteRenderer + BrandFoundationV1
     -> project Brand colors, locale typography, and corners
     -> select locale and page
     -> merge default and localized content
     -> resolve section references and links
     -> render the closed primitive set
```

Reusable definitions have no entity IDs or literal visible content. Instantiation is the boundary that assigns page,
section, content, node, interaction, and ordered-item UUIDs.

## Document contract

```ts
type SiteDocument = {
	documentVersion: 1;
	defaultLocale: Iso6391LanguageCode;
	locales: Iso6391LanguageCode[];
	direction?: "ltr" | "rtl";
	structure: {
		layout: {
			header: SiteSection[];
			footer: SiteSection[];
		};
		pages: Array<{
			id: UUID;
			home: boolean;
			sections: SiteSection[];
		}>;
	};
	content: Partial<Record<Iso6391LanguageCode, LocaleContent>>;
};

type SiteSection = {
	id: UUID;
	contentId: UUID;
	anchor: string;
	category: SectionCategory;
	source?: {
		pattern: string;
	};
	settings?: Record<string, JsonValue>;
	root: PersistedSiteNode;
};
```

`source.pattern` records the shipped composition that seeded a catalog section and supplies its category, settings, and
localized content contract. AI-composed behavior sections omit `source`: their primitive tree and localized content are
validated directly, without pretending they came from a registered design. The persisted primitive tree is the editable
section presentation. Sections do not carry a definition version.

Persisted v1 compatibility is guarded by a frozen database-column fixture (an instantiated Nordic Edge template split
into its structure, content, and logic columns) and a frozen pattern manifest. Before launch the catalog was replaced
one-to-one by the current 135 designs, and both frozen files were deliberately reset to the new identifiers. From this
reset on, a v1 pattern identifier is append-only: add new identifiers to the manifest, but do not remove or rename an
identifier that may be stored. The fixture must keep parsing, editing, and rendering through the current runtime. Do not add per-pattern
migrations or compatibility readers inside v1; a genuinely incompatible document change requires a versioned v2
contract and an explicit host-owned migration.

Composed-section authoring represents its fifteen node types as a flat graph with child keys. Existing node keys accept
partial patches while their type stays the same; a type change requires complete props and new keys require complete
nodes. The server applies them to the inspected graph before the canonical
document schema validates the result for approval and persistence.

The structure tree and localized content are stored separately. A persisted node contains typed, section-local JSON
pointers instead of visible strings:

```ts
{
	id: "4ddc8a28-e78f-4f3e-9794-947375f275cc",
	type: "text",
	props: {
		element: "h1",
		content: { $text: "/copy/heading" },
	},
}
```

The target value lives under the section's `contentId`:

```ts
{
	en: {
		sections: {
			[contentId]: {
				copy: { heading: "Build something lasting" },
			},
		},
	},
	ar: {
		sections: {
			[contentId]: {
				copy: { heading: "ابنِ شيئًا يدوم" },
			},
		},
	},
}
```

Three reference channels define the expected value:

- `{ $text: "/copy/heading" }` resolves a string.
- `{ $link: "/actions/primary" }` resolves a typed link and converts it to an `href`.
- `{ $asset: "/media/hero/assetId" }` resolves a UUID used with the supplied `AssetMap`.

Sections may also use `{ $setting: "/map/zoom" }` for explicitly declared, non-localized instance settings. Settings are
stored directly on the section rather than in another ID-indexed document map.

Pointers use RFC 6901 escaping. Localization merges objects recursively and falls back at the referenced value. The
default locale must contain a complete site, page, and section content graph; other locales may provide overlays.

## Ordered content

Definition and fixture content uses readable arrays. Instantiation converts each array into persisted identity:

```ts
{
	order: [itemIdA, itemIdB],
	items: {
		[itemIdA]: { ... },
		[itemIdB]: { ... },
	},
}
```

Definition pointers aimed at fixture indexes are rewritten to item UUIDs. The persisted `order` array controls rendering
order. The validator requires `order` and `items` to contain the same unique identity set.

Most patterns retain an exact cardinality derived from their indexed references. Patterns that declare a definition-level
repeater instead publish a minimum and maximum. Instantiation expands the repeater into ordinary persisted primitive
nodes or interaction items with stable IDs; no repeater node or authoring instruction is stored in the website document.
The `metrics-big-numbers` pattern accepts two through six items, while FAQ accordions accept one through ten. Localized overlays
keep the default locale's item count so every translation continues to address the same persisted identities.

Collections nest. An array inside an array item is addressed as `/plans/items/N/features/items/M/title` in definitions
and fixtures, and instantiation converts every level to `{ order, items }` with its own stable IDs
(`/plans/items/<planId>/features/items/<featureId>/title`). Each concrete collection has its own count, so every plan
may list a different number of features; localized overlays keep the default locale's count per concrete collection
(`/plans/0/features`). A nested repeater declares `collection: "/plans/*/features"` and a `target` relative to the
parent item's `createValues` output (first segment is the value index); its `createValues({ index, parentIndex })`
receives the child and parent indexes and has its own `min`/`max`. Only one nesting level of repeaters is supported.
Editing addresses a nested collection by its persisted pointer (`/plans/items/<planId>/features`); adding a parent item
clones its nested collections with fresh item IDs because entity IDs are unique per document.

## Links

Persisted links are discriminated values rather than arbitrary strings. Supported kinds are:

- HTTP(S) external and booking URLs;
- safe root-relative paths;
- page links with an optional section target;
- direct section links;
- semantic section anchors;
- email addresses;
- E.164 phone numbers.

Validation rejects unsafe URL protocols, protocol-relative paths, malformed phone numbers, and missing page, section, or
anchor targets. The runtime resolves each typed link once into `{ href, kind }`; action semantics are derived from the
link kind rather than duplicated in section structure.

## Primitives and rendering

The document grammar is the closed `coreNodeTypes` set exported by `structure-schema`:

- layout: `box`, `flex`, `grid`, `masonry`;
- content: `text`, `media`, `icon`, `action`, `embed`;
- interaction: `carousel`, `disclosure`, `menu`, `tabs`;
- behavior: `field`, `value`, `trigger`.

The renderer uses one exhaustive switch from node type to React primitive. It is not a mutable plugin registry.
Marketing concepts such as heroes, cards, testimonials, and pricing tables are section compositions rather than
renderer-level node types.

### Synced interactions

`tabs` is the one primitive for UI where a list drives a stage: a titles list with a synced image panel, a numbered
accordion, a labelled slideshow, or expandable cards. The same persisted tree is typed, bounded, and SSR-deterministic;
SSR renders the first item active and the autoplay phase `idle`.

- Items: `{ value, trigger, detail?, panel }`. `trigger` is the tab content, `detail` is a region linked to the tab with
  `aria-describedby` that collapses (`detailMode: "collapse"`, default) or fades (`"fade"`) with the active state, and
  `panel` is the synced stage content. `activateOnFocus` makes arrow keys drive the stage.
- Panels: `panels: "swap"` (default, active panel only), `"crossfade"` (all panels stacked, opacity crossfade of
  `crossfadeMs`), or `"track"` (a sliding strip using `slideBasis`/`slideGap`, neighbors peek and clicking one selects it).
- Arrangement: without `arrangement` the root is a flex column (a row when `orientation` is `vertical`). `arrangement`
  makes it a grid, `lead` renders extra nodes before the list and stage, and `listLayout`/`panelsLayout`/`itemLayout`
  place and size the parts (grid placement, order, visibility). `listPlacement: "after"` puts the stage first in DOM order.
  Percent margins and insets resolve against the grid area for grid items, so bleed layouts span the whole grid.
- Item surface: `itemAppearance`, `itemFlex`, `tabAppearance`, `listAppearance`, `expandActive` (active item grows,
  others keep `inactiveSize`), `inactiveOpacity` and `activeShift` (inactive labels dim; hover or active restores them
  and active shifts inline-start), `openIndicator: "rotate-180"` (icons rotate when the item is active), `indicator`
  (the sliding underline, on by default).
- Autoplay: `autoplay: { intervalMs, startDelayMs?, pauseOnHover? }` advances to the next enabled item and loops. It only
  runs while the root is at least 25% in view, pauses on hover/focus when `pauseOnHover`, restarts its timer when the user
  selects an item, and is off under `prefers-reduced-motion`. The root exposes `data-autoplay`
  (`off | idle | paused | running`) and the CSS variables `--iw-tab-interval`, `--iw-tab-delay`, `--iw-tab-index`,
  `--iw-tab-dir`.
- Decorations: `decorations` (max 6) are absolutely positioned layers rendered inside every item and driven by the item
  status (`completed`, `active`, `upcoming`). `fill` layers scale along `axis` (`inline`, `block`, `both`, or `none`
  for an opacity fade); `ring` layers draw a circular progress stroke (`thickness` is a percentage of `size`). `source`
  selects the driver: `static` (always full), `active`, `completed` (full for earlier items, animated by
  `transitionMs`), `autoplay` (completed full, active animates over the autoplay interval) or `timer` (only the
  active item animates). `scope` limits a decoration to `first`, `last`, `not-first`, or `not-last` items.

Responsive `layout` edge values (padding, margin, inset) cascade mobile-first: a breakpoint object only overrides the
edges it names and inherits the rest from the next smaller breakpoint.

Lengths accept an `Nsp` spacing unit (`calc(var(--iw-spacing) * N)`) in addition to px/rem/em/%/container and viewport
units, so section rhythm follows the Brand spacing scale. Text `align` and box `fillOpacity` are responsive, and boxes
accept `pattern: "diagonal-slash"` as a decorative fill.

Two other interaction capabilities live on existing nodes. `box.reveal` (`rise`, `zoom`, `fade`, optional
`delayMs`/`durationMs`) animates the box in once when it scrolls into view; only boxes that start below the fold are
armed, so above-the-fold content never flashes. `box.hoverReveal` renders a `backdrop`, a sliding `cover` appearance,
the box children as the base layer, and a duplicate `replacement` layer (aria-hidden, `replacementForeground` defaults to
`media`) that cross-fades in on hover; touch devices reveal at 50% visibility instead. `text.scrollReveal` splits a
text node into words whose opacity follows the scroll position (`--iw-reveal`), and renders fully opaque under reduced
motion.

Registered patterns are starting compositions, not immutable render components. Editors may replace a section's
persisted primitive tree while preserving its content references, stable identities, and any behavior bindings. The
graph validator reparses the resulting tree and document before persistence.

The AI-composed v1 authoring surface is intentionally smaller than this runtime grammar: fifteen node types in a flat graph,
each with exactly `key`, `type`, `props`, and `children`. It has no `layout` field; materialization projects layout props
into the persisted runtime node. Existing custom sections are changed with keyed node patches instead of whole-graph
replacement, while new custom sections use the dedicated composition tool.

The authoring surface includes built-in `icon` and typed-link `action` nodes, the runtime media appearance fields, and
bounded responsive grid placement. Action destinations are supplied in the sibling `links` map and materialize as the
same typed link references used by registered patterns. Interactive `action`, `field`, and `trigger` nodes may not contain
another interactive descendant or a `carousel`, `tabs`, `disclosure`, or `embed`.

The authoring surface also exposes a curated, schema-bounded subset of the runtime interaction nodes. Each is a flat
node whose collection entries are child keys; none exposes the raw runtime props (`controlGroups`, `decorations`,
`items`, `config`):

- `carousel`: children are the slides. Props are `label`, `slideBasis`, `gap`, `loop`, `slideAlign`, `autoplayMs`,
  `arrows`/`dots` (each requires its own label content keys) with `controlsPlacement` and `controlsAlign`. Materialization
  builds the control groups; autoplay pauses on hover and focus.
- `tabs` and `disclosure`: children are `item` nodes. An `item` has `props: {}` and exactly two children, `[trigger,
  panel]`, which materialize to the runtime item's trigger and panel. Tabs expose `label`, `orientation`, `panels`
  (`swap` or `crossfade`), `crossfadeMs`, `autoplayMs`, `progress` (requires autoplay), `indicator`, `listPlacement`, and
  `listGap`; the item key is the tab value. Disclosures expose `multiple`, `defaultOpen`, `divider`, `openIndicator`,
  `panelPadding`, and `triggerPadding`. Inspection re-keys disclosure items as `<disclosure-key>-item-N` because the
  runtime item stores only an ID.
- `embed`: `provider: "google-map"` takes an `address` content key plus `zoom`, `mapType`, `tint`, and `coordinates`;
  `provider: "contact-form"` takes content keys for all eight required labels plus optional `phoneLabel`, `columns`, and
  `submitWidth`. Both take the box appearance and layout props.
- `reveal` on `box` and `scrollReveal` on `text` expose the scroll entrance. `hoverReveal`, marquee, edge fades, slide
  effects, tab decorations other than `progress`, tab `detail`, menus, and masonry stay runtime-only.

Inspection of a composed section is lossless: a collection node is flattened only when rebuilding it from the authored
props reproduces the persisted runtime props exactly, otherwise the section is not editable through the flat graph.
Catalog reference flattening is tolerant instead: unsupported collection props are dropped, and only `masonry` and
`menu` remain `unsupported` stubs.

Composed-section validation adds a deterministic liveness check that blocks composition: every carousel needs at least one
slide and every slide, and every tabs or disclosure needs at least one item whose trigger has a nonblank text, labeled
icon, or media name and whose panel has nonblank text or media; accessible labels and control labels must be nonblank in
both locales; contact forms need every required label nonblank in English and Arabic; a map needs a nonblank address in
both locales unless it carries coordinates; an item trigger may not contain an interactive or composite node.

Base UI owns transient menu, disclosure, and tab state. Embla owns carousel state. The persisted document stores the
interaction structure, labels, options, and children, not browser state.

`carousel` slides are spaced with `gap` (trailing slide margin, no negative track margin) and sized by `slideBasis`;
`slideSizing: "gap-inclusive"` (default) treats the basis as a shadcn-style cell that includes the gap, `"exact"` uses the
basis verbatim. The viewport clips by default; `viewportLayout.overflow: "visible"` lets slides bleed to the section edge
when the section root clips. Motion props:

- `autoplay: { delay, pauseOnHover?, pauseOnFocus? }` advances on an interval; `marquee: { speed, direction?, pauseOnHover? }`
  scrolls continuously (px per frame, loops and repeats slides once as inert hidden copies); both play only while the
  carousel is in view and are disabled under `prefers-reduced-motion`.
- `options`: `axis` (`"x"` | `"y"`, vertical needs a block size on `viewportLayout`), `transition: "fade"`, `slidesToScroll`,
  `startIndex`, `draggable`, `loop`, `align`, `containScroll`.
- `edgeFade: { size? }` masks the viewport edges on the scroll axis; `inactiveOpacity` / `inactiveScale` style non-selected
  slides; `slideEffect` tweens the slide's first child by distance from the centre (`aspectRatio` centre/side/edge,
  `opacity.side`) for loop carousels.

Controls live in `controlGroups` with `placement` `before`, `after`, or `header`. `header` is a flex row (`header` prop:
flex props, box appearance, `children`, `layout`) rendered above the viewport; `header` groups sit inside it, so controls can
share a row with a heading. `controlsGap` is the responsive gap between header, viewport and control groups (default 3rem), and
a group takes box `appearance` for a shared pill or bar. Arrow controls take `size` (responsive), `corners`
(`round` | `square` | `pill`), `icon` (`chevron` | `arrow`), `iconSize`, and `stretch` to fill a bar. Indicators take
`active` / `inactive` size and opacity plus `spacing` (the visual gap between dots; omit it for the legacy 1.5-2rem hit
areas). Counters take `pad`, `separator`, `bar` (a line between the numbers), and a typography `appearance`.

Media nodes can store player or background playback behavior and a decorative contrast overlay. Background mode always
disables controls and interaction. Use a scrim for uniform protection or a linear gradient when copy occupies one side of
the media. The `strong` scrim darkens every source pixel enough for the theme's white `media` foreground to meet WCAG AA
body-text contrast; weaker scrims are visual treatments and still need contrast verification against the selected media.
Overlay content remains ordinary sibling `text` and `action` nodes, so it stays semantic, selectable, and independently
localizable.

The `embed` primitive only supports Google Maps. Map URLs are generated from a validated address or coordinates; raw embed
HTML and arbitrary iframe sources are not accepted. YouTube is handled separately by the `media` primitive.

## Sections

A shipped section definition contains:

- one category;
- one pattern name;
- one ID-free primitive tree with typed content references.

It may also declare code-only repeaters and a Zod schema for section-local, non-localized settings. Repeaters are expanded
before persisted node IDs are assigned. Settings remain pointer-resolved values and are validated against the registered
section definition.

It does not contain fixture content, controls, editor metadata, template knowledge, or a hand-written content schema.
Strict content schemas are derived from the definition's typed references.

Each shipped pattern has a matching JSON fixture and Storybook story. Current catalog coverage is:

| Category       | Patterns |
| -------------- | -------: |
| Call to action |        6 |
| Contact        |       10 |
| Content        |        8 |
| FAQ            |        8 |
| Features       |       24 |
| Footer         |        8 |
| Gallery        |       10 |
| Header         |        5 |
| Hero           |       20 |
| Location       |        5 |
| Metrics        |        7 |
| Pricing        |        5 |
| Showcase       |        7 |
| Team           |        5 |
| Testimonials   |       10 |
| **Total**      |  **138** |

Pattern identifiers equal the design identifiers of the reference catalog (`banner-*`, `text-*`, `feature-*`,
`gallery-*`, `faq-*`, `cta-*`, `header-*`, `footer-*`, and so on). `contact-form`, `blog-latest-three`, and
`blog-latest-six` are the only host-rendered patterns.

The schema also reserves the `logos` and `embed` section categories, but the shipped registry currently has no patterns
under those names.

`defineSection` and `instantiateSection` are exported authoring helpers, but persisted validation accepts only patterns
in the package's private shipped registry. There is currently no public custom-section registration API.

## Templates and catalog

Templates are ID-free blueprints composed from shipped section definitions. They contain stable page and section keys,
global header/footer regions, metadata, and locale declarations. Example content and assets live beside the definition
and are imported separately. Templates do not own Brand data.

All 23 shipped templates currently contain one page:

Airy Spacious, Alpina Ventures, Artisan Craft, Artistic Expression, Clay Cool, Growth Engine, Heritage Drive, Honest
Craft, Midnight Aurora, Modern Foundation, Nordic Edge, Paw Voyage, Professional Structure, Pure Vitality, Reliable Core,
Serene Wellness, Sharp Signal, Sparkle Home, Steady Ascent, Strategic Insight, True Exposure, Urban Edge, and Vibrant
Blooms.

`getTemplateBrand` supplies each template's Brand, including an example `logo` for Nordic Edge, Vibrant Blooms, Heritage
Drive, Clay Cool, Modern Foundation, Honest Craft, Alpina Ventures, Paw Voyage, and Sharp Signal, so their headers and
footers show the logo instead of the business name. Generation uses the same palette and typography but never inherits
the example logo (`getTemplateBrand({ logo: false })`).

The catalog entrypoint exports:

```ts
import { getSectionCatalog, templateCatalog, templateDefinitions } from "@starter/infinite-website/catalog";
```

- `getSectionCatalog()` builds (once, on first call) pattern metadata and an authoring-content JSON Schema for every shipped section, plus a
  settings schema when the pattern declares settings.
- `templateCatalog` contains serializable template discovery metadata.
- `templateDefinitions` contains the complete reusable blueprints.

The section content schemas describe definition/fixture content before arrays receive persisted item identities. They are
not schemas for the persisted `{ order, items }` representation.

The separate `@starter/infinite-website/generation` entrypoint exports the validated generation-safe definitions. The
server owns the single lightweight generation catalog, including field roles, template affinity, page-purpose ranking,
asset/link requirements, preview metadata, and adjacency/duplicate penalties. Category and text filters use the same
catalog that authorizes section addition; previews are deterministic and do not invoke a model.

Importing `@starter/infinite-website/catalog` eagerly loads all section definitions, all template definitions, and
generates every section content JSON Schema. Keep discovery and administration code on this entrypoint; normal rendering
should import the package root.

Reviewed templates also have explicit subpaths:

```ts
import { nordicEdgeTemplate } from "@starter/infinite-website/templates/nordic-edge";
import { nordicEdgeAssets } from "@starter/infinite-website/templates/nordic-edge/assets";
import nordicEdgeContent from "@starter/infinite-website/templates/nordic-edge/content";
```

## Validation boundaries

The package exposes four related validation tools:

| API                           | What it guarantees                                                                         |
| ----------------------------- | ------------------------------------------------------------------------------------------ |
| `siteDocumentSchema`          | The serializable v1 shape and field-level types                                            |
| `siteDocumentJsonSchema`      | Draft 2020-12 representation of that serializable shape                                    |
| `validateSiteDocument(input)` | Shape plus package-registry, identity, content, locale, route, collection, and link checks |
| `parseSiteDocument(input)`    | Returns the validated document or throws; use `validateSiteDocument` for structured issues |

The generated JSON Schema cannot express the package's registry and cross-document graph checks. Passing JSON Schema
validation alone is not enough for runtime rendering or persistence.

The graph validator checks:

- exactly one home page;
- listed locales and complete default-locale content;
- unique localized page slugs;
- exact page/content and section/content joins;
- shipped pattern/category/settings/content contracts when `source` is present, plus validated primitive grammar and
  resolvable localized references for AI-composed sections;
- page, section, semantic-anchor, root-node, nested-node, interaction, content, and collection identities;
- collection identity sets and content-driven order;
- page, section, and semantic-anchor link targets.

Before recursive schema parsing, document admission enforces one shared resource budget: 2 MiB of serialized JSON,
50,000 JSON values, JSON depth 128, eight locales, 32 pages, 256 total sections, eight custom-script programs, 8,192
total nodes, 256 nodes per section, and node depth 32. Section authoring is independently bounded to 200 flat nodes,
256 KiB of localized content, 32 fields, 32 outputs, 16 events, and 32 media intents. Field and value nodes require exactly
one direct text label; action, field, and trigger nodes cannot contain another interactive node. The authenticated write
path still performs a fresh script admission immediately before persistence even when the provider input was admitted
before approval.

## Responsive layout, Brand projection, and RTL

Responsive values use four container ranges:

- `base`: below 28rem;
- `compact`: 28rem and above;
- `medium`: 42rem and above;
- `wide`: 64rem and above.

The layout responds to the rendered `.website-container`, not the application viewport. This lets the same site render in
a dashboard preview or a full-page route.

Layout uses logical block/inline properties. `SiteRenderer` chooses direction from the explicit document override or the
active locale, then applies Base UI's `DirectionProvider`, `dir`, and `lang` once at the website root.

`SiteRenderer` uses `projectBrandToWebsiteTheme` to derive website-owned semantic colors, locale/script-specific
variable fonts, concrete corner radii, and the button style, then applies them as CSS custom properties on that root.
Each corner style resolves separate radii for surfaces, controls, and media: `radius: "theme"` uses the control radius
on actions and the media radius on media, and primary actions paint with the Brand's solid or outline button style. The document remains
Brand-free. The PostCSS build prefixes Tailwind variables, preflight, and utilities beneath `.website-container` so they
do not target the host document globally.

## Package structure

```text
src/
├── index.ts             public runtime and authoring API
├── catalog.ts           eager section/template discovery entrypoint
├── section-registry.ts  private shipped-pattern registry used by validation
├── document/            schemas, content resolution, and graph validation
├── rendering/           reference resolution and React rendering
├── primitives/          the closed runtime node set
├── sections/            shipped structural patterns
├── templates/           template definitions, example content, assets, and stories
└── storybook/           preview boundaries and section fixtures
```

The dependency direction is:

```text
primitives <- sections <- templates
```

Templates cannot define primitives, import section internals, own persisted IDs, or import their example content.

## Development

```bash
# Storybook on port 6006
bun run --cwd packages/infinite-website dev

# Rebuild the scoped stylesheet once
bun run --cwd packages/infinite-website build

# Watch source and styles, rebuilding dist/styles.css
bun run --cwd packages/infinite-website dev:styles

# Package contracts
bun run test packages/infinite-website/tests

# Package typecheck
bun run --cwd packages/infinite-website typecheck
```

Check whether port 6006 is already in use before starting Storybook.

Every template publishes one `Default` story. It exposes native Storybook controls for curated colour groups, all five
individual Brand colors, multilingual font pairing, heading/body variable weights, corner style, and locale. Selecting
`Template / custom` reveals the individual color controls; selecting another group swaps all five together. Controls
rebuild the Brand input and render it through the production `SiteRenderer`; they do not mutate the persisted website
document.

Browser coverage does not yet exercise every menu, disclosure, tab, carousel, or shipped section, and there is no broad
pixel-snapshot suite. Upload and deployment integration remain outside this package.

Repository completion also requires the root checks documented in `AGENTS.md`: typecheck, lint, konsistent, React Doctor,
shadscan, and evlog.

## Current limitations

- The behavior MVP supports up to 32 local decimal fields, 32 named typed outputs, and 16 declared local trigger events. Its safe CEL subset includes arithmetic,
  comparisons, boolean logic, ternary conditionals, and selected numeric functions; it excludes macros, collections,
  property access, general forms, submissions, network access, and booking widgets. Booking is a link kind only. The
  separately labelled `custom-js-v1` profile is the one sanctioned JavaScript surface: sandboxed and binary-float based
  (unlike the exact-decimal CEL profile). It never touches the page, network, or host directly. CEL decimal outputs drive
  `value` nodes; CEL boolean outputs drive visibility and disabled state. Named CEL events map to exact section anchors;
  script events may return the same bounded host command. Script outputs remain decimal-only.
  Guest `eval` and `Function` remain inside QuickJS.
- The package owns pure, validated document-edit functions. AI orchestration, editor state and UI, undo/redo,
  permissions, publishing, persistence, and migrations remain host-owned.
- All shipped templates are currently single-page, although the document and template contracts support multiple pages.
  Production generation selects sections directly from the safe catalog with neutral Brand defaults; named templates remain explicit choices. Supplied menu or portfolio facts can replace generic pages, and Contact includes a working form.
- Catalog sections validate against the shipped registry. AI-composed behavior sections are persisted directly from the
  closed primitive grammar and do not register a section pattern or plugin.
- Assets are a direct UUID-keyed map of resolved image and video values. The package validates and renders optional
  intrinsic dimensions, bounded responsive candidates, sizes, loading, and decoding metadata supplied by the host.
  Uploads, storage, transforms, candidate generation, CDN policy, and framework image optimization remain host-owned.
- Missing assets render accessible placeholders rather than failing the tree.
- Google Maps is the only embed provider.
- There is no arbitrary JavaScript outside the sandboxed `custom-js-v1` behavior profile, and no raw HTML, persisted `className`, or persisted CSS.
- The renderer expects a validated document and a listed locale; it does not repeat boundary validation.
- The renderer requires Brand as an independent input; the host persists Brand and asset bindings beside each document
  version.
- Atomic menu-item edits may persist editor-created dropdown labels and links under the validated per-section
  `authoring.menu` content namespace. The menu structure continues to use ordinary stable nodes and content references;
  there is no parallel editor tree.
- The built stylesheet is generated into ignored `dist/` output and must be built or watched locally.
- The targeted browser suite does not replace broad interaction and visual-regression coverage of every shipped pattern.

## Non-goals

- Puck compatibility or Puck-shaped configuration
- compatibility adapters for discarded development formats
- editor commands or editor controls in the runtime document
- a global mutable primitive, capability, or section registry
- template-aware renderer branches
- generated-section grammars
- Storybook fixtures as runtime defaults

Editing mutates this document through the package's validated edit contract instead of introducing a parallel persisted
tree. Product commands, controls, permissions, and UI remain in the host application.

## Blog content and live feeds

The package owns a separate versioned `BlogPostDocument` with English and Arabic copy, a bounded Tiptap-compatible
body, and safe media/link URLs. Drafts may be incomplete; `blogPublishDocumentSchema` requires both titles and bodies
and localized cover descriptions. The static JSON renderer maps only the validated node and mark grammar to React,
without importing the editor or interpreting HTML.

`SiteRenderer.pageContent` places host-provided blog content between the website header and footer under the same
Brand projection. `SiteRenderer` wraps header, page, and footer sections in `display: contents` `header`, `main#main`, and
`footer` landmarks behind a localized skip link, so `pageContent` must not contain its own `main`; the editor preview
has no landmarks. `blog-latest-three` and `blog-latest-six` are content catalog patterns: hosts supply current published
`BlogPostSummary` records through `blogPosts`. Articles are never copied into `SiteDocument`. Empty feeds disappear
publicly and show localized explanatory content when `preview` is enabled.

The `blog` route namespace is reserved for host routing. `withBlogNavigation` projects an idempotent localized header
link for hosts with published posts, without changing the stored website. The public host checks current posts outside
the published-version cache so the first published article appears without republishing the website. The editor uses
the same projection and inherited header text color; its automatic Blog link opens the Blog workspace and is excluded
from saved-menu reorder controls. The header eye toggle stores `blogNavigationHidden` on the website document through
`set-blog-navigation`. Hidden automatic links remain dimmed in edit mode for recovery, but are omitted from preview
and published rendering; visibility follows the normal draft/publish lifecycle.
Blog persistence, revisions, publication snapshots, generation ownership, and read caching remain host-owned.

## Contact forms

The `contact-form` catalog pattern renders a fixed, accessible form with name, email, optional phone, and message.
Its labels, heading, description, and submission states are localized content references. Hosts supply a
`contactFormComponent` to `SiteRenderer`; without one, forms render as disabled previews. The package owns form
presentation and state, while `apps/websites` owns fetch and BotID, and `packages/server` owns validation and persistence.
Contact-form generation uses the bilingual `contactFormContent` seed, independently of Storybook fixtures.

Primitive-tree contact sections place the same host form with an `embed` node whose `provider` is `contact-form`. Its
`config.labels` are section text references (`/form/*`; `phoneLabel` is optional and hides the phone field), with
`columns` and `submitWidth` layout options. The renderer passes `contactFormComponent`, `preview`, and the owning
section id to it, so submissions carry that section's id.
