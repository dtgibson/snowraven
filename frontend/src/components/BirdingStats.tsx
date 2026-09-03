import { useCallback, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react'
import {
  BarChart2, Trophy, Clock, MapPin, ShieldCheck, Dna,
  AlertCircle, Loader2, ChevronDown, ChevronUp, Calendar, Video,
  ListOrdered, Award, Sparkles, ClipboardList,
} from 'lucide-react'
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, BarChart, Bar, LineChart, Line, Legend,
} from 'recharts'
import { Marker, Popup } from 'react-map-gl/maplibre'
import { SnowMap } from './SnowMap'
import { MapCornerControls } from './map/MapCornerControls'
import { useMapFullscreen, MapFullscreenProvider } from '../lib/useMapFullscreen'
// STATIC imports, deliberately (FR-21): entryChunk.test.ts's walker follows
// STATIC edges only, so its guard-the-guard ("this host's subtree reaches
// CountyLayer") is satisfiable only this way. Safe because this component is
// already off App.tsx's static closure — it mounts SnowMap. The GEOMETRY stays
// lazy: `loadCountyGeometry` is reached by `await import()` in the toggle
// handler below.
import { CountyLayer } from './map/CountyLayer'
import { BasemapDesaturation } from './map/BasemapDesaturation'
import { CountyShadingPanel } from './map/CountyShadingPanel'
import { ToggleSwitch } from './ui/ToggleSwitch'
import {
  buildCountyAggregates, computeCountyTiers, nonZeroMetricValues, COUNTY_CLASS_COUNT,
  type CountyMetric,
} from '../lib/countyShading'
import { SHADED_PIN_OPACITY, STATS_SHADING_HINT, STATS_EMPTY_NOTE } from '../lib/countyShadingUi'
import type { CountyFC } from '../lib/countyBoundaries'
import { ChartViewTip } from './ChartViewTip'
import { buildMediaGraphData } from '../lib/sightingsGraph'
import type { MediaGraphInterval } from '../lib/sightingsGraph'
import { jumpTo } from '../lib/scroll'
import { loadEbirdObservations } from '../lib/observationsCache'
import { loadMLExport } from '../lib/mlExportCache'
import { useFilesEpoch } from '../lib/useFilesEpoch'
import { useKeysEpoch } from '../lib/useKeysEpoch'
import type { MLExportRow } from '../lib/parseMLExport'
import { normalizeSpeciesName, isNonCountableForm } from '../lib/speciesUtils'
import { COUNT_FORMS_TOGGLE_LABEL } from '../lib/countabilityCopy'
import { regionName } from '../lib/regionNames'
import { BirdName } from './BirdName'
import {
  filterObservations, computeChecklists, computeLifeList, computeTopSpecies, computeTotals,
  computeAccumulation, computeTemporal, computeDurationBins, computeGeo, computeEffort, computeQuality,
  computeBreedingStats, computeMlStats, computeFunStats, countableLifeList,
  formatPeriodLabel, MILESTONE_THRESHOLDS, KM_TO_MI, HA_TO_ACRE,
} from '../lib/birdingStats'
import { buildCoverIndex, EMPTY_LOOKUP } from '../lib/exoticProvenance'
import { useExoticProvenance } from '../lib/useExoticProvenance'
import { ExoticProvenanceAccount } from './ExoticProvenanceAccount'
import { ProjectsSection } from './ProjectsSection'
import { useChecklistProjects } from '../lib/useChecklistProjects'
import { ESCAPEE_TOGGLE_LABEL } from '../lib/exoticCopy'
import { useOnline } from '../lib/useOnline'
import type { Granularity, PeriodGranularity } from '../lib/birdingStats'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS, EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { formatDate as fmtDate } from '../lib/formatDate'
import type { ObservationEntry, ChecklistEntry } from '../types'
import { transport } from '../lib/transport'
import { storage } from '../lib/storage'
import { fmt, fmtSharePct, sectionSlug, formatDuration, mlCatalogUrl } from '../lib/statsFormat'
import { fitToPins } from '../lib/fitBounds'
import { SectionCard, StatCell, BarRow, Divider, SubLabel, RankIcon } from './statsPrimitives'
import { computeMediaStats } from '../lib/mediaStats'
import { MediaStatsSections } from './MediaStatsSections'
import { FrivolousListsSections } from './FrivolousListsSections'
import { AVIAN_AMERICAN, CALIFORNIA_DREAMER, PHOEBE_PHANATIC, SCRUB_JAY_ALL_DAY, CROW_RAVEN, HERON_IS_CARIN, BEST_OF_THE_CREST } from '../lib/frivolousLists'
import { ChecklistLink } from './ChecklistLink'
import { OutboundLink } from './OutboundLink'
import { HotspotLink } from './HotspotLink'
import { useHotspotSet } from '../lib/useHotspotSet'

// ── Types ─────────────────────────────────────────────────────────────────────

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mlRows: MLExportRow[]; freshness: string }

// ── Constants ─────────────────────────────────────────────────────────────────

const EMPTY_OBS: ObservationEntry[] = []
const EMPTY_ML: MLExportRow[] = []
const ML_USER_RE = /^ML__.*_([A-Za-z0-9]+)\.csv$/i

const PROTOCOL_COLORS = [
  'var(--sr-accent)',
  'var(--sr-graph-photo)',
  'var(--sr-graph-video)',
  'var(--sr-graph-audio)',
  'var(--sr-chart-slate)',
]

// Always-present sections, in render order (through Breeding Stats). The
// trailing "Media" section (only when an ML export is loaded) is appended at
// render time so the jump-nav never shows a chip for a section that isn't on
// the page.
const NAV_SECTIONS = [
  'Life List Totals', 'Top Species', 'Firsts & Milestones', 'Temporal Stats',
  'Geographic Stats', 'Effort & Outings', 'Projects', 'Data Quality',
  'Highlights & Records', 'Breeding Stats',
]

/**
 * Dims a rank pin beneath an active county fill so the tier colors read on top
 * (FR-05). With shading OFF it renders NOTHING of its own — not a wrapper with
 * `opacity: 1`, which would be new DOM on a surface FR-19 requires to be
 * identical to the pre-change build. The wrapper exists only while it is doing
 * something.
 */
