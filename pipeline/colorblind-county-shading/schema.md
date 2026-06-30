# schema.md — Colorblind-Accessible County Shading

**Feature:** colorblind-county-shading
**Stage:** 3 — The Architect
**Path:** Frontend Only

---

## Architect assessment — Frontend Only

> This feature adds a client-side MapLibre *render* option (a pattern-density
> fill mode for the existing county choropleth) that stores nothing, reads no
> new data, and persists no state — so there is no data layer to design, only a
> component/module build for the Engineer.

This was classified automatically (Studio Style auto-advance). The PRD is
explicit on the point: NFR-02 ("a pure client-side render option … no network
calls, no new tile/data providers, no bundled data, no telemetry") and NFR-06
("session-scoped React state, off by default, with no persistence"). Every
functional requirement is a rendering or control concern; none creates, reads,
updates, or deletes persisted data. If that reading is wrong — if anything here
is meant to be remembered across reload — stop and re-run this stage as a data
path.

---

## Data layer

**No schema. No migrations. No data changes.**

- No new tables, columns, files, or storage keys.
- No `storage` seam writes (the toggle is plain `useState`, NFR-06 / QA-24).
- No backend route, no `vite.config.ts` proxy entry, no transport-seam change.
- No new bundled asset. The texture sprites are generated **at runtime** from a
  `<canvas>`; nothing is added to `frontend/src/assets/` or `backend/staticdata/`.
- No `PRIVACY_POLICY.md` change (QA-21). The feature touches no provider/IP/
  viewport surface — it only re-paints a fill layer that already exists.
- The county count data, the `(state, county)` join, the quantile tiers, and the
  `--sr-county-1..10` tokens all already exist and are **reused unchanged**.

The remainder of this document is the technical design the Engineer (Stage 5)
builds from, and the Designer (Stage 4) tunes the visual constants in.

---

## Module / component design

This mirrors the **already-shipped atlas "Use Textures" path** end-to-end. The
atlas overlay (`lib/atlasTextures.ts` + `AtlasLayer.tsx` + the `TierHatchSwatch`
legend + the `MapExplorer` toggle) is the precedent; the county version is the
same shape scaled from 4 breeding tiers to 10 quantile tiers, with one
deliberate difference (below).

### Key design difference from the atlas precedent

The atlas hatch encodes 4 tiers with **four different motifs** (dot → single
diagonal → crosshatch → dense crosshatch) — motif *and* density both vary. With
**10** county tiers that doesn't scale: ten distinguishable motifs is not a
thing. So the county texture uses **one consistent crosshatch motif whose
DENSITY varies monotonically** — sparse at tier 1, tightest at tier 10. Density
(line spacing, optionally reinforced by line weight) is the single load-bearing,
testable encoding (FR-05/06/07). This keeps the guard test a pure monotonicity
assertion and removes any "is a dot denser than a diagonal?" ambiguity.

---

### 1. NEW `frontend/src/lib/countyTextures.ts`

The county analogue of `lib/atlasTextures.ts`. Pure + canvas-only; reads
`--sr-county-N-rgb` at call time so it tracks light/dark (NFR-03). Exports:

| Export | Shape | Mirrors atlas |
|---|---|---|
| `CountyTier` | `1 \| 2 \| … \| 10` | `Tier` |
| `COUNTY_TIERS` | `CountyTier[]` `[1..10]` | `TIERS` |
| `COUNTY_HATCH_IMAGE_ID` | `Record<CountyTier, string>` → `sr-county-hatch-1..10` | `HATCH_IMAGE_ID` |
| `countyHatchImageData(tier, dpr): ImageData` | bakes the crosshatch sprite | `hatchImageData` |
| `countyHatchPixelRatio(): number` | `min(3, max(2, ceil(dpr)))` | `hatchPixelRatio` |
| `countyHatchTierForImage(id): CountyTier \| null` | reverse lookup for the safety net | `hatchTierForImage` |
| `countyHatchDensity(tier): number` | **pure density metric** for the guard test | *(new)* |

**The density curve — the centralized, Designer-tunable core.** Put every visual
knob in one small constant table so the Designer (Stage 4) tunes it without
touching logic. Suggested shape:

```ts
// One crosshatch motif; DENSITY is the encoding. Sparser (large gap) at tier 1,
// tightest (small gap) at tier 10. Optional lineWidth lets the Designer add a
// secondary axis if 10 spacing steps alone aren't separable at the top end.
interface HatchSpec { gapPx: number; lineWidthPx: number }   // tile = gapPx (tileable crosshatch)
const HATCH: Record<CountyTier, HatchSpec> = { /* Designer fills 1..10 */ }
```

- `countyHatchImageData` draws a 45°/135° crosshatch at `HATCH[tier].gapPx`
  spacing into a `gapPx × gapPx` tile (corner-to-corner diagonals tile
  seamlessly, same trick the atlas TILE sizes use), tinted from
  `--sr-county-${tier}-rgb`. Per **OQ-02 default**, lay a faint tier tint under
  the strokes (atlas uses `FILL_ALPHA = 0.12`) — but density, not tint, must
  carry the tier.
- `countyHatchDensity(tier)` returns a **coverage proxy** the test can assert on
  without a canvas — e.g. `lineWidthPx / gapPx` (effective ink coverage). Deriving
  the test metric this way means it stays valid even if the Designer trades
  spacing for weight: the property "tier N is denser than tier N−1" holds on the
  proxy regardless of which knob moved. This is the analogue of
  `countyContrast.test.ts` asserting luminance monotonicity.

**Theme-independence note:** because *density* (not color) carries the tier, the
guard test is theme-independent — it asserts the geometry, not the token values
(the tokens are anyway identical in both themes, basemap-anchored). The runtime
sprite still re-reads `--sr-county-N-rgb` per NFR-03 so the *tint* tracks theme.

---

### 2. `frontend/src/components/map/CountyLayer.tsx` — changes

Mirror `AtlasLayer.tsx` exactly. Three edits:

**(a) New prop.** Add `useTextures?: boolean` to `Props` (default `false`).

**(b) Sprite-registration effect** — copy AtlasLayer's effect verbatim, retargeted
to the county exports. It must include, without deviation:
- `addAll()` looping `COUNTY_TIERS`, `map.hasImage(id) ? updateImage : addImage(id, img, { pixelRatio })`.
- **Register unconditionally at effect time. Do NOT gate on `isStyleLoaded()`
  with a `once('load')` fallback** — the documented post-mortem (CLAUDE.md): the
  Map Explorer map lives from first tab mount, so a `load` listener armed later
  never fires and the pattern silently renders nothing.
- A `styleimagemissing` safety net that bakes **only our own ids** on demand,
  guarded by `countyHatchTierForImage(e.id)` returning `null` for foreign ids.
- A `data-theme` `MutationObserver` that re-runs `addAll()` and bumps a
  `themeRev` (FR-11/12 / QA-12). Note `CountyLayer` already has a `themeRev`
  MutationObserver (lines ~196–200) for the fill-color re-resolve — extend that
  existing observer to also call `addAll()`, or add the sprite work to it, rather
  than mounting a second observer.
- Cleanup: `cancelled` flag, `obs.disconnect()`, `map.off('styleimagemissing', …)`.

**(c) Conditional fill paint.** Replace the single `fillPaint` with the atlas
pattern: `const useHatch = useTextures && shadeOn`, then

```ts
const fillPaint = useHatch
  ? {
      'fill-pattern': ['match', ['get', 'tier'],
        1, COUNTY_HATCH_IMAGE_ID[1], 2, COUNTY_HATCH_IMAGE_ID[2], … 10, COUNTY_HATCH_IMAGE_ID[10],
        COUNTY_HATCH_IMAGE_ID[1]],                       // tier 0 maps to a valid image, hidden by opacity 0
      'fill-opacity': ['case', ['>', ['get', 'tier'], 0], 1, 0],
    }
  : { /* the EXISTING fill-color match + fill-opacity 0.85 case, untouched */ }
```

The layer **id stays `sr-county-fill`** in both branches — this is load-bearing
(see Do-Not-Touch / heatmap). `shadeOn` already gates this, so FR-02/FR-08 (tier
0 → no texture) and FR-19 (over-cap → `fc` is `EMPTY_FC`, nothing draws, toggle
state retained) fall out for free.

**(d) In-view list swatch (Designer call — flag).** The keyboard "Counties in
view" disclosure renders an 11px swatch per row (`background: countyColor(tier)`,
~line 356). For FR-15 color-independence the row *already* carries the numeric
value, which is the true non-color read — so switching the 11px swatch to a
density mini-swatch in textured mode is optional polish, not a requirement.
**Designer decides** whether to render a density swatch there when `useTextures`
is on; if yes, reuse the same `CountyDensitySwatch` as the legend (below) at 11px.

