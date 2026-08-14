import { ChecklistLink } from '../ChecklistLink'

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

// `{1,15}` (length-bound-checklist-id): real ids are ~10 digits; the ceiling
// aligns every checklist-id guard with the persisted-key guard
// SUBMISSION_KEY_RE (lib/exoticProvenanceCache.ts), so an id can no longer
// become a link yet fail the store's own key guard. Kept in lockstep with
// isValidChecklistId and the four display-guard copies; the shared parity
// fixture (lib/checklistId.fixture.json) holds the ceiling on both transports.
export const SUBMISSION_ID_RE = /^S\d{1,15}$/
export const LOCATION_ID_RE = /^L\d+$/

// Species Detail's large stat cells (e.g. "first seen", "highest count") link to the
// checklist behind the value. Renders through the shared ChecklistLink so the
// accessible name and visual signature match every other checklist link (F064); the
// big-stat typography rides in via the style prop, and the value leads the
// accessible name (WCAG 2.5.3).
export function StatValueLink({ value, submissionId, small }: { value: string; submissionId: string; small?: boolean }) {
  return (
    <ChecklistLink
      submissionId={submissionId}
      label={value}
      size={small ? 'sm' : 'md'}
      style={{
        fontSize: small ? '0.875rem' : '1.25rem',
        fontWeight: 700,
        letterSpacing: small ? '-0.01em' : '-0.02em',
        lineHeight: 1.1,
      }}
    />
  )
}
