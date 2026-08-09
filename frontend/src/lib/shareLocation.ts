// Pin Share — the whole clipboard payload, as pure functions of a coordinate and
// a mode. No map import, no DOM, no clipboard, NO NETWORK (FR-24 / NFR-02): the
// links are string concatenation over numbers already on the device, which is
// what keeps PRIVACY_POLICY.md unchanged and the feature usable offline.
//
// This module MUST stay map-free. Settings.tsx is statically imported by App.tsx
// and imports lib/shareCopyPreference.ts, which re-exports ShareCopyMode from
// here — so a map import (even an `import type` a later refactor promotes to a
// value import) would drag the ~1 MB maplibre vendor chunk onto first paint.
// lib/entryChunk.test.ts is the guard.

export type ShareCopyMode = 'coords-and-links' | 'coords-only'

/** Decimal places for a shared coordinate (FR-19). Five is about one metre and
 *  matches what eBird displays; both Google Maps and Apple Maps accept it pasted
 *  straight into their search boxes, which is what makes the coordinates-only
 *  mode genuinely useful rather than a degraded fallback. */
const PLACES = 5

/** Google Maps coordinate URL (FR-23, ratified in D-04 — do not revisit).
 *  Verified live during the build: this form 302s to
 *  https://maps.google.com/maps?q=<lat>,<lng>, the canonical coordinate query. */
const GOOGLE_MAPS_BASE = 'https://maps.google.com/?q='

/** Apple Maps coordinate URL (FR-23 / OQ-01, ratified in D-04 — do not revisit).
 *  Verified live during the build (macOS and iOS user agents both): this form
 *  301s to /place?coordinate=<lat>%2C<lng>, i.e. Apple's own server recognises
 *  the value as a COORDINATE and routes it to a pinned place. A control request
 *  with a non-coordinate q (`?q=Putah+Creek`) 301s to /search?query=… instead,
 *  which is what proves the coordinate branch is real rather than a coincidence.
 *  The PRD's `?ll=<lat>,<lng>&q=<lat>,<lng>` fallback produces the IDENTICAL
 *  redirect, so it buys nothing and costs 20 characters. Shipping the short form. */
const APPLE_MAPS_BASE = 'https://maps.apple.com/?q='

/**
 * Wrap a longitude into [-180, 180] (FR-20). MapLibre reports UNWRAPPED
 * longitudes after repeated antimeridian panning (e.g. 190, -400), and an
 * unwrapped value produces a maps link that resolves to the wrong place.
 *
 * Note the accepted edge, asserted in the tests so it is a decision on the
 * record rather than a surprise: exactly `180` maps to `-180`. Both name the
 * antimeridian and both resolve correctly in Google Maps and Apple Maps.
 */
export function normalizeLongitude(lng: number): number {
  if (!Number.isFinite(lng)) return lng
  return ((lng + 180) % 360 + 360) % 360 - 180
}

/** `(-0.000001).toFixed(5)` is `"-0.00000"` — a minus sign on a value that reads
 *  as zero, which FR-19 ("no decoration a reader would not expect") rules out.
 *  Plain `(-0).toFixed(5)` is already `"0.00000"`; it is the ROUNDS-to-zero case
 *  that leaks the sign. */
function stripNegativeZero(s: string): string {
  return /^-0(?:\.0+)?$/.test(s) ? s.slice(1) : s
}

/**
 * The single rounding site. `formatCoordinate` and BOTH url builders derive from
 * this, so the coordinate line and the links can never disagree about where the
 * pin is (FR-23). If the formatter normalised longitude and a url builder did
 * not, the copied coordinate and the copied link would point at different
 * places, and no test that checked them separately would catch it.
 */
function fixed5(lat: number, lng: number): { lat: string; lng: string } {
  return {
    lat: stripNegativeZero(lat.toFixed(PLACES)),
    lng: stripNegativeZero(normalizeLongitude(lng).toFixed(PLACES)),
  }
}

/** The FR-19 display/copy form: `38.54321, -121.98765`. Latitude first, five
 *  decimals each, comma plus ONE space. No degree symbol, no hemisphere letter,
 *  no leading plus, no thousands separator. */
export function formatCoordinate(lat: number, lng: number): string {
  const f = fixed5(lat, lng)
  return `${f.lat}, ${f.lng}`
}

/** The pair as it rides INSIDE a url: comma, no space (FR-23). */
function urlPair(lat: number, lng: number): string {
  const f = fixed5(lat, lng)
  return `${f.lat},${f.lng}`
}

export function googleMapsUrl(lat: number, lng: number): string {
  return GOOGLE_MAPS_BASE + urlPair(lat, lng)
}

export function appleMapsUrl(lat: number, lng: number): string {
  return APPLE_MAPS_BASE + urlPair(lat, lng)
}

/**
 * The clipboard payload (FR-21 / FR-22). Exactly three lines in the default
 * mode, exactly one in coordinates-only mode, single newline separators, NO
 * trailing newline.
 *
 * Every character comes from `toFixed(5)` output over numeric input, so no
 * user-supplied or external text can reach a url string (NFR-08).
 */
export function buildSharePayload(lat: number, lng: number, mode: ShareCopyMode): string {
  const line = formatCoordinate(lat, lng)
  if (mode === 'coords-only') return line
  const pair = urlPair(lat, lng)
  return `${line}\nGoogle Maps: ${GOOGLE_MAPS_BASE}${pair}\nApple Maps: ${APPLE_MAPS_BASE}${pair}`
}
