import { storage } from './storage'
import { parseEbirdObservations } from './parseEbirdObservations'
import type { ObservationEntry } from '../types'

// Shared, content-keyed cache for the parsed eBird backup. Several tabs each read
// and parse the same ~20k-row CSV independently; this memoizes the parse so they
// share one result. Keying on the file's text means a re-upload (new content)
// naturally invalidates the cache without any explicit signal.
let cache: { text: string; observations: ObservationEntry[] } | null = null

/**
 * Read the stored eBird backup and parse it into observations, memoized by file
 * content. Returns null when no eBird file is stored. The returned `text` is the
 * raw CSV (callers that also need it — e.g. to parse comments or ML — can reuse it).
 */
export async function loadEbirdObservations(): Promise<{ text: string; observations: ObservationEntry[] } | null> {
  const text = await storage.readFile('ebird')
  if (text === null) return null
  if (cache && cache.text === text) return cache
  cache = { text, observations: parseEbirdObservations(text) }
  return cache
}

/** Drop the cached parse. Content-keying already invalidates on change; this just
 * frees the retained array (e.g. when a file is cleared). */
export function clearEbirdObservationsCache(): void {
  cache = null
}
