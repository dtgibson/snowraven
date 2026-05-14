# Schema Design — Species Links

## Detection Path: Incremental (no schema change)

Species Links is a UI-only feature. It adds one new React component and modifies four existing ones. No new API endpoints. No new data models. No database tables. No migration.

The existing `POST /taxonomy/codes` backend endpoint is the sole data dependency and is already deployed.

---

## New File

### `frontend/src/components/SpeciesLinks.tsx`

```typescript
interface SpeciesLinksProps {
  speciesCode: string | undefined
}

export function SpeciesLinks({ speciesCode }: SpeciesLinksProps) {
  if (!speciesCode) return null

  return (
    <span style={{
      display: 'inline-flex',
      alignItems: 'center',
      gap: 5,
      marginLeft: 6,
      verticalAlign: 'middle',
    }}>
      <a
        href={`https://ebird.org/species/${speciesCode}`}
        target="_blank"
        rel="noreferrer"
      >
        <img
          src="https://ebird.org/favicon.ico"
          width={14}
          height={14}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </a>
      <a
        href={`https://birdsoftheworld.org/bow/species/${speciesCode}/cur/introduction`}
        target="_blank"
        rel="noreferrer"
      >
        <img
          src="https://birdsoftheworld.org/favicon.ico"
          width={14}
          height={14}
          onError={e => { (e.currentTarget as HTMLImageElement).style.display = 'none' }}
        />
      </a>
    </span>
  )
}
```

---

## Modified Files

| File | Change |
|------|--------|
| `frontend/src/components/SpeciesLinks.tsx` | **New** — inline favicon link component |
| `frontend/src/components/LifeListTable.tsx` | Import `SpeciesLinks`, wrap common name in flex div, pass `taxonMap[entry.commonName]` |
| `frontend/src/components/SpeciesPanel.tsx` | Add `taxonMap?: Record<string, string>` prop, render `<SpeciesLinks>` per row |
| `frontend/src/components/ResultsView.tsx` | Add `taxonMap: Record<string, string>` prop, forward to all three `<SpeciesPanel>` instances |
| `frontend/src/components/ListComparer.tsx` | Add `taxonMap` state, `fetchTaxonCodes` after compare, pass to `ResultsView`, clear on reset |

No changes to: `types.ts`, any backend file, `vite.config.ts`, test files, or build config.

---

## Data Flow

```
ListComparer.handleCompare()
  → compareSpecies() → result
  → fetchTaxonCodes(all names in result) → POST /taxonomy/codes
  → setTaxonMap(codes)
  → taxonMap flows into ResultsView → SpeciesPanel → SpeciesLinks

LifeList.tsx (existing)
  → fetchTaxonCodes() on ML export load (already implemented)
  → taxonMap flows into LifeListTable → SpeciesLinks
```
