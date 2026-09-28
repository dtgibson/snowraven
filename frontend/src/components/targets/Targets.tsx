// The Targets tab (targets-tab): one US county's species as a target list over
// the user's own record, ranked by eBird's historical probability from the
// county's bar-chart file or by what the eBird API reports now, with the two
// kinds kept visibly apart (pipeline/targets-tab/design-spec.md).
//
// THE LOAD GATE. `TabLoadErrorAlert` sits at fragment index 0 of EVERY render,
// gate and ready alike, so React reconciles it to the same DOM node across
// every phase and the region is in the accessibility tree before any message
// lands (ui.md, v1.0.15). A rejected file-status lookup is the load-error state
// with a retry, never the setup guidance (FR-09); no backup is the setup state.
//
// WHAT RENDERS BEFORE THE NETWORK. With the county's species list in the shared
// completeness store, the pool, every badge and the Alphabetical and Taxonomic
// sorts render before any request, with no key and offline (FR-12, FR-52). The
// pool fetch, the bar-chart file read and the live sweep each fill in on their
// own and none blocks a control (FR-59).
//
// Session state (toggles, sort, window, distance, and where distances are
// measured from) is plain `useState`: it survives leaving and returning to the
// tab and a county change, because tabs stay mounted, and resets on relaunch.
// Only the county is remembered (FR-08); the measuring point is never written
// to storage (FR-51a).

import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react'
import { Loader2, RefreshCw, Target } from 'lucide-react'
import { Button } from '../ui/Button'
import { SetupRequired } from '../SetupRequired'
import { TabLoadErrorAlert } from '../ui/TabLoadErrorAlert'
import { EBIRD_BACKUP_STEPS } from '../setupCopy'
import { storage } from '../../lib/storage'
import { useOnline } from '../../lib/useOnline'
import { isRegionCode } from '../../lib/regionCode'
import { useBarChartFilesEpoch } from '../../lib/useBarChartFilesEpoch'
import { monthRangeLabel } from '../../lib/barChart/barChartFilename'
import { joinBarChartToPool } from '../../lib/barChart/barChartJoin'
import { thisMonthPercent, yearRoundPercent } from '../../lib/barChart/barChartFrequency'
import type { CountyFC } from '../../lib/countyBoundaries'
import { buildCountyChoices, pickInitialCounty, type CountyChoice } from '../../lib/targets/targetsCounties'
import { classifyPool } from '../../lib/targets/targetsClassify'
import { DEFAULT_TOGGLES, rowBadges, visibleTargets, type TargetsToggles } from '../../lib/targets/targetsFilter'
import {
  deriveLive, distanceCell, hiddenByDistance, hiddenByWindow, windowFullyChecked,
} from '../../lib/targets/targetsLive'
import { effectiveSort, sortAvailability, sortRows, type TargetRow, type TargetsSort } from '../../lib/targets/targetsSort'
import { useTargetsRecord } from '../../lib/targets/useTargetsRecord'
import { useTargetsPool } from '../../lib/targets/useTargetsPool'
import { useBarChartFile } from '../../lib/targets/useBarChartFile'
import { useCountyDaySweep } from '../../lib/targets/useCountyDaySweep'
import { useDistanceAnchor } from '../../lib/targets/useDistanceAnchor'
import { listPlaces } from '../../lib/targets/targetsAnchor'
import {
  CONTROLS_LABEL, anchorName, COUNTY_GEOMETRY_FAILED, COUNTY_LABEL, DISTANCE_STOPS,
  MONTH_NAMES, NO_US_COUNTIES, POOL_NO_KEY, POOL_OFFLINE, RETRY, SETUP_BODY, SETUP_TITLE, TAB_DESCRIPTION, TAB_TITLE,
  TURN_ON_ONE, YEAR_ROUND, filteredEmpty, noTargets, poolFailed, poolLoading, poolLoadingEmpty, poolReady,
  probabilityLabel, type TypeCounts, type WindowKey,
} from '../../lib/targets/targetsCopy'
import { TargetsCountyPicker } from './TargetsCountyPicker'
import { TargetsControls } from './TargetsControls'
import { TargetsBarChartFile } from './TargetsBarChartFile'
import { TargetsList, type LiveMode, type ProbMode } from './TargetsList'
import type { ObservationEntry } from '../../types'
import type { TargetsRecord } from '../../lib/targets/targetsRecord'
import type { MediaState } from '../../lib/targets/useTargetsRecord'

