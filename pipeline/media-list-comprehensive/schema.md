# Schema — Media List: Comprehensive Species View

**Feature:** media-list-comprehensive
**Date:** 2026-05-21
**Stage:** 3 — The Architect
**Path:** Incremental (existing feature extension)

---

## Architecture Path: Incremental

No new backend endpoints. No new parsers. All changes are in two frontend component files (`LifeList.tsx`, `LifeListTable.tsx`), one type file (`parseLifeList.ts`), and one new shared utility module.

---

## Open Question Resolutions

**OQ-01 — Shared utilities**
Extract to `frontend/src/lib/speciesUtils.ts`. Export `normalizeSpeciesName` and `isSpuhOrSlash`. Import in `LifeList.tsx` and `SpeciesDetail.tsx`. Parsers keep their own internal copies — they are data parsers, not UI components, and keeping them self-contained avoids coupling parsers to display logic.

**OQ-02 — County/date filter in comprehensive mode**
Store `rawEbirdObs: ObservationEntry[]` alongside the existing `rawRows: MLExportRow[]` in `LifeList.tsx` state. When a county/date filter is active AND `hasEbirdBackbone` is true, filter both sets independently and pass them to `buildComprehensiveEntries`. The filtered eBird obs determine which species appear; the filtered ML rows determine media counts. `resolveMLCounties` is updated to accept an optional pre-loaded `ObservationEntry[]` to avoid re-fetching the eBird file from Settings when it's already in state.

**OQ-03 — eBird-only mode (no ML)**
Confirmed: `mediaMap = {}`, all `catalogIds = []`. The existing `hasMedia()` and `countMedia()` functions in `LifeListTable` handle this correctly — zero counts, `—` dashes, no ML links. No code changes needed in `LifeListTable` for this case.

---

## New Shared Module

**`frontend/src/lib/speciesUtils.ts`** — new file

```ts
export function normalizeSpeciesName(name: string): string {
  const parenIdx = name.indexOf('(')
  return parenIdx === -1 ? name : name.slice(0, parenIdx).trim()
}

export function isSpuhOrSlash(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/')
}
```

Update `SpeciesDetail.tsx` to import both from `'../lib/speciesUtils'` and remove its inline definitions.

---

## Type Changes

**`frontend/src/lib/parseLifeList.ts`** — extend `LifeListEntry`

```ts
export interface LifeListEntry {
  commonName: string
  scientificName: string
  taxonomicOrder: number
  catalogIds: string[]
  isNonBird?: boolean   // true for ML-only entries not in eBird backup
}
```

Optional field — all existing `LifeListEntry` construction is unaffected (omitted = undefined = falsy).

---

## New Pure Function: `buildComprehensiveEntries`

Local to `LifeList.tsx`, not exported.

```ts
function buildComprehensiveEntries(
  ebirdObs: ObservationEntry[],
  mlRows: MLExportRow[],
  mergeSubspecies: boolean,
): LifeListEntry[] {
  // Step 1: eBird species map keyed by display name
  const ebirdMap = new Map<string, { sci: string }>()
  for (const o of ebirdObs) {
    const name = mergeSubspecies ? normalizeSpeciesName(o.commonName) : o.commonName
    if (!ebirdMap.has(name)) ebirdMap.set(name, { sci: o.scientificName })
  }

  // Step 2: eBird normalized set for non-bird detection (always normalized)
  const ebirdNormalizedSet = new Set<string>()
  for (const o of ebirdObs) ebirdNormalizedSet.add(normalizeSpeciesName(o.commonName))

  // Step 3: ML catalog map (MLExportRow.commonName is already normalized by parseMLExport)
  const mlCatalogMap = new Map<string, Set<string>>()
  const mlSciMap = new Map<string, string>()
  for (const r of mlRows) {
    const s = mlCatalogMap.get(r.commonName)
    if (s) s.add(r.catalogId)
    else mlCatalogMap.set(r.commonName, new Set([r.catalogId]))
    if (!mlSciMap.has(r.commonName)) mlSciMap.set(r.commonName, r.scientificName)
  }

  const entries: LifeListEntry[] = []

  // Step 4: eBird backbone entries
  for (const [displayName, data] of ebirdMap) {
    const lookupName = mergeSubspecies ? displayName : normalizeSpeciesName(displayName)
    const catalogIds = [...(mlCatalogMap.get(lookupName) ?? [])]
    entries.push({
      commonName: displayName,
      scientificName: data.sci,
      taxonomicOrder: Infinity,
      catalogIds,
      isNonBird: false,
    })
  }

  // Step 5: Non-bird entries (ML species absent from eBird normalized set)
  for (const [mlName, catalogIds] of mlCatalogMap) {
    if (!ebirdNormalizedSet.has(mlName)) {
      entries.push({
        commonName: mlName,
        scientificName: mlSciMap.get(mlName) ?? '',
        taxonomicOrder: Infinity,
        catalogIds: [...catalogIds],
        isNonBird: true,
      })
    }
  }

  return entries
}
```

Key invariant: `MLExportRow.commonName` is always normalized (done in `parseMLExport.ts` at parse time). eBird `ObservationEntry.commonName` is raw. The function handles this asymmetry explicitly.

---

## State Changes in `LifeList.tsx`

### Phase type — extend `ready` variant

```ts
type Phase =
  | { tag: 'idle' }
  | { tag: 'loading-saved' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'
      entries: LifeListEntry[]
      mediaMap: Record<string, string>
      hasEbirdBackbone: boolean   // NEW
    }
```

