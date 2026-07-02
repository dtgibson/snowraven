import { useState } from 'react'
import { BREEDING_CODE_MAP, TIER_COLORS } from '../lib/breedingCodes'
import type { BreedingEntry } from '../lib/parseBreedingCodes'
import type { BreedingSortState, SortDir } from '../types'
import { BirdName } from './BirdName'

interface Props {
  entries: BreedingEntry[]
  codesPresent: string[]
  sort: BreedingSortState
  onSortChange: (next: BreedingSortState) => void
  filter: Set<string>
  taxonMap: Record<string, string>
  taxonOrders: Record<string, number>
  wideMode: boolean
  onOpenSpecies?: (commonName: string) => void
}

const TIER_LABELS: Record<number, string> = {
  4: 'Confirmed',
  3: 'Confirmed (also)',
  2: 'Probable',
  1: 'Possible',
}

// Text color for the count badge sitting on a solid TIER_COLORS fill. Paired
// per-theme with --sr-tier-N in globals.css so every tier passes AA in both
// themes (the old hardcoded white-on-tier-2 was 3.96:1 in dark mode).
const TIER_TEXT_COLORS: Record<1 | 2 | 3 | 4, string> = {
  4: 'var(--sr-tier-4-text)',
  3: 'var(--sr-tier-3-text)',
  2: 'var(--sr-tier-2-text)',
  1: 'var(--sr-tier-1-text)',
}

// Sticky species-column width. Was a flat 220px, which on a 320-360px phone left
// the scrollable code matrix a ~1-column peephole. This clamp resolves to 220px
// on every viewport ≥550px (desktop/tablet unchanged) but NARROWS on phones (40vw
// = 128px at 320px), and its rem floor grows the column with the in-app Text Size
// control so it still holds at 200% text scale (the matrix then scrolls in its
// overflow-x wrapper rather than the name column crushing). A viewport/rem
// expression is intrinsically responsive with no media query, so it can live
// inline without the "unreachable by a media query" pitfall the class convention
// guards against. The value is single-sourced so the header cell, every row's
// name cell, and the scrollPaddingLeft stay perfectly aligned.
const NAME_COL_WIDTH = 'clamp(7.5rem, 40vw, 220px)'

