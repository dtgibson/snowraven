# Change Brief — big-old-life-lists

## What is changing
SnowRaven is made to hold a large, old eBird life list without failing, in five parts, with the measurement first:
1. **Measure.** Synthetic 300k, 600k and 1M-row exports (row shapes from `website/tools/gen-demo-data.mjs`), run through the Mac app, the iOS simulator, the Android emulator and a CPU-throttled browser on this Mac standing in for the Pi (the v1.0.20 4x/6x method). Record parse time, heap per copy (main thread and stats worker) and stats time per tab. No physical device (CLAUDE.md device boundary).
2. **Refuse on `file.size` before reading** (saved idea 22aa2e97), with the upload cap set per platform from the measurement. `refuseByContent` stays as the backstop.
3. **A compact in-memory observation representation** (interned strings, typed-array columns, or what the measurement picks), so each held copy shrinks several-fold. Nothing is persisted in a new shape.
4. **Splits and lumps back to about 2019**, from Cornell's own per-year files through the existing generator, fixed where it fails closed.
5. **Raise each cap a 1M-row export reaches**, each as a constant plus a re-measured budget. Extend `MILESTONE_THRESHOLDS` past 3,000. Drive pre-1970 and pre-1900 dates through every tab.
Changes: `lib/uploadGuard.ts`, `components/Settings.tsx` (`importFileContent`, `handleUpload`), `lib/importMechanism.ts` (dialog fallback), `backend/routers/settings.py` (`MAX_BYTES`, the web/Pi twin), `lib/statsOffThread.ts` budgets, `lib/observationsWorker.ts`, `lib/observationsCache.ts`, `types.ts` and the `ObservationEntry` consumers (42 non-test files today) as far as the chosen shape needs, `scripts/lib/taxonomyHistoryDerive.mjs`, `scripts/build-taxonomy-history.mjs`, `assets/ebird-taxonomy-history.json`, the caps in `exoticProvenanceCache.ts`, `checklistProjectsCache.ts`, `countyCompletenessCache.ts` and `countyDayObsCache.ts`, `lib/birdingStats.ts`, `docs/HELP.md` (lines 92 and 199), and their tests.
Does not change: the parse watchdog formulas, the widget hand-over, iCloud's 200 MB per-file bound, the parse-retention rules, any tab's layout, classes or tokens, `website/`, `README.md`, the App Store and F-Droid listings, `PRIVACY_POLICY.md`, and the unvirtualized "Show all N checklists" list (a ROADMAP item that needs its own run with a design pass).

## Why now
- The user directed it on 2026-10-18 ("Let's do all of these") after the big-old-life-lists assessment. At the reference export's ~330 bytes per row, the 50 MB cap holds about 150k observations. A decades-long or world list goes past that.
- Saved idea 22aa2e97 and ROADMAP, On the Horizon, Android item (6) (security I3): `handleUpload` reads the whole file before the size refusal. On Android's WebView that can crash the renderer instead of showing the size line.
- ROADMAP's splits-and-lumps residual (1): coverage starts at 2023, and 2022 fails closed on its Pink Pigeon lump.
- Memory is the open question. A parsed copy is ~19 MB at 21,856 rows and two are held, so a linear guess is about 0.9 GB per copy at 1M rows. The measurement replaces that guess.

## User-facing impact
- Where a platform's cap rises, an export refused today now loads. The "too large" line names that platform's limit and appears at once, without the file being read first.
- Splits and lumps lists more events, and its coverage statement on screen follows the asset, since it is derived and never typed.
- A lister past 3,000 species gets badges for the new thresholds in the existing milestone grid.
- Nothing else on screen should change. Page text on the reference export stays identical apart from the items above. The two `docs/HELP.md` sentences that name 50 MB and "10 to 3,000" follow the new numbers (no stop needed).
- No published surface (website, README, App Store or F-Droid listing, privacy policy) names any of these numbers, so none is edited. Any What's New line at the ship is held for the user's yes as usual.

