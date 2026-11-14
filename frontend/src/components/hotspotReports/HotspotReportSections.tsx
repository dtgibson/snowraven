// The report's sections other than the header, the map and the life list
// (design-spec "Checklists by protocol", "Weather on your visits", "Visits and
// media"; hotspot-report-order-and-stats design-refinement "At a glance" and
// "Most-recorded species"): every distribution is the shared distribution row
// (`WeatherDistRow.tsx`), so this tab is a further surface of that primitive
// and its phone tier. Every string is the copy module's; every bird name is a
// `BirdName`. No DOM id is minted here, and every React key is a fixed literal
// or an index, never file content.

import type { ReactNode } from 'react'
import { Camera, Mic, Video } from 'lucide-react'
import { BirdName } from '../BirdName'
import { ChecklistLink } from '../ChecklistLink'
import { formatDate } from '../../lib/formatDate'
import { fmtSharePct } from '../../lib/statsFormat'
import { CONDITION_LABEL } from '../../lib/weatherDisplay'
import { dayToIso } from '../../lib/lifeLists'
import { WEATHER_SPECIES_MIN_CHECKLISTS } from '../../lib/weatherStats'
import {
  glanceView,
  type LocationFacts, type LocationLifeRow, type LocationSpecies, type MostRecordedView, type WeatherFigure, type WeatherView,
} from '../../lib/hotspotReportsLocation'
import {
  BIGGEST_JOIN, BLANK_PROTOCOL, COMPLETE_HEAD, ELLIPSIS, FACT_TERMS, MEDIA_HEAD, MEDIA_NOTE, MEDIA_UNITS,
  ML_NONE, ML_UNREADABLE, MONTHS_TITLE, MONTH_LABELS, NONE_SAY, NO_DATED, NO_DURATION, NO_WEATHER, ON_WORD,
  OTHER_PROTOCOLS, PROTOCOL_GROUP_TITLE, TILE_LABELS, TOP_SHARE_SEP, WEATHER_GROUPS, WEATHER_SOURCE, YEARS_TITLE,
  biggestLabel, checklistsNoun, completeSentence, datedDenominator, daysNote, distanceNote, earlierYearsLabel,
  formatCount, gapNote, gapUnit, hoursMinutes, milesLabel, ofChecklistsTail, onceNote, perHourFigure, perHourNote,
  soleTopTail, timeBirdedNote, topLead, weatherBelowFloor, weatherCoverage, yearsNote,
} from '../../lib/hotspotReportsCopy'
import { DistGroup, GroupHead, type GroupRow } from './HotspotReportsParts'

/** What a bird name needs from the tab: its marks' code and Species Detail. */
interface NameProps {
  codeFor: (name: string) => string | undefined
  onOpenSpecies?: (commonName: string) => void
}

// ── Checklists by protocol (FR-42 to FR-44) ──────────────────────────────────

export function ProtocolsBody({ facts }: { facts: LocationFacts }) {
  const total = facts.checklists.length
  const rows: GroupRow[] = facts.protocols.map(p => ({
    label: p.kind === 'other' ? OTHER_PROTOCOLS : p.kind === 'blank' ? BLANK_PROTOCOL : p.truncated ? p.name + ELLIPSIS : p.name,
    n: p.count,
  }))
  const { complete, known, unknown } = facts.complete
  return (
    <>
      <DistGroup
        title={PROTOCOL_GROUP_TITLE}
        den={<><b>{formatCount(total)}</b>{` ${checklistsNoun(total)}`}</>}
        rows={rows}
        share
        className="sr-hsr-proto"
      />
      <div className="sr-hsr-divider" />
      <GroupHead title={COMPLETE_HEAD} />
      {known === 0
        ? <p className="sr-hsr-body-text">{NONE_SAY}</p>
        : <p className="sr-hsr-body-text"><b>{fmtSharePct(complete, known)}</b>{completeSentence(complete, known, unknown)}</p>}
    </>
  )
}

