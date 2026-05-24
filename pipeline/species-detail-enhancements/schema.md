# Schema — Species Detail Enhancements

## Path
Frontend Only — No data layer changes required

## Confirmation
All functional requirements read from `ObservationEntry[]` and `MLExportRow[]` already loaded into component state from the user's stored eBird backup and ML export. No new tables, columns, relationships, or migrations are needed.

## Existing Data Used by This Feature

### `ObservationEntry` (`frontend/src/lib/parseEbirdObservations.ts`)
- Fields used: `date` (bucketing into weekly/monthly/yearly keys), `count` (individuals per period), `submissionId` (frequency denominator — unique IDs across filtered scope), `county` and `date` (filter application for frequency denominator)
- How used: passed as `obs` to `buildGraphData`; iterated in a new `totalFilteredChecklists` useMemo for the frequency stat denominator

### `MLExportRow` (`frontend/src/lib/parseMLExport.ts`)
- Fields used: `date`, `format` (Photo/Audio/Video)
- How used: passed as `mlRows` to `buildGraphData` for the Media Over Time overlay lines; unchanged behavior

### `GraphPoint` (`frontend/src/lib/sightingsGraph.ts`)
- Current fields: `key`, `individuals`, `photo`, `audio`, `video`
- New field added: `checklists` (count of observation rows per period)
- This is an in-memory computed type — no persistence, just a structural change to the existing interface

### `buildGraphData` (`frontend/src/lib/sightingsGraph.ts`)
- Current signature: `(obs, mlRows, interval: 'yearly' | 'monthly') → { data, useMonthly }`
- Updated signature: `(obs, mlRows, interval: 'weekly' | 'monthly' | 'yearly') → { data, interval }`
- Returns the active interval string directly instead of a `useMonthly` boolean so consumers can handle all three cases

### `SpeciesDetail.tsx` state consumed
- `graphInterval: 'weekly' | 'monthly' | 'yearly'` — extended type, default changes from `'yearly'` to `'monthly'`
- `speciesObs: ObservationEntry[]` — existing filtered observation array; unchanged, used as-is for frequency numerator
- `phase.observations: ObservationEntry[]` — full unfiltered observation set; filtered by active county/date for frequency denominator

### `sightingsGraph.test.ts`
- Existing tests cover yearly and monthly paths; new tests needed for weekly bucketing, weekly gap-fill, and the `checklists` field

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
