# Upstream provenance

Source: [dmmulroy/anti-slop](https://github.com/dmmulroy/anti-slop) `src/`.

- Base: `446268e` (2026-08-14), the snapshot originally vendored here.
- Current: `c44ef22` (2026-09-10). Every upstream-owned file under `rules/`, `shared/`, and `vendor/` is byte-identical to
  this revision, so the next update can diff `c44ef22..<incoming>` and apply it directly.

## Local deviations

- Local-only rules: `no-comments`, `no-css-modules`, `no-explicit-function-return-type`, `no-let`,
  `no-tautological-absence` (with `shared/tautological-absence.ts`), covered by `tests/rules.test.ts`.
- `index.ts` registers upstream and local rules together.
- Not vendored: upstream `*.test.ts` files (run upstream's suite against the incoming revision instead) and the opt-in
  `effect/` plugin, because this repository does not use Effect.
- `require-readable-spacing` is enabled; the repository was autofixed when it was adopted.
