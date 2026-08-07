// Desktop twin of backend/routers/media.py — keep the two in LOCKSTEP (the
// markers, the browser User-Agent, and the shape of the result).
//
// Cornell put a proof-of-work bot check in front of macaulaylibrary.org. Its
// interstitial needs a cookie a cross-site iframe cannot hold, so an embedded
// player shows Cornell's "Missing feature Cookies" card instead of the media.
// The browser cannot see this itself: the interstitial is a same-status HTTP 200
// in a cross-origin frame and the endpoint sends no CORS headers. Desktop runs
// the probe through the Tauri HTTP plugin, which is not bound by CORS.

import { tauriFetch } from './http'

const BROWSER_UA =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 ' +
  '(KHTML, like Gecko) Version/26.0 Safari/605.1.15'

// Structural markers from the interstitial as served. NOT the visible "Missing
// feature Cookies" text — that string is absent from the HTML and is written
// later by the challenge's own script once its cookie test fails.
const CHALLENGE_BODY_MARKERS = ['id="anubis_challenge"', '/.within.website/x/cmd/anubis/']
const CHALLENGE_COOKIE_MARKER = 'anubis'

const CATALOG_ID_RE = /^[0-9]+$/

export interface EmbedStatus {
  gated: boolean
}

export async function getEmbedStatus(catalogId: string): Promise<EmbedStatus> {
  if (!CATALOG_ID_RE.test(catalogId)) {
    throw Object.assign(new Error('Invalid catalog id.'), { status: 400 })
  }

  // A connection-level failure rejects before this line with no HTTP status, so
  // isOfflineError classifies it as offline; the caller treats any failure as
  // "not gated" either way, so a probe that cannot run never hides real media.
  const res = await tauriFetch(
    `https://macaulaylibrary.org/asset/${encodeURIComponent(catalogId)}/embed`,
    { headers: { 'User-Agent': BROWSER_UA, Accept: 'text/html' } },
  )

  if (!res.ok) {
    throw Object.assign(new Error('Macaulay Library returned an error.'), { status: 502 })
  }

  // Two independent signals, so a change to either the interstitial's markup or
  // its cookie naming does not silently blind the probe.
  const setCookie = (res.headers.get('set-cookie') ?? '').toLowerCase()
  if (setCookie.includes(CHALLENGE_COOKIE_MARKER)) return { gated: true }

  const body = await res.text()
  return { gated: CHALLENGE_BODY_MARKERS.some((marker) => body.includes(marker)) }
}
