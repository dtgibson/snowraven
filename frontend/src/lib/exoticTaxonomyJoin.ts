// The escapee check's taxonomy join (escapee-check-new-taxonomy): which eBird
// answer rows stand in for a species whose export name predates the latest
// taxonomy update.
//
// The problem it closes. An export downloaded before eBird's 2026 update names a
// split bird by its old name ("Willet"). `/taxonomy/codes` resolves it by
// scientific name to one daughter (`willet2`, Saltmarsh Willet), while eBird now
// answers for that observation under a sibling or the slash (`willet1`, now
// "Saltmarsh/Prairie Willet"), so the merge dropped the row and the species
// never settled. A lumped-away name ("House Swift") resolved to no code at all
// and was never checked. The table below says, per before-side name, which
// codes belong to the same event; `joinedCover` in `exoticProvenance.ts` is the
// one rule that reads it, for both cover-index builders.
//
// Scope: the events of the LATEST covered update only, the one the bundled
// taxonomy snapshot carries (2026 today). An export older than an earlier update
// keeps the previous behaviour; the status line names any species left open.
//
// LOADING. Both surfaces (Statistics and Life Lists) take the table from
// `loadEscapeeJoin()`, which reads the asset through `loadTaxonomyHistory()`, the
// one place app code names it, as a dynamic import, so the asset stays off the
// entry chunk and off both tabs' static graphs (`entryChunk.test.ts`). A failed
// load is no join, the previous behaviour, never an error.
//
// The asset is a build-time artifact defended at build and CI time
// (`taxonomyHistoryAsset.test.ts`), so its codes are not re-validated here.

import type { TaxonomyHistory } from './taxonomyHistory'
import { loadTaxonomyHistory } from './taxonomyHistoryAsset'
import { NO_ESCAPEE_JOIN, type EscapeeJoin, type EscapeeJoinEntry } from './exoticProvenance'

/** The join table from the history asset. Pure; asset-sized work, once. */
export function buildEscapeeJoin(history: TaxonomyHistory | null): EscapeeJoin {
  const latest = history?.coverage?.latest
  if (!history || !latest) return NO_ESCAPEE_JOIN
  const byBeforeName = new Map<string, EscapeeJoinEntry>()
  const ambiguous = new Set<string>()
  for (const ev of history.events) {
    if (ev.year !== latest.year) continue
    const family: string[] = []
    for (const e of [...ev.after, ...ev.slashes]) if (!family.includes(e.code)) family.push(e.code)
    for (const b of ev.before) {
      const key = b.com.toLowerCase()
      if (ambiguous.has(key)) continue
      if (byBeforeName.has(key)) { byBeforeName.delete(key); ambiguous.add(key); continue }
      byBeforeName.set(key, { code: b.code, family })
    }
  }
  return byBeforeName.size === 0 ? NO_ESCAPEE_JOIN : { byBeforeName }
}

let pending: Promise<EscapeeJoin> | null = null

/** The join both surfaces read, memoized for the session (the asset is fetched
 *  at most once, by `loadTaxonomyHistory`). Never rejects: the loader resolves
 *  null on failure, and a throw from the derivation (an asset that passed the
 *  loader's shape check but not the types) lands in the `catch` as no join. */
export function loadEscapeeJoin(): Promise<EscapeeJoin> {
  if (pending === null) {
    pending = loadTaxonomyHistory().then(buildEscapeeJoin).catch(() => NO_ESCAPEE_JOIN)
  }
  return pending
}

export function _resetEscapeeJoinForTests(): void {
  pending = null
}
