// Persisted-style store (offline-support Tier A — FR-01/02/05/06/42).
//
// Owns the read/write/revalidate logic for the tuned MapLibre base style that is
// persisted whole so the map can MOUNT offline (the persisted blob seeds
// SnowMap's `mapStyle` before any network fetch). The actual disk/route I/O lives
// in the storage seam (`getStyleBlob`/`setStyleBlob`); this module adds the
// session-level coalescing and the once-per-session background revalidate.
//
// All three helpers are pure-logic + seam calls — NO React state, NO render-path
// `Date.now()` (the only `Date.now()` is in `persistStyle`, called from effects/
// handlers, never render — eslint react-hooks/purity).

import type { StyleSpecification } from 'maplibre-gl'
import { storage, type PersistedStyle } from './storage'

/** Variant-scoped seam key (`map-style-positron` today). A future `liberty`
 *  variant gets its own file and can't clobber positron. */
export function persistedStyleKey(variant: string): string {
  return `map-style-${variant}`
}

// One disk/route read per variant per session (NFR-02/QA-38 — same idiom as
// `taxonomyService.ensureTaxonomy` / `SnowMap.getVectorStyle`). `_mem` holds the
// settled result (PersistedStyle | null); `_loading` coalesces concurrent
// callers onto the single in-flight read.
const _mem = new Map<string, PersistedStyle | null>()
const _loading = new Map<string, Promise<PersistedStyle | null>>()

/**
 * Read the persisted style for `variant`, coalesced + memoized to ONE
 * `storage.getStyleBlob(variant)` disk read per variant per session. Returns the
 * persisted blob, or `null` when nothing has been persisted yet (or the read
 * fails — the seam already swallows its own errors to `null`).
 */
export async function readPersistedStyle(variant: string): Promise<PersistedStyle | null> {
  if (_mem.has(variant)) return _mem.get(variant) ?? null
  let p = _loading.get(variant)
  if (!p) {
    p = storage.getStyleBlob(variant)
      .then(blob => { _mem.set(variant, blob); return blob })
      .catch(() => { _mem.set(variant, null); return null })
      .finally(() => { _loading.delete(variant) })
    _loading.set(variant, p)
  }
  return p
}

/**
 * Persist the tuned style for `variant` (next-launch seed). Wraps it in the
 * `{ variant, style, savedAt }` envelope. `savedAt` is provenance only (QA-04),
 * NOT a TTL gate (FR-05 unbounded). Also refreshes the in-session `_mem` mirror
 * so a later read in the same session returns the freshest blob.
 *
 * `Date.now()` is fine here — this runs from effects/handlers, never render.
 */
export async function persistStyle(variant: string, style: StyleSpecification): Promise<void> {
  const blob: PersistedStyle = { variant, style, savedAt: Date.now() }
  _mem.set(variant, blob)
  await storage.setStyleBlob(variant, blob)
}

// Once-per-variant-per-session guard for the background revalidate, so a fresh
// online fetch refreshes the persisted copy at most once per session.
const _revalidated = new Set<string>()

/**
 * Fire-and-forget background revalidate: at most once per variant per session,
 * fetch a fresh style and persist it for the NEXT launch. Does NOT touch React
 * state and does NOT return the fresh style — no mid-session flicker; the new
 * tuning takes effect next relaunch (FR-05 unbounded supersede). A failed fetch
 * leaves the persisted copy untouched (the `.catch` swallows it).
 *
 * Map-mount-triggered by the caller (after seeding from a persisted copy), never
 * app-load-triggered → FR-09's no-auto-network-on-startup holds.
 */
export function revalidateStyleOnce(
  variant: string,
  fetchStyle: () => Promise<StyleSpecification>,
): void {
  if (_revalidated.has(variant)) return
  _revalidated.add(variant)
  void fetchStyle()
    .then(s => persistStyle(variant, s))
    .catch(() => {})
}

// Test-only: reset the session caches so each test starts clean. Not used in app
// code (the caches are intentionally process-lifetime).
export function __resetPersistedStyleCaches(): void {
  _mem.clear()
  _loading.clear()
  _revalidated.clear()
}
