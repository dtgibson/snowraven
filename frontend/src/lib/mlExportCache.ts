import { storage } from './storage'
import { parseMLExport, type MLExportResult } from './parseMLExport'

// Shared cache for the parsed Macaulay Library export, mirroring observationsCache.
// Four tabs (Multimedia, Statistics, Map Explorer, Species Detail) each read + parse
// the same ML CSV; this parses it once and shares the result. Invalidated explicitly
// when the ML file is saved or cleared (clearMLExportCache, called from Settings).
let cache: MLExportResult | null = null
let inflight: Promise<MLExportResult | null> | null = null
let generation = 0

/** Parsed ML export, memoized. Returns null when no ML file is stored, when the
 * stored file could not be read, or when it is unparseable — the ML export is
 * optional, so callers treat null as "no media". This promise cannot reject. */
export async function loadMLExport(): Promise<MLExportResult | null> {
  if (cache) return cache
  if (!inflight) {
    inflight = loadFresh(generation).finally(() => { inflight = null })
  }
  return inflight
}

async function loadFresh(myGen: number): Promise<MLExportResult | null> {
  let result: MLExportResult | null
  // The READ is inside this try, not above it. It used to sit outside, so a read
  // rejection escaped as a throw while the docstring promised null — and on web/Pi
  // that is an ordinary event: `WebStorage.readFile` is a bare `fetch` + `res.text()`,
  // so an unreachable backend rejects the fetch and a truncated body rejects the text.
  try {
    const text = await storage.readFile('ml')
    if (text === null) return null
    result = parseMLExport(text)
  } catch {
    result = null // ML export is optional; an unreadable or unparseable file is treated as none
  }
  if (myGen === generation && result) cache = result
  return result
}

/** Invalidate the cached parse. Call whenever the stored ML file changes. */
export function clearMLExportCache(): void {
  cache = null
  inflight = null
  generation++
}
