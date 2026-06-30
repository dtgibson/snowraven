# Design Spec — Colorblind-Accessible County Shading ("Use Textures")

**Feature:** colorblind-county-shading
**Stage:** 4 — The Designer
**Preview:** `pipeline/colorblind-county-shading/design.html`
**Builds on:** the schema (`schema.md`) and the shipped atlas textures path
(`lib/atlasTextures.ts`, `AtlasLayer.tsx`, `TierHatchSwatch`).

---

## Visual Direction

A single crosshatch motif whose density rises monotonically across the ten
county quantile tiers — an open lattice at tier 1, a tight (but never solid)
crosshatch at tier 10 — so the county choropleth ranks identically with hue and
luminance removed. It reads as a quiet, restrained extension of the existing
green county ramp and the atlas Use Textures mode, not a new visual language.
Off by default; the plain color ramp is unchanged until the user opts in.

---

## The density curve — final HATCH table

The Designer-tunable core. Two knobs: line spacing (`gapPx`, the tile side) and
line weight (`lineWidthPx`). Spacing carries tiers 1–6 (the sparse end, where
spacing differences are most legible); line weight takes over at 7–10, where the
gap can no longer shrink without the holes closing. Drop this in verbatim:

```ts
// lib/countyTextures.ts
// One 45°/135° crosshatch motif. DENSITY is the encoding, not hue or weight alone.
// tile = gapPx (corner-to-corner diagonals tile seamlessly — the atlas TILE trick).
// gapPx decreases 20→5 (tighter); lineWidthPx rises 0.75→1.30 (heavier at the dense end).
interface HatchSpec { gapPx: number; lineWidthPx: number }

const HATCH: Record<CountyTier, HatchSpec> = {
  1:  { gapPx: 20, lineWidthPx: 0.75 },
  2:  { gapPx: 17, lineWidthPx: 0.80 },
  3:  { gapPx: 14, lineWidthPx: 0.80 },
  4:  { gapPx: 12, lineWidthPx: 0.85 },
  5:  { gapPx: 10, lineWidthPx: 0.90 },
  6:  { gapPx:  9, lineWidthPx: 1.00 },
  7:  { gapPx:  8, lineWidthPx: 1.10 },
  8:  { gapPx:  7, lineWidthPx: 1.15 },
  9:  { gapPx:  6, lineWidthPx: 1.25 },
  10: { gapPx:  5, lineWidthPx: 1.30 },
}
```

**Why these numbers (verified):**

| Tier | gapPx | lineWidthPx | proxy `lw/gap` | step ratio | est. ink coverage |
|---|---|---|---|---|---|
| 1 | 20 | 0.75 | 0.0375 | — | ~10% |
| 2 | 17 | 0.80 | 0.0471 | 1.26 | ~13% |
| 3 | 14 | 0.80 | 0.0571 | 1.21 | ~16% |
| 4 | 12 | 0.85 | 0.0708 | 1.24 | ~19% |
| 5 | 10 | 0.90 | 0.0900 | 1.27 | ~24% |
| 6 | 9 | 1.00 | 0.1111 | 1.24 | ~29% |
| 7 | 8 | 1.10 | 0.1375 | 1.24 | ~35% |
| 8 | 7 | 1.15 | 0.1643 | 1.20 | ~41% |
| 9 | 6 | 1.25 | 0.2083 | 1.27 | ~50% |
| 10 | 5 | 1.30 | 0.2600 | 1.25 | ~60% |

- Proxy `lw/gap` is **strictly increasing**, every step.
- **Minimum adjacency ratio = 1.195** (tier 7→8). Comfortably above the guard
  threshold (below).
- Top tier ~60% ink — dense and unmistakably the maximum, but the square holes
  (~2px at county scale) keep it clearly **not solid**.
- `gapPx` strictly decreases; `lineWidthPx` is non-decreasing (note tiers 2 and 3
  share `lw = 0.80` — spacing carries that step). This is intentional: the proxy,
  not either raw knob alone, is what monotonicity is asserted on.

---

## Crosshatch geometry

Mirror `atlasTextures.ts` exactly, generalized to one motif at a per-tier tile
size:

- **Tile:** a `gapPx × gapPx` square canvas (rendered at `pixelRatio`,
  `min(3, max(2, ceil(dpr)))` — reuse `hatchPixelRatio`).
- **Strokes:** two diagonals, corner to corner, so they tile seamlessly when
  repeated — identical to the atlas:
  ```ts
  ctx.moveTo(0, size); ctx.lineTo(size, 0)   // 45° (anti-diagonal)
  ctx.moveTo(0, 0);    ctx.lineTo(size, size) // 135° (main diagonal)
  ```
  `size = gapPx` (in CSS px, then scaled by the pixel ratio). `lineCap = 'butt'`
  so diagonals meet cleanly across tile boundaries. Effective perpendicular line
  spacing is `gapPx / √2`; that's expected and consistent across tiers.
- **Stroke width:** `HATCH[tier].lineWidthPx` (× pixel ratio).
- Reference `countyHatchDensity` below for the exact tileable values; do **not**
  hand-roll the geometry per-tier — one `drawCrosshatch(ctx, gapPx, lineWidthPx, rgb)`.

---

## Stroke and tint alphas

```ts
const TINT_ALPHA   = 0.12   // faint tier-color underlay (the atlas FILL_ALPHA analogue)
const STROKE_ALPHA = 0.80   // the crosshatch strokes — the load-bearing density cue
```

- The tint reads from `--sr-county-${tier}-rgb` at generation time (NFR-03), so
  it tracks light/dark via the existing `data-theme` MutationObserver. **Density
  is theme-independent**; only the tint re-resolves.
- Strokes use the same `--sr-county-${tier}-rgb` at `STROKE_ALPHA`. At line
  crossings the two diagonals composite slightly darker — that only reinforces
  density, never changes the ranking.
- The legend / in-view swatch render a touch stronger at small size:
  `TINT_ALPHA 0.16`, `STROKE_ALPHA 0.85` (so 26×15 and 11px swatches stay
  legible on the sidebar surface). One small, deliberate deviation; the
  **geometry** (spacing/weight) is identical to the map and read from the same
  `HATCH` table — no drift.

---

## Open-question decisions

- **OQ-01 — Legend: replace the color swatches with density swatches.** With
  textures on the user has opted into the color-free read, so the legend speaks
  the same language as the map; showing both re-introduces the cue the mode
  removes and crowds a ten-row legend. Tier order, range text, and the
  active-metric label all stay. (`COUNTY_METRIC_META[countyMetric]` already wired
  — satisfies FR-14.)

- **OQ-02 — Keep a faint tier tint (0.12) under the crosshatch.** It ties the
  textured map to the color ramp and the greyed basemap so the switch isn't
  jarring, and gives a subtle secondary cue for color-sighted users. Density,
  not tint, carries the tier — the grayscale panel in the preview proves the
  ranking survives with the tint ignored.

- **OQ-03 — Tier-1 floor: `gapPx 20`, `lineWidthPx 0.75` (~10% ink).** A clearly
  visible open lattice — distinct from a tier-0 plain-outline county and from no
  shading at all, while leaving nine denser steps of headroom. This is the
  sparsest end of the curve.

---

## Legend `CountyDensitySwatch`

New inline-SVG component in `map/MapSidebarUI.tsx`, mirroring `TierHatchSwatch`
(~lines 186–204) but parametrized for `CountyTier` (1..10) and drawing the single
crosshatch motif:

- **Box:** 26×15 SVG, `border: 1px solid var(--sr-border-medium)`, `borderRadius: 3`,
  `overflow: hidden`, `aria-hidden`, `flexShrink: 0` — identical to the existing
  swatch chrome.
- **Geometry from the one source of truth:** import `HATCH` (or a thin
  `countyHatchSpec(tier)` accessor) from `lib/countyTextures.ts` so the legend can
  never drift from the map. Draw the anti-diagonals at `HATCH[tier].gapPx` spacing
  and the main diagonals at the same spacing, `strokeWidth = HATCH[tier].lineWidthPx`,
  across an x-offset loop from `-15` to `26` so the lattice fills the 26×15 box (the
  same offset pattern `TierHatchSwatch` uses). Fill `rgba(var(--sr-county-${tier}-rgb), 0.16)`;
  stroke `rgba(var(--sr-county-${tier}-rgb), 0.85)`.
