import { Marker, Popup } from 'react-map-gl/maplibre'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle, Loader2, ChevronDown,
  Search, ExternalLink, Check, Image, Mic, Video, Eye, MessageSquare, Dna,
  MapPin, Play, Calendar, SlidersHorizontal, Share2,
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
import { BirdName } from './BirdName'
import type { ObservationEntry, MediaType } from '../types'
import { normalizeSpeciesName, isSpuhOrSlash } from '../lib/speciesUtils'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'
import { formatDate } from '../lib/formatDate'
import { HEAT_INTENSITY_DEFAULT, heatWeight } from '../lib/heat'
import { smoothScrollIntoView } from '../lib/scroll'
import { SnowMap } from './SnowMap'
import { extractUserId, mlCatalogLink } from '../lib/mlCatalog'
import { SectionCard, SectionHead, StatLabel, StatValueLink, SUBMISSION_ID_RE } from './speciesDetail/ui'
import { SightingsGraph } from './speciesDetail/SightingsGraph'
import { HeatmapLayer } from './speciesDetail/HeatmapLayer'
import { MapBoundsFitter } from './speciesDetail/MapBoundsFitter'

// ── Types ──────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Map<string, MediaType>; mlRows: MLExportRow[]; hasML: boolean; userId: string | null }

type CoordMarker = {
  lat: number
  lng: number
  sightings: { submissionId: string; date: string }[]
}

const COMMENTS_PAGE = 10

// Location pin (teardrop) for the Sighting Locations map. Rendered into a
// react-map-gl <Marker anchor="bottom"> so the tip lands on the coordinate.
// Brand-accent fill via CSS var (resolves at paint time in the DOM overlay).
const SP_PIN_HTML = '<svg viewBox="0 0 28 40" width="24" height="34" xmlns="http://www.w3.org/2000/svg"><path d="M14 0C6.268 0 0 6.268 0 14c0 5.47 3.078 10.23 7.602 12.651L14 40l6.398-13.349A13.944 13.944 0 0028 14C28 6.268 21.732 0 14 0z" style="fill:var(--sr-accent)"/><circle cx="14" cy="14" r="5" fill="white"/></svg>'

// ── Main component ─────────────────────────────────────────────────────────

