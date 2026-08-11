# Change Brief — species-name-regex-bound

## What is changing

`normalizeSpeciesName` (`frontend/src/lib/speciesUtils.ts:10`) strips a trailing
parenthetical with `/\s*\([^)]*\)\s*$/`. Every quantifier is unbounded, so on input
that never completes the match the engine retries from each start position: measured
**140.38 ms at 10k chars of `(`, 2,243 ms at 40k, exactly 4.00x per doubling**, which
extrapolates to the reported ~14 s at 100k. Reproduced on the current tree. A leading
whitespace run makes it worse — `' '*n + '('*n` costs 36 ms at 2,500 chars where bare
parens cost 9 ms, because the leading `\s*` adds its own backtracking dimension.
Replace the regex with a hand-rolled linear scan (`endsWith`/`lastIndexOf`), keeping
the memo. Recommendation and evidence in *What done looks like*; the three parsers'
own local copies are already linear and are NOT in scope (see *Blast radius*).

## Why now

Found by the v0.5.83 security audit, saved as an idea. Pre-existing and local-only
(the user's own export, no server, no other party's data), so this is hardening, not
an incident. **Corrected after the security review: this is NOT the last instance of
the shape in the frontend.** The sweep behind that claim matched literals; measuring
through real exported entry points found five more superlinear regexes still reachable
(two in `commentBlocks.ts`, the worst in `commentText.ts` over eBird API comments), all
at the same 4.00x-per-doubling cost profile. It contradicts CLAUDE.md's own linear-by-construction
rule for regexes over untrusted text, whose recorded precedent (`commentBlocks.ts`,
4.1 s on a 400 KB hostile comment) is the same defect on the same threat model.

## User-facing impact

**None, and this is measured rather than assumed.** Sweeping all 58,104 distinct
strings in the bundled taxonomy snapshot, a faithful scan and a length guard each
produce **0 divergences** from the shipped regex. Real maxima that bound the problem:
longest species name **63 chars** (`American Herring/Vega/European Herring x Glaucous
Gull (hybrid)`), longest trailing parenthetical **43 chars**, and **at most one `(`
in any name**. `frontend/src/assets/ebird-taxonomy.json` and
`backend/staticdata/ebird_taxonomy.json` are identical on all three figures. No real
name is anywhere near a plausible bound, and none can trigger the backtracking at all.

## Design pass

Not needed — no visual change. This is a pure-function internal rewrite with output
identical on every real name; nothing about what renders, or how, changes.

## Decisions touched

- **"The `[name:…]` regex is length-bounded" (v0.5.66 Named Birds, DECISIONS.md).**
  The direct precedent: same shape, same threat model (uncapped user CSV text parsed
  synchronously on the main thread), same reasoning. Followed and completed, not reversed.
- **"Regex hygiene as policy" (v0.5.27 Checklists, DECISIONS.md).** Establishes
  linear-by-construction as a standing rule; this closes the last frontend violation.
- **"A life-list COUNT must exclude spuh/slash/hybrid" (v0.5.38)** and **the
  countable-name asymmetry (v0.5.83)**. `isNonCountableObservedName` calls
  `normalizeSpeciesName` on a *raw* name, so its 782-vs-36 hybrid/intergrade split
  depends on this function's exact output. Binding constraint, not a reversal: if the
  rewrite shifted any real name's normalization it would silently move life-list totals.

## Blast radius

`normalizeSpeciesName` has **23 non-test consumers** — life-list counts, media
matching, Named Birds keys, the Calendar, county shading and completeness, Map
Explorer aggregates, `frivolousLists`, `speciesStats`, `birdingStats`. Any output
change for a real name moves user-visible totals, which is why the bar is a
differential sweep rather than spot checks. **Exposure path:**
`parseEbirdObservations.ts:97` stores the raw `commonName` with no normalization and
no length cap; its worker only parses, so all normalization runs on the **main
thread** in consumer memos. The memo (keyed by raw name, unbounded `Map`) means cost
is paid once per *distinct* name, not per call — it caps a repeated hostile name but
not many distinct ones, and the cache itself grows unbounded on hostile input.

## What done looks like

1. **Prefer the scan over the length guard.** It is faster (0.006 ms vs 0.069 ms vs
   2,243 ms shipped, at 40k), needs no constant to justify or structurally pin, and is
   linear *by construction* rather than merely bounded input. The guard is the fallback
   if the scan cannot reproduce some case.
2. **A differential parity test is the mechanism, not review.** Assert scan == old
   regex across all 58,104 snapshot strings **plus** a malformed probe set. Both are
   required: real names alone cannot discriminate, since the three parsers' looser
   local copies also score 0 divergences there.
3. **Trap — do not copy the parsers' `indexOf('(')` version.** It slices at the first
   paren regardless of closure or position and diverges on 4 probes
   (`Mallard (` → `Mallard`, `Mallard (hybrid) extra` → `Mallard`). The scan must honor
   the `$` anchor, the closing `)`, and `[^)]*`. Use the `\s` whitespace class, not `=== ' '`.
4. Timing guard proving no superlinear growth; no output change on any real name.
