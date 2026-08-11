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
// 0.5.27 `commentBlocks.ts` post-mortem are about. This was NOT the last one. The sweep
// measuring through real exported entry points (not the literals) found five more, and
// re-deriving it in v0.5.85 turned up a SIXTH the record had missed
// (`countyBoundaries.ts`, which runs once per observation). All six became linear scans
// in v0.5.85 — see `regexSweepGuards.ts` and the five `*RegexBound.test.ts` suites.
//
// Do not restate the sweep as finished; re-derive it when you write the claim. As of
// v0.5.85 it was re-run over `frontend/src`, and every remaining regex literal carrying
// an unbounded quantifier with something that can fail after it measured linear (~2x per
// doubling at 10k/20k/40k) through its real path. That is a measurement with a date on
// it, not a guarantee: it decays with every commit, and this exact count is the kind of
// claim that has already shipped false here once.
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
// NOT the same function as `truncateAtFirstParen` below, which the four CSV parsers use.
// That one cuts at the FIRST '(' regardless of closure or position ("Mallard (" ->
// "Mallard"). The divergence has now been measured; see that function's comment for the
// numbers and for why the two deliberately stay apart.
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
// result is a pure function of the input, so caching is always correct.
//
// The memo is BOUNDED, and the reasoning that said it did not need to be was wrong in a
// load-bearing way. The roadmap called it "bounded in practice because `Map.set` stores a
// reference to a string the parsed-observation array already holds" — true only while
// that array is alive. The moment the user loads a second file the Map is the sole owner
// of every key from the first, which is precisely the long desktop session the entry was
// describing. Measured with every other reference dropped: 118 B/entry at realistic
// lengths, 2,093 B/entry at 2,000 characters, and 26.5 MB retained across ten successive
// loads of 20k disjoint names (200,000 entries, none released). A slow leak, confirmed,
// never a denial of service — growth is proportional to distinct names read and never
// amplifies — but a leak the mitigation did not actually cover.
//
// Three limits, so retention is a constant rather than a function of what the CSV
// contained. THESE are the guarantee, and they are what the suite asserts:
//
//   1. the Map admits at most MEMO_MAX_ENTRIES entries,
//   2. no key in it exceeds MEMO_MAX_KEY_LENGTH characters, and
//   3. over-length names are held in a separate budgeted cache (below), bounded at
//      MEMO_LONG_CHAR_BUDGET characters plus one name.
//
// Deliberately NOT stated as a byte product, and the reason is not abstract: three
// independent measurements of this exact design gave 172, 208 and 173 B/entry at the key
// limit, because bytes-per-entry encodes one engine's heap accounting and moves with the
// runtime, the allocator and the string representation. An assertion built on such a
// figure can become false without ever failing, which is what happened to the first
// version of this comment (it claimed a 5.65 MB worst case that a later measurement
// exceeded) and again to the second (it claimed 4-7 MiB while measuring only ASCII).
//
// For SCALE only, naming the variable that actually moves it — V8 stores a string as
// one-byte or two-byte depending on its characters, and a hostile key set picks the
// expensive one:
//
//   ASCII keys at the length limit      ~173 B/entry   ~5.4 MiB at the cap
//   non-Latin1 keys at the length limit ~300 B/entry   ~9.4 MiB at the cap
//
// Both are small fixed ceilings, and neither is the guarantee. Today's real ceiling is far
// below either: the entire bundled taxonomy is 17,891 distinct names of any category, so a
// user who had recorded every taxon on earth fills roughly half the entry limit, so no
// real name is ever turned away.
//
// BOTH caches use admission control: they fill to their limit and then stop admitting.
// Neither evicts. This one evicted oldest-inserted at first, and that was the same defect
// as the over-length slot below, found in the same way — measured only AT capacity, where
// a fixed-size cache never evicts and every measurement is a hit. Past the limit a FIFO
// misses, deletes and inserts on every call: 2,469.8 ms at capacity+1 against 14.6 ms for
// no cache at all, i.e. 169x worse than not caching, on ordinary 24-character names.
// Admission control reads 12.4 ms on the same workload and is identical below capacity.
//
// The rule, stated once for the whole function because it was written here and then
// applied to only one of the two caches: A FIXED-SIZE CACHE'S PERFORMANCE CLAIM MUST BE
// MEASURED AT CAPACITY PLUS ONE. Every bounded structure in this module has a capacity+1
// guard in `speciesUtilsMemoBound.test.ts`, in the scale-invariant ratio shape, and adding
// another bounded structure here means adding another.
//
// Nothing touches the hit path. True LRU would need a `delete`+`set` on every hit, which
// measured 3.54x slower on the realistic hot path for a policy no workload here benefits
// from; the suite pins that the cache is not reordered on a hit.
//
// Accepted trade, the same one the over-length cache carries: admission is first-come, so
// a later file's names can go uncached behind an earlier file's. It is cheap here because
// an unadmitted name recomputes a scan bounded at MEMO_MAX_KEY_LENGTH characters, and no
// real dataset reaches the limit at all — the entire bundled taxonomy is 17,891 names
// against a 32,768 cap.
//
// Interleaved on the realistic hot path (240,000 calls over 500 distinct real names,
// alternating order, min of 12 rounds): 3.52 ms bounded vs 3.30 ms unbounded, i.e. about
// 0.9 ns per call for the length compare. Measured interleaved on purpose — an A-then-B
// run reads 3.0 vs 4.0 and reverses the sign, which is a JIT ordering artifact, not a cost.
const MEMO_MAX_KEY_LENGTH = 128
const MEMO_MAX_ENTRIES = 32768

