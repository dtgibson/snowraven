# Schema — County Lines & Shading

**Path classification: Frontend Only — no DB.** SnowRaven has no database, no
ORM, no migrations: all data is either a bundled static asset (e.g.
`frontend/src/assets/ca-atlas-blocks.json`, `noaa-tide-stations.json`,
`ebird-taxonomy.json`) or the user's own eBird/ML CSV parsed once client-side
(`observationsCache`). So in Weft's DB-oriented taxonomy this is **Frontend
Only** — there is no persistent schema or migration to write. That does **not**
mean "nothing to design": this feature introduces a real **client-side data
architecture** — a bundled geometry asset, a generation script, a re-keyed
client-side join, and a derived shading model — specified in full below so The
Engineer can build it without guessing.

This stage was auto-advanced; the classification is self-confirmed (no DB
exists to read from, the existing assets confirm the bundled-asset pattern).

> **Reference implementation to mirror exactly:** `AtlasLayer.tsx` +
> `lib/atlasBlocks.ts` + `lib/atlasBreeding.ts`. The County overlay is the
> structural twin of the California Breeding Bird Atlas overlay. Everywhere
> below names the atlas analog; reuse the proven pattern, don't re-invent it.

---

## 0. What does NOT change (scope guard)

- **No backend route, no DB, no migration, no ORM.** The join is pure
  client-side over the already-parsed backup. No `/...` path is added
  (NFR-06, QA-31). No dual-transport seam (`transport.ts`) is touched — the
  county geometry is bundled, not served.
- **No backend `staticdata/` copy of the geometry** (justified in §1.4). The
  asset is frontend-only, like `ca-atlas-blocks.json` — unlike the taxonomy /
  tide assets, which are dual-shipped *only because a FastAPI route serves
  them*. No route serves counties, so no second copy.
- **No new network provider, zero new outbound requests.** Geometry ships in
  the bundle; the join is local. `PRIVACY_POLICY.md` therefore needs **no
  change** (NFR-04) — flagged for the security review to confirm explicitly,
  not assume.
- **The Statistics county tables keep their behavior** (PRD "Out of Scope").
  They remain the source of the same per-county data. The *one* shared-code
  edit is the `computeGeo` re-key (§2.3) — its output must stay
  display-compatible with those tables. This is the feature's only structural
  risk and is called out in detail.

---

## 1. County geometry asset

### 1.1 Source (public domain — NFR-11, QA-34)

US Census **Cartographic Boundary Files**, county level, most-simplified
resolution: `cb_<YEAR>_us_county_500k` (1:500,000). Public domain (US federal
work). The cartographic-boundary variant — not raw TIGER/Line — is chosen
because it is already generalized for small-scale mapping (clipped to shoreline,
far smaller than full TIGER) and is the right fidelity for the zoom levels this
overlay shows. Pin a vintage year in the generation script (`VINTAGE = '2023'`
or current) so re-runs are reproducible.

Attribution: record "Boundaries: US Census Bureau Cartographic Boundary Files
(public domain)" wherever the project documents bundled data sources (the same
place the NOAA tide-station and eBird-taxonomy provenance lives — script header
comment + a line in the data-source notes). No runtime attribution UI required.

### 1.2 File format & shape

