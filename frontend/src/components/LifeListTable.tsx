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

export function LifeListTable({ entries, mediaMap, filter, sort, onSortChange, userId, taxonMap, expanded }: Props) {
  const filtered = entries.filter(entry => {
    if (filter.photo === 'has' && !hasMedia(entry, mediaMap, 'Photo')) return false
    if (filter.photo === 'no' && hasMedia(entry, mediaMap, 'Photo')) return false
    if (filter.audio === 'has' && !hasMedia(entry, mediaMap, 'Audio')) return false
    if (filter.audio === 'no' && hasMedia(entry, mediaMap, 'Audio')) return false
    if (filter.video === 'has' && !hasMedia(entry, mediaMap, 'Video')) return false
    if (filter.video === 'no' && hasMedia(entry, mediaMap, 'Video')) return false
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    const dirMult = sort.dir === 'asc' ? 1 : -1
    if (sort.column === 'name') {
      return dirMult * a.commonName.localeCompare(b.commonName)
    }
    const type = sort.column === 'photo' ? 'Photo' : sort.column === 'audio' ? 'Audio' : 'Video'
    const diff = dirMult * (countMedia(a, mediaMap, type) - countMedia(b, mediaMap, type))
    if (diff !== 0) return diff
    return a.commonName.localeCompare(b.commonName)
  })

  function handleHeaderClick(column: SortColumn) {
    if (sort.column === column) {
      onSortChange({ column, dir: sort.dir === 'asc' ? 'desc' : 'asc' })
    } else {
      const defaultDir: SortDir = column === 'name' ? 'asc' : 'desc'
      onSortChange({ column, dir: defaultDir })
    }
  }

  function sortIndicator(column: SortColumn) {
    if (sort.column !== column) return null
    return (
      <span style={{ fontSize: 10, color: '#2D8653', marginLeft: 2 }}>
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
    color: '#2D8653',
    textDecoration: 'none',
  }

  return (
    <div style={{
      border: '1px solid #E4E4E7',
      borderRadius: 10,
      background: '#fff',
      flex: expanded ? 'none' : 1,
      minHeight: expanded ? 'auto' : 0,
      overflowY: expanded ? 'visible' : 'auto',
    }}>
      <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0 }}>
        <thead>
          <tr style={{
            position: 'sticky',
            top: 0,
            background: '#F9FAFB',
            boxShadow: 'inset 0 -1px 0 #E4E4E7',
          }}>
            <th
              onClick={() => handleHeaderClick('name')}
              style={{
                ...thBase,
                padding: '10px 14px',
                textAlign: 'left',
                minWidth: 200,
                color: sort.column === 'name' ? '#0F1117' : '#71717A',
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
                  color: sort.column === col ? '#0F1117' : '#71717A',
                }}
              >
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {icon}
                  {label}
                  {sortIndicator(col)}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => {
            const photoCount = countMedia(entry, mediaMap, 'Photo')
            const audioCount = countMedia(entry, mediaMap, 'Audio')
            const videoCount = countMedia(entry, mediaMap, 'Video')
            const taxonCode = taxonMap[entry.commonName]
            return (
              <tr
                key={entry.commonName}
                style={{ borderBottom: idx < sorted.length - 1 ? '1px solid #F4F4F5' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <div style={{ display: 'flex', alignItems: 'center' }}>
                      <span style={{ fontSize: 13.5, fontWeight: 500, color: '#0F1117' }}>
                        {entry.commonName}
                      </span>
                      <SpeciesLinks speciesCode={taxonMap[entry.commonName]} />
                    </div>
                    <span style={{ fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic' }}>
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
                      : <Minus size={16} strokeWidth={2.5} style={{ color: '#D1D5DB' }} />}
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
                      : <Minus size={16} strokeWidth={2.5} style={{ color: '#D1D5DB' }} />}
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
                      : <Minus size={16} strokeWidth={2.5} style={{ color: '#D1D5DB' }} />}
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
