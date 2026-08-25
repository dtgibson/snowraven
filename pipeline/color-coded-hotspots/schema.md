# Schema — Color-Coded Hotspots

**Feature:** color-coded-hotspots
**Date:** 2026-08-24
**Stage:** 3 — The Architect
**Source:** prd.md (approved, 27 FRs), strategic-brief.md

---

## Path

**Incremental** — extending the existing data layer.

### Assessment

This project has no relational store; its "data layer" is backend routes, their
Tauri service twins, parsers, and client caches. Mode 3 (community activity)
requires a **new dual-transport endpoint** and a **new durable storage-seam
cache document**, which is a genuine data-layer extension, not frontend-only.
Modes 1 and 2 are pure offline joins over the already-parsed backup (no new
reads, no new persistence), and would alone have classified frontend-only —
mode 3 is what settles the path.

| Question | Finding |
|---|---|
| New tables / columns / migrations? | None — no relational store exists. |
| New endpoint? | **Yes.** `GET /map/hotspot-activity` (FastAPI) + `mapService.getHotspotActivity` (Tauri twin), defined below. FR-09/NFR-09. |
| New persisted state? | **Yes.** One storage-seam cache document, `hotspot-activity-v1` (FR-15). Mode/window selection is explicitly session-only and NOT persisted (FR-02/NFR-08). |
| New data read? | Mode 3 reads eBird `data/obs/{locId}/recent` per public hotspot, bounded and cached. Modes 1/2 read nothing new (FR-07). |
| New derived data? | Per-locId personal stats (mode 1/2 values) and quantile tiers — React-lifetime memos, never persisted. |

---

## Current Data-Layer State (what exists, what this feature touches)

Cumulative state after this feature: everything below plus the **Added** section.

### Existing routes (all dual-transport, `backend/routers/map.py` ↔ `lib/tauri/mapService.ts`)

| Route | Params (web transport) | Caching | This feature |
|---|---|---|---|
| `GET /map/hotspots` | `lat: float, lng: float, dist: int` — bare (known unfixed Low finding; **not fixed here**, per instruction) | `CACHED_GET_PATHS` (~90s) | **Read-only dependency, unchanged.** The result set the modes color (FR-03, Out of Scope). |
| `GET /map/recent-obs` | `lat ge=-90 le=90`, `lng ge=-180 le=180`, `dist ge=1 le=200`, `codes` | backend 90s in-process + `CACHED_GET_PATHS` | **Unchanged.** Rejected as the mode-3 mechanism (see below). |
| `GET /map/hotspot-region` | `regionCode` pattern `^[A-Z]{2}(-[A-Z0-9]+){0,2}$` | `CACHED_GET_PATHS` | Unchanged. |
| `GET /map/county-species` | `regionCode` pattern `^US-[A-Z]{2}-[0-9]{3}$` | `countyCompletenessCache` (30-day durable; NOT in `CACHED_GET_PATHS`) | Unchanged. The structural precedent for the new route's cache/fetch policy (FR-11/NFR-05). |

### Existing client machinery reused verbatim

| Thing | Where | Reused for |
|---|---|---|
| `computeCountyTiers(nonZero, maxClasses)` | `lib/countyShading.ts:167` | The 5-class hotspot ramp — `maxClasses = 5`, exactly the Calendar precedent (FR-20). No new tier engine. |
| `isWithinWindow(dateStr, days, nowMs)` | `lib/nearbyLifers.ts:115` | The 7-day sub-window derivation — the SAME day-granular inclusive predicate the shared Time Range vocabulary already means by "Week" (FR-10/FR-16). |
| `isNonCountableForm` / `normalizeSpeciesName` | `lib/speciesUtils.ts` | Mode 1 countability (FR-05) — raw name into the predicate, normalized name into the distinct set, per the repo convention. |
| `countyCompletenessCache.ts` shape | `lib/countyCompletenessCache.ts` | The template for the new durable cache: mirror + debounced write + `order[]` + per-entry load validation + in-flight dedupe + errors-never-cached + offline stale-read. |
| `useCountyCompleteness` pool/queue/pump | `lib/useCountyCompleteness.ts` | The template for the new controller hook: pool of 4, ref-driven queue, `classifyLiveError` three-state degradation. |
| `classifyLiveError`, `OFFLINE_MESSAGE_SHORT`, `GENERIC_ERROR_MESSAGE` | `lib/offlineMessage.ts` | FR-14's three classified failure states. |
| `HotspotMarkers` sprite contract | `components/map/HotspotMarkers.tsx` | Unconditional `addImage` at effect time, theme `MutationObserver`, own-ids-only `styleimagemissing` net (NFR-03). |
| `obsLocationsByLocId` / `visitedLocIds` | `MapExplorer.tsx:749/754` | Unchanged — they keep feeding the default kind classification and the shipped popup. **Deliberately NOT the mode-1 value source** (see Design Decisions: the shipped `species` set is raw-name, uncountable-included; FR-05 requires a different computation). |
| `distanceMiles` | `lib/mapExplorerFormat.ts` | Proximity ordering of the fetch queue (FR-19). |

---

## The Mode-3 Mechanism (FR-09, FR-11, FR-16, FR-19 — the central decision)

**Chosen: one bounded eBird call per public hotspot in the result set —
`GET data/obs/{locId}/recent?back=30`, eBird's documented acceptance of a
location id as the region code.** The response is one record per species (its
most recent observation at that location within 30 days), which yields BOTH
windows from ONE call:

- **30-day count** = the number of distinct species records returned (eBird's
  own windowing is the definition).
- **Week count** = the records whose most-recent `obsDt` falls within the last
  7 days. This is exact, not an approximation: a species was reported within
  the last 7 days **iff** its most recent report is within the last 7 days
  (most-recent dominates every other date). Derived with the shared
  `isWithinWindow(obsDt, 7, nowMs)` so "Week" means the same thing here as on
  every other Map Explorer surface.

So Open Question 4 resolves **yes** by construction: one `back=30` fetch serves
both windows, and a Week ↔ 30-days switch is always zero requests (FR-16).

