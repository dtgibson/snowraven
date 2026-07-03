// The Calendar tab: a year of the birder's eBird data as twelve month grids (like a
// wall calendar's twelve pages), each day carrying a count — species-seen-that-day
// or checklists-that-day, by a toggle — relatively color-shaded (with a colorblind
// crosshatch-density alternative), navigable across every year the backup covers
// plus an all-years-combined view. Clicking a day opens a popup with that day's
// summary and links to its eBird checklists. A Months|Year view-density toggle
// switches between the big month grids and a 3×4 Year-Overview of mini-month
// thumbnails; a low-emphasis "Count spuh, slash & hybrids" toggle optionally admits
// non-countable forms into the Species metric.
//
// Frontend-only, offline, zero new network. Pure derivation lives in lib/calendar.ts;
// the DOM crosshatch density in lib/calendarTextures.ts. See pipeline/calendar-tab.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2, AlertCircle, CalendarDays, ChevronLeft, ChevronRight,
  LayoutGrid, Grid2x2, ArrowRight, X,
} from 'lucide-react'
import type { ObservationEntry } from '../types'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS } from './setupCopy'
import { storage } from '../lib/storage'
import { loadEbirdObservations } from '../lib/observationsCache'
import { formatDate } from '../lib/formatDate'
import { ChecklistLink } from './ChecklistLink'
import { computeCountyTiers, type CountyTiers } from '../lib/countyShading'
import {
  buildDayCells, dataYears, defaultYear, adjacentDataYear, metricCount,
  nonZeroMetricCounts, daysInMonth, dayOfWeek,
  type CalendarMetric, type CalendarView, type DayCell, type DayCellMap,
} from '../lib/calendar'
import { calHatchCss, calMiniHatchCss, type CalTier } from '../lib/calendarTextures'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] // Sunday-first single letters
const COMBINED_REF_YEAR = 2000 // fixed reference leap year for stable weekday columns

type ViewDensity = 'months' | 'year'

type Phase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'empty' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[] }

// ── Small presentational pieces ──────────────────────────────────────────────

function SegControl<T extends string>({ options, value, onChange, ariaLabel }: {
  options: { value: T; label: string; icon?: React.ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  return (
    <div className="sr-wrap-flex" role="group" aria-label={ariaLabel}
      style={{ ['--sr-wrap-gap' as string]: '2px', background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2 }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button tabIndex={0}
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            title={opt.title}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              padding: '0.35rem 12px', borderRadius: 5, fontSize: '0.71875rem',
              background: active ? 'var(--sr-surface)' : 'transparent',
              border: `1px solid ${active ? 'var(--sr-border)' : 'transparent'}`,
              fontWeight: active ? 600 : 400,
              color: active ? 'var(--sr-text)' : 'var(--sr-text-muted)',
              cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
            }}
          >
            {opt.icon}
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}

// A small role="switch" toggle, sized-variant aware (the ToggleSwitch pattern).
function Switch({ label, checked, onChange, small, disabled }: {
  label: string
  checked: boolean
  onChange: () => void
  small?: boolean
  disabled?: boolean
}) {
  const trackW = small ? 30 : 34
  const trackH = small ? 18 : 20
  const knob = small ? 14 : 16
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-disabled={disabled || undefined}
      tabIndex={disabled ? -1 : 0}
      onClick={() => { if (!disabled) onChange() }}
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', padding: 0, margin: 0,
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        pointerEvents: disabled ? 'none' : 'auto',
      }}
    >
      <span style={{
        width: trackW, height: trackH, borderRadius: 999, flexShrink: 0, position: 'relative',
        background: checked ? 'var(--sr-accent)' : 'var(--sr-gray-400)',
        transition: 'background 0.12s',
      }}>
        <span style={{
          position: 'absolute', top: 2, left: checked ? trackW - knob - 2 : 2,
          width: knob, height: knob, borderRadius: '50%', background: '#fff',
          boxShadow: '0 1px 2px rgba(0,0,0,0.25)', transition: 'left 0.12s',
        }} />
      </span>
      <span style={{ fontSize: small ? '0.71875rem' : '0.75rem', fontWeight: 600, color: 'var(--sr-text)' }}>{label}</span>
    </button>
  )
}

