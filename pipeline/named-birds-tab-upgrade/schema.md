# Schema — Named Birds Tab Upgrade

## Path
Incremental (Extending existing structure)

> SnowRaven has no relational database. The "schema" is the frontend data-flow
> and component architecture — TypeScript types, the per-record data threaded
> from the parsed export, and how components consume it. This document is the
> data-layer design The Engineer implements in Stage 5. It is scoped to the
> data/component architecture; the five clarity fixes (contrast, header
> alignment, comment background, location render, sort labels) are styling/render
> changes the Engineer makes inline per the change-brief and are not re-specified
> here except where they touch a type or data flow.

---

## Headline decisions (read first)

1. **Shared-map: YES — extract `SightingsMap.tsx`.** A small, focused reusable
   component owns the pins + popup + bounds-fit. Species Detail migrates to it
   with **zero behavior change** (pins mode only is extracted; heatmap stays in
   Species Detail). Blast radius is bounded and test-covered — see §3.
2. **Concurrency: render-only-while-expanded PLUS a single-open-map cap on the
   Named Birds tab.** Expanding a card collapses any other open card, so at most
   one WebGL map mounts at a time. This makes the one real engineering risk
   (stacked WebGL contexts) structurally impossible rather than "probably fine."
   See §4.
3. **Card map is pins-only** (no heatmap/intensity controls), **below** the
   sightings list, at a **shorter fixed token-able height (220px)**, reusing
   `SP_PIN_HTML` as-is. See §6 for all five resolved open questions.

---

## Current structure (relevant slice)

### `ObservationEntry` (`frontend/src/types.ts`) — unchanged

The parsed eBird-backup observation already carries everything Parts 5 and 6
need. No parser change, no new CSV column.

```typescript
export interface ObservationEntry {
  submissionId: string
  commonName: string
  scientificName: string
  date: string                  // YYYY-MM-DD
  location: string              // ← Part 5 source (already populated)
  locationId: string
  latitude: number | null       // ← Part 6 source (already populated)
  longitude: number | null      // ← Part 6 source (already populated)
  // …county, count, breedingCode, speciesComments, catalogIds, etc.
}
```

### `NamedSighting` / `NamedBird` (`frontend/src/lib/namedBirds.ts`) — extended

`computeNamedBirds` receives full `ObservationEntry` objects but currently drops
`location`, `latitude`, `longitude` when building each `sighting` literal.

### `/taxonomy/codes` response — already returns `orders`

`{ codes: Record<string,string>, orders: Record<string,number> }` in BOTH
runtimes (TS `taxonomyService.ts`, Python `routers/taxonomy.py`) since v0.5.24.
`NamedBirds.tsx` already POSTs this for favicon codes but discards `orders`. **No
backend change, no new fetch.**

---

## Changes in this feature

### 1 — Data-model: thread `location` + coordinates onto `NamedSighting`

**`frontend/src/lib/namedBirds.ts`**

Extend the interface (all three fields; `location` for Part 5, lat/lng for Part 6):

```typescript
export interface NamedSighting {
  date: string                 // YYYY-MM-DD
  submissionId: string
  comment: string              // full species comment for this observation
  location: string             // NEW — from ObservationEntry.location ('' if absent)
  latitude: number | null      // NEW — from ObservationEntry.latitude
  longitude: number | null     // NEW — from ObservationEntry.longitude
}
```

Populate in **both** `sighting` object literals in `computeNamedBirds` (the
first-seen create branch and the push branch):

```typescript
const sighting: NamedSighting = {
  date: obs.date,
  submissionId: obs.submissionId,
  comment: obs.speciesComments,
  location: obs.location,          // NEW
  latitude: obs.latitude,          // NEW
  longitude: obs.longitude,        // NEW
}
```

Rules:
- `location` is a plain string; empty string when the export has no location
  text. The render layer (Part 5) omits the segment when falsy — no placeholder.
- `latitude`/`longitude` stay nullable and are passed through verbatim. **No
  filtering in `computeNamedBirds`** — null-coordinate sightings remain in the
  `sightings[]` list (they still show their date/location/checklist row); the
  map layer skips them when building markers (FR-22). Keeping the list and the
  map decoupled means a sighting with no coordinates still appears as a report.

