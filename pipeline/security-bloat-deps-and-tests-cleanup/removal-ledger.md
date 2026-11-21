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

## Phase 2

No row was dropped. Every row below was repaired or reworked and seen red against its own defect (engineering-log.md, Phase 2, which has each table).

| File | Row | What it was | What it is now | Evidence |
|---|---|---|---|---|
| `frontend/src/lib/clearDerived.test.ts` | the five LOAD_RACES rows and the escapee-name publish row | A storage mock that parked first and read after, so a parked load got the post-purge disk | The mock reads first and parks after; each row waits for the read before it purges | Repaired, class (a) before: each of the five guards deleted left all 37 rows green; after, each deletion turns exactly its own row red |
| `frontend/src/lib/controlRegisters.test.ts` | ends on an attribute selector with no closing bracket (new) | No row; the helper looped forever on that input | A `vm`-bounded row over the helper's own text | Added with the fix (idea `5951387a`): red in 2.0 s with the guard removed |
| `frontend/src/lib/speciesUtilsMemoBound.test.ts` | admits every real name with room to spare; holds a realistic working set | Floors divided by typed-in 66 and 18,631 | Both read from `ebird-taxonomy.json` when the test runs | Repaired, class (a) before: HEAD stayed green with a 70-character name and 400 more names added to the asset; now each turns it red |
| `frontend/src/components/AlertsInboxSheet.test.tsx` | asks first; Escape closes only the confirmation | Escape pressed when the dialog appeared | Escape pressed once focus is inside the dialog | Repaired: HEAD red with the dialog's effects deferred one task or 150 ms, new row green |
| `frontend/src/components/HotspotLink.test.tsx` | never adds or drops a character, over a generated corpus | vitest's 5 s default | Its own 30 s budget | Reworked (wall-clock allowance only): HEAD red under a 500 ms default, new row green |
| `frontend/src/lib/weatherStatsShared.test.ts` | grows about 2x per doubling on hostile input | One wall-clock sample per leg | CPU time through `bestPerCallCpuMs`, legs and limit unchanged | T2, kept gating: 2.00 to 2.02 against 3, control 1.00; red at 3.46 on an array-search mutant |
| `frontend/src/lib/lifeListsLinearity.test.ts` | pass 3, 200 species repeated | Labelled a linearity check | Labelled a fixed-size control; assertion unchanged | Class (a) for its old label: a quadratic sort read 1.38 here (green) while the distinct leg read 68.8 and the region press 30.6 (class (b)) |
| `frontend/src/lib/taxonomyHistory.test.ts` | each retired earlier name of a rename moves only toward the export's true date | Re-parsed the 1.7 MB snapshot on each of 508 calls | Parses it once for the file | Class (c), the same row cheaper: 10.2 s to 4.1 s; red with a rename's retired name kept out of tier 0 |
| `frontend/src/lib/dateRangeFieldsCss.test.ts` | every row that resolves the cascade | Matched every rule on every query | Matches only rules that declare the property | Class (c): both resolvers agreed on all 2,812 queries; red on a phone-tier `display` mutation |
| `website/tools/verify/verify-palette.mjs` | Escape still dismisses a shipped overlay (FR-50) | Skipped when the Welcome screen had not yet appeared | Waits for it and fails when it never appears | Repaired (idea `337b21d6`): HEAD passed 22 of 22 with FR-50 unmeasured when the screen never came |
| `website/tools/verify/verify-plan-readout.mjs` | the readout, the divider and the list hold their place (every sweep) | The scale set inside each reading, confirmed on the root only | Each scale applied once and confirmed on a `rem`-sized descendant before its sweep; failures name the box that moved | Reworked (testing.md v1.0.56): red at 55 of 55 widths on a 1px pick-only shift |
| `website/tools/verify/verify-hotspot-reports.mjs` | every tile label is one line wherever the tiles are two or more across | Measured the runner's fallback face | Unchanged assertion; the runner installs the stack's first family, and the harness prints the face it measured | Environment fix: the runner's DejaVu-metric face reproduced GitHub's 24/28/34/43 exactly; SF, Roboto, Selawik and Inter read 0 |
| `frontend/src/lib/useExoticProvenance.test.tsx` | a store holding only a stamp reads settled; a stamp past its TTL re-opens the species once; every emission advances the sequence | Read the emission list right after a DOM wait (red once on GitHub, run 44857230539) | Wait for the emission list itself | Repaired: with the harness's push deferred one task or 30 ms, HEAD's rows fail and the new rows pass |

## Phase 3: shipped code and exposed surface

The bar is the brief's for code: no caller by import or by string (dynamic `import()`, workers, `?raw`, `TauriTransport` tables, string-invoked commands, templated routes), no guard that reads the text, no published claim that rests on it, and green builds and suites after. Tool output was a lead only; each verdict below was checked by hand. Tools: knip 6.44.1 and vulture 2.16, run from scratch (engineering-log.md, Phase 3, E).

### Removed

