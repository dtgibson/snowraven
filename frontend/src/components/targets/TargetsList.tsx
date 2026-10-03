// The target list (targets-tab FR-41 to FR-58; design-spec section 4): the
// LIVE sweep band, then a real table whose columns are grouped under
// PROBABILITY and LIVE, or the one empty-state sentence that replaces it.
//
// THE TWO KINDS ARE TOLD APART WITHOUT COLOUR OR POSITION (FR-58). A
// probability figure is a percent with its sign over a continuous share bar,
// under a header that names eBird, the county and the file's range; a live
// figure is a sentence with a count and its window over thirty discrete day
// ticks, and never carries "%". Bars and ticks are `aria-hidden`: the words
// carry the meaning, in the visible text and the accessible names alike.
//
// Roles are explicit on the table so they survive the phone tier's display
// change, every cell carries its column label (visible on a phone, sr-only on
// desktop where the header supplies it), and no id is built from a species or
// county name (NFR-04): the only ids here are index-keyed.

import { Fragment, type ReactNode } from 'react'
import {
  ArrowDown, ArrowUp, Camera, Check, ChevronsUpDown, Clock, Egg, Key, Loader, Mic, Percent, Radio, Sparkles,
  Video, WifiOff,
} from 'lucide-react'
import { Button } from '../ui/Button'
import { BirdName } from '../BirdName'
import { HotspotLink } from '../HotspotLink'
import { formatDate } from '../../lib/formatDate'
import { SORT_LABELS, type TargetRow, type TargetsSort } from '../../lib/targets/targetsSort'
import type { DayState } from '../../lib/targets/targetsLive'
import { isChecked } from '../../lib/targets/targetsLive'
import type { SweepStatus } from '../../lib/targets/useCountyDaySweep'
import type { MediaType } from '../../lib/targets/targetsRecord'
import {
  BADGE_BREEDING, BADGE_LIFER, BADGE_MEDIA, COL_DISTANCE, COL_FREQUENCY, COL_LAST_REPORT, COL_REPORTED, COL_SPECIES,
  COL_THIS_MONTH, COL_YEAR_ROUND, FILE_STATUS_UNKNOWN, FILE_UNREADABLE_CELL, LAST_TODAY, LAST_YESTERDAY, LIVE_KIND,
  LIVE_NO_DATA_CELL, LIVE_SOURCE, LIVE_SOURCE_NO_KEY, NEEDS_KEY_CELL, NONE_IN_CHECKED, NOT_IN_FILE_RANGE,
  NOT_REPORTED, NO_DISTANCE, NO_EBIRD_FIGURE, NO_LOCATION, NO_REPORT_30, PCT_UNIT, PROBABILITY_KIND, RETRY,
  SORT_BUTTON_ALPHA, SORT_BUTTON_TAXONOMIC, SORT_NEEDS_KEY, SORT_NO_LIVE_DATA,
  SORT_UNAVAILABLE_NO_FILE, SWEEP_IDLE, SWEEP_OFFLINE_EMPTY, SWEEP_RESUME, TABLE_LABEL, breedingHasTail,
  liveSourceCached, mediaNeedsTail, milesText, needsFullYear, noFileCell, percentParts, probabilityNoFileSource,
  probabilitySource, probabilityTagSource, PROB_TAG_NO_FILE, reportedFull, reportedPartial, sweepComplete, sweepCooldown, sweepNoKey, sweepOffline,
  sweepPaused, sweepRunning, sweepUnanswered,
} from '../../lib/targets/targetsCopy'

const MEDIA_ICON: Record<MediaType, typeof Camera> = { Photo: Camera, Audio: Mic, Video }

/** What the probability columns can say for this county. */
export type ProbMode =
  | { kind: 'present'; years: readonly [number, number] | null; monthName: string; monthInRange: boolean; fullYear: boolean; monthsLabel: string; labelMonth: string; labelYear: string }
  | { kind: 'no-file' | 'unknown' | 'unreadable' | 'loading' }

