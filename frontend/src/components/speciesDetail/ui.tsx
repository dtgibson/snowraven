import { ExternalLink } from 'lucide-react'

// ── Presentational primitives ──────────────────────────────────────────────

export function SectionCard({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--sr-surface)',
      border: '1px solid var(--sr-border)',
      borderRadius: 12,
      overflow: 'hidden',
      boxShadow: 'var(--sr-card-shadow)',
      ...style,
    }}>
      {children}
    </div>
  )
}

export function SectionHead({ icon, title }: { icon: React.ReactNode; title: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 8,
      padding: '14px 18px 12px',
      borderBottom: '1px solid var(--sr-border-subtle)',
    }}>
      <div style={{
        width: 28, height: 28, borderRadius: 7, flexShrink: 0,
        background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
      }}>
        {icon}
      </div>
      <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: 'var(--sr-text)' }}>{title}</span>
    </div>
  )
}

export function StatLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: '0.6875rem', fontWeight: 600, textTransform: 'uppercase' as const,
      letterSpacing: '0.07em', color: 'var(--sr-text-muted)', marginBottom: 4,
    }}>
      {children}
    </div>
  )
}

export const SUBMISSION_ID_RE = /^S\d+$/
export const LOCATION_ID_RE = /^L\d+$/

export function StatValueLink({ value, submissionId, small }: { value: string; submissionId: string; small?: boolean }) {
  if (!SUBMISSION_ID_RE.test(submissionId)) {
    return <span style={{ fontSize: small ? '0.875rem' : '1.25rem', fontWeight: 700, letterSpacing: small ? '-0.01em' : '-0.02em', lineHeight: 1.1, color: 'var(--sr-text)' }}>{value}</span>
  }
  return (
    <a
      href={`https://ebird.org/checklist/${submissionId}`}
      target="_blank"
      rel="noreferrer"
      aria-label={`${value} — view checklist on eBird (opens in new tab)`}
      style={{
        fontSize: small ? '0.875rem' : '1.25rem',
        fontWeight: 700,
        letterSpacing: small ? '-0.01em' : '-0.02em',
        lineHeight: 1.1,
        color: 'var(--sr-accent)',
        textDecoration: 'none',
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
      }}
      onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
      onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
    >
      {value}
      <ExternalLink size={small ? 10 : 11} strokeWidth={2.5} />
    </a>
  )
}
