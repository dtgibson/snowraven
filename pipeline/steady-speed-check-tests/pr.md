## Steadier speed checks (steady-speed-check-tests)

### What this does
Test-only apart from one build-1 accessibility fix (see the follow-ups). The same-run speed checks in four test files now read this process's CPU time (`process.cpuUsage()`) instead of the wall clock, through one shared helper, `frontend/src/test/cpuTiming.ts`. The legs are interleaved, each leg gets an untimed first call, and the best of seven samples per leg is compared per call. The wall clock also counted the time other processes held the core, which inflates the longer leg more, so these rows failed on a busy machine with nothing wrong. Every limit, floor, input size and leg is unchanged. Separately, the Targets row at `Targets.test.tsx:202` now waits for the `/map/county-species` request before it releases it, which fixes the readiness bug the brief found. One row still spreads under load (the bar chart's 512/513 names shape, large leg). Its cause is in the parser, so it is recorded at the row and left for a separate change.

### How to test
1. `cd frontend && npx vitest run src/test/cpuTiming.test.ts src/lib/barChart/parseBarChart.test.ts src/lib/namedBirdTimeline.test.ts src/lib/weatherStatsLinearity.test.ts src/lib/planSpanBound.test.ts src/components/targets/Targets.test.tsx`: all pass.
2. To see the load behaviour, loop a full suite in a second terminal (`while true; do npx vitest run; done`) and repeat step 1 a few times.
3. `npm run typecheck` and `npm run lint` pass.

### Notes for reviewer

**Files.** New: `frontend/src/test/cpuTiming.ts` (the helper) and `frontend/src/test/cpuTiming.test.ts`, with five rows:
- the clock advances at a plausible rate;
- it does not count a 60 ms `Atomics.wait`;
- legs are called once first, then interleaved with a rotating start, `rounds + 1` calls each when unbatched;
- a short leg is batched and a long one is not, and times are reported per call;
- an implausible clock is refused (see the F1 follow-up). Changed: `parseBarChart.test.ts`, `namedBirdTimeline.test.ts`, `weatherStatsLinearity.test.ts`, `planSpanBound.test.ts`, `Targets.test.tsx`, and, in the follow-ups below, `Settings.barcharts.test.tsx`, `Settings.icloudKeys.test.tsx`, `Settings.icloud.test.tsx`, `TargetsBarChartFile.test.tsx` and `TargetsBarChartFile.tsx`. No `vite.config.ts` or CI change. The one application change is the Targets focus fix (last follow-up below). No `retry`, no raised limit, no smaller input.

**Why CPU time, measured.** I timed the same samples on both clocks with two full suites looping alongside (load about 85). Over twelve trials the wall clock read the 512/513 names quotient at up to 5.44 and CPU time read at most 2.65 (limit 3.2). The main thread's own CPU time (`process.threadCpuUsage`) was no steadier, and it does not exist on CI's Node 20. `process.cpuUsage` does exist there (checked on 20.20.2). Vitest runs each file in its own worker process (checked: three files, three pids), so no other test's work lands in a sample.

**Per row: technique, and runs that failed before and after.** "File alone": 20 runs of each file by itself, with TWO full suites looping alongside (load median 117 before and 125 after, maximum 146 and 164). That is heavier than the brief's two-suite bar. "Full suite": 10 full-suite runs with one full suite looping alongside (load median 95, maximum 115).

