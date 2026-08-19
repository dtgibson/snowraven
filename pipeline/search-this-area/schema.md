# Schema — Search This Area

**Feature:** search-this-area
**Date:** 2026-08-16
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md

---

## Path

**Frontend Only** — no data layer changes required.

### Assessment

Every functional requirement was read against the four data questions
(new records, new reads, new writes, new relationships). The result:

| Question | Finding |
|---|---|
| New tables / columns / migrations? | None. There is no relational store in this app at all; persistence is the `storage` seam (`AppLocalData/data/*.json` on desktop, `/settings/*` on web/Pi). |
| New persisted state? | **Explicitly forbidden.** FR-28: "Nothing this feature derives shall be persisted." FR-12: the search record "shall be session-only state and shall start empty for every view." NFR-08: no persisted setting. |
| New endpoint or route? | **Explicitly forbidden.** FR-26: "No new backend route, no new Tauri service function, and no new Tauri capability shall be added." The feature re-runs the *existing* `GET /map/hotspots` and `GET /map/recent-obs` calls that `handleFindHotspots` / `handleFindSightings` / `handleFindLifers` already make. |
| New data read? | None. The centre and the radius are both derived arithmetically from `mapBounds`, which `BoundsTracker` already reports (FR-06 forbids even a second reading of `map.getBounds()`); no new fetch, no new storage-seam read, and no settings-store call on the press path (FR-07, FR-08). |
| New derived data that must be stored? | The per-view search record and the announcement sequence. Both are React state with a component lifetime, and the Map Explorer tab stays mounted for the session, so both reset on relaunch — the settled house phrasing is **"per-session, resetting on relaunch"**. |

Classification holds. No migrations, no schema file changes, no storage-seam
keys. The Engineer proceeds straight to UI and module work.

One thing this classification does **not** mean: that there is no design work.
Everything below is the module-level design the Engineer builds against, and it
is the substance of this artifact.

---

## Existing Data and Endpoints This Feature Uses

Nothing new is read. Everything below already exists and is consumed through
the existing call sites.

### `GET /map/hotspots` — unchanged

- Dual transport: `backend/routers/map.py:27` (`get_hotspots(lat, lng, dist=25)`)
  ↔ `frontend/src/lib/tauri/mapService.ts`.
- Params sent: `lat`, `lng`, `dist` (km, integer as string).
- Called once, from `handleFindHotspots` (`MapExplorer.tsx:903`).
- **No pydantic constraints on this route** — `lat: float, lng: float, dist: int`
  are bare. The `[-180, 180]` normalization in FR-07 is therefore load-bearing
  for `/map/recent-obs` only, but is applied uniformly because both handlers
  share one derivation.

### `GET /map/recent-obs` — unchanged

- Dual transport: `backend/routers/map.py:181` ↔ `mapService.getRecentObs`.
- Constraints, verified at source (`map.py:183-185`):
  `lat: ge=-90, le=90` · `lng: ge=-180, le=180` · `dist: ge=1, le=200`.
  These are what QA-09's antimeridian case must not violate.
- Called from `handleFindSightings` (with `codes`) and `handleFindLifers`
  (without `codes`).
- Backend cache is keyed on exact `(lat, lng, dist)` — the reason the brief
  requires rounding the derived centre to 5 dp, and a second reason the derived
  radius snaps to a rung rather than riding the raw covering radius: repeated
  presses at one zoom produce a byte-identical `dist` instead of a float that
  differs in the sixth decimal.

### Existing in-memory state the feature reads

| State | Where | Used for |
|---|---|---|
| `mapBounds: MarkerBounds \| null` | `MapExplorer.tsx:350`, fed by `BoundsTracker` on load + every `moveend` | The only viewport source (FR-06). **Padded** by `VIEWPORT_PAD_FRAC` (0.15); `unpadBounds` inverts it exactly. |
| `lat` / `lng` (strings), `radius` (number, mi) | `MapExplorer.tsx:280-282` | `lat`/`lng` are the shared search centre the press **adopts into** (FR-10). `radius` is **read but never written by this feature** (revision R-01): it is `useState(5)`, overwritten on mount from the saved `map-defaults` `dist` and thereafter only by the sidebar's own SegControl. A press sends its derived radius without touching this state, so the two are allowed to differ. |
| `viewMode: ViewMode` | `MapExplorer.tsx:205` | View scope and per-view record lookup. |
| `hotspotsLoading` / `targetsLoading` / `lifersLoading` | 293 / 320 / 334 | In-flight suppression (FR-14). |
| `sidebarOpen` | 364 | Filters-overlay gate (FR-04). |
| `hasEbirdKey`, `phase.tag` | props / 205ff | The "runnable" precondition (FR-01). |
| `mapMounted` | `MapExplorer.tsx:1057` | Map-present gate. |

### Existing helpers reused verbatim

- `unpadBounds`, `MarkerBounds` — `lib/markersInView.ts:31,10`
- `distanceMiles(lat1, lng1, lat2, lng2): number` (haversine, miles, R = 3958.8) — `lib/mapExplorerFormat.ts:40`
- `applyCenter` — `MapExplorer.tsx:1031`, the dispatch path FR-02 requires
- `geoErrorReducer` / `GEO_ERROR_NONE` — `lib/geoErrorState.ts`, the pattern FR-25 cites
- `MARKER_LAYERS`, `INTERACTIVE_MAP_LAYERS` — `AtlasLayer.tsx:54`, `lib/mapPins.ts:219`

---

## Module Design

Four new files, one shipped file extended, one new stylesheet block.

```
frontend/src/lib/searchArea.ts                    NEW  pure derivation + predicate + geometry
frontend/src/lib/searchOutcomeState.ts            NEW  pure announcement sequence + copy
frontend/src/components/map/SearchedAreaLayer.tsx NEW  the on-map indicator (GL)
frontend/src/components/MapExplorer.tsx           EDIT wiring only
frontend/src/globals.css                          EDIT three new classes
frontend/src/lib/mapExplorerTypes.ts              EDIT one exported type alias
```

---

### 1. `frontend/src/lib/searchArea.ts` — the pure module (NFR-10, QA-39)

No React, no map instance, no clock, no I/O. Every export is a pure function of
its arguments, so QA-39 is satisfied by construction rather than by discipline.

#### Types

```ts
import type { MarkerBounds } from './markersInView'
import type { CenterViewMode } from './mapExplorerTypes'

/** A viewport midpoint on its own. Not what a press sends — that is
 *  `DerivedArea` below — but the intermediate every covering computation is
 *  measured FROM, so it is worth its own name rather than an inline
 *  `{ lat, lng }`. */
export interface SearchCenter {
  /** Midpoint latitude, rounded to 5 dp. */
  lat: number
  /** Midpoint longitude, rounded to 5 dp and normalized into [-180, 180]. */
  lng: number
}

/** FR-07 / FR-08 / FR-09 — everything a press DERIVES from the viewport, which
 *  is everything it sends. */
export interface DerivedArea {
  /** Midpoint latitude, rounded to 5 dp. */
  lat: number
  /** Midpoint longitude, rounded to 5 dp and normalized into [-180, 180]. */
  lng: number
  /** The rung the covering radius snapped up to, in miles. Always a member of
   *  `RUNGS` at or below `DERIVED_MAX_MI`, so the sidebar's SegControl can
   *  always render it and the request can only carry a `dist` the sidebar could
   *  also have sent. */
  radiusMi: number
  /** True when the viewport wanted MORE than `DERIVED_MAX_MI` and the ladder was
   *  narrowed to fit — i.e. the circle does not cover the screen. */
  capped: boolean
}

/** FR-12 — exactly the three values that were sent. Nothing else. It doubles as
 *  the description of a press that has not happened yet: the component composes
 *  the derived values into the record a press WOULD write, which is what the
 *  offer predicate compares. */
export interface SearchRecord {
  lat: number
  lng: number
  radiusMi: number
}
```

