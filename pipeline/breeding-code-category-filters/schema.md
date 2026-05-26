# Schema — Breeding Code Category Filters

## Type additions — `frontend/src/lib/breedingCodes.ts`

```typescript
// Union of the three eBird evidence category names
export type BreedingCategory = 'confirmed' | 'probable' | 'possible'

// Derived at module level — stays in sync if tier assignments change
export const CATEGORY_CODES: Record<BreedingCategory, Set<string>> = {
  confirmed: new Set(BREEDING_CODES.filter(d => d.tier >= 3).map(d => d.code)),
  probable:  new Set(BREEDING_CODES.filter(d => d.tier === 2).map(d => d.code)),
  possible:  new Set(BREEDING_CODES.filter(d => d.tier === 1).map(d => d.code)),
}
```

## State addition — `frontend/src/components/BreedingCodeList.tsx`

```typescript
const [categoryFilter, setCategoryFilter] = useState<Set<BreedingCategory>>(new Set())
```

## Filter predicate

Replaces the current inline `filteredCount` expression:

```typescript
function applyFilters(entries: BreedingEntry[]): BreedingEntry[] {
  if (categoryFilter.size === 0 && filter.size === 0) return entries
  return entries.filter(e => {
    for (const cat of categoryFilter) {
      if (![...CATEGORY_CODES[cat]].some(code => (e.codes[code] ?? 0) > 0)) return false
    }
    for (const code of filter) {
      if ((e.codes[code] ?? 0) <= 0) return false
    }
    return true
  })
}
```

Logic: OR within each active category, AND across all active categories and individual codes.

## Reset points

| Event | `filter` | `categoryFilter` |
|-------|----------|-----------------|
| "All" clicked | `new Set()` | `new Set()` |
| `processFile` | `new Set()` | `new Set()` |
| `handleReset` | `new Set()` | `new Set()` |

## Pill rendering

Static ordered array drives category pill rendering:

```typescript
const CATEGORY_META: { key: BreedingCategory; label: string }[] = [
  { key: 'confirmed', label: 'Confirmed' },
  { key: 'probable',  label: 'Probable' },
  { key: 'possible',  label: 'Possible' },
]
```

A pill is rendered only if `codesPresent` contains ≥1 code from `CATEGORY_CODES[key]`.

Filter row order: All → Confirmed → Probable → Possible → divider → individual code pills → sort toggle

## Files affected

| File | Change |
|------|--------|
| `frontend/src/lib/breedingCodes.ts` | Add `BreedingCategory` type + `CATEGORY_CODES` constant |
| `frontend/src/components/BreedingCodeList.tsx` | Add `categoryFilter` state, updated predicate, new pills |

No backend changes. No new files. No changes to `BreedingCodeTable`.
