# Schema — Species Detail Visualizations

## Path
Frontend Only — No data layer changes required.

## Confirmation
Every PRD requirement reads from data already available client-side from the eBird backup CSV and ML export. No records are created, updated, or deleted. No new backend endpoints are needed.

---

## Open Questions — Resolved

**OQ-01 (ML export date field):** `MLExportRow` already contains `date: string` (parsed from the ML export CSV's observation date column). Overlay lines (FR-05) are fully feasible. No descoping needed.

**OQ-02 (Heatmap library compatibility):** `useMap` is already imported and used in `SpeciesDetail.tsx` via `MapBoundsFitter`. The `leaflet.heat` integration path (imperative `L.heatLayer` via `useMap()`) is confirmed and consistent with the existing pattern.

---

## Library Decisions

### Charting Library: Recharts

Recharts is recommended over native SVG for this feature. The deciding factors:
- The hover tooltip with simultaneous values for up to 4 lines is the most complex UI requirement — Recharts handles this cleanly with `<Tooltip />` and `<Legend />`
- `<ResponsiveContainer>` handles resize automatically (required for NFR-04)
- TypeScript types are included
- `stroke="var(--sr-accent)"` and similar CSS custom property values work directly on Recharts `<Line>` elements — theming via `var(--sr-*)` works without workarounds

Install: `npm install recharts` (frontend dependency)

### Heatmap Library: leaflet.heat

Install: `npm install leaflet.heat` and `npm install -D @types/leaflet.heat`

Integration: create a `HeatmapLayer` component inside `SpeciesDetail.tsx` that calls `useMap()` to get the Leaflet map instance, then adds/removes the heat layer imperatively using `L.heatLayer(points, options).addTo(map)`. This mirrors the existing `MapBoundsFitter` pattern exactly.

---

## State Change Required

The current `ready` phase in `SpeciesDetail.tsx` stores `mediaMap` from the ML export result but discards `rows` (`MLExportRow[]`). The overlay lines require per-row access to `date` and `format`.

**Change to `Phase` type:**

```ts
// Before
| { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Map<string, MediaType>; hasML: boolean; userId: string | null }

// After
| { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Map<string, MediaType>; mlRows: MLExportRow[]; hasML: boolean; userId: string | null }
```

**Change to phase-setting call:**
```ts
// After parsing mlResult, capture rows:
const mlResult = parseMLExport(mlText)
mediaMap = new Map(Object.entries(mlResult.mediaMap) as [string, MediaType][])
mlRows = mlResult.rows  // new

// Set phase:
setPhase({ tag: 'ready', observations, mediaMap, mlRows, hasML, userId: mlUserId })
```

All three `setPhase({ tag: 'ready', ... })` call sites (auto-load path, manual upload path, ML-absent path) must be updated. The ML-absent path passes `mlRows: []`.

---

## Existing Data Used by This Feature

### `ObservationEntry` — graph primary line + heatmap

Already available as `speciesObs: ObservationEntry[]` — a filtered `useMemo` in `SpeciesDetail.tsx` that applies the selected species, subspecies merge toggle, county filter, and date-range filter. The graph and heatmap both consume `speciesObs` directly.

Relevant fields:
- `date: string` — `YYYY-MM-DD` format; parsed for year/month grouping
- `howMany: number | null` — null and X-coded entries treated as 0 for individuals sum
- `latitude: number | null` / `longitude: number | null` — used for heatmap point coordinates

### `MLExportRow` — graph overlay lines

Stored in the `ready` phase as `mlRows: MLExportRow[]` (new field — see State Change above). Must be filtered to match the selected species by `commonName` before use, applying the same subspecies normalization as the rest of Species Detail.

Relevant fields:
- `commonName: string` — used to filter to the selected species
- `date: string` — `YYYY-MM-DD` format; parsed for year/month grouping
- `format: 'Photo' | 'Audio' | 'Video'` — used to assign each row to the correct overlay line

### `CoordMarker` — heatmap weights

Already computed as `coordMarkers: CoordMarker[]` in `SpeciesDetail.tsx`, derived from `speciesObs`. Each `CoordMarker` has `{ lat, lng, count, sightings[] }`. The `count` field is the weight for each heatmap point — pass as `[lat, lng, count]` tuples to `L.heatLayer`.

---

## New CSS Tokens Required

Four new tokens for graph line colors, added to both `:root` and `[data-theme="dark"]` in `frontend/src/globals.css`:

| Token | Purpose | Light suggestion | Dark suggestion |
|---|---|---|---|
| `--sr-graph-individuals` | Primary individuals line | `var(--sr-accent)` alias | `var(--sr-accent)` alias |
| `--sr-graph-photo` | Photo overlay line | `#3B82F6` (blue-500) | `#60A5FA` (blue-400) |
| `--sr-graph-audio` | Audio overlay line | `#F59E0B` (amber-500) | `#FCD34D` (amber-300) |
| `--sr-graph-video` | Video overlay line | `#8B5CF6` (violet-500) | `#A78BFA` (violet-400) |

The Designer may adjust specific values — the intent (distinct, legible, theme-aware) is fixed. All four tokens must exist before The Engineer adds any graph code.

---

## New Components

### `SightingsGraph` — inline component in `SpeciesDetail.tsx`

**Props:**
- `obs: ObservationEntry[]` — the already-filtered `speciesObs`
- `mlRows: MLExportRow[]` — the ML export rows (empty array when no ML loaded)
- `selectedSpecies: string` — used to filter mlRows by commonName
- `mergeSubspecies: boolean` — controls whether subspecies normalization is applied to mlRows matching

**Behavior:**
- Derives per-period data using `useMemo` from `obs` and `mlRows`
- Maintains local `viewMode: 'per-period' | 'cumulative'` state
- Renders with Recharts `<ResponsiveContainer>`, `<LineChart>`, `<XAxis>`, `<YAxis>`, `<Tooltip>`, `<Legend>`, one or more `<Line>` elements
- Returns `null` when fewer than 2 distinct time periods exist in `obs`

### `HeatmapLayer` — inline component in `SpeciesDetail.tsx`

**Props:**
- `points: [number, number, number][]` — `[lat, lng, weight]` tuples derived from `coordMarkers`
- `visible: boolean` — controls whether the heat layer is added or removed from the map

**Behavior:**
- Calls `useMap()` to access the Leaflet map instance
- On mount and when `points` or `visible` changes, removes any prior heat layer and (if `visible`) adds a new `L.heatLayer(points, { radius: 25, blur: 15, maxZoom: 17 })`
- On unmount, removes the heat layer

---

## No Data Layer Work Required

The Engineer can proceed directly to UI implementation. No migrations need to be written or run. The only structural change is adding `mlRows: MLExportRow[]` to the existing `Phase` type in `SpeciesDetail.tsx`.