---

### 3. `MapExplorer.tsx` + `map/MapSidebarUI.tsx` — toggle, state, legend

**(a) Session state** in `MapExplorer` (next to the existing atlas
`const [useTextures, setUseTextures] = useState(false)` at ~line 216):
```ts
const [useCountyTextures, setUseCountyTextures] = useState(false)   // off by default, NFR-06/QA-03/QA-24
```
Independent of the atlas `useTextures` (separate overlay, separate control).
Plain `useState` — **no `storage` seam, no persistence** (QA-24).

**(b) Pass it down** at the `<CountyLayer … />` mount (~line 2053):
`useTextures={useCountyTextures}`.

**(c) The "Use Textures" toggle.** Add it inside the existing
`shadeByCounty && backupReady` block (~lines 1164–1208), mirroring the atlas
toggle markup (~lines 1049–1073) so FR-01 (same label/placement/style) and FR-16
(accessible name + pressed state) are satisfied by construction:
- `role="switch"`, `aria-checked={useCountyTextures}`,
  `aria-label="Use textures on shaded counties"`, `tabIndex={0}`, the same 44×24
  pill markup, label text **"Use Textures"**.
- Place it directly under the Species/Checklists `SegControl`, above the legend.
- One helper line mirroring the atlas copy: "Adds a distinct hatch density per
  level so counties are distinguishable without color."
