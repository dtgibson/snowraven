import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Loader2, ChevronDown,
  Search, ExternalLink, Image, Mic, Video, Eye, MessageSquare, Dna,
  MapPin, Play, Calendar, SlidersHorizontal, Share2, Tag,
} from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { ToggleSwitch } from './ui/ToggleSwitch'
import { loadEbirdObservations } from '../lib/observationsCache'
import { loadMLExport } from '../lib/mlExportCache'
import type { MLExportRow } from '../lib/parseMLExport'
import { buildGraphData } from '../lib/sightingsGraph'
import { TIER_COLORS } from '../lib/breedingCodes'
import {
  computeSightingsStats, computeMediaCounts, computeRecentMediaIds, computeBreedingPill,
  computeBreedingBreakdown, computeLocationsSorted, computeCoOccurrence,
} from '../lib/speciesStats'
import { SpeciesLinks } from './SpeciesLinks'
import { SpeciesCombobox } from './SpeciesCombobox'
import { BirdName } from './BirdName'
import { computeNamedBirds } from '../lib/namedBirds'
import { NamedBirdsTable } from './NamedBirdsTable'
import { ChecklistLink } from './ChecklistLink'
import { HotspotLink } from './HotspotLink'
import { useHotspotSet } from '../lib/useHotspotSet'
import type { ObservationEntry, MediaType } from '../types'
import { normalizeSpeciesName, isSpuhOrSlash } from '../lib/speciesUtils'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'
import { formatDate } from '../lib/formatDate'
import { HEAT_INTENSITY_DEFAULT, heatWeight } from '../lib/heat'
import { smoothScrollIntoView } from '../lib/scroll'
import { SnowMap } from './SnowMap'
import { SightingsMap } from './SightingsMap'
import { buildSightingMarkers } from '../lib/sightingMarkers'
import { extractUserId, mlCatalogLink, resolveMediaLinkTaxonCode } from '../lib/mlCatalog'
import { RecentMediaEmbed } from './RecentMediaEmbed'
import { SectionCard, SectionHead, StatLabel, StatValueLink } from './speciesDetail/ui'
import { SightingsGraph } from './speciesDetail/SightingsGraph'
import { HeatmapLayer } from './speciesDetail/HeatmapLayer'
import { MapBoundsFitter } from './speciesDetail/MapBoundsFitter'

// ── Types ──────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Map<string, MediaType>; mlRows: MLExportRow[]; hasML: boolean; userId: string | null }

const COMMENTS_PAGE = 10

// ── Main component ─────────────────────────────────────────────────────────

