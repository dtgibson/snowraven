// Single source of truth for the three-state offline / no-key / server-error
// messaging (FR-35/FR-36/FR-38/FR-39) and the replay staleness cue (FR-31).
//
// Every live-feature surface (weather, tide, Nominatim search, Checklist
// Comparer, the nearby-bird overlays, the update check) classifies a failure
// the SAME way and shows ONE of three distinct, non-collapsing treatments:
//
//   • offline   — a connection-level failure (no HTTP status). Honest "you're
//                 offline" copy; it'll work again on reconnect.
//   • no-key    — a missing API key. The existing "add it in Settings" copy.
//   • error     — a reachable server that returned an HTTP non-OK status. The
//                 surface's existing generic error copy.
//
// Classification is delegated to the already-built primitives in offlineDetect
// (isOfflineError / isNoKeyError) so the rule lives in ONE place; this module
// only chooses the copy and the precedence (offline first, then no-key, then
// the generic error — a connection-level failure can never carry a no-key
// status, so the order is unambiguous).

import { isOfflineError, isNoKeyError } from './offlineDetect';
import { isTauri } from './platform';
import { formatDate } from './formatDate';

export type LiveErrorKind = 'offline' | 'no-key' | 'error';

export interface ClassifiedLiveError {
  kind: LiveErrorKind;
  /** The user-facing message for this kind (offline + no-key are canonical;
   *  the generic error uses the caller-provided fallback). */
  message: string;
}

// Canonical copy. Kept here so every surface speaks with one voice; the offline
// line is deliberately honest and reassuring (it'll work again on reconnect),
// distinct from a server error and from a missing key.
export const OFFLINE_MESSAGE =
  "You're offline — this needs a connection. It'll work again when you reconnect.";

// A shorter variant for dense / inline spots (sidebars, compact rows).
export const OFFLINE_MESSAGE_SHORT = "You're offline — this needs a connection.";

export const NO_KEY_MESSAGE = 'API key not configured. Add it in Settings.';

export const GENERIC_ERROR_MESSAGE = 'Something went wrong. Please try again.';

// FR-39a — web/self-hosted (Pi) only. On web/Pi every live feature goes through
// the local FastAPI backend; a connection-level failure WHILE THE DEVICE IS
// ONLINE means that local server is unreachable, not that the device is offline.
// That is a distinct, user-distinguishable state and gets its own honest copy
// (NOT "you're offline"). On desktop (Tauri) there is no local backend, so this
// state cannot occur — see isLikelyBackendDown.
export const BACKEND_DOWN_MESSAGE =
  "Can't reach the SnowRaven server — make sure it's running, then try again.";

export const BACKEND_DOWN_MESSAGE_SHORT = "Can't reach the SnowRaven server.";

/**
 * TRUE only on web/self-hosted (Pi) AND when the device reports connectivity
 * (`navigator.onLine === true`). In that case a connection-level failure is the
 * local backend being down, not the device being offline (FR-39a). On desktop
 * (no local backend) this is always FALSE. `navigator.onLine` is used purely
 * advisorily here — to pick the message wording, never to gate a request
 * (FR-36) — so its known false-positives only ever change copy, never behavior.
 */
export function isLikelyBackendDown(): boolean {
  if (isTauri()) return false;
  return typeof navigator !== 'undefined' && navigator.onLine === true;
}

export interface ClassifyOptions {
  /** Override the offline copy (e.g. the short variant for a compact surface). */
  offlineMessage?: string;
  /** Override the backend-down copy (FR-39a; e.g. the short variant). */
  backendDownMessage?: string;
  /** Override the no-key copy (a surface may name the specific key). */
  noKeyMessage?: string;
  /** The generic-error copy for this surface (its existing message). Also used
   *  if a no-key error is detected but no noKeyMessage override is given AND the
   *  error carries its own detail. */
  errorMessage?: string;
  /** A surface-specific error detail (e.g. TransportError.detail) to prefer for
   *  the generic-error branch over `errorMessage`. */
  errorDetail?: string;
}

/**
 * Classify a thrown live-feature error into exactly one of the three states and
 * pick its message. Offline takes precedence (FR-37 prefers a replayed result,
 * which the caller handles before reaching here; once we're classifying an
 * error with no replay, offline is the honest answer). A connection-level
 * failure never carries a no-key status, so offline → no-key → error is a safe
 * total order.
 */
export function classifyLiveError(err: unknown, opts: ClassifyOptions = {}): ClassifiedLiveError {
  if (isOfflineError(err)) {
    // FR-39a: on web/Pi with the device online, a connection-level failure is the
    // local server being down, not the device being offline — distinct copy, same
    // 'offline' kind (still an informational "needs a connection" status, not an
    // error/alert). On desktop or a genuinely offline device, the offline copy.
    if (isLikelyBackendDown()) {
      return { kind: 'offline', message: opts.backendDownMessage ?? BACKEND_DOWN_MESSAGE };
    }
    return { kind: 'offline', message: opts.offlineMessage ?? OFFLINE_MESSAGE };
  }
  if (isNoKeyError(err)) {
    return { kind: 'no-key', message: opts.noKeyMessage ?? NO_KEY_MESSAGE };
  }
  const detail = opts.errorDetail?.trim();
  return {
    kind: 'error',
    message: detail || opts.errorMessage || GENERIC_ERROR_MESSAGE,
  };
}

/**
 * Format a replay-staleness timestamp (ms epoch) for the "loaded at <time>"
 * cue. Pure — takes the value, so it is safe to call in render (no Date.now /
 * argument-less new Date). Uses the project's canonical formatter so the date
 * honors the user's preference, with the clock appended.
 */
export function formatLoadedTime(ms: number): string {
  return formatDate(new Date(ms), { withTime: true });
}

/** The full staleness cue text including the loaded time (FR-31). */
export function stalenessCueText(replayedAt: number): string {
  return `Offline — showing the last loaded result, from ${formatLoadedTime(replayedAt)}.`;
}
