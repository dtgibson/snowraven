import { storage } from './storage'
import { parseEbirdObservations } from './parseEbirdObservations'
import type { ObservationEntry } from '../types'

// Shared cache for the parsed eBird backup. Several tabs each parse the same ~20k-row
// CSV; this memoizes the parse so they share one result. Once parsed, a cache hit
// returns immediately — no re-read of the ~6 MB file and no content compare on every
// heavy-tab mount. The cache is invalidated explicitly when the eBird file is saved
// or cleared (clearEbirdObservationsCache, called from Settings).
let cache: { text: string; observations: ObservationEntry[] } | null = null
// In-flight parse, so concurrent first-callers share one parse.
let inflight: Promise<{ text: string; observations: ObservationEntry[] } | null> | null = null
// Bumped on invalidation so a parse that's in flight when the file changes won't
// repopulate the cache with now-stale content.
let generation = 0

// Parse off the main thread via a Web Worker so the UI stays responsive while a
// large export is parsed (especially on low-power / Raspberry Pi deployments).
// Falls back to a synchronous parse if Workers are unavailable or the worker errors,
// so behavior is identical everywhere — just smoother where Workers are supported.
function parseOffThread(text: string): Promise<ObservationEntry[]> {
  let worker: Worker
  try {
    worker = new Worker(new URL('./observationsWorker.ts', import.meta.url), { type: 'module' })
  } catch {
    return Promise.resolve(parseEbirdObservations(text))
  }
  return new Promise<ObservationEntry[]>((resolve) => {
    worker.onmessage = (e: MessageEvent<ObservationEntry[]>) => {
      resolve(e.data)
      worker.terminate()
    }
    worker.onerror = () => {
      resolve(parseEbirdObservations(text))
      worker.terminate()
    }
    worker.postMessage(text)
  })
}

/**
 * Read the stored eBird backup and parse it into observations, memoized by file
 * content. Returns null when no eBird file is stored. The returned `text` is the
 * raw CSV (callers that also need it — e.g. to parse comments or ML — can reuse it).
 */
export async function loadEbirdObservations(): Promise<{ text: string; observations: ObservationEntry[] } | null> {
  if (cache) return cache
  if (!inflight) {
    inflight = loadFresh(generation).finally(() => { inflight = null })
  }
  return inflight
}

async function loadFresh(myGen: number): Promise<{ text: string; observations: ObservationEntry[] } | null> {
  const text = await storage.readFile('ebird')
  if (text === null) return null
  const observations = await parseOffThread(text)
  const result = { text, observations }
  // Don't cache if the file was invalidated while we were parsing.
  if (myGen === generation) cache = result
  return result
}

/** Invalidate the cached parse. Call whenever the stored eBird file changes (save or
 * clear) so the next load re-reads + re-parses. */
export function clearEbirdObservationsCache(): void {
  cache = null
  inflight = null
  generation++
}
