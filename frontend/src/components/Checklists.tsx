// The Checklists tab: every checklist as a whole outing. Three sections — a
// checklist-comment search box, an all-species species-comment search box, and a
// filterable expandable list of all checklists — under one tab-wide "Show
// weather & tide blocks" toggle (default hidden; while hidden, display AND
// search run on stripped text, and an empty-after-strip comment counts as no
// comment). Pure logic lives in lib/checklistsTab.ts; see
// pipeline/checklists-tab/{prd,design-spec}.md.

import { useEffect, useMemo, useState } from 'react'
import {
  Loader2, AlertCircle, ClipboardList, MessageSquare, MessagesSquare, Search,
  ChevronDown, Camera, Mic, Video, Egg, Paperclip, Check, X,
} from 'lucide-react'
import type { ObservationEntry } from '../types'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { storage } from '../lib/storage'
import { transport } from '../lib/transport'
import { loadEbirdObservations } from '../lib/observationsCache'
import { loadMLExport } from '../lib/mlExportCache'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { formatDate } from '../lib/formatDate'
import { protocolName, formatDuration, formatDistance, formatObservers } from '../lib/checklistMeta'
import {
  buildChecklistRows, buildChecklistComments, buildSpeciesComments,
  filterAndSortComments, filterChecklistRows, sortChecklistRows, displayComment,
  isPillFilterClear, CHECKLIST_FILTER_CLEAR,
  type ChecklistRowData, type ChecklistCommentEntry, type SpeciesCommentEntry,
  type ChecklistFilterState, type TriState,
} from '../lib/checklistsTab'
import { SectionCard } from './speciesDetail/ui'
import { ToggleSwitch } from './ui/ToggleSwitch'
import { CommentText } from './CommentText'
import { BirdName } from './BirdName'
import { ChecklistLink } from './ChecklistLink'
import { HotspotLink } from './HotspotLink'
import { useHotspotSet } from '../lib/useHotspotSet'

const PAGE = 10

type Phase =
  | { tag: 'loading-saved' }
  | { tag: 'setup-required' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[]; mediaMap: Record<string, string> | null }

type CommentSort = 'newest' | 'oldest'

// ── Small shared pieces ──────────────────────────────────────────────────────

function DateLink({ submissionId, date }: { submissionId: string; date: string }) {
  // The shared ChecklistLink is the single "open checklist on eBird" affordance
  // (F064) and carries the standing SUBMISSION_ID_RE shape check + new-tab name.
  return (
    <ChecklistLink
      submissionId={submissionId}
      label={formatDate(date)}
      style={{ fontSize: '0.75rem', fontWeight: 600, whiteSpace: 'nowrap', flexShrink: 0 }}
    />
  )
}

function SortSeg({ value, onChange }: { value: CommentSort; onChange: (v: CommentSort) => void }) {
  return (
    <div style={{ display: 'inline-flex', border: '1.5px solid var(--sr-accent-border)', borderRadius: 6, overflow: 'hidden', flexShrink: 0 }} role="group" aria-label="Sort order">
      {(['newest', 'oldest'] as const).map((dir, i) => (
        <button tabIndex={0}
          key={dir}
          onClick={() => onChange(dir)}
          aria-pressed={value === dir}
          style={{
            height: 32, padding: '0 12px', border: 'none',
            borderLeft: i > 0 ? '1.5px solid var(--sr-accent-border)' : 'none',
            background: value === dir ? 'var(--sr-accent-bg)' : 'transparent',
            color: value === dir ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
            fontSize: '0.75rem', fontWeight: value === dir ? 600 : 500, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          {dir === 'newest' ? 'Newest' : 'Oldest'}
        </button>
      ))}
    </div>
  )
}

// Stays mounted as a toggle ("Show all N" ⇄ "Show fewer") rather than
// unmounting on activation — an unmounting one-shot button drops keyboard focus
// to <body>, restarting the next Tab from the top of the page (F036).
function ShowAllButton({ count, noun, showAll, onToggle }: { count: number; noun: string; showAll: boolean; onToggle: () => void }) {
  return (
    <button tabIndex={0}
      onClick={onToggle}
      aria-expanded={showAll}
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
      <ChevronDown size={13} strokeWidth={2.5} style={{ transform: showAll ? 'rotate(180deg)' : 'none' }} />
      {showAll ? 'Show fewer' : `Show all ${count.toLocaleString()} ${noun}`}
    </button>
  )
}

function BoxHead({ icon, title, sub }: { icon: React.ReactNode; title: string; sub: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '14px 18px 12px', borderBottom: '1px solid var(--sr-border-subtle)', flexWrap: 'wrap' }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>{title}</span>
      <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>{sub}</span>
    </div>
  )
}

// Debounce a string into the text a live region announces, so rapid changes
// (typing in a filter) settle to one announcement instead of one per keystroke
// (F075). The visible value is rendered directly, immediate; only the polite
// announcement waits ~450ms after the value stops changing.
function useDebouncedText(value: string): string {
  const [announced, setAnnounced] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setAnnounced(value), 450)
    return () => clearTimeout(t)
  }, [value])
  return announced
}

