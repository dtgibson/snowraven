## Superlinear regex sweep

### What this does

Six regexes reachable through real exported entry points were quadratic in their
input. Each is now a linear scan, and each rewrite is proven byte-identical to the
pattern it replaced rather than argued to be.

| # | entry point | pattern | file | before (40k) | after |
|---|---|---|---|---|---|
| 1 | `stripWeatherTideBlocks` | `/(?:[ \t]{2,}\|\r?\n)(?=\S)/g` | `lib/commentBlocks.ts:204` | 3,499 ms | 0.9 ms |
| 2 | `normalizeCountyName` | `/\s+(county\|parish\|…)$/` | `lib/countyBoundaries.ts:129` | 2,496 ms | 0.1 ms |
| 3 | `parseAgeSex` | `/^(.*?)\s*[–—-]\s*(\d+)\s*$/` | `lib/mediaStats.ts:39` | 2,495 ms | 0.9 ms |
| 4 | `commentSegments` | `/[.,;:!?]+$/` | `lib/commentText.ts:49` | 2,781 ms | 0.1 ms |
| 5 | `extractChecklistId` | `/\/+$/` | `lib/checklistId.ts:4` | 2,246 ms | 0.5 ms |
| 6 | `hasSnowravenWeatherBlock` | `/<[^>]*>/g` | `lib/commentBlocks.ts:104` | 2,274 ms | 0.1 ms |

All six measured 3.99x-4.01x per doubling before and ~2x after, through the real
entry points rather than the literals. Impact was a main-thread freeze of the
user's own tab: no data disclosure, no server, hardening rather than an incident.

