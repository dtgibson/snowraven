# species-name-normalizer-consolidation

## What this does

Two independent changes to `frontend/src/lib/speciesUtils.ts` and the four CSV parsers,
neither of which moves a single user-visible name, count or total.

**1. `normalizeSpeciesName`'s memo is bounded.** It was keyed by the raw name, uncapped,
and never cleared. It is now two limits plus a single slot, so retained bytes are a
constant an operator can compute instead of a function of what the CSV contained.

**2. Four private copies of a different function became one shared export.** `parseEbird`,
`parseLifeList`, `parseMLExport` and `parseBreedingCodes` each carried a private function
*named* `normalizeSpeciesName` that shadowed the import of that name while not being it: it
cuts at the first `(` regardless of closure or position. The four are now one export,
`truncateAtFirstParen`, named for its rule and sitting beside the real normalizer.
Deliberately **extracted, not converged** — see below.

## The memo bound

The roadmap's reasoning for leaving it uncapped was wrong in a load-bearing way, and the
entry has been corrected rather than deleted. It called the memo "bounded in practice
because `Map.set` stores a reference to a string the parsed-observation array already
holds". That is true only while that array is alive, and it is not alive after the user
loads a second file. Measured with every other reference dropped: 118 B/entry at realistic
lengths, 2,093 B/entry at 2,000 characters, and 26.5 MB across ten successive loads of 20k
disjoint names (200,000 entries, none released). A slow leak, confirmed, never a denial of
service — growth is proportional to distinct names read and never amplifies.

| Limit | Value | Justification |
|---|---|---|
| `MEMO_MAX_KEY_LENGTH` | 128 | 2.03x the measured maximum. The longest string of any category in the bundled snapshot is **63** chars (p99 47, p50 21, mean 22.9); zero of 58,104 exceed it. Sized as a multiple rather than at the maximum so a taxonomy revision that lengthens names cannot silently push a real species onto the uncached path. |
| `MEMO_MAX_ENTRIES` | 32,768 | 1.83x the **17,891** distinct all-category names in the snapshot, so a user who had recorded every taxon on earth still evicts nothing. |

**The bound is stated structurally, not as a byte figure**, and that is a correction the
Tester caught rather than something I got right first time. The guarantee is four exact
facts: the Map holds at most `MEMO_MAX_ENTRIES` entries, no key in it exceeds
`MEMO_MAX_KEY_LENGTH` characters, no over-length key is in it at all, and over-length names
live in a separate cache bounded at `MEMO_LONG_CHAR_BUDGET` characters.

My first version instead asserted `32,768 x 172 B < 6 MiB` from a heap measurement on this
machine; independent measurement put the worst case at 208 B/entry, so that assertion stated
a ceiling the true worst case exceeds *and passed anyway*. The replacement scale figure was
then wrong a second time, for the reason the paragraph itself names: it was measured with
ASCII keys only. V8 stores one-byte and two-byte strings differently and a hostile key set
picks the expensive one.

For scale only, naming the representation each end assumes:

| Key character set | B/entry | At the cap |
|---|---|---|
| ASCII (one-byte) | ~173 | ~5.4 MiB |
| non-Latin1 (two-byte) | ~300 | ~9.4 MiB |

Both are small fixed ceilings and neither is the guarantee. A user with the entire eBird
taxonomy recorded fills roughly half the entry limit and evicts nothing.

### The two caches, and two designs that failed review

Skipping the memo for an over-length key turns a bounded-memory fix into an **unbounded-CPU**
one, so both caches exist to avoid that. Both reached their final shape by failing security
review first, in the same way, and the second failure is the instructive one.

**Round 1: the over-length path was a single slot.** A one-entry cache has a 100% hit rate
on one repeated key and a 0% hit rate on two alternating keys, and I measured only the
first. Two alternating 40,000-character names cost **3,493.7 ms** against the uncapped Map's
2.4 ms: 1.048x the skip-only implementation the slot existed to avoid.

**The rule that followed: a fixed-size cache's performance claim must be measured at
CAPACITY PLUS ONE.** At capacity it never evicts and every measurement is a hit.