/** What the live columns can say. */
export type LiveMode =
  | { kind: 'on'; partial: boolean; offlineFrom: number | null }
  | { kind: 'no-key' | 'no-data' }

export interface ListProps {
  county: string
  rows: readonly TargetRow[]
  badges: (row: TargetRow) => { lifer: boolean; media: boolean; breeding: boolean }
  threshold: 'any' | 'confirmed'
  /** Rows with a file row, by species code: false means "No eBird figure" (FR-34). */
  inFile: (code: string) => boolean
  prob: ProbMode
  live: LiveMode
  dates: readonly string[]
  days: ReadonlyMap<string, DayState>
  nowMs: number
  hasAnchor: boolean
  sort: TargetsSort
  availability: Record<TargetsSort, string | null>
  onSort: (s: TargetsSort) => void
  onOpenSpecies?: (name: string) => void
  /** Public-hotspot membership, from the parent's single `useHotspotSet()` call. */
  isHotspot: (locId: string | null | undefined) => boolean
  /** The sentence that replaces the table, or null to show the table. */
  empty: ReactNode | null
  showSweep: boolean
  sweep: SweepStatus
  onRetrySweep: () => void
}

function lastLabel(date: string, dates: readonly string[]): string {
  if (date === dates[0]) return LAST_TODAY
  if (date === dates[1]) return LAST_YESTERDAY
  return formatDate(date)
}