// ── Day cell (big month view) ────────────────────────────────────────────────

interface DayCellDescriptor {
  kind: 'pad' | 'nodata' | 'zero' | 'data'
  tier?: CalTier
  day?: number
  count?: number
  cell?: DayCell
}

function DayCellButton({ desc, textures, metric, onOpen }: {
  desc: DayCellDescriptor
  textures: boolean
  metric: CalendarMetric
  onOpen: (cell: DayCell, el: HTMLButtonElement) => void
}) {
  // Hook must run unconditionally (before any early return) — React rules of hooks.
  const ref = useRef<HTMLButtonElement>(null)
  const base: React.CSSProperties = {
    aspectRatio: '1 / 1', borderRadius: 5, border: 0, padding: 0, margin: 0,
    display: 'flex', alignItems: 'center', justifyContent: 'center', position: 'relative',
    font: 'inherit', minWidth: 0,
  }

  if (desc.kind === 'pad') {
    return <div aria-hidden style={{ ...base, background: 'transparent', pointerEvents: 'none' }} />
  }
  if (desc.kind === 'nodata') {
    return <div aria-hidden style={{ ...base, background: 'transparent', border: '1px solid var(--sr-border-subtle)', pointerEvents: 'none' }} />
  }

  const cell = desc.cell!
  const dateLabel = cellDateLabel(cell.bucketKey)

  if (desc.kind === 'zero') {
    return (
      <button
        ref={ref}
        type="button"
        tabIndex={0}
        onClick={() => onOpen(cell, ref.current!)}
        aria-label={`${dateLabel} — birded, 0 ${metric === 'checklists' ? 'checklists' : 'countable species'}. Open day details`}
        className="sr-touch-target"
        style={{
          ...base, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border-subtle)',
          cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-border-subtle)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'var(--sr-surface-subtle)')}
      >
        <span style={{ fontSize: '0.6875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sr-text-muted)', lineHeight: 1 }}>0</span>
      </button>
    )
  }

  // data day
  const tier = desc.tier!
  const fill: React.CSSProperties = textures
    ? calHatchCss(tier)
    : { background: `var(--sr-cal-${tier})` }
  const numStyle: React.CSSProperties = textures
    ? { background: `rgba(var(--sr-cal-${tier}-rgb), 0.9)`, borderRadius: 3, padding: '0 3px' }
    : {}
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={0}
      onClick={() => onOpen(cell, ref.current!)}
      aria-label={`${dateLabel} — ${desc.count}. Open day details`}
      className="sr-touch-target"
      style={{
        ...base, ...fill, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = textures ? 'none' : 'brightness(1.12)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
    >
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sr-cal-fg)', lineHeight: 1, ...numStyle }}>
        {desc.count}
      </span>
    </button>
  )
}

// Format a bucketKey (YYYY-MM-DD or MM-DD) into a human date label for aria/popup.
function cellDateLabel(bucketKey: string): string {
  if (bucketKey.length === 10) return formatDate(bucketKey)
  // combined MM-DD: month + day, no year
  const mo = Number(bucketKey.slice(0, 2))
  const d = Number(bucketKey.slice(3, 5))
  const abbr = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
  return `${abbr[mo - 1]} ${d}`
}

// Build the ordered cell descriptors for one month grid. `refYear` is the calendar
// year for weekday geometry (the actual year, or COMBINED_REF_YEAR for combined).
function buildMonthCells(
  month: number,
  refYear: number,
  keyFor: (day: number) => string,
  cells: DayCellMap,
  tiers: CountyTiers,
  metric: CalendarMetric,
  includeForms: boolean,
): DayCellDescriptor[] {
  const out: DayCellDescriptor[] = []
  const lead = dayOfWeek(refYear, month, 1) // 0=Sunday
  for (let i = 0; i < lead; i++) out.push({ kind: 'pad' })
  const dim = daysInMonth(refYear, month)
  for (let day = 1; day <= dim; day++) {
    const key = keyFor(day)
    const cell = cells.get(key)
    if (!cell) { out.push({ kind: 'nodata' }); continue }
    const count = metricCount(cell, metric, includeForms)
    if (count === 0) { out.push({ kind: 'zero', day, cell }); continue }
    out.push({ kind: 'data', day, count, cell, tier: tiers.tierFor(count) as CalTier })
  }
  return out
}