- FR-02 is automatic: the whole block only renders while `shadeByCounty &&
  backupReady`, so the toggle can't exist without active shading.

**(d) Legend — density ramp (FR-13/14, OQ-01 default).** In the legend loop
(~lines 1185–1196), when `useCountyTextures` is on, **replace** the color swatch
```tsx
<span … background: `var(--sr-county-${row.tier})` />
```
with a new inline-SVG `<CountyDensitySwatch tier={row.tier} />`, keeping the tier
ordering, the range text, and the active-metric label/unit
(`COUNTY_METRIC_META[countyMetric]`, already wired — satisfies FR-14). The "No
records — outline only" row and the quantile caption stay as-is.

**(e) NEW `CountyDensitySwatch`** in `map/MapSidebarUI.tsx`, mirroring
`TierHatchSwatch` (~lines 186–204) but: parametrized for `CountyTier` (1..10),
drawing the **single crosshatch motif** at the spacing **read from the same
`countyTextures.ts` density curve** (import `HATCH`/`countyHatchDensity` so the
legend can never drift from the map — one source of truth), tinted with
`--sr-county-${tier}-rgb`. A 26×15 SVG like the existing legend swatch box.

---

## Explicit "do not touch" list

These are unchanged by this feature — the Engineer must not modify them
(FR-17/18/19/20):

- **`lib/shadingExclusion.ts` `nextShadingState`** and the
  `handleShadeCounty` / `handleShadeBreeding` handlers (FR-17 / QA-17). Mutual
  exclusivity already clears the *other* ramp; clearing `shadeByCounty` makes
  `shadeOn` false in `CountyLayer`, which makes `useHatch` false — textures
  vanish with the shading for free. No new exclusivity wiring.
- **`components/map/BasemapDesaturation.tsx`** (FR-18 / QA-18). It's driven by
  `active={shadeByCounty || shadeByBreeding}` and never inspects the fill mode —
  greying holds in texture mode unchanged.
- **`SightingMarkers` `shadingFillId` / heatmap z-order** (FR-18, ~line 2073).
  The active fill id passed is `'sr-county-fill'` whenever `countyLinesEnabled &&
  shadeByCounty` — and the layer id **stays `sr-county-fill` whether it paints
  color or pattern**. So the heatmap `beforeId` re-order and pin-dimming are
  correct with zero change. Do not touch this expression.
- **County boundary lines** — `sr-county-line` (bundled, z≤9) and
  `sr-county-line-hi` (basemap `openmaptiles` vector, z9+), `vectorReady`,
  `ACCURATE_COUNTY_FILTER`, the handoff zoom (FR-20).
- **The county popup**, `CountStat`, `CountyPopupTop`, the eBird region link
  (FR-20).
- **The `(state, county)` join** — `countyKey` / `countyKeyFromState` and
  `buildCountyAggregates` / `computeCountyTiers` / `countyMetricValue` (FR-20,
  FR-09/10 are pure metric re-tiering that already flows through `tiers` +
  `metric` props — texture mode reads the same `tier` property, so a metric
  switch re-tiers and re-renders density automatically).
