// Splits/Lumps/Renames UI (taxonomic-splits-lumps, extended by
// recorded-names-in-splits-and-lumps): the "Splits/Lumps/Renames" control
// beside "Subspecies and forms" with its full-backup list panel, and the
// per-species "Splits/Lumps/Renames" lineage section. Both render only in merged
// mode, in the ready state, with the history asset loaded; the parent gates all
// three (FR-10, FR-24, FR-28 of the shipped PRD).
//
// Every value derives in lib/taxonomyHistory.ts and every string that carries a
// count, a year, a date or a name comes from lib/taxonomyHistoryCopy.ts; these
// components only place them. Colors are --sr-* tokens only; layout, hover,
// open states and motion live in globals.css (.sr-sl-*, .sr-lin-*), where the
// global prefers-reduced-motion block collapses every animation.
//
// ACCESSIBILITY SHAPE OF THE CHART. The lineage chart repeats, graphically, what
// the visually hidden text equivalent after it states in reading order (FR-32).
// Every non-interactive piece of the chart is therefore `aria-hidden`, so a
// screen reader hears each fact once. The chart is NOT hidden as a whole,
// because a recorded, non-selected entry's name is a real button (it selects
// that species), and a focusable control inside an `aria-hidden` subtree is
// reachable by Tab yet absent from the accessibility tree. So the names that act
// stay exposed, and everything that only repeats the text equivalent does not.
// An earlier name is never a link (the backup does not carry it), so its name
// row is always hidden.
//
// IDS. Only `useId()` is used, so no id or IDREF is built from a name out of the
// backup or the record (security.md, v1.0.21). React keys are indexes.

import { Button } from '../ui/Button'
import { Fragment, forwardRef, useId, useRef, useState } from 'react'
import { Check, ChevronDown, CircleSlash, Info, Split } from 'lucide-react'
import { BirdName } from '../BirdName'
import { PanelSlot, SectionCard, SectionHead } from './ui'
import type {
  AffectedSpecies, EntryView, EventView, HistoryKind, HistoryListEntry, TaxonomyHistory,
} from '../../lib/taxonomyHistory'
import {
  CONTROL_LABEL, SECTION_TITLE, KIND_WORD, MARK_YOUR_SPECIES, MARK_NO_REPORTS, MARK_SLASH,
  MARK_RESIDUAL, MARK_UNTRACEABLE, MARK_ZERO, MARK_LATER, LATER_LINE,
  PART_RECORDED_SINCE, PART_PREDATES, NOT_AFFECTED, FILTER_LINE,
  altEarlierTail, altEntryTail, altKindLine, altResidual, badgeDate, basisLine, coverageLine,
  eventSentence, explanatoryParagraph, formLine, onOrBeforeLabel, panelHead, partsText,
  predatesNote, reportCountLabel, residualLine, showsParagraph, speciesCountLabel,
  untraceableLine, zeroAffected, zeroLine,
  type CopyPart,
} from '../../lib/taxonomyHistoryCopy'

type Coverage = TaxonomyHistory['coverage']

// ── The direction glyphs ────────────────────────────────────────────────────
// Hand-drawn on the lucide grid (decisions.md 1 of the shipped feature):
// lucide's Split and Merge are both vertical and read against the chart's
// left-to-right flow. A split is one line in and two out, a lump two in and one
// out, a rename one line in and one out. On the stacked chart the badge's copy
// rotates 90deg (CSS) so it points downward with the chart. The words beside it
// carry the meaning; the glyph is aria-hidden.
function KindGlyph({ kind, size }: { kind: HistoryKind; size: number }) {
  return (
    <svg
      className="sr-lin-glyph"
      width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"
    >
      {kind === 'split'
        ? <><path d="M2 12h6" /><path d="m8 12 7-6h7" /><path d="m8 12 7 6h7" /></>
        : kind === 'lump'
          ? <><path d="M2 6h7l7 6h6" /><path d="M2 18h7l7-6" /></>
          : <><path d="M2 12h19" /><path d="m15 6 6 6-6 6" /></>}
    </svg>
  )
}