function timeOf(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

// ── The LIVE sweep band ──────────────────────────────────────────────────────

function SweepBand({ county, status, onRetry, shown }: { county: string; status: SweepStatus; onRetry: () => void; shown: boolean }) {
  let icon: ReactNode = null
  let text: ReactNode = null
  let key: string = status.kind
  let bar: number | null = null
  switch (status.kind) {
    case 'idle':
      icon = <Loader size={13} strokeWidth={2.2} aria-hidden="true" />
      text = SWEEP_IDLE
      break
    case 'no-key': {
      const c = sweepNoKey(county)
      icon = <Key size={13} strokeWidth={2.2} aria-hidden="true" />
      text = <><b>{c.strong}</b>{c.tail}</>
      break
    }
    case 'offline': {
      icon = <WifiOff size={13} strokeWidth={2.2} aria-hidden="true" />
      if (status.from === null) text = SWEEP_OFFLINE_EMPTY
      else { const c = sweepOffline(formatDate(new Date(status.from))); text = <><b>{c.strong}</b>{c.tail}</> }
      break
    }
    case 'sweeping': {
      const c = sweepRunning(status.checked, status.total)
      icon = <Loader size={13} strokeWidth={2.2} aria-hidden="true" />
      text = <>{c.lead}<b>{c.strong}</b>{c.tail}</>
      key = `sweeping-${status.checked}`
      bar = status.checked / status.total
      break
    }
    case 'cooldown': {
      const c = sweepCooldown(status.seconds, status.checked, status.total)
      icon = <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
      text = <><span className="sr-tg-warn">{c.warn}</span>{c.rest}<b>{c.strong}</b>{c.tail}</>
      key = `cooldown-${status.seconds}-${status.checked}`
      bar = status.checked / status.total
      break
    }
    case 'paused':
      icon = <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
      text = <>{sweepPaused(status.checked, status.total)} <Button type="button" className="sr-tg-link" onClick={onRetry}>{SWEEP_RESUME}</Button></>
      break
    case 'unanswered':
      icon = <Clock size={13} strokeWidth={2.2} aria-hidden="true" />
      text = <>{sweepUnanswered(status.checked, status.total, status.failed)}. <Button type="button" className="sr-tg-link" onClick={onRetry}>{RETRY}</Button></>
      break
    case 'complete':
      icon = <Check size={13} strokeWidth={2.2} aria-hidden="true" />
      text = sweepComplete(timeOf(status.at), status.total)
      break
  }
  // Always mounted, whether or not the band is shown: a status region created
  // with its first message is not announced (ui.md, v0.5.83 / v1.0.15). Until
  // the county's species list is in, the band is visually hidden (`sr-only`,
  // never `display: none`, which would take the region out of the tree) and its
  // region is EMPTY, so the first status after the list arrives is a mutation
  // of a region that already exists. The emission it shows is the sweep's
  // throttled snapshot, never a per-arrival figure.
  return (
    <div className={shown ? 'sr-tg-sweep' : 'sr-tg-sweep sr-only'}>
      {shown ? <span className="sr-tg-kind"><Radio size={13} strokeWidth={2.4} aria-hidden="true" />{LIVE_KIND}</span> : null}
      <div className="sr-tg-status" role="status">
        {shown ? <Fragment key={key}>{icon}{text}</Fragment> : null}
      </div>
      {shown && bar !== null ? (
        <div className="sr-tg-bar" aria-hidden="true"><i style={{ width: `${Math.round(bar * 100)}%` }} /></div>
      ) : null}
    </div>
  )
}

// ── Header ───────────────────────────────────────────────────────────────────

function SortHeader({ sortKey, label, name, p, note }: {
  sortKey: TargetsSort
  label: ReactNode
  name: string
  p: ListProps
  note?: string
}) {
  const reason = p.availability[sortKey]
  if (reason !== null) {
    return <><span>{label}</span>{note ? <span className="sr-tg-th-note">{note}</span> : null}</>
  }
  const active = p.sort === sortKey
  const Icon = !active ? ChevronsUpDown : (sortKey === 'distance' || sortKey === 'alpha' || sortKey === 'taxonomic' ? ArrowUp : ArrowDown)
  return (
    <Button type="button" className="sr-th-sort" data-active={active ? 'true' : undefined} aria-label={`Sort by ${name}`} onClick={() => p.onSort(sortKey)}>
      {label}<Icon size={11} strokeWidth={2.4} aria-hidden="true" />
    </Button>
  )
}

function ariaSort(p: ListProps, keys: readonly TargetsSort[]): 'ascending' | 'descending' | 'none' {
  if (!keys.includes(p.sort)) return 'none'
  return p.sort === 'freq-month' || p.sort === 'freq-year' || p.sort === 'live-days' ? 'descending' : 'ascending'
}

function Head(p: ListProps) {
  const probOn = p.prob.kind === 'present'
  const liveOn = p.live.kind === 'on'
  const probSource = p.prob.kind === 'present' ? probabilitySource(p.county, p.prob.years) : probabilityNoFileSource(p.county)
  const liveSource = p.live.kind === 'on'
    ? (p.live.offlineFrom !== null ? liveSourceCached(formatDate(new Date(p.live.offlineFrom))) : LIVE_SOURCE)
    : LIVE_SOURCE_NO_KEY
  const liveNote = p.live.kind === 'no-key' ? SORT_NEEDS_KEY : SORT_NO_LIVE_DATA
  const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)
  return (
    <thead role="rowgroup">
      <tr role="row" className="sr-tg-groups">
        <th role="columnheader" scope="col" rowSpan={2} style={{ verticalAlign: 'bottom' }} aria-sort={ariaSort(p, ['alpha', 'taxonomic'])}>
          <span>{COL_SPECIES}</span>
          <span className="sr-tg-th-sub">
            <SortHeader sortKey="alpha" label={SORT_BUTTON_ALPHA} name={SORT_LABELS.alpha} p={p} />
            <SortHeader sortKey="taxonomic" label={SORT_BUTTON_TAXONOMIC} name={SORT_LABELS.taxonomic} p={p} />
          </span>
        </th>
        <th role="columnheader" scope="colgroup" colSpan={probOn ? 2 : 1} className="sr-tg-k-prob">
          <span className="sr-tg-kind"><Percent size={13} strokeWidth={2.4} aria-hidden="true" />{PROBABILITY_KIND}</span>
          <span className="sr-tg-kind-sub">{probSource}</span>
        </th>
        <th role="columnheader" scope="colgroup" colSpan={liveOn ? 3 : 1} className="sr-tg-k-live">
          <span className="sr-tg-kind"><Radio size={13} strokeWidth={2.4} aria-hidden="true" />{LIVE_KIND}</span>
          <span className="sr-tg-kind-sub">{liveSource}</span>
        </th>
      </tr>
      <tr role="row" className="sr-tg-cols">
        {p.prob.kind === 'present' ? (
          <>
            <th role="columnheader" scope="col" className="sr-tg-k-prob" aria-sort={ariaSort(p, ['freq-month'])}>
              <SortHeader
                sortKey="freq-month"
                label={<>{COL_THIS_MONTH} <span className="sr-tg-unit">{PCT_UNIT}</span></>}
                name={`${SORT_LABELS['freq-month']}, ${p.prob.labelMonth}`}
                p={p}
                note={cap(p.availability['freq-month'] ?? '')}
              />
            </th>
            <th role="columnheader" scope="col" aria-sort={ariaSort(p, ['freq-year'])}>
              <SortHeader
                sortKey="freq-year"
                label={<>{COL_YEAR_ROUND} <span className="sr-tg-unit">{PCT_UNIT}</span></>}
                name={`${SORT_LABELS['freq-year']}, ${p.prob.labelYear}`}
                p={p}
                note={cap(p.availability['freq-year'] ?? '')}
              />
            </th>
          </>
        ) : (
          <th role="columnheader" scope="col" className="sr-tg-k-prob">
            <span>{COL_FREQUENCY} <span className="sr-tg-unit">{PCT_UNIT}</span></span>
            <span className="sr-tg-th-note">{SORT_UNAVAILABLE_NO_FILE}</span>
          </th>
        )}
        {liveOn ? (
          <>
            <th role="columnheader" scope="col" className="sr-tg-k-live" aria-sort={ariaSort(p, ['live-days'])}>
              <SortHeader sortKey="live-days" label={COL_REPORTED} name={SORT_LABELS['live-days']} p={p} note={cap(liveNote)} />
            </th>
            <th role="columnheader" scope="col">{COL_LAST_REPORT}</th>
            <th role="columnheader" scope="col" aria-sort={ariaSort(p, ['distance'])}>
              <SortHeader sortKey="distance" label={COL_DISTANCE} name={SORT_LABELS.distance} p={p} note={p.hasAnchor ? undefined : NO_LOCATION} />
            </th>
          </>
        ) : (
          <th role="columnheader" scope="col" className="sr-tg-k-live">
            <span>{COL_REPORTED}</span>
            <span className="sr-tg-th-note">{p.live.kind === 'no-key' ? cap(SORT_NEEDS_KEY) : cap(SORT_NO_LIVE_DATA)}</span>
          </th>
        )}
      </tr>
    </thead>
  )
}

