# Schema — County Shading and Project Contributions

**Feature:** county-shading-and-project-stats
**Date:** 2026-08-27
**Stage:** 3 — The Architect
**Source:** prd.md (approved, 62 FRs / 14 NFRs / 78 QA rows), strategic-brief.md

---

## Path

**Incremental** — extending the existing data layer.

### Assessment

SnowRaven has no relational store. Its data layer is the parsed eBird export
(`ObservationEntry[]` / `ChecklistEntry[]`), a set of dual-transport routes with
their Tauri service twins, and a family of persisted documents behind the
`storage.ts` seam. This feature adds no tables and no migrations; it adds **one
durable storage-seam document**, **two additive response fields on an existing
route**, and **one shared module-scope asset loader**. That is a genuine
data-layer extension, so the path is Incremental, not frontend-only.

| Question | Finding |
|---|---|
| New tables / columns / migrations? | None — no relational store exists. |
| New endpoint? | **No.** `GET /checklists/{id}` gains two additive fields and one `fields=` flag value. FR-23, FR-25. |
| New persisted state? | **Yes — one document.** `checklist-projects-v1` (FR-33). The county half persists nothing. |
| New data read? | The sweep reads eBird `product/checklist/view/{subId}` once per checklist, on an explicit press only (FR-39). County shading reads nothing new (FR-20). |
| New derived data? | Per-county aggregates and the projects tally — both React-lifetime memos, **never persisted** (FR-34, and §E below). |

The precedent this follows end to end is `pipeline/color-coded-hotspots/schema.md`
(also Incremental), which added `lib/hotspotActivityCache.ts` beside the shipped
`lib/countyCompletenessCache.ts`.

### The two halves carry very different weight

