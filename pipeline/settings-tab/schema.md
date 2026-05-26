# Schema — Settings Tab

## Path
Incremental (Extending existing schema)

---

## Current Schema State

This project has no relational database. The "schema" is the API contract between
the FastAPI backend and the React frontend, plus the TypeScript type system, plus
filesystem storage structure.

---

### Filesystem Storage (new in this feature)

```
data/                        ← project root; gitignored
  ebird-backup.csv           ← stored eBird backup (fixed filename)
  ml-export.csv              ← stored ML export (fixed filename)
  metadata.json              ← JSON sidecar for both files
```

**`data/metadata.json` shape:**
```json
{
  "ebird": {
    "filename": "MyEBirdData.csv",
    "uploadedAt": "2026-05-15T01:45:00Z"
  },
  "ml": {
    "filename": "ML__20260101_USER123.csv",
    "uploadedAt": "2026-05-15T01:50:00Z"
  }
}
```

Each key is either a `{ filename, uploadedAt }` object or `null`. The file is
created on first upload and updated atomically on every upload and delete.
If `metadata.json` does not exist, the backend treats both slots as empty.

`DATA_DIR` is resolved in `settings.py` as:
```python
DATA_DIR = Path(__file__).resolve().parent.parent.parent / "data"
# backend/routers/settings.py → backend/routers/ → backend/ → project root → data/
```

---

### Backend API

#### `GET /settings/files` (new)
Returns metadata for both stored files.

**Response:**
```json
{
  "ebird": { "filename": "MyEBirdData.csv", "uploadedAt": "2026-05-15T01:45:00Z" },
  "ml": null
}
```

Each key is `{ filename: string, uploadedAt: string }` or `null`.

---

#### `POST /settings/files/ebird` and `POST /settings/files/ml` (new)
Accepts `multipart/form-data` with a `file` field.

**Validation (server-side):**
- Content-type or filename must end in `.csv` → 400 if not
- File size ≤ 50 MB → 413 if exceeded

**On success:**
- Writes file to `data/ebird-backup.csv` or `data/ml-export.csv`
- Updates `data/metadata.json` with original filename and current UTC timestamp
- Returns 200: `{ "filename": "...", "uploadedAt": "..." }`

---

#### `GET /settings/files/ebird` and `GET /settings/files/ml` (new)
Streams stored CSV content.

- Returns `200` with `Content-Type: text/plain; charset=utf-8` if file exists
- Returns `404` if file does not exist

---

#### `DELETE /settings/files/ebird` and `DELETE /settings/files/ml` (new)
Removes the stored file.

- Deletes file from disk
- Sets the corresponding key in `metadata.json` to `null`
- Returns `200` on success
- Returns `404` if no file is stored

---

#### All existing endpoints — unchanged
- `GET /weather/{checklist_id}` — checklist weather lookup
- `POST /ml/media-types` — ML catalog CDN probe
- `POST /taxonomy/codes` — taxonomy code + order lookup
- `GET /version/check` — GitHub release comparison

---

### Frontend Type System

Current state after this feature (cumulative):

```typescript
// --- Media types ---
export type MediaType = 'Photo' | 'Audio' | 'Video'

// --- Filter state ---
export type MediaDimensionState = 'has' | 'no' | null
export interface MediaFilterState {
  photo: MediaDimensionState
  audio: MediaDimensionState
  video: MediaDimensionState
}
export const MEDIA_FILTER_CLEAR: MediaFilterState = { photo: null, audio: null, video: null }
export type BreedingFilterSet = Set<string>

// --- Sort state ---
export type NameSortMode = 'az' | 'taxonomic'
export type SortColumn = 'name' | 'photo' | 'audio' | 'video'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  column: SortColumn
  dir: SortDir
  nameSortMode: NameSortMode
}
export type BreedingSortColumn = string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: SortDir
  nameSortMode: NameSortMode
}

// --- Life list ---
export interface LifeListEntry {
  commonName: string
  scientificName: string
  taxonomicOrder: number
  catalogIds: string[]
}

// --- List comparer ---
export interface FileData {
  name: string
  species: Set<string>
}
export interface ComparisonResult {
  both: string[]
  aOnly: string[]
  bOnly: string[]
}

// --- Breeding codes ---
export interface BreedingEntry {
  commonName: string
  codes: Record<string, number>
}

// --- Settings (new in this feature) ---
export interface StoredFileInfo {
  filename: string
  uploadedAt: string  // ISO 8601
}
export interface StoredFilesStatus {
  ebird: StoredFileInfo | null
  ml: StoredFileInfo | null
}
```