**`capped` drives no copy, deliberately.** It exists so a test can assert the cap
fired (QA-19) without reaching for a sentence that does not exist: the design
spec's Content Notes settle that a capped search announces the ordinary sentence
for its view. The capped case is carried entirely by geometry — the circle is
drawn visibly smaller than the viewport — which is exactly what FR-17's indicator
is for, rather than something to paper over with a warning.

**`SearchRecord` drops `capped`, and the omission is load-bearing.** `capped`
describes the DERIVATION, not the request, and FR-12 says the record holds
exactly the three values that went out. Keeping it would make two records with
the same `lat` / `lng` / `radiusMi` compare unequal on a field neither search
ever sent. One shape for "what we searched" and "what we would search" is what
keeps the offer predicate honest: it compares whole payloads rather than a proxy
for part of one.

#### Constants

```ts
/** The existing radius options, ascending, and the single source of truth for
 *  them: `snapRadiusMi` snaps ONTO this ladder, and the SegControl derives its
 *  four options from it. */
export const RUNGS: readonly number[] = [5, 10, 25, 50]

/** FR-09 / OQ-01. The largest radius a PRESS may derive, in miles. The sidebar
 *  still offers all four rungs; this caps only the derived path. */
export const DERIVED_MAX_MI = 25

/** FR-13 / OQ-02. How far the centre must move before the control is offered
 *  again, as a fraction of the RECORDED radius, not a fixed distance. */
export const MOVE_THRESHOLD_FRAC = 0.25

/** Vertices in the indicator ring. 96 keeps the chord error under ~0.06% of r. */
export const AREA_CIRCLE_STEPS = 96
```

**`DERIVED_MAX_MI = 25` caps the derived path only, and the reason is honesty
rather than exposure.** 25 mi is 40 km. The app converts miles to kilometres, so
the shipped 50 mi rung sends `dist=80` while eBird documents 50 km as the maximum
for `ref/hotspot/geo` and `data/obs/geo/recent`, and nothing in this repo clamps
it (OQ-01, open). FR-17 draws a circle *claiming* coverage, and a radius the
provider might silently truncate is a claim this feature cannot vouch for. A user
who picks 50 mi in the sidebar is making their own request, unchanged by this
feature; a user who presses this control is being handed a number they never
chose, so it has to be one that holds. **Conditions for lifting it:** measure
eBird's actual behaviour above 50 km — if it honours the request this becomes 50
and the derived path gains the top rung; if it clamps, the app-wide 50 mi rung is
the thing to revisit, not this constant. Either way it is a one-constant change.

**`MOVE_THRESHOLD_FRAC` is scaled rather than absolute, deliberately.** A fixed
2.5 mi threshold would be half of a 5 mile search and a rounding error in a 25
mile one; the same pan cannot mean the same thing at both ends. It is scaled by
the RECORDED radius rather than the derived one because the recorded radius is
the size of the thing being escaped — and the two only differ when the radius
itself changed, in which case `hasMovedFrom` has already answered true on its
first term and never reaches this comparison.

**`RUNGS` is the single source of truth and the sidebar derives from it.**
`RadiusControl` (`MapExplorer.tsx:1112-1116`) currently holds a second copy of
`[5, 10, 25, 50]` as a `SegControl` options literal. Two copies of the same
ladder in two files is the drift hazard `VIEWPORT_PAD_FRAC`'s own comment was
written about, and here it has teeth: what the derivation snaps to could drift
away from what the control offers, and FR-09's promise is that a press sends
only a distance the user could have picked from that control themselves. So
`RadiusControl`
becomes
`options={RUNGS.map(r => ({ value: String(r), label: `${r} mi` }))}`, which
renders byte-identically (same four options, same labels, same order), and the
component test pins the four rendered labels so the derivation cannot silently
change the shipped control. This is the one place the feature touches a shipped
sidebar control; it is behaviour-preserving and FR-27 is unaffected.

#### Functions

```ts
/** FR-07. Arithmetic midpoint of UNPADDED bounds, rounded to 5 dp, longitude
 *  normalized into [-180, 180]. */
export function areaCenter(unpadded: MarkerBounds): SearchCenter

/** FR-08. Maximum great-circle distance in miles from `center` to the four
 *  corners of `unpadded` — "how big a circle at `center` would have to be to
 *  hold everything on screen". Reuses distanceMiles.
 *
 *  Taking the MAXIMUM over the corners (not the minimum, and not the distance to
 *  an edge midpoint) is exactly the statement "every point on screen is within
 *  this distance of the centre", because on a lat/lng rectangle the farthest
 *  point from the midpoint is always a corner.
 *
 *  Its own function because it has two callers pulling in opposite directions:
 *  `deriveSearchArea` asks how big a circle a press must SEND, and
 *  `viewportCoveredBy` asks the converse question of an ALREADY-SEARCHED circle.
 *  One implementation means the radius a press sends and the coverage test that
 *  later withdraws the offer can never disagree about what "covered" means. */
export function coveringRadiusMi(
  unpadded: MarkerBounds,
  center: SearchCenter,
): number

/** FR-08 / FR-09. The smallest rung that HOLDS `rCover`, and whether the cap bit.
 *  The cap is applied by NARROWING THE LADDER, never by clamping the answer. */
export function snapRadiusMi(rCover: number): { radiusMi: number; capped: boolean }

/** FR-07 / FR-08 / FR-09, and the ONE function MapExplorer calls to read the
 *  map. Takes the PADDED bounds the component already holds and unpads
 *  internally, so FR-06's "one reading, one unpad" is structural rather than
 *  remembered. `null` in (map not loaded yet) -> `null` out. */
export function deriveSearchArea(padded: MarkerBounds | null): DerivedArea | null

/** FR-13(a). Would a press SEND something different from what the record holds?
 *  Two terms: the radius differs AT ALL (a rung change is never noise, and this
 *  is the term that makes zooming work), or the centre moved further than
 *  `MOVE_THRESHOLD_FRAC` x the RECORDED radius.
 *  No record means nothing has been searched on this view, so anything is new. */
export function hasMovedFrom(next: SearchRecord, record: SearchRecord | null): boolean

/** FR-13(b). Is everything on screen already inside the area we searched? Every
 *  corner of the live viewport within the RECORDED radius of the RECORDED
 *  centre. Asked against the RECORD, never the live midpoint. */
export function viewportCoveredBy(
  record: SearchRecord | null,
  padded: MarkerBounds | null,
): boolean

/** FR-13 as shipped: the conjunction. `next` is the record a press WOULD write.
 *  Being a conjunction, (b) can only withdraw an offer (a) would make. */
export function shouldOfferSearchArea(
  next: SearchRecord | null,
  record: SearchRecord | null,
  padded: MarkerBounds | null,
): boolean

/** FR-17. A closed geodesic ring for the indicator, as a GeoJSON Feature. */
export function areaCirclePolygon(
  record: SearchRecord,
  steps: number = AREA_CIRCLE_STEPS,
): GeoJSON.Feature<GeoJSON.Polygon>
```

