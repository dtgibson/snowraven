// Presentational sub-components shared by BirdingStats. Pure JSX, no data
// dependencies beyond the formatting/slug helpers in lib/statsFormat.
import { fmt, sectionSlug } from '../lib/statsFormat'

export function SectionCard({ children, title, icon }: {
  children: React.ReactNode; title: string; icon: React.ReactNode
}) {
  return (
    <div id={sectionSlug(title)} style={{
      scrollMarginTop: 16,
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

export function StatCell({ label, value, sub, large = true }: {
  label: string; value: string | number; sub?: string; large?: boolean
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
      {sub && <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{sub}</span>}
      <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', marginTop: 2 }}>{label}</span>
    </div>
  )
}

export function BarRow({ label, value, max, color = 'var(--sr-accent)', labelWidth = 44, pctOf }: {
  label: string; value: number; max: number; color?: string; labelWidth?: number; pctOf?: number
}) {
  const pct = max > 0 ? (value / max) * 100 : 0
  const pctDisplay = pctOf && pctOf > 0 && value > 0 ? Math.round(value / pctOf * 100) : null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minHeight: 22 }}>
      <span style={{
        fontSize: '0.6875rem', color: 'var(--sr-text-muted)',
        textAlign: 'right', flexShrink: 0, width: labelWidth,
      }}>{label}</span>
      <div style={{
        flex: 1, height: 8, borderRadius: 4,
        background: 'var(--sr-surface-subtle)', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${pct}%`, background: color,
          borderRadius: 4, transition: 'width 0.3s',
        }} />
      </div>
      <span style={{ fontSize: '0.6875rem', color: 'var(--sr-text-muted)', flexShrink: 0, width: pctOf ? 68 : 40, textAlign: 'right' }}>
        {fmt(value)}{pctDisplay !== null ? ` (${pctDisplay}%)` : ''}
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

export function RankIcon({ rank, shape }: { rank: number; shape: 'circle' | 'square' }) {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" style={{ display: 'block', cursor: 'pointer' }}>
      {shape === 'circle'
        ? <circle cx="12" cy="12" r="11" fill="#2D8653" />
        : <rect x="1" y="1" width="22" height="22" rx="3" fill="#3B82F6" />}
      <text x="12" y="16" textAnchor="middle" fill="white" fontSize="10" fontWeight="700" fontFamily="system-ui,sans-serif">{rank}</text>
    </svg>
  )
}