export function BreedingCodeTable({ entries, codesPresent, sort, onSortChange, filter, taxonMap, taxonOrders, wideMode, onOpenSpecies }: Props) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const filtered = filter.size === 0
    ? entries
    : entries.filter(e => [...filter].every(code => (e.codes[code] ?? 0) > 0))

  function nameCompare(a: BreedingEntry, b: BreedingEntry): number {
    if (sort.nameSortMode === 'taxonomic') {
      const aOrder = taxonOrders[a.commonName] ?? Infinity
      const bOrder = taxonOrders[b.commonName] ?? Infinity
      const diff = aOrder - bOrder
      if (diff !== 0) return diff
    }
    return a.commonName.localeCompare(b.commonName)
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sort.column === 'name') {
      const cmp = nameCompare(a, b)
      return sort.dir === 'asc' ? cmp : -cmp
    }
    const aCount = a.codes[sort.column] ?? 0
    const bCount = b.codes[sort.column] ?? 0
    if (aCount !== bCount) return sort.dir === 'desc' ? bCount - aCount : aCount - bCount
    return nameCompare(a, b)
  })

  function handleHeaderClick(col: string) {
    if (sort.column === col) {
      onSortChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      const defaultDir: SortDir = col === 'name' ? 'asc' : 'desc'
      onSortChange({ ...sort, column: col, dir: defaultDir })
    }
  }

  function sortIndicator(col: string) {
    if (sort.column !== col) return null
    return (
      <span style={{ fontSize: '0.625rem', color: 'var(--sr-accent)', marginLeft: 2 }}>
        {sort.dir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const tierGroups = new Map<1 | 2 | 3 | 4, string[]>()
  for (const code of codesPresent) {
    const def = BREEDING_CODE_MAP.get(code)
    if (!def) continue
    if (!tierGroups.has(def.tier)) tierGroups.set(def.tier, [])
    tierGroups.get(def.tier)!.push(code)
  }

  const thBase: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    background: 'var(--sr-bg)',
    boxShadow: 'inset 0 -1px 0 var(--sr-border)',
    zIndex: 2,
  }

  // Sortable headers are real <button>s inside the <th> so screen readers
  // announce them as activatable controls (the <th> keeps role columnheader +
  // aria-sort). The button inherits the th's text styling and fills the cell.
  const sortBtn = (active: boolean, justify: 'flex-start' | 'center'): React.CSSProperties => ({
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: justify,
    width: '100%',
    font: 'inherit',
    letterSpacing: 'inherit',
    textTransform: 'inherit',
    color: active ? 'var(--sr-text)' : 'var(--sr-text-muted)',
    background: 'none',
    border: 'none',
    padding: 0,
    cursor: 'pointer',
  })

  return (
    <div style={{
      border: '1px solid var(--sr-border)',
      borderRadius: 10,
      background: 'var(--sr-surface)',
      display: 'flex',
      flexDirection: 'column',
      // min-width:0 lets this card shrink below the table's max-content width
      // when it's a flex child of the panel, so the inner overflowX:auto wrapper
      // actually engages and scrolls instead of pushing the whole page wide.
      minWidth: 0,
      ...(wideMode ? { width: 'max-content' } : {}),
    }}>
      {/* scrollPaddingLeft keeps a focused cell from landing under the sticky
          first column when keyboard focus scrolls it horizontally (WCAG 2.4.11). */}
      {/* position:relative scopes the cells' absolutely-positioned .sr-only
          screen-reader spans to THIS scroll container, so they're clipped with
          the table instead of escaping to the page and forcing horizontal page
          scroll on phones (the wide matrix sits far right of the viewport). */}
      <div style={wideMode ? {} : { overflowX: 'auto', scrollPaddingLeft: NAME_COL_WIDTH, minWidth: 0, position: 'relative' }}>
        <table style={{
          width: '100%',
          minWidth: 'max-content',
          borderCollapse: 'separate',
          borderSpacing: 0,
        }}>
          <thead>
            <tr>
              <th
                scope="col"
                aria-sort={sort.column === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                style={{
                  ...thBase,
                  ...(wideMode ? {} : { left: 0, zIndex: 3, boxShadow: 'inset 0 -1px 0 var(--sr-border), 1px 0 0 var(--sr-border)' }),
                  textAlign: 'left',
                  padding: '10px 12px',
                  width: NAME_COL_WIDTH,
                  minWidth: NAME_COL_WIDTH,
                }}
              >
                <button type="button" style={sortBtn(sort.column === 'name', 'flex-start')} onClick={() => handleHeaderClick('name')}>
                  Species{sortIndicator('name')}
                </button>
              </th>
              {codesPresent.map(code => {
                const def = BREEDING_CODE_MAP.get(code)!
                return (
                  <th
                    key={code}
                    scope="col"
                    aria-sort={sort.column === code ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title={def.label}
                    style={{
                      ...thBase,
                      textAlign: 'center',
                      padding: '10px 0',
                      width: 44,
                      minWidth: 44,
                    }}
                  >
                    {/* The visible header is the terse code; the aria-label carries
                        the full meaning so screen-reader / touch users get it
                        without the UA title tooltip (which never fires on focus). */}
                    <button
                      type="button"
                      aria-label={`Sort by ${def.label} (${code})`}
                      style={sortBtn(sort.column === code, 'center')}
                      onClick={() => handleHeaderClick(code)}
                    >
                      {code}{sortIndicator(code)}
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 && (
              <tr>
                <td colSpan={codesPresent.length + 1} style={{ padding: '20px 12px', textAlign: 'center', color: 'var(--sr-text-muted)', fontSize: '0.8125rem' }}>
                  No species match these filters.
                </td>
              </tr>
            )}
            {sorted.map(entry => {
              const isHovered = hoveredRow === entry.commonName
              const rowBg = isHovered ? 'var(--sr-surface-faint)' : 'var(--sr-surface)'
              return (
                <tr
                  key={entry.commonName}
                  onMouseEnter={() => setHoveredRow(entry.commonName)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <th scope="row" style={{
                    padding: '9px 12px',
                    // <th> defaults to center; match the left-aligned name cells used
                    // elsewhere (Media tab, Life List, etc.).
                    textAlign: 'left',
                    ...(wideMode ? {} : { position: 'sticky', left: 0, zIndex: 1, boxShadow: '1px 0 0 var(--sr-border)' }),
                    background: rowBg,
                    width: NAME_COL_WIDTH,
                    minWidth: NAME_COL_WIDTH,
                    maxWidth: NAME_COL_WIDTH,
                    borderTop: '1px solid var(--sr-border-subtle)',
                    verticalAlign: 'middle',
                    fontWeight: 'normal',
                  }}>
                    <BirdName
                      commonName={entry.commonName}
                      scientificName={entry.scientificName}
                      taxonCode={taxonMap[entry.commonName]}
                      hasEntry={!!onOpenSpecies}
                      onOpenSpecies={onOpenSpecies}
                      showSci
                    />
                  </th>
                  {codesPresent.map(code => {
                    const count = entry.codes[code] ?? 0
                    const def = BREEDING_CODE_MAP.get(code)!
                    return (
                      <td
                        key={code}
                        style={{
                          textAlign: 'center',
                          verticalAlign: 'middle',
                          padding: '6px 0',
                          background: rowBg,
                          borderTop: '1px solid var(--sr-border-subtle)',
                        }}
                      >
                        {count > 0 && (() => {
                          const tierCategoryName = def.tier >= 3 ? 'Confirmed' : def.tier === 2 ? 'Probable' : 'Possible'
                          return (
                            <div style={{
                              width: 28,
                              height: 28,
                              borderRadius: '50%',
                              background: TIER_COLORS[def.tier],
                              color: TIER_TEXT_COLORS[def.tier],
                              fontSize: '0.6875rem',
                              fontWeight: 700,
                              letterSpacing: '-0.3px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}>
                              {count}
                              <span className="sr-only">, {tierCategoryName}</span>
                            </div>
                          )
                        })()}
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      <div style={{
        background: 'var(--sr-surface-faint)',
        borderTop: '1px solid var(--sr-border-subtle)',
        padding: '12px 16px',
        display: 'flex',
        flexWrap: 'wrap',
        gap: 16,
        flexShrink: 0,
      }}>
        {([4, 3, 2, 1] as const).filter(tier => tierGroups.has(tier)).map(tier => (
          <div key={tier} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: TIER_COLORS[tier], flexShrink: 0,
            }} />
            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>
              {TIER_LABELS[tier]}: {tierGroups.get(tier)!.join(' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