**Round 2: I wrote that rule into the source and applied it to one of the two caches.** The
short cache kept evicting FIFO at 32,768 entries, fifteen lines below the comment stating
the rule. It was the more reachable defect of the two: no exotic cell sizes, just 32,769
distinct ordinary names, which is **0.75 MB of name data** in a CSV well under 5 MB, and a
column-misalignment corruption landing `commonName` on a timestamp or comment column
produces tens of thousands of distinct values immediately.

Both caches now use **admission control**: fill to the limit, then stop admitting, never
evict. Measured through the real module, min of 3 interleaved rounds with rotating start
order.

Short cache, 24-character names (snapshot mean is 22.9), 240,000 calls:

| Distinct names | **shipped (admission)** | FIFO evict | no cache | uncapped (HEAD) |
|---|---|---|---|---|
| 32,767 (capacity - 1) | 11.0 ms | 13.8 ms | 15.5 ms | 11.1 ms |
| 32,768 (capacity) | 11.8 ms | 14.1 ms | 13.5 ms | 10.9 ms |
| **32,769 (CAPACITY+1)** | **16.4 ms** | **2,544.9 ms** | 15.2 ms | 12.1 ms |
| 65,536 (2x capacity) | 22.3 ms | 2,601.8 ms | 13.9 ms | 18.2 ms |

Long cache, 40,000-character names, 240,000 calls:

| Workload | **shipped (admission)** | FIFO evict | single slot | skip-only | uncapped |
|---|---|---|---|---|---|
| 1 repeated name | **2.4 ms** | 2.4 ms | 1.5 ms | 3,461.5 ms | 2.2 ms |
| 2 alternating names | **3.0 ms** | 3.0 ms | **3,493.7 ms** | 3,621.7 ms | 2.9 ms |
| 26 rotating (capacity) | **22.4 ms** | 22.3 ms | - | 4,617.0 ms | 22.3 ms |
| **27 rotating (CAPACITY+1)** | **142.9 ms** | **4,797.8 ms** | - | 4,605.0 ms | 23.0 ms |

I did not adopt round 1's recommended remediation unmodified. It proposed a character-budgeted
FIFO and measured it at 8 rotating names against a capacity of 26 — below capacity, the same
class of measurement that let the slot through. Round 2 of the review retracted it: at
capacity+1 that FIFO collapses to 4,585 ms where admission control reads 155 ms.

### The sweep

Every bounded structure in the module, checked at capacity+1 rather than asserted about.
There are exactly **two**, and both now carry a capacity+1 guard:

| Structure | Bound | At capacity | At capacity+1 | vs no cache |
|---|---|---|---|---|
| `_normCache` (entry-capped) | 32,768 entries | 11.8 ms | **16.4 ms** | 1.08x |
| `_longCache` (char-budgeted) | 2^20 characters | 12.1 ms | **11.4 ms** | 0.38x |

Saturation verified structurally: the short cache stops at exactly 32,768 entries, the long
cache at 8,128 entries / 1,048,512 characters against its 1,048,576 budget.

Neither is ever much worse than not caching, which is the property that actually matters and
the one both defects violated (the FIFO short cache was 167x worse than no cache). Honest
residual: past twice capacity the short cache costs ~1.60x no-cache, a failed Map lookup per
miss. A small constant, not a cliff, and no real dataset reaches it.

**Memory, both structures.** Short cache: at most 32,768 keys of at most 128 characters.
Long cache: at most 2^20 characters of keys, or one name when a single name exceeds the whole
budget (admitted into an empty cache so a huge repeated value is still served). Values are
`.slice()`s of their keys and share that storage, which is why the budget charges keys only.

**Accepted trade, carried on both paths:** admission is first-come, so a later file's names
can go uncached behind an earlier file's. Cheap on both — an unadmitted short name recomputes
a scan bounded at 128 characters, and only malformed data reaches the long path at all.

**Wider sweep, for the record.** Four other bounded structures exist in the frontend, all
pre-existing and outside this build's scope: `countyCompletenessCache.ts` (250 entries / 4 MB,
`order.shift()`), `replayStore.ts` (300 entries / 3 MB), `storage.ts` (byte-cap eviction), and
the unbounded module caches in `persistedStyle.ts` and `nominatimService.ts`. The three
evicting ones share this shape but not the exposure: each is network- or storage-backed, so an
eviction per call is invisible against a fetch, where `normalizeSpeciesName` runs ~12x per
observation on the main thread. Flagged, not changed.

