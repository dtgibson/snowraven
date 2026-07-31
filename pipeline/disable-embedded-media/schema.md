# Schema — Disable Embedded Media

## Path
Frontend Only — No data layer changes required

## Confirmation
The durable preference fits SnowRaven's existing generic settings storage seam. The
seam already accepts arbitrary JSON values on desktop and web/Pi, so this feature
needs no database changes, new backend endpoint, filesystem format, table, column,
relationship, or migration.

Every PRD requirement was checked for persistence impact. The only new persisted
value is a boolean stored through the existing `storage.getSetting` /
`storage.setSetting` contract. Existing ML export rows and derived media collections
already contain all information needed for the disabled presentation.

## Existing Data Used by This Feature

### Generic setting: `disableEmbeddedMedia`
- Stored value: raw JSON boolean.
- Read contract: `storage.getSetting<unknown>('disableEmbeddedMedia')`.
- Normalization contract: only the literal value `true` disables embeds. Missing,
  malformed, and every non-boolean value normalize to `false`.
- Default: `false` (embedded media remains enabled for fresh and upgraded installs).
- Desktop persistence: `TauriStorage` stores the key in
  `AppLocalData/data/settings.json` through the existing generic setting methods.
- Web/Pi persistence: `WebStorage` uses the existing raw-JSON
  `GET /settings/{key}` and `POST /settings/{key}` contract, backed by
  `data/settings/<key>.json`; `backend/routers/settingskv.py` already accepts a bare
  boolean and requires no change.
- Failure contract: the write promise must reject on persistence failure so Settings
  can restore the last durable value and show an inline error. `WebStorage.setSetting`
  currently does not reject non-2xx responses, so the frontend storage adapter must
  add that response check (or an equivalent verified-write path); the backend API
  shape remains unchanged.

### App-owned preference state and propagation
- `App.tsx` is the authoritative owner because it already spans Settings and every
  mounted tab. Use an unresolved state (`boolean | null`, where `null` means not yet
  hydrated) and treat both `null` and `true` as ineligible to mount an iframe. This
  satisfies the startup closed gate without component-local storage reads.
- Hydrate the setting in `App.tsx` on startup through `storage`, then pass the loaded
  value and a persistence handler to `Settings.tsx`.
- The Settings handler updates the app-wide state immediately, persists without a
  Save action, and rolls back to the last durable value if the write rejects; the
  toggle must expose that failure with `role="alert"` and must not continue to claim
  the failed value.
- Propagate embed eligibility from `App.tsx` to the two current consumers:
  `SpeciesDetail`, and `NamedBirds` → `NamedBirdsTable` → `NamedBirdRow` →
  `NamedBirdMedia`. The existing shared `ToggleSwitch` supplies the project's
  keyboard-operable `role="switch"` convention for the Settings control.

### Species Detail media data
- `recentMediaIds: Record<MediaType, string | null>` is derived from existing
  observations and `phase.mediaMap`; it is the presence gate for Recent Media.
- `mediaRowById: Map<string, MLExportRow>` supplies existing `date` and
  `checklistId` metadata for the selected Photo, Audio, and Video assets.
- `RecentMediaEmbed` already renders the format label, capture date,
  `ChecklistLink`, and a direct Macaulay Library asset link using `mlAssetUrl`.
  Disabled mode must preserve those local fields and link-outs while replacing the
  section's player area with the exact note from the PRD. The note appears only when
  `hasML` and at least one `recentMediaIds` entry already make the section eligible.

### Named Birds media data
- `mlRows: MLExportRow[] | null` records whether an ML export is loaded.
- `computeNamedBirdMedia(mlRows)` already derives
  `Map<NamedBird.key, NamedBirdAsset[]>`; each `NamedBirdAsset` contains
  `catalogId`, `format`, `date`, and `checklistId`.
- Existing presence gates remain authoritative: no ML export means no media section;
  an expanded bird with zero matched assets keeps its existing empty state and does
  not show the disabled note. An expanded bird with matched assets shows one disabled
  note for that media area while retaining format/date metadata, checklist links, and
  direct `mlAssetUrl` links.

### Shared embed inventory
- `frontend/src/components/MediaEmbed.tsx` → `MediaFrame` contains the repository's
  only Macaulay Library `<iframe>` and constructs the sole
  `https://macaulaylibrary.org/asset/<id>/embed` URL.
- Species Detail reaches it through `SpeciesDetail` → `RecentMediaEmbed` →
  `MediaFrame`.
- Named Birds reaches it through `NamedBirds` → `NamedBirdsTable` → `NamedBirdRow`
  → `NamedBirdMedia` → `NamedBirdMediaItem` → `MediaFrame`.
- Preference checks must occur above `MediaFrame` in both surface paths so disabled
  or unresolved state prevents the component, shimmer, fallback timer, intersection
  callback, and iframe from mounting. `MediaFrame` should also accept the centralized
  eligibility gate (or be guarded by an equivalent shared boundary) as defense in
  depth against a future unguarded callsite.

## No Data Layer Work Required
The Engineer can proceed directly to frontend state, storage-adapter, Settings, and
media-surface implementation. No migrations need to be written or run, and no new
backend route, request body, response type, or persistent data model is required.

Structural constraints: hydrate once at the App root; fail closed until hydration
completes; normalize with `raw === true`; use only the `storage` seam; reconcile failed
writes; render the disabled note only where embed-backed content exists; preserve all
local metadata and direct links; and keep `MediaFrame` as the sole iframe constructor.