/** A string with a line-break opportunity after each "/", the same idea as
 *  BirdName's `breakAfterSlash`: the text content and accessible name are
 *  unchanged, because `<wbr>` adds no character (design-spec 6.1). */
function withSlashBreaks(text: string) {
  const segments = text.split('/')
  return segments.map((seg, i) => (
    <Fragment key={i}>
      {seg}
      {i < segments.length - 1 && <>/<wbr /></>}
    </Fragment>
  ))
}

/**
 * Copy parts, placed: text as text, a bold run at weight 600, a bird name
 * through BirdName (unlinked, no site marks: every name a sentence or line
 * quotes is the record's or the backup's, FR-27). Punctuation that follows a
 * name rides as its `trailing`, so a line never starts with it (bird-names.md).
 * The punctuation is read off the module's own copy strings, never off a name.
 */
function Parts({ parts }: { parts: readonly CopyPart[] }) {
  const out: React.ReactNode[] = []
  for (let i = 0; i < parts.length; i += 1) {
    const p = parts[i]
    if (typeof p === 'string') { out.push(<Fragment key={i}>{p}</Fragment>); continue }
    if ('bold' in p) { out.push(<b key={i}>{p.bold}</b>); continue }
    const next = parts[i + 1]
    let trailing = ''
    if (typeof next === 'string') {
      let k = 0
      while (k < next.length && '.,;:'.includes(next[k])) k += 1
      trailing = next.slice(0, k)
    }
    out.push(<BirdName key={i} commonName={p.name} breakAfterSlash trailing={trailing || undefined} />)
    if (trailing) {
      const rest = (next as string).slice(trailing.length)
      if (rest) out.push(<Fragment key={`${i}r`}>{rest}</Fragment>)
      i += 1
    }
  }
  return <>{out}</>
}

// ── The control + list panel ────────────────────────────────────────────────