// ── Big month grid ───────────────────────────────────────────────────────────

function MonthGrid({ month, descriptors, textures, metric, onOpen, cardRef }: {
  month: number
  descriptors: DayCellDescriptor[]
  textures: boolean
  metric: CalendarMetric
  onOpen: (cell: DayCell, el: HTMLButtonElement) => void
  cardRef?: (el: HTMLDivElement | null) => void
}) {
  return (
    <div
      ref={cardRef}
      tabIndex={-1}
      style={{
        background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 12,
        boxShadow: 'var(--sr-card-shadow)', padding: '12px 12px 14px', minWidth: 0,
      }}
    >
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-text)', margin: '0 2px 8px', letterSpacing: '-0.01em' }}>
        {MONTH_NAMES[month - 1]}
      </div>
      <div aria-hidden style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3, marginBottom: 4 }}>
        {WEEKDAYS.map((w, i) => (
          <div key={i} style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--sr-text-gray)', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.03em' }}>{w}</div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 3 }}>
        {descriptors.map((d, i) => (
          <DayCellButton key={i} desc={d} textures={textures} metric={metric} onOpen={onOpen} />
        ))}
      </div>
    </div>
  )
}

// ── Mini month (Year Overview) ───────────────────────────────────────────────

function MiniMonth({ month, descriptors, textures, onExpand }: {
  month: number
  descriptors: DayCellDescriptor[]
  textures: boolean
  onExpand: (month: number) => void
}) {
  return (
    <button
      type="button"
      tabIndex={0}
      onClick={() => onExpand(month)}
      aria-label={`Open ${MONTH_NAMES[month - 1]} in the month view`}
      className="sr-cal-minimonth"
      style={{
        background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 12,
        boxShadow: 'var(--sr-card-shadow)', padding: '12px 14px 14px', cursor: 'pointer',
        textAlign: 'left', font: 'inherit', color: 'inherit', width: '100%', display: 'block',
        transition: 'border-color .12s, box-shadow .12s',
      }}
      onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--sr-accent-border-strong)')}
      onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--sr-border)')}
    >
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, margin: '0 0 8px' }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-text)', letterSpacing: '-0.01em' }}>{MONTH_NAMES[month - 1]}</span>
        <span className="sr-cal-mini-open" style={{ fontSize: '0.625rem', color: 'var(--sr-accent)', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 3 }}>
          Open <ArrowRight size={10} strokeWidth={2.5} aria-hidden />
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {descriptors.map((d, i) => <MiniDayCell key={i} desc={d} textures={textures} />)}
      </div>
    </button>
  )
}

