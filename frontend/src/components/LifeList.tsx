import { useEffect, useId, useMemo, useState } from 'react'
import { Loader2, AlertCircle, Camera, Mic, Video, MapPin, Calendar, MessageSquare, ChevronDown, Pin } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { ML_EXPORT_STEPS } from './setupCopy'
import { ToggleSwitch } from './ui/ToggleSwitch'
import { formatDate as formatDateLabel } from '../lib/formatDate'
import type { LifeListEntry } from '../lib/parseLifeList'
import { parseMLExport, aggregateMLRows } from '../lib/parseMLExport'
import type { MLExportRow } from '../lib/parseMLExport'
import { assetMatchesFacet, buildCatalogAgeSex } from '../lib/mediaStats'
import type { AgeClass, Sex } from '../lib/mediaStats'
import { loadEbirdObservations } from '../lib/observationsCache'
import { normalizeSpeciesName, isNonCountableForm } from '../lib/speciesUtils'
import { SHOW_FORMS_TOGGLE_LABEL } from '../lib/countabilityCopy'
import { LifeListTable } from './LifeListTable'
import { MediaCommentsSection } from './MediaCommentsSection'
import { hasMediaComment } from '../lib/mediaComments'
import { smoothScrollIntoView } from '../lib/scroll'
import type { MediaFilterState, SortState, DateRangeState, ObservationEntry } from '../types'
import { MEDIA_FILTER_CLEAR, DATE_RANGE_CLEAR } from '../types'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'
import { nextPinnedState, nextViewState } from '../lib/pinnedLabels'
import type { PinnedLabelsTransition } from '../lib/pinnedLabels'

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
  // `countable` is a monotone OR over the RAW names behind each display key. It has
  // to be decided here, from `o.commonName`, because under "Show subspecies" off the
  // key is the normalized base and the form the rule judges is already gone from it.
  const ebirdMap = new Map<string, { sci: string; countable: boolean }>()
  for (const o of ebirdObs) {
    const name = mergeSubspecies ? normalizeSpeciesName(o.commonName) : o.commonName
    const countable = !isNonCountableForm(o.commonName)
    const existing = ebirdMap.get(name)
    if (!existing) ebirdMap.set(name, { sci: o.scientificName, countable })
    else if (countable) existing.countable = true
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
      nonCountable: !data.countable,
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
    fontSize: '0.75rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const,
  }
  if (active === 'positive') return { ...base, border: '1.5px solid var(--sr-accent-border)', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }
  if (active === 'negative') return { ...base, border: '1.5px solid var(--sr-error-overlay)', background: 'var(--sr-error-bg)', color: 'var(--sr-error)' }
  return { ...base, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)' }
}

// Shown while the column headings are pinned. The Breeding Codes note's twin, in
// the same two-sentence shape: what holds still, then the view coupling, naming
// the shipped view control by its shipped label ("Unbounded") so the sentence and
// the button agree. No em dashes (standing copy rule).
const PIN_NOTE = 'Column headings stay at the top while you scroll. Pinning uses the Unbounded view, so the table scrolls with the page.'

function ghostBtn(active = false): React.CSSProperties {
  return {
    height: 28,
    padding: '0 10px',
    borderRadius: 6,
    fontSize: '0.6875rem',
    fontWeight: 500,
    fontFamily: 'inherit',
    cursor: 'pointer',
    border: active ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
    background: active ? 'var(--sr-accent-bg)' : 'none',
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    whiteSpace: 'nowrap' as const,
  }
}

// Sex/Age facet dropdowns — styled to match the County <select> on this tab
// (design-system categorical-filter pattern); accent when a facet is active.
function facetSelectStyle(active: boolean): React.CSSProperties {
  return {
    minHeight: '1.75rem', paddingLeft: 10, paddingRight: 22, borderRadius: 5,
    border: active ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
    background: active ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
    color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
    fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
    cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
  }
}
function facetChevStyle(active: boolean): React.CSSProperties {
  return { position: 'absolute', right: 6, pointerEvents: 'none', color: active ? 'var(--sr-accent)' : 'var(--sr-text-muted)', fontSize: '0.5625rem' }
}

