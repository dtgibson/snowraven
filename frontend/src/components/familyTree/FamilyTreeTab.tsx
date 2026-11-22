// The Family Tree tab (family-rollups-and-tree). The birder's own life list
// arranged by eBird's classification, order, family, genus and species: a table
// of every order and family they have recorded, with species seen of world
// species and their photo, audio and video coverage, each family opening to its
// genera and species.
//
// Data flow (schema section 1): the two stored files load through the shared
// caches and the family asset through its lazy loader; Life Lists' own passes 1
// and 1R and this tab's year columns run once per files epoch inside the load
// effect, with a macrotask yield and a supersession check between them, never
// in a render body (NFR-02, D-07); the per-scope pass runs per Region or Year
// change and the model per control change, both memos. The escapee rule is
// read passively through Life Lists' reader (FR-20); the tab never starts the
// check. The one request it makes is the batched `/taxonomy/codes` post that
// feeds BirdName's marks and the completion check, once per distinct world
// roster (FR-51).
//
// The chosen Region and Names state are the only things here that touch the
// settings document: read in the load effect, written only on a user choice.
// Year, Media, Include Escapees, the sort and every open state are
// session-only. The tab's own code installs no document or window listener.

import {
  Suspense, lazy, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState,
  type CSSProperties, type Dispatch, type SetStateAction,
} from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Loader2, Maximize2, Minimize2, Network, Rows3 } from 'lucide-react'
import type { ObservationEntry } from '../../types'
import { SetupRequired } from '../SetupRequired'
import { TabLoadErrorAlert } from '../ui/TabLoadErrorAlert'
import { Button } from '../ui/Button'
import { EBIRD_BACKUP_STEPS, EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { storage } from '../../lib/storage'
import { transport } from '../../lib/transport'
import { loadEbirdObservations } from '../../lib/observationsCache'
import { loadMLExport } from '../../lib/mlExportCache'
import { useFilesEpoch } from '../../lib/useFilesEpoch'
import { useMapFullscreen } from '../../lib/useMapFullscreen'
import { EXIT_FULLSCREEN_LABEL, EXIT_WORD } from '../../lib/mapStillCopy'
import { FsOpenRow } from '../ui/FsOpenRow'
import { ChartViewTip } from '../ChartViewTip'
import { normalizeSpeciesName, withNormalizedParents } from '../../lib/speciesUtils'
import { deriveFirstSightings } from '../../lib/lifeLists'
import { deriveRegionIndex, findChoice, sameRegion, type RegionRef } from '../../lib/lifeListsRegion'
import { useLifeListsProvenance } from '../../lib/lifeListsProvenance'
import { loadFamilyIndex, type FamilyIndex } from '../../lib/familyTreeAsset'
import { deriveScope, deriveYearColumns, newYearCache, type ScopeBase, type YearCache } from '../../lib/familyTreeScope'
import {
  EXPAND_CHUNK_SPECIES, NO_MEDIA_CONSTRAINTS, SORT_KEYS, buildFamilyModel, expandSteps, nextKindState, worldCounts,
  type FamilyModel, type MediaConstraints, type SortKey, type WorldCounts,
} from '../../lib/familyTreeModel'
import {
  FAMILY_TREE_NAMES_SETTING, FAMILY_TREE_REGION_SETTING, FAMILY_TREE_VIEW_SETTING, defaultViewFor, parseStoredNames,
  parseStoredRegion, parseStoredView,
  type FamilyTreeNames, type FamilyTreeView,
} from '../../lib/familyTreeSettings'
import { buildFindIndex, type FindRow } from '../../lib/familyTreeFind'
import {
  COLLAPSE_ALL, EMPTY_FILTERED, EMPTY_UNFILTERED, ESCAPEE_STATUS, EXPAND_ALL, FAMILY_DATA_ERROR, FILTER_NOTE,
  HEADLINE_LABELS, LOADING_LABEL, NAMES_GROUP_LABEL, NAMES_LABELS, SETUP_BODY, SETUP_TITLE, SORT_LABEL, SORT_LABELS,
  TAB_DESCRIPTION, TAB_TITLE, TOOLS_LABEL, VIEW_GROUP_LABEL, VIEW_LABELS, barWidth, formatCount, headlineSentence,
  mediaScopeParts, notSingleSpeciesLine, notPlacedLine, ofWorld, share, showInTable,
  ENTER_FULLSCREEN_LABEL, OPEN_TREE_LABEL, OPEN_TREE_NOTE, TREE_TIP_BODY, TREE_TIP_LABEL, stillName,
  type KindKey,
} from '../../lib/familyTreeCopy'
import { FamilyTreeControls, type MlAvailability } from './FamilyTreeControls'
import { FamilyTreeRollup, NOT_PLACED_KEY } from './FamilyTreeRollup'
import { FamilyTreeFind } from './FamilyTreeFind'
import type { DiagramApi, TreeSession } from './FamilyTreeDiagram'

// The tree view is its own chunk with its layout module (schema 13): the table
// path never loads it until the tree is chosen.
const FamilyTreeDiagram = lazy(() => import('./FamilyTreeDiagram'))

/** The tree's session before its first layout: full zoom, from the top, nothing active. */
const NEW_TREE_SESSION: TreeSession = { exp: null, active: null, view: { zoom: 1, atFit: false, anchor: null } }

type MlState = { tag: 'none' } | { tag: 'unreadable' } | { tag: 'ready' }

type Phase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | {
    tag: 'ready'
    base: ScopeBase
    index: FamilyIndex
    world: WorldCounts
    ml: MlState
    /** The validated saved choices, re-read at every epoch. */
    rememberedRegion: RegionRef | null
    rememberedNames: FamilyTreeNames
    /** null when no view has been stored (FR-53's first use). */
    rememberedView: FamilyTreeView | null
  }

interface CodeRequest {
  readonly key: string
  readonly species: { commonName: string; scientificName: string }[]
}

const EMPTY_OBS: readonly ObservationEntry[] = []
const EMPTY_OPEN: ReadonlySet<number> = new Set()
const EMPTY_PARTIAL: ReadonlyMap<number, number> = new Map()
/** A running Expand all's rows mounted so far, per key, for the model it was planned on. */
interface PartialState { readonly model: FamilyModel | null; readonly map: ReadonlyMap<number, number> }
const NO_PARTIAL: PartialState = { model: null, map: EMPTY_PARTIAL }

/** How long the load waits for a saved choice before reading the default. */
const SAVED_READ_MS = 10_000

/**
 * A saved choice's read, which never rejects and always settles (CLAUDE.md,
 * promise boundaries; Life Lists' `readSavedRegion` shape): the seam's
 * rejection reads as nothing saved, and so does a read still pending after
 * SAVED_READ_MS, so this cannot hold the tab on its loading state.
 */
function readSaved(key: string): Promise<unknown> {
  return new Promise(resolve => {
    const timer = setTimeout(() => resolve(null), SAVED_READ_MS)
    const done = (v: unknown) => { clearTimeout(timer); resolve(v) }
    Promise.resolve()
      .then(() => storage.getSetting<unknown>(key))
      .then(done, () => done(null))
  })
}

/** One macrotask, so input is handled between the load's passes (D-07). */
function yieldTask(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/** The asset's own failure settles as a tagged value, never as a backup failure. */
type AssetResult = { ok: true; index: FamilyIndex } | { ok: false }

/**
 * The load (FR-13 to FR-17), re-run on every files-epoch bump. It is a hook of
 * its own, outside the tab's render scope, for memory (QA-78, NFR-05): a
 * closure created in a render keeps that render's whole scope alive, and the
 * effect a files-epoch bump re-runs is created in the render that still shows
 * the previous file, so its cleanup kept the previous parse and every pass over
 * it until the next change. Here its closures see only these arguments, all
 * stable (state setters and a callback made in the first render).
 */
function useFamilyTreeLoad(
  filesEpoch: number,
  setPhase: Dispatch<SetStateAction<Phase>>,
  /** Advances the Expand all run and clears its partial state (stable). */
  onLoaded: () => void,
  setCodeRequest: Dispatch<SetStateAction<CodeRequest | null>>,
  setYear: Dispatch<SetStateAction<number | null>>,
): void {
  useEffect(() => {
    let cancelled = false
    async function load() {
      setPhase({ tag: 'loading' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        const assetLoad: Promise<AssetResult> = loadFamilyIndex().then(index => ({ ok: true as const, index }), () => ({ ok: false as const }))
        const [ebird, ml, savedRegion, savedNames, savedView, asset] = await Promise.all([
          loadEbirdObservations(), loadMLExport().catch(() => null),
          readSaved(FAMILY_TREE_REGION_SETTING), readSaved(FAMILY_TREE_NAMES_SETTING), readSaved(FAMILY_TREE_VIEW_SETTING), assetLoad,
        ])
        if (cancelled) return
        if (!ebird) { setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR }); return }
        if (!asset.ok) { setPhase({ tag: 'error', message: FAMILY_DATA_ERROR }); return }
        const obs = ebird.observations
        const mlRows = status.ml && ml ? ml.rows : null
        await yieldTask()
        if (cancelled) return
        const firsts = deriveFirstSightings(obs)
        await yieldTask()
        if (cancelled) return
        const index = deriveRegionIndex(obs)
        await yieldTask()
        if (cancelled) return
        const columns = deriveYearColumns(obs, mlRows)
        const world = worldCounts(asset.index, firsts)
        const mlState: MlState = !status.ml ? { tag: 'none' } : ml ? { tag: 'ready' } : { tag: 'unreadable' }
        const names = [...firsts.keys()].sort()
        const key = JSON.stringify(names)
        const species = withNormalizedParents(names.map(n => [n, firsts.get(n)!.scientificName] as const))
        if (cancelled) return
        onLoaded()
        setPhase({
          tag: 'ready',
          base: { observations: obs, mlRows, firsts, index, columns },
          index: asset.index,
          world,
          ml: mlState,
          rememberedRegion: parseStoredRegion(savedRegion),
          rememberedNames: parseStoredNames(savedNames),
          rememberedView: parseStoredView(savedView),
        })
        setCodeRequest(prev => (prev !== null && prev.key === key ? prev : { key, species }))
        // FR-17: a year the new backup lacks falls back to all years.
        setYear(y => (y !== null && !columns.years.includes(y) ? null : y))
      } catch {
        if (!cancelled) setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [filesEpoch, setPhase, onLoaded, setCodeRequest, setYear])
}

/** The alert's Reload for a failed family asset (schema 8.2). */
function reloadPage(): void {
  window.location.reload()
}

export interface FamilyTreeTabProps {
  onGoToSettings: () => void
  onOpenSpecies?: (commonName: string) => void
  /** `activeTab === 'family-tree'` in App.tsx. */
  showing: boolean
}

export function FamilyTreeTab({ onGoToSettings, onOpenSpecies, showing }: FamilyTreeTabProps) {
  const filesEpoch = useFilesEpoch()
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' })
  const [codeRequest, setCodeRequest] = useState<CodeRequest | null>(null)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const [codesKey, setCodesKey] = useState<string | null>(null)

  // Session-only (FR-32): the saved value governs until the user chooses.
  const [sessionRegion, setSessionRegion] = useState<RegionRef | null | undefined>(undefined)
  const [sessionNames, setSessionNames] = useState<FamilyTreeNames | undefined>(undefined)
  const [year, setYear] = useState<number | null>(null)
  const [media, setMedia] = useState<MediaConstraints>(NO_MEDIA_CONSTRAINTS)
  const [includeEscapees, setIncludeEscapees] = useState(false)
  const [sort, setSort] = useState<SortKey>('taxonomic')
  const [open, setOpen] = useState<ReadonlySet<number>>(EMPTY_OPEN)
  const [fresh, setFresh] = useState<ReadonlySet<number>>(EMPTY_OPEN)
  // Expand all's families still being mounted (schema 9.2 as amended, D-43).
  // Every change that advances expandRun clears it; a model change makes it
  // read as empty by identity, so no effect has to clear it.
  const [partialState, setPartialState] = useState<PartialState>(NO_PARTIAL)
  const [announceSeq, setAnnounceSeq] = useState(0)
  // FR-53, D-35: with nothing stored, the first view follows the window when
  // the tab opens and does not switch if the window later crosses the tier.
  // The tier is the full-screen hook's own (`fs.stillTier`, schema 11.10), so
  // the first view is latched while rendering, once the hook has answered.
  const [firstView, setFirstView] = useState<FamilyTreeView | null>(null)
  const [sessionView, setSessionView] = useState<FamilyTreeView | undefined>(undefined)
  const viewWrite = useRef<Promise<void>>(Promise.resolve())
  const [treeSession, setTreeSession] = useState<TreeSession>(NEW_TREE_SESSION)
  const [toolsEl, setToolsEl] = useState<HTMLSpanElement | null>(null)
  const diagramApi = useRef<DiagramApi | null>(null)
  const hostRef = useRef<HTMLDivElement | null>(null)
  // A reveal in the table: applied after the commit that opens its family.
  const [tableReveal, setTableReveal] = useState<{ seq: number; selector: string; order: boolean } | null>(null)
  // One write at a time per key, in press order (each best-effort).
  const regionWrite = useRef<Promise<void>>(Promise.resolve())
  const namesWrite = useRef<Promise<void>>(Promise.resolve())
  // The table's Expand all run (schema 9.2): a token any superseding change advances.
  const expandRun = useRef(0)
  const uid = useId()
  const sortId = `${uid}-sort`

  // -- Load (FR-13 to FR-17): re-runs on every files-epoch bump ------------------
  // Made once, in the first render (no file loaded yet), so the load holds no
  // later render's scope through it either.
  const onLoaded = useCallback(() => {
    expandRun.current += 1
    setPartialState(NO_PARTIAL)
  }, [])
  useFamilyTreeLoad(filesEpoch, setPhase, onLoaded, setCodeRequest, setYear)

  // FR-14, schema 8.2 (QA round 2, N1): a failed family asset is terminal for
  // the session. A dynamic import whose fetch failed stays failed in WebKit and
  // Chromium, so showing the tab again could only re-read the file status; the
  // way back is the alert's Reload, the call the app's own error screen makes.
  const familyDataFailed = phase.tag === 'error' && phase.message === FAMILY_DATA_ERROR

  // -- The taxon-code batch: one post per distinct world roster -------------------
  useEffect(() => {
    if (codeRequest === null || codeRequest.species.length === 0) return
    let cancelled = false
    transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species: codeRequest.species })
      .then(data => {
        if (cancelled) return
        setTaxonMap(data.codes ?? {})
        setCodesKey(codeRequest.key)
      })
      .catch(() => { /* marks absent; names render and link without them */ })
    return () => { cancelled = true }
  }, [codeRequest])

  const ready = phase.tag === 'ready' ? phase : null
  const rosterCodes = codeRequest !== null && codesKey === codeRequest.key ? taxonMap : null
  const provenance = useLifeListsProvenance(ready ? ready.base.observations : EMPTY_OBS, rosterCodes)
  const mlAvailability: MlAvailability = ready ? ready.ml.tag : 'none'

  // -- The region (the Life Lists rule: a wanted region absent from the choices
  // reads as Everywhere, silently and with no write) -----------------------------
  const wanted = sessionRegion !== undefined ? sessionRegion : ready ? ready.rememberedRegion : null
  const choice = useMemo(() => (ready && wanted ? findChoice(ready.base.index.choices, wanted) : null), [ready, wanted])
  const region = choice ? choice.region : null
  const effectiveYear = ready && year !== null && ready.base.columns.years.includes(year) ? year : null
  const names: FamilyTreeNames = sessionNames ?? (ready ? ready.rememberedNames : 'both')
  // The control updates at once; the rows follow in a transition (schema 9.2).
  const rowNames = useDeferredValue(names)

  // -- S1 per Region or Year change, A1 per control or snapshot change -----------
  // The selected year's own Life Lists passes, kept for that year only: a
  // second region in the same year walks no observation row (schema 5.3).
  const yearCache = useMemo<YearCache | null>(
    () => (ready && effectiveYear !== null ? newYearCache(effectiveYear) : null), [ready, effectiveYear])
  const scope = useMemo(
    () => (ready ? deriveScope(ready.base, region, effectiveYear, yearCache) : null), [ready, region, effectiveYear, yearCache])

  const model = useMemo(() => {
    if (!ready || scope === null) return null
    return buildFamilyModel({
      index: ready.index, world: ready.world, scope, firsts: ready.base.firsts,
      escapees: provenance.escapees, includeEscapees, media, mediaReadable: ready.ml.tag === 'ready',
      scopeFiltered: region !== null || effectiveYear !== null,
    })
  }, [ready, scope, provenance.escapees, includeEscapees, media, region, effectiveYear])

  // Find's index, once per model; a Names change does not rebuild it (schema 12).
  const findIndex = useMemo(() => (ready && model ? buildFindIndex(model, ready.index) : null), [ready, model])
  const view: FamilyTreeView = sessionView ?? (ready && ready.rememberedView !== null ? ready.rememberedView : firstView ?? 'rollup')

  // -- Full screen: the fifth host of the shared hook (schema 11.9). `active`
  // is true only while the tree is ready, the view is the tree and the roster
  // is not empty, so a view switch, an empty filter, a reload or an error
  // collapses and releases by the hook's own rule. The tree draws its own still,
  // so the host takes `className`, never `hostClassName`.
  const fsActive = ready !== null && model !== null && view === 'diagram' && model.seen.species > 0
  const fs = useMapFullscreen({ containerRef: hostRef, baseClass: 'sr-ft-host', active: fsActive })
  const { stillTier, still: fsStill, expanded: fsExpanded, open: fsOpen, toggle: fsToggle, registerToggle } = fs
  if (firstView === null) setFirstView(defaultViewFor(stillTier))

  // Any change that rebuilds the model ends a running Expand all (schema 9.2).
  useEffect(() => { expandRun.current += 1 }, [model])

  const codeFor = useCallback((name: string): string | undefined => {
    if (Object.hasOwn(taxonMap, name)) return taxonMap[name]
    const norm = normalizeSpeciesName(name)
    return Object.hasOwn(taxonMap, norm) ? taxonMap[norm] : undefined
  }, [taxonMap])

  const pressed = () => setAnnounceSeq(s => s + 1)

  const selectRegion = (next: RegionRef | null) => {
    if (sameRegion(next, region)) return
    pressed()
    setSessionRegion(next)
    regionWrite.current = regionWrite.current
      .then(() => (next === null
        ? storage.deleteSetting(FAMILY_TREE_REGION_SETTING)
        : storage.setSetting(FAMILY_TREE_REGION_SETTING, next)))
      .catch(() => { /* a preference: best-effort */ })
  }
  const selectNames = (next: FamilyTreeNames) => {
    if (next === names) return
    setSessionNames(next)
    namesWrite.current = namesWrite.current
      .then(() => storage.setSetting(FAMILY_TREE_NAMES_SETTING, next))
      .catch(() => { /* a preference: best-effort */ })
  }
  const selectView = (next: FamilyTreeView) => {
    if (next === view) return
    setSessionView(next)
    viewWrite.current = viewWrite.current
      .then(() => storage.setSetting(FAMILY_TREE_VIEW_SETTING, next))
      .catch(() => { /* a preference: best-effort */ })
  }
  const cycleKind = (k: KindKey) => {
    pressed()
    setMedia(m => ({ ...m, [k]: nextKindState(m[k]) }))
  }

  const toggleOpen = useCallback((key: number) => {
    expandRun.current += 1
    setPartialState(NO_PARTIAL)
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setFresh(new Set([key]))
  }, [])

  /** Expand all in steps of exactly EXPAND_CHUNK_SPECIES rows, a family split
   *  across steps, with a yield between (schema 9.2 as amended, D-43): a timer
   *  chain started by the press, ended by any change that supersedes it. The
   *  entrance set is emptied once, at the start, never per step, so a family
   *  mounted earlier in the run never re-renders for a later one. */
  const expandAll = () => {
    if (model === null) return
    const token = ++expandRun.current
    const planned = model
    const steps = expandSteps(planned, EXPAND_CHUNK_SPECIES, NOT_PLACED_KEY, open)
    setFresh(EMPTY_OPEN)
    setPartialState(NO_PARTIAL)
    let i = 0
    const step = () => {
      if (expandRun.current !== token || i >= steps.length) return
      const entries = steps[i++]
      setOpen(prev => {
        const next = new Set(prev)
        for (const [k] of entries) next.add(k)
        return next
      })
      setPartialState(prev => {
        const map = new Map(prev.model === planned ? prev.map : EMPTY_PARTIAL)
        for (const [k, mounted, total] of entries) {
          if (mounted >= total) map.delete(k)
          else map.set(k, mounted)
        }
        return { model: planned, map }
      })
      if (i < steps.length) setTimeout(step, 0)
    }
    step()
  }
  const collapseAll = () => {
    expandRun.current += 1
    setPartialState(NO_PARTIAL)
    setOpen(EMPTY_OPEN)
    setFresh(EMPTY_OPEN)
  }
  const partial = model !== null && partialState.model === model ? partialState.map : EMPTY_PARTIAL

  // The table half of a find reveal (design-spec 8): after the commit that
  // opened its family, the row scrolls to the middle and takes focus; an
  // order's heading scrolls to the top and its first family row takes focus.
  useEffect(() => {
    const host = hostRef.current
    if (tableReveal === null || host === null) return
    const el = host.querySelector<HTMLElement>(tableReveal.selector)
    if (el === null) return
    el.scrollIntoView({ block: tableReveal.order ? 'start' : 'center' })
    const target = tableReveal.order
      ? el.querySelector<HTMLElement>('[data-ft-family]')
      : el.matches('button') ? el : el.querySelector<HTMLElement>('.sr-birdname-link, button')
    target?.focus({ preventScroll: true })
  }, [tableReveal])

  const revealInTable = (row: FindRow) => {
    if (!ready) return
    setSort('taxonomic')
    const seq = tableReveal === null ? 1 : tableReveal.seq + 1
    if (row.level === 'order') { setTableReveal({ seq, selector: `[data-ft-order="${row.ref}"]`, order: true }); return }
    const family = row.unplaced ? NOT_PLACED_KEY
      : row.level === 'family' ? row.ref
        : row.level === 'genus' ? ready.index.genera[row.ref].family
          : ready.index.speciesFamily[row.ref]
    expandRun.current += 1
    setPartialState(NO_PARTIAL)
    setOpen(prev => (prev.has(family) ? prev : new Set([...prev, family])))
    const selector = row.level === 'species' ? `[data-ft-sp="${row.unplaced ? 'u' : 's'}${row.ref}"]` : `[data-ft-family="${family}"]`
    setTableReveal({ seq, selector, order: false })
  }
  const chooseFound = (row: FindRow) => {
    if (view === 'diagram' && !row.unplaced) {
      const level = row.level === 'order' ? 0 : row.level === 'family' ? 1 : row.level === 'genus' ? 2 : 3
      // On the still, a result opens full screen and is revealed there (schema 12).
      if (fsStill) fsOpen()
      diagramApi.current?.reveal(level, row.ref)
      return
    }
    if (view === 'diagram') selectView('rollup')
    revealInTable(row)
  }
  const showUnplaced = () => {
    selectView('rollup')
    expandRun.current += 1
    setPartialState(NO_PARTIAL)
    setOpen(prev => (prev.has(NOT_PLACED_KEY) ? prev : new Set([...prev, NOT_PLACED_KEY])))
    setTableReveal(r => ({ seq: (r?.seq ?? 0) + 1, selector: `[data-ft-family="${NOT_PLACED_KEY}"]`, order: false }))
  }

  const header = (
    <div className="sr-ft-head">
      <div className="sr-ft-head-tile">
        <Network size={15} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div>
        <h2>{TAB_TITLE}</h2>
        <p>{TAB_DESCRIPTION}</p>
      </div>
    </div>
  )

  // -- Phase gates (FR-13 to FR-15): the alert region is the first child of
  // every branch, so React keeps it as one DOM node across phases (ui.md v1.0.15).
  if (!ready || model === null) {
    return (
      <div className="sr-ft-tab" data-media="off">
        <TabLoadErrorAlert
          message={phase.tag === 'error' ? phase.message : null}
          onGoToSettings={onGoToSettings}
          onReload={familyDataFailed ? reloadPage : undefined}
        />
        {phase.tag === 'setup-required' ? header : null}
        {phase.tag === 'setup-required' ? (
          <SetupRequired title={SETUP_TITLE} body={SETUP_BODY} steps={EBIRD_BACKUP_STEPS} onGoToSettings={onGoToSettings} />
        ) : phase.tag === 'error' ? null : (
          <div role="status" aria-label={LOADING_LABEL} className="sr-ft-loading">
            <Loader2 size={24} strokeWidth={2} className="spin" aria-hidden="true" />
          </div>
        )}
      </div>
    )
  }

  const showMedia = model.mediaShown
  const regionLabel = choice ? choice.label : null
  const scopeNote = showMedia ? mediaScopeParts(regionLabel, effectiveYear === null ? null : String(effectiveYear)) : null
  const empty = model.seen.species === 0
  // The toolbar's full-screen toggle, drawn here and never through the
  // diagram's portal, so it exists while the tree's chunk is pending (D-48). On
  // the still tier, expanded, it is the shared Exit form (the word shown by the
  // shared `.sr-map-fs-panel .sr-map-exit-label` rule); not rendered on the still.
  const fsToggleShown = view === 'diagram' && !empty && !fsStill
  const fsToggleButton = (
    <Button
      type="button"
      ref={registerToggle}
      // `sr-map-fullscreen-btn` is the shared handle (no declarations of its
      // own): the hook finds the toggle by it when focus must move on open,
      // and the phone tier's shared Exit pill rule is written against it.
      className="sr-ft-tool sr-ft-tool--icon sr-ft-fsbtn sr-map-fullscreen-btn sr-touch-target"
      aria-label={fsExpanded ? EXIT_FULLSCREEN_LABEL : ENTER_FULLSCREEN_LABEL}
      aria-pressed={fsExpanded}
      onClick={fsToggle}
    >
      {fsExpanded
        ? <Minimize2 size={15} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
        : <Maximize2 size={15} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />}
      {fsExpanded ? <span className="sr-map-exit-label">{EXIT_WORD}</span> : null}
    </Button>
  )
  const tiles: [keyof typeof HEADLINE_LABELS, number, number][] = [
    ['species', model.seen.species, model.world.species],
    ['families', model.seen.families, model.world.families],
    ['orders', model.seen.orders, model.world.orders],
  ]

  return (
    <div className="sr-ft-tab" data-media={showMedia ? 'on' : 'off'}>
      <TabLoadErrorAlert message={null} onGoToSettings={onGoToSettings} />
      {header}
      <div className="sr-ft-card">
        <FamilyTreeControls
          regionChoices={ready.base.index.choices}
          region={region}
          onSelectRegion={selectRegion}
          years={ready.base.columns.years}
          year={effectiveYear}
          onSelectYear={y => { pressed(); setYear(y) }}
          includeEscapees={includeEscapees}
          onToggleEscapees={() => { pressed(); setIncludeEscapees(v => !v) }}
          ml={mlAvailability}
          media={media}
          onCycleKind={cycleKind}
        />
        <dl className="sr-ft-glance">
          {tiles.map(([key, seen, world]) => (
            <div key={key} className="sr-ft-tile">
              <dt>{HEADLINE_LABELS[key]}</dt>
              <dd>
                <span className="sr-ft-tile-value">{formatCount(seen)}</span>
                <span className="sr-ft-tile-den">
                  <span>{ofWorld(world)}</span>
                  <span>{share(seen, world)}</span>
                </span>
                <span className={seen > 0 ? 'sr-ft-bar' : 'sr-ft-bar is-zero'} aria-hidden="true">
                  <i style={{ '--w': barWidth(seen, world) } as CSSProperties} />
                </span>
              </dd>
            </div>
          ))}
        </dl>
        <span className="sr-only" role="status" aria-live="polite">
          <span key={announceSeq}>{headlineSentence(model.seen.species, model.seen.families, model.seen.orders)}</span>
        </span>
        <div className="sr-ft-notes">
          {model.filtered && <p className="sr-ft-status">{FILTER_NOTE}</p>}
          {scopeNote !== null && (
            <p className="sr-ft-status">
              {scopeNote.before}
              {scopeNote.region !== null && <b>{scopeNote.region}</b>}
              {scopeNote.middle}
              {scopeNote.year !== null && <b>{scopeNote.year}</b>}
              {scopeNote.after}
            </p>
          )}
          {!provenance.checkComplete && <p className="sr-ft-status">{ESCAPEE_STATUS}</p>}
        </div>
        <div className="sr-ft-viewbar sr-ctl-row">
          <span role="group" aria-label={VIEW_GROUP_LABEL} className="sr-segbar sr-ft-viewseg">
            {(['rollup', 'diagram'] as const).map(v => (
              <Button
                key={v}
                type="button"
                className="sr-segbar-btn sr-touch-target"
                aria-pressed={view === v}
                onClick={() => selectView(v)}
              >
                {v === 'rollup'
                  ? <Rows3 size={13} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />
                  : <Network size={13} strokeWidth={2.2} className="sr-ft-tool-glyph" aria-hidden="true" />}
                {VIEW_LABELS[v]}
              </Button>
            ))}
          </span>
          <span role="group" aria-label={NAMES_GROUP_LABEL} className="sr-segbar sr-segbar--compact sr-ft-namesseg">
            {(['common', 'scientific', 'both'] as const).map(n => (
              <Button
                key={n}
                type="button"
                className="sr-segbar-btn sr-touch-target"
                aria-pressed={names === n}
                onClick={() => selectNames(n)}
              >
                {NAMES_LABELS[n]}
              </Button>
            ))}
          </span>
        </div>
        <div className={fs.className} data-view={view} ref={hostRef}>
          <div className="sr-ft-toolbar sr-ctl-row">
            {/* On the still tier the Exit leads the row by document order, so
                Tab meets it first (schema 11.9; never `order`, ui.md v0.5.80). */}
            {fsToggleShown && stillTier ? fsToggleButton : null}
            {findIndex !== null && !empty ? <FamilyTreeFind findIndex={findIndex} names={names} onChoose={chooseFound} /> : null}
            {view === 'rollup' ? (
            <span className="sr-ft-tablebar">
              <label className="sr-ctl-label sr-ft-label" htmlFor={sortId}>{SORT_LABEL}</label>
              <span className="sr-ft-selwrap">
                <select
                  id={sortId}
                  className="sr-ft-select sr-input-16"
                  value={sort}
                  onChange={e => { setFresh(EMPTY_OPEN); setSort(e.target.value as SortKey) }}
                >
                  {SORT_KEYS.filter(k => showMedia || (k !== 'photo' && k !== 'audio' && k !== 'video')).map(k => (
                    <option key={k} value={k}>{SORT_LABELS[k]}</option>
                  ))}
                </select>
                <ChevronDown size={12} strokeWidth={2.4} className="sr-ft-selcaret" aria-hidden="true" />
              </span>
            </span>
            ) : null}
            {/* The tools are not rendered on the still (design-spec 10.1). */}
            {view === 'rollup' || !fsStill ? (
            <span className="sr-ft-tools" role="toolbar" aria-label={TOOLS_LABEL} ref={setToolsEl}>
              {view === 'rollup' ? (
                <>
                  <Button type="button" className="sr-ft-tool sr-touch-target" onClick={expandAll} disabled={empty}>
                    <ChevronsUpDown size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span className="t">{EXPAND_ALL}</span>
                  </Button>
                  <Button type="button" className="sr-ft-tool sr-touch-target" onClick={collapseAll} disabled={empty}>
                    <ChevronsDownUp size={14} strokeWidth={2.2} aria-hidden="true" />
                    <span className="t">{COLLAPSE_ALL}</span>
                  </Button>
                </>
              ) : null}
            </span>
            ) : null}
            {fsToggleShown && !stillTier ? fsToggleButton : null}
          </div>
          {/* Kept mounted while expanded and not drawn there (the panel's
              rule), so on the way out the page has its height at once and the
              hook's restored scroll offset is not clamped short. */}
          {view === 'diagram' && !empty ? (
            <ChartViewTip page="family-tree" body={TREE_TIP_BODY} label={TREE_TIP_LABEL} />
          ) : null}
          {empty ? (
            <p className="sr-ft-empty">{model.filtered || includeEscapees ? EMPTY_FILTERED : EMPTY_UNFILTERED}</p>
          ) : view === 'diagram' ? (
            <Suspense fallback={<div className="sr-ft-treeview"><div className="sr-ft-boxwrap"><div className="sr-ft-box" /></div></div>}>
              <FamilyTreeDiagram
                model={model}
                index={ready.index}
                names={names}
                stillTier={stillTier}
                initial={treeSession}
                onSession={setTreeSession}
                showing={showing}
                still={fsStill}
                onOpen={fsOpen}
                stillLabel={stillName(model.seen.species, model.seen.families, model.seen.orders)}
                toolsEl={toolsEl}
                apiRef={diagramApi}
                codeFor={codeFor}
                onOpenSpecies={onOpenSpecies}
              />
            </Suspense>
          ) : (
            <FamilyTreeRollup
              model={model}
              index={ready.index}
              names={rowNames}
              sort={sort}
              open={open}
              partial={partial}
              fresh={fresh}
              onToggle={toggleOpen}
              codeFor={codeFor}
              onOpenSpecies={onOpenSpecies}
            />
          )}
        </div>
        {/* The opener: directly after the host, outside the box that expands,
            mounted while it is expanded, on the still tier in the tree view. */}
        {view === 'diagram' && !empty ? <FsOpenRow fs={fs} label={OPEN_TREE_LABEL} note={OPEN_TREE_NOTE} /> : null}
        {(model.unplaced.length > 0 || model.notSingleSpecies > 0) && (
          <div className={view === 'diagram' && !empty ? 'sr-ft-treefoot' : 'sr-ft-tablefoot'}>
            {model.unplaced.length > 0 && (
              <p className="sr-ft-status">
                {notPlacedLine(model.unplaced.length)}
                {view === 'diagram' && !empty ? (
                  <> <Button type="button" className="sr-ft-textbtn" onClick={showUnplaced}>{showInTable(model.unplaced.length)}</Button></>
                ) : null}
              </p>
            )}
            {model.notSingleSpecies > 0 && <p className="sr-ft-status">{notSingleSpeciesLine(model.notSingleSpecies)}</p>}
          </div>
        )}
      </div>
    </div>
  )
}