**County shading is light.** No new persisted data, no network, no new
aggregation function. Everything is the shipped `CountyLayer` fed by the shipped
`buildCountyAggregates`. Three things actually need design: the **shared geometry
loader** (§A.1), the **second argument to `buildCountyAggregates` in the
per-species case** (§A.2 — the one place this half can silently produce wrong
numbers), and the **entry-chunk import shape** (§A.4 — where the FR text and the
guard's own mechanics constrain each other).

**Projects is the real work**, and §C–§F are written accordingly.

---

## Current Data-Layer State (what exists, what this feature touches)

### Parsed export (`frontend/src/types.ts`)

| Type | Line | This feature |
|---|---|---|
| `ObservationEntry` | 57–80 | Read. `stateProvince`, `county`, `submissionId`, `date`, `location`, `locationId` are the fields both halves join on. Unchanged. |
| `ChecklistEntry` | 82–101 | Read. `submissionId` + `date` are the projects join key and date source. Unchanged. |

### Shipped county-shading machinery (all reused unchanged)

| Symbol | File:line | Role |
|---|---|---|
| `buildCountyAggregates(observations, checklists)` | `lib/countyShading.ts:72` | Two linear passes → `Map<countyKey, CountyAggregate>`. **`records` comes from the `checklists` argument, not the observations.** |
| `CountyAggregate` | `lib/countyShading.ts:35` | `{ stateProvince, county, species, records, topSpecies[3], topLocations[3] }` |
| `COUNTY_METRIC_META` | `lib/countyShading.ts:204` | `species → 'Distinct species per county'/'Species'`; `records → 'Total checklists per county'/'Checklists'` |
| `computeCountyTiers` / `COUNTY_CLASS_COUNT` | `lib/countyShading.ts:167` / `:157` | 10-class quantile ramp |
| `countyKeyFromState(stateProvince, county)` | `lib/countyBoundaries.ts:201` | `"US-CA" + "Sonoma"` → `"CA|sonoma"`; **null for non-US** → never shaded |
| `CountyLayer` | `components/map/CountyLayer.tsx:127` | `COUNTY_CAP = 800`, the theme observer, the popup, the "Counties in view" disclosure, the hatch sprites |
| `computeChecklists(obs)` | `lib/birdingStats.ts:81` | `ObservationEntry[]` → one `ChecklistEntry` per distinct `submissionId` |
| `assets/us-counties.json` | — | 3,849,098 B raw / ~1.00 MB gz, 3,145 features, dynamic-imported at `MapExplorer.tsx:1005` |

### Shipped durable-cache pattern (the projects store's template)

| Store | Key | Cap policy | Cap | TTL |
|---|---|---|---|---|
| `lib/countyCompletenessCache.ts` | `county-completeness-v1` | FIFO + byte budget | 250 / 4 MB | 30 d |
| `lib/replayStore.ts` | `replay-store-v1` | FIFO + byte budget | 300 / 3 MB | — |
| `lib/hotspotActivityCache.ts` | `hotspot-activity-v1` | FIFO, entry-count only | 2,000 | 6 h |
| `lib/exoticProvenanceCache.ts` | `exotic-provenance-v1` | **two ledgers, opposite policies**: checklists FIFO (32,768), species **admission** (16,384) | — | 30 d |
| **`lib/checklistProjectsCache.ts`** | **`checklist-projects-v1`** | **admission (fill-and-stop)** | **65,536** | **365 d** |

### Shipped eBird pacing contract (reused verbatim)

`lib/rateLimit.ts` — `ACTIVITY_START_SPACING_MS = 150`,
`ACTIVITY_RATE_LIMIT_RETRIES = 2` (3 requests total per item),
`EBIRD_RATE_LIMIT_DETAIL`, `parseRetryAfterSeconds`, `isRateLimitError`.
`lib/ebirdGate.ts` — module-scoped `{ cooldownUntil, cooldownWave, lastStart }`,
`ebirdGateState()`, `ebirdWaitMs(now)`, `gatedEbirdCall<T>(doCall)`.

---

# Part A — County shading (the light half)

## A.1 The shared geometry loader — `lib/countyGeometry.ts` (FR-01, FR-02)

Today the only load site is `MapExplorer.tsx:996-1013`, an `await
import('../assets/us-counties.json')` cached in that component's own
`useState`. A per-mount `useState` cache cannot serve three mount sites: two
components enabling Counties in one session would each import and each parse
3.85 MB.

**New module. Module-scope memo + one in-flight Promise:**

```ts
// lib/countyGeometry.ts
// Dependency-free at runtime by construction: the ONLY import is a TYPE
// import, which is erased at build, so this module can sit in
// entryChunk.test.ts's App-graph negatives without dragging countyBoundaries.ts
// (the same extraction discipline lib/rateLimit.ts records).
import type { CountyFC } from './countyBoundaries'

let _geometry: CountyFC | null = null
let _inflight: Promise<CountyFC> | null = null

/** Parse the US county geometry once per session. Concurrent first calls share
 *  one Promise and one dynamic import (FR-01). A FAILURE IS NEVER MEMOIZED —
 *  `_geometry` is written only on success and `_inflight` is cleared in a
 *  `finally` — so a retry re-imports, matching the durable stores'
 *  errors-never-cached rule. */
export async function loadCountyGeometry(): Promise<CountyFC> {
  if (_geometry) return _geometry
  if (_inflight) return _inflight
  _inflight = (async () => {
    const mod = await import('../assets/us-counties.json')
    const data = ((mod as { default?: unknown }).default ?? mod) as unknown as CountyFC
    _geometry = data
    return data
  })()
  try { return await _inflight } finally { _inflight = null }
}

/** Test seam. */
export function _resetCountyGeometryForTests(): void { _geometry = null; _inflight = null }
```

**The loader throws; it does not swallow.** Each call site keeps its own
`try/catch → leave data null`, which is exactly `MapExplorer.tsx:1007-1009`
today. That is what makes FR-02's "rendered output, loading copy, and timing of
first enable unchanged" true by construction: the MapExplorer diff is one line —
`const mod = await import(...)` + the cast becomes
`setCountyData(await loadCountyGeometry())` — inside the same
`setCountyLoading(true) / try / catch / finally` frame, with
`'Loading county boundaries…'` (`MapExplorer.tsx:1697`) untouched.

**Each host keeps its own `useState<CountyFC | null>`.** The module memo prevents
the second *parse*; the per-host state is what makes React re-render. No
`getCountyGeometry()` synchronous accessor is added — a render-time read of
module state would be a purity hazard for no gain (NFR-10).

## A.2 The per-species aggregate — the correctness hinge (FR-09, FR-10)

`buildCountyAggregates(observations, checklists)` derives `species` from the
**first** argument and `records` from the **second**
(`lib/countyShading.ts:87-115`). FR-09 names only `speciesObs`. Passing the
tab's or the backup's full checklist array as the second argument would shade
**every county the user has ever birded, at its total checklist count**,
regardless of species — a plausible-looking map that is wrong everywhere.

The correct call is the shipped MapExplorer pattern
(`MapExplorer.tsx:1035-1040`) applied to the species slice:

```tsx
// components/SpeciesDetail.tsx
const countyAggregates = useMemo(
  () => (countiesOn ? buildCountyAggregates(speciesObs, computeChecklists(speciesObs)) : null),
  [countiesOn, speciesObs],
)
```

`computeChecklists(speciesObs)` yields one `ChecklistEntry` per distinct
`submissionId` **in the species slice**, so:

| `CountyAggregate` field | Value in the per-species case | FR |
|---|---|---|
| `records` | the user's checklists in that county **that reported this species** | FR-10 |
| `species` | `1` for every shaded county | FR-10 — not rendered |
| `topLocations` | top locations by checklists **reporting this species** there | FR-10 |
| `topSpecies` | the one species, count = its record total there | not rendered |

No signature change, no new aggregation function, one implementation shared with
the Map Explorer (FR-09, QA-15). Counties with no record of the species produce
no work entry and are simply absent from the map → unshaded, outline only
(FR-12's "No records" legend row).

**Statistics (FR-14) is the same call over the memos that already feed
`computeGeo`:**

```tsx
// components/BirdingStats.tsx — filteredObs :331, checklists :333, geo :375
const countyAggregates = useMemo(
  () => (countiesOn ? buildCountyAggregates(filteredObs, checklists) : null),
  [countiesOn, filteredObs, checklists],
)
```

Cross-surface agreement (FR-15 / QA-16) holds at the default setting because
both sides then compute `filterObservations(allObs, false)` over the same parsed
export: MapExplorer hardcodes `includeSpuh = false` (`:1037`), BirdingStats'
`includeSpuh` defaults `false` (`:91`). **The escapee toggle (`includeEscapees`,
`:95`) does not enter `filteredObs`**, so it cannot make the two disagree — which
is also why the Out-of-Scope note about the escapee numerator does not bite here.

## A.3 Memoization boundary and the performance envelope (NFR-01, NFR-02)

Both memos are **gated on the Counties toggle** (`countiesOn ? … : null`). A user
who never enables Counties never runs `buildCountyAggregates` at all — US-05's
"costs me nothing" is structural, not measured. The accepted cost is that
toggling off and on recomputes; that is one build, well inside the ceilings.

`speciesObs` already exists and is memoized on
`[phase, selectedSpecies, mergeSubspecies, countyFilter, dateRange,
hasLocationFilter]` (`SpeciesDetail.tsx:288`). Adding `speciesObs` as the only
input dependency means **switching species reshades and nothing else re-runs**
(FR-11): the geometry is module-scope, the map viewport lives in MapLibre, and
the Counties/Pins-Heatmap toggles are independent `useState`.

Cost model, from the algorithm at `countyShading.ts:87-128` —
`O(C + O + Σ_k (S_k log S_k + L_k log L_k))`:

| Case | C | O | Ceiling |
|---|---|---|---|
| Per-species (NFR-01) | distinct submissions of one species (tens–hundreds) | `speciesObs` (tens–hundreds) | 50 ms |
| Full export (NFR-02) | 3,252 | 21,369 | 200 ms |

The per-species case is two orders of magnitude under its ceiling; the
full-export case is the same work MapExplorer already does on every `phase`
change. NFR-01/02 ask for the isolated baseline's ratio to the ceiling and
demand ≥10x margin — expected to hold comfortably. If it does not, the
approach changes rather than the ceiling: the fallback is a
`Map<speciesName, Map<countyKey, …>>` prepass, **not** a loosened assertion.

`computeCountyTiers` runs in a second memo keyed `[countyAggregates, metric]`,
exactly as `MapExplorer.tsx:1046-1051`.

## A.4 The entry-chunk import shape (FR-21, FR-22, NFR-04)

`entryChunk.test.ts`'s walker (`staticSpecifiers`, `:72-84`) **follows static
edges only** — `import(` never matches `fromRe`, and `import type` is skipped
explicitly. Two consequences that together fix the import shape:

1. **`CountyLayer` and `countyShading` must be STATIC imports at each new host.**
   FR-21's guard-the-guard requires each host's subtree walk to *reach*
   `components/map/CountyLayer.tsx`. A dynamic `CountyLayer` import would make
   that assertion unsatisfiable, and the non-vacuity guard would fail on a
   correct implementation. This is safe because both hosts are already **off the
   App closure** (both mount `SnowMap`, and `entryChunk.test.ts:181-184` asserts
   maplibre is absent from the App externals), so `:123`'s existing
   `CountyLayer` negative is unaffected.
2. **`lib/countyGeometry.ts` is reached by `await import()` at all three call
   sites**, including MapExplorer. FR-21 requires the loader in the App-graph
   negatives *and* absent from both hosts' static subtrees; a uniform dynamic
   edge makes both structural rather than incidental, and costs nothing because
   every call site is already inside an `async` handler.

The geometry itself (`assets/us-counties.json`) is then two dynamic hops from
any host, and `entryChunk.test.ts:127`'s existing negative keeps holding.

**The reusable walker FR-21 asks for.** `buildClosure()` (`:99-116`) and the
Calendar test's ad-hoc copy (`:192-213`) differ only in their root. Refactor to:

```ts
function closureFrom(root: string): { files: Set<string>; externals: Set<string> }
const { files, externals } = closureFrom(APP)
const hasIn = (fs: Set<string>, suffix: string) =>
  [...fs].some(f => f.replace(/\\/g, '/').endsWith(suffix))
const has = (suffix: string) => hasIn(files, suffix)   // existing call sites unchanged
```

Per new host (`components/SpeciesDetail.tsx`, `components/BirdingStats.tsx`):

```ts
expect(has('components/SpeciesDetail.tsx')).toBe(false)          // off the App closure
const sd = closureFrom(resolve(SRC, 'components/SpeciesDetail.tsx'))
expect(hasIn(sd.files, 'components/map/CountyLayer.tsx')).toBe(true)   // guard the guard
expect(hasIn(sd.files, 'assets/us-counties.json')).toBe(false)
expect(hasIn(sd.files, 'lib/countyGeometry.ts')).toBe(false)
expect(sd.files.size).toBeGreaterThan(20)                        // a real graph
```

plus `expect(has('lib/countyGeometry.ts')).toBe(false)` in the App-graph
negatives beside `:123`/`:127`.

> **FR-16's import assertion must name `lib/useCountyCompleteness.ts`, not
> `lib/countyCompleteness.ts`.** `CountyLayer.tsx:28` statically imports
> `CountyCompletenessPopup`, which at its `:13` value-imports `cacheLineText` /
> `monthDay` from `lib/countyCompleteness.ts`. A correct implementation
> therefore *cannot* keep `lib/countyCompleteness.ts` out of the hosts' chunks.
> The controller `lib/useCountyCompleteness.ts` is imported only by
> `MapExplorer.tsx`, which is exactly what FR-16 names. Write QA-18 as: the
> controller module is absent from each host's subtree, the metric group offers
> two options, and zero `/map/county-species` requests are issued in any state.

## A.5 The one modification to a shipped map component

FR-03 requires `CountyLayer` be reused "unmodified **in its shading
behavior**"; FR-10 requires the Species Detail popup to omit the "1 species"
count and name the species. The popup is rendered *inside* `CountyLayer`
(`:377-395`) and `CountyPopupTop` is module-private (`:561`), so the variation
cannot be composed from outside.

**Resolution:** one new optional prop on `CountyLayer`, defaulting to today's
behavior — the same opt-in discipline FR-08 imposes on `SightingsMap`.

```ts
/** Per-species surface (Species Detail): the aggregates were built over ONE
 *  species, so `species` is always 1 and must not be rendered as a count, and
 *  the popup/legend name the bird instead of "Total checklists per county"
 *  (FR-10, FR-12). Absent → today's all-species presentation, byte-identical. */
speciesContext?: { commonName: string } | null
```

`CountyPopupTop` stays private and gains the same optional field; the
top-locations rendering it already owns is reused verbatim, which is what FR-10
asks for. `shade`, `aggregates`, `tiers`, `metric`, `useTextures`,
`onOpenSpecies`, `hasEntryFor`, `taxonCodeFor`, `isPublicHotspot` are all
unchanged.

`SightingsMap` (FR-08) likewise gains opt-in props defaulting to today's
behavior. Its only other production caller is `NamedBirdRow.tsx:169`
(`<SightingsMap markers={cardMarkers} switcher={false} compact />`), which passes
neither and must render byte-identically (QA-09). The Pins branch owns its
`SnowMap` internally, so the county overlay reaches it through explicit props
(`countyData`, `countyShade`, `countyAggregates`, `countyTiers`,
`countyUseTextures`, `speciesContext`) rather than `children` — a `children`
prop would let any future caller inject arbitrary map layers into the Named
Birds card.

FR-07's two-branch rule is not optional: `SpeciesDetail.tsx:1162-1194` is **two
separate `<SnowMap>` mounts** (`SightingsMap` for Pins, a direct `SnowMap` +
`HeatmapLayer` for Heatmap). Both get the overlay; FR-19/QA-20 assert the
off-state separately for each, plus Statistics — three assertions, because one
combined assertion passes on a half-fix.

---

# Part B — The checklist seam, both transports

## B.1 `projId` and `projectIds` (FR-23, FR-24, NFR-09, NFR-12)

Two additive top-level fields on `GET /checklists/{id}`. No new endpoint, no
`vite.config.ts` change (`/checklists` is already proxied).

### Bounds

```
PROJ_ID_RE      ^[A-Z0-9_]{1,32}$      full match, explicit ASCII classes
PROJECT_ID_MAX  999_999_999            9-digit ceiling → the persisted number's
                                       string form is length-bounded
MAX_PROJECT_IDS 8                      array length cap (sampled data: 1;
                                       mirrors MAX_SEEN_PER_SPECIES = 8)
```

Rejected `projId` → `""`. Non-conforming `projectIds` elements are **dropped**
(not coerced, not defaulted); an absent or non-array value → `[]`.

### Two parity traps that the fixture must carry

Both are the reason FR-24 names a trailing-newline row and a non-ASCII-digit
row, and both are live here in a way they were not for `exoticCategory`:

1. **Python `$` admits a trailing newline; JavaScript's does not.** `re.match(r'
   ^[A-Z0-9_]{1,32}$', "EBIRD\n")` succeeds. Use **`re.fullmatch`** with the
   pattern unanchored in the literal — the shipped house form
   (`services/ebird.py:162-186`, `routers/map.py:_RETRY_AFTER_RE`). The JS twin
   anchors in the literal and uses `.test()`.
2. **`isinstance(True, int)` is `True` in Python**, so `projectIds: [true]`
   would normalize to `1`; in JS `typeof true === 'boolean'` rejects it for
   free. The Python element guard must be
   `isinstance(v, int) and not isinstance(v, bool)`. And **never** `int(v)` /
   `str.isdigit()` on a string element — `"١٠٥٠"` parses as `1050` under both.
   Non-integer types are rejected outright, never coerced.

### Shipped code, exported for the parity test

Modeled exactly on `normalizeProvenancePair` (`lib/tauri/checklistService.ts:26-51`)
and `_norm_token` (`services/ebird.py:162-186`) — the parity test drives the
**shipped** function, never a retyped copy.

```ts
// lib/tauri/checklistService.ts — beside normalizeProvenancePair
export function normalizeProjectFields(
  projId: unknown, projectIds: unknown,
): { projId: string; projectIds: number[] }
```

```python
# backend/services/ebird.py — beside _norm_token
_PROJ_ID_RE = re.compile(r"[A-Z0-9_]{1,32}")
PROJECT_ID_MAX = 999_999_999
MAX_PROJECT_IDS = 8

def _norm_project_fields(proj_id, project_ids) -> tuple[str, list[int]]: ...
```

Wired into the two return dicts alongside the existing keys — `services/ebird.py:264-279`
(`fetch_checklist_species`), passed through by `routers/checklists.py:76-88`; and
`lib/tauri/checklistService.ts:151-163`. `ChecklistResult` (`:61-73`) gains the
two fields. The Comparer's narrower `ChecklistData` view
(`lib/compareChecklists.ts:37`) is unaffected — the addition is invisible to it,
exactly as `exoticCategory` was.

### The shared fixture (FR-24, QA-25)

`frontend/src/lib/checklistProjects.fixture.json`, following
`checklistProvenance.fixture.json`'s shape (`_comment` array of doctrine +
`cases`), with three blocks:

| Block | Rows | Must include |
|---|---|---|
| `projIdRows` | `{ why, value, expected }` | `"EBIRD"`, `"EBIRD_ATL_CA"`, `"EBIRD_MERLIN"`, absent, `null`, `123`, `true`, lowercase, 33 chars, `"EBIRD\n"` (**trailing newline**), `"\nEBIRD"`, `"EBIRD\nX"`, `" EBIRD"`, `"EBIRD-CA"` (hyphen out of class), `"٠١٢"` |
| `projectIdsRows` | `{ why, value, expected }` | `[1050]`, `[]`, absent, `null`, `"1050"` (**string, rejected not coerced**), `[true]`, `[1.5]`, `[-1]`, `[1e9]`, `[1_000_000_000]` (over max), 9 elements (over `MAX_PROJECT_IDS`), `["١٠٥٠"]`, `[1050, 1050]` (duplicate — kept raw here, deduped at display) |
| `fieldFlagRows` | `{ fields, skipLocName, skipSpecies }` | `null`, `""`, `"provenance"`, `"projects"`, `"PROJECTS"`, `"projects,provenance"`, `"bogus"` |

Consumed by `frontend/src/lib/checklistProjects.parity.test.ts` and
`backend/tests/test_checklist_projects_parity.py` (path-resolved via
`Path(__file__).resolve().parents[2] / "frontend" / "src" / "lib" / …`, the
shipped pattern). Both carry the four shipped guard shapes: the case loop, a
**non-vacuity** assertion on row counts, an **anchor** mutation guard, and a
**class** mutation guard.

## B.2 The `fields=projects` flag (FR-25, FR-26, FR-27)

`fields` is single-valued whole-string equality on both transports today
(`routers/checklists.py:39`, `transport.ts:128`). Keep it that way — there is no
comma-splitting precedent anywhere in this seam, and inventing one would put
FR-26's byte-identical guarantee at risk for no caller.

**One flag table per runtime, fixture-locked (`fieldFlagRows`):**

| `fields` | `skipLocName` | `skipSpecies` | Behavior |
|---|---|---|---|
| absent / `""` / unrecognized | false | false | today, byte for byte (FR-26) |
| `"provenance"` | **true** | false | today, byte for byte (FR-26) |
| `"projects"` | **true** | **true** | one outbound eBird call, `species: []` (FR-25, QA-26) |

```ts
// lib/checklistFields.ts — no imports; transport.ts rides the entry chunk, so
// this stays dependency-free by extraction (the lib/rateLimit.ts discipline).
export function checklistFieldFlags(
  fields: string | undefined,
): { skipLocName: boolean; skipSpecies: boolean }
```

```python
# backend/services/ebird.py
def checklist_field_flags(fields: str | None) -> tuple[bool, bool]: ...
```

`skipSpecies` lives at the **same layer** `skipLocName` already lives at — the
service on each side — so `ChecklistOptions`
(`lib/tauri/checklistService.ts:53-59`) gains a second negative-sense boolean
matching the shipped shape (FR-27), and `fetch_checklist_species` gains
`skip_species: bool = False`. Under it, each side skips its species-resolution
call (`resolve_species` at `routers/checklists.py:57`; `resolveSpecies` at
`checklistService.ts:125`) **and** the per-observation projection loop, and
returns `species: []`. Every other response field keeps its current shape.

`transport.ts:114-129` becomes:

```ts
if (path.startsWith('/checklists/')) {
  const { getChecklist } = await import('./tauri/checklistService');
  const checklistId = path.slice('/checklists/'.length);   // unchanged — the id is
  return getChecklist(checklistId, checklistFieldFlags(params?.fields)) as Promise<T>;
}                                                          // sliced off the PATH
```

The id slice is untouched, so a query string can never contaminate it (FR-27).

## B.3 The 429 mapper — single-sourced, but only the 429 half (FR-30, FR-31, FR-32)

As shipped the two transports are wrong in **different** ways: the backend turns
an upstream 429 into a **502** through the bare `except Exception`
(`routers/checklists.py:44-54`), and the desktop service raises
`{ status: 429 }` with **no `detail` and no `retryAfterSec`**
(`checklistService.ts:99`). Without both fixed, `retryAfterMsFrom` returns null
on desktop and `isRateLimitError` is false on web — the pacing contract FR-43
depends on is unenforceable on this path.

> **The non-429 branch must NOT be single-sourced.** `_raise_ebird_http_error`
> falls back to `502 "eBird API error: {status}"` and `throwEbirdHttpError` to
> `{ status: 502, detail: "eBird API error: …" }`. The checklist route's shipped
> non-429 shapes are `502 "Could not fetch checklist: {exc}"` (whose detail is
> **load-bearing — the Life List Comparer displays it**) and, on desktop,
> `{ status: res.status }` with `"Could not fetch checklist (HTTP {n})."`.
> Delegating the whole mapper would change both and break FR-32/QA-33. So:
> **the 429 construction and the `Retry-After` parser are single-sourced; each
> route keeps its own non-429 fallback, deliberately different.**

### Backend — new module `backend/services/ebird_errors.py`

```python
EBIRD_RATE_LIMIT_DETAIL = "eBird is limiting requests right now. Try again in a moment."
RETRY_AFTER_CAP_SEC = 60
def parse_retry_after_seconds(value) -> int | None: ...            # moved verbatim
def ebird_rate_limit_exception(exc: httpx.HTTPStatusError) -> HTTPException | None:
    """The 429 half of the shared mapper: the 429 HTTPException when upstream
       said 429, else None so the caller applies ITS OWN non-429 fallback."""
def raise_ebird_http_error(exc: httpx.HTTPStatusError) -> NoReturn:
    """map.py's full mapper: the 429 above, else the generic 502."""
```

- `routers/map.py` deletes its copies and keeps module-level aliases
  (`_RATE_LIMIT_DETAIL`, `_parse_retry_after_seconds`, `_raise_ebird_http_error`)
  bound to the imports, so its five call sites (`:90, :115, :143, :197, :255`)
  and `test_map_router.py`'s existing patch targets keep resolving unchanged.
- `routers/checklists.py` adds `import httpx` and one clause, **inserted after
  `ValueError` and before the bare `except Exception`** — ordering is
  load-bearing, and `LookupError` must stay first because
  `fetch_checklist_species` special-cases 404 before `raise_for_status()`:

```python
except httpx.HTTPStatusError as exc:
    limited = ebird_rate_limit_exception(exc)
    if limited is not None:
        raise limited
    raise HTTPException(status_code=502, detail=f"Could not fetch checklist: {exc}")
```

No web-transport change is needed: `WebTransport.get` already maps any 429 into
`TransportError { status, detail, retryAfterSec }` path-agnostically
(`transport.ts:56-58`).

### Frontend — new module `lib/tauri/ebirdErrors.ts`

`throwEbirdHttpError` is currently module-private at `mapService.ts:27`.
**Extraction is required, not cosmetic**: importing it *from* `mapService.ts`
would pull that service's whole graph into `checklistService`'s chunk.

```ts
// lib/tauri/ebirdErrors.ts — imports only ../rateLimit
export function ebirdRateLimitError(
  res: { status: number; headers: { get(name: string): string | null } },
): Error | null                     // the 429 error, or null
export function throwEbirdHttpError(res): never   // 429 || generic 502
```

`mapService.ts` deletes its copy and imports `throwEbirdHttpError` (its five
call sites unchanged). `checklistService.ts` gains one branch **after** the
existing 404 check (`:96`) and **before** the generic `!res.ok` (`:98-100`),
which keeps every non-429 shape byte-identical:

```ts
if (res.status === 429) { const e = ebirdRateLimitError(res); if (e) throw e }
```

The duck-typed `{ status; headers: { get } }` parameter shape is preserved so
tests can pass hand-rolled responses.

**Per-consumer tests (v0.5.88 rule, NFR-12):** single-sourcing prevents drift,
so each route and each service function keeps its **own** 429 test — a dropped
call site must turn exactly one test red. Add `/checklists/{id}` to
`test_map_router.py`'s rate-limit shape (or a sibling
`test_checklists_rate_limit.py`) and a `checklistService.rateLimit.test.ts`
mirroring `mapService.rateLimit.test.ts`'s `describe.each`.

