# Change Brief — species-name-normalizer-consolidation

## What is changing

`normalizeSpeciesName`'s memo gets a structural bound, and the four parsers' private
copies of a *different* function get extracted to one shared export — **renamed, not
converged.** The bound is two guards: skip caching a key over a length threshold, and cap
the entry count, evicting oldest-inserted through `Map`'s insertion order (O(1), no
per-hit bookkeeping, hit path untouched). Together they make retained bytes a constant
rather than a function of what the CSV contained. The extraction is a pure de-duplication:
four byte-identical private functions, all named `normalizeSpeciesName` while *not* being
it, become one export named for its actual rule (it cuts at the first `(` regardless of
closure or position) sitting beside the real one, with the divergence documented once.

## Why now

The roadmap's reasoning does not survive measurement. It calls the memo "bounded in
practice because `Map.set` stores a reference to a string the parsed-observation array
already holds" — true only while that array is alive. Once the user loads another file
the Map is the sole owner. Measured, every other reference dropped: **118 B/entry** at
realistic name lengths, **2,093 B/entry** at 2,000 characters (39.9 MB for 20,000 distinct
hostile names), and **26.5 MB across ten successive loads** of 20k disjoint names, 200,000
entries, none released. A slow leak, confirmed, never a denial of service (growth is
proportional to distinct names read, never amplifying) — but the mitigating reason expires
on the second file load, which is the long session the roadmap is describing.

## User-facing impact

None, and the consolidation half is deliberately shaped to keep it that way. Converging
the parsers onto the shared normalizer would change output on **10,300 of 11,111**
exhaustively enumerated malformed strings (92.7%) while changing **0** across 40,225
snapshot strings and 272 distinct demo-export names. The direction is what settles it: the
local rule cuts *more*, so converging makes malformed names *less* normalized (`Mallard (`
becomes `Mallard` today, `Mallard (` after), splitting one corrupted cell into a second
life-list row on four hot paths. Memo bound measured on the hot path: **4.1 ms vs 4.2 ms
over 240,000 calls**, interleaved and warm — no cost. (First run read 3.0 vs 4.0, a JIT
ordering artifact, which is why it had to be interleaved.)

## Design pass

Not needed — no visual change.

## Decisions touched

- **v0.5.83, "Hybrid life-list count"** (`DECISIONS.md:85`) — followed, not reversed. It is
  the precedent for the recommendation: two near-identical predicates keep **different
  names** plus a doc comment saying why, because collapsing them is a silent data-loss bug.
- **v0.5.85 `species-name-regex-bound`** — `speciesUtils.ts:39-42` says "Do not converge
  them without measuring what moves." This build is that measurement. Its
  `rejects the local parser variant` guard pins the divergence, stays green, points at
  the new export (`normalizeSpeciesNameParity.test.ts:184`).
- **Surfaced, not fixed:** those same parsers carry a private `isExcluded` testing the RAW
  name for `" x "`, dropping the exact 36 intergrades v0.5.83 corrected elsewhere (36 lost,
  0 newly dropped by converging). It moves life-list totals, so it went to the idea inbox.

## What done looks like

Retained bytes are bounded by a constant an operator can compute from the two limits, and a
test proves it by driving hostile input through the real exported `normalizeSpeciesName` and
asserting the Map exceeds neither bound — plus a correctness test that an evicted key
recomputes the same answer, and a hot-path guard measured as CLAUDE.md requires (repetition,
real margin, a distinct input per run so it cannot measure a cache hit). Size the length
threshold off the measured maximum: the longest name of any category in the bundled snapshot
is **63 characters** (p99 47, p50 21), so a real user reaches neither limit. Four copies
become one export whose name states its rule, so the divergence is documented at a single
definition instead of implied by four private functions that shadow the shared name — and
the parity suite still rejects substituting either function for the other.
