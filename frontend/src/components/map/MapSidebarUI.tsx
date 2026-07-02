// Presentational sidebar primitives for the Map Explorer (extracted from
// MapExplorer.tsx in a behavior-preserving split). No map/state closures.

import { AlertCircle, ChevronDown } from 'lucide-react'
import { MARKER_LIST_CAP } from '../../lib/markersInView'
import { countyHatchSpec, type CountyTier } from '../../lib/countyTextures'
import { COMPLETENESS_BANDS } from '../../lib/countyCompleteness'

export function SegControl({ options, value, onChange, ariaLabel }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
  /** Optional group name. When set, the wrapper becomes role="group" with this
   *  label; the active option is always exposed via aria-pressed regardless. */
  ariaLabel?: string
}) {
  return (
    <div className="sr-wrap-flex" style={{ ['--sr-wrap-gap' as string]: '2px', background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2 }}
      role={ariaLabel ? 'group' : undefined} aria-label={ariaLabel}>
      {options.map(opt => (
        <button tabIndex={0}
          key={opt.value}
          onClick={() => onChange(opt.value)}
          aria-pressed={value === opt.value}
          style={{
            flex: '1 1 auto', padding: '0.35rem 4px',
            background: value === opt.value ? 'var(--sr-surface)' : 'transparent',
            border: `1px solid ${value === opt.value ? 'var(--sr-border)' : 'transparent'}`,
            borderRadius: 5, fontSize: '0.71875rem',
            fontWeight: value === opt.value ? 600 : 400,
            color: value === opt.value ? 'var(--sr-text)' : 'var(--sr-text-muted)',
            cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap',
          }}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}

export function SidebarLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase',
      letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginBottom: 6,
    }}>
      {children}
    </div>
  )
}

// Keyboard-accessible list of the markers currently in the map view. The on-map
// pins/teardrops are GL (canvas) and can't be focused; this focusable list is the
// keyboard path to them — each row activates the same <Popup> a pin click opens
// and pans the map. role="list"/"listitem" + an explicit aria-label make the
// purpose clear to a screen-reader user. Capped, with an over-cap "zoom in" hint
// mirroring the atlas overlay.
export function InViewMarkerList<T>({ heading, instructions, items, total, overCap, selectedId, getId, getPrimary, getSecondary, getDotColor, getDotLabel, onActivate, collapsed = false, onToggleCollapsed, panelId }: {
  heading: string
  instructions: string
  items: T[]
  total: number
  overCap: boolean
  selectedId: string | null
  getId: (item: T) => string
  getPrimary: (item: T) => string
  getSecondary: (item: T) => string
  /** Optional leading colour swatch (e.g. hotspot kind / sighting marker colour). */
  getDotColor?: (item: T) => string
  getDotLabel?: (item: T) => string
  onActivate: (item: T) => void
  /** When onToggleCollapsed is set, the heading becomes a collapse disclosure
   *  (chevron + aria-expanded) and the body collapses via grid-rows + inert,
   *  mirroring the Filters panel / Counties-in-view disclosures. */
  collapsed?: boolean
  onToggleCollapsed?: () => void
  panelId?: string
}) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
      {onToggleCollapsed ? (
        <button type="button" tabIndex={0} onClick={onToggleCollapsed} aria-expanded={!collapsed} aria-controls={panelId}
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, width: '100%', padding: 0, marginBottom: collapsed ? 0 : 6, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left' }}>
          <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.07em', color: 'var(--sr-text-muted)' }}>{heading} ({total.toLocaleString()})</span>
          <ChevronDown size={14} style={{ color: 'var(--sr-text-muted)', transform: collapsed ? 'rotate(-90deg)' : 'none', transition: 'transform 0.2s', flexShrink: 0 }} />
        </button>
      ) : (
        <SidebarLabel>{heading}</SidebarLabel>
      )}
      <div id={panelId} style={{ display: 'grid', gridTemplateRows: collapsed ? '0fr' : '1fr', transition: 'grid-template-rows 0.2s ease' }}>
        <div inert={collapsed} style={{ overflow: 'hidden', minHeight: 0 }}>
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginBottom: 8, lineHeight: 1.4 }}>
        {instructions}
      </div>
      {items.length === 0 ? (
        <div style={{ fontSize: '0.75rem', color: 'var(--sr-text-muted)' }}>
          None in the current map view — pan or zoom to bring markers into view.
        </div>
      ) : (
        <>
          <ul role="list" aria-label={heading} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {items.map(item => {
              const id = getId(item)
              const isSelected = selectedId === id
              const dot = getDotColor?.(item)
              return (
                <li role="listitem" key={id}>
                  <button
                    type="button"
                    tabIndex={0}
                    onClick={() => onActivate(item)}
                    aria-pressed={isSelected}
                    className="sr-inview-row"
                    style={{
                      display: 'flex', alignItems: 'center', gap: 8, width: '100%',
                      padding: '7px 8px', marginBottom: 2, borderRadius: 6,
                      textAlign: 'left', fontFamily: 'inherit', cursor: 'pointer',
                      background: isSelected ? 'var(--sr-accent-bg)' : 'transparent',
                      border: `1px solid ${isSelected ? 'var(--sr-accent-border)' : 'transparent'}`,
                    }}
                  >
                    {dot && (
                      <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: '50%', background: dot, flexShrink: 0 }} aria-hidden="true">
                        {getDotLabel && <span className="sr-only">{getDotLabel(item)}</span>}
                      </span>
                    )}
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: '0.78125rem', color: 'var(--sr-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {getPrimary(item)}
                      </span>
                      {/* Clamp the secondary to 2 lines so a long join (e.g. the
                          Nearby-Lifers "N lifers · name, name, …" list) can't
                          balloon a row to many lines; short secondaries are
                          unaffected. */}
                      <span style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden', fontSize: '0.625rem', color: 'var(--sr-text-muted)', overflowWrap: 'anywhere' }}>
                        {getSecondary(item)}
                      </span>
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          {overCap && (
            <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.4 }}>
              Showing the first {MARKER_LIST_CAP} of {total.toLocaleString()} in view — zoom in to narrow the list.
            </div>
          )}
        </>
      )}
        </div>
      </div>
    </div>
  )
}