## B.4 Path-set hygiene (FR-28, QA-29)

`CACHED_GET_PATHS` (`transport.ts:224`) and `EBIRD_GATED_PATHS` (`:232`) are both
matched by exact `Set.has(path)` (`:245`, `:248`), so a prefix route carrying an
id **cannot** be a member as written. Both absences stay deliberate:

- out of `CACHED_GET_PATHS` — the durable stores own this path's caching, and a
  90 s layer would only shadow them (one caching layer per call);
- out of `EBIRD_GATED_PATHS` — the sweep is its own enforcement point (§D.3),
  and one request gets exactly one enforcement point.

Assert the absence **in the form the defect would return in** — a later
well-meaning addition would add a prefix or a member, so test both:

```ts
for (const s of [CACHED_GET_PATHS, EBIRD_GATED_PATHS])
  expect([...s].some(p => p.startsWith('/checklists'))).toBe(false)
```

This requires exporting both sets from `transport.ts` (test-only export, or a
source-text assertion in the `cacheInventory.test.ts` style). Prefer the real
export: a source-text guard cannot see a member added through a variable.

**FR-29 / QA-30:** a project identifier never becomes an `href`, a URL segment,
or an outbound request parameter. No public eBird endpoint resolves one, and
this feature invents no destination. Enforced by the label table returning
plain strings only (§F) and by there being no link component in the Projects
rows.

