import { Camera, Mic, Video, Minus } from 'lucide-react'
import type { LifeListEntry } from '../lib/parseLifeList'
import type { MediaFilterState, SortColumn, SortDir, SortState } from '../types'
import { BirdName } from './BirdName'
import { normalizeSpeciesName } from '../lib/speciesUtils'

interface Props {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
  filter: MediaFilterState
  sort: SortState
  onSortChange: (next: SortState) => void
  userId: string | null
  taxonMap: Record<string, string>
  taxonOrders: Record<string, number>
  wideMode: boolean
  /** Navigate to + select a species on Species Detail (when a backbone entry exists). */
  onOpenSpecies?: (commonName: string) => void
  /** True when the eBird backbone is loaded (so bird entries have a Species Detail entry). */
  hasEbirdBackbone?: boolean
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

// All media for the species (no mediaType filter) — the Total count links here.
// Same shape as mlUrl minus the mediaType parameter.
function mlUrlAll(
  commonName: string,
  userId: string | null,
  taxonCode: string | undefined
): string {
  const base = taxonCode
    ? `https://search.macaulaylibrary.org/catalog?taxonCode=${taxonCode}`
    : `https://search.macaulaylibrary.org/catalog?taxaName=${encodeURIComponent(commonName)}`
  return userId ? `${base}&userId=${userId}` : base
}

const iconCell: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}

export function LifeListTable({ entries, mediaMap, filter, sort, onSortChange, userId, taxonMap, taxonOrders, wideMode, onOpenSpecies, hasEbirdBackbone }: Props) {
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
    return taxonOrders[entry.commonName] ?? taxonOrders[normalizeSpeciesName(entry.commonName)] ?? Infinity
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
      if (sort.nameSortMode === 'taxonomic') {
        // Three-tier priority: birds → non-bird animals → non-animals (no scientific name)
        const tierOf = (e: LifeListEntry) => {
          if (!(e.isNonBird ?? false)) return 0
          return e.scientificName.trim().length > 0 ? 1 : 2
        }
        const ta = tierOf(a), tb = tierOf(b)
        if (ta !== tb) return ta - tb
        // Within tier 2 (non-animals), always sort alphabetically regardless of sort.dir
        if (ta === 2) return a.commonName.localeCompare(b.commonName)
      }
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

  // Make the sortable column headers keyboard-operable (Enter / Space).
  function handleHeaderKey(e: React.KeyboardEvent, column: SortColumn) {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      handleHeaderClick(column)
    }
  }

  function sortIndicator(column: SortColumn) {
    if (sort.column !== column) return null
    return (
      <span style={{ fontSize: '0.625rem', color: 'var(--sr-accent)', marginLeft: 2 }}>
        {sort.dir === 'asc' ? '↑' : '↓'}
      </span>
    )
  }

  const thBase: React.CSSProperties = {
    fontSize: '0.6875rem',
    fontWeight: 600,
    letterSpacing: '0.06em',
    textTransform: 'uppercase',
    cursor: 'pointer',
    userSelect: 'none',
  }

  const countLinkStyle: React.CSSProperties = {
    fontSize: '0.8125rem',
    fontWeight: 600,
    color: 'var(--sr-accent)',
    textDecoration: 'none',
  }

  return (
    <div style={{
      border: '1px solid var(--sr-border)',
      borderRadius: 10,
      background: 'var(--sr-surface)',
      ...(wideMode ? { width: 'max-content' } : { overflowX: 'auto' }),
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
              scope="col"
              tabIndex={0}
              onClick={() => handleHeaderClick('name')}
              onKeyDown={e => handleHeaderKey(e, 'name')}
              aria-sort={sort.column === 'name' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
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
                scope="col"
                tabIndex={0}
                onClick={() => handleHeaderClick(col)}
                onKeyDown={e => handleHeaderKey(e, col)}
                aria-sort={sort.column === col ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
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
              scope="col"
              tabIndex={0}
              onClick={() => handleHeaderClick('total')}
              onKeyDown={e => handleHeaderKey(e, 'total')}
              aria-sort={sort.column === 'total' ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'}
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
                  <BirdName
                    commonName={entry.commonName}
                    scientificName={entry.scientificName}
                    taxonCode={taxonMap[entry.commonName]}
                    hasEntry={!!onOpenSpecies && !!hasEbirdBackbone && !(entry.isNonBird ?? false)}
                    onOpenSpecies={onOpenSpecies}
                    showSci
                  />
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
                    {totalCount > 0
                      ? <a
                          href={mlUrlAll(entry.commonName, userId, taxonCode)}
                          target="_blank"
                          rel="noreferrer"
                          title="All media on Macaulay Library"
                          style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-accent)', fontVariantNumeric: 'tabular-nums', textDecoration: 'none' }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >{totalCount}</a>
                      : <Minus size={16} strokeWidth={2.5} style={{ color: 'var(--sr-gray-300)' }} />}
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
