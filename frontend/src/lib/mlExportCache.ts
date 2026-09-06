import { storage } from './storage'
import { parseMLExportOffThread } from './parseMLExportOffThread'
import type { MLExportResult } from './parseMLExport'

// Shared cache for the parsed Macaulay Library export, mirroring observationsCache.
// Four tabs (Multimedia, Statistics, Map Explorer, Species Detail) each read + parse
// the same ML CSV; this parses it once and shares the result. Invalidated explicitly
// when the ML file is saved or cleared (clearMLExportCache, called from Settings).
let cache: MLExportResult | null = null
let inflight: Promise<MLExportResult | null> | null = null
let generation = 0

/** Parsed ML export, memoized. Returns null when no ML file is stored, when the
 * stored file could not be read, when it is unparseable, or when the parse worker
 * died — the ML export is optional, so callers treat null as "no media". This
 * promise cannot reject.
 *
 * The null-on-failure signal is deliberate and stays (v1.0.15): all five consumers
 * already branch on a falsy result, whereas a THROWN load lands in each tab's outer
 * catch, which maps to `setup-required` — telling the user to upload an export they
 * plainly already have. A failed load is not cached and does not survive in
 * `inflight`, so the next mount, re-save or file arrival starts a fresh attempt
 * rather than re-joining a dead promise. */
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
    // Off the main thread since ml-export-hardening, under the v1.0.14 settle
    // contract: the parse this awaits settles on a reply, a worker error, an
    // unreadable reply, a failed post, or silence past a measured budget, so a
    // worker that dies without saying so cannot leave this promise (and the
    // `inflight` memo holding it) pending for the rest of the session.
    result = await parseMLExportOffThread(text)
  } catch {
    // A read or parse that failed for any reason — including a worker that died
    // without saying so, and a stored file that is not an ML export — is reported
    // as "no media", never as a throw.
    result = null
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
