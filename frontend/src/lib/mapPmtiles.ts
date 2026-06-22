// Lazy map-chunk module (NFR-08 / NFR-15 / QA-37): imported ONLY from inside the
// lazy map components (the region base source), NEVER from App.tsx's static
// graph — it pulls in `pmtiles` and touches maplibre, both of which must stay
// off first paint.
//
// Registers two maplibre protocols at module-eval time (idempotent singleton):
//   • pmtiles://  — online HTTP-Range streaming of a remote .pmtiles archive
//     (OQ-03 bonus, native to the pmtiles lib, zero extra cost, opt-in via a
//     pmtiles:// source URL).
//   • srpm://<regionId>/{z}/{x}/{y}  — a LOCAL downloaded region file on desktop
//     (OQ-09). The pmtiles lib's own Protocol hard-codes a `pmtiles://` regex
//     (verified in its source: `/pmtiles:\/\/(.+)\/(\d+)\/(\d+)\/(\d+)/` +
//     `url.substr(10)`), so a distinct scheme needs its own loadFn — backed here
//     by a pmtiles custom Source that does TRUE range reads through the storage
//     seam (open+seek+read via tauri-plugin-fs), NOT a whole-file read
//     (readFile can't range-read → it would materialize the whole multi-hundred-
//     MB archive per tile, breaking NFR-03/NFR-04).

import { addProtocol, type RequestParameters } from 'maplibre-gl'
import { PMTiles, Protocol, type Source, type RangeResponse } from 'pmtiles'
import { storage } from './storage'

export const SRPM_SCHEME = 'srpm'

/**
 * Build the `tiles[]` URL a region vector source uses. The `{z}/{x}/{y}` tokens
 * are substituted by maplibre per tile; the (shape-validated, encoded) regionId
 * is the pmtiles Source key the loadFn parses back out.
 */
export function srpmTilesUrl(regionId: string): string {
  return `${SRPM_SCHEME}://${encodeURIComponent(regionId)}/{z}/{x}/{y}`
}

/**
 * A pmtiles `Source` backed by a locally-downloaded region file, read through
 * the storage seam's true range read (open → seek → read). Stateless per call:
 * the seam opens/seeks/reads/closes each range rather than holding the
 * FileHandle open across tiles — a deliberate simplicity-over-microopt choice
 * for v1. The schema's risk #1 flags a Rust-side range `invoke` as the fallback
 * if per-tile IPC latency dents the ≥30 fps pan (NFR-03) on real hardware;
 * that is validated at release with a real baked county, not blindly here.
 */
export class RegionSource implements Source {
  private readonly regionId: string

  constructor(regionId: string) {
    this.regionId = regionId
  }

  getKey(): string {
    return this.regionId
  }

  async getBytes(offset: number, length: number, signal?: AbortSignal): Promise<RangeResponse> {
    if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
    const data = await storage.readRegionBytes(this.regionId, offset, length)
    return { data }
  }
}

// One PMTiles instance per region — its header + directory cache is reused
// across that region's tiles. Built lazily on first tile request and dropped on
// releaseRegion so a removed/switched region frees its cache.
const regionArchives = new Map<string, PMTiles>()

function archiveFor(regionId: string): PMTiles {
  let pmt = regionArchives.get(regionId)
  if (!pmt) {
    pmt = new PMTiles(new RegionSource(regionId))
    regionArchives.set(regionId, pmt)
  }
  return pmt
}

/** Drop a region's cached archive — call on region switch / unmount / removal. */
export function releaseRegion(regionId: string): void {
  regionArchives.delete(regionId)
}

/** Drop ALL cached region archives (e.g. on map teardown). */
export function releaseAllRegions(): void {
  regionArchives.clear()
}

// maplibre passes a fully-substituted URL "srpm://<regionId>/<z>/<x>/<y>".
const SRPM_TILE_RE = /^srpm:\/\/([^/]+)\/(\d+)\/(\d+)\/(\d+)/

/**
 * The srpm:// loadFn. Parses the per-tile URL, pulls the tile from the region
 * archive via a range read, and hands maplibre the raw (decompressed) MVT bytes.
 * A missing vector tile (overzoom / sparse area) is an EMPTY MVT, not an error
 * (FR-17 over-zoom shows the deepest baked content rather than blanking).
 */
export async function srpmTile(
  params: RequestParameters,
  abortController: AbortController,
): Promise<{ data: Uint8Array; cacheControl?: string; expires?: string }> {
  const m = params.url.match(SRPM_TILE_RE)
  if (!m) throw new Error('Invalid srpm protocol URL')
  const regionId = decodeURIComponent(m[1])
  const z = Number(m[2])
  const x = Number(m[3])
  const y = Number(m[4])
  const tile = await archiveFor(regionId).getZxy(z, x, y, abortController.signal)
  abortController.signal.throwIfAborted()
  if (tile) {
    return { data: new Uint8Array(tile.data), cacheControl: tile.cacheControl, expires: tile.expires }
  }
  return { data: new Uint8Array() }
}

// Module-eval registration, idempotent (HMR / double-import safe). maplibre
// throws when a scheme is registered twice, so a singleton flag guards it. This
// runs at import time (not in a React effect) so a <Source> mounting in the same
// tick already has the protocol available (schema 2a).
let registered = false

export function ensureMapProtocols(): void {
  if (registered) return
  registered = true
  // Online range-streaming bonus: a pmtiles:// source resolves a remote archive.
  addProtocol('pmtiles', new Protocol().tile)
  // Local downloaded regions (desktop): our custom range-read loader.
  addProtocol(SRPM_SCHEME, srpmTile)
}

ensureMapProtocols()
