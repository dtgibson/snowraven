// Region download + orchestration (offline-support Tier B — FR-11..FR-20, FR-11a).
//
// This is the LIGHT download/orchestration layer the (non-lazy) Settings region
// manager imports. It MUST stay off the maplibre/pmtiles import graph:
//   *** This module must NOT import `pmtiles` or `maplibre-gl`. ***
// Downloading a region is just: fetch the `.pmtiles` bytes (with progress) and
// write them through the storage seam. It never PARSES the archive (that's the
// lazy map chunk's `mapPmtiles.ts` job), so it needs no pmtiles lib here.
//
// The bundled catalog is read by a static JSON import (tiny JSON, NOT maplibre)
// so the region list is offline-discoverable with no runtime fetch (privacy-
// first: listing regions makes no network call). Only an explicit, user-
// initiated, opt-in (FR-11a) region download touches the network. It lives in
// `src/assets/` with the other bundled data assets (taxonomy, atlas, tide
// stations) — imported data belongs there, not in `public/` (which is for the
// URL-served glyph/sprite assets); a `public/` JSON import trips a Vite warning.

import { isTauri } from './platform'
import { storage, type RegionEntry, type RegionsManifest } from './storage'
import { loadEbirdObservations } from './observationsCache'
import bundledCatalog from '../assets/regions-catalog.json'

// ── Catalog ───────────────────────────────────────────────────────────────────

/** One curated, bake-able region in the bundled catalog. Mirrors the manifest
 *  shape minus the per-download fields (downloadedAt/sourceVersion are stamped
 *  at download time from `currentVersion`). */
export interface CatalogRegion {
  regionId: string
  name: string
  kind: 'county' | 'state'
  stateCode: string
  countyName?: string
  extent: [number, number, number, number] // [w, s, e, n] WGS84
  minZoom: number
  maxZoom: number
  bytes: number // expected on-disk size, for the pre-download size display
}

export interface RegionsCatalog {
  currentVersion: string
  baseUrl: string
  regions: CatalogRegion[]
}

// Region id shape guard (NFR-12/QA-39) — mirrors storage.ts. Validate BEFORE any
// path / URL interpolation; a malformed id is never interpolated into a fetch URL.
const REGION_ID_RE = /^[a-z]{2}(-[a-z0-9-]{1,40})?$/

/**
 * The bundled catalog (`currentVersion`, `baseUrl`, `regions[]`). Read from the
 * static import — no runtime fetch (FR: offline-discoverable). Async signature so
 * a future remote/merged catalog can swap in without touching call sites.
 */
export async function loadCatalog(): Promise<RegionsCatalog> {
  return bundledCatalog as RegionsCatalog
}

// ── FR-11a — the offline-maps opt-in gate ───────────────────────────────────────

const OFFLINE_MAPS_ENABLED_KEY = 'offline-maps-enabled'

/** Read the `offline-maps-enabled` setting (default FALSE — privacy-first). */
export async function isOfflineMapsEnabled(): Promise<boolean> {
  const v = await storage.getSetting<boolean>(OFFLINE_MAPS_ENABLED_KEY)
  return v === true
}

/** Persist the `offline-maps-enabled` setting. */
export async function setOfflineMapsEnabled(enabled: boolean): Promise<void> {
  await storage.setSetting(OFFLINE_MAPS_ENABLED_KEY, enabled)
}

// ── 2f / OQ-10 — county-first selection ─────────────────────────────────────────

/** Normalize a county / state string for tolerant matching (case + spacing). */
function normCountyName(s: string): string {
  return s.trim().toLowerCase().replace(/\s+/g, ' ')
}

/** A county the user birds, joined (or not) to a catalog region. */
export interface CountyYouBird {
  countyName: string
  stateProvince: string // eBird subnational1, e.g. "US-CA"
  region: CatalogRegion | null // null → not in the catalog (international / not yet baked)
}

