import { useMemo, useState } from 'react'
import { MessageSquare, Search, ChevronDown, ExternalLink, Camera, Mic, Video } from 'lucide-react'
import type { MLExportRow } from '../lib/parseMLExport'
import { filterAndSortMediaComments, pickComment, hasMediaComment, MEDIA_COMMENT_LABEL } from '../lib/mediaComments'
import { mlAssetUrl } from '../lib/mlCatalog'
import { formatDate } from '../lib/formatDate'
import { BirdName } from './BirdName'

const MEDIA_COMMENTS_PAGE = 10

const TYPE_META: Record<MLExportRow['format'], { icon: typeof Camera; color: string }> = {
  Photo: { icon: Camera, color: 'var(--sr-graph-photo)' },
  Audio: { icon: Mic, color: 'var(--sr-graph-audio)' },
  Video: { icon: Video, color: 'var(--sr-graph-video)' },
}

// A "Media Comments" section for the Multimedia tab: the most recent per-asset
// media comments (Caption / Media notes from the ML export), with keyword filter +
// Newest/Oldest sort + paginated "show all", mirroring the Species Detail comments
// box. The eBird observation comment is excluded — the export duplicates it across
// an observation's media. Returns null when the export carries no media comments.
export function MediaCommentsSection({ rows, backboneNames, taxonMap, onOpenSpecies }: {
  rows: MLExportRow[]
  backboneNames: Set<string>
  taxonMap: Record<string, string>
  onOpenSpecies?: (commonName: string) => void
}) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<'newest' | 'oldest'>('newest')
  const [showAll, setShowAll] = useState(false)

  const hasAny = useMemo(() => rows.some(hasMediaComment), [rows])
  const matches = useMemo(() => filterAndSortMediaComments(rows, filter, sort), [rows, filter, sort])

  if (!hasAny) return null

  const visible = showAll ? matches : matches.slice(0, MEDIA_COMMENTS_PAGE)

  return (
    <div id="media-comments" tabIndex={-1} style={{
      marginTop: 16, scrollMarginTop: 16, outline: 'none', background: 'var(--sr-surface)', border: '1px solid var(--sr-border)',
      borderRadius: 12, overflow: 'hidden', boxShadow: 'var(--sr-card-shadow)',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px 12px', borderBottom: '1px solid var(--sr-border-subtle)' }}>
        <div style={{
          width: 28, height: 28, borderRadius: 7, flexShrink: 0,
          background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>
          <MessageSquare size={14} strokeWidth={2.2} />
        </div>
        <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Media Comments</span>
      </div>

      {/* Controls */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        padding: '12px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
        background: 'var(--sr-surface-faint)',
      }}>
        <div style={{ position: 'relative', flex: 1 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-disabled)', pointerEvents: 'none' }}>
            <Search size={12} strokeWidth={2.5} />
          </span>
          <input
            type="text"
            value={filter}
            onChange={e => { setFilter(e.target.value); setShowAll(false) }}
            placeholder="Filter media comments…"
            aria-label="Filter media comments"
            style={{
              width: '100%', height: 32, padding: '0 10px 0 30px',
              border: '1.5px solid var(--sr-border)', borderRadius: 6,
              fontSize: '0.8125rem', fontFamily: 'inherit', color: 'var(--sr-text)',
              background: 'var(--sr-surface)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--sr-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--sr-border)')}
          />
        </div>

        <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
          {(['newest', 'oldest'] as const).map((dir, i) => (
            <button tabIndex={0}
              key={dir}
              onClick={() => setSort(dir)}
              style={{
                height: 32, padding: '0 12px', border: 'none',
                borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
                background: sort === dir ? 'var(--sr-accent-bg)' : 'transparent',
                color: sort === dir ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
              }}
            >
              {dir === 'newest' ? 'Newest' : 'Oldest'}
            </button>
          ))}
        </div>

        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 500, flexShrink: 0 }}>
          {matches.length} {matches.length === 1 ? 'comment' : 'comments'}
        </span>
      </div>

      {/* Rows */}
      {matches.length === 0 ? (
        <div style={{ padding: '16px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
          No media comments match this filter.
        </div>
      ) : (
        <>
          {visible.map((row, idx, arr) => {
            const picked = pickComment(row, filter)
            const tm = TYPE_META[row.format]
            const TypeIcon = tm.icon
            return (
              <div
                key={`${row.catalogId}-${idx}`}
                style={{ padding: '14px 18px', borderBottom: idx < arr.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6, flexWrap: 'wrap' }}>
                  <BirdName
                    commonName={row.commonName}
                    scientificName={row.scientificName}
                    taxonCode={taxonMap[row.commonName]}
                    hasEntry={backboneNames.has(row.commonName)}
                    onOpenSpecies={onOpenSpecies}
                    size="sm"
                  />
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--sr-text-muted)' }}>
                    <TypeIcon size={12} strokeWidth={2.4} style={{ color: tm.color }} />{row.format}
                  </span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{formatDate(row.date)}</span>
                  {row.location && <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>· {row.location}</span>}
                  <a
                    href={mlAssetUrl(row.catalogId)}
                    target="_blank"
                    rel="noreferrer"
                    title={`View asset ML${row.catalogId} on the Macaulay Library`}
                    style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: '0.6875rem', fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                    onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                  >
                    ML{row.catalogId}<ExternalLink size={10} strokeWidth={2.5} />
                  </a>
                </div>
                {picked && (
                  <div style={{ fontSize: '0.84375rem', color: 'var(--sr-text)', lineHeight: 1.55 }}>
                    <span style={{ fontSize: '0.625rem', fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', marginRight: 6 }}>
                      {MEDIA_COMMENT_LABEL[picked.field]}
                    </span>
                    {picked.text}
                  </div>
                )}
              </div>
            )
          })}

          {/* Stays mounted as a toggle so activation doesn't drop keyboard
              focus to <body> and restart Tab from the page top (F036). */}
          {matches.length > MEDIA_COMMENTS_PAGE && (
            <button tabIndex={0}
              onClick={() => setShowAll(v => !v)}
              aria-expanded={showAll}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                width: '100%', padding: '13px 18px',
                border: 'none', borderTop: '1px solid var(--sr-border-subtle)',
                background: 'var(--sr-surface-faint)',
                fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-accent)',
                fontFamily: 'inherit', cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-accent-bg)')}
              onMouseLeave={e => (e.currentTarget.style.background = 'var(--sr-surface-faint)')}
            >
              <ChevronDown size={13} strokeWidth={2.5} style={{ transform: showAll ? 'rotate(180deg)' : 'none' }} />
              {showAll ? 'Show fewer' : `Show all ${matches.length} comments`}
            </button>
          )}
        </>
      )}
    </div>
  )
}
