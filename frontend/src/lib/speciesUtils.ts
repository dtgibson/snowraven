// Strips a trailing parenthetical: "Yellow-rumped Warbler (Myrtle)" -> "Yellow-rumped
// Warbler". Reproduces `/\s*\([^)]*\)\s*$/` followed by `.trim()` EXACTLY — that
// equivalence is the whole contract, and `normalizeSpeciesNameParity.test.ts` asserts it
// differentially against the old pattern over every string in the bundled taxonomy
// snapshot plus an exhaustively enumerated malformed probe set.
//
// Why it is no longer a regex. Every quantifier in that pattern was unbounded, so input
// that never completes the match made the engine retry from each start position:
// measured 140 ms on 10k characters of "(", 2,243 ms on 40k, exactly 4.00x per doubling.
// Names arrive from the user's own uncapped CSV export (`parseEbirdObservations` stores
// `commonName` with no length cap) and are normalized on the main thread inside consumer
// memos, so this was an instance of the shape CLAUDE.md's regex-hygiene rule and the
// 0.5.27 `commentBlocks.ts` post-mortem are about. It is NOT the last one: a sweep
// measuring through real exported entry points (not the literals) found five more
// superlinear regexes still reachable, all 4.00x-4.02x per doubling and 2,243-3,500 ms
// at 40k characters — two of them in `commentBlocks.ts` itself, and the worst in
// `commentText.ts`, reached from ChecklistComparer over eBird API comments, which is
// the only one of the six an unrelated party supplies. Do not restate the sweep as
// finished; re-derive it when you write the claim.
//
// The pattern, read right to left as a scan:
//   `\s*$`   the match runs to end of input, so only whitespace may follow the ')' ...
//   `\)`     ... which makes that ')' the LAST NON-WHITESPACE CHARACTER of the string.
//   `[^)]*`  cannot cross a ')', so the '(' it pairs with is the first '(' after the
//            previous ')' — not simply the first '(' in the string, and not the last.
//   `\s*`    (leading) needs no scan of its own: everything it would consume is trailing
//            whitespace of the prefix we keep, which the final `.trim()` removes anyway.
//
// Whitespace is delegated entirely to `trim`, whose character set is exactly `\s` (both
// are WhiteSpace + LineTerminator per spec), so no hand-rolled `=== ' '` test can drift
// from the pattern it replaces. Every step is a single native pass: linear by
// construction, not merely bounded input.
//
// NOT the same function as the `normalizeSpeciesName` copies local to `parseEbird`,
// `parseLifeList`, `parseMLExport` and `parseBreedingCodes`. Those cut at the FIRST '('
// regardless of closure or position ("Mallard (" -> "Mallard"), which is a different
// and looser rule. Do not converge them without measuring what moves.
function stripTrailingParenthetical(name: string): string {
  const trimmed = name.trim()
  if (!trimmed.endsWith(')')) return trimmed
  const closeIdx = trimmed.length - 1
  const prevClose = trimmed.lastIndexOf(')', closeIdx - 1)
  const openIdx = trimmed.indexOf('(', prevClose + 1)
  // `openIdx < closeIdx` needs no check: `indexOf` cannot return past the last index, and
  // cannot return `closeIdx` itself because that character is a ')'. An earlier revision
  // guarded it anyway, and the mutation matrix showed no test could ever reach the branch.
  if (openIdx === -1) return trimmed
  return trimmed.slice(0, openIdx).trim()
}

// Memoized: this runs ~12× per observation across the stats passes (~240k calls on a
// 20k-row backup), and on a real export there are only a few hundred distinct names. The
// result is a pure function of the input, so caching is always correct. Note the cache is
// keyed by the raw name and is not capped, so it is bounded by the number of DISTINCT
// names in the loaded export rather than by any constant — it makes a repeated hostile
// name free but not many distinct ones. That is pre-existing and deliberately left alone
// here; the cost per distinct name is now linear either way.
const _normCache = new Map<string, string>()

export function normalizeSpeciesName(name: string): string {
  const hit = _normCache.get(name)
  if (hit !== undefined) return hit
  const norm = stripTrailingParenthetical(name)
  _normCache.set(name, norm)
  return norm
}

export function isSpuhOrSlash(name: string): boolean {
  return name.endsWith(' sp.') || name.includes('/')
}

// A countable life-list species excludes spuh ("Gull sp."), slash ("Greater/Lesser
// Scaup"), AND hybrids ("Mallard x American Black Duck") — the same rule the eBird/ML
// parsers and Frivolous Lists apply. `isSpuhOrSlash` deliberately omits the hybrid
// case (it's the minimal display-filter primitive behind the "Show sp./slash" display
// toggles in LifeList/SpeciesDetail), so anything that needs a true "life list" count
// must use this instead.
//
// IMPORTANT: this tests the string it is GIVEN, and gives the wrong answer for
// intergrades when that string is a raw exported name — so every life-list COUNT path
// must pass an already-normalized name, or better, call `isNonCountableObservedName`
// below, which owns the raw-name case. The one deliberate raw-name caller is
// `frivolousLists.ts`, which classifies raw names on purpose (see the note there);
// that is not a pattern to copy.
export function isNonCountableSpecies(name: string): boolean {
  return isSpuhOrSlash(name) || name.includes(' x ')
}

// The countable-life-list predicate for a RAW observed name, i.e. `commonName` straight
// off an eBird export, before `normalizeSpeciesName` has stripped its trailing
// parenthetical. Count paths must use THIS, not `isNonCountableSpecies` on a raw name.
//
// Why the distinction is load-bearing: the hybrid marker is a " x " in the BASE name,
// but a trailing parenthetical can contain its own " x " for an intraspecific
// intergrade, which is a perfectly countable bird:
//
//   "Mallard x American Black Duck (hybrid)"    → base "Mallard x American Black Duck"
//                                                 → a true inter-species hybrid, NOT countable
//   "Yellow-rumped Warbler (Myrtle x Audubon's)" → base "Yellow-rumped Warbler"
//                                                 → a countable Yellow-rumped Warbler
//
// Testing the raw name conflates the two and silently drops 36 such intergrades in the
// current eBird taxonomy (Northern Flicker (Yellow-shafted x Red-shafted), Dark-eyed
// Junco (Oregon x Pink-sided), Green-winged Teal (Eurasian x American), Redpoll
// (Common x Hoary), …), which erases the species outright when the intergrade is a
// birder's only record of it.
//
// The two halves deliberately test DIFFERENT strings, and that asymmetry is the point:
//   - the " x " hybrid check runs on the NORMALIZED name, so a parenthetical intergrade
//     is judged on its base species;
//   - the spuh/slash check runs on the RAW name, preserving today's behavior for
//     subspecies-group slashes ("Canada Goose (moffitti/maxima)"), which stay excluded.
// Normalizing the slash check too would newly ADMIT 88 such names and raise people's
// life-list totals — a product decision, not a mechanical fix, so it is not done here.
export function isNonCountableObservedName(rawName: string): boolean {
  return isSpuhOrSlash(rawName) || normalizeSpeciesName(rawName).includes(' x ')
}