/**
 * Derive the distinct `(county, stateProvince)` pairs from the loaded backup
 * (via observationsCache — the same source useHotspotSet uses) and match each to
 * a catalog region by `countyName` + `stateCode`, normalize-insensitive. Matched
 * counties come first; an unmatched pair is returned with `region: null` so the
 * UI can show it as unavailable rather than a broken control.
 */
export async function countiesYouBird(): Promise<CountyYouBird[]> {
  const catalog = await loadCatalog()
  // Index the catalog's county regions by (stateCode|countyName) for O(1) lookup.
  const byCounty = new Map<string, CatalogRegion>()
  for (const r of catalog.regions) {
    if (r.kind !== 'county' || !r.countyName) continue
    byCounty.set(`${r.stateCode.toUpperCase()}|${normCountyName(r.countyName)}`, r)
  }

  const loaded = await loadEbirdObservations()
  if (!loaded) return []

  // Distinct (county, stateProvince) pairs from the backup; both must be present.
  const seen = new Map<string, { countyName: string; stateProvince: string }>()
  for (const o of loaded.observations) {
    const county = o.county
    const sp = o.stateProvince
    if (!county || !sp) continue
    const key = `${sp.toUpperCase()}|${normCountyName(county)}`
    if (!seen.has(key)) seen.set(key, { countyName: county, stateProvince: sp })
  }

  const rows: CountyYouBird[] = []
  for (const { countyName, stateProvince } of seen.values()) {
    const region = byCounty.get(`${stateProvince.toUpperCase()}|${normCountyName(countyName)}`) ?? null
    rows.push({ countyName, stateProvince, region })
  }
  // Available (matched) regions first, then the rest; alpha within each group.
  rows.sort((a, b) => {
    if (!!a.region !== !!b.region) return a.region ? -1 : 1
    return a.countyName.localeCompare(b.countyName)
  })
  return rows
}

// ── FR-12/13 — download a region ────────────────────────────────────────────────

export interface DownloadProgress {
  /** Bytes received so far. */
  received: number
  /** Total bytes (from Content-Length), or null when the server omits it. */
  total: number | null
  /** 0..1 fraction when `total` is known, else null (indeterminate). */
  fraction: number | null
}

export interface DownloadOptions {
  onProgress?: (p: DownloadProgress) => void
  signal?: AbortSignal
}

/** A cancel surfaces as a DOMException('AbortError') — callers swallow it. */
function isAbort(err: unknown): boolean {
  return err instanceof DOMException && err.name === 'AbortError'
    || (err instanceof Error && err.name === 'AbortError')
}

/**
 * Download a region's `.pmtiles` ahead of time and store it durably.
 *
 * Gated on FR-11a (offline-maps enabled) AND FR-20 (desktop only) — either off →
 * throws (a stray call must not silently fetch megabytes). The URL is built from
 * the catalog `baseUrl` + the SHAPE-VALIDATED, encodeURIComponent-wrapped region
 * id (NFR-12) — the raw county string never rides in a URL. The body is streamed
 * with progress; the AbortSignal cancels in-flight (FR-15). Bytes are written to
 * a temp `.partial` and atomic-renamed on completion (FR-16) — a cancel/error
 * discards the partial and writes NO manifest entry. On completion a RegionEntry
 * is appended/spliced into the manifest (FR-12/13).
 */