`NamedBird` itself is **unchanged** (no new aggregate field — the map derives its
coords from `bird.sightings`).

### 2 — Sort: four options + taxonomic order

**`frontend/src/lib/namedBirds.ts`** — widen the enum and rework `sortNamedBirds`
to take an order resolver.

```typescript
export type NamedBirdSort = 'name' | 'alphabetical' | 'taxonomic' | 'lastSeen'

// orderFor: commonName → eBird taxon order (Infinity when unknown). Optional so
// the reduced-set caller (Species Detail) and tests can omit it.
export function sortNamedBirds(
  birds: NamedBird[],
  sort: NamedBirdSort,
  orderFor?: (commonName: string) => number,
): NamedBird[] {
  const copy = [...birds]
  const byName = (a: NamedBird, b: NamedBird) =>
    a.name.localeCompare(b.name, undefined, { sensitivity: 'base' })
  const bySpecies = (a: NamedBird, b: NamedBird) =>
    a.commonName.localeCompare(b.commonName, undefined, { sensitivity: 'base' })
  switch (sort) {
    case 'name':
      copy.sort((a, b) => byName(a, b) || bySpecies(a, b)); break
    case 'alphabetical':                       // renamed from 'species'
      copy.sort((a, b) => bySpecies(a, b) || byName(a, b)); break
    case 'taxonomic': {                         // NEW
      const order = orderFor ?? (() => Infinity)
      copy.sort((a, b) =>
        (order(a.commonName) - order(b.commonName)) || byName(a, b))
      break
    }
    case 'lastSeen':
    default:
      copy.sort((a, b) => b.lastSeen.localeCompare(a.lastSeen) || byName(a, b)); break
  }
  return copy
}
```

Sort semantics (FR-11/13/14):
- **Taxonomic** subtracts the two orders; unknown species resolve to `Infinity`
  → land in a stable tail, then tie-break by name. `Infinity - Infinity` is
  `NaN`, which sorts as 0 (no swap), so two unknowns fall through to the name
  tie-break — correct and stable.
- **Graceful degradation (FR-14):** before `orders` loads, `orderFor` returns
  `Infinity` for every species → the comparator's first term is `NaN` for every
  pair → the list is fully ordered by the name tie-break. No error, no empty
  list. When `orders` resolves, the parent's state update re-runs the `useMemo`
  and the list reorders. (`orderFor` is a closure over the `taxonOrders` state,
  so passing it as a `useMemo` dep is what triggers the re-sort — see §wiring.)

**`frontend/src/components/NamedBirds.tsx`** — capture `orders`, build `orderFor`,
pass it down.

```typescript
const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})  // NEW

const fetchTaxonCodes = async (birds: NamedBird[]) => {
  try {
    const species = /* …unchanged… */
    const data = await transport.post<{
      codes: Record<string, string>
      orders: Record<string, number>          // NEW — was discarded
    }>('/taxonomy/codes', { species })
    setTaxonMap(data.codes ?? {})
    setTaxonOrders(data.orders ?? {})          // NEW
  } catch { /* favicons + taxonomic sort absent until next load */ }
}

// orderFor mirrors BirdingStats.tsx:289–294 — normalized-name fallback, Infinity tail.
const normTaxonOrder = useMemo(() => {
  const m: Record<string, number> = {}
  for (const [name, ord] of Object.entries(taxonOrders)) m[normalizeSpeciesName(name)] = ord
  return m
}, [taxonOrders])
const orderFor = useCallback(
  (name: string) => taxonOrders[name] ?? normTaxonOrder[normalizeSpeciesName(name)] ?? Infinity,
  [taxonOrders, normTaxonOrder],
)
```

