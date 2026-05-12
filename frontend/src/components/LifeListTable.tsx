import { Eye, Camera, Mic, Video, Check, Minus } from 'lucide-react'
import type { LifeListEntry } from '../lib/parseLifeList'
import type { MediaFilter, SortOrder } from '../types'

interface Props {
  entries: LifeListEntry[]
  mediaMap: Record<string, string>
  filter: MediaFilter
  sort: SortOrder
  expanded: boolean
}

function hasMedia(
  entry: LifeListEntry,
  mediaMap: Record<string, string>,
  type: 'Photo' | 'Audio' | 'Video'
): boolean {
  return entry.catalogIds.some(id => mediaMap[id] === type)
}

const iconCell: React.CSSProperties = {
  display: 'flex',
  justifyContent: 'center',
  alignItems: 'center',
}

export function LifeListTable({ entries, mediaMap, filter, sort, expanded }: Props) {
  const filtered = entries.filter(entry => {
    if (filter === 'no-photo') return !hasMedia(entry, mediaMap, 'Photo')
    if (filter === 'no-audio') return !hasMedia(entry, mediaMap, 'Audio')
    if (filter === 'no-video') return !hasMedia(entry, mediaMap, 'Video')
    return true
  })

  const sorted = [...filtered].sort((a, b) => {
    if (sort === 'alpha') return a.commonName.localeCompare(b.commonName)
    const aFin = isFinite(a.taxonomicOrder)
    const bFin = isFinite(b.taxonomicOrder)
    if (aFin && bFin) return a.taxonomicOrder - b.taxonomicOrder
    if (aFin) return -1
    if (bFin) return 1
    return a.commonName.localeCompare(b.commonName)
  })

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
            <th style={{
              padding: '10px 14px',
              textAlign: 'left',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: '0.06em',
              textTransform: 'uppercase',
              color: '#71717A',
              minWidth: 200,
            }}>
              Species
            </th>
            {([
              ['Seen', <Eye size={11} strokeWidth={2.5} />],
              ['Photo', <Camera size={11} strokeWidth={2.5} />],
              ['Audio', <Mic size={11} strokeWidth={2.5} />],
              ['Video', <Video size={11} strokeWidth={2.5} />],
            ] as [string, React.ReactNode][]).map(([label, icon]) => (
              <th key={label} style={{
                padding: '10px 14px',
                width: 72,
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: '#71717A',
                textAlign: 'center',
              }}>
                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                  {icon}
                  {label}
                </div>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((entry, idx) => {
            const photo = hasMedia(entry, mediaMap, 'Photo')
            const audio = hasMedia(entry, mediaMap, 'Audio')
            const video = hasMedia(entry, mediaMap, 'Video')
            return (
              <tr
                key={entry.commonName}
                style={{ borderBottom: idx < sorted.length - 1 ? '1px solid #F4F4F5' : 'none' }}
                onMouseEnter={e => (e.currentTarget.style.background = '#FAFAFA')}
                onMouseLeave={e => (e.currentTarget.style.background = '')}
              >
                <td style={{ padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
                    <span style={{ fontSize: 13.5, fontWeight: 500, color: '#0F1117' }}>
                      {entry.commonName}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#9CA3AF', fontStyle: 'italic' }}>
                      {entry.scientificName}
                    </span>
                  </div>
                </td>
                <td style={{ width: 72, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    <Check size={16} strokeWidth={2.5} style={{ color: '#2D8653' }} />
                  </div>
                </td>
                <td style={{ width: 72, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    {photo
                      ? <Check size={16} strokeWidth={2.5} style={{ color: '#2D8653' }} />
                      : <Minus size={16} strokeWidth={2.5} style={{ color: '#D1D5DB' }} />}
                  </div>
                </td>
                <td style={{ width: 72, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    {audio
                      ? <Check size={16} strokeWidth={2.5} style={{ color: '#2D8653' }} />
                      : <Minus size={16} strokeWidth={2.5} style={{ color: '#D1D5DB' }} />}
                  </div>
                </td>
                <td style={{ width: 72, padding: '9px 14px', verticalAlign: 'middle' }}>
                  <div style={iconCell}>
                    {video
                      ? <Check size={16} strokeWidth={2.5} style={{ color: '#2D8653' }} />
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