#### The cap narrows the ladder; it does not clamp the answer

`snapRadiusMi` filters `RUNGS` down to the members at or below `DERIVED_MAX_MI`
and then takes the smallest that holds `rCover`, falling back to the top of that
narrowed ladder. Snapping first and then clamping
(`Math.min(snapped, DERIVED_MAX_MI)`) gives the identical number for today's
constants, and would silently start returning a NON-RUNG the moment either
changed — a size the sidebar has no name for, which would break FR-09's promise
that a press only ever sends a distance the user could have picked. Filtering
first makes "the result is always a rung" true by construction rather than by
coincidence, at every value of both constants.

The consequence worth stating for the security review: the derived path can
therefore only ever send `dist` ∈ {8, 16, 40} km. No viewport, however large or
however malformed, can push a value past the cap into the request.

#### Three ordering decisions that are load-bearing

**(a) Round the centre BEFORE the covering radius is measured from it.** FR-07
says the first half: `unpad → midpoint → round to 5 dp → normalize lng`, with a
final idempotent `round5` after the normalize because the modulo arithmetic can
reintroduce float noise below the 5th decimal. The `rCover → snap → cap` tail
then runs from the ROUNDED centre. The order is load-bearing: `round5` moves the
centre by up to ~0.6 m, so a radius measured from the UNROUNDED midpoint and then
paired with the ROUNDED one describes a circle nobody computed — the corner that
set the maximum can end up a hair outside the circle that actually gets sent.
Measuring from the value that is sent makes "every corner is within `radiusMi` of
(`lat`, `lng`)" an exact statement about the request rather than one that holds to
within a rounding error. The snap up the ladder swallows the difference in
practice, which is precisely why getting this backwards would never show up on
screen, so it is stated here rather than left to be rediscovered. The SAME centre
is then the one written to the fields, sent in the request, stored in the record,
drawn as the circle, and measured against by `viewportCoveredBy` — which reads its
centre from the **record**, so the record's rounded value is the one the coverage
question is asked about.

**(b) `round5(n) = Number(n.toFixed(5))`, not `Math.round(n * 1e5) / 1e5`.**
The component writes the field with `area.lat.toFixed(5)` (the format
`applyCenter` already uses) and sends `area.lat` as a number. Defining `round5`
through `toFixed` makes `.toFixed(5)` idempotent on an already-rounded value, so
the string in the field, the number in the request, and the number in the record
are provably the same value. That is what FR-10's "the sidebar and the map shall
never disagree" asks for, at the arithmetic level.

**(c) Corners stay un-normalized when `coveringRadiusMi` runs.** A viewport
straddling ±180 has a midpoint that normalizes (e.g. 180 → -180) while the
corners are still 179 / 181. This is safe, and deliberately so: haversine's
`sin²(Δλ/2)` term has period 360° in Δλ, so a corner 361° "away" scores exactly
the same as one 1° away. Do not "fix" this by normalizing every corner, and do
not compute a signed longitude delta — that is what would actually break.
`searchArea.test.ts` carries a fixture proving the antimeridian radius equals
the equivalent non-straddling one.

#### The circle ring, and the one edge it does not close

`areaCirclePolygon` walks `steps` bearings from 0 to 360 using the standard
destination-point formula (spherical, R = 3958.8 mi to match `distanceMiles`),
emits the ring closed (first vertex repeated last), and **emits longitudes
continuous relative to the centre — vertices are NOT normalized into
[-180, 180]**. Normalizing per-vertex is precisely what tears a ring that
crosses the antimeridian into a band across the whole map. MapLibre renders a
continuous ring correctly. Stated as a known limit rather than hidden: a search
centred within `radiusMi` of ±180 draws a ring whose vertices run past ±180;
this is cosmetically correct in MapLibre and is not otherwise handled.

---

### 2. `frontend/src/lib/searchOutcomeState.ts` — the announcement (FR-25)

Modelled directly on `lib/geoErrorState.ts`, whose three documented properties
transfer unchanged.

```ts
export interface SearchOutcomeState { text: string; seq: number }
export const SEARCH_OUTCOME_NONE: SearchOutcomeState = { text: '', seq: 0 }

/** Action IS the message: non-empty sets, '' clears.
 *  1. A message ALWAYS advances seq, so an identical repeat is two announcements.
 *  2. A clear NEVER advances it.
 *  3. Clearing when already clear returns the SAME object (bail-out, no re-render). */
export function searchOutcomeReducer(
  prev: SearchOutcomeState,
  text: string,
): SearchOutcomeState
```

Wired as `useReducer`, for the reason `geoErrorState.ts` records: a `useReducer`
dispatch is stable **and** `react-hooks/exhaustive-deps` recognizes it as stable,
so adding an announcement to the three handlers changes no dependency array. A
`useCallback` wrapper would not have that property.

#### The copy, generated not hand-listed

```ts
/** FR-20 / FR-21. Zero, singular and plural for each of the three views. */
export function searchOutcomeMessage(view: CenterViewMode, n: number): string
```

| view | n = 0 (FR-21) | n = 1 (FR-20) | n > 1 (FR-20) |
|---|---|---|---|
| `hotspots` | `No hotspots found in this area.` | `1 hotspot found in this area.` | `{n} hotspots found in this area.` |
| `targets` | `No recent sightings of your target species found in this area.` | `1 recent sighting found in this area.` | `{n} recent sightings found in this area.` |
| `lifers` | `No nearby lifers found in this area.` | `1 location with nearby lifers found in this area.` | `{n} locations with nearby lifers found in this area.` |

Two notes for the Engineer, both easy to get wrong:

- **The `targets` zero-form is deliberately not the plural form's noun phrase.**
  FR-21 specifies "No recent sightings **of your target species** found in this
  area." verbatim. Do not regularize it into "No recent sightings found in this
  area." — the longer form is the one that distinguishes an empty result from a
  broken search, which is the whole point of FR-21.
- **No em dashes** anywhere in this copy (repo-wide rule). None are needed.

#### What `n` counts

Each handler counts **the noun its own sentence names**, taken from the value it
has just set — never from a display-filtered derivative:

| handler | `n` |
|---|---|
| `handleFindHotspots` | `pins.length` (the array passed to `setHotspotPins`, personal locations included; `setHiddenKinds(new Set())` runs first, so every pin is displayed) |
| `handleFindSightings` | `pins.length` from `/map/recent-obs` |
| `handleFindLifers` | `buildNearbyLifers(...).length` — **locations**, matching FR-20's noun for that view |

FR-20 says "the number of results the view will display". For `targets` that is
in tension with the persistent `targetViewMode` / `mediaTypes` filters, which
can hide rows the search returned. **Resolution: announce what the search
returned.** Computing a post-filter count inside the handler would couple it to
four filter states and would go stale the instant a filter changed without a new
search, and the sentence is about the search, not about the filter row. Recorded
as a deliberate reading of FR-20 rather than an oversight; the Designer should
confirm, and the Auditor should see it reasoned.

---

### 3. Where the state lives, and the write that collapses FR-15

