# Schema — ML Export Upload

## Path
Frontend Only — No data layer changes required

## Confirmation
Assessed against all PRD functional requirements (FR-01 through FR-18). No new tables, columns, relationships, or migrations are needed. All data processing is in-memory: CSV is read client-side, parsed into TypeScript types, and held in React state for the session lifetime.

## Existing Data Used by This Feature

### `LifeListEntry` — `frontend/src/lib/parseLifeList.ts`
- Fields used: `commonName`, `scientificName`, `taxOrder`, `catalogIds`
- How used: The ML export parser must produce `LifeListEntry[]` in this same shape. The Engineer should model `parseMLExport.ts` after `parseLifeList.ts`. For ML export entries, `taxOrder` will not be available and should be omitted or set to `Infinity` so A-Z sort is used by default.

### `mediaMap: Record<string, string>` — in-memory, `LifeList.tsx`
- Fields used: keys are catalog IDs (numeric strings), values are `"Photo" | "Audio" | "Video"`
- How used: The ML export parser produces this map directly from the `Catalog Number` and `Format` columns. The existing eBird path produces the same structure via CDN lookup. Both paths feed this same map into `LifeListTable`.

### `MediaFilter` — `frontend/src/types.ts`
- Current values: `'all' | 'no-photo' | 'no-audio' | 'no-video'`
- Change needed: Extend to include `'has-photo' | 'has-audio' | 'has-video'`
- How used: Controls which species are shown in `LifeListTable`. The filter logic in `LifeList.tsx` must handle the three new positive cases.

### `SortOrder` — `frontend/src/types.ts`
- Current values: `'taxonomic' | 'alpha'`
- No change needed to the type. The ML export path hides the Taxonomic pill in the UI; `SortOrder` itself is unchanged.

### `POST /ml/media-types` — `backend/routers/ml.py`
- Still used by the eBird CSV path (unchanged). Not called by the ML export path.

### `LifeListTable` — `frontend/src/components/LifeListTable.tsx`
- Unchanged. Receives `entries`, `mediaMap`, `filter`, `sort`, `expanded` props. Both upload paths produce data in this shape.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