| What | Where | Evidence | Commit |
|---|---|---|---|
| `get_api_key`, `set_api_key`, `delete_api_key`, `use keyring::Entry`, their three `generate_handler!` entries, `keyring = "3"` | `src-tauri/src/lib.rs`, `src-tauri/Cargo.toml`, `Cargo.lock` | No caller in any tracked or generated file since v0.3.16; no guard reads them (15 Rust-reading suites, 325 of 325 after); no published claim; keyring built only its in-memory mock store on every target. The lockfile loses exactly `keyring` | `ac7441f1` |
| `BACKEND_DOWN_MESSAGE_SHORT` | `frontend/src/lib/offlineMessage.ts` | Never referenced since 0.5.45; no test names the file | `8e2966a4` |
| `DATE_FORMAT_PREFS` | `frontend/src/lib/formatDate.ts` | Unused; Settings keeps its own list; `entryChunk.test.ts` reads the file's graph membership only | `8e2966a4` |
| `WeatherSectionIcon` and its `CloudSun` import | `frontend/src/components/WeatherStatsSection.tsx` | Its last caller was removed earlier; the guards reading the file check other things; `lib/weatherDisplay.ts`'s comment citing it was reworded | `8e2966a4` |
| `BreedingFilterSet` | `frontend/src/types.ts` | An unused type alias since v0.0.23 | `8e2966a4` |
| `COMBINED_ATTRIBUTION` | `backend/formatters/tide.py` | Unused since 0.5.17; only the TypeScript twin composes the combined block; no test reads the file | `8e2966a4` |
| `opener:default` (in place: `opener:allow-open-url` and `opener:allow-default-urls`) and `process:allow-exit` | `src-tauri/capabilities/default.json`, `desktop.json` | No caller of `reveal_item_in_dir` or `process\|exit`, by string, import or the bundle; no guard pinned the grants; no published claim. Probed in the running debug app against a control build: each refused leg reads as the ACL's refusal where the control reached the plugin or exited, and `open_url`, its three callers and `relaunch()` work unchanged (engineering-log.md, Phase 3, I) | `19eb72c8` |

After `8e2966a4` the production build was byte-identical to `main`'s over all 190 files; pytest 2,080, ruff, eslint and typecheck clean.

### Kept, with the reason

| Lead | Tool | Reason |
|---|---|---|
| 169 of knip's 177 unused exports and exported types | knip | Each is used inside its own module, so only the `export` keyword is idle; narrowing it removes no shipped byte (Rollup already drops unused exports), and 97 are named by string in tests and guards |
| `getMapDefaultsEpoch` (`lib/mapDefaultsChanged.ts`) | knip | Meets the bar, but it is the snapshot getter of the epoch-module shape CLAUDE.md names, beside `getFilesEpoch`, `getKeysEpoch` and `getBarChartFilesEpoch`; no shipped byte |
| The type re-exports in `lib/mapExplorerTypes.ts` and `lib/barChart/barChartFilename.ts` | knip | Deliberate import surfaces, as their comments say; erased at build |
| Seven duplicate exports (`*_DEFAULT` beside a `_set*ForTests` seam's live value) | knip | Test seams by design |
| `@testing-library/jest-dom` (dev) | knip | Unused, but a dev-tree change (package.json and lockfile, audit control owed), outside this strand; two test comments would need rewording. Lead for the next dev-tree pass |
| unlisted `geojson` (8 type-only imports) | knip | Resolves to `@types/geojson` through maplibre-gl and is erased at build; the honest fix is to declare it, not remove anything |
| All 40 backend routes | vulture and a path map | 31 have a literal caller; the file routes are reached through `storage.ts`, `/settings/map-defaults` through `/settings/${key}`, `/health` by its tests and the Vite proxy |
| Every crate in `src-tauri/Cargo.toml` | grep | All used |
| `allow(dead_code)` in `alerts.rs` and `widgets.rs`, and on `BG_TASK_ID` | grep | iOS-only modules compiled for host `cargo test`; the constant is read by `alertsPaths.parity.test.ts` |
| `core:webview:allow-set-webview-zoom`, `core:default` | | Kept by the brief (ACCESSIBILITY.md's zoom promise; `core:default` out of scope) |

### Test rows added or repaired in phase 3

| File | Row | Evidence |
|---|---|---|
| `frontend/src/lib/androidReachableCalls.test.ts` | every `#[tauri::command]` is registered; one row per entry that it has a caller; five strip proofs | Red on the pre-phase `lib.rs` (its three caller rows), on a removed caller, a commented-out caller, a dropped registration and an unregistered command |
| `frontend/src/lib/checklistProvenance.fixture.json` with both parity suites | nine location-id and location-name answers (`followUps`, `locName` in the verdict) | Each of the six gate sites removed turns its own side's verdict row red |
| `frontend/src/lib/checklistProvenance.fixture.json` | three breeding-code answers with truthy non-text values | Repaired, class (a) before: the Python truthiness revert left every row green; now red |
| `frontend/src/lib/atRouteServices.test.ts`, `backend/tests/test_checklist_provenance_parity.py` | weather lookup: four refused ids and a control, each side | Red with each side's weather gate removed |
| `frontend/src/lib/regionNames.test.ts`, `frontend/src/components/BirdingStatsPrototypeNames.test.tsx` | prototype-named State/Province cells; the subnational shape; the Statistics render | Red with the bare-key read, and with either pair of link gates reverted |
| `frontend/src/lib/barChart/parseBarChart.test.ts` | the `tidy` oracle over fixtures and a corpus; the source pin | Pin red on the previous `tidy`; corpus red on two wrong rewrites |
| `frontend/src/lib/tauriHttpScope.test.ts` | the opener and process grants are exactly the three the page uses | Red with `opener:default` restored, with reveal or exit added back, with another opener member added, and with the restart grant dropped |
| `frontend/src/lib/barChart/parseBarChart.test.ts` | names at 512 and 513 characters (comment only) | Its residual is retired by the code change; limit and inputs untouched |
