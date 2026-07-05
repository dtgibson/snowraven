import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, Binoculars, Camera, ChevronDown, Crosshair, Filter, Info, Loader2, Maximize2, Minimize2, MapPin, Navigation, Search, X } from 'lucide-react'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { loadEbirdObservations } from '../lib/observationsCache'
import { loadMLExport } from '../lib/mlExportCache'
import type { MLExportRow } from '../lib/parseMLExport'
import { observationMediaFormats, matchesMediaFilter } from '../lib/observationMedia'
import type { MediaFilter } from '../lib/observationMedia'
import type { ObservationEntry } from '../types'
import { BREEDING_CODES } from '../lib/breedingCodes'
import { transport, TransportError } from '../lib/transport'
import { classifyLiveError, OFFLINE_MESSAGE_SHORT, type LiveErrorKind } from '../lib/offlineMessage'
import { OfflineMessage } from './OfflineMessage'
import { storage } from '../lib/storage'
import { isIOS } from '../lib/platform'
import { mapContentClass } from '../lib/mapFullscreen'
import { getCurrentLocation, describeLocationError } from '../lib/location'
import type { LocationError } from '../lib/location'
import { SnowMap } from './SnowMap'
import { AtlasLayer } from './AtlasLayer'
import { RegionBaseSource } from './map/RegionBaseSource'
import type { AtlasData } from '../lib/atlasBlocks'
import { buildBreedingByBlock } from '../lib/atlasBreeding'
import { CountyLayer } from './map/CountyLayer'
import type { CountyFC } from '../lib/countyBoundaries'
import { buildCountyAggregates, computeCountyTiers, nonZeroMetricValues, COUNTY_METRIC_META, COUNTY_CLASS_COUNT } from '../lib/countyShading'
import { buildCountyCompletenessLocal, type CountyShadeMetric } from '../lib/countyCompleteness'
import { useCountyCompleteness, EBIRD_NO_KEY_MESSAGE } from '../lib/useCountyCompleteness'
import type { CountyTier } from '../lib/countyTextures'
import { nextShadingState } from '../lib/shadingExclusion'
import { computeChecklists, filterObservations } from '../lib/birdingStats'
import { useHotspotSet } from '../lib/useHotspotSet'
import { HEAT_INTENSITY_DEFAULT } from '../lib/heat'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { markersInView, MARKER_LIST_CAP, type MarkerBounds } from '../lib/markersInView'
import { formatDate } from '../lib/formatDate'
import { BirdName } from './BirdName'
import { HotspotLink } from './HotspotLink'
import type {
  ViewMode, DisplayMode, PointSize, MapPhase, BreedingFilter,
  HotspotPin, TargetPin, DisplayTargetPin, LocationGroup, NearbyLiferLocation,
} from '../lib/mapExplorerTypes'
import {
  distanceMiles, recencyTier, tierColors, radiusToZoom,
  MEDIA_ICONS, TEARDROP_HTML, SELECT_STYLE,
} from '../lib/mapExplorerFormat'
import { MAP_VIEW_MODE_ORDER } from '../lib/mapViewModes'
import { SegControl, SidebarLabel, InViewMarkerList, KeyNotice, TierHatchSwatch, CountyDensitySwatch, CountyCompletenessLegend } from './map/MapSidebarUI'
import { MapEffects, BoundsTracker, DetectedLocationPin, CenterPinDropper, CenterPin } from './map/MapControls'
import { SightingMarkers } from './map/SightingMarkers'
import { BasemapDesaturation } from './map/BasemapDesaturation'
import { HotspotMarkers } from './map/HotspotMarkers'
import { TargetMarkers } from './map/TargetMarkers'
import { NearbyLiferMarkers, type MarkerMode } from './map/NearbyLiferMarkers'
import { buildNearbyLifers, isWithinWindow } from '../lib/nearbyLifers'

interface MapExplorerProps {
  onGoToSettings: () => void
  onNavigateToMediaList: () => void
  keysVersion?: number
  /** True when the map occupies the full viewport (mobile fullscreen). */
  isFullscreen?: boolean
  /** Toggle mobile fullscreen. When absent, the fullscreen button is hidden. */
  onToggleFullscreen?: () => void
  /** Navigate to + select a species on the Species Detail tab. */
  onOpenSpecies?: (commonName: string) => void
}

// ── Constants ──────────────────────────────────────────────────────────────────

const POSSIBLE_CODES  = new Set(BREEDING_CODES.filter(d => d.tier === 1).map(d => d.code))
const PROBABLE_CODES  = new Set(BREEDING_CODES.filter(d => d.tier === 2 || d.tier === 3).map(d => d.code))
const CONFIRMED_CODES = new Set(BREEDING_CODES.filter(d => d.tier === 4).map(d => d.code))

// Shared "Time Range" filter — used by both Media Targets and Nearby Lifers so
// the two panels stay consistent. 'all' = the full 30-day fetch window.
type TimeWindow = 'day' | 'week' | 'all'
const TIME_WINDOW_OPTS = [
  { value: 'day',  label: 'Day' },
  { value: 'week', label: 'Week' },
  { value: 'all',  label: '30 days' },
]
const WINDOW_DAYS: Record<TimeWindow, number> = { day: 1, week: 7, all: 30 }

// Session-stable "now" for the recency windows — computed once at module load,
// not during render (calling Date.now() inside a memo trips react-hooks/purity).
const SESSION_NOW_MS = Date.now()

// A classified overlay error — the kind drives the OfflineMessage icon + token
// palette + role so offline / no-key / server-error get three distinct, more-
// than-color treatments (FR-35/NFR-09); a plain validation error is kind 'error'.
type OverlayError = { kind: LiveErrorKind; message: string }

// Classify a live nearby-overlay (hotspots / sightings / lifers) fetch failure
// into one of the three distinct treatments (FR-35/FR-38):
//   • offline (connection-level)        → the honest "you're offline" line
//   • no-key (eBird 401 / message text) → "eBird API key not configured…"
//   • other HTTP/server error           → the surface's detail or generic fallback
// These overlays have NO replay path (FR-38), so offline always shows the
// offline message. Mirrors the existing inline status/detail extraction.
function classifyOverlayError(err: unknown, fallback: string): OverlayError {
  // Offline first — a connection-level rejection carries no HTTP status. (On web/
  // Pi + online this surfaces the backend-down copy via classifyLiveError, FR-39a.)
  const classified = classifyLiveError(err, { offlineMessage: OFFLINE_MESSAGE_SHORT, errorMessage: fallback })
  if (classified.kind === 'offline') return classified
  const e = err as { status?: number; detail?: string }
  const status = err instanceof TransportError ? err.status : e.status
  const detail = err instanceof TransportError ? err.detail : (e.detail ?? (err instanceof Error ? err.message : undefined))
  // The overlays hit eBird directly, so a 401 is specifically a missing eBird key.
  if (status === 401) return { kind: 'no-key', message: 'eBird API key not configured. Add it in Settings.' }
  return { kind: 'error', message: detail ?? fallback }
}

// A plain validation message (bad lat/lng, nothing selected) is an alert-level error.
function validationError(message: string): OverlayError {
  return { kind: 'error', message }
}

// ── Sub-components ─────────────────────────────────────────────────────────────

function AddressSearch({ onLocate }: { onLocate: (lat: number, lng: number) => void }) {
  const [query, setQuery] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSearch() {
    const q = query.trim()
    if (!q) return
    setLoading(true); setError('')
    try {
      const data = await transport.get<{ lat: string; lon: string }[]>('/nominatim/search', { q })
      if (data.length === 0) { setError('No location found. Try a different search term.'); return }
      onLocate(parseFloat(data[0].lat), parseFloat(data[0].lon))
      setQuery('')
    } catch (err) {
      // Offline geocode must read "you're offline", NOT a "no matches"/"failed"
      // message that conflates the two distinct states (FR-38).
      setError(classifyLiveError(err, { errorMessage: 'Location search failed. Try again or enter coordinates manually.' }).message)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ marginBottom: 8 }}>
      <div style={{ display: 'flex', gap: 6 }}>
        <input
          type="text"
          placeholder="Search by place name"
          aria-label="Search by place name"
          value={query}
          onChange={e => setQuery(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleSearch() }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0 }}
        />
        <button tabIndex={0}
          onClick={handleSearch}
          disabled={loading || !query.trim()}
          title="Search"
          aria-label="Search"
          style={{
            width: 34, height: 34, display: 'flex', alignItems: 'center', justifyContent: 'center',
            background: loading || !query.trim() ? 'var(--sr-surface-subtle)' : 'var(--sr-accent)',
            color: loading || !query.trim() ? 'var(--sr-text-muted)' : 'var(--sr-on-accent)',
            border: '1.5px solid var(--sr-border)', borderRadius: 6,
            cursor: loading || !query.trim() ? 'not-allowed' : 'pointer', flexShrink: 0,
          }}
        >
          <Search size={14} strokeWidth={2} />
        </button>
      </div>
      {error && <div role="alert" style={{ fontSize: '0.6875rem', color: 'var(--sr-error)', marginTop: 4 }}>{error}</div>}
    </div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────────

