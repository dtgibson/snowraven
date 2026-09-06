import { useEffect, useMemo, useRef, useState } from 'react'
import type { ObservationEntry } from '../types'
import type { Granularity } from './birdingStats'
import { computeStatsBundle } from './statsBundle'
import type { StatsBundle, StatsRequest } from './statsBundle'
import { computeStatsWithFallback, createStatsSession } from './statsOffThread'
import type { StatsSession } from './statsOffThread'

/**
 * A canonical key for a set of excluded names, for COMPARISON ONLY.
 *
 * Injective over any array of strings, which is the whole requirement: two
 * different name sets can never share a key, whatever characters the names
 * contain. Exported so the property can be asserted directly rather than
 * inferred from the hook's behaviour — see `statsExcludedKey.test.ts`.
 *
 * Nothing decodes it. If a future change needs the names back, it must read the
 * array, not parse this string; a decoder is what made the earlier newline-joined
 * version lossy.
 */
export function excludedNamesKey(sortedNames: readonly string[]): string {
  return JSON.stringify(sortedNames)
}

export interface UseStatsBundleArgs {
  /** The parsed export. Its IDENTITY is the session key: a new array (a Settings
   *  re-upload, an iCloud arrival) tears the worker down and hands over the new
   *  one. */
  observations: ObservationEntry[]
  includeSpuh: boolean
  granularity: Granularity
  /** The eBird-escapee set from the provenance pass. Read by CONTENT, not by
   *  identity — see the content-key note below. */
  excludedNames: ReadonlySet<string>
  /** False until the tab's shell has painted (the existing double-rAF gate), so no
   *  worker is spawned and no export is handed over before the first frame lands. */
  active: boolean
}

/**
 * The Statistics tab's figures, computed off the main thread.
 *
 * ONE REPLY, ONE COMMIT. The whole chain lands in a single `setBundle`, so the page
 * never shows a half-updated set of numbers — a state it has never had, and the
 * constraint that keeps this change invisible. Returns null only before the first
 * bundle for the current export exists; the caller paints its existing
 * "Computing your statistics…" shell for that.
 *
 * A TOGGLE KEEPS SHOWING THE OLD FIGURES until the new ones arrive, because the
 * previous bundle is left in place while the next one computes. That is exactly the
 * sequence the two `useDeferredValue` calls used to produce (a checkbox that flips
 * instantly, figures that update a beat later), which is why they are gone: the
 * bundle IS the deferred value, and it carries the `includeSpuh` / `granularity` it
 * was computed with, so the accumulation chart's branch reads the request its data
 * came from rather than approximating it with a separately-deferred control value.
 */
export function useStatsBundle({
  observations, includeSpuh, granularity, excludedNames, active,
}: UseStatsBundleArgs): StatsBundle | null {
  const [bundle, setBundle] = useState<StatsBundle | null>(null)

  // The escapee set BY CONTENT. `buildProvenanceLookup` rebuilds this Set on every
  // provenance snapshot bump, so its identity churns during a pass whether or not
  // any species was added — and the memo this replaces, keyed on that identity,
  // re-ran the accumulation on every bump for nothing. Keying on content means a
  // re-published identical set costs no request at all, which is also what keeps
  // the rest of the bundle's identity stable through a sweep.
  //
  // THE KEY IS NEVER DECODED, and that is the point rather than a detail. An
  // earlier revision joined the sorted names on a newline and split them back
  // out, on the premise that an eBird common name cannot contain one. Nothing
  // enforces that premise: `streamCsvRows` admits embedded newlines inside a
  // quoted field, `trim()` and `normalizeSpeciesName` only strip the ends, and
  // the taxonomy lookup resolves on scientific name first, so a name carrying a
  // newline survives all the way here — at which point `{"Mallard\nX"}` decoded
  // to `["Mallard", "X"]` and shared a key with `{"Mallard", "X"}`. The visible
  // consequence would be an escapee silently not excluded: a wrong life-list
  // figure, from a set that never round-tripped.
  //
  // So the names travel as the ARRAY they already are, and the key exists only to
  // be compared. `JSON.stringify` is injective over a string array for any
  // content whatsoever — it escapes the separator problem out of existence rather
  // than assuming a character cannot occur — and nothing ever reads a name back
  // out of it. The list reaches the dispatch effect through a ref rather than a
  // dependency, so the effect re-runs when the CONTENT changes and not when the
  // Set is merely rebuilt.
  const excludedList = useMemo(() => [...excludedNames].sort(), [excludedNames])
  const excludedKey = useMemo(() => excludedNamesKey(excludedList), [excludedList])
  // Declared BEFORE the two effects below, and that order is load-bearing twice
  // over: React runs a component's effects in declaration order, so on the commit
  // where the content changed this ref already holds the new list by the time the
  // dispatch effect reads it.
  const excludedRef = useRef<readonly string[]>(excludedList)
  useEffect(() => { excludedRef.current = excludedList }, [excludedList])

  // The worker, keyed on the export. Declared BEFORE the dispatch effect below and
  // that order is load-bearing: React runs a component's effects in declaration
  // order, so the session for a newly-arrived export exists before the dispatch
  // effect reads the ref.
  const sessionRef = useRef<StatsSession | null>(null)
  useEffect(() => {
    if (!active || observations.length === 0) { sessionRef.current = null; return }
    const session = createStatsSession(observations)
    sessionRef.current = session
    return () => { session?.dispose(); sessionRef.current = null }
  }, [active, observations])

  useEffect(() => {
    if (!active || observations.length === 0) {
      // Deliberate synchronous reset, matching the tab's other two: when the export
      // identity changes we WANT to drop back to the shell rather than paint the
      // previous file's figures for a commit.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setBundle(null)
      return
    }
    const request: StatsRequest = {
      includeSpuh, granularity, excludedNames: excludedRef.current,
    }
    const session = sessionRef.current
    if (!session) {
      // No Worker on this platform (an older browser, jsdom under vitest). ONE
      // compute, here, in this commit — the timing 1.0.19 has on every device, and
      // synchronous on purpose: an await on this path would move the commit for
      // every test that renders this tab in exchange for nothing, on a platform
      // with no worker to wait for.
      setBundle(computeStatsBundle(observations, request))
      return
    }
    let cancelled = false
    void computeStatsWithFallback(session, observations, request).then(
      next => { if (!cancelled) setBundle(next) },
      // `computeStatsWithFallback` is total over the session's five settle paths;
      // the ONE thing it does not close is the chain itself throwing, which fails
      // identically on both threads. Leaving the previous bundle in place keeps the
      // figures the user is looking at rather than blanking them — and before this
      // change the same throw came out of the render body and took the tab's whole
      // tree with it.
      () => {},
    )
    return () => { cancelled = true }
  }, [active, observations, includeSpuh, granularity, excludedKey])

  return bundle
}
