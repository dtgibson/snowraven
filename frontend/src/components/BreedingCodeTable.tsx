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

  // Make the sortable column headers keyboard-operable (Enter / Space).
  function handleHeaderKey(e: React.KeyboardEvent, col: string) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleHeaderClick(col)
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
    cursor: 'pointer',
    userSelect: 'none',
    position: 'sticky',
    top: 0,
    background: 'var(--sr-bg)',
    boxShadow: 'inset 0 -1px 0 var(--sr-border)',
    zIndex: 2,
  }

  return (
    <div style={{
      border: '1px solid var(--sr-border)',
      borderRadius: 10,
      background: 'var(--sr-surface)',
      display: 'flex',
      flexDirection: 'column',
      ...(wideMode ? { width: 'max-content' } : {}),
    }}>
      <div style={wideMode ? {} : { overflowX: 'auto' }}>
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
                tabIndex={0}
                onClick={() => handleHeaderClick('name')}
                onKeyDown={e => handleHeaderKey(e, 'name')}
                aria-sort={sort.column === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                style={{
                  ...thBase,
                  ...(wideMode ? {} : { left: 0, zIndex: 3, boxShadow: 'inset 0 -1px 0 var(--sr-border), 1px 0 0 var(--sr-border)' }),
                  textAlign: 'left',
                  padding: '10px 12px',
                  width: 220,
                  minWidth: 220,
                  color: sort.column === 'name' ? 'var(--sr-text)' : 'var(--sr-text-muted)',
                }}
              >
                Species{sortIndicator('name')}
              </th>
              {codesPresent.map(code => {
                const def = BREEDING_CODE_MAP.get(code)!
                return (
                  <th
                    key={code}
                    scope="col"
                    tabIndex={0}
                    onClick={() => handleHeaderClick(code)}
                    onKeyDown={e => handleHeaderKey(e, code)}
                    aria-sort={sort.column === code ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
                    title={def.label}
                    style={{
                      ...thBase,
                      textAlign: 'center',
                      padding: '10px 0',
                      width: 44,
                      minWidth: 44,
                      color: sort.column === code ? 'var(--sr-text)' : 'var(--sr-text-muted)',
                    }}
                  >
                    {code}{sortIndicator(code)}
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
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
                    width: 220,
                    minWidth: 220,
                    maxWidth: 220,
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
                              color: def.tier === 1 ? 'var(--sr-tier-1-text)' : '#fff',
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
