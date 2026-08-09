# Bug Brief — map-explorer-input-zoom

## What is broken

Nine focusable form controls in the Map Explorer sidebar carry no `.sr-input-16`, so each computes a
sub-16px font size at the phone tier and iOS zooms the viewport on focus. Confirmed real: `.sr-input-16`
and `.sr-ctl-row` appear **nowhere** in `MapExplorer.tsx` or `components/map/*.tsx`. A v0.5.61 sweep miss.

| # | Control | File:line | Element | Inline font-size | Rendered in |
|---|---|---|---|---|---|
| 1 | Place-name search (`AddressSearch`) | `MapExplorer.tsx:149` | `input[type=text]` | `0.75rem` | hotspots + targets + lifers (1 source site, 3 instances) |
| 2 | Latitude (`CenterPointControl`) | `MapExplorer.tsx:1030` | `input[type=number]` | `0.75rem` | same 3 (1 source site) |
| 3 | Longitude (`CenterPointControl`) | `MapExplorer.tsx:1032` | `input[type=number]` | `0.75rem` | same 3 (1 source site) |
| 4 | Species filter | `MapExplorer.tsx:1376` | `select` | `0.8125rem` (`SELECT_STYLE`) | sightings |
| 5 | From date | `MapExplorer.tsx:1385` | `input[type=date]` | `0.75rem` | sightings |
| 6 | To date | `MapExplorer.tsx:1387` | `input[type=date]` | `0.75rem` | sightings |
| 7 | County filter | `MapExplorer.tsx:1395` | `select` | `0.8125rem` (`SELECT_STYLE`) | sightings (only when counties resolve) |
| 8 | Media filter | `MapExplorer.tsx:1419` | `select` | `0.8125rem` (`SELECT_STYLE`) | sightings (only with an ML export) |
| 9 | Target species search | `MapExplorer.tsx:1736` | `input[type=text]` | `0.75rem` | targets (no-ML manual path) |

**Correction to the idea and the ROADMAP item.** "Nine" is the right count of zoom-triggering controls, so
the figure stands. "Internally consistent at 0.75rem" is not exactly true: the three selects are `0.8125rem`
via the shared `SELECT_STYLE` (`lib/mapExplorerFormat.ts:21`, used only by these three). Both values are
sub-16px, so no mismatch is visible on screen and the conclusion is unaffected — but the Engineer should not
expect one uniform value. `SELECT_STYLE` has no consumer outside this file.

**Deliberately out of scope** (focusable, but neither raises a keyboard nor triggers iOS focus zoom): the
heatmap-intensity `input[type=range]` (`:1466`) and the manual-target `input[type=checkbox]` (`:1743`).
`components/map/*.tsx` contains no `<input>`, `<select>`, or `<textarea>` at all.

## Steps to reproduce

1. Open SnowRaven on iOS (or Safari/Chrome responsive mode at ≤640px width).
2. Map Explorer → **Filters** FAB → sidebar overlay opens.
3. Tap the **Species** select (or any of the nine controls above).
4. The viewport zooms in and stays zoomed; the user must pinch back out. Repeat on the hotspots/targets/lifers
   modes with the place-name search and the Latitude/Longitude pair.

## Expected behavior

Focusing any Map Explorer sidebar control leaves the viewport scale untouched, matching every other tab in
the app. Nothing changes above 640px.

## Blast radius

**Repair shape: `className="sr-input-16"` on each of the nine control elements. NOT `.sr-ctl-row`.**

- **Why not `.sr-ctl-row`.** There is no single filter row here — the nine sit in four separate subtrees
  (the `AddressSearch` component, `CenterPointControl`, the Filters disclosure panel, the targets manual
  list), so the container hook would need ~4 placements and still not be one row. More decisively, it sizes
  `:is(button, select, input)` **descendants**, and this sidebar is dense with buttons that have no zoom
  problem: the Breeding Code `SegControl` is four `whiteSpace: nowrap` buttons at `0.71875rem` inside a
  `min(282px, 90vw)` overlay — at 16px they would wrap to extra rows — and the same over-reach hits Map View,
  Point Size, Radius, "Use my location", "Find sightings", and every in-view marker-list row. That is
  unrequested layout change on controls that never zoomed. `.sr-ctl-row` is right for a filter *row*; this is
  a sidebar.
- **Placement matters.** The class must sit on the `<select>`/`<input>` **itself**, beside its inline `style`
  — it carries `!important` precisely because it must beat an inline `fontSize` (specificity 1,0,0), and it
  sat inert on ~25 inputs until v0.5.61 for exactly this reason. Reference call site: `LifeList.tsx:659`.
  Sites 1–3 are single source sites that each cover 3 rendered instances; do not duplicate them per sidebar.
- **Scope.** Phone tier only (`@media (max-width: 640px)`). Desktop and tablet are byte-identical. No new CSS
  rule, no behavior, state, transport, or accessible-name change. CSS-only, one class per element.
- **Must hold at 320px and 200% text scale — verify, do not assume:**
  - **Date Range pair** (the one real risk). `.sr-field-row` stacks only at ≤480; from 481–640 the two
    `input[type=date]` sit side by side, each `flex: 1; minWidth: 0`, inside ~250px of sidebar content.
    Native date inputs are the widest control here and may clip at 16px. Mitigating: every iOS portrait width
    is ≤480, where they already stack, so the risk band is largely desktop-narrow. Contingency if it fails —
    extend `.sr-field-row`'s stacking to the 640 tier; do not weaken the guard.
  - **Lat/Lng** share a non-wrapping `display: flex` row; the "Longitude" placeholder at 16px must still fit
    in ~120px.
  - **Fixed heights.** All nine live in `height: 34` px boxes. At 200% scale `max(16px, 0.75rem)` resolves to
    24px — check for vertical clipping. Precedent exists (LifeList's guarded selects) but it is worth an eye.
  - Sidebar is `overflow-y: auto`, so any vertical growth scrolls rather than overflows.

## Verification note — CSS-only, so a stylesheet test is not enough

CLAUDE.md's standing rule applies: a CSS-only fix is verified against a **real render**, not a parsed
stylesheet. `lib/filterControlSizeCss.test.ts` already proves the `max(16px, 0.75rem)` rule exists, is in the
640 tier, and is `!important` — it cannot prove the class reaches these nine elements, that it **wins**
against their inline `fontSize`, or that nothing wraps or clips at 320px. A jsdom/vitest test adds a
`className` assertion (cheap, worth having) but has no layout engine, no media queries, and no cascade
against React inline styles. The load-bearing proof is a browser measurement of `getComputedStyle().fontSize`
on each of the nine at a ≤640 viewport, plus a 320px and a 200%-text-scale render of the Filters panel and the
lat/lng row. Playwright is already available in `website/tools/`; point the backend at the synthetic demo
dataset via `SR_DATA_DIR`, never the real export.

## What done looks like

All nine controls compute ≥16px at the phone tier and iOS does not zoom on focus, in all four view modes.
No layout regression at 320px or at 200% text scale — in particular the Date Range pair and the Lat/Lng row.
Nothing above 640px changes. The range input and the checkbox deliberately remain unguarded.