A single **GeoJSON `FeatureCollection`**, bundled as `*.json`, dynamic-imported
exactly like `ca-atlas-blocks.json`. (Plain GeoJSON, not TopoJSON, to stay
dependency-light and mirror the atlas's bare `import()` — no `topojson-client`
runtime decode. TopoJSON is the documented escape hatch in §1.6 *only* if the
size budget can't otherwise be met.)

Each `Feature`:

```jsonc
{
  "type": "Feature",
  "bbox": [minLng, minLat, maxLng, maxLat],   // precomputed by the build script
  "properties": {
    "geoid":   "06097",        // 5-digit FIPS = STATEFP(2) + COUNTYFP(3); stable identity (FR-23)
    "name":    "Sonoma",       // bare county name (TIGER NAME field — no "County" suffix)
    "stusps":  "CA",           // 2-letter state postal code
    "statefp": "06"            // 2-digit state FIPS
  },
  "geometry": { "type": "Polygon" | "MultiPolygon", "coordinates": [...] }  // [lng, lat], WGS84
}
```

- **`bbox` is precomputed at build time and stored on every feature**, so
  runtime viewport-windowing is a pure bbox-intersect test (mirrors how
  `atlasBlocks.ts` carries `bbox` per block). The runtime never computes a
  polygon bbox for ~3,143 features on each `moveend`.
- `geoid` is the single stable identity and the source of the eBird region
  link (§2.5). `name` + `stusps` are the join inputs (§2). Keep `properties`
  minimal — every extra field multiplies by ~3,143.

### 1.3 Coverage & the antimeridian / AK / HI (FR-08, QA-08)

- **US states + DC.** Territories (PR/VI/GU/AS/MP) are optional for v1 — eBird
  Subnational2 in territories exists but TIGER county equivalents are
  inconsistent; default to the 50 states + DC and treat territory counties as
  "data without geometry" (§3, FR-26). Filter by `STATEFP`: keep `01–56`
  excluding the non-state codes; the build script's filter list is explicit.
- **Antimeridian is resolved at BUILD time, never at runtime.** Alaska's
  Aleutian boroughs cross ±180°. A polygon ring with longitudes spanning
  −179…+172 drawn naively smears across the whole map, and a naive bbox
  (`minLng ≈ −180, maxLng ≈ +180`) would falsely intersect every viewport. The
  build script **cuts dateline-crossing polygons at ±180** (mapshaper handles
  this) so each emitted feature lies wholly in one hemisphere with a correct
  one-sided `bbox`. A borough split this way becomes 2+ features sharing the
  same `geoid`/`name`/`stusps` (multiple features per county is fine — the join
  keys on `(state, name)`, and the keyboard list/popup dedupe by `geoid`; see
  §2 and §4). Hawaii needs no special handling (single hemisphere).

### 1.4 Where it lives

`frontend/src/assets/us-counties.json` — **frontend-only**, exactly like
`ca-atlas-blocks.json`. **No `backend/staticdata/` copy.** Rationale: the
dual-ship pattern (`ebird-taxonomy.json`, `noaa-tide-stations.json`) exists
*only* because a FastAPI route reads the backend copy. Nothing serves counties
— the join is 100% client-side — so a backend copy would be dead weight. This
is the correct asymmetry, not an oversight.

### 1.5 Generation script contract — `scripts/build-county-boundaries.mjs`

New script, modeled on `scripts/build-tide-stations.mjs` /
`build-ebird-taxonomy.mjs` (node ESM, fetch → transform → guard → write,
hard-fail on a degraded result). It is **not** part of `npm run build` (the
asset is a committed artifact, like the taxonomy snapshot); re-run at release
time when refreshing the Census vintage.

| Aspect | Contract |
|---|---|
| **Input** | Census CB shapefile `https://www2.census.gov/geo/tiger/GENZ<YEAR>/shp/cb_<YEAR>_us_county_500k.zip`, vintage pinned in a `VINTAGE` constant. |
| **Tooling** | Orchestrate **mapshaper** (via `npx mapshaper` or a pinned devDependency) for shapefile→GeoJSON, simplify, dateline-cut, projection. There is precedent for a conversion script (`scripts/convert-atlas-blocks.mjs`). Document the exact mapshaper command line in the script header. |
| **Transform** | (a) reproject to WGS84 (EPSG:4326); (b) `-simplify` Visvalingam with `keep-shapes` to the budget (start ~6–10%, tune to hit §1.6); (c) `-each` to keep only `geoid,name,stusps,statefp` (rename from `GEOID/NAME/STUSPS/STATEFP`); (d) filter to the state allow-list; (e) cut at the antimeridian; (f) round coordinates to **4 decimal places** (~11 m — ample at these zooms, big size win); (g) attach per-feature `bbox`. |
| **Output** | `frontend/src/assets/us-counties.json` (single FeatureCollection). |
| **Guard (hard-fail, mirrors taxonomy build)** | Abort the build if: feature count below a floor (`< 3000`, catches a truncated fetch/over-filter); raw bytes above the stretch ceiling (`> 1.5 MB`); any feature missing `geoid`/`name`/`stusps`; any `geoid` not 5 digits; any coordinate `|lng| > 180`/`|lat| > 90` (antimeridian-cut sanity). Print the count + raw/gz size like the taxonomy script does. |
| **Determinism** | Pinned `VINTAGE`, fixed simplification %, fixed rounding, and a stable feature sort (by `geoid`) so re-runs are byte-stable for clean diffs. |

---

## 2. The county key + join model

### 2.1 The canonical key (FR-10)

The join keys on **(state, normalized county name)** — never name alone — so
same-named counties across states ("Washington", "Jefferson") never conflate
(QA-10). Two pure helpers, unit-tested (NFR-10, QA-33):

```ts
// lib/countyBoundaries.ts

/** Lowercase, de-diacritic, strip admin suffixes, normalize Saint/St., collapse ws. */
export function normalizeCountyName(raw: string): string {
  return raw
    .normalize('NFD').replace(/\p{Diacritic}/gu, '')          // Doña Ana → Dona Ana
    .toLowerCase()
    .replace(/\bst\.?\b/g, 'saint').replace(/\bste\.?\b/g, 'sainte')
    .replace(/[.]/g, '')
    .replace(/\s+(county|parish|census area|borough|municipality|city and borough|municipio)$/,'')
    .replace(/\s+/g, ' ')
    .trim()
}

/** STUSPS + normalized name → the join key. STUSPS from the backup is the
 *  subnational1 code's 2nd segment: "US-CA".split('-')[1] === "CA". */
export function countyKey(stusps: string, countyName: string): string {
  return `${stusps.toUpperCase()}|${normalizeCountyName(countyName)}`
}
```

- The CSV `County` field is bare (`"Alameda"`, `"Marin"`, confirmed in
  `parseEbirdObservations.ts` + `deriveBreedingData.test.ts` fixtures) and so
  is the TIGER `NAME` — normalization mostly absorbs diacritics, Saint
  abbreviations, and case; the suffix-strip is a belt-and-suspenders guard
  (some TIGER NAMEs and Louisiana/Alaska forms carry them).
- **US-only gate:** the backup's `stateProvince` is the eBird subnational1 code
  (`"US-CA"`). Join only when the country segment is `US`
  (`stateProvince.split('-')[0] === 'US'`); STUSPS is the 2nd segment.
  Non-US counties get no key → not shaded (FR-26).

### 2.2 The per-county aggregate the join consumes

```ts
// lib/countyShading.ts
export interface CountyAggregate {
  stateProvince: string   // "US-CA"
  county: string          // display name, e.g. "Sonoma"
  species: number         // distinct species recorded in the county
  records: number         // checklist/record count in the county
}
// Built into Map<countyKey, CountyAggregate> from computeGeo's per-county rows.
export function buildCountyAggregates(rows: CountyRow[]): Map<string, CountyAggregate>
```

`buildCountyAggregates` reads `computeGeo`'s per-county output (now correctly
(state, county)-keyed — §2.3) and re-keys it with `countyKey(...)` for O(1)
lookup against each rendered feature. At render, each feature looks up
`countyKey(feature.properties.stusps, feature.properties.name)`; a miss → zero
species / zero records (an unrecorded county, FR-12/FR-16).

