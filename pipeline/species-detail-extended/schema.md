# Schema — Species Detail Extended

## Path
Frontend Only — No data layer changes required

## Confirmation
Reviewed all 21 functional requirements. No new tables, columns, relationships, or migrations are involved. The two "new fields" in FR-15 and FR-20 extend the in-memory `ObservationEntry` TypeScript type and the CSV parser — they are not database changes.

## Existing Data Used by This Feature

### `ObservationEntry` (frontend/src/types.ts)
The primary in-memory type produced by `parseEbirdObservations.ts`. The Engineer must extend this type with three new fields before implementing any feature:

| Field | Type | Status | Source column |
|---|---|---|---|
| `submissionId` | `string` | exists | Submission ID |
| `commonName` | `string` | exists | Common Name |
| `scientificName` | `string` | exists | Scientific Name |
| `date` | `string` | exists | Date |
| `count` | `number \| null` | exists | Count |
| `breedingCode` | `string \| null` | exists | Breeding Code |
| `speciesComments` | `string` | exists | Observation Details / Species Comments |
| `catalogIds` | `string[]` | exists | ML Catalog Number |
| `location` | `string` | exists | Location |
| `locationId` | `string` | **add** | Location ID |
| `latitude` | `number \| null` | **add** | Latitude |
| `longitude` | `number \| null` | **add** | Longitude |

### `parseEbirdObservations.ts` (frontend/src/lib/)
The character-level CSV parser that produces `ObservationEntry[]`. Needs three new column lookups added alongside the existing ones. Missing or non-numeric lat/lng defaults to `null`; missing location ID defaults to `''`.

### `SpeciesDetail.tsx` — Phase state
The `ready` phase carries:
- `observations: ObservationEntry[]` — all parsed rows (will now include the three new fields)
- `mediaMap: Map<string, MediaType>` — maps catalog ID → Photo/Audio/Video; populated from ML export
- `hasML: boolean` — whether ML export is loaded
- `userId: string | null` — parsed from ML export filename

The derived `speciesObs` memo filters `phase.observations` by selected species. All four new feature sections consume `speciesObs` plus `phase.mediaMap` / `phase.hasML`.

### Backend endpoints (unchanged)
- `POST /taxonomy/codes` — taxon codes + orders, already called on file load
- `GET /settings/files` — checks stored file status
- `GET /settings/files/ebird` + `/ml` — fetches stored CSV files

## New Dependencies Required
The Engineer must install before implementing the map:
```
npm install leaflet react-leaflet
npm install -D @types/leaflet
```
`react-leaflet` v4+ requires `leaflet` v1.9+. Leaflet default marker icons require a one-time fix for Vite's asset handling (patch `L.Icon.Default` with CDN icon URLs).

## No Data Layer Work Required
The Engineer can proceed directly to implementation after adding the three fields to `ObservationEntry` and their corresponding parser column reads.