const _normCache = new Map<string, string>()

// A name past the length limit is never admitted to the Map above, but it is not left
// uncached either, and that second half is not optional. Skipping the memo outright
// re-runs the O(n) scan on every call, which turns a bounded-MEMORY fix into an
// unbounded-CPU one: 240,000 calls on a single 40,000-character name measured 3,296 ms
// skipped against 1.8 ms memoized.
//
// This was FIRST written as a single slot, and that was wrong in a way worth recording,
// because the mistake is easy to repeat. A one-entry cache has a 100% hit rate on one
// repeated key and a 0% hit rate on TWO alternating keys, and an attacker picks the keys.
// Measured at 240,000 calls over 40,000-character names: 1.5 ms for one repeated name,
// 3,493.7 ms for two alternating — 1.048x the skip-only implementation the slot was
// written to avoid, and a 1,457x regression against the uncapped Map it replaced. The
// general rule, which is now a convention: a fixed-size cache's performance claim must be
// measured at CAPACITY PLUS ONE, because at capacity it never evicts and every
// measurement is a hit.
//
// So the over-length path is a character-budgeted cache with ADMISSION CONTROL: it fills
// to a budget and then stops admitting. It never evicts.
//
// Eviction was the reviewed suggestion and was measured against this one at CAPACITY PLUS
// ONE, which is the measurement the slot skipped and the thing that decides between them.
// Below capacity they are identical. Past it, a FIFO has a 0% hit rate on a rotating
// working set AND pays a delete-plus-insert per call, so it falls off a cliff, while
// admission control keeps the first N names hitting and recomputes only the excess:
//
//   workload (240,000 calls)          admission   FIFO evict   skip-only   uncapped
//   1 repeated 40k name                  2.4 ms       2.4 ms   3,461.5 ms     2.2 ms
//   2 alternating 40k names              3.0 ms       3.0 ms   3,621.7 ms     2.9 ms
//   26 rotating 40k names (capacity)    22.4 ms      22.3 ms   4,617.0 ms    22.3 ms
//   27 rotating 40k names (CAPACITY+1) 142.9 ms   4,797.8 ms   4,605.0 ms    23.0 ms
//   600 distinct 2k names (CAP+1)       35.7 ms     391.0 ms     235.3 ms     5.4 ms
//   8,200 distinct 129-char (CAP+1)      9.0 ms     764.9 ms      27.3 ms     7.0 ms
//
// Both axes are bounded:
//
//   MEMORY. Retention is at most MEMO_LONG_CHAR_BUDGET characters of keys, or one name
//   when a single name exceeds the whole budget (admitted into an empty cache so that a
//   huge repeated value is still served rather than recomputed forever). Values are
//   `.slice()`s of their keys and share that storage, which is why the budget charges keys
//   only. The entry count needs no separate limit: an over-length name is at least
//   MEMO_MAX_KEY_LENGTH + 1 characters, so the budget holds at most 8,128 of them.
//
//   CPU. Cost degrades in proportion to how far the working set exceeds the budget, rather
//   than falling off a cliff, and the excess has to be present in the user's file as
//   distinct characters. That is what the single slot lacked: two names totalling 80,000
//   characters drove 3.5 seconds.
//
// The honest residual, stated because a bounded cache cannot be thrash-proof: a working
// set far past the budget still costs real time (60 rotating 40,000-character names
// measured 2,647 ms). Reaching it needs ~2.4 MB of DISTINCT long names and 20,000 rows
// carrying them, so the cost tracks the file instead of being amplified by two cells.
//
// The budget is 2^20 characters. Unlike the two limits above it is NOT sized off real
// data, because no real name reaches this path at all (the longest name of any category in
// the bundled snapshot is 63 characters, under half the length limit). It is sized to
// bound damage: 26 names of 40,000 characters, 524 of 2,000, or 8,128 at the minimum
// over-threshold length, while costing at most ~2 MiB of characters.
//
// Accepted trade, and the reason it is acceptable: admission is first-come, so long names
// from a later file may go uncached while an earlier file's stay. Only malformed data
// reaches this path, the memory stays bounded either way, and the alternative that avoids
// it is the cliff above.
const MEMO_LONG_CHAR_BUDGET = 1048576

