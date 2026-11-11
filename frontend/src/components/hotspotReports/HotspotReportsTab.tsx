// The Hotspot Reports tab (hotspot-reports). A report for any one location in
// the user's own eBird backup, a public hotspot or a personal location, chosen
// from a searchable picker; before a choice, a short set of general statistics.
//
// Data flow (schema section 1): the two stored files load through the shared
// caches; pass I (the location index) and pass M (the ML join) run once per
// files epoch inside the load effect, after the awaited loads, never in a
// render body. Everything else is a memo: the overview's totals and ranks per
// index or escapee-set change, the kind split per hotspot-Set change, and one
// location's facts per selection or epoch, with the species rule applied over
// them per escapee-set change. A picker press builds nothing file-scaled.
//
// WHAT HOLDS THE INDEX is the `ready` phase and nothing else (NFR-04, schema
// 7.1): no module of this feature keeps a module-scoped collection, so a
// replace or a clear leaves the previous index unreachable.
//
// NOTHING IS PERSISTED (FR-58): the selection is session state, keyed on the
// Location ID, and dropped silently when a new backup lacks it (FR-57).
//
// REQUESTS (NFR-01): the tab reads the hotspot kind passively through the shared
// Set (`useHotspotSet` starts the shared build; it adds no request of its own),
// reads the escapee classification passively, and makes ONE request of its own:
// the batched `/taxonomy/codes` post for the selected location's names, at most
// once per change in the names a report shows, never on the overview.

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { Loader2, MapPinned } from 'lucide-react'
import type { ObservationEntry } from '../../types'
import { SetupRequired } from '../SetupRequired'
import { TabLoadErrorAlert } from '../ui/TabLoadErrorAlert'
import { EBIRD_BACKUP_STEPS, EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { storage } from '../../lib/storage'
import { transport } from '../../lib/transport'
import { loadEbirdObservations } from '../../lib/observationsCache'
import { loadMLExport } from '../../lib/mlExportCache'
import { useFilesEpoch } from '../../lib/useFilesEpoch'
import { useKeysEpoch } from '../../lib/useKeysEpoch'
import { useOnline } from '../../lib/useOnline'
import { prefersReducedMotion } from '../../lib/scroll'
import { useHotspotSet, useHotspotResolution } from '../../lib/useHotspotSet'
import { computeHotspotShare } from '../../lib/hotspotShare'
import { withNormalizedParents } from '../../lib/speciesUtils'
import {
  buildLocationIndex, deriveMediaCounts, rankLocations, speciesTotals, type LocationIndex,
} from '../../lib/hotspotReports'
import { kindOf, kindReason } from '../../lib/hotspotReportsKind'
import { applySpeciesRule, deriveLocationFacts, weatherView } from '../../lib/hotspotReportsLocation'
import { useHotspotReportsEscapees } from '../../lib/hotspotReportsProvenance'
import {
  LOADING_LABEL, NO_LOCATIONS, SETUP_BODY, SETUP_TITLE, TAB_DESCRIPTION, TAB_TITLE,
  announceLocation, announceOverview, displayName,
} from '../../lib/hotspotReportsCopy'
import { HotspotReportsPicker } from './HotspotReportsPicker'
import { HotspotReportsOverview } from './HotspotReportsOverview'
import { HotspotReport } from './HotspotReport'
import type { MediaState } from './HotspotReportSections'

type Media = { tag: 'none' } | { tag: 'unreadable' } | { tag: 'ready'; counts: Int32Array }

type Phase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: readonly ObservationEntry[]; index: LocationIndex; media: Media }

const EMPTY_OBS: readonly ObservationEntry[] = []

export interface HotspotReportsTabProps {
  onGoToSettings: () => void
  onOpenSpecies?: (commonName: string) => void
}

