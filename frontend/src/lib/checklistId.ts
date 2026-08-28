const SLASH = '/'.charCodeAt(0)

/**
 * Drop a trailing run of "/" - the linear replacement for `/\/+$/` (improve:
 * superlinear-regex-sweep).
 *
 * Why it is no longer a regex. `+` is unbounded and `$` follows it, so on input
 * that never completes the match the engine consumed the whole slash run from
 * every start position and backtracked it away again: 2,246 ms on 40,000
 * slashes, 4.00x per doubling, measured through `extractChecklistId` itself.
 * The input is a value the user pastes into the checklist comparer, so it is
 * uncapped and arrives on the main thread.
 *
 * Equivalence is direct rather than argued: `\/+$` must reach the end of the
 * string, so the only substring it can match is the maximal trailing run of
 * "/", which is exactly what this walks back over. No match (`end` unmoved)
 * leaves the string whole, as `replace` did.
 */
function stripTrailingSlashes(s: string): string {
  let end = s.length
  while (end > 0 && s.charCodeAt(end - 1) === SLASH) end--
  return s.slice(0, end)
}

/** Pull the eBird submission ID out of a pasted checklist ID or full URL
 * (e.g. "https://ebird.org/checklist/S12345678?foo" → "S12345678"). */
export function extractChecklistId(raw: string): string {
  const s = stripTrailingSlashes(raw.trim()).split('?')[0]
  return s.includes('/') ? (s.split('/').pop() ?? s) : s
}

/** eBird submission IDs look like S12345678. */
export function isValidChecklistId(id: string): boolean {
  // `{1,15}` (length-bound-checklist-id): real ids are ~10 digits; the ceiling
  // aligns every checklist-id guard with the persisted-key guard
  // SUBMISSION_KEY_RE (lib/exoticProvenanceCache.ts), so an id can no longer
  // pass this guard yet fail the store's own key guard. The shared parity
  // fixture (checklistId.fixture.json) carries the at-ceiling / over-ceiling
  // rows that hold it. Historical note: the superlinear-regex-sweep had
  // deliberately left the old unbounded `\d+$` alone (with `^` the backtrack
  // is O(n) once, measured flat at 40,000 digits); the bound supersedes that
  // carve-out rather than fixing a live defect here.
  return /^S\d{1,15}$/.test(id)
}

/**
 * The persisted-KEY guard for an eBird submission id, hoisted here from
 * `lib/exoticProvenanceCache.ts` (county-shading-and-project-stats) so a second
 * durable store can share it rather than carry a third copy — that module's own
 * comment carried an explicit instruction against another copy.
 *
 * It is deliberately the same bounded literal as `isValidChecklistId` above and
 * as the backend's `CHECKLIST_ID_RE`, written with an explicit ASCII `[0-9]`
 * rather than `\d`: the ceiling exists to ALIGN every guard so an id can never
 * pass a request/link guard and then fail a store's own key guard (the v0.5.87
 * silent-discard shape). `checklistId.fixture.json` carries the at-ceiling and
 * over-ceiling rows that hold both transports to it.
 *
 * This file has NO imports, so hoisting it here adds a pure leaf to the
 * store modules' graphs and keeps `exoticProvenanceGraph.test.ts` green.
 */
export const SUBMISSION_KEY_RE = /^S[0-9]{1,15}$/
