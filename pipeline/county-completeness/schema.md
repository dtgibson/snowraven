# Schema — County Completeness

**Feature:** county-completeness
**Stage:** 3 — The Architect
**Path:** Incremental (extend the shipped county-overlay data layer)

---

## Architect assessment — Incremental

> SnowRaven has no database; "schema" here is the data-flow, route contracts,
> caching design, type definitions, and cross-runtime parity that the county
> overlay already established (v0.5.46–v0.5.51). This feature **extends** that
> layer: it adds one thin eBird proxy route (+ its Tauri twin), a purpose-built
> persistent per-county cache, and two pure computation libs — and reuses the
> existing `(state, county)` join, the 10-class ramp/tokens/textures, the
> `nextShadingState` mutual-exclusion, the desaturation/heatmap wiring, and the
> three-state offline messaging **unchanged**. Nothing existing is rewritten.

Declared under Studio-Style auto-advance and proceeding. If any assumption below
is wrong (see **Migration Notes** — there is no DB migration), the Engineer flags
it in Stage 5 rather than silently diverging.

---

## Migration Notes

**No database, no migration.** SnowRaven persists only flat JSON/CSV via the
`storage` seam (desktop: `data/*.json` under `AppLocalData`; web/Pi: one file per
key behind `/settings/{key}`). This feature adds exactly one new persisted
document — `county-completeness-v1` — through the existing seam. There is no
schema version to bump, no column to alter, no data to backfill. On first read the
new document is absent → treated as an empty store (same normalize-to-empty
pattern as `replay-store-v1`). Removing the feature later just orphans that one
settings key (harmless).

---

## What already exists and is reused UNCHANGED

The feature is a peer metric on the existing overlay. These are **do-not-touch**
(they already satisfy the FRs that reference them):

| Existing asset | Role reused | FR |
|---|---|---|
| `lib/countyBoundaries.ts` — `countyKey` / `countyKeyFromState` / `deriveCountyRegionCode` / `countiesInBounds` / `padBounds` / `countyListRows` | (state,county) join key; county→`US-XX-###` region code (shape-guarded, null when unresolvable); viewport windowing + cap | FR-12, FR-18, FR-13, NFR-03 |
| `lib/countyShading.ts` — `computeCountyTiers` / `countyMetricValue` / `COUNTY_CLASS_COUNT` / `COUNTY_METRIC_META` | Species/Checklists quantile path stays byte-identical; completeness adds a **parallel** fixed-band path, does not alter these | FR-06 |
| `lib/countyTextures.ts` + `COUNTY_HATCH_IMAGE_ID` + `CountyDensitySwatch` | 10 crosshatch density steps map to the 10 completeness bands with zero change (band index feeds the same `tier` property) | FR-04 |
| `--sr-county-1..10` (+`-rgb`) tokens; `countyContrast.test.ts` / `countyTextures.test.ts` | Band colors/densities; both guard tests stay green (no token change) | FR-06, NFR-05, NFR-10 |
| `lib/shadingExclusion.ts` `nextShadingState` + `handleShadeCounty`/`handleShadeBreeding` | Completeness IS county shading → participates in mutual exclusion for free | FR-03 |
| `components/map/BasemapDesaturation.tsx` (`active={shadeByCounty ‖ shadeByBreeding}`) | Land desaturates while completeness shades — untouched | FR-05 |
| `SightingMarkers` `shadingFillId='sr-county-fill'` heatmap re-order + pin dim | Fill layer id stays `sr-county-fill` in the completeness branch too | FR-05 |
| `lib/offlineDetect.ts` `isOfflineError`/`isNoKeyError` + `lib/offlineMessage.ts` `classifyLiveError` (`OFFLINE_MESSAGE`/`NO_KEY_MESSAGE`/`GENERIC_ERROR_MESSAGE`) | The three distinct degraded states, one voice | FR-29/30/31, NFR-08 |
| `lib/speciesUtils.ts` `isNonCountableSpecies` / `normalizeSpeciesName` | Numerator = countable, subspecies collapsed | FR-07, FR-09 |
| `lib/tauri/taxonomyService.ts` + `/taxonomy/codes` + `<BirdName>` | User-name→code resolution for targets/recent; favicons + backbone-gated links | FR-23 |
| `lib/tauri/mapService.ts` `getHotspotRegion` / `backend/routers/map.py` `/map/hotspot-region` | The template the new route + twin copy exactly (thin eBird proxy, parity) | FR-19, NFR-07 |
| `storage` seam `getSetting`/`setSetting` (+ the `replayStore` document pattern) | Persistent per-county cache home | FR-15, OQ-05 |

