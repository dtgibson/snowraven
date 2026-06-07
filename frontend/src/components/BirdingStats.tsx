import { useEffect, useMemo, useState } from 'react'
import {
  BarChart2, Trophy, Clock, MapPin, ShieldCheck, Dna, Star,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Calendar, Video,
  ListOrdered, Award,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend,
} from 'recharts'
import { Marker, Popup } from 'react-map-gl/maplibre'
import type { Map as MaplibreMap } from 'maplibre-gl'
import { SnowMap } from './SnowMap'
import { buildMediaGraphData } from '../lib/sightingsGraph'
import type { MediaGraphInterval } from '../lib/sightingsGraph'
import { loadEbirdObservations } from '../lib/observationsCache'
import { loadMLExport } from '../lib/mlExportCache'
import type { MLExportRow } from '../lib/parseMLExport'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { regionName } from '../lib/regionNames'
import { BirdName } from './BirdName'
import {
  filterObservations, computeChecklists, computeLifeList, computeTopSpecies, computeTotals,
  computeAccumulation, computeTemporal, computeGeo, computeEffort, computeQuality,
  computeBreedingStats, computeMlStats, computeFunStats,
  formatPeriodLabel, MILESTONE_THRESHOLDS, KM_TO_MI, HA_TO_ACRE,
} from '../lib/birdingStats'
import type { Granularity, PeriodGranularity } from '../lib/birdingStats'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { formatDateMonthFirst as fmtDate } from '../lib/formatDate'
import type { ObservationEntry, ChecklistEntry } from '../types'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mlRows: MLExportRow[]; freshness: string }

type MapDefaults = { lat: number; lng: number; dist: number }

type NemesisSpecies = { commonName: string; recentDate: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_OBS: ObservationEntry[] = []
const EMPTY_ML: MLExportRow[] = []
const SESSION_NOW_MS = Date.now()
const SUBMISSION_ID_RE = /^S\d+$/

// Spell a total duration (minutes) into yr/mo/day/hr/min, largest non-zero units
// only (eBird durations are minute-granular, so seconds never apply).
function formatDuration(totalMin: number): string {
  let m = Math.round(totalMin)
  const yr = Math.floor(m / 525600); m -= yr * 525600
  const mo = Math.floor(m / 43200); m -= mo * 43200
  const day = Math.floor(m / 1440); m -= day * 1440
  const hr = Math.floor(m / 60); m -= hr * 60
  const parts: string[] = []
  if (yr) parts.push(`${yr} yr${yr !== 1 ? 's' : ''}`)
  if (mo) parts.push(`${mo} mo`)
  if (day) parts.push(`${day} day${day !== 1 ? 's' : ''}`)
  if (hr) parts.push(`${hr} hr${hr !== 1 ? 's' : ''}`)
  if (m) parts.push(`${m} min`)
  return parts.length ? parts.join(', ') : '0 min'
}
const ML_USER_RE = /^ML__.*_([A-Za-z0-9]+)\.csv$/i

function mlCatalogUrl(name: string, type: 'Photo' | 'Audio' | 'Video', userId: string | null, taxonCode?: string | null): string {
  const mt = type.toLowerCase()
  const userSuffix = userId ? `&userId=${encodeURIComponent(userId)}` : ''
  if (taxonCode) {
    return `https://search.macaulaylibrary.org/catalog?mediaType=${mt}&taxonCode=${encodeURIComponent(taxonCode)}${userSuffix}`
  }
  return `https://search.macaulaylibrary.org/catalog?taxaName=${encodeURIComponent(name)}&mediaType=${mt}${userSuffix}`
}

const PROTOCOL_COLORS = [
  'var(--sr-accent)',
  'var(--sr-graph-photo)',
  'var(--sr-graph-video)',
  'var(--sr-graph-audio)',
  'var(--sr-chart-slate)',
]

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

// ── Sub-components ────────────────────────────────────────────────────────────

function sectionSlug(title: string): string {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '')
}

// Always-present sections, in render order (through Breeding Stats). The two
// trailing sections — "Media" (only when an ML export is loaded) and the always-
// present "Other Statistics" — are appended at render time so the jump-nav never
// shows a chip for a section that isn't on the page.
const NAV_SECTIONS = [
  'Life List Totals', 'Top Species', 'Firsts & Milestones', 'Temporal Stats',
  'Geographic Stats', 'Effort & Outings', 'Data Quality', 'Highlights & Records',
  'Breeding Stats',
]

function SectionCard({ children, title, icon }: {
  children: React.ReactNode; title: string; icon: React.ReactNode
}) {
  return (
    <div id={sectionSlug(title)} style={{
      scrollMarginTop: 16,
      background: 'var(--sr-surface)',
      border: '1px solid var(--sr-border)',
      borderRadius: 12,
      padding: 'clamp(14px, 4vw, 24px)',
      boxShadow: 'var(--sr-card-shadow)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--sr-border-subtle)',
      }}>
        <span style={{ color: 'var(--sr-accent)' }}>{icon}</span>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

function StatCell({ label, value, sub, large = true }: {
  label: string; value: string | number; sub?: string; large?: boolean
}) {
  return (
    <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{
        fontSize: large ? '1.75rem' : '1.375rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--sr-text)',
        lineHeight: 1,
      }}>
        {typeof value === 'number' ? fmt(value) : value}
      </span>
      {sub && <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{sub}</span>}
      <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  )
}

function BarRow({ label, value, max, color = 'var(--sr-accent)', labelWidth = 44, pctOf }: {
  label: string; value: number; max: number; color?: string; labelWidth?: number; pctOf?: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const pctDisplay = pctOf && pctOf > 0 && value > 0 ? Math.round(value / pctOf * 100) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
      <span style={{
        fontSize: '0.6875rem', color: 'var(--sr-text-muted)',
        textAlign: 'right', flexShrink: 0, width: labelWidth,
      }}>{label}</span>
      <div style={{
        flex: 1, height: 8, borderRadius: 4,
        background: 'var(--sr-surface-subtle)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 4, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: pctDisplay !== null ? 68 : 40, textAlign: 'right' }}>
        {fmt(value)}{pctDisplay !== null ? ` (${pctDisplay}%)` : ''}
      </span>
    </div>
  )
}

function Divider() {
  return <div style={{ height: 1, background: 'var(--sr-border-subtle)', margin: '16px 0' }} />
}

function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: '0 0 10px' }}>
      {children}
    </p>
  )
}

function RankIcon({ rank, shape }: { rank: number; shape: 'circle' | 'square' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ display: 'block', cursor: 'pointer' }}>
      {shape === 'circle'
        ? <circle cx="12" cy="12" r="11" fill="#2D8653" />
        : <rect x="1" y="1" width="22" height="22" rx="3" fill="#3B82F6" />}
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif">{rank}</text>
    </svg>
  )
}

/** Fit the map to all pins once it's loaded (replaces the Leaflet bounds-fitter). */
function fitToPins(map: MaplibreMap, pins: { lat: number; lng: number }[]) {
  if (pins.length === 0) return
  if (pins.length === 1) { map.easeTo({ center: [pins[0].lng, pins[0].lat], zoom: 11, duration: 0 }); return }
  let minLng = Infinity, minLat = Infinity, maxLng = -Infinity, maxLat = -Infinity
  for (const p of pins) {
    minLng = Math.min(minLng, p.lng); maxLng = Math.max(maxLng, p.lng)
    minLat = Math.min(minLat, p.lat); maxLat = Math.max(maxLat, p.lat)
  }
  map.fitBounds([[minLng, minLat], [maxLng, maxLat]], { padding: 28, duration: 0 })
}

// ── Main component ────────────────────────────────────────────────────────────

