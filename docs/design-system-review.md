# Design-system override review

Status: all findings resolved. No consumer exceptions have been added.

## Enforcement

- Installed `@shadcn/lint` in the existing Oxlint configuration.
- `shadcn/no-restyle` is an error: only layout classes are allowed on recognized shared UI consumers.
- `shadcn/require-static-classes` is an error: dynamic class expressions must be analyzable.
- Component implementations in `packages/ui/src/components` own their styling and are outside these two consumer rules.
- Both rules run through `bun lint` and `bun check`; unresolved findings fail the gate.
- This is component-override enforcement, not a claim that all six upstream rules are enabled.
- Do not suppress a finding, add an allowlist, or disguise an override on a wrapper to bypass review.

## Initial cleanup

Removed 17 classes that repeat existing primitive defaults: radio-group gaps, card padding, badge corners/text size, and dialog description color. No new variants or consumer exceptions were introduced.

## Approved duplicate cleanup

The user approved removing the login Form's extra `space-y-4` and all duplicate
default styles. Removed redundant layout, padding, typography, and rounding from
Form, Accordion, Badge, CardDescription, Button, DrawerHeader, SidebarProvider,
and ScrollArea consumers. LinksFieldset now uses the existing `size="compact"`
instead of repeating its width and gap classes.

The insertion controls keep their non-default color, weight, and interaction
styles. Sidebar backgrounds remain because the same class on a different DOM
layer is not necessarily redundant. Unstyled media buttons keep inherited
corners; the regular button defaults do not apply to them.

## First low-impact pass

- Added Form/Field `size="lg"`, RadioGroup `size="sm"`, and TextShimmer
  `variant="label|muted"`. Migrated existing uses without changing those styles.
- Replaced the Links column lookup with static conditional classes the linter can
  analyze; preserved all two-, three-, and four-column breakpoints.
- Standardized small description line-height and skeleton-corner overrides.
- Removed extra margin-based spacing from the Website layout RadioGroup, which
  already supplies a gap.
- No lint rules were relaxed and no suppressions or consumer exceptions were added.

## Insertion, card, and navigation pass

- Migrated Website and Links insertion controls to Button's insertion variant and
  shared hover/focus reveal option. Empty Links controls remain visible.
- Moved consent/invitation card spacing and title sizes into typed variants.
- Moved navigation padding and menu gaps into typed sidebar variants; shared the
  repeated navigation item rendering.
- Preserved existing colors, responsive spacing, and interaction callbacks.
- No lint exceptions or suppressions were introduced.

## Contacts pass

- Migrated new-contact and profile headers, title typography, panel backgrounds
  and padding, activity tabs, and filter option rows to shared typed variants.
- Preserved responsive breakpoints, spacing, and existing contact actions.
- Removed all 39 findings in contact-drawer, contact-profile, and contacts-filters.
- No lint exceptions or suppressions were introduced.

## Final cleanup

All 112 remaining findings have been resolved. The review queue is empty.

- Shared variants now own chat composer typography, attachment cards/dialogs,
  link previews, compact tabs, empty states, and editor sidebar surfaces.
- Media actions use shared hover/focus reveal behavior and inherited corners.
- Loading placeholders share the live composer's layout structure.
- Marketing accordion and navigation drawer consumers use default typography
  and borders; the invitation badge uses its existing size and casing.
- Both strict consumer rules remain enabled without suppressions or allowlists.

## Variant consolidation

Removed 21 overlapping style options and migrated their consumers to the retained
defaults. Card spacing, form and radio spacing, preview padding, title/description
typography, avatar sizing, skeleton corners, tabs, sidebar menus, and contact
headers now use fewer treatments. No compatibility aliases or consumer styling
overrides were introduced. Distinct interaction and layout variants remain.