export interface TargetsProps {
  onGoToSettings: () => void
  filesVersion?: number
  keysVersion?: number
  onOpenSpecies?: (commonName: string) => void
}

function checkedCount(s: { dates: readonly string[]; days: ReadonlyMap<string, unknown> }): number {
  let n = 0
  for (const d of s.dates) { const v = s.days.get(d); if (v !== undefined && v !== 'unchecked' && v !== 'failed') n += 1 }
  return n
}

/** The remembered county's settings key (FR-08): a preference, never derived data. */
const COUNTY_SETTING = 'targetsCounty'

export function Targets({ onGoToSettings, filesVersion, keysVersion, onOpenSpecies }: TargetsProps) {
  const { phase, retry } = useTargetsRecord(filesVersion)

  if (phase.tag !== 'ready') {
    return (
      <>
        <TabLoadErrorAlert
          message={phase.tag === 'error' ? phase.message : null}
          onGoToSettings={onGoToSettings}
          onRetry={retry}
        />
        {phase.tag === 'setup-required' ? (
          <SetupRequired title={SETUP_TITLE} body={SETUP_BODY} steps={EBIRD_BACKUP_STEPS} onGoToSettings={onGoToSettings} />
        ) : phase.tag === 'error' ? null : (
          <div role="status" aria-label="Loading saved eBird data" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden />
          </div>
        )}
      </>
    )
  }

  return (
    <>
      <TabLoadErrorAlert message={null} onGoToSettings={onGoToSettings} onRetry={retry} />
      <TargetsReady
        observations={phase.observations}
        record={phase.record}
        media={phase.media}
        onRetryRecord={retry}
        filesVersion={filesVersion}
        keysVersion={keysVersion}
        onOpenSpecies={onOpenSpecies}
      />
    </>
  )
}

interface ReadyProps {
  observations: readonly ObservationEntry[]
  record: TargetsRecord
  media: MediaState
  onRetryRecord: () => void
  filesVersion?: number
  keysVersion?: number
  onOpenSpecies?: (commonName: string) => void
}

type GeometryState = { status: 'loading' } | { status: 'ready'; fc: CountyFC } | { status: 'failed' }

