// @vitest-environment jsdom
// FR-39a's classification reads navigator.onLine + the Tauri runtime marker, so
// this file needs a DOM (window/navigator). The rest is pure-logic assertions.
import { describe, it, expect, afterEach } from 'vitest';
import { TransportError } from './transport';
import {
  classifyLiveError,
  OFFLINE_MESSAGE,
  BACKEND_DOWN_MESSAGE,
  NO_KEY_MESSAGE,
  GENERIC_ERROR_MESSAGE,
  formatLoadedTime,
  stalenessCueText,
} from './offlineMessage';

// FR-39a hinges on the runtime (Tauri vs web) and navigator.onLine, so the
// classification tests must control both. These helpers set them and the
// afterEach restores defaults so files stay isolated. jsdom defaults to web
// (no __TAURI_INTERNALS__) with navigator.onLine === true.
function setOnLine(value: boolean) {
  Object.defineProperty(navigator, 'onLine', { value, configurable: true });
}
function setTauri(on: boolean) {
  if (on) (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__ = {};
  else delete (window as unknown as { __TAURI_INTERNALS__?: unknown }).__TAURI_INTERNALS__;
}
afterEach(() => { setOnLine(true); setTauri(false); });

// The three-state classification (FR-35/FR-36/QA-26): a connection-level
// failure, a missing-key error, and an HTTP 5xx must produce three DISTINCT
// user-visible treatments. These feed the shapes the real call paths throw.
describe('classifyLiveError — three distinct states (QA-26)', () => {
  // (a) connection-level → OFFLINE (a genuinely offline device: onLine === false)
  it('classifies a bare fetch TypeError (no status) as offline', () => {
    setOnLine(false);
    const c = classifyLiveError(new TypeError('Failed to fetch'));
    expect(c.kind).toBe('offline');
    expect(c.message).toBe(OFFLINE_MESSAGE);
  });

  it('classifies the tauriFetch network shape ({ status: 0 }) as offline', () => {
    const c = classifyLiveError(Object.assign(new Error('network'), { status: 0 }));
    expect(c.kind).toBe('offline');
  });

  // (b) missing key → NO-KEY
  it('classifies a no-key error (message text) as no-key', () => {
    const c = classifyLiveError(
      Object.assign(new Error('OpenWeather API key not configured'), { status: 401 }),
    );
    expect(c.kind).toBe('no-key');
    expect(c.message).toBe(NO_KEY_MESSAGE);
  });

  // (c) HTTP 5xx (reachable server error) → GENERIC ERROR
  it('classifies an HTTP 500 server error as a generic error', () => {
    const c = classifyLiveError(new TransportError('Transport error: 500', 500));
    expect(c.kind).toBe('error');
    expect(c.message).toBe(GENERIC_ERROR_MESSAGE);
  });

  it('the three kinds produce three different strings', () => {
    const offline = classifyLiveError(new TypeError('Failed to fetch')).message;
    const noKey = classifyLiveError(
      Object.assign(new Error('eBird API key not configured'), { status: 401 }),
    ).message;
    const err = classifyLiveError(new TransportError('Transport error: 503', 502)).message;
    expect(new Set([offline, noKey, err]).size).toBe(3);
  });

  it('an HTTP error prefers its surface detail / errorMessage over the default', () => {
    const c = classifyLiveError(new TransportError('Transport error: 500', 500), {
      errorDetail: 'The update server returned an error.',
    });
    expect(c.kind).toBe('error');
    expect(c.message).toBe('The update server returned an error.');
  });

  it('honors an offline-message override (compact surfaces)', () => {
    setOnLine(false);
    const c = classifyLiveError(new TypeError('Failed to fetch'), { offlineMessage: "You're offline — short." });
    expect(c.kind).toBe('offline');
    expect(c.message).toBe("You're offline — short.");
  });

  // A 404 (e.g. an update-check no-release reaching the classifier) is reachable,
  // so it must NOT be offline — it's a generic error.
  it('a 404 is a generic error, never offline (FR-39 false-positive guard)', () => {
    const c = classifyLiveError(new TransportError('Transport error: 404', 404));
    expect(c.kind).toBe('error');
  });
});

// FR-39a / QA-30 — on web/Pi a connection-level failure while the device is
// ONLINE is the local backend being down, NOT the device being offline. The
// message must be the distinct backend-down copy, never "you're offline".
describe('classifyLiveError — backend-down vs device-offline (FR-39a/QA-30)', () => {
  it('web/Pi + device online: a connection-level failure messages backend-down, not offline', () => {
    setTauri(false);
    setOnLine(true);
    const c = classifyLiveError(new TypeError('Failed to fetch'));
    expect(c.kind).toBe('offline'); // same informational kind…
    expect(c.message).toBe(BACKEND_DOWN_MESSAGE); // …distinct copy
    expect(c.message).not.toBe(OFFLINE_MESSAGE);
  });

  it('web/Pi + device offline: it is the honest offline message', () => {
    setTauri(false);
    setOnLine(false);
    const c = classifyLiveError(new TypeError('Failed to fetch'));
    expect(c.message).toBe(OFFLINE_MESSAGE);
  });

  it('desktop (Tauri) never shows backend-down — no local server exists', () => {
    setTauri(true);
    setOnLine(true); // even with connectivity, Tauri has no backend to be "down"
    const c = classifyLiveError(new TypeError('Failed to fetch'));
    expect(c.message).toBe(OFFLINE_MESSAGE);
  });

  it('honors a backend-down message override (compact surfaces)', () => {
    setTauri(false);
    setOnLine(true);
    const c = classifyLiveError(new TypeError('Failed to fetch'), { backendDownMessage: "Server's down — short." });
    expect(c.message).toBe("Server's down — short.");
  });
});

// The staleness cue (FR-31/QA-21/QA-27): given a loaded-at ms timestamp, the cue
// reads "Offline — showing the last loaded result, from <time>".
describe('staleness cue formatting (QA-21/QA-27)', () => {
  it('formatLoadedTime renders a date + clock for a fixed ms timestamp', () => {
    // 2026-06-19T10:30 local — formatLoadedTime is pure (takes the value), so it
    // never reads the wall clock.
    const ms = new Date(2026, 5, 19, 10, 30).getTime();
    const out = formatLoadedTime(ms);
    expect(out).toContain('2026');
    expect(out).toMatch(/10:30/);
  });

  it('stalenessCueText leads with "Offline: showing the last loaded result"', () => {
    const ms = new Date(2026, 5, 19, 10, 30).getTime();
    const text = stalenessCueText(ms);
    expect(text).toContain('Offline: showing the last loaded result');
    expect(text).toContain(formatLoadedTime(ms));
  });
});
