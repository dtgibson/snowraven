# Removal ledger: security-bloat-deps-and-tests-cleanup

One line per test row dropped, reworked or moved. Evidence classes are the brief's bar ("Method and removal bar"):
**(a)** a mutation that removes the guarded thing leaves the row green and no small fix makes it go red;
**(b)** another named row goes red on the same mutants;
**(c)** its cost is out of proportion and a cheaper form is shown going red on the same defect.
Timing rows follow the timing bar instead: **T1** work count or structural, **T2** same-run CPU quotient with a measured margin and a control, **T3** local full suite only, behind `SR_SKIP_LOCAL_ONLY_TIMING` (`frontend/src/test/localOnlyTiming.ts`).
Readings, load averages and mutation runs are in `engineering-log.md`.

CI vitest time before this run: 433 to 799 s across the 25 failing runs on `main` (2026-11-09 to 2026-11-20); latest 789 s wall, tests 524 s (evaluator-notes.md section 1). After: to be read from the draft pull request's runs (the rows below skip about 28 s of `lifeListsLinearity` and add the 20 bundle rows).

## Phase 1

| File | Row | What it was | What replaced it | Evidence |
|---|---|---|---|---|
| `frontend/src/lib/androidProjectPins.test.ts` | pins every action to a full commit SHA with its release in a trailing comment (no mutable ref) | The SHA-pin predicate over `android-build.yml` only | `frontend/src/lib/workflowActionPins.test.ts`, the same predicate over every workflow in `.github/workflows` (read from the directory), plus a check that every `uses:` line was read | (b): restoring `actions/checkout@v6` in `android-build.yml` turns the new file's `android-build.yml` row red; seven mutations across the four workflows each turn exactly one new row red |
| `frontend/src/lib/alphaCodes.test.ts` | published names, a code query | One row: work done at the 8k leg only, then the CPU quotient | Split. **Work done** (`work done: every row looked up exactly once per call, at every leg > published names, a code query`) now asserts one lookup per row at all four legs and gates on GitHub. **CPU time** (same limits 2.5x average and 3.2 per doubling, same legs) moved behind the switch | T1 for the count (red on a second pass, mutant A1, in GitHub mode); T3 for the quotient (red on a search inside the per-row work, mutant A2, locally; GitHub read the first doubling at 3.35 to 3.92, the mutation's own band; Node 24 locally 1.5x to 1.8x under the limits) |
| `frontend/src/lib/alphaCodes.test.ts` | hostile: every name about 4,000 characters, none published, each its own key | Same shape as the row above | Same split | T1 for the count (red on A1 in GitHub mode); T3 for the quotient |
| `frontend/src/lib/lifeListsLinearity.test.ts` | pass 1, pass 2, pass 3 (each in two species shapes) | CPU quotients at 5k/50k (pass 3 at 500/5,000) | Unchanged, behind the switch | T3: no work count can see a search over a collection the pass builds itself (mutant L1 is invisible in GitHub mode); GitHub read pass 1 at 20.3 to 26.1 against 20 (Node 20); Node 24 locally reads 10.7 to 11.1, 1.8x under; red locally on L1 |
| `frontend/src/lib/lifeListsLinearity.test.ts` | pass 1R and pass 2R (eight leg shapes) | CPU quotients at 2k/20k or 5k/50k | Unchanged, behind the switch | T3: GitHub read 1R at 25.6 to 32.4 against 25.5 and 2R at 20.7 to 45.2 against 20 (Node 20); Node 24 locally 1.35x to 1.9x under on the every-row-its-own-key legs; red locally on L2 |
| `frontend/src/lib/lifeListsLinearity.test.ts` | a region press; the choice build sorts in C log C | CPU quotients at 500/5,000 | Unchanged, behind the switch | T3: Node 24 locally reads 11.7 to 13.3 against derived limits of 28.94 and 27.41, 2.06x to 2.32x, which is within the "about 2x" testing.md v0.5.84 says is not margin; they never failed on GitHub's Node 20, which is no margin argument |
| `frontend/src/lib/lifeListsLinearity.test.ts` | the region guard can go red; the guard can go red | The mutant non-vacuity rows | Unchanged, behind the switch | T3: they prove the quotients can fail, so they run where the quotients run |
| `frontend/src/lib/lifeListsLinearity.test.ts` | a capped replica completes promptly; the bound holds at the cap (150,000 rows) | Hang guard and structural counts | Kept, still gate on GitHub | Not timing quotients; unchanged |
| `frontend/src/lib/entryChunk.test.ts` | the 6 post-build `dist/index.html modulepreload` rows | Skipped on every GitHub run (no build yet) | Now run on GitHub (the build runs first); on CI a missing build throws (`frontend/src/test/builtDist.ts`) | Not dropped: moved from never-run to run |
| `frontend/src/lib/targetsSortSelectCss.test.ts` | the 10 emitted-bundle rows | Same | Same | Same |
| `frontend/src/lib/mapFabCascade.test.ts` | the 4 emitted-bundle rows | Same | Same | Same |