export function HotspotReportsTab({ onGoToSettings, onOpenSpecies }: HotspotReportsTabProps) {
  const filesEpoch = useFilesEpoch()
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' })
  // A Location ID, or null for the overview. Session only (FR-58).
  const [selectedId, setSelectedId] = useState<string | null>(null)
  // Advances on every selection change (picker, ranked row), never on an epoch:
  // it re-keys the announcement, replays the view's entrance, and restarts the
  // life list's pager.
  const [selectionSeq, setSelectionSeq] = useState(0)
  const [announcement, setAnnouncement] = useState<string | null>(null)
  const [focusHeadingSeq, setFocusHeadingSeq] = useState(0)
  const headingRef = useRef<HTMLHeadingElement>(null)
  const viewRef = useRef<HTMLDivElement>(null)
  // The resolved taxon codes for names this epoch's reports have shown. A Map,
  // so a species name is never an object key; cleared at every epoch.
  const [codes, setCodes] = useState<ReadonlyMap<string, string>>(() => new Map())
  // Names asked this epoch: in flight, or answered (with a code or without
  // one), so a name is posted at most once per epoch; a failed post releases
  // its names for the next selection.
  const asked = useRef<Set<string>>(new Set())
  const codesEpoch = useRef(0)

  // ── Load (FR-06 to FR-09, FR-57): re-runs on every files-epoch bump ───────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setPhase({ tag: 'loading' })
      try {
        // A rejection lands in the catch: UNKNOWN, never the setup panel.
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); setSelectedId(null); return }
        // loadMLExport resolves null on a read OR a parse failure; the .catch is
        // defense in depth, so an optional ML failure is never blamed on the backup.
        const [ebird, ml] = await Promise.all([loadEbirdObservations(), loadMLExport().catch(() => null)])
        if (cancelled) return
        if (!ebird) { setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR }); setSelectedId(null); return }
        const index = buildLocationIndex(ebird.observations)
        // The metadata record tells "no file" from "unreadable" (FR-09, FR-55).
        const media: Media = !status.ml
          ? { tag: 'none' }
          : ml ? { tag: 'ready', counts: deriveMediaCounts(ml.rows, index) } : { tag: 'unreadable' }
        if (cancelled) return
        setPhase({ tag: 'ready', observations: ebird.observations, index, media })
        // A selection the new backup still holds re-derives in place; one it
        // lacks is dropped silently, with no message (FR-57, QA-55).
        setSelectedId(prev => (prev !== null && index.ordById.has(prev) ? prev : null))
        // Nothing keyed on the old file's names outlives it.
        codesEpoch.current += 1
        asked.current = new Set()
        setCodes(new Map())
      } catch {
        if (!cancelled) { setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR }); setSelectedId(null) }
      }
    }
    void load()
    return () => { cancelled = true }
  }, [filesEpoch])

  // ── The eBird key, for the count block's reason only (FR-27) ──────────────
  const keysEpoch = useKeysEpoch()
  const [hasEbirdKey, setHasEbirdKey] = useState<boolean | null>(null)
  useEffect(() => {
    void keysEpoch
    let cancelled = false
    storage.getApiKey('ebird')
      .then(k => { if (!cancelled) setHasEbirdKey(!!k) })
      .catch(() => { if (!cancelled) setHasEbirdKey(false) })
    return () => { cancelled = true }
  }, [keysEpoch])
  const online = useOnline()

  // ── Memos (schema 7.3) ────────────────────────────────────────────────────
  // useHotspotSet() starts the shared build and must sit in the SAME component
  // as useHotspotResolution(): its resolved load is what re-renders this
  // component so the passive snapshot is adopted (lib/useHotspotSet.ts).
  useHotspotSet()
  const resolution = useHotspotResolution()
  const ready = phase.tag === 'ready' ? phase : null
  const index = ready ? ready.index : null
  const observations = ready ? ready.observations : EMPTY_OBS
  const escapees = useHotspotReportsEscapees(index, observations)
  const share = useMemo(() => (index ? computeHotspotShare(index.locations, resolution) : null), [index, resolution])
  const totals = useMemo(() => (index ? speciesTotals(index, escapees) : null), [index, escapees])
  const ranks = useMemo(() => (index && totals ? rankLocations(index, totals) : null), [index, totals])
  const ord = index === null || selectedId === null ? undefined : index.ordById.get(selectedId)
  const facts = useMemo(
    () => (index === null || ord === undefined ? null : deriveLocationFacts(index, observations, ord)),
    [index, observations, ord],
  )
  const species = useMemo(() => (facts === null ? null : applySpeciesRule(facts, escapees)), [facts, escapees])
  const weather = useMemo(() => (facts === null ? null : weatherView(facts.weather)), [facts])

  // ── The codes batch (schema 7.5): the selected location's names, accumulated ─
  useEffect(() => {
    if (facts === null) return
    const missing: [string, string][] = []
    for (const f of facts.species) {
      if (f.first === null || asked.current.has(f.name)) continue
      missing.push([f.name, f.first.scientificName])
    }
    if (missing.length === 0) return
    const names = missing.map(m => m[0])
    for (const n of names) asked.current.add(n)
    const epochAtAsk = codesEpoch.current
    transport.post<{ codes?: Record<string, string> }>('/taxonomy/codes', { species: withNormalizedParents(missing) })
      .then(data => {
        if (codesEpoch.current !== epochAtAsk) return
        const got = data.codes ?? {}
        setCodes(prev => {
          const next = new Map(prev)
          for (const n of names) if (Object.hasOwn(got, n) && typeof got[n] === 'string') next.set(n, got[n])
          return next
        })
      })
      .catch(() => {
        // Marks stay absent; the names are eligible again at the next selection.
        if (codesEpoch.current === epochAtAsk) for (const n of names) asked.current.delete(n)
      })
  }, [facts])
  const codeFor = (name: string): string | undefined => codes.get(name)

  // ── Focus and the view's entrance ────────────────────────────────────────
  // After a ranked-row press focus lands on the report's name heading (FR-30;
  // never the picker, whose focus opens its list, and never <body>).
  useEffect(() => {
    if (focusHeadingSeq > 0) headingRef.current?.focus()
  }, [focusHeadingSeq])
  // The overview-to-report, report-to-overview and report-to-report entrance
  // (design-spec Motion Spec). Run through the Web Animations API on the view
  // rather than by re-keying it, so the report's one map instance is never
  // remounted by a change of location (schema section 9). Reduced motion runs
  // nothing at all.
  useLayoutEffect(() => {
    const el = viewRef.current
    if (selectionSeq === 0 || el === null || typeof el.animate !== 'function' || prefersReducedMotion()) return
    el.animate(
      [{ opacity: 0, transform: 'translateY(0.1875rem)' }, { opacity: 1, transform: 'none' }],
      { duration: 160, easing: 'cubic-bezier(0.16, 1, 0.3, 1)' },
    )
  }, [selectionSeq])

  /** The one selection handler for the picker and the ranked rows (FR-24, FR-25, FR-30). */
  const select = (next: number | null, from: 'picker' | 'ranked') => {
    if (index === null || totals === null) return
    const rec = next === null ? null : index.locations[next]
    setSelectedId(rec === null ? null : rec.locationId)
    setSelectionSeq(s => s + 1)
    setAnnouncement(rec === null
      ? announceOverview(index.locations.length)
      : announceLocation(displayName(rec.name, rec.truncated), totals[rec.ord], index.checklistCount[rec.ord]))
    if (from === 'ranked' && rec !== null) setFocusHeadingSeq(s => s + 1)
  }

  const header = (
    <div className="sr-hsr-head">
      <div className="sr-hsr-head-tile">
        <MapPinned size={15} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div>
        <h2>{TAB_TITLE}</h2>
        <p>{TAB_DESCRIPTION}</p>
      </div>
    </div>
  )

  // ── Phase gates (FR-07) ───────────────────────────────────────────────────
  // The load-failure region is the first child of every branch, so React keeps
  // it as one DOM node across phases and it is in the accessibility tree before
  // its message arrives (ui.md v1.0.15).
  if (!ready || index === null || share === null || totals === null || ranks === null) {
    return (
      <div className="sr-hsr-tab">
        <TabLoadErrorAlert message={phase.tag === 'error' ? phase.message : null} onGoToSettings={onGoToSettings} />
        {phase.tag === 'setup-required' ? header : null}
        {phase.tag === 'setup-required' ? (
          <SetupRequired title={SETUP_TITLE} body={SETUP_BODY} steps={EBIRD_BACKUP_STEPS} onGoToSettings={onGoToSettings} />
        ) : phase.tag === 'error' ? null : (
          <div role="status" aria-label={LOADING_LABEL} className="sr-hsr-loading">
            <Loader2 size={24} strokeWidth={2} className="spin" aria-hidden="true" />
          </div>
        )}
      </div>
    )
  }

  const noLocations = index.locations.length === 0
  const rec = ord === undefined ? null : index.locations[ord]
  const media: MediaState = ready.media.tag !== 'ready' || rec === null
    ? (ready.media.tag === 'ready' ? { tag: 'ready', photo: 0, audio: 0, video: 0 } : ready.media)
    : { tag: 'ready', photo: ready.media.counts[rec.ord * 3], audio: ready.media.counts[rec.ord * 3 + 1], video: ready.media.counts[rec.ord * 3 + 2] }

  return (
    <div className="sr-hsr-tab">
      <TabLoadErrorAlert message={null} onGoToSettings={onGoToSettings} />
      {header}
      <HotspotReportsPicker
        index={index}
        selectedOrd={ord ?? null}
        onSelect={next => select(next, 'picker')}
        resolution={resolution}
      />
      {/* Always mounted while ready, before its first message; holds only the
          sentence, in a sequence-keyed child so a repeat is still announced. */}
      <div className="sr-only" role="status" aria-live="polite">
        {announcement !== null ? <span key={selectionSeq}>{announcement}</span> : null}
      </div>
      {noLocations ? (
        <p className="sr-hsr-body-text">{NO_LOCATIONS}</p>
      ) : (
        <div className="sr-hsr-view" ref={viewRef}>
          {rec === null || facts === null || species === null || weather === null ? (
            <HotspotReportsOverview
              index={index}
              share={share}
              reason={kindReason(share, { hasEbirdKey, online })}
              resolution={resolution}
              ranks={ranks}
              totals={totals}
              onSelectRanked={next => select(next, 'ranked')}
              onGoToSettings={onGoToSettings}
            />
          ) : (
            <HotspotReport
              rec={rec}
              kind={kindOf(rec, resolution)}
              showId={index.showId[rec.ord] === 1}
              facts={facts}
              species={species}
              weather={weather}
              media={media}
              selectionSeq={selectionSeq}
              headingRef={headingRef}
              codeFor={codeFor}
              onOpenSpecies={onOpenSpecies}
            />
          )}
        </div>
      )}
    </div>
  )
}
