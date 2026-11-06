// The Life Lists rows (life-lists-tab FR-29 to FR-32, FR-42 to FR-44; design-spec 5).
//
// One `li.sr-lfl-row` per species on the seven-track grid. No `React.memo` on a
// row: `formatDate` reads the module-level date preference, and App's re-render
// is what carries a preference change here. The React `key` is the species name
// (never rendered into the DOM, and unique because it is the derivation's Map
// key) so a re-sort keeps each row's element and only a row a control ADDED
// mounts fresh with the entrance class. No DOM id or IDREF is minted here.

import { Camera, Mic, Video } from 'lucide-react'
import { BirdName } from '../BirdName'
import { ChecklistLink } from '../ChecklistLink'
import { formatDate } from '../../lib/formatDate'
import { isValidChecklistId } from '../../lib/checklistId'
import { dayToIso, type LifeListRow, type MediaPresence } from '../../lib/lifeLists'
import { NO_CHECKLIST_LABEL, mediaLabel, positionPrefix } from '../../lib/lifeListsCopy'

export interface LifeListsRowsProps {
  rows: readonly LifeListRow[]
  /** The full count (FR-42's M), never the visible count. */
  total: number
  /** Draw the media presence cell (a readable ML export is loaded). */
  showMedia: boolean
  /** Rows a switch or media press just added, or null when nothing animates. */
  addedFrom: ReadonlySet<string> | null
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

function MediaCell({ media }: { media: MediaPresence }) {
  const slot = (has: boolean) => `sr-lfl-media-glyph ${has ? 'is-has' : 'is-lacks'}`
  return (
    <span className="sr-lfl-media" role="img" aria-label={mediaLabel(media)}>
      <Camera size={12} strokeWidth={2.2} className={slot(media.photo)} aria-hidden="true" />
      <Mic size={12} strokeWidth={2.2} className={slot(media.audio)} aria-hidden="true" />
      <Video size={12} strokeWidth={2.2} className={slot(media.video)} aria-hidden="true" />
    </span>
  )
}

export function LifeListsRows({ rows, total, showMedia, addedFrom, codeFor, onOpenSpecies }: LifeListsRowsProps) {
  return (
    <ol className="sr-lfl-list">
      {rows.map(row => (
        <li
          key={row.name}
          className={addedFrom !== null && !addedFrom.has(row.name) ? 'sr-lfl-row is-new' : 'sr-lfl-row'}
        >
          <span className="sr-lfl-num" aria-hidden="true">{row.position}</span>
          <div className="sr-lfl-name">
            <span className="sr-only">{positionPrefix(row.position, total)} </span>
            <BirdName
              commonName={row.name}
              scientificName={row.scientificName}
              taxonCode={codeFor(row.name)}
              hasEntry
              onOpenSpecies={onOpenSpecies}
              showSci
              size="md"
            />
          </div>
          <div className="sr-lfl-meta">
            <span className="sr-lfl-date">{formatDate(dayToIso(row.day))}</span>
            <span className="sr-lfl-time">{row.time ?? <span className="sr-lfl-dash">-</span>}</span>
          </div>
          <div className="sr-lfl-link">
            {isValidChecklistId(row.checklistId) ? (
              <span className="sr-lfl-cl"><ChecklistLink submissionId={row.checklistId} compact /></span>
            ) : (
              <>
                <span className="sr-lfl-dash" aria-hidden="true">-</span>
                <span className="sr-only">{NO_CHECKLIST_LABEL}</span>
              </>
            )}
          </div>
          <div className="sr-lfl-place">
            {row.location && <span className="sr-lfl-locname">{row.location}</span>}
            {row.place && <span className="sr-lfl-county">{row.place}</span>}
          </div>
          {showMedia && <MediaCell media={row.media} />}
        </li>
      ))}
    </ol>
  )
}