// ── Weather on your visits (FR-45 to FR-49) ──────────────────────────────────

function WeatherGroup({ axis, figure }: { axis: keyof typeof WEATHER_GROUPS; figure: WeatherFigure }) {
  const rows: GroupRow[] = figure.rows.map(r => (axis === 'sky'
    ? { glyph: r.key, label: CONDITION_LABEL[r.index], n: r.checklists }
    : { label: r.key, n: r.checklists }))
  return (
    <DistGroup
      title={WEATHER_GROUPS[axis].title}
      den={<><b>{formatCount(figure.denominator)}</b>{` ${WEATHER_GROUPS[axis].denominator}`}</>}
      rows={rows}
      share
      typical={figure.typical}
    />
  )
}

export function WeatherBody({ view, floor = WEATHER_SPECIES_MIN_CHECKLISTS }: { view: WeatherView; floor?: number }) {
  if (view.state === 'none') return <p className="sr-hsr-body-text">{NO_WEATHER}</p>
  const coverage = (
    <p className="sr-hsr-body-text">
      <b>{formatCount(view.readable)}</b>{weatherCoverage(view.readable, view.total, view.unreadable)}
    </p>
  )
  if (view.state === 'below-floor') {
    return (
      <div className="sr-hsr-stack">
        {coverage}
        <p className="sr-hsr-note">{weatherBelowFloor(floor)}</p>
      </div>
    )
  }
  return (
    <>
      <div className="sr-hsr-stack">
        {coverage}
        <p className="sr-hsr-note">{WEATHER_SOURCE}</p>
      </div>
      <div className="sr-hsr-divider" />
      <WeatherGroup axis="sky" figure={view.sky} />
      <div className="sr-hsr-gap" />
      <WeatherGroup axis="temperature" figure={view.temperature} />
      <div className="sr-hsr-gap" />
      <WeatherGroup axis="wind" figure={view.wind} />
    </>
  )
}

// ── At a glance (FR-51, FR-53, FR-54 moved up; the opening figures) ─────────

function VisitLink({ submissionId, day }: { submissionId: string; day: number }) {
  return <ChecklistLink submissionId={submissionId} label={formatDate(dayToIso(day))} size="md" style={{ fontWeight: 600 }} />
}

/** One count tile: the header's figure label over a figure, its denominator beneath. */
function Tile({ label, value, unit, note }: { label: string; value: string; unit?: string; note: string }) {
  return (
    <div className="sr-hsr-tile">
      <dt className="sr-hsr-fig-label">{label}</dt>
      <dd className="sr-hsr-tile-value">{value}{unit !== undefined ? <span className="sr-hsr-tile-unit">{unit}</span> : null}</dd>
      <dd className="sr-hsr-note">{note}</dd>
    </div>
  )
}

/** A fact row whose value is a bird and the dated checklist of its first record here. */
function SpeciesFact({ term, row, codeFor, onOpenSpecies }: NameProps & { term: string; row: LocationLifeRow }) {
  return (
    <div className="sr-hsr-fact">
      <dt>{term}</dt>
      <dd className="sr-hsr-fact-sp">
        <BirdName commonName={row.name} taxonCode={codeFor(row.name)} hasEntry onOpenSpecies={onOpenSpecies} size="md" />
        <VisitLink submissionId={row.checklistId} day={row.day} />
      </dd>
    </div>
  )
}

