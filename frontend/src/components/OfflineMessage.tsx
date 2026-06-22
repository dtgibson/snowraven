// Shared, consistent presentation for the three-state offline / no-key / error
// messaging (FR-35/FR-38) and the replay staleness cue (FR-31). Every live
// surface renders through these so the copy AND the accessibility contract are
// identical app-wide — no five hand-rolled variants.
//
// Accessibility (NFR-09):
//   • Each message is a role="status" (offline / staleness — informational, not
//     an interruption) or role="alert" (a real error). State is conveyed by an
//     ICON + TEXT, never color alone.
//   • Contrast is fixed at the token in both themes (offline/staleness use the
//     muted/surface tokens; the generic error uses the error tokens).
//
// All color via var(--sr-*).

import { WifiOff, AlertCircle, KeyRound, Clock } from 'lucide-react';
import type { LiveErrorKind } from '../lib/offlineMessage';
import { stalenessCueText } from '../lib/offlineMessage';

interface OfflineMessageProps {
  kind: LiveErrorKind;
  message: string;
  /** Tighter padding + smaller type for dense spots (map sidebars, panels). */
  compact?: boolean;
  style?: React.CSSProperties;
}

// The icon carries the state non-visually too (more than color): a struck-out
// wifi glyph for offline, a key for no-key, an alert triangle for a server error.
function IconFor({ kind }: { kind: LiveErrorKind }) {
  if (kind === 'offline') return <WifiOff size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />;
  if (kind === 'no-key') return <KeyRound size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />;
  return <AlertCircle size={15} strokeWidth={2} style={{ flexShrink: 0, marginTop: 1 }} aria-hidden="true" />;
}

/**
 * A single live-feature failure message. `kind` selects the icon + token palette;
 * a real server error is an alert, offline / no-key are statuses.
 */
export function OfflineMessage({ kind, message, compact, style }: OfflineMessageProps) {
  const isError = kind === 'error';
  const palette: React.CSSProperties = isError
    ? { background: 'var(--sr-error-bg)', border: '1px solid var(--sr-error-border)', color: 'var(--sr-error)' }
    : kind === 'no-key'
      ? { background: 'var(--sr-warning-bg)', border: '1px solid var(--sr-warning-subtle)', color: 'var(--sr-warning)' }
      : { background: 'var(--sr-surface-subtle)', border: '1px solid var(--sr-border)', color: 'var(--sr-text-muted)' };

  return (
    <div
      role={isError ? 'alert' : 'status'}
      style={{
        display: 'flex', alignItems: 'flex-start', gap: 8,
        padding: compact ? '8px 11px' : '10px 13px',
        borderRadius: compact ? 6 : 8,
        fontSize: compact ? '0.6875rem' : '0.8125rem',
        lineHeight: 1.5,
        ...palette,
        ...style,
      }}
    >
      <IconFor kind={kind} />
      <span style={{ minWidth: 0 }}>{message}</span>
    </div>
  );
}

interface StalenessCueProps {
  /** Replay-entry loadedAt (ms epoch). */
  replayedAt: number;
  compact?: boolean;
  style?: React.CSSProperties;
}

/**
 * The "Offline — showing the last loaded result, from <time>" cue (FR-31). A
 * status (not an error — the result IS shown), icon + text, muted tokens so it
 * reads as provenance, not a failure.
 */
export function StalenessCue({ replayedAt, compact, style }: StalenessCueProps) {
  return (
    <div
      role="status"
      style={{
        display: 'flex', alignItems: 'center', gap: 7,
        padding: compact ? '6px 10px' : '8px 12px',
        marginBottom: compact ? 8 : 10,
        borderRadius: compact ? 6 : 8,
        background: 'var(--sr-surface-subtle)',
        border: '1px solid var(--sr-border)',
        color: 'var(--sr-text-muted)',
        fontSize: compact ? '0.6875rem' : '0.75rem',
        lineHeight: 1.45,
        ...style,
      }}
    >
      <Clock size={13} strokeWidth={2} style={{ flexShrink: 0 }} aria-hidden="true" />
      <span style={{ minWidth: 0 }}>{stalenessCueText(replayedAt)}</span>
    </div>
  );
}
