// The one place app code names the splits-and-lumps history asset
// (taxonomic-splits-lumps, schema.md 7.2). A dynamic `import()`, so the asset
// rides its own chunk and stays off the entry graph (`entryChunk.test.ts`);
// Species Detail calls it once it reaches its ready state.
//
// It resolves NULL rather than rejecting, because every consumer already has a
// "do not render" branch on a falsy value (FR-28): a bundled asset that fails to
// load is a build defect, not a user condition, so the control and the section
// simply do not appear and no alert is raised. The promise is memoized for the
// session, so the chunk is fetched at most once.
//
// The one structural check below exists only so FR-28 has a signal. The asset
// is defended at BUILD time (the fail-closed generator) and CI time
// (`taxonomyHistoryAsset.test.ts`); no per-entry runtime validation is owed,
// because a user cannot change a Vite-inlined asset without changing the code
// that reads it (CLAUDE.md, the bundled-asset trust boundary).
//
// NETWORK POSTURE: no third-party request, no new endpoint or host, no request
// moved between components. On web/Pi the chunk is a static file served by the
// user's own FastAPI server alongside every other frontend chunk.
//
// REVERSAL SEAM (schema.md 7.2, OQ-04). If eBird ever publishes a fetchable
// change list on an existing disclosed host, a long-TTL persistent cache of the
// `countyCompletenessCache.ts` shape would sit behind this function and merge
// fetched events over the bundled floor. Nothing of it is built; the network
// posture and PRIVACY_POLICY.md would be re-read then.

import type { TaxonomyHistory } from './taxonomyHistory'

/** 64 KiB per covered update (about 2.6x the measured estimate) plus 16 KiB of
 *  envelope, with an absolute ceiling so a generator that emitted a whole
 *  taxonomy still fails. Bound on the committed file's byte length. */
export const HISTORY_BYTES_PER_UPDATE = 65_536
export const HISTORY_BYTES_ENVELOPE = 16_384
export const HISTORY_BYTES_CEILING = 1_048_576
export const historyMaxBytes = (updates: number): number =>
  Math.min(HISTORY_BYTES_CEILING, HISTORY_BYTES_ENVELOPE + HISTORY_BYTES_PER_UPDATE * updates)

function isHistoryShape(value: unknown): value is TaxonomyHistory {
  if (typeof value !== 'object' || value === null) return false
  const v = value as { v?: unknown; events?: unknown; updates?: unknown }
  return v.v === 1 && Array.isArray(v.events) && Array.isArray(v.updates)
}

let pending: Promise<TaxonomyHistory | null> | null = null

export function loadTaxonomyHistory(): Promise<TaxonomyHistory | null> {
  if (pending === null) {
    pending = import('../assets/ebird-taxonomy-history.json')
      .then((m): TaxonomyHistory | null => {
        const data: unknown = m.default
        return isHistoryShape(data) ? data : null
      })
      .catch(() => null)
  }
  return pending
}

export function _resetTaxonomyHistoryForTests(): void {
  pending = null
}
