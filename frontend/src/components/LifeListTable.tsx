import { Camera, Mic, Video, Minus } from 'lucide-react'
import type { LifeListEntry } from '../lib/parseLifeList'
import type { MediaFilterState, SortColumn, SortDir, SortState } from '../types'
import { SpeciesLinks } from './SpeciesLinks'

interface Props {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
  filter: MediaFilterState
  sort: SortState
  onSortChange: (next: SortState) => void
  userId: string | null
  taxonMap: Record<string, string>
  taxonOrders: Record<string, number>
  expanded: boolean
}

function hasMedia(
  entry: LifeListEntry,
  mediaMap: Record<string, string>,
  type: 'Photo' | 'Audio' | 'Video'
): boolean {
  return entry.catalogIds.some(id => mediaMap[id] === type)
}

function countMedia(
  entry: LifeListEntry,
  mediaMap: Record<string, string>,
  type: 'Photo' | 'Audio' | 'Video'
): number {
  return entry.catalogIds.filter(id => mediaMap[id] === type).length
}

function mlUrl(
  commonName: string,
  type: 'Photo' | 'Audio' | 'Video',
  userId: string | null,
  taxonCode: string | undefined
): string {
  const mediaType = type.toLowerCase()
  if (taxonCode) {
    const base = `https://search.macaulaylibrary.org/catalog?mediaType=${mediaType}&taxonCode=${taxonCode}`
    return userId ? `${base}&userId=${userId}` : base
  }
  const base = `https://search.macaulaylibrary.org/catalog?taxaName=${encodeURIComponent(commonName)}&mediaType=${mediaType}`
  return userId ? `${base}&userId=${userId}` : base
}

const iconCell: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}

