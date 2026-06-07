import { storage } from './storage'
import { parseMLExport, type MLExportResult } from './parseMLExport'

// Shared cache for the parsed Macaulay Library export, mirroring observationsCache.
// Four tabs (Multimedia, Statistics, Map Explorer, Species Detail) each read + parse
// the same ML CSV; this parses it once and shares the result. Invalidated explicitly
// when the ML file is saved or cleared (clearMLExportCache, called from Settings).
let cache: MLExportResult | null = null
let inflight: Promise<MLExportResult | null> | null = null
let generation = 0

/** Parsed ML export, memoized. Returns null when no ML file is stored (or it's
 * unparseable — the ML export is optional, so callers treat null as "no media"). */
export async function loadMLExport(): Promise<MLExportResult | null> {
  if (cache) return cache
  if (!inflight) {
    inflight = loadFresh(generation).finally(() => { inflight = null })
  }
  return inflight
}

async function loadFresh(myGen: number): Promise<MLExportResult | null> {
  const text = await storage.readFile('ml')
  if (text === null) return null
  let result: MLExportResult | null
  try {
    result = parseMLExport(text)
  } catch {
    result = null // ML export is optional; an unparseable file is treated as none
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
