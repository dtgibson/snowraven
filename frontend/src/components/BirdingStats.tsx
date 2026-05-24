import { useEffect, useMemo, useState } from 'react'
import {
  BarChart2, Trophy, Clock, MapPin, ShieldCheck, Dna, Star,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar,
} from 'recharts'
import { parseEbirdObservations } from '../lib/parseEbirdObservations'
import { parseMLExport } from '../lib/parseMLExport'
import type { MLExportRow } from '../lib/parseMLExport'
import { normalizeSpeciesName, isSpuhOrSlash } from '../lib/speciesUtils'
import { BREEDING_CODE_MAP } from '../lib/breedingCodes'
import { SetupRequired } from './SetupRequired'
import type { ObservationEntry, ChecklistEntry } from '../types'

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
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
const SUBMISSION_ID_RE = /^S\d+$/
const KM_TO_MI = 0.621371
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

function parseHour(time: string | null | undefined): number | null {
  if (!time) return null
  const m = time.match(/^(\d+):(\d+)\s*(AM|PM)$/i)
  if (!m) return null
  let hour = parseInt(m[1], 10)
  const period = m[3].toUpperCase()
  if (period === 'PM' && hour !== 12) hour += 12
  if (period === 'AM' && hour === 12) hour = 0
  return hour
}

function fmt(n: number, decimals = 0): string {
  return n.toLocaleString(undefined, { maximumFractionDigits: decimals })
}

function fmtDate(iso: string): string {
  const [y, m, d] = iso.split('-')
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${months[parseInt(m, 10) - 1]} ${parseInt(d, 10)}, ${y}`
}

type Granularity = 'total' | 'weekly' | 'monthly' | 'yearly'
type PeriodGranularity = Exclude<Granularity, 'total'>

function getPeriodKey(date: string, granularity: PeriodGranularity): string {
  if (granularity === 'yearly') return date.substring(0, 4)
  if (granularity === 'monthly') return date.substring(0, 7)
  const d = new Date(date + 'T12:00:00')
  const start = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((Math.floor((d.getTime() - start.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function formatPeriodLabel(key: string, granularity: PeriodGranularity): string {
  if (granularity === 'yearly') return key
  if (granularity === 'monthly') {
    const [y, m] = key.split('-')
    return `${MONTH_LABELS[parseInt(m, 10) - 1]} '${y.slice(2)}`
  }
  const [, w] = key.split('-W')
  return `W${w}`
}

// ── Sub-components ────────────────────────────────────────────────────────────

