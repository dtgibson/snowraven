// The one place app code names the alpha-code asset (species-code-search,
// schema.md section 6). A dynamic `import()`, so the asset rides its own chunk
// and stays off the entry graph (`entryChunk.test.ts`).
//
// WHO STARTS THE LOAD, AND WHEN (FR-24, OQ-07). Exactly three lines do:
// Search's mount effect, a species picker's effect on opening, and the Media
// Targets search box's focus handler (`components/map/TargetSpeciesList.tsx`,
// code-search-and-a11y-polish). Nothing calls `loadAlphaCodes` at module
// evaluation or at app start, so the code data starts loading no later than
// the first Search open, picker open or focus of that box in a session and
// never delays first paint. The load is memoized for the
// session, so it runs at most once and is shared by every surface.
//
// NEVER WAIT (FR-23). Nothing awaits this. Surfaces read the store through
// `useAlphaCodes()`, which is `null` while the chunk is in flight, and every
// surface then matches names exactly as it did before this feature. When the
// table arrives the store notifies, and an open surface re-ranks for the query
// already typed.
//
// FAILURE (FR-26, OQ-04). A rejected import, or a module that fails the one
// structural check below, resolves `null`, leaves the store `null` and is never
// retried in the session: a bundled asset that fails to load is a build defect,
// not a user condition, so there is no message, alert or announcement, and name
// matching continues unchanged. Same posture as `loadTaxonomyHistory`.
//
// The structural check exists only so FR-26 has a signal. The asset is
// defended at BUILD time (the fail-closed generator) and CI time
// (`alphaCodesAsset.test.ts`); no per-entry runtime validation is owed.
//
// NETWORK POSTURE: no third-party request, no new endpoint or host, no request
// moved between components. On web/Pi the chunk is a static file served by the
// user's own FastAPI server alongside every other frontend chunk; on the Mac,
// Windows, iPhone, iPad and Android apps it is in the bundle.

import type { AlphaCodeTable } from './alphaCodes'

type Importer = () => Promise<{ default: unknown }>

const importAsset: Importer = () => import('../assets/ebird-alpha-codes.json')

let importer: Importer = importAsset
let pending: Promise<AlphaCodeTable | null> | null = null
let table: AlphaCodeTable | null = null
const listeners = new Set<() => void>()

function isAlphaCodeTable(value: unknown): value is AlphaCodeTable {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { v?: unknown; version?: unknown; codes?: unknown }
  return v.v === 1 && typeof v.version === 'string'
    && typeof v.codes === 'object' && v.codes !== null && !Array.isArray(v.codes)
}

/** Start the load if nothing has; idempotent, memoized for the session, never rejects. */
export function loadAlphaCodes(): Promise<AlphaCodeTable | null> {
  if (pending === null) {
    pending = importer()
      .then((m): AlphaCodeTable | null => {
        const data: unknown = m.default
        if (!isAlphaCodeTable(data)) return null
        table = data
        for (const listener of listeners) listener()
        return data
      })
      .catch(() => null)
  }
  return pending
}

/** The loaded table, or null while pending, after a failure, or before anything asked. */
export function getAlphaCodes(): AlphaCodeTable | null {
  return table
}

/** `useSyncExternalStore`'s subscribe. Notified once, when the table arrives. */
export function subscribeAlphaCodes(listener: () => void): () => void {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

/** TEST SEAM ONLY: replace the importer (null restores the real one). */
export function _setAlphaCodesImporterForTests(fn: Importer | null): void {
  importer = fn ?? importAsset
}

/** TEST SEAM ONLY: forget the session's load, table and listeners. */
export function _resetAlphaCodesForTests(): void {
  pending = null
  table = null
  listeners.clear()
  importer = importAsset
}