---

## Data-flow diagram (text)

```
                    ┌──────────────────────────── LOCAL (offline, no key) ────────────────────────────┐
 loaded backup ──▶ buildCountyCompletenessLocal(observations)                                          │
 (observations)     └─▶ Map<countyKey, CountyLocalCompleteness>                                          │
                          { stateProvince, county,                                                      │
                            countableCount X (isNonCountableSpecies, subspecies collapsed, DISTINCT),   │
                            countableNames[] (normalized, DISTINCT),                                     │
                            recentNew[] (species by FIRST-in-county date, newest first, top 5) }         │
                    └──────────────────────────────────────────────────────────────────────────────────┘
                                              │  (memoized in MapExplorer; works with NO eBird key/network)
                                              ▼
 metric==='completeness' && shadeByCounty:
   CountyLayer(viewport) ── onViewportCounties(inViewCounties) ──▶ CompletenessController (MapExplorer / hook)
                                                                     │
                     ┌──── persistent cache read (once) ────────────┤   hasKey? online?
                     │  storage.getSetting('county-completeness-v1') │
                     │  → in-memory Map<regionCode, EbirdEntry>      │
                     ▼                                               ▼
             shade cached counties immediately          eager-fetch (bounded ≤4, deduped):
             (offline/no-key friendly)                  for each in-view county WHERE localX≥1
                                                          AND region code resolvable
                                                          AND not fresh-in-cache AND not in-flight AND hasKey
                                                              │
                                                              ▼
                                          transport.get('/map/county-species', { regionCode })
                                              ├─ web/Pi ─▶ FastAPI  GET /map/county-species ─▶ eBird product/spplist/{region}
                                              └─ desktop ▶ mapService.getCountySpecies() ─────▶ eBird product/spplist/{region}
                                                              │
                                          eBird codes (all categories, taxonomic order)
                                                              │  species-comparability collapse (BOTH transports, same snapshot):
                                                              │   code → reportAs parent (if any) → keep iff in species-set → dedupe (preserve order) → resolve comName
                                                              ▼
                                        CountyEbirdData { regionCode, speciesCount Y, species:[{speciesCode, commonName}] (taxonomic order) }
                                                              │  put → persistent cache (fetchedAt = now) + in-memory Map
                                                              ▼
 combine per county (pure):  computeCompleteness(local, ebird, userCountyCodes)
     → CountyCompletenessResult { x, y?, ratio?, percent? (FR-10), band 0..10 (FR-11),
                                  recentNew[], targets? (FR-22), status, fromCache, regionResolvable }
                                                              │
                                                              ▼
   CountyLayer paint:  tier = result.band  (0 → unshaded plain outline)   ── same fill/texture/legend machinery
   CountyLayer popup:  progress bar "X of Y species (Z%)" + recentNew[] + targets[]  (escaped JSX, <BirdName>)
```

Click-to-fetch (un-birded county): `CountyLayer` opens the popup and calls
`onRequestCounty(regionCode, countyKey)`; the controller runs a single deduped
fetch (same pipeline), popup shows pending → result.

---

## Endpoint spec

### NEW `GET /map/county-species`  (thin eBird proxy + species-collapse)

