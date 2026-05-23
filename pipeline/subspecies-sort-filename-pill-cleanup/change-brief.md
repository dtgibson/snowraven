# Change Brief — subspecies-sort-filename-pill-cleanup

## Track
Maintain

## Summary
Three independent improvements: a bug fix for taxonomic sort regression, dead UI removal, and stale copy removal.

---

## Change 1 — Fix taxonomic sort with Show Subspecies toggled

**File:** `frontend/src/components/LifeListTable.tsx`

**Problem:** `getOrder()` looks up `taxonOrders[entry.commonName]`. The `taxonOrders` map is populated with merged species names (e.g., "Mallard"). When `mergeSubspecies` is false, entries carry full parenthetical names like "Mallard (Domestic type)" — these aren't in the map, so they return `Infinity` and sort to the bottom instead of their correct taxonomic position.

**Fix:** Add a fallback to the normalized name before returning `Infinity`. Import `normalizeSpeciesName` from `'../lib/speciesUtils'`.

```ts
// Before
return taxonOrders[entry.commonName] ?? Infinity

// After
return taxonOrders[entry.commonName] ?? taxonOrders[normalizeSpeciesName(entry.commonName)] ?? Infinity
```

---

## Change 2 — Remove filename pill from Media List, Breeding Codes, and Species Detail

**Files:**
- `frontend/src/components/LifeList.tsx`
- `frontend/src/components/BreedingCodeList.tsx`
- `frontend/src/components/SpeciesDetail.tsx`

**Problem:** Each tab shows a pill with the stored ML/backup filename. This was useful when per-tab file upload existed. Now that Settings is the sole file source, the pill is dead UI.

**Removals per file:**
- The `{savedFileInfo && (...)}` pill block
- The `savedFileInfo` state declaration and its setter call
- The `FileCheck` lucide import (and `StoredFileInfo` type import if it becomes unused)

---

## Change 3 — Remove stale copy from Settings

**File:** `frontend/src/components/Settings.tsx`

**Problem:** The sentence "Uploading a different file within a tab is session-only and won't replace your saved default." describes a capability that no longer exists.

**Fix:** Remove that sentence. The preceding sentence about auto-loading remains.

---

## Scope boundaries
- No new user-facing behavior
- No new design decisions
- No schema changes
- No API changes
- No decisions recorded in DECISIONS.md are reversed