---

### Frontend Component State

#### `Settings.tsx` (new)

| State field | Type | Notes |
|---|---|---|
| `status` | `StoredFilesStatus` | Fetched from `GET /settings/files` on mount |
| `ebirdUploading` | `boolean` | True while POST /settings/files/ebird is in flight |
| `mlUploading` | `boolean` | True while POST /settings/files/ml is in flight |
| `ebirdError` | `string \| null` | Upload or delete error for eBird section |
| `mlError` | `string \| null` | Upload or delete error for ML section |

#### `BreedingCodeList.tsx` (after this feature)

| State field | Type | Notes |
|---|---|---|
| `phase` | `Phase` | Extended — adds `{ tag: 'loading-saved' }` |
| `filter` | `BreedingFilterSet` | Unchanged |
| `sort` | `BreedingSortState` | Unchanged |
| `expanded` | `boolean` | Unchanged |
| `taxonMap` | `Record<string, string>` | Unchanged |
| `taxonOrders` | `Record<string, number>` | Unchanged |
| `savedFileInfo` | `StoredFileInfo \| null` | New — set on successful auto-load; shown in toolbar |

**Phase type (extended):**
```typescript
type Phase =
  | { tag: 'idle' }
  | { tag: 'loading-saved' }           // NEW — fetching stored file from server
  | { tag: 'error'; message: string }
  | { tag: 'ready'; data: BreedingData }
```

#### `LifeList.tsx` (after this feature)

| State field | Type | Notes |
|---|---|---|
| `phase` | `Phase` | Extended — adds `{ tag: 'loading-saved' }` |
| `entries` | `LifeListEntry[]` | Unchanged |
| `mediaMap` | `Record<string, string>` | Unchanged |
| `filter` | `MediaFilterState` | Unchanged |
| `sort` | `SortState` | Unchanged |
| `expanded` | `boolean` | Unchanged |
| `userId` | `string \| null` | Unchanged |
| `taxonMap` | `Record<string, string>` | Unchanged |
| `taxonOrders` | `Record<string, number>` | Unchanged |
| `savedFileInfo` | `StoredFileInfo \| null` | New — set on successful auto-load; shown in toolbar |

**Phase type (extended):**
```typescript
type Phase =
  | { tag: 'idle' }
  | { tag: 'loading-saved' }           // NEW
  | { tag: 'loading'; total: number; done: number }
  | { tag: 'error'; message: string }
  | { tag: 'ready' }
```

---

## Changes in This Feature

### Added

**Filesystem**
- `data/` directory at project root; added to `.gitignore`
- `data/ebird-backup.csv` — written on eBird backup upload
- `data/ml-export.csv` — written on ML export upload
- `data/metadata.json` — JSON sidecar tracking filename and uploadedAt for each slot

**Backend**
- `backend/routers/settings.py` — new router; seven endpoints as documented above
- Registration in `backend/main.py`: `app.include_router(settings.router)`

**Frontend types — `frontend/src/types.ts`**
- `StoredFileInfo` interface
- `StoredFilesStatus` interface

**Frontend component — `frontend/src/components/Settings.tsx`** (new)
- Two file management cards: eBird Backup and ML Export
- Each card: filename + upload date when stored; "No file saved" when absent
- Upload control (button or drop zone) + Clear button (disabled when no file stored)
- Fetches `GET /settings/files` on mount to populate initial state
- Upload and delete handlers update local `status` state directly

**Frontend component — `BreedingCodeList.tsx`**
- `{ tag: 'loading-saved' }` phase added; displayed as a loading spinner
- `useEffect` on mount: calls `GET /settings/files/ebird`; on 200 fetches text, parses with existing `parseBreedingCodes`, sets `phase: ready` and `savedFileInfo`; on 404 or error stays at idle
- `savedFileInfo` state (new): shown in the controls row as "Loaded from saved file: [filename]" when set
- `handleReset` clears `savedFileInfo` to `null`

**Frontend component — `LifeList.tsx`**
- `{ tag: 'loading-saved' }` phase added; displayed as a loading spinner
- `useEffect` on mount: calls `GET /settings/files/ml`; on 200 fetches text, runs auto-detection and `parseMLExport`, sets phase and `savedFileInfo`; on 404 or error stays at idle
- `savedFileInfo` state (new): shown in the controls row
- `handleReset` clears `savedFileInfo` to `null`

