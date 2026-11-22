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

import { Suspense, lazy, useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState, type CSSProperties } from 'react'
import { ChevronDown, ChevronsDownUp, ChevronsUpDown, Loader2, Network, Rows3 } from 'lucide-react'
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
import { useIsPhone } from '../../lib/useIsPhone'
import { normalizeSpeciesName, withNormalizedParents } from '../../lib/speciesUtils'
import { deriveFirstSightings } from '../../lib/lifeLists'
import { deriveRegionIndex, findChoice, sameRegion, type RegionRef } from '../../lib/lifeListsRegion'
import { useLifeListsProvenance } from '../../lib/lifeListsProvenance'
import { loadFamilyIndex, type FamilyIndex } from '../../lib/familyTreeAsset'
import { deriveScope, deriveYearColumns, newYearCache, type ScopeBase, type YearCache } from '../../lib/familyTreeScope'
import {
  EXPAND_CHUNK_SPECIES, NO_MEDIA_CONSTRAINTS, SORT_KEYS, buildFamilyModel, expandChunks, nextKindState, worldCounts,
  type MediaConstraints, type SortKey, type WorldCounts,
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

export interface FamilyTreeTabProps {
  onGoToSettings: () => void
  onOpenSpecies?: (commonName: string) => void
  /** `activeTab === 'family-tree'` in App.tsx. */
  showing: boolean
}

export function FamilyTreeTab({ onGoToSettings, onOpenSpecies, showing }: FamilyTreeTabProps) {
  const filesEpoch = useFilesEpoch()
  const [retrySeq, setRetrySeq] = useState(0)
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
  const [announceSeq, setAnnounceSeq] = useState(0)
  // FR-53, D-35: with nothing stored, the first view follows the window when
  // the tab opens and does not switch if the window later crosses the tier.
  const stillTier = useIsPhone()
  const [firstView] = useState<FamilyTreeView>(() => defaultViewFor(stillTier))
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
        expandRun.current += 1
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
  }, [filesEpoch, retrySeq])

  // FR-14: a failed family asset is tried again the next time the tab is shown.
  const familyDataFailed = phase.tag === 'error' && phase.message === FAMILY_DATA_ERROR
  const wasShowing = useRef(showing)
  useEffect(() => {
    if (showing && !wasShowing.current && familyDataFailed) setRetrySeq(s => s + 1)
    wasShowing.current = showing
  }, [showing, familyDataFailed])

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
  const view: FamilyTreeView = sessionView ?? (ready && ready.rememberedView !== null ? ready.rememberedView : firstView)

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
    setOpen(prev => {
      const next = new Set(prev)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
    setFresh(new Set([key]))
  }, [])

  /** Expand all in chunks of about EXPAND_CHUNK_SPECIES rows with a yield
   *  between (schema 9.2): a timer chain started by the press, ended by any
   *  change that supersedes it. */
  const expandAll = () => {
    if (model === null) return
    const token = ++expandRun.current
    const chunks = expandChunks(model, EXPAND_CHUNK_SPECIES)
    let i = 0
    const step = () => {
      if (expandRun.current !== token || i >= chunks.length) return
      const chunk = chunks[i++]
      setOpen(prev => {
        const next = new Set(prev)
        for (const k of chunk) next.add(k)
        return next
      })
      setFresh(new Set(chunk))
      if (i < chunks.length) setTimeout(step, 0)
    }
    step()
  }
  const collapseAll = () => {
    expandRun.current += 1
    setOpen(EMPTY_OPEN)
    setFresh(EMPTY_OPEN)
  }

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
    setOpen(prev => (prev.has(family) ? prev : new Set([...prev, family])))
    const selector = row.level === 'species' ? `[data-ft-sp="${row.unplaced ? 'u' : 's'}${row.ref}"]` : `[data-ft-family="${family}"]`
    setTableReveal({ seq, selector, order: false })
  }
  const chooseFound = (row: FindRow) => {
    if (view === 'diagram' && !row.unplaced) {
      const level = row.level === 'order' ? 0 : row.level === 'family' ? 1 : row.level === 'genus' ? 2 : 3
      diagramApi.current?.reveal(level, row.ref)
      return
    }
    if (view === 'diagram') selectView('rollup')
    revealInTable(row)
  }
  const showUnplaced = () => {
    selectView('rollup')
    expandRun.current += 1
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
        <TabLoadErrorAlert message={phase.tag === 'error' ? phase.message : null} onGoToSettings={onGoToSettings} />
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
        <div className="sr-ft-host" data-view={view} ref={hostRef}>
          <div className="sr-ft-toolbar sr-ctl-row">
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
          </div>
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
              fresh={fresh}
              onToggle={toggleOpen}
              codeFor={codeFor}
              onOpenSpecies={onOpenSpecies}
            />
          )}
        </div>
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