function MiniDayCell({ desc, textures }: { desc: DayCellDescriptor; textures: boolean }) {
  const base: React.CSSProperties = { aspectRatio: '1 / 1', borderRadius: 2, minWidth: 0 }
  if (desc.kind === 'pad') return <div aria-hidden style={{ ...base, background: 'transparent' }} />
  if (desc.kind === 'nodata') return <div aria-hidden style={{ ...base, background: 'transparent', border: '1px solid var(--sr-border-subtle)' }} />
  if (desc.kind === 'zero') {
    return <div aria-hidden title={`${cellDateLabel(desc.cell!.bucketKey)}: birded, 0 countable`} style={{ ...base, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border-subtle)' }} />
  }
  const tier = desc.tier!
  const fill: React.CSSProperties = textures ? calMiniHatchCss(tier) : { background: `var(--sr-cal-${tier})` }
  return <div aria-hidden title={`${cellDateLabel(desc.cell!.bucketKey)}: ${desc.count}`} style={{ ...base, ...fill }} />
}

// ── Legend ───────────────────────────────────────────────────────────────────

function legendUnit(view: CalendarView, metric: CalendarMetric): string {
  if (metric === 'checklists') {
    return view.kind === 'combined' ? 'Checklists across all years' : 'Checklists / day'
  }
  return view.kind === 'combined' ? 'Species ever recorded' : 'Species / day'
}

function CalendarLegend({ view, metric, textures, tiers }: {
  view: CalendarView
  metric: CalendarMetric
  textures: boolean
  tiers: CountyTiers
}) {
  const legend = tiers.legend
  const min = legend.length ? legend[0].min : null
  const max = legend.length ? legend[legend.length - 1].max : null
  return (
    <div className="legend" aria-label="Shade legend" style={{ display: 'flex', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap' }}>
      <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', paddingBottom: 2 }}>
        {legendUnit(view, metric)}
      </span>
      {legend.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--sr-border-medium)', borderRadius: 4, overflow: 'hidden', boxShadow: '0 0 0 1px var(--sr-surface)' }}>
            {legend.map((l, i) => {
              const tier = (i + 1) as CalTier
              const sw: React.CSSProperties = textures
                ? calHatchCss(tier)
                : { background: `var(--sr-cal-${tier})` }
              return (
                <span
                  key={l.tier}
                  title={l.min === l.max ? `${l.min}` : `${l.min}–${l.max}`}
                  style={{ display: 'block', width: 34, height: 13, borderRight: i < legend.length - 1 ? '1px solid var(--sr-border-subtle)' : 'none', ...sw }}
                />
              )
            })}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
            <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{min}</span>
            <span style={{ fontSize: '0.5625rem', color: 'var(--sr-text-gray)', letterSpacing: '0.04em' }}>fewer → more</span>
            <span style={{ fontSize: '0.625rem', color: 'var(--sr-text-muted)', fontVariantNumeric: 'tabular-nums', lineHeight: 1 }}>{max}</span>
          </div>
        </div>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 4, paddingBottom: 1 }}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>
          <span aria-hidden style={{ width: 13, height: 13, borderRadius: 3, border: '1px solid var(--sr-border)', background: 'transparent', flexShrink: 0 }} />
          no birding
        </span>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>
          <span aria-hidden style={{ width: 14, height: 14, borderRadius: 3, border: '1px solid var(--sr-border)', background: 'var(--sr-surface-subtle)', color: 'var(--sr-text-muted)', fontSize: '0.5rem', fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>0</span>
          birded · 0 countable
        </span>
      </div>
    </div>
  )
}

// ── Day popup ────────────────────────────────────────────────────────────────

function DayPopup({ cell, view, includeForms, onClose }: {
  cell: DayCell
  view: CalendarView
  includeForms: boolean
  onClose: () => void
}) {
  const closeRef = useRef<HTMLButtonElement>(null)
  const dialogRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    closeRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key === 'Tab') {
        // Trap Tab inside the dialog (aria-modal). Re-query focusables per keydown
        // so a changing set (e.g. links appearing) is always current, per the app's
        // overlay convention (WelcomeScreen/HelpDocs).
        const root = dialogRef.current
        if (!root) return
        const focusables = Array.from(
          root.querySelectorAll<HTMLElement>('button, a[href], [tabindex]:not([tabindex="-1"])'),
        ).filter(el => !el.hasAttribute('disabled'))
        if (focusables.length < 2) { e.preventDefault(); focusables[0]?.focus(); return }
        const first = focusables[0]
        const last = focusables[focusables.length - 1]
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault()
          last.focus()
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault()
          first.focus()
        }
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const combined = view.kind === 'combined'
  const speciesNum = includeForms ? cell.speciesCountWithForms : cell.speciesCount
  // The number of DISTINCT years that contributed a checklist to this bucket — the
  // years actually birded on this MM-DD, NOT the full data-year span (FR-38/QA-35).
  const spanYears = combined
    ? new Set(cell.checklists.map(c => c.date.slice(0, 4))).size
    : null

  const dateLabel = combined
    ? cellDateLabel(cell.bucketKey)
    : formatDate(cell.bucketKey, { withWeekday: true })

  const rows = [...cell.checklists].sort((a, b) => b.date.localeCompare(a.date)) // newest first

  const speciesLabel = includeForms
    ? (combined ? 'species (incl. forms) ever recorded' : 'species (incl. forms)')
    : (combined ? 'species ever recorded' : 'species')
  const checklistLabel = combined
    ? (spanYears ? `checklists across ${spanYears} ${spanYears === 1 ? 'year' : 'years'}` : 'checklists')
    : 'checklists'

  return (
    <div
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1200, background: 'rgba(0,0,0,0.32)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label={`Day details for ${dateLabel}`}
        style={{ width: '100%', maxWidth: 400, background: 'var(--sr-surface)', color: 'var(--sr-text)', border: '1px solid var(--sr-border)', borderRadius: 14, boxShadow: 'var(--sr-card-shadow)', overflow: 'hidden' }}
      >
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, padding: '16px 18px 12px', borderBottom: '1px solid var(--sr-border-subtle)' }}>
          <div>
            <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sr-text)', letterSpacing: '-0.01em' }}>{dateLabel}</div>
            {combined && <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>Across all years</div>}
            {includeForms && !combined && <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>Spuh / slash / hybrids included in the species count</div>}
          </div>
          <button
            ref={closeRef}
            type="button"
            onClick={onClose}
            aria-label="Close day details"
            style={{ font: 'inherit', cursor: 'pointer', width: 26, height: 26, flexShrink: 0, borderRadius: 7, border: '1px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <X size={14} strokeWidth={2.5} aria-hidden />
          </button>
        </div>

        <div style={{ display: 'flex', gap: 10, padding: '14px 18px 4px' }}>
          <div style={{ flex: 1, background: 'var(--sr-surface-subtle)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{speciesNum}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 4 }}>{speciesLabel}</div>
          </div>
          <div style={{ flex: 1, background: 'var(--sr-surface-subtle)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{cell.checklistCount}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 4 }}>{checklistLabel}</div>
          </div>
        </div>

        <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', padding: '14px 18px 6px' }}>
          Checklists
        </div>
        <div className="sr-map-popup-body" style={{ padding: '0 10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((r, i) => (
            <PopupChecklistRow key={`${r.submissionId}-${i}`} submissionId={r.submissionId} date={r.date} combined={combined} />
          ))}
        </div>
      </div>
    </div>
  )
}

function PopupChecklistRow({ submissionId, date, combined }: { submissionId: string; date: string; combined: boolean }) {
  // The whole row's link is the ChecklistLink affordance (junk id → plain text via
  // SUBMISSION_ID_RE inside ChecklistLink), and ChecklistLink emits its OWN shared
  // external-link glyph — so we render exactly one icon per row (no duplicate). In
  // combined mode a year chip anchors the row.
  const year = date.slice(0, 4)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 8 }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-surface-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--sr-text)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <ChecklistLink submissionId={submissionId} label={formatDate(date)} style={{ fontWeight: 600 }} />
        </div>
      </div>
      {combined && <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--sr-text-muted)', background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>{year}</span>}
    </div>
  )
}

// ── Year Overview ────────────────────────────────────────────────────────────

function YearOverview({ monthDescriptors, textures, onExpand }: {
  monthDescriptors: DayCellDescriptor[][]
  textures: boolean
  onExpand: (month: number) => void
}) {
  return (
    <div className="sr-cal-year">
      {monthDescriptors.map((descriptors, i) => (
        <MiniMonth key={i + 1} month={i + 1} descriptors={descriptors} textures={textures} onExpand={onExpand} />
      ))}
    </div>
  )
}

// ── The tab ──────────────────────────────────────────────────────────────────

export function Calendar({ onGoToSettings, filesVersion }: {
  onGoToSettings: () => void
  filesVersion?: number
  onOpenSpecies?: (commonName: string) => void
}) {
  const [phase, setPhase] = useState<Phase>({ tag: 'loading' })
  const [view, setView] = useState<CalendarView>({ kind: 'year', year: 0 })
  const [metric, setMetric] = useState<CalendarMetric>('species')
  const [textures, setTextures] = useState(false)
  const [density, setDensity] = useState<ViewDensity>('months')
  const [includeForms, setIncludeForms] = useState(false)
  const [popup, setPopup] = useState<DayCell | null>(null)

  const openerRef = useRef<HTMLButtonElement | null>(null)
  const monthCardRefs = useRef<(HTMLDivElement | null)[]>([])

  useEffect(() => {
    let cancelled = false
    async function autoLoad() {
      setPhase({ tag: 'loading' })
      try {
        const status = await storage.getFilesStatus()
        if (cancelled) return
        if (!status.ebird) { setPhase({ tag: 'setup-required' }); return }
        const ebird = await loadEbirdObservations()
        if (cancelled) return
        if (!ebird) {
          setPhase({ tag: 'error', message: "Couldn't load your eBird backup from Settings. Try re-uploading it." })
          return
        }
        const years = dataYears(ebird.observations)
        if (years.length === 0) { setPhase({ tag: 'empty' }); return }
        setView({ kind: 'year', year: defaultYear(ebird.observations)! })
        setPhase({ tag: 'ready', observations: ebird.observations })
      } catch {
        if (!cancelled) setPhase({ tag: 'setup-required' })
      }
    }
    autoLoad()
    return () => { cancelled = true }
  }, [filesVersion])

  const observations = phase.tag === 'ready' ? phase.observations : null

  const years = useMemo(() => (observations ? dataYears(observations) : []), [observations])

  const cells = useMemo(
    () => (observations ? buildDayCells(observations, view) : new Map() as DayCellMap),
    [observations, view],
  )
  const tiers = useMemo(
    () => computeCountyTiers(nonZeroMetricCounts(cells, metric, includeForms), 5),
    [cells, metric, includeForms],
  )

  // Twelve months of cell descriptors (both densities read the same). Combined view
  // uses the fixed reference leap year 2000 for weekday geometry & the Feb-29 cell.
  const refYear = view.kind === 'combined' ? COMBINED_REF_YEAR : view.year
  const monthDescriptors = useMemo(() => {
    const out: DayCellDescriptor[][] = []
    for (let m = 1; m <= 12; m++) {
      const keyFor = view.kind === 'combined'
        ? (day: number) => `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : (day: number) => `${view.year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      out.push(buildMonthCells(m, refYear, keyFor, cells, tiers, metric, includeForms))
    }
    return out
  }, [cells, tiers, metric, includeForms, view, refYear])

  // Days-birded count for the sub-line (distinct populated buckets).
  const daysBirded = cells.size

  const openPopup = (cell: DayCell, el: HTMLButtonElement) => {
    openerRef.current = el
    setPopup(cell)
  }
  const closePopup = () => {
    setPopup(null)
    // restore focus to the activating cell after the close render commits
    const el = openerRef.current
    if (el) requestAnimationFrame(() => el.focus())
  }

  const expandMonth = (month: number) => {
    setDensity('months')
    const idx = month - 1
    requestAnimationFrame(() => {
      const card = monthCardRefs.current[idx]
      if (card) {
        const prefersReduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
        card.scrollIntoView?.({ behavior: prefersReduced ? 'auto' : 'smooth', block: 'start' })
        card.focus({ preventScroll: true })
      }
    })
  }

  const goPrev = () => {
    if (view.kind !== 'year') return
    const y = adjacentDataYear(years, view.year, -1)
    if (y != null) setView({ kind: 'year', year: y })
  }
  const goNext = () => {
    if (view.kind !== 'year') return
    const y = adjacentDataYear(years, view.year, 1)
    if (y != null) setView({ kind: 'year', year: y })
  }
  const toggleAllYears = () => {
    if (view.kind === 'combined') {
      setView({ kind: 'year', year: defaultYear(observations!)! })
    } else {
      setView({ kind: 'combined' })
    }
  }

  // ── Phase gates ──
  if (phase.tag === 'loading') {
    return (
      <div role="status" aria-label="Loading calendar" style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Loader2 size={24} strokeWidth={2} className="spin" style={{ color: 'var(--sr-accent)' }} aria-hidden />
      </div>
    )
  }
  if (phase.tag === 'setup-required') {
    return (
      <SetupRequired
        title="eBird Backup Required"
        body="The Calendar tab loads automatically from your stored eBird backup. You haven't saved one yet."
        steps={EBIRD_BACKUP_STEPS}
        onGoToSettings={onGoToSettings}
      />
    )
  }
  if (phase.tag === 'error') {
    return (
      <div role="alert" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12, padding: 40 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480 }}>
          <AlertCircle size={14} strokeWidth={2.5} style={{ flexShrink: 0 }} aria-hidden />
          {phase.message}
        </div>
        <button type="button" onClick={onGoToSettings} style={{ height: 32, padding: '0 14px', borderRadius: 6, border: '1.5px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text-muted)', fontSize: '0.75rem', fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer' }}>
          Go to Settings
        </button>
      </div>
    )
  }
  if (phase.tag === 'empty') {
    return (
      <div role="status" style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 10, padding: 40, textAlign: 'center' }}>
        <CalendarDays size={30} strokeWidth={1.75} style={{ color: 'var(--sr-text-muted)' }} aria-hidden />
        <div style={{ fontSize: '0.9375rem', fontWeight: 600, color: 'var(--sr-text)' }}>No dated observations found</div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', maxWidth: 420, lineHeight: 1.55 }}>
          Your eBird backup loaded, but it has no observations with valid dates to lay out on a calendar.
        </div>
      </div>
    )
  }

  const combined = view.kind === 'combined'
  const yearSpan = years.length ? { lo: years[0], hi: years[years.length - 1] } : null
  const prevDisabled = combined || adjacentDataYear(years, view.kind === 'year' ? view.year : 0, -1) == null
  const nextDisabled = combined || adjacentDataYear(years, view.kind === 'year' ? view.year : 0, 1) == null

  const viewYearLabel = combined
    ? (yearSpan && yearSpan.lo !== yearSpan.hi ? `All years · ${yearSpan.lo}–${yearSpan.hi}` : 'All years')
    : String(view.kind === 'year' ? view.year : '')
  const metricPhrase = metric === 'checklists'
    ? (combined ? 'Checklists across all years on each calendar day' : 'Checklists submitted each day')
    : (combined ? 'Species ever recorded on each calendar day' : 'Species seen each day')
  const formsSuffix = metric === 'species' && includeForms ? ', spuh/slash/hybrids included' : ''
  const viewSub = `${metricPhrase}${formsSuffix} · ${daysBirded.toLocaleString()} ${daysBirded === 1 ? 'day' : 'days'} birded`

  const formsDisabled = metric === 'checklists'

  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {/* House header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 14 }}>
        <div style={{ width: 30, height: 30, borderRadius: 8, flexShrink: 0, background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <CalendarDays size={16} strokeWidth={2.2} aria-hidden />
        </div>
        <div>
          <h2 style={{ fontSize: '1.125rem', fontWeight: 700, margin: '0 0 2px', color: 'var(--sr-text)', letterSpacing: '-0.01em' }}>Calendar</h2>
          <p style={{ fontSize: '0.8125rem', color: 'var(--sr-text-muted)', margin: 0, lineHeight: 1.5 }}>
            A year of your birding as twelve month grids — each day shaded by how much you saw, with a click into the checklists behind it.
          </p>
        </div>
      </div>

      {/* Control strip */}
      <div role="region" aria-label="Calendar controls" style={{ display: 'flex', flexDirection: 'column', background: 'var(--sr-surface-faint)', border: '1px solid var(--sr-border-subtle)', borderRadius: 10, marginBottom: 18 }}>
        <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '16px 14px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>Show</span>
            <SegControl
              ariaLabel="Day metric"
              value={metric}
              onChange={setMetric}
              options={[{ value: 'species', label: 'Species' }, { value: 'checklists', label: 'Checklists' }]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>Year</span>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>
              <button type="button" onClick={goPrev} disabled={prevDisabled} aria-label="Previous year with data" style={navBtnStyle(prevDisabled)}>
                <ChevronLeft size={15} strokeWidth={2.4} aria-hidden />
              </button>
              <span style={{ minWidth: 74, textAlign: 'center', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--sr-text)', fontVariantNumeric: 'tabular-nums' }}>
                {combined ? '—' : (view.kind === 'year' ? view.year : '')}
              </span>
              <button type="button" onClick={goNext} disabled={nextDisabled} aria-label="Next year with data" style={navBtnStyle(nextDisabled)}>
                <ChevronRight size={15} strokeWidth={2.4} aria-hidden />
              </button>
              <button
                type="button"
                onClick={toggleAllYears}
                aria-pressed={combined}
                style={{
                  font: 'inherit', fontSize: '0.71875rem', fontWeight: 600, cursor: 'pointer', marginLeft: 6,
                  height: 30, padding: '0 12px', borderRadius: 15,
                  border: `1.5px solid ${combined ? 'var(--sr-accent-border-strong)' : 'var(--sr-border)'}`,
                  background: combined ? 'var(--sr-accent-bg)' : 'var(--sr-surface)',
                  color: combined ? 'var(--sr-accent)' : 'var(--sr-text-muted)',
                }}
              >
                All years
              </button>
            </div>
          </div>

          <div style={{ flex: '1 1 auto', minWidth: 0 }} />

          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>View</span>
            <SegControl
              ariaLabel="View density"
              value={density}
              onChange={setDensity}
              options={[
                { value: 'months', label: 'Months', title: 'Large month grids with day numbers', icon: <LayoutGrid size={13} strokeWidth={2.2} aria-hidden /> },
                { value: 'year', label: 'Year', title: 'All twelve months as small heatmap thumbnails', icon: <Grid2x2 size={13} strokeWidth={2.2} aria-hidden /> },
              ]}
            />
          </div>

          <Switch label="Use Textures" checked={textures} onChange={() => setTextures(v => !v)} />
        </div>

        {/* Settling row: the spuh/slash/hybrid toggle — Species-only, dimmed + inert under Checklists */}
        <div
          className="sr-wrap-flex"
          aria-disabled={formsDisabled || undefined}
          style={{
            ['--sr-wrap-gap' as string]: '10px',
            padding: '9px 16px', borderTop: '1px solid var(--sr-border-subtle)',
            background: 'var(--sr-surface-subtle)', borderRadius: '0 0 10px 10px',
            opacity: formsDisabled ? 0.45 : 1,
            pointerEvents: formsDisabled ? 'none' : 'auto',
          }}
        >
          <Switch small label="Count spuh, slash & hybrids" checked={includeForms} onChange={() => setIncludeForms(v => !v)} disabled={formsDisabled} />
          <p style={{ margin: 0, fontSize: '0.6875rem', lineHeight: 1.35, color: 'var(--sr-text-muted)' }}>
            Spuh / slash / hybrid forms aren't countable species; off by default.
          </p>
        </div>
      </div>

      {/* View label + legend */}
      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--sr-text)', letterSpacing: '-0.01em' }}>{viewYearLabel}</div>
          <div style={{ fontSize: '0.71875rem', color: 'var(--sr-text-muted)', marginTop: 1 }}>{viewSub}</div>
        </div>
        <CalendarLegend view={view} metric={metric} textures={textures} tiers={tiers} />
      </div>

      {/* Grid */}
      {density === 'months' ? (
        <div className="sr-cal-months">
          {monthDescriptors.map((descriptors, i) => (
            <MonthGrid
              key={i + 1}
              month={i + 1}
              descriptors={descriptors}
              textures={textures}
              metric={metric}
              onOpen={openPopup}
              cardRef={el => { monthCardRefs.current[i] = el }}
            />
          ))}
        </div>
      ) : (
        <YearOverview monthDescriptors={monthDescriptors} textures={textures} onExpand={expandMonth} />
      )}

      {popup && (
        <DayPopup cell={popup} view={view} includeForms={includeForms} onClose={closePopup} />
      )}
    </div>
  )
}

const ctrlLabelStyle: React.CSSProperties = {
  fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)',
}

function navBtnStyle(disabled: boolean): React.CSSProperties {
  return {
    font: 'inherit', cursor: disabled ? 'default' : 'pointer', width: 30, height: 30, borderRadius: 8,
    border: '1px solid var(--sr-border)', background: 'var(--sr-surface)', color: 'var(--sr-text)',
    display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
    opacity: disabled ? 0.4 : 1,
  }
}
