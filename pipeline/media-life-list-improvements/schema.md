# Schema — Media Life List Improvements

## Path
Frontend Only — No data layer changes required

## Confirmation
Assessed against all PRD requirements. No new tables, columns, relationships, or migrations are needed. The count display (FR-02–04) derives from data already present in the component's props. The soundscape change (FR-05) modifies parser filtering logic only — the output shape is unchanged.

## Existing Data Used by This Feature

### LifeListEntry (frontend/src/lib/parseLifeList.ts)
- Fields used: `commonName`, `scientificName`, `catalogIds`
- How used: `catalogIds` is the array the Engineer will count against to produce per-species media totals. `commonName` and `scientificName` are displayed in the species column and are unchanged.

### mediaMap (Record<string, string>)
- Fields used: catalog ID keys → `'Photo' | 'Audio' | 'Video'` values
- How used: The Engineer filters `entry.catalogIds` against this map to count how many IDs match each media type. Populated by `parseMLExport.ts` (ML export path) or by the backend `/ml/media-types` batch lookup (eBird path) — the display logic is identical for both.

### parseMLExport.ts — isExcluded() (frontend/src/lib/parseMLExport.ts)
- Current behaviour: excludes entries where `commonName.toLowerCase() === 'soundscape'`
- Required change: remove that condition. No new fields or output shape changes — soundscape entries pass through with the same `LifeListEntry` structure as any other species.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
