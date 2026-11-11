// The report's compact sections (design-spec "Checklists by protocol", "Weather
// on your visits", "Visits and media"): every distribution is the shared
// distribution row (`WeatherDistRow.tsx`), so this tab is a further surface of
// that primitive and its phone tier. Every string is the copy module's.

import { Camera, Mic, Video } from 'lucide-react'
import { ChecklistLink } from '../ChecklistLink'
import { formatDate } from '../../lib/formatDate'
import { fmtSharePct } from '../../lib/statsFormat'
import { CONDITION_LABEL } from '../../lib/weatherDisplay'
import { dayToIso } from '../../lib/lifeLists'
import { WEATHER_SPECIES_MIN_CHECKLISTS } from '../../lib/weatherStats'
import type { LocationFacts, LocationSpecies, WeatherFigure, WeatherView } from '../../lib/hotspotReportsLocation'
import {
  BIGGEST_JOIN, BLANK_PROTOCOL, COMPLETE_HEAD, ELLIPSIS, FACT_TERMS, MEDIA_HEAD, MEDIA_NOTE, MEDIA_UNITS,
  ML_NONE, ML_UNREADABLE, MONTHS_TITLE, MONTH_LABELS, NONE_SAY, NO_DATED, NO_DURATION, NO_WEATHER,
  OTHER_PROTOCOLS, PROTOCOL_GROUP_TITLE, WEATHER_GROUPS, WEATHER_SOURCE, YEARS_TITLE,
  biggestLabel, checklistsNoun, completeSentence, datedDenominator, earlierYearsLabel, formatCount,
  hoursMinutes, timeBirdedNote, weatherBelowFloor, weatherCoverage,
} from '../../lib/hotspotReportsCopy'
import { DistGroup, GroupHead, type GroupRow } from './HotspotReportsParts'

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

// ── Visits and media (FR-51 to FR-55) ────────────────────────────────────────

export type MediaState =
  | { readonly tag: 'none' }
  | { readonly tag: 'unreadable' }
  | { readonly tag: 'ready'; readonly photo: number; readonly audio: number; readonly video: number }

function VisitLink({ submissionId, day }: { submissionId: string; day: number }) {
  return <ChecklistLink submissionId={submissionId} label={formatDate(dayToIso(day))} size="md" style={{ fontWeight: 600 }} />
}

export function VisitsBody({ facts, species, media }: { facts: LocationFacts; species: LocationSpecies; media: MediaState }) {
  const total = facts.checklists.length
  const first = facts.firstVisit
  const latest = facts.latestVisit
  const only = first !== null && latest !== null && first.submissionId === latest.submissionId
  const months: GroupRow[] = facts.months.map((n, i) => ({ label: MONTH_LABELS[i], n }))
  const years: GroupRow[] = facts.years.map(y => (y.kind === 'earlier'
    ? { label: earlierYearsLabel(y.before), n: y.count }
    : { label: String(y.year), n: y.count }))
  const dated = datedDenominator(facts.datedChecklists, total)
  const datedDen = <><b>{dated.figure}</b>{dated.tail}</>
  const biggest = species.biggest
  return (
    <>
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
                <small>{timeBirdedNote(facts.timeBirded.counted, total)}</small>
              </>
            )}
          </dd>
        </div>
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
      </dl>
      <div className="sr-hsr-divider" />
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
