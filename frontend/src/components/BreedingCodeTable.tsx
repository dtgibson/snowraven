import { useState } from 'react'
import { BREEDING_CODE_MAP, TIER_COLORS } from '../lib/breedingCodes'
import type { BreedingEntry } from '../lib/parseBreedingCodes'
import type { BreedingSortState, SortDir } from '../types'
import { SpeciesLinks } from './SpeciesLinks'

interface Props {
  entries: BreedingEntry[]
  codesPresent: string[]
  sort: BreedingSortState
  onSortChange: (next: BreedingSortState) => void
  filter: Set<string>
  taxonMap: Record<string, string>
  taxonOrders: Record<string, number>
  wideMode: boolean
}

const TIER_LABELS: Record<number, string> = {
  4: 'Confirmed',
  3: 'Confirmed (also)',
  2: 'Probable',
  1: 'Possible',
}

export function BreedingCodeTable({ entries, codesPresent, sort, onSortChange, filter, taxonMap, taxonOrders, wideMode }: Props) {
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
      <span style={{ fontSize: 10, color: 'var(--sr-accent)', marginLeft: 2 }}>
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
    fontSize: 11,
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
                onClick={() => handleHeaderClick('name')}
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
                    onClick={() => handleHeaderClick(code)}
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
                  <td style={{
                    padding: '9px 12px',
                    ...(wideMode ? {} : { position: 'sticky', left: 0, zIndex: 1, boxShadow: '1px 0 0 var(--sr-border)' }),
                    background: rowBg,
                    width: 220,
                    minWidth: 220,
                    maxWidth: 220,
                    borderTop: '1px solid var(--sr-border-subtle)',
                    verticalAlign: 'middle',
                  }}>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center' }}>
                        <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--sr-text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {entry.commonName}
                        </span>
                        <SpeciesLinks speciesCode={taxonMap[entry.commonName]} />
                      </div>
                      {entry.scientificName && (
                        <span style={{ fontSize: 11.5, color: 'var(--sr-text-gray)', fontStyle: 'italic' }}>
                          {entry.scientificName}
                        </span>
                      )}
                    </div>
                  </td>
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
                        {count > 0 && (
                          <div style={{
                            width: 28,
                            height: 28,
                            borderRadius: '50%',
                            background: TIER_COLORS[def.tier],
                            color: '#fff',
                            fontSize: 11,
                            fontWeight: 700,
                            letterSpacing: '-0.3px',
                            display: 'inline-flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                          }}>
                            {count}
                          </div>
                        )}
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
            <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>
              {TIER_LABELS[tier]}: {tierGroups.get(tier)!.join(' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
