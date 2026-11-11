// The life list at the location (FR-33 to FR-38; design-spec "Life list").
//
// The Life Lists ledger row with one deliberate deviation (decisions.md D-01): a
// visual column header row at wide widths, `aria-hidden`, because each row
// carries two figures. Every cell carries its own words for assistive
// technology ("First recorded here", "On N of M checklists here"), and the
// stacked form (the list's own container query) spells them out on screen.
// The list is list markup, never a table. Paging is the Life Lists pager,
// unchanged: 100 rows, then "Show next 100" and "Show all", with focus moved to
// the count sentence when the last rows appear, never left on <body>.
//
// No DOM id or IDREF is minted here. The React key is the species name, never
// rendered into the DOM and unique because it is the facts' own grouping key.

import { useEffect, useRef, useState } from 'react'
import { BirdName } from '../BirdName'
import { Button } from '../ui/Button'
import { ChecklistLink } from '../ChecklistLink'
import { formatDate } from '../../lib/formatDate'
import { isValidChecklistId } from '../../lib/checklistId'
import { dayToIso } from '../../lib/lifeLists'
import { pageList, PAGE_SIZE } from '../../lib/pageList'
import type { LocationSpecies } from '../../lib/hotspotReportsLocation'
import {
  COLUMN_HEADERS, EMPTY_LIST, FIRST_RECORDED_SR, NO_CHECKLIST_LABEL, ON_WORD, SHOW_NEXT_LABEL,
  formatCount, lifeListCaption, ofChecklistsTail, onChecklistsSr, positionPrefix, showAllLabel, showingLabel,
} from '../../lib/hotspotReportsCopy'

export function HotspotReportLifeList({ species, checklists, codeFor, onOpenSpecies }: {
  species: LocationSpecies
  /** The location's checklist total (FR-37's M). */
  checklists: number
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}) {
  const [shown, setShown] = useState(PAGE_SIZE)
  const [focusSeq, setFocusSeq] = useState(0)
  const countRef = useRef<HTMLParagraphElement>(null)
  useEffect(() => {
    if (focusSeq > 0) countRef.current?.focus()
  }, [focusSeq])

  const total = species.total
  if (total === 0) return <p className="sr-hsr-empty">{EMPTY_LIST}</p>

  const paged = pageList(species.rows, shown)
  return (
    <>
      <div className="sr-hsr-lead">
        <p className="sr-hsr-count" tabIndex={-1} ref={countRef}>
          <b>{formatCount(total)}</b>{lifeListCaption(total, checklists)}
        </p>
      </div>
      <div className="sr-hsr-ll">
        <div className="sr-hsr-ll-cols" aria-hidden="true">
          <span className="c-name">{COLUMN_HEADERS.species}</span>
          <span className="c-date">{COLUMN_HEADERS.first}</span>
          <span className="c-on">{COLUMN_HEADERS.of(checklists)}</span>
        </div>
        <ol className="sr-hsr-ll-list">
          {paged.visible.map(row => {
            const share = checklists > 0 ? (row.checklists / checklists) * 100 : 0
            return (
              <li key={row.name} className="sr-hsr-ll-row">
                <span className="sr-hsr-ll-num" aria-hidden="true">{row.position}</span>
                <div className="sr-hsr-ll-name">
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
                <div className="sr-hsr-ll-meta">
                  <span className="sr-hsr-ll-date">
                    <span className="sr-only">{FIRST_RECORDED_SR} </span>
                    {formatDate(dayToIso(row.day))}
                  </span>
                  {' '}
                  <span className="sr-hsr-ll-on">
                    <span className="sr-hsr-ll-on-fig">
                      <span className="sr-only">{onChecklistsSr(row.checklists, checklists)}</span>
                      <span aria-hidden="true">
                        <span className="sr-hsr-ll-words">{'\u00b7 '}{ON_WORD}</span>
                        <b>{formatCount(row.checklists)}</b>
                        <span className="sr-hsr-ll-words">{ofChecklistsTail(checklists)}</span>
                      </span>
                    </span>
                    <span className="sr-hsr-ll-bar" aria-hidden="true">
                      <i style={{ width: `${share}%` }} />
                    </span>
                  </span>
                </div>
                <div className="sr-hsr-ll-link">
                  {isValidChecklistId(row.checklistId) ? (
                    <span className="sr-hsr-ll-cl"><ChecklistLink submissionId={row.checklistId} compact /></span>
                  ) : (
                    <>
                      <span className="sr-hsr-ll-dash" aria-hidden="true">-</span>
                      <span className="sr-only">{NO_CHECKLIST_LABEL}</span>
                    </>
                  )}
                </div>
              </li>
            )
          })}
        </ol>
      </div>
      {paged.hasMore && (
        <div className="sr-lfl-paging">
          <Button
            type="button"
            className="sr-lfl-next sr-touch-target"
            onClick={() => {
              setShown(paged.nextCount)
              if (paged.nextCount >= total) setFocusSeq(s => s + 1)
            }}
          >
            {SHOW_NEXT_LABEL}
          </Button>
          <Button
            type="button"
            className="sr-lfl-all sr-touch-target"
            onClick={() => { setShown(total); setFocusSeq(s => s + 1) }}
          >
            {showAllLabel(total)}
          </Button>
          <span className="sr-lfl-showing">{showingLabel(paged.visible.length)}</span>
        </div>
      )}
    </>
  )
}
