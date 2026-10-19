// The Media Targets view's Target Species list, shown when no ML export is
// loaded: a search box over the species in the eBird backup and a checkbox per
// species to tick as a target. Lifted out of MapExplorer.tsx
// (code-search-and-a11y-polish) so the code modules it reads stay out of that
// file, whose `lib/alphaCodeWiring.test.ts` call-site row asserts it wires no
// code search of its own: the shared picker does that for its other boxes.
//
// THE SAME MATCH AS EVERY SPECIES PICKER. The query is normalized once per
// keystroke and ranked through `rankSpeciesMatches` with the imported
// `matchesSpeciesQuery` binding and no `order`, exactly as `SpeciesCombobox`
// calls it (rule A): birds that carry the typed code come first, then birds
// whose common or scientific name contains it, each group in the list's own
// order. `rows` is MapExplorer's `speciesOptions` memo, the very array the My
// Sightings species picker is handed, so the code index, which
// `alphaCodeIndexFor` memoizes per array identity, is built once and shared.
// The row cap applies AFTER ranking, so a code match is never cut off by
// alphabetical position.
//
// LINEAR PER KEYSTROKE (the scan declaration `.claude/rules/security.md`
// asks for). One pass over `rows`, a `toLowerCase` and `includes` on each
// common and scientific name, with no sort because no `order` is passed, plus
// one `Map.get` for the code; the code index is built once per array identity
// and shared with the My Sightings picker. The security review measured it
// through this component at about 2x per doubling (1.8 to 2.4x) up to 160,000
// names and 32M characters, with never more than 60 rows drawn.
//
// LOAD ON FOCUS, NEVER WAIT. Focusing the search box is this surface's
// `loadAlphaCodes()` trigger, beside Search's and the shared picker's. Nothing
// awaits it: until the table arrives `useAlphaCodes()` is null and the list
// matches names only, and when it arrives the list re-ranks the query already
// typed. There is no highlight here to keep or clear (the rows are checkboxes),
// so `highlightOnCodeArrival` has nothing to do. Rows look exactly as before:
// no badge, no label.

import { useMemo } from 'react'
import { matchesSpeciesQuery, normalizeSpeciesQuery, rankSpeciesMatches } from '../../lib/speciesMatch'
import { alphaCodeHits } from '../../lib/alphaCodes'
import { loadAlphaCodes } from '../../lib/alphaCodesAsset'
import { useAlphaCodes } from '../../lib/useAlphaCodes'

/** How many rows the list draws, counted after ranking (unchanged). */
export const TARGET_SPECIES_ROW_CAP = 60

export interface TargetSpeciesRow {
  name: string
  sciName?: string
}

export function TargetSpeciesList({ rows, query, onQueryChange, selected, onToggle }: {
  /** Every species in the backup, alphabetical; pass the memoized array. */
  rows: readonly TargetSpeciesRow[]
  query: string
  onQueryChange: (query: string) => void
  selected: ReadonlySet<string>
  onToggle: (name: string, checked: boolean) => void
}) {
  const alphaCodes = useAlphaCodes()
  const shown = useMemo(() => {
    const q = normalizeSpeciesQuery(query)
    const matched = q
      ? rankSpeciesMatches(rows, q, alphaCodeHits(alphaCodes, rows, q), matchesSpeciesQuery)
      : rows
    return matched.slice(0, TARGET_SPECIES_ROW_CAP)
  }, [rows, query, alphaCodes])

  return (
    <>
      <input className="sr-input-16" type="text" placeholder="Search species…" value={query}
        onChange={e => onQueryChange(e.target.value)}
        onFocus={() => { void loadAlphaCodes() }}
        style={{ width: '100%', height: 32, padding: '0 10px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
      />
      <div style={{ maxHeight: 130, overflowY: 'auto', border: '1.5px solid var(--sr-border)', borderRadius: 6, background: 'var(--sr-surface)' }}>
        {shown.map(({ name }) => (
          <label key={name} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', minWidth: 0 }}>
            <input
              type="checkbox"
              checked={selected.has(name)}
              onChange={e => onToggle(name, e.target.checked)}
              style={{ flexShrink: 0 }}
            />
            <span style={{ color: 'var(--sr-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</span>
          </label>
        ))}
      </div>
    </>
  )
}
