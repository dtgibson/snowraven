## species-name-regex-bound

### What this does

Replaces the regex in `normalizeSpeciesName` (`frontend/src/lib/speciesUtils.ts`)
with a linear scan.

`/\s*\([^)]*\)\s*$/` had every quantifier unbounded, so on input that never
completes the match the engine retried from each start position. Reproduced on the
current tree: **140 ms at 10k characters of `(`, 2,243 ms at 40k, exactly 4.00x per
doubling.** Names come from the user's own uncapped CSV export
(`parseEbirdObservations` stores `commonName` with no length cap) and are
normalized on the main thread inside consumer memos, so a long enough name froze
the UI. An earlier revision of this PR called it the **last** unbounded instance of
that shape in the frontend. That was wrong, and the security review caught it before
the bundle's release notes were written: the sweep behind the claim matched regex
literals, and measuring through real exported entry points instead finds five more
still reachable, all 4.00x-4.02x per doubling and 2,243-3,500 ms at 40k characters.
Two are in `commentBlocks.ts`, the file cited here as precedent; the worst is in
`commentText.ts`, reached from ChecklistComparer over eBird API comments, the only
one of the six supplied by an unrelated party. They are captured as follow-up work.
This build closes one real instance, and
it contradicted CLAUDE.md's own linear-by-construction rule, whose recorded
precedent (`commentBlocks.ts`, 4.1 s on a 400 KB hostile comment) is the same
defect on the same threat model.

Hardening, not an incident: the data is local-only and no real name comes close.
Longest string in the bundled taxonomy is **63 characters**, longest trailing
parenthetical **45 including the parens** (43 inside), and **no name contains more
than one `(`**.

**No version bump or changelog entry in this commit** — this is one build in a
bundled Spool release, and the bump happens once for the whole bundle.

### Files

- `frontend/src/lib/speciesUtils.ts` — the rewrite. Behavior is unchanged; the
  function it replaces is documented above it clause by clause.
- `frontend/src/lib/normalizeSpeciesNameParity.test.ts` — **new.** The differential
  parity sweep, the semantic statements, the countable-name asymmetry sweep, and
  the two guards that reject a revert.

### How to test

See `how-to-see.md`. Automated:

```
cd frontend
npx vitest run src/lib/normalizeSpeciesNameParity.test.ts src/lib/speciesUtils.test.ts
npm run lint
npm run build
```

### Notes for reviewer

**1. The rewrite is exact, and "exact" is the whole contract.**
`normalizeSpeciesName` has 23 non-test consumers — life-list counts, media
matching, Named Birds keys, the Calendar, county shading and completeness, Map
Explorer aggregates, `frivolousLists`, `speciesStats`, `birdingStats`. A shift on
any real name moves user-visible totals, so the bar is a differential sweep, not
review.

Zero divergences from the old pattern on:

| universe | strings | divergences |
|---|---|---|
| every string in `ebird-taxonomy.json` (keys and values, deep-walked) | 58,104 | 0 |
| exhaustive enumeration over a 10-symbol alphabet, lengths 0..4 | 11,111 | 0 |
| named malformed probes | 28 | 0 |

The exhaustive set is the interesting half. Its alphabet is `(`, `)`, a letter, and
five whitespace characters — space, tab, newline, U+00A0, U+2028, U+FEFF, U+3000 —
so it covers every arrangement of those up to length 4. U+2028 is the one that
earns its place: it is both `\s` and a LineTerminator, yet a non-multiline `$` does
**not** treat it as an end of input, so an implementation reaching for a line-aware
primitive would diverge there and nowhere else.

The frontend and backend snapshots were confirmed identical (58,104 strings each,
same set), so the sweep covers both.