## Design pass
Not needed: nothing changes visually. The new milestone thresholds render in the existing Uniform badge set at the existing tier 4, which every threshold of 1,000 or more already uses. No token, class, tier or grid rule changes, and no fifth tier is added.
The one visual risk is width. A five-digit label (`10,000`) widens `.sr-ms-num`, which is the v1.0.50 reversal trigger. So the Engineer re-measures the built grid at 320px, at 100% and 200% text, in Chromium and WebKit. If a label does not fit, the Engineer stops and routes to The Designer rather than changing the grid during the build.
Everything else is logic, data, budgets, tests, and Help sentences that follow the numbers.

## Decisions touched
- **Upload-size copy derives from its constant at the chokepoint** (DECISIONS ~747, v1.0.24). Kept per platform, and web/Pi stays twinned with the backend's `MAX_BYTES` under mutation tests. Two records are stale, because Settings now refuses on every platform: v1.0.13's "guard is absent on desktop and iOS" (~1089) and ROADMAP's "The 50 MB upload cap guards the web/Pi path ONLY". The Chronicler corrects both and closes Android item (6).
- **The stats worker holds a 19.2 MB copy, bounded by `STATS_WORKER_IDLE_MS`** (~841, v1.0.20). A compact shape, or transferring buffers instead of cloning them, changes that trade, so it is re-argued from the measurement.
- **`STATS_BUDGET_CEILING_MS` (240 s) is anchored to the parse budget's 230 s ceiling at the 50 MB cap** (~849). Raising any cap moves the anchor, so the ceiling is re-derived per cap to keep "anything that survived its parse has at least as long to compute".
- **Parse retention** (~1083-1087, v1.0.13): `indexOf` plus a character copy, never a slice or regex that keeps the source alive, held by a drift guard. Slice-based field extraction was excluded because it cannot be proved across three engines. The compact shape keeps both rules and is measured per engine. `speciesIndex`'s `WeakRef` memo keys on array identity, and the in-memory boundary means no `clearDerived` row (v1.0.20).
- **Two retention policies stay as they are.** v0.5.87 (~1475): the provenance checklist ledger is FIFO and the species index uses admission control. v0.5.86 (~1501): county completeness is 250 entries FIFO with a 4 MB code-unit budget. v1.0.5 (~1229): projects is fill-and-stop with no byte budget, justified by per-field bounds. A raised cap keeps its policy and is measured at capacity+1.
- **The day-obs peer merge stays on the main thread** (~442, v1.0.40). That decision reverses if `DAY_OBS_MAX_BYTES` rises. The 10 MB budget, not the 3,000-entry backstop, is what binds, so more day-obs room means moving `mergeSharedSnapshot`'s parse into a worker.
- **Splits and lumps** (~404, v1.0.41): coverage is derived from the asset, and each year must reproduce eBird's announced gained and lost totals or nothing is written. Events are resolved from Cornell's files, never typed by hand. 2022's Pink Pigeon lump is the known failure.
- **Milestone grid track minimum of 7.25rem** (~181, v1.0.50): a wider one-line badge item means a re-measure in the built app, in both engines.

## What done looks like
1. The measurement is recorded in the run's decisions first. It sets item 2's caps per platform and item 3's shape, and the Engineer writes down which shape was chosen and why before building either one.
2. On every input path, an oversized file is refused on `file.size` before it is read. The dialog fallback states its own answer in writing. The copy comes from each platform's constant, web/Pi stays twinned with the backend, and the stats ceiling is re-anchored.
3. The compact shape cuts heap per copy several-fold at 21,856 rows and at 1M rows, on each engine measured. Every tab's output is identical on the reference export, and the retention drift guards stay green.
4. Splits and lumps reaches back to about 2019 (the generator's date table has 2019, 2021 and 2022 rows and no 2020), and every year reproduces eBird's tally. **The Engineer stops for one input:** the user downloads each year's Cornell integrated checklist and eBird taxonomy CSV by hand into `scripts/taxonomy-history-input/` (birds.cornell.edu answers scripts with a 403), along with each year's announced tally if the run cannot read it.
5. Each cap a 1M-row export reaches is raised and measured at capacity+1, counting work done rather than time taken. A cap that cannot bind (`PROVENANCE_MAX_SPECIES` is already above the world list) stays, with that written down. Milestones run past 3,000 and are re-measured. Pre-1970 dates work on every tab, or the defects are recorded.
6. The full vitest suite, `npm run build` and the backend tests are green.