---

# Part C — The projects store: `lib/checklistProjectsCache.ts`

Template: `lib/exoticProvenanceCache.ts`'s **species index** (admission control),
not its checklist ledger (FIFO). The choice follows what an eviction *costs*:
evicting here destroys a paid-for network answer and, at capacity+1, would do so
on **every pass forever**, never converging. That is the v0.5.87 rule applied,
and it is the opposite of `hotspotActivityCache`'s FIFO, where an eviction costs
one redundant request and loses no answer.

## C.1 Document envelope and entry shape (FR-33, FR-34, FR-36)

```ts
/** OQ-01 default. A submitted checklist's project assignment does not change
 *  retroactively, so this is deliberately an order of magnitude beyond the
 *  escapee store's 30 days. It governs RE-CONSULTATION ONLY (FR-37). */
export const PROJECTS_TTL_MS = 365 * 24 * 60 * 60 * 1000

/** Storage-seam document key. Bump the suffix AND `version` together on any
 *  shape change; a mismatch yields an empty store, never a migration. */
export const PROJECTS_STORE_KEY = 'checklist-projects-v1'

/** OQ-02 default. Fill-and-stop never evicts, so hitting the cap is permanent
 *  for this document — which argues for a cap above any real birder rather
 *  than the escapee ledger's 32,768 (that ledger is FIFO, so its cap is cheap
 *  to hit). 65,536 sits above the highest known personal checklist totals; the
 *  reference account is 3,252. The at-capacity display state ships regardless
 *  (FR-51). Mutable binding + test seam, mirroring PROVENANCE_MAX_CHECKLISTS. */
export let PROJECTS_MAX_CHECKLISTS = 65_536
export function setProjectsMaxChecklists(n: number): void { PROJECTS_MAX_CHECKLISTS = n }

export interface ChecklistProjectsEntry {
  /** Normalized projId, '' when absent or rejected. Bounded ^[A-Z0-9_]{1,32}$. */
  proj: string
  /** Normalized projectIds. Each 0..PROJECT_ID_MAX, at most MAX_PROJECT_IDS. */
  ids: number[]
  /** ms epoch — TTL anchor ONLY. Never displayed: every displayed date comes
   *  from the loaded backup (FR-34). */
  at: number
}

export interface ChecklistProjectsStore {
  version: 1
  /** submissionId -> entry. Every key satisfies SUBMISSION_KEY_RE (validated on
   *  load). Built with a NULL PROTOTYPE (v0.5.90 write-side hygiene): the keys
   *  are external strings, and on a plain `{}` a key of '__proto__' hits the
   *  inherited setter instead of storing an own property. */
  entries: Record<string, ChecklistProjectsEntry>
  /** Admission order, insertion-ordered. It is the CONTAINER admission is
   *  gated on (FR-35) — never an eviction queue, never a scalar counter. */
  order: string[]
}
```

**What is stored is exactly the two normalized fields plus a TTL anchor —
nothing derived.** No dates, no names, no counts, no project labels. That is
FR-34/QA-35, and it is what makes a newer export automatically correct dates and
drop checklists it no longer contains (§E).

**Short field names are deliberate.** At 65,536 entries the key *names* alone
would cost ~1.8 MB as `projId`/`projectIds`/`fetchedAt` versus ~0.5 MB as
`proj`/`ids`/`at` — the `{ seen, n, at }` precedent from
`SpeciesProvenanceRecord`.

**The key regex is not copied.** `exoticProvenanceCache.ts`'s `SUBMISSION_KEY_RE`
carries an explicit instruction not to duplicate it. Hoist it to
`lib/checklistId.ts` — which already documents the alignment of every
checklist-id guard to `{1,15}` and owns the parity fixture that holds it — as
`export const SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/`, re-point
`exoticProvenanceCache.ts` at it, and import it here. `lib/checklistId.ts` has no
imports, so `exoticProvenanceGraph.test.ts`'s import-discipline walk gains one
pure module and stays green (the Engineer should confirm, not assume).

## C.2 Size envelope, stated structurally (FR-36)

No `JSON.stringify` payload budget is added, and none is wanted — every
dimension is bounded, so the document cannot grow without bound, which is what
the rule exists for. A byte product would encode one engine's accounting and can
go false silently (the reasoning `hotspotActivityCache` records).

Bound: ≤ `PROJECTS_MAX_CHECKLISTS` entries, each a key of ≤ 16 chars, a `proj`
of ≤ 32 chars, ≤ 8 integers of ≤ 9 digits, and one ms epoch, plus one `order[]`
key of ≤ 16 chars.

| | per entry | at 3,252 (reference account) | at the 65,536 cap |
|---|---|---|---|
| Realistic (`proj` ≈ 5–12 chars, `ids` 0–1) | ~55 B + ~14 B order | **~225 KB** | ~4.5 MB |
| Adversarial ceiling (every field maxed) | ~155 B + 18 B | ~560 KB | ~11 MB |

The realistic cap figure sits alongside `COMPLETENESS_MAX_BYTES = 4_000_000`,
already this app's accepted settings-document envelope. The adversarial ceiling
requires eBird itself to return eight nine-digit ids and a 32-char portal for
tens of thousands of distinct checklists; it is bounded, stated, and not
defended against further.

## C.3 Load-path validation (FR-33, QA-34)

Per-entry, malformed **dropped**, never thrown on. A corrupt document degrades to
"not cached", which degrades to an unanswered section — never to a render-time
crash.

```ts
export function sanitizeStore(loaded: unknown): ChecklistProjectsStore
```

- document not an object / `version !== 1` / `entries` not an object /
  `order` not an array → **empty store** (no migrations; a shape change bumps
  the key suffix so an old document is orphaned rather than half-read);
- iterate `doc.order`; skip a key that is not a string, fails
  `SUBMISSION_KEY_RE`, is already admitted (duplicate `order` key), or is not an
  **own** property of `doc.entries` — every read through `Object.hasOwn`, never
  a bare index (a bare index on an object literal returns a truthy inherited
  member for at least twelve strings);
- entry must be an object with `typeof proj === 'string' &&
  PROJ_ID_RE_OR_EMPTY(proj)`, `Array.isArray(ids)` with
  `ids.length <= MAX_PROJECT_IDS` and every element a non-negative integer
  `<= PROJECT_ID_MAX`, and `Number.isFinite(at)`; anything else is dropped and
  that checklist simply gets re-asked;
- **stop admitting at `PROJECTS_MAX_CHECKLISTS`** on the load path too, so a
  hand-grown document cannot exceed the cap in memory.

The pollution probe in tests is built with `JSON.parse`, not an object literal —
`{ __proto__: … }` in source sets the prototype and creates no own property,
i.e. tests a shape that cannot arrive from storage.

## C.4 Admission: fill-and-stop (FR-35, NFR-03, QA-36, QA-37)

```ts
if (!Object.hasOwn(store.entries, submissionId)) {
  // Admission gates NEW KEYS ONLY, on the CONTAINER'S OWN SIZE. The v0.5.85
  // defect was a bound enforced by a separate counter that silently inflated
  // until admission closed permanently, invisible in both entries and answers.
  if (store.order.length >= PROJECTS_MAX_CHECKLISTS) { refused = true; return { refused } }
  store.order.push(submissionId)
}
store.entries[submissionId] = { proj, ids, at: nowMs }   // merge is NEVER capped
```