// ── Rows ─────────────────────────────────────────────────────────────────────

function KindTag({ kind, source }: { kind: 'prob' | 'live'; source: string }) {
  return (
    <span className="sr-tg-kind-tag" aria-hidden="true">
      {kind === 'prob' ? <Percent size={11} strokeWidth={2.4} /> : <Radio size={11} strokeWidth={2.4} />}
      {kind === 'prob' ? PROBABILITY_KIND : LIVE_KIND}
      <span className="sr-tg-kind-src">{source}</span>
    </span>
  )
}

function Pct({ v, max }: { v: number; max: number }) {
  const parts = percentParts(v)
  const w = max > 0 ? Math.max(3, Math.round((v / max) * 100)) : 0
  return (
    <>
      <span className="sr-tg-pct">{parts.num}<span className="sr-tg-sign">{parts.sign}</span></span>
      <span className="sr-tg-share" aria-hidden="true"><i style={{ width: `${w}%` }} /></span>
    </>
  )
}

interface RowProps {
  row: TargetRow
  idx: number
  p: ListProps
  maxMonth: number
  maxYear: number
  probTag: string
  liveTag: string
}

function Row({ row, idx, p, maxMonth, maxYear, probTag, liveTag }: RowProps) {
  const b = p.badges(row)
  const openName = row.openName
  const onOpen = p.onOpenSpecies
  const name = (
    <td role="cell" className="sr-tg-name">
      <BirdName
        commonName={row.commonName}
        scientificName={row.sciName ?? undefined}
        taxonCode={row.speciesCode}
        hasEntry={!row.lifer && openName !== null && !!onOpen}
        onOpenSpecies={openName !== null && onOpen ? () => onOpen(openName) : undefined}
        showSci={!!row.sciName}
      />
      <span className="sr-tg-badges">
        {b.lifer ? <span className="sr-tg-badge sr-tg-badge--lifer"><Sparkles size={10} strokeWidth={2.4} aria-hidden="true" />{BADGE_LIFER}</span> : null}
        {b.media && row.missingMedia ? (
          <span className="sr-tg-badge">
            <Camera size={10} strokeWidth={2.4} aria-hidden="true" />{BADGE_MEDIA}
            <span className="sr-only">{mediaNeedsTail(row.missingMedia)}</span>
            <span className="sr-tg-badge-miss" aria-hidden="true">
              {row.missingMedia.map(t => { const I = MEDIA_ICON[t]; return <I key={t} size={10} strokeWidth={2.4} /> })}
            </span>
          </span>
        ) : null}
        {b.breeding ? (
          <span className="sr-tg-badge">
            <Egg size={10} strokeWidth={2.4} aria-hidden="true" />{BADGE_BREEDING}
            {p.threshold === 'confirmed' && row.codes.size > 0 ? <span className="sr-only">{breedingHasTail([...row.codes])}</span> : null}
          </span>
        ) : null}
      </span>
    </td>
  )

  let prob: ReactNode
  if (p.prob.kind === 'present') {
    const has = p.inFile(row.speciesCode)
    const month = !has ? <span className="sr-tg-na">{NO_EBIRD_FIGURE}</span>
      : !p.prob.monthInRange ? <span className="sr-tg-na">{NOT_IN_FILE_RANGE}</span>
      : row.monthPct === null ? <span className="sr-tg-na">{NO_EBIRD_FIGURE}</span>
      : <Pct v={row.monthPct} max={maxMonth} />
    const year = !has ? <span className="sr-tg-na">{NO_EBIRD_FIGURE}</span>
      : !p.prob.fullYear ? <span className="sr-tg-na">{needsFullYear(p.prob.monthsLabel)}</span>
      : row.yearPct === null ? <span className="sr-tg-na">{NO_EBIRD_FIGURE}</span>
      : <Pct v={row.yearPct} max={maxYear} />
    prob = (
      <>
        <td role="cell" className="sr-tg-k-prob sr-tg-month">
          <KindTag kind="prob" source={probTag} />
          <span className="sr-tg-cell-k">{`${COL_THIS_MONTH}, ${p.prob.monthName}`}</span>
          {month}
        </td>
        <td role="cell" className="sr-tg-year">
          <span className="sr-tg-cell-k">{COL_YEAR_ROUND}</span>
          {year}
        </td>
      </>
    )
  } else {
    const text = p.prob.kind === 'no-file' ? noFileCell(p.county)
      : p.prob.kind === 'unknown' ? FILE_STATUS_UNKNOWN
      : p.prob.kind === 'unreadable' ? FILE_UNREADABLE_CELL
      : NO_EBIRD_FIGURE
    prob = (
      <td role="cell" className="sr-tg-k-prob sr-tg-merged">
        <KindTag kind="prob" source={probTag} />
        <span className="sr-tg-cell-k">{COL_FREQUENCY}</span>
        <span className="sr-tg-na">{text}</span>
      </td>
    )
  }

  let live: ReactNode
  if (p.live.kind === 'on' && row.live) {
    const cell = row.live
    const partial = p.live.partial
    const sentence = partial ? reportedPartial(cell.daysReported, cell.checkedDays)
      : cell.daysReported === 0 ? null : reportedFull(cell.daysReported)
    const ticks: ReactNode[] = []
    for (let i = p.dates.length - 1; i >= 0; i--) {
      const checked = isChecked(p.days.get(p.dates[i]))
      const cls = !checked ? 'is-unk' : (cell.reported[i] ? 'is-on' : undefined)
      ticks.push(<i key={i} className={cls} />)
    }
    live = (
      <>
        <td role="cell" className="sr-tg-k-live sr-tg-days">
          <KindTag kind="live" source={liveTag} />
          <span className="sr-tg-cell-k">{COL_REPORTED}</span>
          <span className="sr-tg-live">
            {sentence
              ? <><span className="sr-tg-live-lead">{sentence.lead}</span><b>{sentence.count}</b>{sentence.tail}</>
              : <span className="sr-tg-live-lead">{NOT_REPORTED}</span>}
          </span>
          <span className="sr-tg-ticks" aria-hidden="true">{ticks}</span>
        </td>
        <td role="cell" className="sr-tg-last">
          <span className="sr-tg-cell-k">{COL_LAST_REPORT}</span>
          {cell.lastDate !== null ? (
            <>
              <span>{lastLabel(cell.lastDate, p.dates)}</span>
              {cell.place ? (
                // The block line stays the wrapper and keeps its shipped rule; a
                // public hotspot's name links to its eBird page inside it, and a
                // personal place (or a null id, or a Set not yet loaded) is the
                // same muted text it always was. Names WRAP, never truncate: eBird
                // puts what tells two hotspots apart at the end of the name.
                <span className="sr-tg-place">
                  <HotspotLink
                    locId={cell.locId ?? ''}
                    name={cell.place}
                    isHotspot={p.isHotspot(cell.locId)}
                    style={{ color: 'var(--sr-text-muted)' }}
                  />
                </span>
              ) : null}
            </>
          ) : <span className="sr-tg-na">{partial && cell.daysReported === 0 ? NONE_IN_CHECKED : NO_REPORT_30}</span>}
        </td>
        <td role="cell" className="sr-tg-distc">
          <span className="sr-tg-cell-k">{COL_DISTANCE}</span>
          {row.distanceMi !== null ? (
            <span className="sr-tg-dist">{milesText(row.distanceMi).value} <span className="sr-tg-dist-unit">{milesText(row.distanceMi).unit}</span></span>
          ) : <span className="sr-tg-na">{p.hasAnchor ? NO_DISTANCE : NO_LOCATION}</span>}
        </td>
      </>
    )
  } else {
    live = (
      <td role="cell" className="sr-tg-k-live sr-tg-merged">
        <KindTag kind="live" source={liveTag} />
        <span className="sr-tg-cell-k">{COL_REPORTED}</span>
        <span className="sr-tg-na">{p.live.kind === 'no-key' ? NEEDS_KEY_CELL : LIVE_NO_DATA_CELL}</span>
      </td>
    )
  }

  return <tr role="row" id={`tg-row-${idx}`}>{name}{prob}{live}</tr>
}