**No point-in-polygon, ever** (FR-09, QA-09): geometry only draws and locates a
county; the count comes from the CSV's own `County`/`State/Province` columns via
`computeGeo`. The tints must match the Statistics county tables for the same
county (QA-09).

### 2.3 The `computeGeo` re-key — the one shared-code change (Open Q5, FR-10)

**File:** `frontend/src/lib/birdingStats.ts`, `computeGeo` (line ~278).

**Today (latent collision):** `countyMap`, `countyStateMap`, `countySpecies`
are keyed by `c.county` (name alone, lines 280–282, 297–300). A "Washington"
checklist in `US-CA` and one in `US-UT` collapse into a single merged row —
wrong counts, and unusable as a (state, county) join source.

**Change:** key the three internal maps by a composite of state + county, so
each (state, county) pair is its own bucket:

```ts
const k = `${c.stateProvince ?? ''} ${c.county}`   // raw composite; lossless
```

(Use a raw NUL-joined composite for the internal key — normalization happens
only at the §2.1 join boundary, so the internal aggregation stays lossless.)
The observation pass (lines 308–313) must key `countySpecies` by the same
composite, derived from `o.stateProvince` + `o.county`.

**Output shape is preserved.** `allCountyData` rows stay
`{ name, count, stateProvince, species }` — `name` is the county, and
`stateProvince` is already present on every row today (line 323). The *only*
observable change is that two same-named counties in different states now emit
**two rows instead of one merged row** — a correctness fix. `topCounties` /
`topCountiesBySpecies` keep the same row type. Add `records` as an explicit
alias of `count` *or* let the county module read `count` directly (either is
fine; pick one and be consistent).

**Compatibility risk — must be handled, not assumed (flag for Engineer + QA):**

