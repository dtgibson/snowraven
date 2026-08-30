# Design Refinement — Projects Stats Card

Improve lane, design pass. Refines the Projects card on the Statistics tab
(`SectionCard` in `BirdingStats.tsx` mounting `ProjectsSection.tsx`). Rendering
only: same facts, same states, same copy module, no new data, no new controls
beyond the chart. Mockup: `pipeline/projects-stats-card/design.html` (theme
toggle covers both themes; artboards A–E cover complete/320px/running/idle/
degenerate).

## Visual Direction

Extends the established SnowRaven design system unchanged: quiet utility,
Inter/system-ui, restrained color where green means actionable or active. The
refinement kills the card's dead horizontal space by giving the projects block
the Statistics tab's own chart-aside language (the observer-count exemplar's
`.sr-grid-chart-aside` shape): dense one-line rows on the left, a decorative
participation bar chart on the right. Portals stay visually subordinate:
quieter rows, no dots, no chart. Nothing about the card's honesty posture
changes — every number still renders with its denominator, in text.

## Screens / Views

### Projects card, Zone A (status / progress / notes) — UNCHANGED

The status live region, its sequence-keyed child, the conditional progress row
(`role="progressbar"` + N / M readout), the action cluster, and the
`.sr-proj-rule` notes are structurally and visually untouched. Do not re-style
or re-order anything in this zone. All copy continues to come from
`projectsCopy.ts` only.

### Projects block (Zone B, primary)

Layout at >640px: the block's content (below the existing `Divider` +
`PROJECTS_SUBLABEL`) becomes a two-column grid — reuse the shared
`.sr-grid-chart-aside` with `--sr-aside: 200px` and `alignItems: 'start'`
(the observer-count call site is the pattern; lift any new layout to a class
per ui.md, colors stay inline as tokens).

- **Left column: densified rows.** Each row is one line at desktop:
  `[dot + name]  [count]  ......  [meta, right-aligned]`.
  - `.sr-proj-name` changes `flex: 1 1 12rem` → `flex: 0 1 auto` (keep
    `min-width: 0`), so the count sits directly after the name.
  - `.sr-proj-n` unchanged.
  - `.sr-proj-meta` changes `flex: 1 1 100%` → `flex: 0 1 auto` plus
    `margin-left: auto; text-align: right;` so the share clause + date span
    ride the same line, right-aligned. The row keeps `flex-wrap`, so a long
    name or 200% text scale wraps the meta to its own line instead of clipping.
  - Row padding tightens `0.625rem` → `0.5rem`; row gap becomes
    `0.25rem 0.75rem` (row-gap matters once wrapped).
  - `.sr-proj-unnamed` unchanged (its own full-width muted line, only for
    unnamed identifiers; raw ids keep the mono `.raw` treatment and are never
    links, FR-29).
  - **Dot:** an 8px `border-radius: 50%` inline-block span (`.sr-proj-dot`,
    `margin-right: 0.5rem`, `aria-hidden="true"`) rendered INSIDE
    `.sr-proj-name` — never as a direct row child, or the ≤640 stacking rule
    (`.sr-proj-row > *:not(.sr-only)` → `width: 100%`) would seize it. Dots
    render only for rows that have a bar (see chart gate); background from the
    categorical order below.

- **Right column (aside): the participation chart.** See Component Usage.
  A micro-caption sits above it: "Checklists per project" (0.625rem, 600,
  0.06em tracking, uppercase, `--sr-text-muted`) — inside the inert wrapper,
  since it labels a decoration whose accessible equivalent is the rows.

At ≤640px: the grid stacks to one column (shipped `.sr-grid-chart-aside`
behavior) — rows first, chart below at full width. Rows stack per the existing
tier rule (name / count / meta as separate full-width lines); add to that tier
`.sr-proj-meta { margin-left: 0; text-align: left; }` so the desktop
right-alignment does not misalign the stacked form. Same override for the
portal `.sh` span.

### Portals block (Zone B, subordinate) — same one-line densification, nothing else

