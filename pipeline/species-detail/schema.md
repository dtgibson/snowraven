# Schema — Species Detail
**Feature:** species-detail
**Session:** 001
**Date:** 2026-05-15
**Stage:** 3 — The Architect
**Assessment:** Frontend Only — no backend or data layer changes required

---

## Assessment Summary

Species Detail is a pure client-side feature. All data it needs (eBird backup CSV, ML export CSV) is already handled by the Settings stored-file system. The existing `GET /settings/files/ebird` and `GET /settings/files/ml` endpoints cover auto-load. The existing `POST /taxonomy/codes` endpoint covers taxonomic ordering. No new endpoints, database tables, or migrations are required.

The only schema work for this feature is defining new TypeScript types and a new parser.

---

## New Types

### `ObservationEntry`

```typescript
interface ObservationEntry {
  submissionId: string;
  commonName: string;
  scientificName: string;
  date: string;           // YYYY-MM-DD
  location: string;       // location name from "Location" column
  count: number | null;   // null for "X" / presence-only rows
  breedingCode: string | null;  // code abbreviation only (e.g. "CN"), null if absent
  speciesComments: string;      // raw string, may be empty
  catalogIds: string[];         // ML catalog IDs with "ML" prefix stripped
}
```

### `SpeciesDetailState`

```typescript
type SpeciesDetailState =
  | { tag: 'loading-saved' }
  | { tag: 'idle' }           // no eBird backup loaded, upload zone shown
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Map<string, 'Photo' | 'Audio' | 'Video'>; taxonOrders: Record<string, number> | null; userId: string | null };
```

---

## New Parser

### `parseEbirdObservations.ts`

Location: `frontend/src/lib/parseEbirdObservations.ts`

**Signature:**
```typescript
export function parseEbirdObservations(csvContent: string): ObservationEntry[]
```

**Behavior:**
- Uses the existing character-level `parseCSV()` function (from `parseBreedingCodes.ts` or a shared util) — never `content.split(/\r?\n/)`, per the DECISIONS.md rule on embedded newlines
- Strips UTF-8 BOM if present on the first character
- Validates that required columns exist; throws a descriptive error if not
- Returns one `ObservationEntry` per row — no deduplication

**Required CSV columns (by header name):**

| Header | Maps to |
|--------|---------|
| `Submission ID` | `submissionId` |
| `Common Name` | `commonName` |
| `Scientific Name` | `scientificName` |
| `Date` | `date` (YYYY-MM-DD, as-is from eBird) |
| `Location` | `location` |
| `Count` | `count` — parse as integer; "X" or non-numeric → null |
| `Breeding Code` | `breedingCode` — split on whitespace, take first token; empty → null |
| `Species Comments` | `speciesComments` — preserve as-is, may be empty |
| `ML Catalog Numbers` | `catalogIds` — split on space, strip leading "ML" prefix from each token |

**Validation error (thrown as `Error`):**
- If the CSV has no rows, or any of the required columns is missing from the header row

---

## Existing Assets Reused

### Parsers (no changes)
- `parseMLExport.ts` → `parseMLExport(csvContent)` — returns `Map<catalogId, 'Photo' | 'Audio' | 'Video'>` for the `mediaMap`
- `parseBreedingCodes.ts` (or its shared `parseCSV` utility) — the character-level CSV parser

### Endpoints (no changes)
- `GET /settings/files` — metadata for both stored files (used to detect presence, extract ML filename for userId)
- `GET /settings/files/ebird` — raw eBird backup CSV content
- `GET /settings/files/ml` — raw ML export CSV content
- `POST /taxonomy/codes` — existing endpoint; returns `{ orders: Record<string, number>, codes: Record<string, string> }`; `orders` used for taxonomic species sorting

### Constants / Maps (no changes)
- `BREEDING_CODE_MAP` — code abbreviation → full label
- `TIER_COLORS` — tier number → `--sr-tier-N` CSS variable token
- Tier assignment logic (already exists in `BreedingCodeList.tsx` or a shared util)

### URL Pattern (no changes)
- Macaulay Library filter URL: `https://search.macaulaylibrary.org/catalog?mediaType={type}&taxonCode={code}` with `&userId={userId}` appended when available
- userId extraction from ML filename regex: `^ML__.*_([A-Za-z0-9]+)\.csv$`

---

## Migration

None. Frontend-only feature.

---

## Files to Create

| File | Purpose |
|------|---------|
| `frontend/src/lib/parseEbirdObservations.ts` | New parser for per-observation eBird rows |
| `frontend/src/components/SpeciesDetail.tsx` | Main tab component |
| `frontend/src/components/SpeciesSelector.tsx` | Searchable species dropdown |
| `frontend/src/components/SpeciesDetailView.tsx` | Detail panels (summary card, sections) |

No backend files created or modified.