- **The viewport cap / windowing** — `countiesInBounds`, `COUNTY_CAP`,
  `BOUNDS_PAD`, `COUNTY_MINZOOM`, the `tooMany` "Zoom in to see counties" chip
  (FR-19 / QA-19).
- **The `--sr-county-1..10` tokens** in `globals.css` (Out of Scope: "No new,
  recolored, or additional county color classes / ramps") and
  `countyContrast.test.ts` — both stay green and pass unchanged.

---

## Open questions — handed to the Designer (Stage 4)

Restated with their PRD defaults so Stage 4 owns the visual call. The module
above is built so each is a small, centralized constant change, not a refactor.

- **OQ-01 — Legend: replace color swatches with density swatches, or show both?**
  *Default (this design):* replace the color swatch with `CountyDensitySwatch`
  while textures are on, keeping tier order + active-metric label (mirrors the
  atlas legend swapping to `TierHatchSwatch`). If "both" is chosen, the color
  swatch stays as a secondary cue with density leading.

- **OQ-02 — Faint tier tint under the pattern, or neutral/transparent base?**
  *Default:* keep a faint tier tint beneath the crosshatch (the
  `FILL_ALPHA ≈ 0.12` analogue), but the tier must be fully readable with the
  tint ignored. Tune `HATCH[tier]` tint alpha here.

- **OQ-03 — How sparse is tier 1 (lowest non-zero tier)?**
  *Default:* sparse but clearly present, so tier 1 reads as distinct from a
  tier-0 plain-outline county *and* from no fill — while leaving room for nine
  denser steps above. This is the largest-`gapPx` end of the density curve; the
  Designer sets the floor. (This is the central visual risk — see below.)

---

## Build / verify checklist hooks (Stage 5 Engineer / Stage 6 Tester)

- **NEW `frontend/src/lib/countyTextures.test.ts`** (spirit of
  `countyContrast.test.ts`, NFR-01 / QA-06 / QA-22). Pure, no canvas — assert on
  `countyHatchDensity(tier)`:
  1. **Strictly monotonic** across tiers 1..10 (density increases every step) —
     FR-05 / QA-05.
  2. **Adjacency-distinguishable**: each adjacent pair differs by at least a
     defined minimum step (a ratio or absolute delta the Designer sets), so no
     two neighbours blur — FR-06 / QA-06 / QA-07. Theme-independent (density, not
     color, carries the tier), so unlike the contrast test it need not parse both
     theme blocks — but it MAY also assert `COUNTY_HATCH_IMAGE_ID` has all 10
     ids and `countyHatchTierForImage` round-trips + returns `null` for a foreign
     id.
- **Existing `countyContrast.test.ts`** — must still pass untouched (no token
  change). Good signal that the color ramp was left alone.
- **`entryChunk.test.ts`** — **no change expected**. `countyTextures.ts` is a
  plain synchronous lib import into `CountyLayer` (itself already off the entry
  chunk via the lazy Map Explorer tab); it pulls in no maplibre and no
  `us-counties.json`. Re-confirm a fresh `npm run build` still shows
  `vendor-maplibre` and the county JSON **absent** from `dist/index.html`
  modulepreload (CLAUDE.md standing check) — they should be, unchanged.
- **Full CI mirror before push** (user memory: run-full-ci-mirror) —
  `npm run lint && npm run typecheck && npm run test && npm run build`. Note the
  build is the real type gate (CLAUDE.md 0.5.35 post-mortem): a new prop or an
  unused import will fail `tsc -b` even when vitest/eslint pass.
- **Manual / QA pass:** toggle round-trip restores the exact color ramp (QA-04);
  both metrics textured + metric switch keeps textures on (QA-09/10); both themes
  legible + theme switch refreshes, no stale pattern (QA-11/12); over-cap chip +
  retained toggle (QA-19); mutual exclusivity clears textures (QA-17); basemap
  grey + heatmap re-order hold (QA-18); keyboard "Counties in view" parity
  (QA-15); 200% text scale + desktop(Tauri)/web parity (NFR-05).
- **NFR-02 / QA-21:** confirm no new network call/provider/bundle/telemetry and
  that `PRIVACY_POLICY.md` is unchanged.
- **Version + changelog:** per CLAUDE.md this is a user-facing feature → bump
  BOTH `frontend/package.json` and `src-tauri/tauri.conf.json` (same patch
  version), update `CHANGELOG.md`, `docs/HELP.md`, `README.md`, and `website/`.
  (Deployment-stage concerns, noted here so they aren't missed downstream.)
