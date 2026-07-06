// Footer update affordance — extracted verbatim from App.tsx's footer for the
// mobile-app feature so the FR-14 gate is one testable branch: on iOS/iPadOS
// this component renders NOTHING (no check button, no live region, no dynamic
// import of updateManager ever runs) — updates flow through TestFlight / the
// App Store, and the updater/process plugins aren't even compiled into the
// mobile binary. Desktop and web/Pi render exactly the pre-extraction DOM:
// the separator, the Check-For-Updates button, the always-mounted polite live
// region (F024), the desktop Install button (F025), and the download
// progressbar. No outcome auto-dismisses (F020: WCAG 2.2.1 Timing Adjustable).
import { Loader2, WifiOff } from 'lucide-react'
import { isTauri } from '../lib/platform'
import { showUpdaterFooter } from '../lib/platformGates'

export type UpdateStatus =
  | { kind: 'idle' }
  | { kind: 'checking' }
  | { kind: 'up-to-date'; current: string }
  | { kind: 'available'; latest: string }
  | { kind: 'downloading'; progress: number | null }
  | { kind: 'ready-to-restart' }
  // 'offline' is distinct from 'error' (FR-39): a connection-level failure says
  // "couldn't reach the update server — you're offline"; a reachable server
  // error (the backend's 502) shows the generic update-check error.
  | { kind: 'offline' }
  | { kind: 'error' }

interface UpdateFooterProps {
  updateStatus: UpdateStatus
  onCheck: () => void
  onInstall: () => void
}

export function UpdateFooter({ updateStatus, onCheck, onInstall }: UpdateFooterProps) {
  // FR-14: absent on iOS/iPadOS. The live region never mounts there, which is
  // correct — there is nothing for AT to announce about updates on iOS.
  if (!showUpdaterFooter()) return null

  return (
    <>
      {' · '}
      {/* Update checker. One persistent polite live region carries every textual
          outcome (always mounted, so AT reliably announces text changes — F024),
          and no outcome auto-dismisses (F020: 2.2.1 Timing Adjustable). The
          Check-For-Updates button stays present except while a check/download is
          in flight, so re-checking is one click away and keyboard focus is never
          dropped to <body> when an outcome resolves. */}
      {(updateStatus.kind === 'idle'
        || updateStatus.kind === 'up-to-date'
        || updateStatus.kind === 'available'
        || updateStatus.kind === 'offline'
        || updateStatus.kind === 'error') && (
        <>
          <button tabIndex={0}
            onClick={onCheck}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              font: 'inherit',
              color: 'var(--sr-text-footer)',
              cursor: 'pointer',
              textDecoration: 'none',
            }}
            onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
            onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
          >
            Check For Updates
          </button>
          {/* Desktop "available" gets its Install button as a sibling OUTSIDE the
              live span so its mount doesn't depend on live-region timing (F025). */}
          {updateStatus.kind === 'available' && isTauri() && (
            <>
              {' · '}
              <button tabIndex={0}
                onClick={onInstall}
                style={{
                  background: 'none', border: 'none', padding: 0, font: 'inherit',
                  color: 'var(--sr-warning)', cursor: 'pointer', fontWeight: 600,
                }}
                onMouseEnter={e => (e.currentTarget.style.textDecoration = 'underline')}
                onMouseLeave={e => (e.currentTarget.style.textDecoration = 'none')}
              >
                Install update and restart
              </button>
            </>
          )}
        </>
      )}
      {/* Always-mounted polite live region (empty while idle). Its text content
          changes per state, which AT announces reliably. The web "available"
          branch keeps its actionable ./update.sh instruction here, persistent. */}
      <span
        role="status"
        aria-live="polite"
        style={{
          marginLeft: updateStatus.kind === 'idle' ? 0 : 8,
          color:
            updateStatus.kind === 'up-to-date' || updateStatus.kind === 'ready-to-restart' ? 'var(--sr-accent)'
            : updateStatus.kind === 'available' ? 'var(--sr-warning)'
            : updateStatus.kind === 'error' ? 'var(--sr-error)'
            : updateStatus.kind === 'offline' ? 'var(--sr-text-muted)'
            : 'var(--sr-text-muted)',
        }}
      >
        {updateStatus.kind === 'checking' && (
          <>
            <Loader2 size={11} className="spin" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Checking…
          </>
        )}
        {updateStatus.kind === 'up-to-date' && `Up to date (v${updateStatus.current})`}
        {updateStatus.kind === 'available' && !isTauri() && (
          <>
            v{updateStatus.latest} available: run{' '}
            <code style={{ fontFamily: 'ui-monospace, "Cascadia Code", "Fira Code", Consolas, monospace' }}>./update.sh</code>
          </>
        )}
        {updateStatus.kind === 'available' && isTauri() && `v${updateStatus.latest} available`}
        {updateStatus.kind === 'ready-to-restart' && 'Update installed. Restarting…'}
        {/* Offline: distinct from the generic error and conveyed by an icon +
            text, not color alone (FR-39/NFR-09). */}
        {updateStatus.kind === 'offline' && (
          <>
            <WifiOff size={11} strokeWidth={2.5} aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
            Couldn't reach the update server. You're offline.
          </>
        )}
        {updateStatus.kind === 'error' && 'Could not check for updates'}
      </span>
      {/* Download progress: a real progressbar AT can query as a value, plus the
          same persistent live text. Indeterminate (no Content-Length) → aria-busy. */}
      {updateStatus.kind === 'downloading' && (
        <span
          role="progressbar"
          aria-label="Downloading update"
          aria-busy={updateStatus.progress === null}
          {...(updateStatus.progress !== null
            ? {
                'aria-valuemin': 0,
                'aria-valuemax': 100,
                'aria-valuenow': Math.round(updateStatus.progress * 100),
              }
            : {})}
          style={{ marginLeft: 8, color: 'var(--sr-text-muted)' }}
        >
          <Loader2 size={11} className="spin" aria-hidden="true" style={{ verticalAlign: '-1px', marginRight: 4 }} />
          {updateStatus.progress !== null
            ? `Downloading… ${Math.round(updateStatus.progress * 100)}%`
            : 'Downloading update…'}
        </span>
      )}
    </>
  )
}