### Hot-path cost

Measured **interleaved**, alternating order every round, min of 12 rounds, 240,000 calls over
500 distinct real names: **3.52 ms bounded vs 3.30 ms unbounded**, about 0.9 ns per call for
the length compare. Interleaving is not a formality here — an A-then-B run reads 3.0 vs 4.0
and reverses the sign, a JIT ordering artifact rather than a cost.

## The extraction, and why converging was rejected

Converging the parsers onto `normalizeSpeciesName` was measured and rejected. Real names
cannot discriminate the two functions at all: **0 divergences across all 58,104 snapshot
strings**, because every eBird name is well formed (at most one `(`, always closed, always
trailing). The probes are the entire discriminating power: **10,300 of 11,111** enumerated
malformed strings, 92.7%.

The direction is what settles it. Restricted to strings containing a `(`,
`truncateAtFirstParen`'s result is always a **prefix** of `normalizeSpeciesName`'s (0
exceptions over 3,730 probes, strictly shorter on 3,286). It cuts *more*, so converging
would make malformed names *less* normalized (`Mallard (` stays `Mallard (` under the
normalizer, becomes `Mallard` here), splitting one corrupted cell into a second life-list
row on four hot paths.

One nuance worth stating, because the headline 10,300 overstates it if read carelessly: the
other 7,381 probes carry no `(`, and 7,014 of those differ **by trimming alone** — the
no-paren branch returns its input untouched. The suite asserts both halves separately.

That untrimmed branch **is reachable**, which is a correction to my first draft (it claimed
"unreachable from every shipped call site"). It is exactly true for `parseBreedingCodes`,
which trims and stops. The other three trim and *then* strip surrounding quotes
(`.trim().replace(/^"|"$/g, '')`), and stripping a quote exposes whitespace the earlier
trim could not see: `parseCSVLine` unescapes CSV `"""  Mallard  """` to the field value
`"  Mallard  "`, `.trim()` does nothing because the quotes are the outer characters, and
the unquote then yields `  Mallard  `. Verified by reading the parser rather than assumed.
This **strengthens** the case against converging rather than weakening it — the branch is
live on three of the four parsers, so converging would change stored names on real cells
rather than only on unreachable ones. The conclusion stands; only the reach of the claim
was wrong.

## How to test

No user-visible behavior changes, so the meaningful verification is the suite plus a
normal-use smoke test. `pipeline/species-name-normalizer-consolidation/how-to-see.md` has
the step-by-step.

```
cd frontend && npx vitest run          # 163 files, 2,211 tests
cd frontend && npm run build           # the real gate: tsc -b && vite build
cd frontend && npm run lint
cd backend  && ./.venv/bin/python -m pytest tests/ -q
```

## Notes for reviewer

- **Relocation proved, not reasoned about.** Per CLAUDE.md's rule for a refactor that
  relocates code, all four pre-change copies are reproduced verbatim in
  `truncateAtFirstParen.test.ts` as differential oracles and swept against the new export:
  0 divergences on the snapshot, the 11,111 probes, and the named probes. Three copies were
  byte-identical; `parseBreedingCodes` used a ternary, so it is carried as a separate
  oracle rather than assumed equivalent. The parser diffs are exactly one import added, one
  private function removed, and the call sites renamed — nothing else moved.

- **`isExcluded` was deliberately left alone.** The same four parsers each carry a private
  `isExcluded` testing the RAW name for `" x "`, which drops the same 36 countable
  intergrades v0.5.83 corrected elsewhere. That moves visible life-list totals, so it is
  its own build and is in the idea inbox. It is untouched here.

- **The probe alphabet moved to `regexSweepGuards.ts`** so this suite and
  `normalizeSpeciesNameParity.test.ts` share one definition. It is the entire
  discriminating power of both, and its exotic members have been flattened to ASCII spaces
  in transit three times during the previous build — **it happened again while writing
  this one**: the first attempt at the shared constant silently turned U+00A0 and U+2028
  into ordinary spaces, leaving an eight-symbol alphabet with two duplicates. That is why
  `truncateAtFirstParen.test.ts` now pins the ten code points directly rather than trusting
  that they were written down correctly. (A second, separate slip in the same constant
  wrote `\\t` where `\t` was meant, which is over-escaping rather than flattening; the
  code-point assertion catches both, and did.)

