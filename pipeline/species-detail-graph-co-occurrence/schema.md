# Schema — Species Detail: Graph Options and Co-occurring Species

## Path
Frontend Only — No data layer changes required

## Confirmation
This feature has been assessed against the PRD and confirmed to require no database changes. No new tables, columns, relationships, API endpoints, or file storage are needed. All computation reads from data already held in component state after auto-load.

## Existing Data Used by This Feature

### ObservationEntry[]
Held in `phase.observations` (all species, all dates) and derived as `speciesObs` (filtered to selected species + county + date range).

- `submissionId: string` — checklist key; used to group observations by checklist for co-occurrence computation
- `commonName: string` — species name; normalized with `normalizeSpeciesName()` when `mergeSubspecies` is true
- `date: string` — YYYY-MM-DD; used for yearly/monthly graph bucketing and date filter gating
- `count: number | null` — individual count per observation; summed for Individuals graph line
- `county: string | null` — used by the county filter that gates `speciesObs`

### MLExportRow[]
Held in `phase.mlRows`, derived as `speciesMlRows` (filtered to selected species).

- `date: string` — bucketing key for Media Over Time graph
- `format: 'Photo' | 'Audio' | 'Video'` — determines which media line to increment

### buildGraphData (sightingsGraph.ts)
Currently accepts `(obs: ObservationEntry[], mlRows: MLExportRow[])` and returns `{ data: GraphPoint[], useMonthly: boolean }`.

**FR-06 requires a signature change:** Replace the auto-detection logic (`years.size <= 1 → useMonthly`) with an explicit `interval: 'yearly' | 'monthly'` parameter. The Engineer must update this function, all call sites in `SpeciesDetail.tsx`, and the test file `sightingsGraph.test.ts`.

### SightingsGraph component (SpeciesDetail.tsx ~lines 275–419)
Currently owns `viewMode: 'per-period' | 'cumulative'` state internally and renders both the Sightings Over Time and Media Over Time `SectionCard`s.

**FR-02/FR-04 require restructuring:** `viewMode` and `interval` states move up to the call site in the ready-state render block. A new `GraphOptions` `SectionCard` renders above `SightingsGraph`, sharing these states as props. `SightingsGraph` becomes a controlled component receiving `interval` and `viewMode` as props.

### normalizeSpeciesName (speciesUtils.ts)
Apply to co-occurring species names when `mergeSubspecies` is true, consistent with how `speciesObs` is filtered.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