export async function downloadRegion(
  region: CatalogRegion,
  opts: DownloadOptions = {},
): Promise<RegionEntry> {
  if (!REGION_ID_RE.test(region.regionId)) {
    throw new Error(`Invalid region id: ${JSON.stringify(region.regionId)}`)
  }
  // FR-11a: never fetch a single tile byte while the toggle is off.
  if (!(await isOfflineMapsEnabled())) {
    throw new Error('Offline maps are disabled. Enable them in Settings first')
  }
  // FR-20: region downloads are desktop-only (web/Pi can't durably persist GB blobs).
  if (!isTauri()) {
    throw new Error('Region downloads are only available in the desktop app')
  }

  const catalog = await loadCatalog()
  const base = catalog.baseUrl.endsWith('/') ? catalog.baseUrl : `${catalog.baseUrl}/`
  const url = `${base}${encodeURIComponent(region.regionId)}.pmtiles`

  const { onProgress, signal } = opts
  if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')

  let received = 0
  try {
    const res = await fetch(url, { signal })
    if (!res.ok) throw new Error(`Region download failed: ${res.status}`)
    const lenHeader = res.headers.get('Content-Length')
    const total = lenHeader ? Number(lenHeader) : null
    onProgress?.({ received: 0, total, fraction: total ? 0 : null })

    const body = res.body
    let bytes: Uint8Array
    if (body) {
      // Stream → collect chunks, reporting progress as they arrive.
      const reader = body.getReader()
      const chunks: Uint8Array[] = []
      for (;;) {
        const { done, value } = await reader.read()
        if (done) break
        if (value) {
          chunks.push(value)
          received += value.byteLength
          onProgress?.({ received, total, fraction: total ? Math.min(received / total, 1) : null })
        }
        // Cooperative cancel: stop reading and discard. fetch's own signal also
        // aborts the underlying request; this guards a signal set mid-stream.
        if (signal?.aborted) {
          await reader.cancel().catch(() => {})
          throw new DOMException('Aborted', 'AbortError')
        }
      }
      bytes = concatChunks(chunks, received)
    } else {
      // No streaming body (e.g. a mocked fetch) — fall back to a whole-buffer read.
      const buf = new Uint8Array(await res.arrayBuffer())
      received = buf.byteLength
      bytes = buf
      onProgress?.({ received, total: total ?? received, fraction: 1 })
    }

    // Write the partial, then atomic-rename to the final file (FR-16). A cancel
    // between these is impossible (no await of the signal here), and the partial
    // is swept on next manager open if anything throws.
    await storage.writeRegionPartial(region.regionId, bytes)
    if (signal?.aborted) {
      // Late cancel after the bytes landed but before commit → discard the partial.
      await storage.removeRegionFile(region.regionId).catch(() => {})
      throw new DOMException('Aborted', 'AbortError')
    }
    await storage.renameRegionPartial(region.regionId)

    const entry: RegionEntry = {
      regionId: region.regionId,
      name: region.name,
      kind: region.kind,
      stateCode: region.stateCode,
      countyName: region.countyName,
      extent: region.extent,
      minZoom: region.minZoom,
      maxZoom: region.maxZoom,
      bytes: received,
      downloadedAt: Date.now(), // async fn, never render — eslint purity OK
      sourceVersion: catalog.currentVersion,
    }

    // Upsert into the manifest (replace any prior entry for this id).
    const manifest = await storage.getRegionsManifest()
    const next: RegionsManifest = {
      version: manifest.version,
      regions: manifest.regions.filter(r => r.regionId !== entry.regionId).concat(entry),
    }
    await storage.setRegionsManifest(next)
    return entry
  } catch (err) {
    // Discard any partial on cancel/error (FR-15/16) — never leave a half file
    // and never write a manifest entry for it.
    await storage.removeRegionFile(region.regionId).catch(() => {})
    throw err
  }
}

/** Concatenate stream chunks into one Uint8Array of exactly `total` bytes. */
function concatChunks(chunks: Uint8Array[], total: number): Uint8Array {
  const out = new Uint8Array(total)
  let off = 0
  for (const c of chunks) { out.set(c, off); off += c.byteLength }
  return out
}

// ── FR-14 — remove a downloaded region ──────────────────────────────────────────

/** Remove a downloaded region's file AND its manifest entry (FR-14 — reclaims
 *  storage + updates the total). No-throw on a missing file (idempotent). */
export async function removeRegion(regionId: string): Promise<void> {
  if (!REGION_ID_RE.test(regionId)) {
    throw new Error(`Invalid region id: ${JSON.stringify(regionId)}`)
  }
  await storage.removeRegionFile(regionId)
  const manifest = await storage.getRegionsManifest()
  const next: RegionsManifest = {
    version: manifest.version,
    regions: manifest.regions.filter(r => r.regionId !== regionId),
  }
  await storage.setRegionsManifest(next)
}