Path prefix `/map` is **already** in the Vite dev proxy and `main.py`'s
`map_router` — **no new proxy entry, no new router registration** (FR-19 note:
add-prefix rule triggers only for a *new* prefix; this reuses `/map`).

**Request**

| Param | Type | Validation |
|---|---|---|
| `regionCode` | query string | `^US-[A-Z]{2}-\d{3}$` (county subnational2 only; stricter than `hotspot-region`, matching `deriveCountyRegionCode`'s `COUNTY_REGION_RE`). Malformed → 422; `encodeURIComponent`-wrapped before interpolation into the eBird URL (NFR-09). |

**Upstream:** `GET https://api.ebird.org/v2/product/spplist/{regionCode}` with
`X-eBirdApiToken` header (user's own key). Returns a JSON array of species codes
for the region, all-time, **all categories** (species, issf, form, domestic,
hybrid, spuh, slash, intergrade), in eBird taxonomic order.

**Server-side species-comparability transform** (the FR-09 denominator rule; run
identically on both transports against the bundled taxonomy snapshot — see
*Taxonomy-comparability algorithm*): collapse each code to its species parent,
keep only species-category codes, dedupe preserving first-seen (taxonomic) order,
resolve each to its common name.

**Response 200**

```jsonc
{
  "regionCode": "US-CA-085",
  "speciesCount": 412,               // Y — species-level, FR-08/FR-09
  "species": [                        // species-level, taxonomic order (targets pool, FR-22)
    { "speciesCode": "gwfgoo", "commonName": "Greater White-fronted Goose" },
    { "speciesCode": "cangoo", "commonName": "Canada Goose" }
    // …
  ]
}
```

- Empty eBird list (valid region, nothing reported) → `{ speciesCount: 0, species: [] }` (FR-25).

**Error shapes** (identical to the existing `/map/*` routes → drive the three states)

| Condition | HTTP | Body / behavior | Frontend classification |
|---|---|---|---|
| No eBird key | 401 | `{ "detail": "eBird API key not configured. Add it in Settings." }` (raised by `_api_key()` **before** any network) | `no-key` |
| eBird returned non-OK | 502 | `{ "detail": "eBird API error: <status>" }` | `error` (server-error) |
| eBird unreachable / device offline | 502 (web) / connection-level throw (desktop) | `{ "detail": "Could not reach the eBird API." }` (web) | `offline` via `isOfflineError` |
| Bad `regionCode` | 422 | FastAPI validation | never sent (frontend only calls with a `deriveCountyRegionCode` non-null value) |

**Not added to `CACHED_GET_PATHS`.** The 90 s in-memory `networkCache` would be
shadowed by the 30-day persistent completeness cache and add a confusing second
layer. The `CompletenessController` owns caching (persistent store + in-flight
dedup Map), so `transport.get('/map/county-species')` is only ever called on a
genuine cache miss. (Decision — see *Design decisions*.)

---

## New / changed files

### Frontend — new

| File | Purpose |
|---|---|
| `frontend/src/lib/countyCompleteness.ts` | **Pure core.** `buildCountyCompletenessLocal(observations)` → `Map<countyKey, CountyLocalCompleteness>` (X, distinct countable names, recent-new-species). `computeCompleteness(local, ebird, userCountyCodes)` → `CountyCompletenessResult`. `completenessBand(ratio)` (FR-11 fixed bands). `completenessPercent(x, y)` (FR-10). `completenessTargets(ebirdSpecies, userCodes, n)` (FR-22). `COMPLETENESS_BANDS` legend table. No network, no maplibre. |
| `frontend/src/lib/countyCompletenessCache.ts` | **Persistent per-county eBird cache.** Storage-seam-backed (`county-completeness-v1`), 30-day TTL, in-flight dedup, bounded eviction, offline-from-cache reads. Mirrors `replayStore.ts` structure (in-memory mirror + debounced whole-doc write + order-based eviction). |
| `frontend/src/hooks/useCountyCompleteness.ts` *(or inline controller in MapExplorer)* | Orchestrates: load persistent cache once; expose `resultFor(countyKey)`; bounded eager-fetch (≤4) of birded in-view counties; `requestCounty()` click-to-fetch; per-county status. |
| `frontend/src/lib/countyCompleteness.test.ts` | band monotonicity + FR-10 percent rules + FR-09 clamp + recent-new ordering + targets exclusion; pure. |
| `frontend/src/lib/countyCompletenessCache.test.ts` | TTL freshness, in-flight dedup, eviction caps, offline-from-cache. |

### Frontend — changed

| File | Change |
|---|---|
| `frontend/src/lib/transport.ts` | `TauriTransport.get`: add `if (path === '/map/county-species') return getCountySpecies(params.regionCode)`. **Do NOT** add to `CACHED_GET_PATHS`. |
| `frontend/src/lib/tauri/mapService.ts` | NEW `getCountySpecies(regionCode)` — twin of `getHotspotRegion`; fetch spplist, run the species-collapse via a taxonomyService helper, return the same payload shape as the backend. |
| `frontend/src/lib/tauri/taxonomyService.ts` | Export a comparability helper (e.g. `collapseToSpeciesList(codes)` / `getSpeciesCodeSet()`) reusing the already-loaded in-memory cache (`bySci` values → species-code set, `reportAs`, `byCode`). No new bundle load (BirdName already loads it on desktop). |
| `frontend/src/components/map/CountyLayer.tsx` | Add `'completeness'` handling: metric union gains `'completeness'`; when active, `tier = completenessResults.get(key)?.band ?? 0`; popup renders the completeness block (progress bar + counts + recentNew + targets) instead of the top-3; add `onViewportCounties` + `onRequestCounty` callbacks. Fill layer id stays `sr-county-fill`. |
| `frontend/src/components/MapExplorer.tsx` | Third `SegControl` option; wire `useCountyCompleteness`; build `localCompleteness` memo + `completenessResults`; pass fixed-band tiers/results + callbacks to `CountyLayer`; point-of-use disclosure (FR-34); legend switches to the 0–100% band scale (FR-27). |
| `frontend/src/components/map/MapSidebarUI.tsx` | Completeness legend rows (10 percentage-range labels + unshaded entry); reuse `CountyDensitySwatch` for textures mode. |
| `frontend/src/lib/entryChunk.test.ts` | Extend guard so the new completeness code stays off the entry chunk (NFR-02) — it is only reachable through the already-lazy `CountyLayer`/Map Explorer; assert no new maplibre/county import leaks. |

### Backend — changed

| File | Change |
|---|---|
| `backend/routers/map.py` | NEW `GET /map/county-species` — twin of `get_hotspot_region`: validate `regionCode` (county pattern), fetch spplist, run the species-collapse using the taxonomy maps already loaded by `routers/taxonomy.py` (`_by_sci` values → species-set, `_report_as`, `_by_code`; reuse `_ensure_loaded()` / the `resolve_species` collapse logic), return `{ regionCode, speciesCount, species[] }`. Same 401/502 error idiom. |
| `backend/tests/test_map_router.py` | New-route tests: species-collapse (issf→species, drop spuh/slash/hybrid), empty list, 401/502, taxonomic-order dedupe. |

### Desktop / config

- **No `vite.config.ts` change** — `/map` already proxied.
- **No `src-tauri` capability change** — reuses `tauriFetch` + existing key access.
- **No new bundled asset** — reuses the existing taxonomy snapshot on both sides.

### Docs (Stage 8 / same change — flagged, not Architect-owned)

`docs/HELP.md`, `README.md`, `website/`, and **`PRIVACY_POLICY.md` verification**
(FR-35/36): the new call is device→eBird with the user's key — the same class as
`/map/hotspot-region`/`/map/recent-obs`, already covered by the eBird disclosure;
verify and, only if absent, add. No new provider (NFR-06).

---

## Type definitions

```ts
// lib/countyCompleteness.ts

/** Local, backup-derived per-county facts — available offline, no key. */
export interface CountyLocalCompleteness {
  stateProvince: string            // "US-CA"
  county: string                   // display name
  countableCount: number           // X: DISTINCT countable species (isNonCountableSpecies), subspecies collapsed
  countableNames: string[]         // normalized DISTINCT countable common names (for target-subtraction + code resolve)
  recentNew: FirstCountyRecord[]   // by first-in-county date, newest first, capped (default 5)
}

export interface FirstCountyRecord {
  commonName: string               // normalized (species-level)
  scientificName: string
  firstDate: string                // YYYY-MM-DD — earliest record of this species in the county
}

/** The eBird payload for a county (from the route; cacheable). */
export interface CountyEbirdData {
  regionCode: string               // "US-CA-085"
  speciesCount: number             // Y (species-level, comparable)
  species: EbirdSpecies[]          // species-level, taxonomic order
}
export interface EbirdSpecies { speciesCode: string; commonName: string }

export type CompletenessStatus =
  | 'ready'        // local + eBird combined (band may be 0 if X=0)
  | 'loading'      // fetch in flight (FR-33)
  | 'offline'      // FR-30
  | 'no-key'       // FR-29
  | 'error'        // FR-31 server error
  | 'empty'        // eBird returned 0 species (FR-25)
  | 'unfetched'    // birded/known but not yet fetched, or un-birded not yet clicked
  | 'no-region'    // deriveCountyRegionCode === null (FR-18)

export interface TargetSpecies { speciesCode: string; commonName: string }

/** Combined, render-ready per-county result. */
export interface CountyCompletenessResult {
  x: number                        // local countable count (0 if no local record)
  recentNew: FirstCountyRecord[]   // always present when local exists (offline)
  y?: number                       // eBird species count (present when data or cache present)
  ratio?: number                   // min(x/y, 1) when y>0, else undefined
  percent?: number                 // FR-10 display value 0..100 when y>0
  band: number                     // 0..10 — the fill/texture tier (0 = unshaded)
  targets?: TargetSpecies[]        // FR-22 (present when y present)
  status: CompletenessStatus
  fromCache: boolean               // true when y came from the persistent store (may be stale-but-shown)
  regionResolvable: boolean        // false → status 'no-region'
}
```

```ts
// lib/countyCompletenessCache.ts  (storage document shape — persisted via seam)
export interface CountyCompletenessStore {
  version: 1
  entries: Record<string, CountyCompletenessCacheEntry>   // key = regionCode "US-CA-085"
  order: string[]                                          // oldest-fetched → newest (eviction)
}
export interface CountyCompletenessCacheEntry {
  data: CountyEbirdData
  fetchedAt: number     // ms epoch — 30-day TTL anchor
  bytes: number         // serialized length — byte-cap eviction
}
```

---

## Taxonomy-comparability algorithm (FR-09 — "the percentage must not lie")

Both sides count **species-category taxa** the same way. Subspecies collapse to
species; spuh / slash / hybrid never inflate either side.

**Denominator (Y) — server-side, both transports, against the bundled snapshot:**

```
speciesSet = new Set(Object.values(bySci))     // authoritative species-category codes (~11.2k)
seen = new Set(); out = []
for code in spplist(regionCode):               // eBird order, all categories
    parent = reportAs[code] ?? code            // collapse issf/form/domestic/intergrade → species
    if parent in speciesSet and parent not in seen:
        seen.add(parent); out.push({ speciesCode: parent, commonName: byCode[parent] })
    // spuh/slash/hybrid (and any code not resolving into speciesSet) are dropped
Y = out.length
```

- `reportAs` handles subspecies/form collapse (a county with 3 Song Sparrow
  subspecies contributes **one** species). Spuh (`gull sp.`), slash
  (`Greater/Lesser Scaup`), and hybrids have no species-parent in `speciesSet`
  and are dropped — never counted (FR-09, QA-08).
- Order preserved = taxonomic order (drives the targets floor, FR-22 / OQ-01).

**Numerator (X) — frontend, from the backup:**

```
per county, over filterObservations-then-isNonCountableSpecies rows:
  X = |{ normalizeSpeciesName(commonName) : distinct }|
```

- `normalizeSpeciesName` strips the subspecies parenthetical → subspecies collapse
  to species on the user side too. `isNonCountableSpecies` drops spuh/slash/hybrid
  (note: this is **stricter** than the Species-metric count, which uses
  `isSpuhOrSlash` and keeps hybrids — hence FR-20's requirement that the popup
  label X so it can't be confused with the Species-metric number).

**Ratio & clamp (FR-09/FR-10):** `ratio = y > 0 ? Math.min(x / y, 1) : undefined`.
A user species that resolves to no eBird species, or one eBird's list happens to
lack, still counts in X but the `Math.min(…,1)` clamp guarantees the displayed
percentage never exceeds 100% (QA-09).

**Targets (FR-22):** resolve the user's `countableNames` → species codes via the
existing `/taxonomy/codes` path (`userCountyCodes: Set<speciesCode>`). Targets =
`ebird.species.filter(s => !userCountyCodes.has(s.speciesCode))`, first `n`
(default 5) in taxonomic order. Because `ebird.species` is already species-level,
no spuh/slash/hybrid can appear (QA-18). Names render through `<BirdName>` with
resolved favicons; a target not in the user's backbone gets plain name + favicons,
no link (FR-23).

---

## Band-mapping table (FR-11 — fixed equal-width bands over 0–100%)

`completenessBand(ratio)`: `ratio <= 0 → 0`; else `Math.min(10, Math.ceil(ratio * 10))`.
Band assignment uses the **true** ratio (`min(x/y,1)`), never the rounded display
percent.

| Band | Ratio interval (true) | County tier / `--sr-county-N` / hatch density | Legend label |
|---|---|---|---|
| 0 | `x = 0` **or** unfetched / no-region / degraded | none — plain outline | "Not birded / not fetched" |
| 1 | `(0%, 10%]` | tier 1 | "1–10%" |
| 2 | `(10%, 20%]` | tier 2 | "11–20%" |
| 3 | `(20%, 30%]` | tier 3 | "21–30%" |
| 4 | `(30%, 40%]` | tier 4 | "31–40%" |
| 5 | `(40%, 50%]` | tier 5 | "41–50%" |
| 6 | `(50%, 60%]` | tier 6 | "51–60%" |
| 7 | `(60%, 70%]` | tier 7 | "61–70%" |
| 8 | `(70%, 80%]` | tier 8 | "71–80%" |
| 9 | `(80%, 90%]` | tier 9 | "81–90%" |
| 10 | `(90%, 100%]` | tier 10 | "91–100%" |

- Any non-zero completeness lands in band ≥ 1 (a 1-of-300 county is visibly
  shaded, QA-10). Fully complete (`x ≥ y > 0`) → ratio 1 → band 10.
- Legend caption differs from the quantile metrics: **fixed percentage ranges, not
  data-driven breaks** (FR-27). `COMPLETENESS_BANDS` is a static 10-row table (not
  `computeCountyTiers`), so the legend and `CountyDensitySwatch` order are byte-stable.

**Display percent (FR-10)** `completenessPercent(x, y)`:
```
x === 0            → 0
y > 0 && x >= y    → 100
r = round(x/y*100); if r >= 100 → 99 (incomplete never shows 100); if r <= 0 → 1 (non-zero never shows 0)
```

---

## Caching — key / shape / TTL / eviction (OQ-04 30-day, OQ-05 persisted)

- **Layer:** dedicated `countyCompletenessCache.ts` on the `storage` seam, **not**
  `networkCache` (90 s, wrong TTL) and **not** `replayStore` (its offline-only
  fallback semantics don't give FR-15's "no refetch within the bound"). Structure
  copies `replayStore.ts`: one-disk-read-per-session in-memory mirror, debounced
  whole-document write, `order[]`-based eviction.
- **Storage key:** `county-completeness-v1` (one document; desktop
  `data/settings.json` field or its own file behind the seam — Engineer's call,
  simplest is a `setSetting` key like the map-style blobs).
- **Entry key:** `regionCode` (`US-CA-085`) — canonical, 1:1 with a county, matches
  `deriveCountyRegionCode`. (`countyKey` is the render join; the cache keys on
  region code because that's what was fetched.)
- **TTL:** 30 days from `fetchedAt`. Read: fresh entry → return, **no network**
  (FR-15). Miss/stale → fetch. Stale-but-present + offline → still return it for
  shading, marked `fromCache` (FR-30).
- **Eviction:** oldest-`fetchedAt` first; caps **250 counties OR 4 MB**, whichever
  fills first (a ~500-species county ≈ 15 KB; 250 ≈ ~3.5–4 MB). Exported mutable
  caps for tests (mirrors `REPLAY_MAX_*`).
- **In-flight dedup (FR-16):** module-level `Map<regionCode, Promise>` — concurrent
  or repeat requests for the same county share one call; cleared on settle.
- **Errors never cached** (same posture as `networkCache`/`replayStore`): a
  401/502/offline failure never writes an entry, so it's retryable on the next
  click (FR-25/31).

---

## Concurrency / eager-fetch bounding (OQ-07 ~4)

- **Eager set:** on `CountyLayer` `moveend` → `onViewportCounties(inView)`; the
  controller keeps only counties with `localX ≥ 1` **and** a resolvable region code
  **and** not fresh-in-cache **and** not in-flight — then, only if `hasKey`, enqueue
  them. Never un-birded, never the full viewport-cap set, never any metric but
  completeness, never a bulk/all-US sweep (FR-13/17, QA-11).
- **Bound:** a fixed-size promise pool of **4** (simple semaphore/worker-drain over
  the queue). New pans re-seed the queue; the in-flight Map prevents duplicates
  across pans (FR-16). Results stream into state → counties shade **progressively**
  (FR-33). No `window`/`resize` reads (convention).
- **Click-to-fetch (FR-14):** un-birded county click → `onRequestCounty` → one
  deduped fetch (bypasses the birded-only eager filter; a single explicit request).
  0% result stays unshaded (band 0), preserving "plain outline = never birded".

---

## Error / degraded-state contract (FR-24/25/29/30/31, NFR-08)

Classification uses `classifyLiveError` (offline → no-key → error precedence).
The mode is **local-first**: X and `recentNew` come from the backup and render
regardless; only Y/percent/targets depend on eBird.

| Situation | Shading | Popup |
|---|---|---|
| `hasKey === false` (FR-29) | cached counties still shade; uncached plain; **no fetch** | X + recentNew shown; Y/%/targets replaced by `NO_KEY_MESSAGE`; point-of-use cue at control |
| Offline, uncached (FR-30) | plain (unless cached) | X + recentNew; offline message where Y/%/targets go; no spinner, no blank |
| Offline, cached (FR-30) | shades from cache (`fromCache`) | cached Y/%/targets shown (optionally noted as cached) |
| Server error 5xx (FR-31) | failed county plain; already-shaded keep shading | `GENERIC_ERROR_MESSAGE`; retryable on next click |
| Empty eBird list (FR-25) | not shaded (band 0) | counts + "no species reported for this county on eBird"; no %; retry on click |
| No region code (FR-18) | never fetched, never shaded | "eBird data isn't available for this county"; no link |
| Fetch in flight (FR-33) | progressive as results arrive | pending indication for the clicked county |
| Zero-county user (FR-32) | all plain | click-to-fetch works normally |

`hasKey` is read via `storage.getApiKey('ebird')` when Completeness is selected;
`navigator.onLine` is **never** used to gate a request (convention) — offline is
detected by classifying the actual failure.

---

## Accessibility & security (NFR-04/05/09)

- Third `SegControl` option carries `aria-pressed`; the point-of-use disclosure has
  an accessible name. Progress bar = `role="progressbar"` with
  `aria-valuenow/min/max` **and** the "X of Y species (Z%)" text (equivalent text
  rendering) (NFR-04). "Counties in view" gains completeness parity: each row shows
  "X of Y, Z%" or the honest state (FR-28).
- Popup content is **escaped JSX** — species/county names never `dangerouslySetInnerHTML`
  (NFR-09). `regionCode` shape-validated (`COUNTY_REGION_RE`) before any URL
  interpolation and `encodeURIComponent`-wrapped in the query (NFR-09, matches the
  existing region-link guard). A malformed/unresolvable code → plain text, no href.
- All fills reuse `--sr-county-*` tokens + existing hatch sprites (no new color;
  `countyContrast.test.ts` / `countyTextures.test.ts` unchanged) (NFR-05/10).

---

## Design decisions

1. **Targets = unranked taxonomic-order floor from the spplist itself (OQ-01
   floor), ONE eBird call per county.** The public API has no all-time frequency
   product. The recency alternative (`data/obs/{regionCode}/recent`, ~last 30 days)
   would **double** the per-county eBird call volume for a *seasonal, partial*
   signal (a winter target vanishes in July) — a poor trade against NFR-01's
   bounded-fetch mandate and the honesty bar. The spplist already returns the pool
   in taxonomic order at zero extra cost. **Flagged** as the deliberate v1 limit;
   recency-ranking is a clean future upgrade (add a second bounded call + a
   frequency merge) that this design's `computeCompleteness`/`completenessTargets`
   seam accommodates without a route change.

2. **Comparability split: Y-side (denominator + target pool) on the route; X-side
   (numerator + user codes) on the frontend — both against the identical bundled
   taxonomy snapshot.** The web frontend deliberately does **not** load the 1.7 MB
   taxonomy (it delegates to the Python backend), so the species-collapse must
   happen where the snapshot already lives on each transport: Python
   `routers/taxonomy.py` maps for web/Pi, `taxonomyService` in-memory cache for
   desktop. This keeps the frontend transport-agnostic (consumes one JSON shape)
   and reuses existing loaders — no third copy of the taxonomy, honoring the
   "shipped twice, kept identical" snapshot rule.

3. **Dedicated persistent cache, not `replayStore`/`networkCache`.** FR-15's "no
   refetch within 30 days" needs freshness-based short-circuiting that neither
   existing layer provides (`networkCache` = 90 s; `replayStore` = always-live-first
   with offline-only fallback). The new cache copies `replayStore`'s proven
   storage-seam persistence + eviction shape but with TTL-gated reads. Not added to
   `CACHED_GET_PATHS` (would double-cache).

4. **Fixed bands parallel to — not replacing — `computeCountyTiers`.** Completeness
   supplies its own `band` per county (a static `COMPLETENESS_BANDS` table);
   `CountyLayer` branches on `metric === 'completeness'` for the tier value and the
   popup, leaving the Species/Checklists quantile path byte-identical (FR-06). The
   fill layer id stays `sr-county-fill`, so desaturation/heatmap/texture wiring is
   untouched (FR-05).

5. **Local-first degradation.** X + recent-new-species derive purely from the
   backup and render with no key/no network; only the eBird half degrades, using
   the app's existing three-state classifier so completeness speaks the same
   offline/no-key/error voice as every other live surface (NFR-08).