Merging a fresh answer into an existing key is not admission and is never
blocked, so a full store still stays current.

**The capacity+1 measurement (NFR-03) asserts work done, not elapsed time.**
Work stats mirror `ProvenanceCacheWorkStats`, installed only by the test reset
seam so the production path carries no benchmark clocks:

```ts
export interface ProjectsCacheWorkStats {
  loaderCalls: number; merges: number
  admissions: number; admissionsRefused: number
  evictions: number                       // MUST stay 0 — fill-and-stop never evicts
  writeSchedules: number; writeFlushes: number
  lastSnapshotEntries: number
}
export function _getProjectsCacheWorkStatsForTests(): Readonly<ProjectsCacheWorkStats>
export function _resetProjectsCacheForTests(): void
```

Two required tests:

| Test | Asserts |
|---|---|
| **QA-36 — capacity+1** | Set the cap to N via the seam, fill to N, then request key N+1: `admissionsRefused === 1`, `evictions === 0`, `order.length === N`, the N existing entries all still readable, and the N+1th still **returns its answer to the caller** (it is simply not persisted). "Never much worse than not caching" is stated as those counts, never as milliseconds. |
| **QA-37 — admission not consumed** | Re-merge **one** existing id **fifty times** at capacity−1: `admissions === 0` beyond the first, `admissionsRefused === 0`, `order.length` unchanged, and one further **new** key is still admitted afterwards. This is the test that would have caught the v0.5.85 defect. |

## C.5 The one write path (FR-38, QA-40)

Every persisted entry is written through one `dedupedFetch`-shaped chokepoint, so
the entry is fixed-shape by a single write path rather than by each caller's
discipline (the v0.5.92 rule). `mergeEntry` is **not** exported.

```ts
export interface ProjectsFetchResult {
  /** The normalized answer. Present even when `refused` — the caller still
   *  counts it for this session's tally; only persistence was declined. */
  entry: ChecklistProjectsEntry
  fromNetwork: boolean
  /** A NEW key was declined by the cap (drives FR-51's at-capacity state). */
  refused: boolean
}

/**
 * The one fetch chokepoint. A fresh entry short-circuits with NO NETWORK
 * (unless `force`). A miss runs `loader`, deduped per submission id, and
 * merges the result.
 *
 * IMPORT DISCIPLINE: this module touches the storage seam only. The network
 * fetcher is an INJECTED LOADER — it must never import `transport` or any
 * `lib/tauri/*Service` (the exoticProvenanceCache rule, walked by a graph test).
 */
export function dedupedFetchProjects(
  submissionId: string,
  loader: () => Promise<{ projId: string; projectIds: number[] }>,
  opts?: {
    /** OQ-05's "Check again": skip the fresh short-circuit for THIS call. The
     *  in-flight dedupe and the merge are unchanged, so a forced re-ask is
     *  still one bounded request through the one write path (§D.5). */
    force?: boolean
  },
): Promise<ProjectsFetchResult>
```

- `_inflight: Map<string, Promise<…>>`, cleared in a **`finally`**. It lives in
  the store, not the controller, so it holds across controller remounts.
- **Errors are never cached — a 429 included (FR-37).** On any loader rejection
  the chokepoint rethrows and writes nothing, so a retry issues a fresh request.
  There is deliberately **no offline stale-serve branch** here (unlike the
  escapee store): the answer for an already-answered id is already in the
  document and is read by the join, never by a fetch.
- Debounced whole-document write: 250 ms, `storage.setSetting`, best-effort
  `.catch(() => {})` with the in-memory mirror as the live source. The flush
  snapshot is also built with a **null prototype**.
- One disk read per session (`ensureLoaded` + `_loading` coalescing), a
  `getSnapshot()` render-safe synchronous mirror, and
  `getRevision()`/`subscribe()` for `useSyncExternalStore`.
- **`localStorage` is never touched** (NFR-11, QA-73).

## C.6 TTL semantics (FR-37, QA-39)

**The TTL governs re-consultation only, never display.**

| | fresh entry | expired entry | no entry |
|---|---|---|---|
| counts as *checked* | yes | **yes** | no |
| displays | yes | **yes** | — |
| in the next pass's target set | no | **yes** | yes |

A total that blanked itself because a timer expired would be a worse answer than
a slightly old one. And because a submitted checklist's project assignment does
not change retroactively, an expired entry is essentially never wrong — the TTL
exists as a repair path if eBird ever restates one, not as a correctness
mechanism.

---

# Part D — The sweep

## D.1 Target-set derivation and the denominators (FR-41, FR-47, FR-50)

**Nothing about progress is persisted. There is no cursor.** The target set is
recomputed from scratch at every start and resume, which is precisely what makes
"resume after a quit" and "second run after a newer export" the *same operation*
(QA-43). Every figure the section can render is derived from three sets:

```
backupIds   = distinct o.submissionId over the loaded backup's checklists
exportTotal = |{ id ∈ backupIds : SUBMISSION_KEY_RE.test(id) }|      ← THE denominator
skipped     = |backupIds| − exportTotal      (reported only when nonzero — FR-47)
checked     = |{ id : shape-valid ∧ store has ANY entry }|           (fresh OR stale)
remaining   = exportTotal − checked
targetIds   = { id : shape-valid ∧ (no entry ∨ entry stale) }        (normal start/resume)
            = { id : shape-valid }                                    (Check again — §D.5)
unanswered  = ids attempted this session that exhausted retries       (session-only, FR-44)
```

A shape-invalid id is **never requested, excluded from the denominator, and
reported as a skipped count** — it is not silently dropped and not counted as a
failure. Every id is `encodeURIComponent`-wrapped before it reaches the URL
(NFR-09), on top of the shape guard.

**The denominator is carried in the type, not by discipline.** Every status
variant that can render a tally carries `checked` and `total` as required
fields (§D.4), so QA-53's "no tally renders alone" is structurally impossible to
violate.

FR-46 / QA-50: loading a different export increments a generation ref, which
stops the pump and recomputes the target set against the new backup. In-flight
responses still complete **into the store** (the answer is paid for and stays
useful) but their state writes are generation-guarded — the `useHotspotActivity`
deactivation pattern.

## D.2 Ordering (FR-42, QA-44)

Newest first: `ChecklistEntry.date` descending (`YYYY-MM-DD`, lexicographically
sortable), submission id descending as a deterministic tie-break.

```ts
const idNum = (id: string) => Number(id.slice(1))   // safe: the ^S[0-9]{1,15}$ guard
                                                    // bounds it at 10^15 < 2^53
targetIds.sort((a, b) => (dateOf(b) ?? '').localeCompare(dateOf(a) ?? '') || idNum(b) - idNum(a))
```

Numeric on the id, not lexicographic, so `S1000` precedes `S999` the way a
reader expects — and the shape guard is what makes the parse safe. Asserted on a
fixture with date ties.

## D.3 Pacing: the sweep is its own enforcement point (FR-43, NFR-08)

`/checklists/{id}` cannot join `EBIRD_GATED_PATHS` (§B.4), so the sweep owns its
enforcement over the **same shared state** — the same shape as the
hotspot-activity pump, and the reason CLAUDE.md's rule reads "joins
`EBIRD_GATED_PATHS` or owns its enforcement over the shared state — never
neither, never both."

```ts
const res = await gatedEbirdCall(() =>
  transport.get<{ projId: string; projectIds: number[] }>(
    `/checklists/${encodeURIComponent(id)}`, { fields: 'projects' },
  ),
)
```

`gatedEbirdCall` already supplies every element FR-43 names: serialized starts at
`ACTIVITY_START_SPACING_MS` (150 ms), the one key-global cooldown honoring a
bounded `Retry-After`, and `ACTIVITY_RATE_LIMIT_RETRIES` (2) retries per item.
Nothing is re-implemented. A 429 raised by the sweep slows the Map Explorer and
vice versa, because the state is module-scoped in `lib/ebirdGate.ts` (QA-46).

**Concurrency is 1 — a sequential pump, not the activity controller's pool of
4.** The 150 ms spacing is the governor, so a pool buys no throughput; it only
deepens `startChain`'s queue and makes Stop less crisp. Sequential also makes
FR-45 exact: at most one in-flight request may complete after Stop. The estimate
follows directly: 3,252 × 150 ms ≈ 8.1 minutes, which is the floor FR-49
requires the never-run copy to derive from `exportTotal × ACTIVITY_START_SPACING_MS`
rather than hardcode.

## D.4 The status model and one emission source (FR-51, FR-52, FR-53)

Discriminated union, modeled on `ProvenanceStatus`
(`lib/useExoticProvenance.ts:87-104`), in `lib/useChecklistProjects.ts`:

```ts
export type ProjectsStatus =
  | { kind: 'never-run';  total: number; skipped: number; estimateMs: number }
  | { kind: 'running';    done: number; target: number; checked: number; total: number }
  | { kind: 'cooldown';   done: number; target: number; checked: number; total: number
                        ; until: number }
  | { kind: 'stopped';    checked: number; total: number }
  | { kind: 'partial';    checked: number; total: number; remaining: number }
  | { kind: 'complete';   checked: number; total: number }
  | { kind: 'unanswered'; checked: number; total: number; failed: number }
  | { kind: 'at-capacity'; checked: number; total: number; capacity: number }
  | { kind: 'no-key' }
  | { kind: 'offline';    checked: number; total: number }
  | { kind: 'error';      checked: number; total: number }