// ── FR-13/19 — list regions (with staleness + total) ────────────────────────────

// OQ-05: a region is flagged stale after a generous fixed interval (9 months) OR
// when its bake version no longer matches the catalog's currentVersion. A single
// module constant, read via the session-now seam so QA can cross it deterministically.
export const STALE_MS = 9 * 30 * 24 * 60 * 60 * 1000

// Session-now seam: a single module-level "now" captured at import, the same
// pattern as MapExplorer's SESSION_NOW_MS. Read in pure helpers so no Date.now()
// runs in a render path (eslint react-hooks/purity).
const SESSION_NOW_MS = Date.now()

export interface ListedRegion extends RegionEntry {
  /** True when the region is past STALE_MS old OR its sourceVersion != catalog. */
  stale: boolean
}

export interface RegionsList {
  regions: ListedRegion[]
  totalBytes: number
  /** The catalog version current regions are compared against (FR-19 badge). */
  currentVersion: string
}

/** Pure staleness test (FR-19) — injectable now/currentVersion for QA-14. */
export function isRegionStale(
  entry: RegionEntry,
  currentVersion: string,
  nowMs: number = SESSION_NOW_MS,
): boolean {
  if (entry.sourceVersion !== currentVersion) return true
  return nowMs - entry.downloadedAt > STALE_MS
}

/**
 * List all downloaded regions with a staleness flag and a total byte count.
 * Desktop-only — on web/Pi the seam returns an empty manifest, so this returns
 * an empty list (FR-20). The manifest is the source of truth for bytes (no
 * per-file stat).
 */
export async function listRegions(): Promise<RegionsList> {
  const catalog = await loadCatalog()
  const manifest = await storage.getRegionsManifest()
  let totalBytes = 0
  const regions: ListedRegion[] = manifest.regions.map(r => {
    totalBytes += r.bytes
    return { ...r, stale: isRegionStale(r, catalog.currentVersion) }
  })
  return { regions, totalBytes, currentVersion: catalog.currentVersion }
}

// ── Point-in-region (for the map to pick a downloaded source) ────────────────────

/**
 * The downloaded region whose extent contains `(lng, lat)`, or null. Pure helper
 * the map child uses to decide which `srpm://` source to mount for the current
 * view. When several overlap, the most-recently-downloaded wins (freshest bake).
 */
export function regionForPoint(
  lng: number,
  lat: number,
  regions: RegionEntry[],
): RegionEntry | null {
  let best: RegionEntry | null = null
  for (const r of regions) {
    const [w, s, e, n] = r.extent
    if (lng >= w && lng <= e && lat >= s && lat <= n) {
      if (!best || r.downloadedAt > best.downloadedAt) best = r
    }
  }
  return best
}

/**
 * The downloaded region whose detail the map should serve RIGHT NOW, or null
 * (FR-17). Pure + gated: only when offline AND offline-maps is enabled AND a
 * downloaded region contains the view center. Over-max-zoom over-zooming is
 * maplibre's job (the region source's `maxzoom`), not this decision — so this
 * stays a simple point-in-region test. Returns null in every state where the
 * Tier-A persisted base should remain (online, disabled, or outside coverage),
 * which is the universal case until a region is actually downloaded.
 */
export function pickActiveRegion(
  lng: number,
  lat: number,
  regions: RegionEntry[],
  opts: { offline: boolean; enabled: boolean },
): RegionEntry | null {
  if (!opts.offline || !opts.enabled || regions.length === 0) return null
  return regionForPoint(lng, lat, regions)
}

// Re-export the abort predicate for the Settings UI to recognize a user-cancel
// (a cancelled download is not an error to surface).
export { isAbort as isDownloadAbort }

/** Whole-MB display for a byte count (regions are tens–hundreds of MB). */
export function formatRegionMB(bytes: number): string {
  const mb = bytes / (1024 * 1024)
  if (mb <= 0) return '0 MB'
  if (mb < 1) return '<1 MB'
  return `${Math.round(mb)} MB`
}