function SectionCard({ children, title, icon }: {
  children: React.ReactNode; title: string; icon: React.ReactNode
}) {
  return (
    <div style={{
      background: 'var(--sr-surface)',
      border: '1px solid var(--sr-border)',
      borderRadius: 12,
      padding: 24,
      boxShadow: 'var(--sr-card-shadow)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--sr-border-subtle)',
      }}>
        <span style={{ color: 'var(--sr-accent)' }}>{icon}</span>
        <h3 style={{ fontSize: 15, fontWeight: 600, margin: 0 }}>{title}</h3>
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
        fontSize: large ? 28 : 22,
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--sr-text)',
        lineHeight: 1,
      }}>
        {typeof value === 'number' ? fmt(value) : value}
      </span>
      {sub && <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', marginTop: 2 }}>{sub}</span>}
      <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', marginTop: 2 }}>{label}</span>
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
        fontSize: 11, color: 'var(--sr-text-muted)',
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
      <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: pctDisplay !== null ? 68 : 40, textAlign: 'right' }}>
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
    <p style={{ fontSize: 11, fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: '0 0 10px' }}>
      {children}
    </p>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BirdingStats({ onGoToSettings }: { onGoToSettings: () => void }) {
  const [phase, setPhase]           = useState<Phase>({ tag: 'loading-saved' })
  const [mapDefaults, setMapDefaults] = useState<MapDefaults | null>(null)
  const [includeSpuh, setIncludeSpuh] = useState(false)
  const [accGranularity, setAccGranularity] = useState<Granularity>('total')
  const [showAllCounties, setShowAllCounties] = useState(false)
  const [breedingFilter, setBreedingFilter] = useState<'all' | 'confirmed' | 'probable' | 'possible'>('all')
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [mlTaxonMap, setMlTaxonMap] = useState<Record<string, string>>({})
  const [nemesisResult, setNemesisResult] = useState<NemesisSpecies[] | null>(null)
  const [nemesisLoading, setNemesisLoading] = useState(false)
  const [nemesisError, setNemesisError] = useState<string | null>(null)

  // Auto-load eBird backup + ML export + map defaults on mount
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const [statusRes, mapDefaultsRes] = await Promise.all([
          fetch('/settings/files'),
          fetch('/settings/map-defaults').catch(() => null),
        ])

        if (!statusRes.ok || cancelled) { setPhase({ tag: 'setup-required' }); return }
        const status: { ebird: { filename: string; uploadedAt: string } | null; ml: { filename: string } | null } =
          await statusRes.json()
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }

        if (mapDefaultsRes?.ok) {
          const md = await mapDefaultsRes.json()
          if (md && typeof md.lat === 'number' && typeof md.lng === 'number') {
            setMapDefaults(md)
          }
        }

        const fetches: Promise<Response>[] = [fetch('/settings/files/ebird')]
        if (status.ml) fetches.push(fetch('/settings/files/ml'))
        const [ebirdRes, mlRes] = await Promise.all(fetches)

        if (!ebirdRes.ok || cancelled) {
          setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." })
          return
        }

        const ebirdText = await ebirdRes.text()
        const observations = parseEbirdObservations(ebirdText)

        let mlRows: MLExportRow[] = []
        if (mlRes?.ok) {
          const mlText = await mlRes.text()
          try { mlRows = parseMLExport(mlText).rows } catch { /* ML export optional */ }
        }

        if (cancelled) return
        const mlMatch = status.ml?.filename.match(ML_USER_RE)
        if (mlMatch) setMlUserId(mlMatch[1])

        if (mlRows.length > 0) {
          const seenNames = new Map<string, string>()
          for (const r of mlRows) {
            if (!seenNames.has(r.commonName)) seenNames.set(r.commonName, r.scientificName)
          }
          const species = [...seenNames.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
          try {
            const taxRes = await fetch('/taxonomy/codes', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ species }),
            })
            if (taxRes.ok && !cancelled) {
              const data: { codes: Record<string, string> } = await taxRes.json()
              setMlTaxonMap(data.codes)
            }
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
        const r = await fetch(`/stats/nemesis?lat=${mapDefaults.lat}&lng=${mapDefaults.lng}&dist=${mapDefaults.dist}`)
        if (!r.ok) throw new Error(String(r.status))
        const data = await r.json()
        if (!cancelled) setNemesisResult(data.species ?? [])
      } catch {
        if (!cancelled) setNemesisError('Could not load nearby sightings.')
      } finally {
        if (!cancelled) setNemesisLoading(false)
      }
    }
    run()
    return () => { cancelled = true }
  }, [mapDefaults, phase.tag])

  // Raw data — stable refs so useMemos don't thrash when phase tag changes
  const rawObs = phase.tag === 'ready' ? phase.observations : EMPTY_OBS
  const rawMlRows = phase.tag === 'ready' ? phase.mlRows : EMPTY_ML
  const freshness = phase.tag === 'ready' ? phase.freshness : ''

  // ── useMemos (all declared before any conditional return) ─────────────────

  const filteredObs = useMemo(() =>
    includeSpuh ? rawObs : rawObs.filter(o => !isSpuhOrSlash(o.commonName))
  , [rawObs, includeSpuh])

  const checklists = useMemo((): ChecklistEntry[] => {
    const speciesBySub = new Map<string, Set<string>>()
    const firstRowBySub = new Map<string, ObservationEntry>()
    for (const o of filteredObs) {
      if (!firstRowBySub.has(o.submissionId)) {
        firstRowBySub.set(o.submissionId, o)
        speciesBySub.set(o.submissionId, new Set())
      }
      speciesBySub.get(o.submissionId)!.add(normalizeSpeciesName(o.commonName))
    }
    const result: ChecklistEntry[] = []
    for (const [subId, firstRow] of firstRowBySub) {
      result.push({
        submissionId: subId,
        date: firstRow.date,
        location: firstRow.location,
        locationId: firstRow.locationId,
        latitude: firstRow.latitude,
        longitude: firstRow.longitude,
        county: firstRow.county,
        stateProvince: firstRow.stateProvince ?? null,
        time: firstRow.time ?? null,
        duration: firstRow.duration ?? null,
        distance: firstRow.distance ?? null,
        protocol: firstRow.protocol ?? null,
        numObservers: firstRow.numObservers ?? null,
        allObsReported: firstRow.allObsReported ?? null,
        checklistComments: firstRow.checklistComments ?? '',
        speciesCount: speciesBySub.get(subId)!.size,
      })
    }
    return result.sort((a, b) => a.date.localeCompare(b.date))
  }, [filteredObs])

  const lifeList = useMemo((): string[] => {
    const seen = new Set<string>()
    for (const o of filteredObs) seen.add(normalizeSpeciesName(o.commonName))
    return [...seen].sort()
  }, [filteredObs])

  const totals = useMemo(() => {
    const locations = new Set<string>()
    const years = new Set<string>()
    const states = new Set<string>()
    const countries = new Set<string>()
    for (const c of checklists) {
      locations.add(c.locationId)
      years.add(c.date.substring(0, 4))
      if (c.stateProvince) {
        states.add(c.stateProvince)
        const country = c.stateProvince.split('-')[0]
        if (country) countries.add(country)
      }
    }
    const dates = checklists.map(c => c.date).sort()
    return {
      speciesCount: lifeList.length,
      checklistCount: checklists.length,
      locationCount: locations.size,
      yearCount: years.size,
      stateCount: states.size,
      countryCount: countries.size,
      firstDate: dates[0] ?? null,
      lastDate: dates[dates.length - 1] ?? null,
    }
  }, [checklists, lifeList])

  // Accumulation curve + milestones — must process observations in chronological order
  const accumulation = useMemo(() => {
    const sorted = [...filteredObs].sort((a, b) => a.date.localeCompare(b.date))
    const seen = new Set<string>()
    const milestoneMap = new Map<number, { date: string; species: string; submissionId: string }>()
    const byPeriod = new Map<string, number>()
    const liferDates = new Map<string, { count: number; species: string }>()
    let firstSpecies: { date: string; name: string } | null = null
    const thresholds = Array.from({ length: 20 }, (_, i) => (i + 1) * 50)

    for (const o of sorted) {
      const norm = normalizeSpeciesName(o.commonName)
      if (!seen.has(norm)) {
        seen.add(norm)
        const count = seen.size
        if (!firstSpecies) firstSpecies = { date: o.date, name: norm }
        for (const t of thresholds) {
          if (count === t && !milestoneMap.has(t)) {
            milestoneMap.set(t, { date: o.date, species: norm, submissionId: o.submissionId })
          }
        }
        liferDates.set(o.date, { count, species: norm })
        if (accGranularity !== 'total') {
          byPeriod.set(getPeriodKey(o.date, accGranularity as PeriodGranularity), count)
        }
      }
    }

    const chartData = accGranularity !== 'total'
      ? [...byPeriod.entries()]
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([period, species]) => ({ period, species }))
      : []

    const liferPoints = [...liferDates.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, { count, species }]) => ({ date, count, species }))

    return { chartData, liferPoints, milestones: milestoneMap, firstSpecies }
  }, [filteredObs, accGranularity])

  // Temporal histograms
  const temporal = useMemo(() => {
    const byYearMap = new Map<string, { checklists: number; species: Set<string> }>()
    const byMonthMap = new Map<number, { checklists: number; species: Set<string> }>()
    const byDow = new Map<number, number>()
    const byHour = new Map<number, number>()

    for (const c of checklists) {
      const year = c.date.substring(0, 4)
      const month = parseInt(c.date.substring(5, 7), 10) - 1

      if (!byYearMap.has(year)) byYearMap.set(year, { checklists: 0, species: new Set() })
      byYearMap.get(year)!.checklists++

      if (!byMonthMap.has(month)) byMonthMap.set(month, { checklists: 0, species: new Set() })
      byMonthMap.get(month)!.checklists++

      // getDay() is timezone-sensitive; use noon UTC workaround
      const dow = new Date(c.date + 'T12:00:00').getDay()
      byDow.set(dow, (byDow.get(dow) ?? 0) + 1)

      const hour = parseHour(c.time)
      if (hour !== null) byHour.set(hour, (byHour.get(hour) ?? 0) + 1)
    }

    for (const o of filteredObs) {
      const year = o.date.substring(0, 4)
      const month = parseInt(o.date.substring(5, 7), 10) - 1
      const norm = normalizeSpeciesName(o.commonName)
      byYearMap.get(year)?.species.add(norm)
      byMonthMap.get(month)?.species.add(norm)
    }

    const yearRows = [...byYearMap.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([year, d]) => ({ label: year, checklists: d.checklists, species: d.species.size }))

    const monthRows = Array.from({ length: 12 }, (_, i) => ({
      label: MONTH_LABELS[i],
      checklists: byMonthMap.get(i)?.checklists ?? 0,
      species: byMonthMap.get(i)?.species.size ?? 0,
    }))

    const dowRows = Array.from({ length: 7 }, (_, i) => ({
      label: DOW_LABELS[i],
      value: byDow.get(i) ?? 0,
    }))

    const hourRows = Array.from({ length: 24 }, (_, i) => ({
      label: i === 0 ? '12am' : i < 12 ? `${i}am` : i === 12 ? '12pm' : `${i - 12}pm`,
      value: byHour.get(i) ?? 0,
    }))

    return { yearRows, monthRows, dowRows, hourRows }
  }, [checklists, filteredObs])

  // Geographic stats
  const geo = useMemo(() => {
    const locationMap = new Map<string, { name: string; count: number; species: Set<string> }>()
    const countyMap = new Map<string, number>()
    const countyStateMap = new Map<string, string | null>()
    const countySpecies = new Map<string, Set<string>>()
    const stateMap = new Map<string, number>()
    const stateSpecies = new Map<string, Set<string>>()

    for (const c of checklists) {
      if (!locationMap.has(c.locationId)) {
        locationMap.set(c.locationId, { name: c.location, count: 0, species: new Set() })
      }
      locationMap.get(c.locationId)!.count++

      if (c.county) {
        countyMap.set(c.county, (countyMap.get(c.county) ?? 0) + 1)
        if (!countyStateMap.has(c.county)) countyStateMap.set(c.county, c.stateProvince)
        if (!countySpecies.has(c.county)) countySpecies.set(c.county, new Set())
      }
      if (c.stateProvince) {
        stateMap.set(c.stateProvince, (stateMap.get(c.stateProvince) ?? 0) + 1)
        if (!stateSpecies.has(c.stateProvince)) stateSpecies.set(c.stateProvince, new Set())
      }
    }

    for (const o of filteredObs) {
      const norm = normalizeSpeciesName(o.commonName)
      locationMap.get(o.locationId)?.species.add(norm)
      if (o.county) countySpecies.get(o.county)?.add(norm)
      if (o.stateProvince) stateSpecies.get(o.stateProvince)?.add(norm)
    }

    const allLocations = [...locationMap.values()]
      .map(l => ({ name: l.name, checklists: l.count, species: l.species.size }))

    const topLocations = [...allLocations].sort((a, b) => b.checklists - a.checklists).slice(0, 10)
    const topLocationsBySpecies = [...allLocations].sort((a, b) => b.species - a.species).slice(0, 10)

    const allCountyData = [...countyMap.entries()].map(([name, count]) => ({
      name, count,
      stateProvince: countyStateMap.get(name) ?? null,
      species: countySpecies.get(name)?.size ?? 0,
    }))
    const topCounties = [...allCountyData].sort((a, b) => b.count - a.count)
    const topCountiesBySpecies = [...allCountyData].sort((a, b) => b.species - a.species)

    const allStateData = [...stateMap.entries()].map(([name, count]) => ({
      name, count,
      species: stateSpecies.get(name)?.size ?? 0,
    }))
    const topStates = [...allStateData].sort((a, b) => b.count - a.count)
    const topStatesBySpecies = [...allStateData].sort((a, b) => b.species - a.species)

    return { topLocations, topLocationsBySpecies, topCounties, topCountiesBySpecies, topStates, topStatesBySpecies }
  }, [checklists, filteredObs])

  // Effort stats
  const effort = useMemo(() => {
    const protocols = new Map<string, number>()
    const protocolDuration = new Map<string, { total: number; count: number }>()
    const protocolDistance = new Map<string, { total: number; count: number }>()
    let totalDurationMin = 0, durationCount = 0
    let totalDistanceKm = 0, distanceCount = 0
    const observerDist = new Map<number, number>()
    let completeCount = 0, allObsCount = 0
    let totalSpeciesHours = 0, speciesHourCount = 0
    let totalSpeciesDist = 0, speciesDistCount = 0

    for (const c of checklists) {
      const proto = c.protocol ?? ''
      if (proto) protocols.set(proto, (protocols.get(proto) ?? 0) + 1)
      if (c.duration !== null) {
        totalDurationMin += c.duration; durationCount++
        if (proto) {
          const pd = protocolDuration.get(proto) ?? { total: 0, count: 0 }
          pd.total += c.duration; pd.count++
          protocolDuration.set(proto, pd)
        }
        if (c.speciesCount > 0 && c.duration > 0) {
          totalSpeciesHours += c.speciesCount / (c.duration / 60)
          speciesHourCount++
        }
      }
      if (c.distance !== null) {
        totalDistanceKm += c.distance; distanceCount++
        if (proto) {
          const dd = protocolDistance.get(proto) ?? { total: 0, count: 0 }
          dd.total += c.distance; dd.count++
          protocolDistance.set(proto, dd)
        }
        if (c.speciesCount > 0 && c.distance > 0) {
          totalSpeciesDist += c.speciesCount / (c.distance * KM_TO_MI)
          speciesDistCount++
        }
      }
      if (c.numObservers !== null) {
        const key = c.numObservers >= 5 ? 5 : c.numObservers
        observerDist.set(key, (observerDist.get(key) ?? 0) + 1)
      }
      if (c.allObsReported !== null) {
        allObsCount++
        if (c.allObsReported) completeCount++
      }
    }

    const total = checklists.length
    const protocolRows = [...protocols.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({
        name,
        count,
        pct: total > 0 ? Math.round(count / total * 100) : 0,
        avgDurationMin: protocolDuration.has(name)
          ? protocolDuration.get(name)!.total / protocolDuration.get(name)!.count
          : null,
        avgDistanceMi: protocolDistance.has(name)
          ? (protocolDistance.get(name)!.total / protocolDistance.get(name)!.count) * KM_TO_MI
          : null,
      }))

    const observerRows = [...observerDist.entries()]
      .sort(([a], [b]) => a - b)
      .map(([n, count]) => ({ n, count }))

    return {
      protocolRows,
      observerRows,
      totalHours: durationCount > 0 ? totalDurationMin / 60 : null,
      avgDurationMin: durationCount > 0 ? totalDurationMin / durationCount : null,
      totalDistanceMi: distanceCount > 0 ? totalDistanceKm * KM_TO_MI : null,
      avgDistanceMi: distanceCount > 0 ? (totalDistanceKm / distanceCount) * KM_TO_MI : null,
      sppPerHour: speciesHourCount > 0 ? totalSpeciesHours / speciesHourCount : null,
      sppPerMi: speciesDistCount > 0 ? totalSpeciesDist / speciesDistCount : null,
      completeRatio: allObsCount > 0 ? completeCount / allObsCount : null,
    }
  }, [checklists])

  // Data quality
  const quality = useMemo(() => {
    let numericCount = 0, xCount = 0
    const speciesMaxCounts = new Map<string, { count: number; submissionId: string }>()
    const checklistBySubId = new Map(checklists.map(c => [c.submissionId, c]))

    for (const o of filteredObs) {
      if (o.count !== null) {
        numericCount++
        const norm = normalizeSpeciesName(o.commonName)
        const existing = speciesMaxCounts.get(norm)
        if (!existing || o.count > existing.count) {
          speciesMaxCounts.set(norm, { count: o.count, submissionId: o.submissionId })
        }
      } else {
        xCount++
      }
    }

    const total = numericCount + xCount
    const biggestCounts = [...speciesMaxCounts.entries()]
      .sort(([, a], [, b]) => b.count - a.count)
      .slice(0, 10)
      .map(([name, { count, submissionId }]) => {
        const cl = checklistBySubId.get(submissionId)
        return { name, count, submissionId, date: cl?.date ?? '', location: cl?.location ?? '' }
      })

    const checksWithComments = checklists.filter(c => c.checklistComments.trim().length > 0).length

    return {
      numericRatio: total > 0 ? numericCount / total : null,
      xRatio: total > 0 ? xCount / total : null,
      biggestCounts,
      checksWithComments,
      commentRatio: checklists.length > 0 ? checksWithComments / checklists.length : null,
    }
  }, [filteredObs, checklists])

  // Breeding stats
  const breedingStats = useMemo(() => {
    const codesBySp = new Map<string, number>() // sp → highest tier overall
    const byMonth = new Map<number, Map<string, number>>() // month → sp → highest tier that month

    for (const o of filteredObs) {
      if (!o.breedingCode) continue
      const norm = normalizeSpeciesName(o.commonName)
      const def = BREEDING_CODE_MAP.get(o.breedingCode)
      const tier = def?.tier ?? 0
      if (tier === 0) continue
      codesBySp.set(norm, Math.max(codesBySp.get(norm) ?? 0, tier))

      const month = parseInt(o.date.substring(5, 7), 10) - 1
      if (!byMonth.has(month)) byMonth.set(month, new Map())
      const mm = byMonth.get(month)!
      mm.set(norm, Math.max(mm.get(norm) ?? 0, tier))
    }

    let confirmed = 0, probable = 0, possible = 0
    for (const tier of codesBySp.values()) {
      if (tier >= 4) confirmed++
      else if (tier >= 2) probable++
      else if (tier >= 1) possible++
    }

    const byMonthRows = Array.from({ length: 12 }, (_, i) => {
      const mm = byMonth.get(i)
      let c = 0, p = 0, s = 0
      if (mm) {
        for (const tier of mm.values()) {
          if (tier >= 4) c++
          else if (tier >= 2) p++
          else if (tier >= 1) s++
        }
      }
      return { label: MONTH_LABELS[i], confirmed: c, probable: p, possible: s, total: c + p + s }
    })

    return { confirmed, probable, possible, total: confirmed + probable + possible, byMonthRows }
  }, [filteredObs])

  // ML stats (most photographed / audio / video)
  const mlStats = useMemo(() => {
    const photoCounts = new Map<string, number>()
    const audioCounts = new Map<string, number>()
    const videoCounts = new Map<string, number>()
    const firstCatalog = new Map<string, string>() // name+format → first catalogId
    for (const row of rawMlRows) {
      const key = `${row.commonName}::${row.format}`
      if (!firstCatalog.has(key)) firstCatalog.set(key, row.catalogId)
      if (row.format === 'Photo') photoCounts.set(row.commonName, (photoCounts.get(row.commonName) ?? 0) + 1)
      else if (row.format === 'Audio') audioCounts.set(row.commonName, (audioCounts.get(row.commonName) ?? 0) + 1)
      else if (row.format === 'Video') videoCounts.set(row.commonName, (videoCounts.get(row.commonName) ?? 0) + 1)
    }
    const topN = (m: Map<string, number>, fmt: 'Photo' | 'Audio' | 'Video') => [...m.entries()]
      .sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([name, count]) => ({ name, count, catalogId: firstCatalog.get(`${name}::${fmt}`) ?? null }))
    return {
      mostPhotographed: topN(photoCounts, 'Photo'),
      mostAudio: topN(audioCounts, 'Audio'),
      mostVideo: topN(videoCounts, 'Video'),
      totalPhotos: [...photoCounts.values()].reduce((a, b) => a + b, 0),
    }
  }, [rawMlRows])

  // Fun stats
  const funStats = useMemo(() => {
    // One-and-done: species seen on exactly 1 checklist
    const checklistsBySp = new Map<string, Set<string>>()
    for (const o of filteredObs) {
      const norm = normalizeSpeciesName(o.commonName)
      if (!checklistsBySp.has(norm)) checklistsBySp.set(norm, new Set())
      checklistsBySp.get(norm)!.add(o.submissionId)
    }
    const oneDoneBirds = [...checklistsBySp.entries()]
      .filter(([, subs]) => subs.size === 1)
      .map(([name, subs]) => ({ name, submissionId: [...subs][0] }))
      .sort((a, b) => a.name.localeCompare(b.name))

    // Consecutive-day streak + longest dry spell
    const dates = [...new Set(checklists.map(c => c.date))].sort()
    let maxStreak = 0, drySpell = 0
    let streakStart = '', streakEnd = '', dryStart = '', dryEnd = ''

    if (dates.length > 0) {
      let streak = 1
      let currentStreakStart = dates[0]
      maxStreak = 1
      streakStart = dates[0]
      streakEnd = dates[0]

      for (let i = 1; i < dates.length; i++) {
        const diffDays = Math.round(
          (new Date(dates[i] + 'T12:00:00').getTime() - new Date(dates[i - 1] + 'T12:00:00').getTime()) / 86400000
        )
        if (diffDays === 1) {
          streak++
          if (streak > maxStreak) {
            maxStreak = streak
            streakStart = currentStreakStart
            streakEnd = dates[i]
          }
        } else {
          const gap = diffDays - 1
          if (gap > drySpell) {
            drySpell = gap
            dryStart = dates[i - 1]
            dryEnd = dates[i]
          }
          streak = 1
          currentStreakStart = dates[i]
        }
      }
    }

    // Busiest day by species
    const spByDate = new Map<string, Set<string>>()
    for (const o of filteredObs) {
      if (!spByDate.has(o.date)) spByDate.set(o.date, new Set())
      spByDate.get(o.date)!.add(normalizeSpeciesName(o.commonName))
    }
    const busiestDayEntry = [...spByDate.entries()].sort(([, a], [, b]) => b.size - a.size)[0]
    const busiestDaySubId = busiestDayEntry
      ? checklists
          .filter(c => c.date === busiestDayEntry[0])
          .sort((a, b) => b.speciesCount - a.speciesCount)[0]?.submissionId ?? ''
      : ''

    // Shannon diversity (numeric obs only)
    const spCounts = new Map<string, number>()
    for (const o of filteredObs) {
      if (o.count === null) continue
      const norm = normalizeSpeciesName(o.commonName)
      spCounts.set(norm, (spCounts.get(norm) ?? 0) + o.count)
    }
    const totalCount = [...spCounts.values()].reduce((a, b) => a + b, 0)
    let shannon = 0
    if (totalCount > 0) {
      for (const count of spCounts.values()) {
        const p = count / totalCount
        if (p > 0) shannon -= p * Math.log(p)
      }
    }

    return {
      oneDoneBirds,
      maxStreak,
      streakStart,
      streakEnd,
      drySpell,
      dryStart,
      dryEnd,
      busiestDay: busiestDayEntry
        ? { date: busiestDayEntry[0], species: busiestDayEntry[1].size, submissionId: busiestDaySubId }
        : null,
      shannon: shannon > 0 ? shannon : null,
    }
  }, [filteredObs, checklists])

  // Nemesis birds filtered against life list
  const nemesisFiltered = useMemo(() => {
    if (!nemesisResult) return null
    const lifeSet = new Set(lifeList.map(s => s.toLowerCase()))
    return nemesisResult.filter(n => !lifeSet.has(n.commonName.toLowerCase()))
  }, [nemesisResult, lifeList])



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
        steps={['Go to Settings', 'Under Default Files, upload your MyEBirdData.csv']}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sr-error)', fontSize: 14 }}>
          <AlertCircle size={16} />
          {phase.message}
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

  return (
    <div style={{ width: '100%', maxWidth: 900, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 20, paddingBottom: 40 }}>

      {/* Page header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div>
          <h2 style={{ fontSize: 22, fontWeight: 700, margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 8 }}>
            <BarChart2 size={20} style={{ color: 'var(--sr-accent)' }} />
            Statistics
          </h2>
          <p style={{ fontSize: 13, color: 'var(--sr-text-muted)', margin: 0 }}>
            {fmt(totals.checklistCount)} checklists · eBird backup: {freshness}
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={includeSpuh}
            onChange={e => setIncludeSpuh(e.target.checked)}
            style={{ accentColor: 'var(--sr-accent)', width: 14, height: 14 }}
          />
          Include spuh / slash species
        </label>
      </div>

      {/* ── Section 1: Life List Totals ─────────────────────────────────────── */}
      <SectionCard title="Life List Totals" icon={<BarChart2 size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 0 }}>
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
                  <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>{label}</p>
                  {SUBMISSION_ID_RE.test(cl.submissionId) ? (
                    <a
                      href={`https://ebird.org/checklist/${cl.submissionId}`}
                      target="_blank" rel="noreferrer"
                      style={{ fontSize: 15, fontWeight: 700, color: 'var(--sr-accent)', textDecoration: 'none', display: 'block', margin: '0 0 3px' }}
                    >
                      {fmtDate(cl.date)}
                    </a>
                  ) : (
                    <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 3px' }}>{fmtDate(cl.date)}</p>
                  )}
                  <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: 0 }}>{cl.location}</p>
                </div>
              ))}
              {accumulation.firstSpecies && (
                <div style={{
                  flex: '1 1 160px', padding: '10px 14px', borderRadius: 8,
                  background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                }}>
                  <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>First species ever</p>
                  <p style={{ fontSize: 15, fontWeight: 700, margin: '0 0 3px' }}>{accumulation.firstSpecies.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: 0 }}>{fmtDate(accumulation.firstSpecies.date)}</p>
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
                {(['total', 'yearly', 'monthly', 'weekly'] as const).map(g => (
                  <button
                    key={g}
                    onClick={() => setAccGranularity(g)}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
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
            <div style={{ height: 180 }}>
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
                      tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={d => fmtDate(String(d))}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: 12 }}
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
                      tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }}
                      tickLine={false} axisLine={false}
                      interval="preserveStartEnd"
                      tickFormatter={key => formatPeriodLabel(String(key), accGranularity as PeriodGranularity)}
                    />
                    <YAxis tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: 12 }}
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

        {accumulation.milestones.size > 0 && (
          <>
            <Divider />
            <SubLabel>Milestones</SubLabel>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              {Array.from({ length: 20 }, (_, i) => (i + 1) * 50).map(threshold => {
                const m = accumulation.milestones.get(threshold)
                if (!m) return null
                return (
                  <div key={threshold} style={{
                    display: 'flex', flexDirection: 'column', alignItems: 'flex-start',
                    padding: '8px 12px', borderRadius: 8,
                    background: 'var(--sr-accent-bg)', border: '1px solid var(--sr-accent-border)',
                    minWidth: 80,
                  }}>
                    <span style={{ fontSize: 20, fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1 }}>{threshold}</span>
                    <span style={{ fontSize: 12, fontWeight: 600, margin: '3px 0 2px' }}>{m.species}</span>
                    {SUBMISSION_ID_RE.test(m.submissionId) ? (
                      <a
                        href={`https://ebird.org/checklist/${m.submissionId}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: 11, color: 'var(--sr-text-muted)', textDecoration: 'none' }}
                      >
                        {fmtDate(m.date)}
                      </a>
                    ) : (
                      <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{fmtDate(m.date)}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 2: Firsts & Milestones ─────────────────────────────────── */}
      <SectionCard title="Firsts & Milestones" icon={<Trophy size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {funStats.busiestDay && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Biggest single day</p>
              {SUBMISSION_ID_RE.test(funStats.busiestDay.submissionId) ? (
                <a
                  href={`https://ebird.org/checklist/${funStats.busiestDay.submissionId}`}
                  target="_blank" rel="noreferrer"
                  style={{ fontSize: 18, fontWeight: 700, display: 'block', margin: '0 0 2px', color: 'var(--sr-accent)', textDecoration: 'none' }}
                >
                  {fmt(funStats.busiestDay.species)} species
                </a>
              ) : (
                <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-accent)' }}>
                  {fmt(funStats.busiestDay.species)} species
                </p>
              )}
              <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', margin: 0 }}>{fmtDate(funStats.busiestDay.date)}</p>
            </div>
          )}
          {funStats.maxStreak > 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Longest streak</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-accent)' }}>
                {fmt(funStats.maxStreak)} day{funStats.maxStreak !== 1 ? 's' : ''}
              </p>
              {funStats.maxStreak > 1 && funStats.streakStart && (
                <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: 0 }}>
                  {fmtDate(funStats.streakStart)} – {fmtDate(funStats.streakEnd)}
                </p>
              )}
            </div>
          )}
          {funStats.drySpell > 0 && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Longest dry spell</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>
                {fmt(funStats.drySpell)} day{funStats.drySpell !== 1 ? 's' : ''}
              </p>
              {funStats.dryStart && (
                <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: 0 }}>
                  {fmtDate(funStats.dryStart)} – {fmtDate(funStats.dryEnd)}
                </p>
              )}
            </div>
          )}
          {funStats.shannon !== null && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Shannon diversity (H′)</p>
              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px' }}>
                {funStats.shannon.toFixed(2)}
              </p>
              <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', margin: 0 }}>from numeric counts</p>
            </div>
          )}
        </div>
      </SectionCard>

      {/* ── Section 3: Temporal Stats ──────────────────────────────────────── */}
      <SectionCard title="Temporal Stats" icon={<Calendar size={16} />}>
        {temporal.yearRows.length > 0 && (
          <>
            <SubLabel>Checklists by year</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {temporal.yearRows.map(r => (
                <BarRow key={r.label} label={r.label} value={r.checklists} max={maxYearChecklists} labelWidth={36} />
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
                <div style={{ position: 'relative', width: 120, height: 120 }}>
                  <PieChart width={120} height={120}>
                    <Pie data={monthPieData} dataKey="value" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                      {monthPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                    </Pie>
                  </PieChart>
                  {peakMonth && (
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sr-text-muted)', lineHeight: 1 }}>peak</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1.3 }}>{peakMonth.label}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )
        })()}

        <Divider />
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
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
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, alignItems: 'start' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {temporal.dowRows.map(r => (
                      <BarRow key={r.label} label={r.label} value={r.value} max={maxDow} labelWidth={28} color="var(--sr-graph-photo)" pctOf={totalDow} />
                    ))}
                  </div>
                  <div>
                    <div style={{ position: 'relative', width: 120, height: 120 }}>
                      <PieChart width={120} height={120}>
                        <Pie data={dowPieData} dataKey="value" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                          {dowPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                      </PieChart>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none' }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--sr-text-muted)', lineHeight: 1 }}>wkend</span>
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1.3 }}>{weekendPct}%</span>
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                      {dowPieData.map(d => {
                        const dpct = totalDow > 0 ? Math.round(d.value / totalDow * 100) : 0
                        return (
                          <div key={d.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: d.fill, flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{d.label} {dpct}%</span>
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
                <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', margin: 0 }}>No time data in this export.</p>
              )}
            </div>
          </div>
        </div>
      </SectionCard>

      {/* ── Section 4: Geographic Stats ────────────────────────────────────── */}
      <SectionCard title="Geographic Stats" icon={<MapPin size={16} />}>
        {geo.topLocations.length > 0 && (
          <>
            <SubLabel>Top locations by checklists</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {geo.topLocations.map((loc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0' }}>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0 }}>{fmt(loc.checklists)} lists · {fmt(loc.species)} sp.</span>
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
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: 13, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{loc.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0 }}>{fmt(loc.species)} sp. · {fmt(loc.checklists)} lists</span>
                </div>
              ))}
            </div>
          </>
        )}

        {geo.topCounties.length > 0 && (
          <>
            <Divider />
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
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
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topCounties[0]?.count ? (c.count / geo.topCounties[0].count) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 32, textAlign: 'right' }}>{fmt(c.count)}</span>
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
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 100, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topCountiesBySpecies[0]?.species ? (c.species / geo.topCountiesBySpecies[0].species) * 100 : 0}%`, background: 'var(--sr-graph-photo)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 40, textAlign: 'right' }}>{fmt(c.species)} sp.</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
            <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '8px 0 4px' }}>
              County names link to their state/province eBird region page.
            </p>
            {geo.topCounties.length > 8 && (
              <button
                onClick={() => setShowAllCounties(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--sr-accent)', padding: 0, fontFamily: 'inherit',
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
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24, alignItems: 'start' }}>
              <div>
                <SubLabel>States by checklists</SubLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {geo.topStates.map((s, i) => {
                    const validSp = s.name && s.name.includes('-')
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {validSp ? (
                            <a
                              href={`https://ebird.org/region/${s.name}`}
                              target="_blank" rel="noreferrer"
                              style={{ color: 'var(--sr-text)', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {s.name}
                            </a>
                          ) : s.name}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topStates[0]?.count ? (s.count / geo.topStates[0].count) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 32, textAlign: 'right' }}>{fmt(s.count)}</span>
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
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 60, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {validSp ? (
                            <a
                              href={`https://ebird.org/region/${s.name}`}
                              target="_blank" rel="noreferrer"
                              style={{ color: 'var(--sr-text)', textDecoration: 'none' }}
                              onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                              onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
                            >
                              {s.name}
                            </a>
                          ) : s.name}
                        </span>
                        <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topStatesBySpecies[0]?.species ? (s.species / geo.topStatesBySpecies[0].species) * 100 : 0}%`, background: 'var(--sr-graph-photo)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 40, textAlign: 'right' }}>{fmt(s.species)} sp.</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </>
        )}

      </SectionCard>

      {/* ── Section 5: Effort & Methodology ───────────────────────────────── */}
      <SectionCard title="Effort & Methodology" icon={<Clock size={16} />}>

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
                    <span style={{ fontSize: 11, color: '#fff', fontWeight: 600, whiteSpace: 'nowrap' }}>{r.pct}%</span>
                  )}
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {effort.protocolRows.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: PROTOCOL_COLORS[i % PROTOCOL_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: 12 }}>{r.name}</span>
                  <span style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>({fmt(r.count)})</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Divider />
        <SubLabel>Key metrics</SubLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 1, background: 'var(--sr-border-subtle)', border: '1px solid var(--sr-border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { label: 'Avg Duration', value: effort.avgDurationMin !== null ? `${fmt(effort.avgDurationMin, 0)} min` : '—' },
            { label: 'Avg Distance', value: effort.avgDistanceMi !== null ? `${fmt(effort.avgDistanceMi, 1)} mi` : '—' },
            { label: 'Spp / Hour', value: effort.sppPerHour !== null ? fmt(effort.sppPerHour, 1) : '—' },
            { label: 'Spp / Mi', value: effort.sppPerMi !== null ? fmt(effort.sppPerMi, 1) : '—' },
          ].map((cell, i) => (
            <div key={i} style={{ background: 'var(--sr-surface-subtle)', padding: '12px 8px', textAlign: 'center' }}>
              <div style={{ fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{cell.value}</div>
              <div style={{ fontSize: 10, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', marginTop: 4 }}>{cell.label}</div>
            </div>
          ))}
        </div>

        {effort.protocolRows.length > 0 && (effort.protocolRows.some(r => r.avgDurationMin !== null) || effort.protocolRows.some(r => r.avgDistanceMi !== null)) && (
          <>
            <Divider />
            <SubLabel>Average by protocol</SubLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {(['Protocol', 'Avg Duration (min)', 'Avg Distance (mi)', 'Count'] as const).map(h => (
                      <th key={h} style={{ textAlign: h === 'Protocol' ? 'left' : 'right', padding: '4px 8px', fontSize: 11, color: 'var(--sr-text-muted)', fontWeight: 600, borderBottom: '1px solid var(--sr-border-subtle)' }}>{h}</th>
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
                  <div style={{ height: 110 }}>
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={effort.observerRows} margin={{ top: 4, right: 4, bottom: 16, left: -20 }}>
                        <XAxis
                          dataKey="n"
                          tick={{ fontSize: 11, fill: 'var(--sr-text-muted)' }}
                          tickLine={false} axisLine={false}
                          tickFormatter={n => n === 5 ? '5+' : String(n)}
                        />
                        <YAxis tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: 12 }}
                          formatter={(v) => [fmt(Number(v)), 'Lists']}
                          labelFormatter={n => n === 5 ? '5+ observers' : `${n} observer${n === 1 ? '' : 's'}`}
                        />
                        <Bar dataKey="count" fill="var(--sr-accent)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    <PieChart width={120} height={120}>
                      <Pie data={effort.observerRows} dataKey="count" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                        {effort.observerRows.map((_, i) => (
                          <Cell key={i} fill={obsPieColors[i % obsPieColors.length]} />
                        ))}
                      </Pie>
                    </PieChart>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                      {effort.observerRows.map((r, i) => {
                        const opct = totalObs > 0 ? Math.round(r.count / totalObs * 100) : 0
                        return (
                          <div key={r.n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                            <div style={{ width: 8, height: 8, borderRadius: '50%', background: obsPieColors[i % obsPieColors.length], flexShrink: 0 }} />
                            <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{r.n === 5 ? '5+' : r.n} obs {opct}%</span>
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

        {effort.completeRatio !== null && (
          <>
            <Divider />
            <p style={{ fontSize: 13, margin: 0 }}>
              <span style={{ fontWeight: 600 }}>{Math.round(effort.completeRatio * 100)}%</span>
              <span style={{ color: 'var(--sr-text-muted)' }}> of checklists reported all species observed (complete checklists)</span>
            </p>
          </>
        )}
      </SectionCard>

      {/* ── Section 6: Data Quality ────────────────────────────────────────── */}
      <SectionCard title="Data Quality" icon={<ShieldCheck size={16} />}>

        {quality.numericRatio !== null && quality.xRatio !== null && (
          <>
            <SubLabel>Count method</SubLabel>
            <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
              <div style={{ width: `${Math.round(quality.numericRatio * 100)}%`, background: 'var(--sr-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {quality.numericRatio > 0.1 && <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{Math.round(quality.numericRatio * 100)}% numeric</span>}
              </div>
              <div style={{ flex: 1, background: 'var(--sr-chart-slate)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {quality.xRatio > 0.1 && <span style={{ fontSize: 12, color: 'var(--sr-text)', fontWeight: 600 }}>{Math.round(quality.xRatio * 100)}% X</span>}
              </div>
            </div>
          </>
        )}

        {quality.commentRatio !== null && (
          <>
            <Divider />
            <SubLabel>Comment coverage</SubLabel>
            <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 6 }}>
              <div style={{ width: `${Math.round(quality.commentRatio * 100)}%`, background: 'var(--sr-graph-photo)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {quality.commentRatio > 0.1 && <span style={{ fontSize: 12, color: '#fff', fontWeight: 600 }}>{Math.round(quality.commentRatio * 100)}% with notes</span>}
              </div>
              <div style={{ flex: 1, background: 'var(--sr-chart-blue-light)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {(1 - quality.commentRatio) > 0.1 && <span style={{ fontSize: 12, color: 'var(--sr-text)', fontWeight: 600 }}>{Math.round((1 - quality.commentRatio) * 100)}% no notes</span>}
              </div>
            </div>
          </>
        )}

        {quality.biggestCounts.length > 0 && (
          <>
            <Divider />
            <SubLabel>Biggest single counts</SubLabel>
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <thead>
                  <tr>
                    {(['Species', 'Count', 'Date', 'Location'] as const).map(h => (
                      <th key={h} style={{
                        textAlign: h === 'Species' ? 'left' : 'right',
                        padding: '4px 8px', fontSize: 11, color: 'var(--sr-text-muted)',
                        fontWeight: 600, borderBottom: '1px solid var(--sr-border-subtle)',
                      }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {quality.biggestCounts.map((entry, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--sr-border-subtle)' }}>
                      <td style={{ padding: '5px 8px', textAlign: 'left' }}>{entry.name}</td>
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
      </SectionCard>

      {/* ── Section 7: Breeding Stats ──────────────────────────────────────── */}
      <SectionCard title="Breeding Stats" icon={<Dna size={16} />}>
        {breedingStats.total === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--sr-text-muted)', margin: 0 }}>
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
                  <span style={{ fontSize: 24, fontWeight: 700, color: tier.color }}>{fmt(tier.value)}</span>
                  <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '4px 0 0' }}>{tier.label} species</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SubLabel>Breeding activity by month</SubLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                {([
                  { key: 'all', label: 'All' },
                  { key: 'confirmed', label: 'Confirmed', color: 'var(--sr-tier-4)' },
                  { key: 'probable', label: 'Probable', color: 'var(--sr-tier-2)' },
                  { key: 'possible', label: 'Possible', color: 'var(--sr-tier-1)' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    onClick={() => setBreedingFilter(f.key)}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 6, fontSize: 11, fontWeight: 500,
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
                            <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 28 }}>{r.label}</span>
                            <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 20, textAlign: 'right' }}>{val || ''}</span>
                          </div>
                        )
                      }
                      const totalPct = maxVal > 0 ? (r.total / maxVal) * 100 : 0
                      const confPct = r.total > 0 ? (r.confirmed / r.total) * totalPct : 0
                      const probPct = r.total > 0 ? (r.probable / r.total) * totalPct : 0
                      const possPct = r.total > 0 ? (r.possible / r.total) * totalPct : 0
                      return (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
                          <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 0, width: 28 }}>{r.label}</span>
                          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ height: '100%', width: `${confPct}%`, background: 'var(--sr-tier-4)', transition: 'width 0.3s' }} />
                            <div style={{ height: '100%', width: `${probPct}%`, background: 'var(--sr-tier-2)', transition: 'width 0.3s' }} />
                            <div style={{ height: '100%', width: `${possPct}%`, background: 'var(--sr-tier-1)', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 20, textAlign: 'right' }}>{r.total || ''}</span>
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
                          <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{d.label}</span>
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

      {/* ── Section 8: Fun Stats ───────────────────────────────────────────── */}
      <SectionCard title="Fun Stats" icon={<Star size={16} />}>

        {/* ML media sections */}
        {mlStats.mostPhotographed.length > 0 && (
          <>
            <SubLabel>Most photographed (ML export)</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {mlStats.mostPhotographed.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <a
                    href={mlCatalogUrl(entry.name, 'Photo', mlUserId, mlTaxonMap[entry.name])}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, flex: 1, color: 'var(--sr-accent)', textDecoration: 'none' }}
                  >
                    {entry.name}
                  </a>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{fmt(entry.count)} photos</span>
                </div>
              ))}
            </div>
          </>
        )}
        {mlStats.mostAudio.length > 0 && (
          <>
            <Divider />
            <SubLabel>Most recorded (audio)</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {mlStats.mostAudio.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <a
                    href={mlCatalogUrl(entry.name, 'Audio', mlUserId, mlTaxonMap[entry.name])}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, flex: 1, color: 'var(--sr-accent)', textDecoration: 'none' }}
                  >
                    {entry.name}
                  </a>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{fmt(entry.count)} recordings</span>
                </div>
              ))}
            </div>
          </>
        )}
        {mlStats.mostVideo.length > 0 && (
          <>
            <Divider />
            <SubLabel>Most filmed (video)</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 16 }}>
              {mlStats.mostVideo.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <a
                    href={mlCatalogUrl(entry.name, 'Video', mlUserId, mlTaxonMap[entry.name])}
                    target="_blank" rel="noreferrer"
                    style={{ fontSize: 13, flex: 1, color: 'var(--sr-accent)', textDecoration: 'none' }}
                  >
                    {entry.name}
                  </a>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{fmt(entry.count)} videos</span>
                </div>
              ))}
            </div>
          </>
        )}
        {rawMlRows.length === 0 && (
          <>
            <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', margin: '0 0 16px' }}>
              Upload an ML export in Settings to see most-photographed species.
            </p>
          </>
        )}

        {/* One-and-done birds */}
        <Divider />
        <SubLabel>One-and-done birds</SubLabel>
        <p style={{ fontSize: 13, color: 'var(--sr-text-muted)', margin: '0 0 8px' }}>
          {fmt(funStats.oneDoneBirds.length)} species seen on exactly one checklist
        </p>
        {funStats.oneDoneBirds.length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {funStats.oneDoneBirds.map(bird => (
              SUBMISSION_ID_RE.test(bird.submissionId) ? (
                <a
                  key={bird.name}
                  href={`https://ebird.org/checklist/${bird.submissionId}`}
                  target="_blank" rel="noreferrer"
                  style={{
                    fontSize: 12, padding: '3px 10px', borderRadius: 100,
                    background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                    color: 'var(--sr-accent)', textDecoration: 'none',
                  }}
                >
                  {bird.name}
                </a>
              ) : (
                <span key={bird.name} style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 100,
                  background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                  color: 'var(--sr-text-muted)',
                }}>
                  {bird.name}
                </span>
              )
            ))}
          </div>
        )}

        {/* Nemesis birds */}
        <Divider />
        <SubLabel>Current Local Nemesis Birds</SubLabel>
        <p style={{ fontSize: 12, color: 'var(--sr-text-muted)', fontStyle: 'italic', margin: '0 0 10px', borderLeft: '3px solid var(--sr-accent-border)', paddingLeft: 10 }}>
          Nemesis birds are species recently reported within your area that don't yet appear on your life list, ranked by how frequently they've been seen.
        </p>
        {!mapDefaults ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
            <AlertCircle size={14} style={{ color: 'var(--sr-text-muted)', flexShrink: 0 }} />
            <p style={{ fontSize: 13, color: 'var(--sr-text-muted)', margin: 0 }}>
              Set a default location in{' '}
              <button onClick={onGoToSettings} style={{ background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--sr-accent)', fontSize: 'inherit', fontFamily: 'inherit', fontWeight: 600 }}>
                Settings
              </button>{' '}
              to see Nemesis Birds nearby.
            </p>
          </div>
        ) : nemesisLoading ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sr-text-muted)', fontSize: 13 }}>
            <Loader2 size={14} className="spin" /> Loading nearby sightings…
          </div>
        ) : nemesisError ? (
          <p style={{ fontSize: 13, color: 'var(--sr-error)', margin: 0 }}>{nemesisError}</p>
        ) : nemesisFiltered !== null && nemesisFiltered.length === 0 ? (
          <p style={{ fontSize: 13, color: 'var(--sr-text-muted)', margin: 0 }}>
            No nemesis birds — you've seen everything reported nearby in the past 30 days.
          </p>
        ) : nemesisFiltered && nemesisFiltered.length > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {nemesisFiltered.map(bird => {
              const daysAgo = Math.round(
                (SESSION_NOW_MS - new Date(bird.recentDate + 'T12:00:00').getTime()) / 86400000
              )
              const dotColor = daysAgo <= 7 ? '#EF4444' : daysAgo <= 14 ? '#F59E0B' : 'var(--sr-text-disabled)'
              return (
                <div key={bird.commonName} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: dotColor, flexShrink: 0 }} />
                  <span style={{ fontSize: 13, flex: 1 }}>{bird.commonName}</span>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>{fmtDate(bird.recentDate)}</span>
                </div>
              )
            })}
          </div>
        ) : null}
      </SectionCard>
    </div>
  )
}
