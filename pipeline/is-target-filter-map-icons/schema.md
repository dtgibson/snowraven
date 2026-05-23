# Schema — Is Target Filter and Map Icons

## Path
Frontend Only — No data layer changes required

## Confirmation
Every functional requirement was reviewed against the PRD. None involve creating, reading from new columns, updating, or deleting database records. All data the feature needs already exists in client-side state derived from the ML export and eBird backup CSV files.

## Existing Data Used by This Feature

### `MLExportRow[]` — from `parseMLExport.ts`
- Fields used: `commonName`, `format` (`'Photo' | 'Audio' | 'Video'`)
- How used: The `mediaTypes` useMemo in `MapExplorer.tsx` already builds `Map<string, Set<'Photo'|'Audio'|'Video'>>` from this. The redefined `targetSpecies` useMemo and the new `missingTypes` computation on each `TargetPin` both read from this same map. No change to parsing.

### `ObservationEntry[]` — from `parseEbirdObservations.ts`
- Fields used: `commonName`, `scientificName`
- How used: The `targetSpecies` useMemo iterates `phase.observations` to build the backbone species list and identify which are targets. This is already the data source; only the target condition changes.

### `LifeListEntry` — produced by `buildComprehensiveEntries()` and the ML-only path in `LifeList.tsx`
- Fields used: `commonName`, `photoCount`, `audioCount`, `videoCount`
- How used: The "Is Target" filter pill applies `entry.photoCount === 0 || entry.audioCount === 0 || entry.videoCount === 0`. These three count fields already exist on every `LifeListEntry`.

### `TargetPin` — shape returned by `GET /map/recent-obs`
- Current fields: `comName`, `sciName`, `locName`, `subId`, `recentDate`, `lat`, `lng`
- Change: A `missingTypes: ('Photo' | 'Audio' | 'Video')[]` field is added **client-side only** when building `displayedTargetPins` (derived from `mediaTypes` at that point). The backend response is unchanged.

### App.tsx tab state
- Current fields: `activeTab` string state
- Change: A new `mediaListFilter: 'is-target' | null` state is added to App.tsx to carry the navigation intent from MapExplorer to LifeList. This is ephemeral UI state — never persisted.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