```

Eleven states, each carrying its own denominator. `no-key` carries none because
it renders no tally.

`'stopped'` is **session-only** — a ref set by the Stop handler. Nothing about a
stop is persisted, so after a relaunch the state resolves to `'partial'`, which
states counts only and cannot claim the user stopped it (FR-51, QA-55). That
honesty falls out of the no-cursor design rather than needing to be enforced.

**One 2,000 ms ticker is the single emission source (FR-52).** The pump mutates
plain counters in refs; a single interval, armed while the phase is `running` or
`cooldown`, reads those refs **and** `ebirdGateState()` inside its callback and
emits exactly one status object. Because sentence, progress bar and `N / M`
readout all render from that one object, they cannot disagree on screen (QA-57)
— structurally, not by discipline.

```ts
export const PROJECTS_ANNOUNCE_INTERVAL_MS = 2000   // the shipped escapee interval
const advance = (next: ProjectsStatus) =>
  setState(prev => ({ status: next, seq: prev.seq + 1 }))
```

- **Bypass the throttle for:** the first definite figure, every `kind` change,
  and every terminal status — called through `advance` directly.
- `statusSeq` increments on **every** update including an identical one, because
  `aria-live` fires on DOM mutation and React bails on an identical text node.
  The component keys its message child on it: `<span key={statusSeq}>` inside
  `<div role="status" aria-live="polite">`, present in the accessibility tree
  from first render and **never** `display: none` (the
  `ExoticProvenanceAccount.tsx:100-102` shape). Any CSS-collapsed disclosure
  carries `inert` while closed, with the live region rendered **outside** the
  inert-able element.
- Every emission constructs a fresh object literal from primitives, so it is a
  frozen snapshot rather than a live accumulator (the v0.5.92 `flushEmit`
  sharpening).
- `role="progressbar"` with explicit `aria-label`, `aria-valuenow={done}`,
  `aria-valuemax={target}` beside the `N / M` readout (FR-53), **conditionally
  rendered** — never `hidden` against an author `display`.

**The cooldown state is observable, and must be emitted before the wait.**
`gatedEbirdCall` sleeps internally, so a cooldown opened mid-call is invisible to
the caller for up to three attempts. The ticker closes that: it reads
`ebirdGateState().cooldownUntil` on every tick, including while a request is
parked inside the gate, and switches to `{ kind: 'cooldown', until }` — a shape
change, so it bypasses the throttle and announces immediately.

**All clock reads live in the ticker, the pump, and handlers — never in a render
body, `useMemo` or `useCallback`** (NFR-10; `react-hooks/purity` is
build-blocking).

Controller surface, mirroring `ExoticProvenanceController`:

```ts
export interface ChecklistProjectsController {
  status: ProjectsStatus
  statusSeq: number
  /** The derived tally, recomputed from (store snapshot × loaded backup). §E. */
  view: ProjectsView
  start: () => void                    // FR-39: the ONLY automatic-free entry
  stop: () => void                     // FR-45
  resume: () => void                   // stopped / partial / unanswered
  checkAgain: () => void               // FR-51 complete state; force path, §D.5
}
```

**FR-39/FR-40 are structural.** There is no auto-start effect — the escapee
controller's `useEffect`-driven start (`useExoticProvenance.ts:374-409`) is
deliberately **not** copied. The hook mounts idle and only a handler calls
`start`. It is mounted by `components/BirdingStats.tsx` and nowhere else, so
QA-42 ("mounting any other tab imports no sweep module") is an import-graph fact.

## D.5 "Check again" needs a force path — a gap in FR-41 as written

FR-41 defines `targetIds` as shape-valid ids **minus those already answered and
still fresh**. Under OQ-01's 365-day TTL, a completed sweep leaves that set empty
for a year — so FR-51's "Check again (complete)" control would be a no-op press
for its entire useful lifetime.

**Resolution:** `checkAgain()` builds `targetIds` from *all* shape-valid ids and
passes `{ force: true }` through the **same** `dedupedFetchProjects` chokepoint
(§C.5). It is not a second write path and not a second enforcement point — the
in-flight dedupe, the pacing, the admission rule and the single write path are
all unchanged. The escapee store's `opts.refetch` is the shipped precedent for
exactly this seam.

The Designer's copy must make the cost visible **before** the press, since a
forced re-ask is the full `exportTotal × 150 ms` again (OQ-05's condition).

## D.6 Failure handling (FR-44, QA-47, QA-48)

A checklist that still fails after `gatedEbirdCall`'s bounded retries is **left
unanswered**: nothing is written to the store, it does not count toward
`checked`, and it is counted in `unanswered`. The pass continues. The
`'unanswered'` state's "Try again" re-asks **only** the unanswered ids and issues
no request for an already-answered one — which falls out of §D.1's derivation
because an answered id has an entry and a failed one does not.

Error classification for `offline` / `no-key` / `error` goes through the shipped
`classifyLiveError` (`lib/offlineMessage.ts:94`), whose `offline → no-key →
error` total order is already the app's. A `no-key` or `offline` classification
also drains the queue — there is no point starting requests that must fail
identically.

---

# Part E — The derived tally: recomputed, never stored

CLAUDE.md's **denormalized-published-field rule** says a denormalized,
published classification field is a legitimate member of a persistent cache
document *when a passive reader structurally cannot re-derive it*, provided the
raw evidence stays the source of truth and the reader **confirms** rather than
trusts it (`ProvenanceSnapshot.excludedNames` is the reference: the Calendar
holds no name-to-code join and may not fetch one).

**That precondition is not met here, so the tally is recomputed.** The only
reader of the projects tally is the Statistics tab's Projects section — the same
surface that owns the sweep and holds the loaded backup. It has the store
snapshot and `ChecklistEntry[]` in hand and can re-derive every figure at zero
network cost. Publishing a denormalized copy would buy nothing and would create
exactly the stale-cache trap the rule warns about: stored counts and date spans
would survive a newer export and quietly contradict the file the user just
loaded. FR-34/QA-35 already require the join; the rule confirms that requirement
rather than carving an exception out of it.

**The derivation (pure, memoized, no clock read):**

```ts
// lib/checklistProjects.ts — pure; no storage, no transport, no clock.
export interface ProjectRow {
  /** Canonical key: both forms of one project collapse to it (FR-54, QA-61). */
  key: string
  label: string
  checklists: number
  /** min/max ChecklistEntry.date over this project's checklists, from the BACKUP. */
  firstDate: string
  lastDate: string
}
export interface ProjectsView {
  projects: ProjectRow[]
  /** FR-56: the subordinate "how you submitted" reading, raw projId values. */
  portals: { code: string; label: string; checklists: number }[]
  checked: number
  total: number
  skipped: number
}
export function deriveProjectsView(
  checklists: readonly ChecklistEntry[],
  snapshot: ReadonlyMap<string, ChecklistProjectsEntry>,
): ProjectsView
```

- **The join direction is backup → store.** Iterate the backup's checklists; look
  up the store; skip misses. A store entry with no backup row contributes
  nothing. That is what makes a newer export correct dates automatically and
  drop checklists it no longer contains — and it means loading a *smaller*
  export correctly reduces `checked`.
- **Projects** (FR-55) = per checklist, the canonical keys of every element of
  `ids`, **plus** the canonical key of `proj` when `proj !== ''` and `proj` is
  not in the generic submission-portal set. Collected into a **Set per
  checklist**, so a checklist naming one project as both `EBIRD_ATL_CA` and
  `1050` contributes exactly one (QA-61).
- **Portals** (FR-56) = a count over the raw `proj` values (excluding `''`),
  denominated by `checked`. Rendered visually and semantically subordinate, never
  as a project.
- **Ordering** (FR-54): checklist count descending, label ascending as the
  tie-break, no rank numbers.
- **Share** always routes through `fmtSharePct(count, checked)`
  (`lib/statsFormat.ts:12`), so a nonzero share never renders a bare rounded
  `"0%"` — it renders `"<1%"`.
- **Earned zero** (FR-55, QA-63): `checked > 0 && projects.length === 0` renders
  a sentence against the denominator, not an empty list. `checked === 0` renders
  no count at all (FR-49).

**Forward-looking boundary.** If a later feature wants projects on a surface that
holds no store access — the Calendar, say — *then* the published-field rule
applies and a published, confirmed list becomes legitimate. It would need the
confirmation step, not just the publication. That is out of scope here and is
recorded so a future run does not read this section as a blanket prohibition.

---

# Part F — The label table (FR-57, NFR-09)

`lib/projectLabels.ts`, a **bundled build-time asset** in the
`PROTOCOL_NAMES` mould (`lib/checklistMeta.ts:7-18`).

```ts
interface ProjectLabel { key: string; label: string }

/** Keyed by BOTH the string code and the numeric id, both pointing at the SAME
 *  entry, so the two forms of one project canonicalize together (FR-57, QA-61). */
const PROJECT_LABELS: Readonly<Record<string, ProjectLabel>> = {
  EBIRD_ATL_CA: { key: 'atl-ca', label: 'California Breeding Bird Atlas' },
  '1050':       { key: 'atl-ca', label: 'California Breeding Bird Atlas' },
  // …known codes and ids only. A name is NEVER invented.
}

/** projId values that are submission portals, not projects (FR-55, the brief's
 *  "'Submitted via Merlin' is not a project"). */
const GENERIC_SUBMISSION_PORTALS: ReadonlySet<string> = new Set(['EBIRD', 'EBIRD_MERLIN'])