| Row | Technique | File alone, before | File alone, after | Full suite, after |
|---|---|---|---|---|
| `parseBarChart`: entity decoder / blank-separated rows / names at 512 and 513 | CPU clock in the shared `assertLinear`. The decoder keeps its 20 ms batched samples, now sized per leg. File rows time one call per sample | 17/20 runs (decoder 8, blank-separated 7, names 5, plus 4 on unscoped shapes; up to 5.51) | 1/20 (names 512/513, large leg, 3.39 at load 130) | 1/10 (names 512/513, large leg, 3.21) |
| `namedBirdTimeline` TIMING | CPU clock, interleaved, best of 7. Each call gets a distinct pre-built input (8 per leg). Explicit 30 s budget | 2/20 (14.75, 14.86 against 8) | 0/20 | 0/10 |
| `weatherStatsLinearity` checklist count, and the `ratios()` rows | `ratios()` now takes its sizes and input type and reads CPU time after an untimed first call. RUNS goes from 5 to 7. The checklist-count row now runs through `ratios()` (before, it timed each size's runs back to back) and has an explicit 30 s budget | 7/20 (checklist 7, emoji 1; up to 8.60 against 3) | 0/20 | 0/10 |
| `planSpanBound` doubling | The quotient in CPU time, interleaved, best of 7 batched samples. The absolute 300 ms budget stays on the wall clock, as before | 4/20 (B 7.56 to 11.91 ms against A 1.05 to 3.61) | 0/20 | 0/10 |
| `Targets.test.tsx:202` | `await waitFor(() => expect(H.tGet).toHaveBeenCalledWith('/map/county-species', { regionCode }))` before `releasePool` | 0/20 | 0/20 | 0/10 |
| `countyDayObsCache.sync` O(n log n) (not changed) | None: it did not reproduce | 0/20 | 0/20 | 0/10 |

**Mutation proof.** Each ran on a quiet machine. After each one, the file was restored and its hash checked.
- **Entity decoder.** Bounded lookahead reverted to an unbounded `indexOf(';')`: red at the first leg, 42.22 ms to 168.70 ms, 3.996 against 3.2.
- **The two file-level rows.** The brief's mutation reverts the M1 tab-search bound (`indexOf('\t', p)` with no end). Only the M1 A row goes red (3.96). **The blank-separated and 512/513 rows stay green**, because neither shape has a tab-free line for the search to run past.
  - So I named a defect that does reach them: a line walk that rescans the file's prefix for every line. It is the line-axis twin of the weather file's prefix-rescanning header walk. The outer loop runs the same number of times, so the capped walk cannot see it.
  - Blank-separated: red at the first leg, 3.83.
  - Names at 512/513: green at the first leg, red at the second (4.02). Catching this is the large leg's job, and the file now says so.
- **`namedBirdTimeline` TIMING.** The `Array.includes` dedup restored: 110.45 ms to 10,995.31 ms, 99.5 against 8, red in 89 s.
- **`weatherStatsLinearity`.** The header walk rescanning its prefix per code point: both emoji rows red at 3.99. For the checklist-count row, every earlier checklist's comment re-tested on each new one: 3.97 and 3.98 against 3.
- **`planSpanBound`.** Its bound `tA * 2.5 + 1` admits a chain that exactly doubles, so it does not test "the clamps are there". What it rejects is the **day cap removed** (the `asDays` break). `sideAt` rescans the admitted days on every evaluation and `sunPeakByDay` rescans every anchor for every day, so without the cap the chain grows with the square of the day count. With the cap removed: A 372.93 ms, B 1,392.38 ms, against a bound of 933 (3.73x). The assertion now says this in a comment.
- **Targets.** With a 5 ms delay on the completeness-document read, the HEAD row failed 3/3 ("Unable to find role=table", the tab stuck loading). The fixed row passed 3/3 with the delay, and it passes without it. Creating the status region together with its first message (ui.md v1.0.15) turns the row red ("expected null not to be null").

**Scope notes.**
- `assertLinear` is shared by all eight linearity rows in `parseBarChart.test.ts`, so the five unscoped file-level shapes moved to the CPU clock along with the three scoped rows. They also failed 4 times in the before runs. Leaving them on a clock known to fail seemed worse than taking the shared change.
- `ratios()` drives all six weather shape rows, as the brief scoped.
- `countyDayObsCache.sync` did not fail in 40 runs under two looping suites or in 10 full-suite runs, so it is unchanged, as the brief said.

**Not met: the 512/513 names row's large leg.** Two of the brief's bars fail on this one reading: 0 failures under load, and a green quiet full suite.
- **Where it failed:** once in six quiet full-suite runs (3.37), once in 10 full-suite runs beside a looping suite (3.21), and once in 20 file-alone runs beside two looping suites (3.39). Every other scoped row passed every run.
- **The cause is in the parser.** `tidy()` builds each kept name by `+=`, so the parse holds every 512-character name as a long chain of string pieces until it returns. A 14 MB file of 20,000 such names keeps 350 MB alive, and 41 MB once the names are read. The collector's share of the 4 MB parse is larger than its share of the 2 MB one, and by how much depends on the heap's state when each call starts.
- **No clock removes it.** Across three quiet full-suite runs this reading was 2.18 to 2.82, while no other leg in the file read above 2.20. The wall clock spreads it at least as far: on the same samples beside one looping suite, wall time read up to 3.72 where CPU time read at most 2.90.
- **What I tried.** More rounds did not help. A held heap ballast and an untimed call before each sample made it worse. A forced collection before each sample made it steady, but at 4.0 to 4.6, above the limit.
- **Fixing it needs application code,** so I stopped there as the brief directs. The evidence and the fix are recorded at the row. The fix is to build the name in one piece in `tidy()` (`parseBarChart.ts`), which would also cut the 350 MB. I saved it to the idea inbox (id `b1e71586`).

**Other findings, not changed.**
- **Node 20 on this Mac.** Under Node 20.20.2, the unscoped all-tabs row reads 3.28 to 3.32 on every run at its 2 MB to 4 MB leg. The decoder's large leg reads up to 3.99 there. HEAD's wall-clock version does the same (all-tabs 3.28 to 3.32 in 3 of 3 runs, decoder 3.68 in one), so this change did not cause it. It looks like a trait of Node 20's V8. CI runs Node 20 on Linux and has not reported the all-tabs row, so I could not check what CI sees.
- **Targets Remove focus race (build 1 QA, Known Limitations 1).** This one is FIXED here: see the last follow-up below.

**Follow-up: the two Settings Escape rows (build 1's files, fixed here).** `Settings.barcharts.test.tsx` "Escape closes it with nothing removed" failed 1 of 10 loaded full-suite runs, and the Evaluator saw `Settings.icloudKeys.test.tsx` "Escape cancels the note" fail once.
- **Cause: a test readiness race, not an app defect.** `ModalDialog` arms its Escape listener, its Tab trap and its initial focus in one effect pass. That pass runs after the dialog's node is in the DOM. Each row pressed Escape as soon as `findByRole('dialog')` saw the node, and on a loaded machine React yields between the commit and that pass, so the Escape was lost.
- **Evidence.** With a clock that runs 6 ms per read, React's scheduler yields after every task. Under that clock both HEAD rows failed 3/3 with the recorded message ("expected <div role="dialog"> to be null"). Pressing Cancel instead closed the dialog 3/3 under the same clock, so the close path is fine.
- **Not a user-facing defect.** The window lasts until those effects run, while the panel is still in its opacity-0 entry frame.
- **Not the Targets focus race.** That one is about where focus lands when the dialog closes (see Other findings).
- **Fix, test-only.** Both rows now wait for focus inside the dialog before pressing Escape: `await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true))`. Under the forced yields: 3/3 green each. File alone, 20 runs each with two looping suites (load median 136, max 164): 0/20 and 0/20.
- **A third row with the same cause, also fixed:** `Settings.icloud.test.tsx` "Escape cancels the note and focus returns to the switch". It is older (v1.0.11), not from this bundle, and I had not been asked about it. It failed 1 of 8 QUIET full-suite runs with the same message. Under the forced yields: HEAD 3/3 red, fixed 3/3 green. File alone, 20 runs with two looping suites (load median 72, max 93): 0/20.
- No application code changed and `decisions.md` is untouched, because this is not the build-1 focus defect.

**One more reading to know about: the weather attribution-spam row.** `weatherStatsLinearity` "attribution spam: at most 3x per doubling" (the `parseWeatherBlock` one) failed once, at 4.10 and 0.96, in a quiet full-suite run. That is 1 of 16 quiet full-suite runs of this change. It passed all 20 heavy file-alone runs, all 10 loaded full-suite runs, and in isolation it reads 1.98 to 2.02 on every clock, quiet or loaded.
- **Likely cause, not proven.** Process CPU time also counts V8's concurrent collector threads, which the wall clock never did. In this shape's samples on a quiet machine, CPU time ran up to twice the wall time.
- **I could not reproduce it,** so I did not change the clock again. If it recurs, the candidate is to take, per sample, the smaller of the wall time and the process CPU time. Both are upper bounds on the calling thread's own work, and each drops the inflation the other carries.

**Follow-up: the Targets Remove focus race (build 1's UI, fixed here; application code).** After a confirmed Remove on the Targets bar-chart card, `ModalDialog` picks where focus returns when its close transition ends. When that fell after the removal but before the parent's manifest re-read switched the card to absent, it focused Remove. Remove then unmounted, and focus fell to `<body>`.
- **The fix,** in `frontend/src/components/targets/TargetsBarChartFile.tsx`: once the card's absent state has committed (and it is no longer busy), focus goes to Add file, the design spec's target. It does this only if focus was lost or is still in the section. `ModalDialog` is unchanged.
- **The test,** in `TargetsBarChartFile.test.tsx`: a three-order roster plus a no-steal row. Without the fix, the "dialog closes, then absent" row failed 3/3 with focus on `<body>`. Dropping the guard fails the no-steal row. The mid-removal row cannot discriminate in jsdom, and the comment beside the roster says why.
- **Under load:** 0/20 for the card file and 0/20 for `Targets.test.tsx`, each run alone beside two looping suites (load median 88, max 115). Typecheck, lint and a quiet full suite pass (8,701 passed). The CSS is still byte-identical to HEAD.
- **Recorded** in `pipeline/icloud-bar-chart-sync/decisions.md`, item 15.
- **No version bump or CHANGELOG line:** this fixes unreleased build-1 UI, and the Spool bundle stamps once at the flush.

**Follow-up: the Auditor's F1 and F2 (test-only).**
- **F1: the helper now checks its clock rather than trusting it.** `bestPerCallCpuMs` holds each leg's best CPU time against its best wall time. It throws if the CPU time is above wall time times (cores + 1), or below 1/200 of wall time for any leg whose best wall sample is at least 50 us. It also throws before batching if a warm call reads zero CPU over 1 ms or more of wall time, or under 1/200 of a warm call of 1 s or more.
  - Over the four files with two looping suites (load 40 to 79), every real leg read 0.42 to 1.16 of its wall time.
  - In the self-test, `burn` is capped at 5 s of wall time, so it can no longer hang. A new row checks that 25 ms of spinning reads at least 25 ms of CPU and at most four times its wall time. Another row checks `assertPlausibleClock` directly.
- **Mutation proof.** I mutated the clock three ways: stalled at 0, 1,000 times too slow, and 1,000 times too fast. Each time, every timing row in the four files went red and the self-test's two clock rows went red. The stall ran 15 s end to end, the slow clock 8 s and the fast one 3 s. The slowest single row was the stalled self-test's batching row at 10 s (two capped burns). Nothing hung.
- **F2.** The NON-VACUITY row in `namedBirdTimeline.test.ts` is now titled "the same step and bound", and its comment says what it runs (the oracle at the same STEP, a quarter of the anchor, wall clock, min of two) and that the TIMING row was shown rejecting the defect by mutation instead.
- **Verification.**
  - The helper's test and the four timing files, 5 runs each beside a looping `npm run build`: 0 failures. That load only reached a 1-minute load average of about 2.3.
  - The self-test also passes on Node 20.
  - Typecheck, lint and a quiet full suite pass (8,703 passed). The CSS is still byte-identical to HEAD.

**Cost.** A quadratic regression costs what it did before, because its single call is already past the batch size. The exception is the TIMING row, which now makes eight calls per leg instead of three. With `includes` restored it takes 89 s to go red, against about 33 s before (three calls per leg at the same readings). The rows' own time on an idle Mac: TIMING 0.13 s, checklist-count 0.21 s, `planSpanBound` doubling 0.20 s. The `parseBarChart` file takes about 3 s in all.

**Bundle.** The built CSS is byte-identical to HEAD, with the same content hash (`index-CxCK3QGh.css`). So the new comments under `frontend/` added no Tailwind rules. No built JS file references the helper.

**Final checks.** `npm run typecheck` and `npm run lint` pass. Over 16 quiet full-suite runs of this change, 13 were green (8,697 passed, 5 skipped), including the last one, run after every fix. One failed on the names row above, one on the attribution-spam reading, and one on the `Settings.icloud` Escape row, which is now fixed.

There is no version bump, CHANGELOG line or copy change. The test changes are dev-only under CLAUDE.md, and the one application fix is to unreleased build-1 UI, which the bundle stamps at the flush. Nothing is committed.

## Seeing the steadier speed checks locally

1. Open a terminal in the project folder (`snowraven`).

2. Go to the app folder:
   `cd frontend`

3. Run the changed test files:
   `npx vitest run src/test/cpuTiming.test.ts src/lib/barChart/parseBarChart.test.ts src/lib/namedBirdTimeline.test.ts src/lib/weatherStatsLinearity.test.ts src/lib/planSpanBound.test.ts src/components/targets/Targets.test.tsx`

4. What to look for: "6 passed" test files and no failures. There is nothing to see in the app itself, because nothing in it changed.

5. Optional, to see the fix under load: in a second terminal in `frontend`, run `while true; do npx vitest run; done` to load the machine, then repeat step 3 several times. The rows should keep passing, apart from rare failures on the 512/513 names row described above. Stop the loop with Ctrl+C when done.