1. **Statistics county-table React keys.** `BirdingStats.tsx` renders
   `topCounties` rows. If any row is keyed by `name` alone, two same-named
   counties (now two rows) produce **duplicate React keys**. Re-key those list
   rows to `` `${row.stateProvince}-${row.name}` `` (or include the index).
   Grep `BirdingStats.tsx` for the county table render and fix the `key=`.
2. **Visible count shift.** A user who birded same-named counties in multiple
   states will now see them split (e.g. two "Washington" rows). This is the
   intended fix, but it changes displayed numbers for those users — note it so
   it isn't mistaken for a regression.
3. **Existing tests.** `birdingStats.test.ts` asserts on `computeGeo` county
   output — update any fixture/expectation that assumed name-only merging, and
   **add** a test proving two same-named counties in different states stay
   distinct (this doubles as QA-10 coverage).

### 2.4 Why state comes from `stateProvince`, not geometry

The backup carries `State/Province` (subnational1, `"US-CA"`) and `County` on
every row — that's the join's state source. The geometry's `stusps`/`statefp`
are the *target* side. No geometry is consulted to compute a count; the two
sides meet only through `countyKey`.

### 2.5 eBird region link derivation (FR-17, NFR-08, QA-17)

```ts
// lib/countyBoundaries.ts
const COUNTY_REGION_RE = /^US-[A-Z]{2}-\d{3}$/
/** GEOID "06097" + STUSPS "CA" → "US-CA-097", validated, else null. */
export function deriveCountyRegionCode(geoid: string, stusps: string): string | null {
  if (!/^\d{5}$/.test(geoid)) return null
  const code = `US-${stusps.toUpperCase()}-${geoid.slice(-3)}`   // last 3 = COUNTYFP
  return COUNTY_REGION_RE.test(code) ? code : null
}
```

The popup name links to `https://ebird.org/region/${encodeURIComponent(code)}`
**only** when `deriveCountyRegionCode` returns non-null; otherwise the name is
plain text — never a styled 404 link (same posture as the v0.5.40 hotspot-link
/ v0.5.34 id-shape guards). Built as escaped JSX, never `dangerouslySetInnerHTML`
(NFR-08). Bundled `geoid` is trusted-but-validated.

---

## 3. Derived data model (windowing, tiers, metric)

### 3.1 Viewport windowing — mirrors `atlasBlocks.blocksInBounds`

```ts
// lib/countyBoundaries.ts
export type Bounds = [minLng, minLat, maxLng, maxLat]
export interface CountiesInBoundsResult { features: CountyFeature[]; tooMany: boolean }
export function countiesInBounds(data: CountyFC, bounds: Bounds, cap: number): CountiesInBoundsResult
export function countyListRows(features: CountyFeature[], cap: number): { rows: CountyListRow[]; total: number; overCap: boolean }
```

- Reuse `padBounds` and the `bboxIntersects` test from `atlasBlocks.ts` (export
  them or copy the 3-line helper). Recompute on `moveend` over
  `padBounds(bounds, 0.15)`.
- **Cap + minzoom (FR-06, QA-06):** ~3,143 counties total, so a national
  zoom-out shows them all → over cap → "Zoom in to see counties" hint and draw
  nothing. Suggested `COUNTY_CAP ≈ 800` and `minzoom ≈ 4` on the layers
  (tunable — far fewer than the atlas's 9,000/17k, so the cap is hit only when
  genuinely too dense to read). `countyListRows` caps the keyboard list at
  `MARKER_LIST_CAP` with an over-cap hint, exactly like `blockListRows`.
- **Dedupe for the keyboard list / popup by `geoid`** (a dateline-split borough
  is multiple features but one county); the on-map fill draws each feature ring.

### 3.2 Quantile tiers — data-driven (FR-11, QA-11)

```ts
// lib/countyShading.ts
export interface CountyTiers {
  /** Upper bound of each class, ascending; length = class count (1–4). */
  breaks: number[]
  /** count → tier 1..N (0 if the county has no record for the metric). */
  tierFor(count: number): number
  /** Per-tier inclusive [min,max] for the legend. */
  legend: { tier: number; min: number; max: number }[]
}
export function computeCountyTiers(nonZeroValues: number[], maxClasses = 4): CountyTiers
```

- Compute **quantile breaks over the user's own non-zero county values** for the
  active metric, mapped onto `--sr-tier-1..4` (the ramp has exactly 4 steps —
  confirmed in `globals.css`).