/** An identifier not in the table is its OWN canonical key and renders its raw
 *  value verbatim (FR-57, QA-62). Read through Object.hasOwn because the key is
 *  an unvalidated string from an external API. */
export function canonicalProject(identifier: string): ProjectLabel {
  return Object.hasOwn(PROJECT_LABELS, identifier)
    ? PROJECT_LABELS[identifier]
    : { key: identifier, label: identifier }
}
export function isGenericPortal(projId: string): boolean {
  return GENERIC_SUBMISSION_PORTALS.has(projId)   // a Set — no prototype hazard
}
```

**Trust boundary (CLAUDE.md's bundled-asset vs persisted-cache rule).** This
table is code, inlined at build time; an attacker who could change it could
already change the code that reads it. So it needs **no runtime validation** —
the defenses are the type system and the test suite, not a load-path sanitizer.
The persisted store (§C.3) is the opposite case and gets full per-entry
validation. What *is* attacker-influenceable is the **key** — it arrives from the
eBird response — which is why every lookup goes through `Object.hasOwn`. Two
unknown identifiers (`9999` and `FOO_BAR`) are correctly separate keys; the app
cannot know they name the same project and does not guess.

**FR-57 also converts the two shipped bare-index lookups.**
`protocolName` (`checklistMeta.ts:20-23`, `PROTOCOL_NAMES[protocolId] ?? protocolId`)
and `submissionAppName` (`:35-41`, indexed twice) are both keyed on
eBird-supplied strings, so `protocolName('constructor')` returns an inherited
`Object.prototype` member instead of falling through to the raw input. Both
become `Object.hasOwn`-guarded in this change (QA-65). Production callers —
`WeatherBacklog.tsx:150`, `Checklists.tsx:330` and `:485`,
`ChecklistComparer.tsx:448` and `:452` — are unaffected by the fix for every
real code.

---

## Changes in This Feature

### Added

| Path | What |
|---|---|
| `frontend/src/lib/countyGeometry.ts` | Shared geometry loader: module memo + one in-flight Promise, failure never memoized (FR-01) |
| `frontend/src/lib/checklistFields.ts` | `checklistFieldFlags` — the `fields=` flag table, dependency-free (FR-25) |
| `frontend/src/lib/tauri/ebirdErrors.ts` | Extracted `throwEbirdHttpError` + `ebirdRateLimitError` (FR-31) |
| `frontend/src/lib/checklistProjects.ts` | Pure types + `deriveProjectsView` (FR-34, FR-54, FR-55, FR-56) |
| `frontend/src/lib/checklistProjectsCache.ts` | The durable store (FR-33–FR-38) |
| `frontend/src/lib/projectLabels.ts` | Bundled label table + `canonicalProject` (FR-57) |
| `frontend/src/lib/useChecklistProjects.ts` | The sweep controller (FR-39–FR-47, FR-51–FR-53) |
| `frontend/src/lib/checklistProjects.fixture.json` | Dual-runtime parity fixture: `projIdRows`, `projectIdsRows`, `fieldFlagRows` (FR-24) |
| `frontend/src/lib/checklistProjects.parity.test.ts` | JS half of the fixture (QA-25) |
| `backend/tests/test_checklist_projects_parity.py` | Python half of the same fixture (QA-25) |
| `backend/services/ebird_errors.py` | Single-sourced 429 mapper + `Retry-After` parser (FR-30) |
| `frontend/src/components/…` Projects section | The Designer's / Engineer's surface; mounted only by `BirdingStats.tsx` |

### Modified

| Path | Change | Risk |
|---|---|---|
| `backend/routers/checklists.py` | `fields=projects` flag; `projId`/`projectIds` in the response; one `except httpx.HTTPStatusError` clause **before** the bare `except Exception` | **Flagged** — the non-429 502 detail must stay `f"Could not fetch checklist: {exc}"` (the Comparer displays it, FR-32) |
| `backend/services/ebird.py` | `_norm_project_fields`, `_PROJ_ID_RE`, `PROJECT_ID_MAX`, `MAX_PROJECT_IDS`, `checklist_field_flags`, `skip_species` param, two new return keys | Additive |
| `backend/routers/map.py` | Delete the two mapper copies; import from `ebird_errors`, keep the `_`-prefixed module aliases so its five call sites and `test_map_router.py`'s patch targets resolve unchanged | Low; five per-route 429 tests already guard it |
| `frontend/src/lib/tauri/checklistService.ts` | `normalizeProjectFields` (exported), `skipSpecies` in `ChecklistOptions`, two new `ChecklistResult` fields, a 429 branch after the 404 check | **Flagged** — the generic `!res.ok` shape must stay `{ status: res.status }` / `"Could not fetch checklist (HTTP n)."` (FR-32) |
| `frontend/src/lib/tauri/mapService.ts` | Delete the private `throwEbirdHttpError`; import it | Low; `mapService.rateLimit.test.ts` guards all five call sites |
| `frontend/src/lib/transport.ts` | `checklistFieldFlags(params?.fields)` in the `/checklists/` branch; export both path sets for the FR-28 test | Low; the id slice is untouched |
| `frontend/src/lib/checklistId.ts` | Hoist `SUBMISSION_KEY_RE` here as an export (do **not** copy it) | Low; `checklistIdRegexBound.test.ts` + `checklistId.parity.test.ts` guard the literal |
| `frontend/src/lib/exoticProvenanceCache.ts` | Re-point its private `SUBMISSION_KEY_RE` at the hoisted constant | **Flagged** — confirm `exoticProvenanceGraph.test.ts`'s import-discipline walk still passes (`checklistId.ts` has no imports, so it should) |
| `frontend/src/lib/checklistMeta.ts` | `protocolName` / `submissionAppName` → `Object.hasOwn` (FR-57) | Low |
| `frontend/src/components/map/CountyLayer.tsx` | One optional `speciesContext` prop, default null (FR-10) | Additive, opt-in; shading behavior untouched (FR-03) |
| `frontend/src/components/SightingsMap.tsx` | Opt-in county props, all defaulting to today's behavior (FR-08) | **Flagged** — `NamedBirdRow.tsx:169` must stay byte-identical (QA-09) |
| `frontend/src/components/MapExplorer.tsx` | One line: `await import('../assets/us-counties.json')` → `await import('../lib/countyGeometry')` + `loadCountyGeometry()` (FR-02) | Low; same try/catch/finally frame, same copy |
| `frontend/src/components/SpeciesDetail.tsx` | Counties toggle, geometry state, aggregate memo, overlay on **both** map branches (FR-06, FR-07, FR-09) | Two branches, two wirings, two tests |
| `frontend/src/components/BirdingStats.tsx` | Counties toggle + 2-option metric group on Geographic Stats; the Projects section; `NAV_SECTIONS` gains `'Projects'` between `'Effort & Outings'` and `'Data Quality'` (`:83`); the `<SectionCard>` goes at `:1488` | OQ-03 default |
| `frontend/src/lib/entryChunk.test.ts` | `closureFrom(root)` + `hasIn(files, suffix)`; Calendar test uses them; two per-host subtree blocks with guard-the-guard; `lib/countyGeometry.ts` added to the App-graph negatives (FR-21) | — |
| `docs/HELP.md`, `HelpDocs.tsx` TOC, `helpToc.test.ts`, `README.md`, `website/`, `PRIVACY_POLICY.md`, `website/privacy.html`, `CHANGELOG.md`, `frontend/package.json`, `src-tauri/tauri.conf.json` | FR-58–FR-62. `### Projects` goes between `### Effort and Outings` (`HELP.md:201`) and `### Data Quality` (`:205`) | Version 1.0.4 → 1.0.5, both files in lockstep |

### Unchanged (used by this feature, not modified)

`lib/countyShading.ts` — every export, including `buildCountyAggregates`'s
signature, `COUNTY_METRIC_META`'s strings, `computeCountyTiers`,
`COUNTY_CLASS_COUNT = 10`. `lib/countyBoundaries.ts` — `countyKeyFromState`,
`countiesInBounds`, `COUNTY_CAP`'s callers, the whole normalization chain.
`lib/countyTextures.ts`, `countyContrast.test.ts`, the `--sr-county-1..10`
tokens, the hatch sprites, the theme `MutationObserver`.
`lib/birdingStats.ts` — `filterObservations`, `computeChecklists`, `computeGeo`.
`lib/rateLimit.ts` and `lib/ebirdGate.ts` — read and used, not edited.
`lib/statsFormat.ts` — `fmtSharePct`, `fmt`, `sectionSlug`.
`storage.ts` — remains an I/O adapter owning no cache or eviction policy
(`cacheInventory.test.ts` asserts this).
`frontend/vite.config.ts` — `/checklists` is already proxied (FR-23, QA-28).
`lib/useCountyCompleteness.ts`, `lib/useExoticProvenance.ts`, the Weather tab,
the Weather Backlog, the Checklists tab, the List Comparer (FR-26, QA-27).

---

## Migration Plan (build order for the Engineer)

There is no database migration. This is a dependency-ordered build order; each
step is independently testable and leaves the app shippable.

1. **`lib/checklistId.ts`** — hoist `SUBMISSION_KEY_RE`; re-point
   `exoticProvenanceCache.ts`. Run `checklistIdRegexBound.test.ts`,
   `checklistId.parity.test.ts`, `exoticProvenanceGraph.test.ts`.
2. **The 429 mappers** — `backend/services/ebird_errors.py` and
   `lib/tauri/ebirdErrors.ts`; re-point `map.py` and `mapService.ts`. The
   existing per-route 429 tests must pass **before** anything new is added.
