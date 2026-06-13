# Schema — Checklists Tab

## Path
Frontend Only — no data layer changes required.

## Confirmation
Assessed against every PRD requirement: no new stored data, no migrations, no backend or endpoint changes, and no storage-seam writes — filter and toggle state is session-local per the PRD's out-of-scope list. Every section is derived in memory from the two already-stored CSVs.

## Existing Data Used by This Feature

### eBird backup → `ObservationEntry[]` (`loadEbirdObservations()`, `lib/observationsCache.ts`)
- One row per species-observation; parsed once, cached app-wide, off-thread.
- Fields used: `submissionId`, `date`, `time`, `location`, `county`, `stateProvince`, `protocol`, `duration` (**minutes**), `distance` (km), `numObservers`, `allObsReported` (true/false/null), `checklistComments` (checklist-level, repeated on every row), `speciesComments` (row-level), `breedingCode`, `catalogIds`, `commonName`, `scientificName`.

### Checklist grouping → `ChecklistEntry[]` (`computeChecklists()`, `lib/birdingStats.ts`)
- The canonical Submission-ID grouper — carries every checklist-level field plus `speciesCount`/`individualCount`. This is Section 3's row model, used as-is.

### ML export → `MLExportResult` (`loadMLExport()`, `lib/mlExportCache.ts`) — optional
- `mediaMap` (catalog ID → Photo/Audio/Video) joined against `ObservationEntry.catalogIds` via `observationMediaFormats()` (`lib/observationMedia.ts`) for the media-type filters and per-type indicators (FR-18/20/22).
- Absent → media-type filters hidden; "has media" falls back to `catalogIds.length > 0` from the backup alone.

### Existing helpers the feature composes
- `hasWeatherBlock` / `hasTideBlock` / `hasSnowravenWeatherBlock` / `hasRaincrowWeatherBlock` (`lib/commentBlocks.ts`) — power the has-weather/has-tide *filters* (FR-08, toggle-independent).
- `protocolName()` (`lib/checklistMeta.ts`) — protocol display names. Caution for the Engineer: its `formatDuration()` takes **hours**; CSV duration is **minutes**.
- `formatDate()` (`lib/formatDate.ts`) — honors the user's date-format preference (NFR-05).
- `SUBMISSION_ID_RE` (`components/speciesDetail/ui.tsx`) — mandatory link gate (FR-23, NFR-03).
- `lib/commentText.ts` (`decodeEntities`, `commentSegments`) — injection-safe comment rendering with validated http(s) links (FR-12); the Comparer's file-local `CommentText` component should be lifted to a shared module rather than copied a third time.
- `MediaCommentsSection.tsx` + `lib/mediaComments.ts` — the proven "last 10 / expandable / searchable" pattern both new boxes clone.
- `BirdName` + batched `/taxonomy/codes` — species rendering in Section 2 (FR-14).
- `ToggleSwitch`, the tri-state pill idiom, `Set` multi-select pills, county `<select>`, `DateRangeState` — the filter controls (FR-20), per the Multimedia/Breeding Codes patterns.

## New In-Memory Structures (computed, never stored)

1. **`stripWeatherTideBlocks(raw: string): string`** — the one genuinely new piece of plumbing, added to `lib/commentBlocks.ts` so it shares the existing marker constants. Removes SnowRaven/Raincrow weather blocks and NOAA tide blocks; handles blocks at start/middle/end; collapses leftover blank lines; returns `''` for block-only comments. Single source of truth for FR-05/06/07, unit-tested against the weather/tide formatter output formats.
2. **Comment-box entries** (derived): checklist comments deduped to one per checklist `{submissionId, date, location, text}`; species comments one per commented observation, plus `commonName`/`scientificName`.
3. **Per-checklist filter flags** (derived in one pass over each checklist's rows): has checklist comment (toggle-aware), has species comments, has media + media-format set, has breeding codes, has weather block, has tide block.
4. **A new pure module** (e.g. `lib/checklistsTab.ts`) holding entry-building, flag derivation, filtering, and sorting — unit-testable exactly like `mediaComments.ts`, keeping the tab component thin.

## No Data Layer Work Required
No migrations, no backend changes, no new endpoints, no storage writes. The Engineer proceeds directly to UI implementation over the caches above.
