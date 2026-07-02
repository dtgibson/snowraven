// Presentational sub-components shared by BirdingStats. Pure JSX, no data
// dependencies beyond the formatting/slug helpers in lib/statsFormat.
import { fmt, sectionSlug } from '../lib/statsFormat'
import { OutboundLink } from './OutboundLink'

export function SectionCard({ children, title, icon }: {
  children: React.ReactNode; title: string; icon: React.ReactNode
}) {
  return (
    // tabIndex={-1} so the jump-nav (BirdingStats) can move keyboard focus here
    // after scrolling (WCAG 2.4.3) — every Statistics section is a jump target.
    // outline:none keeps the programmatic focus from painting the card ring; the
    // scroll itself is the cue and the next Tab resumes from the section.
    <div id={sectionSlug(title)} tabIndex={-1} style={{
      scrollMarginTop: 16,
      outline: 'none',
      background: 'var(--sr-surface)',
      border: '1px solid var(--sr-border)',
      borderRadius: 12,
      padding: 'clamp(14px, 4vw, 24px)',
      boxShadow: 'var(--sr-card-shadow)',
    }}>
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8,
        marginBottom: 20, paddingBottom: 16,
        borderBottom: '1px solid var(--sr-border-subtle)',
      }}>
        <span style={{ color: 'var(--sr-accent)' }}>{icon}</span>
        <h3 style={{ fontSize: '0.9375rem', fontWeight: 600, margin: 0 }}>{title}</h3>
      </div>
      {children}
    </div>
  )
}

export function StatCell({ label, value, sub, large = true, reserveSub = false }: {
  label: string; value: string | number; sub?: React.ReactNode; large?: boolean
  /** Render the sub-line slot even without a `sub`, so a grid mixing tiles
      with and without sub-lines keeps every tile the same height. */
  reserveSub?: boolean
}) {
  return (
    <div style={{ padding: '12px 4px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
      <span style={{
        fontSize: large ? '1.75rem' : '1.375rem',
        fontWeight: 700,
        letterSpacing: '-0.02em',
        color: 'var(--sr-text)',
        lineHeight: 1,
      }}>
        {typeof value === 'number' ? fmt(value) : value}
      </span>
      {(sub || reserveSub) && <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{sub || '\u00A0'}</span>}
      <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  )
}

export function BarRow({ label, value, max, color = 'var(--sr-accent)', labelWidth = 44, pctOf, href, linkLabel }: {
  label: string; value: number; max: number; color?: string; labelWidth?: number; pctOf?: number
  /** When set, the count becomes an outbound link (e.g. a Macaulay Library filter).
      `linkLabel` is its accessible name; OutboundLink appends the new-tab cue. */
  href?: string; linkLabel?: string
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const pctDisplay = pctOf && pctOf > 0 && value > 0 ? Math.round(value / pctOf * 100) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22, minWidth: 0 }}>
      <span style={{
        fontSize: '0.6875rem', color: 'var(--sr-text-muted)',
        // rem so the label box grows with the Text Size control (1.4.4) instead
        // of clipping the label at 200% scale. labelWidth is a px number prop;
        // convert here so no call site changes. The width is a PREFERRED size
        // (flex-basis) that can shrink (flexShrink:1 + minWidth:0) when the row
        // would otherwise overflow — e.g. a wide label (labelWidth 150) at 200%
        // text-scale on a phone — ellipsizing instead of pushing the page wide.
        textAlign: 'right', flexShrink: 1, minWidth: 0, width: `${labelWidth / 16}rem`,
        overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
      }}>{label}</span>
      <div style={{
        flex: 1, minWidth: 0, height: 8, borderRadius: 4,
        background: 'var(--sr-surface-subtle)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 4, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: pctOf ? '4.25rem' : '2.5rem', textAlign: 'right' }}>
        {href
          // inline-block + vertical padding and a compensating negative margin
          // enlarge the tap target toward the ~44px touch guideline without
          // shifting the row layout (the count column keeps its box); a dense
          // inline text link can't use .sr-touch-target (it would center/grow
          // the visible box) — this is the established hit-area-expansion pattern.
          ? <OutboundLink href={href} aria-label={linkLabel} style={{ display: 'inline-block', padding: '11px 0 11px 10px', margin: '-11px 0 -11px -10px', color: 'var(--sr-accent)', textDecoration: 'none' }}>{fmt(value)}{pctDisplay !== null ? ` (${pctDisplay}%)` : ''}</OutboundLink>
          : <>{fmt(value)}{pctDisplay !== null ? ` (${pctDisplay}%)` : ''}</>}
      </span>
    </div>
  )
}

export function Divider() {
  return <div style={{ height: 1, background: 'var(--sr-border-subtle)', margin: '16px 0' }} />
}

export function SubLabel({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ fontSize: '0.6875rem', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase', color: 'var(--sr-text-muted)', margin: '0 0 10px' }}>
      {children}
    </p>
  )
}

export function RankIcon({ rank, shape, label }: { rank: number; shape: 'circle' | 'square'; label?: string }) {
  // em-sized so the pin + numeral track the root font scale (1.4.4 Resize Text);
  // fills are tokens (--sr-rank-pin-*, theme-invariant — the basemap stays light
  // in dark mode) instead of the old hardcoded hexes, and white-numeral contrast
  // passes (circle 5.71:1, square 6.70:1). `label` names the pin for AT (the
  // maplibre Marker wrapper otherwise announces a generic "Map marker"); F055.
  return (
    <svg width="1.5em" height="1.5em" viewBox="0 0 24 24"
      role="img" aria-label={label}
      style={{ display: 'block', cursor: 'pointer' }}>
      {shape === 'circle'
        ? <circle cx="12" cy="12" r="11" fill="var(--sr-rank-pin-circle)" />
        : <rect x="1" y="1" width="22" height="22" rx="3" fill="var(--sr-rank-pin-square)" />}
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif">{rank}</text>
    </svg>
  )
}
