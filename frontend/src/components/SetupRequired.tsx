import { UploadCloud, Settings } from 'lucide-react'

interface SetupRequiredProps {
  title: string
  body: string
  steps: React.ReactNode[]
  onGoToSettings: () => void
}

export function SetupRequired({ title, body, steps, onGoToSettings }: SetupRequiredProps) {
  return (
    <div style={{
      flex: 1,
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      textAlign: 'center',
      padding: '52px 32px 48px',
    }}>
      <div style={{
        width: 64, height: 64, borderRadius: '50%',
        background: 'var(--sr-surface)',
        border: '1px solid var(--sr-border)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20, flexShrink: 0,
      }}>
        <UploadCloud size={28} strokeWidth={1.75} style={{ color: 'var(--sr-text-muted)' }} />
      </div>

      <div style={{
        fontSize: 17, fontWeight: 600, letterSpacing: '-0.2px',
        color: 'var(--sr-text)', marginBottom: 10,
      }}>
        {title}
      </div>

      <div style={{
        fontSize: 14, color: 'var(--sr-text-muted)', maxWidth: 420,
        lineHeight: 1.6, marginBottom: 24,
      }}>
        {body}
      </div>

      <div style={{
        background: 'var(--sr-surface)',
        border: '1px solid var(--sr-border)',
        borderRadius: 8,
        padding: '14px 18px',
        textAlign: 'left',
        maxWidth: 440, width: '100%',
        marginBottom: 28,
      }}>
        <div style={{
          fontSize: 11, fontWeight: 700, textTransform: 'uppercase' as const,
          letterSpacing: '0.07em', color: 'var(--sr-text-disabled)', marginBottom: 10,
        }}>
          How to set this up
        </div>
        {steps.map((step, i) => (
          <div key={i} style={{
            display: 'flex', gap: 10, alignItems: 'flex-start',
            fontSize: 13, color: 'var(--sr-text)',
            marginBottom: i < steps.length - 1 ? 7 : 0,
            lineHeight: 1.45,
          }}>
            <div style={{
              width: 18, height: 18, borderRadius: '50%',
              background: 'var(--sr-border)', color: 'var(--sr-text-muted)',
              fontSize: 11, fontWeight: 700,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0, marginTop: 1,
            }}>
              {i + 1}
            </div>
            <div>{step}</div>
          </div>
        ))}
      </div>

      <button tabIndex={0}
        onClick={onGoToSettings}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          padding: '8px 16px',
          background: 'var(--sr-accent)', color: '#fff',
          border: 'none', borderRadius: 8,
          fontSize: 13.5, fontWeight: 500, fontFamily: 'inherit',
          cursor: 'pointer',
        }}
      >
        <Settings size={15} strokeWidth={2} />
        Go to Settings
      </button>
    </div>
  )
}
