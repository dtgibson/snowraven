# QA Report — County Lines & Shading

**Date:** 2026-06-28
**Test Runner:** vitest
**Result:** PASSED

QA reproduced the full CI mirror independently (lint → typecheck → test → build) and
walked every QA-01…QA-34 row in the PRD. All four gates are green and all 34
acceptance criteria pass. Several criteria are verified by code inspection where the
literal pass condition describes runtime/visual behavior; those are listed under
*Known Limitations* as deploy-stage manual checks. No test failures, no Fails, no
Partials.

## Test Suite Results

Reproduced from `/home/parallels/snowraven/frontend` (my own run, not the Engineer's):

| Gate | Command | Result |
|---|---|---|
| Lint | `npm run lint` (eslint) | exit 0 — clean |
| Typecheck | `npm run typecheck` (`tsc --noEmit`) | exit 0 — clean |
| Tests | `npm run test` (`vitest run`) | exit 0 — **95 files, 1140 tests passing, 0 failing** |
| Build | `npm run build` (`tsc -b && vite build`) | exit 0 — built successfully |

**Backend:** untouched (`git status` shows no `backend/` changes). pytest skipped — justified.

**County-specific tests (44):** `countyBoundaries.test.ts`, `countyShading.test.ts`,
`countyContrast.test.ts`, `entryChunk.test.ts` — all green, including the post-build
`dist/index.html` modulepreload check (re-run with `dist/` present).

### Build-inspection (NFR-02 / NFR-03 / QA-29 / QA-30)

- **County geometry chunk size:** `dist/assets/us-counties-*.js` = 1,428.20 KB raw /
  **317.74 KB gzipped** — under the 400 KB gz budget (and under the 1.5 MB raw ceiling).
- **Separate on-demand chunk:** the geometry is its own chunk, not folded into the entry
  chunk (`index-*.js` = 223.63 KB).
- **Off the entry chunk:** `dist/index.html` modulepreload list contains **no**
  `us-counties`, `CountyLayer`, or `vendor-maplibre` reference (confirmed by grep AND by
  the now-active post-build assertion in `entryChunk.test.ts`). The static-import-graph
  test also confirms `App.tsx` never statically reaches `CountyLayer.tsx`,
  `us-counties.json`, or maplibre.
- **Asset integrity:** 3,145 features across 51 states+DC; each carries
  `{geoid,name,stusps,statefp}` + a precomputed bbox; `source` field records the
  public-domain Census attribution.

## Acceptance Criteria Verification

Verification method key: **(a)** automated test · **(b)** code inspection ·
**(c)** requires runtime/manual to fully confirm (noted, not claimed as machine-verified).

| ID | Result | Method | Basis |
|---|---|---|---|
| QA-01 | ✓ Pass | b, c | "County lines" switch added to the shared Map Overlays sidebar block (rendered for all view modes since it lives in the one MapExplorer sidebar); `handleToggleCounty` lazy-loads geometry and `CountyLayer` draws boundaries. Runtime confirms the on-map draw. |
| QA-02 | ✓ Pass | b | `useState(false)` for `countyLinesEnabled` at component level → default OFF, shared across view modes (one component), not persisted (plain state, no storage seam). |
| QA-03 | ✓ Pass | b | Shade sub-toggle is inside `countyLinesEnabled && (…)`; turning lines off sets `shadeByCounty=false` and unmounts `CountyLayer` (popup `sel` state destroyed) → fills/legend/popup all gone. |
| QA-04 | ✓ Pass | b | Shade switch `disabled={!backupReady}` + `aria-disabled` + "Load your eBird backup in Settings to use this" note; County lines loads geometry regardless of backup. |
| QA-05 | ✓ Pass | a, b, c | `map.on('moveend', …)` → `setBounds` → `countiesInBounds(padBounds(bounds, .15), CAP)`; live source = in-view features only (`countiesInBounds` test). Runtime confirms pan/zoom redraw. |
| QA-06 | ✓ Pass | a, b, c | `COUNTY_CAP=800` → `tooMany` "Zoom in to see counties" chip (test); `COUNTY_MINZOOM=4` on both layers. Runtime confirms thresholds feel right. |
| QA-07 | ✓ Pass | b | Name surfaced in the popup and in the "Counties in view" list rows. |
| QA-08 | ✓ Pass | a, b, c | `build-county-boundaries.mjs` `emitFeatures` splits dateline-crossing counties into one-hemisphere features with correct per-feature bbox; AK & HI present in the asset; `countyListRows` dedupes the split halves by geoid (test). Runtime confirms no visual smear. |
| QA-09 | ✓ Pass | a, b | `buildCountyAggregates` joins on the CSV's County/State columns — no point-in-polygon. Parity test locks `agg.records/species == computeGeo`'s row. Live app feeds identical input to both paths under defaults (see caveat below). |
| QA-10 | ✓ Pass | a | `countyKey(stusps, normalizeCountyName(name))`; two-Washingtons test (CA vs UT stay distinct) + normalization tests (case/diacritic/Saint/suffix). |
| QA-11 | ✓ Pass | a | `computeCountyTiers` quantile breaks; ties→fewer classes, small-dataset, all-equal→1 class, zero-non-zero→empty, zero/negative-ignored all tested. |
| QA-12 | ✓ Pass | b | `fill-opacity` is `['case', ['>', ['get','tier'], 0], 0.85, 0]` — tier 0 draws no fill, line still drawn. |
| QA-13 | ✓ Pass | b, c | Legend renders from `countyTiers.legend` with metric title/unit; "No records — outline only" row included. Runtime confirms legend matches rendered fills. |
| QA-14 | ✓ Pass | a, b | `countyTiers.legend.length === 0` → AlertCircle "No recorded counties to shade" note; `tierFor`→0 for all → no fills (`computeCountyTiers([])` test). |
| QA-15 | ✓ Pass | b, c | Single state-driven `<Popup>` keyed on `sel` shows name, state, species count, checklist count. Runtime confirms click→popup. |
| QA-16 | ✓ Pass | b, c | MapLibre fill is hit-tested at opacity 0; `selAgg` null → 0/0 + "No species recorded here yet." Runtime confirms click on an unshaded county. |
| QA-17 | ✓ Pass | a, b | `deriveCountyRegionCode` validates `^US-[A-Z]{2}-\d{3}$`, returns null → plain text; href is `${REGION_URL}${encodeURIComponent(selRegion)}` (tests cover valid + malformed). |
| QA-18 | ✓ Pass | b, c | Click handler short-circuits when `queryRenderedFeatures(point, {layers: ['sr-sight-circle','sr-hotspot']})` hits — mirrors atlas arbitration. Runtime confirms pin-over-county. |
| QA-19 | ✓ Pass | b, c | Keyboard "Counties in view" disclosure: real `<button>` header (`aria-expanded`) + `<button>` rows that `flyTo`+open the popup; capped at `MARKER_LIST_CAP` with over-cap hint. Runtime confirms keyboard operability/announcement. |
| QA-20 | ✓ Pass | b | `SegControl` Species/Records (shared component carries `aria-pressed`); `countyMetric` defaults `'species'`. |
| QA-21 | ✓ Pass | b, c | `countyTiers` recompute on `countyMetric`; legend uses `COUNTY_METRIC_META[metric]`; popup always shows both species + checklist counts. Runtime confirms re-tier/relabel. |
| QA-22 | ✓ Pass | a, b | `await import('../assets/us-counties.json')` on first enable; build shows it as a separate chunk; entryChunk test confirms it's not statically reachable. |
| QA-23 | ✓ Pass | a, b | Each feature carries `geoid` (5-digit FIPS); used as identity (dedup) and for the region link. |
| QA-24 | ✓ Pass | b, c | Overlay core (boundaries, counts, tiers, legend, popup numbers, in-view list) is genuinely zero-network; geometry is the app's own bundled chunk; join is client-side; popup makes no taxonomy fetch (favicons only when a code is already resolved). Fully functional offline (NFR-05). **Caveat:** the popup's top-location *link* classification reuses the pre-existing, app-wide `useHotspotSet` seam (cached `GET /map/hotspot-region`, an existing route, offline-degrading to plain text) — see Known Limitations. A definitive network trace is a runtime check. |
| QA-25 | ✓ Pass | b | `countyLoading` → spinner + "Loading county boundaries…" in the control, cleared in `finally`. |
| QA-26 | ✓ Pass | a, b, c | Geometry-anchored draw + independently-keyed aggregates → a data county with no bundled geometry is simply not drawn (no error); non-US rows get no join key (test). Statistics tables unchanged. Runtime confirms no error path. |
| QA-27 | ✓ Pass | a, b, c | Fills read `--sr-county-N` at runtime via `countyColor()`; MutationObserver re-resolves on `data-theme`; `countyContrast.test.ts` asserts monotonic light→dark ramp, ≥1.2:1 adjacent, legend text AA in BOTH themes, and `-rgb` triplets. Line color is the same hardcoded slate AtlasLayer ships (`rgba(71,85,105,0.85)` vs atlas `…,0.8)`) — basemap-anchored, FR-27 scopes the token rule to fills. Runtime confirms light/dark legibility. |
| QA-28 | ✓ Pass | b, c | Aggregates + tiers memoized on `phase`/`metric`; `filterObservations` reuses the parse-once observations; viewport-capped source. No `Date.now()`/`new Date()` in render — `react-hooks/purity` lint is green. Runtime confirms responsiveness on a ~20k-row backup. |
| QA-29 | ✓ Pass | a | Built county chunk = **317.74 KB gzipped** (≤ 400 KB). |
| QA-30 | ✓ Pass | a | `dist/index.html` modulepreload has no county/maplibre entry (grep + post-build test); static-import-graph test passes. |
| QA-31 | ✓ Pass | b | No backend changes (`git status`); frontend-only asset + client join; `useHotspotSet` uses the existing dual-transport `/map/hotspot-region` route — no new route/seam. |
| QA-32 | ✓ Pass | b, c | Control + legend live in the sidebar; in-view panel width `min(232px, 62vw)`; leaf truncation on names. Runtime at 320px / 200% text scale is the definitive check for no h-scroll leak. |
| QA-33 | ✓ Pass | a | `countyBoundaries.test.ts` (join + normalization + region guard + viewport cap), `countyShading.test.ts` (tiers: ties/small/zero-non-zero), `entryChunk.test.ts` (NFR-03) — all present and passing. |
| QA-34 | ✓ Pass | b | US Census Cartographic Boundary Files (public domain); attribution recorded in the asset's `source` field, the build-script header, and `docs/HELP.md`. |

**Totals: 34 Pass · 0 Partial · 0 Fail.**

## Edge Cases Tested

- **Two same-named counties in different states** (CA vs UT "Washington") — emit two distinct
  rows with their own per-state counts; the `computeGeo` re-key does not merge them
  (`birdingStats.test.ts` regression test + `countyShading.test.ts` parity test).
- **Quantile tier degeneracies** — ties collapse to fewer classes (no empty/duplicate
  ranges), small datasets (`[10,20]`→2 classes), all-equal (`[5,5,5]`→1 class), and
  zero-non-zero (`[]`→empty model, `tierFor` always 0) all covered.
- **Non-US / unresolved rows** — `countyKeyFromState('CA-ON', …)` (Ontario) returns null →
  never shaded; a malformed geoid → null region code → name renders as plain text.
- **Dateline-split boroughs** (Aleutians West) — two features share one geoid; the in-view
  list dedupes them to a single row anchored at the correct bbox centre.
- **Name normalization** — diacritics (Doña Ana), Saint/St., admin suffixes
  (County/Parish/Census Area/Borough), case, and whitespace all fold to one key.
- **Aggregation parity** — per-county species/records totals equal `computeGeo`'s for the
  same county (locks QA-09 to the existing Statistics data).

## Known Limitations

These are not blockers — they are honest observations and deploy-stage manual checks.

1. **Definitive runtime confirmation pending (deploy stage).** The interaction, visual,
   performance, and network-trace criteria (QA-01 draw, QA-05/06, QA-08 no-smear, QA-13
   legend↔fill match, QA-15/16/18/19 click + keyboard, QA-21 re-tier, QA-24 network trace,
   QA-26 no-error path, QA-27 light/dark legibility, QA-28 ~20k-row responsiveness, QA-32
   320px/200%-scale no h-scroll) are verified by code inspection against the proven atlas
   patterns; their pass conditions reference runtime/visual behavior that a headless QA run
   cannot exercise. Each should be eyeballed once in the running app at the deploy stage.

2. **Popup top-location links consume the shared hotspot-set seam.** This feature adds a
   `useHotspotSet()` call to `MapExplorer` (to decide whether a popup top-location renders
   as an eBird hotspot link vs plain text). That hook fires the **existing, cached**
   `GET /map/hotspot-region` route on mount. It is not a new provider, sends only the same
   region codes already sent app-wide by `HotspotLink`, degrades to plain text offline/uncached,
   and does not affect the popup's counts or the overlay's core data path (all zero-network).
   But strictly, a network trace taken right after enabling the overlay *could* show
   hotspot-region requests if no other tab pre-warmed the set — so the overlay's vicinity is
   not 100% request-free in every session. Worth the user knowing; not a privacy regression
   (no new outbound request type, so `PRIVACY_POLICY.md` correctly needs no change).

3. **Statistics filter divergence (by design).** The overlay always shows the countable
   life list (spuh/slash excluded, no date filter). If the user toggles "include spuh" or a
   date filter in the Statistics tab, that tab's per-county *species* counts can differ from
   the overlay's. The underlying join and default-state parity (QA-09) hold; this is the
   expected consequence of Statistics having user-adjustable filters the map overlay doesn't
   mirror.

## Convention Flags

- **GL layer line colors are a recurring hardcoded-RGB exception.** Both `AtlasLayer` and
  now `CountyLayer` hardcode a slate boundary line (`rgba(71,85,105,0.8/0.85)`) because
  MapLibre GL paint can't read CSS vars and the line is anchored to the always-light
  Positron basemap. This is consistent and defensible, but it is the second GL layer to do
  it. Consider documenting in `CLAUDE.md` that GL *boundary line* colors may be a fixed
  basemap-anchored literal (distinct from GL *fill* colors, which must still be read from
  `--sr-*` tokens at runtime), so a future reviewer doesn't flag it as a token violation —
  or, better, hoist the shared slate to a single `--sr-map-boundary-line` literal read at
  runtime like the fills. (Stage 9 applies the decision filter.)