**`frontend/src/App.tsx`**
- Settings tab added as fifth tab (rightmost)
- `Settings` component mounted with display toggle
- `isExpanded` is not propagated to Settings (Settings has no expand toggle)

**Infrastructure**
- `.gitignore`: `data/` entry added
- `frontend/vite.config.ts`: `/settings` proxy added pointing to `http://localhost:1620`

### Modified

None — all changes are additive. No existing types, API response shapes, or component interfaces are changed in a breaking way. The `Phase` union in both list components gains a new tag; all existing `phase.tag` checks remain correct because the new tag is handled in new branches.

### Unchanged

- All existing endpoints and response shapes
- All parser modules (`parseBreedingCodes`, `parseMLExport`, `parseLifeList`)
- `LifeListEntry`, `BreedingEntry`, `FileData`, `ComparisonResult`
- `MediaFilterState`, `BreedingFilterSet`, `MEDIA_FILTER_CLEAR`
- `SortState`, `BreedingSortState`, `NameSortMode`, `SortColumn`, `SortDir`
- `taxonMap` / `taxonOrders` data flow in existing components
- `SpeciesLinks` component
- `ListComparer`, `ResultsView`, `SpeciesPanel`, `DropZone`

---

## Migration Plan

No database migrations. Steps for the Engineer in Stage 5:

1. **`.gitignore`** — add `data/` line.

2. **Backend router** — create `backend/routers/settings.py`:
   - Define `DATA_DIR`, `EBIRD_FILE`, `ML_FILE`, `META_FILE` paths
   - Implement `read_meta()` / `write_meta()` helpers for `metadata.json`
   - Implement all seven endpoints with validation, streaming, and metadata updates
   - Register in `backend/main.py`

3. **Backend tests** — create `backend/tests/test_settings_router.py`:
   - Upload valid CSV → 200, file exists on disk, metadata updated
   - Upload non-CSV → 400
   - GET file when stored → 200 with CSV content
   - GET file when absent → 404
   - DELETE when stored → 200, file gone, metadata null
   - DELETE when absent → 404
   - GET /settings/files → correct status for stored/absent combinations

4. **Frontend types** — add `StoredFileInfo` and `StoredFilesStatus` to `frontend/src/types.ts`.

5. **`Settings.tsx`** — create new component; wire upload, clear, and display logic.

6. **`BreedingCodeList.tsx`** — add `loading-saved` phase; add `savedFileInfo` state; add auto-load `useEffect`.

7. **`LifeList.tsx`** — add `loading-saved` phase; add `savedFileInfo` state; add auto-load `useEffect`.

8. **`App.tsx`** — add Settings tab and mount component.

9. **`vite.config.ts`** — add `/settings` proxy.

---

## Design Decisions

**Fixed server-side filenames, original name in metadata only.**
The server stores files as `ebird-backup.csv` and `ml-export.csv` regardless of the
original filename. The original name is preserved in `metadata.json` for display only.
This prevents path traversal attacks and keeps file management simple — there is always
at most one file per slot.

**Single `metadata.json` sidecar for both files.**
One file to read for the Settings tab status check, one file to write on any change.
Simpler than two separate sidecar files, and the combined payload is tiny.

**`loading-saved` is a distinct phase, not a flag.**
Adding a flag like `isAutoLoading: boolean` alongside `phase` would create invalid
combinations (e.g. `phase: ready` + `isAutoLoading: true`). A dedicated phase tag
is unambiguous and fits the existing discriminated union pattern in both components.

**Auto-load fires on component mount, not on tab visibility.**
All tab components are always mounted (display-toggle pattern). Firing on mount means
the auto-load happens immediately on page load — the tab is ready by the time the user
clicks it. No visibility API or intersection observer needed.

**`savedFileInfo` cleared on reset, not on manual upload.**
When the user uploads a file via the tab's own upload UI (one-off use), `savedFileInfo`
is cleared from the display but the server-side file is untouched. On the next page
load, the stored default is restored. This satisfies FR-12 without any server round-trip.

**`DATA_DIR` resolved from `__file__` in settings.py.**
This makes the path correct regardless of the working directory from which uvicorn is
started. Hardcoding a relative path would break when `uvicorn` is run from a directory
other than the project root.