#### The record store

```ts
// FR-12 / FR-19. Per-view, session-only, starts empty, never persisted (FR-28).
const [searchRecords, setSearchRecords] =
  useState<Partial<Record<CenterViewMode, SearchRecord>>>({})
```

One map rather than three `useState`s: FR-19's "show the incoming view's record,
or nothing" becomes a lookup, and there is one write shape instead of three.

`CenterViewMode` is added to `lib/mapExplorerTypes.ts` beside `ViewMode`:

```ts
export type CenterViewMode = Extract<ViewMode, 'hotspots' | 'targets' | 'lifers'>
```

#### The headline decision: the three handlers write the record, not the six call sites

FR-15 names six routes that must write the record. Every one of them already
funnels through exactly one of the three fetch handlers — verified call site by
call site:

| FR-15 route | Where | Handler |
|---|---|---|
| This control | new, via `applyCenter` | all three |
| Sidebar Find button | `MapExplorer.tsx:1608`, `1832`, `2027` | direct |
| Place-name search | `1603`, `1762`, `2022` | direct |
| "Use my location" | `1016-1018` | direct |
| Centre pin drop / drag | `2513` (`onDrop`), `2518` (`onMove`) → `applyCenter:1031` | via `applyCenter` |
| View-mode change | `2191-2196` | direct |

So the write belongs **inside each handler, on the success path**, and FR-15
stops being a six-site checklist and becomes a three-site invariant. Three
requirements fall out of that placement rather than needing separate work:

- **FR-16** (a failure must not write) — the write is the last statement of the
  `try` block's success path, after the `set*Pins` call. It is not in `finally`,
  which runs on failure too, and it is not before the `await`.
- **FR-21** (zero results must write) — a successful fetch returning `[]` takes
  the same path.
- **FR-23** (pan during flight) — the written values are the handler's own locals
  `latNum` / `lngNum` / `radiusMi`, all resolved before the `await`. Panning
  mutates `mapBounds`, not those, so the record holds what was *sent*.
  Structural.

**Key the write by the HANDLER, never by `viewMode`.** `handleFindHotspots`
always writes `hotspots`, `handleFindSightings` always `targets`,
`handleFindLifers` always `lifers`. This is not just tidier: at the view-mode
change call site (`2191-2196`) the new mode's handler is invoked while `viewMode`
state still holds the *old* value, so a `viewMode`-keyed write would file that
search under the view the user just left. Keying by handler also keeps `viewMode`
out of the three dependency arrays.

**Use the `useState` setter directly, with no helper:**

```ts
// inside handleFindHotspots, after setHotspotPins(pins)
setSearchRecords(prev => ({ ...prev, hotspots: { lat: latNum, lng: lngNum, radiusMi } }))
setSearchOutcome(searchOutcomeMessage('hotspots', pins.length))
```

A `useState` setter and a `useReducer` dispatch are both stable *and* recognized
as stable by `exhaustive-deps` — the property `geoErrorState.ts` documents at
length. A `useCallback` helper would not be, and would force a change to all
three dependency arrays for no behavioural gain.

#### Where the failure announcement goes

Each handler's existing `catch` gains one line beside the untouched
`set*Error(classifyOverlayError(...))`:

```ts
const e = classifyOverlayError(err, 'Failed to fetch hotspots.')
setHotspotsError(e)          // unchanged rendering path (FR-22)
setSearchOutcome(e.message)  // OverlayError = { kind, message } (MapExplorer.tsx:112)
```

**Scope of announcing:** the success path (FR-20 / FR-21) and the `catch` around
the network fetch (FR-22) — and **not** the `validationError(...)` early returns
("Enter a valid latitude and longitude", "No target species to search for", and
the taxonomy-codes failure). Those are searches that never ran; they keep today's
sidebar-only behaviour, and the line is easy to state and easy to test.

FR-20 and FR-22 are written about "a search", not about "a press", so **every
route announces**, not only this control. That is consistent with FR-15's
every-route posture, puts the record write and the announcement in the same two
places, and is a strict accessibility gain on the existing routes. Recorded as a
deliberate reading for the Designer to confirm.

#### Nothing writes into `.sr-map-geo-error`

FR-22's prohibition is satisfied structurally: `setGeoError` is untouched by this
feature, and the new region is a different element with a different reducer. The
component test asserts `.sr-map-geo-error` stays empty across a failed press.

---

### 4. The explicit radius parameter, and the `fromViewport` flag beside it (FR-11)

**The radius is always `radiusMi`, on every route into these handlers.** Each of
the three fetch handlers takes an `overrideRadius` in its third position, ahead of
the `fromViewport` flag:

```ts
const handleFindHotspots = useCallback(
  async (overrideLat?: number, overrideLng?: number, overrideRadius?: number, fromViewport?: boolean) => {
    const latNum = overrideLat ?? parseFloat(lat)
    const lngNum = overrideLng ?? parseFloat(lng)
    ...
    // `!== undefined`, never a truthiness check: 0 is not a radius this app can
    // produce, but a truthy test would silently swap a future 0 for the state
    // value, and the guard costs nothing.
    const radiusMi = overrideRadius !== undefined ? overrideRadius : radius
    const distKm = Math.round(radiusMi * 1.60934)
```

Identical shape in `handleFindSightings` and `handleFindLifers`.

**Why the parameter exists at all, rather than letting the handler read `radius`
off its closure.** "Search this area" derives its own radius, and under revision
R-01 the sidebar's `radius` keeps holding the **user's** setting for the whole
session. So the two are not a tick apart, they are simply different numbers, and
a handler reading `radius` off its own closure would send the wrong distance on
essentially **every** press — while looking perfectly consistent from the
sidebar, since the sidebar would be the thing it was agreeing with. Passing it
explicitly is what makes the value sent, the value recorded and the value
**drawn** provably the same number. That is the whole of FR-11, and it is a
stronger requirement after R-01 than before it.

The three `useCallback` dependency arrays are **unchanged**: `radius` is still
read from the closure on every route that omits the override, so it stays a
dependency, and the new parameter adds none.

**Every existing caller passes zero or two arguments**, verified at each site
(`1016-1018`, `1603`, `1608`, `1762`, `1832`, `2022`, `2027`, `2191-2196`, and
`applyCenter`), so `overrideRadius` is `undefined` on every shipped path and the
handler falls back to the state value exactly as before (FR-27). The two
prop-passed call sites are safe for the same reason: `CenterPinDropper`'s prop is
typed `(lat: number, lng: number) => void` and `useMapLongPressDrop.ts:56`
invokes it with exactly two arguments; `CenterPin`'s `onMove` is typed the same
and `MapControls.tsx:127` invokes it with exactly two. Neither can leak a third
argument into `overrideRadius` or a fourth into `fromViewport`.

`fromViewport` sits in the fourth position and means "this search's centre came
from the current map viewport, so its results are already framed and the marker
layer must not re-frame them". Optional and falsy by default, on the same FR-27
footing as the radius.

#### The one substantive read of `radius` inside `handleFindHotspots`

Line 919 filters personal locations client-side:

```ts
if (distanceMiles(latNum, lngNum, loc.lat, loc.lng) <= radius) {
```

