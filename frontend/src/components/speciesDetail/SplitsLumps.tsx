// Splits and lumps UI (taxonomic-splits-lumps): the "Splits and lumps" control
// beside "Subspecies and forms" with its full-backup list panel, and the
// per-species "Splits and Lumps" lineage section. Both render only in merged mode,
// in the ready state, with the history asset loaded; the parent gates all three
// (FR-10, FR-24, FR-28).
//
// Every value derives in lib/taxonomyHistory.ts and every string that carries a
// count, a year or a date comes from lib/taxonomyHistoryCopy.ts; these components
// only place them. Colors are --sr-* tokens only; layout, hover, open states and
// motion live in globals.css (.sr-sl-*, .sr-lin-*), where the global
// prefers-reduced-motion block collapses every animation.
//
// ACCESSIBILITY SHAPE OF THE CHART. The lineage chart repeats, graphically, what
// the visually hidden text equivalent after it states in reading order (FR-22).
// Every non-interactive piece of the chart is therefore `aria-hidden`, so a
// screen reader hears each fact once. The chart is NOT hidden as a whole,
// because a recorded, non-selected entry's name is a real button (it selects
// that species, FR-23), and a focusable control inside an `aria-hidden` subtree
// is reachable by Tab yet absent from the accessibility tree. So the names that
// act stay exposed, and everything that only repeats the text equivalent does
// not.

import { Button } from '../ui/Button'
import { forwardRef, useId, useRef, useState } from 'react'
import { Check, ChevronDown, Info, Split } from 'lucide-react'
import { BirdName } from '../BirdName'
import { PanelSlot, SectionCard, SectionHead } from './ui'
import type { AffectedSpecies, EntryView, EventView, HistoryListEntry, TaxonomyHistory } from '../../lib/taxonomyHistory'
import {
  CONTROL_LABEL, SECTION_TITLE, KIND_WORD, MARK_YOUR_SPECIES, MARK_NO_REPORTS, MARK_SLASH,
  PART_REASSIGNED, PART_RECORDED_SINCE, PART_PREDATES, NOT_AFFECTED, FILTER_LINE,
  altEntryTail, altKindLine, coverageLine, eventSentence, eventSentenceText, nameSeparator,
  panelHead, predatesNote, reportCountLabel, speciesCountLabel, updateLabel, zeroAffected,
} from '../../lib/taxonomyHistoryCopy'

type Coverage = TaxonomyHistory['coverage']

// ── The direction glyph ─────────────────────────────────────────────────────
// Hand-drawn on the lucide grid (decisions.md 1): lucide's Split and Merge are
// both vertical and read against the chart's left-to-right flow. A split is one
// line in and two out, a lump two in and one out. On the phone tier the badge's
// copy rotates 90deg (CSS) so it fans downward with the stacked chart. The words
// beside it carry the meaning; the glyph is aria-hidden.
function KindGlyph({ kind, size }: { kind: 'split' | 'lump'; size: number }) {
  return (
    <svg
      className="sr-lin-glyph"
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {kind === 'split'
        ? <><path d="M2 12h6" /><path d="m8 12 7-6h7" /><path d="m8 12 7 6h7" /></>
        : <><path d="M2 6h7l7 6h6" /><path d="M2 18h7l7-6" /></>}
    </svg>
  )
}

// ── The control + list panel ────────────────────────────────────────────────