**2. Both halves of the parity test are load-bearing, and the guard-the-guard
proves it.** Real names cannot discriminate. Every eBird name is well formed — at
most one `(`, always closed, always trailing — so **even the wrong implementation
scores 0 divergences across all 58,104 of them.** A snapshot-only sweep would have
passed on the parsers' local `indexOf('(')` variant. On the exhaustive probes that
same variant diverges **10,300 times**. `rejects the local parser variant` asserts
both numbers, so the suite states in its own body why it is shaped this way.

**3. The parsers' local variant was not copied, per the brief.** `parseEbird`,
`parseLifeList`, `parseMLExport` and — a fourth the brief does not list —
`parseBreedingCodes` each carry a private `normalizeSpeciesName` that cuts at the
first `(` regardless of closure or position. It looks like a ready-made answer and
is a different function: `Mallard (` becomes `Mallard`, `Mallard (hybrid) extra`
becomes `Mallard`. Those four are already linear, carry no performance defect, and
stay untouched. The divergence is now pinned in a test rather than left as a
comment, and noted at the definition site so converging them later is a deliberate
step rather than an accident.

**4. The countable-name asymmetry is unmoved, swept rather than spot-checked.**
`isNonCountableObservedName` calls this function on a *raw* name, and CLAUDE.md
records that its split is load-bearing: "fixing" the asymmetry is a silent
data-loss bug.

| | shipped regex | linear scan |
|---|---|---|
| non-spuh/slash names with a raw `" x "` | 818 | 818 |
| still excluded after normalization | 782 | 782 |
| countable intergrades kept | 36 | 36 |

Exactly the recorded 818 / 782 / 36. **Zero classification disagreements across all
58,104 snapshot strings**, so no life-list total moves anywhere.

Reconciling one figure, since it looked like a miss at first: sweeping *all* names
gives 825 / 788 / 37, not 818 / 782 / 36. The difference is the universe. CLAUDE.md
counts what the `" x "` half is *solely* responsible for, i.e. after spuh/slash has
already excluded its own — and exactly one intergrade
(`Common Tern (hirundo/tibetana x longipennis)`) carries a slash and so is caught
by the other half regardless. The recorded numbers are right; the test computes on
the same universe they do.

The split test compares old against new **computed live on both sides**, so it
stays exact across a taxonomy regeneration. A separate test pins the literal
818 / 782 / 36 and says in its failure message that tripping it means the snapshot
moved, not that this code broke — so a future regeneration surfaces as a prompt to
re-measure and update CLAUDE.md rather than letting those numbers go stale silently.

**5. The parity tests stay GREEN on a revert, which is why there are two more.**
They guard behavior, and behavior is unchanged. Following the same lesson recorded
in the `help-link-scheme-gate` PR earlier in this bundle:

- **Structural**, deterministic and unflakeable: no regex literal in either
  function body may carry an unbounded quantifier. This is deliberately *not* "no
  regex at all", which would also condemn a correct implementation using a
  quantifier-free `/\s/` per-character test. It is the property CLAUDE.md's rule
  actually names.
- **Timing**, four hostile shapes, min of five complete runs (the QA-41 pattern),
  ceiling 50 ms. Each run uses a distinct string via an inert leading letter run so
  the memo always misses — without that the guard would measure a cache hit.

The ceiling sits ~15,000x above what the scan costs and 12x to 46x below what the
regex costs: a gap no shared runner closes in either direction.

**6. Mutation-checked, in both directions.** Every mutation was applied to the real
source and the suite re-run.

| mutation | expected | result |
|---|---|---|
| M1 revert to the shipped regex | RED | RED (5) |
| M2 the parsers' local variant | RED | RED (9) |
| M3 length guard bolted onto the same regex | RED | RED (2) |
| M4 close paren no longer required to be last | RED | RED (5) |
| M5 opener taken as the first `(` in the string | RED | RED (4) |
| M6 the `openIdx === -1` check dropped | RED | RED (3) |
| M7 whitespace tested as `=== ' '` instead of `\s` | RED | RED (3) |
| G1 loop-based faithful scan using `/\s/` | GREEN | GREEN |
| G2 `charAt` close-paren test instead of `endsWith` | GREEN | GREEN |

M3 is the one worth pausing on. A length guard is the *other* shape this defect
could return in, and it is the option the brief weighed and rejected — capping the
input does not make the pattern linear, it just picks a constant. The structural
guard reddens on it.

The two GREEN rows are the half that is easy to skip. G1 is the loop-based scan I
wrote first, and it is what forced the structural guard to be about unbounded
quantifiers rather than about regexes: an earlier revision of this PR would have
rejected a correct implementation.

**7. The mutation matrix found a dead branch, and it was removed rather than
shipped.** The first implementation guarded `openIdx === -1 || openIdx >= closeIdx`.
M6 originally mutated away the `>= closeIdx` half and **no test went red** — because
that condition is unreachable: `indexOf` cannot return past the last index, and
cannot return `closeIdx` itself because that character is a `)`. A branch no test
can reach is a branch a future reader cannot evaluate, so it is gone and the reason
is recorded at the line. M6 now mutates the surviving check and correctly reddens.
Every remaining line of the function is load-bearing.

**8. Measured, on the current tree.** Min of five complete runs.

| shape | n | shipped regex | growth | linear scan | growth |
|---|---|---|---|---|---|
| `"(" * n` | 5,000 | 35.06 ms | — | 0.0003 ms | — |
| | 10,000 | 139.96 ms | 3.99x | 0.0002 ms | 0.63x |
| | 20,000 | 559.98 ms | 4.00x | 0.0002 ms | 1.00x |
| | 40,000 | 2244.33 ms | 4.01x | 0.0002 ms | 1.20x |
| `" " * n + "(" * n` | 1,250 | 9.31 ms | — | 0.0008 ms | — |
| | 2,500 | 36.93 ms | 3.97x | 0.0014 ms | 1.70x |
| | 5,000 | 148.04 ms | 4.01x | 0.0026 ms | 1.82x |
| | 10,000 | 592.31 ms | 4.00x | 0.0049 ms | 1.90x |

4.00x per doubling versus ~1.9x: quadratic to linear. The second shape is the one
the brief flagged as worse than the original idea reported, and it reproduces: at
n=2,500 the leading whitespace run costs 36.93 ms where the same count of bare
parens costs about 9 ms, because the leading `\s*` adds a second backtracking
dimension.

Pushed past anything the regex can reach, the scan holds linear: on the shape that
forces all four passes it is 0.0488 ms at 100k characters, 0.0974 at 200k, 0.1683
at 400k and 0.3900 at 800k.

**One honest qualification.** The scan is not uniformly faster — it is *bounded*.
On shapes the regex matches cheaply, both are sub-millisecond and the regex can
edge ahead (120,001 characters of the all-passes shape: regex 0.0513 ms, scan
0.0588 ms). On a real 63-character name the two are indistinguishable at 0.0002 ms.
The win is that there is no longer any input for which this function is slow.

**9. The memo is unbounded, and is deliberately not fixed here.** The cache is
keyed by the raw name with no cap, so it makes a *repeated* hostile name free but
not many *distinct* ones, and it grows without limit on hostile input. That is
pre-existing and is separate scope — flagged for capture, not changed. The stale
claim next to it ("bounded by the number of distinct raw names (small)") stated as
a property of the code something that is only true of real data, so the comment now
says what is actually guaranteed. Comment only; no behavior change.

**10. No published prose needed updating, and this was checked rather than
assumed.** Grepped `docs/HELP.md`, `README.md`, `website/index.html`,
`PRIVACY_POLICY.md` and `ACCESSIBILITY.md` for `normaliz`, `subspecies`,
`parenthetic`, `intergrade`, `hybrid`, `countable`. Nothing describes the
normalization mechanism. What the prose *does* describe is the rule this function
feeds — subspecies folding into the parent, and spuh/slash/hybrid exclusion — and
`docs/HELP.md` states the intergrade case by name twice (lines 163 and 271:
"An intergrade between two subspecies, like `Northern Flicker (Yellow-shafted x
Red-shafted)`, is not a hybrid in this sense: it counts"). That sentence is exactly
what note 4 sweeps, and that exact name is one of the four in the
`keeps the named intergrades` test, so the published claim is now pinned by a test
rather than merely still true.

### Verification run

- `npx vitest run src/lib/normalizeSpeciesNameParity.test.ts src/lib/speciesUtils.test.ts`
  — 36 passed.
- Direct consumers (`birdingStats`, `calendar`, `speciesStats`, `countyShading`,
  `countyCompleteness`, `mediaStats`, `namedBirds`, `nearbyLifers`,
  `frivolousLists`, `namedBirdMedia`) — 300 passed.
- `npm run test` (full suite) — **156 files, 2,111 tests, all passing**, no flakes.
- `npm run lint` — clean.
- `npm run build` — clean (`tsc -b && vite build`). The only warning is the
  pre-existing `chunkSizeWarningLimit` note CLAUDE.md documents.