This **must become `<= radiusMi`**, and it is the one non-mechanical edit in the
three handlers. On a derived press the two values differ, and using the state
value here would filter the personal pins against the pre-press circle while
eBird was asked about the derived one — the map would show personal pins from a
circle eBird was never asked about. Same circle, one variable. It is the only
place in the three handlers where the radius is read for something other than
`distKm`, and the component test drives a fixture where the two candidate values
would give different pin counts.

#### `applyCenter` gains the same optional radius, FORWARDED ONLY (FR-02, FR-10)

```ts
const applyCenter = useCallback((latNum: number, lngNum: number, radiusMi?: number, fromViewport?: boolean) => {
  setLat(latNum.toFixed(5))
  setLng(lngNum.toFixed(5))
  // No setRadius: the Radius control is the user's setting (R-01).
  if (viewMode === 'hotspots') {
    if (!hotspotsLoading && hasEbirdKey !== false) handleFindHotspots(latNum, lngNum, radiusMi, fromViewport)
  } else if (viewMode === 'targets') {
    if (!targetsLoading && hasEbirdKey !== false && phase.tag === 'ready') handleFindSightings(latNum, lngNum, radiusMi, fromViewport)
  } else if (viewMode === 'lifers') {
    if (!lifersLoading && hasEbirdKey !== false && phase.tag === 'ready') handleFindLifers(latNum, lngNum, radiusMi, fromViewport)
  }
}, [/* unchanged */])
```