export function GlanceBody({ facts, species, codeFor, onOpenSpecies }: NameProps & { facts: LocationFacts; species: LocationSpecies }) {
  const total = facts.checklists.length
  const view = glanceView(facts, species)
  const first = facts.firstVisit
  const latest = facts.latestVisit
  const only = first !== null && latest !== null && first.submissionId === latest.submissionId
  const biggest = species.biggest
  const tiles: ReactNode[] = []
  if (view.days !== null) tiles.push(<Tile key="days" label={TILE_LABELS.days} value={formatCount(view.days.days)} note={daysNote(view.days.dated, total)} />)
  if (view.years !== null) tiles.push(<Tile key="years" label={TILE_LABELS.years} value={formatCount(view.years.count)} note={yearsNote(view.years.first, view.years.last)} />)
  if (view.perHour !== null) {
    tiles.push(<Tile key="hour" label={TILE_LABELS.perHour} value={perHourFigure(view.perHour.mean)} note={perHourNote(view.perHour.counted, total, view.perHour.aboveZero)} />)
  }
  if (view.recordedOnce !== null) tiles.push(<Tile key="once" label={TILE_LABELS.once} value={formatCount(view.recordedOnce.once)} note={onceNote(view.recordedOnce.species)} />)
  if (view.gap !== null) {
    tiles.push(<Tile key="gap" label={TILE_LABELS.gap} value={formatCount(view.gap.days)} unit={gapUnit(view.gap.days)} note={gapNote(dayToIso(view.gap.from), dayToIso(view.gap.to))} />)
  }
  const sp = view.species
  return (
    <div className="sr-hsr-glance">
      {tiles.length > 0 ? <dl className="sr-hsr-tiles">{tiles}</dl> : null}
      <dl className="sr-hsr-facts">
        {first === null ? (
          <div className="sr-hsr-fact"><dt>{FACT_TERMS.first}</dt><dd>{NO_DATED}</dd></div>
        ) : only ? (
          <div className="sr-hsr-fact"><dt>{FACT_TERMS.only}</dt><dd><VisitLink submissionId={first.submissionId} day={first.day} /></dd></div>
        ) : (
          <>
            <div className="sr-hsr-fact"><dt>{FACT_TERMS.first}</dt><dd><VisitLink submissionId={first.submissionId} day={first.day} /></dd></div>
            <div className="sr-hsr-fact"><dt>{FACT_TERMS.latest}</dt><dd><VisitLink submissionId={latest!.submissionId} day={latest!.day} /></dd></div>
          </>
        )}
        <div className="sr-hsr-fact">
          <dt>{FACT_TERMS.time}</dt>
          <dd>
            {facts.timeBirded.counted === 0 ? NO_DURATION : (
              <>
                <b>{hoursMinutes(facts.timeBirded.minutes)}</b>
                <small>{timeBirdedNote(facts.timeBirded.counted, total, facts.timeBirded.minutes)}</small>
              </>
            )}
          </dd>
        </div>
        {view.distance !== null ? (
          <div className="sr-hsr-fact">
            <dt>{FACT_TERMS.distance}</dt>
            <dd>
              <b>{milesLabel(view.distance.km)}</b>
              <small>{distanceNote(view.distance.counted, total, view.distance.km)}</small>
            </dd>
          </div>
        ) : null}
        {biggest !== null ? (
          <div className="sr-hsr-fact">
            <dt>{FACT_TERMS.biggest}</dt>
            <dd>
              <b>{biggestLabel(biggest.species)}</b>{BIGGEST_JOIN}
              {biggest.day > 0
                ? <VisitLink submissionId={biggest.checklist.submissionId} day={biggest.day} />
                : <ChecklistLink submissionId={biggest.checklist.submissionId} size="md" style={{ fontWeight: 600 }} />}
            </dd>
          </div>
        ) : null}
        {sp === null ? null : sp.kind === 'only' ? (
          <SpeciesFact term={FACT_TERMS.onlySpecies} row={sp.row} codeFor={codeFor} onOpenSpecies={onOpenSpecies} />
        ) : (
          <>
            <SpeciesFact term={FACT_TERMS.firstSpecies} row={sp.first} codeFor={codeFor} onOpenSpecies={onOpenSpecies} />
            <SpeciesFact term={FACT_TERMS.newestSpecies} row={sp.newest} codeFor={codeFor} onOpenSpecies={onOpenSpecies} />
          </>
        )}
      </dl>
    </div>
  )
}

// ── Most-recorded species (the life list's own figure, ten at most) ────────