// The comment-box count, debounced for its live region (F075).
function useDebouncedCount(count: number): string {
  return useDebouncedText(`${count.toLocaleString()} ${count === 1 ? 'comment' : 'comments'}`)
}

// ── Comment search box (sections 1 + 2) ──────────────────────────────────────

function CommentSearchBox<T extends ChecklistCommentEntry>({
  icon, title, sub, placeholder, entries, emptyAll, emptyFiltered, renderLead, isHotspot,
}: {
  icon: React.ReactNode
  title: string
  sub: string
  placeholder: string
  entries: T[]
  emptyAll: string
  emptyFiltered: string
  renderLead?: (entry: T) => React.ReactNode
  isHotspot: (locId: string | null | undefined) => boolean
}) {
  const [filter, setFilter] = useState('')
  const [sort, setSort] = useState<CommentSort>('newest')
  const [showAll, setShowAll] = useState(false)

  const matches = useMemo(() => filterAndSortComments(entries, filter, sort), [entries, filter, sort])
  const visible = showAll ? matches : matches.slice(0, PAGE)

  // The visible count updates immediately; the screen-reader announcement is
  // debounced so a count change on every keystroke doesn't queue an utterance
  // per character, competing with the input's own character echo (F075).
  const liveCount = useDebouncedCount(matches.length)

  return (
    <SectionCard>
      <BoxHead icon={icon} title={title} sub={sub} />

      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap',
        padding: '12px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
        background: 'var(--sr-surface-faint)',
      }}>
        <div style={{ position: 'relative', flex: '1 1 140px', maxWidth: 340 }}>
          <span style={{ position: 'absolute', left: 9, top: '50%', transform: 'translateY(-50%)', color: 'var(--sr-text-disabled)', pointerEvents: 'none' }}>
            <Search size={12} strokeWidth={2.5} />
          </span>
          <input
            type="text"
            value={filter}
            onChange={e => { setFilter(e.target.value); setShowAll(false) }}
            placeholder={placeholder}
            aria-label={placeholder.replace(/…$/, '')}
            style={{
              width: '100%', height: 32, padding: '0 10px 0 30px',
              border: '1.5px solid var(--sr-border)', borderRadius: 6,
              fontSize: '0.8125rem', fontFamily: 'inherit', color: 'var(--sr-text)',
              background: 'var(--sr-surface)',
            }}
            onFocus={e => (e.currentTarget.style.borderColor = 'var(--sr-accent)')}
            onBlur={e => (e.currentTarget.style.borderColor = 'var(--sr-border)')}
          />
        </div>
        <SortSeg value={sort} onChange={setSort} />
        <span aria-hidden="true" style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 500, flexShrink: 0, marginLeft: 'auto' }}>
          {matches.length.toLocaleString()} {matches.length === 1 ? 'comment' : 'comments'}
        </span>
        <span className="sr-only" aria-live="polite">{liveCount}</span>
      </div>

      {matches.length === 0 ? (
        <div style={{ padding: '16px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
          {entries.length === 0 ? emptyAll : emptyFiltered}
        </div>
      ) : (
        <>
          {visible.map((e, idx) => (
            <div key={`${e.submissionId}-${idx}`} style={{ padding: '13px 18px', borderBottom: idx < visible.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none' }}>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, marginBottom: 5, flexWrap: 'wrap', minWidth: 0 }}>
                {renderLead?.(e)}
                <DateLink submissionId={e.submissionId} date={e.date} />
                {e.location && (
                  <>
                    <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)' }}>·</span>
                    <HotspotLink locId={e.locationId} name={e.location} isHotspot={isHotspot(e.locationId)} truncate style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', minWidth: 0 }} />
                  </>
                )}
              </div>
              <div style={{ fontSize: '0.84375rem', color: 'var(--sr-text)', lineHeight: 1.55, wordBreak: 'break-word' }}>
                <CommentText raw={e.text} decoded />
              </div>
            </div>
          ))}
          {matches.length > PAGE && (
            <ShowAllButton count={matches.length} noun="comments" showAll={showAll} onToggle={() => setShowAll(v => !v)} />
          )}
        </>
      )}
    </SectionCard>
  )
}

// ── Cycling tri-state filter pill (off → has → no → off) ────────────────────
// One pill per category instead of the Multimedia tab's paired Has/No pills —
// the approved evolution for this tab's larger category set (see
// pipeline/checklists-tab/decisions.md). The label always states its condition.

function TriPill({ label, state, onCycle, icon, hasLabel, noLabel }: {
  label: string
  state: TriState
  onCycle: () => void
  icon?: React.ReactNode
  hasLabel?: string
  noLabel?: string
}) {
  const text = state === 'has'
    ? (hasLabel ?? `Has ${label.toLowerCase()}`)
    : state === 'no'
      ? (noLabel ?? `No ${label.toLowerCase()}`)
      : label
  const colors: React.CSSProperties =
    state === 'has'
      ? { border: '1.5px solid var(--sr-accent-border)', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', fontWeight: 600 }
      : state === 'no'
        ? { border: '1.5px solid var(--sr-error-overlay)', background: 'var(--sr-error-bg)', color: 'var(--sr-error)', fontWeight: 600 }
        : { border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontWeight: 500 }
  return (
    <button tabIndex={0}
      onClick={onCycle}
      aria-pressed={state !== null}
      title={`${label} — click to cycle: any / has / doesn't have`}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 5,
        height: 30, padding: '0 11px', borderRadius: 15,
        fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
        ...colors,
      }}
    >
      {state === 'has' && <Check size={11} strokeWidth={3} aria-hidden />}
      {state === 'no' && <X size={11} strokeWidth={3} aria-hidden />}
      {state === null && icon}
      {text}
    </button>
  )
}