export function BirdingStats({ onGoToSettings, onOpenSpecies }: { onGoToSettings: () => void; onOpenSpecies?: (commonName: string) => void }) {
  const [phase, setPhase]           = useState<Phase>({ tag: 'loading-saved' })
  const [mapDefaults, setMapDefaults] = useState<MapDefaults | null>(null)
  const [includeSpuh, setIncludeSpuh] = useState(false)
  const [accGranularity, setAccGranularity] = useState<Granularity>('total')
  const [showAllCounties, setShowAllCounties] = useState(false)
  const [breedingFilter, setBreedingFilter] = useState<'all' | 'confirmed' | 'probable' | 'possible'>('all')
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [mlTaxonMap, setMlTaxonMap] = useState<Record<string, string>>({})
  const [geoPopup, setGeoPopup] = useState<{ lng: number; lat: number; title: string; sub: string } | null>(null)
  const [nemesisResult, setNemesisResult] = useState<NemesisSpecies[] | null>(null)
  const [nemesisLoading, setNemesisLoading] = useState(false)
  const [nemesisError, setNemesisError] = useState<string | null>(null)
  const [nemesisTaxonMap, setNemesisTaxonMap] = useState<Record<string, string>>({})
  const [mediaInterval, setMediaInterval] = useState<MediaGraphInterval>('monthly')
  const [mediaViewMode, setMediaViewMode] = useState<'per-period' | 'cumulative'>('per-period')

  // Auto-load eBird backup + ML export + map defaults on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [status, mapDefaults] = await Promise.all([
          storage.getFilesStatus(),
          storage.getSetting<{ lat: number; lng: number; dist: number }>('map-defaults').catch(() => null),
        ])

        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }

        if (mapDefaults && typeof mapDefaults.lat === 'number' && typeof mapDefaults.lng === 'number') {
          setMapDefaults(mapDefaults)
        }

        const [ebird, ml] = await Promise.all([
          loadEbirdObservations(),
          status.ml ? loadMLExport() : Promise.resolve(null),
        ])

        if (!ebird || cancelled) {
          setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." })
          return
        }

        const observations = ebird.observations

        const mlRows: MLExportRow[] = ml?.rows ?? []

        if (cancelled) return
        const mlMatch = status.ml?.filename.match(ML_USER_RE)
        if (mlMatch) setMlUserId(mlMatch[1])

        // Resolve eBird taxon codes for EVERY observed species (+ any ML-only
        // species) so the BirdName favicons appear consistently across all Stats
        // lists — not just for species that happen to have Macaulay media.
        const seenNames = new Map<string, string>()
        for (const o of observations) {
          if (!seenNames.has(o.commonName)) seenNames.set(o.commonName, o.scientificName)
        }
        for (const r of mlRows) {
          if (!seenNames.has(r.commonName)) seenNames.set(r.commonName, r.scientificName)
        }
        if (seenNames.size > 0) {
          const species = [...seenNames.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
          try {
            const data = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
            if (!cancelled) setMlTaxonMap(data.codes)
          } catch { /* taxonomy unavailable — falls back to taxaName */ }
        }

        setPhase({ tag: 'ready', observations, mlRows, freshness: status.ebird.filename })
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    load()
    return () => { cancelled = true }
  }, [])

  // Nemesis fetch when map defaults are available
  useEffect(() => {
    if (!mapDefaults || phase.tag !== 'ready') return
    let cancelled = false
    const run = async () => {
      setNemesisLoading(true)
      setNemesisError(null)
      try {
        const data = await transport.get<{ species: NemesisSpecies[] }>('/stats/nemesis', {
          lat: String(mapDefaults.lat),
          lng: String(mapDefaults.lng),
          dist: String(mapDefaults.dist),
        })
        if (!cancelled) {
          const species: NemesisSpecies[] = data.species ?? []
          setNemesisResult(species)
          const missing = species.map(s => s.commonName).filter(n => !mlTaxonMap[n])
          if (missing.length > 0) {
            try {
              const taxData = await transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', {
                species: missing.map(n => ({ commonName: n, scientificName: '' })),
              })
              if (!cancelled) setNemesisTaxonMap(taxData.codes)
            } catch { /* non-fatal */ }
          }
        }
      } catch {
        if (!cancelled) setNemesisError('Could not load nearby sightings.')
      } finally {
        if (!cancelled) setNemesisLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
    // mlTaxonMap is read only to skip already-resolved species; including it as a
    // dep would re-fire the nemesis fetch on every taxon-map update (refetch loop).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mapDefaults, phase.tag])

  // Raw data — stable refs so useMemos don't thrash when phase tag changes
  const rawObs = phase.tag === 'ready' ? phase.observations : EMPTY_OBS
  const rawMlRows = phase.tag === 'ready' ? phase.mlRows : EMPTY_ML
  const freshness = phase.tag === 'ready' ? phase.freshness : ''

  // Normalized common names the user has recorded — i.e. species that HAVE a
  // Species Detail entry. Drives whether a BirdName links (vs. plain + favicons).
  const backboneNames = useMemo(
    () => new Set(rawObs.map(o => normalizeSpeciesName(o.commonName))),
    [rawObs],
  )
  const hasEntryFor = (name: string) => backboneNames.has(normalizeSpeciesName(name))
  // Normalized taxon-code lookup so the (normalized) names in Stats lists resolve
  // to a code even when the resolved map is keyed by the original (subspecies) name.
  const normTaxon = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [name, code] of Object.entries(mlTaxonMap)) m[normalizeSpeciesName(name)] = code
    for (const [name, code] of Object.entries(nemesisTaxonMap)) {
      const k = normalizeSpeciesName(name)
      if (!(k in m)) m[k] = code
    }
    return m
  }, [mlTaxonMap, nemesisTaxonMap])
  const codeFor = (name: string) => mlTaxonMap[name] ?? nemesisTaxonMap[name] ?? normTaxon[normalizeSpeciesName(name)]

  // ── useMemos (all declared before any conditional return) ─────────────────

  const filteredObs = useMemo(() => filterObservations(rawObs, includeSpuh), [rawObs, includeSpuh])

  const checklists = useMemo(() => computeChecklists(filteredObs), [filteredObs])

  const lifeList = useMemo(() => computeLifeList(filteredObs), [filteredObs])

  // Top species — most individuals counted (Σ count) and most checklists reported on
  // (distinct submissions). One pass over observations.
  const topSpecies = useMemo(() => computeTopSpecies(filteredObs), [filteredObs])

  const totals = useMemo(() => computeTotals(checklists, lifeList), [checklists, lifeList])

  // Accumulation curve + milestones — must process observations in chronological order
  const accumulation = useMemo(() => computeAccumulation(filteredObs, accGranularity), [filteredObs, accGranularity])

  // Temporal histograms
  const temporal = useMemo(() => computeTemporal(checklists, filteredObs), [checklists, filteredObs])

  // Geographic stats
  const geo = useMemo(() => computeGeo(checklists, filteredObs), [checklists, filteredObs])

  // Effort stats
  const effort = useMemo(() => computeEffort(checklists), [checklists])

  // Data quality
  const quality = useMemo(() => computeQuality(filteredObs, checklists), [filteredObs, checklists])

  // Breeding stats
  const breedingStats = useMemo(() => computeBreedingStats(filteredObs), [filteredObs])

  // ML stats (most photographed / audio / video)
  const mlStats = useMemo(() => computeMlStats(rawMlRows), [rawMlRows])

  // Fun stats
  const funStats = useMemo(() => computeFunStats(filteredObs, checklists, rawObs), [filteredObs, checklists, rawObs])

  // Nearby Lifers (nemesis* internals) filtered against life list
  const nemesisFiltered = useMemo(() => {
    if (!nemesisResult) return null
    const lifeSet = new Set(lifeList.map(s => s.toLowerCase()))
    return nemesisResult.filter(n => !lifeSet.has(n.commonName.toLowerCase()))
  }, [nemesisResult, lifeList])

  const mediaGraphResult = useMemo(
    () => buildMediaGraphData(rawMlRows, mediaInterval),
    [rawMlRows, mediaInterval],
  )

  const mediaDisplayData = useMemo(() => {
    const useCumulative = mediaInterval === 'total' || mediaViewMode === 'cumulative'
    if (!useCumulative) return mediaGraphResult.data
    let rPhoto = 0, rAudio = 0, rVideo = 0
    return mediaGraphResult.data.map(p => {
      rPhoto += p.photo; rAudio += p.audio; rVideo += p.video
      return { ...p, photo: rPhoto, audio: rAudio, video: rVideo, total: rPhoto + rAudio + rVideo }
    })
  }, [mediaGraphResult.data, mediaInterval, mediaViewMode])

  // ── Phase gates (all hooks above) ────────────────────────────────────────

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
        title="Statistics require your eBird backup"
        body="Upload your eBird backup to see comprehensive statistics about your birding history — life list, effort, geography, and more."
        steps={EBIRD_BACKUP_STEPS}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', maxWidth: 420 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sr-error)', fontSize: '0.875rem' }}>
            <AlertCircle size={16} style={{ flexShrink: 0 }} />
            {phase.message}
          </div>
          <button tabIndex={0}
            onClick={onGoToSettings}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 7, padding: '8px 16px',
              background: 'var(--sr-accent)', color: 'var(--sr-on-accent)',
              border: 'none', borderRadius: 8, fontSize: '0.84375rem', fontWeight: 500,
              fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            Go to Settings →
          </button>
        </div>
      </div>
    )
  }

  // ── Ready ─────────────────────────────────────────────────────────────────

  const maxYearChecklists = Math.max(...temporal.yearRows.map(r => r.checklists), 1)
  const maxMonthChecklists = Math.max(...temporal.monthRows.map(r => r.checklists), 1)
  const maxDow = Math.max(...temporal.dowRows.map(r => r.value), 1)
  const maxHour = Math.max(...temporal.hourRows.map(r => r.value), 1)
  const totalHour = temporal.hourRows.reduce((s, r) => s + r.value, 0)
  // Jump-nav: base sections + Media (only with an ML export) + Other Statistics.
  const navSections = [
    ...NAV_SECTIONS,
    ...(rawMlRows.length > 0 ? ['Media'] : []),
    'Other Statistics',
  ]

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: '1.375rem', fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={20} style={{ color: 'var(--sr-accent)' }} />
            Statistics
          </h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0 }}>
            {fmt(totals.checklistCount)} checklists · eBird backup: {freshness}
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={includeSpuh}
            onChange={e => setIncludeSpuh(e.target.checked)}
            style={{ accentColor: 'var(--sr-accent)', width: 14, height: 14 }}
          />
          Include spuh / slash species
        </label>
      </div>

      {/* Section jump-nav */}
      <nav aria-label="Jump to section" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {navSections.map(t => (
          <a
            key={t}
            href={`#${sectionSlug(t)}`}
            onClick={e => { e.preventDefault(); document.getElementById(sectionSlug(t))?.scrollIntoView({ behavior: 'smooth', block: 'start' }) }}
            style={{ fontSize: '0.71875rem', fontWeight: 500, color: 'var(--sr-text-muted)', textDecoration: 'none', padding: '4px 10px', borderRadius: 100, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', whiteSpace: 'nowrap' }}
          >
            {t}
          </a>
        ))}
      </nav>

      {/* ── Section 1: Life List Totals ─────────────────────────────────────── */}
      <SectionCard title="Life List Totals" icon={<BarChart2 size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))', gap: 0 }}>
          {[
            { label: 'Species', value: totals.speciesCount },
            { label: 'Checklists', value: totals.checklistCount },
            { label: 'Locations', value: totals.locationCount },
            { label: 'Years Active', value: totals.yearCount },
            totals.stateCount > 0 ? { label: 'States/Provinces', value: totals.stateCount } : null,
            totals.countryCount > 0 ? { label: 'Countries', value: totals.countryCount } : null,
          ].filter(Boolean).map((stat, i) => (
            <div key={i} style={{ borderRight: '1px solid var(--sr-border-subtle)', borderBottom: '1px solid var(--sr-border-subtle)' }}>
              <StatCell label={stat!.label} value={stat!.value} />
            </div>
          ))}
        </div>

        {totals.firstDate && (
          <>
            <Divider />
            <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
              {[
                { label: 'First observation', cl: checklists[0] },
                { label: 'Most recent', cl: checklists[checklists.length - 1] },
              ].map(({ label, cl }) => cl && (
                <div key={label} style={{
                  flex: '1 1 160px', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                }}>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>{label}</p>
                  {SUBMISSION_ID_RE.test(cl.submissionId) ? (
                    <a
                      href={`https://ebird.org/checklist/${cl.submissionId}`}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.9375rem', fontWeight: 700, color: 'var(--sr-accent)', textDecoration: 'none', display: 'block', margin: '0 0 3px' }}
                    >
                      {fmtDate(cl.date)}
                    </a>
                  ) : (
                    <p style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 3px' }}>{fmtDate(cl.date)}</p>
                  )}
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: 0 }}>{cl.location}</p>
                </div>
              ))}
              {accumulation.firstSpecies && (
                <div style={{
                  flex: '1 1 160px', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                }}>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>First species ever</p>
                  <div style={{ margin: '0 0 3px' }}>
                    <BirdName
                      commonName={accumulation.firstSpecies.name}
                      taxonCode={codeFor(accumulation.firstSpecies.name)}
                      hasEntry={hasEntryFor(accumulation.firstSpecies.name)}
                      onOpenSpecies={onOpenSpecies}
                      size="lg"
                    />
                  </div>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: 0 }}>{fmtDate(accumulation.firstSpecies.date)}</p>
                </div>
              )}
            </div>
          </>
        )}

        {(accumulation.liferPoints.length > 1 || accumulation.chartData.length > 1) && (
          <>
            <Divider />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SubLabel>Life list accumulation</SubLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['weekly', 'monthly', 'yearly', 'total'] as const).map(g => (
                  <button tabIndex={0}
                    key={g}
                    onClick={() => setAccGranularity(g)}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer',
                      border: accGranularity === g ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
                      background: accGranularity === g ? 'var(--sr-accent-bg)' : 'none',
                      color: accGranularity === g ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    }}
                  >
                    {g.charAt(0).toUpperCase() + g.slice(1)}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ height: 180 }} role="img" aria-label={`Life list accumulation chart — ${fmt(totals.speciesCount)} species recorded over time`}>
              <ResponsiveContainer width="100%" height="100%">
                {accGranularity === 'total' ? (
                  <AreaChart data={accumulation.liferPoints} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="statsAccGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--sr-accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--sr-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={d => fmtDate(String(d))}
                    />
                    <YAxis tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                      formatter={(v, _n, props) => [
                        `#${typeof v === 'number' ? fmt(v) : String(v ?? '')}: ${(props?.payload as { species?: string })?.species ?? ''}`,
                        fmtDate(String((props?.payload as { date?: string })?.date ?? '')),
                      ]}
                      labelFormatter={() => ''}
                    />
                    <Area type="stepAfter" dataKey="count" stroke="var(--sr-accent)" fill="url(#statsAccGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                ) : (
                  <AreaChart data={accumulation.chartData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                    <defs>
                      <linearGradient id="statsAccGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="var(--sr-accent)" stopOpacity={0.25} />
                        <stop offset="95%" stopColor="var(--sr-accent)" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <XAxis
                      dataKey="period"
                      tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={key => formatPeriodLabel(String(key), accGranularity as PeriodGranularity)}
                    />
                    <YAxis tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                      formatter={(v) => [typeof v === 'number' ? fmt(v) : String(v ?? ''), 'Species']}
                      labelFormatter={key => formatPeriodLabel(String(key), accGranularity as PeriodGranularity)}
                    />
                    <Area type="monotone" dataKey="species" stroke="var(--sr-accent)" fill="url(#statsAccGrad)" strokeWidth={2} dot={false} />
                  </AreaChart>
                )}
              </ResponsiveContainer>
            </div>
          </>
        )}

      </SectionCard>

      {/* ── Top Species ────────────────────────────────────────────────────── */}
      <SectionCard title="Top Species" icon={<ListOrdered size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(248px, 1fr))', gap: 'clamp(16px, 4vw, 28px)' }}>
          <div>
            <SubLabel>Most individuals counted</SubLabel>
            {topSpecies.byIndividuals.length > 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {topSpecies.byIndividuals.map((entry, i) => (
                  <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <BirdName commonName={entry.name} taxonCode={codeFor(entry.name)} hasEntry={hasEntryFor(entry.name)} onOpenSpecies={onOpenSpecies} />
                    </span>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-accent)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(entry.total)}</span>
                  </div>
                ))}
                <p style={{ fontSize: '0.65625rem', color: 'var(--sr-text-muted)', margin: '10px 0 0', lineHeight: 1.4 }}>
                  {"Total individuals reported; presence-only X records can't be summed, so they're excluded here."}
                </p>
              </div>
            ) : (
              <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{"No numeric counts in your data yet."}</p>
            )}
          </div>
          <div>
            <SubLabel>Most checklists</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {topSpecies.byChecklists.map((entry, i) => (
                <div key={entry.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <BirdName commonName={entry.name} taxonCode={codeFor(entry.name)} hasEntry={hasEntryFor(entry.name)} onOpenSpecies={onOpenSpecies} />
                  </span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--sr-accent)', fontVariantNumeric: 'tabular-nums', flexShrink: 0 }}>{fmt(entry.count)}</span>
                </div>
              ))}
              <p style={{ fontSize: '0.65625rem', color: 'var(--sr-text-muted)', margin: '10px 0 0', lineHeight: 1.4 }}>
                {"Number of distinct checklists each species appears on."}
              </p>
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 2: Firsts & Milestones ─────────────────────────────────── */}
      <SectionCard title="Firsts & Milestones" icon={<Trophy size={16} />}>
        {accumulation.milestones.size > 0 && (
          <>
            <Divider />
            <SubLabel>Milestones</SubLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'flex-start' }}>
              {MILESTONE_THRESHOLDS.map(threshold => {
                const m = accumulation.milestones.get(threshold)
                if (!m) return null
                const tier = threshold < 100 ? 1 : threshold < 500 ? 2 : threshold < 1000 ? 3 : 4
                const ts = tier === 1
                  ? { bg: 'linear-gradient(160deg,#F2FAF5,#E8F5EE)', border: 'rgba(45,134,83,0.28)', num: '#2D8653', date: '#5EA07C', check: '#2D8653' }
                  : tier === 2
                  ? { bg: 'linear-gradient(160deg,#E5F3EC,#D8EDE4)', border: 'rgba(28,100,60,0.32)', num: '#1C6443', date: '#3E7A56', check: '#2D8653' }
                  : tier === 3
                  ? { bg: 'linear-gradient(160deg,#D6EAE0,#C6E2D5)', border: 'rgba(18,74,44,0.38)', num: '#14502E', date: '#2D6644', check: '#2D8653' }
                  : { bg: 'linear-gradient(160deg,#FEFAEC,#FEF3C7)', border: 'rgba(146,64,14,0.32)', num: '#92400E', date: '#B45309', check: '#B45309' }
                return (
                  <div key={threshold} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'center',
                    padding: '10px 14px', borderRadius: 10,
                    background: ts.bg, border: `1.5px solid ${ts.border}`,
                    minWidth: 70, gap: 3, position: 'relative',
                  }}>
                    <div style={{
                      position: 'absolute', top: 5, right: 6,
                      width: 13, height: 13, borderRadius: '50%',
                      background: ts.check, color: '#fff',
                      fontSize: '0.5rem', fontWeight: 700,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>✓</div>
                    <span style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1, color: ts.num }}>{threshold}</span>
                    <BirdName commonName={m.species} taxonCode={codeFor(m.species)} hasEntry={hasEntryFor(m.species)} onOpenSpecies={onOpenSpecies} size="sm" />
                    {SUBMISSION_ID_RE.test(m.submissionId) ? (
                      <a href={`https://ebird.org/checklist/${m.submissionId}`} target="_blank" rel="noreferrer"
                        style={{ fontSize: '0.625rem', color: ts.date, textDecoration: 'none' }}>
                        {fmtDate(m.date)}
                      </a>
                    ) : (
                      <span style={{ fontSize: '0.625rem', color: ts.date }}>{fmtDate(m.date)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 3: Temporal Stats ──────────────────────────────────────── */}
      <SectionCard title="Temporal Stats" icon={<Calendar size={16} />}>
        {temporal.yearRows.length > 0 && (
          <>
            <SubLabel>Checklists by year</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {temporal.yearRows.map(r => (
                <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 36 }}>{r.label}</span>
                  <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${maxYearChecklists > 0 ? (r.checklists / maxYearChecklists) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 28, textAlign: 'right' }}>{fmt(r.checklists)}</span>
                  <span style={{ fontSize: '0.6875rem', flexShrink: 0, width: 44, textAlign: 'right', color: 'var(--sr-accent)' }}>{fmt(r.species)} sp.</span>
                  <span style={{ fontSize: '0.6875rem', flexShrink: 0, width: 60, textAlign: 'right' }}>
                    {r.bestDay && SUBMISSION_ID_RE.test(r.bestDay.submissionId) ? (
                      <a href={`https://ebird.org/checklist/${r.bestDay.submissionId}`} target="_blank" rel="noreferrer"
                        style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}>
                        {fmt(r.bestDay.species)} best
                      </a>
                    ) : r.bestDay ? (
                      <span style={{ color: 'var(--sr-text-muted)' }}>{fmt(r.bestDay.species)} best</span>
                    ) : null}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        <Divider />
        <SubLabel>Checklists by month</SubLabel>
        {(() => {
          const maxMonth = Math.max(...temporal.monthRows.map(r => r.checklists), 1)
          const totalMonth = temporal.monthRows.reduce((s, r) => s + r.checklists, 0)
          const peakMonth = temporal.monthRows.reduce((best, r) => r.checklists > best.checklists ? r : best, temporal.monthRows[0])
          const monthPieData = temporal.monthRows.map((r) => ({
            label: r.label, value: r.checklists,
            fill: totalMonth > 0 ? `hsl(145,60%,${Math.round(80 - (r.checklists / maxMonth) * 45)}%)` : 'var(--sr-chart-slate)',
          }))
          return (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, alignItems: 'start', marginBottom: 4 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {temporal.monthRows.map(r => (
                  <BarRow key={r.label} label={r.label} value={r.checklists} max={maxMonthChecklists} labelWidth={28} pctOf={totalMonth} />
                ))}
              </div>
              <div>
                <div style={{ position: 'relative', width: 120, height: 120 }} role="img" aria-label={`Checklists by month${peakMonth ? `, peak in ${peakMonth.label}` : ''}`}>
                  <PieChart width={120} height={120}>
                    <Pie data={monthPieData} dataKey="value" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                      {monthPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                  {peakMonth && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--sr-text-muted)', lineHeight: 1 }}>peak</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1.3 }}>{peakMonth.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        <Divider />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16 }}>
          <div>
            <SubLabel>By day of week</SubLabel>
            {(() => {
              const totalDow = temporal.dowRows.reduce((s, r) => s + r.value, 0)
              const weekendPct = totalDow > 0
                ? Math.round(((temporal.dowRows[0]?.value ?? 0) + (temporal.dowRows[6]?.value ?? 0)) / totalDow * 100)
                : 0
              const dowPieData = [
                { label: 'Sat', value: temporal.dowRows[6]?.value ?? 0, fill: 'var(--sr-chart-blue-dark)' },
                { label: 'Sun', value: temporal.dowRows[0]?.value ?? 0, fill: 'var(--sr-graph-photo)' },
                { label: 'Weekdays', value: temporal.dowRows.slice(1, 6).reduce((s, r) => s + r.value, 0), fill: 'var(--sr-chart-blue-light)' },
              ]
              return (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {temporal.dowRows.map(r => (
                      <BarRow key={r.label} label={r.label} value={r.value} max={maxDow} labelWidth={28} color="var(--sr-graph-photo)" pctOf={totalDow} />
                    ))}
                  </div>
                  <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }} role="img" aria-label={`Checklists by day of week — ${weekendPct}% on weekends`}>
                      <PieChart width={120} height={120}>
                        <Pie data={dowPieData} dataKey="value" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                          {dowPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                      </PieChart>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--sr-text-muted)', lineHeight: 1 }}>wkend</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1.3 }}>{weekendPct}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                      {dowPieData.map(d => {
                        const dpct = totalDow > 0 ? Math.round(d.value / totalDow * 100) : 0
                        return (
                          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{d.label} {dpct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </div>
          <div>
            <SubLabel>By start hour</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {temporal.hourRows.filter(r => r.value > 0).map(r => (
                <BarRow key={r.label} label={r.label} value={r.value} max={maxHour} labelWidth={28} color="var(--sr-graph-photo)" pctOf={totalHour} />
              ))}
              {temporal.hourRows.every(r => r.value === 0) && (
                <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: 0 }}>No time data in this export.</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 4: Geographic Stats ────────────────────────────────────── */}
      <SectionCard title="Geographic Stats" icon={<MapPin size={16} />}>
        {(() => {
          const clPins = geo.topLocations
            .map((loc, i) => loc.lat !== null ? { name: loc.name, checklists: loc.checklists, lat: loc.lat, lng: loc.lng!, rank: i + 1 } : null)
            .filter((p): p is { name: string; checklists: number; lat: number; lng: number; rank: number } => p !== null)
          const spPins = geo.topLocationsBySpecies
            .map((loc, i) => loc.lat !== null ? { name: loc.name, species: loc.species, lat: loc.lat, lng: loc.lng!, rank: i + 1 } : null)
            .filter((p): p is { name: string; species: number; lat: number; lng: number; rank: number } => p !== null)
          if (clPins.length === 0 && spPins.length === 0) return null
          return (
            <div style={{ marginBottom: 20 }}>
              <div style={{ height: 320, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--sr-border)' }}>
                <SnowMap
                  initialViewState={{ longitude: 0, latitude: 20, zoom: 1 }}
                  style={{ width: '100%', height: '100%' }}
                  onLoad={e => fitToPins(e.target, [...clPins, ...spPins])}
                  switcher
                >
                  {clPins.map(pin => (
                    <Marker key={`cl-${pin.rank}`} longitude={pin.lng} latitude={pin.lat} anchor="center"
                      onClick={e => { e.originalEvent.stopPropagation(); setGeoPopup({ lng: pin.lng, lat: pin.lat, title: pin.name, sub: `${fmt(pin.checklists)} checklists` }) }}>
                      <RankIcon rank={pin.rank} shape="circle" />
                    </Marker>
                  ))}
                  {spPins.map(pin => (
                    <Marker key={`sp-${pin.rank}`} longitude={pin.lng} latitude={pin.lat} anchor="center"
                      onClick={e => { e.originalEvent.stopPropagation(); setGeoPopup({ lng: pin.lng, lat: pin.lat, title: pin.name, sub: `${fmt(pin.species)} species` }) }}>
                      <RankIcon rank={pin.rank} shape="square" />
                    </Marker>
                  ))}
                  {geoPopup && (
                    <Popup longitude={geoPopup.lng} latitude={geoPopup.lat} anchor="bottom" offset={16} onClose={() => setGeoPopup(null)} closeButton={false}>
                      <span style={{ fontSize: '0.8125rem' }}>{geoPopup.title}</span><br /><span style={{ color: '#71717A', fontSize: '0.75rem' }}>{geoPopup.sub}</span>
                    </Popup>
                  )}
                </SnowMap>
              </div>
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="#2D8653" /></svg>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>Top by checklists</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="2" fill="#3B82F6" /></svg>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>Top by species</span>
                </div>
              </div>
            </div>
          )
        })()}

        {geo.topLocations.length > 0 && (
          <>
            <SubLabel>Top locations by checklists</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {geo.topLocations.map((loc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.8125rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0 }}>{fmt(loc.checklists)} lists · {fmt(loc.species)} sp.</span>
                </div>
              ))}
            </div>
          </>
        )}

        {geo.topLocationsBySpecies.length > 0 && (
          <>
            <SubLabel>Top locations by species</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {geo.topLocationsBySpecies.map((loc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.8125rem', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0 }}>{fmt(loc.species)} sp. · {fmt(loc.checklists)} lists</span>
                </div>
              ))}
            </div>
          </>
        )}

        {geo.topCounties.length > 0 && (
          <>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' }}>
              <div>
                <SubLabel>Counties by checklists</SubLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {(showAllCounties ? geo.topCounties : geo.topCounties.slice(0, 8)).map((c, i) => {
                    const sp = c.stateProvince
                    const validSp = sp && sp.includes('-')
                    const label = validSp ? (
                      <a
                        href={`https://ebird.org/region/${sp}`}
                        target="_blank" rel="noreferrer"
                        style={{ color: 'var(--sr-text)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {c.name}
                      </a>
                    ) : c.name
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topCounties[0]?.count ? (c.count / geo.topCounties[0].count) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 32, textAlign: 'right' }}>{fmt(c.count)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <SubLabel>Counties by species</SubLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {geo.topCountiesBySpecies.slice(0, 8).map((c, i) => {
                    const sp = c.stateProvince
                    const validSp = sp && sp.includes('-')
                    const label = validSp ? (
                      <a
                        href={`https://ebird.org/region/${sp}`}
                        target="_blank" rel="noreferrer"
                        style={{ color: 'var(--sr-text)', textDecoration: 'none' }}
                        onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                        onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                      >
                        {c.name}
                      </a>
                    ) : c.name
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topCountiesBySpecies[0]?.species ? (c.species / geo.topCountiesBySpecies[0].species) * 100 : 0}%`, background: 'var(--sr-graph-photo)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 40, textAlign: 'right' }}>{fmt(c.species)} sp.</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '8px 0 4px' }}>
              County names link to their state/province eBird region page.
            </p>
            {geo.topCounties.length > 8 && (
              <button tabIndex={0}
                onClick={() => setShowAllCounties(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: '0.75rem', color: 'var(--sr-accent)', padding: 0, fontFamily: 'inherit',
                }}
              >
                {showAllCounties
                  ? <><ChevronUp size={12} /> Show fewer</>
                  : <><ChevronDown size={12} /> Show all {geo.topCounties.length} counties</>}
              </button>
            )}
          </>
        )}

        {geo.topStates.length > 0 && (
          <>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, alignItems: 'start' }}>
              <div>
                <SubLabel>States by checklists</SubLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {geo.topStates.map((s, i) => {
                    const validSp = s.name && s.name.includes('-')
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {validSp ? (
                            <a
                              href={`https://ebird.org/region/${s.name}`}
                              target="_blank" rel="noreferrer"
                              style={{ color: 'var(--sr-text)', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {regionName(s.name)}
                            </a>
                          ) : regionName(s.name)}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topStates[0]?.count ? (s.count / geo.topStates[0].count) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 32, textAlign: 'right' }}>{fmt(s.count)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <SubLabel>States by species</SubLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {geo.topStatesBySpecies.map((s, i) => {
                    const validSp = s.name && s.name.includes('-')
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 96, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {validSp ? (
                            <a
                              href={`https://ebird.org/region/${s.name}`}
                              target="_blank" rel="noreferrer"
                              style={{ color: 'var(--sr-text)', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {regionName(s.name)}
                            </a>
                          ) : regionName(s.name)}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topStatesBySpecies[0]?.species ? (s.species / geo.topStatesBySpecies[0].species) * 100 : 0}%`, background: 'var(--sr-graph-photo)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 40, textAlign: 'right' }}>{fmt(s.species)} sp.</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

      </SectionCard>

      {/* ── Section 5: Effort & Outings ───────────────────────────────────── */}
      <SectionCard title="Effort & Outings" icon={<Clock size={16} />}>

        {(effort.totalHours !== null || effort.totalDistanceMi !== null || effort.totalAreaAcres !== null) && (
          <>
            <SubLabel>Totals</SubLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(6rem, 1fr))', gap: 1, background: 'var(--sr-border-subtle)', border: '1px solid var(--sr-border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
              {[
                { label: 'Time Afield', value: effort.totalHours !== null ? `${fmt(effort.totalHours, 0)} h` : '—', sub: effort.durationCount > 0 ? `${fmt(effort.durationCount)} lists` : '' },
                { label: 'Distance', value: effort.totalDistanceMi !== null ? `${fmt(effort.totalDistanceMi, 0)} mi` : '—', sub: effort.distanceCount > 0 ? `${fmt(effort.distanceCount)} lists` : '' },
                effort.totalAreaAcres !== null ? { label: 'Area Covered', value: `${fmt(effort.totalAreaAcres, 0)} ac`, sub: effort.areaCount > 0 ? `${fmt(effort.areaCount)} lists` : '' } : null,
              ].filter((c): c is { label: string; value: string; sub: string } => c !== null).map((cell, i) => (
                <div key={i} style={{ background: 'var(--sr-surface-subtle)', padding: '12px 8px', textAlign: 'center' }}>
                  <div style={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1 }}>{cell.value}</div>
                  {cell.sub && <div style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', marginTop: 3 }}>{cell.sub}</div>}
                  <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', marginTop: 4 }}>{cell.label}</div>
                </div>
              ))}
            </div>
            {effort.totalMinutes !== null && (
              <p style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', margin: '8px 0 0' }}>
                Total time afield: {formatDuration(effort.totalMinutes)}
              </p>
            )}
            <Divider />
          </>
        )}

        {effort.completeRatio !== null && (() => {
          const completePct = Math.round(effort.completeRatio * 100)
          const incompletePct = 100 - completePct
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 10px' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Complete checklists</p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(effort.completeCount)} of {fmt(effort.allObsCount)} complete</span>
              </div>
              <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                <div style={{ width: `${completePct}%`, background: 'var(--sr-chart-blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {completePct >= 8 && (
                    <span style={{ fontSize: '0.6875rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{completePct}%</span>
                  )}
                </div>
                <div style={{ flex: 1, background: 'var(--sr-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {incompletePct >= 8 && (
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{incompletePct}%</span>
                  )}
                </div>
              </div>
              {(() => {
                const subBars = effort.protocolRows
                  .filter(r => /traveling|stationary/i.test(r.name))
                  .map(r => ({ name: r.name, pc: effort.protocolComplete.get(r.name) }))
                  .filter(({ pc }) => pc && pc.total > 0) as { name: string; pc: { complete: number; total: number } }[]
                if (subBars.length === 0) return null
                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 10 }}>
                    {subBars.map(({ name, pc }) => {
                      const pct = Math.round((pc.complete / pc.total) * 100)
                      const incompletePct = 100 - pct
                      return (
                        <div key={name}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 3 }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{name}</span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(pc.complete)} of {fmt(pc.total)} complete</span>
                          </div>
                          <div style={{ height: 20, borderRadius: 3, overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${pct}%`, background: 'var(--sr-graph-photo)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {pct >= 10 && <span style={{ fontSize: '0.625rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{pct}%</span>}
                            </div>
                            <div style={{ flex: 1, background: 'var(--sr-surface-subtle)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                              {incompletePct >= 10 && <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', fontWeight: 600, whiteSpace: 'nowrap' }}>{incompletePct}%</span>}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )
              })()}
              {effort.protocolRows.length > 0 && <Divider />}
            </>
          )
        })()}

        {effort.protocolRows.length > 0 && (
          <>
            <SubLabel>Protocol distribution</SubLabel>
            <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
              {effort.protocolRows.map((r, i) => (
                <div key={r.name} style={{
                  width: `${r.pct}%`,
                  background: PROTOCOL_COLORS[i % PROTOCOL_COLORS.length],
                  display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden',
                }}>
                  {r.pct >= 8 && (
                    <span style={{ fontSize: '0.6875rem', color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.pct}%</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {effort.protocolRows.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: PROTOCOL_COLORS[i % PROTOCOL_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem' }}>{r.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>({fmt(r.count)})</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Divider />
        <SubLabel>Key metrics</SubLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))', gap: 1, background: 'var(--sr-border-subtle)', border: '1px solid var(--sr-border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { label: 'Average duration', value: effort.avgDurationMin !== null ? `${fmt(effort.avgDurationMin, 0)} min` : '—' },
            { label: 'Average distance', value: effort.avgDistanceMi !== null ? `${fmt(effort.avgDistanceMi, 1)} mi` : '—' },
            effort.avgAreaAcres !== null ? { label: 'Average area', value: `${fmt(effort.avgAreaAcres, 1)} ac` } : null,
            { label: 'Species per hour', value: effort.sppPerHour !== null ? fmt(effort.sppPerHour, 1) : '—' },
            { label: 'Species per mile', value: effort.sppPerMi !== null ? fmt(effort.sppPerMi, 1) : '—' },
          ].filter((c): c is { label: string; value: string } => c !== null).map((cell, i) => (
            <div key={i} style={{ background: 'var(--sr-surface-subtle)', padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: '1.375rem', fontWeight: 700, lineHeight: 1 }}>{cell.value}</div>
              <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', marginTop: 4 }}>{cell.label}</div>
            </div>
          ))}
        </div>

        {effort.protocolRows.length > 0 && (effort.protocolRows.some(r => r.avgDurationMin !== null) || effort.protocolRows.some(r => r.avgDistanceMi !== null)) && (
          <>
            <Divider />
            <SubLabel>Average by protocol</SubLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    {(['Protocol', 'Avg Duration (min)', 'Avg Distance (mi)', 'Count'] as const).map(h => (
                      <th key={h} style={{ textAlign: h === 'Protocol' ? 'left' : 'right', padding: '4px 8px', fontSize: '0.6875rem', color: 'var(--sr-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--sr-border-subtle)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {effort.protocolRows.map(r => (
                    <tr key={r.name} style={{ borderBottom: '1px solid var(--sr-border-subtle)' }}>
                      <td style={{ padding: '5px 8px', textAlign: 'left' }}>{r.name}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>{r.avgDurationMin !== null ? fmt(r.avgDurationMin, 0) : '—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>{r.avgDistanceMi !== null ? fmt(r.avgDistanceMi, 1) : '—'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>{fmt(r.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {effort.observerRows.length > 0 && (
          <>
            <Divider />
            <SubLabel>Lists by observer count</SubLabel>
            {(() => {
              const parts: string[] = []
              const tot = effort.soloCount + effort.groupCount
              if (tot > 0) parts.push(`${Math.round(effort.soloCount / tot * 100)}% solo`)
              if (effort.avgObservers !== null) parts.push(`${fmt(effort.avgObservers, 1)} avg observers`)
              if (effort.largestGroup) parts.push(`largest group ${fmt(effort.largestGroup.n)}`)
              return parts.length > 0 ? <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: '0 0 10px' }}>{parts.join(' · ')}</p> : null
            })()}
            {(() => {
              const totalObs = effort.observerRows.reduce((s, r) => s + r.count, 0)
              const obsPieColors = [
                'var(--sr-accent)',
                'var(--sr-graph-photo)',
                'var(--sr-graph-video)',
                'var(--sr-graph-audio)',
                'var(--sr-chart-slate)',
              ]
              return (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 160px', gap: 16, alignItems: 'start' }}>
                  <div style={{ height: 110 }} role="img" aria-label="Bar chart of checklists grouped by number of observers">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={effort.observerRows} margin={{ top: 4, right: 4, bottom: 16, left: -20 }}>
                        <XAxis
                          dataKey="n"
                          tick={{ fontSize: '0.6875rem', fill: 'var(--sr-text-muted)' }}
                          tickLine={false} axisLine={false}
                          tickFormatter={n => n === 5 ? '5+' : String(n)}
                        />
                        <YAxis tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                          formatter={(v) => [fmt(Number(v)), 'Lists']}
                          labelFormatter={n => n === 5 ? '5+ observers' : `${n} observer${n === 1 ? '' : 's'}`}
                        />
                        <Bar dataKey="count" fill="var(--sr-accent)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <div aria-hidden="true">
                      <PieChart width={120} height={120}>
                        <Pie data={effort.observerRows} dataKey="count" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                          {effort.observerRows.map((_, i) => (
                            <Cell key={i} fill={obsPieColors[i % obsPieColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                      {effort.observerRows.map((r, i) => {
                        const opct = totalObs > 0 ? Math.round(r.count / totalObs * 100) : 0
                        return (
                          <div key={r.n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: obsPieColors[i % obsPieColors.length], flexShrink: 0 }} />
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{r.n === 5 ? '5+' : r.n} obs {opct}%</span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                </div>
              )
            })()}
          </>
        )}

        {(effort.longest || effort.farthest || effort.largestArea || effort.biggest) && (
          <>
            <Divider />
            <SubLabel>Notable outings</SubLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 10 }}>
              {[
                effort.longest && effort.longest.duration !== null ? { label: 'Longest', metric: `${fmt(effort.longest.duration / 60, 1)} h`, c: effort.longest } : null,
                effort.farthest && effort.farthest.distance !== null ? { label: 'Farthest', metric: `${fmt(effort.farthest.distance * KM_TO_MI, 1)} mi`, c: effort.farthest } : null,
                effort.largestArea && effort.largestArea.area !== null ? { label: 'Largest area', metric: `${fmt(effort.largestArea.area * HA_TO_ACRE, 1)} ac`, c: effort.largestArea } : null,
                effort.biggest ? { label: 'Most species', metric: `${fmt(effort.biggest.speciesCount)} spp`, c: effort.biggest } : null,
                effort.mostIndividuals && effort.mostIndividuals.individualCount > 0 ? { label: 'Most individuals', metric: fmt(effort.mostIndividuals.individualCount), c: effort.mostIndividuals } : null,
              ].filter((o): o is { label: string; metric: string; c: ChecklistEntry } => o !== null).map(card => (
                <div key={card.label} style={{ background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border-subtle)', borderRadius: 8, padding: '10px 12px' }}>
                  <div style={{ fontSize: '0.625rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)' }}>{card.label}</div>
                  <div style={{ fontSize: '1.25rem', fontWeight: 700, lineHeight: 1.1, margin: '2px 0 4px' }}>{card.metric}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{card.c.location}</div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{fmtDate(card.c.date)}</span>
                    {SUBMISSION_ID_RE.test(card.c.submissionId) && (
                      <a href={`https://ebird.org/checklist/${card.c.submissionId}`} target="_blank" rel="noreferrer" title="Open checklist" style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}>↗</a>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </SectionCard>

      {/* ── Section 6: Data Quality ────────────────────────────────────────── */}
      <SectionCard title="Data Quality" icon={<ShieldCheck size={16} />}>

        {quality.numericRatio !== null && quality.xRatio !== null && (() => {
          const numPct = Math.round(quality.numericRatio * 100)
          const xPct = Math.round(quality.xRatio * 100)
          const total = quality.numericCount + quality.xCount
          return (
            <>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 10px' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Count method</p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(quality.numericCount)} numeric · {fmt(quality.xCount)} X / {fmt(total)} observations</span>
              </div>
              <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
                <div style={{ width: `${numPct}%`, background: 'var(--sr-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {numPct >= 8 && <span style={{ fontSize: '0.75rem', color: 'var(--sr-on-accent)', fontWeight: 600 }}>{numPct}% numeric</span>}
                </div>
                <div style={{ flex: 1, background: 'var(--sr-chart-slate)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {xPct >= 8 && <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)', fontWeight: 600 }}>{xPct}% X</span>}
                </div>
              </div>
            </>
          )
        })()}

        {(quality.commentRatio !== null || quality.speciesCommentRatio !== null) && (
          <>
            <Divider />
            {quality.commentRatio !== null && (
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 10px' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Checklist comments</p>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(quality.checksWithComments)} of {fmt(checklists.length)} checklists</span>
                </div>
                {(() => {
                  const pct = Math.round(quality.commentRatio * 100)
                  return (
                    <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--sr-graph-photo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pct >= 8 && <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 600 }}>{pct}%</span>}
                      </div>
                      <div style={{ flex: 1, background: 'var(--sr-chart-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(100 - pct) >= 8 && <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)', fontWeight: 600 }}>{100 - pct}%</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
            {quality.speciesCommentRatio !== null && (
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', margin: '0 0 10px' }}>
                  <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Species notes</p>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(quality.obsWithSpeciesComments)} of {fmt(filteredObs.length)} observations</span>
                </div>
                {(() => {
                  const pct = Math.round(quality.speciesCommentRatio * 100)
                  return (
                    <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${pct}%`, background: 'var(--sr-graph-photo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {pct >= 8 && <span style={{ fontSize: '0.75rem', color: '#fff', fontWeight: 600 }}>{pct}%</span>}
                      </div>
                      <div style={{ flex: 1, background: 'var(--sr-chart-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                        {(100 - pct) >= 8 && <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)', fontWeight: 600 }}>{100 - pct}%</span>}
                      </div>
                    </div>
                  )
                })()}
              </div>
            )}
          </>
        )}

      </SectionCard>

      {/* ── Highlights & Records ───────────────────────────────────────────── */}
      <SectionCard title="Highlights & Records" icon={<Award size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {funStats.busiestDay && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Biggest single day</p>
              {SUBMISSION_ID_RE.test(funStats.busiestDay.submissionId) ? (
                <a
                  href={`https://ebird.org/checklist/${funStats.busiestDay.submissionId}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: '1.125rem', fontWeight: 700, display: 'block', margin: '0 0 2px', color: 'var(--sr-accent)', textDecoration: 'none' }}
                >
                  {fmt(funStats.busiestDay.species)} species
                </a>
              ) : (
                <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-accent)' }}>
                  {fmt(funStats.busiestDay.species)} species
                </p>
              )}
              <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: 0 }}>{fmtDate(funStats.busiestDay.date)}</p>
            </div>
          )}
          {funStats.maxStreak > 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Longest streak</p>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-accent)' }}>
                {fmt(funStats.maxStreak)} day{funStats.maxStreak !== 1 ? 's' : ''}
              </p>
              {funStats.maxStreak > 1 && funStats.streakStart && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: 0 }}>
                  {fmtDate(funStats.streakStart)} – {fmtDate(funStats.streakEnd)}
                </p>
              )}
            </div>
          )}
          {funStats.drySpell > 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Longest dry spell</p>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px' }}>
                {fmt(funStats.drySpell)} day{funStats.drySpell !== 1 ? 's' : ''}
              </p>
              {funStats.dryStart && (
                <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: 0 }}>
                  {fmtDate(funStats.dryStart)} – {fmtDate(funStats.dryEnd)}
                </p>
              )}
            </div>
          )}
          {funStats.shannon !== null && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Shannon diversity (H′)</p>
              <p style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px' }}>
                {funStats.shannon.toFixed(2)}
              </p>
              <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: 0 }}>from numeric counts</p>
            </div>
          )}
        </div>

        {quality.biggestCounts.length > 0 && (
          <>
            <Divider />
            <SubLabel>Biggest single counts</SubLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
                <thead>
                  <tr>
                    {(['Species', 'Count', 'Date', 'Location'] as const).map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Species' ? 'left' : 'right',
                        padding: '4px 8px', fontSize: '0.6875rem', color: 'var(--sr-text-muted)',
                        fontWeight: 600, borderBottom: '1px solid var(--sr-border-subtle)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quality.biggestCounts.map((entry, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--sr-border-subtle)' }}>
                      <td style={{ padding: '5px 8px', textAlign: 'left' }}>
                        <BirdName commonName={entry.name} taxonCode={codeFor(entry.name)} hasEntry={hasEntryFor(entry.name)} onOpenSpecies={onOpenSpecies} />
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right' }}>
                        {SUBMISSION_ID_RE.test(entry.submissionId) ? (
                          <a
                            href={`https://ebird.org/checklist/${entry.submissionId}`}
                            target="_blank" rel="noreferrer"
                            style={{ color: 'var(--sr-accent)', fontWeight: 600, textDecoration: 'none' }}
                          >
                            {fmt(entry.count)}
                          </a>
                        ) : (
                          <span style={{ fontWeight: 600 }}>{fmt(entry.count)}</span>
                        )}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>
                        {entry.date ? fmtDate(entry.date) : '—'}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)', maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {entry.location || '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <Divider />
        <SubLabel>Single-checklist birds</SubLabel>
        <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: '0 0 8px' }}>
          {fmt(funStats.singleChecklistBirds.length)} species seen on exactly one checklist (excludes one-and-done birds, listed below)
        </p>
        {funStats.singleChecklistBirds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {funStats.singleChecklistBirds.map(bird => (
              <span key={bird.name} style={{
                display: 'inline-flex', alignItems: 'center', gap: 6,
                padding: '3px 10px', borderRadius: 100,
                background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
              }}>
                <BirdName commonName={bird.name} taxonCode={codeFor(bird.name)} hasEntry={hasEntryFor(bird.name)} onOpenSpecies={onOpenSpecies} size="sm" />
                {SUBMISSION_ID_RE.test(bird.submissionId) && (
                  <a href={`https://ebird.org/checklist/${bird.submissionId}`} target="_blank" rel="noreferrer" title="Open checklist" style={{ color: 'var(--sr-accent)', textDecoration: 'none', fontSize: '0.6875rem' }}>↗</a>
                )}
              </span>
            ))}
          </div>
        )}

        <Divider />
        <SubLabel>One-and-done birds</SubLabel>
        {funStats.oneDoneBirds.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0 }}>No one-and-done birds in your data.</p>
        ) : (
          <>
            <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: '0 0 8px' }}>
              {fmt(funStats.oneDoneBirds.length)} species with a total individual count of exactly 1
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {funStats.oneDoneBirds.map(bird => (
                <span key={bird.name} style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  padding: '3px 10px', borderRadius: 100,
                  background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                }}>
                  <BirdName commonName={bird.name} taxonCode={codeFor(bird.name)} hasEntry={hasEntryFor(bird.name)} onOpenSpecies={onOpenSpecies} size="sm" />
                  {SUBMISSION_ID_RE.test(bird.submissionId) && (
                    <a href={`https://ebird.org/checklist/${bird.submissionId}`} target="_blank" rel="noreferrer" title="Open checklist" style={{ color: 'var(--sr-accent)', textDecoration: 'none', fontSize: '0.6875rem' }}>↗</a>
                  )}
                </span>
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 7: Breeding Stats ──────────────────────────────────────── */}
      <SectionCard title="Breeding Stats" icon={<Dna size={16} />}>
        {breedingStats.total === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0 }}>
            No breeding codes recorded in this export.
          </p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 0, marginBottom: 20 }}>
              {[
                { label: 'Confirmed', value: breedingStats.confirmed, color: 'var(--sr-tier-4)' },
                { label: 'Probable', value: breedingStats.probable, color: 'var(--sr-tier-2)' },
                { label: 'Possible', value: breedingStats.possible, color: 'var(--sr-tier-1)' },
              ].map((tier, i) => (
                <div key={i} style={{ borderRight: '1px solid var(--sr-border-subtle)', borderBottom: '1px solid var(--sr-border-subtle)', padding: '12px 4px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: tier.color }}>{fmt(tier.value)}</span>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '4px 0 0' }}>{tier.label} species</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <SubLabel>Breeding activity by month</SubLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { key: 'all', label: 'All' },
                  { key: 'confirmed', label: 'Confirmed', color: 'var(--sr-tier-4)' },
                  { key: 'probable', label: 'Probable', color: 'var(--sr-tier-2)' },
                  { key: 'possible', label: 'Possible', color: 'var(--sr-tier-1)' },
                ] as const).map(f => (
                  <button tabIndex={0}
                    key={f.key}
                    onClick={() => setBreedingFilter(f.key)}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer',
                      border: breedingFilter === f.key
                        ? `1.5px solid ${'color' in f ? f.color : 'var(--sr-accent-border)'}`
                        : '1.5px solid var(--sr-border)',
                      background: breedingFilter === f.key ? ('color' in f ? `rgba(var(--sr-tier-${'confirmed' === f.key ? 4 : 'probable' === f.key ? 2 : 1}-rgb), 0.1)` : 'var(--sr-accent-bg)') : 'none',
                      color: breedingFilter === f.key ? ('color' in f ? f.color : 'var(--sr-accent)') : 'var(--sr-text-muted)',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>
            {(() => {
              const maxVal = Math.max(...breedingStats.byMonthRows.map(r =>
                breedingFilter === 'all' ? r.total :
                breedingFilter === 'confirmed' ? r.confirmed :
                breedingFilter === 'probable' ? r.probable : r.possible
              ), 1)
              return (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {breedingStats.byMonthRows.map(r => {
                      if (breedingFilter !== 'all') {
                        const val = breedingFilter === 'confirmed' ? r.confirmed : breedingFilter === 'probable' ? r.probable : r.possible
                        const color = breedingFilter === 'confirmed' ? 'var(--sr-tier-4)' : breedingFilter === 'probable' ? 'var(--sr-tier-2)' : 'var(--sr-tier-1)'
                        return (
                          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 28 }}>{r.label}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 20, textAlign: 'right' }}>{val || ''}</span>
                          </div>
                        )
                      }
                      const totalPct = maxVal > 0 ? (r.total / maxVal) * 100 : 0
                      const confPct = r.total > 0 ? (r.confirmed / r.total) * totalPct : 0
                      const probPct = r.total > 0 ? (r.probable / r.total) * totalPct : 0
                      const possPct = r.total > 0 ? (r.possible / r.total) * totalPct : 0
                      return (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 28 }}>{r.label}</span>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ height: '100%', width: `${confPct}%`, background: 'var(--sr-tier-4)', transition: 'width 0.3s' }} />
                            <div style={{ height: '100%', width: `${probPct}%`, background: 'var(--sr-tier-2)', transition: 'width 0.3s' }} />
                            <div style={{ height: '100%', width: `${possPct}%`, background: 'var(--sr-tier-1)', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: 20, textAlign: 'right' }}>{r.total || ''}</span>
                        </div>
                      )
                    })}
                  </div>
                  {breedingFilter === 'all' && (
                    <div style={{ display: 'flex', gap: 14, marginTop: 8 }}>
                      {[
                        { label: 'Confirmed', color: 'var(--sr-tier-4)' },
                        { label: 'Probable', color: 'var(--sr-tier-2)' },
                        { label: 'Possible', color: 'var(--sr-tier-1)' },
                      ].map(d => (
                        <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: d.color, flexShrink: 0 }} />
                          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{d.label}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )
            })()}
          </>
        )}
      </SectionCard>

      {/* ── Section 8: Media ─────────────────────────────────────────────────── */}
      {rawMlRows.length > 0 && (
        <SectionCard title="Media" icon={<Video size={16} />}>

          {/* Controls row */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', rowGap: 8, marginBottom: 10 }}>
            {/* Per Period / Cumulative toggle — hidden when interval = 'total' */}
            {mediaInterval !== 'total' ? (
              <div style={{ display: 'flex', gap: 4 }}>
                {(['per-period', 'cumulative'] as const).map(m => (
                  <button tabIndex={0}
                    key={m}
                    onClick={() => setMediaViewMode(m)}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer',
                      border: mediaViewMode === m ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
                      background: mediaViewMode === m ? 'var(--sr-accent-bg)' : 'none',
                      color: mediaViewMode === m ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                    }}
                  >
                    {m === 'per-period' ? 'Per Period' : 'Cumulative'}
                  </button>
                ))}
              </div>
            ) : <div />}
            {/* Interval control */}
            <div style={{ display: 'flex', gap: 4 }}>
              {(['weekly', 'monthly', 'yearly', 'total'] as const).map(g => (
                <button tabIndex={0}
                  key={g}
                  onClick={() => setMediaInterval(g)}
                  style={{
                    height: 24, padding: '0 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 500,
                    fontFamily: 'inherit', cursor: 'pointer',
                    border: mediaInterval === g ? '1.5px solid var(--sr-accent-border)' : '1.5px solid var(--sr-border)',
                    background: mediaInterval === g ? 'var(--sr-accent-bg)' : 'none',
                    color: mediaInterval === g ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                  }}
                >
                  {g.charAt(0).toUpperCase() + g.slice(1)}
                </button>
              ))}
            </div>
          </div>

          {/* Chart */}
          {mediaGraphResult.data.length >= 2 && (
            <div style={{ height: 240, marginBottom: 20 }} role="img" aria-label="Line chart of media uploaded over time — photo, audio, video, and total counts">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={mediaDisplayData} margin={{ top: 4, right: 4, bottom: 0, left: -10 }}>
                  <XAxis
                    dataKey="key"
                    tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }}
                    tickLine={false} axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={key => mediaInterval === 'total'
                      ? fmtDate(String(key))
                      : formatPeriodLabel(String(key), mediaInterval as PeriodGranularity)}
                  />
                  <YAxis tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                    labelFormatter={key => mediaInterval === 'total'
                      ? fmtDate(String(key))
                      : formatPeriodLabel(String(key), mediaInterval as PeriodGranularity)}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.6875rem' }} />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="photo" name="Photo" stroke="var(--sr-graph-photo)" strokeWidth={2} dot={false} />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="audio" name="Audio" stroke="var(--sr-graph-audio)" strokeWidth={2} dot={false} />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="video" name="Video" stroke="var(--sr-graph-video)" strokeWidth={2} dot={false} />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="total" name="Total" stroke="var(--sr-graph-media-total)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Rankings */}
          {mlStats.mostPhotographed.length > 0 && (
            <>
              <SubLabel>Most photographed</SubLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {mlStats.mostPhotographed.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <BirdName commonName={entry.name} taxonCode={codeFor(entry.name)} hasEntry={hasEntryFor(entry.name)} onOpenSpecies={onOpenSpecies} />
                    </span>
                    <a
                      href={mlCatalogUrl(entry.name, 'Photo', mlUserId, mlTaxonMap[entry.name])}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {fmt(entry.count)} photos
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
          {mlStats.mostAudio.length > 0 && (
            <>
              {mlStats.mostPhotographed.length > 0 && <Divider />}
              <SubLabel>Most recorded (audio)</SubLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
                {mlStats.mostAudio.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <BirdName commonName={entry.name} taxonCode={codeFor(entry.name)} hasEntry={hasEntryFor(entry.name)} onOpenSpecies={onOpenSpecies} />
                    </span>
                    <a
                      href={mlCatalogUrl(entry.name, 'Audio', mlUserId, mlTaxonMap[entry.name])}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {fmt(entry.count)} recordings
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
          {mlStats.mostVideo.length > 0 && (
            <>
              {(mlStats.mostPhotographed.length > 0 || mlStats.mostAudio.length > 0) && <Divider />}
              <SubLabel>Most filmed (video)</SubLabel>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                {mlStats.mostVideo.map((entry, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <BirdName commonName={entry.name} taxonCode={codeFor(entry.name)} hasEntry={hasEntryFor(entry.name)} onOpenSpecies={onOpenSpecies} />
                    </span>
                    <a
                      href={mlCatalogUrl(entry.name, 'Video', mlUserId, mlTaxonMap[entry.name])}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {fmt(entry.count)} videos
                    </a>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* ── Section 9: Other Statistics ───────────────────────────────────── */}
      <SectionCard title="Other Statistics" icon={<Star size={16} />}>

        {/* Nearby Lifers (formerly "Nemesis Birds") */}
        <SubLabel>Nearby Lifers</SubLabel>
        <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: '0 0 12px', borderLeft: '3px solid var(--sr-accent-border)', paddingLeft: 10 }}>
          <p style={{ margin: '0 0 6px' }}>
            Species observed near your configured location in the past 30 days that haven't appeared on your life list, sorted by most recently seen. Data comes from eBird's recent observations for the location and search radius set in Settings.
          </p>
          <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            {[
              { color: '#EF4444', label: 'Seen in past 7 days' },
              { color: '#F59E0B', label: '8–14 days ago' },
              { color: 'var(--sr-text-disabled)', label: '15–30 days ago' },
            ].map(d => (
              <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.color, flexShrink: 0 }} />
                <span>{d.label}</span>
              </div>
            ))}
          </div>
        </div>
        {!mapDefaults ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
            <AlertCircle size={14} style={{ color: 'var(--sr-text-muted)', flexShrink: 0 }} />
            <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0 }}>
              Set a default location in{' '}
              <button tabIndex={0} onClick={onGoToSettings} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--sr-accent)', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 600 }}>
                Settings
              </button>{' '}
              to see Nearby Lifers.
            </p>
          </div>
        ) : nemesisLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sr-text-muted)', fontSize: '0.8125rem' }}>
            <Loader2 size={14} className="spin" /> Loading nearby sightings…
          </div>
        ) : nemesisError ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-error)', margin: 0 }}>{nemesisError}</p>
        ) : nemesisFiltered !== null && nemesisFiltered.length === 0 ? (
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0 }}>
            No nearby lifers — you've seen everything reported nearby in the past 30 days.
          </p>
        ) : nemesisFiltered && nemesisFiltered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nemesisFiltered.map(bird => {
              const daysAgo = Math.round(
                (SESSION_NOW_MS - new Date(bird.recentDate + 'T12:00:00').getTime()) / 86400000
              )
              const dotColor = daysAgo <= 7 ? '#EF4444' : daysAgo <= 14 ? '#F59E0B' : 'var(--sr-text-disabled)'
              const taxonCode = mlTaxonMap[bird.commonName] || nemesisTaxonMap[bird.commonName] || null
              return (
                <div key={bird.commonName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{ flex: 1, minWidth: 0 }}>
                    <BirdName
                      commonName={bird.commonName}
                      taxonCode={taxonCode ?? undefined}
                      hasEntry={hasEntryFor(bird.commonName)}
                      onOpenSpecies={onOpenSpecies}
                    />
                  </span>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0 }}>{fmtDate(bird.recentDate)}</span>
                </div>
              )
            })}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}