export function KeyNotice({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div style={{
      display: 'flex', flexWrap: 'wrap', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      padding: '10px 12px', background: 'var(--sr-warning-bg)',
      border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
      fontSize: '0.75rem', color: 'var(--sr-warning)', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start', flex: 1, minWidth: 0 }}>
        <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>eBird API key required. Add it in Settings to use this feature.</span>
      </div>
      {/* .sr-touch-target grows the hit area to ~44px ON PHONES only (≤640);
          the text-link look (no bg/border) is untouched, desktop keeps its
          compact height. */}
      <button tabIndex={0}
        onClick={onGoToSettings}
        className="sr-touch-target"
        style={{
          background: 'none', border: 'none', padding: 0, fontSize: '0.6875rem', fontWeight: 600,
          color: 'var(--sr-warning)', cursor: 'pointer', fontFamily: 'inherit',
          whiteSpace: 'nowrap', flexShrink: 0,
        }}
      >
        Settings →
      </button>
    </div>
  )
}

// Legend swatch previewing a tier's hatch (when "Use Textures" is on). Drawn
// directly (no <pattern> ids) so it's safe to render in any sidebar, and tinted
// with the --sr-tier-N-rgb tokens so it tracks light/dark. Mirrors the on-map
// hatch density: dots (1) → diagonal (2) → cross (3) → dense cross (4).
export function TierHatchSwatch({ tier }: { tier: 1 | 2 | 3 | 4 }) {
  const rgb = `var(--sr-tier-${tier}-rgb)`
  const fillStyle = { fill: `rgba(${rgb}, 0.16)` }
  const dotStyle = { fill: `rgba(${rgb}, 0.9)` }
  const lineStyle = { stroke: `rgba(${rgb}, 0.7)`, strokeWidth: tier === 2 ? 1 : 0.8 }
  const step = tier === 2 ? 10 : tier === 3 ? 9 : 6
  const offsets: number[] = []
  for (let x = -14; x < 24; x += step) offsets.push(x)
  return (
    <svg width={24} height={14} aria-hidden
      style={{ flexShrink: 0, border: '1px solid var(--sr-border-medium)', borderRadius: 3, display: 'block', overflow: 'hidden' }}>
      <rect x={0} y={0} width={24} height={14} style={fillStyle} />
      {tier === 1
        ? [5, 12, 19].flatMap(cx => [4.5, 10].map(cy => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.1} style={dotStyle} />))
        : offsets.map(x => <line key={`a${x}`} x1={x} y1={14} x2={x + 14} y2={0} style={lineStyle} />)}
      {tier >= 3 && offsets.map(x => <line key={`b${x}`} x1={x} y1={0} x2={x + 14} y2={14} style={lineStyle} />)}
    </svg>
  )
}

// The Completeness legend (FR-27 / OQ-06): ten FIXED equal percentage bands over
// 0–100% — unlike the count metrics' data-driven quantile ranges — reusing the
// same --sr-county-1..10 swatches (or the CountyDensitySwatch crosshatch when
// Use Textures is on) so band N always paints identically on legend and map.
// Switching back to Species/Checklists restores the quantile legend untouched.
export function CountyCompletenessLegend({ useTextures }: { useTextures: boolean }) {
  return (
    <div style={{ marginTop: 12 }} aria-live="polite">
      <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--sr-text-muted)', marginBottom: 8 }}>
        Completeness — % of the county list
      </div>
      {COMPLETENESS_BANDS.map(b => (
        <div key={b.band} style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          {useTextures
            ? <CountyDensitySwatch tier={b.band as CountyTier} />
            : <span aria-hidden="true" style={{ width: 26, height: 15, borderRadius: 3, flexShrink: 0, border: '1px solid var(--sr-border-medium)', background: `var(--sr-county-${b.band})` }} />}
          <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)' }}>{b.label}</span>
        </div>
      ))}
      <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginTop: 8, marginBottom: 6 }}>
        <span aria-hidden="true" style={{ width: 26, height: 15, borderRadius: 3, flexShrink: 0, border: '1px dashed var(--sr-border-medium)', background: 'transparent' }} />
        <span style={{ fontSize: '0.75rem', color: 'var(--sr-text)' }}>
          Not birded / not fetched <span style={{ color: 'var(--sr-text-muted)' }}>— outline only</span>
        </span>
      </div>
      <div style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 6, lineHeight: 1.45 }}>
        Fixed 0–100% bands — the same shade always means the same completeness, in every county.
      </div>
    </div>
  )
}

