# Design Refinement — Mobile Chart Tip

Approved mockup: `pipeline/mobile-chart-rotation-tip/design.html` (light + dark,
working dismiss). Refines two existing surfaces; no chart, layout, or data
change anywhere.

## Visual Direction

A quiet, informational note in the house "quiet utility" register. Deliberately
accent-free: in SnowRaven green means "actionable or active," and this element
informs rather than asks. Faint surface, muted ink, small uppercase kicker.
Type is the established Inter / system-ui system (the design-lint `banned-font`
warn is this deliberate, logged design-system deviation).

## Screens / Views

### The tip element (one shared component, e.g. `components/ChartViewTip.tsx`)

- Row layout: Lucide `Smartphone` icon (15px, stroke 2.2, `--sr-text-muted`,
  top-aligned) · text block · dismiss button.
- Text block: kicker `TIP` (0.625rem, 700, letter-spacing 0.09em, uppercase,
  `--sr-text-gray`) over one body sentence (0.8125rem, line-height 1.5,
  `--sr-text-muted`).
- Container: `--sr-surface-faint` fill, 1px `--sr-border`, radius 10px,
  padding 10px 6px 10px 12px, 14px gap below (matches card rhythm).
- Dismiss: icon-only Lucide `X` (15px), 32px square hit area, transparent at
  rest, `--sr-surface-subtle` + `--sr-text` on hover, `:focus-visible` 2px
  `--sr-accent` outline. `.sr-touch-target` in the phone tier.

### Statistics

Tip renders directly ABOVE the first chart-bearing section card, below the tab
header, full content width. It scrolls with the page (not sticky, not fixed).

### Species Detail

Same element, same rule: directly above the "Sightings Over Time" card. When
the graph section does not render (fewer than 2 data points), the tip does not
render either — it exists only where a chart does.

## Component Usage

One new shared component used by both tabs; no library additions. House
`SectionCard` untouched — the tip is a SIBLING above the card, never inside it
(no nested cards).

## Design Tokens Applied

`--sr-surface-faint`, `--sr-border`, `--sr-text-muted`, `--sr-text-gray`,
`--sr-surface-subtle` (hover), `--sr-text` (hover), `--sr-accent` (focus ring
only). **No new tokens.** All values already AA-audited in both themes.

## Interaction Notes

- **Phones only:** render-branch on the ≤640px tier via the sanctioned
  `lib/useIsPhone.ts` pattern (this changes what mounts, not just styling).
  Tablets/desktop never mount it.
- **Once per page, never returns:** per-page dismissal flags persisted through
  the storage seam (`storage.getSetting`/`setSetting`, never localStorage on
  desktop — the WelcomeScreen `welcomeSeen` precedent).
- **Closed until hydrated:** like the embed-eligibility gate, the tip stays
  unmounted until the saved flags have loaded, so a dismissed installation
  never flashes it at startup.
- **Dismiss is the only action.** Rotating or opening the desktop app is left
  entirely to the reader; the tip contains no links or steering controls.
- Accessibility: container `role="note"` with `aria-label="Tip about chart
  viewing options"`; dismiss button `aria-label="Dismiss this tip"`, explicit
  `tabIndex={0}` (WKWebView convention); all sizes in rem so in-app Text Size
  scales it; AA contrast held by the tokens in both themes.

## Motion Spec

- Dismiss collapse: height + opacity, 220ms, ease-out, CSS transition (no
  motion library), `prefers-reduced-motion: reduce` → instant removal.
- No entrance motion (static content mounts still — anti-slop rule).

## Content Notes

Exact strings (no em dashes; sentence case; neutral, never promotional):

- Kicker: `Tip`
- Body: `Charts get more room in landscape. Rotate your device for a wider
  view, or open SnowRaven's desktop app if you have it.`
- Dismiss accessible name: `Dismiss this tip`

Docs rule applies in the same change: `docs/HELP.md`, `README.md`, and
`website/` gain a one-line mention of the tip and its one-time dismissal.
