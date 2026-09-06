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
