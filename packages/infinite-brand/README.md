# `@starter/infinite-brand`

`@starter/infinite-brand` owns the canonical, consumer-neutral Brand foundation. It describes authored business identity choices;
it does not describe how a website component implements them.

## Brand foundation v1

The first contract contains only the fields needed to create a coherent multilingual website:

- five authored colors: background, neutral, primary, secondary, and tertiary;
- variable-font selections for heading and body with script and locale overrides;
- one portable corner style;
- an optional button style, solid or outline.

Infinite Website consumes this package through its own projector. Website semantic colors, CSS variables, concrete
corner radii, layout, sections, spacing, shadows, and rendering remain website concerns. Brand stays separate from the
website document and is passed directly to the renderer.

## Website ownership and publication

Brand remains a portable, independently validated value, but the host stores it inside each complete website version.
The website's draft version is editable; the published version is immutable and continues to style the live website
until the whole website is published again. This keeps brand, content, structure, and assets on one publication boundary.

The dashboard edits Brand through the website editor. A published website exposes that version's foundation at
`/brand-guidelines`. This package does not own database records, optimistic concurrency, authorization, or publication.

## Variable-font catalog

The package ships a curated, versioned variable-only catalog. Brand parsing verifies that every default, script, and
locale selection exists in this catalog, falls within its variable ranges, and covers the scripts used by the Brand's
declared locales.

- Inter, Outfit, Manrope, Playfair Display, and Source Serif 4 for Latin;
- Noto Sans Arabic, Noto Kufi Arabic, Cairo, and Noto Naskh Arabic for Arabic;
- Minimal, Modern, and Editorial pairings with `Arab` script overrides.

All nine families are pinned `@fontsource-variable/*` packages. Each pairing assigns both heading and body families for
Latin and Arabic, so changing a pairing updates both roles. Web consumers opt into the self-hosted assets explicitly:

```css
@import "@starter/infinite-brand/fonts.css";
```

Importing `@starter/infinite-brand` itself remains JavaScript-only and does not load font CSS.

`scripts/build-font-assets.ts <outDir>` writes one self-contained `<fontId>/font.css` plus its referenced files per
catalog font. `apps/websites` generates them into `public/brand-fonts/` and links only the fonts a page resolves.

## Deferred to Brand v2

Voice and editorial guidance, business positioning, audiences, offerings, value proposition, logos and assets, imagery,
contact/presence, extraction providers, revision history, and consumer-specific adapters are intentionally outside v1.

The public contract never exposes provider confidence, evidence, provenance, or quality scores.