Pass `orderFor` into `<NamedBirdsTable … orderFor={orderFor} />`. (`useCallback`
so its identity only changes when `taxonOrders` does — that identity change is
the signal the table's sort `useMemo` keys on.)

**`frontend/src/components/NamedBirdsTable.tsx`** — new prop, new labels, thread
into the sort memo.

```typescript
export function NamedBirdsTable({ birds, showSpecies, renderSpecies, orderFor }: {
  birds: NamedBird[]
  showSpecies: boolean
  renderSpecies?: (commonName: string, scientificName: string) => React.ReactNode
  orderFor?: (commonName: string) => number          // NEW — supplied only by the tab
}) {
  const [sort, setSort] = useState<NamedBirdSort>('lastSeen')
  const sorted = useMemo(
    () => sortNamedBirds(birds, sort, orderFor),
    [birds, sort, orderFor],                           // orderFor in deps → re-sort on load
  )

  const sortOptions: { key: NamedBirdSort; label: string }[] = showSpecies
    ? [
        { key: 'name',         label: 'Name (Individual)' },   // FR-10 exact labels + order
        { key: 'alphabetical', label: 'Alphabetical' },
        { key: 'taxonomic',    label: 'Taxonomic' },
        { key: 'lastSeen',     label: 'Last Seen' },
      ]
    : [
        { key: 'name',     label: 'Name (Individual)' },        // FR-15 reduced set
        { key: 'lastSeen', label: 'Last Seen' },
      ]
}
```

**Reduced-set boundary (FR-15):** Species Detail's caller passes
`showSpecies={false}` and **no `orderFor`** — so Taxonomic/Alphabetical never
appear there, and `sortNamedBirds` falls back to the name tie-break for any
unreachable key. The four-option set is gated purely on `showSpecies`, which is
already the surface discriminator. No change to the Species Detail caller
(`SpeciesDetail.tsx:1435`) is required.

### 3 — Extract `SightingsMap.tsx` (the shared-map decision)

**Decision: extract a reusable pins map; both surfaces use it; Species Detail
migrates with no behavior change.**

Rationale: the Species Detail pins block (markers + single state-driven popup +
bounds fit) is ~40 lines that the card needs verbatim. Inlining a second copy
into `NamedBirdsTable` duplicates the `SP_PIN_HTML` constant, the selected-coord
popup state machine, the `SUBMISSION_ID_RE` link guard, and the per-coordinate
aggregation — four things that must then stay in sync by hand. One small,
test-covered component is the lower-maintenance, higher-consistency choice, and
the refactor risk is contained because **only the pins path is extracted** —
Species Detail's heatmap, intensity slider, and map-mode toggle stay exactly
where they are.

**New file: `frontend/src/components/SightingsMap.tsx`**

Owns: the `SnowMap` wrapper, the DOM `<Marker>` pins, the single state-driven
`<Popup>` (its own `selectedCoord` state — moved off the parent), and
`MapBoundsFitter`. It does **not** own the `SnowMap` height container
(`className="sr-map-container"` vs the card's shorter height) — the caller wraps
it — nor the heatmap.

```typescript
import { useState } from 'react'
import { Marker, Popup } from 'react-map-gl/maplibre'
import { SnowMap } from './SnowMap'
import { MapBoundsFitter } from './speciesDetail/MapBoundsFitter'
import { formatDate } from '../lib/formatDate'
import { SUBMISSION_ID_RE } from './speciesDetail/ui'

export type SightingMarker = {
  lat: number
  lng: number
  sightings: { submissionId: string; date: string }[]   // newest first
}

const SP_PIN_HTML = '…'   // moved here from SpeciesDetail.tsx; SpeciesDetail imports it back if still needed elsewhere (it isn't outside the map)

export function SightingsMap({ markers, switcher = true }: {
  markers: SightingMarker[]
  switcher?: boolean
}) {
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null)
  const selected = selectedCoord
    ? markers.find(m => `${m.lat},${m.lng}` === selectedCoord) ?? null
    : null
  const coords = markers.map(m => [m.lat, m.lng] as [number, number])

  return (
    <SnowMap
      initialViewState={{ longitude: coords[0]?.[1] ?? 0, latitude: coords[0]?.[0] ?? 0, zoom: 5 }}
      style={{ height: '100%', width: '100%' }}
      switcher={switcher}
      scrollZoom={false}
    >
      {markers.map(m => (
        <Marker key={`${m.lat},${m.lng}`} longitude={m.lng} latitude={m.lat} anchor="bottom"
          onClick={e => { e.originalEvent.stopPropagation(); setSelectedCoord(`${m.lat},${m.lng}`) }}>
          <div style={{ width: 24, height: 34, cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: SP_PIN_HTML }} />
        </Marker>
      ))}
      {selected && (
        <Popup longitude={selected.lng} latitude={selected.lat} anchor="bottom" offset={36}
          onClose={() => setSelectedCoord(null)} closeButton={false} maxWidth="260px">
          {/* identical date-list popup body lifted from SpeciesDetail.tsx:1273–1297 */}
        </Popup>
      )}
      <MapBoundsFitter coordinates={coords} />
    </SnowMap>
  )
}
```

Contract:
- **Input:** `markers: SightingMarker[]` — already aggregated by coordinate,
  sightings newest-first. The caller builds this (the aggregation memo, below);
  the component is presentational + popup-state only.
- **`switcher` prop** defaults `true` (Species Detail parity); the card may pass
  `switcher={false}` if a base switcher is too heavy for 220px — **decision: keep
  `switcher` true for both** so the card matches Species Detail, but the prop
  exists as an escape hatch.
- The component renders **nothing meaningful with an empty `markers` array** —
  but callers must not mount it empty (Species Detail already gates on
  `coordMarkers.length > 0`; the card gates per FR-23). The empty-array guard is
  the caller's, not the component's, so the WebGL context never mounts for a
  no-coordinate individual.
- The `dangerouslySetInnerHTML` here is the **static `SP_PIN_HTML` SVG constant**
  — no user text — preserving the CLAUDE.md standing security check (map popups
  stay escaped JSX; the only `dangerouslySetInnerHTML` is the static pin sprite).
  The popup body renders dates/IDs as escaped JSX children exactly as today.

**Species Detail migration (no behavior change):**

`SpeciesDetail.tsx` keeps its `coordMarkers` memo, `heatPoints`, `heatIntensity`,
`mapMode` toggle, `HeatmapLayer`, and the `sr-map-container` wrapper. The change
is surgical: replace the inline `mapMode === 'pins'` markers + popup block (lines
~1265–1299) with `mapMode === 'pins' && <SightingsMap markers={coordMarkers} />`,
and **delete** the now-component-owned local `selectedCoord` state and the
`SP_PIN_HTML` constant (move the constant into `SightingsMap.tsx`). `CoordMarker`
becomes a type alias for the shared `SightingMarker` (or SpeciesDetail imports
`SightingMarker`). The heatmap branch (`mapMode === 'heatmap' && <HeatmapLayer …>`)
and `MapBoundsFitter` placement are unaffected — but note `SightingsMap` now also
renders its own `MapBoundsFitter`, so in pins mode the fitter runs inside the
component; the existing top-level `MapBoundsFitter` at line 1301 should remain
for the heatmap branch (or be moved so both modes fit). **Engineer must verify
the fitter runs in both modes** after the swap — this is the one subtle migration
point.

> Migration-risk note for The Engineer: the existing `SpeciesDetail.tsx` map is a
> shipped, working surface. Do the extraction in one commit, run
> `SpeciesDetail`-adjacent tests, and eyeball the Species Detail map (pins click
> → popup, bounds fit on single vs many coords, heatmap toggle) before wiring the
> card. The behavior contract is "pixel-identical pins/popup on Species Detail."

### 4 — Map lifecycle & concurrency (the real risk)

**Decision: render-only-while-expanded PLUS single-open-map on the Named Birds
tab.**

Two layers:

1. **Render-only-while-expanded (FR-21).** The map subtree lives inside the
   `open && (…)` block in `NamedBirdsTable`. Collapsing the card unmounts
   `SightingsMap` → react-map-gl disposes the MapLibre instance → the WebGL
   context is released. This is already how the expanded panel works; the map
   just rides the same mount/unmount.

2. **Single-open accordion on the Named Birds tab.** Change the tab's expand
   model from "a `Set` of open keys" to **one open key at a time** so opening a
   card closes the previously open one. At most one `SightingsMap` (one WebGL
   context) is ever mounted on this tab — the stacked-context risk becomes
   structurally impossible, not "probably fine under normal use."

   Implementation: `NamedBirdsTable` already owns `expanded: Set<string>`. Add a
   prop `singleOpen?: boolean` (the Named Birds tab passes `true`; Species Detail
   keeps the multi-open `Set` so its non-map list is unaffected). When
   `singleOpen`, `toggle(key)` sets `expanded` to `new Set([key])` (or empties it
   if re-clicking the open one).

   > Why gate it rather than always single-open: Species Detail's
   > `NamedBirdsTable` has **no map** and lists few individuals — forcing
   > accordion there is a gratuitous UX change. Only the tab that mounts maps
   > gets the cap. The cap is therefore *also* the answer to Open Question 1.

This is a clear call: **one map, one context, guaranteed.** It removes the need
for any global map-instance counter, queue, or `WEBGL_lose_context` juggling, and
it makes QA-23 (expand/collapse many over a session) trivially stable — there is
never more than one live map. Stage 6 still verifies, but the failure mode is
designed out.

### 5 — Card map composition (where it renders)

In `NamedBirdsTable`, inside the `open && (…)` panel, **after** the sightings
list and before the panel's closing tag, render the map only when the individual
has usable coordinates:

```typescript
// Build per-coordinate markers from this bird's sightings (same shape as
// SpeciesDetail.coordMarkers, fed from bird.sightings).
const cardMarkers = useMemo(() => buildMarkers(bird.sightings), [bird.sightings])
// buildMarkers: skip null lat/lng (FR-22); group by "lat,lng"; aggregate dates
// newest-first; return SightingMarker[].
…
{open && (
  <div /* expanded panel */>
    {bird.sightings.map(/* …date · location · checklist row… */)}
    {cardMarkers.length > 0 && (
      <div className="sr-named-map">            {/* shorter fixed height; see §6 Q3 */}
        <SightingsMap markers={cardMarkers} />
      </div>
    )}
  </div>
)}
```

`buildMarkers` is the per-coordinate aggregation lifted from
`SpeciesDetail.coordMarkers` — extract it as a tiny pure helper
(`frontend/src/lib/sightingMarkers.ts`) so both Species Detail and the card use
one implementation and it's unit-testable:

```typescript
export function buildSightingMarkers(
  sightings: { latitude: number | null; longitude: number | null; submissionId: string; date: string }[],
): SightingMarker[] {
  const map = new Map<string, SightingMarker>()
  for (const s of sightings) {
    if (s.latitude === null || s.longitude === null) continue   // FR-22 skip
    const key = `${s.latitude},${s.longitude}`
    const hit = map.get(key)
    if (hit) hit.sightings.push({ submissionId: s.submissionId, date: s.date })
    else map.set(key, { lat: s.latitude, lng: s.longitude, sightings: [{ submissionId: s.submissionId, date: s.date }] })
  }
  for (const m of map.values()) m.sightings.sort((a, b) => b.date.localeCompare(a.date))
  return [...map.values()]
}
```

Species Detail's `coordMarkers` memo collapses to
`useMemo(() => buildSightingMarkers(speciesObs), [speciesObs])`. FR-23/FR-22/FR-24
all fall out of this one helper (empty result → caller renders no map; null
coords → skipped; same-coord → aggregated with dates).

`buildMarkers`/`useMemo` must be declared at the top of the row's render scope —
since each row is mapped, consider extracting the row body into a `NamedBirdRow`
component so the `useMemo` (and the single-open logic) live at a stable hook
position rather than inside `.map()`. **Decision: extract `NamedBirdRow`** — it's
the clean place for the per-row `cardMarkers` memo and avoids hooks-in-loop
concerns. (Today the row is inline in `.map()`; an inline `useMemo` there is a
rules-of-hooks violation, so this extraction is required, not optional.)

### 6 — Resolved open questions

| # | Question | Decision | One-line rationale |
|---|---|---|---|
| 1 | Concurrent-map lifecycle bound | **Single-open accordion on the Named Birds tab** (one map mounted at a time) + render-only-while-expanded | Makes stacked WebGL contexts structurally impossible; no counter/queue needed (§4). |
| 2 | Map placement in the card | **Below** the sightings list, before the panel's bottom padding | Matches PRD default; the list is the primary content, the map is supporting context. |
| 3 | Map height | **Single fixed token-able height, 220px**, via a new `.sr-named-map` class (height only; reuses `width:100%`) | Shorter than Species Detail's 300/380px so it fits a collapsible card; consistent across cards; one CSS class, no hardcoded color. |
| 4 | Pin sprite reuse | **Reuse `SP_PIN_HTML` as-is** (now owned by `SightingsMap.tsx`) | Visual consistency with Species Detail; the sprite already resolves `--sr-accent` at paint and is the extracted component's. |
| 5 | Card-map control surface | **Pins-only** — no heatmap/intensity controls; `switcher` (base map) kept on | A named individual has a handful of points — a heatmap is meaningless and the controls bloat a 220px card; `SightingsMap` doesn't carry the heatmap anyway, so pins-only is the natural extraction boundary. |

> Note on Q5 + the base switcher: `SightingsMap`'s `switcher` defaults `true`, so
> the card shows the Map/Satellite/Topo switcher like Species Detail. If Stage 4
> (The Designer) judges the switcher too heavy for the small card, pass
> `switcher={false}` — the seam exists. Default ships `true` for parity.

---

## Styling/render changes (data-layer-adjacent, specified by the change-brief)

These don't change types; listed so the touch-list is complete. Engineer
implements inline per the change-brief, verifying both themes.

- **Part 1 (contrast):** promote per-sighting date + header date-range off
  `--sr-text-muted` toward `--sr-text`; never `--sr-text-disabled` for content
  (the "N named birds" count may stay lower-emphasis); nudge `0.6875rem` content
  text to `0.75rem`. Tokens only.
- **Part 2 (header alignment):** align the name `<span>` and the `renderSpecies`
  `<BirdName size="sm">` on a shared baseline within `NamedBirdsTable` only;
  additive `sr-birdname-inline` use is the only sanctioned `BirdName`-side touch.
- **Part 3 (comment background):** wrap the comment in its own `<div>` on
  `var(--sr-surface-subtle)` (exists in both themes: light `#F4F4F5`, dark
  `#27272A`) with small radius + padding. No new token needed.
- **Part 5 (location render):** in the expand-row, render
  `date · {location} · {checklistLink}` when `s.location` is truthy; omit the
  segment + separator when falsy; ellipsize long location to keep the row
  single-line. Mirrors the Media Comments muted-location pattern.

---

## File-by-file touch list

| File | Change | Type |
|---|---|---|
| `frontend/src/lib/namedBirds.ts` | Add `location`/`latitude`/`longitude` to `NamedSighting`; populate in both `sighting` literals in `computeNamedBirds`; widen `NamedBirdSort` to `'name' \| 'alphabetical' \| 'taxonomic' \| 'lastSeen'`; rework `sortNamedBirds` to take optional `orderFor` and add the `taxonomic` case + `alphabetical` rename | **Data + sort** |
| `frontend/src/lib/sightingMarkers.ts` | **NEW** — `SightingMarker` type + `buildSightingMarkers()` pure helper (per-coordinate aggregation, skip-null, dates newest-first) | **New helper** |
| `frontend/src/components/SightingsMap.tsx` | **NEW** — shared pins map (SnowMap + DOM markers + single state-driven Popup + MapBoundsFitter); owns `SP_PIN_HTML` and its own `selectedCoord` state | **New component** |
| `frontend/src/components/NamedBirds.tsx` | Capture `data.orders` into new `taxonOrders` state; build `orderFor` (`useCallback`, normalized-name fallback, `Infinity` tail); pass `orderFor` to `NamedBirdsTable`; pass `singleOpen` | **Wiring** |
| `frontend/src/components/NamedBirdsTable.tsx` | New `orderFor?` + `singleOpen?` props; four-option `sortOptions` with exact labels (gated on `showSpecies`); thread `orderFor` into the sort `useMemo`; single-open `toggle`; extract `NamedBirdRow`; render `<SightingsMap>` below the list when `cardMarkers.length > 0`; Parts 1/2/3/5 styling | **Component** |
| `frontend/src/components/SpeciesDetail.tsx` | Replace inline pins markers+popup block with `<SightingsMap markers={coordMarkers} />`; remove local `selectedCoord` + `SP_PIN_HTML`; `coordMarkers` memo → `buildSightingMarkers(speciesObs)`; keep heatmap/intensity/mode toggle untouched; verify `MapBoundsFitter` fires in both modes; Named Individuals caller stays `showSpecies={false}` (no `orderFor`) | **Migration** |
| `frontend/src/globals.css` | Add `.sr-named-map { height: 220px; width: 100%; }`; any contrast token only if a genuinely new shade is needed (add to both themes) | **CSS** |
| `frontend/src/lib/namedBirds.test.ts` | Update sort assertions (`'species'` → `'alphabetical'`; add `'taxonomic'` with an `orderFor` stub + unknown-species tail + graceful `Infinity` fallback); assert `location`/`latitude`/`longitude` on `NamedSighting` | **Tests** |
| `frontend/src/components/NamedBirdsTable.test.tsx` | Update sort-button names (`'Species'` → exactly `Name (Individual)`/`Alphabetical`/`Taxonomic`/`Last Seen`); add location-render + map-mount/no-mount (no-coord) coverage; single-open behavior | **Tests** |
| `frontend/src/lib/sightingMarkers.test.ts` | **NEW** — aggregation, skip-null, same-coord grouping, newest-first ordering | **New test** |
| `frontend/package.json` + `src-tauri/tauri.conf.json` | Patch version bump (same version both) | **Release** |
| `CHANGELOG.md` | Entry for the upgrade | **Release** |
| `docs/HELP.md` / `README.md` / `website/` | Review/update Named Birds description (four sort options, per-report location, the new map) | **Docs** |

---

## What is NOT changing

- **No backend change.** `/taxonomy/codes` already returns `orders` (both
  runtimes). No new endpoint, no new fetch — `NamedBirds.tsx` already calls it.
- **No parser / CSV change.** `location`, `latitude`, `longitude` are already on
  `ObservationEntry`; this only threads them onto `NamedSighting`.
- **No `[name:…]` model change.** Detection/keying/aggregation of named birds is
  untouched.
- **No new map pattern, tile provider, or data egress.** The card reuses
  `<SnowMap>`'s existing keyless providers via the extracted `SightingsMap`;
  bounded DOM `<Marker>`s (a named bird has few sightings), not GL pin layers, per
  CLAUDE.md. No `PRIVACY_POLICY.md` change.
- **No shared `BirdName` default change** — Part 2 alignment stays in
  `NamedBirdsTable` (additive `sr-birdname-inline` only if unavoidable).
- **No Species Detail behavior change** beyond the pins extraction (which is
  designed to be pixel-identical) and the reduced sort set staying as-is.

---

## Design decisions (rationale captured for The Chronicler)

**Extract `SightingsMap` rather than inline-duplicate.** One test-covered
component owns pins+popup+fit; duplication would force four constants/state
machines to stay hand-synced. Risk is bounded by extracting *only* the pins path
(heatmap stays in Species Detail) and migrating in one verified commit.

**Single-open accordion only on the Named Birds tab.** The cleanest answer to the
concurrent-WebGL risk is to make multiple live maps impossible rather than
tolerable. Gating on `singleOpen` keeps Species Detail's map-less list multi-open
(no gratuitous UX change there). This subsumes Open Question 1 — no instance
counter or queue is needed.

**`buildSightingMarkers` as a shared pure helper.** FR-22 (skip null), FR-23
(empty → no map), and FR-24 (same-coord aggregation + dated popup) all fall out
of one unit-tested function used by both surfaces, instead of two copies of the
aggregation memo.

**`orderFor` passed as a value, threaded through `useMemo` deps.** Matches the
v0.5.24 taxonomic-sort pattern (`BirdingStats.tsx` / `LifeList.tsx`). Because the
resolver's identity changes only when `taxonOrders` loads, it doubles as the
graceful-degradation signal: the list renders name-ordered first, then re-sorts
taxonomically when `orders` resolves (FR-14).
