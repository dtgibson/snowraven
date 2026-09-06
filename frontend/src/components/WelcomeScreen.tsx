import { useEffect, useRef } from 'react'
import { Settings as SettingsIcon, BookOpen, KeyRound, FileUp, ArrowRight } from 'lucide-react'
import { RavenGlyph } from './RavenGlyph'
import { useFocusTrap } from '../lib/useFocusTrap'

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
  const rootRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    startRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onDismiss()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onDismiss])

  // aria-modal="true" tells SR users the background doesn't exist; back that up
  // for sighted keyboard users by trapping Tab inside the dialog (the app behind
  // it is not inert), so focus never lands on the obscured tab bar/footer.
  //
  // `containOutsideFocus` STAYS OFF HERE, and the reason is this screen's own
  // markup rather than anything about the app behind it. THIS IS THE ONE OVERLAY
  // IN THE APP THAT RENDERS THE OPENER OF AN OVERLAY THAT WILL SIT ABOVE IT: the
  // "documentation" button below calls `onOpenHelp`, and App.tsx mounts
  // `<HelpDocs>` as a LATER SIBLING while this screen stays mounted (the welcome
  // is gated on `coldStart && !welcomeDismissed`, which opening Help does not
  // change; `.sr-help-panel` is `position: fixed; inset: 0` at the same z-index,
  // so it paints over this one). The `focusin` arm is a document listener that
  // asks only "is the new focus inside MY root" — so with it armed, HelpDocs'
  // own `closeRef.current?.focus()` fires a `focusin` this trap treats as an
  // escape and answers by pulling focus back onto THIS screen's first button.
  // MEASURED in jsdom on exactly App.tsx's shape (a contained overlay plus a
  // later sibling that takes focus): the sibling's control never keeps focus.
  // The Help overlay would be unusable on first run, which is the only run this
  // screen has. The same shape holds for the Cmd-K palette, which
  // `usePaletteHotkey` binds unconditionally at `window` and which can therefore
  // open over this screen too.
  //
  // So this consolidates onto the shared hook and the shared selector — one copy
  // of what counts as focusable, no hand-rolled prediction — at the hook's
  // default, which is the end-wrap this screen already shipped. Two differences
  // to state rather than gloss, both unreachable here: the shared selector also
  // matches `input, select, textarea`, and this screen renders none (three
  // buttons, an inline SVG glyph and lucide paths — checked); and the hook pins
  // focus on the sole focusable where the old copy let a Tab through, which
  // needs a dialog with fewer than two controls to tell apart.
  // Opting in needs the nesting resolved first (App.tsx would have to tell this
  // screen that something is above it, or the arm would have to yield to a
  // higher modal); that is the named follow-up, not this build.
  useFocusTrap(true, rootRef)

  return (
    <div
      ref={rootRef}
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
          {/* aria-hidden lives inside RavenGlyph — this site gains it deliberately
              (the old lucide bird here lacked it; see the design refinement). */}
          <RavenGlyph size={34} style={{ color: 'var(--sr-accent)' }} />
          <span style={{ fontSize: '1.875rem', fontWeight: 700, letterSpacing: '-0.6px' }}>
            Snow<span style={{ color: 'var(--sr-accent)' }}>Raven</span>
          </span>
        </div>

        <h1 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '14px 0 8px', letterSpacing: '-0.2px' }}>
          Welcome, let's get you set up
        </h1>
        <p style={{ fontSize: '0.875rem', color: 'var(--sr-text-muted)', lineHeight: 1.6, margin: '0 0 24px' }}>
          SnowRaven turns your own eBird and Macaulay Library exports into a personal birding
          dashboard, all on your device, nothing collected. Two quick things unlock everything:
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
              <div style={{ fontSize: '0.84375rem', fontWeight: 600, marginBottom: 2 }}>Add your free API keys</div>
              <div style={{ fontSize: '0.78125rem', color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
                An eBird key powers most features; an OpenWeather key adds checklist weather. Settings has links + steps for both.
              </div>
            </div>
          </div>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ width: 34, height: 34, borderRadius: 9, flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--sr-accent-bg)', color: 'var(--sr-accent)' }}>
              <FileUp size={17} strokeWidth={2} />
            </div>
            <div>
              <div style={{ fontSize: '0.84375rem', fontWeight: 600, marginBottom: 2 }}>Upload your data files</div>
              <div style={{ fontSize: '0.78125rem', color: 'var(--sr-text-muted)', lineHeight: 1.5 }}>
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
              borderRadius: 9, fontSize: '0.90625rem', fontWeight: 600, fontFamily: 'inherit', cursor: 'pointer',
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
                fontSize: '0.8125rem', fontWeight: 500,
              }}
            >
              <BookOpen size={14} strokeWidth={2} />
              Read the documentation
            </button>
            <button tabIndex={0}
              onClick={onDismiss}
              style={{
                background: 'none', border: 'none', padding: 4, color: 'var(--sr-text-muted)',
                cursor: 'pointer', fontFamily: 'inherit', fontSize: '0.8125rem',
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