`PORTALS_SUBLABEL` + `PORTALS_NOTE` unchanged. Rows take the identical one-line
shape (`.nm` → `flex: 0 1 auto`; `.vl` after it; `.sh` → `flex: 0 1 auto;
margin-left: auto; text-align: right`), padding `0.4375rem` → `0.375rem`. No
dots, no chart, no color: the quieter type register already shipped is what
keeps this block subordinate to projects. Exception (chart ownership fallback):
when the projects block does not render but portals has ≥ 2 rows, the portals
block owns the chart-aside grid and the chart charts portals (same form, same
categorical order) — with no projects present there is nothing for it to be
subordinate to.

### States

- **idle / never-run, no-key, offline, error:** visually unchanged (Zone A
  only, or Zone A + whatever paid-for Zone B data exists). A never-run section
  still shows no number of any kind.
- **running / cooldown:** unchanged Zone A with live progress; Zone B grows as
  answers land. The chart mounts the moment its block has ≥ 2 rows and its bar
  widths simply re-render as counts arrive (no per-tick animation; see Motion).
- **complete:** the full layout (artboard A).
- **degenerate lists (the chart gate):** the chart renders only when the block
  that owns it has ≥ 2 rows. With 1 project the row states the fact and no dot
  renders (a bar chart of one is chrome around a single fact — the v1.0.3
  ranked-list rule); with 0, the block is absent as today. Earned zero stays a
  sentence, never an empty chart frame.

## Component Usage

- **Chart:** recharts (already a dependency; the Statistics chart language).
  `BarChart layout="vertical"` inside a `ResponsiveContainer width="100%"`,
  in the aside column:
  - Data: `view.projects` (or `view.portals` in the fallback), already sorted
    count-desc by `deriveProjectsView`; chart the FIRST 8 rows, never more
    (rows beyond 8 keep full text rows, no bar, no dot).
  - `XAxis type="number" hide domain={[0, 'dataMax']}`, `YAxis type="category" hide`
    — no axes, no grid, no tooltip, no legend: the rows ARE the legend and the
    table view.
  - `Bar dataKey="checklists"`, `barSize={12}`,
    `radius={[0, 3, 3, 0]}` (rounded data end), `minPointSize={2}`,
    `background={{ fill: 'var(--sr-surface-subtle)', radius: 3 }}` (each bar
    sits on a full-length track, echoing the house `BarRow` language),
    `isAnimationActive={false}` (see Motion), per-row `<Cell>` fills from the
    categorical order below.
  - Height: `24 * chartedRows + 8` px, container-level (px is correct here:
    bars carry no text, so they owe nothing to text scale).
  - **Wrapper: `<div aria-hidden="true" inert>`** — the shipped donut
    precedent; recharts ignores `accessibilityLayer` and leaves a focusable
    root `<svg>` otherwise. Every figure the chart shows is already in the
    rows as accessible text.
- **Rows:** existing `.sr-proj-row` / `.sr-proj-portalrow` markup with the flex
  changes above (lifted to `globals.css`, never inline layout).
- **Grid:** shared `.sr-grid-chart-aside` (do not mint a parallel grid class);
  `--sr-aside: 200px` inline var per the shipped call-site pattern.
- **Icons, buttons, dividers, sublabels:** unchanged shipped components
  (`Divider`, `SubLabel`, `.sr-proj-act*`, lucide at the shipped sizes).

## Design Tokens Applied

All existing tokens, both themes; this feature mints none.

- **Categorical order (bar fills and row dots), fixed, never cycled:**
  1. `var(--sr-accent)` 2. `var(--sr-graph-photo)` 3. `var(--sr-graph-audio)`
  4. `var(--sr-graph-video)` 5–8. `var(--sr-chart-slate)` (the fold color: every
  charted row past the fourth is slate, identity carried by its row text).
  This is the shipped statistics chart family in a deliberately different
  ORDER from the observer donut's array: measured with the dataviz palette
  validator, the donut's blue↔violet adjacency is near-indistinguishable under
  deuteranopia (ΔE 1.3); with amber third the set passes every separation
  check in BOTH themes (light: worst adjacent ΔE 25.7 deutan; dark: 19.4).
  Token VALUES are untouched — only this chart's assignment order encodes the
  fix. Color is reinforcement, never sole carrier: bar order equals row order,
  and the row text is the identity (WCAG 1.4.1 holds with color removed).