export function SpeciesDetail({ onGoToSettings, filesVersion, requestedSpecies, onRequestedSpeciesConsumed }: { onGoToSettings: () => void; filesVersion?: number; requestedSpecies?: string; onRequestedSpeciesConsumed?: () => void }) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [taxonOrders, setTaxonOrders] = useState<Record<string, number>>({})
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [selectedSpecies, setSelectedSpecies] = useState<string | null>(null)
  const [selectorQuery, setSelectorQuery] = useState('')
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const [activeOptionIdx, setActiveOptionIdx] = useState(-1)

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
  const [selectedCoord, setSelectedCoord] = useState<string | null>(null)
  const [graphInterval, setGraphInterval] = useState<'weekly' | 'monthly' | 'yearly'>('monthly')
  const [viewMode, setViewMode] = useState<'per-period' | 'cumulative'>('per-period')
  const [showAllCoOccurrence, setShowAllCoOccurrence] = useState(false)

  const selectorRef = useRef<HTMLDivElement>(null)
  const dropdownListRef = useRef<HTMLDivElement>(null)

  const selectSpecies = (name: string | null) => {
    setSelectedSpecies(name)
    setCommentFilter('')
    setCommentSort('newest')
    setShowAllComments(false)
    setShowAllLocations(false)
    setMapMode('pins')
    setHeatIntensity(HEAT_INTENSITY_DEFAULT)
    setSelectedCoord(null)
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

  // Close dropdown on outside click
  useEffect(() => {
    function onPointerDown(e: MouseEvent) {
      if (selectorRef.current && !selectorRef.current.contains(e.target as Node)) {
        setDropdownOpen(false)
        setActiveOptionIdx(-1)
      }
    }
    document.addEventListener('mousedown', onPointerDown)
    return () => document.removeEventListener('mousedown', onPointerDown)
  }, [])

  useEffect(() => {
    if (activeOptionIdx >= 0) {
      const el = document.getElementById(`species-option-${activeOptionIdx}`)
      el?.scrollIntoView({ block: 'nearest' })
    }
  }, [activeOptionIdx])

  const fetchTaxonData = async (obs: ObservationEntry[]) => {
    try {
      const seen = new Map<string, string>()
      for (const o of obs) {
        if (!seen.has(o.commonName)) seen.set(o.commonName, o.scientificName)
      }
      const species = [...seen.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
      const data = await transport.post<{ codes: Record<string, string>; orders: Record<string, number> }>(
        '/taxonomy/codes',
        { species }
      )
      setTaxonOrders(data.orders ?? {})
      setTaxonMap(data.codes ?? {})
    } catch {
      // silently fail — selector usable in A–Z; ML links omit taxonCode
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

  const filteredSpeciesList = useMemo(() => {
    const q = selectorQuery.trim().toLowerCase()
    if (!q) return displaySpeciesList
    return displaySpeciesList.filter(name => {
      if (name.toLowerCase().includes(q)) return true
      return (sciNameMap.get(name) ?? '').toLowerCase().includes(q)
    })
  }, [displaySpeciesList, selectorQuery, sciNameMap])

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

  // Map markers: one per unique lat/lng, with all sightings at that coordinate
  const coordMarkers = useMemo((): CoordMarker[] => {
    const markerMap = new Map<string, CoordMarker>()
    for (const o of speciesObs) {
      if (o.latitude === null || o.longitude === null) continue
      const key = `${o.latitude},${o.longitude}`
      const existing = markerMap.get(key)
      if (existing) {
        existing.sightings.push({ submissionId: o.submissionId, date: o.date })
      } else {
        markerMap.set(key, { lat: o.latitude, lng: o.longitude, sightings: [{ submissionId: o.submissionId, date: o.date }] })
      }
    }
    for (const m of markerMap.values()) {
      m.sightings.sort((a, b) => b.date.localeCompare(a.date))
    }
    return [...markerMap.values()]
  }, [speciesObs])

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

  // The pin whose popup is open (MapLibre uses one state-driven <Popup>, not a
  // popup bound to each marker as Leaflet did). Keyed by "lat,lng".
  const selectedMarker = selectedCoord ? coordMarkers.find(m => `${m.lat},${m.lng}` === selectedCoord) ?? null : null

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

  // Taxon code for selected species (merge-mode aware)
  const speciesTaxonCode = useMemo(() => {
    if (!selectedSpecies) return undefined
    const direct = taxonMap[selectedSpecies]
    if (direct) return direct
    if (mergeSubspecies) {
      for (const [key, code] of Object.entries(taxonMap)) {
        if (normalizeSpeciesName(key) === selectedSpecies) return code
      }
    }
    return undefined
  }, [selectedSpecies, taxonMap, mergeSubspecies])

  // ── Selector input display value ─────────────────────────────────────
  const selectorDisplayValue = dropdownOpen
    ? selectorQuery
    : (selectedSpecies ?? '')

  // ── Render ─────────────────────────────────────────────────────────────

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
        <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--sr-text-disabled)' }}>
          {displaySpeciesList.length} species
        </span>
      </div>

      {/* Species selector */}
      <div ref={selectorRef} style={{ position: 'relative', marginBottom: 16, flexShrink: 0, zIndex: 20 }}>
        <div style={{ position: 'relative' }}>
          <span style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-muted)', pointerEvents: 'none' }}>
            <Search size={15} strokeWidth={2} />
          </span>
          <input
            type="text"
            value={selectorDisplayValue}
            placeholder="Choose a species…"
            onChange={e => {
              setSelectorQuery(e.target.value)
              setActiveOptionIdx(-1)
              if (!dropdownOpen) setDropdownOpen(true)
            }}
            onFocus={() => {
              setSelectorQuery('')
              setActiveOptionIdx(-1)
              setDropdownOpen(true)
            }}
            onKeyDown={e => {
              if (e.key === 'Escape') { setDropdownOpen(false); setActiveOptionIdx(-1); (e.target as HTMLInputElement).blur() }
              if (e.key === 'Tab') { setDropdownOpen(false); setActiveOptionIdx(-1) }
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                if (!dropdownOpen) setDropdownOpen(true)
                setActiveOptionIdx(i => Math.min(i + 1, filteredSpeciesList.length - 1))
              }
              if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActiveOptionIdx(i => Math.max(i - 1, -1))
              }
              if (e.key === 'Enter' && dropdownOpen) {
                e.preventDefault()
                const target = activeOptionIdx >= 0 ? filteredSpeciesList[activeOptionIdx] : filteredSpeciesList[0]
                if (target) { selectSpecies(target); setSelectorQuery(''); setDropdownOpen(false); setActiveOptionIdx(-1) }
              }
            }}
            role="combobox"
            aria-label="Select species"
            aria-expanded={dropdownOpen}
            aria-autocomplete="list"
            aria-controls="species-listbox"
            aria-haspopup="listbox"
            aria-activedescendant={dropdownOpen && activeOptionIdx >= 0 ? `species-option-${activeOptionIdx}` : undefined}
            style={{
              width: '100%', height: 40, padding: '0 36px 0 38px',
              border: `1.5px solid ${dropdownOpen ? 'var(--sr-accent)' : 'var(--sr-border)'}`,
              borderRadius: dropdownOpen ? '8px 8px 0 0' : 8,
              borderBottomColor: dropdownOpen ? 'transparent' : undefined,
              fontSize: '0.875rem', fontWeight: selectedSpecies && !dropdownOpen ? 500 : 400,
              fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)',
              outline: 'none', transition: 'border-color 0.15s',
            }}
          />
          <span
            onClick={() => setDropdownOpen(o => !o)}
            style={{
              position: 'absolute', right: 11, top: '50%',
              transform: `translateY(-50%) rotate(${dropdownOpen ? 180 : 0}deg)`,
              transition: 'transform 0.15s', cursor: 'pointer',
              color: 'var(--sr-text-muted)', display: 'flex',
            }}
          >
            <ChevronDown size={16} strokeWidth={2} />
          </span>
        </div>

        {dropdownOpen && (
          <div
            ref={dropdownListRef}
            role="listbox"
            id="species-listbox"
            style={{
              position: 'absolute', top: '100%', left: 0, right: 0,
              background: 'var(--sr-surface)',
              border: '1.5px solid var(--sr-accent)',
              borderTop: 'none', borderRadius: '0 0 8px 8px',
              boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
              maxHeight: 260, overflowY: 'auto',
            }}
          >
            {filteredSpeciesList.length === 0 ? (
              <div style={{ padding: '12px 14px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
                No species match this search.
              </div>
            ) : (
              filteredSpeciesList.map((name, idx) => {
                const isSelected = name === selectedSpecies
                const isActive = idx === activeOptionIdx
                return (
                  <div
                    key={name}
                    id={`species-option-${idx}`}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      selectSpecies(name)
                      setSelectorQuery('')
                      setDropdownOpen(false)
                      setActiveOptionIdx(-1)
                    }}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '9px 14px', cursor: 'pointer',
                      background: isActive ? 'var(--sr-accent-bg-hover)' : isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                      outline: isActive ? `2px solid var(--sr-accent)` : 'none',
                      outlineOffset: '-2px',
                    }}
                    onMouseEnter={e => { if (!isSelected && !isActive) (e.currentTarget as HTMLDivElement).style.background = 'var(--sr-surface-subtle)' }}
                    onMouseLeave={e => { if (!isSelected && !isActive) (e.currentTarget as HTMLDivElement).style.background = 'transparent' }}
                  >
                    <span style={{ width: 16, flexShrink: 0, color: 'var(--sr-accent)' }}>
                      {isSelected && <Check size={13} strokeWidth={3} />}
                    </span>
                    <span style={{ fontSize: '0.84375rem', fontWeight: 500, color: isSelected ? 'var(--sr-accent)' : 'var(--sr-text)', flex: 1 }}>
                      {name}
                    </span>
                    <span style={{ fontSize: '0.6875rem', fontStyle: 'italic', color: 'var(--sr-text-disabled)' }}>
                      {sciNameMap.get(name)}
                    </span>
                  </div>
                )
              })
            )}
          </div>
        )}
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
              value={countyFilter ?? ''}
              onChange={e => setCountyFilter(e.target.value || null)}
              style={{
                height: 26, paddingLeft: 24, paddingRight: 22, borderRadius: 5,
                border: countyFilter ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                background: countyFilter ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit',
                cursor: 'pointer', appearance: 'none', WebkitAppearance: 'none', outline: 'none',
              }}
            >
              <option value="">All Counties</option>
              {counties.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <span style={{ position: 'absolute', right: 6, pointerEvents: 'none', color: countyFilter ? 'var(--sr-accent)' : 'var(--sr-text-muted)', fontSize: '0.5625rem' }}>▾</span>
          </div>

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
                  fontSize: '0.75rem', fontFamily: 'inherit', outline: 'none',
                }}
              />
            </div>
            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>→</span>
            <input
              type="date"
              value={dateRange.to}
              onChange={e => setDateRange(prev => ({ ...prev, to: e.target.value }))}
              style={{
                height: 26, paddingLeft: 8, paddingRight: 6, borderRadius: 5,
                border: dateRange.to ? '1.5px solid var(--sr-accent-border-strong)' : '1.5px solid var(--sr-border)',
                background: dateRange.to ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                color: dateRange.to ? 'var(--sr-accent)' : 'var(--sr-text-disabled)',
                fontSize: '0.75rem', fontFamily: 'inherit', outline: 'none',
              }}
            />
          </div>

          {hasLocationFilter && (
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
            <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text-disabled)', marginTop: 4 }}>
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
            const baseCount = mergeSubspecies
              ? observations.filter((o: ObservationEntry) => normalizeSpeciesName(o.commonName) === selectedSpecies).length
              : observations.filter((o: ObservationEntry) => o.commonName === selectedSpecies).length
            parts.push(`Showing ${speciesObs.length} of ${baseCount} checklists`)
            return (
              <div style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                padding: '7px 14px',
                background: 'var(--sr-accent-bg)', borderRadius: 6,
                fontSize: '0.75rem', color: 'var(--sr-accent)',
              }}>
                <span style={{ fontWeight: 500 }}>{parts.join(' · ')}</span>
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
            <div style={{ padding: '20px 22px 18px' }}>
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
                          color: 'var(--sr-text-disabled)',
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
                    color: TIER_COLORS[breedingPill.tier],
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sr-text-disabled)' }}>—</div>
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
                      <div style={{ fontSize: '1.25rem', fontWeight: 700, color: 'var(--sr-text-disabled)' }}>—</div>
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
                      const link = mlCatalogLink(type, speciesTaxonCode, userId)
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
                              style={{
                                fontSize: '0.84375rem', fontWeight: 600, color: 'var(--sr-accent)',
                                textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3,
                              }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {count}
                              <ExternalLink size={10} strokeWidth={2.5} />
                            </a>
                          ) : (
                            <span style={{ fontSize: '0.84375rem', fontWeight: 500, color: 'var(--sr-text-disabled)' }}>0</span>
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
                  <div role="group" aria-label="Graph interval" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                  <div role="group" aria-label="Graph view mode" style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
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
                    <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', flex: 1 }}>{label}</span>
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
                  <span style={{ marginLeft: 'auto', fontSize: '0.6875rem', color: 'var(--sr-text-disabled)' }}>
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
                    {/* Column headers */}
                    <div style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 0 6px', borderBottom: '1px solid var(--sr-border-subtle)', marginBottom: 2,
                    }}>
                      <span style={{ width: 20, flexShrink: 0 }} />
                      <span style={{ flex: 1, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-disabled)' }}>Species</span>
                      <span style={{ width: 100, flexShrink: 0 }} />
                      <span style={{ width: 38, textAlign: 'right' as const, flexShrink: 0, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-disabled)' }}>Rate</span>
                      <span style={{ width: 84, textAlign: 'right' as const, flexShrink: 0, fontSize: '0.625rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-disabled)' }}>Checklists</span>
                    </div>
                    {/* Rows */}
                    {visible.map((r, idx) => (
                      <div key={r.name} style={{
                        display: 'flex', alignItems: 'center', gap: 10,
                        padding: '9px 0',
                        borderBottom: idx < visible.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none',
                      }}>
                        <span style={{ width: 20, textAlign: 'right' as const, fontSize: '0.6875rem', color: 'var(--sr-text-disabled)', flexShrink: 0 }}>
                          {idx + 1}
                        </span>
                        <span style={{ flex: 1, minWidth: 0 }}>
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
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-disabled)', minWidth: 22, flexShrink: 0, textAlign: 'right' }}>
                          {idx + 1}.
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--sr-text)', flex: 1 }}>{location}</span>
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
                display: 'flex', alignItems: 'center', gap: 8,
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
                <div style={{
                  marginLeft: 'auto', display: 'inline-flex', gap: 2,
                  background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2,
                }}>
                  {(['pins', 'heatmap'] as const).map((mode) => (
                    <button tabIndex={0}
                      key={mode}
                      onClick={() => { setMapMode(mode); setSelectedCoord(null) }}
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
                <SnowMap
                  initialViewState={{ longitude: uniqueCoords[0]?.[1] ?? 0, latitude: uniqueCoords[0]?.[0] ?? 0, zoom: 5 }}
                  style={{ height: '100%', width: '100%' }}
                  switcher
                  scrollZoom={false}
                >
                  {mapMode === 'pins' && coordMarkers.map(m => (
                    <Marker key={`${m.lat},${m.lng}`} longitude={m.lng} latitude={m.lat} anchor="bottom"
                      onClick={e => { e.originalEvent.stopPropagation(); setSelectedCoord(`${m.lat},${m.lng}`) }}>
                      <div style={{ width: 24, height: 34, cursor: 'pointer' }} dangerouslySetInnerHTML={{ __html: SP_PIN_HTML }} />
                    </Marker>
                  ))}
                  {mapMode === 'pins' && selectedMarker && (
                    <Popup longitude={selectedMarker.lng} latitude={selectedMarker.lat} anchor="bottom" offset={36} onClose={() => setSelectedCoord(null)} closeButton={false} maxWidth="260px">
                      <div style={{ fontSize: '0.8125rem', lineHeight: 1.7, minWidth: 120 }}>
                        {selectedMarker.sightings.slice(0, 6).map(({ submissionId, date }, i) => (
                          <div key={`${submissionId}-${i}`}>
                            {SUBMISSION_ID_RE.test(submissionId) ? (
                              <a
                                href={`https://ebird.org/checklist/${submissionId}`}
                                target="_blank"
                                rel="noreferrer"
                                style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}
                                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                              >
                                {formatDate(date)}
                              </a>
                            ) : (
                              <span>{formatDate(date)}</span>
                            )}
                          </div>
                        ))}
                        {selectedMarker.sightings.length > 6 && (
                          <div style={{ color: 'var(--sr-text-muted)', marginTop: 2, fontSize: '0.75rem' }}>
                            +{selectedMarker.sightings.length - 6} more
                          </div>
                        )}
                      </div>
                    </Popup>
                  )}
                  {mapMode === 'heatmap' && <HeatmapLayer points={heatPoints} intensity={heatIntensity} />}
                  <MapBoundsFitter coordinates={uniqueCoords} />
                </SnowMap>
              </div>
            </SectionCard>
          )}

          {/* Comments */}
          <SectionCard>
            <SectionHead icon={<MessageSquare size={14} strokeWidth={2.2} />} title="Comments" />

            {/* Controls */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              padding: '12px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
              background: 'var(--sr-surface-faint)',
            }}>
              {/* Keyword filter */}
              <div style={{ position: 'relative', flex: 1 }}>
                <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-disabled)', pointerEvents: 'none' }}>
                  <Search size={12} strokeWidth={2.5} />
                </span>
                <input
                  type="text"
                  value={commentFilter}
                  onChange={e => setCommentFilter(e.target.value)}
                  placeholder="Filter comments…"
                  style={{
                    width: '100%', height: 32, padding: '0 10px 0 30px',
                    border: '1.5px solid var(--sr-border)', borderRadius: 6,
                    fontSize: '0.8125rem', fontFamily: 'inherit', color: 'var(--sr-text)',
                    background: 'var(--sr-surface)', outline: 'none',
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

              <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)', fontWeight: 500, flexShrink: 0 }}>
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
                      {SUBMISSION_ID_RE.test(o.submissionId) ? (
                        <a
                          href={`https://ebird.org/checklist/${o.submissionId}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                          onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                          onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                        >
                          {formatDate(o.date)}
                          <ExternalLink size={10} strokeWidth={2.5} />
                        </a>
                      ) : (
                        <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-text)' }}>{formatDate(o.date)}</span>
                      )}
                      <span style={{ fontSize: '0.75rem', color: 'var(--sr-gray-300)' }}>·</span>
                      <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{o.location}</span>
                    </div>
                    <div style={{ fontSize: '0.84375rem', color: 'var(--sr-text)', lineHeight: 1.55 }}>
                      {o.speciesComments}
                    </div>
                  </div>
                ))}

                {!showAllComments && allComments.length > COMMENTS_PAGE && (
                  <button tabIndex={0}
                    onClick={() => setShowAllComments(true)}
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
                    <ChevronDown size={13} strokeWidth={2.5} />
                    Show all {allComments.length} comments
                  </button>
                )}
              </>
            )}
          </SectionCard>

          {/* Recent Media — at bottom, only when ML is loaded and species has ≥1 catalog item */}
          {hasML && (['Photo', 'Audio', 'Video'] as MediaType[]).some(t => recentMediaIds[t] !== null) && (
            <SectionCard>
              <SectionHead icon={<Play size={14} strokeWidth={2.2} />} title="Recent Media" />
              <div style={{ padding: '16px 18px' }}>
                <div className="sr-media-grid">
                  {(['Photo', 'Audio', 'Video'] as MediaType[]).map(type => {
                    const id = recentMediaIds[type]
                    if (!id) return null
                    return (
                      <div key={type} className="sr-media-item">
                        <div style={{
                          fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase',
                          letterSpacing: '0.07em', color: 'var(--sr-text-disabled)', marginBottom: 8,
                        }}>
                          {type}
                        </div>
                        <iframe
                          src={`https://macaulaylibrary.org/asset/${id}/embed`}
                          title={`Most recent ${type} of ${selectedSpecies}`}
                          loading="lazy"
                          allowFullScreen
                          scrolling="no"
                          className="sr-media-iframe"
                        />
                      </div>
                    )
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
