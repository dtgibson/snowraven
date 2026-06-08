// Presentational sidebar primitives for the Map Explorer (extracted from
// MapExplorer.tsx in a behavior-preserving split). No map/state closures.

import { AlertCircle } from 'lucide-react'
import { MARKER_LIST_CAP } from '../../lib/markersInView'

export function SegControl({ options, value, onChange }: {
  options: { value: string; label: string }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', background: 'var(--sr-surface-subtle)', borderRadius: 6, padding: 2 }}>
      {options.map(opt => (
        <button tabIndex={0}
          key={opt.value}
          onClick={() => onChange(opt.value)}
          style={{
            flex: 1, height: 28, padding: '0 4px',
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
export function InViewMarkerList<T>({ heading, instructions, items, total, overCap, selectedId, getId, getPrimary, getSecondary, getDotColor, getDotLabel, onActivate }: {
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
}) {
  return (
    <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--sr-border)' }}>
      <SidebarLabel>{heading}</SidebarLabel>
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
                      <span style={{ display: 'block', fontSize: '0.625rem', color: 'var(--sr-text-muted)' }}>
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
  )
}

export function KeyNotice({ onGoToSettings }: { onGoToSettings: () => void }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10,
      padding: '10px 12px', background: 'var(--sr-warning-bg)',
      border: '1px solid var(--sr-warning-subtle)', borderRadius: 8,
      fontSize: '0.75rem', color: 'var(--sr-warning)', marginBottom: 14,
    }}>
      <div style={{ display: 'flex', gap: 7, alignItems: 'flex-start' }}>
        <AlertCircle size={13} style={{ flexShrink: 0, marginTop: 1 }} />
        <span>eBird API key required. Add it in Settings to use this feature.</span>
      </div>
      <button tabIndex={0}
        onClick={onGoToSettings}
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