export function TargetsList(p: ListProps) {
  let maxMonth = 0
  let maxYear = 0
  for (const r of p.rows) {
    if (r.monthPct !== null && r.monthPct > maxMonth) maxMonth = r.monthPct
    if (r.yearPct !== null && r.yearPct > maxYear) maxYear = r.yearPct
  }
  const probTag = p.prob.kind === 'present' ? probabilityTagSource(p.prob.years) : PROB_TAG_NO_FILE
  const liveTag = p.live.kind === 'on' ? LIVE_SOURCE : (p.live.kind === 'no-key' ? NEEDS_KEY_CELL : LIVE_NO_DATA_CELL)
  return (
    <section className="sr-tg-list-card" aria-label={TABLE_LABEL}>
      <SweepBand county={p.county} status={p.sweep} onRetry={p.onRetrySweep} shown={p.showSweep} />
      {p.empty !== null ? (
        <div className="sr-tg-empty">{p.empty}</div>
      ) : (
        <div className="sr-scroll-x">
          <table className="sr-tg-table" role="table" aria-label={TABLE_LABEL}>
            <Head {...p} />
            <tbody role="rowgroup">
              {p.rows.map((row, idx) => (
                <Row key={row.speciesCode} row={row} idx={idx} p={p} maxMonth={maxMonth} maxYear={maxYear} probTag={probTag} liveTag={liveTag} />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
