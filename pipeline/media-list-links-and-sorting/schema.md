# Schema — Media List Links and Sorting

## Path
Frontend Only — No data layer changes required

## Confirmation
Assessed against all PRD requirements. No new tables, columns, relationships, or migrations are needed. No new backend routes. No parser changes.

---

## Type System Changes

### `frontend/src/types.ts`

**Remove:** `SortOrder = 'taxonomic' | 'alpha'`

**Add:**
```typescript
export type SortColumn = 'name' | 'photo' | 'audio' | 'video'
export type SortDir = 'asc' | 'desc'
export interface SortState {
  column: SortColumn
  dir: SortDir
}
```

`SortState` replaces `SortOrder` everywhere it is imported. Current consumers: `LifeList.tsx` (state) and `LifeListTable.tsx` (prop + sort logic).

---

## Component Changes

### `frontend/src/components/LifeListTable.tsx`

**Props interface — after:**
```typescript
interface Props {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
  filter: MediaFilter
  sort: SortState
  onSortChange: (next: SortState) => void
  expanded: boolean
}
```

**Column header rendering** — each of the four headers (`Entries`, `Photo`, `Audio`, `Video`) becomes clickable. Active column appends `↑` or `↓` after the label. Default sort indicator on load: `Entries ↑`.

**Sort logic — after:** switch on `sort.column`:
- `'name'`: `a.commonName.localeCompare(b.commonName)`, reversed if `dir === 'desc'`
- `'photo'`: `countMedia(b, mediaMap, 'Photo') - countMedia(a, mediaMap, 'Photo')` for desc, inverted for asc. Tie-break: `a.commonName.localeCompare(b.commonName)`
- `'audio'`: same pattern for Audio
- `'video'`: same pattern for Video

**"Media" column** — the `<th>` for `['Media', <Eye …>]` and its corresponding `<td>` with the `<Check>` are removed. `Check` and `Eye` imports removed if unused.

**Count cells — non-zero:** renders an `<a>` element:
```
href: https://search.macaulaylibrary.org/catalog?taxaName={encodeURIComponent(entry.commonName)}&mediaType={Photo|Audio|Video}
target: _blank
rel: noreferrer
style: fontSize 13 / fontWeight 600 / color #2D8653 / textDecoration none at rest / underline on hover
```

**Count cells — zero:** unchanged — renders `<Minus>` icon.

### `frontend/src/components/LifeList.tsx`

**State — after:** `useState<SortState>({ column: 'name', dir: 'asc' })`

**`processFile` ML export path:** remove `setSort('alpha')` call — default is already correct.

**`handleReset`:** `setSort({ column: 'name', dir: 'asc' })`

**Sort control block:** entire sort button group JSX deleted.

**`LifeListTable` usage:** add `onSortChange={setSort}` prop.

---

## Files Touched

| File | Change type |
|---|---|
| `frontend/src/types.ts` | Remove `SortOrder`; add `SortColumn`, `SortDir`, `SortState` |
| `frontend/src/components/LifeListTable.tsx` | Remove Media column; add `onSortChange` prop; new sort logic; count links |
| `frontend/src/components/LifeList.tsx` | Replace `SortOrder` state; remove sort buttons; pass new props |

## No Data Layer Work Required
The Engineer can proceed directly to UI implementation.