export function LifeList({ onGoToSettings, requestedFilter, onRequestedFilterConsumed, filesVersion, onOpenSpecies }: {
  onGoToSettings: () => void
  requestedFilter?: 'is-target'
  onRequestedFilterConsumed?: () => void
  filesVersion?: number
  onOpenSpecies?: (commonName: string) => void
}) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [filter, setFilter] = useState<MediaFilterState>(MEDIA_FILTER_CLEAR)
  const [sort, setSort] = useState<SortState>({ column: 'name', dir: 'asc', nameSortMode: 'az' })
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  // All-category name→code map (species + issf/domestic/form). Drives the ML link's
  // taxonCode when "Show subspecies" is on, so a form entry filters to its own media
  // (media-catalog-taxon-links). Species-only taxonMap is untouched (favicons/sort).
  const [formTaxonMap, setFormTaxonMap] = useState<Record<string, string>>({})
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [wideMode, setWideMode] = useState(false)
  // Pinned column headings — opt-in, session-only (plain useState, matching
  // wideMode right beside it: no storage seam, no localStorage, nothing persisted).
  const [pinned, setPinned] = useState(false)
  // The view the user pinned FROM, so unpinning restores it and the round trip
  // leaves no residue. null whenever nothing is pinned.
  const [viewBeforePin, setViewBeforePin] = useState<boolean | null>(null)
  // Key of the live region's message node. React bails out when a text node
  // reconciles to an identical string, so a repeat announcement needs a real node
  // replacement, never an invisible character appended to the text (v0.5.80).
  const [pinSeq, setPinSeq] = useState(0)
  const pinDescId = useId()
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
  const [sexFilter, setSexFilter] = useState<Sex | null>(null)
  const [ageFilter, setAgeFilter] = useState<AgeClass | null>(null)

  // Both toggles run the SHARED machine in lib/pinnedLabels.ts — the same one the
  // Breeding Codes tab runs. The user asked for this tab to have "the same pin
  // labels option," and one implementation is the only way two surfaces stay the
  // same. The invariant (`pinned` is never true while `wideMode` is false) and the
  // reasoning behind it live there.
  function applyPinTransition(next: PinnedLabelsTransition) {
    setPinned(next.pinned)
    setWideMode(next.wideMode)
    setViewBeforePin(next.viewBeforePin)
    if (next.announce) setPinSeq(s => s + 1)
  }

  const pinState = { pinned, wideMode, viewBeforePin }
  const togglePin = () => applyPinTransition(nextPinnedState(pinState))
  const toggleView = () => applyPinTransition(nextViewState(pinState))

  // Normalized eBird backbone names — used to decide whether a media-comment
  // species links to Species Detail (only species the user has actually recorded).
  const backboneNames = useMemo(
    () => new Set(rawEbirdObs.map(o => normalizeSpeciesName(o.commonName))),
    [rawEbirdObs],
  )

  // Media assets carrying a free-text comment, counted the same way the Media
  // Comments section derives its rows — drives the discoverability hint below so
  // the count stays in sync with the section it points at.
  const commentCount = useMemo(() => rawRows.filter(hasMediaComment).length, [rawRows])

  useEffect(() => {
    if (requestedFilter !== 'is-target') return
    const run = async () => { setFilterIsTarget(true); onRequestedFilterConsumed?.() }
    run()
  }, [requestedFilter, onRequestedFilterConsumed])

  const fetchTaxonCodes = async (entries: LifeListEntry[]) => {
    try {
      const data = await transport.post<{ codes: Record<string, string>; orders: Record<string, number>; formCodes?: Record<string, string> }>(
        '/taxonomy/codes',
        { species: entries.map(e => ({ commonName: e.commonName, scientificName: e.scientificName })) }
      )
      setTaxonMap(data.codes ?? {})
      setFormTaxonMap(data.formCodes ?? {})
      setTaxonOrders(data.orders ?? {})
    } catch {
      // silently fail — links fall back to the species code (or a bare type link),
      // sort falls back to A–Z
    }
  }

  const resolveMLCounties = async (initialRows: MLExportRow[], preloadedEbirdObs?: ObservationEntry[]) => {
    setCountyResolution('resolving')
    const rows = initialRows.map(r => ({ ...r }))

    // Pass 2: cross-reference eBird backup (use pre-loaded obs if available)
    try {
      let ebirdObs: ObservationEntry[] | null = preloadedEbirdObs ?? null
      if (!ebirdObs) {
        const status = await storage.getFilesStatus()
        if (status.ebird) {
          const ebird = await loadEbirdObservations()
          if (ebird) ebirdObs = ebird.observations
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
        const data = await transport.post<{ results: Array<{ lat: number; lng: number; county: string | null }> }>(
          '/nominatim/counties',
          { locations: [...seen.values()] }
        )
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

  // Per-asset Age/Sex groups by catalog id — parsed once, reused by the facet filter.
  const catalogAgeSex = useMemo(() => buildCatalogAgeSex(rawRows), [rawRows])
  const facetActive = sexFilter !== null || ageFilter !== null

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
      // `nonCountable` is decided from the RAW names in buildComprehensiveEntries;
      // fall back to the display name only for parser-derived entries, which drop
      // non-countable rows at parse and so never set the flag.
      if (!showSpuh && (e.nonCountable ?? isNonCountableForm(e.commonName))) return false
      if (!showNonBird && e.isNonBird) return false
      return true
    })
  }, [phase, rawEbirdObs, rawRows, filteredRows, phaseEntries, countyFilter, dateRange,
      mergeSubspecies, showSpuh, showNonBird, hasLocationFilter])

  // Apply the sex/age facet by projecting each entry's catalogIds to the matching
  // subset (exact-combo) and dropping zero-match species — so every downstream
  // count / filter / sort over catalogIds becomes facet-aware with no further change.
  // No facet → returns displayEntries unchanged (byte-identical to before this feature).
  const facetEntries = useMemo((): LifeListEntry[] => {
    if (!facetActive) return displayEntries
    const out: LifeListEntry[] = []
    for (const e of displayEntries) {
      const ids = e.catalogIds.filter(id => assetMatchesFacet(catalogAgeSex.get(id) ?? [], sexFilter, ageFilter))
      if (ids.length > 0) out.push({ ...e, catalogIds: ids })
    }
    return out
  }, [displayEntries, facetActive, sexFilter, ageFilter, catalogAgeSex])

  // The species universe IGNORING the location/date filter — the correct
  // denominator for the "X of N species" count. displayEntries already applies
  // the location filter, so reusing its length collapsed the denominator onto
  // the numerator whenever a county/date filter was active ("0 of 0 species").
  const unfilteredDisplayEntries = useMemo((): LifeListEntry[] => {
    const hasEbird = phase.tag === 'ready' && phase.hasEbirdBackbone
    let base: LifeListEntry[]
    if (hasEbird && rawEbirdObs.length > 0) {
      base = buildComprehensiveEntries(rawEbirdObs, rawRows, mergeSubspecies)
    } else {
      base = phaseEntries
    }
    return base.filter(e => {
      // `nonCountable` is decided from the RAW names in buildComprehensiveEntries;
      // fall back to the display name only for parser-derived entries, which drop
      // non-countable rows at parse and so never set the flag.
      if (!showSpuh && (e.nonCountable ?? isNonCountableForm(e.commonName))) return false
      if (!showNonBird && e.isNonBird) return false
      return true
    })
  }, [phase, rawEbirdObs, rawRows, phaseEntries, mergeSubspecies, showSpuh, showNonBird])

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      setPhase({ tag: 'loading-saved' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ml) { setPhase({ tag: 'setup-required' }); return }

        const [mlText, ebird] = await Promise.all([
          storage.readFile('ml'),
          status.ebird ? loadEbirdObservations() : Promise.resolve(null),
        ])
        if (cancelled) return

        let entries: LifeListEntry[] = []
        let mediaMap: Record<string, string> = {}
        let rows: MLExportRow[] = []
        let hasEbirdBackbone = false
        let ebirdObs: ObservationEntry[] = []

        if (mlText && detectFileType(mlText) === 'ml-export') {
          const parsed = parseMLExport(mlText)
          entries = parsed.entries
          mediaMap = parsed.mediaMap
          rows = parsed.rows
          setMlUserId(parseMLUserId(status.ml.filename))
          setRawRows(rows)
        }

        if (ebird) {
          ebirdObs = ebird.observations
          setRawEbirdObs(ebirdObs)
          hasEbirdBackbone = true
        }

        if (cancelled) return

        setPhase({ tag: 'ready', entries, mediaMap, hasEbirdBackbone })

        // Request codes for BOTH toggle states: the merged (normalized, species) names
        // AND the un-merged (form) names. `codes` resolves the species names (favicons /
        // OFF-state links); `formCodes` resolves the form names to their own issf codes
        // (ON-state links). Deduped by common name so a name is requested once.
        const merged = hasEbirdBackbone ? buildComprehensiveEntries(ebirdObs, rows, true) : entries
        const unmerged = hasEbirdBackbone ? buildComprehensiveEntries(ebirdObs, rows, false) : []
        const byName = new Map<string, LifeListEntry>()
        for (const e of [...merged, ...unmerged]) {
          if (!byName.has(e.commonName)) byName.set(e.commonName, e)
        }
        fetchTaxonCodes([...byName.values()])
        resolveMLCounties(rows, ebirdObs.length > 0 ? ebirdObs : undefined)
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [filesVersion])

  // ── Auto-loading saved file ───────────────────────────────────────────────
  if (phase.tag === 'loading-saved') {
    return (
      <div role="status" aria-label="Loading saved Macaulay Library data" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden />
      </div>
    )
  }

  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="Macaulay Library Export Required"
        body="The Multimedia tab loads automatically from your stored Macaulay Library export. You haven't saved one yet."
        steps={ML_EXPORT_STEPS}
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
          fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          {phase.message}
        </div>
        <button tabIndex={0}
          onClick={onGoToSettings}
          style={{
            height: 32, padding: '0 14px', borderRadius: 6,
            border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
            color: 'var(--sr-text-muted)', fontSize: '0.75rem', fontWeight: 500,
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
    ? facetEntries.filter(e => e.catalogIds.some(id => mediaMap[id] === 'Photo' || mediaMap[id] === 'Audio' || mediaMap[id] === 'Video'))
    : facetEntries

  const isTargetFilteredEntries = filterIsTarget
    ? mediaFilteredEntries.filter(e => {
        const photo = e.catalogIds.some(id => mediaMap[id] === 'Photo')
        const audio = e.catalogIds.some(id => mediaMap[id] === 'Audio')
        const video = e.catalogIds.some(id => mediaMap[id] === 'Video')
        return !photo || !audio || !video
      })
    : mediaFilteredEntries

  const isFilterClear = !filter.photo && !filter.audio && !filter.video && !filterHasMedia && !filterIsTarget && !facetActive

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

  const totalSpecies = unfilteredDisplayEntries.length
  const countLabel = (isFilterClear && !hasLocationFilter)
    ? `${displayEntries.length} species`
    : `${filteredCount} of ${totalSpecies} species`

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
      fontSize: '0.75rem',
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
          fontSize: '0.8125rem', color: 'var(--sr-warning)', marginBottom: 12, flexShrink: 0,
        }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} />
          Media links could not be personalised. The CSV filename was not in the default Macaulay Library format, so links will open the general catalog search instead.
        </div>
      )}

      {/* Media Comments discoverability hint — points to the searchable section
          at the bottom of the tab. Gated on commentCount so it never points at a
          section that renders null. Mirrors the Statistics "Jump to section" anchor. */}
      {commentCount > 0 && (
        <div style={{
          display: 'flex', alignItems: 'center', gap: 8,
          padding: '8px 12px', marginBottom: 12, flexShrink: 0, flexWrap: 'wrap',
          background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
          borderRadius: 8, fontSize: '0.78125rem', color: 'var(--sr-text-muted)',
        }}>
          <MessageSquare size={13} strokeWidth={2.2} style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
          <span>{commentCount === 1 ? '1 media comment is' : `${commentCount} media comments are`} searchable below the table.</span>
          <a
            href="#media-comments"
            onClick={e => {
              e.preventDefault()
              const el = document.getElementById('media-comments')
              smoothScrollIntoView(el)
              // preventDefault suppresses the browser's native fragment-focus move,
              // so relocate focus to the section ourselves (2.4.3 Focus Order).
              // The section div isn't natively focusable; make it programmatically
              // focusable just-in-time without painting a ring for mouse users.
              if (el) {
                el.setAttribute('tabindex', '-1')
                el.style.outline = 'none'
                el.focus({ preventScroll: true })
              }
            }}
            style={{
              marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4,
              fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0,
              // ≥24px hit area (WCAG 2.2 target size) without growing the visual box.
              minHeight: 24, paddingLeft: 6, paddingRight: 6, marginRight: -6,
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Jump to comments
            <ChevronDown size={13} strokeWidth={2.5} />
          </a>
        </div>
      )}

      {/* Controls row */}
      <div style={{
        display: 'flex', justifyContent: 'space-between', alignItems: 'center',
        gap: 12, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap',
      }}>
        {/* Filter pills. .sr-ctl-row gives every interactive control in this block
            ONE phone-tier text size (globals.css), so the pills/sort toggles/switches
            can't read smaller than the .sr-input-16 selects and date inputs beside
            them. Deliberately NOT on the right-hand cluster below: the count is
            static text and the wide-mode button is a view control, not a filter. */}
        <div className="sr-ctl-row" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <button tabIndex={0} aria-pressed={isFilterClear} style={pillStyle(isFilterClear ? 'positive' : 'none')} onClick={() => { setFilter(MEDIA_FILTER_CLEAR); setFilterHasMedia(false); setFilterIsTarget(false); setSexFilter(null); setAgeFilter(null) }}>All</button>
          <button tabIndex={0} aria-pressed={filterHasMedia} style={pillStyle(filterHasMedia ? 'positive' : 'none')} onClick={() => setFilterHasMedia(v => !v)}>Has media</button>
          <button tabIndex={0}
            aria-pressed={filterIsTarget}
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

          <button tabIndex={0} aria-pressed={filter.photo === 'no'} style={pillStyle(filter.photo === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('photo', 'no')}>
            <Camera size={11} strokeWidth={2.5} />No photo
          </button>
          <button tabIndex={0} aria-pressed={filter.audio === 'no'} style={pillStyle(filter.audio === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('audio', 'no')}>
            <Mic size={11} strokeWidth={2.5} />No audio
          </button>
          <button tabIndex={0} aria-pressed={filter.video === 'no'} style={pillStyle(filter.video === 'no' ? 'negative' : 'none')} onClick={() => toggleDimension('video', 'no')}>
            <Video size={11} strokeWidth={2.5} />No video
          </button>

          <div style={pillSep} />

          <button tabIndex={0} aria-pressed={filter.photo === 'has'} style={pillStyle(filter.photo === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('photo', 'has')}>
            <Camera size={11} strokeWidth={2.5} />Has photo
          </button>
          <button tabIndex={0} aria-pressed={filter.audio === 'has'} style={pillStyle(filter.audio === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('audio', 'has')}>
            <Mic size={11} strokeWidth={2.5} />Has audio
          </button>
          <button tabIndex={0} aria-pressed={filter.video === 'has'} style={pillStyle(filter.video === 'has' ? 'positive' : 'none')} onClick={() => toggleDimension('video', 'has')}>
            <Video size={11} strokeWidth={2.5} />Has video
          </button>

          <div style={pillSep} />

          {/* Sex / Age media facets — native selects matching the County control */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="sr-input-16"
              aria-label="Sex"
              value={sexFilter ?? ''}
              onChange={e => setSexFilter((e.target.value || null) as Sex | null)}
              style={facetSelectStyle(sexFilter !== null)}
            >
              <option value="">Any sex</option>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
            </select>
            <span style={facetChevStyle(sexFilter !== null)}>▾</span>
          </div>
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <select
              className="sr-input-16"
              aria-label="Age"
              value={ageFilter ?? ''}
              onChange={e => setAgeFilter((e.target.value || null) as AgeClass | null)}
              style={facetSelectStyle(ageFilter !== null)}
            >
              <option value="">Any age</option>
              <option value="Juvenile">Juvenile</option>
              <option value="Immature">Immature</option>
              <option value="Adult">Adult</option>
            </select>
            <span style={facetChevStyle(ageFilter !== null)}>▾</span>
          </div>

          <div style={pillSep} />

          {/* A–Z / Taxonomic sort toggle */}
          <div role="group" aria-label="Sort order" style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
            <button tabIndex={0}
              aria-pressed={sort.nameSortMode === 'az'}
              style={{ ...sortToggleBtn(sort.nameSortMode === 'az'), borderRight: '1.5px solid var(--sr-accent-border)' }}
              onClick={() => setSort({ column: 'name', dir: 'asc', nameSortMode: 'az' })}
            >
              A–Z
            </button>
            <button tabIndex={0}
              aria-pressed={sort.nameSortMode === 'taxonomic'}
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
            label={SHOW_FORMS_TOGGLE_LABEL}
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
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, height: 26, padding: '0 10px', borderRadius: 5, border: '1.5px dashed var(--sr-border)', background: 'var(--sr-surface-subtle)', color: 'var(--sr-text-muted)', fontSize: '0.75rem' }}>
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
                className="sr-input-16"
                aria-label="County"
                value={countyFilter ?? ''}
                onChange={e => setCountyFilter(e.target.value || null)}
                style={{
                  minHeight: '1.75rem', paddingLeft: 24, paddingRight: 22, borderRadius: 5,
                  border: countyFilter
                    ? '1.5px solid var(--sr-accent-border-strong)'
                    : '1.5px solid var(--sr-border)',
                  background: countyFilter ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                  color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
                  cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
                }}
              >
                <option value="">All Counties</option>
                {availableCounties.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <span style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)', fontSize: '0.5625rem' }}>▾</span>
            </div>
          )}

          {/* Date range — .sr-field-row stacks From/To full-width ≤480 where
              native date inputs can't shrink below their intrinsic min-width. */}
          <div className="sr-field-row" style={{ gap: 4 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center', minWidth: 0 }}>
              <Calendar size={11} strokeWidth={2} style={{
                position: 'absolute', left: 7, color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                pointerEvents: 'none',
              }} />
              <input
                type="date"
                className="sr-input-16"
                aria-label="From date"
                value={dateRange.from}
                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                style={{
                  // width:100% lets the From input fill its icon wrapper, so when
                  // .sr-field-row stacks the wrapper full-width ≤480 the From field
                  // matches the (direct-child) To field instead of staying intrinsic.
                  width: '100%',
                  minHeight: '1.75rem', paddingLeft: 24, paddingRight: 6, borderRadius: 5,
                  border: dateRange.from ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                  background: dateRange.from ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                  color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  fontSize: '0.75rem', fontFamily: 'inherit',
                }}
              />
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>→</span>
            <input
              type="date"
              className="sr-input-16"
              aria-label="To date"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              style={{
                minHeight: '1.75rem', paddingLeft: 8, paddingRight: 6, borderRadius: 5,
                border: dateRange.to ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                background: dateRange.to ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                color: dateRange.to ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontFamily: 'inherit',
              }}
            />
          </div>
        </div>

        {/* Right controls. display/align-items/gap are lifted to .sr-wrap-flex so
            the count and the view button WRAP instead of pushing page horizontal
            scroll at 320px and 200% text scale. The class ALONE is inert here:
            flexShrink: 0 pins the cluster at its max-content width even once the
            parent row has wrapped it onto its own line, so nothing ever narrows
            it and a flex container that is never narrowed has no reason to break
            a line. maxWidth: '100%' is what makes the class bind — it caps the
            cluster at the row's content box while keeping the do-not-get-squeezed
            intent of flexShrink: 0 (the same pairing .sr-scroll-x already uses). */}
        <div className="sr-wrap-flex" style={{ '--sr-wrap-gap': '8px', flexShrink: 0, maxWidth: '100%' } as React.CSSProperties}>
          <span aria-live="polite" style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{countLabel}</span>
          {/* The two presentation controls read as one group rather than as more
              filters, exactly as on Breeding Codes. Same shipped ghostBtn() styling,
              so they are visually a pair. The group needs no width cap of its own:
              unlike its parent it does not pin itself with flexShrink: 0, so it can
              narrow and wrap (v0.5.82, .sr-wrap-flex is inert on a pinned cluster). */}
          <div role="group" aria-label="Table view" className="sr-wrap-flex" style={{ '--sr-wrap-gap': '6px' } as React.CSSProperties}>
            <button tabIndex={0}
              type="button"
              className="sr-touch-target"
              // The accessible name is the button's own text and nothing else:
              // deliberately NO aria-label, so the visible label and the accessible
              // name cannot drift apart. The consequence of pressing it rides on
              // aria-describedby, a DESCRIPTION not a name, which keeps WCAG 2.5.3
              // Label in Name trivially satisfied. Same formula as Breeding Codes'.
              aria-pressed={pinned}
              aria-describedby={pinDescId}
              style={{ ...ghostBtn(pinned), gap: 5 }}
              onClick={togglePin}
            >
              <Pin size={12} strokeWidth={2.2} aria-hidden style={{ flexShrink: 0 }} />
              {/* Names the axis it freezes, as "Pin code labels" does on Breeding
                  Codes: here the row that holds still is the column headings. */}
              Pin column labels
            </button>
            {/* .sr-touch-target closes the parity gap with the Breeding Codes view
                toggle, which got it in v0.5.81: this button ships 15px tall, well
                under the ~44px phone posture. The class sets min-height in the ≤640
                tier only, so desktop density is untouched and only the cluster's
                height changes (the wrapping row absorbs it). */}
            <button tabIndex={0}
              type="button"
              className="sr-touch-target"
              style={ghostBtn(wideMode)}
              onClick={toggleView}
              title={wideMode ? 'Collapse table into scroll box' : 'Expand table: scroll the whole page on mobile'}
            >
              {wideMode ? '↔ Normal' : '↔ Unbounded'}
            </button>
          </div>
          {/* Persistent description target. It sits in the control row, never inside
              the horizontally scrolled table (where an absolutely positioned .sr-only
              span can extend document.scrollWidth on a phone). */}
          <span className="sr-only" id={pinDescId}>Pinning uses the Unbounded view.</span>
        </div>
      </div>

      {hasLocationFilter && (
        <div className="sr-action-row sr-action-row-stack" style={{
          padding: '7px 12px', marginBottom: 8,
          background: 'var(--sr-accent-bg)', borderRadius: 6,
          fontSize: '0.75rem', color: 'var(--sr-accent)', flexShrink: 0,
        }}>
          <span className="sr-min0" style={{ fontWeight: 500 }}>{filterStripText}</span>
          <button tabIndex={0}
            onClick={() => { setCountyFilter(null); setDateRange(DATE_RANGE_CLEAR) }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', flexShrink: 0,
              fontSize: '0.75rem', color: 'var(--sr-accent)', fontFamily: 'inherit',
              // ≥24px hit area (WCAG 2.2 target size) without shifting the row layout.
              minHeight: 24, padding: '0 6px', margin: '0 -6px', textDecoration: 'underline',
            }}
          >
            Clear filter
          </button>
        </div>
      )}

      {/* The live region is rendered from the START and never mounts alongside its
          message: assistive tech reports CHANGES to a region that already exists, so
          a region that appears together with its text can go unannounced. The
          wrapper is chromeless and collapses to nothing when empty; the note is its
          key={pinSeq} child, so each pin is a real node replacement (an addition in
          aria-live terms) while the region's textContent stays exactly the message.
          Padding the string with an invisible character to force a diff is the wrong
          fix: it makes every textContent assertion quietly false. */}
      <div className="sr-pinstatus" role="status">
        {pinned ? <p key={pinSeq} className="sr-pinnote sr-pinnote--enter">{PIN_NOTE}</p> : null}
      </div>

      <LifeListTable
        entries={isTargetFilteredEntries}
        mediaMap={mediaMap}
        filter={filter}
        sort={sort}
        onSortChange={setSort}
        userId={mlUserId}
        taxonMap={taxonMap}
        formTaxonMap={formTaxonMap}
        showSubspecies={!mergeSubspecies}
        taxonOrders={taxonOrders}
        wideMode={wideMode}
        pinned={pinned}
        onOpenSpecies={onOpenSpecies}
        hasEbirdBackbone={phase.tag === 'ready' && phase.hasEbirdBackbone}
        sexFilter={sexFilter}
        ageFilter={ageFilter}
      />

      <MediaCommentsSection
        rows={rawRows}
        backboneNames={backboneNames}
        taxonMap={taxonMap}
        onOpenSpecies={onOpenSpecies}
      />
    </div>
  )
}
