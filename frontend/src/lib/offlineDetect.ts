// Error classification for the offline / replay layer (FR-36).
//
// The replay-on-offline path (transport.getReplayable) must distinguish a
// CONNECTION-LEVEL failure (device offline / unreachable host / timeout) from
// an HTTP non-OK status (server error, missing API key). Only the former may
// fall back to a replayed (last-loaded) result; an HTTP error must always
// rethrow so a server error or a no-key state is never masked by stale data.
//
// Pure + dependency-light: it inspects the shapes the real call paths throw —
//   • Web (WebTransport): a bare fetch() network failure throws a TypeError
//     ("Failed to fetch") with NO `status`. A non-OK response throws a
//     TransportError carrying the HTTP `status`.
//   • Desktop (tauriFetch / services): a request timeout throws
//     `{ status: 0, timeout: true }`; the underlying @tauri-apps/plugin-http
//     network rejection has no `status`; the checklist service wraps a network
//     reject as `{ status: 0 }`. An aborted request surfaces as an
//     AbortError (DOMException/Error with name 'AbortError').
//   • Service no-key guards throw with an explicit HTTP-like `status`
//     (401 / 500) BEFORE any fetch — those are NOT offline.
//
// Rule of thumb: an error carries a meaningful HTTP status (>= 100) → NOT
// offline (it reached a server, or it's a deliberate pre-fetch rejection).
// No status, status 0, a timeout marker, or an abort → offline.

interface ErrorLike {
  status?: unknown;
  timeout?: unknown;
  name?: unknown;
  message?: unknown;
}

function asErrorLike(err: unknown): ErrorLike | null {
  return typeof err === 'object' && err !== null ? (err as ErrorLike) : null;
}

/** The status carried by an error, if it is a finite number; otherwise null. */
function statusOf(err: ErrorLike): number | null {
  return typeof err.status === 'number' && Number.isFinite(err.status) ? err.status : null;
}

/**
 * TRUE only for a connection-level rejection — a network failure with no HTTP
 * status (fetch `TypeError`, the tauriFetch network-error shape), a request
 * timeout, or an abort. FALSE for any HTTP non-OK status (server error /
 * missing-key — those carry a status and must rethrow). FR-36.
 */
export function isOfflineError(err: unknown): boolean {
  const e = asErrorLike(err);
  if (!e) {
    // A primitive throw (string/number) carries no status → treat as connection-level.
    return true;
  }

  const status = statusOf(e);
  // A genuine HTTP status (>= 100) means the request reached a server (or a
  // deliberate pre-fetch rejection like a no-key guard). Never offline.
  if (status !== null && status >= 100) return false;

  // Explicit timeout marker (tauriFetch sets { status: 0, timeout: true }).
  if (e.timeout === true) return true;

  // Aborted request (AbortController / AbortSignal).
  if (e.name === 'AbortError' || e.name === 'TimeoutError') return true;

  // status === 0 is the tauriFetch / checklist-service network-failure sentinel.
  if (status === 0) return true;

  // No status at all: a bare fetch() TypeError ("Failed to fetch") or a raw
  // @tauri-apps/plugin-http network rejection — connection-level.
  if (status === null) return true;

  // A status present but below 100 (and not 0) is an unexpected shape; be
  // conservative and treat it as NOT offline so an HTTP-ish error never
  // surfaces stale data.
  return false;
}

/**
 * Best-effort: TRUE when the error is the missing-API-key error a service throws
 * BEFORE fetching (the later offline-messaging layer uses this to show "add your
 * key in Settings" instead of an offline cue). The services throw an `Error`
 * whose message / detail mentions "API key" with an HTTP-like status (401/500) —
 * see weatherService / tideService / checklistService no-key guards. We match on
 * that message text (the status alone collides with real 401/500 responses).
 *
 * This is a heuristic, not a structural marker — if a future change makes it
 * ambiguous, the messaging layer can refine it. It is intentionally conservative
 * (returns false on anything it can't positively identify).
 */
export function isNoKeyError(err: unknown): boolean {
  const e = asErrorLike(err);
  if (!e) return false;
  const text = [
    typeof e.message === 'string' ? e.message : '',
    typeof (e as { detail?: unknown }).detail === 'string' ? (e as { detail: string }).detail : '',
  ].join(' ').toLowerCase();
  // The no-key guards say "API key not configured" (eBird / OpenWeather variants).
  return text.includes('api key') && (text.includes('not configured') || text.includes('add it in settings'));
}
