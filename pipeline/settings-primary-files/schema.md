# Schema Design — Settings-First File Model
**Feature:** settings-primary-files
**Session:** 001
**Date:** 2026-05-22
**Stage:** 3 — The Architect
**Source:** prd.md (approved)

---

## Architecture Classification

**Frontend Only**

All APIs required by this feature already exist. No new backend endpoints, database tables, or server-side changes are needed. Every change is confined to the React frontend.

---

## Existing APIs (No Changes Required)

| Endpoint | Used By | Purpose |
|---|---|---|
| `GET /settings/files/ebird` | BreedingCodeList, SpeciesDetail, ListComparer | Fetch stored eBird backup CSV |
| `GET /settings/files/ml` | LifeList | Fetch stored ML export CSV |
| `GET /settings/files` | BreedingCodeList, LifeList, SpeciesDetail | Check stored file status |
| `GET /settings/keys` | App.tsx (Weather tab) | Check whether API keys are configured |

These endpoints were built for the Settings tab feature. This feature repurposes them as the primary data source for all consumer tabs.

---

## New Shared Component

### `SetupRequired`
**Path:** `frontend/src/components/SetupRequired.tsx`

A reusable card displayed in place of the old drop zone when a required file is not stored in Settings. Used by BreedingCodeList, LifeList, and SpeciesDetail.

**Props:**
```typescript
interface SetupRequiredProps {
  title: string                  // e.g. "eBird Backup Required"
  instructions: React.ReactNode  // explanatory text with file name, how to get it, Settings path
  onGoToSettings: () => void     // switches active tab to Settings
}
```

**Visual requirements (NFR-01):** Same icon, same card style, same "Go to Settings" button style across all three tabs. The visual design is intentional — this pattern must be instantly recognisable.

---

## Component Change Map

### `BreedingCodeList.tsx`

**Changes:**
- Remove `Phase.idle` (drop zone state) — the only initial state is now `loading-saved`
- Remove `Phase.idle` drop zone JSX
- Add `Phase.setup-required` — renders `<SetupRequired>` instead of the drop zone
- Change `loading-saved` failure path: when no stored file found, transition to `setup-required` (not `idle`)
- Remove "Load new file" and "Load different file" buttons from `ready` state toolbar (FR-01, FR-04)
- `onGoToSettings` prop added to the component for the "Go to Settings" button

**Phase state machine after changes:**
```
loading-saved → ready          (stored file found and parsed)
loading-saved → setup-required (no stored file found)
loading-saved → error          (fetch/parse failure on a stored file)
```

---

### `LifeList.tsx`

**Changes:**
- Remove drop zone JSX from `idle` phase
- Add `setup-required` phase that renders `<SetupRequired>` (ML export instructions)
- Change `loading-saved` failure path: when no stored ML file found, transition to `setup-required`
- Remove "Load new file" and "Load different file" buttons from `ready` state toolbar (FR-05, FR-09)
- Keep the ML filename warning banner in `ready` state (FR-08) — it is triggered by stored filename, not an uploaded file
- `onGoToSettings` prop added

**Phase state machine after changes:**
```
loading-saved → ready             (stored ML file found and parsed)
loading-saved → setup-required    (no stored ML file found)
loading-saved → error             (fetch/parse failure)
```

---

### `SpeciesDetail.tsx`

**Changes:**
- Remove `Phase.idle` drop zone JSX
- Add `Phase.setup-required` — renders `<SetupRequired>` (eBird backup instructions)
- Change `loading-saved` failure path: when no stored eBird file found, transition to `setup-required`
- Remove "Load different file" button from `ready` state (FR-10, FR-12)
- `onGoToSettings` prop added

**Phase state machine after changes:**
```
loading-saved → ready          (stored file found and parsed)
loading-saved → setup-required (no stored file found)
loading-saved → error          (fetch/parse failure)
```

---

### `ListComparer.tsx`

**Changes:**
- Add `storedEbirdStatus: 'loading' | 'available' | 'unavailable'` state (fetched on mount)
- Add `listAMode: 'my-list' | 'upload'` state (defaults to `'my-list'` when stored file available)
- On mount: fetch `GET /settings/files` to determine whether eBird backup is stored
- When `listAMode === 'my-list'`: fetch `GET /settings/files/ebird` on comparison activation; parse using `parseEbird`; use as List A data
- When `listAMode === 'upload'`: show existing `<DropZone>` for List A (current behaviour)
- When `storedEbirdStatus === 'unavailable'`: show `<DropZone>` for List A only, no mode selector (FR-18)
- Rename all List A / List B references to "My List" / "Other List" throughout (FR-13, FR-14)
- Thread label change through: `ListComparer` → `ResultsView` → `SpeciesPanel` header and summary bar (FR-20)
- List B: always `<DropZone>`, always labelled "Other List" (FR-19)

**New state shape (additions only):**
```typescript
type ListAMode = 'my-list' | 'upload'
type StoredEbirdStatus = 'loading' | 'available' | 'unavailable'
```

---

### `App.tsx`

**Changes:**
- Add `keyStatus: { ebird: boolean; openweather: boolean } | null` state
- On mount: fire `GET /settings/keys` and store result in `keyStatus`
- In the Weather tab panel: when `keyStatus` is loaded, show notices for any missing keys (FR-22, FR-23, FR-24)
- Notice for each missing key includes: which key is missing, Settings path (Settings → API Keys → [Key Name]), external link to obtain the key, and a "Go to Settings" button (FR-25, Q-02 default)
- Checklist ID input and lookup button remain visible regardless of key notice state (FR-25)

---

## ResultsView.tsx and SpeciesPanel.tsx

**Changes (label threading only):**
- `ResultsView` props: add `listALabel: string` and `listBLabel: string` (defaulting to "My List" / "Other List")
- Thread labels to: panel headers, summary bar count labels
- `SpeciesPanel`: add `label` prop for the panel header

No logic changes — only label text is affected.

---

## No Changes Required

- `DropZone.tsx` — unchanged; still used by ListComparer List A (upload mode) and List B
- `Settings.tsx` — unchanged; Settings tab file management and API key UI are out of scope
- `parseEbird.ts` and all other parsers — unchanged
- Backend (`settings.py`, `apikeys.py`) — unchanged; all needed endpoints already exist
- `types.ts` — no new shared types needed (new state types are local to their components)

---

## Data Flow Summary

**Breeding Codes / Species Detail / Media List:**
```
App mounts → loading-saved phase →
  GET /settings/files →
    file stored: fetch file → parse → ready phase
    no file:                         setup-required phase (SetupRequired component)
```

**Life List Comparison (List A "Use my list"):**
```
User clicks Compare →
  GET /settings/files/ebird →
    parse CSV → use as listAData → run compareSpecies()
```

**Weather tab:**
```
App mounts → GET /settings/keys →
  keyStatus.ebird === false → show eBird key notice
  keyStatus.openweather === false → show OpenWeather key notice
  both true → no notices shown
```

---

## Implementation Order

1. `SetupRequired.tsx` — new shared component (no dependencies)
2. `BreedingCodeList.tsx` — simplest consumer; validates SetupRequired
3. `SpeciesDetail.tsx` — same pattern
4. `LifeList.tsx` — same pattern plus ML filename warning preservation
5. `ListComparer.tsx` — most complex (mode selector, stored file fetch, label threading)
6. `ResultsView.tsx` + `SpeciesPanel.tsx` — label prop threading
7. `App.tsx` — key status fetch and Weather tab notices