const _longCache = new Map<string, string>()
let _longChars = 0

export function normalizeSpeciesName(name: string): string {
  if (name.length > MEMO_MAX_KEY_LENGTH) {
    const longHit = _longCache.get(name)
    if (longHit !== undefined) return longHit
    const norm = stripTrailingParenthetical(name)
    // Admit only while the budget allows, or into an empty cache so that a single name
    // larger than the whole budget is still served rather than recomputed on every call.
    if (_longChars + name.length <= MEMO_LONG_CHAR_BUDGET || _longCache.size === 0) {
      _longCache.set(name, norm)
      _longChars += name.length
    }
    return norm
  }
  const hit = _normCache.get(name)
  if (hit !== undefined) return hit
  const norm = stripTrailingParenthetical(name)
  // Admission control, exactly as on the over-length path above. This cache ALSO evicted
  // FIFO once, and it had the same capacity+1 cliff for the same reason: past the limit
  // every call misses, deletes and re-inserts. At one name past the cap that measured
  // 2,469.8 ms against 14.6 ms for no cache at all — a cache 169x worse than not having
  // one — on ordinary 24-character names, needing only 0.75 MB of distinct name data.
  if (_normCache.size < MEMO_MAX_ENTRIES) _normCache.set(name, norm)
  return norm
}

// Cuts a name at its FIRST '(', regardless of whether that paren ever closes and
// regardless of where in the string it sits. Shared by the four CSV parsers
// (`parseEbird`, `parseLifeList`, `parseMLExport`, `parseBreedingCodes`), each of which
// carried its own private copy of this under the name `normalizeSpeciesName` — four
// functions that shadowed the import of that name while not being it.
//
// It is NOT `normalizeSpeciesName`, and the two are kept apart on purpose. Same posture,
// and for the same reason, as `isNonCountableSpecies` / `isNonCountableObservedName`
// below: collapsing a pair of near-identical predicates that answer different questions
// is a silent data-loss bug, so the names state the rules and the divergence is documented
// at one definition instead of implied by four private copies.
//
// Converging them onto `normalizeSpeciesName` was measured, and rejected. It changes
// output on 10,300 of 11,111 exhaustively enumerated malformed strings (92.7%) while
// changing 0 across the 58,104 strings in the bundled taxonomy snapshot — real names
// cannot discriminate the two at all, because every eBird name is well formed (at most one
// '(', always closed, always trailing). The direction is what settles it: this rule cuts
// MORE, so converging makes a malformed name LESS normalized ("Mallard (" stays "Mallard ("
// under `normalizeSpeciesName`, becomes "Mallard" here), which would split one corrupted
// cell into a second life-list row on four hot paths.
//
// Deliberately NOT memoized. It runs once per CSV row during parse, not ~12x per
// observation across the stats passes, so it has no repeat-call pressure to relieve —
// and a second unbounded Map keyed by raw names is the exact defect bounded above.
export function truncateAtFirstParen(name: string): string {
  const parenIdx = name.indexOf('(')
  if (parenIdx === -1) return name
  return name.slice(0, parenIdx).trim()
}

// Test-only introspection. Nothing in the app calls these; they exist so the memo's
// bounds can be asserted against the REAL exported `normalizeSpeciesName` rather than a
// copy of it, which is the only version of that test worth having.
//
// Unlike `regexSweepGuards.ts` and `cssTopLevelRules.ts`, which are test-only MODULES and
// so are never bundled, these sit in a module the app imports heavily — which would ship
// a mutable handle on the memo if they survived the build. They do not: verified against
// a fresh `npm run build` at v0.5.85, none of the four names appears anywhere in
// `dist/assets/` (the bundler drops an export no module imports), while the memo's own
// constants do. Re-check if this module ever gains a `/* @__PURE__ */`-hostile shape or a
// side-effectful top level, since both can defeat that. The bundler is rolldown, under
// Vite 8 — named here once, and described by role above, because it has already changed
// under this project and an earlier revision of this comment sent maintainers to rollup's
// documentation instead.
export function __normCacheForTests(): ReadonlyMap<string, string> {
  return _normCache
}

/** The over-length admission-controlled cache, so its character budget is asserted
 *  exactly rather than inferred from a wall clock. It never evicts; see the design note
 *  above. */
export function __longCacheForTests(): { entries: number; chars: number; keys: string[] } {
  return { entries: _longCache.size, chars: _longChars, keys: [..._longCache.keys()] }
}

export function __resetNormCacheForTests(): void {
  _normCache.clear()
  _longCache.clear()
  _longChars = 0
}

export const __MEMO_LIMITS_FOR_TESTS = {
  maxKeyLength: MEMO_MAX_KEY_LENGTH,
  maxEntries: MEMO_MAX_ENTRIES,
  longCharBudget: MEMO_LONG_CHAR_BUDGET,
} as const

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
