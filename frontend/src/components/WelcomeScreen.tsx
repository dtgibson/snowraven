import { useEffect, useRef } from 'react'
import { Bird, Settings as SettingsIcon, BookOpen, KeyRound, FileUp, ArrowRight } from 'lucide-react'

interface WelcomeScreenProps {
  /** Persist "seen" + jump to Settings to begin setup. */
  onGetStarted: () => void
  /** Open the documentation overlay. */
  onOpenHelp: () => void
  /** Persist "seen" + dismiss without going to Settings. */
  onDismiss: () => void
}

// First-run takeover, shown only on a cold start (no API keys and no data files yet).
// Orients a brand-new user and routes them to Settings, instead of dropping them on
// an empty tab. Dismissing (either button) persists so it never nags again.
export function WelcomeScreen({ onGetStarted, onOpenHelp, onDismiss }: WelcomeScreenProps) {
  const startRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    startRef.current?.focus()
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onDismiss() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Welcome to SnowRaven"
      style={{
        position: 'fixed', inset: 0, zIndex: 1200,
        background: 'var(--sr-bg)', color: 'var(--sr-text)',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        padding: '32px 24px', overflowY: 'auto', fontFamily: 'var(--font-sans)',
      }}
    >
      <div style={{ maxWidth: 540, width: '100%', textAlign: 'center' }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
          <Bird size={34} strokeWidth={1.75} style={{ color: 'var(--sr-accent)' }} />
          <span style={{ fontSize: 30, fontWeight: 700, letterSpacing: '-0.6px' }}>
            Snow<span style={{ color: 'var(--sr-accent)' }}>Raven</span>
          </span>
        </div>

        <h1 style={{ fontSize: 20, fontWeight: 700, margin: '14px 0 8px', letterSpacing: '-0.2px' }}>
          Welcome — let's get you set up
        </h1>
        <p style={{ fontSize: 14, color: 'var(--sr-text-muted)', lineHeight: 1.6, margin: '0 0 24px' }}>
          SnowRaven turns your own eBird and Macaulay Library exports into a personal birding
          dashboard — all on your device, nothing collected. Two quick things unlock everything:
        </p>

        <div style={{
          border: '1px solid var(--sr-border)', borderRadius: 12, background: 'var(--sr-surface)',
          padding: '18px 20px', textAlign: 'left', marginBottom: 24,
          display: 'flex', flexDirection: 'column', gap: 16,
        }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }}>
              <KeyRound size={17} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>Add your free API keys</div>
              <div style={{ fontSize: 12.5, color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
                An eBird key powers most features; an OpenWeather key adds checklist weather. Settings has links + steps for both.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }}>
              <FileUp size={17} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 600, marginBottom: 2 }}>Upload your data files</div>
              <div style={{ fontSize: 12.5, color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
                Your eBird backup unlocks the analytics tabs; an optional Macaulay Library export adds media coverage.
              </div>
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
          <button tabIndex={0}
            ref={startRef}
            onClick={onGetStarted}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 8, padding: '11px 22px',
              background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', border: 'none',
              borderRadius: 9, fontSize: 14.5, fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
            }}
          >
            <SettingsIcon size={16} strokeWidth={2} />
            Go to Settings
            <ArrowRight size={16} strokeWidth={2.5} />
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 18 }}>
            <button tabIndex={0}
              onClick={onOpenHelp}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none',
                padding: 4, color: 'var(--sr-accent)', cursor: 'pointer', fontFamily: 'inherit',
                fontSize: 13, fontWeight: 500,
              }}
            >
              <BookOpen size={14} strokeWidth={2} />
              Read the documentation
            </button>
            <button tabIndex={0}
              onClick={onDismiss}
              style={{
                background: 'none', border: 'none', padding: 4, color: 'var(--sr-text-muted)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
              }}
            >
              Explore the app first
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
