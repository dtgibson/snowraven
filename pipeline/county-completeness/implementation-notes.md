# Implementation Notes — County Completeness

**Feature:** county-completeness
**Stage:** 5 — The Engineer
**Version:** 0.5.54 (patch bump in `frontend/package.json` + `src-tauri/tauri.conf.json`)

---

## County Completeness (PR description)

### What this does
Adds **Completeness** as a third county-shading metric on the Map Explorer's
existing county overlay: each US county the user has birded is shaded by their
countable species recorded there divided by everything ever reported to eBird
for that county (all-time), on ten fixed 0–100% bands. The county popup gains a
progress bar ("X of Y species (Z%)"), the user's five newest new-in-county
species (backup-derived, works offline), and a five-species taxonomic-order
targets list; never-birded counties stay plain outlines with a one-click
"Load completeness" on-demand fetch. Per-county eBird results persist for 30
days via the storage seam; eager fetching is bounded to birded, in-view,
region-resolvable counties through a pool of four; offline / no-key /
server-error degrade through the app's standard three-state messaging.

### How to test
1. Backend: `cd backend && python -m pytest tests/test_map_router.py -v`
   (the six new `county_species` tests exercise the collapse, 401/422/502, and
   the empty list).
2. Frontend: `cd frontend && npx vitest run` — new suites:
   `countyCompleteness.test.ts` (band/percent boundary semantics, local
   derivation, targets, clamp), `countyCompletenessCache.test.ts` (TTL, dedupe,
   eviction, errors-never-cached, offline stale-read, persistence),
   `CountyLayer.test.tsx` (completeness branch + quantile-path parity),
   `CountyCompletenessUI.test.tsx` (popup variants + degraded states + legend).
3. Manually: see "Seeing County Completeness locally" below. To exercise the
   degraded states: remove the eBird key in Settings (no-key), throttle to
   offline in DevTools (offline), or point the key at garbage (eBird 4xx →
   server-error; errors are never cached — a re-click retries).

### Notes for reviewer
- **The Species/Checklists quantile path is byte-identical** (FR-06):
  `countyShading.ts` untouched; `CountyLayer` branches on
  `metric === 'completeness'` for tier + popup; the fill layer id stays
  `sr-county-fill` in every branch (heatmap re-order + desaturation wiring).
  A parity test locks that the count metrics never consult the completeness
  controller.
- **Comparability split per schema:** the Y-side collapse (reportAs → species
  parent, spuh/slash/hybrid dropped, first-seen dedupe) runs where the taxonomy
  snapshot already lives on each transport — `routers/taxonomy.py`
  `collapse_to_species_list` for web/Pi, `taxonomyService.collapseToSpeciesList`
  for desktop. Keep the two in lockstep (both carry lockstep comments).
- `/map/county-species` is deliberately **not** in `CACHED_GET_PATHS` — the
  30-day `countyCompletenessCache` is the single caching layer (schema decision
  #3). `/map` was already Vite-proxied; verified, no proxy change.
- Un-birded counties fetch via the popup's explicit **Load completeness**
  button (the approved Stage-4 design), not the bare county click; birded
  counties auto-fetch on popup open. QA-12 should be read against the button.
- The atlas mutual exclusion needed **no code change**: Completeness IS county
  shading, so `nextShadingState` covers it for free (FR-03).

---

## Seeing County Completeness locally

1. Open a terminal in your project folder.

2. Start the backend:
   `cd backend && uvicorn main:app --reload --port 1620`

3. In a second terminal, start the frontend:
   `cd frontend && npm run dev`
   (Or, for the desktop app: `npm run desktop:dev` from the project root —
   then skip step 4.)

4. Open your browser and go to: `http://localhost:5173`

5. You'll need your eBird backup loaded and your eBird API key saved (both
   under **Settings**) — the key is what Completeness uses to ask eBird for
   each county's species list.

6. Go to the **Map Explorer** tab and zoom the map to an area where you've
   birded (zoom in past the "Zoom in to see counties" hint).

