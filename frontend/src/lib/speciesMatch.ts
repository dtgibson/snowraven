// THE ONE COPY OF THE SPECIES-PICKER MATCH PREDICATE (FR-23).
//
// EXTRACTED, NOT DUPLICATED-AND-ASSERTED-EQUIVALENT. The PRD allowed either.
// This repo's parity-test convention (`checklistId.parity.test.ts`,
// `hotspotActivity.parity.test.ts`) exists for CROSS-RUNTIME twins -- TypeScript
// against Python -- that genuinely cannot share code. `SpeciesCombobox` and the
// command palette can, and `.claude/rules` says the opposite thing wherever
// sharing is possible ("single-sourcing prevents drift", the 429 mappers;
// `pipeline/design-system.md` putting every species picker through one shared
// component for exactly this reason). QA-22 is therefore a table over the ONE
// function plus a source scan proving both files import it, which is strictly
// stronger than a table comparing two implementations that agree today.
//
// BEHAVIOUR PRESERVED EXACTLY when it was lifted out of `SpeciesCombobox`: same
// `trim().toLowerCase()`, same OR, same `?? ''` so a missing scientific name
// never matches. Do not "improve" a shipped predicate while extracting it -- if
// `SpeciesCombobox.test.tsx` goes red, the extraction is wrong, not the test.
//
// NFR-07 / QA-62: the query reaches only `String.prototype.includes`. No
// `RegExp` is constructed anywhere on this path, so no user input can drive
// backtracking on the main thread, and this module is the single file a source
// scan has to check.
//
// It imports nothing, so it could ride either half of the bundle harmlessly; it
// is off the entry graph today only because both of its consumers are.
//
// SPECIES CODE SEARCH ADDED TWO FUNCTIONS BELOW THE PREDICATE, AND LEFT THE TWO
// ABOVE BYTE-IDENTICAL (FR-11). `rankSpeciesMatches` is the ONE place the
// ranking rule lives (code matches first, then name matches, each in the
// surface's own order; FR-13, OQ-02 resolved by the user as rule A), and
// `highlightOnCodeArrival` is the one place FR-25's highlight rule lives. Both
// consumers call both, so Search and every picker answer a code the same way.
// Still no import: the code hits are computed by the caller (`lib/alphaCodes.ts`)
// and handed in as a Set, and the name predicate is handed in as a PARAMETER
// rather than called here, because an ESM module's internal call would bypass
// the export binding that `speciesComboboxOptionsIdentity.test.tsx` counts
// through (schema.md 2.5). No `localeCompare` and no RegExp (NFR-11, NFR-03).

/**
 * Normalize a raw query once. Callers normalize ONCE PER KEYSTROKE, never once
 * per row -- which is the whole reason this is a separate function from the
 * predicate below (NFR-02).
 */
export function normalizeSpeciesQuery(raw: string): string {
  return raw.trim().toLowerCase()
}

/**
 * Case-insensitive substring over common name AND scientific name.
 *
 * `q` is expected to be ALREADY normalized by `normalizeSpeciesQuery`. Passing a
 * raw query here is not an error the types can catch, and it would simply match
 * less; every shipped caller normalizes first.
 */
export function matchesSpeciesQuery(o: { name: string; sciName?: string }, q: string): boolean {
  return o.name.toLowerCase().includes(q) || (o.sciName ?? '').toLowerCase().includes(q)
}

/**
 * THE RANKING RULE, DEFINED ONCE (FR-12, FR-13, FR-18, OQ-02).
 *
 * `q` is already normalized and non-empty; `codeHits` is the set of names in
 * THIS list that carry `q` as a code (`alphaCodeHits`), or undefined when there
 * is no code data or no code matched; `matchesName` is the name predicate
 * (callers pass the `matchesSpeciesQuery` binding they import); `order` is the
 * surface's own order within each group (Search passes `compareSpeciesName`, a
 * picker passes nothing and keeps the order it was handed).
 *
 * - NO HITS is the old code path exactly: filter by name, then sort when an
 *   order is given. So FR-18's non-code invariant (every query that is not a
 *   code of a listed row behaves as it did before) is that path itself rather
 *   than an equivalent of it.
 * - HITS: one pass. A row whose name is a hit goes to the code group and is not
 *   tested by name, so a row matching both ways is listed once, in the code
 *   group; any other row goes to the name group when the predicate holds. Each
 *   group is sorted by `order` when given (Array.prototype.sort is stable), and
 *   the code group comes first.
 *
 * Any change to the rule (a mitigation for a four-letter name prefix that is
 * also a code, say) is a change to this one function, which already receives
 * everything such a rule could need, and which acts only when there are hits,
 * so it cannot disturb a query that is not a code.
 */
export function rankSpeciesMatches<T extends { name: string; sciName?: string }>(
  rows: readonly T[],
  q: string,
  codeHits: ReadonlySet<string> | undefined,
  matchesName: (row: T, q: string) => boolean,
  order?: (a: T, b: T) => number,
): T[] {
  if (codeHits === undefined || codeHits.size === 0) {
    const matched = rows.filter(r => matchesName(r, q))
    if (order) matched.sort(order)
    return matched
  }
  const byCode: T[] = []
  const byName: T[] = []
  for (const r of rows) {
    if (codeHits.has(r.name)) byCode.push(r)
    else if (matchesName(r, q)) byName.push(r)
  }
  if (order) {
    byCode.sort(order)
    byName.sort(order)
  }
  return byCode.concat(byName)
}

/**
 * FR-25, DEFINED ONCE (OQ-03): when the code data arrives while a surface is
 * open, keep the highlight or clear it, so it never moves to a different bird
 * on its own.
 *
 * Keeps `active` when nothing, a destination, the Alerts inbox row or "All
 * species" is highlighted (`active < firstSpeciesIndex`), or when the species
 * rows are unchanged element by element. Otherwise returns -1.
 * `firstSpeciesIndex` is Search's `destinationCount`, or a picker's 1 with an
 * "All species" row and 0 without one.
 */
export function highlightOnCodeArrival(
  active: number,
  firstSpeciesIndex: number,
  before: readonly string[],
  after: readonly string[],
): number {
  if (active < firstSpeciesIndex) return active
  if (before.length === after.length && before.every((name, i) => name === after[i])) return active
  return -1
}