- **The `rejects the local parser variant` guard now aims at the shipped function.** It
  previously compared against a copy written out in the test file, because the real thing
  was four private functions with no export to reach. It imports `truncateAtFirstParen`
  now, which makes it a guard rather than a description.

- **Test-only exports do not ship.** `__normCacheForTests`, `__resetNormCacheForTests`,
  `__longCacheForTests` and `__MEMO_LIMITS_FOR_TESTS` sit in a module the app imports
  heavily, so they would otherwise ship a mutable handle on the memo. Verified against a
  fresh build: none of the four names appears anywhere in `dist/assets/`, while the memo's
  own constants do.

- **A timing guard was considered and rejected for two claims**, and the tests say so in
  their own comments. The LRU and thrashing defects sit 3.54x and 9.77x from the shipped
  path, and the slot's gap is 15.5x; CLAUDE.md is explicit that 2x is not margin and the
  repo's existing guards sit 30x to 15,000x from their defects. Insertion order and slot
  occupancy are exact, so both are asserted exactly instead.

- **This build failed security review twice, and the second failure is the more
  instructive one.** Round 1 was the over-length slot; round 2 was the same rule going
  unapplied to the short cache, fifteen lines below where I had just written it down. A
  rule discovered in review has to be applied to every instance in the module, not only
  the one that failed, which is what the sweep above is. See "The two caches" above. Two smaller
  review findings closed in the same pass: the retained-bytes scale figure now names the
  string representation it assumes (it had been measured on ASCII only, and two-byte keys
  exceeded the stated range by a third), and a comment attributing dead-code elimination to
  rollup now names rolldown, since it was sending maintainers to the wrong tool's docs.

- **I did not adopt the recommended remediation unmodified, and the reason is the finding
  itself.** The review proposed a character-budgeted FIFO and measured it at 8 rotating
  names against a capacity of 26 — below capacity, which is the same class of measurement
  that let the single slot through. At capacity+1 the FIFO measures 4,797.8 ms, no better
  than not caching. Admission control is identical below capacity and 34x, 11x and 85x
  better at capacity+1 on the three workloads tested. Both axes proven above.

- **`!== undefined` on both hit tests now has a guard rather than a compliment.** Round 1 of
  the review praised it as load-bearing and it went two more rounds unguarded, which is its
  own small lesson. Truthiness mutants are real, not equivalent: `normalizeSpeciesName('(abc)')`
  is `''` from a five-character name, and on the long path the mutant re-charges `_longChars`
  every call until admission closes permanently and the cache is silently dead for the
  session. Two exact assertions, no wall clock — one seeds the cache with a value a recompute
  could not produce (so "served from cache" is observable at all), the other pins the
  accounting variable separately from the contents. Each turns exactly its own mutant red.

- **Mutation matrix: 25 mutations, all RED, none survived.** Enumerated in full so the
  count is checkable against the matrix rather than asserted:

  *Short cache (6):* whole bound reverted; entry cap never fires; hit path reorders (LRU
  touch); **short cache evicts FIFO again** (the round-2 defect, red on 6 tests); short
  cache admission removed; **hit test becomes truthiness**.
  *Limits (2):* entry cap lowered to 64; key limit lowered to the bare measured 63.
  *Long cache (8):* key limit never fires; long cache removed (skip-only); **single slot
  restored** (the round-1 defect, so it cannot silently return); long admission control
  removed; budget accounting neutered; huge-single-name escape removed; budget shrunk
  below two names; **hit test becomes truthiness**.
  *Extraction (4):* converged onto the normalizer; no-paren branch trims; cuts at the last
  paren; cut branch stops trimming.
  *Probe alphabet (5):* flattened to spaces; probe depth 4 to 3; `)` dropped from the
  alphabet; flattened **with the code-point pin deleted**; one member flattened with the
  pin deleted.

- **One assertion of mine was wrong and is worth flagging as a near-miss.** I first wrote
  the direction guard as "`truncateAtFirstParen` is never longer than `normalizeSpeciesName`
  on any probe". That is false — on a paren-free whitespace-padded name it is longer,
  because the no-paren branch does not trim. The test now states the true property
  (prefix-on-paren-strings, trim-only-otherwise) with both counts pinned.
