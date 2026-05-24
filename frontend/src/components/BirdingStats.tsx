import { useEffect, useMemo, useState } from 'react'
import {
  BarChart2, Trophy, Clock, MapPin, ShieldCheck, Dna, Star,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Calendar,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
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

type Granularity = 'weekly' | 'monthly' | 'yearly'

function getPeriodKey(date: string, granularity: Granularity): string {
  if (granularity === 'yearly') return date.substring(0, 4)
  if (granularity === 'monthly') return date.substring(0, 7)
  const d = new Date(date + 'T12:00:00')
  const start = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil((Math.floor((d.getTime() - start.getTime()) / 86400000) + 1) / 7)
  return `${d.getFullYear()}-W${String(week).padStart(2, '0')}`
}

function formatPeriodLabel(key: string, granularity: Granularity): string {
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

function BarRow({ label, value, max, color = 'var(--sr-accent)', labelWidth = 44 }: {
  label: string; value: number; max: number; color?: string; labelWidth?: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
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
      <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', flexShrink: 0, width: 40, textAlign: 'right' }}>
        {fmt(value)}
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
  const [accGranularity, setAccGranularity] = useState<Granularity>('yearly')
  const [showAllOneDone, setShowAllOneDone] = useState(false)
  const [showAllCounties, setShowAllCounties] = useState(false)
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
    const milestoneMap = new Map<number, string>()
    const byPeriod = new Map<string, number>()
    let firstSpecies: { date: string; name: string } | null = null
    const thresholds = Array.from({ length: 20 }, (_, i) => (i + 1) * 50)

    for (const o of sorted) {
      const norm = normalizeSpeciesName(o.commonName)
      if (!seen.has(norm)) {
        seen.add(norm)
        const count = seen.size
        if (!firstSpecies) firstSpecies = { date: o.date, name: norm }
        for (const t of thresholds) {
          if (count === t && !milestoneMap.has(t)) milestoneMap.set(t, o.date)
        }
        byPeriod.set(getPeriodKey(o.date, accGranularity), count)
      }
    }

    const chartData = [...byPeriod.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([period, species]) => ({ period, species }))

    return { chartData, milestones: milestoneMap, firstSpecies }
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
    const stateMap = new Map<string, number>()

    for (const c of checklists) {
      if (!locationMap.has(c.locationId)) {
        locationMap.set(c.locationId, { name: c.location, count: 0, species: new Set() })
      }
      locationMap.get(c.locationId)!.count++

      if (c.county) countyMap.set(c.county, (countyMap.get(c.county) ?? 0) + 1)
      if (c.stateProvince) stateMap.set(c.stateProvince, (stateMap.get(c.stateProvince) ?? 0) + 1)
    }

    for (const o of filteredObs) {
      const norm = normalizeSpeciesName(o.commonName)
      locationMap.get(o.locationId)?.species.add(norm)
    }

    const topLocations = [...locationMap.values()]
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)
      .map(l => ({ name: l.name, checklists: l.count, species: l.species.size }))

    const topCounties = [...countyMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }))

    const topStates = [...stateMap.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }))

    return { topLocations, topCounties, topStates }
  }, [checklists, filteredObs])

  // Effort stats
  const effort = useMemo(() => {
    const protocols = new Map<string, number>()
    let totalDurationMin = 0, durationCount = 0
    let totalDistanceKm = 0, distanceCount = 0
    const observerDist = new Map<number, number>()
    let completeCount = 0, allObsCount = 0

    for (const c of checklists) {
      if (c.protocol) protocols.set(c.protocol, (protocols.get(c.protocol) ?? 0) + 1)
      if (c.duration !== null) { totalDurationMin += c.duration; durationCount++ }
      if (c.distance !== null) { totalDistanceKm += c.distance; distanceCount++ }
      if (c.numObservers !== null) {
        observerDist.set(c.numObservers, (observerDist.get(c.numObservers) ?? 0) + 1)
      }
      if (c.allObsReported !== null) {
        allObsCount++
        if (c.allObsReported) completeCount++
      }
    }

    const total = checklists.length
    const protocolRows = [...protocols.entries()]
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count, pct: total > 0 ? Math.round(count / total * 100) : 0 }))

    const observerRows = [...observerDist.entries()]
      .sort(([a], [b]) => a - b)
      .map(([n, count]) => ({ n, count }))

    return {
      protocolRows,
      observerRows,
      totalHours: durationCount > 0 ? totalDurationMin / 60 : null,
      avgDurationMin: durationCount > 0 ? totalDurationMin / durationCount : null,
      totalDistanceKm: distanceCount > 0 ? totalDistanceKm : null,
      avgDistanceKm: distanceCount > 0 ? totalDistanceKm / distanceCount : null,
      completeRatio: allObsCount > 0 ? completeCount / allObsCount : null,
    }
  }, [checklists])

  // Data quality
  const quality = useMemo(() => {
    let numericCount = 0, xCount = 0
    const speciesMaxCounts = new Map<string, { count: number; submissionId: string }>()

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
      .slice(0, 5)
      .map(([name, { count, submissionId }]) => ({ name, count, submissionId }))

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
    const codesBySp = new Map<string, number>() // sp → highest tier
    const byMonth = new Map<number, Set<string>>()

    for (const o of filteredObs) {
      if (!o.breedingCode) continue
      const norm = normalizeSpeciesName(o.commonName)
      const def = BREEDING_CODE_MAP.get(o.breedingCode)
      const tier = def?.tier ?? 0
      codesBySp.set(norm, Math.max(codesBySp.get(norm) ?? 0, tier))

      const month = parseInt(o.date.substring(5, 7), 10) - 1
      if (!byMonth.has(month)) byMonth.set(month, new Set())
      byMonth.get(month)!.add(norm)
    }

    let confirmed = 0, probable = 0, possible = 0
    for (const tier of codesBySp.values()) {
      if (tier >= 4) confirmed++
      else if (tier >= 2) probable++
      else if (tier >= 1) possible++
    }

    const byMonthRows = Array.from({ length: 12 }, (_, i) => ({
      label: MONTH_LABELS[i],
      value: byMonth.get(i)?.size ?? 0,
    }))

    return { confirmed, probable, possible, total: confirmed + probable + possible, byMonthRows }
  }, [filteredObs])

  // ML stats (most photographed / audio / video)
  const mlStats = useMemo(() => {
    const photoCounts = new Map<string, number>()
    const audioCounts = new Map<string, number>()
    const videoCounts = new Map<string, number>()
    for (const row of rawMlRows) {
      if (row.format === 'Photo') photoCounts.set(row.commonName, (photoCounts.get(row.commonName) ?? 0) + 1)
      else if (row.format === 'Audio') audioCounts.set(row.commonName, (audioCounts.get(row.commonName) ?? 0) + 1)
      else if (row.format === 'Video') videoCounts.set(row.commonName, (videoCounts.get(row.commonName) ?? 0) + 1)
    }
    const topN = (m: Map<string, number>) => [...m.entries()]
      .sort(([, a], [, b]) => b - a).slice(0, 10).map(([name, count]) => ({ name, count }))
    return {
      mostPhotographed: topN(photoCounts),
      mostAudio: topN(audioCounts),
      mostVideo: topN(videoCounts),
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
      .map(([name]) => name)
      .sort()

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
    const busiestDay = [...spByDate.entries()].sort(([, a], [, b]) => b.size - a.size)[0]

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
      busiestDay: busiestDay ? { date: busiestDay[0], species: busiestDay[1].size } : null,
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
            <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap' }}>
              <div>
                <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>First observation</span>
                <p style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>{fmtDate(totals.firstDate)}</p>
              </div>
              <div>
                <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>Most recent</span>
                <p style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>{fmtDate(totals.lastDate!)}</p>
              </div>
              {accumulation.firstSpecies && (
                <div>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)' }}>First species ever</span>
                  <p style={{ fontSize: 14, fontWeight: 600, margin: '2px 0 0' }}>{accumulation.firstSpecies.name}</p>
                  <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '1px 0 0' }}>{fmtDate(accumulation.firstSpecies.date)}</p>
                </div>
              )}
            </div>
          </>
        )}

        {accumulation.chartData.length > 1 && (
          <>
            <Divider />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
              <SubLabel>Life list accumulation</SubLabel>
              <div style={{ display: 'flex', gap: 4 }}>
                {(['yearly', 'monthly', 'weekly'] as const).map(g => (
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
                    tickLine={false}
                    axisLine={false}
                    interval="preserveStartEnd"
                    tickFormatter={key => formatPeriodLabel(key, accGranularity)}
                  />
                  <YAxis tick={{ fontSize: 10, fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: 12 }}
                    formatter={(v) => [typeof v === 'number' ? fmt(v) : String(v ?? ''), 'Species']}
                    labelFormatter={key => formatPeriodLabel(String(key), accGranularity)}
                  />
                  <Area type="monotone" dataKey="species" stroke="var(--sr-accent)" fill="url(#statsAccGrad)" strokeWidth={2} dot={false} />
                </AreaChart>
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
                const date = accumulation.milestones.get(threshold)
                if (!date) return null
                return (
                  <div key={threshold} style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '6px 12px', borderRadius: 8,
                    background: 'var(--sr-accent-bg)', border: '1px solid var(--sr-accent-border)',
                  }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--sr-accent)' }}>{threshold}</span>
                    <span style={{ fontSize: 12, color: 'var(--sr-text-muted)' }}>{fmtDate(date)}</span>
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
              <p style={{ fontSize: 18, fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-accent)' }}>
                {fmt(funStats.busiestDay.species)} species
              </p>
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

        <SubLabel>Checklists by month</SubLabel>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
          {temporal.monthRows.map(r => (
            <BarRow key={r.label} label={r.label} value={r.checklists} max={maxMonthChecklists} labelWidth={28} />
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 32 }}>
          <div>
            <SubLabel>By day of week</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {temporal.dowRows.map(r => (
                <BarRow key={r.label} label={r.label} value={r.value} max={maxDow} labelWidth={28} color="#3B82F6" />
              ))}
            </div>
          </div>
          <div>
            <SubLabel>By hour of day</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {temporal.hourRows.filter(r => r.value > 0).map(r => (
                <BarRow key={r.label} label={r.label} value={r.value} max={maxHour} labelWidth={28} color="#3B82F6" />
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
            <SubLabel>Top locations</SubLabel>
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

        {geo.topCounties.length > 0 && (
          <>
            <Divider />
            <SubLabel>Counties / regions</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {(showAllCounties ? geo.topCounties : geo.topCounties.slice(0, 8)).map((c, i) => (
                <BarRow key={i} label={c.name} value={c.count}
                  max={geo.topCounties[0]?.count ?? 1} labelWidth={120} />
              ))}
            </div>
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

      </SectionCard>

      {/* ── Section 5: Effort & Methodology ───────────────────────────────── */}
      <SectionCard title="Effort & Methodology" icon={<Clock size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(140px, 1fr))', gap: 0 }}>
          {[
            effort.totalHours !== null ? { label: 'Total hours', value: fmt(effort.totalHours, 1) } : null,
            effort.avgDurationMin !== null ? { label: 'Avg duration', value: `${fmt(effort.avgDurationMin, 0)} min` } : null,
            effort.totalDistanceKm !== null ? { label: 'Total distance', value: `${fmt(effort.totalDistanceKm * 0.621371, 0)} mi` } : null,
            effort.avgDistanceKm !== null ? { label: 'Avg distance', value: `${fmt(effort.avgDistanceKm * 0.621371, 1)} mi` } : null,
            effort.completeRatio !== null ? { label: 'Complete lists', value: `${Math.round(effort.completeRatio * 100)}%` } : null,
          ].filter(Boolean).map((stat, i) => (
            <div key={i} style={{ borderRight: '1px solid var(--sr-border-subtle)', borderBottom: '1px solid var(--sr-border-subtle)' }}>
              <StatCell label={stat!.label} value={stat!.value} large={false} />
            </div>
          ))}
        </div>

        {effort.protocolRows.length > 0 && (
          <>
            <Divider />
            <SubLabel>Protocol breakdown</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {effort.protocolRows.map(r => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ fontSize: 12, flex: 1 }}>{r.name}</span>
                  <div style={{ width: 120, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${r.pct}%`, background: 'var(--sr-accent)', borderRadius: 4 }} />
                  </div>
                  <span style={{ fontSize: 11, color: 'var(--sr-text-muted)', width: 48, textAlign: 'right' }}>
                    {r.pct}% ({fmt(r.count)})
                  </span>
                </div>
              ))}
            </div>
          </>
        )}

        {effort.observerRows.length > 0 && (
          <>
            <Divider />
            <SubLabel>Lists by observer count</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {effort.observerRows.map(r => (
                <BarRow
                  key={r.n}
                  label={r.n === 1 ? 'Solo' : `${r.n}`}
                  value={r.count}
                  max={effort.observerRows[0]?.count ?? 1}
                  labelWidth={36}
                />
              ))}
            </div>
          </>
        )}
      </SectionCard>

      {/* ── Section 6: Data Quality ────────────────────────────────────────── */}
      <SectionCard title="Data Quality" icon={<ShieldCheck size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 16 }}>
          {quality.numericRatio !== null && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Numeric counts</p>
              <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{Math.round(quality.numericRatio * 100)}%</p>
            </div>
          )}
          {quality.xRatio !== null && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Presence-only (X)</p>
              <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{Math.round(quality.xRatio * 100)}%</p>
            </div>
          )}
          {quality.commentRatio !== null && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: 11, color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Lists with notes</p>
              <p style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>{Math.round(quality.commentRatio * 100)}%</p>
            </div>
          )}
        </div>

        {quality.biggestCounts.length > 0 && (
          <>
            <Divider />
            <SubLabel>Biggest single counts</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {quality.biggestCounts.map((entry, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '2px 0' }}>
                  <span style={{ fontSize: 13, flex: 1 }}>{entry.name}</span>
                  <a
                    href={`https://ebird.org/checklist/${entry.submissionId}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ fontSize: 13, fontWeight: 600, color: 'var(--sr-accent)', textDecoration: 'none' }}
                  >
                    {fmt(entry.count)}
                  </a>
                </div>
              ))}
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

            <SubLabel>Breeding activity by month</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {breedingStats.byMonthRows.map(r => (
                <BarRow key={r.label} label={r.label}
                  value={r.value}
                  max={Math.max(...breedingStats.byMonthRows.map(x => x.value), 1)}
                  labelWidth={28}
                  color="var(--sr-tier-4)"
                />
              ))}
            </div>
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
                  <span style={{ fontSize: 13, flex: 1 }}>{entry.name}</span>
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
                  <span style={{ fontSize: 13, flex: 1 }}>{entry.name}</span>
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
                  <span style={{ fontSize: 13, flex: 1 }}>{entry.name}</span>
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
          <>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
              {(showAllOneDone ? funStats.oneDoneBirds : funStats.oneDoneBirds.slice(0, 20)).map(name => (
                <span key={name} style={{
                  fontSize: 12, padding: '3px 10px', borderRadius: 100,
                  background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)',
                  color: 'var(--sr-text-muted)',
                }}>
                  {name}
                </span>
              ))}
            </div>
            {funStats.oneDoneBirds.length > 20 && (
              <button
                onClick={() => setShowAllOneDone(v => !v)}
                style={{
                  display: 'flex', alignItems: 'center', gap: 4,
                  background: 'none', border: 'none', cursor: 'pointer',
                  fontSize: 12, color: 'var(--sr-accent)', padding: 0, fontFamily: 'inherit',
                }}
              >
                {showAllOneDone
                  ? <><ChevronUp size={12} /> Show fewer</>
                  : <><ChevronDown size={12} /> Show all {fmt(funStats.oneDoneBirds.length)}</>}
              </button>
            )}
          </>
        )}

        {/* Nemesis birds */}
        <Divider />
        <SubLabel>Current Local Nemesis Birds</SubLabel>
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