export function LifeListTable({ entries, mediaMap, filter, sort, onSortChange, userId, taxonMap, taxonOrders, expanded }: Props) {
  const filtered = entries.filter(entry => {
    if (filter.photo === 'has' && !hasMedia(entry, mediaMap, 'Photo')) return false
    if (filter.photo === 'no' && hasMedia(entry, mediaMap, 'Photo')) return false
    if (filter.audio === 'has' && !hasMedia(entry, mediaMap, 'Audio')) return false
    if (filter.audio === 'no' && hasMedia(entry, mediaMap, 'Audio')) return false
    if (filter.video === 'has' && !hasMedia(entry, mediaMap, 'Video')) return false
    if (filter.video === 'no' && hasMedia(entry, mediaMap, 'Video')) return false
    return true
  })

  // Returns the taxon order for an entry. For eBird CSV the parsed taxonomicOrder
  // is finite and used directly; for ML export (Infinity) and any gaps, falls back
  // to the fetch result. Species not found in either sort last (Infinity).
  function getOrder(entry: LifeListEntry): number {
    if (entry.taxonomicOrder !== Infinity) return entry.taxonomicOrder
    return taxonOrders[entry.commonName] ?? Infinity
  }

  function nameCompare(a: LifeListEntry, b: LifeListEntry): number {
    if (sort.nameSortMode === 'taxonomic') {
      const diff = getOrder(a) - getOrder(b)
      if (diff !== 0) return diff
    }
    return a.commonName.localeCompare(b.commonName)
  }

  const sorted = [...filtered].sort((a, b) => {
    if (sort.column === 'name') {
      const cmp = nameCompare(a, b)
      return sort.dir === 'asc' ? cmp : -cmp
    }
    const dirMult = sort.dir === 'asc' ? 1 : -1
    if (sort.column === 'total') {
      const totalA = countMedia(a, mediaMap, 'Photo') + countMedia(a, mediaMap, 'Audio') + countMedia(a, mediaMap, 'Video')
      const totalB = countMedia(b, mediaMap, 'Photo') + countMedia(b, mediaMap, 'Audio') + countMedia(b, mediaMap, 'Video')
      if (totalA !== totalB) return dirMult * (totalA - totalB)
      return nameCompare(a, b)
    }
    const type = sort.column === 'photo' ? 'Photo' : sort.column === 'audio' ? 'Audio' : 'Video'
    const diff = countMedia(a, mediaMap, type) - countMedia(b, mediaMap, type)
    if (diff !== 0) return dirMult * diff
    return nameCompare(a, b)
  })

  function handleHeaderClick(column: SortColumn) {
    if (sort.column === column) {
      onSortChange({ ...sort, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      const defaultDir: SortDir = column === 'name' ? 'asc' : 'desc'
      onSortChange({ ...sort, column, dir: defaultDir })
    }
  }

  function sortIndicator(column: SortColumn) {
    if (sort.column !== column) return null
    return (
      <span style={{ fontSize: 10, color: 'var(--sr-accent)', marginLeft: 2 }}>
        {sort.dir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const thBase: React.CSSProperties = {
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    userSelect: 'none',
  }

  const countLinkStyle: React.CSSProperties = {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--sr-accent)',
    textDecoration: 'none',
  }

  return (
    <div style={{
      border: '1px solid var(--sr-border)',
      borderRadius: 10,
      background: 'var(--sr-surface)',
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
      overflowY: expanded ? 'visible' : 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{
            position: 'sticky',
            top: 0,
            background: 'var(--sr-bg)',
            boxShadow: 'inset 0 -1px 0 var(--sr-border)',
          }}>
            <th
              onClick={() => handleHeaderClick('name')}
              style={{
                ...thBase,
                padding: '10px 14px',
                textAlign: 'left',
                minWidth: 200,
                color: sort.column === 'name' ? 'var(--sr-text)' : 'var(--sr-text-muted)',
              }}
            >
              Entries{sortIndicator('name')}
            </th>
            {([
              ['Photo', 'photo', <Camera size={11} strokeWidth={2.5} />],
              ['Audio', 'audio', <Mic size={11} strokeWidth={2.5} />],
              ['Video', 'video', <Video size={11} strokeWidth={2.5} />],
            ] as [string, SortColumn, React.ReactNode][]).map(([label, col, icon]) => (
              <th
                key={label}
                onClick={() => handleHeaderClick(col)}
                style={{
                  ...thBase,
                  padding: '10px 14px',
                  width: 80,
                  textAlign: 'center',
                  color: sort.column === col ? 'var(--sr-text)' : 'var(--sr-text-muted)',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {icon}
                  {label}
                  {sortIndicator(col)}
                </div>
              </th>
            ))}
            <th
              onClick={() => handleHeaderClick('total')}
              style={{
                ...thBase,
                padding: '10px 14px',
                width: 70,
                textAlign: 'center',
                color: 'var(--sr-accent)',
                borderLeft: '1px solid var(--sr-border)',
              }}
            >
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                Total
                {sortIndicator('total')}
              </div>
            </th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => {
            const photoCount = countMedia(entry, mediaMap, 'Photo')
            const audioCount = countMedia(entry, mediaMap, 'Audio')
            const videoCount = countMedia(entry, mediaMap, 'Video')
            const totalCount = photoCount + audioCount + videoCount
            const taxonCode = taxonMap[entry.commonName]
            return (
              <tr
                key={entry.commonName}
                style={{ borderBottom: idx < sorted.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-surface-faint)')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: 'var(--sr-text)' }}>
                        {entry.commonName}
                      </span>
                      <SpeciesLinks speciesCode={taxonMap[entry.commonName]} />
                    </div>
                    <span style={{ fontSize: 11.5, color: 'var(--sr-text-gray)', fontStyle: 'italic' }}>
                      {entry.scientificName}
                    </span>
                  </div>
                </td>
                <td style={{ width: 80, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    {photoCount > 0
                      ? <a
                          href={mlUrl(entry.commonName, 'Photo', userId, taxonCode)}
                          target="_blank"
                          rel="noreferrer"
                          style={countLinkStyle}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >{photoCount}</a>
                      : <Minus size={16} strokeWidth={2.5} style={{ color: 'var(--sr-gray-300)' }} />}
                  </div>
                </td>
                <td style={{ width: 80, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    {audioCount > 0
                      ? <a
                          href={mlUrl(entry.commonName, 'Audio', userId, taxonCode)}
                          target="_blank"
                          rel="noreferrer"
                          style={countLinkStyle}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >{audioCount}</a>
                      : <Minus size={16} strokeWidth={2.5} style={{ color: 'var(--sr-gray-300)' }} />}
                  </div>
                </td>
                <td style={{ width: 80, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    {videoCount > 0
                      ? <a
                          href={mlUrl(entry.commonName, 'Video', userId, taxonCode)}
                          target="_blank"
                          rel="noreferrer"
                          style={countLinkStyle}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >{videoCount}</a>
                      : <Minus size={16} strokeWidth={2.5} style={{ color: 'var(--sr-gray-300)' }} />}
                  </div>
                </td>
                <td style={{ width: 70, padding: '9px 14px', verticalAlign: 'middle', borderLeft: '1px solid var(--sr-border)' }}>
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sr-accent)', fontVariantNumeric: 'tabular-nums' }}>
                      {totalCount}
                    </span>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
