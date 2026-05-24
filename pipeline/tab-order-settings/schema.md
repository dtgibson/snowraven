# Schema — Tab Order Settings

## Path
Frontend Only — No data layer changes required

## Confirmation
All PRD requirements involve reading/writing `localStorage` and manipulating React state in `App.tsx`. No backend changes are needed. No new endpoints, no files on disk, no database.

## Existing Structure This Feature Works With

### `App.tsx` — Tab type and state

```typescript
type Tab = 'weather' | 'comparer' | 'life-list' | 'breeding-codes'
         | 'species-detail' | 'map-explorer' | 'birding-stats' | 'settings'
```

- `activeTab: Tab` state controls which panel is shown
- Tab bar renders 8 `<button>` elements in hardcoded order
- Panel visibility uses `display: activeTab === tab ? 'flex' : 'none'` (display toggling — tabs are never unmounted)
- `tabStyle(tab)` helper returns inline styles including the active indicator

The 7 configurable tab IDs (in user-specified default order): `'weather'`, `'species-detail'`, `'birding-stats'`, `'map-explorer'`, `'life-list'`, `'breeding-codes'`, `'comparer'`. The `'settings'` tab is fixed and excluded.

Note: the current hardcoded order in the file differs from the new default the PRD defines. The Engineer will replace the hardcoded order with the new default.

### `localStorage` — existing pattern (`src/lib/theme.ts`, `Settings.tsx`)

All reads and writes are wrapped in try/catch to handle private browsing silently:
```typescript
try { localStorage.setItem('sr-theme', pref) } catch { /* private browsing */ }
try { const val = localStorage.getItem('sr-theme') } catch { /* private browsing */ }
```
The new `sr-tab-layout` key must follow the same pattern exactly.

### `localStorage` schema for `sr-tab-layout`

```json
{
  "order": ["weather", "species-detail", "birding-stats", "map-explorer", "life-list", "breeding-codes", "comparer"],
  "hidden": []
}
```

- `order` — all 7 configurable tab IDs in user-defined sequence (Settings never included)
- `hidden` — tab IDs currently toggled off (subset of `order`)

### Initialisation timing (NFR-04)

The preference must be read at module level in a new `src/lib/tabLayout.ts` utility — before `App` renders — and the initial state passed into `App` as the starting value for `useState`. This avoids a first-paint flash where tabs render in default order then jump to the stored order.

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation. No migrations need to be written or run for this feature.
