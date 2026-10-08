---
name: starter-ui
description: Build, refactor, or review React UI, styling, accessibility, responsive behavior, or motion in the starter repository.
---

# Starter UI

Use the existing product design language; do not introduce a component registry or parallel design system.

## Sources of truth

- Product primitives and tokens: `packages/ui/src/components` and `packages/ui/src/globals.css`
- Route-owned UI: the nearest route directory in `apps/webapp`
- Next.js APIs: the relevant app-local `node_modules/next/dist/docs` guide

## Decisions

- Reuse a local primitive before adding a component. Keep route-specific components local until multiple real consumers
  justify promotion.
- Use product tokens from `packages/ui/src/globals.css`; do not hard-code colors.
- Prefer container queries for reusable components, logical properties for RTL, semantic HTML, visible focus, keyboard
  operation, labeled icon controls, and reduced-motion support.
- Keep Client Components and hydration boundaries as small as the interaction permits.
- Add motion only when it clarifies state or continuity. Prefer interruptible transform/opacity animation; avoid
  `transition: all`, decorative repetition, and animating an LCP element from hidden.
- Preserve raw form input while typing and normalize at validation or submission boundaries.

For reviews, report only observable, actionable issues, ordered by user impact. Verify touched UI with the narrowest
relevant test or browser pass, then run repository gates without building.