function TargetsReady({ observations, record, media, onRetryRecord, filesVersion, keysVersion, onOpenSpecies }: ReadyProps) {
  const online = useOnline()

  // ── The key (FR-43: no eBird call without it) ──────────────────────────────
  const [hasEbirdKey, setHasEbirdKey] = useState<boolean | null>(null)
  useEffect(() => {
    let cancelled = false
    storage.getApiKey('ebird')
      .then(k => { if (!cancelled) setHasEbirdKey(!!k) })
      .catch(() => { if (!cancelled) setHasEbirdKey(false) })
    return () => { cancelled = true }
  }, [keysVersion])

  // ── The county geometry, reached through import() only ─────────────────────
  const [geometry, setGeometry] = useState<GeometryState>({ status: 'loading' })
  const [geometryNonce, setGeometryNonce] = useState(0)
  useEffect(() => {
    let cancelled = false
    import('../../lib/countyGeometry')
      .then(m => m.loadCountyGeometry())
      .then(fc => { if (!cancelled) setGeometry({ status: 'ready', fc }) })
      .catch(() => { if (!cancelled) setGeometry({ status: 'failed' }) })
    return () => { cancelled = true }
  }, [geometryNonce])
  const choices = useMemo(
    () => (geometry.status === 'ready' ? buildCountyChoices(observations, geometry.fc) : []),
    [geometry, observations],
  )

  // ── The county (FR-07, FR-08) ──────────────────────────────────────────────
  const [remembered, setRemembered] = useState<string | null | undefined>(undefined)
  useEffect(() => {
    let cancelled = false
    storage.getSetting<unknown>(COUNTY_SETTING)
      .then(v => { if (!cancelled) setRemembered(isRegionCode(v) ? v : null) })
      .catch(() => { if (!cancelled) setRemembered(null) })
    return () => { cancelled = true }
  }, [])
  const [chosen, setChosen] = useState<string | null>(null)
  const county: CountyChoice | null = useMemo(() => {
    if (remembered === undefined) return null
    if (chosen) {
      for (const c of choices) if (c.regionCode === chosen && c.unavailableReason === null) return c
    }
    return pickInitialCounty(choices, remembered)
  }, [choices, chosen, remembered])
  const regionCode = county?.regionCode ?? null
  const onSelectCounty = useCallback((c: CountyChoice) => {
    if (!c.regionCode) return
    setChosen(c.regionCode)
    void storage.setSetting(COUNTY_SETTING, c.regionCode).catch(() => { /* a preference: best-effort */ })
  }, [])

  // ── The three sources ──────────────────────────────────────────────────────
  const pool = useTargetsPool(regionCode, hasEbirdKey, online)
  const barChartEpoch = useBarChartFilesEpoch()
  const file = useBarChartFile(regionCode, barChartEpoch, filesVersion)
  const sweep = useCountyDaySweep(regionCode, hasEbirdKey, online)
  const anchor = useDistanceAnchor()

  // ── Session controls ───────────────────────────────────────────────────────
  const [toggles, setToggles] = useState<TargetsToggles>(DEFAULT_TOGGLES)
  const [chosenSort, setChosenSort] = useState<TargetsSort | null>(null)
  const [reportWindow, setReportWindow] = useState<WindowKey>('any')
  const [distanceIdx, setDistanceIdx] = useState(0)

  // ── Derivations ────────────────────────────────────────────────────────────
  const poolData = pool.state.status === 'ready' ? pool.state.data : null
  const classified = useMemo(() => (poolData ? classifyPool(poolData.species, record) : []), [poolData, record])
  const poolCodes = useMemo(() => new Set(classified.map(c => c.speciesCode)), [classified])
  const liveOn = sweep.hasData && hasEbirdKey !== false
  const cells = useMemo(
    () => (liveOn ? deriveLive(sweep.dates, sweep.days, poolCodes) : null),
    [liveOn, sweep.dates, sweep.days, poolCodes],
  )
  // "Places in this list" (FR-51a): from the live cells already derived, over
  // the whole pool, so it costs no request, works offline and grows as days land.
  const places = useMemo(() => listPlaces(cells), [cells])
  const fileState = file.state
  const join = useMemo(
    () => (fileState.status === 'present' && poolData ? joinBarChartToPool(fileState.file, poolData.species) : null),
    [fileState, poolData],
  )

  const month = new Date(sweep.nowMs).getMonth() + 1
  const range = fileState.status === 'present' ? fileState.range : null
  const monthsLabel = range ? monthRangeLabel(range.months) : ''
  const monthInRange = range ? range.months[month - 1] === true : false
  const fullYear = range ? range.fullYear : false
  const countyLabel = county?.label ?? ''
  const liveMissing: 'no-key' | 'no-data' = hasEbirdKey === false ? 'no-key' : 'no-data'
  const availability = sortAvailability({
    county: countyLabel,
    hasFile: fileState.status === 'present',
    monthInRange,
    fullYear,
    monthsLabel,
    liveAvailable: liveOn,
    liveMissing,
    hasAnchor: anchor.anchor !== null,
  })
  const sort = effectiveSort(chosenSort, availability)
  const distanceOn = liveOn && anchor.anchor !== null
  const stopMiles = distanceOn ? DISTANCE_STOPS[distanceIdx] : null
  const windowEff: WindowKey = liveOn ? reportWindow : 'any'
  const mediaAvailable = media === 'ok'

  const view = useMemo(() => {
    const base = visibleTargets(classified, toggles, mediaAvailable)
    const fullyChecked = cells ? windowFullyChecked(windowEff, sweep.dates, sweep.days, sweep.nowMs) : false
    const rows: TargetRow[] = []
    const counts: TypeCounts = { lifer: 0, media: 0, breeding: 0 }
    for (const c of base.rows) {
      const cell = cells ? cells.get(c.speciesCode) ?? null : null
      if (cell) {
        if (hiddenByWindow(cell, windowEff, fullyChecked, sweep.nowMs)) continue
        if (hiddenByDistance(cell, stopMiles, anchor.anchor, windowEff, fullyChecked, sweep.nowMs)) continue
      }
      const fileRow = join ? join.bySpeciesCode.get(c.speciesCode) : undefined
      const sampleSizes = fileState.status === 'present' ? fileState.file.sampleSizes : null
      rows.push({
        ...c,
        sciName: c.sciName ?? fileRow?.sciName ?? null,
        monthPct: fileRow && sampleSizes && monthInRange ? thisMonthPercent(fileRow, sampleSizes, month) : null,
        yearPct: fileRow && sampleSizes && fullYear ? yearRoundPercent(fileRow, sampleSizes) : null,
        live: cell,
        distanceMi: cell ? distanceCell(cell, anchor.anchor) : null,
      })
      const b = rowBadges(c, toggles, mediaAvailable)
      if (b.lifer) counts.lifer += 1
      if (b.media) counts.media += 1
      if (b.breeding) counts.breeding += 1
    }
    return { baseCount: base.rows.length, rows: sortRows(rows, sort), counts }
  }, [classified, toggles, mediaAvailable, cells, windowEff, sweep.dates, sweep.days, sweep.nowMs, stopMiles, anchor.anchor, join, fileState, monthInRange, fullYear, month, sort])

  // The summary's live twin advances once per distinct announcement.
  const summaryText = poolData ? `${view.rows.length}|${view.counts.lifer}|${view.counts.media}|${view.counts.breeding}` : ''
  const [summarySeq, setSummarySeq] = useState(0)
  const [lastSummary, setLastSummary] = useState('')
  if (summaryText !== lastSummary) {
    // A render-phase adjustment, not an effect: the new sequence commits with
    // the new text, so the keyed child is replaced exactly when the text changes.
    setLastSummary(summaryText)
    setSummarySeq(s => s + 1)
  }

  // ── Copy that depends on the state ─────────────────────────────────────────
  const anyToggle = toggles.lifer || (toggles.media && mediaAvailable) || toggles.breeding
  const typesOn = { lifer: toggles.lifer, media: toggles.media && mediaAvailable, breeding: toggles.breeding }
  let empty: ReactNode | null = null
  if (!poolData) {
    empty = pool.state.status === 'no-key' ? POOL_NO_KEY
      : pool.state.status === 'offline' ? POOL_OFFLINE
      : pool.state.status === 'failed'
        ? <>{poolFailed(pool.state.cause)} <Button type="button" className="sr-tg-link" onClick={pool.retry}>{RETRY}</Button></>
      : poolLoadingEmpty(countyLabel)
  } else if (!anyToggle) {
    empty = TURN_ON_ONE
  } else if (view.baseCount === 0) {
    empty = noTargets(typesOn, countyLabel, poolData.speciesCount)
  } else if (view.rows.length === 0) {
    empty = filteredEmpty(
      typesOn, countyLabel, windowEff,
      stopMiles !== null && anchor.kind !== null
        ? { miles: stopMiles, anchorName: anchorName(anchor.kind, anchor.name) ?? '' }
        : null,
    )
  }

  const monthName = MONTH_NAMES[month - 1]
  const prob: ProbMode = fileState.status === 'present'
    ? {
        kind: 'present', years: fileState.range.years, monthName, monthInRange, fullYear, monthsLabel,
        labelMonth: probabilityLabel(countyLabel, fileState.range.years, monthName),
        labelYear: probabilityLabel(countyLabel, fileState.range.years, YEAR_ROUND),
      }
    : { kind: fileState.status === 'absent' ? 'no-file' : fileState.status === 'unknown' ? 'unknown' : fileState.status === 'unreadable' ? 'unreadable' : 'loading' }
  const live: LiveMode = liveOn
    ? {
        kind: 'on',
        partial: checkedCount(sweep) < sweep.dates.length,
        offlineFrom: sweep.status.kind === 'offline' ? sweep.status.from : null,
      }
    : { kind: liveMissing }
  const sortSuffix: Record<TargetsSort, string> = {
    'freq-month': prob.kind === 'present' ? ` (${prob.labelMonth})` : '',
    'freq-year': prob.kind === 'present' ? ` (${prob.labelYear})` : '',
    'live-days': '', 'distance': '', 'alpha': '', 'taxonomic': '',
  }

  const poolStatus = !county ? null
    : pool.state.status === 'ready' ? poolReady(pool.state.data.speciesCount, countyLabel)
    : pool.state.status === 'loading' ? poolLoading(countyLabel)
    : pool.state.status === 'no-key' ? POOL_NO_KEY
    : pool.state.status === 'offline' ? POOL_OFFLINE
    : pool.state.status === 'failed' ? poolFailed(pool.state.cause)
    : null

  return (
    <div className="sr-tg">
      <div className="sr-tg-head">
        <div className="sr-tg-head-tile" aria-hidden="true"><Target size={16} strokeWidth={2.2} /></div>
        <div>
          <h2>{TAB_TITLE}</h2>
          <p>{TAB_DESCRIPTION}</p>
        </div>
      </div>

      <section className="sr-tg-strip sr-ctl-row" aria-label={CONTROLS_LABEL}>
        <div className="sr-tg-strip-row">
          <span className="sr-tg-label sr-ctl-label">{COUNTY_LABEL}</span>
          {geometry.status === 'failed' ? (
            <span className="sr-tg-status">
              {COUNTY_GEOMETRY_FAILED}{' '}
              <Button type="button" className="sr-tg-link" onClick={() => { setGeometry({ status: 'loading' }); setGeometryNonce(n => n + 1) }}>{RETRY}</Button>
            </span>
          ) : geometry.status === 'loading' || remembered === undefined ? (
            <span className="sr-tg-status" role="status"><Loader2 size={13} strokeWidth={2.2} className="spin" aria-hidden="true" /></span>
          ) : choices.length === 0 || !county ? (
            <span className="sr-tg-status">{NO_US_COUNTIES}</span>
          ) : (
            <>
              <TargetsCountyPicker choices={choices} selected={county} onSelect={onSelectCounty} />
              <span className="sr-tg-status" role="status">
                {poolStatus}
                {pool.state.status === 'failed' ? <> <Button type="button" className="sr-tg-link" onClick={pool.retry}><RefreshCw size={12} strokeWidth={2.2} aria-hidden="true" />{RETRY}</Button></> : null}
              </span>
            </>
          )}
        </div>
        {county ? (
          <TargetsControls
            toggles={toggles}
            onToggles={setToggles}
            media={media}
            onRetryMedia={onRetryRecord}
            summary={poolData ? { total: view.rows.length, counts: view.counts } : null}
            summarySeq={summarySeq}
            sort={sort}
            sortSuffix={sortSuffix}
            availability={availability}
            onSort={setChosenSort}
            window={windowEff}
            onWindow={setReportWindow}
            liveOn={liveOn}
            liveMissing={liveMissing}
            distanceIdx={distanceIdx}
            onDistance={setDistanceIdx}
            distanceOn={distanceOn}
            anchor={anchor}
            places={places}
          />
        ) : null}
      </section>

      {county && regionCode ? (
        <>
          <TargetsBarChartFile regionCode={regionCode} county={countyLabel} state={fileState} join={join} onRetry={file.retry} />
          <TargetsList
            county={countyLabel}
            rows={view.rows}
            badges={row => rowBadges(row, toggles, mediaAvailable)}
            threshold={toggles.threshold}
            inFile={code => join !== null && join.bySpeciesCode.has(code)}
            prob={prob}
            live={live}
            dates={sweep.dates}
            days={sweep.days}
            nowMs={sweep.nowMs}
            hasAnchor={anchor.anchor !== null}
            sort={sort}
            availability={availability}
            onSort={setChosenSort}
            onOpenSpecies={onOpenSpecies}
            empty={empty}
            showSweep={poolData !== null}
            sweep={sweep.status}
            onRetrySweep={sweep.retry}
          />
        </>
      ) : null}
    </div>
  )
}