export function SplitsLumpsControl({ entries, coverage, selectedSpecies, onPick, panelHost }: {
  entries: readonly HistoryListEntry[]
  coverage: Coverage
  /** The page's selected species (merged-mode key), for aria-current. */
  selectedSpecies: string | null
  /** Selects through the page's own path (reveal included), then scrolls to and
   *  focuses the lineage section (FR-12). */
  onPick: (species: string) => void
  /** The shared panel host after the taxonomy tools row (see PanelSlot). */
  panelHost: HTMLElement | null
}) {
  // Component state only: collapsed on every visit, never persisted (FR-12).
  const [open, setOpen] = useState(false)
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelId = useId()

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape' && open) {
      e.stopPropagation()
      setOpen(false)
      toggleRef.current?.focus()
    }
  }

  return (
    // .sr-ctl-row: the same phone-tier control sizing as "Subspecies and forms"
    // beside it, so the two chips read at one size (globals.css).
    <div className="sr-ctl-row" onKeyDown={handleKeyDown}>
      <Button
        ref={toggleRef}
        type="button"
        className="sr-ssx-toggle"
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen(v => !v)}
      >
        <span className="sr-ssx-tile" aria-hidden="true">
          <Split size={12} strokeWidth={2.2} />
        </span>
        {CONTROL_LABEL}
        {/* The count is the length of the SAME array the list renders (FR-10). */}
        <span className="sr-ssx-count">{speciesCountLabel(entries.length)}</span>
        <ChevronDown size={13} strokeWidth={2.2} className="sr-ssx-caret" aria-hidden="true" />
      </Button>

      {/* Conditionally RENDERED, never CSS-collapsed: no closed subtree, so no
          `inert` is owed. */}
      {open && (
        <PanelSlot host={panelHost}>
          <div className="sr-ssx-panel" id={panelId}>
            <div className="sr-ssx-panel-head">
              {entries.length === 0 ? zeroAffected(coverage) : panelHead(coverage)}
            </div>
            {entries.length > 0 && (
              <ul className="sr-ssx-list">
                {entries.map((entry, i) => (
                  <li key={i}>
                    <Button
                      type="button"
                      className="sr-sl-row"
                      aria-current={entry.species === selectedSpecies ? 'true' : undefined}
                      onClick={() => {
                        setOpen(false)
                        onPick(entry.species)
                      }}
                    >
                      {/* BirdName's non-link, favicon-less form: the whole row is
                          one button, so a nested link would be
                          interactive-inside-interactive (the explorer's rule). */}
                      <span className="sr-sl-row-name"><BirdName commonName={entry.species} breakAfterSlash /></span>
                      <span className="sr-sl-row-events">
                        {entry.events.map((ev, j) => (
                          <span key={j} className="sr-sl-row-ev">
                            <KindGlyph kind={ev.kind} size={11} />
                            <b>{KIND_WORD[ev.kind]}</b>
                            <span className="sr-sl-dot" aria-hidden="true">·</span>
                            {ev.year}
                          </span>
                        ))}
                      </span>
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </PanelSlot>
      )}
    </div>
  )
}

// ── One node of the chart ───────────────────────────────────────────────────

function LineageNode({ entry, yours, slash, predates, onOpenSpecies }: {
  /** `entry.current` decides the eBird and Birds of the World marks: true only
   *  for an after-side code that is still a species after every covered update.
   *  An after code a LATER update retired (Macquarie Parakeet's recpar23, still
   *  linkable as a species in an export made between the two updates) and every
   *  before-side code get the bare name, so no site link points at a species
   *  page that no longer exists (security review L1). */
  entry: EntryView
  yours: boolean
  slash: boolean
  predates: boolean
  onOpenSpecies: (species: string) => void
}) {
  const absent = entry.count === 0
  // A recorded entry that is not the page's own species links through the page's
  // selection path; the selected species, an entry with no reports and a slash
  // entry render the bare name (FR-23, design-spec.md).
  const speciesKey = entry.speciesKey
  const linkable = !absent && !yours && !slash && speciesKey !== null
  const cls = `sr-lin-node${yours ? ' is-you' : ''}${absent ? ' is-absent' : ''}`
  const sincePct = entry.count > 0 ? (entry.after / entry.count) * 100 : 0

  return (
    <div className={cls}>
      <div className="sr-lin-name" aria-hidden={linkable ? undefined : 'true'}>
        {linkable ? (
          <BirdName
            commonName={entry.com}
            taxonCode={entry.current ? entry.code : undefined}
            hasEntry
            onOpenSpecies={() => onOpenSpecies(speciesKey)}
            breakAfterSlash
          />
        ) : (
          <BirdName commonName={entry.com} breakAfterSlash />
        )}
      </div>
      <div className="sr-lin-sci" aria-hidden="true">{entry.sci}</div>
      {yours ? (
        <div className="sr-lin-mark sr-lin-mark--you" aria-hidden="true">
          <Check size={11} strokeWidth={3} />{MARK_YOUR_SPECIES}
        </div>
      ) : absent ? (
        <div className="sr-lin-mark" aria-hidden="true">{MARK_NO_REPORTS}</div>
      ) : slash ? (
        <div className="sr-lin-mark" aria-hidden="true">{MARK_SLASH}</div>
      ) : null}
      {!absent && (
        <div aria-hidden="true">
          <div className="sr-lin-count">{reportCountLabel(entry.count)}</div>
          {predates ? (
            <div className="sr-lin-part"><span>{PART_PREDATES}</span></div>
          ) : (
            <>
              <div className="sr-lin-part">
                <span><b>{entry.onOrBefore}</b> {PART_REASSIGNED}</span>
                <span><b>{entry.after}</b> {PART_RECORDED_SINCE}</span>
              </div>
              {/* One track (the reassigned share) and one right-aligned fill (the
                  recorded-since share): reinforcement only, both numbers are text. */}
              <div className="sr-lin-bar"><i style={{ width: `${sincePct.toFixed(2)}%` }} /></div>
            </>
          )}
        </div>
      )}
    </div>
  )
}

// ── One event: note, chart, sentence, text equivalent ───────────────────────

function LineageEvent({ ev, selectedSpecies, onOpenSpecies }: {
  ev: EventView
  selectedSpecies: string | null
  onOpenSpecies: (species: string) => void
}) {
  const yours = (e: EntryView) => e.speciesKey !== null && e.speciesKey === selectedSpecies
  const predates = ev.predates
  const beforeMulti = ev.before.length > 1
  const afterMulti = ev.after.length + ev.slashes.length > 1
  const sentence = eventSentence(ev.kind, ev.published, {
    predates,
    lumpName: ev.after[0]?.com ?? '',
    slashNames: ev.slashes.map(s => s.com),
  })
  const note = predates ? predatesNote(ev.published) : null

  return (
    <div className="sr-lin-event">
      {note && (
        <div className="sr-lin-note">
          <Info size={14} strokeWidth={2.2} aria-hidden="true" />
          <span><b>{note.lead}</b>{note.rest}</span>
        </div>
      )}

      <div className="sr-lin-chart">
        <div className={`sr-lin-side sr-lin-side--before ${beforeMulti ? 'sr-lin-side--multi' : 'sr-lin-side--single'}`}>
          {ev.before.map((e, i) => (
            <LineageNode key={i} entry={e} yours={yours(e)} slash={false} predates={predates} onOpenSpecies={onOpenSpecies} />
          ))}
        </div>
        <div className="sr-lin-rail" aria-hidden="true">
          <span className="sr-lin-badge">
            <KindGlyph kind={ev.kind} size={13} />
            <b>{KIND_WORD[ev.kind]}</b>
            <span>{updateLabel(ev.published)}</span>
          </span>
        </div>
        <div className={`sr-lin-side sr-lin-side--after ${afterMulti ? 'sr-lin-side--multi' : 'sr-lin-side--single'}`}>
          {ev.after.map((e, i) => (
            <LineageNode key={`a${i}`} entry={e} yours={yours(e)} slash={false} predates={false} onOpenSpecies={onOpenSpecies} />
          ))}
          {ev.slashes.map((e, i) => (
            <LineageNode key={`s${i}`} entry={e} yours={false} slash predates={false} onOpenSpecies={onOpenSpecies} />
          ))}
        </div>
      </div>

      {/* The plain statement of what eBird did, once per event (FR-17). Hidden
          from assistive technology only because the text equivalent below
          carries it verbatim. Every VISIBLE name in this section opts into
          breakAfterSlash (a no-op without a "/"), so a slash name such as
          "European/African/Eastern Red-rumped Swallow" wraps after its slashes
          at 320px and 200% text instead of running past the card (QA fix 2).
          The text equivalent is visually hidden and does not need it. */}
      <p className="sr-lin-sentence" aria-hidden="true">
        {sentence.lead}<b>{sentence.date}</b>{sentence.mid}
        {sentence.names.map((n, i) => (
          <span key={i}>{nameSeparator(i, sentence.names.length)}<BirdName commonName={n} breakAfterSlash /></span>
        ))}
        {sentence.tail}
      </p>

      {/* The text equivalent (FR-22): every fact the chart shows, in reading
          order. Visually hidden; `.sr-lin-event` is position: relative, so the
          absolutely positioned box cannot extend the page's scroll width. */}
      <div className="sr-only">
        <p>{altKindLine(ev.kind, ev.published)}</p>
        <p>
          Before:{' '}
          {ev.before.map((e, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <BirdName commonName={e.com} /> ({e.sci}){altEntryTail(e, { yours: yours(e), slash: false, predates })}
            </span>
          ))}
        </p>
        <p>
          After:{' '}
          {ev.after.map((e, i) => (
            <span key={`a${i}`}>
              {i > 0 && ' '}
              <BirdName commonName={e.com} /> ({e.sci}){altEntryTail(e, { yours: yours(e), slash: false, predates: false })}
            </span>
          ))}
          {ev.slashes.map((e, i) => (
            <span key={`s${i}`}>
              {' '}
              <BirdName commonName={e.com} /> ({e.sci}){altEntryTail(e, { yours: false, slash: true, predates: false })}
            </span>
          ))}
        </p>
        <p>{eventSentenceText(sentence)}</p>
      </div>
    </div>
  )
}

// ── The section ─────────────────────────────────────────────────────────────

export const SplitsLumpsSection = forwardRef<HTMLDivElement, {
  /** The selected species' lineage, or null when it is not affected (FR-21). */
  lineage: AffectedSpecies | null
  /** The index's events, addressed by `lineage.events[i].eventIndex`. */
  events: readonly EventView[]
  selectedSpecies: string | null
  coverage: Coverage
  /** A county or date filter is active: show the one-line note (FR-09). */
  filterActive: boolean
  /** The page's own selection path (openSpeciesInTab): reveals a hidden species. */
  onOpenSpecies: (species: string) => void
}>(function SplitsLumpsSection({ lineage, events, selectedSpecies, coverage, filterActive, onOpenSpecies }, ref) {
  return (
    // tabIndex -1: the focus target after a list pick (FR-12).
    <div ref={ref} tabIndex={-1}>
      <SectionCard>
        <SectionHead icon={<Split size={14} strokeWidth={2.2} />} title={SECTION_TITLE} />
        <div className="sr-pad-x-trim sr-lin-pad">
          {/* Keyed on the species, so the entrance and the bar fill play exactly
              when the content changed and never on an unrelated re-render. */}
          <div key={selectedSpecies ?? ''} className="sr-lin-body">
            {filterActive && <div className="sr-lin-filter-line">{FILTER_LINE}</div>}
            {lineage ? (
              lineage.events.map(ae => (
                <LineageEvent
                  key={`e${ae.eventIndex}`}
                  ev={events[ae.eventIndex]}
                  selectedSpecies={selectedSpecies}
                  onOpenSpecies={onOpenSpecies}
                />
              ))
            ) : (
              <div className="sr-lin-empty">{NOT_AFFECTED}</div>
            )}
          </div>
          <p className="sr-lin-coverage">{coverageLine(coverage)}</p>
        </div>
      </SectionCard>
    </div>
  )
})
