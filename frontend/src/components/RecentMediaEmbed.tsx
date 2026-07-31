// Species Detail "Recent Media": the most-recent Photo/Audio/Video embed for a
// species, on the shared resilient frame (a loading shimmer, a non-destructive
// give-up/failed overlay with a link-out, and an offline placeholder that recovers
// on reconnect). All three formats share one uniform full height so the row reads as
// matching tiles, and the Macaulay audio player's controls fit. Beneath each player
// is an info + attribution row — the capture date, a link to that asset on the
// Macaulay Library (credit + open), and its eBird checklist — from the user's own ML
// export, so it shows even offline (where those links are how you reach the media).
import { useOnline } from '../lib/useOnline'
import { formatDate } from '../lib/formatDate'
import { mlAssetUrl } from '../lib/mlCatalog'
import { EmbeddedMediaDisabled, MediaFrame, MediaFallback } from './MediaEmbed'
import { MEDIA_FORMAT_META, MEDIA_CATALOG_ID_RE } from '../lib/mediaEmbed'
import { OutboundLink } from './OutboundLink'
import { ChecklistLink } from './ChecklistLink'
import type { MediaType } from '../types'

export function RecentMediaEmbed({ id, type, species, date, checklistId, embedAllowed }: {
  id: string
  type: MediaType
  species: string
  date?: string
  checklistId?: string
  embedAllowed: boolean
}) {
  const online = useOnline()
  const { icon: Icon } = MEDIA_FORMAT_META[type]
  // One uniform, full-height player for all three formats, so the most-recent
  // photo/audio/video read as a matching row (and the audio player's controls fit).
  const heightClass = 'sr-media-iframe--recent'
  const validId = MEDIA_CATALOG_ID_RE.test(id)
  const title = `Most recent ${type} of ${species}`
  const dateLabel = date ? formatDate(date) : ''
  return (
    <div className="sr-media-item">
      <div style={{
        fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
        letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginBottom: 8,
      }}>
        {type}
      </div>
      <div className={`sr-media-frame ${heightClass}`}>
        {!embedAllowed && validId ? (
          <EmbeddedMediaDisabled />
        ) : !validId || !online ? (
          <MediaFallback catalogId={id} format={type} compact={false} />
        ) : (
          <MediaFrame key={online ? 'online' : 'offline'} catalogId={id} format={type} title={title} Icon={Icon} heightClass={heightClass} embedAllowed compact={false} />
        )}
      </div>

      {/* Info + attribution row (always shown; local data): capture date, a link to
          this asset on the Macaulay Library (credit + open), and its eBird checklist. */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap',
        marginTop: 8, minWidth: 0, fontSize: '0.75rem',
      }}>
        {dateLabel && (
          <span style={{ fontWeight: 600, color: 'var(--sr-text)', whiteSpace: 'nowrap' }}>{dateLabel}</span>
        )}
        {dateLabel && validId && <span style={{ color: 'var(--sr-text-disabled)' }} aria-hidden>·</span>}
        {validId && (
          <OutboundLink
            href={mlAssetUrl(id)}
            aria-label={`View this ${type.toLowerCase()} on the Macaulay Library (ML${id})`}
            style={{ fontWeight: 600, color: 'var(--sr-accent)', whiteSpace: 'nowrap' }}
          >
            Macaulay Library
          </OutboundLink>
        )}
        {checklistId && (
          <>
            <span style={{ color: 'var(--sr-text-disabled)' }} aria-hidden>·</span>
            <ChecklistLink submissionId={checklistId} style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 600 }} />
          </>
        )}
      </div>
    </div>
  )
}
