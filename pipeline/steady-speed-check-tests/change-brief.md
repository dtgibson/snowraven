# Change Brief — steady-speed-check-tests

## What is changing
Test-only. Speed-check rows in four test files still go red on a very busy machine. They get a steadier measurement. One Targets row that fails under the same load gets the wait it is missing. Each row must still catch the defect it exists for.

**This re-targets the saved idea.** Its "two speed-check tests" are the pair that turned CI run `36376776547` red:
- The `namedBirdTimeline` NON-VACUITY row timed out at 5,175 ms. `13789e2` fixed it: no failures in any run below.
- The `parseBarChart` entity-decoder row read 3.32 against a limit of 3.2. `11e16b8` fixed it only in part: it holds at the loads that commit measured, and still fails 4 of 13 times when a second full suite runs alongside.

The other rows were found by measuring under that load.

## Why now
The rows below were measured with a second full frontend suite running alongside ("two suites"): load average 48 to 87 on this 8-core Mac, 13 full-suite runs. A Tester run overlapping an Auditor or Engineer run produces exactly that, and it is what happened in build 3's QA.
| Row | Two suites | Other evidence |
|---|---|---|
| `parseBarChart`: entity decoder / blank-separated rows / names at 512 and 513 | 4 / 3 / 1 of 13 (3.32 to 4.34, limit 3.2) | CI failed the decoder row 2 times before `11e16b8` |
| `namedBirdTimeline` TIMING (the NON-VACUITY row's sibling) | 5/13 (9.05 to 19.13, limit 8; the small leg is 1.3 ms) | |
| `weatherStatsLinearity` checklist-count row | 3/13 (3.16 to 4.50, limit 3) | build 3 QA 5.24; county-date-filter-mobile QA 3.26; CI `36103956779`: the emoji `ratios()` row read 3.15 |
| `planSpanBound` doubling row (one sample per leg) | 1/13 (3.80, limit 3.54) | 3 more at heavier load |
| `Targets.test.tsx:202` | 0/13 | build 2 QA: 1 timeout; reproduced every time (Evidence) |

## Evidence
- **Lighter loads, all green.**
  - Quiet: all 24 timing files plus Targets, 706/706.
  - One looping full suite (load 7.5 to 15.5): each candidate file run alone, 35/35 over 5 rounds.
  - The full suite beside a looping build (load 16 to 28): 5/5.
  - So failures start between load 28 and 48.
- **Heavier load, not this build's bar.** With two suites plus a looping build (load up to 87), every timing row trips, including `speciesUtilsMemoBound` and `weatherStatsShared` once each. No wall-clock ratio can meet that bar.
- **Targets is a readiness defect, not a speed check** (testing.md v1.0.32). The row calls `releasePool(POOL)` as soon as the County picker appears. But `useTargetsPool` sends `/map/county-species` only after `await loadAll()`. When the request has not gone out yet, `releasePool` is still the no-op, so the table never renders.
- **The Targets proof** (a scratch copy outside the repo, 3 runs each):
  - A 5 ms delay on the fake completeness-document read failed 3/3. The tab stayed on "Loading Alameda, CA's species list from eBird", the state build 2 recorded.
  - Waiting for `H.tGet` to be called with `/map/county-species` before releasing passed 3/3 with that delay, and 3/3 without it.

## User-facing impact
None. Test files only. No version bump, CHANGELOG entry or tag, under CLAUDE.md's dev-only rule. No README, website, HELP, privacy or App Store text changes.

## Design pass
Not needed. No visual change.

## Decisions touched
None is reversed. Each guard's limit sits between linear and its measured defect, and the fix must keep it there.
- DECISIONS.md "A docstring is not a test ... a ratio whose numerator is a CONSTANT is a wall clock" (v1.0.21): the `distinctDates` guard.
- DECISIONS.md "Targets tab ..." (v1.0.39): the bar-chart parser's linearity guard (NFR-06, security M1).
- DECISIONS.md "A 'no shipped path can produce such a document' clause was FALSE ..." (v1.0.33): `planSpanBound`'s clamps.
- testing.md rules this build must follow:
  - timing rules: same-run quotients; v0.5.84 "2x is not margin"; v1.0.33 "a `testTimeout` cannot interrupt a synchronous loop".
  - the Targets fix: v1.0.25 "wait for the exact observable".

## Scope
**Changes:**
- `frontend/src/lib/barChart/parseBarChart.test.ts`: the three rows.
- `frontend/src/lib/namedBirdTimeline.test.ts`: the TIMING row only.
- `frontend/src/lib/weatherStatsLinearity.test.ts`: the checklist-count row and the shared `ratios()` helper.
- `frontend/src/lib/planSpanBound.test.ts`: the doubling row.
- `frontend/src/components/targets/Targets.test.tsx`: wait for the request before `releasePool`.
- A shared test-support timing helper is allowed if it serves more than one row.

**Does not change:**
- Any non-test source file.
- `vite.config.ts` (no global `testTimeout` or `retry`) and the CI workflow.
- The NON-VACUITY row.
- `countyDayObsCache.sync` (failed 1/13 at 10.18 against 9; it is already best of 5 with a 4x step).
- `speciesUtilsMemoBound` and `weatherStatsShared`, which failed only at heavier load.

## How each guard keeps catching its regression
**Rules:** keep same-run quotients. Not allowed: `retry`, a raised limit the recorded defect would pass under, and inputs made smaller than the defect needs to show.

**Mutation checks.** Mutate each row back to its own defect and record the reading:
- Entity decoder: revert its bounded lookahead. `11e16b8` measured 3.97 to 3.98.
- The two file-level `parseBarChart` rows: revert their M1 search bounds.
- `namedBirdTimeline` TIMING: restore the quadratic `includes` dedup.
- `weatherStatsLinearity`: the prefix-rescanning header walk named in the file header. For the checklist-count row, a rescan per checklist.
- `planSpanBound`: remove the clamps. Its bound (`tA * 2.5 + 1`) admits a chain that exactly doubles, so first name the defect it actually rejects.
- Targets: create the status region along with its first message (the ui.md v1.0.15 defect). The row must go red.

**Approaches to try, the Engineer's choice, measured before relying on them:**
- Time with `process.cpuUsage()` instead of the wall clock. Vitest 4's default forks pool runs one file per process, and the call works on CI's Node 20. Confirm both first.
- Give both legs samples of the same length.
- Interleave the legs.
- Use a wider size step, so the limit has at least 2x margin both from linear and from the defect.

## What done looks like
- **Load test:** every scoped row passes, with 0 failures, 10 full-suite runs and 20 runs of its file alone, each with a second looping full suite running alongside (load at least 48).
- **Mutation proof:** every scoped row goes red against its named defect, and the reading is recorded.
- **Targets proof:** the row is red with the 5 ms delay on the completeness read and green with the wait.
- **Final checks:** the full suite is green on a quiet machine, and `npm run typecheck` passes.