- **Ties / small datasets (FR-11):** dedupe break values; when distinct
  non-zero values `< maxClasses`, produce *fewer* classes, never empty or
  duplicate ranges. With `k` distinct values < 4, yield `k` classes.
- **Zero non-zero counties (FR-14, QA-14):** `computeCountyTiers([])` returns
  empty `breaks`/`legend`; the layer draws no fills and the control shows an
  honest "no recorded counties to shade" note (county lines still draw if on).
- Fill assignment uses the same MapLibre `['match', ['get','tier'], …]`
  expression pattern as `AtlasLayer` (§ fillPaint), `fill-opacity 0` for
  `tier 0` (unrecorded — FR-12) while keeping the polygon **hit-tested** so its
  popup still opens (FR-16, QA-16). Tier colors read from `--sr-tier-N` tokens
  at runtime with a `TIER_FALLBACK`, re-resolved on a `data-theme`
  `MutationObserver` (FR-27, QA-27) — copy `AtlasLayer`'s `tierColor` + theme
  effect verbatim.

### 3.3 Metric toggle (FR-20/21, QA-20/21)

- State `metric: 'species' | 'records'`, default `'species'`, session-scoped,
  beside the atlas-style toggle state in `MapExplorer`.
- The feature property fed to the fill is `aggregate[metric]` (species or
  records) per county; switching `metric` recomputes `computeCountyTiers` over
  that metric's non-zero values, redraws fills, and relabels the legend.
- The **popup always shows both** species and records regardless of the active
  metric (FR-21) — both live on `CountyAggregate`.

---

## 4. New TypeScript modules / types (and where they slot)

| New file | Atlas analog | Responsibility |
|---|---|---|
| `frontend/src/assets/us-counties.json` | `ca-atlas-blocks.json` | Bundled GeoJSON FeatureCollection, dynamic-imported on first enable. |
| `frontend/src/lib/countyBoundaries.ts` | `lib/atlasBlocks.ts` | Types (`CountyFeature`, `CountyFC`, `CountyListRow`), `countiesInBounds`, `countyListRows`, `padBounds`/`bboxIntersects` (reuse), `normalizeCountyName`, `countyKey`, `deriveCountyRegionCode`. |
| `frontend/src/lib/countyShading.ts` | `lib/atlasBreeding.ts` | `CountyAggregate`, `buildCountyAggregates(computeGeo rows)`, `computeCountyTiers`, `tierFor`, legend ranges, metric selection. |
| `frontend/src/components/CountyLayer.tsx` | `components/AtlasLayer.tsx` | The MapLibre overlay: line + fill layers, single state-driven `<Popup>`, keyboard "Counties in view" panel, theme `MutationObserver` re-resolve, marker-layer click arbitration. |
| `scripts/build-county-boundaries.mjs` | `scripts/build-tide-stations.mjs` | Build-time asset generation (§1.5). |
| `frontend/src/lib/countyBoundaries.test.ts` | `atlasBlocks.test.ts` | Unit: normalization, `countyKey`, `countiesInBounds`/cap, `deriveCountyRegionCode` guard. |
| `frontend/src/lib/countyShading.test.ts` | `atlasBreeding.test.ts` | Unit: aggregates, quantile tiers (ties / small / zero-non-zero), metric switch. |
| `frontend/src/components/CountyLayer.test.tsx` | `AtlasLayer.test.tsx` | Render/marker-arbitration parallels. |
| **Build-inspection test (new — none exists yet)** | — | Asserts NFR-03/QA-30: `us-counties.json` chunk absent from `dist/index.html` modulepreload and not imported by the entry chunk. **This test does not currently exist** (the `vendor-maplibre`/atlas check is a manual standing check in CLAUDE.md); the Engineer must create it. |

**Wiring in `MapExplorer.tsx`** (mirror the atlas wiring exactly — lines
200–204, 669–692, 905–1010, 1826–1833):
- State: `countyLinesEnabled` (default `false`, FR-02), `countyData` (lazy),
  `countyLoading`, `shadeByCounty` (default `false`, FR-03), `countyMetric`
  (`'species'`, FR-20). All session-scoped, shared across view modes, **not**
  persisted (FR-02) — same as `atlasEnabled`/`shadeByBreeding`.
- Lazy load on first enable: `await import('../assets/us-counties.json')` with
  a `countyLoading` spinner state (FR-22/FR-25), copying `handleToggleAtlas`.