7. In the left panel, turn on **County lines**, then turn on **Shade
   counties**, and pick **Completeness** in the Species / Checklists /
   Completeness switch. A note under the switch reminds you this metric needs
   a connection and your eBird key.

8. What to look for:
   - Counties you've birded shade in progressively (a few at a time) as eBird
     answers; the legend reads as fixed percentage bands, "1–10%" through
     "91–100%".
   - Click a shaded county: a progress bar with "X of Y species · Z%", a
     "Recently added" list of your newest county species with dates, and a
     "Top targets" chase list.
   - Click a county you've never birded: it stays a plain outline; press
     **Load completeness** for a one-county lookup ("0 of Y species · 0%" plus
     targets).
   - Pan away and back: no new eBird calls (each county is cached for 30
     days). Switch to Species or Checklists and back: the old shading is
     exactly as before.

---

## Convention Flags

- **Fixed-band metrics live PARALLEL to `computeCountyTiers`, never inside
  it.** A metric with absolute meaning (percent) supplies its own static band
  table + `band` per county and feeds the same tier property/tokens/textures;
  the quantile machinery stays untouched. Future absolute-scale map metrics
  should copy `COMPLETENESS_BANDS` / `completenessBand`, not extend the
  quantile code.
- **Long-TTL persistent network caches copy `replayStore`'s shape but with
  TTL-gated reads** (`countyCompletenessCache.ts`: storage-seam document,
  in-memory mirror, debounced whole-doc write, order[]-eviction, exported
  mutable caps for tests, in-flight dedupe Map, errors never cached, offline
  stale-read). Reuse this module's pattern for any future "cache live data for
  days" need instead of `networkCache` (90 s) or `replayStore` (live-first).
- **A map layer that needs per-feature live data takes a controller VIEW
  object** (render-safe `summaryFor`/`resultFor` + event-driven
  `onViewportCounties`/`requestCounty`), keeping the layer presentational and
  the fetch policy unit-testable in the hook. `CountyCompletenessView` in
  `lib/countyCompleteness.ts` is the reference shape.
- **Session-stable "now"**: both the hook and the popup use a module-level
  `SESSION_NOW_MS` for render-time day math and fromCache classification
  (the CLAUDE.md purity pattern), with real `Date.now()` only in
  handlers/effects.

## Known limitations

- **Targets are the OQ-01 floor:** the county species list in taxonomic order
  (waterfowl lead), not findability-ranked — the public eBird API has no
  all-time frequency product; the popup caption says "taxonomic order" and the
  design footnote flags ranking as a planned upgrade. The
  `completenessTargets` seam accepts a future ranked pool without a route
  change.
- **Eager-fetch failures don't auto-retry on later pans** (only a click
  retries, and errors are never cached). Meets FR-31's "at minimum on a
  subsequent click"; a reconnect-triggered retry sweep would be a clean
  follow-up.
- **On web/Pi, a device-offline condition surfaces as the backend's 502
  ("Could not reach the eBird API.")** — the server-error state with an honest
  detail — because the local FastAPI is still reachable. This matches the
  shipped overlays' behavior (hotspots/targets/lifers classify the same way);
  desktop classifies true connection-level failures as offline.
- **Y is only as fresh as the cache** (up to 30 days) and only as complete as
  eBird's spplist; a species recorded by the user but absent from eBird's
  county list still counts in X (clamped ≤ 100%).

## Schema deviations (recorded, not silent)

None functional. Two additive type-shape notes vs. schema.md's sketches:
- `CountyLocalCompleteness` gained `sciByName` (representative scientific name
  per countable name) so the batched `/taxonomy/codes` resolve is robust;
  `countableNames` is unchanged.
- `completenessTargets` subtracts by resolved species code AND normalized
  common name (schema specified code-only) — belt-and-braces so an unresolved
  code can never surface an already-recorded species (QA-18). Both are noted
  here per the Engineer-flags rule; neither changes the route contract, cache
  shape, band math, or any FR behavior.
- The controller hook lives at `lib/useCountyCompleteness.ts` (schema suggested
  `hooks/`); `lib/` is where the project's existing hooks live
  (`useHotspotSet.ts`).
