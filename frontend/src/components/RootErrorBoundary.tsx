import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

// App-wide safety net: if a render throws (startup or otherwise), show a recoverable
// message instead of a blank white screen. Reload re-runs the app from scratch.
export class RootErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div role="alert" style={{
        position: 'fixed', inset: 0, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center', gap: 14, padding: 24, textAlign: 'center',
        background: 'var(--sr-bg)', color: 'var(--sr-text-muted)', fontFamily: 'inherit',
      }}>
        <span style={{ fontSize: '1.125rem', fontWeight: 600, color: 'var(--sr-text)' }}>
          Something went wrong
        </span>
        <span style={{ fontSize: '0.875rem', maxWidth: 420, lineHeight: 1.5 }}>
          SnowRaven hit an unexpected error and couldn't continue. Reloading usually fixes it.
        </span>
        <button
          tabIndex={0}
          onClick={() => window.location.reload()}
          style={{
            marginTop: 4, height: 40, padding: '0 20px', border: 'none', borderRadius: 8,
            background: 'var(--sr-accent)', color: 'var(--sr-on-accent)', fontSize: '0.875rem',
            fontWeight: 500, fontFamily: 'inherit', cursor: 'pointer',
          }}
        >
          Reload
        </button>
      </div>
    )
  }
}