// Legend / in-view swatch previewing a COUNTY tier's crosshatch density (when the
// county "Use Textures" mode is on). One consistent crosshatch motif whose spacing
// + weight come from the SAME `HATCH` curve the on-map sprite uses
// (lib/countyTextures.ts), so the legend can never drift from the map. Drawn
// directly (no <pattern> ids) and tinted from the --sr-county-N-rgb tokens so it
// tracks light/dark. Default box 26×15 (legend); pass `size` for the 11px square
// "counties in view" mini-swatch.
export function CountyDensitySwatch({ tier, size }: { tier: CountyTier; size?: number }) {
  const { gapPx, lineWidthPx } = countyHatchSpec(tier)
  const w = size ?? 26
  const h = size ?? 15
  const rgb = `var(--sr-county-${tier}-rgb)`
  const fillStyle = { fill: `rgba(${rgb}, 0.16)` }
  const lineStyle = { stroke: `rgba(${rgb}, 0.85)`, strokeWidth: lineWidthPx }
  // Same gapPx spacing as the on-map tile so density reads at the same visual rate
  // as the map; offsets run -h..w so the diagonals fill the whole box (the offset
  // pattern TierHatchSwatch uses).
  const offsets: number[] = []
  for (let x = -h; x < w; x += gapPx) offsets.push(x)
  return (
    <svg width={w} height={h} aria-hidden
      style={{ flexShrink: 0, border: '1px solid var(--sr-border-medium)', borderRadius: 3, display: 'block', overflow: 'hidden' }}>
      <rect x={0} y={0} width={w} height={h} style={fillStyle} />
      {offsets.map(x => <line key={`a${x}`} x1={x} y1={h} x2={x + h} y2={0} style={lineStyle} />)}
      {offsets.map(x => <line key={`b${x}`} x1={x} y1={0} x2={x + h} y2={h} style={lineStyle} />)}
    </svg>
  )
}
