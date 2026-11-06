// The Life Lists tab (life-lists-tab). Every species on the life list, newest
// first by its first sighting, or by its first photo, audio or video, or the
// day it first held every selected media type.
//
// Data flow (schema section 1): the two stored files load through the shared
// caches; passes 1 and 2 run once per files epoch inside the load effect, after
// the awaited loads, never in a render body; pass 3 is a memo over species. The
// provenance record is read passively (lifeListsProvenance.ts) and the tab
// never initiates a provenance request. The one request the tab makes is the
// batched `/taxonomy/codes` post that feeds BirdName's eBird and Birds of the
// World marks, once per distinct roster (section 5.4); it never blocks, delays
// or re-orders the list. The switches and the media selection are session-only
// `useState` (FR-36): nothing here touches the storage seam.

import { useEffect, useMemo, useRef, useState } from 'react'
import { ListChecks, Loader2 } from 'lucide-react'
import type { ObservationEntry } from '../../types'
import { SetupRequired } from '../SetupRequired'
import { TabLoadErrorAlert } from '../ui/TabLoadErrorAlert'
import { Button } from '../ui/Button'
import { EBIRD_BACKUP_STEPS, EBIRD_BACKUP_LOAD_ERROR } from '../setupCopy'
import { SectionCard } from '../speciesDetail/ui'
import { storage } from '../../lib/storage'
import { transport } from '../../lib/transport'
import { loadEbirdObservations } from '../../lib/observationsCache'
import { loadMLExport } from '../../lib/mlExportCache'
import { useFilesEpoch } from '../../lib/useFilesEpoch'
import { normalizeSpeciesName, withNormalizedParents } from '../../lib/speciesUtils'
import {
  deriveFirstAssets, deriveFirstSightings, selectRows,
  type FirstAssets, type FirstSighting, type MediaFormat,
} from '../../lib/lifeLists'
import { useLifeListsProvenance } from '../../lib/lifeListsProvenance'
import { pageList, PAGE_SIZE } from '../../lib/pageList'
import {
  LOADING_LABEL, SETUP_BODY, SETUP_TITLE, SHOW_NEXT_LABEL, STATUS_RESOLVED, STATUS_UNRESOLVED,
  TAB_DESCRIPTION, TAB_TITLE, countSentenceParts, emptySentence, showAllLabel, showingLabel,
} from '../../lib/lifeListsCopy'
import { LifeListsControls, type MlAvailability } from './LifeListsControls'
import { LifeListsRows } from './LifeListsRows'

type MlState =
  | { tag: 'none' }
  | { tag: 'unreadable' }
  | { tag: 'ready'; assets: Map<string, FirstAssets> }

type Phase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | {
    tag: 'ready'
    /** The cache's own array (never a copy), kept only as the stable input the
     *  provenance confirmation memoizes on. */
    observations: readonly ObservationEntry[]
    firsts: Map<string, FirstSighting>
    ml: MlState
  }

/** The codes batch for one roster NAME SET. Its identity changes only when the
 *  set does, so the batch effect re-issues nothing for a re-parse of the same
 *  species (QA-41). */
interface CodeRequest {
  readonly key: string
  readonly species: { commonName: string; scientificName: string }[]
}

const EMPTY_OBS: readonly ObservationEntry[] = []
const EMPTY_ASSETS: ReadonlyMap<string, FirstAssets> = new Map()
const EMPTY_FORMATS: ReadonlySet<MediaFormat> = new Set()

export interface LifeListsTabProps {
  onGoToSettings: () => void
  onOpenSpecies?: (commonName: string) => void
}

