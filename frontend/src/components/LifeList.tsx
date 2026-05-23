import { useEffect, useMemo, useState } from 'react'
import { Loader2, AlertCircle, Camera, Mic, Video, MapPin, Calendar } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import type { LifeListEntry } from '../lib/parseLifeList'
import { parseMLExport, aggregateMLRows } from '../lib/parseMLExport'
import type { MLExportRow } from '../lib/parseMLExport'
import { parseEbirdObservations } from '../lib/parseEbirdObservations'
import { normalizeSpeciesName, isSpuhOrSlash } from '../lib/speciesUtils'
import { LifeListTable } from './LifeListTable'
import type { MediaFilterState, SortState, DateRangeState, ObservationEntry } from '../types'
import { MEDIA_FILTER_CLEAR, DATE_RANGE_CLEAR } from '../types'

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; entries: LifeListEntry[]; mediaMap: Record<string, string>; hasEbirdBackbone: boolean }

function buildComprehensiveEntries(
  ebirdObs: ObservationEntry[],
  mlRows: MLExportRow[],
  mergeSubspecies: boolean,
): LifeListEntry[] {
  const ebirdMap = new Map<string, { sci: string }>()
  for (const o of ebirdObs) {
    const name = mergeSubspecies ? normalizeSpeciesName(o.commonName) : o.commonName
    if (!ebirdMap.has(name)) ebirdMap.set(name, { sci: o.scientificName })
  }

  const ebirdNormalizedSet = new Set<string>()
  for (const o of ebirdObs) ebirdNormalizedSet.add(normalizeSpeciesName(o.commonName))

  const mlCatalogMap = new Map<string, Set<string>>()
  const mlSciMap = new Map<string, string>()
  for (const r of mlRows) {
    const s = mlCatalogMap.get(r.commonName)
    if (s) s.add(r.catalogId)
    else mlCatalogMap.set(r.commonName, new Set([r.catalogId]))
    if (!mlSciMap.has(r.commonName)) mlSciMap.set(r.commonName, r.scientificName)
  }

  const entries: LifeListEntry[] = []

  for (const [displayName, data] of ebirdMap) {
    const lookupName = mergeSubspecies ? displayName : normalizeSpeciesName(displayName)
    const catalogIds = [...(mlCatalogMap.get(lookupName) ?? [])]
    entries.push({
      commonName: displayName,
      scientificName: data.sci,
      taxonomicOrder: Infinity,
      catalogIds,
      isNonBird: false,
    })
  }

  for (const [mlName, catalogIds] of mlCatalogMap) {
    if (!ebirdNormalizedSet.has(mlName)) {
      entries.push({
        commonName: mlName,
        scientificName: mlSciMap.get(mlName) ?? '',
        taxonomicOrder: Infinity,
        catalogIds: [...catalogIds],
        isNonBird: true,
      })
    }
  }

  return entries
}

function ToggleSwitch({ label, checked, onChange }: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 7,
        height: 30, padding: '0 10px 0 8px', borderRadius: 6,
        border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
        cursor: 'pointer', fontFamily: 'inherit', fontSize: 12, fontWeight: 500,
        color: 'var(--sr-text-muted)',
      }}
    >
      <div style={{
        width: 28, height: 16, borderRadius: 8, flexShrink: 0, position: 'relative',
        background: checked ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
        transition: 'background 0.15s',
      }}>
        <div style={{
          width: 12, height: 12, borderRadius: '50%',
          background: 'white',
          position: 'absolute', top: 2,
          left: checked ? 14 : 2,
          transition: 'left 0.15s',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)',
        }} />
      </div>
      {label}
    </button>
  )
}

function parseMLUserId(filename: string): string | null {
  const match = filename.match(/^ML__.*_([A-Za-z0-9]+)\.csv$/i)
  return match ? match[1] : null
}

function detectFileType(text: string): 'ml-export' | 'ebird' | 'unknown' {
  const firstLine = (text.split(/\r?\n/)[0] ?? '').toLowerCase()
  const hasCatalogNumber = firstLine.includes('catalog number')
  const hasFormat = firstLine.includes('format')
  if (hasCatalogNumber && hasFormat) return 'ml-export'
  if (firstLine.includes('submission id')) return 'ebird'
  return 'unknown'
}

