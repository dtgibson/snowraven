# Decisions — named-birds-audio-and-docs-sweep

## 2026-08-04 — Stage re-entry to Stage 1 (The Evaluator)

**Trigger.** The live desktop preview before the deploy sign-off. The user
reported that the Named Birds tab shows "No media matched to this bird." for
every named individual, despite having photos of those birds.

**Diagnosis (verified against the user's own local export).** Both named
individuals in the user's data carry `[name:...]` tags, and all 15 of their
Macaulay assets are present in the ML export. Every one of those assets carries
the name tag **only in `Observation Details`** — the exact field
`computeNamedBirdMedia` deliberately excludes. `Caption` and `Media notes`, the
two fields the matcher reads, are empty on all 15.

**The inconsistency.** `computeNamedBirds` discovers a named individual by
parsing `[name:...]` out of the species comment (`Observation Details`). The
media matcher then refuses to read that same field, so the tag that creates a
named bird can never attribute media to it. The v0.5.66 exclusion was reasoned
on the ML export copying the observation comment onto every media row from that
observation, making it non-asset-specific — true, but `Observation Details` is
scoped to one species on one checklist, far tighter than the checklist comment
it was grouped with in that decision.

**Why re-entry rather than a follow-on run.** Half 1 of this release is the
Named Birds audio tile height. With zero media matching, that fix is
unobservable on the user's machine, so shipping it alone would ship a fix nobody
can see. The user chose to fold the matching fix into this release rather than
defer it.

**What carries forward unchanged.** The Designer's approved refinement (audio
tiles at 230px desktop / 280px phone, audio fallback at full density) stands and
was not revisited. Stage 2 is not re-run. Version stays 0.5.75; the changelog
entry widens to cover the matching fix.

**Cascade.** Stage 1 (The Evaluator) re-scopes, then Stage 3 (The Engineer),
Stage 4 (The Tester), and Stage 5 (The Auditor) re-run before returning to
Stage 6 (The Deployer).
