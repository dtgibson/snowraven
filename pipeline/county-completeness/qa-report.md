# QA Report — County Completeness

**Date:** 2026-07-02
**Test Runner:** vitest (frontend) + pytest (backend)
**Result:** PASSED

## Test Suite Results

| Suite | Result |
|---|---|
| Frontend (`npx vitest run`) | **1238 passing, 0 failing** (103 test files) |
| Backend (`python -m pytest tests/ -v`) | **163 passing, 0 failing** (includes the 6 new `/map/county-species` tests) |
| Lint (`npm run lint`) | Clean |
| Build (`npm run build` — `tsc -b` + vite) | Passed. Entry chunk `index-*.js` = 223.79 kB; no maplibre / county / completeness asset on first paint |
| Entry-chunk guard re-run against the fresh `dist/` | 7/7 passing (`entryChunk.test.ts`, including the new completeness assertions and the post-build `dist/index.html` modulepreload check) |

No retry rounds were needed. **Zero fixes applied** — the implementation passed as delivered.

## Acceptance Criteria Verification

Judged against the RATIFIED state (D-401 "Shade counties" rename, D-402 count-row retention, the approved Stage-4 "Load completeness" button for un-birded click-to-fetch, and the recorded additive schema deviations).

| Criterion | Result | Notes |
|---|---|---|
| QA-01 Metric switch offers Completeness (FR-01) | ✓ Pass | `SegControl` third option, `MapExplorer.tsx` ~1204; fixed-band shading via `tierForCounty` completeness branch (`CountyLayer.tsx`); Map Explorer only, US geometry only. |
| QA-02 Session-only state (FR-02) | ✓ Pass | `countyMetric` / `shadeByCounty` are plain `useState` (`MapExplorer.tsx:229-230`) — no storage seam writes for the choice. The persistent 30-day *data* cache is the OQ-05 ratified default, not shading state. |
| QA-03 Atlas mutual exclusion (FR-03) | ✓ Pass | `shadingExclusion.ts` untouched; Completeness IS county shading, so `nextShadingState` covers it with no code change. Boundary lines still coexist (line layers unchanged). |
| QA-04 Use Textures composition (FR-04) | ✓ Pass | Band 1–10 feeds the same `tier` property into the unchanged `fill-pattern` match arms (`CountyLayer.tsx:317-322`); legend uses `CountyDensitySwatch` per band; UI test "textures mode renders the density swatches". |
| QA-05 Active-shade behaviors (FR-05) | ✓ Pass | `shadingFillId`/`BasemapDesaturation` are driven by `shadeByCounty` (metric-agnostic, `MapExplorer.tsx:2149,2181`); fill layer id stays `sr-county-fill` in every branch — locked by `CountyLayer.test.tsx`. |
| QA-06 Metric round-trip (FR-06) | ✓ Pass | `countyShading.ts` untouched; quantile tiers computed only for count metrics; parity test proves the count metrics never consult the completeness view and paint from quantile tiers. Re-shade is state-driven paint, no map reload. |
| QA-07 Numerator correctness (FR-07, FR-12) | ✓ Pass | `countyCompleteness.test.ts`: spuh/slash/hybrid excluded, subspecies collapsed, two same-named counties in different states independent (composite key). |
| QA-08 Denominator comparability (FR-08, FR-09) | ✓ Pass | Backend test: issf/domestic fold via reportAs and dedupe; spuh/slash/hybrid drop; taxonomic order preserved. Desktop twin `collapseToSpeciesList` inspected line-for-line in lockstep (see Known Limitations re: twin test). |
| QA-09 Percentage clamp (FR-09, FR-10) | ✓ Pass | Unit tests + independent throwaway run (16/16): x>y → 100 never more; 299/300 → 99; 1/300 and 1/1000 → 1. |
| QA-10 Fixed bands (FR-11) | ✓ Pass | ~5% → band 1, ~95% → band 10, 1/300 visibly shaded; band from TRUE ratio; exactly-10% boundary stays in the lower band ((lo, hi] semantics, FP-epsilon-guarded). |
| QA-11 Bounded eager fetch (FR-13, FR-17, NFR-01) | ✓ Pass | `useCountyCompleteness.ts:171-190`: birded-only (`countableCount < 1` skip), region-resolvable-only, TTL-fresh skip, in-flight/queued dedupe, pool of 4 (`EAGER_FETCH_CONCURRENCY`); no bulk-fetch code path exists anywhere. `CountyLayer.test.tsx` locks the in-view handoff and the no-notify-while-shading-off case. |
| QA-12 Click-to-fetch (FR-14) | ✓ Pass | Judged against the ratified Stage-4 design: un-birded click opens Variant B; the explicit **Load completeness** button issues one deduped fetch → `role="status"` pending → "0 of Y species · 0%" + targets; county stays band 0 (unit test: "a 0-of-Y county stays band 0"). |
| QA-13 Cache reuse (FR-15, FR-16) | ✓ Pass | Cache tests: fresh entry short-circuits with NO loader call; two concurrent requests share one loader call; stale past 30 days refetches. Pan-back reuse = the same TTL short-circuit. |
| QA-14 Unresolvable region code (FR-18) | ✓ Pass | `deriveCountyRegionCode` null → skipped in eager fetch and `requestCounty`; status `no-region` → "eBird data isn't available for this county." (UI test); popup header falls back to plain text (`CountyLayer.tsx:351,362`) — no link. |
| QA-15 Dual-transport parity (FR-19, NFR-07) | ✓ Pass | `/map` prefix already proxied (`vite.config.ts:31`); `mapService.getCountySpecies` + `taxonomyService.collapseToSpeciesList` twins exist with identical payload/error shapes (422 malformed, 502 API error, 401-shaped no-key from `ebirdHeaders` classifying to the same `no-key` state). Verified structurally; live desktop run not performed in this pass (see Known Limitations). |
| QA-16 Popup completeness block (FR-20) | ✓ Pass | Progress bar + "X of Y species · Z%" + the labeling caption "Countable species — spuhs, slashes & hybrids don't count." (D-402: CountStat row retained, neither number accent-active). UI test covers bar value + text. |
| QA-17 Recent new species (FR-21) | ✓ Pass | First-in-county date, newest first, cap 5, dates rendered (`monthDay`); derived entirely from the backup (`buildCountyCompletenessLocal`); the block renders in every popup status, including offline/no-key (UI test). |
| QA-18 Targets list (FR-22) | ✓ Pass | Species-level pool (spuh/slash/hybrid can't appear); subtraction by resolved code AND normalized name (ratified belt-and-braces deviation); cap 5; taxonomic order. Unit tests cover both subtraction paths. |
| QA-19 BirdName conventions (FR-23) | ✓ Pass | Recent + targets render through `<BirdName>`; recent favicons from the batched `/taxonomy/codes` resolve (`codeFor`), target favicons from the eBird `speciesCode`; Species Detail link gated on `hasEntryFor` (UI test: in-backbone links, out-of-backbone plain). |
| QA-20 Partial popup (FR-24) | ✓ Pass | UI test: offline shows honest message + "You've recorded X countable species here" + the Recently added list — no blank section. |
| QA-21 Empty/unfetchable denominator (FR-25) | ✓ Pass | Empty list → y=0, no percent, band 0, explanatory note (backend + unit + UI tests); errors never cached (cache test) and the error state offers **Try again** → `requestCounty` clears the transient and relaunches. |
| QA-22 Other metrics untouched (FR-26) | ✓ Pass | Controller is `null` (hook inert, zero effects/fetches) unless the metric is Completeness (`MapExplorer.tsx` active gate + prop gate); popup keeps `CountyPopupTop` for count metrics; header name/state/region link shared by both branches. Parity test locks it. |
| QA-23 Percent legend (FR-27) | ✓ Pass | `CountyCompletenessLegend`: ten fixed "1–10%"…"91–100%" rows, "Completeness — % of the county list" title, dashed "Not birded / not fetched — outline only" entry, fixed-bands caption; density swatches in textures mode (both UI-tested). |
| QA-24 Keyboard parity (FR-28, NFR-04) | ✓ Pass | The existing keyboard "Counties in view" disclosure's value column shows "X/Y · Z%" when ready, else the honest label map (`COMPLETENESS_LIST_LABEL`: not fetched / no eBird data / offline / needs eBird key / eBird error / none on eBird / loading…). |
| QA-25 No-key state (FR-29) | ✓ Pass | Eager fetch requires `hasEbirdKey === true`; `requestCounty` blocks on `=== false`; sidebar shows the standard `OfflineMessage kind="no-key"` + `EBIRD_NO_KEY_MESSAGE`; popup shows the key icon + message (no Load button offered); cached counties still shade (seed from store is unconditional on activation). |
| QA-26 Offline state (FR-30) | ✓ Pass | `classifyLiveError` → offline status/message; fresh cache short-circuits; **stale + offline serves the stale copy for shading** (cache test); a failed fetch resolves the pending state to the offline message — no indefinite spinner (UI test). |
| QA-27 Server-error state (FR-31) | ✓ Pass | Backend 5xx/unreachable → 502 with distinct detail (2 backend tests); classified `error` with `role="alert"` + AlertTriangle, distinct from offline (wifi-off) and no-key (key icon); already-shaded counties keep their `ebirdByRegion` entry; retry via Try again without reload. |
| QA-28 Zero-county user (FR-32) | ✓ Pass | Empty local map → all counties band 0 (plain); the mode stays selectable; `requestCounty` does not require local data, so click-to-fetch scouting works. |
| QA-29 Pending visibility (FR-33) | ✓ Pass | `loading` status renders spinner + "Checking eBird for {county}…" (`role="status"`, UI test); eager results update `ebirdByRegion` → new view identity → `tierForCounty`/`fc` memos recompute → progressive shading (reactivity chain verified). |
| QA-30 Point-of-use disclosure (FR-34) | ✓ Pass | Info-icon note directly under the metric switch, rendered only while Completeness is selected: "…needs a network connection and your eBird API key. Counties you've fetched are cached for 30 days." (ratified D-placement). |
| QA-31 Docs updated (FR-35, FR-36) | ✓ Pass | `docs/HELP.md` (new County Completeness section + offline-support entry), `README.md` (Map Explorer bullet), `website/index.html` (feature copy + version pill/footer → 0.5.54), `PRIVACY_POLICY.md` eBird bullet now names the county species-list call explicitly. |
| QA-32 Entry chunk unchanged (NFR-02) | ✓ Pass | Fresh `npm run build`: no county/completeness/maplibre in the entry chunk or `dist/index.html` modulepreload (grep = 0 matches); `entryChunk.test.ts` extended with the four new modules and re-run post-build (7/7). |
| QA-33 Map responsiveness (NFR-03) | ✓ Pass | Re-shading reads in-memory state only (`summaryFor` is render-safe, no network in render); viewport windowing unchanged; `eagerRows` memo split from tier assignment so progressive-shading re-renders don't re-notify the controller. |
| QA-34 AA + aria (NFR-04, NFR-05) | ✓ Pass | `SegControl` carries `aria-pressed` (`MapSidebarUI.tsx:24`); progress bar has `role="progressbar"` + `aria-valuenow/min/max` + equivalent text; **zero new tokens** (`globals.css` untouched; hex/rgb grep over all four new files = clean); existing `countyContrast`/`countyTextures` guards pass in the suite. |
| QA-35 Security (NFR-09) | ✓ Pass | Backend `Query(pattern=…)` → 422 on malformed region (6-case test); desktop twin shape-guards + `encodeURIComponent`; popup region link only when `deriveCountyRegionCode` is non-null, else plain text; all popup content is escaped JSX through `<BirdName>`/text nodes — no HTML strings, no `dangerouslySetInnerHTML` in any new file. |
| QA-36 Privacy (NFR-06) | ✓ Pass | The only new call is `GET /map/county-species` → eBird `product/spplist` (backend) / `EBIRD_BASE` direct (desktop), authenticated with the user's own key, on demand; no new hosts anywhere in the diff; PRIVACY_POLICY.md updated. Verified by code inspection of the full change set. |

**Tally: 36 Pass · 0 Partial · 0 Fail.**

## Edge Cases Tested

- **Band boundaries (independent throwaway run, 16/16):** exactly 10% (30/300) stays band 1; 31/300 lands band 2; the FP-hazard `0.3` (3/10) lands band 3, not 4; 1/300 is shaded (band 1); ratio 1.0 and 1.2 both clamp to band 10; ratio 0 → band 0.
- **Percent extremes:** 299/300 (rounds to 100) displays 99; 1/1000 displays 1; x ≥ y displays exactly 100; 128/312 → 41.
- **Empty spplist:** backend returns `{speciesCount: 0, species: []}` (test); popup shows the explanatory note, no percentage; county unshaded.
- **Cache TTL expiry:** an entry past 30 days refetches (test); offline + stale serves the stale copy for shading; an HTTP error with a stale entry still rethrows (server errors never masked as cache hits).
- **Metric switch while a shade is active:** quantile tiers recompute only for count metrics; `nextShadingState` untouched, so atlas mutual exclusion is inherited with zero new code.
- **Use Textures + Completeness:** bands drive the same hatch sprite ids 1–10; legend density swatches match (`countyHatchSpec` single source).
- **Dark mode:** no new tokens exist to check (`globals.css` not in the diff); all four new files are 100 % `var(--sr-*)` (hex/rgb grep clean); the county ramp stays deliberately theme-identical (always-light basemap).
- **Desktop no-key parity:** `ebirdHeaders` throws a 401-shaped error → `classifyFetchError` → the same `no-key` state and message as the backend 401.
- **Fill-opacity-0 hit-testing:** band-0 counties keep `fill-opacity 0` but stay clickable — required for un-birded click-to-fetch, and preserved.
- **Eager-fetch convergence:** the notify effect refires on controller state updates, but fresh/queued/in-flight/failed regions are all skipped, so it converges (no fetch loop).

## Known Limitations

Carried from implementation-notes.md and confirmed accurate during QA; none are FR violations:

- **Targets are the OQ-01 floor** — taxonomic-order slice, not findability-ranked; the popup caption says so.
- **Eager-fetch failures don't auto-retry on later pans** — only a click retries (meets FR-31's "at minimum on a subsequent click").
- **On web/Pi a device-offline condition classifies as the backend's 502 server-error** (the local FastAPI is still reachable) — matches the shipped overlays' behavior; desktop classifies true offline.
- **Y freshness is bounded by the 30-day cache** and by eBird's spplist completeness; the ≤100 % clamp covers user species absent from eBird's list.
- **Two structural QA notes (not failures):** the desktop `collapseToSpeciesList` twin has no dedicated frontend unit test (semantics are locked by the backend fixture tests + lockstep comments), and the `useCountyCompleteness` hook's eager-fetch gating is verified by code inspection plus the CountyLayer handoff tests rather than a direct hook test.

## Convention Flags

- **Dual-transport collapse twins should share a fixture test.** `collapse_to_species_list` (Python) and `collapseToSpeciesList` (TS) are kept in lockstep by comments alone; a small shared JSON fixture (codes in → species out) asserted on both sides would make a drift fail the suite instead of a review. Same applies to any future twin that transforms data (not just proxies it).
- **Fetch-policy hooks deserve a direct unit test.** A controller hook whose whole job is gating (birded-only, TTL, concurrency bound, dedupe) can be tested with a mocked transport + `renderHook`; relying on the consuming layer's tests leaves the gates themselves inspection-only.
