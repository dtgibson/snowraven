// The Calendar tab: a year of the birder's eBird data as twelve month grids (like a
// wall calendar's twelve pages), each day carrying a count — species-seen-that-day
// or checklists-that-day, by a toggle — relatively color-shaded (with a colorblind
// crosshatch-density alternative), navigable across every year the backup covers
// plus an all-years-combined view (whose weekday columns align to the CURRENT year).
// Clicking a day opens a popup with that day's summary and links to its eBird
// checklists. A view toggle switches between the big month grids (labeled "Compact",
// count-only cells, no day-of-month date) and a 3×4 Year-Overview of shaded, dated
// mini-month thumbnails (labeled "Large", date + shade, no count — the figures live in
// the day popup). Both show the whole year, only the cell size and what each cell
// carries differ; the overview is read-only (the toggle is the only way to switch
// views). The toggle governs at ALL widths (phones included), so both distinct views
// are reachable on mobile. A low-emphasis "Count all forms" toggle optionally
// admits the forms eBird does not count into the Species / Total count metrics.
//
// Frontend-only, offline, zero new network. Pure derivation lives in lib/calendar.ts;
// the DOM crosshatch density in lib/calendarTextures.ts. See pipeline/calendar-tab.

import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Loader2, AlertCircle, CalendarDays, ChevronLeft, ChevronRight,
  LayoutGrid, Grid2x2, X,
} from 'lucide-react'
import type { ObservationEntry } from '../types'
import { SetupRequired } from './SetupRequired'
import { EBIRD_BACKUP_STEPS, EBIRD_BACKUP_LOAD_ERROR } from './setupCopy'
import { storage } from '../lib/storage'
import { loadEbirdObservations } from '../lib/observationsCache'
import { useProvenanceLookup } from '../lib/useProvenanceLookup'
import { COUNT_RULE_SENTENCE } from '../lib/exoticCopy'
import {
  COUNT_FORMS_TOGGLE_LABEL, COUNT_FORMS_HELPER, COUNT_FORMS_POPUP_NOTE, COUNT_FORMS_SUFFIX,
} from '../lib/countabilityCopy'
import { formatDate } from '../lib/formatDate'
import { ChecklistLink } from './ChecklistLink'
import { computeCountyTiers, type CountyTiers } from '../lib/countyShading'
import {
  buildDayCells, dataYears, defaultYear, adjacentDataYear, metricCount,
  nonZeroMetricCounts, daysInMonth, dayOfWeek,
  type CalendarMetric, type CalendarView, type DayCell, type DayCellMap,
} from '../lib/calendar'
import { calHatchCss, calMiniHatchCss, type CalTier } from '../lib/calendarTextures'
import { normalizeSpeciesName } from '../lib/speciesUtils'
import { SpeciesCombobox } from './SpeciesCombobox'

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December']
const WEEKDAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'] // Sunday-first single letters

// The combined ("All years") grid aligns its weekday columns to the CURRENT year, so
// the combined layout matches this year's single-year view instead of a fixed
// reference year no birder is looking at. The "now" read is a module-level SESSION
// constant (evaluated once at import) — NEVER a render-time new Date()/Date.now()
// (react-hooks/purity is build-blocking). This is grid GEOMETRY only; it never feeds
// dataYears/defaultYear (the no-now-read year-selection contract is untouched).
const SESSION_NOW_MS = Date.now()
const CURRENT_YEAR = new Date(SESSION_NOW_MS).getFullYear()

// The View toggle is density-neutral internally: 'months' renders the big MonthGrid
// (labeled "Compact"), 'overview' renders the YearOverview thumbnails (labeled
// "Large"). Keeping the value names label-agnostic means the UI copy can be worded
// however reads best without the code and the label disagreeing. Session-only state.
type ViewMode = 'months' | 'overview'

type Phase =
  | { tag: 'loading' }
  | { tag: 'setup-required' }
  | { tag: 'empty' }
  | { tag: 'error'; message: string }
  | { tag: 'ready'; observations: ObservationEntry[] }

/** Stable empty reference for the passive provenance read before data loads. */
const EMPTY_OBSERVATIONS: ObservationEntry[] = []