export function MostRecordedBody({ view, species, checklists, codeFor, onOpenSpecies }: NameProps & {
  view: MostRecordedView
  /** The location's species total (the lead line's S). */
  species: number
  /** The location's checklist total (every row's C). */
  checklists: number
}) {
  if (view.kind === 'one') {
    return (
      <p className="sr-hsr-body-text">
        <BirdName commonName={view.row.name} taxonCode={codeFor(view.row.name)} hasEntry onOpenSpecies={onOpenSpecies} size="md" />
        {soleTopTail(view.row.checklists, checklists)}
      </p>
    )
  }
  return (
    <>
      <p className="sr-hsr-note sr-hsr-toplead">{topLead(species, checklists)}</p>
      <ol className="sr-hsr-toplist">
        {view.rows.map((r, i) => (
          <li key={i} className="sr-hsr-toprow">
            <span className="sr-hsr-top-num" aria-hidden="true">{i + 1}</span>
            <div className="sr-hsr-top-main">
              <BirdName commonName={r.name} taxonCode={codeFor(r.name)} hasEntry onOpenSpecies={onOpenSpecies} size="md" />
              <span className="sr-hsr-top-fig">
                {ON_WORD}<b>{formatCount(r.checklists)}</b>{ofChecklistsTail(checklists)}
                <span aria-hidden="true">{TOP_SHARE_SEP}</span>{' '}{fmtSharePct(r.checklists, checklists)}
              </span>
            </div>
          </li>
        ))}
      </ol>
    </>
  )
}

// ── Visits and media (FR-52, FR-55) ──────────────────────────────────────────

export type MediaState =
  | { readonly tag: 'none' }
  | { readonly tag: 'unreadable' }
  | { readonly tag: 'ready'; readonly photo: number; readonly audio: number; readonly video: number }

export function VisitsBody({ facts, media }: { facts: LocationFacts; media: MediaState }) {
  const total = facts.checklists.length
  const months: GroupRow[] = facts.months.map((n, i) => ({ label: MONTH_LABELS[i], n }))
  const years: GroupRow[] = facts.years.map(y => (y.kind === 'earlier'
    ? { label: earlierYearsLabel(y.before), n: y.count }
    : { label: String(y.year), n: y.count }))
  const dated = datedDenominator(facts.datedChecklists, total)
  const datedDen = <><b>{dated.figure}</b>{dated.tail}</>
  return (
    <>
      <DistGroup title={MONTHS_TITLE} den={datedDen} rows={months} share={false} />
      {years.length > 0 ? (
        <>
          <div className="sr-hsr-divider" />
          <DistGroup title={YEARS_TITLE} den={datedDen} rows={years} share={false} />
        </>
      ) : null}
      <div className="sr-hsr-divider" />
      <GroupHead title={MEDIA_HEAD} />
      {media.tag === 'none' ? <p className="sr-hsr-body-text">{ML_NONE}</p>
        : media.tag === 'unreadable' ? <p className="sr-hsr-body-text">{ML_UNREADABLE}</p>
          : (
            <>
              <ul className="sr-hsr-media">
                <li><Camera size={13} strokeWidth={2.2} className="sr-hsr-media-glyph" aria-hidden="true" /><span><b>{formatCount(media.photo)}</b> {MEDIA_UNITS.photo(media.photo)}</span></li>
                <li><Mic size={13} strokeWidth={2.2} className="sr-hsr-media-glyph" aria-hidden="true" /><span><b>{formatCount(media.audio)}</b> {MEDIA_UNITS.audio(media.audio)}</span></li>
                <li><Video size={13} strokeWidth={2.2} className="sr-hsr-media-glyph" aria-hidden="true" /><span><b>{formatCount(media.video)}</b> {MEDIA_UNITS.video(media.video)}</span></li>
              </ul>
              <p className="sr-hsr-note">{MEDIA_NOTE}</p>
            </>
          )}
    </>
  )
}
