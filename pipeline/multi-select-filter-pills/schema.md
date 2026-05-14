# Schema — Multi-Select Filter Pills

## Path
Frontend Only — No data layer changes required

## Confirmation
All PRD requirements involve changes to in-memory filter state and filtering logic within two existing React components. No database, no new backend endpoints, no new API calls.

## Existing Data Used by This Feature

### Media List entries
- **Source:** `LifeListEntry[]` — parsed from the uploaded ML export or eBird backup CSV at load time; held in component state
- **Fields used by filtering:** `catalogIds: string[]` — cross-referenced against `mediaMap` to count Photo/Audio/Video items per species
- **Supporting structure:** `mediaMap: Record<string, string>` — maps catalog ID → `'Photo' | 'Audio' | 'Video'`; already present in `LifeList.tsx` phase state
- **How used:** Each active filter dimension asks `countMedia(entry, mediaMap, type) > 0` (has) or `=== 0` (no); multi-filter AND means all active dimension checks must pass

### Breeding code entries
- **Source:** `BreedingEntry[]` — parsed from the eBird backup CSV at load time; held in component state
- **Fields used by filtering:** `codes: Record<string, number>` — maps breeding code → count; a code is present if its count is ≥ 1
- **How used:** Multi-filter AND means every code in the active set must have `(entry.codes[code] ?? 0) > 0`

## Type Changes Required in `frontend/src/types.ts`

The following existing types must be replaced. No new files are needed.

**`MediaFilter` (currently a string union) → `MediaFilterState` (object per dimension):**
```typescript
// Remove:
export type MediaFilter = 'all' | 'no-photo' | 'no-audio' | 'no-video' | 'has-photo' | 'has-audio' | 'has-video'

// Add:
export type MediaDimensionState = 'has' | 'no' | null
export interface MediaFilterState {
  photo: MediaDimensionState
  audio: MediaDimensionState
  video: MediaDimensionState
}
export const MEDIA_FILTER_CLEAR: MediaFilterState = { photo: null, audio: null, video: null }
```

The object structure makes the per-dimension incompatibility constraint structurally enforced — `photo` can only hold one value at a time — and makes AND logic straightforward: filter by every non-null dimension.

**`BreedingFilter` (currently `string`) → `Set<string>`:**
```typescript
// Remove:
export type BreedingFilter = string

// Add:
export type BreedingFilterSet = Set<string>  // empty = All; populated = AND of codes
```

`Set<string>` gives O(1) membership testing and naturally prevents duplicates. Since this state is never serialised (no persistence, no URL sync), JSON-incompatibility is not a concern.

## Components Affected

| Component | Change |
|---|---|
| `frontend/src/types.ts` | Replace `MediaFilter` and `BreedingFilter` with new types |
| `frontend/src/components/LifeList.tsx` | Filter state, pill click handlers, `pillActive()`, count label |
| `frontend/src/components/LifeListTable.tsx` | Filtering logic consuming `MediaFilterState` |
| `frontend/src/components/BreedingCodeList.tsx` | Filter state, pill click handlers, count label |
| `frontend/src/components/BreedingCodeTable.tsx` | Filtering logic consuming `Set<string>` |

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
