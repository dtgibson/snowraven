## Test, CI and developer-tool cleanup

### What this does
GitHub's `Pipeline` check has failed on every push to `main` since 1.0.67, always on two speed-ratio test files that read differently on GitHub's shared runners than on a developer Mac, and the production build and the real-engine gate have not run there since. This branch makes those checks mean something again: speed rows that cannot read steadily on GitHub run in the local full suite behind one named switch, the 20 rows that read the built app now run on GitHub because the build runs first, CI moves to the repository's pinned Node (24), every action in every workflow is pinned by commit SHA, and the developer-tool dependency advisories are fixed. Nothing in the shipped app, its native code or its dependencies changes, and there is no version bump.

Phase 1 of the `security-bloat-deps-and-tests-cleanup` run, one concern per commit:
- `ci: pin every action in every workflow by commit SHA` (and `workflowActionPins.test.ts`, which replaces the Android-only pin row)
- `ci: Pipeline and the Windows build follow .nvmrc (Node 24)`
- `test: speed rows that cannot gate on GitHub run in the local full suite` (`alphaCodes.test.ts`, `lifeListsLinearity.test.ts`, the `SR_SKIP_LOCAL_ONLY_TIMING` switch)
- `ci: build before the suite, so the 20 bundle rows run on GitHub` (`builtDist.ts`)
- `chore(deps): frontend dev-tree audit fix, lockfile only`
- `chore(deps): sharp 0.35.5 in website/tools`
- `chore(deps): record the fsevents install-script decision as no`

### How to test
1. `cd frontend && npm ci && npm run lint && npm run typecheck && npm run build`
2. `npx vitest run` (the local full suite runs every row, the local-only speed rows included)
3. `SR_SKIP_LOCAL_ONLY_TIMING=1 npx vitest run src/lib/alphaCodes.test.ts src/lib/lifeListsLinearity.test.ts` shows exactly what GitHub runs of those two files: 17 pass, 20 skip.
4. `rm -rf dist && CI=1 npx vitest run src/lib/entryChunk.test.ts` fails the file (a missing build on CI is an error); without `CI` the same command skips the post-build rows and prints a `[skipped]` line. Run `npm run build` again afterwards.
5. `npm audit` and `npm audit --omit=dev` in `frontend/` and `website/tools/` (online): 0 in each.
6. On this pull request's `Pipeline` run: the vitest step, the build, the tooling install and the real-engine gate all run, on Node 24.

### Notes for reviewer
- **No shipped change, measured.** The production build is byte-identical to the branch point's over all 190 files in `frontend/dist`, checked after every commit that could move it (Tailwind scans test files, so test edits are not exempt).
- **The speed rows were not loosened.** No limit, leg or input changed. On GitHub's Node 20 they read up to 45 where a real quadratic reads about 99. On this Mac, Node 20 reproduces that pattern and Node 24 reads them steadily, but still within 2x of their limits, which the testing rules do not count as margin. The Life Lists rows have no form a work count can check, so they run locally only; the alpha-code join keeps a work-count row that gates on GitHub at every leg. Each moved row was seen red against its own defect (engineering-log.md, item A).
- **What GitHub no longer catches:** a search inside the Life Lists passes or inside the alpha-code join's per-row work. The local full suite still catches both; the files say so.
- **Node 24:** the next tag's Windows build is that job's first on Node 24, so the release leg should watch it. The Android build keeps its own Node pin (`scripts/android/toolchain.env`), outside this change.
- **Pages:** this branch touches `website/tools/package*.json` and `pages.yml`, so the first push to `main` that carries it redeploys the website with no visible change.
- **Still to come in this run:** watching the gate's first runs, the flaky and ineffective test rework, the per-file efficiency pass, and the shipped-code half (its own release). Cargo and Python audit dispositions are in engineering-log.md, item E.

## Phase 2: flaky and ineffective tests, the gate's first reds, and the slowest files

Still test, harness and CI only: no app code, no dependency, no version bump. The production build is byte-identical to `main`'s (measured, not claimed; see engineering-log.md, Phase 2).

### What changed
- **Rows that could not fail, repaired.** The five Clear-race rows in `clearDerived.test.ts` (the storage mock now reads first and parks after; each store's guard deleted now turns its own row red, where before all 37 rows stayed green), the memo-headroom row (its figures come from the bundled taxonomy when it runs), and two link gates a mutation sample found blind (a prefix-shaped location id; CommentText's own scheme gate, now source-pinned).
- **Flakes fixed at their cause.** AlertsInboxSheet's Escape now waits for focus inside the dialog; HotspotLink's corpus row has its own budget; weatherStatsShared's doubling row reads CPU time; the specificity helper fails closed on an unclosed `[` instead of hanging; the palette check fails when the Welcome screen never appears instead of skipping FR-50.
- **The gate's two GitHub reds.** Hotspot Reports' tile-label row was measuring the runner's fallback face (DejaVu-metric), wider than every shipped platform's: forcing DejaVu Sans reproduced GitHub's counts exactly, while SF, Roboto, Selawik (Segoe UI's metric twin) and Inter all read clean. The workflow now installs `fonts-inter`, the stack's first family, and the harness prints the face it measured. The Planner's 1px row did not reproduce here; the harness now applies each text scale before its sweep and confirms it on a `rem` descendant (testing.md v1.0.56), and a failure names the box that moved.
- **Slow files.** taxonomyHistory parses the 1.7 MB snapshot once (one row 10.2 s to 4.1 s); the date-range cascade resolver matches only rules that declare the property (equivalence shown over all 2,812 queries).
- **A pre-existing flake GitHub showed on this branch.** useExoticProvenance's rows read their emission list right after a render wait, before the passive effect that records it; they now wait for the list itself (reproduced on demand, fixed).
- **A relabel.** Life Lists' pass-3 repeated-species row is a fixed-size control, and now says so.

### Notes for reviewer
- Every reworked row was seen red against its own defect; the tables are in engineering-log.md. Nothing was loosened: no limit, leg or input changed on any timing row.
- A mutation sample of 33 distinct mutations over the security, Clear, CSP and HTTP-permit, entry-chunk and publishing guards: 28 red as they should, 3 green for a stated reason, 2 found rows that could not fail (repaired).
- Left alone on purpose, with reasons in the log: the parseBarChart 512/513 residual (retired only by the shipped `tidy()` change, idea `b1e71586`), the deliberately real-duration rows in useChecklistProjects, and the Calendar's render cost.
- **Pages:** this branch touches `website/tools/verify/`, which the Pages deploy publishes; the first push to `main` that carries it redeploys the website with no visible change.