function cycle(s: TriState): TriState {
  return s === null ? 'has' : s === 'has' ? 'no' : null
}

const selectStyle: React.CSSProperties = {
  height: 28, padding: '0 8px', borderRadius: 6,
  border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)',
  color: 'var(--sr-text)', fontSize: '0.75rem', fontFamily: 'inherit',
  // Long county/protocol names (or wide native date controls) must not push the
  // filter row past the card and scroll the page on a phone (F074).
  maxWidth: '100%',
}

const rowLabelStyle: React.CSSProperties = {
  fontSize: '0.71875rem', fontWeight: 600, color: 'var(--sr-text-muted)', width: 72, flexShrink: 0,
}

// ── A checklist row in section 3 ─────────────────────────────────────────────

function Badge({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <span title={title} role="img" aria-label={title} style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: 20, height: 20, borderRadius: 5, flexShrink: 0,
      background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
    }}>
      {children}
    </span>
  )
}

function ChecklistRow({ row, showBlocks, mlLoaded, isLast, isHotspot }: {
  row: ChecklistRowData
  showBlocks: boolean
  mlLoaded: boolean
  isLast: boolean
  isHotspot: (locId: string | null | undefined) => boolean
}) {
  const c = row.checklist
  const comment = displayComment(row, showBlocks)
  const state = c.stateProvince ? c.stateProvince.split('-')[1] : null
  const place = [c.county, state].filter(Boolean).join(', ')

  const meta: string[] = []
  if (c.time) meta.push(c.time)
  if (c.protocol) meta.push(protocolName(c.protocol))
  if (c.duration != null && c.duration > 0) meta.push(formatDuration(c.duration / 60)) // CSV minutes → helper takes hours
  if (c.distance != null && c.distance > 0) meta.push(formatDistance(c.distance, null))
  if (c.numObservers != null && c.numObservers > 0) meta.push(c.numObservers === 1 ? 'Solo' : formatObservers(c.numObservers))
  if (place) meta.push(place)
  if (c.allObsReported !== null) meta.push(c.allObsReported ? 'Complete' : 'Incomplete')

  return (
    <div style={{ padding: '13px 18px 14px', borderBottom: isLast ? 'none' : '1px solid var(--sr-border-subtle)' }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 7, flexWrap: 'wrap', minWidth: 0 }}>
        <DateLink submissionId={c.submissionId} date={c.date} />
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)' }}>·</span>
        <HotspotLink locId={c.locationId} name={c.location} isHotspot={isHotspot(c.locationId)} truncate style={{ fontSize: '0.8125rem', fontWeight: 500, minWidth: 0 }} />
        <span style={{ display: 'inline-flex', gap: 4, alignSelf: 'center' }}>
          {row.hasSpeciesComments && <Badge title="Has species comments"><MessageSquare size={11} strokeWidth={2.2} /></Badge>}
          {mlLoaded ? (
            <>
              {row.mediaFormats.has('Photo') && <Badge title="Has photos"><Camera size={11} strokeWidth={2.2} /></Badge>}
              {row.mediaFormats.has('Audio') && <Badge title="Has audio"><Mic size={11} strokeWidth={2.2} /></Badge>}
              {row.mediaFormats.has('Video') && <Badge title="Has video"><Video size={11} strokeWidth={2.2} /></Badge>}
            </>
          ) : (
            row.hasAnyMedia && <Badge title="Has media"><Paperclip size={11} strokeWidth={2.2} /></Badge>
          )}
          {row.hasBreeding && <Badge title="Has breeding codes"><Egg size={11} strokeWidth={2.2} /></Badge>}
        </span>
        <span style={{ marginLeft: 'auto', display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 12px', flexShrink: 0, paddingLeft: 12 }}>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--sr-accent)', whiteSpace: 'nowrap' }}>
            {c.speciesCount.toLocaleString()} species
          </span>
          {c.individualCount > 0 && (
            <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)', whiteSpace: 'nowrap' }}>
              {c.individualCount.toLocaleString()} {c.individualCount === 1 ? 'bird' : 'birds'}
            </span>
          )}
        </span>
      </div>

      {meta.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', fontSize: '0.71875rem', color: 'var(--sr-text-gray)', marginTop: 3 }}>
          {meta.map((m, i) => (
            <span key={i} style={{ display: 'inline-flex', alignItems: 'center' }}>
              {i > 0 && <span style={{ color: 'var(--sr-text-disabled)', padding: '0 6px' }}>·</span>}
              {m}
            </span>
          ))}
        </div>
      )}

      {comment && (
        <div style={{
          fontSize: '0.8125rem', color: 'var(--sr-text)', lineHeight: 1.55,
          background: 'var(--sr-quote-bg)',
          border: '1px solid var(--sr-quote-border)',
          borderLeft: '3px solid var(--sr-accent-border)',
          borderRadius: 7,
          padding: '8px 11px',
          marginTop: 7,
          wordBreak: 'break-word',
        }}>
          <CommentText raw={comment} decoded />
        </div>
      )}
    </div>
  )
}