3. **`projId` / `projectIds` + `fields=projects`** — the two normalizers, the
   two flag tables, the fixture, both parity tests, and the new per-route 429
   tests on `/checklists/{id}`. This closes FR-23–FR-32 with no UI in play.
4. **`lib/countyGeometry.ts`** + the `MapExplorer.tsx` one-line swap. QA-01,
   QA-02 green before any new mount site exists.
5. **`entryChunk.test.ts` refactor** — `closureFrom` / `hasIn`, Calendar test
   re-pointed, `lib/countyGeometry.ts` negative added. Green on the pre-mount
   tree, so the walker refactor is proven independently.
6. **Species Detail county shading** — both branches, the `SightingsMap` opt-in
   props, the `CountyLayer.speciesContext` prop, the per-species aggregate memo
   (`computeChecklists(speciesObs)` — §A.2), FR-19's Pins and Heatmap off-state
   assertions, and the per-host entry-chunk block.
7. **Statistics county shading** — the toggle, the 2-option metric group, the
   aggregate memo over `filteredObs` / `checklists`, FR-19's third off-state
   assertion, QA-16's cross-surface parity, QA-18's no-Completeness assertions,
   and the second per-host entry-chunk block.
8. **`lib/checklistProjectsCache.ts`** — envelope, `sanitizeStore`, admission,
   `dedupedFetchProjects`, work stats. QA-34, QA-36, QA-37, QA-38, QA-39, QA-40
   green with no controller and no UI.
9. **`lib/projectLabels.ts` + `lib/checklistProjects.ts`** — canonicalization and
   `deriveProjectsView`, pure and fully testable (QA-59, QA-61, QA-62, QA-63,
   QA-65). Convert the two `checklistMeta.ts` lookups here.
10. **`lib/useChecklistProjects.ts`** — target-set derivation, the sequential
    gated pump, the one-ticker emitter, the eleven states, `checkAgain`'s force
    path. QA-41 through QA-58.
11. **The Projects section** — the Designer's copy in the eleven states, the live
    region, the progress bar, the jump-nav chip, the `SectionCard` at
    `BirdingStats.tsx:1488`.
12. **Docs, published surfaces, version bump, changelog** — FR-58–FR-62, all in
    the same change. `grep -n '—'` over every touched user-facing surface.
13. **Gate:** `npm run build` (not vitest and eslint alone) plus
    `cd backend && python -m pytest tests/ -v`, then the post-build
    `dist/index.html` modulepreload assertion (QA-23).

---

## Design Decisions

1. **The per-species second argument is `computeChecklists(speciesObs)`, not the
   backup's checklists.** `records` is derived from the second argument, so the
   obvious reading of FR-09 ("build from `speciesObs`") produces a map that
   shades every county the user has birded at its total checklist count. The
   fix needs no signature change and reuses the shipped MapExplorer pattern —
   but it is the single place this half can be silently, plausibly wrong.

2. **`CountyLayer` and `countyShading` are static imports at the new hosts; the
   geometry loader is dynamic at all three.** `entryChunk.test.ts`'s walker
   follows static edges only, so FR-21's guard-the-guard ("the subtree walk
   reaches `CountyLayer`") is satisfiable *only* with a static `CountyLayer`
   import — and safe, because both hosts are already off the App closure.

3. **The store is fill-and-stop, and `order[]` is a container, not a counter.**
   An eviction here destroys a paid-for network answer and at capacity+1 would
   do so on every pass forever. Admission gates on `store.order.length` — the
   array that holds the keys — which is the v0.5.87 rule's "container's own
   size", not the v0.5.85 defect's separate counter. `order[]` is persisted
   (matching the escapee species index) rather than rebuilt in memory, because
   deviating from a shipped, audited precedent to save ~0.85 MB in a case that
   cannot occur on real data is the wrong trade.

4. **Nothing derived is persisted; the tally is recomputed by joining the store
   against the loaded backup.** CLAUDE.md's denormalized-published-field rule
   permits a published field only when a passive reader *structurally cannot*
   re-derive it. The Projects section owns both the store and the backup, so the
   precondition fails and the rule points at recomputation. Storing counts and
   date spans would be the stale-cache trap the rule warns about: a newer export
   would leave them quietly contradicting the file on screen.

5. **Only the 429 half of the eBird mapper is single-sourced.** The full mapper's
   non-429 fallback is `502 "eBird API error: {n}"`, which would replace the
   checklist route's `502 "Could not fetch checklist: {exc}"` — a string the Life
   List Comparer displays — and the desktop route's `{ status: res.status }`.
   FR-30/31 ask for the shared mapper; FR-32 forbids changing any non-429
   outcome. Splitting at the 429 boundary satisfies both.

6. **The sweep is sequential (concurrency 1), not a pool.** 150 ms spacing is the
   governor, so a pool adds no throughput — only `startChain` queue depth and a
   fuzzier Stop. Sequential makes FR-45 exact (at most one in-flight completion)
   and makes FR-49's duration estimate a clean `exportTotal × 150 ms`.

7. **One 2,000 ms ticker is the single emission source, and it reads the shared
   gate.** The progress sentence, the progress bar and the `N / M` readout render
   from one status object, so they cannot disagree (QA-57). The same tick reads
   `ebirdGateState()`, which is the only way the cooldown state is observable —
   `gatedEbirdCall` sleeps internally, so a cooldown could otherwise stay hidden
   for up to three attempts.

8. **`fields` stays single-valued whole-string equality.** Both transports match
   the whole string today. Introducing comma-splitting would put FR-26's
   byte-identical guarantee at risk for no caller, and there is no precedent for
   it anywhere in this seam.

9. **Short persisted field names (`proj` / `ids` / `at`).** At the cap the key
   names alone would cost ~1.3 MB more in long form; the
   `SpeciesProvenanceRecord` `{ seen, n, at }` precedent already established the
   convention for a high-cardinality persisted document.

10. **The label table gets no runtime validation; its lookups get
    `Object.hasOwn`.** It is a bundled build-time asset — the trust boundary
    CLAUDE.md distinguishes from a persisted runtime cache. Its *keys* come from
    the eBird response, which is the part that needs guarding.

### Open questions, resolved to their stated defaults

| | Resolution |
|---|---|
| OQ-01 TTL | **365 days**, governing re-consultation only (§C.6) |
| OQ-02 capacity | **65,536**, fill-and-stop, at-capacity state ships regardless (§C.1) |
| OQ-03 placement | **After "Effort & Outings"** — `NAV_SECTIONS:83`, `SectionCard` at `BirdingStats.tsx:1488`, `HELP.md` between `:201` and `:205` |
| OQ-04 species metric | **Single on/off**, metric fixed to `records` (§A.2) |
| OQ-05 Check again | **Offered**, through the force path (§D.5), cost stated before the press |
| OQ-06 state wording | The Designer's. The state set, controls and denominators are fixed by §D.4 |

---

## Flags Carried Forward

1. **FR-09 as written would produce a wrong map.** It names only `speciesObs`;
   `records` comes from `buildCountyAggregates`'s second argument. §A.2 is the
   correction. Highest-value item in the county half.
2. **FR-16's import assertion must name `lib/useCountyCompleteness.ts`, not
   `lib/countyCompleteness.ts`.** `CountyLayer` → `CountyCompletenessPopup` →
   `countyCompleteness.ts` is a shipped **value** import, so a correct
   implementation cannot keep that module out of the hosts' chunks. Writing
   QA-18 against the wrong module fails a correct build.
3. **FR-32 vs FR-30/FR-31.** The full shared mapper would change the checklist
   route's non-429 detail strings on both transports, one of which the List
   Comparer displays. §B.3 splits at the 429 boundary; the Engineer must not
   "simplify" it back to one call.
4. **FR-41 leaves "Check again" a no-op for a year.** Under OQ-01's TTL the
   normal target set is empty after a complete sweep. §D.5 adds the force path
   through the same chokepoint. Without it, FR-51's complete-state control does
   nothing.
5. **FR-03 "unmodified" vs FR-10's popup.** `CountyPopupTop` is module-private
   and the popup is owned by `CountyLayer`, so the per-species presentation needs
   one additive, default-off prop. FR-03's own text scopes "unmodified" to
   *shading behavior*, which is preserved exactly.
6. **`SUBMISSION_KEY_RE` must be hoisted, not copied.**
   `exoticProvenanceCache.ts` carries an explicit instruction against a third
   copy. The hoist touches a shipped, audited module — confirm
   `exoticProvenanceGraph.test.ts` stays green rather than assuming it.
7. **The FR-28 test needs both path sets exported from `transport.ts`.** They are
   module-private today. A source-text guard in the `cacheInventory.test.ts`
   style cannot see a member added through a variable, so prefer the real
   test-only export.
8. **Python's `$` and `isinstance(True, int)`** are the two live parity traps for
   `projId`/`projectIds` (§B.1). Both must appear as fixture rows, not just as
   code comments.
9. **`fmtSharePct` has exactly one production caller today**
   (`BirdingStats.tsx:1447`). This feature becomes its second and third. Its
   `"<1%"` behavior is the reason FR-54 routes through it; do not inline a
   percentage anywhere in the Projects section.
10. **`formatDuration` is defined twice** — `statsFormat.ts:24` (minutes) and
    `checklistMeta.ts:51` (hours), with different output vocabularies. The
    duration estimate in FR-49 is in **minutes** and should use neither blindly;
    check which one an import resolves to.