export function SpeciesDetail({ onGoToSettings, filesVersion, requestedSpecies, onRequestedSpeciesConsumed, embedAllowed }: { onGoToSettings: () => void; filesVersion?: number; requestedSpecies?: string; onRequestedSpeciesConsumed?: () => void; embedAllowed: boolean }) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  // All-category name→code map (species + issf/domestic/form). Drives the ML link's
  // taxonCode when "Show subspecies" is on, so a selected form filters to its own media
  // (media-catalog-taxon-links). taxonMap stays species-only (favicons / selector).
  const [formTaxonMap, setFormTaxonMap] = useState<Record<string, string>>({})
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)

  const [mergeSubspecies, setMergeSubspecies] = useState(true)
  const [showSpuh, setShowSpuh] = useState(false)

  const [countyFilter, setCountyFilter] = useState<string | null>(null)
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({ from: '', to: '' })

  const [commentFilter, setCommentFilter] = useState('')
  const [commentSort, setCommentSort] = useState<'newest' | 'oldest'>('newest')
  const [showAllComments, setShowAllComments] = useState(false)
  const [showAllLocations, setShowAllLocations] = useState(false)
  const [mapMode, setMapMode] = useState<'pins' | 'heatmap'>('pins')
  const [heatIntensity, setHeatIntensity] = useState(HEAT_INTENSITY_DEFAULT)
  const [graphInterval, setGraphInterval] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [viewMode, setViewMode] = useState<'per-period' | 'cumulative'>('per-period')
  const [showAllCoOccurrence, setShowAllCoOccurrence] = useState(false)

  // Public-hotspot membership for location names (Top Locations, Comments). Loads the
  // backup itself via the shared cache, so it's safe to call before the phase guard.
  const { isHotspot } = useHotspotSet()

  const selectSpecies = (name: string | null) => {
    setSelectedSpecies(name)
    setCommentFilter('')
    setCommentSort('newest')
    setShowAllComments(false)
    setShowAllLocations(false)
    setMapMode('pins')
    setHeatIntensity(HEAT_INTENSITY_DEFAULT)
    setGraphInterval('monthly')
    setViewMode('per-period')
    setShowAllCoOccurrence(false)
  }

  const handleToggleMerge = () => {
    if (!mergeSubspecies) {
      if (selectedSpecies) setSelectedSpecies(normalizeSpeciesName(selectedSpecies))
    } else {
      selectSpecies(null)
    }
    setShowAllLocations(false)
    setMergeSubspecies(prev => !prev)
  }

  const handleToggleSpuh = () => {
    const nextShowSpuh = !showSpuh
    if (!nextShowSpuh && selectedSpecies && isSpuhOrSlash(selectedSpecies)) {
      selectSpecies(null)
    }
    setShowSpuh(nextShowSpuh)
  }

  const fetchTaxonData = async (obs: ObservationEntry[]) => {
    try {
      const seen = new Map<string, string>()
      for (const o of obs) {
        // Request the raw name (form code lives in formCodes) AND the normalized
        // species name (so `codes` carries the SPECIES code keyed by the merged name —
        // the OFF-state ML link, even when the user only recorded a form). First
        // scientificName wins; the normalized entry reuses the same one.
        if (!seen.has(o.commonName)) seen.set(o.commonName, o.scientificName)
        const norm = normalizeSpeciesName(o.commonName)
        if (!seen.has(norm)) seen.set(norm, o.scientificName)
      }
      const species = [...seen.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
      const data = await transport.post<{ codes: Record<string, string>; orders: Record<string, number>; formCodes?: Record<string, string> }>(
        '/taxonomy/codes',
        { species }
      )
      setTaxonOrders(data.orders ?? {})
      setTaxonMap(data.codes ?? {})
      setFormTaxonMap(data.formCodes ?? {})
    } catch {
      // silently fail — selector usable in A–Z; ML links fall back to the species
      // code or omit taxonCode
    }
  }

  // Auto-load from stored files
  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      setPhase({ tag: 'loading-saved' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }

        const mlUserId = extractUserId(status.ml?.filename ?? '')

        const [ebird, ml] = await Promise.all([
          loadEbirdObservations(),
          status.ml ? loadMLExport() : Promise.resolve(null),
        ])
        if (cancelled) return

        if (!ebird) { setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." }); return }

        const observations = ebird.observations

        let mediaMap = new Map<string, MediaType>()
        let mlRows: MLExportRow[] = []
        let hasML = false

        if (ml) {
          mediaMap = new Map(Object.entries(ml.mediaMap) as [string, MediaType][])
          mlRows = ml.rows
          hasML = true
        }

        if (cancelled) return
        setPhase({ tag: 'ready', observations, mediaMap, mlRows, hasML, userId: mlUserId })
        fetchTaxonData(observations)
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [filesVersion])

  // ── Derived data ───────────────────────────────────────────────────────

  const { sciNameMap, sortedSpeciesList } = useMemo(() => {
    if (phase.tag !== 'ready') return { sciNameMap: new Map<string, string>(), sortedSpeciesList: [] }

    const seen = new Map<string, string>()   // name → first sci name
    const orders = new Map<string, number>() // name → min taxon order

    for (const o of phase.observations) {
      const key = mergeSubspecies ? normalizeSpeciesName(o.commonName) : o.commonName
      if (!seen.has(key)) seen.set(key, o.scientificName)
      const order = taxonOrders[o.commonName.toLowerCase()] ?? taxonOrders[key.toLowerCase()] ?? Infinity
      const current = orders.get(key) ?? Infinity
      if (order < current) orders.set(key, order)
    }

    const sorted = [...seen.keys()].sort((a, b) => {
      const oa = orders.get(a) ?? Infinity
      const ob = orders.get(b) ?? Infinity
      if (oa !== ob) return oa - ob
      return a.localeCompare(b)
    })

    return { sciNameMap: seen, sortedSpeciesList: sorted }
  }, [phase, taxonOrders, mergeSubspecies])

  // Apply spuh/slash filter
  const displaySpeciesList = useMemo(
    () => showSpuh ? sortedSpeciesList : sortedSpeciesList.filter(name => !isSpuhOrSlash(name)),
    [sortedSpeciesList, showSpuh]
  )

  // Select a species and scroll the detail back to the top (used by in-tab
  // BirdName clicks — Reported With / Top Locations — and external requests).
  const rootRef = useRef<HTMLDivElement>(null)
  const openSpeciesInTab = useCallback((name: string) => {
    const target = mergeSubspecies ? normalizeSpeciesName(name) : name
    const match = displaySpeciesList.includes(target)
      ? target
      : displaySpeciesList.find(n => normalizeSpeciesName(n) === normalizeSpeciesName(name))
    if (!match) return
    selectSpecies(match)
    requestAnimationFrame(() => smoothScrollIntoView(rootRef.current))
  }, [mergeSubspecies, displaySpeciesList])

  // Consume an external "open this species" request once data is ready (single-use).
  // Deferred to a microtask so the selection state-update isn't applied
  // synchronously inside the effect (mirrors the LifeList requestedFilter pattern).
  useEffect(() => {
    if (phase.tag !== 'ready' || !requestedSpecies) return
    queueMicrotask(() => {
      openSpeciesInTab(requestedSpecies)
      onRequestedSpeciesConsumed?.()
    })
  }, [phase.tag, requestedSpecies, openSpeciesInTab, onRequestedSpeciesConsumed])

  // Resolve an eBird taxon code for any species name (handles subspecies merge).
  const taxonCodeFor = useCallback((name: string): string | undefined => {
    const direct = taxonMap[name]
    if (direct) return direct
    const norm = normalizeSpeciesName(name)
    for (const [k, code] of Object.entries(taxonMap)) {
      if (normalizeSpeciesName(k) === norm) return code
    }
    return undefined
  }, [taxonMap])

  const counties = useMemo(() => {
    if (phase.tag !== 'ready') return []
    const set = new Set<string>()
    for (const o of phase.observations) {
      if (o.county) set.add(o.county)
    }
    return [...set].sort()
  }, [phase])

  const hasLocationFilter = countyFilter !== null || !!dateRange.from || !!dateRange.to

  const speciesObs = useMemo((): ObservationEntry[] => {
    if (phase.tag !== 'ready' || !selectedSpecies) return []
    const base = mergeSubspecies
      ? phase.observations.filter(o => normalizeSpeciesName(o.commonName) === selectedSpecies)
      : phase.observations.filter(o => o.commonName === selectedSpecies)
    if (!hasLocationFilter) return base
    return base.filter(o => {
      if (countyFilter !== null && o.county !== countyFilter) return false
      if (dateRange.from && o.date < dateRange.from) return false
      if (dateRange.to && o.date > dateRange.to) return false
      return true
    })
  }, [phase, selectedSpecies, mergeSubspecies, countyFilter, dateRange, hasLocationFilter])

  // Full-backup count for the selected species — the "of N" denominator in the
  // location-filter strip. It does NOT depend on the date/county filter, so
  // memoize it once per species/merge change instead of rescanning the whole
  // backup on every date-filter keystroke.
  const baseCount = useMemo(() => {
    if (phase.tag !== 'ready' || !selectedSpecies) return 0
    return mergeSubspecies
      ? phase.observations.filter(o => normalizeSpeciesName(o.commonName) === selectedSpecies).length
      : phase.observations.filter(o => o.commonName === selectedSpecies).length
  }, [phase, selectedSpecies, mergeSubspecies])

  // Sightings stats
  const sightingsStats = useMemo(() => computeSightingsStats(speciesObs), [speciesObs])

  // Media counts
  const mediaCounts = useMemo(
    () => computeMediaCounts(speciesObs, phase.tag === 'ready' ? phase.mediaMap : new Map<string, string>()),
    [speciesObs, phase],
  )

  // Highest catalog ID per media type (for embedded media)
  const recentMediaIds = useMemo(
    () => computeRecentMediaIds(speciesObs, phase.tag === 'ready' ? phase.mediaMap : new Map<string, string>()),
    [speciesObs, phase],
  )

  // Per-asset export row keyed by catalog id, so each Recent Media embed can show its
  // capture date + checklist beneath the player (from the user's own ML export rows).
  const mediaRowById = useMemo(() => {
    const m = new Map<string, MLExportRow>()
    if (phase.tag === 'ready') for (const r of phase.mlRows) m.set(r.catalogId, r)
    return m
  }, [phase])

  // Highest breeding category pill
  const breedingPill = useMemo(() => computeBreedingPill(speciesObs), [speciesObs])

  // Breeding code breakdown
  const breedingBreakdown = useMemo(() => computeBreedingBreakdown(speciesObs), [speciesObs])

  // Locations list sorted by count desc
  const locationsSorted = useMemo(() => computeLocationsSorted(speciesObs), [speciesObs])

  // ML rows filtered to selected species + date range (for graph overlay lines)
  const speciesMlRows = useMemo((): MLExportRow[] => {
    if (phase.tag !== 'ready' || !selectedSpecies) return []
    return phase.mlRows.filter(r => {
      const name = mergeSubspecies ? normalizeSpeciesName(r.commonName) : r.commonName
      if (name !== selectedSpecies) return false
      if (dateRange.from && r.date < dateRange.from) return false
      if (dateRange.to && r.date > dateRange.to) return false
      return true
    })
  }, [phase, selectedSpecies, mergeSubspecies, dateRange])

  // Total unique checklists in scope (same filters as speciesObs) — denominator for Frequency stat
  const totalFilteredChecklists = useMemo(() => {
    if (phase.tag !== 'ready') return 0
    const ids = new Set<string>()
    for (const o of phase.observations) {
      if (!o.submissionId) continue
      if (countyFilter !== null && o.county !== countyFilter) continue
      if (dateRange.from && o.date < dateRange.from) continue
      if (dateRange.to && o.date > dateRange.to) continue
      ids.add(o.submissionId)
    }
    return ids.size
  }, [phase, countyFilter, dateRange])

  // Map markers: one per unique lat/lng, with all sightings at that coordinate.
  // Shared with the Named Birds card map via buildSightingMarkers.
  const coordMarkers = useMemo(() => buildSightingMarkers(speciesObs), [speciesObs])

  const uniqueCoords = useMemo(
    (): [number, number][] => coordMarkers.map(m => [m.lat, m.lng] as [number, number]),
    [coordMarkers]
  )

  // Heat layer points: [lat, lng, weight] — weight scales the per-location obs
  // count by the intensity slider (shared model with the Map Explorer; lib/heat.ts).
  const heatPoints = useMemo(
    (): [number, number, number][] => coordMarkers.map(m => [m.lat, m.lng, heatWeight(m.sightings.length, heatIntensity)]),
    [coordMarkers, heatIntensity]
  )

  // Graph data (lifted from SightingsGraph for hasGraphData check and GraphOptions card)
  const graphResult = useMemo(
    () => buildGraphData(speciesObs, speciesMlRows, graphInterval),
    [speciesObs, speciesMlRows, graphInterval],
  )
  const hasGraphData = graphResult.data.length >= 2

  // Co-occurrence: species sharing target-species checklists, filtered by county/date
  const coOccurrence = useMemo(
    () => phase.tag !== 'ready' ? null : computeCoOccurrence(phase.observations, speciesObs, selectedSpecies, mergeSubspecies),
    [phase, selectedSpecies, speciesObs, mergeSubspecies],
  )

  // Comments
  const allComments = useMemo(() => {
    const base = speciesObs.filter(o => o.speciesComments.trim() !== '')
    const sorted = [...base].sort((a, b) =>
      commentSort === 'newest'
        ? b.date.localeCompare(a.date)
        : a.date.localeCompare(b.date)
    )
    if (!commentFilter.trim()) return sorted
    const q = commentFilter.toLowerCase()
    return sorted.filter(o => o.speciesComments.toLowerCase().includes(q))
  }, [speciesObs, commentSort, commentFilter])

  // Named individuals of this species, parsed from [name:…] tags in comments.
  const namedIndividuals = useMemo(() => computeNamedBirds(speciesObs), [speciesObs])

  // Species code for the header favicons (eBird / Birds of the World). This is the
  // SPECIES code in BOTH toggle states — favicon behavior stays byte-identical to
  // before the media-catalog-taxon-links fix. taxonMap now also carries the code keyed
  // by the normalized name (requested above), so a form-only species resolves here too;
  // the legacy scan is the belt-and-braces fallback for the merged case.
  const speciesTaxonCode = useMemo(() => {
    if (!selectedSpecies) return undefined
    const direct = taxonMap[selectedSpecies] ?? taxonMap[normalizeSpeciesName(selectedSpecies)]
    if (direct) return direct
    if (mergeSubspecies) {
      for (const [key, code] of Object.entries(taxonMap)) {
        if (normalizeSpeciesName(key) === selectedSpecies) return code
      }
    }
    return undefined
  }, [selectedSpecies, taxonMap, mergeSubspecies])

  // Taxon code for the ML MEDIA links, toggle-aware (media-catalog-taxon-links):
  //  • "Show subspecies" ON (mergeSubspecies false): selectedSpecies is a FORM name —
  //    use the form's OWN issf code (formTaxonMap) so the link filters to just that
  //    form; fall back to the species code (offline gap / unmapped).
  //  • OFF (merged): the species code above.
  // Species code is the universal fallback — never a bare link for a resolvable species.
  const mediaLinkTaxonCode = useMemo(() => {
    if (!selectedSpecies) return undefined
    return resolveMediaLinkTaxonCode(!mergeSubspecies, formTaxonMap[selectedSpecies], speciesTaxonCode)
  }, [selectedSpecies, formTaxonMap, mergeSubspecies, speciesTaxonCode])

  // ── Render ─────────────────────────────────────────────────────────────

  if (phase.tag === 'loading-saved') {
    return (
      <div role="status" aria-label="Loading saved eBird data" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden="true" />
      </div>
    )
  }

  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="eBird Backup Required"
        body="Species Detail loads automatically from your stored eBird backup. Upload it once in Settings and this tab will always be ready."
        steps={EBIRD_BACKUP_STEPS}
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

  const { observations, hasML, userId } = phase

  // ── Ready state ────────────────────────────────────────────────────────
  return (
    <div ref={rootRef} style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>

      {/* Toolbar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexShrink: 0, flexWrap: 'wrap' }}>
        <ToggleSwitch label="Show subspecies" checked={!mergeSubspecies} onChange={handleToggleMerge} />
        <ToggleSwitch label="Show sp./slash" checked={showSpuh} onChange={handleToggleSpuh} />
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
          {displaySpeciesList.length} species
        </span>
      </div>

      {/* Species selector — the shared searchable combobox (reference impl for it). */}
      <div style={{ marginBottom: 16, flexShrink: 0 }}>
        <SpeciesCombobox
          options={displaySpeciesList.map(n => ({ name: n, sciName: sciNameMap.get(n) }))}
          value={selectedSpecies}
          onChange={selectSpecies}
          placeholder="Choose a species…"
          ariaLabel="Select species"
          size="md"
          className="sr-input-16"
        />
      </div>

      {/* Filter controls row */}
      {counties.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap', flexShrink: 0 }}>
          {/* County dropdown */}
          <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
            <MapPin size={12} strokeWidth={2} style={{
              position: 'absolute', left: 7, color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
              pointerEvents: 'none', flexShrink: 0,
            }} />
            <select
              aria-label="County"
              value={countyFilter ?? ''}
              onChange={e => setCountyFilter(e.target.value || null)}
              className="sr-input-16"
              style={{
                minHeight: '1.625rem', paddingLeft: 24, paddingRight: 22, borderRadius: 5,
                border: countyFilter ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                background: countyFilter ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
                cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none',
              }}
            >
              <option value="">All Counties</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)', fontSize: '0.5625rem' }}>▾</span>
          </div>

          {/* Date range */}
          <div className="sr-field-row" style={{ gap: 4 }}>
            <div style={{ position: 'relative', display: 'inline-flex', alignItems: 'center' }}>
              <Calendar size={11} strokeWidth={2} style={{
                position: 'absolute', left: 7, color: dateRange.from ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                pointerEvents: 'none',
              }} />
              <input
                type="date"
                aria-label="From date"
                value={dateRange.from}
                onChange={e => setDateRange(prev => ({ ...prev, from: e.target.value }))}
                className="sr-input-16"
                style={{
                  minHeight: '1.625rem', paddingLeft: 24, paddingRight: 6, borderRadius: 5, width: '100%',
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
              aria-label="To date"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              className="sr-input-16"
              style={{
                minHeight: '1.625rem', paddingLeft: 8, paddingRight: 6, borderRadius: 5,
                border: dateRange.to ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                background: dateRange.to ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                color: dateRange.to ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontFamily: 'inherit',
              }}
            />
          </div>

          {hasLocationFilter && (
            <button tabIndex={0}
              onClick={() => { setCountyFilter(null); setDateRange({ from: '', to: '' }) }}
              style={{
                background: 'none', border: 'none', cursor: 'pointer',
                fontSize: '0.75rem', color: 'var(--sr-accent)', fontFamily: 'inherit',
                padding: '0 2px', minHeight: 24, display: 'inline-flex', alignItems: 'center',
                textDecoration: 'underline',
              }}
            >
              Clear filter
            </button>
          )}
        </div>
      )}

      {/* No species selected prompt */}
      {!selectedSpecies && (
        <SectionCard style={{ flex: 1 }}>
          <div style={{
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            justifyContent: 'center', padding: '56px 32px', textAlign: 'center',
          }}>
            <div style={{
              width: 48, height: 48, borderRadius: 12,
              background: 'var(--sr-surface-subtle)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              marginBottom: 14, color: 'var(--sr-border-medium)',
            }}>
              <Search size={22} strokeWidth={1.8} />
            </div>
            <div style={{ fontSize: '0.875rem', fontWeight: 500, color: 'var(--sr-text-muted)' }}>
              Choose a species to see your history with it
            </div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', marginTop: 4 }}>
              All statistics come from your loaded eBird backup.
            </div>
          </div>
        </SectionCard>
      )}

      {/* Species detail — shown when a species is selected */}
      {selectedSpecies && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* Filter strip — appears above Summary card when filters active */}
          {hasLocationFilter && (() => {
            const parts: string[] = []
            if (countyFilter) parts.push(countyFilter)
            if (dateRange.from && dateRange.to) parts.push(`${formatDate(dateRange.from)} – ${formatDate(dateRange.to)}`)
            else if (dateRange.from) parts.push(`From ${formatDate(dateRange.from)}`)
            else if (dateRange.to) parts.push(`Through ${formatDate(dateRange.to)}`)
            parts.push(`Showing ${speciesObs.length} of ${baseCount} checklists`)
            return (
              <div className="sr-action-row" style={{
                padding: '7px 14px',
                background: 'var(--sr-accent-bg)', borderRadius: 6,
                fontSize: '0.75rem', color: 'var(--sr-accent)',
              }}>
                <span className="sr-min0" style={{ fontWeight: 500 }}>{parts.join(' · ')}</span>
                <button tabIndex={0}
                  onClick={() => { setCountyFilter(null); setDateRange({ from: '', to: '' }) }}
                  style={{
                    background: 'none', border: 'none', cursor: 'pointer',
                    fontSize: '0.75rem', color: 'var(--sr-accent)', fontFamily: 'inherit',
                    padding: 0, textDecoration: 'underline',
                  }}
                >
                  Clear filter
                </button>
              </div>
            )
          })()}

          {sightingsStats && (<>
          {/* Summary card */}
          <SectionCard>
            <div className="sr-pad-x-trim" style={{ padding: '20px 22px 18px' }}>
              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '1.5rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.2, color: 'var(--sr-text)', wordBreak: 'break-word' }}>
                  {selectedSpecies}
                </div>
                <div style={{ fontSize: '0.875rem', fontStyle: 'italic', color: 'var(--sr-text-muted)', marginTop: 3, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 6, wordBreak: 'break-word' }}>
                  <span>{sciNameMap.get(selectedSpecies)}</span>
                  <SpeciesLinks speciesCode={speciesTaxonCode} />
                </div>
              </div>

              <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                {/* Media indicator buttons */}
                {(['Photo', 'Audio', 'Video'] as MediaType[]).map(type => {
                  const Icon = type === 'Photo' ? Image : type === 'Audio' ? Mic : Video
                  const count = mediaCounts[type]
                  const state: 'unavailable' | 'has' | 'none' = !hasML ? 'unavailable' : count > 0 ? 'has' : 'none'
                  return (
                    <button tabIndex={0}
                      key={type}
                      title={!hasML ? 'Load ML export in Settings for media data' : undefined}
                      style={{
                        display: 'inline-flex', alignItems: 'center', gap: 5,
                        height: 28, padding: '0 10px', borderRadius: 6,
                        fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
                        cursor: 'default', border: '1.5px solid',
                        ...(state === 'has' ? {
                          background: 'var(--sr-accent-bg)',
                          borderColor: 'var(--sr-accent-border)',
                          color: 'var(--sr-accent)',
                        } : {
                          background: 'var(--sr-surface-subtle)',
                          borderColor: 'var(--sr-border)',
                          color: 'var(--sr-text-muted)',
                        }),
                      }}
                    >
                      <Icon size={12} strokeWidth={2.2} />
                      {type}
                    </button>
                  )
                })}

                {/* Breeding category pill */}
                {breedingPill && (
                  <span style={{
                    display: 'inline-flex', alignItems: 'center', gap: 5,
                    height: 28, padding: '0 10px', borderRadius: 6,
                    fontSize: '0.75rem', fontWeight: 600,
                    background: `rgba(var(--sr-tier-${breedingPill.tier}-rgb), 0.08)`,
                    border: `1px solid rgba(var(--sr-tier-${breedingPill.tier}-rgb), 0.2)`,
                    color: `var(--sr-tier-${breedingPill.tier}-fg)`,
                  }}>
                    <span style={{
                      width: 7, height: 7, borderRadius: '50%', flexShrink: 0,
                      background: TIER_COLORS[breedingPill.tier],
                    }} />
                    {breedingPill.category}
                  </span>
                )}
              </div>
            </div>
          </SectionCard>

          {/* Sightings + Media two-column grid */}
          <div className="sr-two-col">

            {/* Sightings */}
            <SectionCard>
              <SectionHead icon={<Eye size={14} strokeWidth={2.2} />} title="Sightings" />
              <div style={{ padding: '16px 18px' }}>
                {(() => {
                  const frequencyPct = totalFilteredChecklists > 0
                    ? (sightingsStats.total / totalFilteredChecklists) * 100
                    : null
                  const frequencyDisplay = frequencyPct === null ? null
                    : frequencyPct < 1 ? '<1%'
                    : `${Math.round(frequencyPct)}%`
                  return (
                <div className="sr-grid-2" style={{ ['--sr-grid-gap' as string]: '12px' }}>
                  <div>
                    <StatLabel>Checklists</StatLabel>
                    <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)' }}>
                      {sightingsStats.total}
                    </div>
                  </div>
                  <div>
                    <StatLabel>Individuals</StatLabel>
                    {sightingsStats.totalIndividuals !== null ? (
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)' }}>
                        {sightingsStats.totalIndividuals}
                      </div>
                    ) : (
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sr-text-muted)' }}>-</div>
                    )}
                  </div>
                  {frequencyDisplay !== null && (
                    <div style={{ borderLeft: '1.5px solid var(--sr-border-subtle)', paddingLeft: 12 }}>
                      <StatLabel>Frequency</StatLabel>
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, letterSpacing: '-0.02em', lineHeight: 1.1, color: 'var(--sr-accent)' }}>
                        {frequencyDisplay}
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>of your checklists</div>
                      <div style={{
                        height: 3, borderRadius: 2, marginTop: 6,
                        background: 'var(--sr-border)',
                        overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', borderRadius: 2,
                          background: 'var(--sr-accent)',
                          width: `${Math.min(frequencyPct ?? 0, 100)}%`,
                        }} />
                      </div>
                    </div>
                  )}
                  <div style={{ gridColumn: '1 / -1' }}>
                    <StatLabel>Personal best</StatLabel>
                    {sightingsStats.bestObs ? (
                      <StatValueLink value={String(sightingsStats.bestCount)} submissionId={sightingsStats.bestObs.submissionId} />
                    ) : (
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sr-text-muted)' }}>-</div>
                    )}
                  </div>
                  <div>
                    <StatLabel>First seen</StatLabel>
                    <StatValueLink
                      value={formatDate(sightingsStats.firstObs.date)}
                      submissionId={sightingsStats.firstObs.submissionId}
                      small
                    />
                  </div>
                  <div>
                    <StatLabel>Last seen</StatLabel>
                    <StatValueLink
                      value={formatDate(sightingsStats.lastObs.date)}
                      submissionId={sightingsStats.lastObs.submissionId}
                      small
                    />
                  </div>
                </div>
                  )
                })()}
              </div>
            </SectionCard>

            {/* Media Statistics */}
            <SectionCard>
              <SectionHead icon={<Image size={14} strokeWidth={2.2} />} title="Media" />
              <div style={{ padding: '16px 18px' }}>
                {!hasML ? (
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, color: 'var(--sr-text-muted)' }}>
                    <span style={{ fontSize: '0.8125rem', lineHeight: 1.5 }}>
                      Load your ML export in Settings to see media statistics.
                    </span>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {(['Photo', 'Audio', 'Video'] as MediaType[]).map(type => {
                      const Icon = type === 'Photo' ? Image : type === 'Audio' ? Mic : Video
                      const count = mediaCounts[type]
                      const link = mlCatalogLink(type, mediaLinkTaxonCode, userId)
                      return (
                        <div key={type} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div style={{
                            width: 22, height: 22, borderRadius: 5, flexShrink: 0,
                            background: 'var(--sr-surface-subtle)',
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            color: 'var(--sr-text-muted)',
                          }}>
                            <Icon size={11} strokeWidth={2.2} />
                          </div>
                          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)', flex: 1 }}>{type}s</span>
                          {count > 0 ? (
                            <a
                              href={link}
                              target="_blank"
                              rel="noreferrer"
                              aria-label={`${count} ${type.toLowerCase()} on the Macaulay Library (opens in a new tab)`}
                              style={{
                                fontSize: '0.84375rem', fontWeight: 600, color: 'var(--sr-accent)',
                                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {count}
                              <ExternalLink size={10} strokeWidth={2.5} aria-hidden="true" />
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.84375rem', fontWeight: 500, color: 'var(--sr-text-muted)' }}>0</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </SectionCard>
          </div>

          </>)}

          {/* Graph Options */}
          {hasGraphData && (() => {
            const btnBase: React.CSSProperties = {
              padding: '5px 13px', border: 'none', borderRadius: 5, fontSize: '0.75rem',
              fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
            }
            const btnActive: React.CSSProperties = {
              ...btnBase, background: 'var(--sr-surface)', color: 'var(--sr-text)',
              boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
            }
            const btnInactive: React.CSSProperties = {
              ...btnBase, background: 'transparent', color: 'var(--sr-text-muted)',
            }
            return (
              <SectionCard>
                <SectionHead icon={<SlidersHorizontal size={14} strokeWidth={2.2} />} title="Graph Options" />
                <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 24, flexWrap: 'wrap' }}>
                  <div role="group" aria-label="Graph interval" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
                      Interval
                    </span>
                    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--sr-surface-subtle)', borderRadius: 7, padding: 2 }}>
                      {(['weekly', 'monthly', 'yearly'] as const).map(v => (
                        <button key={v} tabIndex={0} aria-pressed={graphInterval === v} onClick={() => setGraphInterval(v)} style={graphInterval === v ? btnActive : btnInactive}>
                          {v === 'weekly' ? 'Weekly' : v === 'monthly' ? 'Monthly' : 'Yearly'}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div role="group" aria-label="Graph view mode" style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
                      View
                    </span>
                    <div style={{ display: 'inline-flex', gap: 2, background: 'var(--sr-surface-subtle)', borderRadius: 7, padding: 2 }}>
                      {(['per-period', 'cumulative'] as const).map(v => (
                        <button key={v} tabIndex={0} aria-pressed={viewMode === v} onClick={() => setViewMode(v)} style={viewMode === v ? btnActive : btnInactive}>
                          {v === 'per-period' ? 'Per Period' : 'Cumulative'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              </SectionCard>
            )
          })()}

          {/* Sightings Over Time + Checklists Over Time + Media Over Time graphs */}
          <SightingsGraph data={graphResult.data} interval={graphResult.interval} viewMode={viewMode} hasML={hasML} />

          {/* Breeding Codes */}
          <SectionCard>
            <SectionHead icon={<Dna size={14} strokeWidth={2.2} />} title="Breeding Codes" />
            <div style={{ padding: breedingBreakdown.length ? '4px 18px' : '16px 18px' }}>
              {breedingBreakdown.length === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>No breeding codes recorded.</span>
              ) : (
                breedingBreakdown.map(({ code, tier, label, count }, idx) => (
                  <div key={code} style={{
                    display: 'flex', alignItems: 'center', gap: 10,
                    padding: '9px 0',
                    borderBottom: idx < breedingBreakdown.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                  }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: TIER_COLORS[tier] }} />
                    <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sr-text)', minWidth: 28, fontFamily: 'inherit' }}>{code}</span>
                    <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', flex: 1, minWidth: 0, overflowWrap: 'anywhere' }}>{label}</span>
                    <span style={{
                      fontSize: '0.75rem', fontWeight: 500, color: 'var(--sr-text-muted)',
                      background: 'var(--sr-surface-subtle)', padding: '2px 8px', borderRadius: 10, whiteSpace: 'nowrap',
                    }}>
                      {count} {count === 1 ? 'time' : 'times'}
                    </span>
                  </div>
                ))
              )}
            </div>
          </SectionCard>

          {/* Reported With */}
          {coOccurrence && (
            <SectionCard>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: '14px 18px 12px',
                borderBottom: '1px solid var(--sr-border-subtle)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <Share2 size={14} strokeWidth={2.2} />
                </div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Reported With</span>
                {coOccurrence.type === 'results' && (
                  <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>
                    of {coOccurrence.totalChecklists} checklists
                  </span>
                )}
              </div>

              {coOccurrence.type === 'no-data' ? (
                <div style={{ padding: '16px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                  No checklist data available.
                </div>
              ) : coOccurrence.results.length === 0 ? (
                <div style={{ padding: '16px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                  No species met the minimum co-occurrence threshold.
                </div>
              ) : (() => {
                const maxPct = coOccurrence.results[0]?.pct ?? 1
                const visible = showAllCoOccurrence
                  ? coOccurrence.results
                  : coOccurrence.results.slice(0, 10)
                return (
                  <div style={{ padding: '0 18px' }}>
                    {/* Wide row layout (rank + name + 100px bar + rate + checklists ≈ 282px
                        of fixed cells) crushes the name column on phones; the wrapper
                        scrolls horizontally instead (house wideMode pattern). */}
                    <div className="sr-scroll-x">
                    {/* Column headers */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10, minWidth: 320,
                      padding: '8px 0 6px', borderBottom: '1px solid var(--sr-border-subtle)', marginBottom: 2,
                    }}>
                      <span style={{ width: 20, flexShrink: 0 }} />
                      <span style={{ flex: 1, minWidth: 80, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)' }}>Species</span>
                      <span style={{ width: 100, flexShrink: 0 }} />
                      <span style={{ width: 38, textAlign: 'right' as const, flexShrink: 0, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)' }}>Rate</span>
                      <span style={{ width: 84, textAlign: 'right' as const, flexShrink: 0, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)' }}>Checklists</span>
                    </div>
                    {/* Rows */}
                    {visible.map((r, idx) => (
                      <div key={r.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10, minWidth: 320,
                        padding: '9px 0',
                        borderBottom: idx < visible.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                      }}>
                        <span style={{ width: 20, textAlign: 'right' as const, fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0 }}>
                          {idx + 1}
                        </span>
                        <span style={{ flex: 1, minWidth: 80 }}>
                          <BirdName commonName={r.name} taxonCode={taxonCodeFor(r.name)} hasEntry onOpenSpecies={openSpeciesInTab} />
                        </span>
                        <div style={{ width: 100, height: 5, background: 'var(--sr-surface-subtle)', borderRadius: 3, flexShrink: 0, overflow: 'hidden' }}>
                          <div style={{ height: '100%', borderRadius: 3, background: 'var(--sr-accent)', opacity: 0.55, width: `${Math.round((r.pct / maxPct) * 100)}%` }} />
                        </div>
                        <span style={{ width: 38, textAlign: 'right' as const, fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-accent)', flexShrink: 0 }}>
                          {r.pct}%
                        </span>
                        <span style={{ width: 84, textAlign: 'right' as const, fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0 }}>
                          {r.count} {r.count === 1 ? 'checklist' : 'checklists'}
                        </span>
                      </div>
                    ))}
                    </div>
                    {/* Expand / collapse */}
                    {coOccurrence.results.length > 10 && (
                      <button tabIndex={0}
                        onClick={() => setShowAllCoOccurrence(prev => !prev)}
                        style={{
                          display: 'flex', alignItems: 'center', justifyContent: 'center',
                          width: '100%', padding: '10px 0 4px',
                          border: 'none', background: 'none',
                          fontSize: '0.75rem', fontWeight: 500, color: 'var(--sr-accent)',
                          fontFamily: 'inherit', cursor: 'pointer',
                        }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {showAllCoOccurrence
                          ? 'Show top 10'
                          : `Show all ${coOccurrence.results.length} species`}
                      </button>
                    )}
                  </div>
                )
              })()}
            </SectionCard>
          )}

          {/* Top Locations */}
          <SectionCard>
            <SectionHead icon={<MapPin size={14} strokeWidth={2.2} />} title="Top Locations" />
            <div style={{ padding: locationsSorted.length ? '4px 18px' : '16px 18px' }}>
              {locationsSorted.length === 0 ? (
                <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>No location data found.</span>
              ) : (
                <>
                  {(showAllLocations ? locationsSorted : locationsSorted.slice(0, 10)).map(({ location, locationId, count }, idx) => {
                    const visibleCount = showAllLocations ? locationsSorted.length : Math.min(locationsSorted.length, 10)
                    return (
                      <div key={`${locationId || location}-${idx}`} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 0',
                        borderBottom: idx < visibleCount - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                      }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', minWidth: 22, flexShrink: 0, textAlign: 'right' }}>
                          {idx + 1}.
                        </span>
                        <HotspotLink
                          locId={locationId}
                          name={location}
                          isHotspot={isHotspot(locationId)}
                          truncate
                          style={{ fontSize: '0.8125rem', flex: 1 }}
                        />
                        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap', flexShrink: 0 }}>
                          {count} {count === 1 ? 'sighting' : 'sightings'}
                        </span>
                      </div>
                    )
                  })}

                  {locationsSorted.length > 10 && (
                    <button tabIndex={0}
                      onClick={() => setShowAllLocations(prev => !prev)}
                      style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                        width: '100%', padding: '13px 18px',
                        border: 'none', borderTop: '1px solid var(--sr-border-subtle)',
                        background: 'var(--sr-surface-faint)',
                        fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-accent)',
                        fontFamily: 'inherit', cursor: 'pointer',
                      }}
                      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-accent-bg)')}
                      onMouseLeave={e => (e.currentTarget.style.background = 'var(--sr-surface-faint)')}
                    >
                      <ChevronDown
                        size={13}
                        strokeWidth={2.5}
                        style={{ transform: showAllLocations ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                      />
                      {showAllLocations ? 'Show top 10' : `Show all ${locationsSorted.length} locations`}
                    </button>
                  )}
                </>
              )}
            </div>
          </SectionCard>

          {/* Sighting Locations Map */}
          {coordMarkers.length > 0 && (
            <SectionCard>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
                padding: '14px 18px 12px',
                borderBottom: '1px solid var(--sr-border-subtle)',
              }}>
                <div style={{
                  width: 28, height: 28, borderRadius: 7, flexShrink: 0,
                  background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                }}>
                  <MapPin size={14} strokeWidth={2.2} />
                </div>
                <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Sighting Locations</span>
                <div role="group" aria-label="Map display mode" style={{
                  marginLeft: 'auto', display: 'inline-flex', gap: 2,
                  background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2,
                }}>
                  {(['pins', 'heatmap'] as const).map((mode) => (
                    <button tabIndex={0}
                      key={mode}
                      aria-pressed={mapMode === mode}
                      onClick={() => setMapMode(mode)}
                      className="sr-touch-target"
                      style={{
                        padding: '4px 10px', border: 'none', borderRadius: 4, fontSize: '0.6875rem',
                        fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer', transition: 'all 0.15s',
                        background: mapMode === mode ? 'var(--sr-surface)' : 'transparent',
                        color: mapMode === mode ? 'var(--sr-text)' : 'var(--sr-text-muted)',
                        boxShadow: mapMode === mode ? '0 1px 2px rgba(0,0,0,0.08)' : 'none',
                      }}
                    >
                      {mode === 'pins' ? 'Pins' : 'Heatmap'}
                    </button>
                  ))}
                </div>
              </div>
              {mapMode === 'heatmap' && (
                <div style={{ padding: '10px 18px', borderBottom: '1px solid var(--sr-border-subtle)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: 'var(--sr-text-muted)', textTransform: 'uppercase', letterSpacing: '0.04em' }}>Heatmap Intensity</span>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{heatIntensity}</span>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={10}
                    step={1}
                    value={heatIntensity}
                    onChange={e => setHeatIntensity(Number(e.target.value))}
                    aria-label="Heatmap intensity"
                    style={{ width: '100%', accentColor: 'var(--sr-accent)', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>
                    <span>Tighter</span>
                    <span>Broader</span>
                  </div>
                </div>
              )}
              <div className="sr-map-container">
                {/* Pins mode: the shared SightingsMap owns the markers + popup +
                    its own MapBoundsFitter. Heatmap mode keeps its inline SnowMap
                    with the HeatmapLayer and a top-level MapBoundsFitter, so the
                    fitter runs in BOTH modes. */}
                {mapMode === 'pins' ? (
                  <SightingsMap markers={coordMarkers} switcher />
                ) : (
                  <SnowMap
                    initialViewState={{ longitude: uniqueCoords[0]?.[1] ?? 0, latitude: uniqueCoords[0]?.[0] ?? 0, zoom: 5 }}
                    style={{ height: '100%', width: '100%' }}
                    switcher
                    scrollZoom={false}
                    // Heatmap-mode branch of the same page-embedded Sighting
                    // Locations map — parity with the pins-mode SightingsMap:
                    // two-finger pan on touch so a thumb-scroll moves the page.
                    cooperativeGestures
                  >
                    <HeatmapLayer points={heatPoints} intensity={heatIntensity} />
                    <MapBoundsFitter coordinates={uniqueCoords} />
                  </SnowMap>
                )}
              </div>
            </SectionCard>
          )}

          {/* Comments */}
          <SectionCard>
            <SectionHead icon={<MessageSquare size={14} strokeWidth={2.2} />} title="Comments" />

            {/* Controls */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
              padding: '12px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
              background: 'var(--sr-surface-faint)',
            }}>
              {/* Keyword filter */}
              <div style={{ position: 'relative', flex: 1, minWidth: 160 }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-muted)', pointerEvents: 'none' }}>
                  <Search size={12} strokeWidth={2.5} />
                </span>
                <input
                  type="text"
                  value={commentFilter}
                  onChange={e => setCommentFilter(e.target.value)}
                  placeholder="Filter comments…"
                  aria-label="Filter comments"
                  style={{
                    width: '100%', height: 32, padding: '0 10px 0 30px',
                    border: '1.5px solid var(--sr-border)', borderRadius: 6,
                    fontSize: '0.8125rem', fontFamily: 'inherit', color: 'var(--sr-text)',
                    background: 'var(--sr-surface)',
                  }}
                  onFocus={e => (e.currentTarget.style.borderColor = 'var(--sr-accent)')}
                  onBlur={e => (e.currentTarget.style.borderColor = 'var(--sr-border)')}
                />
              </div>

              {/* Sort toggle */}
              <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }}>
                {(['newest', 'oldest'] as const).map((dir, i) => (
                  <button tabIndex={0}
                    key={dir}
                    onClick={() => setCommentSort(dir)}
                    style={{
                      height: 32, padding: '0 12px',
                      border: 'none',
                      borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
                      background: commentSort === dir ? 'var(--sr-accent-bg)' : 'transparent',
                      color: commentSort === dir ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                      fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
                    }}
                  >
                    {dir === 'newest' ? 'Newest' : 'Oldest'}
                  </button>
                ))}
              </div>

              <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 500, flexShrink: 0 }}>
                {allComments.length} {allComments.length === 1 ? 'comment' : 'comments'}
              </span>
            </div>

            {/* Comment rows */}
            {allComments.length === 0 ? (
              <div style={{ padding: '16px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                {commentFilter.trim()
                  ? 'No comments match this filter.'
                  : 'No species comments found.'}
              </div>
            ) : (
              <>
                {(showAllComments ? allComments : allComments.slice(0, COMMENTS_PAGE)).map((o, idx, arr) => (
                  <div
                    key={`${o.submissionId}-${idx}`}
                    style={{
                      padding: '14px 18px',
                      borderBottom: idx < arr.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                      <ChecklistLink
                        submissionId={o.submissionId}
                        label={formatDate(o.date)}
                        style={{ fontSize: '0.75rem', fontWeight: 600 }}
                      />
                      <span style={{ fontSize: '0.75rem', color: 'var(--sr-gray-300)' }}>·</span>
                      <HotspotLink
                        locId={o.locationId}
                        name={o.location}
                        isHotspot={isHotspot(o.locationId)}
                        className="sr-wrap-anywhere"
                        style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}
                      />
                    </div>
                    <div className="sr-wrap-anywhere" style={{ fontSize: '0.84375rem', color: 'var(--sr-text)', lineHeight: 1.55 }}>
                      {o.speciesComments}
                    </div>
                  </div>
                ))}

                {allComments.length > COMMENTS_PAGE && (
                  <button tabIndex={0}
                    onClick={() => setShowAllComments(prev => !prev)}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6,
                      width: '100%', padding: '13px 18px',
                      border: 'none', borderTop: '1px solid var(--sr-border-subtle)',
                      background: 'var(--sr-surface-faint)',
                      fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-accent)',
                      fontFamily: 'inherit', cursor: 'pointer',
                    }}
                    onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-accent-bg)')}
                    onMouseLeave={e => (e.currentTarget.style.background = 'var(--sr-surface-faint)')}
                  >
                    <ChevronDown
                      size={13}
                      strokeWidth={2.5}
                      style={{ transform: showAllComments ? 'rotate(180deg)' : 'none', transition: 'transform 0.15s' }}
                    />
                    {showAllComments ? 'Show fewer' : `Show all ${allComments.length} comments`}
                  </button>
                )}
              </>
            )}
          </SectionCard>

          {/* Named Individuals — birds named in this species' comments via [name:…] */}
          {namedIndividuals.length > 0 && (
            <SectionCard>
              <SectionHead icon={<Tag size={14} strokeWidth={2.2} />} title="Named Individuals" />
              <div style={{ padding: '16px 18px' }}>
                <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Individuals you've named in this species' checklist comments with a <code style={{ fontFamily: 'ui-monospace, monospace', fontSize: '0.6875rem', color: 'var(--sr-text)' }}>[name:…]</code> tag. The full cross-species list is on the Named Birds tab.
                </p>
                <NamedBirdsTable birds={namedIndividuals} showSpecies={false} embedAllowed={embedAllowed} />
              </div>
            </SectionCard>
          )}

          {/* Recent Media — at bottom, only when ML is loaded and species has ≥1 catalog item */}
          {hasML && (['Photo', 'Audio', 'Video'] as MediaType[]).some(t => recentMediaIds[t] !== null) && (
            <SectionCard>
              <SectionHead icon={<Play size={14} strokeWidth={2.2} />} title="Recent Media" />
              <div style={{ padding: '16px 18px' }}>
                <div className="sr-media-grid">
                  {(['Photo', 'Audio', 'Video'] as MediaType[]).map(type => {
                    const id = recentMediaIds[type]
                    if (!id) return null
                    const row = mediaRowById.get(id)
                    return <RecentMediaEmbed key={type} id={id} type={type} species={selectedSpecies} date={row?.date} checklistId={row?.checklistId} embedAllowed={embedAllowed} />
                  })}
                </div>
              </div>
            </SectionCard>
          )}

        </div>
      )}

      {/* Suppress unused-variable warning for observations */}
      <span style={{ display: 'none' }}>{observations.length}</span>
    </div>
  )
}