// ── The tab ──────────────────────────────────────────────────────────────────

export function Checklists({ onGoToSettings, filesVersion, onOpenSpecies }: {
  onGoToSettings: () => void
  filesVersion?: number
  onOpenSpecies?: (commonName: string) => void
}) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading-saved' })
  const [showBlocks, setShowBlocks] = useState(false)
  const [taxonMap, setTaxonMap] = useState<Record<string, string>>({})
  const { isHotspot } = useHotspotSet()

  // Section 3 state
  const [listSort, setListSort] = useState<CommentSort>('newest')
  const [showAllList, setShowAllList] = useState(false)
  const [filters, setFilters] = useState<ChecklistFilterState>(CHECKLIST_FILTER_CLEAR)

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      setPhase({ tag: 'loading-saved' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        const ebird = await loadEbirdObservations()
        if (!ebird || cancelled) {
          setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." })
          return
        }
        // The ML export is optional: without it, per-type media filters hide
        // and "has media" falls back to the backup's catalog numbers (FR-22).
        let mediaMap: Record<string, string> | null = null
        try {
          const ml = await loadMLExport()
          mediaMap = ml?.mediaMap ?? null
        } catch { /* no export — degrade gracefully */ }
        if (cancelled) return
        setPhase({ tag: 'ready', observations: ebird.observations, mediaMap })
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [filesVersion])

  const observations = phase.tag === 'ready' ? phase.observations : null
  const mediaMap = phase.tag === 'ready' ? phase.mediaMap : null

  // Batched taxon-code resolution for the species shown in section 2 (favicons
  // on BirdName); names render and link fine while/if this is absent.
  useEffect(() => {
    if (!observations) return
    const distinct = new Map<string, string>()
    for (const o of observations) {
      if (o.speciesComments.trim() && !distinct.has(o.commonName)) distinct.set(o.commonName, o.scientificName)
    }
    if (distinct.size === 0) return
    let cancelled = false
    const species = [...distinct.entries()].map(([commonName, scientificName]) => ({ commonName, scientificName }))
    transport.post<{ codes: Record<string, string> }>('/taxonomy/codes', { species })
      .then(data => { if (!cancelled) setTaxonMap(data.codes ?? {}) })
      .catch(() => { /* favicons absent until next load */ })
    return () => { cancelled = true }
  }, [observations])

  const rows = useMemo(
    () => (observations ? buildChecklistRows(observations, mediaMap) : []),
    [observations, mediaMap],
  )
  const checklistComments = useMemo(() => buildChecklistComments(rows, showBlocks), [rows, showBlocks])
  const speciesComments = useMemo(
    () => (observations ? buildSpeciesComments(observations, showBlocks) : []),
    [observations, showBlocks],
  )

  const counties = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.checklist.county) set.add(r.checklist.county)
    return [...set].sort()
  }, [rows])

  const protocols = useMemo(() => {
    const set = new Set<string>()
    for (const r of rows) if (r.checklist.protocol) set.add(r.checklist.protocol)
    return [...set].map(id => ({ id, label: protocolName(id) })).sort((a, b) => a.label.localeCompare(b.label))
  }, [rows])

  const filteredRows = useMemo(() => filterChecklistRows(rows, filters, showBlocks), [rows, filters, showBlocks])
  const sortedRows = useMemo(() => sortChecklistRows(filteredRows, listSort), [filteredRows, listSort])
  const visibleRows = showAllList ? sortedRows : sortedRows.slice(0, PAGE)

  const pillsClear = isPillFilterClear(filters)
  const filtersAllClear = pillsClear && filters.protocol === null && filters.county === null && !filters.dateRange.from && !filters.dateRange.to
  const hasLocationFilter = filters.county !== null || !!filters.dateRange.from || !!filters.dateRange.to

  // Visible list count (immediate) + its debounced screen-reader announcement
  // (F075): the date inputs can type-churn this, so the live region settles
  // rather than announcing on every change. Hook stays above the early returns.
  const listCountText = filtersAllClear
    ? `${rows.length.toLocaleString()} checklists`
    : `${sortedRows.length.toLocaleString()} of ${rows.length.toLocaleString()} checklists`
  const liveListCount = useDebouncedText(listCountText)

  const codeFor = (name: string) => taxonMap[name] ?? taxonMap[normalizeSpeciesName(name)]
  const setTri = (key: keyof ChecklistFilterState) =>
    () => setFilters(f => ({ ...f, [key]: cycle(f[key] as TriState) }))

  if (phase.tag === 'loading-saved') {
    return (
      <div role="status" aria-label="Loading saved eBird data" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden />
      </div>
    )
  }

  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="eBird Backup Required"
        body="The Checklists tab loads automatically from your stored eBird backup. You haven't saved one yet."
        steps={EBIRD_BACKUP_STEPS}
        onGoToSettings={onGoToSettings}
      />
    )
  }

  if (phase.tag === 'error') {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480 }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} aria-hidden />
          {phase.message}
        </div>
        <button tabIndex={0} onClick={onGoToSettings} style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
          Go to Settings
        </button>
      </div>
    )
  }

  const mlLoaded = mediaMap !== null
  const totalChecklists = rows.length

  const filterStripText = [
    filters.county,
    filters.dateRange.from && filters.dateRange.to
      ? `${formatDate(filters.dateRange.from)} – ${formatDate(filters.dateRange.to)}`
      : filters.dateRange.from
        ? `From ${formatDate(filters.dateRange.from)}`
        : filters.dateRange.to
          ? `Through ${formatDate(filters.dateRange.to)}`
          : null,
    `${sortedRows.length.toLocaleString()} of ${totalChecklists.toLocaleString()} checklists`,
  ].filter(Boolean).join(' · ')

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
      {/* Tab header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 6 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <ClipboardList size={15} strokeWidth={2.2} aria-hidden />
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-text)' }}>Checklists</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0, lineHeight: 1.5 }}>
            Every checklist you've submitted — search the comments you wrote, and browse or filter the full list of your outings.
          </p>
        </div>
      </div>

      {/* The tab-wide weather/tide toggle (default hidden — FR-04) */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '0 0 16px' }}>
        <ToggleSwitch
          label="Show weather & tide blocks"
          checked={showBlocks}
          onChange={() => setShowBlocks(v => !v)}
        />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        {/* Section 1 — checklist comments */}
        <CommentSearchBox
          icon={<MessageSquare size={14} strokeWidth={2.2} />}
          title="Checklist Comments"
          sub="what you wrote about whole outings"
          placeholder="Filter checklist comments…"
          entries={checklistComments}
          emptyAll="No checklist comments found."
          emptyFiltered="No checklist comments match this filter."
          isHotspot={isHotspot}
        />

        {/* Section 2 — species comments, all species */}
        <CommentSearchBox
          icon={<MessagesSquare size={14} strokeWidth={2.2} />}
          title="Species Comments"
          sub="notes you wrote on individual sightings — all species"
          placeholder="Filter species comments…"
          entries={speciesComments}
          emptyAll="No species comments found."
          emptyFiltered="No species comments match this filter."
          isHotspot={isHotspot}
          renderLead={(e: SpeciesCommentEntry) => (
            <span style={{ marginRight: 3 }}>
              <BirdName
                commonName={e.commonName}
                scientificName={e.scientificName}
                taxonCode={codeFor(e.commonName)}
                hasEntry
                onOpenSpecies={onOpenSpecies}
                size="sm"
              />
            </span>
          )}
        />

        {/* Section 3 — all checklists */}
        <SectionCard>
          <BoxHead
            icon={<ClipboardList size={14} strokeWidth={2.2} />}
            title="All Checklists"
            sub="every outing, filterable"
          />

          {/* Filters — three labeled rows (design-spec) */}
          <div style={{
            display: 'flex', flexDirection: 'column', gap: 9,
            padding: '12px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
            background: 'var(--sr-surface-faint)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={rowLabelStyle}>Contains</span>
              <button tabIndex={0}
                onClick={() => setFilters(f => ({
                  ...f,
                  checklistComment: null, speciesComments: null, media: null, breeding: null,
                  weatherBlock: null, tideBlock: null, complete: null, photo: null, audio: null, video: null,
                }))}
                aria-pressed={pillsClear}
                style={{
                  display: 'inline-flex', alignItems: 'center', height: 30, padding: '0 12px', borderRadius: 15,
                  fontSize: '0.75rem', fontFamily: 'inherit', cursor: 'pointer', whiteSpace: 'nowrap',
                  ...(pillsClear
                    ? { border: '1.5px solid var(--sr-accent-border)', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', fontWeight: 600 }
                    : { border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontWeight: 500 }),
                }}
              >
                All
              </button>
              <span style={{ width: 1, height: 20, background: 'var(--sr-border)', margin: '0 3px', flexShrink: 0 }} />
              <TriPill label="Checklist comment" state={filters.checklistComment} onCycle={setTri('checklistComment')} />
              <TriPill label="Species comments" state={filters.speciesComments} onCycle={setTri('speciesComments')} />
              <TriPill label="Media" state={filters.media} onCycle={setTri('media')} />
              <TriPill label="Breeding codes" state={filters.breeding} onCycle={setTri('breeding')} />
              <TriPill label="Weather block" state={filters.weatherBlock} onCycle={setTri('weatherBlock')} />
              <TriPill label="Tide block" state={filters.tideBlock} onCycle={setTri('tideBlock')} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              {mlLoaded && (
                <>
                  <span style={rowLabelStyle}>Media type</span>
                  <TriPill label="Photo" state={filters.photo} onCycle={setTri('photo')} icon={<Camera size={11} strokeWidth={2.2} aria-hidden />} />
                  <TriPill label="Audio" state={filters.audio} onCycle={setTri('audio')} icon={<Mic size={11} strokeWidth={2.2} aria-hidden />} />
                  <TriPill label="Video" state={filters.video} onCycle={setTri('video')} icon={<Video size={11} strokeWidth={2.2} aria-hidden />} />
                  <span style={{ width: 1, height: 20, background: 'var(--sr-border)', margin: '0 3px', flexShrink: 0 }} />
                </>
              )}
              <span style={{ ...rowLabelStyle, width: mlLoaded ? 'auto' : 72 }}>Effort</span>
              <TriPill label="Complete" state={filters.complete} onCycle={setTri('complete')} hasLabel="Complete" noLabel="Incomplete" />
              {protocols.length > 0 && (
                <select
                  aria-label="Protocol"
                  value={filters.protocol ?? ''}
                  onChange={e => setFilters(f => ({ ...f, protocol: e.target.value || null }))}
                  style={{ ...selectStyle, ...(filters.protocol ? { borderColor: 'var(--sr-accent-border)', color: 'var(--sr-accent)', fontWeight: 600 } : {}) }}
                >
                  <option value="">All protocols</option>
                  {protocols.map(p => <option key={p.id} value={p.id}>{p.label}</option>)}
                </select>
              )}
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
              <span style={rowLabelStyle}>Where &amp; when</span>
              {counties.length > 0 && (
                <select
                  aria-label="County"
                  value={filters.county ?? ''}
                  onChange={e => setFilters(f => ({ ...f, county: e.target.value || null }))}
                  style={{ ...selectStyle, ...(filters.county ? { borderColor: 'var(--sr-accent-border)', color: 'var(--sr-accent)', fontWeight: 600 } : {}) }}
                >
                  <option value="">All counties</option>
                  {counties.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              )}
              <input
                type="date"
                aria-label="From date"
                value={filters.dateRange.from}
                onChange={e => setFilters(f => ({ ...f, dateRange: { ...f.dateRange, from: e.target.value } }))}
                style={selectStyle}
              />
              <span style={{ fontSize: '0.75rem', color: 'var(--sr-text-disabled)' }}>→</span>
              <input
                type="date"
                aria-label="To date"
                value={filters.dateRange.to}
                onChange={e => setFilters(f => ({ ...f, dateRange: { ...f.dateRange, to: e.target.value } }))}
                style={selectStyle}
              />
              <span aria-hidden="true" style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--sr-text-muted)', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {listCountText}
              </span>
              <span className="sr-only" aria-live="polite">{liveListCount}</span>
            </div>
          </div>

          {/* Accent filter strip for county/date (house pattern) */}
          {hasLocationFilter && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap',
              padding: '8px 18px', background: 'var(--sr-accent-bg)',
              borderBottom: '1px solid var(--sr-border-subtle)',
              fontSize: '0.75rem', color: 'var(--sr-accent-strong)',
            }}>
              <span>{filterStripText}</span>
              <button tabIndex={0}
                onClick={() => setFilters(f => ({ ...f, county: null, dateRange: { from: '', to: '' } }))}
                style={{ border: 'none', background: 'none', color: 'var(--sr-accent)', fontSize: '0.75rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer', textDecoration: 'underline', padding: 0 }}
              >
                Clear filter
              </button>
            </div>
          )}

          {/* Sort row */}
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            padding: '10px 18px', borderBottom: '1px solid var(--sr-border-subtle)',
          }}>
            <SortSeg value={listSort} onChange={setListSort} />
          </div>

          {/* Rows */}
          {sortedRows.length === 0 ? (
            <div style={{ padding: '16px 18px', fontSize: '0.8125rem', color: 'var(--sr-text-muted)' }}>
              {totalChecklists === 0 ? 'No checklists found in the stored file.' : 'No checklists match these filters.'}
            </div>
          ) : (
            <>
              {visibleRows.map((r, idx) => (
                <ChecklistRow
                  key={r.checklist.submissionId}
                  row={r}
                  showBlocks={showBlocks}
                  mlLoaded={mlLoaded}
                  isLast={idx === visibleRows.length - 1}
                  isHotspot={isHotspot}
                />
              ))}
              {sortedRows.length > PAGE && (
                <ShowAllButton count={sortedRows.length} noun="checklists" showAll={showAllList} onToggle={() => setShowAllList(v => !v)} />
              )}
            </>
          )}
        </SectionCard>
      </div>
    </div>
  )
}
