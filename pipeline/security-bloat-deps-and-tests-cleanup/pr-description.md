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

## Phase 3: the shipped-code half (1.0.75, D-02), with five saved fixes (D-06) and a macOS test job (D-07)

Unlike phases 1 and 2, this changes the shipped app and its native dependencies. It ships as 1.0.75 after the user approves the held copy (`release-copy-held.md`); the version bump is the Deployer's single release commit (D-10) and is not on this branch yet.

### What changed
- **Three keychain commands and the `keyring` crate removed.** They had no caller since v0.3.16, yet any script in the page could call them. With no backend feature, keyring built only an in-memory mock store on every target, so they never reached a keychain.
- **Per-crate Cargo updates:** rustls 0.23.46, rustls-webpki 0.103.17, webpki-roots 1.0.12, h2 0.4.20, plist 1.10.4 (quick-xml 0.42.0), anyhow, rustix, tokio, clipboard-win, and webpki-root-certs (in no shipped graph). One `cargo update -p` per crate or group; the vendored `tao` patch stays in every target's graph after each. cargo-audit: 24 vulnerabilities in 9 crates down to 16 in 4, and in a shipped graph only `zip` (Windows, held by D-08, its disposition written for the Auditor).
- **A lockfile lesson:** two of those updates silently re-pointed `windows-sys` edges for eight Windows-side crates while every version diff looked clean. They are restored, cargo accepts the file under `--locked`, and each target's graph now differs from the start by exactly the updated crates.
- **A guard** in `androidReachableCalls.test.ts`: every `#[tauri::command]` is registered, and every registered command has a caller in shipped frontend code. It would have caught the keychain commands.
- **Five ride-along fixes,** each with rows seen red against the unfixed code:
  - an eBird location id is shape-checked before any follow-up request, on both transports, including two weather URLs the original review had not listed (`3eb8682b`);
  - a non-text location name reads as absent (`c5fa8455`);
  - the breeding-code check, already fixed in 1.0.69, gets rows that can fail on web/Pi (`c7cf73d6`);
  - a prototype-named State/Province cell no longer takes down Statistics, and only a real subdivision code becomes a link (`25608818`);
  - the bar-chart reader builds each name in one piece, 320 MB to 25 MB on a 14 MB file, which also retires the last flaky speed row's residual (`b1e71586`).
- **Five unused declarations removed** (frontend and backend), byte-identical bundle.
- **The opener and process grants narrowed** to what the page calls: `opener:allow-open-url` and `opener:allow-default-urls` in place of `opener:default` (whose unused `reveal_item_in_dir` let page script test whether a file exists), and no `process:allow-exit`. Probed in the running debug app against a control build first; a guard row holds the set.
- **A macOS job** runs all 140 Rust tests on GitHub on Rust 1.96.1 (read from the Android pins); it needs no frontend build (measured).

### How to test
1. `cd src-tauri && cargo test --locked` (140 pass) and `cargo tree -i tao --target aarch64-apple-ios` (the vendored path).
2. `cd frontend && npx vitest run src/lib/androidReachableCalls.test.ts src/lib/checklistProvenance.parity.test.ts src/lib/atRouteServices.test.ts src/lib/regionNames.test.ts src/components/BirdingStatsPrototypeNames.test.tsx src/lib/barChart/parseBarChart.test.ts`
3. `cd backend && .venv/bin/python -m pytest tests/test_checklist_provenance_parity.py`
4. On this pull request: the new `Native — cargo test (macOS)` job. Before the tag, run the Windows workflow on the branch (`workflow_dispatch`): this Mac cannot compile the Windows target, and `clipboard-win` and the restored `windows-sys` edges get their first compile there.

### Notes for reviewer
- **The bundle changes, and every moved byte is accounted for** (engineering-log.md, Phase 3, H): the intended code in six chunks, minifier re-lettering, and one shared chunk renamed by Rollup; no CSS, `index.html` or entry-chunk byte moved.
- **Deviation from a review's remediation:** `25608818`'s write-up named `isRegionCode` for the links, which is the US county shape and would have dropped every real state link. The gate is the ISO 3166-2 subdivision shape, checked against every value in the stored backup.
- **The capability narrowing was probed on the Mac only.** The ACL is resolved from the same JSON on every desktop target, so the refusals carry to Windows; the Windows relaunch and its link opening are not shown here (engineering-log.md, Phase 3, I). The Windows workflow compiles the narrowed files.
- **Still open, same family as `c5fa8455`:** `howManyStr`, `comments`, `obsDt` and a region-info name are not type-normalized on either twin.