function pillStyle(active: 'none' | 'positive' | 'negative'): React.CSSProperties {
  const base: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 5,
    height: 30,
    padding: '0 12px',
    borderRadius: 6,
    fontSize: 12,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }
  if (active === 'positive') return { ...base, border: '1.5px solid var(--sr-accent-border)', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }
  if (active === 'negative') return { ...base, border: '1.5px solid var(--sr-error-overlay)', background: 'var(--sr-error-bg)', color: 'var(--sr-error)' }
  return { ...base, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
}

function ghostBtn(active = false): React.CSSProperties {
  return {
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    fontSize: 11,
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: active ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
    background: active ? 'var(--sr-accent-bg)' : 'none',
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    whiteSpace: 'nowrap' as const,
  }
}

export function LifeList({ onGoToSettings, requestedFilter, onRequestedFilterConsumed }: {
  onGoToSettings: () => void
  requestedFilter?: 'is-target'
  onRequestedFilterConsumed?: () => void
}) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [filter, setFilter] = useState<MediaFilterState>(MEDIA_FILTER_CLEAR)
  const [sort, setSort] = useState<SortState>({ column: 'name', dir: 'asc', nameSortMode: 'az' })
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [wideMode, setWideMode] = useState(false)
  const [rawRows, setRawRows] = useState<MLExportRow[]>([])
  const [rawEbirdObs, setRawEbirdObs] = useState<ObservationEntry[]>([])
  const [mergeSubspecies, setMergeSubspecies] = useState(true)
  const [showSpuh, setShowSpuh] = useState(false)
  const [showNonBird, setShowNonBird] = useState(false)
  const [filterHasMedia, setFilterHasMedia] = useState(false)
  const [filterIsTarget, setFilterIsTarget] = useState(false)
  const [countyResolution, setCountyResolution] = useState<'idle' | 'resolving' | 'done'>('idle')
  const [countyFilter, setCountyFilter] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<DateRangeState>(DATE_RANGE_CLEAR)

  useEffect(() => {
    if (requestedFilter === 'is-target') {
      setFilterIsTarget(true)
      onRequestedFilterConsumed?.()
    }
  }, [requestedFilter, onRequestedFilterConsumed])

  const fetchTaxonCodes = async (entries: LifeListEntry[]) => {
    try {
      const res = await fetch('/taxonomy/codes', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          species: entries.map(e => ({ commonName: e.commonName, scientificName: e.scientificName })),
        }),
      })
      if (!res.ok) return
      const data = await res.json()
      setTaxonMap(data.codes ?? {})
      setTaxonOrders(data.orders ?? {})
    } catch {
      // silently fail — links fall back to taxaName, sort falls back to A–Z
    }
  }

  const resolveMLCounties = async (initialRows: MLExportRow[], preloadedEbirdObs?: ObservationEntry[]) => {
    setCountyResolution('resolving')
    const rows = initialRows.map(r => ({ ...r }))

    // Pass 2: cross-reference eBird backup (use pre-loaded obs if available)
    try {
      let ebirdObs: ObservationEntry[] | null = preloadedEbirdObs ?? null
      if (!ebirdObs) {
        const statusRes = await fetch('/settings/files')
        if (statusRes.ok) {
          const status = await statusRes.json()
          if (status.ebird) {
            const ebirdRes = await fetch('/settings/files/ebird')
            if (ebirdRes.ok) {
              const ebirdText = await ebirdRes.text()
              ebirdObs = parseEbirdObservations(ebirdText)
            }
          }
        }
      }
      if (ebirdObs) {
        const locationCounty = new Map<string, string>()
        for (const o of ebirdObs) {
          if (o.county && o.location && !locationCounty.has(o.location)) {
            locationCounty.set(o.location, o.county)
          }
        }
        for (const row of rows) {
          if (row.county === null && row.location) {
            const c = locationCounty.get(row.location)
            if (c) row.county = c
          }
        }
      }
    } catch {
      // silently continue to Pass 3
    }

    // Pass 3: Nominatim for rows still missing county
    const needsNominatim = rows.filter(r => r.county === null && r.latitude !== null && r.longitude !== null)
    if (needsNominatim.length > 0) {
      const seen = new Map<string, { lat: number; lng: number }>()
      for (const r of needsNominatim) {
        const key = `${Math.round(r.latitude! * 10000)},${Math.round(r.longitude! * 10000)}`
        if (!seen.has(key)) seen.set(key, { lat: r.latitude!, lng: r.longitude! })
      }
      try {
        const res = await fetch('/nominatim/counties', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ locations: [...seen.values()] }),
        })
        if (res.ok) {
          const data = await res.json()
          const byKey = new Map<string, string | null>()
          for (const result of data.results) {
            const key = `${Math.round(result.lat * 10000)},${Math.round(result.lng * 10000)}`
            byKey.set(key, result.county ?? null)
          }
          for (const row of rows) {
            if (row.county === null && row.latitude !== null && row.longitude !== null) {
              const key = `${Math.round(row.latitude * 10000)},${Math.round(row.longitude * 10000)}`
              const c = byKey.get(key)
              if (c) row.county = c
            }
          }
        }
      } catch {
        // silently fail — entries remain with null county
      }
    }

    setRawRows(rows)
    setCountyResolution('done')
  }

  // Derived filter data (computed at top level to satisfy hooks rules)
  const availableCounties = useMemo(() => {
    const set = new Set<string>()
    for (const row of rawRows) {
      if (row.county) set.add(row.county)
    }
    return [...set].sort()
  }, [rawRows])

  const filteredRows = useMemo(() => {
    if (countyFilter === null && !dateRange.from && !dateRange.to) return rawRows
    return rawRows.filter(row => {
      if (countyFilter !== null && row.county !== countyFilter) return false
      if (dateRange.from && row.date < dateRange.from) return false
      if (dateRange.to && row.date > dateRange.to) return false
      return true
    })
  }, [rawRows, countyFilter, dateRange])

  const hasLocationFilter = countyFilter !== null || !!dateRange.from || !!dateRange.to

  const phaseEntries = useMemo(
    () => (phase.tag === 'ready' ? phase.entries : []),
    [phase]
  )

  const displayEntries = useMemo((): LifeListEntry[] => {
    const hasEbird = phase.tag === 'ready' && phase.hasEbirdBackbone

    let base: LifeListEntry[]

    if (hasEbird && rawEbirdObs.length > 0) {
      const filtEbird = hasLocationFilter
        ? rawEbirdObs.filter(o => {
            if (countyFilter !== null && o.county !== countyFilter) return false
            if (dateRange.from && o.date < dateRange.from) return false
            if (dateRange.to && o.date > dateRange.to) return false
            return true
          })
        : rawEbirdObs
      const filtML = hasLocationFilter ? filteredRows : rawRows
      base = buildComprehensiveEntries(filtEbird, filtML, mergeSubspecies)
    } else if (hasLocationFilter && rawRows.length > 0) {
      base = aggregateMLRows(filteredRows)
    } else {
      base = phaseEntries
    }

    return base.filter(e => {
      if (!showSpuh && isSpuhOrSlash(e.commonName)) return false
      if (!showNonBird && e.isNonBird) return false
      return true
    })
  }, [phase, rawEbirdObs, rawRows, filteredRows, phaseEntries, countyFilter, dateRange,
      mergeSubspecies, showSpuh, showNonBird, hasLocationFilter])

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      try {
        const statusRes = await fetch('/settings/files')
        if (!statusRes.ok || cancelled) { setPhase({ tag: 'setup-required' }); return }
        const status = await statusRes.json()
        if (!status.ml) { setPhase({ tag: 'setup-required' }); return }

        const [mlRes, ebirdRes] = await Promise.all([
          status.ml ? fetch('/settings/files/ml') : Promise.resolve(null),
          status.ebird ? fetch('/settings/files/ebird') : Promise.resolve(null),
        ])
        if (cancelled) return

        let entries: LifeListEntry[] = []
        let mediaMap: Record<string, string> = {}
        let rows: MLExportRow[] = []
        let hasEbirdBackbone = false
        let ebirdObs: ObservationEntry[] = []

        if (mlRes?.ok) {
          const mlText = await mlRes.text()
          if (detectFileType(mlText) === 'ml-export') {
            const parsed = parseMLExport(mlText)
            entries = parsed.entries
            mediaMap = parsed.mediaMap
            rows = parsed.rows
            setMlUserId(parseMLUserId(status.ml.filename))
            setRawRows(rows)
          }
        }

        if (ebirdRes?.ok) {
          const ebirdText = await ebirdRes.text()
          ebirdObs = parseEbirdObservations(ebirdText)
          setRawEbirdObs(ebirdObs)
          hasEbirdBackbone = true
        }

        if (cancelled) return

        setPhase({ tag: 'ready', entries, mediaMap, hasEbirdBackbone })

        const comprehensiveEntries = hasEbirdBackbone
          ? buildComprehensiveEntries(ebirdObs, rows, true)
          : entries
        fetchTaxonCodes(comprehensiveEntries)
        resolveMLCounties(rows, ebirdObs.length > 0 ? ebirdObs : undefined)
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [])

  // ── Auto-loading saved file ───────────────────────────────────────────────
  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} />
      </div>
    )
  }

  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="Macaulay Library Export Required"
        body="The Media Life List loads automatically from your stored ML export. You haven't saved one yet."
        steps={[
          <>Go to <strong>macaulaylibrary.org</strong> → My Media</>,
          <>Click <strong>Save Spreadsheet</strong> — do not rename the downloaded file</>,
          <>Upload it in <strong>Settings → Default Files → ML Export</strong></>,
          <>This tab loads automatically on every visit from then on</>,
        ]}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8,
          fontSize: 13, color: 'var(--sr-error)', maxWidth: 480,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          {phase.message}
        </div>
        <button
          onClick={onGoToSettings}
          style={{
            height: 32, padding: '0 14px', borderRadius: 6,
            border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
            color: 'var(--sr-text-muted)', fontSize: 12, fontWeight: 500,
            fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          Go to Settings
        </button>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────
  const { mediaMap, hasEbirdBackbone } = phase

  const mediaFilteredEntries = filterHasMedia
    ? displayEntries.filter(e => e.catalogIds.some(id => mediaMap[id] === 'Photo' || mediaMap[id] === 'Audio' || mediaMap[id] === 'Video'))
    : displayEntries

  const isTargetFilteredEntries = filterIsTarget
    ? mediaFilteredEntries.filter(e => {
        const photo = e.catalogIds.some(id => mediaMap[id] === 'Photo')
        const audio = e.catalogIds.some(id => mediaMap[id] === 'Audio')
        const video = e.catalogIds.some(id => mediaMap[id] === 'Video')
        return !photo || !audio || !video
      })
    : mediaFilteredEntries

  const isFilterClear = !filter.photo && !filter.audio && !filter.video && !filterHasMedia && !filterIsTarget

  const filteredCount = isTargetFilteredEntries.filter(entry => {
    const photo = entry.catalogIds.some(id => mediaMap[id] === 'Photo')
    const audio = entry.catalogIds.some(id => mediaMap[id] === 'Audio')
    const video = entry.catalogIds.some(id => mediaMap[id] === 'Video')
    if (filter.photo === 'has' && !photo) return false
    if (filter.photo === 'no' && photo) return false
    if (filter.audio === 'has' && !audio) return false
    if (filter.audio === 'no' && audio) return false
    if (filter.video === 'has' && !video) return false
    if (filter.video === 'no' && video) return false
    return true
  }).length

  const totalSpecies = displayEntries.length
  const countLabel = (isFilterClear && !hasLocationFilter)
    ? `${displayEntries.length} species`
    : `${filteredCount} of ${totalSpecies} species`

  function formatDateLabel(d: string): string {
    if (!d) return ''
    const [y, m, day] = d.split('-').map(Number)
    const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec']
    return `${months[(m ?? 1) - 1]} ${day}, ${y}`
  }

  const filterStripText = (() => {
    const parts: string[] = []
    if (countyFilter) parts.push(countyFilter)
    if (dateRange.from && dateRange.to) parts.push(`${formatDateLabel(dateRange.from)} – ${formatDateLabel(dateRange.to)}`)
    else if (dateRange.from) parts.push(`From ${formatDateLabel(dateRange.from)}`)
    else if (dateRange.to) parts.push(`Through ${formatDateLabel(dateRange.to)}`)
    parts.push(`${filteredCount} of ${totalSpecies} species`)
    return parts.join(' · ')
  })()

  function toggleDimension(dim: 'photo' | 'audio' | 'video', val: 'has' | 'no') {
    setFilter(prev => {
      if (prev[dim] === val) return { ...prev, [dim]: null }
      return { ...prev, [dim]: val }
    })
  }

  const pillSep: React.CSSProperties = {
    width: 1, height: 20, background: 'var(--sr-border)', flexShrink: 0, alignSelf: 'center',
  }

  function sortToggleBtn(active: boolean): React.CSSProperties {
    return {
      height: 30,
      padding: '0 13px',
      border: 'none',
      background: active ? 'var(--sr-accent-bg)' : 'transparent',
      color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
      fontSize: 12,
      fontWeight: 500,
      fontFamily: 'inherit',
      cursor: 'pointer',
      whiteSpace: 'nowrap' as const,
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {mlUserId === null && rawRows.length > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '9px 13px', background: 'var(--sr-warning-bg)',
          border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
          fontSize: 13, color: 'var(--sr-warning)', marginBottom: 12, flexShrink: 0,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Media links could not be personalised — the CSV filename was not in the default Macaulay Library format. Links will open the general catalog search instead.
        </div>
      )}

      {/* Controls row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Filter pills */}
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button style={pillStyle(isFilterClear ? 'positive' : 'none')} onClick={() => { setFilter(MEDIA_FILTER_CLEAR); setFilterHasMedia(false); setFilterIsTarget(false) }}>All</button>
          <button style={pillStyle(filterHasMedia ? 'positive' : 'none')} onClick={() => setFilterHasMedia(v => !v)}>Has media</button>
          <button
            style={filterIsTarget ? {
              ...pillStyle('none'),
              background: 'var(--sr-is-target-bg)', color: 'var(--sr-is-target-text)',
              border: '1.5px solid var(--sr-is-target-border)', fontWeight: 600,
            } : pillStyle('none')}
            onClick={() => setFilterIsTarget(v => !v)}
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="12" cy="12" r="10"/><circle cx="12" cy="12" r="3"/></svg>
            Is Target
          </button>

          <div style={pillSep} />

          <button style={pillStyle(filter.photo === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('photo', 'no')}>
            <Camera size={11} strokeWidth={2.5} />No photo
          </button>
          <button style={pillStyle(filter.audio === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('audio', 'no')}>
            <Mic size={11} strokeWidth={2.5} />No audio
          </button>
          <button style={pillStyle(filter.video === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('video', 'no')}>
            <Video size={11} strokeWidth={2.5} />No video
          </button>

          <div style={pillSep} />

          <button style={pillStyle(filter.photo === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('photo', 'has')}>
            <Camera size={11} strokeWidth={2.5} />Has photo
          </button>
          <button style={pillStyle(filter.audio === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('audio', 'has')}>
            <Mic size={11} strokeWidth={2.5} />Has audio
          </button>
          <button style={pillStyle(filter.video === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('video', 'has')}>
            <Video size={11} strokeWidth={2.5} />Has video
          </button>

          <div style={pillSep} />

          {/* A–Z / Taxonomic sort toggle */}
          <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <button
              style={{ ...sortToggleBtn(sort.nameSortMode === 'az'), borderRight: '1.5px solid var(--sr-accent-border)' }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })}
            >
              A–Z
            </button>
            <button
              style={sortToggleBtn(sort.nameSortMode === 'taxonomic')}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'taxonomic' })}
            >
              Taxonomic
            </button>
          </div>

          <div style={pillSep} />

          <ToggleSwitch
            label="Show subspecies"
            checked={!mergeSubspecies}
            onChange={() => setMergeSubspecies(v => !v)}
          />
          <ToggleSwitch
            label="Show sp./slash"
            checked={showSpuh}
            onChange={() => setShowSpuh(v => !v)}
          />
          {hasEbirdBackbone && (
            <ToggleSwitch
              label="Show non-bird"
              checked={showNonBird}
              onChange={() => setShowNonBird(v => !v)}
            />
          )}

          <div style={pillSep} />

          {/* County dropdown */}
          {countyResolution === 'resolving' ? (
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 5, border: '1.5px dashed var(--sr-border)', background: 'var(--sr-surface-subtle)', color: 'var(--sr-text-disabled)', fontSize: 12 }}>
              <Loader2 size={11} strokeWidth={2} className="spin" />
              Resolving counties…
            </div>
          ) : (
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <MapPin size={12} strokeWidth={2} style={{
                position: 'absolute', left: 7, color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                pointerEvents: 'none', flexShrink: 0,
              }} />
              <select
                value={countyFilter ?? ''}
                onChange={e => setCountyFilter(e.target.value || null)}
                style={{
                  height: 26, paddingLeft: 24, paddingRight: 22, borderRadius: 5,
                  border: countyFilter
                    ? '1.5px solid var(--sr-accent-border-strong)'
                    : '1.5px solid var(--sr-border)',
                  background: countyFilter ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                  color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  fontSize: 12, fontWeight: 500, fontFamily: 'inherit',
                  cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none',
                }}
              >
                <option value="">All Counties</option>
                {availableCounties.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)', fontSize: 9 }}>▾</span>
            </div>
          )}

          {/* Date range */}
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Calendar size={11} strokeWidth={2} style={{
                position: 'absolute', left: 7, color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                pointerEvents: 'none',
              }} />
              <input
                type="date"
                value={dateRange.from}
                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                style={{
                  height: 26, paddingLeft: 24, paddingRight: 6, borderRadius: 5,
                  border: dateRange.from ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                  background: dateRange.from ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                  color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-disabled)',
                  fontSize: 12, fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>→</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              style={{
                height: 26, paddingLeft: 8, paddingRight: 6, borderRadius: 5,
                border: dateRange.to ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                background: dateRange.to ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                color: dateRange.to ? 'var(--sr-accent)' : 'var(--sr-text-disabled)',
                fontSize: 12, fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>
        </div>

        {/* Right controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>{countLabel}</span>
          <button
            style={ghostBtn(wideMode)}
            onClick={() => setWideMode(w => !w)}
            title={wideMode ? 'Collapse table into scroll box' : 'Expand table — scroll the whole page on mobile'}
          >
            {wideMode ? '↔ Normal' : '↔ Unbounded'}
          </button>
        </div>
      </div>

      {hasLocationFilter && (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '7px 12px', marginBottom: 8,
          background: 'var(--sr-accent-bg)', borderRadius: 6,
          fontSize: 12, color: 'var(--sr-accent)', flexShrink: 0,
        }}>
          <span style={{ fontWeight: 500 }}>{filterStripText}</span>
          <button
            onClick={() => { setCountyFilter(null); setDateRange(DATE_RANGE_CLEAR) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer',
              fontSize: 12, color: 'var(--sr-accent)', fontFamily: 'inherit',
              padding: 0, textDecoration: 'underline',
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      <LifeListTable
        entries={isTargetFilteredEntries}
        mediaMap={mediaMap}
        filter={filter}
        sort={sort}
        onSortChange={setSort}
        userId={mlUserId}
        taxonMap={taxonMap}
        taxonOrders={taxonOrders}
        wideMode={wideMode}
      />
    </div>
  )
}