**There is no `setRadius` call here, and its absence is the substance of
revision R-01.** `applyCenter` adopts the **centre** into the coordinate boxes
and forwards the radius to the handler; it does not write the radius into the
sidebar's SegControl. The Radius control is the user's setting, and only the
sidebar writes it — so `MapExplorer.tsx` has exactly **two** `setRadius` callers
(the saved `map-defaults` on mount, and the SegControl's own `onChange`), and a
structural test enumerates them precisely because a third reintroduced here would
move the user's setting from several gestures at once with the behavioural tests
for the other views still green.

**`overrideRadius !== undefined`, never a truthiness test.** The guard lives at
the point of use inside each of the three handlers, for the reason they state: 0
is not a radius this app can produce, but a truthy test would silently swap a
future 0 for the state value, and the explicit guard costs nothing. It is worth
an assertion of its own — a truthiness mutant is exactly the kind of detail a
review praises and no test pins.

Every shipped caller omits both trailing arguments and therefore neither adopts a
centre-derived radius nor changes the results fit, exactly as before. `fromViewport` is **forwarded, not
interpreted**; the pin drop and drag (`onDrop={applyCenter}` /
`onMove={applyCenter}`) invoke with exactly two arguments, so they keep their
results fit — the shipped behaviour. Only this control's press passes both.

The press is then one call, and it is literally the pin-drop path FR-02 demands:

```ts
applyCenter(pendingSearch.lat, pendingSearch.lng, pendingSearch.radiusMi, true)
```

Centre AND radius, both derived and both **sent** (FR-11). The centre is also
adopted into the sidebar's coordinate boxes (FR-10); the radius is not, so the
sidebar goes on showing whatever the user set (R-01). Passing the radius rather
than letting the handler read state is what makes the value sent and the value
**drawn** the same number.

---

### 5. The control, and the FR-24 retained state

#### The render gate

```ts
const derivedArea = useMemo(() => deriveSearchArea(mapBounds), [mapBounds])  // pure, O(1), no clock
// The record a press WOULD write, which is exactly what it would send. `capped`
// is dropped here deliberately: it describes the DERIVATION, not the request
// (FR-12). The press sends these same values through `applyCenter`, and the
// record the handlers write is built from the arguments they were called with,
// so the control cannot be offered on the strength of one radius and then send
// another — the FR-11 property the explicit radius argument exists for.
const pendingSearch = useMemo<SearchRecord | null>(
  () => (derivedArea
    ? { lat: derivedArea.lat, lng: derivedArea.lng, radiusMi: derivedArea.radiusMi }
    : null),
  [derivedArea],
)
const activeRecord = isCenterView ? searchRecords[viewMode as CenterViewMode] ?? null : null
const activeLoading = viewMode === 'hotspots' ? hotspotsLoading
                    : viewMode === 'targets'  ? targetsLoading
                    : viewMode === 'lifers'   ? lifersLoading : false
const activeRunnable = viewMode === 'hotspots' ? hasEbirdKey !== false
                     : (viewMode === 'targets' || viewMode === 'lifers')
                       ? (hasEbirdKey !== false && phase.tag === 'ready') : false
const searchMoved = shouldOfferSearchArea(pendingSearch, activeRecord, mapBounds)

// FR-01, all six conditions, in the PRD's order.
const showSearchArea =
  isCenterView && mapMounted && !sidebarOpen && activeRunnable && !activeLoading && searchMoved
```

`activeRunnable` reproduces `applyCenter`'s condition (`MapExplorer.tsx:1035-1039`)
and not the stricter `targetsFetchDisabled` used at the view-mode switch — the
PRD's "Out of Scope" section explicitly adopts `applyCenter`'s condition so the
press behaves exactly like a pin drop and leaves the pre-existing discrepancy
alone.

`useMemo` over `mapBounds` means the derivation runs once per `moveend` and does
no network, no layout and no allocation beyond one small object (NFR-13, QA-41).
The `pendingSearch` memo adds one more small object on the same schedule, and
nothing else. No `Date.now()`, no `new Date()` anywhere on this path (NFR-04).

**Why the predicate takes `mapBounds` as well as the two records.** FR-13(b) asks
whether the live viewport is already inside the recorded circle, which needs the
viewport itself, not a summary of it. Both arguments describe ONE reading of the
bounds — `pendingSearch` is derived from the same `mapBounds` tuple — so FR-06's
"one reading, one unpad" holds through both conjuncts.

**Why BOTH conjuncts are needed, and which case each one carries.**
`hasMovedFrom` asks "would a press send something different"; the user's question
is narrower, "is there anything on screen I have not searched yet". They come
apart when the user ZOOMS IN after a search: the covering radius drops a rung, so
`hasMovedFrom` answers true on its radius term, but the smaller circle a press
would send is entirely inside the one already fetched and every pin on screen is
already there — so the coverage test withdraws the offer. Being a conjunction it
can only ever withdraw, never create, which is why FR-05's "no search without an
explicit press" and the no-record case are untouched. The converse case is the
one the cap creates: past `DERIVED_MAX_MI` the circle is deliberately SMALLER
than the viewport, so `viewportCoveredBy` is false and stays false however long
the map sits still. Coverage ALONE would offer the control permanently on a map
nobody has moved, every press sending the identical centre and the identical
capped radius; `hasMovedFrom` answers false there and withholds it. Their ORDER
is not load-bearing (both are pure and total); what is load-bearing is that both
are present.

#### The retained already-searched state

```ts
const [retainSearchBtn, setRetainSearchBtn] = useState(false)
const showRetained = !showSearchArea && retainSearchBtn
                     && isCenterView && mapMounted && !sidebarOpen
```

Note `showRetained` re-asserts the three *scope* conditions. `retainSearchBtn`
overrides only the **moved** and **in-flight** conditions — the two that the
press itself flips — never the view, the map, or the overlay. Without that, a
retained ghost could survive onto a view where the control has no meaning.

Press handler:

```ts
onClick={e => {
  if (!showSearchArea || !pendingSearch) return        // the no-op in the retained state (FR-24)
  // Read in an event handler, never in render. Distinguishes the keyboard/Enter
  // case (the control holds focus) from the WKWebView pointer case (it never
  // did), which FR-24 permits removing immediately.
  if (document.activeElement === e.currentTarget) setRetainSearchBtn(true)
  // Centre AND radius, both derived and both sent; the centre is also adopted
  // into the sidebar, the radius deliberately is not (R-01). The fourth
  // argument suppresses the results re-fit.
  applyCenter(pendingSearch.lat, pendingSearch.lng, pendingSearch.radiusMi, true)
}}
onBlur={() => setRetainSearchBtn(false)}
```

`aria-disabled="true"` in the retained state, **never the `disabled` attribute** —
disabling a focused button drops focus to `<body>`, which is the exact failure
FR-24 exists to prevent and which `.sr-map-locate-btn` already records.

**Three reset sites, all at the call site rather than a `useEffect` mirror**
(the repo's own recorded convention, stated at `MapExplorer.tsx:2179-2182`):

1. `onBlur` on the button — the ordinary path.
2. Beside `setViewMode(mode)` (`:2179`) — a view switch can unmount the button
   without firing blur.
3. Beside `setSidebarOpen(true)` (`:2453`) — opening Filters unmounts it the
   same way, and a stale flag would show a phantom disabled button on close.

#### Accessible names (FR-03, QA-04)

Visible text is `Search this area` on all three views. Accessible names:

| view | name | retained state |
|---|---|---|
| `hotspots` | `Search this area for hotspots` | `Search this area for hotspots. This area has already been searched.` |
| `targets` | `Search this area for recent sightings` | `... for recent sightings. This area has already been searched.` |
| `lifers` | `Search this area for nearby lifers` | `... for nearby lifers. This area has already been searched.` |

Each contains the visible text verbatim (WCAG 2.5.3), and all six are pairwise
distinct from the ten existing map-control names FR-03 enumerates. Assert with
`getByRole('button', { name })`, which pins the guarantee rather than the
mechanism carrying it — and do not measure any *change* in an accessible name
against jsdom's `computeAccessibleName`, which deviates from real engines by an
inter-node space.

---

### 6. The indicator — `components/map/SearchedAreaLayer.tsx`

Mounted as a `<SnowMap>` child inside the existing `{isCenterView && (...)}`
block (`MapExplorer.tsx:2509`), beside `CenterPinDropper`:

```tsx
{activeRecord && <SearchedAreaLayer record={activeRecord} />}
```

FR-19 falls out: the record is looked up per view, and `isCenterView` already
excludes My Sightings. Records are **not** cleared on a view switch, so
switching back restores that view's circle (QA-21).

Structure, following `AtlasLayer` / `CountyLayer` exactly:

```tsx
const map = useMap().current
const [insertBelow] = useState(() => MARKER_LAYERS.find(id => !!map?.getLayer(id)))
const fc = useMemo(() => ({ type: 'FeatureCollection', features: [areaCirclePolygon(record)] }),
                   [record])

<Source id="sr-search-area" type="geojson" data={fc}>
  <Layer id="sr-search-area-line" type="line" paint={linePaint} beforeId={insertBelow} />
</Source>
```

#### Four properties the Engineer must not lose

**(a) Inert, by construction — the QA-20 guarantee.** The component registers
**no `map.on(...)` of any kind**: no click, no hover, no cursor arbitration. And
the layer id `sr-search-area-line` appears in **neither** list that gates
interaction:

- `INTERACTIVE_MAP_LAYERS = ['sr-sight-circle', 'sr-hotspot', 'sr-atlas-fill']`
  (`lib/mapPins.ts:219`) — what `updateMapCursor` queries.
- `MARKER_LAYERS = ['sr-sight-circle', 'sr-hotspot']` (`AtlasLayer.tsx:54`,
  `CountyLayer.tsx:81`) — what the two overlay click handlers use to yield.

`SightingMarkers` and `HotspotMarkers` query their own layer ids by name
(`SightingMarkers.tsx:106`, `HotspotMarkers.tsx:102`), and the atlas and county
handlers are layer-scoped `map.on('click', 'sr-atlas-fill' | fill id, ...)`.
None of them can see the new layer. **Do not add the id to either list**, and
say so in a comment — that single sentence is what makes FR-18 structural.
(FR-18's own caution about a `fill-opacity: 0` fill still being hit-tested is
therefore moot here, but it stays true: if the Designer adds a shaded disc, give
it a non-zero opacity and still keep its id out of both lists.)

**(b) The source id is constant.** The v0.5.30 post-mortem is about a `<Source>`
whose `id` *changes* between render branches, which throws
`Error: source id changed` and takes the whole app down via the error boundary.
Here the id is a literal and only `data` changes, so react-map-gl updates the
source in place. Mounting and unmounting the whole component across view
switches is a different thing and is safe.

**(c) `beforeId` (NFR-07, QA-37).** `MARKER_LAYERS.find(...)` in a lazy `useState`
initializer, exactly as both overlays do. Note that of the three centre views
only Hotspots draws a GL marker layer (`sr-hotspot`); Target and Lifer markers
are DOM `<Marker>`s and are above the canvas regardless. So `beforeId` is
load-bearing on Hotspots and inert on the other two — which is correct, not a
gap.

**(d) Paint (NFR-05).** Two sanctioned routes, and the Designer picks:
either resolve `--sr-*` tokens at runtime and re-resolve on a `data-theme`
change via the `MutationObserver` contract `CountyLayer` uses, **or** use the
basemap-anchored literal exception that both overlays' boundary lines already
take (the ring sits on the always-light Positron basemap) — and if the literal,
say so in a comment so it is not flagged as a token violation. No hardcoded
colour may appear without that comment.

---

### 7. CSS — three new classes, and the safe-area answer

All in `frontend/src/globals.css`. Positioning, display, wrap and gap live here,
never inline (NFR-06, QA-36). Colours, padding and borders may stay inline as
tokens.

| class | role |
|---|---|
| `.sr-map-search-area-btn` | the control. Absolute, in the loading chip's top-centre slot per OQ-03's default (`top: 12px; left: 50%; transform: translateX(-50%); z-index: 1050`) but with `pointer-events: auto` (the chip is `none`). Width bound and wrap allowance belong here, not inline as the chip does them. Add `.sr-touch-target` on the element for NFR-03, following `.sr-map-filters-btn`. |
| `.sr-map-search-status` | the FR-25 live region container. `pointer-events: none`. Rendered always. |
| `.sr-map-search-status-msg` | the message node, mirroring `.sr-map-geo-error-msg`. |

#### NFR-02 — the containing block, confirmed against the real DOM

NFR-02's pre-derivation is **correct**, and the positioned ancestor has a name:

> the map-area `<div style={{ flex: 1, position: 'relative' }}>` at
> **`MapExplorer.tsx:2268`**.

The chain, read off the source:

1. `.sr-map-fullscreen-panel` is `position: fixed; inset: 0` (`globals.css:1248`),
   and `.sr-ios-app .sr-map-fullscreen-panel` adds
   `padding-top / left / right: env(safe-area-inset-*)` (`:1275-1279`), with
   `padding-bottom` **deliberately omitted**.
2. `.sr-map-content` (`position: relative`, `:1459`) is an in-flow descendant, so
   the panel's padding has already displaced it inward.
3. The map-area div at `:2268` is an in-flow descendant of that, carries
   `position: relative` inline, and has **no padding of its own**.

Therefore an `position: absolute` child of the map area resolves against **that
div's** padding box, which is already inside the safe area on all three padded
sides.

**Consequences the Engineer must honour:**

- A **top-anchored** control (the OQ-03 default) inherits the protection and
  must **not** add its own `env()` inset — that would double-inset. The
  stylesheet guard therefore asserts the *absence* of a safe-area rule on
  `.sr-map-search-area-btn`, using `findUngatedSafeAreaRules` from
  `lib/cssTopLevelRules.ts`.
- A **bottom-anchored** control would need its own `.sr-ios-app`-gated inset,
  because the panel omits `padding-bottom` — which is exactly why
  `.sr-ios-app .sr-map-fab-cluster` exists (`:1547`). If the Designer moves the
  control to the bottom, that rule is required, and it must be gated on
  `.sr-ios-app`, never a bare `env()` (`index.html` ships `viewport-fit=cover`
  to browsers too, so an ungated rule would change shipped web rendering).

**Do not lift the map-area div's inline `position: relative` into a class.**
The usual house rule lifts inline layout so a stylesheet can reach it — but here
the goal is the opposite. An inline declaration cannot be beaten by any rule in
any stylesheet, so keeping it inline is the *strongest possible* guarantee that
this div remains the containing block; moving it to a class would drop it to
(0,1,0), open it to the cascade, and oblige a competitor scan across both
`globals.css` and the lazily-loaded `maplibre-gl.css` for no gain. NFR-02's
"name and assert" is therefore satisfied by a **component test** reading the
rendered style, plus a comment at the call site. (`mapIosFullscreen.test.ts`'s
assertion that `.sr-map-content`'s `position: relative` is load-bearing is the
precedent for asserting a containing block; this is the same idea one level in.)

#### NFR-12 — the live-region guard, and where the region should sit

The region is its **own absolutely positioned element in the map area**, not a
second full-width row inside `.sr-map-fab-cluster`. The cluster's geometry is
measured and commented at length (a message row is first and full width
precisely so no button moves); adding a second row there is churn against a
surface that has already been paid for once.

The guard, modelled on `mapFabClusterCss.test.ts`'s
"is never hidden while idle" scan, must have all three of its parts:

1. a scan over **top-level** rules whose subject is the region, rejecting
   `display` / `visibility` / `content-visibility` set to a hiding value;
2. an **any-depth** regex scan over comment-stripped CSS, so a media tier cannot
   smuggle one in;
3. a **positive** `display` assertion on the base rule, so deleting the rule
   fails the test rather than passing it vacuously.

Match the selector with a negative lookahead — `/^\.sr-map-search-status(?![-\w])/`
— so the container scan does not also swallow `-msg`. A `\b` there would.

**If the Designer hides the region visually, it must be the `.sr-only` idiom
(clip / 1px), never `display: none`** — `display: none` removes an element from
the accessibility tree, which is the documented way to make a live region fail
to announce, and it would defeat the sequence-keyed child whose whole premise is
a stable region.

---

## Dual-Transport Parity (FR-26, QA-28)

**Confirmed: nothing changes on either transport.**

- **No backend change.** `backend/routers/map.py` is untouched. No new route, no
  changed signature, no changed constraint. The backend test suite should pass
  unmodified.
- **No `lib/tauri/mapService.ts` change.** No new service function, and no
  change to `getHotspots` / `getRecentObs`.
- **No new Tauri capability**, no new dependency, no `PRIVACY_POLICY.md` change,
  no `package.json` change.

Parity is structural rather than asserted: the derivation is a pure function
that runs **once, in the component, before `transport.get` is called**, so both
transports receive the identical already-computed `lat`, `lng` and `dist`
strings. There is no per-transport code path in which they could diverge.

One interaction worth recording rather than leaving implicit: `DERIVED_MAX_MI`
means the derived path's `dist` is drawn from `{8, 16, 40}` km and nothing else,
so **a press cannot reach a `dist` that some other route to a search could not
already reach**. `/map/recent-obs` constrains `dist` to `[1, 200]` on the web
transport and the Tauri twin constrains nothing, but no derived value goes
anywhere near either edge, and the cap sits comfortably inside eBird's documented
50 km ceiling. The derived path is therefore the *narrowest* route to a search
this app has, not a new exposure.

What remains is the pre-existing question about the shipped 50 mi rung itself,
which sends `dist=80` from the sidebar's own Find button and is untouched by this
feature. The PRD puts clamping any route explicitly out of scope, and OQ-01 is
restated there as a property of that rung rather than of this feature: settling
it either lowers the app-wide rung or raises `DERIVED_MAX_MI`, and neither is
work this feature does.

---

## Test Surface

### New test files

| File | Covers |
|---|---|
| `frontend/src/lib/searchArea.test.ts` | QA-08 (bounds fixture table: midpoint at 5 dp, the smallest rung ≥ the maximum corner distance, and all four corners inside the derived radius for every uncapped fixture — plus the radius growing with the viewport up the ladder and then to the cap, about a centre that does not move), QA-09 (antimeridian: derived lng inside `[-180, 180]`, and the straddling radius equals the equivalent non-straddling one), QA-10 (`snapRadiusMi` returns the smallest holding rung, never a value outside `RUNGS` at any input, and narrows a ladder that really does extend past the cap), QA-11 / QA-12 (`hasMovedFrom` on **both** sides of the tolerance; the boundary at exactly `MOVE_THRESHOLD_FRAC × recorded radius`; **any** rung change with the centre unmoved, widening or narrowing, which an inequality test gets backwards; the tolerance measured against the RECORDED radius; pan-away-and-back; and the conjunction's headline hazard, that a CAPPED unmoved view is **not** offered forever), QA-39. Also the ring: closed, `steps + 1` vertices, every vertex within a tight tolerance of `radiusMi` from the centre, and continuous lngs across ±180. |
| `frontend/src/lib/searchOutcomeState.test.ts` | QA-22, and the three reducer properties (an identical repeat advances `seq`; a clear never does; clearing when clear returns the same object). Copy table for 3 views × {0, 1, N}, including the `targets` zero-form verbatim. |
| `frontend/src/lib/mapSearchAreaCss.test.ts` | QA-40 (the three-part hidden-region scan above), QA-36 (positioning declared in `globals.css`, exact selector match, never `String.includes`), QA-33 (`.sr-touch-target` reach or an equivalent ≤640 rule), and `findUngatedSafeAreaRules` asserting **no** safe-area rule on the top-anchored control. |
| `frontend/src/components/MapExplorerSearchThisArea.test.tsx` | QA-01 (all six gate conditions, each falsified in turn), QA-02, QA-03, QA-04, QA-05, QA-10 (**a viewport past the cap derives exactly 25 while the sidebar still offers all four rungs**), QA-13, QA-14 (**the coordinate fields adopt the derived centre while the Radius `SegControl` is left showing the user's own rung, checked from a rung moved off both the derived value and the default first, and swept with that rung below AND above the derived one; `dist = Math.round(radiusMi × 1.60934)` carries the DERIVED radius, which is the FR-11 property the explicit argument exists for**), QA-15, QA-16, QA-17, QA-23, QA-24, QA-26, QA-27 (region in the DOM while idle **and** the same message twice producing two DOM mutations of the keyed child), QA-30. Follows `MapExplorerLocateFab.test.tsx` / `MapExplorerCenterShareFab.test.tsx`. Also pins the four `RadiusControl` labels; the personal-location filter against a fixture where the sidebar's and the derived radii would give different pin counts; that `applyCenter` contains no `setRadius` and that the file has exactly two `setRadius` callers (R-01); and the accepted consequence that a successful view-switch re-search rewrites the drawn ring to the circle IT searched. |
| `frontend/src/components/map/SearchedAreaLayer.test.tsx` | QA-18, QA-20 (**the layer id is in neither `MARKER_LAYERS` nor `INTERACTIVE_MAP_LAYERS`, and the component registers no `map.on`**), QA-21, QA-37 (`beforeId`). Follows `CountyLayer.test.tsx`. |

### Existing suites that must stay green (QA-29, QA-38)

- `components/MapExplorerLocateFab.test.tsx`, `MapExplorerCenterShareFab.test.tsx`,
  `MapExplorerInViewList.test.tsx`, `MapExplorerInputZoom.test.tsx`
- `components/map/CenterPin.test.tsx`, `CenterPinDropper.test.tsx` — **the
  pin-drop path, named by QA-29**; `applyCenter`'s two new optional trailing
  arguments must leave both untouched, and both invoke with exactly two
  arguments so neither can reach either one
- `components/map/SightingMarkers.test.tsx`, `HotspotMarkers.test.tsx`,
  `TargetMarkers.test.tsx`, `NearbyLiferMarkers.test.tsx`, `CountyLayer.test.tsx`,
  `components/AtlasLayer.test.tsx`
- `lib/mapFabClusterCss.test.ts`, `lib/mapFabCascade.test.ts`,
  `lib/mapIosFullscreen.test.ts`, `lib/iosChrome.test.ts`,
  `lib/cssTopLevelRules.test.ts`
- `lib/entryChunk.test.ts` (NFR-09) — `SearchedAreaLayer.tsx` imports
  `react-map-gl/maplibre`, so it may be imported **only** from `MapExplorer.tsx`,
  which is already lazy. `searchArea.ts` and `searchOutcomeState.ts` are
  React-free and map-free.
- the backend suite, unchanged (QA-42)

### Verification that cannot be done in vitest

QA-19, QA-31, QA-32, QA-35 and QA-41 are geometric or engine-level and need a
real browser (Playwright is already a dependency in `website/tools/`, and
`SR_DATA_DIR` points the backend at the synthetic demo dataset — never the real
export). Measure the control's **text ink** via `Range` client rects against its
container's **content box**; `document.scrollWidth` is not admissible evidence
and can certify a broken build, and the map area has co-located overflowers
(the top-right layers switcher) that can mask the element entirely.

---

## No Data Layer Work Required

The Engineer can proceed directly to UI and module implementation. No migrations
need to be written or run. No storage-seam key is added. `PRIVACY_POLICY.md`,
`package.json`, `backend/`, and `lib/tauri/mapService.ts` are all unchanged.

---

## Flags Carried Forward

**For the Designer:**

1. **OQ-03's top-centre slot is viable for the control and probably not for a
   visible outcome card.** The prior feature paid for this measurement and it is
   in the source: at 320px and 200% text scale "the free band under the layer
   switcher is 96px", which is why the location-failure message was moved to the
   bottom cluster. A one-line pill fits there (the loading chip is the proof, and
   FR-14 makes the two mutually exclusive by construction). A multi-line outcome
   card would hit the same wall.
2. **But FR-22's stated reason for announcing failures is that the sidebar is
   off screen on a phone**, which argues the failure text should be *visible*,
   not only announced. If it is visible, the visible card and the announced node
   must be the **same** node (the `.sr-map-geo-error` precedent), never a
   duplicate `.sr-only` announcer.
3. Indicator paint is yours: token-resolved with a `data-theme` `MutationObserver`,
   or the sanctioned basemap-anchored literal. Either is fine; a literal needs
   the comment saying which exception it is taking.
4. **`DerivedArea.capped` is available if the capped case wants an affordance,
   and it deliberately drives no copy today.** Past `DERIVED_MAX_MI` the circle
   under-covers the viewport, which is the one case where "everything on screen
   was searched" stops being true. The flag exists so a test can assert the cap
   fired (QA-19) without reaching for a sentence that does not exist; the case is
   otherwise carried entirely by geometry, since the circle is drawn visibly
   smaller than the viewport. If you want a sentence or a badge for it, this is
   the hook — but the default is that a capped search announces the ordinary
   sentence for its view.

**For the Engineer:**

1. **`distanceMiles(...) <= radius` at `MapExplorer.tsx:919` must become
   `<= radiusMi`.** It is the only non-`distKm` read of the radius in the three
   handlers, and it is easy to miss because it is correct today: on a derived
   press the two values differ, and the state value would filter the personal
   pins against the pre-press circle while eBird was asked about the derived one.
   Test it against a fixture where the two candidate values would give different
   pin counts.
2. **Write the record inside the three handlers, keyed by the handler, never by
   `viewMode`** — at the view-mode change call site `viewMode` is stale.
3. `RadiusControl` derives its four options from `RUNGS`. This is the feature's
   only touch of a shipped sidebar control; it is behaviour-preserving, and the
   component test pins the four rendered labels. The `SegControl` has no honest
   way to render a value outside the ladder, which is what `snapRadiusMi`'s
   narrow-the-ladder cap guarantees it never has to.
4. `retainSearchBtn` needs **three** reset sites (blur, `setViewMode`,
   `setSidebarOpen(true)`), all at the call site — a `useEffect` mirror is
   against house convention here.
5. Round the centre with `Number(n.toFixed(5))`, round again after the longitude
   normalize, and measure `rCover` **from the rounded centre**, so display,
   request, record, circle and the coverage question are provably one value.
6. **OQ-01 does not block this feature and needs no probe to ship it.**
   `DERIVED_MAX_MI` keeps the derived path inside the documented ceiling; the
   question survives as a property of the shipped 50 mi rung, which this feature
   does not touch.
7. Standing mutation checks worth running on this change: **clamp instead of
   narrowing the ladder** in `snapRadiusMi` (the "never returns a value outside
   `RUNGS`" assertion must go red once either constant moves); **measure
   `rCover` from the unrounded midpoint** (documented as not separately testable
   through this interface — say so rather than inventing an assertion that
   cannot fail); **turn `hasMovedFrom`'s radius equality into `>`** (the
   narrow-with-centre-unmoved case must go red); **drop the `hasMovedFrom`
   conjunct** (the capped-and-unmoved case must go red, since coverage alone
   would offer the control forever); **drop the `viewportCoveredBy` conjunct**
   (the zoom-in-inside-the-circle case must go red); **replace `applyCenter`'s
   `radiusMi !== undefined` with a truthiness check**, and **have the handlers
   read `radius` off the closure instead of the override** (the same-tick QA-14
   assertion must go red); **leave the personal-location filter on `radius`**
   (its pin-count fixture must go red); delete the `sr-search-area-line`
   exclusion reasoning by adding the id to `INTERACTIVE_MAP_LAYERS` (QA-20 must
   go red); remove the sequence key and assert the double-mutation test rejects
   it.