function DimmablePin({ dim, children }: { dim: boolean; children: React.ReactNode }) {
  if (!dim) return <>{children}</>
  return (
    <span style={{
      display: 'block', opacity: SHADED_PIN_OPACITY,
      transition: 'opacity 200ms cubic-bezier(0.16, 1, 0.3, 1)',
    }}>
      {children}
    </span>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export function BirdingStats({ onGoToSettings, onOpenSpecies }: { onGoToSettings: () => void; onOpenSpecies?: (commonName: string) => void }) {
  const [phase, setPhase]           = useState<Phase>({ tag: 'loading-saved' })
  const [includeSpuh, setIncludeSpuh] = useState(false)
  // Session-only, matching its neighbour: no storage seam, resetting on relaunch.
  // A tab stays mounted once opened, so it survives leaving and returning to
  // Statistics and resets only on relaunch (the settled phrasing).
  const [includeEscapees, setIncludeEscapees] = useState(false)
  const [hasEbirdKey, setHasEbirdKey] = useState<boolean | null>(null)
  const [accGranularity, setAccGranularity] = useState<Granularity>('total')
  const [showAllCounties, setShowAllCounties] = useState(false)
  const [breedingFilter, setBreedingFilter] = useState<'all' | 'confirmed' | 'probable' | 'possible'>('all')
  const [mlUserId, setMlUserId] = useState<string | null>(null)
  const [mlTaxonMap, setMlTaxonMap] = useState<Record<string, string>>({})
  const [mlTaxonOrders, setMlTaxonOrders] = useState<Record<string, number>>({})
  const [geoPopup, setGeoPopup] = useState<{ lng: number; lat: number; title: string; sub: string } | null>(null)
  // Geographic Stats county shading (FR-13): both off/default on mount and
  // session-scoped (plain useState, no storage seam). A tab stays mounted once
  // opened, so they survive leaving and returning to Statistics and reset only
  // on relaunch. NO Completeness option: this surface offers exactly two
  // metrics and reaches no completeness controller (FR-16).
  const [countiesOn, setCountiesOn] = useState(false)
  const [countyMetric, setCountyMetric] = useState<CountyMetric>('species')
  const [countyUseTextures, setCountyUseTextures] = useState(false)
  const [countyData, setCountyData] = useState<CountyFC | null>(null)
  const [countyLoading, setCountyLoading] = useState(false)
  const { isHotspot } = useHotspotSet()
  const [mediaInterval, setMediaInterval] = useState<MediaGraphInterval>('monthly')
  const [mediaViewMode, setMediaViewMode] = useState<'per-period' | 'cumulative'>('per-period')
  // Progressive-render gates (perf): `computed` flips on after first paint so the
  // ~15 O(observations) memos + the geographic map don't block the tab's first
  // frame; `mapReady` defers the MapLibre mount until the browser is idle.
  const [computed, setComputed] = useState(false)
  const [mapReady, setMapReady] = useState(false)

  // Auto-load eBird backup + ML export on mount, and again whenever a data
  // file changes (see the deps comment below).
  const filesEpoch = useFilesEpoch()
  useEffect(() => {
    let cancelled = false
    async function load() {
      try {
        const status = await storage.getFilesStatus()

        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }

        const [ebird, ml] = await Promise.all([
          loadEbirdObservations(),
          // .catch: defense in depth, and deliberately kept. Since v1.0.15 the read
          // sits INSIDE loadMLExport's own try, so it resolves null on a read or a
          // parse failure and this guard has nothing left to catch. It stays because
          // the cost of being wrong is asymmetric: a rejection here rejects the whole
          // Promise.all into the outer catch, which claims there is no eBird backup
          // while one is plainly loaded — over a shared seam four tabs read through.
          status.ml ? loadMLExport().catch(() => null) : Promise.resolve(null),
        ])

        if (cancelled) return   // a cancelled run writes no state at all
        if (!ebird) {
          setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR })
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
        // Each raw name AND its normalized parent go into the batch. The
        // codes lookup is species-only on both transports, so a bird recorded
        // ONLY as a form ("Swan Goose (Domestic type)") never resolves by its
        // raw name — and a species that resolves nowhere is invisible to the
        // escapee cover (it classified 'unknown' and silently counted; the
        // v1.0.1 zero-escapees fix) and shows no favicons. The parent name
        // resolves via the species map, and normTaxon below hands its code to
        // every normalized-name consumer.
        for (const o of observations) {
          if (!seenNames.has(o.commonName)) seenNames.set(o.commonName, o.scientificName)
          const parent = normalizeSpeciesName(o.commonName)
          if (parent !== o.commonName && !seenNames.has(parent)) seenNames.set(parent, '')
        }
        for (const r of mlRows) {
          if (!seenNames.has(r.commonName)) seenNames.set(r.commonName, r.scientificName)
          const parent = normalizeSpeciesName(r.commonName)
          if (parent !== r.commonName && !seenNames.has(parent)) seenNames.set(parent, '')
        }
        // Frivolous Lists shows its hardcoded birds whether or not the user has
        // recorded them; resolve their codes too so the eBird / Birds of the World
        // favicons render on the not-yet-seen rows (matched by common name — robust to
        // recent eBird splits like American Goshawk). Grouped lists are flattened.
        for (const name of [
          ...AVIAN_AMERICAN, ...CALIFORNIA_DREAMER,
          ...PHOEBE_PHANATIC, ...SCRUB_JAY_ALL_DAY, ...CROW_RAVEN,
          ...HERON_IS_CARIN.flatMap(g => g.species),
          ...BEST_OF_THE_CREST.flatMap(g => g.species),
        ]) {
          if (!seenNames.has(name)) seenNames.set(name, '')
        }
        if (seenNames.size > 0) {
          const species = [...seenNames.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
          try {
            const data = await transport.post<{ codes: Record<string, string>; orders: Record<string, number> }>('/taxonomy/codes', { species })
            if (!cancelled) { setMlTaxonMap(data.codes); setMlTaxonOrders(data.orders ?? {}) }
          } catch { /* taxonomy unavailable — ML links omit the taxon filter, favicons omitted */ }
        }

        setPhase({ tag: 'ready', observations, mlRows, freshness: status.ebird.filename })
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    load()
    return () => { cancelled = true }
    // filesEpoch: a new or cleared data file (a Settings upload or an iCloud
    // arrival) re-runs the load, so the tab reflects it without a relaunch
    // (icloud-sync FR-35). It was mount-only before.
  }, [filesEpoch])

  // Is an eBird key configured? One of the three auto-start conditions for the
  // exotic-provenance pass (the other two are online and a non-fresh cache).
  // Re-read on every key epoch (a Settings save, or a synced key applied or
  // cleared by the iCloud controller), so the missing-key behaviour tracks the
  // key without a relaunch (icloud-api-key-sync FR-24). It was mount-only before.
  const keysEpoch = useKeysEpoch()
  useEffect(() => {
    void keysEpoch
    let cancelled = false
    storage.getApiKey('ebird')
      .then(k => { if (!cancelled) setHasEbirdKey(!!k) })
      .catch(() => { if (!cancelled) setHasEbirdKey(false) })
    return () => { cancelled = true }
  }, [keysEpoch])

  const online = useOnline()

  // Raw data — stable refs so useMemos don't thrash when phase tag changes
  const rawObs = phase.tag === 'ready' ? phase.observations : EMPTY_OBS
  const rawMlRows = phase.tag === 'ready' ? phase.mlRows : EMPTY_ML
  const freshness = phase.tag === 'ready' ? phase.freshness : ''

  // ── Progressive render (perf) ─────────────────────────────────────────────
  // Once the data is ready, let the browser paint the shell (header + jump-nav +
  // a "computing" indicator) BEFORE the ~15 O(observations) memos run. A double
  // requestAnimationFrame guarantees a real frame lands first: the first rAF
  // fires before that paint, the second after it, so flipping `computed` in the
  // second callback schedules the heavy work for the frame AFTER the shell is on
  // screen. `rawObs` is in the deps so a Settings re-upload (fresh cache array)
  // resets back to the shell and re-schedules.
  useEffect(() => {
    // Deliberate synchronous reset: when the data identity changes (phase leaves
    // 'ready', or a Settings re-upload swaps in a fresh `rawObs` array) we WANT to
    // drop straight back to the shell and re-run the two-pass render, so the
    // cascading re-render is intentional, not a bug.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (phase.tag !== 'ready') { setComputed(false); return }
    setComputed(false)
    let raf2 = 0
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => setComputed(true))
    })
    return () => { cancelAnimationFrame(raf1); cancelAnimationFrame(raf2) }
  }, [phase.tag, rawObs])

  // Defer the geographic map's MapLibre mount until the browser is idle, so the
  // heavy stats math gets to paint first. Resets when the observations identity
  // changes (file re-upload). requestIdleCallback isn't universal (absent in
  // WKWebView / older Safari), so feature-detect with a setTimeout fallback.
  useEffect(() => {
    // Deliberate synchronous reset (see the `computed` effect above): unmount the
    // map back to its placeholder whenever the heavy phase resets.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!computed) { setMapReady(false); return }
    const w = window as unknown as {
      requestIdleCallback?: (cb: () => void) => number
      cancelIdleCallback?: (handle: number) => void
    }
    if (typeof w.requestIdleCallback === 'function') {
      const handle = w.requestIdleCallback(() => setMapReady(true))
      return () => { w.cancelIdleCallback?.(handle) }
    }
    const t = setTimeout(() => setMapReady(true), 200)
    return () => clearTimeout(t)
  }, [computed, rawObs])

  // Root-input gating: during the shell pass (`!computed`) the whole memo cascade
  // is fed STABLE EMPTY arrays so every downstream memo runs trivially fast on
  // identical refs; when `computed` flips, the real arrays flow in and the tree
  // recomputes exactly once. The memo bodies are untouched.
  const effectiveObs = computed ? rawObs : EMPTY_OBS
  const effectiveMl = computed ? rawMlRows : EMPTY_ML

  // useDeferredValue on the two recompute-triggering controls: the control state
  // stays snappy (checkbox/button highlight) while the deferred value drives the
  // heavy memo so React can interrupt the recompute. The chart branch + tick
  // formatters MUST read the deferred granularity (the value the memo consumed)
  // to avoid a one-frame data/branch mismatch.
  const deferredIncludeSpuh = useDeferredValue(includeSpuh)
  const deferredAccGranularity = useDeferredValue(accGranularity)

  // Normalized common names the user has recorded — i.e. species that HAVE a
  // Species Detail entry. Drives whether a BirdName links (vs. plain + favicons).
  const backboneNames = useMemo(
    () => new Set(effectiveObs.map(o => normalizeSpeciesName(o.commonName))),
    [effectiveObs],
  )
  // The same set with the forms eBird does not count already dropped. The form
  // rule has to run on the RAW name, BEFORE normalization, because that is the
  // only place the form survives: "Brewster's Warbler (hybrid)" normalizes to
  // "Brewster's Warbler", which reads exactly like a species. Media
  // documentation coverage is the consumer; it must not disagree with the
  // Species tile about what a species is, on the same tab.
  //
  // Deliberately NOT derived from `filteredObs`: coverage applies the countable
  // rule unconditionally, independent of the "Count all forms" toggle, exactly
  // as it already ignores it for escapees (FR-30, FR-34). Depending only on
  // `effectiveObs` is what keeps the toggle out of this memo.
  const countableBackboneNames = useMemo(() => {
    const names = new Set<string>()
    for (const o of effectiveObs) {
      if (isNonCountableForm(o.commonName)) continue
      names.add(normalizeSpeciesName(o.commonName))
    }
    return names
  }, [effectiveObs])
  const hasEntryFor = (name: string) => backboneNames.has(normalizeSpeciesName(name))
  // Normalized taxon-code lookup so the (normalized) names in Stats lists resolve
  // to a code even when the resolved map is keyed by the original (subspecies) name.
  const normTaxon = useMemo(() => {
    const m: Record<string, string> = {}
    for (const [name, code] of Object.entries(mlTaxonMap)) m[normalizeSpeciesName(name)] = code
    return m
  }, [mlTaxonMap])
  const codeFor = (name: string) => mlTaxonMap[name] ?? normTaxon[normalizeSpeciesName(name)]
  // Taxonomic order for media species (for the Age coverage by species sort).
  const normTaxonOrder = useMemo(() => {
    const m: Record<string, number> = {}
    for (const [name, ord] of Object.entries(mlTaxonOrders)) m[normalizeSpeciesName(name)] = ord
    return m
  }, [mlTaxonOrders])
  const orderFor = (name: string) => mlTaxonOrders[name] ?? normTaxonOrder[normalizeSpeciesName(name)] ?? Infinity

  // ── Exotic provenance (escapee-count-toggle) ───────────────────────────────
  // The cover index is built from the RAW observations, never `filteredObs`, so
  // neither count-rule toggle is a memo input to it (NFR-02). Names are mapped
  // to codes ONCE, in one direction, through the batch this tab already fetches
  // for favicons and taxonomic sort; there is no code -> name -> code round trip
  // anywhere in this feature (FR-07).
  const coverIndex = useMemo(
    () => buildCoverIndex(effectiveObs, norm => normTaxon[norm]),
    [effectiveObs, normTaxon],
  )
  // Statistics is the ONLY surface allowed to initiate a provenance request
  // (FR-17). Every other surface reads the cached result through
  // `useProvenanceLookup`, which cannot reach a network module at all.
  const provenance = useExoticProvenance({ active: computed, index: coverIndex, hasEbirdKey, online })
  // Both counts are precomputed in one pass and SELECTED AT READ, so toggling
  // "Count escapees" never invalidates a memo (NFR-02, QA-52).
  const excludedNames = provenance.lookup.excludedNames
  const appliedExcluded = includeEscapees ? EMPTY_LOOKUP.excludedNames : excludedNames

  // Lazy-load the boundary geometry on FIRST enable, through the shared module
  // loader (FR-01/FR-21): if Species Detail already enabled Counties this
  // session, nothing is imported or parsed a second time. Zero network, no API
  // key: the shading is computed entirely from the loaded export (FR-20).
  const handleToggleCounties = useCallback(async () => {
    const next = !countiesOn
    setCountiesOn(next)
    if (!next || countyData || countyLoading) return
    setCountyLoading(true)
    try {
      const { loadCountyGeometry } = await import('../lib/countyGeometry')
      setCountyData(await loadCountyGeometry())
    } catch {
      // Asset failed to load — leave data null; the overlay simply won't draw.
    } finally {
      setCountyLoading(false)
    }
  }, [countiesOn, countyData, countyLoading])

  // ── useMemos (all declared before any conditional return) ─────────────────

  const filteredObs = useMemo(() => filterObservations(effectiveObs, deferredIncludeSpuh), [effectiveObs, deferredIncludeSpuh])

  const checklists = useMemo(() => computeChecklists(filteredObs), [filteredObs])

  // The projects sweep's checklist set — deliberately NOT the `checklists` memo
  // above, and this is a correctness fix rather than a preference.
  //
  // `checklists` is derived from `filteredObs`, so it carries the "Count all
  // forms" DISPLAY toggle. Two things followed from that, both wrong. The
  // section's denominator moved with a taxonomy checkbox: on the reference
  // export `S290076558`'s only row is a `hawk sp.`, so the "exact number of
  // requests" FR-49 requires the never-run state to name read 3,251 with the
  // toggle off and 3,252 with it on — for a figure that is a count of
  // CHECKLISTS, about which the toggle has nothing to say. And because the
  // identity changed with the toggle, flipping it mid-sweep tripped FR-46's
  // export-swap cancellation and silently killed a running eight-minute pass.
  //
  // A checklist is a checklist whichever taxa you have chosen to display, so
  // this depends on `effectiveObs` alone — the same reasoning, and the same
  // shape, as `countableBackboneNames` above. A genuinely different export
  // still changes this identity and still cancels the pass, which is what
  // FR-46 actually asks for.
  const projectChecklists = useMemo(() => computeChecklists(effectiveObs), [effectiveObs])

  // The projects sweep. Mounted HERE and nowhere else, so "no other surface can
  // initiate a projects request" is an import-graph fact rather than a
  // convention. It mounts IDLE: there is no auto-start effect anywhere in the
  // controller, so opening this tab issues zero requests (FR-39, FR-40).
  const projects = useChecklistProjects({ checklists: projectChecklists, hasEbirdKey, online })

  const lifeList = useMemo(() => computeLifeList(filteredObs), [filteredObs])

  // Top species — most individuals counted (Σ count) and most checklists reported on
  // (distinct submissions). One pass over observations.
  const topSpecies = useMemo(() => computeTopSpecies(filteredObs), [filteredObs])

  const totals = useMemo(() => computeTotals(checklists, lifeList), [checklists, lifeList])

  // The headline Species figure. `countableLifeList` composes the escapee rule
  // with the countable-name predicate `lifeList` has already been through; it
  // never replaces it (FR-05). With the toggle ON this is byte-identical to the
  // pre-feature value (FR-28, QA-02).
  const speciesShown = useMemo(
    () => countableLifeList(lifeList, appliedExcluded).length,
    [lifeList, appliedExcluded],
  )

  // Accumulation curve + milestones — must process observations in chronological
  // order. BOTH series are produced in one memo pass and the toggle selects
  // between them at read (NFR-02): the Calendar's precompute-both shape, not the
  // include-spuh toggle's recompute-everything shape. With nothing excluded the
  // second series IS the first, so an unresolved cache costs one comparison.
  const accumulationPair = useMemo(() => {
    const all = computeAccumulation(filteredObs, deferredAccGranularity)
    return {
      all,
      countable: excludedNames.size === 0
        ? all
        : computeAccumulation(filteredObs, deferredAccGranularity, excludedNames),
    }
  }, [filteredObs, deferredAccGranularity, excludedNames])
  const accumulation = includeEscapees ? accumulationPair.all : accumulationPair.countable

  // Temporal histograms
  const temporal = useMemo(() => computeTemporal(checklists, filteredObs), [checklists, filteredObs])

  // Checklist-duration histogram (Temporal Stats)
  const durationBins = useMemo(() => computeDurationBins(checklists), [checklists])

  // Geographic stats
  const geo = useMemo(() => computeGeo(checklists, filteredObs), [checklists, filteredObs])

  // Fullscreen for the Geographic Stats map. The pin test is lifted to this
  // level from the IIFE that renders the map (hooks cannot live in there) and
  // asks the same question the two ranked-pin arrays answer: is there a pin with
  // a coordinate? Together with `mapReady` that is FR-05's "no map, no toggle" —
  // the loading placeholder draws no map, so it offers nothing to expand.
  const geoHasPins = useMemo(
    () => geo.topLocations.some(l => l.lat !== null) || geo.topLocationsBySpecies.some(l => l.lat !== null),
    [geo],
  )
  const geoMapRef = useRef<HTMLDivElement>(null)
  const geoFs = useMapFullscreen({
    containerRef: geoMapRef,
    baseClass: 'sr-geo-map',
    active: mapReady && geoHasPins,
  })

  // Opening a species from the county popup leaves this tab entirely, so the
  // expanded map must collapse and release its scroll lock and Escape handler on
  // the way out. The tab does unmount, so the hook's own teardown would cover it
  // — this makes the release deterministic and observable rather than racing a
  // lazy tab teardown. `undefined` in, `undefined` out, so CountyLayer's own
  // gating on the prop is unchanged.
  const collapseGeoFs = geoFs.collapse
  const handleGeoOpenSpecies = useMemo(
    () => (onOpenSpecies
      ? (commonName: string) => { collapseGeoFs(); onOpenSpecies(commonName) }
      : undefined),
    [collapseGeoFs, onOpenSpecies],
  )

  // ── County shading for the Geographic Stats map (FR-14, FR-15) ────────────
  // Built from the EXACT `filteredObs` / `checklists` memos that feed
  // `computeGeo` above, so the map and the ranked county tables beside it cannot
  // disagree by construction rather than by discipline.
  //
  // Cross-surface agreement with the Map Explorer (FR-15) holds at the default
  // setting because both sides then compute `filterObservations(allObs, false)`
  // over the same parsed export: MapExplorer hardcodes includeSpuh = false and
  // this tab's `includeSpuh` defaults false. The escapee toggle does not enter
  // `filteredObs` at all, so it cannot make the two disagree.
  //
  // GATED ON THE TOGGLE, so a user who never turns Counties on never runs it.
  const countyAggregates = useMemo(
    () => (countiesOn ? buildCountyAggregates(filteredObs, checklists) : null),
    [countiesOn, filteredObs, checklists],
  )
  const countyTiers = useMemo(
    () => computeCountyTiers(
      countyAggregates ? nonZeroMetricValues(countyAggregates, countyMetric) : [],
      COUNTY_CLASS_COUNT,
    ),
    [countyAggregates, countyMetric],
  )
  const countyShadeOn = countiesOn && !!countyData && !!countyAggregates

  // Effort stats
  const effort = useMemo(() => computeEffort(checklists), [checklists])

  // Data quality
  const quality = useMemo(() => computeQuality(filteredObs, checklists), [filteredObs, checklists])

  // Breeding stats
  const breedingStats = useMemo(() => computeBreedingStats(filteredObs), [filteredObs])

  // ML stats (most photographed / audio / video)
  const mlStats = useMemo(() => computeMlStats(effectiveMl), [effectiveMl])

  // Richer media stats (demographics, behaviors, coverage, ratings, time-of-day)
  // Media documentation coverage applies the escapee rule UNCONDITIONALLY,
  // independent of the toggle, exactly as it already ignores the include-spuh
  // toggle (FR-30, FR-34, QA-39).
  const mediaStats = useMemo(
    () => computeMediaStats(effectiveMl, countableBackboneNames, excludedNames),
    [effectiveMl, countableBackboneNames, excludedNames],
  )

  // Fun stats
  const funStats = useMemo(() => computeFunStats(filteredObs, checklists, effectiveObs), [filteredObs, checklists, effectiveObs])

  const mediaGraphResult = useMemo(
    () => buildMediaGraphData(effectiveMl, mediaInterval),
    [effectiveMl, mediaInterval],
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
        body="Upload your eBird backup to see comprehensive statistics about your birding history: life list, effort, geography, and more."
        steps={EBIRD_BACKUP_STEPS}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 24px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, textAlign: 'center', maxWidth: 420 }}>
          <div className="sr-wrap-anywhere" style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--sr-error)', fontSize: '0.875rem' }}>
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
  // Reduce, not a Math.max spread: the bins array is data-derived (the model
  // bounds it at 33, but defense in depth — a spread over an unbounded array
  // throws RangeError at ~1e5 elements). The other spreads here are over
  // small fixed-length arrays and stay as-is.
  const maxDurationBin = durationBins.bins.reduce((m, r) => Math.max(m, r.value), 1)
  // Jump-nav: base sections + Media (only with an ML export).
  const navSections = [
    ...NAV_SECTIONS,
    ...(rawMlRows.length > 0 ? ['Media'] : []),
    'Frivolous Lists',
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
            {computed ? fmt(totals.checklistCount) : '…'} checklists · eBird backup: {freshness}
          </p>
        </div>
        {/* Two count rules, STACKED rather than side by side: two "Count ..."
            labels in a row read as two unrelated controls and wrap badly at any
            narrow width; stacked they read as one count rule with two clauses.
            The new control is a plain checkbox identical to its neighbour, not a
            ToggleSwitch, because FR-27 asks for matching treatment and the
            neighbour is a checkbox. */}
        <div className="sr-count-rules">
          <label className="sr-count-rule">
            <input
              type="checkbox"
              checked={includeSpuh}
              onChange={e => setIncludeSpuh(e.target.checked)}
              style={{ accentColor: 'var(--sr-accent)', width: 14, height: 14 }}
            />
            {COUNT_FORMS_TOGGLE_LABEL}
          </label>
          <label className="sr-count-rule">
            <input
              type="checkbox"
              checked={includeEscapees}
              onChange={e => setIncludeEscapees(e.target.checked)}
              style={{ accentColor: 'var(--sr-accent)', width: 14, height: 14 }}
            />
            {ESCAPEE_TOGGLE_LABEL}
          </label>
        </div>
      </div>

      {/* Section jump-nav */}
      <nav aria-label="Jump to section" style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {navSections.map(t => (
          <a
            key={t}
            className="sr-touch-target"
            href={`#${sectionSlug(t)}`}
            onClick={e => { e.preventDefault(); jumpTo(document.getElementById(sectionSlug(t))) }}
            style={{ fontSize: '0.71875rem', fontWeight: 500, color: 'var(--sr-text-muted)', textDecoration: 'none', padding: '4px 10px', borderRadius: 100, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', whiteSpace: 'nowrap' }}
          >
            {t}
          </a>
        ))}
      </nav>

      {!computed ? (
        /* Computing phase: shell is painted; the heavy memos + map mount next
           frame. Markup mirrors App.tsx's TabLoading (the Suspense fallback) so
           the transition from "Loading charts…" to "Computing your statistics…"
           is visually seamless. */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 48, minHeight: 200 }}>
          <Loader2 size={22} className="spin" aria-hidden="true" style={{ color: 'var(--sr-text-muted)' }} />
          <span role="status" style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Computing your statistics…</span>
        </div>
      ) : (
      <>
      {/* One-time mobile chart tip (phones only; sits above the first chart) */}
      <ChartViewTip page="statistics" />

      {/* ── Section 1: Life List Totals ─────────────────────────────────────── */}
      <SectionCard title="Life List Totals" icon={<BarChart2 size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(7.5rem, 1fr))', gap: 0 }}>
          {[
            { label: 'Species', value: speciesShown, settling: provenance.status.kind === 'in-progress' },
            { label: 'Checklists', value: totals.checklistCount },
            { label: 'Locations', value: totals.locationCount },
            { label: 'Years Active', value: totals.yearCount },
            totals.stateCount > 0 ? { label: 'States/Provinces', value: totals.stateCount } : null,
            totals.countryCount > 0 ? { label: 'Countries', value: totals.countryCount } : null,
          ].filter(Boolean).map((stat, i) => (
            <div key={i} style={{ borderRight: '1px solid var(--sr-border-subtle)', borderBottom: '1px solid var(--sr-border-subtle)' }}>
              {/* A settling figure renders muted while a pass runs. Supporting
                  cue only: the status sentence below says the same thing in
                  words, so it is never colour alone (WCAG 1.4.1). No sub-line is
                  added here, which would force `reserveSub` on all six tiles and
                  permanently add a blank line to five of them. */}
              <StatCell label={stat!.label} value={stat!.value} settling={stat!.settling ?? false} />
            </div>
          ))}
        </div>

        {/* The control lives with its sibling in the header; the ACCOUNT lives
            with the number, because a headline figure that drops by three has to
            answer for itself where the reader is looking. */}
        <ExoticProvenanceAccount
          status={provenance.status}
          statusSeq={provenance.statusSeq}
          excluded={provenance.lookup.excluded}
          includeEscapees={includeEscapees}
          onStop={provenance.stop}
          onRetry={provenance.retry}
          onGoToSettings={onGoToSettings}
          codeFor={codeFor}
          onOpenSpecies={onOpenSpecies}
        />

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
                  <ChecklistLink submissionId={cl.submissionId} label={fmtDate(cl.date)} style={{ fontSize: '0.9375rem', fontWeight: 700, margin: '0 0 3px' }} />
                  <div style={{ fontSize: '0.6875rem' }}>
                    <HotspotLink locId={cl.locationId} name={cl.location} isHotspot={isHotspot(cl.locationId)} style={{ color: 'var(--sr-text-muted)' }} />
                  </div>
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
            <div className="sr-action-row" style={{ marginBottom: 10 }}>
              <SubLabel>Life list accumulation</SubLabel>
              <div role="group" aria-label="Accumulation granularity" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(['weekly', 'monthly', 'yearly', 'total'] as const).map(g => (
                  <button
                    key={g}
                    className="sr-touch-target"
                    onClick={() => setAccGranularity(g)}
                    aria-pressed={accGranularity === g}
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
            <div style={{ height: 180 }} role="img" aria-label={`Life list accumulation chart: ${fmt(speciesShown)} species recorded over time`}>
              <ResponsiveContainer width="100%" height="100%">
                {deferredAccGranularity === 'total' ? (
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
                      trigger="click"
                      wrapperStyle={{ pointerEvents: 'auto' }}
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
                      tickFormatter={key => formatPeriodLabel(String(key), deferredAccGranularity as PeriodGranularity)}
                    />
                    <YAxis tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                    <Tooltip
                      trigger="click"
                      wrapperStyle={{ pointerEvents: 'auto' }}
                      contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                      formatter={(v) => [typeof v === 'number' ? fmt(v) : String(v ?? ''), 'Species']}
                      labelFormatter={key => formatPeriodLabel(String(key), deferredAccGranularity as PeriodGranularity)}
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
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(248px, 100%), 1fr))', gap: 'clamp(16px, 4vw, 28px)' }}>
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
                // Tokenized milestone palette (--sr-milestone-N-*): replaces the
                // old hardcoded hexes (CLAUDE.md tokens-only rule); the failing
                // date colors were darkened to ≥AA in globals.css.
                const ts = {
                  bg: `var(--sr-milestone-${tier}-bg)`,
                  border: `var(--sr-milestone-${tier}-border)`,
                  num: `var(--sr-milestone-${tier}-num)`,
                  date: `var(--sr-milestone-${tier}-date)`,
                  check: `var(--sr-milestone-${tier}-check)`,
                }
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
                    <ChecklistLink submissionId={m.submissionId} label={fmtDate(m.date)} style={{ fontSize: '0.625rem', color: ts.date }} />
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
              {/* rem column widths + a shrinkable, ellipsizing label (the BarRow
                  pattern in statsPrimitives) so the row's boxes grow with the Text
                  Size control instead of the rem-sized text overflowing fixed px
                  boxes at 200% scale; the trailing best-day link is allowed to
                  wrap within its box rather than nowrap-overflowing the card. */}
              {temporal.yearRows.map(r => (
                // .sr-wrap-flex supplies display + flex-wrap + align-items + the
                // 8px gap (v1.0.4), lifted off the inline style so this row can
                // break. It is the ONLY bar row with three trailing flexShrink:0
                // boxes (1.75rem + 2.75rem + 4.5rem = 288px at 200% text scale)
                // inside a 242px card, so the bar and label both collapsed to 0
                // and it still overflowed, putting the best-day link 39px past
                // the viewport. Wrapping moves those boxes to a second line
                // instead of off the card; at 100% they fit and nothing wraps.
                // The sibling breeding rows carry one trailing box and are left
                // alone deliberately — they fit at every measured size.
                <div key={r.label} className="sr-wrap-flex" style={{ minHeight: 22, minWidth: 0 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '2.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                  <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${maxYearChecklists > 0 ? (r.checklists / maxYearChecklists) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                  </div>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '1.75rem', textAlign: 'right' }}>{fmt(r.checklists)}</span>
                  <span style={{ fontSize: '0.6875rem', flexShrink: 0, width: '2.75rem', textAlign: 'right', color: 'var(--sr-accent)' }}>{fmt(r.species)} sp.</span>
                  <span style={{ fontSize: '0.6875rem', flexShrink: 0, width: '4.5rem', textAlign: 'right' }}>
                    {r.bestDay ? (
                      <ChecklistLink submissionId={r.bestDay.submissionId} label={`${fmt(r.bestDay.species)} best`} />
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
            <div className="sr-grid-chart-aside" style={{ alignItems: 'start', marginBottom: 4, ['--sr-aside' as string]: '160px' }}>
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
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', pointerEvents: 'none' }}>
                      <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--sr-text-muted)', lineHeight: 1 }}>peak</span>
                      <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1.3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{peakMonth.label}</span>
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
                    <div style={{ position: 'relative', width: 120, height: 120, flexShrink: 0 }} role="img" aria-label={`Checklists by day of week: ${weekendPct}% on weekends`}>
                      <PieChart width={120} height={120}>
                        <Pie data={dowPieData} dataKey="value" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                          {dowPieData.map((d, i) => <Cell key={i} fill={d.fill} />)}
                        </Pie>
                      </PieChart>
                      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '0 8px', pointerEvents: 'none' }}>
                        <span style={{ fontSize: '0.6875rem', fontWeight: 700, color: 'var(--sr-text-muted)', lineHeight: 1 }}>wkend</span>
                        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1.3, maxWidth: '100%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{weekendPct}%</span>
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

        <Divider />
        <SubLabel>Checklist duration</SubLabel>
        {durationBins.durationCount > 0 ? (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {/* Zero-count bins inside the range keep their empty track (honest
                shape); bins beyond the longest checklist are omitted by the
                model. pctOf is the duration-bearing checklist count, matching
                "By start hour"'s share-of-covered semantics. */}
            {durationBins.bins.map(r => (
              <BarRow key={r.label} label={r.label} value={r.value} max={maxDurationBin} labelWidth={82} color="var(--sr-graph-photo)" pctOf={durationBins.durationCount} />
            ))}
            <p style={{ fontSize: '0.65625rem', color: 'var(--sr-text-muted)', margin: '10px 0 0', lineHeight: 1.4 }}>
              {/* The caption uses the MODEL's own average — computed over
                  exactly the in-range durations the bars show — so it can
                  never disagree with the bars. It matches Effort's average on
                  sane data (parity-locked in tests); Effort's own tile is
                  deliberately unchanged. Coverage counts usable (0-24h)
                  durations, hence "usable". */}
              {durationBins.avgDurationMin !== null ? `${formatDuration(durationBins.avgDurationMin)} avg` : ''}
              {durationBins.durationCount < durationBins.totalCount
                ? ` · ${fmt(durationBins.durationCount)} of ${fmt(durationBins.totalCount)} checklists have a usable duration`
                : ''}
            </p>
          </div>
        ) : (
          <p style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', margin: 0 }}>No duration data in this export.</p>
        )}
      </SectionCard>

      {/* ── Section 4: Geographic Stats ────────────────────────────────────── */}
      <SectionCard
        title="Geographic Stats"
        icon={<MapPin size={16} />}
        action={
          // One rule across both surfaces: the Counties switch lives in its
          // section's header row. Off on mount, session-scoped.
          <ToggleSwitch
            label="Counties"
            checked={countiesOn}
            onChange={() => { void handleToggleCounties() }}
            busy={countyLoading}
          />
        }
      >
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
              {/* Idle-deferred map: the placeholder keeps the EXACT box so the
                  SnowMap mount causes zero layout shift. Both boxes now carry the
                  SAME `.sr-geo-map` class rather than two hand-kept copies of an
                  inline style, so they agree by construction; the class also
                  exists because an inline `height: 320px` is specificity 1,0,0
                  and could never be beaten by the expanded panel's `100dvh`.
                  mapReady flips on requestIdleCallback after `computed`. */}
              {mapReady ? (
                <div ref={geoMapRef} className={geoFs.className}>
                  <MapFullscreenProvider value={geoFs}>
                  <SnowMap
                    initialViewState={{ longitude: 0, latitude: 20, zoom: 1 }}
                    style={{ width: '100%', height: '100%' }}
                    onLoad={e => fitToPins(e.target, [...clPins, ...spPins])}
                    switcher
                  >
                    {clPins.map(pin => (
                      <Marker key={`cl-${pin.rank}`} longitude={pin.lng} latitude={pin.lat} anchor="center"
                        onClick={e => { e.originalEvent.stopPropagation(); setGeoPopup({ lng: pin.lng, lat: pin.lat, title: pin.name, sub: `${fmt(pin.checklists)} checklists` }) }}>
                        <DimmablePin dim={countyShadeOn}>
                          <RankIcon rank={pin.rank} shape="circle" label={`#${pin.rank} by checklists: ${pin.name}, ${fmt(pin.checklists)} checklists`} />
                        </DimmablePin>
                      </Marker>
                    ))}
                    {spPins.map(pin => (
                      <Marker key={`sp-${pin.rank}`} longitude={pin.lng} latitude={pin.lat} anchor="center"
                        onClick={e => { e.originalEvent.stopPropagation(); setGeoPopup({ lng: pin.lng, lat: pin.lat, title: pin.name, sub: `${fmt(pin.species)} species` }) }}>
                        <DimmablePin dim={countyShadeOn}>
                          <RankIcon rank={pin.rank} shape="square" label={`#${pin.rank} by species: ${pin.name}, ${fmt(pin.species)} species`} />
                        </DimmablePin>
                      </Marker>
                    ))}
                    {/* closeButton enabled so the popup is keyboard-dismissable —
                        maplibre renders a real <button aria-label="Close popup">
                        (themed in globals.css); F044. */}
                    {geoPopup && (
                      <Popup longitude={geoPopup.lng} latitude={geoPopup.lat} anchor="bottom" offset={16} onClose={() => setGeoPopup(null)} closeButton>
                        <span style={{ fontSize: '0.8125rem' }}>{geoPopup.title}</span><br /><span style={{ color: 'var(--sr-text-muted)', fontSize: '0.75rem' }}>{geoPopup.sub}</span>
                      </Popup>
                    )}
                    {/* Counties (FR-13). Rendered only once the geometry has
                        loaded, so with the control off this subtree does not
                        exist: no layer, no source, no basemap effect, no new
                        DOM. The ranked pins, their popups, the share pin,
                        fitToPins and the mapReady deferral are untouched. */}
                    {countyData && (
                      <>
                        <CountyLayer
                          data={countyData}
                          shade={countiesOn}
                          aggregates={countyAggregates}
                          tiers={countyTiers}
                          metric={countyMetric}
                          useTextures={countyUseTextures}
                          isPublicHotspot={isHotspot}
                          onOpenSpecies={handleGeoOpenSpecies}
                          taxonCodeFor={codeFor}
                        />
                        <BasemapDesaturation active={countyShadeOn} />
                      </>
                    )}
                    {/* The corner row: the share-pin drop button (surface E),
                        then the fullscreen toggle. No share-pin reset key
                        needed: this map has no entity behind it that can change
                        under a mounted map. */}
                    <MapCornerControls compact={false} />
                  </SnowMap>
                  </MapFullscreenProvider>
                </div>
              ) : (
                <div className="sr-geo-map" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <span role="status" style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>Loading map…</span>
                </div>
              )}
              <div style={{ display: 'flex', gap: 16, marginTop: 8, flexWrap: 'wrap' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><circle cx="7" cy="7" r="6" fill="var(--sr-rank-pin-circle)" /></svg>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>Top by checklists</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <svg width="14" height="14" viewBox="0 0 14 14"><rect x="1" y="1" width="12" height="12" rx="2" fill="var(--sr-rank-pin-square)" /></svg>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>Top by species</span>
                </div>
              </div>
              {/* The shading panel, beneath the rank-pin legend row. Exactly two
                  metric options; no Completeness, and no code path from this
                  surface that could reach one (FR-16). */}
              <CountyShadingPanel
                open={countiesOn}
                metric={countyMetric}
                onMetricChange={setCountyMetric}
                useTextures={countyUseTextures}
                onToggleTextures={() => setCountyUseTextures(v => !v)}
                tiers={countyTiers}
                hint={STATS_SHADING_HINT}
                emptyNote={STATS_EMPTY_NOTE}
              />
            </div>
          )
        })()}

        {geo.topLocations.length > 0 && (
          <>
            <SubLabel>Top locations by checklists</SubLabel>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 20 }}>
              {geo.topLocations.map((loc, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap', rowGap: 2 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <HotspotLink locId={loc.locationId} name={loc.name} isHotspot={isHotspot(loc.locationId)} truncate style={{ fontSize: '0.8125rem', flex: '1 1 140px' }} />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, marginLeft: 'auto' }}>{fmt(loc.checklists)} lists · {fmt(loc.species)} sp.</span>
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
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '4px 0', flexWrap: 'wrap', rowGap: 2 }}>
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', width: 16, textAlign: 'right', flexShrink: 0 }}>{i + 1}</span>
                  <HotspotLink locId={loc.locationId} name={loc.name} isHotspot={isHotspot(loc.locationId)} truncate style={{ fontSize: '0.8125rem', flex: '1 1 140px' }} />
                  <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, marginLeft: 'auto' }}>{fmt(loc.species)} sp. · {fmt(loc.checklists)} lists</span>
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
                  {(showAllCounties ? geo.topCounties : geo.topCounties.slice(0, 8)).map((c) => {
                    const sp = c.stateProvince
                    const validSp = sp && sp.includes('-')
                    const label = validSp ? (
                      // Persistent accent affordance (no hover-only underline) so
                      // the link reads as a link on touch, where hover never fires.
                      <OutboundLink
                        href={`https://ebird.org/region/${sp}`}
                        style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}
                      >
                        {c.name}
                      </OutboundLink>
                    ) : c.name
                    return (
                      <div key={`${c.stateProvince ?? ''}-${c.name}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
                        <span title={c.name} style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '6.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topCounties[0]?.count ? (c.count / geo.topCounties[0].count) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '2rem', textAlign: 'right' }}>{fmt(c.count)}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
              <div>
                <SubLabel>Counties by species</SubLabel>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                  {geo.topCountiesBySpecies.slice(0, 8).map((c) => {
                    const sp = c.stateProvince
                    const validSp = sp && sp.includes('-')
                    const label = validSp ? (
                      <OutboundLink
                        href={`https://ebird.org/region/${sp}`}
                        style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}
                      >
                        {c.name}
                      </OutboundLink>
                    ) : c.name
                    return (
                      <div key={`${c.stateProvince ?? ''}-${c.name}`} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
                        <span title={c.name} style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '6.25rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                          {label}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topCountiesBySpecies[0]?.species ? (c.species / geo.topCountiesBySpecies[0].species) * 100 : 0}%`, background: 'var(--sr-graph-photo)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '2.5rem', textAlign: 'right' }}>{fmt(c.species)} sp.</span>
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
                  // real vertical padding for a comfortable tap target — the
                  // button sits alone on its line, so this shifts nothing.
                  fontSize: '0.75rem', color: 'var(--sr-accent)', padding: '8px 0', fontFamily: 'inherit',
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
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {validSp ? (
                            <OutboundLink
                              href={`https://ebird.org/region/${s.name}`}
                              style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}
                            >
                              {regionName(s.name)}
                            </OutboundLink>
                          ) : regionName(s.name)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topStates[0]?.count ? (s.count / geo.topStates[0].count) * 100 : 0}%`, background: 'var(--sr-accent)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '2rem', textAlign: 'right' }}>{fmt(s.count)}</span>
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
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '6rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.name}>
                          {validSp ? (
                            <OutboundLink
                              href={`https://ebird.org/region/${s.name}`}
                              style={{ color: 'var(--sr-accent)', textDecoration: 'none' }}
                            >
                              {regionName(s.name)}
                            </OutboundLink>
                          ) : regionName(s.name)}
                        </span>
                        <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${geo.topStatesBySpecies[0]?.species ? (s.species / geo.topStatesBySpecies[0].species) * 100 : 0}%`, background: 'var(--sr-graph-photo)', borderRadius: 4, transition: 'width 0.3s' }} />
                        </div>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '2.5rem', textAlign: 'right' }}>{fmt(s.species)} sp.</span>
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
                { label: 'Time Afield', value: effort.totalHours !== null ? `${fmt(effort.totalHours, 0)} h` : '-', sub: effort.durationCount > 0 ? `${fmt(effort.durationCount)} lists` : '' },
                { label: 'Distance', value: effort.totalDistanceMi !== null ? `${fmt(effort.totalDistanceMi, 0)} mi` : '-', sub: effort.distanceCount > 0 ? `${fmt(effort.distanceCount)} lists` : '' },
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
              <div className="sr-action-row" style={{ margin: '0 0 10px' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Complete checklists</p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(effort.completeCount)} of {fmt(effort.allObsCount)} complete</span>
              </div>
              <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 10 }}>
                <div style={{ width: `${completePct}%`, background: 'var(--sr-chart-blue-dark)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }}>
                  {completePct >= 8 && (
                    // Theme-aware on-fill token: white on the light-theme blue (#1D4ED8,
                    // 6.70) and near-black on the lighter dark-theme blue (#3B82F6, 5.38).
                    // on-accent was wrong here — its dark value (#052E16) is only 4.05:1
                    // on #3B82F6, below AA for this 11px label. F032.
                    <span style={{ fontSize: '0.6875rem', color: 'var(--sr-on-chart-blue-dark)', fontWeight: 600, whiteSpace: 'nowrap' }}>{completePct}%</span>
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
                      return (
                        <div key={name}>
                          <div className="sr-action-row" style={{ marginBottom: 3 }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{name} <span style={{ color: 'var(--sr-text)', fontWeight: 600 }}>{pct}%</span></span>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>{fmt(pc.complete)} of {fmt(pc.total)} complete</span>
                          </div>
                          {/* % shown in the header above (surface text, AA in both themes)
                              rather than inside the pale graph-photo fill, which can't
                              carry AA-contrast text in either theme. F032. */}
                          <div style={{ minHeight: 20, borderRadius: 3, overflow: 'hidden', display: 'flex' }} aria-hidden="true">
                            <div style={{ width: `${pct}%`, background: 'var(--sr-graph-photo)' }} />
                            <div style={{ flex: 1, background: 'var(--sr-surface-subtle)' }} />
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
            {/* Per-segment % shown in the legend below (surface text, AA in both
                themes) rather than inside the multi-hued segments — several
                PROTOCOL_COLORS fills can't carry AA-contrast in-bar text. F032. */}
            <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 10 }} aria-hidden="true">
              {effort.protocolRows.map((r, i) => (
                <div key={r.name} style={{
                  width: `${r.pct}%`,
                  background: PROTOCOL_COLORS[i % PROTOCOL_COLORS.length],
                }} />
              ))}
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
              {effort.protocolRows.map((r, i) => (
                <div key={r.name} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                  <div style={{ width: 10, height: 10, borderRadius: 2, background: PROTOCOL_COLORS[i % PROTOCOL_COLORS.length], flexShrink: 0 }} />
                  <span style={{ fontSize: '0.75rem' }}>{r.name}</span>
                  <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{r.pct}% ({fmt(r.count)})</span>
                </div>
              ))}
            </div>
          </>
        )}

        <Divider />
        <SubLabel>Key metrics</SubLabel>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(5rem, 1fr))', gap: 1, background: 'var(--sr-border-subtle)', border: '1px solid var(--sr-border-subtle)', borderRadius: 8, overflow: 'hidden' }}>
          {[
            { label: 'Average duration', value: effort.avgDurationMin !== null ? `${fmt(effort.avgDurationMin, 0)} min` : '-' },
            { label: 'Average distance', value: effort.avgDistanceMi !== null ? `${fmt(effort.avgDistanceMi, 1)} mi` : '-' },
            effort.avgAreaAcres !== null ? { label: 'Average area', value: `${fmt(effort.avgAreaAcres, 1)} ac` } : null,
            { label: 'Species per hour', value: effort.sppPerHour !== null ? fmt(effort.sppPerHour, 1) : '-' },
            { label: 'Species per mile', value: effort.sppPerMi !== null ? fmt(effort.sppPerMi, 1) : '-' },
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
            <div className="sr-scroll-x">
              {/* width:max-content + min-width:100% — the wrapper scrolls on
                  phones (instead of crushing the 4 columns to wrapped headers)
                  while the table still fills the card on desktop. */}
              <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
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
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>{r.avgDurationMin !== null ? fmt(r.avgDurationMin, 0) : '-'}</td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>{r.avgDistanceMi !== null ? fmt(r.avgDistanceMi, 1) : '-'}</td>
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
                <div className="sr-grid-chart-aside" style={{ alignItems: 'start', ['--sr-aside' as string]: '160px' }}>
                  <div style={{ height: 110 }} role="img" aria-label="Bar chart of checklists grouped by number of observers">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={effort.observerRows} margin={{ top: 4, right: 4, bottom: 16, left: -20 }}>
                        <XAxis
                          dataKey="n"
                          tick={{ fontSize: '0.6875rem', fill: 'var(--sr-text-muted)' }}
                          tickLine={false} axisLine={false}
                          tickFormatter={n => String(n)}
                        />
                        <YAxis tick={{ fontSize: '0.625rem', fill: 'var(--sr-text-muted)' }} tickLine={false} axisLine={false} />
                        <Tooltip
                          trigger="click"
                          wrapperStyle={{ pointerEvents: 'auto' }}
                          contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                          formatter={(v) => [fmt(Number(v)), 'Lists']}
                          labelFormatter={n => `${n} observer${n === 1 ? '' : 's'}`}
                        />
                        <Bar dataKey="count" fill="var(--sr-accent)" radius={[3, 3, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                  <div>
                    {/* Decorative donut (the observer breakdown is also the bar
                        chart + legend beside it). `inert` removes the whole
                        subtree from the tab order AND from AT — recharts ignores
                        accessibilityLayer on PieChart and still renders a
                        focusable root <svg>, so aria-hidden alone left an
                        axe aria-hidden-focus ghost; inert kills it for good. */}
                    <div aria-hidden="true" inert>
                      <PieChart width={120} height={120} accessibilityLayer={false}>
                        <Pie data={effort.observerRows} dataKey="count" cx={60} cy={60} innerRadius={34} outerRadius={56} strokeWidth={0}>
                          {effort.observerRows.map((_, i) => (
                            <Cell key={i} fill={obsPieColors[i % obsPieColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </div>
                    {/* Count-first legend: the exact list count per group size is
                        readable here without the click tooltip, and a rare size
                        never shows a bare rounded "0%" (fmtSharePct → "<1%"). */}
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginTop: 6 }}>
                      {effort.observerRows.map((r, i) => (
                        <div key={r.n} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                          <div style={{ width: 8, height: 8, borderRadius: '50%', background: obsPieColors[i % obsPieColors.length], flexShrink: 0 }} />
                          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>
                            {r.n} obs · {fmt(r.count)} list{r.count === 1 ? '' : 's'} ({fmtSharePct(r.count, totalObs)})
                          </span>
                        </div>
                      ))}
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
                  <div style={{ fontSize: '0.6875rem', display: 'flex' }}>
                    <HotspotLink locId={card.c.locationId} name={card.c.location} isHotspot={isHotspot(card.c.locationId)} truncate style={{ flex: 1 }} />
                  </div>
                  <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span>{fmtDate(card.c.date)}</span>
                    <ChecklistLink submissionId={card.c.submissionId} compact />
                  </div>
                </div>
              ))}
            </div>
          </>
        )}

      </SectionCard>

      {/* ── Section 6: Projects ────────────────────────────────────────────── */}
      {/* Immediately after Effort & Outings (OQ-03's default). It is a
          contribution reading, which sits naturally with effort, and it is this
          tab's only user-initiated network section, so it is low enough not to
          be pressed by reflex. The jump-nav chip and the docs/HELP.md heading
          sit in the same position.

          ClipboardList reads as a survey you fill in and is legible at 16px
          (Handshake was built first and rejected: five paths turn to mush). */}
      <SectionCard title="Projects" icon={<ClipboardList size={16} />}>
        <ProjectsSection controller={projects} onGoToSettings={onGoToSettings} />
      </SectionCard>

      {/* ── Section 7: Data Quality ────────────────────────────────────────── */}
      <SectionCard title="Data Quality" icon={<ShieldCheck size={16} />}>

        {quality.numericRatio !== null && quality.xRatio !== null && (() => {
          const numPct = Math.round(quality.numericRatio * 100)
          const xPct = Math.round(quality.xRatio * 100)
          const total = quality.numericCount + quality.xCount
          return (
            <>
              <div className="sr-action-row" style={{ margin: '0 0 10px' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Count method</p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}><span style={{ color: 'var(--sr-text)', fontWeight: 600 }}>{numPct}%</span> numeric · <span style={{ color: 'var(--sr-text)', fontWeight: 600 }}>{xPct}%</span> X / {fmt(total)} observations</span>
              </div>
              {/* % moved to the header (surface text, AA in both themes); the X
                  segment sits on the pale --sr-chart-slate fill, which can't carry
                  AA-contrast in-bar text. F032. */}
              <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex', marginBottom: 6 }} aria-hidden="true">
                <div style={{ width: `${numPct}%`, background: 'var(--sr-accent)' }} />
                <div style={{ flex: 1, background: 'var(--sr-chart-slate)' }} />
              </div>
            </>
          )
        })()}

        {(quality.commentRatio !== null || quality.speciesCommentRatio !== null) && (
          <>
            <Divider />
            {quality.commentRatio !== null && (
              <div style={{ marginBottom: 10 }}>
                {(() => {
                  const pct = Math.round(quality.commentRatio * 100)
                  return (
                    <>
                      <div className="sr-action-row" style={{ margin: '0 0 10px' }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Checklist comments</p>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}><span style={{ color: 'var(--sr-text)', fontWeight: 600 }}>{pct}%</span> · {fmt(quality.checksWithComments)} of {fmt(checklists.length)} checklists</span>
                      </div>
                      {/* % shown in the header (surface text, AA both themes); neither
                          the graph-photo nor the pale chart-blue-light segment can
                          carry AA-contrast in-bar text. F032. */}
                      <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex' }} aria-hidden="true">
                        <div style={{ width: `${pct}%`, background: 'var(--sr-graph-photo)' }} />
                        <div style={{ flex: 1, background: 'var(--sr-chart-blue-light)' }} />
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
            {quality.speciesCommentRatio !== null && (
              <div>
                {(() => {
                  const pct = Math.round(quality.speciesCommentRatio * 100)
                  return (
                    <>
                      <div className="sr-action-row" style={{ margin: '0 0 10px' }}>
                        <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Species notes</p>
                        <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}><span style={{ color: 'var(--sr-text)', fontWeight: 600 }}>{pct}%</span> · {fmt(quality.obsWithSpeciesComments)} of {fmt(filteredObs.length)} observations</span>
                      </div>
                      {/* % shown in the header (surface text, AA both themes); neither
                          the graph-photo nor the pale chart-blue-light segment can
                          carry AA-contrast in-bar text. F032. */}
                      <div style={{ height: 32, borderRadius: 4, overflow: 'hidden', display: 'flex' }} aria-hidden="true">
                        <div style={{ width: `${pct}%`, background: 'var(--sr-graph-photo)' }} />
                        <div style={{ flex: 1, background: 'var(--sr-chart-blue-light)' }} />
                      </div>
                    </>
                  )
                })()}
              </div>
            )}
          </>
        )}

        {(quality.anyWeatherCount > 0 || quality.snowravenTideCount > 0) && (
          <>
            <Divider />
            <div>
              <div className="sr-action-row" style={{ margin: '0 0 10px' }}>
                <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: 0 }}>Weather &amp; tide blocks</p>
                <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)' }}>of {fmt(quality.weatherTideTotal)} checklists</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <BarRow label="Any weather" value={quality.anyWeatherCount} max={quality.weatherTideTotal} pctOf={quality.weatherTideTotal} color="var(--sr-accent)" labelWidth={120} />
                <BarRow label="Raincrow weather" value={quality.raincrowWeatherCount} max={quality.weatherTideTotal} pctOf={quality.weatherTideTotal} color="var(--sr-chart-slate)" labelWidth={120} />
                <BarRow label="SnowRaven weather" value={quality.snowravenWeatherCount} max={quality.weatherTideTotal} pctOf={quality.weatherTideTotal} color="var(--sr-graph-photo)" labelWidth={120} />
                <BarRow label="SnowRaven tide" value={quality.snowravenTideCount} max={quality.weatherTideTotal} pctOf={quality.weatherTideTotal} color="var(--sr-chart-blue-light)" labelWidth={120} />
                <BarRow label="Weather + tide" value={quality.snowravenWeatherAndTideCount} max={quality.weatherTideTotal} pctOf={quality.weatherTideTotal} color="var(--sr-graph-video)" labelWidth={120} />
              </div>
              <p style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', margin: '8px 0 0', lineHeight: 1.4 }}>
                Detected from SnowRaven/Raincrow blocks pasted into the checklist comment. "Any weather" counts a block from either app; Raincrow blocks are recognized by their raincrow.app credit, SnowRaven blocks by their SnowRaven credit. Tide blocks are SnowRaven-only; "Weather + tide" means a checklist carrying both a SnowRaven weather block and a tide block.
              </p>
            </div>
          </>
        )}

      </SectionCard>

      {/* ── Highlights & Records ───────────────────────────────────────────── */}
      <SectionCard title="Highlights & Records" icon={<Award size={16} />}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16 }}>
          {funStats.busiestDay && (
            <div style={{ padding: '12px 16px', background: 'var(--sr-surface-subtle)', borderRadius: 8 }}>
              <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '0 0 4px' }}>Biggest single day</p>
              <ChecklistLink submissionId={funStats.busiestDay.submissionId} label={`${fmt(funStats.busiestDay.species)} species`} size="md" style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px' }} />
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
            <div className="sr-scroll-x">
              {/* width:max-content + min-width:100% — scrolls on phones so the
                  Species (BirdName + favicons) column isn't crushed past the
                  card edge; fills the card on desktop. */}
              <table style={{ width: 'max-content', minWidth: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
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
                        <ChecklistLink submissionId={entry.submissionId} label={fmt(entry.count)} style={{ fontWeight: 600 }} />
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)' }}>
                        {entry.date ? fmtDate(entry.date) : '-'}
                      </td>
                      <td style={{ padding: '5px 8px', textAlign: 'right', color: 'var(--sr-text-muted)', maxWidth: 180 }}>
                        {entry.location
                          ? <HotspotLink locId={entry.locationId} name={entry.location} isHotspot={isHotspot(entry.locationId)} truncate style={{ color: 'var(--sr-text-muted)', maxWidth: '100%', justifyContent: 'flex-end' }} />
                          : '-'}
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
                <ChecklistLink submissionId={bird.submissionId} compact style={{ fontSize: '0.6875rem' }} />
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
                  <ChecklistLink submissionId={bird.submissionId} compact style={{ fontSize: '0.6875rem' }} />
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
            {/* Fixed 3-up: three short stat numbers fit at every width down to
                320px, and the per-cell divider borders stay coherent (a
                collapsing grid would leave a dangling border on a wrapped row). */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 0, marginBottom: 20 }}>
              {[
                // -fg text tokens (not the raw tier fills) so the colored stat
                // numbers meet AA on the card surface in both themes (F003/F017).
                { label: 'Confirmed', value: breedingStats.confirmed, color: 'var(--sr-tier-4-fg)' },
                { label: 'Probable', value: breedingStats.probable, color: 'var(--sr-tier-2-fg)' },
                { label: 'Possible', value: breedingStats.possible, color: 'var(--sr-tier-1-fg)' },
              ].map((tier, i) => (
                <div key={i} style={{ borderRight: '1px solid var(--sr-border-subtle)', borderBottom: '1px solid var(--sr-border-subtle)', padding: '12px 4px', textAlign: 'center' }}>
                  <span style={{ fontSize: '1.5rem', fontWeight: 700, color: tier.color }}>{fmt(tier.value)}</span>
                  <p style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', margin: '4px 0 0' }}>{tier.label} species</p>
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8, marginBottom: 10 }}>
              <SubLabel>Breeding activity by month</SubLabel>
              <div role="group" aria-label="Filter breeding activity by tier" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {([
                  // `color` styles the border (non-text); `fg` is the AA-passing
                  // text token (F003) used for the active pill label.
                  { key: 'all', label: 'All' },
                  { key: 'confirmed', label: 'Confirmed', color: 'var(--sr-tier-4)', fg: 'var(--sr-tier-4-fg)' },
                  { key: 'probable', label: 'Probable', color: 'var(--sr-tier-2)', fg: 'var(--sr-tier-2-fg)' },
                  { key: 'possible', label: 'Possible', color: 'var(--sr-tier-1)', fg: 'var(--sr-tier-1-fg)' },
                ] as const).map(f => (
                  <button
                    key={f.key}
                    className="sr-touch-target"
                    onClick={() => setBreedingFilter(f.key)}
                    aria-pressed={breedingFilter === f.key}
                    style={{
                      height: 24, padding: '0 8px', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 500,
                      fontFamily: 'inherit', cursor: 'pointer',
                      border: breedingFilter === f.key
                        ? `1.5px solid ${'color' in f ? f.color : 'var(--sr-accent-border)'}`
                        : '1.5px solid var(--sr-border)',
                      background: breedingFilter === f.key ? ('color' in f ? `rgba(var(--sr-tier-${'confirmed' === f.key ? 4 : 'probable' === f.key ? 2 : 1}-rgb), 0.1)` : 'var(--sr-accent-bg)') : 'none',
                      color: breedingFilter === f.key ? ('fg' in f ? f.fg : 'var(--sr-accent)') : 'var(--sr-text-muted)',
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
                          <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '1.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                            <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden' }}>
                              <div style={{ height: '100%', width: `${maxVal > 0 ? (val / maxVal) * 100 : 0}%`, background: color, borderRadius: 4, transition: 'width 0.3s' }} />
                            </div>
                            <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '1.5rem', textAlign: 'right' }}>{val || ''}</span>
                          </div>
                        )
                      }
                      const totalPct = maxVal > 0 ? (r.total / maxVal) * 100 : 0
                      const confPct = r.total > 0 ? (r.confirmed / r.total) * totalPct : 0
                      const probPct = r.total > 0 ? (r.probable / r.total) * totalPct : 0
                      const possPct = r.total > 0 ? (r.possible / r.total) * totalPct : 0
                      return (
                        <div key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', textAlign: 'right', flexShrink: 1, minWidth: 0, width: '1.75rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
                          <div style={{ flex: 1, minWidth: 0, height: 8, borderRadius: 4, background: 'var(--sr-surface-subtle)', overflow: 'hidden', display: 'flex' }}>
                            {/* 1px surface-colored separators so adjacent tier
                                segments are distinguishable — the tier fills are
                                <3:1 against each other (1.4.11 Non-text). F072. */}
                            <div style={{ height: '100%', width: `${confPct}%`, background: 'var(--sr-tier-4)', borderRight: confPct > 0 && (probPct > 0 || possPct > 0) ? '1px solid var(--sr-surface)' : undefined, transition: 'width 0.3s' }} />
                            <div style={{ height: '100%', width: `${probPct}%`, background: 'var(--sr-tier-2)', borderRight: probPct > 0 && possPct > 0 ? '1px solid var(--sr-surface)' : undefined, transition: 'width 0.3s' }} />
                            <div style={{ height: '100%', width: `${possPct}%`, background: 'var(--sr-tier-1)', transition: 'width 0.3s' }} />
                          </div>
                          <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: '1.5rem', textAlign: 'right' }}>{r.total || ''}</span>
                        </div>
                      )
                    })}
                  </div>
                  {breedingFilter === 'all' && (
                    // .sr-wrap-flex supplies display + flex-wrap + align-items and
                    // carries the 14px gap through --sr-wrap-gap (v1.0.4). The three
                    // swatch+label groups are 92.34px each at 200% text scale inside
                    // a 242px card, so the row ran 50.6px past the viewport — the
                    // largest single contributor to Statistics' leak. Wrapping puts
                    // the third tier on its own line rather than off the card. This
                    // legend, NOT the 3-up stat grid above, is the offender: that
                    // grid's minmax(0, 1fr) tracks already hold at this size.
                    <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '14px', marginTop: 8 }}>
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
              <div role="group" aria-label="Media chart mode" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                {(['per-period', 'cumulative'] as const).map(m => (
                  <button
                    key={m}
                    className="sr-touch-target"
                    onClick={() => setMediaViewMode(m)}
                    aria-pressed={mediaViewMode === m}
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
            <div role="group" aria-label="Media chart interval" style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {(['weekly', 'monthly', 'yearly', 'total'] as const).map(g => (
                <button
                  key={g}
                  className="sr-touch-target"
                  onClick={() => setMediaInterval(g)}
                  aria-pressed={mediaInterval === g}
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
            <div style={{ height: 240, marginBottom: 20 }} role="img" aria-label="Line chart of media uploaded over time: photo, audio, video, and total counts">
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
                    trigger="click"
                    wrapperStyle={{ pointerEvents: 'auto' }}
                    contentStyle={{ background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 8, fontSize: '0.75rem' }}
                    labelFormatter={key => mediaInterval === 'total'
                      ? fmtDate(String(key))
                      : formatPeriodLabel(String(key), mediaInterval as PeriodGranularity)}
                  />
                  <Legend wrapperStyle={{ fontSize: '0.6875rem' }} />
                  {/* Per-series dash patterns + distinct legend marker shapes so
                      the four lines differ by more than hue (1.4.1 Use of Color);
                      color-blind users can otherwise confuse photo/video. F071. */}
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="photo" name="Photo" stroke="var(--sr-graph-photo)" strokeWidth={2} dot={false} legendType="circle" />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="audio" name="Audio" stroke="var(--sr-graph-audio)" strokeWidth={2} dot={false} strokeDasharray="6 3" legendType="square" />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="video" name="Video" stroke="var(--sr-graph-video)" strokeWidth={2} dot={false} strokeDasharray="2 3" legendType="triangle" />
                  <Line type={mediaInterval === 'total' ? 'stepAfter' : 'monotone'} dataKey="total" name="Total" stroke="var(--sr-graph-media-total)" strokeWidth={2} dot={false} strokeDasharray="8 3 2 3" legendType="cross" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          )}

          <MediaStatsSections
            stats={mediaStats}
            escapeesExcluded={excludedNames.size > 0}
            taxonOrderFor={orderFor}
            userId={mlUserId}
            renderName={name => (
              <BirdName commonName={name} taxonCode={codeFor(name)} hasEntry={hasEntryFor(name)} onOpenSpecies={onOpenSpecies} size="sm" />
            )}
          />

          {/* Rankings — separated from the MediaStatsSections block above so the
              last section can't run into "Most photographed". */}
          {(mlStats.mostPhotographed.length > 0 || mlStats.mostAudio.length > 0 || mlStats.mostVideo.length > 0) && <Divider />}
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
                    <OutboundLink
                      href={mlCatalogUrl(entry.name, 'Photo', mlUserId, codeFor(entry.name))}
                      style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {fmt(entry.count)} photos
                    </OutboundLink>
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
                    <OutboundLink
                      href={mlCatalogUrl(entry.name, 'Audio', mlUserId, codeFor(entry.name))}
                      style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {fmt(entry.count)} recordings
                    </OutboundLink>
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
                    <OutboundLink
                      href={mlCatalogUrl(entry.name, 'Video', mlUserId, codeFor(entry.name))}
                      style={{ fontSize: '0.6875rem', color: 'var(--sr-accent)', textDecoration: 'none', flexShrink: 0 }}
                    >
                      {fmt(entry.count)} videos
                    </OutboundLink>
                  </div>
                ))}
              </div>
            </>
          )}
        </SectionCard>
      )}

      {/* ── Section 9: Frivolous Lists ───────────────────────────────────────── */}
      <SectionCard title="Frivolous Lists" icon={<Sparkles size={16} />}>
        <FrivolousListsSections
          observations={effectiveObs}
          excludedNames={excludedNames}
          codeFor={codeFor}
          hasEntryFor={hasEntryFor}
          onOpenSpecies={onOpenSpecies}
        />
      </SectionCard>

      </>
      )}
    </div>
  )
}