- Bar track: `var(--sr-surface-subtle)`. Card, borders, text, progress, and
  buttons: exactly the tokens already on the card (`--sr-surface`,
  `--sr-border-subtle`, `--sr-text`, `--sr-text-muted`, `--sr-accent`,
  `--sr-on-accent`, `--sr-warning`, `--sr-error`, `--font-mono`).
- Dots and bars are pure decoration duplicating text, so they carry no
  contrast duty; all text stays on its shipped AA-audited token pairs.

## Interaction Notes

- No new interactive elements. The chart is inert and tooltip-free; rows remain
  plain text (FR-29: a project identifier is never a link). All shipped
  controls (`Check projects` / `Stop` / `Resume` / `Check again` / `Try again`,
  the Settings link) are untouched, including the ≤640 `min-height: 2.75rem`
  touch posture.
- Live region, sequence-keyed message child, and progressbar semantics:
  untouched (the three must-not-reintroduce defects in `ProjectsSection.tsx`'s
  header comment all still hold).
- Chart wrapper is `aria-hidden` + `inert`; dots `aria-hidden`. The rows
  remain the single accessible source of every figure, via `projectsCopy.ts`
  (`shareClause` + `fmtSharePct` + `fmt`) — no count-bearing string is built
  outside the copy module.
- AA at 320px / 200% text scale, both themes: rows wrap (flex-wrap retained)
  or stack (shipped ≤640 tier + the two alignment overrides above); the chart
  stacks below rows at full width; nothing new clips or leaks page scroll (the
  dot lives inside the name span specifically so the `:not(.sr-only)`
  full-width stacking rule cannot reach it).

## Motion Spec

One easing everywhere on this card: `cubic-bezier(0.16, 1, 0.3, 1)` (the
shipped house ease-out). Reduced motion is handled by the app's global
shorten-not-remove rule; nothing here depends on `transitionend`.

- Chart/aside entrance: fade + 3px rise, 140ms, ease-out, origin n/a (block
  entrance), reduced-motion near-instant, CSS keyframe (`.sr-proj-viz`).
  Keyed by `key={chartedRows.length}` on the wrapper so it replays exactly
  when the chartable SHAPE changes (a new bar appearing mid-sweep), never per
  progress tick.
- Chart bars: NO internal animation — `isAnimationActive={false}`. Recharts
  animation is JS-driven (blind to `prefers-reduced-motion`) and would replay
  per data tick during a live sweep; bar widths snap to each throttled
  emission instead, which reads as live progress.
- Status message: shipped `sr-proj-msg-in`, 160ms fade + rise — unchanged.
- Progress fill: shipped 300ms width transition — unchanged.
- Buttons: shipped 160ms background/border/color hover transitions — unchanged.
  No hover states on rows (they are not interactive); no stagger, no
  motion-on-static.

## Content Notes

- Every string continues to come from `projectsCopy.ts` / `formatDateRange` /
  `fmtSharePct` — this refinement adds ONE new user-visible string, the chart
  caption "Checklists per project" (constant, no counts, so it may live as an
  exported constant in the copy module for the sweep's sake). No em dashes;
  en dash only in date ranges; plural agreement already guarded by the
  generated-corpus sweep.
- Mockup content is realistic and formula-exact (real eBird projects: Great
  Backyard Bird Count, Maine Bird Atlas, Global Big Day, an unnamed `1050`;
  portals eBird / GBBC / eBird Canada; every share re-computed through the
  `fmtSharePct` rounding rules, including the `<1%` floor).
- `docs/HELP.md` / `README.md` / `website/` need a line only if they describe
  the card's layout; the card's described BEHAVIOR (what is checked, when, at
  what cost) does not change.

## Lint / self-audit record (Step 2.5)

`weft-design-lint`: one `warn` remains, `banned-font` (Inter) — deliberately
justified, not fixed: `pipeline/design-system.md` sets Inter/system-ui as the
product's shipped face across 61+ versions, and the doctrine itself rules that
the design system wins on type specifics; introducing a new display face in an
Improve-lane card refinement would be silent brand drift. All other findings:
none. Pre-flight boxes pass (three type roles at the card's register, tinted
neutrals via tokens, one accent + purposeful categorical color, ease-out
motion ≤300ms with reduced-motion fallback, no anti-slop, content-driven
layout with no nested cards, realistic content, designed states). Palette
separation was validated by measurement in both themes (see Design Tokens).