### New useState declarations (before any early return)

```ts
const [rawEbirdObs, setRawEbirdObs] = useState<ObservationEntry[]>([])
const [mergeSubspecies, setMergeSubspecies] = useState(true)   // true = merge (default)
const [showSpuh, setShowSpuh] = useState(false)
const [showNonBird, setShowNonBird] = useState(false)
```

---

## Data Flow: Auto-Load

1. Fetch `/settings/files`
2. In parallel: fetch ML file (if stored) + eBird file (if stored)
3. If ML response ok: parse ML → `{ entries, mediaMap, rows }`; set `mlUserId`, `savedFileInfo`, `rawRows`
4. If eBird response ok: parse eBird → `ObservationEntry[]`; set `rawEbirdObs`; `hasEbirdBackbone = true`
5. Set phase: `{ tag: 'ready', entries, mediaMap, hasEbirdBackbone }`
6. `fetchTaxonCodes` with the comprehensive entry list (eBird backbone when available)
7. `resolveMLCounties(rows, ebirdObs)` — pass pre-loaded obs to skip re-fetch

If only eBird stored (no ML): `entries = []`, `mediaMap = {}`, `hasEbirdBackbone = true`.
If only ML stored (no eBird): existing behavior exactly. `hasEbirdBackbone = false`.

**`processFile` (manual drop):** After parsing the ML file, check Settings for a stored eBird backup and load it if available. Same as auto-load step 4.

---

## `resolveMLCounties` Signature Update

```ts
const resolveMLCounties = async (
  initialRows: MLExportRow[],
  preloadedEbirdObs?: ObservationEntry[]  // skip Pass 2 fetch if already loaded
) => { ... }
```

Pass 2: if `preloadedEbirdObs` is provided, use it directly instead of fetching from Settings.

---

## `displayEntries` useMemo — Revised

```ts
const displayEntries = useMemo((): LifeListEntry[] => {
  const hasEbird = phase.tag === 'ready' && phase.hasEbirdBackbone

  let base: LifeListEntry[]

  if (hasEbird && rawEbirdObs.length > 0) {
    const filtEbird = hasLocationFilter
      ? rawEbirdObs.filter(o => {
          if (countyFilter !== null && o.county !== countyFilter) return false
          if (dateRange.from && o.date < dateRange.from) return false
          if (dateRange.to && o.date > dateRange.to) return false
          return true
        })
      : rawEbirdObs
    const filtML = hasLocationFilter ? filteredRows : rawRows
    base = buildComprehensiveEntries(filtEbird, filtML, mergeSubspecies)
  } else if (hasLocationFilter && rawRows.length > 0) {
    base = aggregateMLRows(filteredRows)
  } else {
    base = phaseEntries
  }

  return base.filter(e => {
    if (!showSpuh && isSpuhOrSlash(e.commonName)) return false
    if (!showNonBird && e.isNonBird) return false
    return true
  })
}, [phase, rawEbirdObs, rawRows, filteredRows, phaseEntries, countyFilter, dateRange,
    mergeSubspecies, showSpuh, showNonBird, hasLocationFilter])
```

---

## `LifeListTable.tsx` Changes

Add non-bird partition at the top of the sort comparator (before existing column sort logic):

```ts
// Non-bird entries always after bird entries when sorting by name (taxonomic or A-Z)
if (sort.column === 'name') {
  const aNB = a.isNonBird ?? false
  const bNB = b.isNonBird ?? false
  if (aNB !== bNB) return sort.dir === 'asc' ? (aNB ? 1 : -1) : (aNB ? -1 : 1)
}
```

No other changes to `LifeListTable`.

---

## `handleReset` Additions

```ts
setRawEbirdObs([])
setMergeSubspecies(true)
setShowSpuh(false)
setShowNonBird(false)
```

---

## Toggle Rendering

Three `ToggleSwitch` buttons rendered in the controls row when `phase.tag === 'ready'`:
- "Show subspecies" — always visible in ready state
- "Show sp./slash" — always visible in ready state
- "Show non-bird" — visible only when `phase.hasEbirdBackbone === true`

`ToggleSwitch` implemented inline in `LifeList.tsx` matching the identical visual style in `SpeciesDetail.tsx` (28px × 16px track, accent fill when checked, 12px label, 0.15s transition). Not extracted — the two components are self-contained.

---

## `fetchTaxonCodes` Call Site

In comprehensive mode, call `fetchTaxonCodes` with the comprehensive entry list (all eBird backbone species), not just the ML entries. This ensures taxonomic sort works for all eBird species, including those with no media.

---

## Files Changed

| File | Change |
|---|---|
| `frontend/src/lib/speciesUtils.ts` | **New**: `normalizeSpeciesName`, `isSpuhOrSlash` |
| `frontend/src/lib/parseLifeList.ts` | Add `isNonBird?: boolean` to `LifeListEntry` |
| `frontend/src/components/LifeList.tsx` | New state, `buildComprehensiveEntries`, revised `displayEntries`, `resolveMLCounties` update, `processFile` update, toggle UI |
| `frontend/src/components/LifeListTable.tsx` | Non-bird partition in sort comparator |
| `frontend/src/components/SpeciesDetail.tsx` | Import `normalizeSpeciesName`, `isSpuhOrSlash` from `speciesUtils`; remove inline definitions |

No backend changes. New test file: `frontend/src/lib/speciesUtils.test.ts`.