- `countyAggregates` `useMemo` gated on `phase.tag === 'ready'` (the parse-once
  `observationsCache`/`computeGeo` result — NFR-01), exactly like
  `breedingByBlock` (line 690).
- Add the toggle block to the shared `atlasOverlayControls` region (or a sibling
  "Map Overlays" block) so it appears in every view mode (FR-01) — `role=switch`
  + `aria-checked` toggles, the shade sub-toggle `disabled` + note when
  `phase.tag !== 'ready'` (FR-04, copy the `backupReady` gating at lines
  940–966), the metric `SegControl`-style toggle with `aria-pressed` (NFR-07).
- Render `<CountyLayer …/>` under `{countyLinesEnabled && …}` beside
  `{atlasEnabled && <AtlasLayer …/>}` (line 1826).

---

## 5. Data-flow & edge cases (mapped to the PRD)

| Case | Behavior | PRD |
|---|---|---|
| **No backup loaded** | County **lines** draw (geometry only). Shade sub-toggle **disabled** with "Load your eBird backup in Settings to use this". | FR-04, QA-04 |
| **County in data, no matching geometry** (renamed/non-US/unresolved) | `countyKey` miss → not drawn/shaded, **no error**. Count still appears in the Statistics county tables (unchanged). | FR-26, QA-26 |
| **Zero non-zero counties** (no records / no county-tagged checklists) | `computeCountyTiers([])` → no fills, honest "nothing to shade" note; lines still draw. | FR-14, QA-14 |
| **Offline** | Once the geometry chunk is loaded, **zero** network calls — lines, shading, popup, legend, in-view list all local. | FR-24, NFR-04/05, QA-24 |
| **Large life list (~20k rows)** | Reuse parse-once `observationsCache` + memoized `computeGeo`/aggregates/tiers; viewport cap keeps the live GeoJSON small; no `react-hooks/purity` violation (no `Date.now()`/impure calls in render or memo). | NFR-01, QA-28 |
| **Antimeridian / AK / HI** | Dateline-crossing boroughs are **cut at build time** into one-hemisphere features with correct bboxes — no smear, correct windowing. | FR-08, QA-08 |
| **Same-named counties, different states** | Distinct (state, county) keys → shaded by their own per-state counts, never merged. | FR-10, QA-10 |
| **Unrecorded county clicked** | Transparent (`fill-opacity 0`) fill stays hit-tested; popup shows 0 species / 0 records. | FR-16, QA-16 |
| **Click on a pin above a county** | `queryRenderedFeatures` against `['sr-sight-circle','sr-hotspot']` short-circuits the county click (copy `AtlasLayer`'s arbiter). | FR-18, QA-18 |
| **Theme toggle** | Fill colors re-resolved from `--sr-tier-N` via `data-theme` `MutationObserver`; line color is a token, AA in both themes (verify with the project's luminance math before shipping any new pair). | FR-27, NFR-07, QA-27 |

---

## 6. Bundle / build constraints (NFR-02, NFR-03)

- **Off the entry chunk (v0.5.42 rule, NFR-03/QA-30).** `us-counties.json` and
  `CountyLayer.tsx` (which couples to maplibre) must be reachable only via
  `import()` / `React.lazy` — **never** from `App.tsx`'s static import graph.
  `CountyLayer` follows the map-tab lazy pattern; the asset is imported on first
  enable. A fresh `npm run build` must show the county chunk absent from
  `dist/index.html` modulepreload and no bare import in the entry chunk — same
  standing check as `vendor-maplibre`/`ca-atlas-blocks`. The new
  build-inspection test (§4) enforces it.
- **Size budget (NFR-02/QA-29):** target ≤ **400 KB gzipped** chunk (raw
  stretch ≤ 1.5 MB). The build script's simplification % is tuned to meet this
  while keeping boundaries recognizable at the shown zooms. Reference point: the
  atlas chunk is ~160 KB, but it ships a *gazetteer* and generates rectangles;
  counties are real irregular polygons, so this is the feature's main size
  pressure (see Flags).

---

## 7. Open-question resolutions carried from the PRD

US-only v1 (non-US → no geometry, FR-26); metric toggle included, default
distinct species (FR-20); Map Explorer only; ≤ 400 KB gz budget; (state,
county) re-key of `computeGeo`; up to 4 quantile classes onto `--sr-tier-1..4`,
collapsing on small datasets. All resolved as PRD defaults — no schema-level
deviation.
