import { useState } from 'react'
import { BREEDING_CODE_MAP, TIER_COLORS } from '../lib/breedingCodes'
import type { BreedingEntry } from '../lib/parseBreedingCodes'
import type { BreedingSortState, SortDir } from '../types'

interface Props {
  entries: BreedingEntry[]
  codesPresent: string[]
  sort: BreedingSortState
  onSortChange: (next: BreedingSortState) => void
  filter: string
  expanded: boolean
}

const TIER_LABELS: Record<number, string> = {
  4: 'Confirmed',
  3: 'Confirmed (also)',
  2: 'Probable',
  1: 'Possible',
}

export function BreedingCodeTable({ entries, codesPresent, sort, onSortChange, filter, expanded }: Props) {
  const [hoveredRow, setHoveredRow] = useState<string | null>(null)

  const filtered = filter === 'all'
    ? entries
    : entries.filter(e => (e.codes[filter] ?? 0) > 0)

  const sorted = [...filtered].sort((a, b) => {
    if (sort.column === 'name') {
      const cmp = a.commonName.localeCompare(b.commonName)
      return sort.dir === 'asc' ? cmp : -cmp
    }
    const aCount = a.codes[sort.column] ?? 0
    const bCount = b.codes[sort.column] ?? 0
    if (aCount !== bCount) return sort.dir === 'desc' ? bCount - aCount : aCount - bCount
    return a.commonName.localeCompare(b.commonName)
  })

  function handleHeaderClick(col: string) {
    if (sort.column === col) {
      onSortChange({ column: col, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      const defaultDir: SortDir = col === 'name' ? 'asc' : 'desc'
      onSortChange({ column: col, dir: defaultDir })
    }
  }

  function sortIndicator(col: string) {
    if (sort.column !== col) return null
    return (
      <span style={{ fontSize: 10, color: '#2D8653', marginLeft: 2 }}>
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
    background: '#F9FAFB',
    boxShadow: 'inset 0 -1px 0 #E4E4E7',
    zIndex: 2,
  }

  return (
    <div style={{
      border: '1px solid #E4E4E7',
      borderRadius: 10,
      background: '#fff',
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
      display: 'flex',
      flexDirection: 'column',
      overflow: 'hidden',
    }}>
      <div style={{
        flex: expanded ? 'none' : 1,
        minHeight: 0,
        overflowX: 'auto',
        overflowY: expanded ? 'visible' : 'auto',
      }}>
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
                  left: 0,
                  zIndex: 3,
                  textAlign: 'left',
                  padding: '10px 12px',
                  width: 190,
                  minWidth: 190,
                  color: sort.column === 'name' ? '#0F1117' : '#71717A',
                  boxShadow: 'inset 0 -1px 0 #E4E4E7, 1px 0 0 #E4E4E7',
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
                      color: sort.column === code ? '#0F1117' : '#71717A',
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
              const rowBg = isHovered ? '#FAFAFA' : '#fff'
              return (
                <tr
                  key={entry.commonName}
                  onMouseEnter={() => setHoveredRow(entry.commonName)}
                  onMouseLeave={() => setHoveredRow(null)}
                >
                  <td style={{
                    padding: '9px 12px',
                    fontSize: 13.5,
                    fontWeight: 500,
                    color: '#0F1117',
                    position: 'sticky',
                    left: 0,
                    background: rowBg,
                    zIndex: 1,
                    boxShadow: '1px 0 0 #E4E4E7',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    maxWidth: 190,
                    borderTop: '1px solid #F4F4F5',
                  }}>
                    {entry.commonName}
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
                          borderTop: '1px solid #F4F4F5',
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
        background: '#FAFAFA',
        borderTop: '1px solid #F4F4F5',
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
            <span style={{ fontSize: 11, color: '#71717A' }}>
              {TIER_LABELS[tier]}: {tierGroups.get(tier)!.join(' ')}
            </span>
          </div>
        ))}
      </div>
    </div>
  )
}