- The "No records — outline only" legend row stays as-is (a dashed/plain outline
  swatch, no fill), and the quantile caption is unchanged.

---

## In-view list mini-swatch (FR-15) — RECOMMEND adding it

In the keyboard "Counties in view" disclosure, when `useTextures` is on, replace
the 11px color dot (`background: countyColor(tier)`, ~line 356) with
`<CountyDensitySwatch tier={tier} />` sized to 11px. Low-risk polish: the row's
numeric value is still the true non-color read, but the density mini-swatch keeps
the disclosure speaking the same language as the legend and the map. Off-mode
keeps the color dot unchanged.

---

## Guard-test property (`lib/countyTextures.test.ts`)

Assert on the pure coverage proxy — no canvas, theme-independent:

```ts
export function countyHatchDensity(tier: CountyTier): number {
  return HATCH[tier].lineWidthPx / HATCH[tier].gapPx   // ink-coverage proxy
}
const MIN_ADJ_RATIO = 1.12   // actual min step is 1.195; this leaves margin so a flattening tweak fails
```

1. **Strictly monotonic:** `countyHatchDensity(n) > countyHatchDensity(n-1)` for
   all `n` in 2..10 (FR-05 / QA-05).
2. **Adjacency-distinguishable:** `countyHatchDensity(n) / countyHatchDensity(n-1) >= MIN_ADJ_RATIO`
   for all `n` in 2..10 (FR-06 / QA-06/07). The proxy is `lineWidthPx/gapPx`, so
   the property holds whichever knob the Designer later moves.
3. **Image-id integrity (optional but recommended):** `COUNTY_HATCH_IMAGE_ID` has
   all 10 ids; `countyHatchTierForImage` round-trips every id and returns `null`
   for a foreign id.

Theme note: the test asserts geometry only, so it need not parse both theme
blocks (unlike `countyContrast.test.ts`). The runtime sprite still re-reads
`--sr-county-N-rgb` per NFR-03 so the tint tracks theme.

---

## Component Usage / Tokens applied

- **Canvas `ImageData` sprites** via `map.addImage` → MapLibre `fill-pattern`
  (NFR-03) — same mechanism as the atlas hatches; no SVG `<pattern>`, no new
  bundled asset.
- **Tokens:** `--sr-county-1..10-rgb` for tint and strokes (unchanged, identical
  in both themes — basemap-anchored). `--sr-border-medium` for swatch chrome.
  The boundary-line color stays the basemap-anchored slate literal
  `rgba(71,85,105,0.85)` (the documented no-token exception).
- **Toggle:** `role="switch"`, `aria-checked`, `aria-label="Use textures on
  shaded counties"`, the same 44×24 / 40×22 pill as the atlas toggle, label
  "Use Textures", helper line "Adds a distinct hatch density per level so
  counties are distinguishable without color."

---

## Interaction notes

- Sprites generate on mount and on a `data-theme` change only (NFR-04) — never
  per frame or per `moveend`. Register unconditionally at effect time; **never**
  gate on `isStyleLoaded()` with a `once('load')` fallback (the documented
  post-mortem). Keep the `styleimagemissing` safety net scoped to our own ids via
  `countyHatchTierForImage(e.id) !== null`.
- The fill layer **id stays `sr-county-fill`** in both the color and pattern
  branches — load-bearing for the heatmap z-order and basemap-desaturation wiring
  (do-not-touch list). Tier 0 maps to a valid image hidden by
  `fill-opacity ['case', ['>', ['get','tier'], 0], 1, 0]`.
- Everything else — mutual exclusivity, basemap greying, heatmap re-order,
  viewport cap, boundary lines, popup, the (state, county) join — is untouched.

---

## Content notes

Copy stays in the app's quiet, informative register. Toggle helper: "Adds a
distinct hatch density per level so counties are distinguishable without color."
Legend caption: "Quantile bins · 10 levels." Metric label follows the active
metric ("Species" / "Checklists"). No promotional language; the control explains
itself in one calm line.