**The sweep found six, not the five on record.** Re-deriving it instead of working
from the roadmap list surfaced `countyBoundaries.ts:129`, which is the most
amplified of the set: it runs once per observation from `countyShading` and
`countyCompleteness` over the CSV `County` column, which the parser does not cap.
That is the v0.5.84 instruction (`speciesUtils.ts`: "do not restate the sweep as
finished; re-derive it when you write the claim") doing exactly what it was
written to do.

`commentText.ts:49` was the priority and is the only one of the six an **unrelated
party** supplies: ChecklistComparer renders `<CommentText raw>` over comments
returned by the eBird API. The other five need the user's own file or paste.

### User-facing impact

None. Every rewrite is output-identical on real data. The only observable
difference is that a pathological cell or comment stops freezing the tab.

### How to test

`cd frontend && npx vitest run` and `npm run build`. The six guards are in
`lib/commentBlocksRegexBound.test.ts` (sites 1 and 6),
`lib/countyNameRegexBound.test.ts`, `lib/parseAgeSexRegexBound.test.ts`,
`lib/commentTextRegexBound.test.ts` and `lib/checklistIdRegexBound.test.ts`.
`pipeline/superlinear-regex-sweep/how-to-see.md` has the manual walkthrough.

### Notes for reviewer

**Output identity is proven both ways, per site.** Real inputs here are well
formed and cannot discriminate a correct rewrite from a wrong one, so each site
carries a corpus sweep *and* an exhaustive enumeration over an alphabet built
from what that function actually branches on (37,449 / 16,105 / 111,111 / 37,449
/ 19,608 / 21,845 probes). Each also names a plausible **wrong** implementation
and proves the probe set rejects it.

That second half is not ceremony. The corpora turned out to be largely unable to
discriminate, and the numbers are asserted in the suites so the tests say why
they are shaped this way:

- the demo export contains **no URLs at all** across 3,053 non-empty comment
  fields, and **no weather blocks**, so sites 1, 4 and 6 have essentially no real
  corpus; the formatter-built fixtures are the real corpus they do have;
- TIGER's county `NAME` field is **bare** ("Juneau"), and the demo `County`
  column's ten values are bare too, so a 7,869-value sweep of real data exercised
  site 2's changed branch **exactly zero times**. The committed corpus
  reconstructs the other side of the join (every bundled name with each
  administrative suffix, 22,057 strings), which is what eBird actually writes
  into that column;
- no Macaulay `Age/Sex` value contains a newline, so site 3's named wrong
  implementation scores **zero divergences** on the entire real value space.

**Site 3 carried the real behavioural risk and was not rewritten by inspection.**
`.` excludes line terminators, so `(.*?)` cannot reach *across* one: `"Adult\nx -
3"` never matched and counted as one individual, while a naive right-to-left scan
matches it and silently recounts the row. The equivalence is derived from the
pattern (the tail must decompose as whitespace/digits/whitespace, none of which
contains a dash, so the only candidate is the **last** dash) and the asymmetry is
proven differentially in both directions: the newline-before-the-class case must
still fail, and the newline-*after*-the-class cases that always matched must still
match.

**The four-test guard, with one deliberate substitution.** CLAUDE.md specifies
structural / timing / parity / headroom for a *bound* guard. None of these six
introduces a bound or a constant; each is a scan that is exact at every length, so
a headroom assertion could not fail. That slot is taken by **non-vacuity** instead,
and the reasoning is recorded in `regexSweepGuards.ts` rather than left implicit.
Inventing a headroom test to keep the count at four would have been a test that
cannot go red.

**Verified by actually reverting.** Each site was reverted locally in place and its
suite re-run. Every site turns its structural guard, its structural guard-the-guard
and its primary timing test RED, and leaves every parity test GREEN, which is the
contract.

That check earned its keep: it caught **five timing fixtures, across sites 2
through 5, that passed on the broken build**. A greedy quantifier that swallows the
hostile run and then matches never backtracks, so `' '.repeat(40000) + 'borough'`
runs in 0.0 ms under the very pattern that takes 2,501 ms on
`' '.repeat(40000) + 'boroughx'`. Sites 2 and 3 gained near-miss replacements that
do go red, and **four** tests (one per site, 2 through 5) keep a success-path
fixture as coverage while saying in their own comments that they cannot reject a
revert, and naming the test that can.

**One guard gap closed after the Tester's pass.** Deleting `ch === ' '` from
`isLineTerminatorChar` left the whole 1,550-test `src/lib` suite green: the shipped
behaviour was right, but U+2028 and U+2029 are separate members of that predicate
and only U+2028 was in site 3's probe alphabet, so a probe set holding one could
not kill the deletion of the other. U+2029 is now in the alphabet (177,156 probes,
up from 111,111) and in the named probes, and the mutant was re-run and dies in
both tests. This matters specifically because `isLineTerminatorChar` is the one
helper of the three in `charClasses.ts` that cannot delegate to a quantifier-free
regex, so it is the one that can drift.

**Scope, re-derived at the moment of writing rather than restated.** The sweep was
re-run over `frontend/src`: every regex literal carrying an unbounded quantifier
with something that can fail after it was measured through its real path at
10k/20k/40k. Everything remaining is linear (~2x per doubling), including the
already-bounded `ATTRIB_END_RE` and `NAME_TAG_RE`, the `^…$` guards whose anchor
pins the backtrack to one start position, and the `/^[ \t]+$/gm` line scan whose
`^` limits it to one start per line. Sibling patterns on all six paths were
measured too, so "bound the whole path" is evidence rather than argument. This is a
measurement with a date on it; the stale "five" claims in `ROADMAP.md`,
`CLAUDE.md` and `speciesUtils.ts` are corrected, and none of them now says the
sweep is finished.

**One pre-existing quirk surfaced and deliberately left alone.**
`extractChecklistId('https://ebird.org/checklist/S12345678/?foo=1')` returns `''`,
because the slash strip runs before the `?` split. Identical on both sides of this
change, so it is pinned by a test rather than fixed in a build whose contract is
byte-identity. Flagged for the roadmap.

**New files.** `lib/charClasses.ts` (`isWsChar` / `isAsciiDigitChar` /
`isLineTerminatorChar`, extracted because three modules needed the whitespace test
at once, which is this repo's threshold for a shared helper) and
`lib/regexSweepGuards.ts` (test-only, imported by no app module and verified absent
from `dist/`).

## Convention Flags

- A rewrite that replaces a quantified pattern with a scan has no constant, so a
  bound guard's headroom test is vacuous there. Put non-vacuity in that slot: proof
  that the probe set rejects a named, plausible, wrong implementation. Do not invent
  a headroom assertion that cannot fail in order to keep the count at four.
- A timing fixture only guards linearity if the old pattern actually *failed* on it.
  A fixture where the match succeeds at the first start position was never quadratic
  and will certify a broken build. Build the input so the pattern fails after
  consuming the hostile run, and prove it by reverting locally. Where a success-path
  fixture is kept as coverage, say in its comment that it cannot reject a revert and
  name the test that can.
- Where a corpus sweep cannot reach the changed branch, reconstruct the corpus that
  does rather than reporting the vacuous pass, and assert both numbers (real data
  diverges zero times, probes do discriminate) so the test states why it is shaped
  that way.
- Exotic whitespace in a probe alphabet (U+00A0, U+2028, U+2029, U+3000, U+FEFF)
  must be written as `\uXXXX` escapes in source. Literal characters are invisible and
  were silently flattened into ordinary spaces three times while writing this build,
  which would have left the alphabet quietly weaker with every test still green.
- A per-character test for a regex character class should delegate to a
  quantifier-free single-character regex (`/\s/`, `/\d/`) rather than a hand-written
  comparison, so the set cannot drift from the pattern it replaces.
