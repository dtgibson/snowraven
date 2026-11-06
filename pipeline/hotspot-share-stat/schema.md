# Schema - Hotspot Share Stat

**Feature:** hotspot-share-stat
**Date:** 2026-11-06
**Revised:** 2026-11-06, for `decisions.md` section 1 (the per-region hotspot answer is persisted after its first lookup; FR-22 to FR-30, NFR-09 to NFR-12 and QA-35 to QA-53 are the new obligations)
**Stage:** 3 - The Architect
**Source:** prd.md (approved, revised), strategic-brief.md (approved, revised), decisions.md section 1
**Path:** Incremental

## 1. Path

**Architect assessment - Incremental.** `pipeline.config.json` exists and is complete, so the config step is skipped. SnowRaven's data layer is a family of storage-seam documents plus the user's parsed export, and this feature extends that family by one document: the per-region public-hotspot answer that `lib/hotspotSet.ts` fetches today and holds only in memory and in the 90 s `CACHED_GET_PATHS` layer becomes a durable store in the `lib/countyCompletenessCache.ts` shape, keyed by region code, read on every later launch with no request. The prior revision of this schema classified the feature frontend-only; the user's direction at the design review (`decisions.md` section 1) changes that, and nothing else in the prior design is withdrawn: the resolution snapshot (section 4), `computeHotspotShare` (section 5), the view-state discriminator (5.4), the copy module (section 6) and the `BirdingStats.tsx` touch points (section 8) all stand, amended only where persistence changes what the snapshot can know. Running hands-off, so this is declared here rather than confirmed in chat.

Precedents followed: `lib/countyCompletenessCache.ts` (the reference durable cache shape, named by the brief), `lib/hotspotActivityCache.ts` and `lib/checklistProjectsCache.ts` (the later instances, in particular the one-chokepoint validation rule), `frontend/src/lib/settingsRouteBudget.test.ts` (how a cap is proven against the route), and `lib/clearDerived.ts` plus `cacheInventory.test.ts` (the registration convention).

## 2. Data layer changes, in one place

What this feature ADDS to the data layer:

- **One new settings-document store**, `hotspot-regions-v1`, owned by a new module `frontend/src/lib/hotspotRegionCache.ts` (section 9): one entry per region code holding the shape-valid hotspot ids eBird returned and the fetch time; TTL 30 days; 512 entries and a 2^23 code-unit payload budget with oldest-fetched-first eviction; validated on every load; written only on a successful answer.
- **One registry row** in `lib/clearDerived.ts` and its pairing row in `cacheInventory.test.ts` (9.8).
- **One `describe`** in `settingsRouteBudget.test.ts` (9.12).
- **One removal** from `lib/transport.ts`: `/map/hotspot-region` leaves `CACHED_GET_PATHS` and stays in `EBIRD_GATED_PATHS` (9.11).
- **Two rule-gate lines** in `.claude/rules/security.md` `paths` (7.4).

What it does NOT add, each a decision:

- **No `docChains` key.** The store writes through `storage.setSetting`, which on Tauri is already a link on the `settings.json` chain (`SETTINGS_PATH` in `storage.ts`) and on web/Pi is its own file `data/settings/hotspot-regions-v1.json` through the generic route. The reference store takes the same path and needs no key of its own (9.5).
- **No own document and no ordered writer.** NFR-09's worst case fits the route with room (9.3, 9.12), so the store stays a settings document; the `county-day-obs.json` shape is the named escape if the reversal condition in 9.13 is met.
- **No iCloud Sync kind, no Rust twin, no export** (FR-27, NFR-12).
- **No new request kind, endpoint, host, transport path, CSP entry or `http:allow-fetch` entry** (NFR-01). The only network dependency is the region fetch the links already issue; the change in posture is downward (section 10's request table).
- **No epoch module.** The feature rides the hotspot-set change epoch; the store itself has no subscribers and announces nothing (hotspotSet.ts owns every announce).
- **No `PRIVACY_POLICY.md`, README or website change** (NFR-08). The document holds eBird's public data keyed on regions the user birded, which is the same posture as `county-completeness-v1`, and no request moves between components.
- **No DOM id or ARIA IDREF** (NFR-07).

## 3. Existing data used by this feature

### `ObservationEntry` (`frontend/src/types.ts`, produced by `lib/parseEbirdObservations.ts`)

- Fields used, through `ChecklistEntry` below: `submissionId` (string), `locationId` (string, the export's Location ID cell verbatim), `stateProvince` (`string | null | undefined`, e.g. `"US-MN"`).
- How used: never read directly by the feature; `computeChecklists` collapses the rows to one entry per distinct `submissionId` and the feature reads those.

### `ChecklistEntry` via `computeChecklists(effectiveObs)` (`lib/birdingStats.ts` line 87)

- Already computed in `BirdingStats.tsx` line 547 as `projectChecklists`, memoised on `effectiveObs` (the UNFILTERED observations once `computed` is true; `EMPTY_OBS` before). It is the Projects section's per-checklist derivation and it does not move with "Count all forms" (FR-03, FR-05, QA-03). The feature reuses this memo; it does not call `computeChecklists` again.
- Fields used: `submissionId` (the denominator is `projectChecklists.length`, one entry per distinct id), `locationId` (first row of the checklist), `stateProvince` (first row, `string | null`).
- A checklist whose only rows are non-countable forms is still one entry here, because `computeChecklists` keys on `submissionId` alone.

### The public-hotspot Set (`lib/hotspotSet.ts`)

- `getHotspotSet(obs)` / `loadHotspotSet()` build ONE Set of hotspot location ids per region list (`regionsFromObservations`), shared by every tab through the module cache. `isPublicHotspot(locId, set)` is the O(1) membership test (`LOC_ID_RE` then `set.has`). The tab reaches it through `useHotspotSet()` (`BirdingStats.tsx` line 165) and passes `isHotspot` to each `HotspotLink` in the top-location lists (lines 1366 to 1389).
- **What changes:** the per-region request now goes through the store's `dedupedFetch` (9.6) instead of straight to `transport.get`, so a region with a persisted entry costs no request, a region without one costs exactly one, and a successful answer is persisted. The Set the hook returns is the union of the persisted lists and this session's answers (FR-22). The build lifecycle is in section 10.
- Re-ask schedule (`hotspot-links-retry-after-429`, v1.0.49): unchanged in policy. A region refused with 429 past the gate's retries is asked again in `HOTSPOT_RETRY_ROUNDS` (3) rounds at 1, 2 and 4 minutes; a round that changes anything replaces `_promise` and calls `announce()`. `invalidateHotspotSet()` and a new region list both call `supersedeRetries()`. A 429 on a TTL refresh joins the same rounds (10.4).
- `hotspotSet.ts` is ON the entry chunk (`NamedBirdsTable` imports `useHotspotSet`, and `NamedBirdRow` is on `App.tsx`'s static graph; `entryChunk.test.ts` line 638 says so). It gains one static import, the store module; what that costs and what the guard requires is 9.10.
- `/map/hotspot-region` today sits in `CACHED_GET_PATHS` (`transport.ts` line 282); it leaves (9.11).

### Key status and online flag (`BirdingStats.tsx`)

- `hasEbirdKey: boolean | null` (line 147; `null` while the keys document is being read, set at lines 275 and 276). The Projects section and the exotic-provenance pass already branch on it; the feature's FR-09 and FR-10 branch on it the same way.
- `online` from `useOnline()` (line 280), the flag FR-11 reads. The store does not read this hook; section 10.4 says where `navigator.onLine` is consulted and why that is a hint and not a gate.
- `onGoToSettings` (prop, line 136), the route FR-21's button calls.

### Formatting helpers (`lib/statsFormat.ts`)

- `fmt(n)` for every count (FR-16).
- `fmtSharePct(count, total)` for a LONE share figure. It returns `"100%"` for 999 of 1,000, which is correct for a lone figure and is NOT the pair rule FR-15 states; section 5.3 owns the pair.

### Primitives the block renders with (`components/statsPrimitives.tsx`, `components/ui/Button.tsx`)

- `SubLabel`, `Divider` (FR-01), `Button` (FR-21). The Complete-checklists bar at `BirdingStats.tsx` lines 1572 to 1600 is the F032 pattern FR-20 names; its fills are `var(--sr-chart-blue-dark)` and `var(--sr-surface-subtle)`, with `var(--sr-text-muted)` for the caption, which are the tokens NFR-05 means by "already in use in the Statistics tab's share bars". The Designer may pick the pair.

### The storage seam (`lib/storage.ts`)

- `storage.getSetting<T>(key)`, `storage.setSetting<T>(key, value)`, `storage.deleteSetting(key)`: the three calls the store makes, exactly the reference store's three. On Tauri each is a link on the `settings.json` chain; on web/Pi each is one request to `/settings/{key}` carrying `APP_REQUEST_HEADERS`, with `_MAX_BYTES` (16 MiB, `backend/routers/settingskv.py` line 54) refusing a larger body with a swallowed 413.

## 4. The seam change: a resolution snapshot beside the Set (`lib/hotspotSet.ts`)

### 4.1 Types and exports

```ts
// frontend/src/lib/hotspotSet.ts (additions; nothing existing is renamed or re-typed)

/** What the module knows about one region's lookup in the CURRENT build. */
export type RegionResolution = 'pending' | 'answered' | 'unanswered'

/** One immutable snapshot of the current build: the ids known so far and
 *  each region's state. Replaced whole, never mutated, so a reference
 *  comparison is a change test (useSyncExternalStore reads it). */
export interface HotspotResolution {
  /** The build's region list (regionsFromObservations order). Empty before the
   *  first getHotspotSet call and for a backup with no askable region. */
  readonly regions: readonly string[]
  /** region code -> state, one entry per member of `regions`. */
  readonly byRegion: ReadonlyMap<string, RegionResolution>
  /** The ids known so far in this build (persisted lists plus this session's
   *  answers): the SAME Set object the cached promise resolves with, or the
   *  object a later landing replaced it with (empty while nothing is known). */
  readonly set: ReadonlySet<string>
  /** Derived counts over `byRegion`, kept on the snapshot so a consumer does
   *  not iterate the map per render. */
  readonly pending: number
  readonly answered: number
  readonly unanswered: number
}

/** Current snapshot. Stable reference until the module replaces it. */
export function getHotspotResolution(): HotspotResolution

/** The REGION_RE shape test (`/^[A-Z]{2}(-[A-Z0-9]+){0,2}$/`), exported so the
 *  classification helper and regionsFromObservations agree by construction on
 *  what "an askable region code" is. */
export function isAskableRegionCode(code: string | null | undefined): code is string
```

`getHotspotSetEpoch`, `subscribeHotspotSet`, `invalidateHotspotSet`, `getHotspotSet`, `loadHotspotSet`, `buildHotspotSet`, `isPublicHotspot`, `regionsFromObservations`, `HOTSPOT_RETRY_ROUNDS`, `HOTSPOT_RETRY_BASE_MS` and `hotspotRetryDelayMs` keep their signatures and semantics (FR-07, QA-11). `buildHotspotSet` (no shipped caller; two test rows) routes through the store like every other ask, so it has exactly one caching layer; its rows pass unchanged on an empty document.

### 4.2 The three states, precisely (amended for persistence)

The module now holds, per build, `_lists: Map<string, readonly string[]>`: one list per region it has an answer for, taken from the document at the build's first read (fresh or stale) or from the network in this build. The Set is the union of `_lists`' values, rebuilt whenever a list is added or replaced. The state of a region is DERIVED from that map, never kept separately, which is what makes the invariant trivial:

- **answered**: `_lists.has(region)`. A persisted entry (fresh or past the TTL) makes a region answered from the build's first read of the document, before any request; a successful answer in this build does too. **An empty list is answered** (FR-06), persisted and read back like any other. A TTL refresh in flight, failed, or rate-limited does NOT leave this state, because it never removes the list it is refreshing (FR-07, FR-25, QA-09).
- **pending**: not in `_lists`, and either the build's document read or first ask has not settled, or the region's last answer was a 429 with a re-ask round still to come (`round <= HOTSPOT_RETRY_ROUNDS`), or a round that will decide it is in flight.
- **unanswered**: not in `_lists`, and the first-ever request failed with anything but a 429 (offline, 5xx, 401/403 from a missing or bad key, a non-iterable body) in the build or in a round, or its last answer was a 429 with no round left. Nothing asks again until `invalidateHotspotSet()` or a new region list, exactly as today.

`pending + answered + unanswered === regions.length` on every snapshot. With persistence, `pending` and `unanswered` are confined to a region's first-ever lookup: a fresh install, a cleared store, a region the export newly introduces, or an entry dropped by validation or eviction (FR-04, FR-29, FR-30).

### 4.3 Where the snapshot moves (transition table, amended)

`askRegions` returns a per-region outcome (`'answered'` with the list, `'limited'`, `'failed'`); its callers derive the lists and the limited set from that. Every request inside it goes through `dedupedFetch` (9.6), which is what decides whether a request is issued at all.

| Event (where in the module) | `regions` | `byRegion` | `set` | Epoch |
|---|---|---|---|---|
| Module load | `[]` | empty | `EMPTY` | 0 |
| `getHotspotSet(obs)` with a NEW key (region list changed, or after invalidate) | the new list | every region `pending` | `EMPTY` | no announce (silent replacement; see 4.4) |
| `getHotspotSet(obs)` with an empty key (no askable region) | `[]` | empty | `EMPTY` | no announce |
| **Phase 1** (10.1): the document read settles, generation current | unchanged | each region with a persisted entry `answered`, the rest `pending` | the union of the persisted lists | **no announce** (the promise resolves here when phase 2 has nothing to ask; see 4.4) |
| **Phase 2** (10.2): the first ask of the regions with no entry settles, generation current | unchanged | each asked region `answered` / `unanswered` / (limited) `pending` | the union so far | **no announce** (the promise resolves here; see 4.4) |
| A refresh round or a re-ask round lands, generation current, and it changed anything (a list added or replaced with a DIFFERENT list, OR a region moved to `answered`, OR a region moved to `unanswered` because `round + 1 > HOTSPOT_RETRY_ROUNDS`) | unchanged | the moved regions | the rebuilt union when a list changed, else unchanged | **one announce** per round |
| A round lands, generation current, nothing changed (every still-limited region has rounds left; a refresh returned the identical list) | | | | no announce (an identical refresh still writes its new fetch time to the document, 9.7) |
| Any landing, generation superseded | no change (the answer never lands and never writes, 9.6) | | | |
| `invalidateHotspotSet()` | unchanged (the last known list) | every region `pending` | `EMPTY` | one announce (today's single `announce()` call, unchanged) |

Writing the snapshot BEFORE the cached promise resolves is load-bearing: the build replaces the snapshot and then returns the Set, so every `.then` on `_promise` (the `useHotspotSet` effect's `setSet`) runs with the settled snapshot already in place. The same order holds in every round: snapshot first, then `_promise = Promise.resolve(union)`, then `announce()`.

### 4.4 Why the build's settle is silent, and why that is safe

`hotspotSetRetry.test.tsx` line 108 pins `notified` at exactly one call across a build (one region limited, one answered) plus round 1 (which adds ids); QA-11 requires that suite to pass with no weakened assertion. So the build's own settle (phase 1 and phase 2 together, which on an empty document is exactly today's single build) must not bump the epoch, and the epoch keeps precisely today's events plus the round-settles-a-region case that FR-08 and QA-12 need, plus the refresh landing that FR-25 and QA-43 need.

The Statistics tab still re-renders on the build's settle, through the hook it already calls: `useHotspotSet()`'s effect does `loadHotspotSet().then(setSet)`, and that `setSet` lands a new Set identity (the build's union, never `EMPTY` once any region is known) and re-renders the component. `useSyncExternalStore` calls `getSnapshot` on every render and adopts a changed reference, so that render reads the settled snapshot. Two consequences the Engineer must keep true:

1. **`useHotspotResolution()` (4.5) is read in the SAME component that calls `useHotspotSet()`**, which is already the case in `BirdingStats.tsx`. A component reading the snapshot alone would neither drive a build nor re-render on its settle, and that is by design: the resolution hook is a passive reader of the Set's own lifecycle.
2. **The snapshot's `set` is the SAME object the promise resolves with**, so the stat's classification (over `resolution.set`) and the links' classification (over the hook's `set`) are computed from one Set once both have landed. Between a round's `announce()` and the hook's reload resolving (a cache hit, a few microtasks and one effect), the stat is at most one tick AHEAD of the links; it is never behind in the dangerous direction, because `set` and `byRegion` travel in one object. QA-07 is asserted in the settled state, and holds equally when the Set came from the document with no fetch (QA-36).

An alternative the Engineer should not take: resolving the promise at phase 1 on a cold document and treating phase 2 as a round. It is the simpler-looking shape and it turns `hotspotSetRetry.test.tsx` line 108 red (the cold build would then announce once more). Section 10 gives the shape that keeps the cold path's announce count exactly as it is today.

### 4.5 The React seam: `useHotspotResolution()` (`lib/useHotspotSet.ts`)

```ts
/** The current resolution snapshot, re-read on every hotspot-set change and on
 *  every render of the calling component. Passive: it starts no build and
 *  issues no request; call it beside useHotspotSet(), which does. */
export function useHotspotResolution(): HotspotResolution {
  return useSyncExternalStore(subscribeHotspotSet, getHotspotResolution, getHotspotResolution)
}
```

`useHotspotSet()` is byte-identical. Adding the export to the same file keeps the entry-chunk posture unchanged (the file is already on the entry chunk and gains no import).

### 4.6 Invalidation and the region list (FR-07, QA-10, amended)

- `invalidateHotspotSet()` keeps `regions` (the last known list), marks every one `pending` with `set = EMPTY`, clears `_lists`, abandons the store's in-flight requests (9.6, so a request made under the old key is never joined by the rebuild and never writes), and then runs its existing `announce()`. It does NOT purge the document (FR-26: a key save, a file save and an iCloud arrival are replaces). The Stats tab therefore renders FR-10 from the invalidation until the rebuild's first read of the document lands, which for a warm rebuild (every region persisted) is the next few microtasks: phase 1 resolves from the mirror with no request, `setSet` fires, and the bar is back. Open Question 5 is honoured by construction: a region with a persisted entry is read from the document on the rebuild and never asked.
- The next `getHotspotSet(obs)` recomputes the list; when it differs (a new backup), the snapshot is replaced with the new regions all `pending` (silently, per 4.4), and phase 1 immediately marks the persisted ones answered; when it is the same list, the same happens. Either way the summary covers only the current regions, and entries for regions the new backup no longer names stay in the document untouched (FR-24, QA-39).
- A region that is absent from `byRegion` (the window between a tab's first render and its hook's first `getHotspotSet`, or a region a checklist names that `regionsFromObservations` did not see) is treated by the classification helper as `pending` (5.2). This is why the first-render window renders FR-10 and not FR-12's "carry no region code" sentence.
- **After a clear** (Settings' delete and both iCloud clear paths), the order is `invalidateHotspotSet()` first and the store's purge second (`Settings.tsx` lines 2092 to 2097; the iCloud controller's `invalidate` and `purgeDerived` deps). That order is safe because after a delete there is no backup, so no rebuild asks the mirror; the next upload calls `invalidateHotspotSet()` again and its rebuild reads the purged (empty) mirror, so every region is pending and is asked (QA-45). The Engineer does not reorder the clear paths.

### 4.7 Test seam

Same as the existing suite: `vi.resetModules()` plus a fresh `import()` per test (`hotspotSet.test.ts` line 14), which also resets the store's mirror. `hotspotSetRetry.test.tsx` does not reset modules, so it adds the store's test reset (`_resetHotspotRegionCacheForTests()`, the reference's seam shape) to its `beforeEach` beside the existing `invalidateHotspotSet()`; without it a region persisted by one row would answer the next row with no request (section 11). Both suites mock `./storage` with an in-memory `Map` so persistence rows can read the document back (QA-35) and so no row depends on a `fetch` stub rejecting the settings route by accident. Rows QA-09 and QA-10 read `getHotspotResolution()` directly; the retry rows in `hotspotSetRetry.test.tsx` gain siblings that count announces for a round that settles a region WITHOUT adding ids (the empty-list answer and the final-429 case) and for a refresh that replaces a list, which are the new epoch events the existing suite cannot see.

## 5. The classification: `lib/hotspotShare.ts` (new, pure, dependency-light)

Imports: `isPublicHotspot`, `isAskableRegionCode` and the `HotspotResolution` type from `./hotspotSet`; `fmt` and `fmtSharePct` from `./statsFormat`; `type ChecklistEntry` from `./birdingStats` (type-only, erased). Imported only by `BirdingStats.tsx` (lazy), so it never reaches the entry chunk; `entryChunk.test.ts` needs no new row for it, since nothing new is forbidden and nothing new is lazy.

### 5.1 Shape

```ts
export interface HotspotShare {
  total: number          // checklists.length (distinct Submission IDs)
  hotspot: number
  personal: number
  unclassified: number   // === total - hotspot - personal
  noRegion: number       // the subset of unclassified with no askable region code
  regionsTotal: number   // distinct askable region codes among the checklists (r)
  regionsPending: number
  regionsUnanswered: number  // k
}

export function computeHotspotShare(
  checklists: readonly ChecklistEntry[],
  res: HotspotResolution,
): HotspotShare
```

### 5.2 Rules (QA-04 to QA-08)

One pass over `checklists`; per entry, in this order:

1. `code = c.stateProvince`. If `!isAskableRegionCode(code)` (null, empty, or failing `REGION_RE`): `unclassified++`, `noRegion++`, next.
2. `status = seen.get(code)`, else `status = res.byRegion.get(code) ?? 'pending'`, memoised in a local `Map<string, RegionResolution>` (`seen`) so the snapshot map is consulted once per DISTINCT region, not per checklist.
3. If `isPublicHotspot(c.locationId, res.set)`: `hotspot++`. A shape-valid id present in the Set is a hotspot whatever its region reads, because the Set holds only ids some region answered with (persisted or fetched).
4. Else if `status === 'answered'`: `personal++`.
5. Else (`pending` or `unanswered`): `unclassified++`.

After the pass, `regionsTotal = seen.size`, `regionsPending` and `regionsUnanswered` count `seen`'s values. `r` and `k` are therefore counted over the regions the CHECKLISTS name, not the build's list, so they are consistent with each other and with `u` in the FR-12 sentence. `k` counts only never-answered regions; a region whose refresh failed is `answered` and is not in it (FR-12, QA-18).

Invariant, asserted in the helper's test over every fixture, the stale-persisted fixture included (QA-04): `hotspot + personal + unclassified === total`, `noRegion <= unclassified`, `regionsPending + regionsUnanswered <= regionsTotal`.

### 5.3 The percentage pair (FR-14, FR-15, QA-23, QA-24, QA-34)

```ts
export interface SharePctPair { hotspot: string; personal: string; hotspotPct: number }
export function sharePctPair(h: number, m: number): SharePctPair   // requires m > 0
```

`hotspotPct = Math.round(h / m * 100)` is the ONE rounding. Display:

| Case | hotspot | personal |
|---|---|---|
| `h === 0` | `"0%"` | `"100%"` |
| `h === m` | `"100%"` | `"0%"` |
| `hotspotPct === 0` (h > 0) | `"<1%"` | `">99%"` |
| `hotspotPct === 100` (h < m) | `">99%"` | `"<1%"` |
| otherwise | `` `${hotspotPct}%` `` | `` `${100 - hotspotPct}%` `` |

This agrees with `fmtSharePct(h, m)` for the hotspot figure in every row except the fourth, where `fmtSharePct(999, 1000)` returns `"100%"`: correct for a lone figure, but FR-15 says a nonzero complement reads `"<1%"` and its partner `">99%"`. So the pair function owns the rule and the test pins the one divergence as a named row. Bar widths use the unrounded `h / m * 100` and `100 - that` (QA-20's `37.39...%`).

### 5.4 View state (the discriminator the copy module and the component share)

```ts
export type HotspotShareView =
  | { kind: 'hidden' }                                         // FR-02: total === 0
  | { kind: 'no-key' }                                         // FR-09
  | { kind: 'pending';    u: number; m: number; h: number; p: number }                // FR-10
  | { kind: 'offline';    u: number; m: number; h: number; p: number }                // FR-11
  | { kind: 'unanswered'; k: number; r: number; u: number; m: number; h: number; p: number } // FR-12
  | { kind: 'no-region';  u: number; m: number; h: number; p: number }                // FR-12, k === 0
  | { kind: 'settled';    h: number; p: number; m: number; pct: SharePctPair; hotspotWidthPct: number } // FR-13

export function hotspotShareView(
  share: HotspotShare,
  input: { hasEbirdKey: boolean | null; online: boolean },
): HotspotShareView
```

Precedence, top to bottom, first match wins: `total === 0` -> `hidden`; `hasEbirdKey === false` -> `no-key` (QA-13, QA-14, including when every region has a persisted answer); `hasEbirdKey === null` -> `pending`; `unclassified === 0` -> `settled`; `regionsPending > 0` -> `pending`; `!online` -> `offline`; `regionsUnanswered > 0` -> `unanswered`; else `no-region`. `u = unclassified`, `m = total`, `h = hotspot`, `p = personal`, `k = regionsUnanswered`, `r = regionsTotal`.

Two consequences of persistence, both falling out of the precedence rather than added to it: a classification served from a stale entry renders `settled` with no marker (FR-13, Open Question 7), because a stale region is `answered`; and offline-after-an-answer (FR-11's second case) renders `settled` when every region holds an entry, because `unclassified === 0` is tested before `!online` (QA-37).

Note the ordering of `settled` before `pending`: a build with a region still pending whose checklists are nonetheless all classified (every one of them a hotspot id already in the Set) is settled for this statistic, since no checklist is unclassified. QA-04's partition is what makes that sound.

### 5.5 Memo inputs and re-draw count (NFR-02, NFR-03, QA-32)

In `BirdingStats.tsx`:

```ts
const resolution = useHotspotResolution()
const hotspotShare = useMemo(() => computeHotspotShare(projectChecklists, resolution), [projectChecklists, resolution])
const hotspotShareView_ = useMemo(() => hotspotShareView(hotspotShare, { hasEbirdKey, online }), [hotspotShare, hasEbirdKey, online])
```

`projectChecklists` is stable for the life of the export (it is memoised on `effectiveObs` alone; `BirdingStats.tsx` lines 535 to 547 explain why). `resolution` changes identity only at the transitions in 4.3. So the pass runs once per build settle (phase 1 and phase 2 each replace the snapshot, but only the build's one `setSet` render reads it, so one draw), once per announcing round, once per invalidation, and once per new export; it does not run on "Count all forms", on a key-status read, on an online flip, or on any other re-render of the tab. Per build the bound is `2 + HOTSPOT_RETRY_ROUNDS + (regions refreshed)` re-draws of the pass plus one per invalidation, and on a warm launch it is one.

## 6. The copy module: `lib/hotspotShareCopy.ts` (new)

Every user-facing string the block renders lives here and is generated from `HotspotShareView` (FR-17, QA-25, QA-26), so the plural-agreement and em-dash sweeps run over the reachable corpus:

```ts
export const HOTSPOT_SHARE_SUBLABEL = 'Checklists at hotspots'
export const HOTSPOT_SHARE_NO_KEY = 'Checklists at hotspots cannot be counted without an eBird API key.'
export const HOTSPOT_SHARE_ADD_KEY = 'Add a key in Settings'
/** The sentences for one view, in reading order; [] for 'hidden'. The first
 *  sentence of 'settled' carries both counts, the denominator and both
 *  percentages (FR-19). */
export function hotspotShareSentences(view: HotspotShareView): string[]
```

Count-bearing fragments use `fmt` and agree in number ("1 checklist" / "2 checklists", "1 region" / "2 regions"; FR-16). The guard builds its corpus by calling `hotspotShareView` over a grid of `HotspotShare` values with counts in {0, 1, 2, 1234} per field, both `online` values and all three `hasEbirdKey` values, then `hotspotShareSentences` over each view, and asserts the rules (no `/\b1 [a-z]+s\b/`, every 1234 renders as `1,234`, no U+2014). Default wording is FR-09 to FR-13; the Designer may refine it provided the copy module, the QA rows and the Help sentence move together (PRD open question 3). No string names an age or staleness (Open Question 7).

`docs/HELP.md`'s Geographic Stats paragraph gains the FR-18 sentence in the same change (QA-27). In-app text and Help need no approval stop.

## 7. Declared scans over user-file-derived and persisted text (NFR-02, QA-31)

This feature adds THREE scans and no new regex beyond one bounded id pattern. Declared here so the security review verifies stated claims rather than hunting for them.

### 7.1 `computeHotspotShare` in `frontend/src/lib/hotspotShare.ts` (over parsed rows)

- **Input:** `projectChecklists`, one `ChecklistEntry` per distinct `submissionId` (already derived by `computeChecklists`, itself a declared linear pass), and one `HotspotResolution` snapshot. Per entry it reads `stateProvince` and `locationId`, both cells of the user's export stored verbatim.
- **Work per entry:** `isAskableRegionCode(code)`, which is `REGION_RE` (`/^[A-Z]{2}(-[A-Z0-9]+){0,2}$/`, already shipped and run once per OBSERVATION by `regionsFromObservations`): anchored at both ends, each quantified group begins with a literal `-` that the preceding `[A-Z0-9]+` run cannot contain, so there is no ambiguous split and the engine's work is bounded by the cell's length; one `Map.get` on `seen` (and, on a miss, one on `byRegion`); `isPublicHotspot`, which is `LOC_ID_RE` (`/^L\d+$/`, anchored, one run, linear in the cell) then one `Set.has`. No `includes` / `indexOf` / `find` / `filter` inside the loop, no nested scan, no allocation sized from a count read off the file beyond `seen`, which holds at most one entry per distinct region code.
- **Cost per draw:** O(C + R) with C checklists and R distinct region codes, constant per entry equal to the two cells' lengths. Measured on a prototype of exactly this loop (Node 24, Apple M1 Pro, CPU time, best of 20 after warm-up; scratch script `share-bench.mjs`): 15,000 checklists 2.28 ms (the realistic count for a 150,000-row export at about ten rows per checklist), 30,000 3.71 ms, 75,000 6.64 ms, 150,000 13.51 ms (the pathological one-row-per-checklist file), 300,000 27.60 ms. Doubling grows 2.03x at the top, 1.79x to 1.63x lower down where fixed costs dominate: linear. For comparison `computeChecklists` over 150,000 rows is recorded at 5.8 ms (`BirdingStats.tsx` line 546), so at matched scale the pass is well within NFR-03's "not measurably slower"; QA-32 measures the shipped helper through `cpuTiming.ts` as a same-run quotient (75k against 150k entries), never against these absolute figures.
- **Cost per re-draw:** identical to a draw; a re-draw happens only on a change of `projectChecklists` or `resolution` (5.5).
- **Hostile shapes the helper's test carries:** a `stateProvince` of `AA-`, then 40,000 `A`s, then a lowercase letter, built flat with `join` (the group takes the run and the lowercase letter fails `REGION_RE` after it; must still be linear, since the run is bounded by one anchored pass). Corrected at the audit (security I2): the shape first written here, 40,000 `A`s followed by a lowercase letter, fails at its third character, because the group needs a literal `-`, so it never consumed the run and measured neither scan; a `locationId` of `L` plus 40,000 digits plus `x` (fails `LOC_ID_RE` after the run); 150,000 entries each with its own distinct valid region code (the every-row-its-own-key leg, so `seen` is exercised at volume); every entry with an empty region (the all-`noRegion` branch); and the delimiter-absence shape is not applicable (no native search).

### 7.2 `sanitizeStore` in `frontend/src/lib/hotspotRegionCache.ts` (over the persisted document, NFR-02 (b))

- **Input:** the parsed `hotspot-regions-v1` document, on-device data that can arrive corrupted, hand-edited, or from a future shape drift (NFR-11: nothing in it is trusted by presence). Run once per session on the first `ensureLoaded()`, and again only after a purge followed by a rebuild.
- **Work, in order, per `order` entry walked NEWEST-FIRST (9.2 says why that direction):** the key is recorded in a `Set` at first sight, BEFORE its validation (the v1.0.40 rule: a hostile `order` repeating one invalid key pays one validation, not one per repeat); the key is refused unless it is a string of at most `HOTSPOT_REGION_KEY_MAX_CHARS` (12) code units that passes `REGION_RE` (the length check first, so the regex sees at most 12 characters); the entry is refused unless it is an object whose `fetchedAt` is a finite number and whose `ids` is an array of length at most `HOTSPOT_IDS_PER_REGION_MAX` (65,536), both O(1) checks made BEFORE any id is examined, so an array of ten million elements is refused without a scan; each id is refused unless it is a string of at most 16 code units passing `HOTSPOT_ID_RE` (`/^L[0-9]{1,15}$/`, anchored, one literal then one bounded run, linear in the id and bounded by the length check that precedes it); the entry's payload length is DERIVED arithmetically from the validated ids (`ids.length === 0 ? 2 : 1 + sum(id.length + 3)`, which equals `JSON.stringify(ids).length` for ASCII ids, asserted in the store's test at 0, 1, 2 and 1,000 ids), never read from the document; the entry is admitted while the running count stays within `HOTSPOT_REGIONS_MAX_ENTRIES` and the running payload within `HOTSPOT_REGIONS_MAX_BYTES`, and the walk STOPS at the first entry that would exceed either (the remaining, older entries are dropped: this is eviction at load, 9.4).
- **Work bound, named:** validation work is bounded by the ids examined, and the walk examines at most `HOTSPOT_REGIONS_MAX_BYTES / 5` ids before the budget is necessarily spent (the smallest serialized id, `"L1",`, is 5 code units) plus one entry's `HOTSPOT_IDS_PER_REGION_MAX` for the entry that crosses the budget: 1,677,721 + 65,536 ids, at the measured 65 ns per `HOTSPOT_ID_RE.test` (240,000 ids in 15.7 ms, Node 24, M1 Pro) about 115 ms in the worst hostile document that parses. A malformed entry costs at most its own `ids.length` tests (bounded by the 65,536 check) before it is dropped. A document that does not parse is treated as empty (FR-29). The clamp's cost per draw is that bound; per re-draw (a purge then a rebuild) the same.
- **Hostile shapes the store's test carries (QA-48, QA-49):** an unparseable document; an `order` of 10,000 copies of one invalid key (asserted as WORK DONE, validator calls flat); an entry whose `ids` is an array of `HOTSPOT_IDS_PER_REGION_MAX + 1` valid ids (refused in O(1)); an entry with one id failing the shape test in last position (dropped, the region asked again); a non-finite `fetchedAt`; a key of 13 characters; `cap + 1` valid entries (the oldest dropped); a payload one id past the budget (the oldest dropped); and a `__proto__` key written with `JSON.parse`, never an object literal (the key fails `REGION_RE`, and `entries` is read with `Object.hasOwn`, the v0.5.81 rule).

### 7.3 The write-path filter in `frontend/src/lib/hotspotRegionCache.ts` (over eBird's answer)

- **Input:** the `string[]` the transport resolves for one region (the backend already maps `h.locId`; the desktop twin filters `!!id`).
- **Work:** one pass applying the SAME `HOTSPOT_ID_RE` plus the 16-code-unit length check to each id (the writer sanitizes to the validator's exact bounds, the v1.0.11 rule), producing the list the Set holds and the list the document stores. If the filtered list is longer than `HOTSPOT_IDS_PER_REGION_MAX`, the region is answered in memory for the session and NOT persisted (the honest degradation: a region eBird answers with more hotspots than the store admits is re-asked on the next build, exactly today's behaviour for every region). Linear in the answer's length, which the route and the gate bound; no nested scan.
- **Hostile shape:** a region answering with 65,537 valid ids (answered, not persisted, re-asked next build); a region answering with an id of 17 characters (dropped from both the Set and the document).

### 7.4 `.claude/rules/security.md` gate and the other rule files

- The build adds `"frontend/src/lib/hotspotShare*.ts"` and `"frontend/src/lib/hotspotRegionCache*.ts"` to that file's `paths` in the same change, so each module that HOLDS a scan loads the rule. `hotspotSet.ts` holds no new scan (its only read over user-file text is the unchanged `regionsFromObservations`; the id filter lives in the store at the one chokepoint), so it is not added. `.claude/rules/maps.md` already gates `frontend/src/lib/hotspot*.ts`, which covers all three modules; no change there.
- Two rule sentences become false with this change and are corrected in the same change (CLAUDE.md: a claim that reached the prose from the source is swept from the source): `.claude/rules/ui.md`'s `HotspotLink` bullet says "`/map/hotspot-region` is in `CACHED_GET_PATHS`" (it leaves, 9.11), and `.claude/rules/maps.md`'s re-ask bullet says "a region that answered is never re-asked" (true within a build; across builds the TTL re-asks it once). The `hotspotSet.ts` header's "networkCache never holds a 429" sentence is rewritten for the store.

### 7.5 What is NOT read

`submissionId` is used only as the collapse key inside `computeChecklists` (unchanged). No location name reaches the block or the document. No value from the file or the document reaches a URL, a DOM id, an IDREF, a React `key` used as a selector, or `innerHTML`. The document's keys reach exactly one place outside the store: `transport.get('/map/hotspot-region', { regionCode })`, and only keys that are ALSO in the current build's `regionsFromObservations` list are ever asked; a key read from the document is never used to issue a request on its own.

## 8. Where `BirdingStats.tsx` changes

- Line 165 area: add `const resolution = useHotspotResolution()` beside the existing `useHotspotSet()` call; the two memos of 5.5.
- Geographic Stats section (line 1214 onward): a new block rendered immediately before the `{geo.topLocations.length > 0 && (...)}` fragment at line 1364, gated on `hotspotShareView_.kind !== 'hidden'`: `<SubLabel>{HOTSPOT_SHARE_SUBLABEL}</SubLabel>`, the state's rendering, then `<Divider />`. Note FR-02's gate is the CHECKLIST count (`total === 0`), which is independent of `geo.topLocations.length`. The component owns no copy; every string comes from section 6.
- The block renders the bar only in `settled` (`aria-hidden="true"` container, no text inside it, percentages as surface text outside it; FR-19, FR-20, QA-28, QA-29) and the `Button` only in `no-key` (`onClick={onGoToSettings}`; FR-21). No live region (PRD open question 2). No DOM id.
- Nothing else in the tab changes: `projectChecklists`, `isHotspot`, the top-location lists, the map, the county panel and the Projects controller are untouched. The tab never imports the store.

## 9. The durable store: `frontend/src/lib/hotspotRegionCache.ts` (new)

Shape: `lib/countyCompletenessCache.ts`, copied in structure and departing from it in five named places (9.2 the newest-first load walk with eviction at load and a derived payload length; 9.6 the in-flight abandon on invalidation; 9.7 the identical-list refresh; 7.3 the per-region admission bound; and no `isOfflineError` import, because the stale answer is served by the caller holding the list, not by the store catching the error). It imports `./storage` and nothing else at runtime.

### 9.1 Document key, shape and constants

```ts
/** Storage-seam document key (one settings document, the completeness store's shape). */
export const HOTSPOT_REGIONS_STORE_KEY = 'hotspot-regions-v1'

/** TTL: 30 days, as milliseconds (days * hours * minutes * seconds * ms). */
export const HOTSPOT_REGION_TTL_MS = 30 * 24 * 60 * 60 * 1000

/** Entry cap (regions) and the serialized PAYLOAD budget in UTF-16 code units,
 *  summed over `JSON.stringify(ids).length` per entry, keys and envelope excluded. */
export const HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT = 512
export const HOTSPOT_REGIONS_MAX_BYTES_DEFAULT = 8_388_608   // 2^23
export let HOTSPOT_REGIONS_MAX_ENTRIES = HOTSPOT_REGIONS_MAX_ENTRIES_DEFAULT
export let HOTSPOT_REGIONS_MAX_BYTES = HOTSPOT_REGIONS_MAX_BYTES_DEFAULT
export function setHotspotRegionsMaxEntries(n: number): void   // test seam
export function setHotspotRegionsMaxBytes(n: number): void     // test seam

/** Per-entry bounds the load validator and the write filter share. */
export const HOTSPOT_IDS_PER_REGION_MAX = 65_536               // 2^16
export const HOTSPOT_REGION_KEY_MAX_CHARS = 12                 // twin of the route's max_length=12
export const HOTSPOT_ID_MAX_CHARS = 16                         // 'L' plus 15 digits
export const HOTSPOT_ID_RE = /^L[0-9]{1,15}$/

export interface HotspotRegionEntry {
  /** Shape-valid public-hotspot location ids eBird returned; [] is a real answer. */
  ids: readonly string[]
  /** ms epoch of the answer; the TTL anchor. */
  fetchedAt: number
}

export interface HotspotRegionStore {
  version: 1
  /** Keyed by region code ("US-MN"); exactly the keys regionsFromObservations can emit. */
  entries: Record<string, HotspotRegionEntry>
  /** Oldest-fetched first (eviction order). */
  order: string[]
}
```

No `bytes` field is stored (the reference stores one): the payload length is derived from validated ids on every load and on every put (7.2), so the document carries one fewer number a reader would have to trust. `fetchedAt` is `Date.now()` taken in the loader's resolution handler, never in a render.

### 9.2 Validation on load (FR-29, NFR-11)

`sanitizeStore(loaded: unknown): HotspotRegionStore` is exported for the budget test and is the ONE normalizer: `ensureLoaded` runs every document through it, and a purge installs `EMPTY_STORE()`. A non-object, a document without an object `entries` or an array `order`, or one that failed to parse at the seam, is the empty store; nothing throws. The per-entry rules and their order are 7.2. The walk is NEWEST-FIRST over `order` (from the last element) and stops at the first entry that would exceed the entry cap or the payload budget, so a document over either bound sheds its OLDEST entries, which is the same comparator the write path evicts by (9.4); the reference walks oldest-first and does not evict at load, and the difference is deliberate: a single entry here can be 1.2 M code units, so a document written under a different bound, or hand-edited, could otherwise exceed the route on its next write. The admitted entries are re-emitted in their original oldest-first order. Every key read out of `entries` goes through `Object.hasOwn`.

### 9.3 The caps and budget, derived from a measurement (FR-30, NFR-09, QA-49, QA-50)

Measured on Node 24 (scratch script `hotspot-store-size.mjs`, this revision):

| Shape | `JSON.stringify(ids).length` |
|---|---|
| one realistic id (`L` plus 8 digits, eBird's current id width), including its comma | 12 |
| one validator-maximum id (`L` plus 15 digits), including its comma | 19 |
| a county-sized region, 250 ids | 3,001 |
| a mid-sized state, 5,000 ids | 60,001 |
| a large US state, 15,000 ids (Texas and California are each in the low tens of thousands) | 180,001 |
| 20,000 ids | 240,001 |
| 50,000 ids | 600,001 |
| the validator-maximum entry, 65,536 ids of 16 characters | 1,245,185 |

- **`HOTSPOT_IDS_PER_REGION_MAX = 65,536` (2^16).** Four times the largest subnational1 region's hotspot count as the Architect understands it, so every state and province a backup names persists, while a country-level code (which `REGION_RE` admits and which eBird's export never writes into State/Province, but which a hand-edited file could) answering with 150,000 or more ids is answered for the session and not persisted (7.3). **The Engineer confirms the largest-state figure with one live count at build time** (one `ref/hotspot/US-TX` request with the dev key, the id count recorded in the PR), because the Architect's figure is recalled, not measured, and the bound's whole claim is that it sits above the largest real region.
- **`HOTSPOT_REGIONS_MAX_BYTES = 8,388,608` (2^23) code units of payload.** CLAUDE.md's rule is the largest power of two whose worst-case document fits the route: 2^24 would not (16,777,216 payload plus envelope exceeds `_MAX_BYTES`), 2^23 does with 9.26 MB of headroom (below). Realistically: a 50-state lister at 5,000 ids per state is 3.0 M code units; the measured 60-region heavy document at 4,000 ids each is 2.88 MB; a world lister with 300 mostly small regions is well under 2 M. Eviction is therefore an extreme-case clamp, not a working condition.
- **`HOTSPOT_REGIONS_MAX_ENTRIES = 512` (2^9).** eBird has on the order of four thousand subnational1 regions in total, so 512 is above any real lister's key set by a wide margin; it bounds the `order` array's splice-and-shift work and the load walk's entry count rather than the bytes (the budget binds first for any mix of real-sized entries: 512 entries fit the budget only at a mean of 16,384 code units, about 1,365 ids per region).
- **Worst-case document, built and measured:** 6 validator-maximum entries (the most that fit the budget: 7,471,110) plus 506 one-id entries, 512 entries, payload 7,481,230, serialized at **7,520,689 UTF-8 bytes** against the route's **16,777,216**, so it fits with 9.26 MB of headroom; the envelope is 77 bytes per entry. Any admitted document is bounded above by `HOTSPOT_REGIONS_MAX_BYTES + 512 * 97` (the longest envelope: a 12-character key, a 25-character `fetchedAt`, the order entry), under 8.44 MB. No single entry can exceed the budget (1,245,185 < 8,388,608), so the reference's "one sole oversized newest entry" allowance never arises here; the eviction loop keeps the reference's `order.length > 1` guard anyway and the test asserts the invariant that makes it moot.
- **Every number above is read from the exported constants by the tests, never restated** (QA-49: `cap + 1` and `budget + one id` through `setHotspotRegionsMaxEntries` / `setHotspotRegionsMaxBytes` where the full budget would make a unit row slow; QA-50: the shipped defaults, asserted equal to the live bindings, through the real `sanitizeStore`).

### 9.4 Eviction comparator

Oldest `fetchedAt` first, carried by `order` (a put appends; a refresh of an existing region removes its old position and appends, so position tracks age by construction). FIFO-by-age is the right policy here per CLAUDE.md: an eviction costs one redundant request on the next build, which is the cheapest possible loss, and an entry served stale after a failed refresh keeps its old `fetchedAt`, so it is also the first to go, which is right. Evict while over EITHER bound; the just-put tail always survives. The same walk is applied at load (9.2).

### 9.5 Where the document lives, and `docChains`

A settings document, key `hotspot-regions-v1`, through `storage.getSetting` / `setSetting` / `deleteSetting`, exactly the reference. On Tauri the three calls are links on the existing `settings.json` chain (`TauriStorage.chain(SETTINGS_PATH, ...)`, `storage.ts` lines 976 to 1000), so the store's read-modify-write of the shared file is serialized against every other settings writer with no new `docChains` key. On web/Pi the key is its own file through the generic route, capped at `_MAX_BYTES` (9.12). `cacheInventory.test.ts`'s "storage remains an I/O adapter" row is untouched: the budget, the eviction and the debounce live in the store, and `storage.ts` gains no code.

### 9.6 The fetch chokepoint, the purge generation and the in-flight abandon (FR-28, NFR-10, QA-46, QA-51)

```ts
export interface HotspotRegionFetchResult {
  ids: readonly string[]
  fetchedAt: number
  /** True when the loader ran (a live request was made). */
  fromNetwork: boolean
}

/** The one read/fetch chokepoint. A persisted entry within the TTL resolves
 *  with no request. A miss, or an entry past the TTL when `refresh` is true,
 *  runs `loader` (deduped per region), filters its answer (7.3), persists it
 *  (unless over the per-region bound) and resolves it. A loader failure of any
 *  kind rethrows and writes nothing: the CALLER holds the stale list it read
 *  through `peek` and keeps serving it. */
export function dedupedFetch(
  regionCode: string,
  loader: () => Promise<string[]>,
  opts: { refresh: boolean },
): Promise<HotspotRegionFetchResult>

/** The mirror's current entry for a region, after ensureLoaded: fresh or
 *  stale, or null. Never issues a request. */
export function peekRegion(regionCode: string): HotspotRegionEntry | null
export async function ensureLoaded(): Promise<void>

/** Drop every in-flight request's claim to write: a request already running
 *  still settles for whoever awaited it, but it will not be joined by a later
 *  caller and will not persist its answer. invalidateHotspotSet calls this. */
export function abandonInflight(): void
```

- **Purge generation at the chokepoint:** `dedupedFetch` captures `const store = await ensureLoaded(); const mirror = _store` BEFORE calling `loader()`, and `putEntry` writes only while `mirror === _store`. A purge replaces `_store` with a fresh `EMPTY_STORE()` synchronously, so a request begun before the purge and resolved after it compares unequal and writes nothing (the reference's exact mechanism; QA-46's first half). `ensureLoaded`'s parked read checks `if (_store) return _store` after its await, so a purge landing mid-read installs the authoritative empty mirror and the pre-purge document is dropped (QA-46's second half). The chokepoint is inside the store, so no generation argument crosses a module boundary.
- **In-flight dedupe:** `_inflight: Map<string, Promise<...>>` keyed on the region; two concurrent asks of one region share one request (QA-51). The write-after-settle is additionally gated on `_inflight.get(regionCode) === p` (the request is still the current one for its region), which is what `abandonInflight()` clears: `invalidateHotspotSet()` means "the key or file changed", and an answer obtained under the old key must neither be joined by the rebuild (which must ask with the new key) nor be persisted. This is the one place the design departs from the reference, and it is what keeps `hotspotSet.test.ts`'s row "a re-ask answer that started under an older build never lands on the newer one" green with no weakened assertion (section 11). A new region LIST without an invalidation does not abandon: the key is unchanged, so a running request's answer is as good for the new build as for the old.
- **Errors never write, and nothing is cached for a failure:** a rejection (offline, 5xx, 401/403, 429, a non-iterable body) propagates to `askRegions`, which maps it to `'failed'` or `'limited'` as today; the `finally` deletes the in-flight entry; the document and the mirror are untouched (FR-22, QA-41, QA-42, QA-47). No 429 body or marker is ever written anywhere.

### 9.7 TTL and refresh semantics (FR-25, QA-40 to QA-44)

- **TTL 30 days**, the reference's anchor and PRD Open Question 4's default, kept: eBird promotes or demotes a hotspot rarely, the links beside the bar already accepted a session's lag, and a longer TTL would cut refresh requests further at the cost of a demoted hotspot keeping its link for a season; no measurement argues for a different number and parity with `county-completeness-v1` keeps one convention. The constant carries its unit conversion in source.
- A region's entry is **due** when `Date.now() - fetchedAt >= HOTSPOT_REGION_TTL_MS`. A due entry is still served (the build's phase 1 reads it into `_lists`, so the region is `answered` and the Set holds its ids before any request), and it is asked again with ONE request in the build's refresh round (10.4): never on a timer, never more than once per build, and never when `navigator.onLine === false` at the moment the round is assembled.
- **A refresh that succeeds** replaces the entry's `ids` and `fetchedAt` in the document and moves it to the tail of `order`; the module replaces that region's list, rebuilds the union, replaces `_promise` and announces (QA-43). **A refresh that returns the identical list** (compared as sorted arrays, O(n log n) in a list the bound caps) writes the new `fetchedAt` to the document and does not announce, because nothing a consumer reads changed.
- **A refresh that fails or is rate-limited** writes nothing and leaves the stored entry and the `answered` state in place; a 429 joins the re-ask rounds (10.4); after the last round the entry simply stays due and is tried once more on the next build (QA-41, QA-42).

### 9.8 Purge export, the registry row and the inventory row (FR-26, NFR-10, QA-45)

```ts
/** Drop every persisted region from the mirror AND from disk. The PRODUCTION
 *  purge, distinct from the test reset. Registered in lib/clearDerived.ts
 *  because the KEY SET is the list of regions the user has birded, read off
 *  their export; the payloads are eBird's public data. Called only from the
 *  clear-path teardown, never on a replace. */
export async function purgeHotspotRegionStore(): Promise<void> {
  // clear the debounced write timer; _inflight.clear(); _store = EMPTY_STORE();
  // await storage.deleteSetting(HOTSPOT_REGIONS_STORE_KEY)
}
```

- `lib/clearDerived.ts` gains the row `{ slot: 'ebird', store: 'hotspot-regions-v1', purge: async () => (await import('./hotspotRegionCache')).purgeHotspotRegionStore() }`, reached through `import()` like every other row, so the registry's closure stays exactly one file (`entryChunk.test.ts` line 342).
- `cacheInventory.test.ts` gains `['./hotspotRegionCache.ts', 'purgeHotspotRegionStore', 'setting']` in its roster (the `setting` class asserts the purge ends in `storage.deleteSetting(`), and its "durable cache caps stay explicit" row gains a `HOTSPOT_REGIONS_MAX_ENTRIES = 512[\s\S]*HOTSPOT_REGIONS_MAX_BYTES = 8_388_608` pin beside the three existing ones. The `slot: 'ebird'` count follows the roster's length automatically.
- The purge empties the mirror synchronously before awaiting the delete, so a failed delete still leaves the session showing nothing stale and the next Clear re-attempts the document. It cancels the pending flush and clears the in-flight map, so work begun before the purge cannot write (9.6).
- The purge does NOT reach `hotspotSet.ts` (the import runs the other way); every clear path calls `invalidateHotspotSet()` itself (4.6).

### 9.9 The debounced write

As the reference: a 250 ms debounced whole-document `storage.setSetting` of a snapshot (`{ version, entries: { ...entries }, order: [...order] }`), best-effort, errors swallowed, superseded by a purge (the closure holds the pre-purge store and compares it to `_store` before writing). A cold build whose regions answer within a few hundred milliseconds of each other coalesces into one write. On Tauri that write is one `settings.json` read-modify-write on the chain; on web/Pi one POST whose body is the document alone.

### 9.10 The entry chunk: what `entryChunk.test.ts` requires (NFR-10, QA-52)

- `hotspotSet.ts` is on the entry chunk today (through `NamedBirdsTable` -> `useHotspotSet`; `entryChunk.test.ts` line 638 records the chain), and it already reaches `transport.ts`, which reaches `replayStore.ts` and `storage.ts`. The store imports `./storage` only, so a STATIC import of `hotspotRegionCache.ts` from `hotspotSet.ts` adds one small module to the entry chunk and no new external or seam. No row in the guard forbids a store module on the entry chunk in general; the rows that exist pin `lib/countyCompletenessCache.ts` absent (line 328, because that store is reachable only from the lazy Map Explorer) and the registry's closure at one file (line 342). The Engineer adds a positive row: `hotspotRegionCache.ts` IS on the entry chunk, its closure reaches `lib/storage.ts` and no `lib/tauri/*Service.ts`, no maplibre and no recharts; and records the built `dist/assets/index-*.js` size before and after in the PR (expected growth under 3 KB gzipped).
- The lazy alternative (reaching the store from `hotspotSet.ts` through `import()`) was considered and not taken: it would put one chunk round trip on web/Pi ahead of every build, including the warm launch FR-23 wants to be a local read, to save a few kilobytes on a chunk the module already rides.
- `clearDerived.ts` keeps reaching the store through `import()` (9.8), so the registry row costs the entry chunk nothing and the existing closure-of-one assertion keeps holding.
- `hotspotShare.ts` and `hotspotShareCopy.ts` are imported only by the lazy `BirdingStats.tsx` (section 5).
- `ITEM_SUBDIRS` in `lib/icloud/` and its Rust twin are untouched (QA-52).

### 9.11 Leaving `CACHED_GET_PATHS` (FR-28, QA-30)

`/map/hotspot-region` is removed from `CACHED_GET_PATHS` in `lib/transport.ts` (line 282) and stays in `EBIRD_GATED_PATHS` (line 294). One caching layer per call: the durable store owns TTL, in-flight dedupe and eviction for this path, and a 90 s layer above it would only shadow the store for the first 90 s of a session, during which the store already answers from its mirror. The Tauri chokepoint at line 199 gains the same "NOT in CACHED_GET_PATHS: lib/hotspotRegionCache.ts is the one caching layer" comment its three siblings carry. The gate keeps wrapping the loader, so pacing, the cooldown and the bounded retries are unchanged. `cacheInventory.test.ts`'s "live network cache" row reads the transport's `cachedGet` call site, not the path Set, and is unaffected; `transport.test.ts` rows that enumerate `CACHED_GET_PATHS` members, if any, move the path to the gated-only expectation.

A consequence for `hotspotSetRetry.test.tsx` line 105's comment ("here its reply is still in the 90 s network cache"): the reason the answered region is not re-asked in round 1 is now the schedule (a round asks only still-limited regions, pinned in `hotspotSet.test.ts`) AND the store (the region has an entry); the assertion stands and the comment is rewritten (section 11).

### 9.12 The `settingsRouteBudget.test.ts` row (NFR-09, QA-50)

A new `describe('the hotspot-regions store\'s worst-case document fits under the route\'s limit')` in the file's existing shape:

- imports `sanitizeStore as sanitizeHotspots`, the two live caps, their `_DEFAULT` twins, `HOTSPOT_IDS_PER_REGION_MAX`, `HOTSPOT_REGION_KEY_MAX_CHARS` and `HOTSPOT_ID_MAX_CHARS` from `./hotspotRegionCache` (the file's existing `vi.mock('./storage')` covers the store's one import);
- **each-dimension row:** a 12-character key (`ZZ-ZZZZ-0000`) is admitted and a 13-character one refused; a 16-character id is admitted and a 17-character one refused, as is `L` alone, `S1`, `L1a` and `L` with a non-ASCII digit; an entry with `HOTSPOT_IDS_PER_REGION_MAX` ids is admitted and one with one more refused; `fetchedAt` of `LONGEST_FINITE` admitted, `NaN` and a string refused;
- **at the shipped caps, built through `sanitizeStore`:** asserts the live caps equal their defaults; builds `HOTSPOT_REGIONS_MAX_ENTRIES + 1` entries, the first `floor(MAX_BYTES / 1,245,185)` of them validator-maximum (65,536 ids of 16 characters, `fetchedAt: LONGEST_FINITE`, 12-character keys) and the rest one-id entries, then one entry more than the cap; runs it through `sanitizeStore`; asserts `order.length === HOTSPOT_REGIONS_MAX_ENTRIES` (the extra entry evicted at load), the derived payload `<= HOTSPOT_REGIONS_MAX_BYTES`, and `utf8Bytes(JSON.stringify(store)) <= routeLimitBytes()` with the figures in the message; `testTimeout` 60,000 like its siblings (the document is about 7.5 MB; measured 20 ms to parse and 10 ms to serialize, so the bound is generous);
- **a budget-filled variant:** 6 maximum entries plus one entry sized to bring the payload to exactly `HOTSPOT_REGIONS_MAX_BYTES` is admitted whole, and the same document with one more id in the last entry sheds its oldest entry, which is QA-49's budget edge proven through the load path.

The header comment of the test names the store as the third settings-document store with a write-path cap twinned to `_MAX_BYTES` (`settingskv.py`'s own comment at line 46 lists the two; the Engineer adds this one to that comment too, so the Python file's claim stays true).

### 9.13 The accepted cost on Tauri, and the reversal condition

On the Tauri targets every settings key shares `data/settings.json`, and every `getSetting` / `setSetting` of ANY key parses and re-serializes the whole file on the chain. This store's realistic document (2.9 MB for a heavy 60-region lister, measured) adds about 12 ms to each such operation and its worst case (7.5 MB) about 30 ms (20 ms parse, 10 ms stringify, M1 Pro); the reference store already imposes up to 4 M code units on the same file, so this at most doubles a cost the app already pays, and settings writes happen at user-action rate plus the stores' debounced flushes. Accepted. **Reversal condition:** if a settings write becomes visible as latency on any Tauri target (the live look at the built app is where it would show), the store moves to its own document in the `county-day-obs.json` shape (an ordered `writeThrough`, `storage` twins on both transports, an `ordered-writer` inventory row), with no change to its key, validator, caps or the module's exports beyond the three seam calls.

## 10. The build lifecycle in `lib/hotspotSet.ts` with the store (FR-22 to FR-25, FR-28)

`buildAndArm(regions, gen)` becomes four steps; `getHotspotSet` and `loadHotspotSet` keep their signatures and the promise cache keeps keying on the region list.

### 10.1 Phase 1: the local read (no request)

`await ensureLoaded()` (the one disk read per session; a mirror hit thereafter). If `gen !== _buildGen`, return `EMPTY` (superseded; the promise was already replaced). Otherwise, for each region in the build's list, `peekRegion(region)`: an entry (fresh or due) puts its ids into `_lists`; the snapshot is replaced (those regions `answered`, the rest `pending`, `set` = the union), silently. The Engineer may call `ensureLoaded()` at the top of `loadHotspotSet()` so the document read overlaps the backup parse; both are local and either order is correct.

### 10.2 Phase 2: the first ask of the regions with no entry (the only requests a new region costs)

`missing = regions.filter(r => !_lists.has(r))`. If empty, the build resolves NOW with the union: this is the warm launch, zero requests, online or offline (FR-23, QA-36, QA-44). Otherwise `askRegions(missing)` through `dedupedFetch(region, loader, { refresh: false })`, exactly today's build over a shorter list; when it settles with the generation current, each answered region's list joins `_lists`, the snapshot is replaced (answered / unanswered / limited-pending), the limited set arms round 1, and the build resolves with the union (FR-24, QA-38: replacing the backup with one new region issues exactly that region's request). On an empty document this is today's build, request for request and announce for announce, which is what keeps `hotspotSetRetry.test.tsx` green (4.4).

### 10.3 The refresh round (one request per due region, off the critical path)

Assembled after phase 1 and started without awaiting it: `due = regions.filter(r => the entry exists and is past the TTL)`, emptied when `navigator.onLine === false` at that moment. `navigator.onLine` is a hint and never a hard gate on a user-visible request (the house posture in `useOnline.ts`); here it gates an OPTIONAL background refresh of an answer the user already has, which is the one case where skipping on the hint costs nothing the user can see and saves a request that would fail at the socket. The first-ever asks of 10.2 are never gated on it, so the honest unanswered state still follows a real failure. The round calls `askRegions(due)` with `{ refresh: true }`; a landing with the generation current replaces lists, rebuilds the union, replaces `_promise` and announces once if any list changed (9.7); its limited regions join the re-ask rounds below; its failures leave the stale lists in place. One request per due region per build, never a timer of its own (FR-25).

### 10.4 The re-ask rounds (unchanged policy)

`armRetry` / `retryRound` run as today over the still-limited regions, whether limited at phase 2 (a first-ever ask, region `pending`) or in the refresh round (region `answered` throughout, its stale list served). A round's answer for a first-ever region adds its list; for a refreshed region it replaces it. The generation check, the one-timer invariant and the request bound per region per build (`1 + ACTIVITY_RATE_LIMIT_RETRIES` per attempt, `HOTSPOT_RETRY_ROUNDS` rounds) are unchanged, and the module header's accounting is rewritten to add the refresh round as one more attempt per due region.

### 10.5 Request accounting per build (NFR-01)

| Launch | Requests through `/map/hotspot-region` |
|---|---|
| Fresh install or cleared store, R regions | R (plus the bounded re-ask rounds for 429s), as today |
| Every region persisted within the TTL | 0, online or offline |
| Every region persisted, D of them past the TTL, online | D, in the refresh round; the bar renders from the stored lists before any of them lands |
| Every region persisted, some past the TTL, `navigator.onLine === false` | 0 |
| A replaced backup introducing N new regions | N, plus D refreshes if any are due |
| A key save (invalidation) with every region persisted | 0 (Open Question 5), plus D refreshes if any are due |
| An eviction or a dropped entry | that region is asked again on the next build, as a new region is |

The posture is downward from today's "R per launch", never upward, and no new request kind, host or path exists (QA-30: a transport spy over a render with an empty document sees exactly one request per distinct region and nothing new).

## 11. Tests: assertions that pin a per-launch re-fetch, named individually (QA-11)

### 11.1 `frontend/src/lib/hotspotSet.test.ts`

- **MUST CHANGE, one row:** `describe('invalidateHotspotSet') > it('forces a refetch for the SAME regions after invalidation (the key-added / outage-recovery case)')` (lines 123 to 134). Its first build resolves `[]` (`mockResolvedValueOnce([])`), which the row's comment calls a degraded no-key build; under FR-06 and FR-22 an empty resolved list is an ANSWER and is persisted, so after `invalidateHotspotSet()` the rebuild reads US-CA from the document and issues no request: `expect(second).toEqual(['L1', 'L2'])` and `expect(getMock).toHaveBeenCalledTimes(2)` both fail. It is replaced by two rows that between them keep every claim the old row made and add the persistence one: (a) the same scenario with the first build REJECTING `err(401)` (a real no-key failure, which writes nothing), asserting the rebuild refetches and lands `['L1', 'L2']` with two calls (QA-47); (b) the first build resolving `[]`, then `invalidateHotspotSet()`, then a rebuild that issues no further request, reads `answered` for US-CA from the snapshot and `size === 0` (QA-08, QA-53, Open Question 5).
- **Setup change, no assertion weakened:** `vi.mock('./storage', ...)` with an in-memory `Map` behind `getSetting` / `setSetting` / `deleteSetting`, so persistence rows can assert the document (QA-35) and so the real `WebStorage` is never reached; `fresh()`'s `vi.resetModules()` already gives each row an empty mirror.
- **Stand unchanged, with the reason:** `getHotspotSet caching > rebuilds (new promise, refetch) when the region list changes` (two different regions, neither persisted); `re-asking > the three non-429 failures are not re-asked` (a failure writes nothing); `only the rate-limited region is asked again` (the answered region has an entry AND is not in the round's list, two reasons where there was one); `a genuine empty answer is an answer, never re-asked` (now also persisted); `twoRegionsAnsweringInTurn` and its two rows (`notified` 2, one per round that added ids); the three `cancels the re-ask` rows (`when === 'build'`: the invalidation abandons the held request, which then rejects 429 under a moved generation and arms nothing); and `a re-ask answer that started under an older build never lands on the newer one`, which stands ONLY because of 9.6's abandon-on-invalidate: without it the newer build's ask of US-CA would join the held round-1 request through the in-flight map, call 3 would never happen and the stale `['L1']` would both land and persist. That row is therefore also the regression row for the abandon.
- **New rows:** QA-09 (every state through the snapshot, with and without a persisted entry, including answered-throughout during a failing and a rate-limited refresh), QA-10, QA-35, QA-36 (zero requests, every region answered, from a pre-seeded document), QA-38, QA-39, QA-40 to QA-44, QA-45 (through `purgeDerivedOnClear('ebird')` with the real registry and the mocked storage), QA-46, QA-47, QA-51, QA-53, plus the region-over-the-per-region-bound shape of 7.3.

### 11.2 `frontend/src/lib/hotspotSetRetry.test.tsx` (the composed twin)

- **No assertion changes.** Row 1's `expect(notified).toHaveBeenCalledTimes(1)` (line 108) is the pin that section 4.4 and 10.2 are designed around; row 1's `expect(callsFor('US-MN')).toBe(1)` (line 107) stands because a round asks only still-limited regions, and its COMMENT at lines 105 to 106 ("its reply is still in the 90 s network cache") is rewritten, since the path has left that cache. Row 2 (`stops after N rounds ... with no timer left`) stands: a 429 writes nothing, so every round asks.
- **Setup changes, no assertion weakened:** `beforeEach` adds the store's test reset beside `invalidateHotspotSet()` (without it row 1's persisted US-CA and US-MN would answer row 2 with no request, and row 2's `expect(callsFor('US-CA')).toBe(PER_ATTEMPT)` would read 0); and the suite mocks `./storage` with the same in-memory `Map`, because today the only thing keeping the real `WebStorage` from mattering is that the `fetch` stub throws on the settings route, which the store's `catch` happens to swallow. `clearNetworkCache()` in `beforeEach` stays (harmless, and still right for the other cached paths).
- **New rows (siblings in the same file, the real transport and gate):** a round that settles a region with an EMPTY list announces once and persists the empty entry; the final-429 round announces once and persists nothing; a warm launch through the real `CachedTransport` issues zero `fetch` calls (the request-count form of QA-36); a due region's refresh issues one request, serves the stored ids before it lands, and a 429 on it joins the rounds while the region reads answered (QA-40, QA-42 through the real gate).

### 11.3 Elsewhere

- `useHotspotSet.test.tsx` and `HotspotLink.test.tsx` pass unmodified (they mock or do not reach the store).
- `transport.test.ts`: any row enumerating `CACHED_GET_PATHS` members moves `/map/hotspot-region` to the gated-only expectation (9.11).
- `cacheInventory.test.ts`, `settingsRouteBudget.test.ts`, `entryChunk.test.ts`: the rows in 9.8, 9.12 and 9.10.
- New `hotspotRegionCache.test.ts`: the load-path rows of 7.2 and QA-48, the cap rows of QA-49 through the setters, the arithmetic payload identity, the dedupe and abandon rows, the purge rows, and a `vi.mock('./storage')` of the same shape. Its capacity+1 claim is stated as work done (puts, order searches, evictions, as the reference's work-stats seam does), not elapsed time.

## 12. Rules the Engineer can test, one sentence each

- **Partition (QA-04):** for every fixture, the stale-persisted one included, `hotspot + personal + unclassified === total`.
- **Hotspot wins over region state (QA-05, QA-06):** an id that is shape-valid and in `res.set` counts hotspot even if its region reads `pending` or `unanswered`; `"junk"` in an answered region counts personal.
- **Answered-and-empty is answered (QA-08):** a region with `'answered'` and no ids in the Set classifies its checklists personal, leaves `unclassified` at 0, and after a simulated relaunch is read from the document with no request.
- **Absent region is pending:** a checklist whose askable code is not in `byRegion` counts unclassified and its region counts toward `regionsPending`.
- **No region code (QA-19):** `stateProvince` of `null`, `''`, `'us-mn'` or `'U'` counts unclassified and `noRegion`, and does not add to `regionsTotal`.
- **Snapshot transitions (QA-09):** with an empty document, after `getHotspotSet` and before any settle every region reads `pending`; after a list arrives `answered`; after a non-429 rejection `unanswered`; after a 429 with rounds left `pending`; after the final round still 429 `unanswered`; with a persisted entry, fresh or due, `answered` throughout a refresh in flight, failed or rate-limited; and `set` is the same object the promise resolved with.
- **Snapshot reset (QA-10):** `invalidateHotspotSet()` leaves every region `pending` with `set.size === 0` and the epoch advanced by exactly one; the rebuild's phase 1 reads every persisted region `answered` with no request; a new backup with a different region list replaces `regions`.
- **Epoch discipline (QA-11, QA-12, QA-43):** the build's settle (phase 1 and phase 2) does not bump the epoch; a round that adds or replaces a list bumps it once; a round that only settles a region bumps it once; a round that changes nothing, an identical-list refresh included, does not; the four existing suites pass with no weakened assertion beyond the one row named in 11.1.
- **Snapshot before promise:** in a test that awaits `getHotspotSet(obs)`, `getHotspotResolution().set === (await promise)` and no region reads `pending` unless it was limited.
- **Warm launch (QA-36, QA-44):** with every region persisted, building the Set calls the transport zero times, online and with `navigator.onLine` false, and the promise resolves with the union of the stored lists.
- **New region only (QA-38):** with US-MN persisted, a build over US-MN and US-WI calls the transport once, for US-WI.
- **Stale served, refresh bounded (QA-40 to QA-42):** a due region is asked once per build, reads answered and serves its stored ids before the request settles, and a failed or rate-limited refresh leaves the document byte-identical.
- **Errors never persist (QA-47):** after a rejection of any kind the document has no entry for the region and the next build asks again.
- **Validation (QA-48):** each malformed shape of 7.2 is dropped without a throw, the valid entries beside it survive, and an unparseable document loads as empty.
- **Caps (QA-49):** at `cap + 1` entries and at one id past the budget the store evicts the OLDEST to within both bounds, through the setters, with the evicted region asked again on the next build.
- **Route budget (QA-50):** the 9.12 `describe` is green with the shipped defaults.
- **Dedupe and abandon (QA-51):** two concurrent asks of one region share one request; after `invalidateHotspotSet()` a still-running request is not joined and its answer is not persisted.
- **Purge (QA-45, QA-46):** after `purgeDerivedOnClear('ebird')` the document is absent, the mirror empty, every region pending on the next build; a request begun before the purge writes nothing; a parked load does not adopt the old document.
- **Replace keeps entries (QA-39):** a replaced backup, a key save and an iCloud arrival leave the document unchanged.
- **Percent pair (QA-23, QA-24, QA-34):** over a generated grid of `(h, m)`, exactly one of the three displayed shapes holds; `sharePctPair(999, 1000)` is `{ hotspot: '>99%', personal: '<1%' }`.
- **View precedence (QA-13 to QA-18, QA-37):** `no-key` beats every resolution state; `hasEbirdKey === null` is `pending`; `settled` requires `unclassified === 0` and beats `offline`; `offline` requires no pending region.
- **Memo (QA-32):** a re-render with the same `projectChecklists` and `resolution` does not call `computeHotspotShare`; toggling "Count all forms" does not change `total` (QA-03).
- **Linearity (QA-32):** the helper over 150,000 entries costs about 2x the helper over 75,000, read through `cpuTiming.ts`; the load path's validator-call count stays flat over a repeated invalid key.
- **No new request (QA-30):** the set of transport paths issued by rendering the tab is unchanged; `/map/hotspot-region` is absent from `CACHED_GET_PATHS` and present in `EBIRD_GATED_PATHS`; `tauriCsp.test.ts` and `tauriHttpScope.test.ts` pass with no capability or CSP diff.
- **Copy corpus (QA-25, QA-26):** every string the block renders resolves to `hotspotShareCopy.ts`; the generated corpus has no `/\b1 [a-z]+s\b/`, renders 1234 as `1,234`, and contains no U+2014.

## 13. What The Designer decides

- The bar's two fills from the Statistics tab's existing share-bar tokens, its height, and the placement of the two percentages relative to it (beside or above, never inside; FR-20).
- Final wording of the sub-label and the five sentences (defaults in FR-09 to FR-13), moved together with `hotspotShareCopy.ts`, the QA rows and the Help sentence.
- The layout of the counts-so-far sentence under the pending, offline and unanswered states, and the wrapping at 320px and 200% text (NFR-04).
- Whether the `no-key` control reuses `ProjectsSection`'s `sr-proj-link` register or the section's quiet button register.
- What renders during the local document read on a warm launch (Open Question 9): the FR-10 sentence is the default and the QA fallback; holding the previous content is the Designer's option.

Out of the Designer's scope: anything in sections 4, 5, 7, 9 and 10, which are the Engineer's contract.

## 14. Data layer work required

The Engineer's data-layer work, in build order: `lib/hotspotRegionCache.ts` and its test (section 9, 7.2, 7.3); the registry row and the inventory row (9.8); the `settingsRouteBudget.test.ts` `describe` and the `settingskv.py` comment (9.12); `/map/hotspot-region` out of `CACHED_GET_PATHS` with the chokepoint comment (9.11); the `hotspotSet.ts` lifecycle and the snapshot (sections 4 and 10), with the two suites' setup changes and the one replaced row (section 11); the `entryChunk.test.ts` positive row (9.10); the `security.md` `paths` lines and the two rule-sentence corrections (7.4); then the two `lib/` modules (sections 5 and 6), the tab change (section 8) and the Help sentence. No migration: the document did not exist before, and a reader meeting no document treats it as empty (FR-29). No backend change beyond the one comment, no capability or CSP change, no iCloud change.
