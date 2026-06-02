// California Breeding Bird Atlas blocks.
//
// The blocks are a regular grid: each USGS 7.5' topo quad (0.125° x 0.125°) is
// divided into 6 blocks on a uniform sub-grid, named "<quad name> <position>".
// Rather than bundle 16,527 full polygons, we bundle only the irreducible data —
// a compact gazetteer of quads (SW corner + name) plus the subdivision scheme —
// and GENERATE the block rectangles + names at runtime. Any block that is not a
// clean quad/N rectangle (clipped coastline/border blocks) is carried explicitly
// in `irregular`.

/** A USGS quad: its south-west corner [lat, lng] (on the 0.125° grid), name, and
 *  USGS quad id (e.g. "32117F2"). The block code = id + position, used for the
 *  eBird atlas block URL. */
export interface Quad {
  sw: [number, number]
  name: string
  id: string
  /**
   * Position codes present for this quad. Omitted = all scheme positions present
   * (the common case). Edge quads missing some of their blocks list only the codes
   * that actually exist, so generation stays faithful to the official data.
   */
  pos?: string[]
}

/** How a quad is subdivided into blocks. */
export interface AtlasScheme {
  /** Columns (west→east) and rows (south→north) the quad is split into. */
  cols: number
  rows: number
  /** Quad span in degrees (USGS 7.5' = 0.125 each). */
  quadLat: number
  quadLng: number
  /** Position code per cell, indexed [row][col] with row 0 = south, col 0 = west. */
  positions: string[][]
}

/** A generated (or explicit) atlas block, ready to render. */
export interface AtlasBlock {
  name: string
  /** Block code (USGS quad id + position, e.g. "32117F2CE") for the eBird URL. */
  code: string
  /** Closed GeoJSON polygon ring in [lng, lat] order. */
  ring: [number, number][]
  /** [minLng, minLat, maxLng, maxLat] */
  bbox: [number, number, number, number]
}

/** The bundled asset shape. */
export interface AtlasData {
  scheme: AtlasScheme
  quads: Quad[]
  /** Clipped/irregular blocks that aren't a clean quad/N rectangle. */
  irregular: AtlasBlock[]
}

/** Map viewport as [minLng, minLat, maxLng, maxLat] (Leaflet bounds). */
export type Bounds = [number, number, number, number]

/** Generate the block rectangles + names for a single quad. */
export function generateBlocks(quad: Quad, scheme: AtlasScheme): AtlasBlock[] {
  const [swLat, swLng] = quad.sw
  const dLat = scheme.quadLat / scheme.rows
  const dLng = scheme.quadLng / scheme.cols
  const present = quad.pos ? new Set(quad.pos) : null
  const blocks: AtlasBlock[] = []
  for (let r = 0; r < scheme.rows; r++) {
    for (let c = 0; c < scheme.cols; c++) {
      const code = scheme.positions[r]?.[c] ?? `${r}${c}`
      if (present && !present.has(code)) continue // edge quad missing this block
      const minLat = swLat + r * dLat
      const minLng = swLng + c * dLng
      const maxLat = minLat + dLat
      const maxLng = minLng + dLng
      blocks.push({
        name: `${quad.name} ${code}`,
        code: `${quad.id}${code}`,
        ring: [
          [minLng, minLat],
          [maxLng, minLat],
          [maxLng, maxLat],
          [minLng, maxLat],
          [minLng, minLat],
        ],
        bbox: [minLng, minLat, maxLng, maxLat],
      })
    }
  }
  return blocks
}

/** Do two bboxes overlap? (axis-aligned, [minLng,minLat,maxLng,maxLat]) */
function bboxIntersects(a: Bounds, b: Bounds): boolean {
  return a[0] <= b[2] && a[2] >= b[0] && a[1] <= b[3] && a[3] >= b[1]
}

/** A quad's full bbox from its SW corner. */
export function quadBbox(quad: Quad, scheme: AtlasScheme): Bounds {
  const [swLat, swLng] = quad.sw
  return [swLng, swLat, swLng + scheme.quadLng, swLat + scheme.quadLat]
}

export interface InBoundsResult {
  /** Generated + explicit blocks intersecting the bounds (empty if tooMany). */
  blocks: AtlasBlock[]
  /** True when the count would exceed `cap` — caller shows a "zoom in" hint and draws nothing. */
  tooMany: boolean
}

/**
 * Collect the atlas blocks intersecting `bounds`, generating geometry on demand.
 * If the resulting count would exceed `cap`, returns { blocks: [], tooMany: true }
 * so the caller can show a "zoom in to see atlas blocks" hint instead of drawing
 * thousands of polygons. Outside California → empty blocks, tooMany false.
 */
export function blocksInBounds(data: AtlasData, bounds: Bounds, cap: number): InBoundsResult {
  const result: AtlasBlock[] = []
  // Quads whose bbox intersects the view, expanded to their blocks.
  for (const quad of data.quads) {
    if (!bboxIntersects(quadBbox(quad, data.scheme), bounds)) continue
    for (const block of generateBlocks(quad, data.scheme)) {
      if (bboxIntersects(block.bbox, bounds)) {
        result.push(block)
        if (result.length > cap) return { blocks: [], tooMany: true }
      }
    }
  }
  for (const block of data.irregular) {
    if (bboxIntersects(block.bbox, bounds)) {
      result.push(block)
      if (result.length > cap) return { blocks: [], tooMany: true }
    }
  }
  return { blocks: result, tooMany: false }
}

// ── Point → block (for joining observations to atlas blocks) ──────────────────

function gridSnap(v: number, step: number): number {
  return Number((Math.floor(v / step) * step).toFixed(4))
}

/** O(1) lookup of a quad by its SW corner. Key matches the gazetteer's `sw` values. */
export function buildQuadIndex(data: AtlasData): Map<string, Quad> {
  const idx = new Map<string, Quad>()
  for (const q of data.quads) idx.set(`${q.sw[0]},${q.sw[1]}`, q)
  return idx
}

/**
 * The atlas block code (quad id + position, e.g. "32117F2CE") containing a point,
 * or null if the point is outside California atlas coverage (no quad in the
 * gazetteer) or in an edge quad that lacks that sub-block. Uses the regular
 * quad-grid math — no polygon test needed since blocks are axis-aligned rectangles.
 */
export function pointToBlockCode(
  data: AtlasData,
  index: Map<string, Quad>,
  lat: number,
  lng: number,
): string | null {
  const { quadLat, quadLng, cols, rows, positions } = data.scheme
  const swLat = gridSnap(lat, quadLat)
  const swLng = gridSnap(lng, quadLng)
  const quad = index.get(`${swLat},${swLng}`)
  if (!quad) return null
  let col = Math.floor((lng - swLng) / (quadLng / cols))
  let row = Math.floor((lat - swLat) / (quadLat / rows))
  col = Math.min(Math.max(col, 0), cols - 1)
  row = Math.min(Math.max(row, 0), rows - 1)
  const code = positions[row]?.[col]
  if (!code) return null
  if (quad.pos && !quad.pos.includes(code)) return null
  return `${quad.id}${code}`
}