// ── Small presentational pieces ──────────────────────────────────────────────

function SegControl<T extends string>({ options, value, onChange, ariaLabel }: {
  options: { value: T; label: string; icon?: React.ReactNode; title?: string }[]
  value: T
  onChange: (v: T) => void
  ariaLabel: string
}) {
  // .sr-seg makes the segments FILL their line once the group wraps (v1.0.4).
  // The pill paints --sr-surface-subtle behind the whole group, so a wrapped
  // line that only its widest option reaches left a broad band of empty grey
  // beside it: at 402px the group is 273px wide with "Total count" alone on
  // line two, about 166px of dead background. Growing the segments keeps the
  // pill looking like a control rather than a grey rectangle. Pre-existing
  // (measured byte-identical on the v1.0.3 build), fixed here because it is the
  // same family as the rest of this change.
  return (
    <div className="sr-wrap-flex sr-seg" role="group" aria-label={ariaLabel}
      style={{ ['--sr-wrap-gap' as string]: '2px', background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2 }}>
      {options.map(opt => {
        const active = value === opt.value
        return (
          <button tabIndex={0}
            key={opt.value}
            type="button"
            className="sr-seg-btn"
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
      // fontSize sits on the BUTTON, not on the label span below, so the shared
      // .sr-ctl-row phone-tier rule (globals.css) can reach it: a size declared on
      // a nested span wins over any class on an ancestor, and the label would
      // otherwise stay small beside the strip's other controls. The span inherits
      // it, so desktop rendering is unchanged.
      style={{
        display: 'inline-flex', alignItems: 'center', gap: 8,
        background: 'none', border: 'none', padding: 0, margin: 0,
        cursor: disabled ? 'default' : 'pointer', fontFamily: 'inherit',
        fontSize: small ? '0.71875rem' : '0.75rem',
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
          width: knob, height: knob, borderRadius: '50%', background: 'var(--sr-switch-thumb)',
          boxShadow: 'var(--sr-switch-thumb-shadow)', transition: 'left 0.12s',
        }} />
      </span>
      <span style={{ fontWeight: 600, color: 'var(--sr-text)' }}>{label}</span>
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
    // A day with no checklist: a faint outlined cell. The big month grids are count-only
    // at EVERY width (the day-of-month date lives on the Large-view thumbnails, which are
    // reachable on the phone via the View toggle). A day is identified by its grid
    // position and, on a data/zero day, its aria-label.
    return (
      <div aria-hidden style={{ ...base, background: 'transparent', border: '1px solid var(--sr-border-subtle)', pointerEvents: 'none' }} />
    )
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
        aria-label={`${dateLabel}: birded, 0 ${metric === 'checklists' ? 'checklists' : metric === 'total' ? 'individuals' : 'countable species'}. Open day details`}
        className="sr-touch-target sr-cal-day"
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
      aria-label={`${dateLabel}: ${desc.count}. Open day details`}
      className="sr-touch-target sr-cal-day"
      style={{
        ...base, ...fill, cursor: 'pointer', WebkitTapHighlightColor: 'transparent',
      }}
      onMouseEnter={e => (e.currentTarget.style.filter = textures ? 'none' : 'brightness(1.12)')}
      onMouseLeave={e => (e.currentTarget.style.filter = 'none')}
    >
      {/* The big month cells are count-only at every width: the centered --sr-cal-fg count
          reads over the shade (and in textures mode over the tier-color pill numStyle backs).
          The day-of-month date lives on the Large-view thumbnails, reachable via the toggle. */}
      <span style={{ fontSize: '0.6875rem', fontWeight: 600, fontVariantNumeric: 'tabular-nums', color: 'var(--sr-cal-fg)', lineHeight: 1, ...numStyle }}>
        {desc.count}
      </span>
    </button>
  )
}

// The small day-of-month label in the top-left corner (wall-calendar convention).
// The sole caller is the Year-Overview mini-month thumbnails (shown at their container-
// query legibility floor); the big MonthGrid cells are count-only at every width and
// carry no date. Decorative-only (the accessible date lives in the day popup);
// pointer-events:none keeps the parent the sole hit target. Sized in rem so it holds at
// 200% text scale.
function DayCorner({ day, color, pillStyle }: { day: number; color: string; pillStyle?: React.CSSProperties }) {
  return (
    <span
      aria-hidden
      className="sr-cal-daynum"
      style={{
        position: 'absolute', top: 2, left: 3, lineHeight: 1,
        fontWeight: 600, fontVariantNumeric: 'tabular-nums',
        color, pointerEvents: 'none',
        // In textures mode pillStyle is the same solid tier-color pill the centered
        // count carries — without it the white date renders over the faint hatch
        // underlay (~1.2:1 in light theme). Empty ({}) in solid-fill mode → no change.
        ...pillStyle,
      }}
    >
      {day}
    </span>
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

// Build the ordered cell descriptors for one month grid. `leadYear` is the calendar
// year for the weekday lead-in geometry: the actual year for a single-year view, or
// CURRENT_YEAR for the combined view so its columns match this year's grid. `combined`
// forces February to 29 days regardless of the lead year's leapness — the combined
// grid always keeps its Feb-29 cell (the README promise), even when CURRENT_YEAR is a
// non-leap year like 2026. The two uses of the year are deliberately decoupled: the
// weekday lead-in follows leadYear; daysInMonth for the combined view is pinned to 29
// for February and the Feb-29 cell flows into the slot after Feb 28.
function buildMonthCells(
  month: number,
  leadYear: number,
  combined: boolean,
  keyFor: (day: number) => string,
  cells: DayCellMap,
  tiers: CountyTiers,
  metric: CalendarMetric,
  includeForms: boolean,
): DayCellDescriptor[] {
  const out: DayCellDescriptor[] = []
  const lead = dayOfWeek(leadYear, month, 1) // 0=Sunday
  for (let i = 0; i < lead; i++) out.push({ kind: 'pad' })
  const dim = combined && month === 2 ? 29 : daysInMonth(leadYear, month)
  for (let day = 1; day <= dim; day++) {
    const key = keyFor(day)
    const cell = cells.get(key)
    if (!cell) { out.push({ kind: 'nodata', day }); continue }
    const count = metricCount(cell, metric, includeForms)
    if (count === 0) { out.push({ kind: 'zero', day, cell }); continue }
    // Clamp to the 5-class ramp: tierFor returns breaks.length (6) for a value above
    // the max break. It can't fire today (every rendered count is in the tiering set),
    // but the clamp keeps a --sr-cal-6-less ramp defensive — do it at the CALL SITE,
    // never in countyShading.ts (the county overlay relies on the breaks.length return).
    out.push({ kind: 'data', day, count, cell, tier: Math.min(tiers.tierFor(count), 5) as CalTier })
  }
  return out
}

// ── Big month grid ───────────────────────────────────────────────────────────

function MonthGrid({ month, descriptors, textures, metric, onOpen }: {
  month: number
  descriptors: DayCellDescriptor[]
  textures: boolean
  metric: CalendarMetric
  onOpen: (cell: DayCell, el: HTMLButtonElement) => void
}) {
  return (
    <div
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

function MiniMonth({ month, descriptors, textures, metric, onOpen }: {
  month: number
  descriptors: DayCellDescriptor[]
  textures: boolean
  metric: CalendarMetric
  onOpen: (cell: DayCell, el: HTMLButtonElement) => void
}) {
  // A thumbnail card whose MONTH level is static/non-interactive (v0.5.63): the month
  // name is readable text, and the card is a plain container — no onClick, no aria-label,
  // no "Open →" affordance, so it never navigates between the two views (the Compact/
  // Large toggle is the only view switch). Its DAY cells ARE interactive, though: each
  // data/zero cell is a real <button> opening the SAME day popup as the Compact grid.
  return (
    <div
      className="sr-cal-minimonth"
      style={{
        background: 'var(--sr-surface)', border: '1px solid var(--sr-border)', borderRadius: 12,
        boxShadow: 'var(--sr-card-shadow)', padding: '12px 14px 14px',
      }}
    >
      <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--sr-text)', letterSpacing: '-0.01em', margin: '0 0 8px' }}>
        {MONTH_NAMES[month - 1]}
      </div>
      <div className="sr-cal-minigrid" style={{ display: 'grid', gridTemplateColumns: 'repeat(7,1fr)', gap: 2 }}>
        {descriptors.map((d, i) => <MiniDayCell key={i} desc={d} textures={textures} metric={metric} onOpen={onOpen} />)}
      </div>
    </div>
  )
}

function MiniDayCell({ desc, textures, metric, onOpen }: {
  desc: DayCellDescriptor
  textures: boolean
  metric: CalendarMetric
  onOpen: (cell: DayCell, el: HTMLButtonElement) => void
}) {
  // A shaded thumbnail cell carrying a small day-of-month number (restored in v0.5.63).
  // Data/zero cells are real, focusable <button>s (v0.5.63 revision) that open the SAME
  // single day popup as the Compact grid's DayCellButton — one popup, one code path — so
  // day detail is reachable from the Large overview without switching views. Which cell
  // kinds are clickable MIRRORS the Compact grid EXACTLY (data + zero → button; pad +
  // nodata → non-interactive). The number HIDES below the 152px cell floor (the
  // .sr-cal-mininum container query in globals.css) so a too-small cell stays a clean
  // magnitude heatmap. The cell shows shade + date only (no count) — the exact figures
  // live in the Compact view and the day popup. position:relative anchors DayCorner.
  // Hook must run unconditionally (before any early return) — React rules of hooks.
  const ref = useRef<HTMLButtonElement>(null)
  const base: React.CSSProperties = {
    aspectRatio: '1 / 1', borderRadius: 2, minWidth: 0, overflow: 'hidden', position: 'relative',
  }
  if (desc.kind === 'pad') return <div aria-hidden style={{ ...base, background: 'transparent' }} />
  if (desc.kind === 'nodata') {
    return (
      <div aria-hidden className="sr-cal-mininum" style={{ ...base, background: 'transparent', border: '1px solid var(--sr-border-subtle)' }}>
        {desc.day != null && <DayCorner day={desc.day} color="var(--sr-text-muted)" />}
      </div>
    )
  }

  const cell = desc.cell!
  const dateLabel = cellDateLabel(cell.bucketKey)
  const btnBase: React.CSSProperties = { ...base, border: 0, padding: 0, margin: 0, font: 'inherit', cursor: 'pointer', WebkitTapHighlightColor: 'transparent' }

  if (desc.kind === 'zero') {
    // Present-but-zero: a muted outlined cell (parity with the Compact zero cell), still
    // dated so the day is identifiable; no "0" glyph. Accessible name matches the Compact
    // zero cell's pattern.
    return (
      <button
        ref={ref}
        type="button"
        tabIndex={0}
        onClick={() => onOpen(cell, ref.current!)}
        aria-label={`${dateLabel}: birded, 0 ${metric === 'checklists' ? 'checklists' : metric === 'total' ? 'individuals' : 'countable species'}. Open day details`}
        className="sr-cal-mininum"
        style={{ ...btnBase, background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border-subtle)' }}
      >
        {desc.day != null && <DayCorner day={desc.day} color="var(--sr-text-muted)" />}
      </button>
    )
  }
  const tier = desc.tier!
  const fill: React.CSSProperties = textures ? calMiniHatchCss(tier) : { background: `var(--sr-cal-${tier})` }
  // In textures mode the crosshatch would swallow the number — back it with the same
  // tier-color pill the Compact cell uses so the date reads over the hatch.
  const numStyle: React.CSSProperties = textures
    ? { background: `rgba(var(--sr-cal-${tier}-rgb), 0.9)`, borderRadius: 2, padding: '0 1px' }
    : {}
  return (
    <button
      ref={ref}
      type="button"
      tabIndex={0}
      onClick={() => onOpen(cell, ref.current!)}
      aria-label={`${dateLabel}: ${desc.count}. Open day details`}
      className="sr-cal-mininum"
      style={{ ...btnBase, ...fill }}
    >
      {desc.day != null && <DayCorner day={desc.day} color="var(--sr-cal-fg)" pillStyle={numStyle} />}
    </button>
  )
}

// ── Legend ───────────────────────────────────────────────────────────────────

function legendUnit(view: CalendarView, metric: CalendarMetric): string {
  const combined = view.kind === 'combined'
  if (metric === 'checklists') {
    return combined ? 'Checklists across all years' : 'Checklists / day'
  }
  if (metric === 'total') {
    return combined ? 'Individuals across all years' : 'Individuals / day'
  }
  return combined ? 'Species ever recorded' : 'Species / day'
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

function DayPopup({ cell, view, includeForms, showFormsNote, onClose }: {
  cell: DayCell
  view: CalendarView
  includeForms: boolean
  showFormsNote: boolean
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
  const totalNum = includeForms ? cell.totalCountWithForms : cell.totalCount
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
  const totalLabel = includeForms
    ? (combined ? 'individuals (incl. forms), all years' : 'individuals (incl. forms)')
    : (combined ? 'individuals, all years' : 'individuals')

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
            {showFormsNote && !combined && <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{COUNT_FORMS_POPUP_NOTE}</div>}
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

        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10, padding: '14px 18px 4px' }}>
          <div style={{ flex: '1 1 90px', minWidth: 90, background: 'var(--sr-surface-subtle)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{speciesNum}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 4 }}>{speciesLabel}</div>
          </div>
          <div style={{ flex: '1 1 90px', minWidth: 90, background: 'var(--sr-surface-subtle)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{cell.checklistCount}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 4 }}>{checklistLabel}</div>
          </div>
          <div style={{ flex: '1 1 90px', minWidth: 90, background: 'var(--sr-surface-subtle)', borderRadius: 9, padding: '10px 12px' }}>
            <div style={{ fontSize: '1.375rem', fontWeight: 700, color: 'var(--sr-accent)', lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>{totalNum.toLocaleString()}</div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 4 }}>{totalLabel}</div>
          </div>
        </div>

        <div style={{ fontSize: '0.625rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', padding: '14px 18px 6px' }}>
          Checklists
        </div>
        <div className="sr-map-popup-body" style={{ padding: '0 10px 14px', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {rows.map((r, i) => (
            <PopupChecklistRow
              key={`${r.submissionId}-${i}`}
              submissionId={r.submissionId}
              date={r.date}
              time={r.time}
              location={r.location}
              speciesCount={includeForms ? r.speciesCountWithForms : r.speciesCount}
              combined={combined}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// Tidy an eBird checklist start time ("HH:MM AM/PM") for display: trim a single
// leading zero on the hour ("07:30 AM" → "7:30 AM"). Deliberately minimal — the eBird
// export already carries a "HH:MM AM/PM" string, so we only shave the pad, not reparse.
function formatChecklistTime(time: string): string {
  return time.replace(/^0(\d:)/, '$1')
}

function PopupChecklistRow({ submissionId, date, time, location, speciesCount, combined }: {
  submissionId: string
  date: string
  time: string | null
  location: string
  speciesCount: number
  combined: boolean
}) {
  // The row's primary line is the ChecklistLink affordance (junk id → plain text via
  // SUBMISSION_ID_RE inside ChecklistLink), and ChecklistLink emits its OWN shared
  // external-link glyph — so we render exactly one icon per row (no duplicate). In
  // combined mode a year chip anchors the row.
  //
  // The secondary line shows the checklist's start time, location, and its OWN distinct-
  // species count as low-emphasis context ("7:30 AM · Point Reyes NS--Bear Valley · 42
  // species"). `speciesCount` already reflects the include-forms toggle (countable by
  // default, with-forms when on) — the caller picks the field — so it stays consistent
  // with the day-level stat tiles and the rest of the tab. The count is ALWAYS present
  // (even "0 species" for a spuh-only checklist in countable mode), so it always shows;
  // time and location degrade gracefully (no stray "·" when one is missing). The LOCATION
  // IS PLAIN TEXT ON PURPOSE — NOT a HotspotLink: the Calendar tab is intentionally fully
  // offline / zero new network (see this file's header), and HotspotLink needs a live
  // hotspot-region fetch to decide public-vs-personal. Rendering the name as React
  // children auto-escapes it (injection-safe). Do NOT "fix" this into a HotspotLink — it
  // would add a network dependency the tab deliberately avoids.
  const year = date.slice(0, 4)
  const prettyTime = time ? formatChecklistTime(time) : null
  const loc = location.trim()
  // "species" is an invariant plural here ("1 species", "42 species") — eBird/birder
  // convention, and it keeps the count short so it never needs truncation.
  const speciesPart = `${speciesCount.toLocaleString()} species`
  // The "time · location" prefix degrades gracefully (no stray "·" when one is missing);
  // the species count is ALWAYS present, so a middot precedes it only when a prefix
  // exists. The prefix truncates (long location → ellipsis) while the species count is
  // flex-shrink:0 so it stays fully visible on the tail — the count is short and must not
  // be clipped. A single meta string kept location + count in one ellipsis; splitting
  // them protects the count.
  const prefix = prettyTime && loc ? `${prettyTime} · ${loc}` : (prettyTime ?? loc)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 8px', borderRadius: 8 }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--sr-surface-subtle)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
    >
      <div style={{ minWidth: 0, flex: 1 }}>
        <div style={{ fontWeight: 600, color: 'var(--sr-text)', fontSize: '0.8125rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          <ChecklistLink submissionId={submissionId} label={formatDate(date)} style={{ fontWeight: 600 }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 0, fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2, minWidth: 0 }}>
          {prefix && (
            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>{prefix}</span>
          )}
          <span style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>{prefix ? ` · ${speciesPart}` : speciesPart}</span>
        </div>
      </div>
      {combined && <span style={{ fontSize: '0.5625rem', fontWeight: 700, color: 'var(--sr-text-muted)', background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', borderRadius: 4, padding: '1px 5px', flexShrink: 0 }}>{year}</span>}
    </div>
  )
}

// ── Year Overview ────────────────────────────────────────────────────────────

function YearOverview({ monthDescriptors, textures, metric, onOpen }: {
  monthDescriptors: DayCellDescriptor[][]
  textures: boolean
  metric: CalendarMetric
  onOpen: (cell: DayCell, el: HTMLButtonElement) => void
}) {
  return (
    <div className="sr-cal-year">
      {monthDescriptors.map((descriptors, i) => (
        <MiniMonth key={i + 1} month={i + 1} descriptors={descriptors} textures={textures} metric={metric} onOpen={onOpen} />
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
  // The View toggle: 'months' = the big MonthGrid ("Compact" label, count-only), 'overview'
  // = the YearOverview thumbnails ("Large" label, date + shade). Default is the big month
  // grids. The toggle governs at ALL widths — phones included — so both distinct views are
  // reachable on mobile (no phone force). Session-only state.
  const [viewMode, setViewMode] = useState<ViewMode>('months')
  const [includeForms, setIncludeForms] = useState(false)
  // Session-only per-species filter ('' = All species). A normalized common name.
  const [selectedSpecies, setSelectedSpecies] = useState('')
  const [popup, setPopup] = useState<DayCell | null>(null)

  const openerRef = useRef<HTMLButtonElement | null>(null)

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
          setPhase({ tag: 'error', message: EBIRD_BACKUP_LOAD_ERROR })
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

  // Sorted, deduped normalized common names across all observations — the
  // options for the per-species filter (folds subspecies/form parentheticals).
  const speciesOptions = useMemo(() => {
    if (!observations) return [] as string[]
    const set = new Set<string>()
    for (const o of observations) set.add(normalizeSpeciesName(o.commonName))
    return [...set].sort((a, b) => a.localeCompare(b))
  }, [observations])

  // A concrete species is selected only when the value is non-empty AND still a
  // valid option (guards a stale selection after the backup changes).
  const speciesFilterActive = selectedSpecies !== '' && speciesOptions.includes(selectedSpecies)

  // Under a concrete species filter the include-forms toggle is inert/dimmed, so
  // it must have NO effect on output: force the with-forms field. For a normal
  // species countable===withForms (a no-op); for a selected spuh/slash/hybrid it
  // makes the calendar render its own presence instead of an all-zero grid.
  const effectiveForms = speciesFilterActive ? true : includeForms

  // The escapee rule, read PASSIVELY. `useProvenanceLookup` touches the storage
  // seam and the pure model only; it imports no network module, holds no key
  // dependency, and initiates nothing. This tab's zero-network guarantee is
  // therefore unchanged, and with an empty cache the set is empty and every
  // number here is byte-identical to pre-feature (FR-26, FR-35, QA-40).
  const escapeeNames = useProvenanceLookup(observations ?? EMPTY_OBSERVATIONS)

  const cells = useMemo(
    () => (observations
      ? buildDayCells(observations, view, speciesFilterActive ? selectedSpecies : undefined, escapeeNames)
      : new Map() as DayCellMap),
    [observations, view, speciesFilterActive, selectedSpecies, escapeeNames],
  )
  const tiers = useMemo(
    () => computeCountyTiers(nonZeroMetricCounts(cells, metric, effectiveForms), 5),
    [cells, metric, effectiveForms],
  )

  // Twelve months of cell descriptors (both densities read the same). The combined
  // view aligns its weekday lead-in to CURRENT_YEAR (a module-level session constant,
  // never a render-time now-read) so the combined grid matches this year's single-year
  // view; buildMonthCells pins February to 29 days in the combined view so the Feb-29
  // cell survives even in a non-leap current year.
  const combinedView = view.kind === 'combined'
  const leadYear = combinedView ? CURRENT_YEAR : view.year
  const monthDescriptors = useMemo(() => {
    const out: DayCellDescriptor[][] = []
    for (let m = 1; m <= 12; m++) {
      const keyFor = combinedView
        ? (day: number) => `${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
        : (day: number) => `${view.year}-${String(m).padStart(2, '0')}-${String(day).padStart(2, '0')}`
      out.push(buildMonthCells(m, leadYear, combinedView, keyFor, cells, tiers, metric, effectiveForms))
    }
    return out
  }, [cells, tiers, metric, effectiveForms, view, combinedView, leadYear])

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
        <div className="sr-wrap-anywhere" style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '9px 13px', background: 'var(--sr-error-bg)', borderRadius: 8, fontSize: '0.8125rem', color: 'var(--sr-error)', maxWidth: 480 }}>
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
    : metric === 'total'
      ? (combined ? 'Individuals recorded on each calendar day' : 'Individuals recorded each day')
      : (combined ? 'Species ever recorded on each calendar day' : 'Species seen each day')
  const formsSuffix = (metric === 'species' || metric === 'total') && !speciesFilterActive && includeForms ? COUNT_FORMS_SUFFIX : ''
  const speciesSuffix = speciesFilterActive ? ` · ${selectedSpecies} only` : ''
  const viewSub = `${metricPhrase}${formsSuffix}${speciesSuffix} · ${daysBirded.toLocaleString()} ${daysBirded === 1 ? 'day' : 'days'} birded`

  // The spuh/include-forms toggle is meaningless under a concrete species filter
  // (a normalized name has no forms to admit), and always for the Checklists metric.
  const formsDisabled = metric === 'checklists' || speciesFilterActive

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
            A year of your birding as twelve month grids, each day shaded by how much you saw, with a click into the checklists behind it.
          </p>
        </div>
      </div>

      {/* Control strip. .sr-ctl-row spans BOTH rows of the strip so the SegControls,
          the year buttons and the switches share one phone-tier text size with the
          .sr-input-16 combobox (globals.css); the uppercase SHOW / SPECIES / YEAR /
          VIEW labels are spans and stay smaller by design. */}
      <div className="sr-ctl-row" role="region" aria-label="Calendar controls" style={{ display: 'flex', flexDirection: 'column', background: 'var(--sr-surface-faint)', border: '1px solid var(--sr-border-subtle)', borderRadius: 10, marginBottom: 18 }}>
        <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '16px 14px', padding: '12px 16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>Show</span>
            <SegControl
              ariaLabel="Day metric"
              value={metric}
              onChange={setMetric}
              options={[{ value: 'species', label: 'Species' }, { value: 'checklists', label: 'Checklists' }, { value: 'total', label: 'Total count' }]}
            />
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
            <span style={ctrlLabelStyle}>Species</span>
            <SpeciesCombobox
              options={speciesOptions.map(name => ({ name }))}
              value={selectedSpecies}
              onChange={n => { setSelectedSpecies(n ?? ''); setPopup(null) }}
              allLabel="All species"
              placeholder="Filter to one species…"
              ariaLabel="Filter the calendar to one species"
              size="sm"
              className="sr-input-16"
            />
          </div>

          {/* Layout LIFTED to classes (v1.0.4): the inline display/align/gap this
              carried are specificity (1,0,0) and unreachable from a media query,
              so the group could not be told to wrap on a phone. Values are
              byte-identical to the inline ones they replace; the phone-tier wrap
              lives in globals.css beside them. */}
          <div className="sr-cal-year-group">
            <span style={ctrlLabelStyle}>Year</span>
            <div className="sr-cal-year-nav">
              <button type="button" onClick={goPrev} disabled={prevDisabled} aria-label="Previous year with data" style={navBtnStyle(prevDisabled)}>
                <ChevronLeft size={15} strokeWidth={2.4} aria-hidden />
              </button>
              <span style={{ minWidth: 74, textAlign: 'center', fontSize: '0.9375rem', fontWeight: 700, color: 'var(--sr-text)', fontVariantNumeric: 'tabular-nums' }}>
                {combined ? '·' : (view.kind === 'year' ? view.year : '')}
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

          <div className="sr-cal-view-toggle" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={ctrlLabelStyle}>View</span>
            <SegControl
              ariaLabel="Calendar view"
              value={viewMode}
              onChange={setViewMode}
              options={[
                { value: 'months', label: 'Compact', title: 'The twelve big month grids, with a count on every birded day', icon: <LayoutGrid size={13} strokeWidth={2.2} aria-hidden /> },
                { value: 'overview', label: 'Large', title: 'All twelve months as shaded, dated thumbnails: the whole year at a glance', icon: <Grid2x2 size={13} strokeWidth={2.2} aria-hidden /> },
              ]}
            />
          </div>

          <Switch label="Use Textures" checked={textures} onChange={() => setTextures(v => !v)} />
        </div>

        {/* Settling row: the Count all forms toggle — Species-only, dimmed + inert under Checklists */}
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
          <Switch small label={COUNT_FORMS_TOGGLE_LABEL} checked={includeForms} onChange={() => setIncludeForms(v => !v)} disabled={formsDisabled} />
          <p style={{ margin: 0, fontSize: '0.6875rem', lineHeight: 1.35, color: 'var(--sr-text-muted)' }}>
            {COUNT_FORMS_HELPER}
          </p>
          {/* FR-33: the Species metric reflects the escapee rule once Statistics
              has resolved it, so the rule is stated here rather than left to be
              discovered. Plain text, no link and no fetch. */}
          {escapeeNames.size > 0 && (
            <p className="sr-count-rule-note" style={{ margin: 0 }}>{COUNT_RULE_SENTENCE}</p>
          )}
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

      {/* Grid: 'months' → the big MonthGrid cards ("Compact" label, count-only); 'overview'
          → the YearOverview thumbnails ("Large" label, dated + shaded). The toggle governs
          at all widths, so both are reachable on a phone. */}
      {viewMode === 'months' ? (
        <div className="sr-cal-months">
          {monthDescriptors.map((descriptors, i) => (
            <MonthGrid
              key={i + 1}
              month={i + 1}
              descriptors={descriptors}
              textures={textures}
              metric={metric}
              onOpen={openPopup}
            />
          ))}
        </div>
      ) : (
        <YearOverview monthDescriptors={monthDescriptors} textures={textures} metric={metric} onOpen={openPopup} />
      )}

      {popup && (
        <DayPopup cell={popup} view={view} includeForms={effectiveForms} showFormsNote={includeForms && !speciesFilterActive} onClose={closePopup} />
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