export function SplitsLumpsControl({ entries, coverage, selectedSpecies, onPick, panelHost }: {
  entries: readonly HistoryListEntry[]
  coverage: Coverage
  /** The page's selected species (merged-mode key), for aria-current. */
  selectedSpecies: string | null
  /** Selects through the page's own path (reveal included), then scrolls to and
   *  focuses the lineage section (FR-31). */
  onPick: (species: string) => void
  /** The shared panel host after the taxonomy tools row (see PanelSlot). */
  panelHost: HTMLElement | null
}) {
  // Component state only: collapsed on every visit, never persisted (FR-31).
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
        <span className="sr-ssx-label">{withSlashBreaks(CONTROL_LABEL)}</span>
        {/* The count is the length of the SAME array the list renders (FR-30). */}
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

// ── Names as displayed ──────────────────────────────────────────────────────

/**
 * A rename's current name as the page shows it (design-spec section 5, item 3):
 * the record holds the update file's spelling, which can differ from today's
 * (Nankeen Night-Heron against Nankeen Night Heron), so the LATEST rename of a
 * code that is still current shows the species as the page carries it. Only
 * then: an earlier rename, a later-changed one (a later split or lump may have
 * renamed the code again) and a name no report matched keep the record's
 * spelling. The record is never touched.
 */
function shownCurrentName(ev: EventView): string {
  const a = ev.after[0]
  if (ev.kind !== 'rename' || a === undefined) return a?.com ?? ''
  return a.current && a.speciesKey !== null && ev.earlierState !== 'later-changed' ? a.speciesKey : a.com
}

// ── One current-side node, or any node of an older backup (shipped) ─────────

function LineageNode({ entry, com, yours, slash, predates, partLabel, onOpenSpecies }: {
  /** `entry.current` decides the eBird and Birds of the World marks: true only
   *  for an after-side code that is still a species after every covered update
   *  (and, on a rename, only on its latest rename). An after code a LATER update
   *  retired and every before-side code get the bare name, so no site link
   *  points at a species page that no longer exists (security review L1). */
  entry: EntryView
  /** The name as displayed (shownCurrentName on a rename), else `entry.com`. */
  com: string
  yours: boolean
  slash: boolean
  predates: boolean
  /** "reassigned by eBird", or "renamed by eBird" on a rename (FR-23). */
  partLabel: string
  onOpenSpecies: (species: string) => void
}) {
  const absent = entry.count === 0
  // A recorded entry that is not the page's own species links through the page's
  // selection path; the selected species, an entry with no reports and a slash
  // entry render the bare name (shipped FR-23, design-spec.md).
  const speciesKey = entry.speciesKey
  const linkable = !absent && !yours && !slash && speciesKey !== null
  const cls = `sr-lin-node${yours ? ' is-you' : ''}${absent ? ' is-absent' : ''}`
  const sincePct = entry.count > 0 ? (entry.after / entry.count) * 100 : 0

  return (
    <div className={cls}>
      <div className="sr-lin-name" aria-hidden={linkable ? undefined : 'true'}>
        {linkable ? (
          <BirdName
            commonName={com}
            taxonCode={entry.current ? entry.code : undefined}
            hasEntry
            onOpenSpecies={() => onOpenSpecies(speciesKey)}
            breakAfterSlash
          />
        ) : (
          <BirdName commonName={com} breakAfterSlash />
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
                <span><b>{entry.onOrBefore}</b> {partLabel}</span>
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

// ── One earlier-name node (design-spec 4.2, S1 to S5) ───────────────────────

/** One `.sr-lin-part` line: ONE span holding the whole line, because the row is
 *  a wrapping flex row and a second child would wrap as its own item. */
function Line({ parts }: { parts: readonly CopyPart[] }) {
  return <div className="sr-lin-part" aria-hidden="true"><span><Parts parts={parts} /></span></div>
}

/** A micro-caps marker; `cannot` adds the circle-slash glyph (S3, S5). */
function Mark({ text, cannot, lead }: { text: string; cannot?: boolean; lead?: boolean }) {
  const cls = `sr-lin-mark${cannot ? ' sr-lin-mark--cannot' : ''}${lead ? ' sr-lin-mark--lead' : ''}`
  return (
    <div className={cls} aria-hidden="true">
      {cannot && <CircleSlash className="sr-lin-cannot-glyph" strokeWidth={2.4} aria-hidden="true" />}
      <span>{text}</span>
    </div>
  )
}

/** The earlier-name share bar (design-spec section 8): this box's share of the
 *  event's reports dated on or before the update. Full for a split and a
 *  rename; a lump's boxes add up to the whole. Reinforcement only. */
function ShareBar({ figure, total }: { figure: number; total: number }) {
  const pct = total > 0 ? (figure / total) * 100 : 0
  return <div className="sr-lin-bar sr-lin-bar--earlier" aria-hidden="true"><i style={{ width: `${pct.toFixed(2)}%` }} /></div>
}

function EarlierNode({ entry, ev, currentName }: { entry: EntryView; ev: EventView; currentName: string }) {
  const name = (
    <div className="sr-lin-name" aria-hidden="true"><BirdName commonName={entry.com} breakAfterSlash /></div>
  )
  const sci = <div className="sr-lin-sci" aria-hidden="true">{entry.sci}</div>
  const lumped = ev.after[0]?.com ?? ''
  if (ev.earlierState === 'later-changed') {
    return (
      <div className="sr-lin-node is-absent">
        {name}{sci}<Mark text={MARK_LATER} cannot /><Line parts={[LATER_LINE]} />
      </div>
    )
  }
  const e = entry.earlier
  if (e.state === 'untraceable') {
    return (
      <div className="sr-lin-node is-absent">
        {name}{sci}<Mark text={MARK_UNTRACEABLE} cannot /><Line parts={untraceableLine(e.reason, lumped)} />
      </div>
    )
  }
  if (e.state !== 'count') return null
  if (e.n === 0) {
    return (
      <div className="sr-lin-node is-absent">
        {name}{sci}<Mark text={MARK_ZERO} /><Line parts={zeroLine(ev.kind, { form: entry.form, currentName })} />
      </div>
    )
  }
  // A split's and a rename's figure IS their reassigned total, so the bar is
  // full; a lump's total is the lumped name's reassigned figure.
  const total = ev.kind === 'lump' ? ev.after[0].onOrBefore : e.n
  return (
    <div className="sr-lin-node">
      {name}{sci}
      <div className="sr-lin-count" aria-hidden="true">{reportCountLabel(e.n)}</div>
      <Line parts={[basisLine(e.n, ev.kind)]} />
      {entry.form !== '' && <Line parts={formLine(entry.form)} />}
      <ShareBar figure={e.n} total={total} />
    </div>
  )
}

/** "Earlier name not recorded" (S4): a lump's reports dated on or before the
 *  update that carry no kept form (FR-17). Never assigned to an earlier name. */
function ResidualNode({ ev }: { ev: EventView }) {
  return (
    <div className="sr-lin-node is-absent">
      <Mark text={MARK_RESIDUAL} lead />
      <div className="sr-lin-count" aria-hidden="true">{reportCountLabel(ev.residual)}</div>
      <Line parts={[residualLine(ev.residual)]} />
      <ShareBar figure={ev.residual} total={ev.after[0].onOrBefore} />
    </div>
  )
}

// ── One event: note, chart, sentence, paragraph, text equivalent ────────────

function LineageEvent({ ev, selectedSpecies, onOpenSpecies }: {
  ev: EventView
  selectedSpecies: string | null
  onOpenSpecies: (species: string) => void
}) {
  const yours = (e: EntryView) => e.speciesKey !== null && e.speciesKey === selectedSpecies
  const predates = ev.predates
  const preUpdate = ev.earlierState === 'pre-update'
  const showResidual = ev.earlierState === 'counted' && ev.residual > 0
  const currentName = shownCurrentName(ev)
  const afterCom = (e: EntryView, i: number) => (ev.kind === 'rename' && i === 0 ? currentName : e.com)
  const beforeMulti = ev.before.length + (showResidual ? 1 : 0) > 1
  const afterMulti = ev.after.length + ev.slashes.length > 1
  const partLabel = onOrBeforeLabel(ev.kind)
  const sentence = eventSentence(ev.kind, ev.published, {
    earlierState: ev.earlierState,
    predates,
    lumpName: ev.after[0]?.com ?? '',
    slashNames: ev.slashes.map(s => s.com),
    anyTraced: ev.before.some(b => b.form !== ''),
    earlierName: ev.before[0]?.com ?? '',
    currentName,
  })
  const paragraph = showsParagraph(ev)
    ? explanatoryParagraph(ev.kind, { earlierName: ev.before[0]?.com ?? '', residual: ev.residual })
    : null
  const note = predates ? predatesNote(ev.published, ev.kind) : null
  const lumped = ev.after[0]?.com ?? ''

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
          {ev.before.map((e, i) => (preUpdate
            ? <LineageNode key={i} entry={e} com={e.com} yours={yours(e)} slash={false} predates={predates} partLabel={partLabel} onOpenSpecies={onOpenSpecies} />
            : <EarlierNode key={i} entry={e} ev={ev} currentName={currentName} />
          ))}
          {showResidual && <ResidualNode ev={ev} />}
        </div>
        <div className="sr-lin-rail" aria-hidden="true">
          <span className="sr-lin-badge">
            <KindGlyph kind={ev.kind} size={13} />
            <b>{KIND_WORD[ev.kind]}</b>
            <span>{badgeDate(ev.kind, ev.published)}</span>
          </span>
        </div>
        <div className={`sr-lin-side sr-lin-side--after ${afterMulti ? 'sr-lin-side--multi' : 'sr-lin-side--single'}`}>
          {ev.after.map((e, i) => (
            <LineageNode key={`a${i}`} entry={e} com={afterCom(e, i)} yours={yours(e)} slash={false} predates={false} partLabel={partLabel} onOpenSpecies={onOpenSpecies} />
          ))}
          {ev.slashes.map((e, i) => (
            <LineageNode key={`s${i}`} entry={e} com={e.com} yours={false} slash predates={false} partLabel={partLabel} onOpenSpecies={onOpenSpecies} />
          ))}
        </div>
      </div>

      {/* The plain statement of what eBird did, once per event (FR-24), and how
          the counts are worked out (FR-25). Hidden from assistive technology only
          because the text equivalent below carries both verbatim. Every name
          they quote opts into breakAfterSlash (a no-op without a "/"), so a
          slash name wraps after its slashes at 320px and 200% text. */}
      <p className="sr-lin-sentence" aria-hidden="true"><Parts parts={sentence} /></p>
      {paragraph && <p className="sr-lin-sentence" aria-hidden="true"><Parts parts={paragraph} /></p>}

      {/* The text equivalent (FR-32): every fact the chart shows, in reading
          order, in the chart's own words. Visually hidden; `.sr-lin-event` is
          position: relative, so the absolutely positioned box cannot extend the
          page's scroll width. */}
      <div className="sr-only">
        <p>{altKindLine(ev.kind, ev.published)}</p>
        <p>
          Before:{' '}
          {ev.before.map((e, i) => (
            <span key={i}>
              {i > 0 && ' '}
              <BirdName commonName={e.com} /> ({e.sci}){preUpdate
                ? altEntryTail(e, { yours: yours(e), slash: false, predates, kind: ev.kind })
                : altEarlierTail(ev.kind, ev.earlierState === 'later-changed' ? 'later-changed' : 'counted', e, { currentName, lumpedName: lumped })}
            </span>
          ))}
          {showResidual && <span>{' '}{altResidual(ev.residual)}</span>}
        </p>
        <p>
          After:{' '}
          {ev.after.map((e, i) => (
            <span key={`a${i}`}>
              {i > 0 && ' '}
              <BirdName commonName={afterCom(e, i)} /> ({e.sci}){altEntryTail(e, { yours: yours(e), slash: false, predates: false, kind: ev.kind })}
            </span>
          ))}
          {ev.slashes.map((e, i) => (
            <span key={`s${i}`}>
              {' '}
              <BirdName commonName={e.com} /> ({e.sci}){altEntryTail(e, { yours: false, slash: true, predates: false, kind: ev.kind })}
            </span>
          ))}
        </p>
        <p>{partsText(sentence)}</p>
        {paragraph && <p>{partsText(paragraph)}</p>}
      </div>
    </div>
  )
}

// ── The section ─────────────────────────────────────────────────────────────

export const SplitsLumpsSection = forwardRef<HTMLDivElement, {
  /** The selected species' lineage, or null when it is not affected (FR-29). */
  lineage: AffectedSpecies | null
  /** The index's events, addressed by `lineage.events[i].eventIndex`. */
  events: readonly EventView[]
  selectedSpecies: string | null
  coverage: Coverage
  /** A county or date filter is active: show the one-line note (FR-11). */
  filterActive: boolean
  /** The page's own selection path (openSpeciesInTab): reveals a hidden species. */
  onOpenSpecies: (species: string) => void
}>(function SplitsLumpsSection({ lineage, events, selectedSpecies, coverage, filterActive, onOpenSpecies }, ref) {
  return (
    // tabIndex -1: the focus target after a list pick (FR-31).
    <div ref={ref} tabIndex={-1}>
      <SectionCard>
        <SectionHead icon={<Split size={14} strokeWidth={2.2} />} title={withSlashBreaks(SECTION_TITLE)} titleClassName="sr-lin-title" />
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