### Why not the alternatives

- **`data/obs/geo/recent` grouped by locId (the existing `/map/recent-obs`
  fetch): rejected for accuracy.** Verified against the shipped code and eBird's
  contract: that endpoint returns ONE record per species — its most recent
  across the WHOLE radius — so a species seen at ten hotspots this week appears
  at exactly one of them. Grouping by locId systematically undercounts every
  hotspot, worst exactly where activity is highest. One cheap call producing
  numbers that are confidently wrong fails FR-09's "number of species reported
  at that hotspot" outright. (The backend's `(speciesCode, locId)` grouping in
  `/map/recent-obs` is tolerant plumbing, not evidence of per-location
  completeness — the input stream itself is one-record-per-species.)
- **`product/spplist/{locId}` (the County Completeness product): rejected** — 
  all-time species list, no time window; FR-10's whole point is recency.
- **`ref/hotspot/info/{locId}`: rejected** — `numSpeciesAllTime` +
  `latestObsDt` only; no windowed count.
- **Per-day `product/stats`: rejected** — 7–30 calls per hotspot; strictly
  worse than one.

### Call-volume envelope (worst case at the cap)

- **Per result set:** at most `min(publicHotspots, 200)` network calls
  (FR-19's cap, default 200 kept), pool of 4 concurrent (NFR-05), each fired
  once — the durable cache then answers for 6 hours, so a re-search of the same
  area inside the TTL costs only the locIds not yet cached (typically ~0).
- **Per call:** one record per species. A pathologically active hotspot
  (~300 species in 30 days) is roughly 75 KB of JSON; typical hotspots return
  20–60 records. Reduced server-side to `{speciesCode, obsDt}` pairs
  (~30 bytes/species) before it crosses to the client on the web transport.
- **Window switch:** 0 calls (both windows from one entry). **Pan/zoom:** 0
  calls (fetch is result-set-scoped, never viewport-scoped — FR-11).
  **Mode 1/2/default selection:** 0 calls in any form (FR-07).
- **The 30-day `back` ceiling** is eBird's documented maximum, which is exactly
  the PRD's larger window — the mechanism and FR-10's windows are mutually
  consistent with no truncation.
- `includeProvisional` is left at eBird's default (false), matching the
  existing `/map/recent-obs` posture, so the app carries ONE definition of
  "recent observations."

---

## Changes in This Feature

### Added

1. `GET /map/hotspot-activity` — new FastAPI route (`backend/routers/map.py`).
2. `getHotspotActivity(locId)` — new Tauri twin (`lib/tauri/mapService.ts`) +
   its `TauriTransport` dispatch arm in `transport.ts` (with the NOT-in-
   `CACHED_GET_PATHS` comment, same as `/map/county-species`).
3. `frontend/src/lib/hotspotActivity.ts` — NEW pure module: payload shape,
   locId guard regex (single source), reduction + counting functions.
4. `frontend/src/lib/hotspotActivityCache.ts` — NEW durable storage-seam cache
   (`hotspot-activity-v1`), 6h TTL, FIFO, per-entry validation.
5. `frontend/src/lib/useHotspotActivity.ts` — NEW controller hook (bounded
   fetch pool, in-flight dedupe, cap, classified degradation, render-safe view).
6. `frontend/src/lib/hotspotColorModes.ts` — NEW pure module: mode/window
   types, personal per-locId stats, ramp classing, per-pin reading resolution,
   legend model.
7. `--sr-hotspot-1..5` (+`-rgb`) ramp tokens and `--sr-hotspot-nodata` /
   `--sr-hotspot-zero` / `--sr-hotspot-unanswered` (+`-rgb`) state tokens, both
   theme blocks of `globals.css`, guarded by a new `hotspotContrast.test.ts`.
8. Component wiring: mode selector + window control + retry + legend/popup/list
   content in `MapExplorer.tsx` / `MapSidebarUI.tsx`; mode sprite baking + a
   `cls` feature property + mode `icon-image` expression in
   `HotspotMarkers.tsx` / `lib/mapPins.ts`.
9. Fixture `frontend/src/lib/hotspotActivity.fixture.json` + parity tests on
   both transports (NFR-09).

### Modified

- `HotspotMarkers.tsx` — additive props (`reading`, mode-active flag); the
  default-mode render path must remain byte-identical (FR-03, NFR-10 regression
  guard). Risk: low; the layer's default `icon-image` expression and the
  `key={hotspotPins.length}` call-site contract are untouched.
- `lib/mapPins.ts` — additive sprite-id table + baking variant for mode states.
  The existing `HOTSPOT_IMAGE_ID` trio and `teardropImageData` outputs are
  untouched.
- `lib/mapExplorerTypes.ts` — additive exported types (`HotspotColorMode`,
  `ActivityWindow`).

### Unchanged (used, not modified)

- `GET /map/hotspots` — the fetch, its bare params (the known Low finding is
  deliberately NOT silently fixed here; it stays on ROADMAP), its result shape,
  `CACHED_GET_PATHS` membership, and `handleFindHotspots`' pin construction
  (FR-03, FR-18, Out of Scope).
- County and atlas overlays, `nextShadingState` mutual exclusion,
  `BasemapDesaturation` (FR-27) — the hotspot color mode never enters
  `nextShadingState` and never triggers desaturation.
- The GL sprite machinery's existing visited/unvisited/personal path, the
  legend kind filters (`hiddenKinds` GL filter, FR-23), popup shipped content
  (FR-25), `key={hotspotPins.length}` remount contract, `autoFit` /
  `framedByViewport` (FR-18, v0.5.91 no-reframe rule).
- `CACHED_GET_PATHS` membership rules — the new route joins the durable-cache
  family (`/map/county-species` precedent) and stays OUT of it.
- `vite.config.ts` proxy — `/map` prefix already proxied; the new route rides
  it (verified against the shipped proxy table; no edit needed, and the
  Engineer should confirm the dev-path call succeeds rather than trusting this
  sentence).
- The storage seam itself, `obsLocationsByLocId` / `visitedLocIds`, and every
  other Map Explorer view (FR-04).

---

## Route Definition (FR-09, NFR-05, NFR-06, NFR-09)

### `GET /map/hotspot-activity` — `backend/routers/map.py`

```python
@router.get("/map/hotspot-activity")
async def get_hotspot_activity(
    locId: str = Query(..., min_length=2, max_length=11, pattern=r"^L[0-9]{1,10}$"),
):
    """Recent community activity for ONE public hotspot: eBird
    data/obs/{locId}/recent with back=30 (eBird accepts a locId as the region
    code — the same accepts-a-narrow-region pattern county-species uses with
    product/spplist). Response is reduced to one (speciesCode, obsDt) pair per
    species — the most recent report of each — from which the client derives
    both the 30-day and 7-day counts (one call serves both windows).

    SSRF: the only interpolated value is locId, constrained to ^L[0-9]{1,10}$ —
    a character class that cannot express a scheme, host, credential, '?', '@',
    or path separator, so the destination cannot be steered; quote(locId,
    safe='') is belt-and-braces. `back` is a fixed literal (no numeric params
    at all). The shared client does not follow redirects, and the upstream body
    is reduced, never reflected. Desktop twin: mapService.getHotspotActivity —
    keep both in lockstep (shared fixture parity test). Deliberately NOT in the
    frontend's CACHED_GET_PATHS: the 6-hour persistent hotspotActivityCache is
    the single caching layer for this route."""
```

- **Param bounds, exactly:** `locId` — required, `min_length=2`,
  `max_length=11`, `pattern=r"^L[0-9]{1,10}$"`. Explicit `[0-9]`, never `\d`
  (pydantic Rust-regex twinning rule). `pattern=` is the documented carve-out:
  the Rust engine rejects a trailing newline itself, so do NOT "fix" it toward
  `fullmatch`. There are no numeric query params — `back=30` and `fmt=json` are
  server-side literals, which satisfies the bounded-numeric-params rule by
  having none.
- **Outbound call:** `client = get_client()` (the shared pooled client — never
  a per-call `AsyncClient`), `GET f"{_EBIRD_BASE}/data/obs/{quote(locId, safe='')}/recent"`,
  `params={"back": 30, "fmt": "json"}`, `headers={"X-eBirdApiToken": key}`
  from `_api_key()` (401 when unset — the FR-14 no-key state), `timeout=10.0`.
- **Error mapping:** identical to siblings — `HTTPStatusError` → 502
  `"eBird API error: {status}"`, `RequestError` → 502
  `"Could not reach the eBird API."`. Errors produce no cache entry anywhere.
- **Reduction (the response contract):**
  ```json
  { "locId": "L123456", "species": [ { "speciesCode": "amecro", "obsDt": "2026-08-22 07:10" } ] }
  ```
  Keep a record only when `speciesCode` and `obsDt` are both non-empty
  strings; dedupe by `speciesCode` keeping the lexicographically greatest
  `obsDt` (ISO-style dates compare correctly as strings — the documented
  `/map/recent-obs` reasoning). Nothing else from the upstream body crosses.
- **No backend in-process cache** (unlike `/map/recent-obs`): one caching layer
  per call, and the durable client cache owns this one (FR-15d).

### `mapService.getHotspotActivity` — `lib/tauri/mapService.ts` (lockstep twin)

```ts
export async function getHotspotActivity(locId: string): Promise<HotspotActivityPayload>
```

- Validates with the SAME compiled guard, single-sourced as
  `HOTSPOT_ACTIVITY_LOC_ID_RE = /^L[0-9]{1,10}$/` in `lib/hotspotActivity.ts`
  (JS `$` does not match before a trailing newline — the anchor-parity rule is
  satisfied on both sides by construction). Rejects with the same
  invalid-argument error shape the sibling services use.
- Fetches `https://api.ebird.org/v2/data/obs/${encodeURIComponent(locId)}/recent?back=30&fmt=json`
  with the stored eBird key; applies the IDENTICAL reduction + dedupe.
- **Parity test (QA-34):** `hotspotActivity.fixture.json` carries (a) a raw
  eBird response array → expected reduced payload (including a duplicate
  species with out-of-order dates, a record missing `speciesCode`, a
  non-string `obsDt`), and (b) id-validation rows both sides must agree on:
  `L123456` ✓, `L1` ✓, `L` + 10 digits ✓ (upper bound), `L` + 11 digits ✗,
  `L` ✗, `l123` ✗, `123` ✗, `L12x3` ✗, `"L123\n"` ✗ (trailing newline),
  `"L٠١٢"` ✗ (non-ASCII digits), `"L123/../x"` ✗, `""` ✗.
  Backend route test + vitest both drive the same fixture file.
- **Guard scope note:** the shipped `LOCATION_ID_RE = /^L\d+$/` (HotspotLink's
  link gate) is a different guard for a different question and is NOT touched;
  the new guard is length-bounded per the v0.5.90 length-bounding precedent. A
  hypothetical 11+-digit locId from `ref/hotspot/geo` would fail the new guard
  and render permanently `unanswered` — accepted, stated here rather than
  discovered.

---

## The Durable Cache — `lib/hotspotActivityCache.ts` (FR-15, NFR-05)

**Pattern:** the `countyCompletenessCache` storage-seam document, chosen over a
transient in-memory map because FR-15(b) makes offline stale-reads part of the
contract ("previously fetched values still render... cached rather than
current") and QA-16 tests it across a reload — an in-memory cache cannot honor
that. Chosen over `CACHED_GET_PATHS` (90s is the wrong lifetime) and
`replayStore` (live-first semantics would refetch inside the TTL).

```ts
export const HOTSPOT_ACTIVITY_TTL_MS = 6 * 60 * 60 * 1000   // OQ-1 default: 6h, kept
export const HOTSPOT_ACTIVITY_STORE_KEY = 'hotspot-activity-v1'
export let HOTSPOT_ACTIVITY_MAX_ENTRIES = 2000              // + test seam setter

export interface HotspotActivityCacheEntry {
  /** Distinct species in eBird's back=30 window, as returned. */
  count30: number
  /** Subset whose most recent obsDt was within 7 days OF THE FETCH (isWithinWindow(obsDt, 7, fetchedAt)). */
  count7: number
  /** ms epoch — TTL anchor and the popup's as-of time. */
  fetchedAt: number
}

export interface HotspotActivityStore {
  version: 1
  /** Keyed by locId — every key satisfies ^L[0-9]{1,10}$. */
  entries: Record<string, HotspotActivityCacheEntry>
  /** Oldest-fetched → newest (FIFO eviction order). */
  order: string[]
}
```

- **What is cached: the two counts, not the species list.** Computed at fetch
  time against `Date.now()` taken in the promise handler (never render). The
  entry is a fixed shape of three finite numbers — validation is trivial, the
  window switch is a field read, and FR-16's "no re-ask when held data serves
  both windows" is satisfied by construction. The cost is that `count7`'s
  boundary is frozen at fetch time; within a 6h TTL that is at most 6h of
  boundary drift, and FR-25's as-of wording ("cached, as of {time}") is the
  honest reading either way. (Caching the per-species date list instead would
  buy back that drift at ~50x the entry size and a per-render recount; not
  worth it — recorded as a decision, below.)
- **Cap policy: FIFO at 2,000 entries, entry-count only.** Choice follows what
  an eviction costs: one redundant eBird call for a hotspot the user scrolls
  back to — the cheap-eviction case where FIFO is correct and admission control
  would be wrong (an admission-closed cache could never take on a new area's
  hotspots once full; capacity+1 is a measurement rule, not a policy). The
  bound is stated STRUCTURALLY, not as bytes: ≤2,000 entries, each a key of
  ≤11 chars (guarded by the key regex on load) plus exactly three finite
  numbers — no unbounded string exists anywhere in the document, so no
  `JSON.stringify` payload budget is needed or wanted (a byte product would
  encode an engine's accounting; the entry-count × bounded-shape statement
  cannot go false silently). 2,000 ≈ ten full 200-cap result sets.
- **Load-path validation (per-entry, malformed dropped, never thrown):**
  document not an object / bad `entries` / non-array `order` → empty store;
  per key: must match `^L[0-9]{1,10}$`, dedupe on `order`, entry must be an
  object with three finite numbers (`count30 ≥ 0`, `count7 ≥ 0`,
  `count7 ≤ count30`, `fetchedAt` finite) — anything else is dropped and that
  hotspot simply refetches.
- **Mechanics copied from `countyCompletenessCache`:** one-disk-read-per-session
  mirror (`ensureLoaded`), `loadAll()` snapshot returning fresh AND stale
  entries (stale still renders offline — FR-15b), debounced 250ms whole-document
  `storage.setSetting` write, `dedupedFetch(locId, loader)` chokepoint: fresh
  hit → no network; miss/stale → loader, deduped in flight per locId; loader
  failure while offline with a stale entry → serve stale
  (`fromNetwork: false`); any other failure → rethrow, cache nothing
  (errors never cached — FR-15c, QA-14). Test seams mirror the county cache's
  (`_reset...ForTests`, cap setters).

---

## The Controller — `lib/useHotspotActivity.ts` (FR-11, FR-12, FR-14, FR-17, FR-19, NFR-05)

Modeled on `useCountyCompleteness`, with one structural difference: the work
unit is a **result-set pass**, not a viewport event stream — hotspot activity
is scoped to the search's result set (FR-11), so pan/zoom NEVER enqueues
anything (QA-10).

```ts
export const ACTIVITY_FETCH_CONCURRENCY = 4          // NFR-05, county pool precedent
export const ACTIVITY_FETCH_CAP = 200                // FR-19 / OQ-3 default, kept

export interface UseHotspotActivityArgs {
  /** mode 3 selected AND hotspots view AND result set non-empty AND backup phase irrelevant (community data). */
  active: boolean
  /** The UNFILTERED result set (public pins only are fetched; personal are skipped — FR-21). */
  pins: HotspotPin[]
  /** For in-view-first ordering at pass start (FR-19). */
  mapBounds: MarkerBounds | null
  /** The search record's centre for proximity ordering (FR-19); null → skip that tiebreak. */
  searchCenter: { lat: number; lng: number } | null
  hasEbirdKey: boolean | null
}

export interface HotspotActivityView {
  /** Render-safe. null = unanswered (not asked / in flight / failed / beyond cap). */
  countFor(locId: string): { count7: number; count30: number; fetchedAt: number; fromCache: boolean } | null
  /** Panel-level status for FR-12's loading line, FR-14's classified error, FR-19's cap sentence. */
  status: {
    phase: 'idle' | 'running' | 'done'
    answered: number
    target: number            // public pins this pass will answer (≤ cap accounting below)
    capped: boolean           // some public pins were left unanswered by the cap
    error: { kind: 'offline' | 'no-key' | 'error'; message: string } | null
  }
  /** FR-14: re-asks every failed/unanswered locId without re-running the hotspot search. */
  retry(): void
}
```

Behavioral contract, in the order things happen:

1. **Seed:** on first activation, `loadAll()` the persistent store into a
   `Map<locId, entry>` state — cached answers (fresh AND stale) color pins
   before any network activity (FR-12 "cached answers render immediately",
   FR-15a). Entries with `fetchedAt < SESSION_NOW_MS` report
   `fromCache: true` (the county `SESSION_NOW_MS` pattern) for FR-25's as-of
   wording.
2. **Pass start** (activation, or `pins` identity change while active):
   increment a generation ref; enumerate `pins` where `kind !== 'personal'`
   (FR-21) and locId passes `HOTSPOT_ACTIVITY_LOC_ID_RE`; drop locIds with a
   FRESH cache entry (they are already answered at zero cost — cache hits do
   not consume the cap); order the remainder **in-view first** (inside
   `mapBounds` at pass start), then ascending `distanceMiles` to
   `searchCenter`; truncate to `ACTIVITY_FETCH_CAP`; the truncated remainder
   is `capped: true` and stays unanswered with the panel saying so in words
   (FR-19, QA-20).
3. **Pump:** ref-driven queue + pool of 4 (`launch`/`pump` per the county
   hook), each launch through `hotspotActivityCache.dedupedFetch(locId, () =>
   transport.get('/map/hotspot-activity', { locId }))`, then
   `computeActivityCounts(payload.species, Date.now())` in the promise handler
   and `putEntry` — the cache stores counts, the hook mirrors them into state,
   the pin recolors on that render (FR-12 progressive).
4. **Failure:** classify via `classifyLiveError` + the county
   `classifyFetchError` shape into exactly three kinds — offline / no-key
   (401) / error (FR-14, QA-13). First failure sets `status.error`; a
   `no-key` or `offline` classification also drains the queue (stop starting
   requests that must fail identically); already-answered pins keep their
   colors; failed locIds carry no cache entry, so `retry()` re-enqueues
   exactly the unanswered remainder and pumps (QA-13/QA-14).
5. **Deactivation mid-flight** (mode switch away, view switch, tab hide):
   `active` goes false → the pump gate stops new launches; in-flight responses
   complete into the **cache** (useful later) but state writes are
   generation-guarded, so they never touch the now-active mode's coloring
   (FR-17, QA-18). Reactivation reuses everything cached and enqueues only the
   missing remainder.
6. **Window switch:** not visible to this hook at all — both windows read the
   same entry (FR-16, QA-17: zero requests).
7. **Zero-request invariants:** `active === false` → no request in any form
   (FR-07); empty result set → `target: 0`, no request (FR-11); pan/zoom →
   nothing (no viewport subscription exists in the hook — structural, not
   disciplined).

---

## Pure Classification — `lib/hotspotColorModes.ts` (FR-05, FR-06, FR-08, FR-13, FR-20, FR-21)

No React, no map, no clock, no I/O (every `nowMs` is a parameter).

```ts
/** Label-agnostic semantic values (the repo's toggle-state rule). */
export type HotspotColorMode = 'default' | 'mySpecies' | 'myChecklists' | 'activity'
/** Window in days — numbers, so no label can leak into state. */
export type ActivityWindow = 7 | 30

export const HOTSPOT_CLASS_COUNT = 5    // OQ-2 default, kept

/** FR-05/FR-06: one O(n) pass over the parsed observations. */
export interface HotspotPersonalStats { species: number; checklists: number }
export function buildHotspotPersonalStats(
  observations: ObservationEntry[],
): Map<string, HotspotPersonalStats>

/** FR-20: quantile tiers over the CURRENT result set's nonzero active-mode values. */
export function computeHotspotTiers(nonZeroValues: number[]): CountyTiers
// = computeCountyTiers(nonZeroValues, HOTSPOT_CLASS_COUNT) — the Calendar maxClasses=5 precedent.

/** The per-pin answer every surface renders from (pin fill, popup, in-view list, legend states). */
export type HotspotReading =
  | { state: 'ramp'; tier: number; value: number; window?: ActivityWindow; fromCache?: boolean; fetchedAt?: number }
  | { state: 'zero'; value: 0 }                    // modes 1/2: visited, value 0 (FR-08)
  | { state: 'noData' }                            // modes 1/2: never birded by me (FR-08)
  | { state: 'quiet'; window: ActivityWindow; fromCache?: boolean; fetchedAt?: number }  // mode 3: answered 0 (FR-13)
  | { state: 'unanswered' }                        // mode 3: not asked / in flight / failed / beyond cap (FR-12)
  | { state: 'personal' }                          // FR-21: never joins a ramp
  | { state: 'default' }                           // mode 'default': shipped rendering

export function hotspotReading(
  pin: HotspotPin,
  mode: HotspotColorMode,
  window: ActivityWindow,
  tiers: CountyTiers,
  personal: Map<string, HotspotPersonalStats> | null,
  activityFor: (locId: string) => { count7: number; count30: number; fetchedAt: number; fromCache: boolean } | null,
): HotspotReading

/** FR-24: legend rows derived from the SAME tiers object the layer paints from (NFR-10 parity). */
export function hotspotLegendModel(
  mode: HotspotColorMode, window: ActivityWindow, tiers: CountyTiers,
  statesInEffect: { noData: boolean; zero: boolean; quiet: boolean; unanswered: boolean },
): { classes: { tier: number; min: number; max: number }[]; states: ...; modeLabelKey: ... }
```

- **`buildHotspotPersonalStats` (FR-05/FR-06):** per `locationId`, a species
  Set and a submissionId Set. Species: skip rows where
  `isNonCountableForm(o.commonName)` (RAW name, trailing parenthetical intact —
  the repo convention), add `normalizeSpeciesName(o.commonName)` (subspecies
  fold). Escapee provenance deliberately NOT applied (FR-05 / OQ-5 default
  stands: this surface does not headline a life-list count, and the passive-
  reader import-graph guard must stay true — this module gains no transport
  edge). Checklists: distinct `submissionId` count — all checklist types, since
  the export carries no type distinction to filter on (FR-06's "incidental and
  incomplete included" is free). One pass builds both.
  **This is deliberately NOT `obsLocationsByLocId.species.size`** — the shipped
  set adds raw names with no countable rule (spuhs and forms inflate it), which
  is fine for the shipped popup line it feeds but fails FR-05/QA-04. The two
  numbers will legitimately differ on the same popup; the mode value is
  labeled, the shipped line stays as shipped.
- **Tier input per mode (FR-20):** mode 1/2 — nonzero personal values of the
  current result set's public pins (available synchronously, so classing is
  complete on the first render); mode 3 — nonzero answered counts for the
  ACTIVE window. Quantile breaks recompute whenever the result set, mode,
  window, or (mode 3) the answered set changes — progressive arrivals reshape
  the breaks, which is FR-20's "computed over the current result set" read
  honestly while answers accumulate. Fewer distinct values → fewer classes
  (`computeCountyTiers` already guarantees it — QA-21's two-value case).
- **State resolution order** (each state mutually exclusive by construction):
  `personal` (kind) → mode: default → mode 1/2: no backup rows for locId →
  `noData`; value 0 → `zero`; else `ramp` — mode 3: answer present ? (count 0
  → `quiet` : `ramp`) : `unanswered`. "No data" and "zero" are distinct
  answers and neither can occupy the lowest band (FR-08); "quiet" and
  "unanswered" never share a reading (FR-13) — the type makes the distinction
  unrepresentable rather than remembered.

---

## GL Paint, Sprites, and Tokens (FR-22, FR-27, NFR-01–NFR-04)

### Mechanism (in `HotspotMarkers.tsx` + `lib/mapPins.ts`)

- The feature collection memo gains a `cls` property per feature — the
  reading's paint class (`t1..t5`, `zero`, `nodata`, `quiet`, `unanswered`,
  `personal`, or absent in default mode). Mode active → the symbol layer's
  `icon-image` becomes a `match` on `['get', 'cls']` over a new
  `HOTSPOT_MODE_IMAGE_ID` table; **default mode → the shipped expression,
  byte-identical** (the NFR-10 regression guard asserts the default-mode
  layout object deep-equals the shipped one).
- **Mode, window, and readings are PROPS — never folded into the marker
  set's remount `key`** (`key={hotspotPins.length}` is unchanged). A mode
  switch is a cosmetic in-place re-render: no remount, no re-fit, no popup
  dismissal (NFR-04, the v0.5.59 markerMode rule).
- **Sprites:** baked `ImageData` variants of the existing teardrop, one per
  (paint class × kind-glyph) pairing — bounded at 16 mode sprites (5 tiers × 2
  kinds, quiet × 2, unanswered × 2, nodata [unvisited-only by construction],
  zero [visited-only by construction]) beside the 3 shipped ones. FR-22's
  visited/unvisited non-color channel rides the glyph baked into the sprite
  (final glyph treatment is the Designer's; the id table and count are fixed
  here so the machinery is bounded). Registration follows the shipped contract
  verbatim: unconditional `addImage`/`updateImage` at effect time — **never an
  `isStyleLoaded()` gate** — theme `MutationObserver` re-bake, and the
  `styleimagemissing` net extended through a reverse lookup that answers ONLY
  the component's own hardcoded ids (foreign ids ignored), exactly
  `hotspotKindForImage`'s pattern (NFR-03).
- SDF + `icon-color` was considered and rejected: it would replace the shipped
  default sprite path (multi-color ImageData is not SDF-colorizable), putting
  FR-03's byte-identical default at risk for no capability the baked variants
  lack.

### Token family (NFR-01, NFR-02, FR-27)

- **Ramp:** `--sr-hotspot-1` … `--sr-hotspot-5` + `--sr-hotspot-N-rgb`, both
  `:root` and `[data-theme="dark"]`. Recommended hue family: **cyan-blue**
  (teal-leaning) — distinct from the county green, the atlas purple, and the
  personal-star orange that co-renders on this view; it may resemble the
  shipped unvisited blue without conflict because mode fills REPLACE kind
  fills (the kind survives as glyph, FR-22). Final values are the Designer's
  within the guard's floors.
- **States:** `--sr-hotspot-nodata`, `--sr-hotspot-zero`,
  `--sr-hotspot-unanswered` (+`-rgb`, both themes). `zero` (modes 1/2) and
  `quiet` (mode 3) SHARE the `--sr-hotspot-zero` token — they are the same
  semantic answer ("asked, and the answer is zero"), can never co-occur
  (different modes), and carry distinct popup/legend wording; minting two
  visually-identical tokens would be a name that lies. Flagged for the
  Designer to confirm or split.
- **Guard — `frontend/src/lib/hotspotContrast.test.ts` (QA-29/QA-30):** parses
  the real `globals.css` (the `countyContrast` posture), asserts for BOTH
  themes: every ramp/state token + `-rgb` twin present in both blocks; ramp
  luminance strictly monotonic (grayscale-readable, NFR-02); adjacent ramp
  steps ≥1.2:1 (the county floor); every ramp AND state fill ≥3:1 against the
  basemap land tints — computed against the exported `TINT_*` constants in
  `lib/mapStyle.ts` (`TINT_GRASS` is the palest and is the binding case), the
  documented `--sr-map-pin-*` practice; and the three state tokens pairwise
  ≥1.2:1 from each other and from ramp step 1 (off-ramp states distinguishable
  by more than hue, NFR-02). No text rides the fill, so the 4.5:1 rule stays
  dormant (stated in the test so a future number-on-pin change trips over it).

---

## Component State Model (FR-01, FR-02, FR-04, NFR-07, NFR-08)

In `MapExplorer.tsx` — plain session `useState`, the Point Size convention:

```ts
const [hotspotColorMode, setHotspotColorMode] = useState<HotspotColorMode>('default')  // FR-02
const [activityWindow, setActivityWindow] = useState<ActivityWindow>(7)                // FR-10 default Week
```

- Never persisted, no storage-seam write (QA-02 asserts none at the seam);
  survives tab switches because the tab stays mounted; house phrasing
  "per-session, resetting on relaunch" in any prose.
- Selector renders on the Hotspots view only (FR-01/FR-04); window control
  only while mode 3 active (FR-10); both inside the existing sidebar filter
  block under `.sr-ctl-row` / `.sr-touch-target` / `.sr-input-16` posture
  (NFR-07 — control form and labels are the Designer's; the four option
  MEANINGS and two window meanings are fixed).
- `useHotspotActivity({ active: viewMode === 'hotspots' && hotspotColorMode === 'activity' && hotspotPins.length > 0, ... })`.
- `buildHotspotPersonalStats` memoized over `phase.observations` (one O(n)
  pass beside the existing `obsLocationsByLocId` memo).
- Legend (FR-24), popup additions (FR-25), and the "Hotspots in view" list
  values (FR-26) all render from the SAME `hotspotReading` calls the layer
  paints from — the legend-cannot-drift parity (NFR-10) is one source, not a
  test-time reconciliation. FR-18 needs no new work: a re-search replaces
  `hotspotPins`, the readings recompute, and the hook runs a new pass
  cache-first; `autoFit`/`framedByViewport` semantics are untouched.

---

## Edge Cases, End to End

**No-data vs zero (FR-08, QA-07):** distinct at every layer — the type
(`noData` vs `zero` are different variants), the sprite (`nodata` uses the
unvisited glyph + nodata token; `zero` the visited glyph + zero token), the
popup ("You have not birded this hotspot." vs "0 countable species here." —
final copy Designer's, meanings fixed), the in-view list, and the legend
(both rows present only when in effect). Neither can reach the ramp: the
classifier never passes 0 to `tierFor`, and `computeCountyTiers` maps 0 to
tier 0 anyway (two independent locks).

**Quiet vs unanswered (FR-13, QA-12):** `quiet` requires an ANSWER
(`countFor` non-null, count 0); `unanswered` is the absence of one. A failed
fetch leaves no cache entry and no answer → `unanswered` + the classified
panel error, never `quiet`. The two states use different tokens
(`--sr-hotspot-zero` vs `--sr-hotspot-unanswered`), different wording, and
the guard asserts their fills ≥1.2:1 apart.

**Fetch failure mid-set (FR-14, QA-13/QA-14):** arrived answers persist in
cache + state → pins keep their classes; unanswered remainder stays
`unanswered`; the first failure classifies into exactly one of
offline/no-key/error at the panel; no error is ever cached (the
`dedupedFetch` chokepoint rethrows without a `putEntry`); `retry()`
re-enqueues exactly the unanswered set and pumps — no hotspot re-search
needed. Offline with a stale entry present serves the stale counts with
`fromCache: true` + `fetchedAt` for the as-of wording (FR-15b, QA-16).

**Mode switch mid-flight (FR-17, QA-18):** `active` false stops the pump
before the next launch; in-flight responses land in the durable cache
(generation-guarded out of state), so they can never recolor a pin under the
new mode — and the new mode's readings are computed from its own sources, so
even a state write would be invisible to it (belt and braces). Switching back:
seed + cache hits color instantly, only the true remainder fetches.

**Window switch mid-flight (FR-16):** invisible to the fetch layer (one entry
serves both); the readings and tiers recompute from `count7` vs `count30` on
the next render; a late arrival carries both counts, so it can never answer
"the wrong window."

**Result-set replacement mid-flight (FR-18):** new `pins` identity → new
generation → old pass's pending launches stop; late old-pass responses cache
harmlessly (join is by locId; locIds not in the new set never render); the new
pass enumerates cache-first.

**Empty / tiny result sets:** empty → hook idle, zero requests (FR-11); all
values zero in a mode → no ramp classes, legend shows only the states in
effect; two distinct nonzero values → two classes (QA-21,
`computeCountyTiers` guarantee).

---

## Test Surface

| File | Covers |
|---|---|
| `backend/tests/test_hotspot_activity.py` (new) | Route param bounds (every fixture id-validation row, incl. trailing-newline + non-ASCII-digit rejection — QA-34), reduction + dedupe against the fixture, 401-no-key, 502 mapping, no-cache-on-error. |
| `lib/hotspotActivity.test.ts` / `.parity.test.ts` (new) | Reduction parity on the shared fixture; `computeActivityCounts`: count7 ≤ count30 invariant, the exact 7-day boundary via `isWithinWindow` semantics (inclusive day-floor edges), malformed `obsDt` rows excluded from count7 but present in count30 only if kept by reduction (they are dropped at reduction — assert). |
| `lib/hotspotActivityCache.test.ts` (new) | County-cache suite shape: TTL fresh/stale, FIFO at cap (capacity+1 measured as WORK DONE via the work-stats seam, per the repo's cache-measurement rules), per-entry load validation (each malformed shape dropped independently), errors never cached, offline stale-serve, in-flight dedupe, debounced write. |
| `lib/useHotspotActivity.test.ts` (new) | Pool bound ≤4, cap at 200 with in-view-first order (fixture where proximity and in-view disagree), cache hits exempt from cap, zero-request invariants (inactive / empty set / pan), generation guard (late stale response never mutates state), retry re-asks only the remainder, three-state classification. |
| `lib/hotspotColorModes.test.ts` (new) | FR-05 hand-computed fixture (subspecies fold + non-countable exclusion + escapee INCLUDED — a fixture row that discriminates), FR-06 distinct submissionIds, state resolution table (every variant reachable, `zero`/`noData`/`quiet`/`unanswered` never on the ramp), tiers = `computeCountyTiers(…, 5)` parity, legend-from-same-tiers parity (NFR-10). |
| `lib/hotspotContrast.test.ts` (new) | QA-29/QA-30 as specified in the token section. |
| `components/map/HotspotMarkers.test.tsx` (extend) | **Default-mode layout/paint deep-equal to shipped (NFR-10 regression)**; mode active → `cls`-matched `icon-image`; mode/window changes never change the component `key` or trigger the fit effect; kind filters still hide/reveal under a mode (FR-23); sprite net answers own ids only. |
| `components/MapExplorer…` (extend) | QA-01/02/03 selector + session lifetime + no storage-seam write; QA-06 transport-seam zero-request sweep for modes 1/2; popup/list/legend content rows (QA-25/26/27). |
| Existing suites that must stay green | `HotspotMarkers.test.tsx` shipped rows, `searchArea`/`resultsFit` (FR-18), `CountyLayer`/`AtlasLayer`/`basemapMute` (FR-27), `entryChunk.test.ts` (all new modules are reachable only from the lazy `MapExplorer` graph — no entry-chunk change), backend suite. |

Live-browser (not vitest): QA-11 progressive coloring under throttling, QA-30
grayscale screenshot ordering, QA-31 theme re-resolve, QA-32 pan/zoom jank,
QA-33 320px/200% — Playwright against `SR_DATA_DIR` demo data, per the repo's
measurement rules.

---

## Migration Plan (build order for the Engineer)

1. `lib/hotspotActivity.ts` (guard regex, payload types, reduction spec,
   `computeActivityCounts`) + fixture + unit tests — everything downstream
   imports it.
2. Backend route + backend tests; Tauri twin + `transport.ts` dispatch arm
   (with the NOT-in-`CACHED_GET_PATHS` comment) + parity test. Verify the dev
   proxy path serves it (the `/map` prefix already proxies).
3. `lib/hotspotActivityCache.ts` + tests (template: `countyCompletenessCache`).
4. `lib/hotspotColorModes.ts` + tests (pure; no transport import — keep it
   passive-graph clean).
5. `lib/useHotspotActivity.ts` + tests.
6. Tokens in `globals.css` (both blocks) + `hotspotContrast.test.ts` — before
   any component reads them (the tokens-before-use rule).
7. Sprite table + baking in `lib/mapPins.ts`, `HotspotMarkers` extension with
   the default-mode regression guard written FIRST (red against any default
   drift).
8. `MapExplorer` wiring: state, selector/window/retry UI, hook, readings,
   legend/popup/list. CSS classes for the new controls (lifted, phone-tier
   posture).
9. Docs sweep at ship: `docs/HELP.md`, `README.md`, `website/`,
   `ACCESSIBILITY.md`; **`PRIVACY_POLICY.md` check is a real one** — the eBird
   bullet must be re-read against the new per-hotspot call class (NFR-06);
   whether it needs naming is the release leg's explicit check, not silently
   assumed either way.

---

## Design Decisions

1. **Per-hotspot `data/obs/{locId}/recent?back=30` over area aggregation** —
   accuracy is disqualifying for the area endpoint (one record per species
   area-wide undercounts every hotspot); the per-location call answers both
   windows in one bounded request. (FR-09, FR-16, FR-19.)
2. **`back` fixed server-side; no window parameter anywhere in the transport.**
   The window is a client-side derivation, so the route has one shape, the
   cache has one entry per hotspot, and the cap cannot be spent twice. (FR-16.)
3. **Cache the two counts, not the species list** — fixed-size entries,
   trivial validation, zero-cost window switch; the 6h as-of wording absorbs
   the frozen 7-day boundary. (FR-15, FR-25.)
4. **FIFO at 2,000 entries, structural bound, no byte budget** — eviction
   costs one cheap re-ask; every field is bounded by shape, so an entry-count
   cap states the whole truth. (NFR-05, repo cache rules.)
5. **Mode 3 counts eBird's taxa as returned — no countable-form collapse.**
   FR-09 defines the value as "species reported by the community" per the
   chosen product; mirroring eBird's own recent-activity tallies is the honest
   parity claim, a client-side taxonomy collapse would need a per-row
   code→category lookup the passive surfaces must not make, and the PRD
   imposes the form rule on mode 1 only. Stated in the popup mode label
   territory as the Designer sees fit. **Flagged** (sharpening of FR-09).
6. **Mode-1 values come from a NEW countable-rule pass, not the shipped
   `obsLocationsByLocId.species`** — the shipped set is raw-name and feeds the
   shipped popup line, which FR-25 retains; the two numbers differ by design
   and both render, labeled. (FR-05, FR-25.)
7. **`zero` and `quiet` share one fill token with distinct wording** — same
   semantic answer, never co-occurring; two identical-valued tokens would be a
   lie waiting to drift. **Flagged** for the Designer to confirm or split.
8. **Cap accounting excludes cache hits** — FR-19 bounds network cost; a
   cached answer costs nothing, and counting it would starve fresh hotspots of
   the budget on every revisit. (Sharpening of FR-19's letter toward its
   stated purpose.)
9. **locId guard is length-bounded `^L[0-9]{1,10}$` on both transports**
   (v0.5.90 length-bounding precedent), single-sourced client-side, with the
   pydantic `pattern=` carve-out left as the carve-out. The shipped unbounded
   `LOCATION_ID_RE` link gate is out of scope and untouched.
10. **`/map/hotspots`' bare params stay bare** — the known Low finding is not
    silently fixed inside this feature (repo rule: deliberate, on ROADMAP).
    The NEW route carries full bounds.

## Flags Carried Forward

**For the Designer (Stage 4):**
- Ramp hue family recommended cyan-blue; final values yours within the
  `hotspotContrast` floors (monotonic luminance, ≥1.2:1 adjacency, ≥3:1 vs
  `TINT_GRASS`, state tokens mutually ≥1.2:1). If a number ever rides the pin
  fill, the 4.5:1 on-fill rule activates (NFR-01).
- `zero`/`quiet` one-token decision (Decision 7) — confirm or split.
- Kind-glyph treatment on mode sprites (FR-22) and whether activating a mode
  auto-reveals the legend (FR-24) are yours; sprite-id table and count are
  fixed.
- FR-12's loading line is a per-arrival progress surface — the v0.5.87
  throttle-the-emission rule applies if it announces; design the copy with
  that in mind ("Checking activity: N of M" + the FR-19 cap sentence).

**For the Engineer (Stage 5):**
- Keep `hotspotColorModes.ts` and every mode-1/2 path free of `transport` /
  `lib/tauri/*Service` imports (the passive-graph posture; QA-06 verifies at
  the seam).
- The `HotspotMarkers` default-mode regression guard comes FIRST and must be
  demonstrated red against a deliberate default-path mutation before the mode
  work lands on top.
- `computeActivityCounts` takes `nowMs` as an argument; the only `Date.now()`
  sits in the promise handler (render purity is build-blocking).
- Mode/window/readings are props — never in the marker `key`; assert the fit
  effect does not run on a mode switch.
- The cache's capacity+1 measurement asserts WORK DONE via a work-stats seam,
  not elapsed time (repo cache-measurement rules).
