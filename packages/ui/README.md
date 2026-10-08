# Shared product UI

Import components from `@starter/ui/components/*`. Prefer their typed variants over
restyling borders, colors, typography, padding, or corners at the call site.
Keep page layout, responsive visibility, positioning, and content-specific dimensions local.

Define component styling variants with module-level `cva` from
`class-variance-authority`. Use `compoundVariants` for combinations whose styling
must take precedence, and `cn(variants({ ... }), className)` to merge caller layout.
Keep rendering decisions and runtime-computed values outside the variant definitions.
Prefer the default treatment over adding variants for small spacing, size, or typography differences.

| Component            | Reusable options                                                |
| -------------------- | --------------------------------------------------------------- |
| Button               | `variant`, `size`; `unstyled` for card/image hit targets        |
| SelectTrigger        | `variant="subtle"`, `size`                                      |
| Input / FieldControl | `variant="ghost\|subtle\|overlay"`, `size`, `corners="pill"`    |
| Textarea             | `variant="inline"` for autosized text entry                     |
| DropdownMenuItem     | `variant="destructive"`                                         |
| TabsList             | `variant="toggle"`, inherited trigger `size`                    |
| TabsContent          | `animated` (respects reduced motion)                            |
| Fieldset             | `size="compact"`                                                |
| DialogPopup          | `size`, `padding="none"`, `variant="transparent"`, `fullScreen` |
| PopoverPopup         | `padding="none\|xs\|sm\|default"`                               |
| Card                 | `variant="selectable\|dashed\|elevated"`, `corners="rounded"`   |
| Avatar               | `size`, `corners="rounded"`, `variant="outline"`                |
| Skeleton             | `corners="rounded\|circle\|square"`                             |
| Field                | `size="lg"` for spacious form steps                             |
| RadioGroup           | `padded` for inset option panels                                |
| TextShimmer          | `variant="label\|muted"` for loading status labels              |
| Radio                | `variant="card"` with a labelled, focus-visible card surface    |
| DrawerFooter         | `variant="bare"`                                                |

Selectable cards respond to their parent control's `aria-pressed` state. Keep the
semantic control and its keyboard focus treatment when composing these cards.

## Reusable layout and insertion variants

- Button: `size="option|option-lg"` provides padded, rounded multiline option rows.
- Button: `borderStyle="dashed"` provides a dashed border without consumer overrides. `variant="inherit"`
  keeps the background transparent and inherits the surrounding text color for controls over branded content.
- Button: `variant="insertion"` uses the selection color. `revealOnHover`
  reveals it on hover/focus within a `group/button-reveal` ancestor and keeps it
  visible on coarse pointers, respecting reduced motion.
- CardHeader/CardFooter use standard spacing.
- CardTitle: `size="lg"`.
- CardPanel/CardContent: `spacing="default"` for stacked content.
- SidebarHeader/Content/Footer: `variant="navigation"`.
- SidebarMenu/MenuButton use standard spacing.

## Drawer, tabs, and option variants

- DrawerPopup: `barVariant="muted"` matches a muted header.
- DrawerHeader: `variant="profile"` provides responsive header spacing and a muted surface.
- DrawerTitle: `size="lg"` and `multiline` control title typography.
- DrawerPanel: `padding="none|spacious"`, `variant="surface"`.
- Tabs: `spacing="none"` joins adjacent panel surfaces without a gap.
- TabsList: `surface="panel"`; TabsContent: `padding="panel"`.
- Label: `variant="option"` provides a full-width selectable option row.

## Chat, media, and editor variants

- Button: `corners="inherit"` for media hit targets; `hideWhenDisabled` for reveal actions.
- AvatarImage: `animated` animates image entry and respects reduced motion.
- Textarea: `variant="composer"` provides chat input typography and padding.
- Card: `variant="attachment"`; CollapsibleTrigger: `variant="step"`.
- FramePanel: `elevation="flat"` keeps the Frame layout without a shadow.
- PreviewCardTrigger: `variant="link"`.
- DialogHeader: `variant="spacious"`.
- DialogTitle: `size="sm"` for compact document headings.
- CredenzaContent: `padding="none"` works in both drawer and dialog modes.
- Tabs/TabsContent share a standard gap.
- Empty: `variant="inline"`.
- Sidebar: `border="none|editor"`, `surface="sidebar"`; SidebarProvider: `surface="canvas"`.
- ScrollArea: `corners="sm|inherit"`; RadioGroup: `padded`; PopoverPopup: `stacked`.
- SelectTrigger: `iconOnMobile` collapses the trigger on small screens.

## Styling enforcement

The root Oxlint configuration uses `@shadcn/lint` to enforce `no-restyle`
(layout only) and `require-static-classes` as errors on shared component
consumers. Primitive implementations own their styles. Run `bun lint` or
`bun check` to enforce the policy.

Remove redundant classes and use existing typed variants first. Any additional
styling exception requires individual user approval before a targeted suppression
or contract change. Do not add broad allowlists or move styles onto wrappers
merely to evade the rule. Pending cases are recorded in
[the review queue](../../docs/design-system-review.md).

## Charts

`SpectrumChart` from `@starter/ui/components/charts/genui-charts` adapts the
[Apache-2.0 Spectrum UI chart blocks](https://github.com/arihantcodes/spectrum-ui/tree/main/app/registry/charts).
The adapted source uses Starter color tokens, arbitrary validated series, accessible
data tables, reduced-motion-aware Recharts animation, dashed grids, compact axes,
legends, gradient area fills, and tooltips. Charts have transparent surfaces to fit
inside the existing Frame panels. The sparkline presentation hides axes and legends
while preserving accessible values for stat cards.

OpenUI chat charts use this renderer. Supported kinds are line, area, bar,
composed, pie (including donut), radar, and radial. Composed charts draw the first
series as bars and subsequent series as lines. Funnel stages use horizontal bars.
Pie and radial charts accept one nonnegative series; radar and stacked bars also
require nonnegative values. No demo data is substituted for empty or invalid input.