export function LifeListsTab({ onGoToSettings, onOpenSpecies }: LifeListsTabProps) {
  const filesEpoch = useFilesEpoch()
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' })
  const [codeRequest, setCodeRequest] = useState<CodeRequest | null>(null)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})

  const [includeEscapees, setIncludeEscapees] = useState(false)
  const [includeExotics, setIncludeExotics] = useState(false)
  const [formats, setFormats] = useState<ReadonlySet<MediaFormat>>(EMPTY_FORMATS)
  const [shown, setShown] = useState(PAGE_SIZE)
  // The live-region child's key: one per control press, so a repeated identical
  // sentence is still a real node replacement and is announced (ui.md v0.5.80).
  const [announceSeq, setAnnounceSeq] = useState(0)
  // The names shown before the last control press; a row outside it entered
  // with that press and animates in. Null on load, so first paint is instant.
  const [addedFrom, setAddedFrom] = useState<ReadonlySet<string> | null>(null)
  const [focusSeq, setFocusSeq] = useState(0)
  const countRef = useRef<HTMLParagraphElement>(null)

  // ── Load (FR-05 to FR-09): re-runs on every files-epoch bump ──────────────
  useEffect(() => {
    let cancelled = false
    async function load() {
      setPhase({ tag: 'loading' })
      try {
        // A rejection lands in the catch: UNKNOWN, never the setup panel.
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        // The .catch is defense in depth: loadMLExport resolves null on a read
        // OR a parse failure, so an optional ML failure can never be blamed on
        // the eBird backup (the Checklists shape).
        const [ebird, ml] = await Promise.all([loadEbirdObservations(), loadMLExport().catch(() => null)])
        if (cancelled) return
        if (!ebird) { setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR }); return }
        const firsts = deriveFirstSightings(ebird.observations)
        // loadMLExport is null for "no file" AND "unreadable", so the metadata
        // record tells the two FR-27 sentences apart (schema 5.2).
        const mlState: MlState = !status.ml
          ? { tag: 'none' }
          : ml ? { tag: 'ready', assets: deriveFirstAssets(ml.rows) } : { tag: 'unreadable' }
        // The roster's NAME SET as one unambiguous string. JSON, not a newline
        // join: a quoted CSV cell can carry an interior line break the parser's
        // trim keeps, so two different rosters could join to one key.
        const names = [...firsts.keys()].sort()
        const key = JSON.stringify(names)
        const species = withNormalizedParents(names.map(n => [n, firsts.get(n)!.scientificName] as const))
        if (cancelled) return
        setPhase({ tag: 'ready', observations: ebird.observations, firsts, ml: mlState })
        setCodeRequest(prev => (prev !== null && prev.key === key ? prev : { key, species }))
        if (mlState.tag !== 'ready') setFormats(EMPTY_FORMATS)
        setShown(PAGE_SIZE)
        setAddedFrom(null)
      } catch {
        if (!cancelled) setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR })
      }
    }
    void load()
    return () => { cancelled = true }
  }, [filesEpoch])

  // ── The taxon-code batch (FR-43): one post per distinct roster ────────────
  useEffect(() => {
    if (codeRequest === null || codeRequest.species.length === 0) return
    let cancelled = false
    transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species: codeRequest.species })
      .then(data => { if (!cancelled) setTaxonMap(data.codes ?? {}) })
      .catch(() => { /* marks absent until the next roster change; names render and link without them */ })
    return () => { cancelled = true }
  }, [codeRequest])

  // Focus anchor for paging (FR-37): when a control reveals the last row the
  // paging row unmounts, so focus moves to the count sentence, never <body>.
  useEffect(() => {
    if (focusSeq > 0) countRef.current?.focus()
  }, [focusSeq])

  const ready = phase.tag === 'ready' ? phase : null
  const provenance = useLifeListsProvenance(ready ? ready.observations : EMPTY_OBS)
  const mlAvailability: MlAvailability = ready ? ready.ml.tag : 'none'
  const effectiveFormats = mlAvailability === 'ready' ? formats : EMPTY_FORMATS

  // ── Pass 3 (FR-13, FR-18, FR-23 to FR-28): species-scaled, no file pass ──
  const rows = useMemo(() => {
    if (!ready) return []
    const assets = ready.ml.tag === 'ready' ? ready.ml.assets : EMPTY_ASSETS
    return selectRows(ready.firsts, assets, provenance, { includeEscapees, includeExotics, formats: effectiveFormats })
  }, [ready, provenance, includeEscapees, includeExotics, effectiveFormats])

  // The Checklists `codeFor`, read through Object.hasOwn because the table is
  // keyed by species names out of the user's CSV (security.md, v1.0.22).
  const codeFor = (name: string): string | undefined => {
    if (Object.hasOwn(taxonMap, name)) return taxonMap[name]
    const norm = normalizeSpeciesName(name)
    return Object.hasOwn(taxonMap, norm) ? taxonMap[norm] : undefined
  }

  /** Every control press: re-derive (by state), reset paging, record what was
   *  shown so a row the press adds can enter, and re-key the announcement. */
  const pressed = () => {
    setAddedFrom(new Set(rows.map(r => r.name)))
    setShown(PAGE_SIZE)
    setAnnounceSeq(s => s + 1)
  }
  const toggleFormat = (f: MediaFormat) => {
    pressed()
    setFormats(prev => {
      const next = new Set(prev)
      if (next.has(f)) next.delete(f)
      else next.add(f)
      return next
    })
  }

  const header = (
    <div className="sr-lfl-head">
      <div className="sr-lfl-head-tile">
        <ListChecks size={15} strokeWidth={2.2} aria-hidden="true" />
      </div>
      <div>
        <h2>{TAB_TITLE}</h2>
        <p>{TAB_DESCRIPTION}</p>
      </div>
    </div>
  )

  // ── Phase gates (FR-05 to FR-07) ─────────────────────────────────────────
  // The load-failure region is the first child of every branch, so React keeps
  // it as one DOM node across phases and it is in the accessibility tree before
  // its message arrives (ui.md v1.0.15, the Checklists gate).
  if (!ready) {
    return (
      <div className="sr-lfl-tab" data-media="off">
        <TabLoadErrorAlert message={phase.tag === 'error' ? phase.message : null} onGoToSettings={onGoToSettings} />
        {phase.tag === 'setup-required' ? header : null}
        {phase.tag === 'setup-required' ? (
          <SetupRequired title={SETUP_TITLE} body={SETUP_BODY} steps={EBIRD_BACKUP_STEPS} onGoToSettings={onGoToSettings} />
        ) : phase.tag === 'error' ? null : (
          <div role="status" aria-label={LOADING_LABEL} className="sr-lfl-loading">
            <Loader2 size={24} strokeWidth={2} className="spin" aria-hidden="true" />
          </div>
        )}
      </div>
    )
  }

  const paged = pageList(rows, shown)
  const { count, rest } = countSentenceParts(rows.length, effectiveFormats)
  const showMedia = mlAvailability === 'ready'

  return (
    <div className="sr-lfl-tab" data-media={showMedia ? 'on' : 'off'}>
      <TabLoadErrorAlert message={null} onGoToSettings={onGoToSettings} />
      {header}
      <SectionCard>
        <LifeListsControls
          includeEscapees={includeEscapees}
          includeExotics={includeExotics}
          formats={effectiveFormats}
          ml={mlAvailability}
          onToggleEscapees={() => { pressed(); setIncludeEscapees(v => !v) }}
          onToggleExotics={() => { pressed(); setIncludeExotics(v => !v) }}
          onToggleFormat={toggleFormat}
        />
        <div className="sr-lfl-lead">
          <p className="sr-lfl-count" tabIndex={-1} ref={countRef}><b>{count}</b>{rest}</p>
          <span className="sr-only" role="status" aria-live="polite">
            <span key={announceSeq}>{count}{rest}</span>
          </span>
          <p className="sr-lfl-status">
            {!provenance.exoticsPublished || !provenance.ledgerCoversExport ? STATUS_UNRESOLVED : STATUS_RESOLVED}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="sr-lfl-empty">{emptySentence(effectiveFormats)}</p>
        ) : (
          <>
            <LifeListsRows
              rows={paged.visible}
              total={rows.length}
              showMedia={showMedia}
              addedFrom={addedFrom}
              codeFor={codeFor}
              onOpenSpecies={onOpenSpecies}
            />
            {paged.hasMore && (
              <div className="sr-lfl-paging">
                <Button
                  type="button"
                  className="sr-lfl-next sr-touch-target"
                  onClick={() => {
                    setShown(paged.nextCount)
                    if (paged.nextCount >= rows.length) setFocusSeq(s => s + 1)
                  }}
                >
                  {SHOW_NEXT_LABEL}
                </Button>
                <Button
                  type="button"
                  className="sr-lfl-all sr-touch-target"
                  onClick={() => { setShown(rows.length); setFocusSeq(s => s + 1) }}
                >
                  {showAllLabel(rows.length)}
                </Button>
                <span className="sr-lfl-showing">{showingLabel(paged.visible.length)}</span>
              </div>
            )}
          </>
        )}
      </SectionCard>
    </div>
  )
}
