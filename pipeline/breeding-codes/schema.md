# Schema Design — Breeding Code List

## Detection Path: Incremental (no schema change)

All new code is frontend-only. No backend files are touched. No database exists in this project.

---

## New Files

| File | Purpose |
|------|---------|
| `frontend/src/lib/breedingCodes.ts` | Code definitions, tier assignments, color map, `BREEDING_CODE_MAP` |
| `frontend/src/lib/parseBreedingCodes.ts` | CSV parser returning `BreedingData` |
| `frontend/src/lib/parseBreedingCodes.test.ts` | Parser unit tests |
| `frontend/src/components/BreedingCodeList.tsx` | Parent: drop zone, phase state, controls |
| `frontend/src/components/BreedingCodeTable.tsx` | Table: sort, filter, circle cells |

## Modified Files

| File | Change |
|------|--------|
| `frontend/src/types.ts` | Add `BreedingSortColumn`, `BreedingSortState`, `BreedingFilter` |
| `frontend/src/App.tsx` | Add `'breeding-codes'` to `Tab` union; add tab button + panel |

---

## Data Flow

```
User drops eBird CSV
  → BreedingCodeList reads file text
  → parseBreedingCodes(text)
      → returns { entries: BreedingEntry[], codesPresent: string[] }
  → phase transitions to 'ready'
  → BreedingCodeList renders controls + BreedingCodeTable
      → filter applied (entries where codes[filter] > 0)
      → sort applied (by name or by code count)
      → cells rendered as tier-colored circles with count
```

---

## Type Additions

```typescript
// types.ts additions
export type BreedingSortColumn = 'name' | string
export interface BreedingSortState {
  column: BreedingSortColumn
  dir: 'asc' | 'desc'
}
export type BreedingFilter = 'all' | string

// App.tsx change
type Tab = 'weather' | 'comparer' | 'life-list' | 'breeding-codes'
```

---

## Key Architectural Decisions

**`breedingCodes.ts` is the single source of truth** — both the table column order and the filter pill order derive from `BREEDING_CODES`. Adding or reordering a code requires changing only this file.

**`codesPresent` drives both columns and pills** — the parser returns the canonical-ordered subset of codes that appear in the data. Both the table and the filter pill row consume this same array. No divergence possible.

**Sort column is typed as `'name' | string`** — breeding code strings are valid sort columns. This avoids an exhaustive union of all 23 codes and keeps the sort logic simple: anything that isn't `'name'` is a code lookup.

**Sticky-left species column + horizontal scroll** — the table wrapper gets `overflow-x: auto`; the species name column gets `position: sticky; left: 0`. CSS-only, no JS scroll management needed.
