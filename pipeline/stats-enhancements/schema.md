# Schema — Stats Enhancements

## Path
Frontend Only — No data layer changes required

## Confirmation
Assessed against all 24 functional requirements. No new tables, columns, relationships, or migrations are needed. The `POST /taxonomy/codes` endpoint (used for nemesis taxon resolution) already exists and requires no modification. The feature reads exclusively from already-parsed in-memory data.

## Existing Data Used by This Feature

### `filteredObs: ObservationEntry[]`
- Fields used: `commonName`, `count`, `date`, `submissionId`, `latitude`, `longitude`, `location`, `locationId`
- How used: source for one-and-done individual-count computation; lat/lng used to resolve coordinates for top-location map pins

### `checklists: ChecklistEntry[]`
- Fields used: `submissionId`, `date`, `speciesCount`, `latitude`, `longitude`, `location`, `locationId`
- How used: per-year best-single-day lookup (find max `speciesCount` per year, carry `submissionId` for checklist link)

### `accumulation.milestones: Map<number, { date: string; species: string; submissionId: string }>`
- How used: the threshold array that drives milestone iteration is replaced; the map structure and pill rendering are unchanged

### `mlTaxonMap: Record<string, string>` (existing state in `BirdingStats`)
- Fields used: `commonName → taxonCode`
- How used: primary source for nemesis bird taxon codes when ML data is loaded

### `nemesisResult: NemesisSpecies[]` (existing state, type `{ commonName: string; recentDate: string }`)
- How used: after results arrive, common names are passed to `POST /taxonomy/codes` if `mlTaxonMap` doesn't cover them; taxon codes drive the `ebird.org/species/{code}` links

### `geo` computed object (from existing `geo` useMemo)
- Current fields on each location: `name`, `locationId`, `checklists`, `species`, `stateProvince`
- **New fields added by this feature:** `lat: number | null`, `lng: number | null` — resolved from the first `filteredObs` entry at that location with non-null coordinates
- How used: drives top-locations Leaflet map pins (FR-17 through FR-24)

### `temporal.yearRows` (from existing `temporal` useMemo)
- Current fields: `{ label: string; checklists: number; species: number }`
- **New field added by this feature:** `bestDay: { species: number; submissionId: string } | null` — the highest-species-count checklist for that calendar year
- How used: renders the third column in the per-year display (FR-13 through FR-16)

## New State

### `nemesisTaxonMap: Record<string, string>`
- A new `useState<Record<string, string>>({})` in `BirdingStats`
- Populated by a fire-and-forget `POST /taxonomy/codes` fetch triggered when nemesis results arrive and `mlTaxonMap` doesn't have all codes
- Used exclusively for rendering nemesis bird links (FR-07, FR-08)

## Renamed Computed Value

### `funStats.oneDoneBirds` → `funStats.singleChecklistBirds`
- Existing field renamed; shape unchanged: `{ name: string; submissionId: string }[]`
- A new `funStats.oneDoneBirds` field is added alongside it: `{ name: string }[]` — species where sum of numeric counts = 1 (no submissionId needed — links not required for this section)

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