export function MapExplorer({ onGoToSettings, onNavigateToMediaList, keysVersion, isFullscreen, onToggleFullscreen, onOpenSpecies }: MapExplorerProps) {
  const [phase, setPhase] = useState<MapPhase>({ tag: 'loading-saved' })
  const [viewMode, setViewMode] = useState<ViewMode>('sightings')
  const [displayMode, setDisplayMode] = useState<DisplayMode>('pins')
  // Session-only Pins-mode point sizing (Normal / Small / Off) — mirrors
  // displayMode: plain useState, NOT the storage seam, so it resets on relaunch.
  const [pointSize, setPointSize] = useState<PointSize>('normal')
  const [heatIntensity, setHeatIntensity] = useState(HEAT_INTENSITY_DEFAULT)

  const sidebarRef = useRef<HTMLDivElement>(null)
  const filtersButtonRef = useRef<HTMLButtonElement>(null)

  // My Sightings filters
  const [filterOpen, setFilterOpen]         = useState(true)
  // Per-panel collapsed state for the "… in view" lists (session-only, like
  // filterOpen and the Counties-in-view disclosure). Absent key = expanded.
  const [inviewCollapsed, setInviewCollapsed] = useState<Record<string, boolean>>({})
  const toggleInview = (key: string) => setInviewCollapsed(m => ({ ...m, [key]: !m[key] }))
  const [speciesFilter, setSpeciesFilter]   = useState('')
  const [dateFrom, setDateFrom]             = useState('')
  const [dateTo, setDateTo]                 = useState('')
  const [countyFilter, setCountyFilter]     = useState('')
  const [breedingFilter, setBreedingFilter] = useState<BreedingFilter>('all')
  const [mediaFilter, setMediaFilter]       = useState<MediaFilter>('any')

  // Shared center point (hotspots + targets)
  const [lat, setLat]         = useState('')
  const [lng, setLng]         = useState('')
  const [radius, setRadius]   = useState(5)
  const [geoError, setGeoError] = useState('')
  const [isLocating, setIsLocating] = useState(false)

  // Hotspot state
  const [hotspotPins, setHotspotPins]         = useState<HotspotPin[] | null>(null)
  const [hotspotsLoading, setHotspotsLoading] = useState(false)
  const [hotspotsError, setHotspotsError]     = useState<OverlayError | null>(null)
  const [legendVisible, setLegendVisible]     = useState(false)
  const [hiddenKinds, setHiddenKinds]         = useState<Set<HotspotPin['kind']>>(new Set())

  // Atlas block overlay state (California Breeding Bird Atlas)
  const [atlasEnabled, setAtlasEnabled]       = useState(false)
  const [atlasData, setAtlasData]             = useState<AtlasData | null>(null)
  const [atlasLoading, setAtlasLoading]       = useState(false)
  const [shadeByBreeding, setShadeByBreeding] = useState(false)
  const [useTextures, setUseTextures]         = useState(false)

  // County overlay state (County Lines & Shading) — mirrors the atlas state:
  // session-scoped, shared across view modes, NOT persisted across relaunch.
  const [countyLinesEnabled, setCountyLinesEnabled] = useState(false)
  const [countyData, setCountyData]                 = useState<CountyFC | null>(null)
  const [countyLoading, setCountyLoading]           = useState(false)
  const [shadeByCounty, setShadeByCounty]           = useState(false)
  const [countyMetric, setCountyMetric]             = useState<CountyShadeMetric>('species')
  // Colorblind-accessible county shading: paint shaded counties as a per-tier
  // crosshatch density instead of color. Session-scoped, off by default, NO
  // storage seam / persistence (NFR-06 / QA-24); independent of the atlas
  // `useTextures` above (separate overlay, separate control).
  const [useCountyTextures, setUseCountyTextures]   = useState(false)

  // Target state
  const [targetPins, setTargetPins]           = useState<TargetPin[] | null>(null)
  const [targetsLoading, setTargetsLoading]   = useState(false)
  const [targetsError, setTargetsError]       = useState<OverlayError | null>(null)
  const [manualTargets, setManualTargets]     = useState<Set<string>>(new Set())
  const [targetSearch, setTargetSearch]       = useState('')
  const [targetViewMode, setTargetViewMode]   = useState<TimeWindow>('all')
  // Selected target LOCATION (locId) — shared between the "Nearest Targets"
  // sidebar list and the TargetMarkers popup, so a sidebar row opens the same
  // popup the map marker does (consistent with the sightings/hotspots lists).
  const [selectedTargetLocId, setSelectedTargetLocId] = useState<string | null>(null)
  const [targetTypeFilter, setTargetTypeFilter] = useState<Set<'Photo' | 'Audio' | 'Video'>>(new Set())

  // Nearby Lifers state — recent reports near the center of species NOT on the
  // user's life list, grouped by location. Shares the center/radius controls.
  const [liferPins, setLiferPins]           = useState<NearbyLiferLocation[] | null>(null)
  const [lifersLoading, setLifersLoading]   = useState(false)
  const [lifersError, setLifersError]       = useState<OverlayError | null>(null)
  const [liferWindow, setLiferWindow]       = useState<TimeWindow>('all')
  const [selectedLiferLocId, setSelectedLiferLocId] = useState<string | null>(null)

  // Marker style per panel (session-only): 'labels' shows the name chip, 'dots'
  // collapses each marker to just its locator dot. Independent for Lifers/Targets.
  const [liferMarkerMode, setLiferMarkerMode]   = useState<MarkerMode>('labels')
  const [targetMarkerMode, setTargetMarkerMode] = useState<MarkerMode>('labels')

  // Map pan target (set by sidebar clicks, consumed by MapEffects inside SnowMap)
  const [panTarget, setPanTarget]             = useState<{ lat: number; lng: number } | null>(null)
  const handlePanDone                         = useCallback(() => setPanTarget(null), [])

  // Current map viewport (padded), reported by BoundsTracker on load + moveend.
  // Scopes the keyboard-accessible in-view marker lists to what's on screen.
  const [mapBounds, setMapBounds]             = useState<MarkerBounds | null>(null)
  const handleBounds                          = useCallback((b: MarkerBounds) => setMapBounds(b), [])

  // Marker selection lifted out of the marker components, so a focusable sidebar
  // row opens the SAME <Popup> a pin click does (one owner per mode). null = no
  // popup. Sidebar activation also pans the map (setPanTarget) so the popup is
  // brought into view if the marker was near the edge.
  const [selectedSightingLocId, setSelectedSightingLocId] = useState<string | null>(null)
  const [selectedHotspotLocId, setSelectedHotspotLocId]   = useState<string | null>(null)

  // Detected location pin (set by "Use my location", cleared when user edits coords manually)
  const [detectedLocation, setDetectedLocation] = useState<{ lat: number; lng: number } | null>(null)

  // Mobile sidebar overlay state
  const [sidebarOpen, setSidebarOpen] = useState(false)

  // Single close path for the mobile sidebar: Escape, the Close button, and the
  // backdrop all route through here so every close restores focus to the
  // Filters button. The FAB cluster only mounts while the sidebar is CLOSED, so
  // the restore must run in an effect AFTER the close render commits — at
  // close() time filtersButtonRef.current is still null.
  const restoreFiltersFocusRef = useRef(false)
  const closeSidebar = useCallback(() => {
    restoreFiltersFocusRef.current = true
    setSidebarOpen(false)
  }, [])
  useEffect(() => {
    if (!sidebarOpen && restoreFiltersFocusRef.current) {
      restoreFiltersFocusRef.current = false
      filtersButtonRef.current?.focus()
    }
  }, [sidebarOpen])

  // Focus trap for mobile sidebar. Focusables are re-queried on EVERY Tab press
  // (the HelpDocs.tsx pattern): the sidebar's content is dynamic (accordion,
  // async hotspot/target results, in-view lists that change on pan/zoom), so a
  // snapshot taken at open goes stale and lets focus escape the overlay.
  useEffect(() => {
    if (!sidebarOpen) return
    const sidebar = sidebarRef.current
    if (!sidebar) return

    const focusables = () =>
      Array.from(sidebar.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
      )).filter(el => !el.hasAttribute('disabled') && el.offsetParent !== null && !el.closest('[inert]'))

    focusables()[0]?.focus()

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeSidebar()
        return
      }
      if (e.key !== 'Tab') return
      const list = focusables()
      if (list.length === 0) return
      const first = list[0]
      const last = list[list.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault()
          last.focus()
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [sidebarOpen, closeSidebar])

  // Escape exits map fullscreen — innermost layer first: while the mobile
  // filters overlay is open its own Escape handler (above) closes it instead,
  // so this listener is only armed when the sidebar is closed. Focus returns to
  // the fullscreen toggle so the keyboard user isn't dropped to <body>.
  const fullscreenButtonRef = useRef<HTMLButtonElement>(null)
  useEffect(() => {
    if (!isFullscreen || !onToggleFullscreen || sidebarOpen) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      onToggleFullscreen()
      fullscreenButtonRef.current?.focus()
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isFullscreen, onToggleFullscreen, sidebarOpen])

  // Initial map center from saved defaults
  const [defaultCenter, setDefaultCenter] = useState<{ lat: number; lng: number; zoom: number } | null>(null)
  const handleDefaultCenterDone = useCallback(() => setDefaultCenter(null), [])

  // Species code map and key status
  const [speciesCodeMap, setSpeciesCodeMap] = useState<Record<string, string>>({})
  const [hasEbirdKey, setHasEbirdKey]       = useState<boolean | null>(null)

  // Load eBird key status — re-runs when a key is saved in Settings
  useEffect(() => {
    storage.getApiKey('ebird')
      .then(key => setHasEbirdKey(key !== null))
      .catch(() => setHasEbirdKey(false))
  }, [keysVersion])

  // Pre-fill lat/lng/radius from saved map defaults on mount. We do NOT pan the
  // map to the saved search center here: the landing mode is My Sightings, which
  // fits to all of the user's sightings. Panning to the saved center would win
  // the async race against that fit and leave the map zoomed in on load. The
  // saved center is applied when the user switches to Hotspots/Targets (below).
  useEffect(() => {
    storage.getSetting<{ lat: number; lng: number; dist: number }>('map-defaults')
      .then(data => {
        if (data && typeof data.lat === 'number' && typeof data.lng === 'number' && typeof data.dist === 'number') {
          setLat(String(data.lat))
          setLng(String(data.lng))
          setRadius(data.dist)
        }
      })
      .catch(() => {})
  }, [])

  // Load observations + ML export
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }

        const [ebird, ml] = await Promise.all([
          loadEbirdObservations(),
          status.ml ? loadMLExport() : Promise.resolve(null),
        ])
        if (!ebird || cancelled) { setPhase({ tag: 'setup-required' }); return }

        const observations = ebird.observations

        const mlRows: MLExportRow[] = ml?.rows ?? []
        const mediaMap: Record<string, string> = ml?.mediaMap ?? {}   // catalogId → 'Photo' | 'Audio' | 'Video'
        const hasML = mlRows.length > 0

        if (cancelled) return
        setPhase({ tag: 'ready', observations, mlRows, mediaMap, hasML })
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Pre-fetch taxonomy codes for target species once data is loaded
  const fetchTargetCodes = useCallback(async (observations: ObservationEntry[], mlRows: MLExportRow[]) => {
    try {
      const mediaTypesMap = new Map<string, Set<'Photo' | 'Audio' | 'Video'>>()
      for (const row of mlRows) {
        let s = mediaTypesMap.get(row.commonName)
        if (!s) { s = new Set(); mediaTypesMap.set(row.commonName, s) }
        s.add(row.format)
      }
      const targetMap = new Map<string, string>()
      for (const o of observations) {
        if (targetMap.has(o.commonName)) continue
        const types = mediaTypesMap.get(o.commonName)
        const hasAll = types?.has('Photo') && types?.has('Audio') && types?.has('Video')
        if (!hasAll) targetMap.set(o.commonName, o.scientificName)
      }
      if (targetMap.size === 0) return

      const species = [...targetMap.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
      const data = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
      setSpeciesCodeMap(data.codes)
    } catch { /* taxonomy unavailable — gracefully handled at fetch time */ }
  }, [])

  useEffect(() => {
    if (phase.tag !== 'ready') return
    const run = async () => { await fetchTargetCodes(phase.observations, phase.mlRows) }
    run()
  }, [phase, fetchTargetCodes])

  // ── Derived data ──────────────────────────────────────────────────────────────

  const mediaTypes = useMemo((): Map<string, Set<'Photo' | 'Audio' | 'Video'>> => {
    if (phase.tag !== 'ready' || !phase.hasML) return new Map()
    const map = new Map<string, Set<'Photo' | 'Audio' | 'Video'>>()
    for (const row of phase.mlRows) {
      let s = map.get(row.commonName)
      if (!s) { s = new Set(); map.set(row.commonName, s) }
      s.add(row.format)
    }
    return map
  }, [phase])

  const filteredLocations = useMemo((): LocationGroup[] => {
    if (phase.tag !== 'ready') return []
    let obs = phase.observations

    if (speciesFilter)         obs = obs.filter(o => o.commonName === speciesFilter)
    if (dateFrom)              obs = obs.filter(o => o.date >= dateFrom)
    if (dateTo)                obs = obs.filter(o => o.date <= dateTo)
    if (countyFilter)          obs = obs.filter(o => o.county === countyFilter)
    if (breedingFilter !== 'all') {
      const codeSet = breedingFilter === 'possible' ? POSSIBLE_CODES
        : breedingFilter === 'probable' ? PROBABLE_CODES : CONFIRMED_CODES
      obs = obs.filter(o => o.breedingCode !== null && codeSet.has(o.breedingCode))
    }
    if (mediaFilter !== 'any' && phase.hasML) {
      // Match media to the SPECIFIC sighting via its ML catalog numbers (from the
      // eBird backup), not by species — otherwise every sighting of a species you've
      // ever photographed/recorded would match. mediaMap: catalogId → format.
      const mediaMap = phase.mediaMap
      obs = obs.filter(o =>
        matchesMediaFilter(observationMediaFormats(o.catalogIds, mediaMap), mediaFilter)
      )
    }

    const groups = new Map<string, LocationGroup>()
    for (const o of obs) {
      if (o.latitude === null || o.longitude === null) continue
      let g = groups.get(o.locationId)
      if (!g) {
        g = { locId: o.locationId, locName: o.location, lat: o.latitude, lng: o.longitude, count: 0, species: new Set(), lastDate: '' }
        groups.set(o.locationId, g)
      }
      g.count++
      g.species.add(o.commonName)
      if (o.date > g.lastDate) g.lastDate = o.date
    }
    return [...groups.values()]
  }, [phase, speciesFilter, dateFrom, dateTo, countyFilter, breedingFilter, mediaFilter])

  const stats = useMemo(() => {
    const species = new Set(filteredLocations.flatMap(l => [...l.species]))
    const obs = filteredLocations.reduce((s, l) => s + l.count, 0)
    return { locations: filteredLocations.length, species: species.size, obs }
  }, [filteredLocations])

  const allSpecies = useMemo((): string[] => {
    if (phase.tag !== 'ready') return []
    return [...new Set(phase.observations.map(o => o.commonName))].sort()
  }, [phase])

  // Normalized names the user has recorded (⇒ they have a Species Detail entry).
  const recordedNames = useMemo(
    () => phase.tag === 'ready'
      ? new Set(phase.observations.map(o => normalizeSpeciesName(o.commonName)))
      : new Set<string>(),
    [phase],
  )
  const hasEntryFor = useCallback((name: string) => recordedNames.has(normalizeSpeciesName(name)), [recordedNames])

  // Public-hotspot classification for the county popup's top-locations list.
  const { isHotspot } = useHotspotSet()

  const allCounties = useMemo((): string[] => {
    if (phase.tag !== 'ready') return []
    return [...new Set(phase.observations.map(o => o.county).filter((c): c is string => c !== null))].sort()
  }, [phase])

  const targetSpecies = useMemo((): { commonName: string; scientificName: string }[] => {
    if (phase.tag !== 'ready' || !phase.hasML) return []
    const seen = new Map<string, string>()
    for (const o of phase.observations) {
      if (seen.has(o.commonName)) continue
      const types = mediaTypes.get(o.commonName)
      const hasAll = types?.has('Photo') && types?.has('Audio') && types?.has('Video')
      if (!hasAll) seen.set(o.commonName, o.scientificName)
    }
    return [...seen.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
  }, [phase, mediaTypes])

  const visitedLocIds = useMemo((): Set<string> => {
    if (phase.tag !== 'ready') return new Set()
    return new Set(phase.observations.map(o => o.locationId))
  }, [phase])

  const obsLocationsByLocId = useMemo((): Map<string, { lat: number; lng: number; locName: string; count: number; lastDate: string; species: Set<string> }> => {
    if (phase.tag !== 'ready') return new Map()
    const map = new Map<string, { lat: number; lng: number; locName: string; count: number; lastDate: string; species: Set<string> }>()
    for (const o of phase.observations) {
      if (o.latitude === null || o.longitude === null) continue
      let e = map.get(o.locationId)
      if (!e) { e = { lat: o.latitude, lng: o.longitude, locName: o.location, count: 0, lastDate: '', species: new Set() }; map.set(o.locationId, e) }
      e.count++; e.species.add(o.commonName)
      if (o.date > e.lastDate) e.lastDate = o.date
    }
    return map
  }, [phase])

  const filteredManualSpecies = useMemo(() => {
    if (!targetSearch) return allSpecies
    const q = targetSearch.toLowerCase()
    return allSpecies.filter(s => s.toLowerCase().includes(q))
  }, [allSpecies, targetSearch])

  const displayedTargetPins = useMemo((): DisplayTargetPin[] => {
    if (!targetPins) return []
    const ALL_TYPES: ('Photo' | 'Audio' | 'Video')[] = ['Photo', 'Audio', 'Video']
    const withMissing = targetPins.map(pin => ({
      ...pin,
      missingTypes: ALL_TYPES.filter(t => !mediaTypes.get(pin.comName)?.has(t)),
    }))
    // Pass 1: recency filter — shared Time Range windows (Day / Week / 30 days)
    let filtered = withMissing
    if (targetViewMode !== 'all') {
      const days = WINDOW_DAYS[targetViewMode]
      filtered = withMissing.filter(pin => isWithinWindow(pin.recentDate, days, SESSION_NOW_MS))
    }
    // Pass 2: type filter — AND logic; empty set means All
    if (targetTypeFilter.size > 0) {
      filtered = filtered.filter(pin =>
        [...targetTypeFilter].every(t => pin.missingTypes.includes(t))
      )
    }
    return filtered
  }, [targetPins, targetViewMode, mediaTypes, targetTypeFilter])

  // Targets in view — the keyboard path to the on-map target chips (click-only
  // DOM markers). Scoped to the current viewport via markersInView and recomputed
  // on pan/zoom, capped with a "zoom in" hint — mirroring the sightings/hotspots
  // in-view lists. Sorted nearest-the-search-center first (newest first when no
  // valid center) so the most reachable targets lead the list.
  const targetsInView = useMemo(() => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    const hasCenter = !isNaN(latNum) && !isNaN(lngNum)
    const sorted = hasCenter
      ? [...displayedTargetPins].sort((a, b) =>
          distanceMiles(latNum, lngNum, a.lat, a.lng) - distanceMiles(latNum, lngNum, b.lat, b.lng))
      : [...displayedTargetPins].sort((a, b) => b.recentDate.localeCompare(a.recentDate))
    const res = markersInView(sorted, mapBounds)
    return {
      total: res.total,
      overCap: res.overCap,
      visible: res.visible.map(pin => ({
        pin,
        dist: hasCenter ? distanceMiles(latNum, lngNum, pin.lat, pin.lng) : null,
      })),
    }
  }, [displayedTargetPins, lat, lng, mapBounds])

  // Nearby lifers, narrowed by the Time Range window (client-side, no refetch).
  // A location is kept if it has at least one lifer within the window; the count
  // badge and tier reflect only the in-window lifers.
  const displayedLiferLocations = useMemo((): NearbyLiferLocation[] => {
    if (!liferPins) return []
    if (liferWindow === 'all') return liferPins
    const days = WINDOW_DAYS[liferWindow]
    const out: NearbyLiferLocation[] = []
    for (const loc of liferPins) {
      const lifers = loc.lifers.filter(l => isWithinWindow(l.recentDate, days, SESSION_NOW_MS))
      if (lifers.length === 0) continue
      const mostRecentDate = lifers.reduce((m, l) => (l.recentDate > m ? l.recentDate : m), '')
      out.push({ ...loc, lifers, count: lifers.length, mostRecentDate, tier: recencyTier(mostRecentDate) })
    }
    return out
  }, [liferPins, liferWindow])

  // Nearby lifers in view — keyboard path to the location pins, scoped to the
  // viewport and recomputed on pan/zoom (already sorted nearest-first by
  // buildNearbyLifers).
  const lifersInView = useMemo(
    () => markersInView(displayedLiferLocations, mapBounds),
    [displayedLiferLocations, mapBounds],
  )

  const totalLifers = useMemo(
    () => displayedLiferLocations.reduce((s, l) => s + l.count, 0),
    [displayedLiferLocations],
  )

  // Ten closest UNVISITED hotspots from the current hotspot search, by distance
  // from the center point. Rendered in the Hotspots sidebar as eBird links.
  const nearestUnvisited = useMemo(() => {
    const latNum = parseFloat(lat)
    const lngNum = parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum) || !hotspotPins) return []
    return hotspotPins
      .filter((p): p is Extract<HotspotPin, { kind: 'unvisited' }> => p.kind === 'unvisited')
      .map(pin => ({ pin, dist: distanceMiles(latNum, lngNum, pin.lat, pin.lng) }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 10)
  }, [hotspotPins, lat, lng])

  // ── In-view marker lists (keyboard path to the GL markers) ─────────────────────
  // The on-map pins/teardrops are GPU GL layers (canvas) and can't be DOM focus
  // targets. These derive a focusable sidebar list of the markers currently in
  // the viewport (mapBounds), so keyboard/screen-reader users reach the same
  // details + pan the map. Scoped to the current view + capped (lib/markersInView,
  // mirroring the atlas viewport-cap), recomputed as the user pans/zooms.

  // Sightings in view, sorted by observation count (densest first) so the most
  // significant locations lead the list.
  const sightingsInView = useMemo(() => {
    const sorted = [...filteredLocations].sort((a, b) => b.count - a.count)
    return markersInView(sorted, mapBounds)
  }, [filteredLocations, mapBounds])

  // Hotspots in view — honor the legend's hidden kinds (a hidden teardrop has no
  // popup, so it shouldn't be a keyboard target either), sorted visited→unvisited
  // →personal then by name for a stable order.
  const hotspotsInView = useMemo(() => {
    if (!hotspotPins) return { visible: [], total: 0, overCap: false }
    const kindOrder: Record<HotspotPin['kind'], number> = { visited: 0, unvisited: 1, personal: 2 }
    const shown = hotspotPins
      .filter(p => !hiddenKinds.has(p.kind))
      .sort((a, b) => kindOrder[a.kind] - kindOrder[b.kind] || a.locName.localeCompare(b.locName))
    return markersInView(shown, mapBounds)
  }, [hotspotPins, hiddenKinds, mapBounds])

  // Open a sighting's popup from the sidebar: select it (same owner the pin click
  // sets) AND pan so the popup lands in view if the pin was near the edge.
  // Activating the already-selected row TOGGLES the popup closed — the rows carry
  // aria-pressed, and the keyboard path needs a dismissal (the map popups have no
  // close button and MapLibre has no built-in Escape).
  const openSightingFromList = useCallback((loc: LocationGroup) => {
    if (selectedSightingLocId === loc.locId) { setSelectedSightingLocId(null); return }
    setSelectedSightingLocId(loc.locId)
    setPanTarget({ lat: loc.lat, lng: loc.lng })
  }, [selectedSightingLocId])

  const openHotspotFromList = useCallback((pin: HotspotPin) => {
    if (selectedHotspotLocId === pin.locId) { setSelectedHotspotLocId(null); return }
    setSelectedHotspotLocId(pin.locId)
    setPanTarget({ lat: pin.lat, lng: pin.lng })
  }, [selectedHotspotLocId])

  const openLiferFromList = useCallback((loc: NearbyLiferLocation) => {
    if (selectedLiferLocId === loc.locId) { setSelectedLiferLocId(null); return }
    setSelectedLiferLocId(loc.locId)
    setPanTarget({ lat: loc.lat, lng: loc.lng })
  }, [selectedLiferLocId])

  // Atlas overlay toggle — lazy-loads the block gazetteer on first enable so it
  // never affects initial app load, then just shows/hides the layer.
  const handleToggleAtlas = useCallback(async () => {
    const next = !atlasEnabled
    setAtlasEnabled(next)
    if (!next) setShadeByBreeding(false) // shading is meaningless without the overlay
    if (next && !atlasData && !atlasLoading) {
      setAtlasLoading(true)
      try {
        const mod = await import('../assets/ca-atlas-blocks.json')
        setAtlasData(((mod as { default?: unknown }).default ?? mod) as unknown as AtlasData)
      } catch {
        // Asset failed to load — leave data null; the overlay simply won't draw.
      } finally {
        setAtlasLoading(false)
      }
    }
  }, [atlasEnabled, atlasData, atlasLoading])

  // Map of atlas block code → the user's highest breeding evidence there. Computed
  // once from the loaded backup + gazetteer; drives the "shade by breeding" overlay.
  const breedingByBlock = useMemo(
    () => (atlasData && phase.tag === 'ready' ? buildBreedingByBlock(atlasData, phase.observations) : null),
    [atlasData, phase],
  )

  // County overlay toggle — lazy-loads the boundary geometry on first enable so it
  // stays OFF the entry chunk (NFR-03); subsequent toggles just show/hide the layer.
  const handleToggleCounty = useCallback(async () => {
    const next = !countyLinesEnabled
    setCountyLinesEnabled(next)
    if (!next) setShadeByCounty(false) // shading is meaningless without the overlay
    if (next && !countyData && !countyLoading) {
      setCountyLoading(true)
      try {
        const mod = await import('../assets/us-counties.json')
        setCountyData(((mod as { default?: unknown }).default ?? mod) as unknown as CountyFC)
      } catch {
        // Asset failed to load — leave data null; the overlay simply won't draw.
      } finally {
        setCountyLoading(false)
      }
    }
  }, [countyLinesEnabled, countyData, countyLoading])

  // Mutual exclusion for the two shade overlays: turning one shade ON clears the
  // other (their ramps fight; rule lives in lib/shadingExclusion.ts so it's unit-
  // testable). Boundary lines stay independent. React batches the paired setters,
  // so there is no intermediate double-render.
  const handleShadeBreeding = useCallback(() => {
    const next = nextShadingState('breeding', { shadeByBreeding, shadeByCounty })
    setShadeByBreeding(next.shadeByBreeding)
    setShadeByCounty(next.shadeByCounty)
  }, [shadeByBreeding, shadeByCounty])

  const handleShadeCounty = useCallback(() => {
    const next = nextShadingState('county', { shadeByBreeding, shadeByCounty })
    setShadeByBreeding(next.shadeByBreeding)
    setShadeByCounty(next.shadeByCounty)
  }, [shadeByBreeding, shadeByCounty])

  // Per-county aggregates (species/records totals + popup top-3), built from the
  // parse-once observations/checklists (NFR-01, no re-parse, memoized). spuh/slash/
  // hybrid are excluded so "distinct species per county" reads as a countable life
  // list; the records metric is the checklist count, matching the Statistics tables.
  const countyAggregates = useMemo(() => {
    if (phase.tag !== 'ready') return null
    const obs = filterObservations(phase.observations, false)
    const checklists = computeChecklists(obs)
    return buildCountyAggregates(obs, checklists)
  }, [phase])

  // Quantile tiers over the active metric's non-zero county values; empty when
  // there are none (drives the honest "nothing to shade" note). Completeness is
  // NOT a quantile metric — it carries its own fixed bands (FR-11), so the
  // quantile computation is skipped entirely while it is selected.
  const countyTiers = useMemo(
    () => computeCountyTiers(
      countyAggregates && countyMetric !== 'completeness' ? nonZeroMetricValues(countyAggregates, countyMetric) : [],
      COUNTY_CLASS_COUNT,
    ),
    [countyAggregates, countyMetric],
  )

  // Local (backup-derived) per-county completeness: countable X + the recent
  // new-in-county list. Works offline and with no eBird key (FR-21/FR-24).
  const countyLocalCompleteness = useMemo(
    () => (phase.tag === 'ready' ? buildCountyCompletenessLocal(phase.observations) : null),
    [phase],
  )

  // The Completeness controller — persistent 30-day cache, bounded eager fetch,
  // click-to-fetch, degraded states. Null (and fully inert — zero fetches)
  // unless the Completeness metric is the active county shading.
  const countyCompleteness = useCountyCompleteness({
    active: countyLinesEnabled && shadeByCounty && countyMetric === 'completeness' && phase.tag === 'ready',
    localByCounty: countyLocalCompleteness,
    hasEbirdKey,
  })

  // ── Actions ───────────────────────────────────────────────────────────────────

  const handleFindHotspots = useCallback(async (overrideLat?: number, overrideLng?: number) => {
    const latNum = overrideLat ?? parseFloat(lat)
    const lngNum = overrideLng ?? parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) { setHotspotsError(validationError('Enter a valid latitude and longitude.')); return }
    setHotspotsLoading(true); setHotspotsError(null)
    try {
      const distKm = Math.round(radius * 1.60934)
      const data = await transport.get<{ locId: string; locName: string; lat: number; lng: number }[]>('/map/hotspots', {
        lat: String(latNum), lng: String(lngNum), dist: String(distKm),
      })
      const hotspotLocIds = new Set(data.map(h => h.locId))

      const pins: HotspotPin[] = data.map(h => {
        if (visitedLocIds.has(h.locId)) {
          const loc = obsLocationsByLocId.get(h.locId)
          return { kind: 'visited' as const, locId: h.locId, locName: h.locName, lat: h.lat, lng: h.lng, speciesCount: loc?.species.size ?? 0, lastVisit: loc?.lastDate ?? '' }
        }
        return { kind: 'unvisited' as const, locId: h.locId, locName: h.locName, lat: h.lat, lng: h.lng }
      })

      // Add personal locations within radius
      for (const [locId, loc] of obsLocationsByLocId.entries()) {
        if (hotspotLocIds.has(locId)) continue
        if (distanceMiles(latNum, lngNum, loc.lat, loc.lng) <= radius) {
          pins.push({ kind: 'personal', locId, locName: loc.locName, lat: loc.lat, lng: loc.lng, obsCount: loc.count, lastVisit: loc.lastDate })
        }
      }

      setHiddenKinds(new Set())
      setHotspotPins(pins); setLegendVisible(true)
    } catch (err) {
      setHotspotsError(classifyOverlayError(err, 'Failed to fetch hotspots.'))
    } finally {
      setHotspotsLoading(false)
    }
  }, [lat, lng, radius, visitedLocIds, obsLocationsByLocId])

  const handleFindSightings = useCallback(async (overrideLat?: number, overrideLng?: number) => {
    setTargetTypeFilter(new Set())
    const latNum = overrideLat ?? parseFloat(lat)
    const lngNum = overrideLng ?? parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) { setTargetsError(validationError('Enter a valid latitude and longitude.')); return }

    const useManual = phase.tag === 'ready' && !phase.hasML
    const names = useManual ? [...manualTargets] : targetSpecies.map(t => t.commonName)
    if (names.length === 0) { setTargetsError(validationError('No target species to search for.')); return }

    let codes = names.map(n => speciesCodeMap[n]).filter(Boolean).join(',')
    if (!codes) {
      // Fetch codes on demand if pre-fetch hasn't resolved yet
      try {
        const sciMap = new Map(
          (phase.tag === 'ready' ? [...phase.observations] : []).map(o => [o.commonName, o.scientificName]),
        )
        const species = names.map(n => ({ commonName: n, scientificName: sciMap.get(n) ?? '' }))
        const d = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
        setSpeciesCodeMap(prev => ({ ...prev, ...d.codes }))
        codes = names.map(n => d.codes[n]).filter(Boolean).join(',')
      } catch (err) {
        setTargetsError(classifyOverlayError(err, 'Could not load eBird taxonomy.'))
        return
      }
    }
    if (!codes) { setTargetsError(validationError('No eBird species codes found for the selected species.')); return }

    setTargetsLoading(true); setTargetsError(null)
    try {
      const distKm = Math.round(radius * 1.60934)
      const pins = await transport.get<TargetPin[]>('/map/recent-obs', {
        lat: String(latNum), lng: String(lngNum), dist: String(distKm), codes,
      })
      setTargetPins(pins)
    } catch (err) {
      setTargetsError(classifyOverlayError(err, 'Failed to fetch recent sightings.'))
    } finally {
      setTargetsLoading(false)
    }
  }, [lat, lng, radius, phase, targetSpecies, speciesCodeMap, manualTargets])

  const handleFindLifers = useCallback(async (overrideLat?: number, overrideLng?: number) => {
    const latNum = overrideLat ?? parseFloat(lat)
    const lngNum = overrideLng ?? parseFloat(lng)
    if (isNaN(latNum) || isNaN(lngNum)) { setLifersError(validationError('Enter a valid latitude and longitude.')); return }
    if (phase.tag !== 'ready') { setLifersError(validationError('Load your eBird backup in Settings to find nearby lifers.')); return }
    setLifersLoading(true); setLifersError(null)
    try {
      const distKm = Math.round(radius * 1.60934)
      // No `codes` param ⇒ the route returns all species in the radius; we then
      // subtract the user's life list and group by location client-side.
      const records = await transport.get<TargetPin[]>('/map/recent-obs', {
        lat: String(latNum), lng: String(lngNum), dist: String(distKm),
      })
      setLiferPins(buildNearbyLifers(records, recordedNames, latNum, lngNum))
      // recent-obs records already carry eBird speciesCode, so favicons need no
      // extra taxonomy call — merge name → code from the records.
      if (records.length > 0) {
        setSpeciesCodeMap(prev => {
          const next = { ...prev }
          for (const r of records) if (r.speciesCode && !next[r.comName]) next[r.comName] = r.speciesCode
          return next
        })
      }
    } catch (err) {
      setLifersError(classifyOverlayError(err, 'Failed to fetch nearby lifers.'))
    } finally {
      setLifersLoading(false)
    }
  }, [lat, lng, radius, phase, recordedNames])

  const handleUseMyLocation = useCallback(async () => {
    setGeoError('')
    setIsLocating(true)
    const wasEmpty = !lat && !lng
    try {
      const loc = await getCurrentLocation()
      setLat(loc.lat.toFixed(5))
      setLng(loc.lng.toFixed(5))
      setDetectedLocation({ lat: loc.lat, lng: loc.lng })
      setPanTarget({ lat: loc.lat, lng: loc.lng })
      if (wasEmpty) {
        if (viewMode === 'hotspots') handleFindHotspots(loc.lat, loc.lng)
        else if (viewMode === 'targets') handleFindSightings(loc.lat, loc.lng)
        else if (viewMode === 'lifers') handleFindLifers(loc.lat, loc.lng)
      }
    } catch (err) {
      setGeoError(describeLocationError(err as LocationError))
    } finally {
      setIsLocating(false)
    }
  }, [lat, lng, viewMode, handleFindHotspots, handleFindSightings, handleFindLifers, setPanTarget, setDetectedLocation])

  // Set the shared search center from a dropped/dragged map pin (right-click or
  // long-press), then re-run the active view's search — the "drop a pin to see
  // what's there" path. Session-only: it updates the in-session center, never the
  // saved default (map-defaults), exactly like "Use my location".
  const applyCenter = useCallback((latNum: number, lngNum: number) => {
    setLat(latNum.toFixed(5))
    setLng(lngNum.toFixed(5))
    if (viewMode === 'hotspots') {
      if (!hotspotsLoading && hasEbirdKey !== false) handleFindHotspots(latNum, lngNum)
    } else if (viewMode === 'targets') {
      if (!targetsLoading && hasEbirdKey !== false && phase.tag === 'ready') handleFindSightings(latNum, lngNum)
    } else if (viewMode === 'lifers') {
      if (!lifersLoading && hasEbirdKey !== false && phase.tag === 'ready') handleFindLifers(latNum, lngNum)
    }
  }, [viewMode, hotspotsLoading, targetsLoading, lifersLoading, hasEbirdKey, phase, handleFindHotspots, handleFindSightings, handleFindLifers])

  // ── Render ────────────────────────────────────────────────────────────────────

  if (phase.tag === 'loading-saved') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={22} className="spin" style={{ color: 'var(--sr-accent)' }} />
      </div>
    )
  }

  const isSetupRequired = phase.tag === 'setup-required'

  const CenterPointControl = (
    <div style={{ marginBottom: 16 }}>
      <button tabIndex={0}
        onClick={handleUseMyLocation}
        disabled={isLocating}
        style={{
          display: 'flex', alignItems: 'center', gap: 7,
          width: '100%', height: 34, padding: '0 12px',
          background: isLocating ? 'var(--sr-surface-subtle)' : 'none',
          border: '1.5px solid var(--sr-border)',
          borderRadius: 6, fontSize: '0.78125rem', fontWeight: 500,
          fontFamily: 'inherit',
          color: isLocating ? 'var(--sr-text-muted)' : 'var(--sr-text)',
          cursor: isLocating ? 'default' : 'pointer',
          marginBottom: 8, boxSizing: 'border-box',
        }}
      >
        {isLocating
          ? <Loader2 size={13} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
          : <Navigation size={13} strokeWidth={2} style={{ color: 'var(--sr-accent)', flexShrink: 0 }} />
        }
        {isLocating ? 'Locating…' : 'Use my location'}
      </button>
      {geoError && <div role="alert" style={{ fontSize: '0.6875rem', color: 'var(--sr-error)', marginBottom: 6 }}>{geoError}</div>}
      <div style={{ display: 'flex', gap: 6 }}>
        <input type="number" placeholder="Latitude" aria-label="Latitude" value={lat} onChange={e => { setLat(e.target.value); setDetectedLocation(null) }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0 }} />
        <input type="number" placeholder="Longitude" aria-label="Longitude" value={lng} onChange={e => { setLng(e.target.value); setDetectedLocation(null) }}
          style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0 }} />
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
        Tip: right-click the map (or long-press on touch) to drop the center here, then drag the pin to fine-tune.
      </div>
    </div>
  )

  const RadiusControl = (
    <div style={{ marginBottom: 16 }}>
      <SidebarLabel>Radius</SidebarLabel>
      <SegControl
        options={[{ value: '5', label: '5 mi' }, { value: '10', label: '10 mi' }, { value: '25', label: '25 mi' }, { value: '50', label: '50 mi' }]}
        value={String(radius)}
        onChange={v => setRadius(Number(v))}
      />
    </div>
  )

  // ── Sidebar content per mode ──────────────────────────────────────────────────

  // Shared atlas overlay controls (atlas blocks + shade-by-breeding + textures +
  // legend). Rendered in all three mode sidebars; the map layer itself already
  // renders in every mode. State is shared across modes.
  const atlasOverlayControls = (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
      <SidebarLabel>Map Overlays</SidebarLabel>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>California atlas blocks</span>
        <button
          type="button"
          role="switch"
          aria-checked={atlasEnabled}
          aria-label="Show California atlas blocks"
          tabIndex={0}
          onClick={handleToggleAtlas}
          style={{
            width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
            background: atlasEnabled ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
            position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
          }}
        >
          <span style={{
            position: 'absolute', top: 2, left: atlasEnabled ? 22 : 2, width: 20, height: 20,
            borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
          }} />
        </button>
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
        {atlasLoading
          ? 'Loading atlas blocks…'
          : 'California Breeding Bird Atlas blocks. Shown for the current map area.'}
      </div>

      {/* Shade-by-breeding toggle — only when the atlas overlay is on */}
      {atlasEnabled && (() => {
        const backupReady = phase.tag === 'ready'
        return (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: backupReady ? 1 : 0.55 }}>
              <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Shade by My Highest Breeding Code</span>
              <button
                type="button"
                role="switch"
                aria-checked={shadeByBreeding}
                aria-label="Shade atlas blocks by my highest breeding code"
                title="Only one shading shows at a time — turning this on switches off county shading."
                disabled={!backupReady}
                tabIndex={0}
                onClick={() => backupReady && handleShadeBreeding()}
                style={{
                  width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
                  background: shadeByBreeding ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                  position: 'relative', cursor: backupReady ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
                }}
              >
                <span style={{
                  position: 'absolute', top: 2, left: shadeByBreeding ? 22 : 2, width: 20, height: 20,
                  borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                }} />
              </button>
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              {backupReady
                ? "Based only on breeding codes you've personally entered."
                : 'Load your eBird backup in Settings to use this.'}
              {backupReady && shadeByCounty && ' Turning this on switches off county shading.'}
            </div>
            {shadeByBreeding && backupReady && (
              <>
                {/* Use Textures — per-tier hatch patterns; off by default (colorblind aid) */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Use Textures</span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={useTextures}
                    aria-label="Use textures on shaded atlas blocks"
                    tabIndex={0}
                    onClick={() => setUseTextures(v => !v)}
                    style={{
                      width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
                      background: useTextures ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                      position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
                    }}
                  >
                    <span style={{
                      position: 'absolute', top: 2, left: useTextures ? 22 : 2, width: 20, height: 20,
                      borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                    }} />
                  </button>
                </div>
                <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                  Adds a distinct hatch per level so blocks are distinguishable without color.
                </div>

                <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {([
                    { tier: 4, label: 'Confirmed (nest / young)' },
                    { tier: 3, label: 'Confirmed (nest building)' },
                    { tier: 2, label: 'Probable' },
                    { tier: 1, label: 'Possible' },
                  ] as const).map(row => (
                    <div key={row.tier} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.75rem' }}>
                      {useTextures
                        ? <TierHatchSwatch tier={row.tier} />
                        : (
                          <svg width="24" height="14" style={{ flexShrink: 0, border: '1px solid var(--sr-border-medium)', borderRadius: 3 }}>
                            <rect width="24" height="14" className={`sr-atlas-fill-${row.tier}`} />
                          </svg>
                        )}
                      <span style={{ color: 'var(--sr-text-muted)' }}>{row.label}</span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>
        )
      })()}

      {/* ── County Lines & Shading ─────────────────────────────────────────── */}
      <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
          <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>County lines</span>
          <button
            type="button"
            role="switch"
            aria-checked={countyLinesEnabled}
            aria-label="Show US county lines"
            tabIndex={0}
            onClick={handleToggleCounty}
            style={{
              width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
              background: countyLinesEnabled ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
              position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
            }}
          >
            <span style={{
              position: 'absolute', top: 2, left: countyLinesEnabled ? 22 : 2, width: 20, height: 20,
              borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
            }} />
          </button>
        </div>
        <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4, display: 'flex', alignItems: 'center', gap: 7 }}>
          {countyLoading && <Loader2 size={13} className="spin" aria-hidden="true" />}
          {countyLoading ? 'Loading county boundaries…' : 'US county boundaries, shown for the current map area.'}
        </div>

        {countyLinesEnabled && (() => {
          const backupReady = phase.tag === 'ready'
          return (
            <div style={{ marginTop: 12 }}>
              {/* Shade counties (D-401 rename — the toggle now governs three
                  metrics) — disabled without a loaded backup (FR-04) */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, opacity: backupReady ? 1 : 0.55 }}>
                <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Shade counties</span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={shadeByCounty}
                  aria-label="Shade counties by the selected metric"
                  title="Only one shading shows at a time — turning this on switches off atlas shading."
                  aria-disabled={!backupReady}
                  disabled={!backupReady}
                  tabIndex={0}
                  onClick={() => backupReady && handleShadeCounty()}
                  style={{
                    width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
                    background: shadeByCounty ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                    position: 'relative', cursor: backupReady ? 'pointer' : 'not-allowed', transition: 'background 0.15s',
                  }}
                >
                  <span style={{
                    position: 'absolute', top: 2, left: shadeByCounty ? 22 : 2, width: 20, height: 20,
                    borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                  }} />
                </button>
              </div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                {backupReady
                  ? (countyMetric === 'completeness' && shadeByCounty
                      ? 'Tints each county by how complete your county list is — your backup measured against everything reported on eBird.'
                      : 'Tints each county by your own count there — drawn only from your loaded backup.')
                  : 'Load your eBird backup in Settings to use this.'}
                {backupReady && shadeByBreeding && ' Turning this on switches off atlas shading.'}
              </div>

              {shadeByCounty && backupReady && (
                <>
                  <div style={{ marginTop: 10 }}>
                    <SegControl
                      ariaLabel="Choropleth metric"
                      options={[
                        { value: 'species', label: 'Species' },
                        { value: 'records', label: 'Checklists' },
                        { value: 'completeness', label: 'Completeness' },
                      ]}
                      value={countyMetric}
                      onChange={v => setCountyMetric(v as CountyShadeMetric)}
                    />
                  </div>

                  {/* Point-of-use disclosure (FR-34): only while Completeness is
                      selected — this is the one county metric that needs network
                      + the user's eBird key. */}
                  {countyMetric === 'completeness' && (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 10, fontSize: '0.6875rem', color: 'var(--sr-text-muted)', lineHeight: 1.45 }}>
                      <Info size={14} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                      <span>
                        Unlike Species and Checklists, Completeness needs a network connection and your
                        eBird API key. Counties you've fetched are cached for 30 days.
                      </span>
                    </div>
                  )}
                  {countyMetric === 'completeness' && hasEbirdKey === false && (
                    <OfflineMessage kind="no-key" message={EBIRD_NO_KEY_MESSAGE} compact style={{ marginTop: 10 }} />
                  )}

                  {/* Use Textures — per-tier crosshatch density; off by default (colorblind aid) */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12 }}>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 500, color: 'var(--sr-text)' }}>Use Textures</span>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={useCountyTextures}
                      aria-label="Use textures on shaded counties"
                      tabIndex={0}
                      onClick={() => setUseCountyTextures(v => !v)}
                      style={{
                        width: 44, height: 24, borderRadius: 12, border: 'none', flexShrink: 0,
                        background: useCountyTextures ? 'var(--sr-accent)' : 'var(--sr-border-medium)',
                        position: 'relative', cursor: 'pointer', transition: 'background 0.15s',
                      }}
                    >
                      <span style={{
                        position: 'absolute', top: 2, left: useCountyTextures ? 22 : 2, width: 20, height: 20,
                        borderRadius: '50%', background: '#fff', transition: 'left 0.15s',
                      }} />
                    </button>
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                    Adds a distinct hatch density per level so counties are distinguishable without color.
                  </div>

                  {countyMetric === 'completeness' ? (
                    // FR-27: fixed 0–100% band legend — the quantile legend below
                    // is untouched for Species/Checklists (FR-06).
                    <CountyCompletenessLegend useTextures={useCountyTextures} />
                  ) : countyTiers.legend.length === 0 ? (
                    <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', marginTop: 12, fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
                      <AlertCircle size={14} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
                      <span>No recorded counties to shade. Add records or load a backup with county data to see the choropleth.</span>
                    </div>
                  ) : (
                    <div style={{ marginTop: 12 }} aria-live="polite">
                      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', marginBottom: 8 }}>
                        {COUNTY_METRIC_META[countyMetric].title}
                      </div>
                      {countyTiers.legend.map((row, i) => {
                        const isLast = i === countyTiers.legend.length - 1
                        const range = isLast ? `${row.min.toLocaleString()}+` : row.min === row.max ? `${row.min.toLocaleString()}` : `${row.min.toLocaleString()}–${row.max.toLocaleString()}`
                        return (
                          <div key={row.tier} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
                            {useCountyTextures
                              ? <CountyDensitySwatch tier={row.tier as CountyTier} />
                              : <span aria-hidden="true" style={{ width: 26, height: 15, borderRadius: 3, flexShrink: 0, border: '1px solid var(--sr-border-medium)', background: `var(--sr-county-${row.tier})` }} />}
                            <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)' }}>
                              {range}{i === 0 && <span style={{ color: 'var(--sr-text-muted)' }}> {COUNTY_METRIC_META[countyMetric].unit}</span>}
                            </span>
                          </div>
                        )
                      })}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, marginBottom: 6 }}>
                        <span aria-hidden="true" style={{ width: 26, height: 15, borderRadius: 3, flexShrink: 0, border: '1px dashed var(--sr-border-medium)', background: 'transparent' }} />
                        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)' }}>
                          No records <span style={{ color: 'var(--sr-text-muted)' }}>— outline only</span>
                        </span>
                      </div>
                      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.45 }}>
                        Ranges are quantiles of <em>your</em> non-zero counties, so the breaks shift with your data.
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )

  const sightingsSidebar = (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
      <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }}>
        {/* Collapsible filter panel */}
        <div>
          <button tabIndex={0}
            onClick={() => setFilterOpen(o => !o)}
            aria-expanded={filterOpen}
            aria-controls="sr-map-filter-panel"
            style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              width: '100%', padding: '12px 16px',
              background: 'none', border: 'none',
              borderBottom: `1px solid var(--sr-border)`,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)' }}>Filters</span>
            <ChevronDown size={14} style={{ color: 'var(--sr-text-muted)', transform: filterOpen ? 'none' : 'rotate(-90deg)', transition: 'transform 0.2s', flexShrink: 0 }} />
          </button>
          {/* Animated with grid-template-rows 0fr/1fr (no hard max-height cap), so
              added filters can never overflow a clamp and become unreachable. The
              collapsed content is `inert` — clipped-to-zero controls would
              otherwise remain invisible tab stops. */}
          <div id="sr-map-filter-panel" style={{ display: 'grid', gridTemplateRows: filterOpen ? '1fr' : '0fr', transition: 'grid-template-rows 0.25s ease', borderBottom: filterOpen ? '1px solid var(--sr-border)' : 'none' }}>
            <div inert={!filterOpen} style={{ overflow: 'hidden', minHeight: 0 }}>
            <div style={{ padding: '10px 16px 14px' }}>
              {/* Species */}
              <div style={{ marginBottom: 12 }}>
                <SidebarLabel>Species</SidebarLabel>
                <select aria-label="Species" value={speciesFilter} onChange={e => setSpeciesFilter(e.target.value)} style={SELECT_STYLE}>
                  <option value="">All species</option>
                  {allSpecies.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              {/* Date range */}
              <div style={{ marginBottom: 12 }}>
                <SidebarLabel>Date Range</SidebarLabel>
                <div className="sr-field-row">
                  <input type="date" aria-label="From date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                    style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0, boxSizing: 'border-box' }} />
                  <input type="date" aria-label="To date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                    style={{ flex: 1, height: 34, padding: '0 8px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', minWidth: 0, boxSizing: 'border-box' }} />
                </div>
              </div>
              {/* County */}
              {allCounties.length > 0 && (
                <div style={{ marginBottom: 12 }}>
                  <SidebarLabel>County</SidebarLabel>
                  <select aria-label="County" value={countyFilter} onChange={e => setCountyFilter(e.target.value)} style={SELECT_STYLE}>
                    <option value="">All counties</option>
                    {allCounties.map(c => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              )}
              {/* Breeding Code */}
              <div style={{ marginBottom: 12 }}>
                <SidebarLabel>Breeding Code</SidebarLabel>
                <SegControl
                  options={[
                    { value: 'all', label: 'All' },
                    { value: 'possible', label: 'Possible' },
                    { value: 'probable', label: 'Probable' },
                    { value: 'confirmed', label: 'Confirmed' },
                  ]}
                  value={breedingFilter}
                  onChange={v => setBreedingFilter(v as BreedingFilter)}
                />
              </div>
              {/* Media (only when ML export stored) */}
              {phase.tag === 'ready' && phase.hasML && (
                <div>
                  <SidebarLabel>Media</SidebarLabel>
                  <select aria-label="Media" value={mediaFilter} onChange={e => setMediaFilter(e.target.value as MediaFilter)} style={SELECT_STYLE}>
                    <option value="any">Any</option>
                    <option value="photo">Has Photo</option>
                    <option value="audio">Has Audio</option>
                    <option value="video">Has Video</option>
                    <option value="none">No Media</option>
                  </select>
                </div>
              )}
            </div>
            </div>
          </div>
        </div>

        {/* Map View control */}
        <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Map View</SidebarLabel>
          <SegControl
            options={[{ value: 'pins', label: 'Pins' }, { value: 'heatmap', label: 'Heatmap' }]}
            value={displayMode}
            onChange={v => setDisplayMode(v as DisplayMode)}
          />
          {/* Point Size — shrink or hide the sighting points so a shaded
              breeding/county choropleth reads through. Pins mode only (there are
              no points to size in Heatmap). Session-only, composes with the
              shade auto-dim. */}
          {displayMode === 'pins' && (
            <div style={{ marginTop: 12 }}>
              <SidebarLabel>Point Size</SidebarLabel>
              <SegControl
                ariaLabel="Point size"
                options={[
                  { value: 'normal', label: 'Normal' },
                  { value: 'small', label: 'Small' },
                  { value: 'off', label: 'Off' },
                ]}
                value={pointSize}
                onChange={v => setPointSize(v as PointSize)}
              />
            </div>
          )}
          {displayMode === 'heatmap' && (
            <div style={{ marginTop: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <SidebarLabel>Heatmap Intensity</SidebarLabel>
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
        </div>
        {/* Map overlay controls (atlas + county) — above the long in-view list so
            the controls stay near the Map View control, matching the hotspots and
            lifers sidebars. */}
        <div style={{ padding: '0 16px 14px' }}>
          {atlasOverlayControls}
        </div>

        {/* In-view sightings — the longest section, so it sits LAST in the scroll
            area, just above the pinned stats bar. Keyboard-accessible path to the
            GL sighting pins; each row opens the same popup a pin click shows and
            pans the map. */}
        <div style={{ padding: '0 16px 14px' }}>
          <InViewMarkerList
            heading="Sightings in view"
            instructions="Select a location to open its details on the map. Updates as you pan or zoom."
            items={sightingsInView.visible}
            total={sightingsInView.total}
            overCap={sightingsInView.overCap}
            selectedId={selectedSightingLocId}
            getId={l => l.locId}
            getPrimary={l => l.locName}
            getSecondary={l => `${l.count.toLocaleString()} observation${l.count !== 1 ? 's' : ''} · ${l.species.size} species`}
            getDotColor={() => 'var(--sr-map-visited)'}
            onActivate={openSightingFromList}
            collapsed={!!inviewCollapsed['sightings']}
            onToggleCollapsed={() => toggleInview('sightings')}
            panelId="sr-inview-sightings"
          />
        </div>
      </div>

      {/* Stats bar — pinned to sidebar bottom */}
      <div style={{ display: 'flex', borderTop: '1px solid var(--sr-border)', padding: '12px 16px', flexShrink: 0 }}>
        {[
          { label: 'Locations', value: stats.locations.toLocaleString() },
          { label: 'Species',   value: stats.species.toLocaleString() },
          { label: 'Obs',       value: stats.obs >= 1000 ? `${(stats.obs / 1000).toFixed(1)}k` : stats.obs.toLocaleString() },
        ].map((s, i) => (
          <div key={s.label} style={{ flex: 1, textAlign: 'center', borderLeft: i > 0 ? '1px solid var(--sr-border)' : 'none' }}>
            <div style={{ fontSize: '1.0625rem', fontWeight: 700, color: 'var(--sr-accent)', letterSpacing: '-0.02em', lineHeight: 1.1 }}>{s.value}</div>
            <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginTop: 2 }}>{s.label}</div>
          </div>
        ))}
      </div>
    </div>
  )

  const hotspotsSidebar = (
    <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
      {hasEbirdKey === false && <KeyNotice onGoToSettings={onGoToSettings} />}
      <AddressSearch onLocate={(aLat, aLng) => {
        setLat(aLat.toFixed(5)); setLng(aLng.toFixed(5))
        handleFindHotspots(aLat, aLng)
      }} />
      {CenterPointControl}
      {RadiusControl}
      <button tabIndex={0}
        onClick={() => handleFindHotspots()}
        disabled={hotspotsLoading || hasEbirdKey === false}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: hotspotsLoading || hasEbirdKey === false ? 'var(--sr-text-disabled)' : 'var(--sr-accent)',
          color: 'var(--sr-on-accent)', border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
          cursor: hotspotsLoading || hasEbirdKey === false ? 'not-allowed' : 'pointer',
          marginBottom: 10,
        }}
      >
        {hotspotsLoading
          ? <><Loader2 size={14} className="spin" /> Finding…</>
          : 'Find Hotspots'}
      </button>
      {hotspotsError && (
        <OfflineMessage kind={hotspotsError.kind} message={hotspotsError.message} compact style={{ marginBottom: 10 }} />
      )}

      {/* Legend — visible after first successful fetch */}
      {legendVisible && hotspotPins && hotspotPins.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Legend</SidebarLabel>
          <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontStyle: 'italic', marginBottom: 8 }}>
            Click a row to hide or show that pin category.
          </div>
          {([
            { label: 'Visited',   kind: 'visited' as const },
            { label: 'Unvisited', kind: 'unvisited' as const },
            { label: 'Personal',  kind: 'personal' as const },
          ] as { label: string; kind: HotspotPin['kind'] }[])
            .filter(row => hotspotPins.some(p => p.kind === row.kind))
            .map(row => {
              const count = hotspotPins.filter(p => p.kind === row.kind).length
              const isHidden = hiddenKinds.has(row.kind)
              return (
                <button tabIndex={0}
                  key={row.label}
                  aria-pressed={!isHidden}
                  onClick={() => setHiddenKinds(prev => {
                    const next = new Set(prev)
                    if (next.has(row.kind)) next.delete(row.kind); else next.add(row.kind)
                    return next
                  })}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8,
                    width: '100%', background: 'none', border: 'none', padding: 0,
                    cursor: 'pointer', opacity: isHidden ? 0.4 : 1, textAlign: 'left',
                  }}
                >
                  <div dangerouslySetInnerHTML={{ __html: TEARDROP_HTML[row.kind] }} style={{ flexShrink: 0, width: 28, height: 40 }} />
                  <div>
                    <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>{row.label}</span>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', marginLeft: 6 }}>{count}</span>
                  </div>
                </button>
              )
            })}
        </div>
      )}

      {atlasOverlayControls}

      {nearestUnvisited.length > 0 && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          <SidebarLabel>Nearest Unvisited Hotspots</SidebarLabel>
          {nearestUnvisited.map(({ pin, dist }) => (
            <div
              key={pin.locId}
              className="sr-nearest-unvisited-row"
              style={{
                display: 'flex', alignItems: 'center', gap: 6, width: '100%',
                padding: '5px 8px', marginBottom: 2, borderRadius: 6,
              }}
            >
              <span style={{ display: 'inline-block', width: 7, height: 7, borderRadius: '50%', background: 'var(--sr-map-unvisited)', flexShrink: 0 }} aria-hidden="true" />
              {/* Row opens the on-map popup + pans (keyboard path to the teardrop);
                  the trailing ↗ still links out to eBird. */}
              <button
                type="button"
                tabIndex={0}
                onClick={() => openHotspotFromList(pin)}
                aria-pressed={selectedHotspotLocId === pin.locId}
                className="sr-nearest-unvisited-name"
                style={{
                  flex: 1, minWidth: 0, display: 'flex', alignItems: 'center',
                  fontSize: '0.78125rem', color: 'var(--sr-text)', overflow: 'hidden',
                  background: 'none', border: 'none', padding: 0, textAlign: 'left',
                  fontFamily: 'inherit', cursor: 'pointer',
                }}
                title="Show on map"
              >
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.locName}</span>
              </button>
              {/* The trailing ↗ links to the eBird hotspot page. This list is, by
                  type, only unvisited hotspots — all public — so isHotspot is true;
                  the shared HotspotLink still shape-validates the id (no styled 404). */}
              <HotspotLink
                locId={pin.locId}
                name={pin.locName}
                isHotspot
                compact
                title="Open on eBird (opens in a new tab)"
                className="sr-map-icon-btn-touch"
                style={{ flexShrink: 0, width: 26, height: 26, justifyContent: 'center' }}
              />
              <span style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>{dist.toFixed(1)} mi</span>
            </div>
          ))}
        </div>
      )}

      {/* In-view hotspots — the longest section, so it sits LAST in the panel
          (below Nearest Unvisited), matching the other view sidebars. Keyboard-
          accessible path to the GL teardrops; each row opens the same popup a
          teardrop click shows and pans the map. */}
      {hotspotPins && hotspotPins.length > 0 && (
        <InViewMarkerList
          heading="Hotspots in view"
          instructions="Select a hotspot to open its details on the map. Updates as you pan or zoom."
          items={hotspotsInView.visible}
          total={hotspotsInView.total}
          overCap={hotspotsInView.overCap}
          selectedId={selectedHotspotLocId}
          getId={p => p.locId}
          getPrimary={p => p.locName}
          getSecondary={p => p.kind === 'visited' ? `Visited · ${p.speciesCount} species`
            : p.kind === 'personal' ? `Personal location · ${p.obsCount} observation${p.obsCount !== 1 ? 's' : ''}`
            : 'Unvisited hotspot'}
          getDotColor={p => `var(--sr-map-${p.kind})`}
          getDotLabel={p => p.kind === 'visited' ? 'Visited' : p.kind === 'personal' ? 'Personal location' : 'Unvisited'}
          onActivate={openHotspotFromList}
          collapsed={!!inviewCollapsed['hotspots']}
          onToggleCollapsed={() => toggleInview('hotspots')}
          panelId="sr-inview-hotspots"
        />
      )}
    </div>
  )

  const targetsHasML = phase.tag === 'ready' && phase.hasML
  const targetsNoML  = phase.tag === 'ready' && !phase.hasML
  const targetsFetchDisabled =
    targetsLoading ||
    hasEbirdKey === false ||
    (targetsHasML && targetSpecies.length === 0) ||
    (targetsNoML && manualTargets.size === 0)

  const targetsSidebar = (
    <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
      {hasEbirdKey === false && <KeyNotice onGoToSettings={onGoToSettings} />}
      <AddressSearch onLocate={(aLat, aLng) => {
        setLat(aLat.toFixed(5)); setLng(aLng.toFixed(5))
        handleFindSightings(aLat, aLng)
      }} />
      {CenterPointControl}
      {RadiusControl}

      {/* Target species — auto-derived when ML export present */}
      {targetsHasML && (
        <div style={{ marginBottom: 16 }}>
          <SidebarLabel>Target Species</SidebarLabel>
          {targetSpecies.length === 0 ? (
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
              You already have media for every species in your eBird backup.
            </div>
          ) : (
            <div style={{ padding: '10px 12px', background: 'var(--sr-surface-subtle)', borderRadius: 8, border: '1px solid var(--sr-border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 3 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--sr-map-target)', flexShrink: 0 }} />
                <button tabIndex={0}
                  onClick={onNavigateToMediaList}
                  style={{
                    fontSize: '0.875rem', fontWeight: 700, color: 'var(--sr-accent)',
                    background: 'none', border: 'none', padding: 0, cursor: 'pointer',
                    fontFamily: 'inherit', textDecoration: 'underline',
                    textDecorationColor: 'rgba(45,134,83,0.4)',
                  }}
                >
                  {targetSpecies.length} target species
                </button>
              </div>
              <div style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', marginLeft: 15 }}>from ML export · missing ≥1 media type</div>
            </div>
          )}
        </div>
      )}

      {/* Manual species select — when no ML export */}
      {targetsNoML && (
        <div style={{ marginBottom: 16 }}>
          <SidebarLabel>Target Species</SidebarLabel>
          <div style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', marginBottom: 8, lineHeight: 1.45 }}>
            Upload an ML export in Settings to auto-derive targets, or select species manually.
          </div>
          <input type="text" placeholder="Search species…" value={targetSearch}
            onChange={e => setTargetSearch(e.target.value)}
            style={{ width: '100%', height: 32, padding: '0 10px', border: '1.5px solid var(--sr-border)', borderRadius: 6, fontSize: '0.75rem', fontFamily: 'inherit', color: 'var(--sr-text)', background: 'var(--sr-surface)', outline: 'none', boxSizing: 'border-box', marginBottom: 6 }}
          />
          <div style={{ maxHeight: 130, overflowY: 'auto', border: '1.5px solid var(--sr-border)', borderRadius: 6, background: 'var(--sr-surface)' }}>
            {filteredManualSpecies.slice(0, 60).map(s => (
              <label key={s} style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '5px 10px', cursor: 'pointer', fontSize: '0.75rem', minWidth: 0 }}>
                <input
                  type="checkbox"
                  checked={manualTargets.has(s)}
                  onChange={e => setManualTargets(prev => {
                    const next = new Set(prev)
                    if (e.target.checked) next.add(s); else next.delete(s)
                    return next
                  })}
                  style={{ flexShrink: 0 }}
                />
                <span style={{ color: 'var(--sr-text)', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s}</span>
              </label>
            ))}
          </div>
          {manualTargets.size > 0 && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 5 }}>{manualTargets.size} selected</div>
          )}
        </div>
      )}

      <button tabIndex={0}
        onClick={() => handleFindSightings()}
        disabled={targetsFetchDisabled}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: 'var(--sr-accent)', color: 'var(--sr-on-accent)',
          border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
          cursor: targetsFetchDisabled ? 'not-allowed' : 'pointer',
          opacity: targetsFetchDisabled ? 0.5 : 1,
          marginBottom: 10,
        }}
      >
        {targetsLoading
          ? <><Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> Finding…</>
          : 'Find Recent Sightings'}
      </button>
      {targetsError && (
        <OfflineMessage kind={targetsError.kind} message={targetsError.message} compact />
      )}

      {/* Recency toggle + nearest-10 — shown once pins are loaded */}
      {targetPins !== null && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          {/* Filter by type */}
          <div style={{ marginBottom: 12 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 6 }}>
              <SidebarLabel>Filter by Type</SidebarLabel>
              <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{displayedTargetPins.length} species</span>
            </div>
            <div style={{ display: 'flex', gap: 5, flexWrap: 'wrap' }}>
              <button tabIndex={0}
                onClick={() => setTargetTypeFilter(new Set())}
                style={{
                  display: 'inline-flex', alignItems: 'center', padding: '3px 9px',
                  borderRadius: 20, fontSize: '0.71875rem', fontWeight: 500,
                  cursor: 'pointer', fontFamily: 'inherit',
                  background: targetTypeFilter.size === 0 ? 'var(--sr-is-target-bg)' : 'var(--sr-surface-subtle)',
                  border: `1.5px solid ${targetTypeFilter.size === 0 ? 'var(--sr-is-target-border)' : 'var(--sr-border)'}`,
                  color: targetTypeFilter.size === 0 ? 'var(--sr-is-target-text)' : 'var(--sr-text-muted)',
                }}
              >
                All
              </button>
              {(['Photo', 'Audio', 'Video'] as const).map(type => {
                const isActive = targetTypeFilter.has(type)
                return (
                  <button tabIndex={0}
                    key={type}
                    onClick={() => setTargetTypeFilter(prev => {
                      const next = new Set(prev)
                      if (next.has(type)) next.delete(type); else next.add(type)
                      return next
                    })}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4, padding: '3px 9px',
                      borderRadius: 20, fontSize: '0.71875rem', fontWeight: 500,
                      cursor: 'pointer', fontFamily: 'inherit',
                      background: isActive ? 'var(--sr-is-target-bg)' : 'var(--sr-surface-subtle)',
                      border: `1.5px solid ${isActive ? 'var(--sr-is-target-border)' : 'var(--sr-border)'}`,
                      color: isActive ? 'var(--sr-is-target-text)' : 'var(--sr-text-muted)',
                    }}
                  >
                    <span style={{ display: 'inline-flex' }} dangerouslySetInnerHTML={{ __html: MEDIA_ICONS[type] }} />
                    {type}
                  </button>
                )
              })}
            </div>
          </div>
          <div style={{ marginBottom: 12 }}>
            <SidebarLabel>Time Range</SidebarLabel>
            <SegControl
              options={TIME_WINDOW_OPTS}
              value={targetViewMode}
              onChange={v => { setTargetViewMode(v as TimeWindow); setSelectedTargetLocId(null) }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <SidebarLabel>Marker Style</SidebarLabel>
            <SegControl
              ariaLabel="Target marker style"
              options={[{ value: 'labels', label: 'Labels' }, { value: 'dots', label: 'Dots' }]}
              value={targetMarkerMode}
              onChange={v => setTargetMarkerMode(v as MarkerMode)}
            />
          </div>
          {atlasOverlayControls}
          {displayedTargetPins.length > 0 && (
            <div>
              <button type="button" tabIndex={0} onClick={() => toggleInview('targets')} aria-expanded={!inviewCollapsed['targets']} aria-controls="sr-inview-targets"
                style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: 0, marginBottom: inviewCollapsed['targets'] ? 0 : 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
                <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)' }}>Targets in View ({targetsInView.total.toLocaleString()})</span>
                <ChevronDown size={14} style={{ color: 'var(--sr-text-muted)', transform: inviewCollapsed['targets'] ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
              </button>
              <div id="sr-inview-targets" style={{ display: 'grid', gridTemplateRows: inviewCollapsed['targets'] ? '0fr' : '1fr', transition: 'grid-template-rows 0.2s ease' }}>
                <div inert={!!inviewCollapsed['targets']} style={{ overflow: 'hidden', minHeight: 0 }}>
              <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
                Select a target to open its details on the map. Updates as you pan or zoom.
              </div>
              {targetsInView.visible.length === 0 ? (
                <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
                  None in the current map view — pan or zoom to bring targets into view.
                </div>
              ) : (
                <ul role="list" aria-label="Targets in view" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {targetsInView.visible.map(({ pin, dist }) => {
                    const key = `${pin.speciesCode}-${pin.locId}`
                    const tier = recencyTier(pin.recentDate)
                    const { bg } = tierColors(tier)
                    const isSelected = selectedTargetLocId === pin.locId
                    return (
                      <li role="listitem" key={key}>
                        <div
                          style={{
                            display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                            padding: '6px 8px', marginBottom: 2, borderRadius: 6,
                            background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                            border: `1px solid ${isSelected ? 'var(--sr-accent-border)' : 'transparent'}`,
                          }}
                        >
                          {/* The faded "old" dot gets a strong border so the tier isn't
                              conveyed by a low-contrast fill alone. */}
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: bg, border: `1px solid ${tier === 'old' ? 'var(--sr-accent-strong)' : 'transparent'}`, flexShrink: 0 }}>
                            <span className="sr-only">
                              {tier === 'fresh' ? 'Recent (≤7 days)' : tier === 'mid' ? 'Seen 8–14 days ago' : 'Seen 15–30 days ago'}
                            </span>
                          </div>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <BirdName commonName={pin.comName} taxonCode={speciesCodeMap[pin.comName]} hasEntry={hasEntryFor(pin.comName)} onOpenSpecies={onOpenSpecies} size="sm" />
                            {pin.missingTypes.length > 0 && (
                              <span className="sr-only">Missing {pin.missingTypes.map(t => t.toLowerCase()).join(', ')}</span>
                            )}
                            <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{pin.locName}</div>
                          </div>
                          <div style={{ flexShrink: 0, textAlign: 'right' }}>
                            <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>{formatDate(pin.recentDate)}</div>
                            {dist !== null && (
                              <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums' }}>{dist.toFixed(1)} mi</div>
                            )}
                          </div>
                          <button
                            tabIndex={0}
                            onClick={() => {
                              if (isSelected) { setSelectedTargetLocId(null); return }
                              setSelectedTargetLocId(pin.locId)
                              setPanTarget({ lat: pin.lat, lng: pin.lng })
                            }}
                            aria-pressed={isSelected}
                            title="Show on map"
                            aria-label={`Show ${pin.comName} on the map`}
                            className="sr-map-icon-btn-touch"
                            style={{
                              flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                              width: 26, height: 26, borderRadius: 6, cursor: 'pointer',
                              background: 'transparent', border: '1px solid var(--sr-border)', color: 'var(--sr-text-muted)',
                            }}
                          >
                            <Crosshair size={13} strokeWidth={2.2} />
                          </button>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              )}
              {targetsInView.overCap && (
                <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
                  Showing the first {MARKER_LIST_CAP} of {targetsInView.total.toLocaleString()} in view — zoom in to narrow the list.
                </div>
              )}
                </div>
              </div>
            </div>
          )}
          {displayedTargetPins.length === 0 && (
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
              No targets match this filter.
            </div>
          )}
        </div>
      )}
    </div>
  )

  const lifersSidebar = (
    <div style={{ padding: '14px 16px', overflowY: 'auto', flex: 1 }}>
      {hasEbirdKey === false && <KeyNotice onGoToSettings={onGoToSettings} />}
      <AddressSearch onLocate={(aLat, aLng) => {
        setLat(aLat.toFixed(5)); setLng(aLng.toFixed(5))
        handleFindLifers(aLat, aLng)
      }} />
      {CenterPointControl}
      {RadiusControl}
      <button tabIndex={0}
        onClick={() => handleFindLifers()}
        disabled={lifersLoading || hasEbirdKey === false || phase.tag !== 'ready'}
        style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 7,
          width: '100%', height: 36,
          background: lifersLoading || hasEbirdKey === false || phase.tag !== 'ready' ? 'var(--sr-text-disabled)' : 'var(--sr-accent)',
          color: 'var(--sr-on-accent)', border: 'none', borderRadius: 6,
          fontSize: '0.8125rem', fontWeight: 500, fontFamily: 'inherit',
          cursor: lifersLoading || hasEbirdKey === false || phase.tag !== 'ready' ? 'not-allowed' : 'pointer',
          marginBottom: 10,
        }}
      >
        {lifersLoading
          ? <><Loader2 size={14} className="spin" /> Finding…</>
          : 'Find Nearby Lifers'}
      </button>
      {phase.tag !== 'ready' && (
        <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', lineHeight: 1.5, marginBottom: 10 }}>
          Load your eBird backup in Settings to identify which nearby species are lifers for you.
        </div>
      )}
      {lifersError && (
        <OfflineMessage kind={lifersError.kind} message={lifersError.message} compact style={{ marginBottom: 10 }} />
      )}

      {liferPins !== null && (
        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
          <div style={{ marginBottom: 12 }}>
            <SidebarLabel>Time Range</SidebarLabel>
            <SegControl
              options={TIME_WINDOW_OPTS}
              value={liferWindow}
              onChange={v => { setLiferWindow(v as TimeWindow); setSelectedLiferLocId(null) }}
            />
          </div>
          <div style={{ marginBottom: 12 }}>
            <SidebarLabel>Marker Style</SidebarLabel>
            <SegControl
              ariaLabel="Lifer marker style"
              options={[{ value: 'labels', label: 'Labels' }, { value: 'dots', label: 'Dots' }]}
              value={liferMarkerMode}
              onChange={v => setLiferMarkerMode(v as MarkerMode)}
            />
          </div>
          <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 12 }}>
            {displayedLiferLocations.length.toLocaleString()} spot{displayedLiferLocations.length !== 1 ? 's' : ''} · {totalLifers.toLocaleString()} lifer{totalLifers !== 1 ? 's' : ''}
          </div>
          {atlasOverlayControls}
          {displayedLiferLocations.length > 0 ? (
            <InViewMarkerList
              heading="Nearby lifers in view"
              instructions="Select a spot to open its details on the map. Updates as you pan or zoom."
              items={lifersInView.visible}
              total={lifersInView.total}
              overCap={lifersInView.overCap}
              selectedId={selectedLiferLocId}
              getId={l => l.locId}
              getPrimary={l => l.locName}
              getSecondary={l => `${l.count} lifer${l.count !== 1 ? 's' : ''} · ${l.lifers.map(s => s.comName).join(', ')}`}
              getDotColor={l => tierColors(l.tier).bg}
              getDotLabel={l => l.tier === 'fresh' ? 'Seen in last 7 days' : l.tier === 'mid' ? 'Seen 8–14 days ago' : 'Seen 15–30 days ago'}
              onActivate={openLiferFromList}
              collapsed={!!inviewCollapsed['lifers']}
              onToggleCollapsed={() => toggleInview('lifers')}
              panelId="sr-inview-lifers"
            />
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
              No nearby lifers in this time range.
            </div>
          )}
        </div>
      )}
    </div>
  )

  // Center pin (the three search views only): a draggable marker at the current
  // center, set by right-click / long-press and dragged to fine-tune. It replaces
  // the detected-location dot while shown so the two never overlap.
  const isCenterView = viewMode === 'hotspots' || viewMode === 'targets' || viewMode === 'lifers'
  const centerLatNum = parseFloat(lat)
  const centerLngNum = parseFloat(lng)
  const hasValidCenter = !Number.isNaN(centerLatNum) && !Number.isNaN(centerLngNum)
  const centerPinShown = isCenterView && hasValidCenter

  // ── Layout ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, height: '100%' }}>
      {/* Mode bar — flexWrap so the four pills drop to a second/third line on a
          narrow phone (or at a large in-app text size) instead of forcing the
          whole panel into horizontal overflow. */}
      <div role="group" aria-label="Map view mode" style={{ display: 'flex', flexWrap: 'wrap', gap: 8, padding: '10px 16px', borderBottom: '1px solid var(--sr-border)', background: 'var(--sr-surface)', flexShrink: 0 }}>
        {MAP_VIEW_MODE_ORDER.map(({ mode, label }) => {
          const icon =
            mode === 'sightings'
              ? <MapPin size={14} strokeWidth={2.5} />
              : mode === 'hotspots'
                ? <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden><circle cx="8" cy="12" r="4"/><circle cx="16" cy="12" r="4"/></svg>
                : mode === 'lifers'
                  ? <Binoculars size={14} strokeWidth={2.5} />
                  : <Camera size={14} strokeWidth={2.5} />

          return (
            <button tabIndex={0}
              key={mode}
              aria-pressed={viewMode === mode}
              onClick={() => {
                setViewMode(mode)
                if (mode === 'hotspots' || mode === 'targets' || mode === 'lifers') {
                  const latNum = parseFloat(lat)
                  const lngNum = parseFloat(lng)
                  if (!isNaN(latNum) && !isNaN(lngNum)) {
                    setDefaultCenter({ lat: latNum, lng: lngNum, zoom: radiusToZoom(radius) })
                    if (mode === 'hotspots' && !hotspotsLoading && hasEbirdKey !== false) {
                      handleFindHotspots(latNum, lngNum)
                    } else if (mode === 'targets' && !targetsFetchDisabled && phase.tag === 'ready') {
                      handleFindSightings(latNum, lngNum)
                    } else if (mode === 'lifers' && !lifersLoading && hasEbirdKey !== false && phase.tag === 'ready') {
                      handleFindLifers(latNum, lngNum)
                    }
                  }
                }
              }}
              style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 14px', borderRadius: 20,
                background: viewMode === mode ? 'var(--sr-accent-bg)' : 'var(--sr-surface-subtle)',
                border: `1.5px solid ${viewMode === mode ? 'var(--sr-accent-border)' : 'transparent'}`,
                color: viewMode === mode ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                fontWeight: viewMode === mode ? 600 : 400,
                fontSize: '0.8125rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
              }}
            >
              {icon}
              {label}
            </button>
          )
        })}
      </div>

      {/* Content: sidebar + map. On iOS builds ONLY, fullscreen adds
          sr-map-ios-fullscreen (globals.css): the sidebar becomes the
          phone-tier overlay and the Filters FAB appears at ANY width — the
          user-approved mobile-app design-review rule. Desktop/web fullscreen
          keeps the sidebar visible beside the map, unchanged. */}
      <div className={mapContentClass(isIOS() && !!isFullscreen)} style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        {/* Backdrop — mobile only, shown when sidebar open */}
        {sidebarOpen && (
          <div
            className="sr-map-backdrop"
            onClick={closeSidebar}
            aria-hidden="true"
          />
        )}

        {/* Sidebar */}
        <div
          ref={sidebarRef}
          className={`sr-map-sidebar-overlay${sidebarOpen ? '' : ' sr-map-sidebar-hidden'}`}
          /* Width lives in the .sr-map-sidebar-overlay class (globals.css), NOT
             inline: an inline width (specificity 1,0,0) beats the ≤640 media
             query, so the phone overlay's min(282px, 90vw) was dead CSS. The
             base class rule carries the same clamp(240px, 28vw, 300px) for the
             641–1024 tablet band; only the ≤640 tier overrides it. Keep just
             flexShrink/border/background inline (non-layout). */
          style={{ flexShrink: 0, borderRight: '1px solid var(--sr-border)', background: 'var(--sr-surface)' }}
        >
          {/* Mobile-only header with close button */}
          <div className="sr-map-sidebar-close">
            <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>Map Filters</span>
            <button tabIndex={0}
              onClick={closeSidebar}
              aria-label="Close filters"
              className="sr-map-icon-btn-touch"
              style={{
                width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center',
                background: 'var(--sr-surface-subtle)', border: 'none', borderRadius: '50%',
                cursor: 'pointer', color: 'var(--sr-text-muted)',
              }}
            >
              <X size={14} />
            </button>
          </div>
          {viewMode === 'sightings' && sightingsSidebar}
          {viewMode === 'hotspots' && hotspotsSidebar}
          {viewMode === 'targets'  && targetsSidebar}
          {viewMode === 'lifers'   && lifersSidebar}
        </div>

        {/* Map area */}
        <div style={{ flex: 1, position: 'relative' }}>
          {/* Loading chip over the canvas while a search is in flight — the
              sidebar button already shows "Finding…", but on mobile (sidebar
              closed) the map itself gave no signal. */}
          {((viewMode === 'hotspots' && hotspotsLoading) || (viewMode === 'targets' && targetsLoading) || (viewMode === 'lifers' && lifersLoading)) && (
            /* Bound + allow wrap (overriding the class's nowrap) so the centered
               chip stays compact on a narrow phone and doesn't reach across to
               touch the top-right layers switcher. */
            <div className="sr-map-loading-chip" role="status" style={{ maxWidth: 'calc(100% - 24px)', whiteSpace: 'normal', textAlign: 'center' }}>
              <Loader2 size={13} className="spin" aria-hidden="true" style={{ flexShrink: 0 }} />
              {viewMode === 'hotspots' ? 'Finding hotspots…' : viewMode === 'targets' ? 'Finding sightings…' : 'Finding nearby lifers…'}
            </div>
          )}
          {/* Floating map controls, hidden while the mobile sidebar overlay is open.
              Fullscreen toggle shows on all widths; the Filters button is mobile-
              only (CSS). They sit in a flex cluster so they never overlap regardless
              of the Filters label width. */}
          {!sidebarOpen && (
            <div className="sr-map-fab-cluster">
              {onToggleFullscreen && (
                <button tabIndex={0}
                  className="sr-map-fullscreen-btn"
                  onClick={onToggleFullscreen}
                  aria-label={isFullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
                  aria-pressed={!!isFullscreen}
                >
                  {isFullscreen
                    ? <Minimize2 size={16} strokeWidth={2.5} />
                    : <Maximize2 size={16} strokeWidth={2.5} />}
                </button>
              )}
              <button tabIndex={0}
                ref={filtersButtonRef}
                className="sr-map-filters-btn"
                onClick={() => setSidebarOpen(true)}
                aria-label="Open map filters"
              >
                <Filter size={14} strokeWidth={2.5} />
                Filters
              </button>
            </div>
          )}
          {isSetupRequired && viewMode === 'sightings' ? (
            <SetupRequired
              title="eBird Backup Required"
              body="Map Explorer needs your eBird backup to show your sightings on the map. Hotspot and Media Targets modes also benefit from a backup for visited classification."
              steps={EBIRD_BACKUP_STEPS}
              onGoToSettings={onGoToSettings}
            />
          ) : (
            <SnowMap
              initialViewState={{ longitude: -100, latitude: 45, zoom: 4 }}
              style={{ height: '100%', width: '100%' }}
              switcher
            >
              <MapEffects
                panTarget={panTarget}
                onPanDone={handlePanDone}
                defaultCenter={defaultCenter}
                onDefaultDone={handleDefaultCenterDone}
              />
              <BoundsTracker onBounds={handleBounds} />
              {/* Offline region rendering (FR-17): serves a downloaded region's
                  local tiles when offline + in coverage. Self-gates to a no-op
                  unless offline-maps is enabled AND a region is downloaded. */}
              <RegionBaseSource />
              {/* Mute the basemap (grey the land fills / desaturate raster bases)
                  while a county or atlas shading ramp is active, so the ramp pops. */}
              <BasemapDesaturation active={shadeByCounty || shadeByBreeding} />
              {atlasEnabled && (
                <AtlasLayer
                  data={atlasData}
                  shade={shadeByBreeding}
                  breedingByBlock={breedingByBlock}
                  useTextures={useTextures}
                />
              )}
              {countyLinesEnabled && (
                <CountyLayer
                  data={countyData}
                  shade={shadeByCounty}
                  aggregates={countyAggregates}
                  tiers={countyTiers}
                  metric={countyMetric}
                  completeness={countyMetric === 'completeness' ? countyCompleteness : null}
                  useTextures={useCountyTextures}
                  onOpenSpecies={onOpenSpecies}
                  hasEntryFor={hasEntryFor}
                  taxonCodeFor={name => speciesCodeMap[name]}
                  isPublicHotspot={isHotspot}
                />
              )}
              {detectedLocation && !centerPinShown && <DetectedLocationPin position={detectedLocation} />}
              {isCenterView && (
                <>
                  <CenterPinDropper onDrop={applyCenter} />
                  {centerPinShown && <CenterPin lat={centerLatNum} lng={centerLngNum} onMove={applyCenter} />}
                </>
              )}
              {viewMode === 'sightings' && !isSetupRequired && (
                <SightingMarkers locations={filteredLocations} displayMode={displayMode} pointSize={pointSize} heatIntensity={heatIntensity} shadingFillId={atlasEnabled && shadeByBreeding ? 'sr-atlas-fill' : countyLinesEnabled && shadeByCounty ? 'sr-county-fill' : undefined} sel={selectedSightingLocId} onSelect={setSelectedSightingLocId} />
              )}
              {viewMode === 'hotspots' && hotspotPins && (
                <HotspotMarkers key={hotspotPins.length} pins={hotspotPins} hiddenKinds={hiddenKinds} sel={selectedHotspotLocId} onSelect={setSelectedHotspotLocId} />
              )}
              {viewMode === 'targets' && targetPins && (
                <TargetMarkers key={`${targetPins.length}-${targetViewMode}`} pins={displayedTargetPins} speciesCodeMap={speciesCodeMap} hasEntryFor={hasEntryFor} onOpenSpecies={onOpenSpecies} sel={selectedTargetLocId} onSelect={setSelectedTargetLocId} markerMode={targetMarkerMode} />
              )}
              {viewMode === 'lifers' && liferPins && (
                <NearbyLiferMarkers key={`${displayedLiferLocations.length}-${liferWindow}`} pins={displayedLiferLocations} speciesCodeMap={speciesCodeMap} onOpenSpecies={onOpenSpecies} sel={selectedLiferLocId} onSelect={setSelectedLiferLocId} markerMode={liferMarkerMode} />
              )}
            </SnowMap>
          )}
        </div>
      </div>
    </div>
  )
}
