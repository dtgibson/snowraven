# Schema: Visited Hotspots in Search

**Feature:** visited-hotspots-in-search
**Date:** 2026-11-13
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (43 FRs, 18 NFRs, 55 QA rows). Open Questions 3 and 4 are decided here from the measurement; Open Question 5 does not arise; the others keep their defaults.
**Extends:** `pipeline/command-palette/schema.md` (the overlay, its resolver, its one flat row array), `pipeline/species-code-search/schema.md` (the code ranking, the WeakMap memo shape) and `pipeline/hotspot-reports/schema.md` (what a location is, `buildLocationIndex`, the measured costs of section 12.5). Carried forward by reference.
**Ships as:** one patch bump across the six-file set (section 12). `main` is at 1.0.71, so this ships as 1.0.72 unless another ship lands first; the Deployer reads the number off `main` at ship time, never off this document.

**Outcome of the go or no-go measurement: GO, in the full form.** FR-33 applies; FR-34 and FR-35 do not; FR-03 does not arise. The figures are in section 0, and the two readings a reader should weigh before accepting that outcome are stated in 0.1, not left to the tables.

## Path

Frontend Only: no data layer change is required.

## Architect assessment

> **Architect assessment: Frontend Only**
>
> SnowRaven has no database. Its data layer is the documents under `AppLocalData/data/` (mirrored by the web/Pi backend), the epoch modules that announce a change to them, the durable caches behind the `storage` seam, and the pure `lib/` modules that derive what the UI shows. Every user story and requirement was checked for a record created, read from a new source, updated or deleted, a stored relationship, or a derived value that is stored. There is none: the feature derives one in-memory index from the parse the app already holds, routes one Location ID through component state, and writes nothing. Proceeding on this assessment per the hands-off run.

## Confirmation

Nothing is persisted, no route is added, and no third-party request, new endpoint or host, or request moved between components is introduced (section 8 makes each of those checkable). What follows is the measurement, then the module and data-shape design the Engineer builds from.

Settled by reading the code and by measuring, not from the PRD alone. Each is returned as a flag in the hand-back:

1. **FR-33's "same update" and NFR-02's "none of it before destinations have painted" collide in one case, and the gate wins.** When the backup was parsed before Search was opened and the file-status read answers before the overlay's first frame, deriving the locations in the species update would run the derivation before destinations have painted. Section 4.2 holds the derivation back to the first frame in that case only. In every other open the location rows join in the species update, as FR-33 says.
2. **The layout of the search text decides whether a hostile file is linear, and two obvious layouts are not.** A lowercased name per record reads up to 14 per doubling at the cap, and a dense array of lowercased names up to 4, from the memory hierarchy alone. One flat string reads 2.0 (0.6, 2.5).
3. **The derivation's own doubling quotient depends on where the legs sit** (0.1, 0.5). At the house method's cache-resident legs it passes; at the cap-size doublings it reads up to 2.7 in V8 and 3.0 in JavaScriptCore, as the tab's own index does on the same legs in the same run. This is the one judgment in the outcome, and it is the user's to overrule.
4. **`buildPaletteRows` cannot grow a field** without editing existing assertions, which NFR-05 forbids, so the third group is added by a wrapper (section 3) and the shipped function stays byte-identical. The new overlay prop is optional for the same reason.
5. **A whitespace-only location name cannot come out of the parser** (FR-15 c): `entryFromRow` trims the Location cell, so such a cell is the empty name and FR-15 (b) applies. The derivation still handles a whitespace-only string handed to it directly, and a row pins it.
6. **FR-10's parenthesis is false for one character.** Lowercasing can lengthen a name (U+0130 becomes two code units), so a bounded name's search text can be longer than the bound, and the query bound can then change a result. Recorded as a stated limit in 2.5.
7. **`website/tools/verify/verify-palette.mjs` is published by the Pages deploy.** If the build extends it for the real-engine rows (QA-13, QA-49, QA-50), that edit is a held patch in the pipeline folder until the user's yes, as `verify-hotspot-reports.mjs` was.
8. **QA-43 asks the committed guard's rows to read at most 2.2 per doubling.** Asserted in CI at that number a correct build would flake: the sound readings sit between 1.96 and 2.37 against limits of 2.2 and 2.39. The committed guard asserts the house limits over a tenfold span and prints each per-doubling quotient; the 2.2 judgment is made on recorded figures at each of the three measurements (10.3).

---

## 0. The go or no-go measurement (FR-02 a)

Taken before any design work, on the pure functions, in V8 and in JavaScriptCore. The candidate is real code, not a model: the location pass and the match of section 2, run against the repo's own modules. It lives in the session scratchpad and nowhere in `frontend/src`.

### 0.1 Outcome

**The full form passes all five gates. The ladder stops at its first rung.** No gate number was changed.

| Gate | Limit | V8 | JavaScriptCore | Result |
|---|---|---|---|---|
| R1, added by the location half, worst of ten queries | 4 ms | 0.10 ms | 0.10 ms | Pass, by more than 35 times |
| R1, whole keystroke build, worst of ten queries | 16 ms | 0.43 ms | 0.56 ms | Pass, by 28 times |
| R2, added to the first open after a file load (the derivation's first call) | 50 ms | 18.2 to 21.3 ms | 7.6 to 8.6 ms | Pass, by more than twice |
| R2, later opens and keystrokes | zero derivations | one build for sixty calls on one parse | the same | Pass |
| R3, the per-keystroke scan, each doubling | 2.2 | 1.96 to 2.05 on the uniform fixture, 2,500 to 150,000 locations | 1.93 to 2.05 | Pass; the other fixtures' readings are in 0.5 |
| R3, the derivation, each doubling at the house legs | 2.2, or the limit derived from its sort (2.37 to 2.39) | 2.03 to 2.37 hostile, 1.94 to 2.11 realistic | 2.14 to 2.32 hostile, 2.01 to 2.13 realistic; one wall-clock reading of 2.42 | Pass at the house legs; see below |
| R3, location half against species half at 150,000 distinct, same run | at most 1 | at most 0.46 (0.15 on ordinary text) | at most 0.11 | Pass |
| R3, rendered rows capped with a line; names bounded before matching and render | by structure | `LOCATION_CAP`, `boundText` at 200 | | Pass |
| R4, retained heap at the realistic cap | 5 MB | 0.30 MB | 0.27 MB | Pass, by 16 times |
| R4, unreachable when the parse is replaced or cleared | asserted | collected; the strong-slot control is not | the same | Pass |
| R4, the entry chunk | nothing new | no new module (section 7) | | Pass, by structure |
| R5, destination and species rows, Enter's first row | unchanged | identical to the shipped function's over 17 queries, by construction | the same | Pass |

**Two readings to weigh before accepting that table.**

1. **R3's linearity is judged at the house method's legs, and the derivation does not hold 2.2 at the cap-size doublings.** The house method (`hotspot-reports` schema 13.1, `lifeListsLinearity.test.ts`) sizes its legs to stay cache-resident, because a leg that leaves the cache measures the memory hierarchy. At those legs (2,500 to 20,000 rows) the derivation reads 2.03 to 2.37 against a limit of 2.37 to 2.39 derived from the locations it sorts, as NFR-09 allows; the margin is thin. At the cap-size doublings (18,750 to 150,000 rows) it reads 2.1 to 2.7 in V8 and 2.2 to 3.0 in JavaScriptCore (one wall-clock reading of 3.5). The tab's own index, shipped at 1.0.71, reads up to 2.8 and 2.9 on the same legs in the same run; the shipped species pass reads 2.2 to 2.4. Every phase of the pass shows it, not one of them (0.5), which is what the memory hierarchy looks like and what a quadratic does not. **If the gate is read as applying at the cap-size doubling, the derivation fails it, and it fails in all three forms, because all three share it: the outcome would be "does not ship".** I have taken the house reading, because the gate names the house method. It is the one judgment in this outcome.
2. **A hand-built file is slow in two places, and neither is worse than what Search does on such a file today** (0.5). With 150,000 distinct locations the derivation costs between a sixth of a second and nearly a second, once, on the first Search open: 0.16 to 0.35 s with short names, 0.49 to 0.94 s with names at the bound. The shipped species pass costs 0.21 to 1.05 s on a like file with 150,000 distinct species. And where every one of those names is 192 repeats of one letter and the query is built for it, the location half of a keystroke costs 0.26 s in V8 (0.015 s in JavaScriptCore), beside a species half of 0.57 s on the same text in the same run. No gate limits the derivation figure; R2 is set at the realistic cap, where the same pass is 8 to 21 ms. No eBird export has either shape.

### 0.2 Method, and what was and was not measured

- **Machine.** The developer Mac (Apple M1 Pro, 8 cores), 2026-11-13. Another session ran browser probes on it throughout, so nothing here was taken on an idle machine: the one-minute load average was between 1.4 and 4.6 at the start of every run and is recorded in each run's file. Runs were sequential, one process at a time.
- **Engines.** V8 13.6 in Node 24.18.0, and JavaScriptCore as the system `jsc` shell (`/System/Library/Frameworks/JavaScriptCore.framework/Versions/Current/Helpers/jsc`), the engine the Mac, iPhone and iPad apps run.
- **Clocks.** V8 figures are process CPU time through the repo's own `frontend/src/test/cpuTiming.ts` (`bestPerCallCpuMs` and `cpuMs`), which counts the engine's helper threads too, so they bound main-thread CPU from above. **The `jsc` shell has no process CPU clock, so every JavaScriptCore figure is wall clock** (`preciseTime`), through a twin of the same procedure: an untimed first call, a batch per leg, legs interleaved with a rotating start, the best sample per call. A JavaScriptCore figure can therefore include time another process held the core; that is stated, not corrected.
- **Code under test.** The scratch entries import the real `paletteRows.ts`, `speciesIndex.ts`, `speciesMatch.ts`, `alphaCodes.ts` with the real code asset, `hotspotReports.ts`, `lifeLists.ts`, `lifeListsRegion.ts`, `hotspotReportsCopy.ts`, `tabLayout.ts`, `parseEbirdObservations.ts` and `observationsPacked.ts`, bundled with esbuild 0.28.2 for each engine.
- **Fixtures.** Each is CSV text put through the real parser (`packEbirdObservations`, the string table re-created as a structured clone leaves it, `materializeObservations`), so entries have the shape and the string sharing the main thread sees.
  - **The realistic cap:** 150,000 rows, 3,000 species (real names from the bundled taxonomy), 2,000 locations, 21,429 checklists, rows in species-major order so checklists interleave. Place names of 4 to 60 units; 20 pairs sharing a name in different places, 10 sharing name and place, 3 unnamed. Its column is 57,294 code units. A second copy carries a curly apostrophe in one place name and weather emoji in every tenth checklist's comments, so its text and its column are two-byte, as a real export's usually are.
  - **The hostile shape:** 150,000 rows, every row its own checklist and its own location, the names shuffled against their sorted order. Names short and distinct (about 27 units), or at the 200 bound sharing a 192-unit prefix; each also all lowercase, and the bound shape once more with a single unit outside Latin-1. For the comparison with species, every row is also its own species.
- **Readings.** R1: 3 processes per engine, 5 trials each, each trial the best of 9 interleaved rounds (15 readings per cell; 10 on the two-byte fixture). R2 first call: 7 fresh processes per engine per subject, nothing warmed but the parse. R3: 2 processes per shape and leg set, and one more for the reference rows. The comparison: 2 processes of 3 trials, and one process of one trial on the repeated-letter text. R4: 5 trials in one process, a forced collection before and after each. A figure is a first call or a best-of, and says which.
- **Not measured, and not claimed.** No browser and no built app: Chromium and WebKit are the Engineer's measurement (FR-02 b). No device. No CPU time in JavaScriptCore. R2's clause that none of the work precedes the first paint cannot be measured on pure functions; it is met by structure (4.2) and held by a spy row (10.5), and the Engineer measures it in the built app. Scratch files: `/private/tmp/claude-502/-Users-developer-devwork-snowraven/62fd3fac-64b8-4883-9476-1f1c8d5502d9/scratchpad/vhs/src/` (the candidate and the harness) and `/private/tmp/claude-502/-Users-developer-devwork-snowraven/62fd3fac-64b8-4883-9476-1f1c8d5502d9/scratchpad/vhs/out/` (every run's output).

### 0.3 R1 and R2 at the realistic cap

**R1, the whole synchronous build for one keystroke, in milliseconds.** "Shipped" is `buildPaletteRows` as it stands; "with" adds the third group. Each cell is the median of its readings; the last column is the worst case, the largest "with" reading less the smallest "shipped" one. Destinations are the fourteen real labels; the species half includes the code ranking against the real code asset.

| Query (rows it returns) | V8 shipped | V8 with | V8 worst added | JSC shipped | JSC with | JSC worst added |
|---|---|---|---|---|---|---|
| `a`, one character (9 destinations, 50 species cut, 50 locations cut) | 0.290 | 0.290 | 0.041 | 0.463 | 0.465 | 0.040 |
| `e`, one character | 0.276 | 0.277 | 0.015 | 0.471 | 0.471 | 0.028 |
| `park` (3 species, 50 locations cut) | 0.239 | 0.244 | 0.019 | 0.299 | 0.304 | 0.045 |
| `lake` (50 locations cut) | 0.294 | 0.302 | 0.026 | 0.316 | 0.322 | 0.030 |
| `war` (50 species cut, 23 locations) | 0.205 | 0.218 | 0.024 | 0.299 | 0.303 | 0.026 |
| `red` (50 species cut, 24 locations) | 0.314 | 0.376 | 0.080 | 0.329 | 0.335 | 0.036 |
| `maow`, a listed bird's code (1 species) | 0.243 | 0.254 | 0.025 | 0.316 | 0.319 | 0.023 |
| `amro`, no match, first letter common | 0.340 | 0.403 | 0.081 | 0.336 | 0.399 | 0.104 |
| `cedar lake`, no match | 0.244 | 0.275 | 0.042 | 0.317 | 0.347 | 0.061 |
| `zzqxv`, no match, first letter absent | 0.184 | 0.186 | 0.012 | 0.294 | 0.297 | 0.025 |

- **Worst total:** 0.419 ms in V8, 0.494 ms in JavaScriptCore. **Worst added:** 0.081 ms and 0.104 ms. **The location half timed alone** never passed 0.056 ms and 0.060 ms.
- **On the two-byte fixture:** worst total 0.432 ms and 0.563 ms; worst added 0.095 ms and 0.091 ms; the location half alone at most 0.069 ms and 0.054 ms.
- **The first build of a process, cold,** including the shipped one-time code index: 4.0 to 7.1 ms of CPU in V8 over 5 processes, 4.0 to 4.6 ms in JavaScriptCore.
- **In counts, which no machine moves:** a keystroke makes `min(matches, 50) + 1` native searches: 51 for `a`, 24 for `war`, 1 for a query that matches nothing.
- **With 2,000 names all at the 200 bound,** the worst query the engine's search could be given cost 0.17 ms in V8 and 0.013 ms in JavaScriptCore.
- **The shipped overlay is not over 16 ms on this fixture** (0.2 to 0.6 ms at 3,000 species), so no separate finding is owed and the feature is judged on both limits.

**R2, the derivation, in milliseconds, minimum / median / maximum.**

| Subject | V8 first call (CPU, 7 processes) | V8 best of (CPU) | JSC first call (wall, 7 processes) | JSC best of (wall) |
|---|---|---|---|---|
| **The location pass, realistic cap** | **18.15 / 18.22 / 18.93** | 5.37 to 5.71 | **8.13 / 8.32 / 8.55** | 4.25 to 4.60 |
| The location pass, realistic cap, two-byte text | 20.40 / 20.58 / 21.34 | | 7.64 / 7.92 / 8.59 | |
| The shipped species pass, same fixture, for scale | 8.94 / 9.00 / 9.08 | 4.86 to 5.06 | 8.17 / 8.57 / 8.85 | 4.55 to 4.77 |

Per re-draw the cost is zero: sixty memoized calls on one parse ran one build. A session that never opens Search runs none, because the module is reachable only from the lazy overlay.

### 0.4 R5 at the function level

`buildSearchRows` calls the shipped function and appends (section 3), so its destination and species rows are that function's output. The measured candidate carried the shipped body inline instead, which is the harder case, and was compared with the shipped function over 17 queries (the ten above, an empty one, a whitespace-only one, a mixed-case one, a state code, a place name that is also a county's, a Location ID and `unnamed`): identical rows, counts and species cut in every case; an empty and a whitespace-only query return no location; a state code and a Location ID that are in no name return none; `unnamed` returns the three unnamed locations. That a county or a place label is never matched is held by the comparison with the literal rule in 0.7. The rendered half of R5, the existing suites and the first commit, is the Engineer's.

### 0.5 R3 and R4: hostile files, memory and lifetime

**The per-keystroke scan, each doubling.** Best of 3 trials, 2 processes. "The uniform fixture" is every row its own location with names at the bound: its legs differ only in length, so it isolates growth.

| Shape | Legs (locations) | Query | V8 quotients | JSC quotients | At the largest leg, V8 / JSC |
|---|---|---|---|---|---|
| The uniform fixture | 18,750 to 150,000 | no match, first unit absent | 1.98 to 2.04 | 1.96 to 2.05 | 0.69 ms / 0.97 ms |
| The same | the same | a 100-unit near miss | 1.99 to 2.01 | 1.96 to 2.05 | 4.4 ms / 0.97 ms |
| The same | the same | a periodic near miss | 2.00 | 1.95 to 2.05 | 12.4 ms / 0.97 ms |
| The same, all lowercase | the same | the three above | 1.98 to 2.03 | 1.96 to 2.05 | 0.72 ms / 1.00 ms |
| The same, one unit outside Latin-1 (a two-byte column) | the same | the three above, and no match with a common first unit | 1.97 to 2.05 | 1.93 to 2.05 | 14.6 ms / 2.2 ms at worst |
| The uniform fixture | 2,500 to 20,000 | all four | 1.96 to 2.04 | 1.99 to 2.01 | 1.9 ms / 0.13 ms at worst |
| Short names | 18,750 to 150,000 | no match, first unit absent | 2.01 to 2.15 | 1.99 to 2.01 | 0.12 ms / 0.13 ms |
| The same | the same | no match, first unit common | 1.87 to 1.91 | 2.00 to 2.01 | 2.7 ms / 2.7 ms |
| Short names, and the same all lowercase | 2,500 to 20,000 | no match, first unit common | **2.30 to 2.36**, then 2.07 to 2.10, then 1.91 to 1.93 | 2.04, then 2.00 to 2.01, then 1.99 to 2.00 | 0.42 ms / 0.36 ms |
| The same | the same | no match, first unit absent | **2.08 to 2.26**, then 1.89 to 1.96, then 1.81 to 1.87 | 2.02 to 2.04, then 1.99 to 2.01, then 1.99 | 0.015 ms / 0.018 ms |
| The realistic shape, a different generated file per leg | 250 to 2,000 | no match, first unit common | 2.09 to 2.15, then **2.22** | 1.85 to 2.07, then **34** | 0.054 ms / 0.037 ms |
| A one-character query | every leg of every shape | | 0.95 to 1.42 | 0.95 to 1.39 | 0.001 to 0.002 ms |

**The readings above 2.2 on this scan, and why none is growth.**

- **The short-name fixture's first doubling, 2,500 to 5,000 locations, in V8.** Per location that scan costs 17.6 ns at 2,500, 20.8 at 5,000, 21.6 at 10,000 and 20.9 at 20,000, and 21.1, 20.1, 18.8 and 17.9 ns from 18,750 to 150,000: flat within a fifth across a sixty-fold range, and lowest at the two ends. The smallest leg's column (67,075 units) fits the first-level cache and the next does not, and its names hold 3.5% fewer of the query's first letter. The absent-first-unit row there is a call of two microseconds.
- **The realistic shape's top doubling.** Its four legs are four different generated files, and a native search's speed depends on the text it is given. In JavaScriptCore the same query ran at 0.035 ns a unit on the realistic cap's column and at 0.67 ns a unit on the short-name fixture's, on the column and on a rebuilt copy of it alike, so the difference is the text and not the string's form; the leg that reads 34 is a file whose text tips that engine from its faster search to its slower one. Within either speed it is linear: 0.66 ns a unit at 18,750 locations and at 150,000. A fixed text read at thirteen lengths from 8,000 to 1,000,000 units costs the same per unit at every length in both engines.
- **So the uniform fixture is the gate's row,** and it reads 1.93 to 2.05 at every doubling from 2,500 to 150,000 locations in both engines.

**The mutant,** a search restarted at every location and left to run to the column's end, reads 3.97 to 4.14 per doubling on the absence leg in both engines (918 ms in V8 and 1,287 ms in JavaScriptCore at 20,000 locations, against 0.09 and 0.13 ms). So this leg sees the defect it exists for.

**The derivation, each doubling.** Best of 3 trials, 2 processes and a third for the reference rows; the limit is 2.2 for a pass that does not sort a growing set, and `2.2 x log2(larger) / log2(smaller)` over the locations each leg sorts where it does.

| Shape | House legs, 2,500 to 20,000 rows: V8 / JSC | Limit | Cap-size legs, 18,750 to 150,000 rows: V8 / JSC | Limit |
|---|---|---|---|---|
| Every row its own location, short names | 2.20 to 2.35 / 2.14 to 2.29, and one reading of 2.42 | 2.37 to 2.39 | 2.20 to 2.23, 2.43 to 2.48, 2.69 to 2.71 / 2.20 to 2.22, 2.60 to 2.63, 2.88 to 3.00 | 2.34 to 2.35 |
| The same, all lowercase | 2.19 to 2.29 / 2.14 to 2.32 | the same | not run | |
| Every row its own location and its own species | 2.37, 2.35, 2.03 / 2.30, 2.16, 2.30 | the same | 2.14, 2.49, 2.61 / 2.54, 2.59, 3.54 | the same |
| Every row its own location, names at the bound | 2.09 to 2.21 / 2.14 to 2.22 | the same | 2.22 to 2.23, 2.30, 2.32 to 2.36 / 2.26 to 2.27, 2.37 to 2.39, 2.57 to 2.58 | the same |
| The same, all lowercase | 2.10 to 2.22 / 2.15 to 2.19 | the same | 2.18 to 2.19, 2.27, 2.37 to 2.39 / 2.26 to 2.39, 2.39 to 2.43, 2.46 to 2.57 | the same |
| The same, two-byte | not run | | 2.21 to 2.22, 2.30 to 2.34, 2.38 to 2.41 / 2.26 to 2.27, 2.43 to 2.45, 2.35 to 2.38 | the same |
| The realistic shape (a location per 75 rows) | 1.94 to 2.11 / 2.01 to 2.13 | 2.2 | 2.33 to 2.48, 2.49 to 2.56, 2.57 to 2.67 / 2.54 to 2.65, 2.46 to 2.54, 2.63 to 2.91 | 2.2 |

- **At the house legs** V8, on CPU time, has no reading over its limit in 22 runs; the closest is 2.37 against 2.39. The reading of 2.42 is one of four JavaScriptCore wall-clock readings at that doubling; its larger leg read 11.91 ms where the other three read 10.35 to 10.40 ms.
- **At the cap-size legs most doublings after the first are over the limit.** For reference, over the same legs in the same run, with every row its own location and its own species: the tab's index (`buildLocationIndex`) reads 2.51, 2.40, 2.77 in V8 and 2.55, 2.61, 2.62 in JavaScriptCore; the shipped species pass reads 2.18, 2.28, 2.29 and 2.30, 2.33, 2.37; this pass is the third row above.
- **By phase,** at the cap-size legs with short names, V8 then JavaScriptCore: the rows and records 2.18, 2.32, 2.66 and 2.27, 2.70, 3.36; the sort 2.29, 2.62, 2.62 and 2.47, 2.71, 2.86; the namesake runs 2.82, 3.22, 3.60 and 2.51, 4.76, 4.09; the column 2.77, 2.53, 3.76 and 2.73, 3.21, 3.37. Every phase rises together as the legs grow past the cache. On the realistic shape the pass costs 25 ns a row at 18,750 rows and 52 ns at 150,000: it is little but memory reads, so the cache is most of its quotient, where the tab's index, which computes far more per row, reads 2.0 on that shape.
- **In absolute terms at the cap,** best of: 164 to 174 ms in V8 and 163 to 167 ms in JavaScriptCore with short names; 605 to 620 ms and 494 to 543 ms with names at the bound; 636 to 641 ms and 876 to 941 ms when that file's text is two-byte; 591 to 601 ms and 509 to 530 ms with names of one repeated letter. First call, 7 fresh processes: 310 / 322 / 352 ms and 162 / 168 / 206 ms with short names; 685 / 688 / 717 ms and 495 / 514 / 532 ms at the bound. The sort is four fifths of it at the bound (531 of 669 ms in V8).
- **The shipped species pass on a like file,** 150,000 distinct species, same runs: 207 to 220 ms in V8 and 338 to 360 ms in JavaScriptCore with ordinary names; 389 to 400 ms and 1,017 to 1,051 ms with 200-unit names sharing a prefix; 282 to 287 ms and 809 to 811 ms with names of one repeated letter.

**The location half against the species half at 150,000 distinct of each, same run** (NFR-03), in milliseconds, minimum to maximum of 6 readings over two name shapes:

| Query | V8 species half | V8 location half | JSC species half | JSC location half |
|---|---|---|---|---|
| One character | 40.6 to 54.5 | 0.001 | 85.3 to 105.9 | 0.001 to 0.002 |
| Ordinary (`mar`) | 27.1 to 38.3 | 0.001 to 0.004 | 52.2 to 63.7 | 0.001 to 0.003 |
| Rare (`9999`) | 27.2 to 37.3 | 0.91 to 1.39 | 48.0 to 56.1 | 4.08 to 5.25 |
| No match | 24.5 to 35.3 | 0.12 to 0.71 | 47.4 to 54.2 | 0.13 to 0.97 |
| A 100-unit near miss, names at the bound | 29.7 to 30.4 | 4.36 to 4.37 | 45.9 to 51.3 | 0.97 to 0.98 |

The worst ratio in one run on this text is 0.15 (V8, the near miss). With 200-unit species names the species half is 46 to 92 ms in V8 and 96 to 188 ms in JavaScriptCore. The species half lowercases every name and sorts its matches on every keystroke; the location half's text was lowercased and its order fixed at derivation.

**The worst text a file can hold for this scan,** measured the same way, one process per engine: every name 192 repeats of one letter and then its digits, locations and species alike.

| Query | V8 species half | V8 location half | JSC species half | JSC location half |
|---|---|---|---|---|
| `ab` | 572 | 259 | 79 | 0.98 |
| `aab` | 570 | 260 | 81 | 0.97 |
| `a0a` | 569 | 261 | 149 | 15.1 |
| Six of the letter, then `b` | 287 | 117 | 79 | 0.97 |
| 100 of the letter, then `b` | 212 | 63 | 78 | 0.97 |
| 199 of the letter, then `b` | 59 | 2.9 | 78 | 0.97 |
| 200 of the letter | 61 | 1.8 | 77 | 2.2 |
| No match, first unit absent | 41 | 0.70 | 78 | 0.97 |

**So the location half's worst keystroke is 0.26 s in V8 and 0.015 s in JavaScriptCore,** on a file built for it and a query built for it, and it is under half of what the shipped species half costs on that text (ratio 0.46). The Hotspot Reports picker's own worst, on the same kind of file, was recorded at 97 ms a scan and two scans a keystroke.

**R4, retained heap,** a forced collection before and after, 5 trials (V8: heap plus typed arrays; JavaScriptCore: `gcHeapSize`):

| File | The location index, V8 / JSC | Its column | For scale: the tab's index, the species index |
|---|---|---|---|
| **Realistic cap** | **0.29 to 0.31 MB / 0.26 to 0.32 MB** | 57,294 units | 4.5 to 4.7 MB / 6.9 to 7.2 MB; 0.14 MB / 0.13 MB |
| Hostile, short names | 21.0 MB / 20.0 MB | 4.1 million units | 52.7 to 54.0 MB / 48.2 to 51.9 MB |
| Hostile, names at the bound | 45.8 MB / 44.9 MB | 30.2 million units, one byte each | 77.6 to 78.8 MB / 73.0 to 76.7 MB |
| Hostile, names at the bound, one unit outside Latin-1 | 74.6 MB / 73.6 MB | the same units, two bytes each | |

**The bound that limits the hostile figure:** one record and at most 401 column units per location, two bytes each at most, with locations at most the rows the upload cap admits; and never more than 2^28 units whatever the file (2.6). The index is released with its parse.

**Lifetime, both engines, forced collection:** the index is alive while its parse is alive; a second call returns the same object with zero rebuilds; after the parse is dropped the index is collected; a strong module slot holding an index, the species memo's shape, is not collected. So the probe can see a retained index, and the `WeakMap` does not retain one.

### 0.6 What the measurement ruled out

- **Calling `buildLocationIndex` for Search** (Key Decision 6). Its first call at the realistic cap read 48.1 to 53.3 ms of CPU in V8 over 14 fresh processes in two batches, 6 of them over R2's 50 ms; 29.0 to 39.8 ms in JavaScriptCore. It retains 4.5 to 4.7 MB in V8 and 6.9 to 7.2 MB in JavaScriptCore, over R4's 5 MB there. It sits on one gate's limit and is over another's in one engine; the slim pass passes both by more than twice.
- **A lowercased name on each record.** At 150,000 locations with names at the bound, a no-match keystroke read 0.24, 0.51, 1.02 and then 14.4 ms across the four cap-size legs in V8 (quotients 2.1, 2.0, 14.1) and 0.39, 1.27, 4.74, 14.7 ms in JavaScriptCore (3.3, 3.8, 3.1). The walk is one read per location; the records and strings sit in memory in file order and are read in name order.
- **A dense array of lowercased names, built in name order.** It reads 2.0 where lowercasing allocates a new string. Where a name is already lowercase the engine hands back the same string, the array points back into the parse, and JavaScriptCore read 3.2, 3.2 and 4.0 (14.0 ms at the cap).
- **The flat column** reads 2.0 at every doubling of the uniform fixture, and at the cap costs a fifteenth to a twentieth of the first layout: 0.69 ms in V8 and 0.97 ms in JavaScriptCore for that keystroke. An adversarial 100-unit near miss costs 4.4 ms on it in V8, where a dense array read 49 ms.
- **The deferred and threshold forms** were not measured as forms: the ladder stops at the first that passes. Both would share this derivation and this match.

### 0.7 Parity and correctness, measured in scratch in both engines

- **Against the tab,** over 4,005 generated files through the real parser (21,000 locations; 374 with the ID shown, 1,405 truncated, 2,097 unnamed), the three failure returns first: zero differences in the set of Location IDs, in name, truncation and place, in the shown name, in `showId`, and in order against `pickerOrder`. At the realistic cap and at 150,000 distinct locations: zero. The named wrong derivation (a location per row) differs from the tab on 3,777 of the files.
- **The match against the PRD's rule read literally,** one location at a time: zero differences over 136,170 calls returning 52,484 rows, at the real cap and at a cap of 2. The one designed difference, a query holding a line feed, is checked to return nothing.
- **Hostile names:** `__proto__` and `constructor` as names and as Location IDs are listed, found and returned; `unnamed` finds the empty-named location; a 200-unit query finds the 200-unit name and a 201-unit query finds nothing; text past the bound and the ellipsis find nothing; a name cut at a surrogate pair is 199 units with no lone surrogate; a multi-line name is found by a word on either line and by no query holding a line feed; `Object.prototype` is untouched; the column ceiling patched down makes the derivation refuse.


---

## Existing data used by this feature

Nothing below is modified.

### Stored documents

| Document | This feature |
|---|---|
| `data/ebird-backup.csv`, `data/metadata.json` | Read only, through `storage.getFilesStatus()` and `loadEbirdObservations()`, by the overlay's existing effect. The count of each read per open is unchanged: the location half adds no read of its own |
| `data/ml-export.csv`, `data/api-keys.json`, `data/settings.json`, every derived store, `lib/clearDerived.ts`, `ITEM_SUBDIRS` and its Rust twin | Not read and not written by Search. The Hotspot Reports tab reads what it reads today when a location row opens it |

### Parsed rows

**`ObservationEntry`** (`frontend/src/types.ts`), from `loadEbirdObservations().observations`, the cache's own array. Fields the location pass reads: `submissionId`, `locationId`, `location`, `county`, `stateProvince`. Nothing else. The array's IDENTITY is the memo key (2.4).

### What the tab already defines, used by identity

`boundText`, `LOCATION_ID_MAX_CHARS` (16) and `LOCATION_NAME_MAX_CHARS` (200) from `lib/hotspotReports.ts`; `placeOf` and `STATE_CODE_SCAN_CHARS` (16) from `lib/lifeLists.ts`; `COUNTY_CELL_MAX_CHARS` (96) from `lib/lifeListsRegion.ts`; `displayName` and `UNNAMED_LOCATION` from `lib/hotspotReportsCopy.ts`; `buildLocationIndex` itself, as the oracle of the parity suite only.

### Requests

Search makes none. Opening the tab from a location row can cause the tab's existing requests exactly as choosing that location in the tab's picker does: `/map/hotspot-region` inside the shared Set, the batched `/taxonomy/codes` post, map tiles and style through `<SnowMap>`, favicons through `<BirdName>`. On web and Pi the two seam reads above are existing calls to the user's own server.

---

## Changes in this feature

### Added

Library modules, both under `frontend/src/lib/` and both matching one new glob, `frontend/src/lib/paletteLocations*.ts` (9.4):

1. **`paletteLocations.ts`**: the location pass, its memo, and the per-keystroke match (section 2).
2. **`paletteLocationsLoad.ts`**: the first-frame gate and the one decision of when to derive (section 4).

Suites (names fixed so the glob gates them): `paletteLocations.test.ts`, `paletteLocationsParity.test.ts`, `paletteLocationsLinearity.test.ts`, `paletteLocationsLifetime.test.ts`, `paletteLocationsLoad.test.ts` under `frontend/src/lib/`; `CommandPalette.locations.test.tsx` under `frontend/src/components/`; `HotspotReportsTab.request.test.tsx` under `frontend/src/components/hotspotReports/`; and the App-level rows of QA-26 to QA-28 beside the suite that already drives the species route from the overlay.

### Modified

1. `lib/paletteRows.ts`: gains the `location` row kind and `buildSearchRows` (section 3). `buildPaletteRows` is not edited.
2. `components/CommandPalette.tsx`: the location half's state, the third group, the sentences (section 4). One new optional prop.
3. `lib/paletteCopy.ts`: the strings of section 6.
4. `App.tsx`: the requested-location state and two callbacks (section 5). No new static import.
5. `components/hotspotReports/HotspotReportsTab.tsx`: two optional props, one consume effect, one reveal (section 5). Nothing else in the tab's modules.
6. `lib/entryChunk.test.ts`, `lib/palettePublishedClaims.test.ts`: new rows (7, 11). The three existing assertions that pin a string FR-36 changes are edited and listed in `decisions.md`: `CommandPalette.test.tsx` line 381 (the no-backup sentence) and `HelpDocs.test.tsx` lines 304 and 309 (the accessible name). No other existing row is edited.
7. `docs/HELP.md`, `ACCESSIBILITY.md` (section 11).
8. Rule files: `.claude/rules/security.md` and `.claude/rules/ui.md` gain `paths` entries in the same change (9.4).

### Unchanged (used, not modified)

`lib/paletteSpeciesLoad.ts` and its suite (the resolver is reused as it stands, 4.1), `lib/speciesIndex.ts`, `lib/speciesMatch.ts`, `lib/alphaCodes.ts`, `lib/observationsCache.ts`, `lib/filesChanged.ts`, `lib/useFilesEpoch.ts`, `lib/hotspotReports.ts`, `lib/hotspotReportsPicker.ts`, `lib/hotspotReportsLocation.ts`, `lib/hotspotReportsKind.ts`, `lib/hotspotReportsProvenance.ts`, `lib/hotspotReportsCopy.ts`, the tab's picker, overview and report components, `lib/lifeLists.ts`, `lib/lifeListsRegion.ts`, `transport.ts` (`CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`), `storage.ts`, `frontend/vite.config.ts`, `src-tauri/tauri.conf.json`, `src-tauri/capabilities/**`, every backend file, every `lib/tauri/` service, `clearDerived.ts`, `cacheInventory.test.ts`, `README.md`, `website/` other than the version stamp, `appstore/LISTING.md`, `PRIVACY_POLICY.md`, `website/privacy.html`, the F-Droid listing text.

---

## 1. Data flow, stated once

```
Search opens (CommandPalette mounts; destinations render in the first commit, from a prop)
  effect [filesEpoch]:  species = pending, locations = none          (one commit; a replaced file's rows leave together)
    resolvePaletteSpecies(...)        unchanged: status read, shared parse, species index
      then:  species = answer
             locations = locationsAtAnswer(observations, framed)      memo hit: the index, no work
                                                                       miss, first frame presented: derive now, SAME commit
                                                                       miss, first frame not yet presented: leave none
  first frame presented (once per mount):  framed = true; if observations wait, derive and set locations

each keystroke (render):  buildSearchRows({ ...shipped inputs, locations })
                            = buildPaletteRows(...)  +  matchLocations(index, q, LOCATION_CAP)

a location row chosen:  onOpenLocation(locationId); onClose()
  App: collapse a fullscreen Map Explorer; activeTab = 'hotspot-reports'; requestedLocation = locationId
  HotspotReportsTab: when its phase has settled for the current files epoch, consume once and clear
```

Nothing above runs at launch, on a file load, or on any tab. The location pass is reachable only from `CommandPalette.tsx`, which is lazy.

---

## 2. The location module: `frontend/src/lib/paletteLocations.ts`

Pure: no I/O, no clock, no React, no network import. Its one module-scoped collection is the `WeakMap` of 2.4.

### 2.1 Shapes

```ts
export const LOCATION_CAP = 50                                    // FR-12; a number the file cannot change
export const LOCATION_QUERY_MAX_CHARS = LOCATION_NAME_MAX_CHARS   // FR-10; the tab's constant, by identity
export const LOCATION_COLUMN_MAX_CHARS = 0x10000000               // 2.6; 2^28 code units
export const COLUMN_SEP = '\n'                                    // 2.5
export const LOCATION_INDEX_FAILED = 'palette-locations-failed'   // FR-25

export interface SearchLocation {
  readonly locationId: string   // the Location ID cell, 1..16 code units, exactly as parsed
  readonly name: string         // the Location cell through boundText(…, 200); '' when the cell is empty
  readonly truncated: boolean   // the cell was longer than the bound; the surface writes the ellipsis
  readonly place: string        // placeOf(county, stateProvince): "County, ST" | "County" | "ST" | ''
  readonly showId: boolean      // the tab's namesake rule (FR-14)
}

export interface LocationSearchIndex {
  readonly rows: readonly SearchLocation[]   // every location, in FR-11's order
  readonly column: string                    // every search text, in that order, each followed by COLUMN_SEP
  readonly starts: Int32Array                // length rows.length + 1; starts[k] is where row k's text begins
}

export function buildLocationSearchIndex(obs: readonly ObservationEntry[], columnMax?: number): LocationSearchIndex
export function locationSearchIndexFor(obs: readonly ObservationEntry[]): LocationSearchIndex | typeof LOCATION_INDEX_FAILED
export function peekLocationSearchIndex(obs: readonly ObservationEntry[]): LocationSearchIndex | typeof LOCATION_INDEX_FAILED | undefined
export function matchLocations(index: LocationSearchIndex, q: string, cap?: number): { rows: SearchLocation[]; truncated: boolean }
export function _locationSearchBuilds(): number    // test seam: derivations run since load
export function _columnSearches(): number          // test seam: native searches made
export function _resetColumnSearches(): void
```

A row holds only what a row shows and what the request carries (FR-06): no coordinates, no counts, no kind, no state name. `columnMax` and `cap` are overridable for tests; production always uses the constants.

### 2.2 The pass: `buildLocationSearchIndex`

A second derivation of the tab's rule, not a call to `buildLocationIndex` (0.6 records why: the tab's build is the larger part of the R2 budget and its per-row columns the larger part of R4's). FR-05's equality with the tab is therefore **measured, not argued**, by the parity suite of 10.2; the scratch run already reads zero differences in both directions and in both engines (0.7).

1. **The rows (L1).** One loop over `obs`. Per row: `submissionId` must be a non-empty string, else the row changes nothing. It is added to a `Set` of Submission IDs **at first sight, before any test of its location**, and a Submission ID already in the Set ends the row's work (security.md v1.0.40: a rejected key is recorded when first seen, so a checklist whose first row carries no usable Location ID is decided once and never re-examined). So only a checklist's first row in file order goes further.
2. **That first row's Location ID** must be a string of 1 to `LOCATION_ID_MAX_CHARS` code units (a length read before the ID is hashed), compared exactly as parsed. A second `Set` of Location IDs keeps the first checklist of each location.
3. **The record (L2)**, from that first checklist's first row, with the tab's own bounded reads in the tab's own order: `boundText(location, 200)`; the County cell when a string of at most 96 code units, else `''`; the State/Province cell when a non-empty string of at most 16, else `null`; `placeOf(county, stateProvince)`.
4. **The order and the namesake runs (L3).** `rows.sort` with the tab's comparator, copied: unnamed after named, then `name.localeCompare`, then `place.localeCompare`, then the Location ID by code unit. Then one walk marks every run of two or more adjacent rows whose name and place both compare equal by `localeCompare`, the tab's `showId` rule verbatim. Both are evaluated over the whole backup, never over a query's matches.
5. **The column (L4).** For each row in order, the search text is `(name === '' ? UNNAMED_LOCATION : name).toLowerCase()`: the bounded name without the ellipsis, or the placeholder for an empty name (FR-10). A running total of their lengths plus one separator each fills `starts`; if it would pass `columnMax` the function throws `LOCATION_COLUMN_TOO_LONG` (2.6). Then one `join(COLUMN_SEP)` plus a trailing separator.

Every table keyed on file text is a `Set` (NFR-10). No composite string key is built from two cells. No loop is driven by a number read from a cell. The index holds strings, booleans and one typed array, never an `ObservationEntry` and never the array.

### 2.3 Decision: locale compare, the tab's picker order (Open Question 3)

**`localeCompare`, at derivation, once per loaded file. No comparison runs on a keystroke.**

- FR-14 requires Search to show the Location ID exactly when the tab's picker does, and the tab defines that by `localeCompare` equality over a `localeCompare` sort, which joins canonically equivalent spellings that code-unit equality keeps apart. A code-unit order would still owe that same locale sort to compute `showId`, so it would cost more, not less.
- Sharing the comparator makes FR-11's order and the tab's picker order one order: the scratch corpus reads zero order differences against `pickerOrder`.
- The order is fixed when the index is built, so the per-keystroke match takes its rows in order and never sorts. The species half sorts its matches on every keystroke; the location half does not.
- **Cost.** It is inside the derivation's figures (0.3): at 2,000 locations it is a small part of 18 ms; at 150,000 locations with names at the bound it is most of 0.6 s, once per file.
- **NFR-15, stated.** The order can differ between engines' collations, as the tab's picker order already can. On each platform the order is the same on every run and does not depend on file order (the comparator ends on the Location ID, which is unique), and the namesake rule equals the tab's on that platform.
- **What would reverse it:** the tab moving its picker to another comparison. Search follows it in the same change; the parity suite goes red until it does.

### 2.4 The memo, and why the index cannot outlive its parse (NFR-04, Key Decision 7)

```ts
const memo = new WeakMap<object, LocationSearchIndex | typeof LOCATION_INDEX_FAILED>()
```

`locationSearchIndexFor(obs)` returns the memo's value for that array, or builds, stores and returns it; a build that throws stores and returns `LOCATION_INDEX_FAILED`, so a failing file is attempted once per parse and never again (R2's zero derivations on later opens holds for a failure too). `peekLocationSearchIndex(obs)` reads the memo and does no work.

**The argument, to be written at the definition site as it is here:**

- **What holds the index.** One module-scoped `WeakMap` keyed on the IDENTITY of the observations array, and, while Search is open, the overlay's own state. A WeakMap entry's value is reachable through the map only while its key is reachable from somewhere else. The key's long-lived holders are `observationsCache.ts`'s `cache` slot, which `clearEbirdObservationsCache()` empties on every save, replace and clear, and each mounted tab's ready phase, which every tab replaces on the files epoch. Once the parse is replaced or cleared and those have let go, nothing reaches the old array and nothing reaches its index. There is no teardown to call and none to forget.
- **Why identity.** `loadEbirdObservations` hands back the same array for the life of its cache, so the identity changes exactly when the parse does. There is at most one live parse, so nothing alternates and nothing is evicted.
- **Why not the species index's shape** (a `WeakRef` on the source beside a STRONG slot for the index, `lib/speciesIndex.ts`). That slot keeps the last index alive after its parse has gone, until the next build replaces it. For about a thousand name pairs that is nothing. A hand-built file makes this index 150,000 rows and a column of tens of megabytes (0.5), held after a Clear for the rest of the session. The scratch run shows it: the strong-slot form is still alive after the parse is dropped and collected, in both engines.
- **Why not a `WeakRef` on the index.** Nothing but an open overlay would hold the index, so the engine could collect it between two opens and the next open would derive again, which R2 forbids.
- **What the index must never hold:** an `ObservationEntry` or the array. It holds the parse's own strings and its own arrays.
- **What the overlay must do.** Set its location state back to none in the same update that sets the species half to pending on a files-epoch change (4.2), and drop any observations it is holding for the first frame in that effect's cleanup. Closed, the overlay is unmounted and holds nothing.
- **`WeakMap` availability** is cleared for every shipped target (it predates `WeakRef`, which `speciesIndex.ts` already cleared against the macOS and iOS minimums and the Android WebView floor).

Measured in scratch, V8 and JavaScriptCore, forced collection: alive while its parse is alive; the same object on a second call with zero rebuilds; collected once the parse is dropped; the strong-slot control not collected (0.5).

### 2.5 The match: `matchLocations(index, q, cap)`

`q` is the query already normalized by `normalizeSpeciesQuery` (trimmed, lowercased), once per keystroke, by the caller.

```
if q is '' or longer than LOCATION_QUERY_MAX_CHARS or holds COLUMN_SEP: no rows
from = 0, lo = 0
while lo < rows.length:
    hit = column.indexOf(q, from)                 // the one native search
    if hit is -1: stop
    k = the last index in [lo, rows.length) with starts[k] <= hit      // bisection over starts
    if rows drawn == cap: return them, truncated
    draw rows[k]; lo = k + 1; from = starts[lo]
return the rows drawn, not truncated
```

- **A location matches exactly when its search text contains `q`** (FR-10): the equality with the PRD's rule read literally, one location at a time, is held over a generated corpus (10.2); the scratch run reads zero differences over 136,170 calls in each engine.
- **No match can span two names.** A hit inside the column lies inside one location's text or runs across a separator; the second needs `q` to hold the separator, and such a `q` is refused. A name that itself holds a line feed is harmless: `starts` is built from lengths, never by searching for separators.
- **The cut is after ordering** (FR-12): rows come out in the column's order, the first `cap` are drawn, and one more hit sets `truncated`.
- **Work per keystroke.** At most `cap + 1` native searches, whatever the file holds, each resuming where the last location ended, so the column is read at most once; at most `cap + 1` bisections of about `log2(L)` steps. A keystroke with no match is one search over the column and nothing else.
- **No `RegExp`** is built anywhere on this path, and county, state, place label and Location ID are not in the column, so they cannot match.

**Stated limits, each pinned by a row and recorded in `decisions.md` with what would reverse it:**

- **A query holding a line feed matches no location.** A single-line input cannot hold one (the engine strips line breaks from its value), so no typed or pasted query reaches this branch. A multi-line name is still found by any part of it that sits on one line. Reversal: the query input becoming a multi-line control.
- **The query bound and U+0130.** Lowercasing can lengthen a name, so a 200-unit name can have a search text of up to 400 units, and a normalized query longer than 200 that would have matched it is refused. That needs a hand-built name of dotted capital I and a query of more than 200 units. Reversal: a real name reported unfindable.
- **A whitespace-only name** is listed, shown as the tab shows it, and matched by no query, since a trimmed query holds a non-space unit (FR-15 c). It cannot come out of the parser.
- **One name outside Latin-1 widens the whole column** to a two-byte string (a curly apostrophe is enough): twice the column's memory for that file and about twice the search time, measured at the hostile cap as 1.4 against 0.7 ms in V8 and 2.2 against 1.0 ms in JavaScriptCore (0.5). R1 and R2 were taken on a one-byte and on a two-byte realistic fixture, and the gate table reports the worse of the two.

### 2.6 The column ceiling

`LOCATION_COLUMN_MAX_CHARS` is 2^28 code units, half of V8's longest string. No file can move it. A backup inside the 50 MB upload cap cannot reach it: its names are at most 50 million units, and lowercasing lengthens only a letter that already costs the file two bytes. An unguarded iCloud pull could. Past it the derivation refuses whole, with FR-25's sentence, instead of asking the engine for a string it may not make and instead of offering part of the backup without saying so (FR-04). This is the second bound of security.md v1.0.57: the column's size is driven by the names' text, and capped by a number the text cannot inflate. So FR-25's case is real, not hypothetical, and its test patches the ceiling down through `columnMax` and needs no throwing stub (a throwing stub is still injected for QA-25's wording).

---

## 3. The row builder: `lib/paletteRows.ts`

`buildPaletteRows`, `SPECIES_CAP` and every existing export stay byte-identical. Added:

```ts
export type PaletteRow =
  | /* the three shipped kinds, unchanged */
  | { kind: 'location'; locationId: string; name: string; truncated: boolean; place: string; showId: boolean }

export interface SearchRowsInput extends PaletteRowsInput {
  locations?: LocationSearchIndex | null   // null or absent: exactly buildPaletteRows' rows
  locationCap?: number                     // overridable for tests
}
export interface SearchRowsResult extends PaletteRowsResult {
  speciesCount: number                     // rows after the destinations and before the locations
  locationsTruncated: boolean
}
export function buildSearchRows(input: SearchRowsInput): SearchRowsResult
```

`buildSearchRows` calls `buildPaletteRows(input)`, takes `speciesCount = rows.length - destinationCount`, and, when the normalized query is non-empty and `locations` is an index, appends `matchLocations(locations, q, locationCap ?? LOCATION_CAP)`'s rows as `location` rows.

**Why a wrapper.** NFR-05 lets no existing assertion be edited to fit, and R5 requires destination and species rows to be unchanged for every query. With the shipped function called, not copied, both are properties of the code: the first `destinationCount + speciesCount` rows ARE its output, so `rows[0]`, and with it Enter's choice when nothing is highlighted, is a location only when no destination and no species matched (FR-17). QA-16's comparison is then between two calls of one function. The query is normalized a second time for the location half: one `trim` and one `toLowerCase` of the typed text, tens of nanoseconds. The measured candidate normalized once, so that second call is not in the R1 figures; the Engineer's measurement includes it.

Headings, both cap lines and the state sentences stay out of `rows`, as today.

---

## 4. The overlay's location half

### 4.1 `components/CommandPalette.tsx`: props and state

```ts
onOpenLocation?: (locationId: string) => void     // App's wrapper (section 5)
```

**Optional, and the location half is armed only when it is passed**, the Alerts inbox row's precedent. Existing renders of the overlay in existing suites pass no such prop, compile unchanged, and do no location work. `App.tsx` always passes it.

State, beside the unchanged `species`:

```ts
type LocationsHalf = LocationSearchIndex | typeof LOCATION_INDEX_FAILED | null    // null: none yet
const [locations, setLocations] = useState<LocationsHalf>(null)
```

**`resolvePaletteSpecies` is reused as it stands** (its return shape is pinned by its own suite). The overlay learns which observations loaded from the `buildIndex` dependency it already injects: the closure it passes records the array it is handed and returns `speciesIndexFor(obs)`. `buildIndex` is called exactly when the load succeeded, with the cache's own array.

### 4.2 When the locations are derived: `lib/paletteLocationsLoad.ts`

```ts
export const FIRST_FRAME_FALLBACK_MS = 250
export function afterFirstFrame(run: () => void): () => void      // returns a cancel function
export function locationsAtAnswer(obs: readonly ObservationEntry[], framed: boolean)
  : LocationSearchIndex | typeof LOCATION_INDEX_FAILED | undefined
```

- **`afterFirstFrame`** calls `run` once, in a task queued from the overlay's first `requestAnimationFrame` callback, which is after that frame has been presented. A window that is hidden or suspended fires no frame, and nothing is being painted there, so a `FIRST_FRAME_FALLBACK_MS` timer calls `run` instead; whichever fires first wins and cancels the other. It is called from the overlay's mount effect; `run` sets a `framed` ref.
- **`locationsAtAnswer`** is the one decision. A memo hit (`peekLocationSearchIndex`) returns the memo's value: no work, so no gate. A miss with `framed` true returns `locationSearchIndexFor(obs)`. A miss with `framed` false returns `undefined`.

The overlay's `then`, after `setSpecies(next)` for a ready answer: `const now = locationsAtAnswer(obs, framed.current)`; if it is not `undefined`, `setLocations(now)` in the same batch, **so the location rows join in the commit in which the species rows join** (FR-33); otherwise the observations wait in a ref, and `run` derives them and sets the state when the first frame has been presented. The files-epoch effect sets `species` to pending and `locations` to `null` together, and its cleanup clears the waiting ref.

**Why this shape, and what it costs (flag 1).** R2 allows none of the feature's work before destinations have painted. On desktop the file-status read is an IPC round trip of a few milliseconds, so when another tab has already parsed the backup, the species answer routinely lands before the overlay's first frame. Deriving there would put up to 21 ms (0.3) ahead of the first paint. Holding the SPECIES answer for the frame instead would delay species, which FR-04 forbids, and would flash the reading sentence on every open. So only the location derivation waits, and only when there is a derivation to run:

| Open | Locations join |
|---|---|
| The parse finishes while Search is open (the first open after a file load, nothing parsed yet) | In the species update. The parse takes far longer than a frame |
| Any later open for the same file | In the species update. A memo hit, no work |
| The parse was already cached and the species answer lands before the first frame | At the first frame: at most one frame after species |
| The backup is replaced while Search is open | In the species update of the new file |

In the third row the query is still empty in any real sequence, and an empty query shows no location rows, so nothing visible changes. If a keystroke does render inside that frame, its species rows show and its location rows follow one frame later, after every existing row (FR-18), and the no-match sentence is withheld (4.3). This is not the deferred form: the location data is not prepared after species on any open in which it can be prepared with them, and no file load produces a gap. **What would reverse it:** the user deciding that FR-33's letter outranks the paint clause of R2, in which case the gate in `locationsAtAnswer` is removed and the third row joins in the species update.

### 4.3 Rows, sentences and headings

```ts
const index = Array.isArray(species) ? species : null
const locationIndex = onOpenLocation && locations !== null && locations !== LOCATION_INDEX_FAILED ? locations : null
const current = useMemo(() => buildSearchRows({ items, index, query, inbox, alphaCodes, locations: locationIndex }), [...])
```

The one status sentence (FR-20 to FR-25), in this order, through the existing always-mounted region and its sequence-keyed child:

| Condition | Sentence | Heading over it |
|---|---|---|
| `species` is pending | `PALETTE_COPY.speciesLoading`, unchanged | `groupBackup` |
| `species` is `null` (no backup saved) | `PALETTE_COPY.speciesNoBackup`, reworded | `groupBackup` |
| `species` is unloadable (a failed status read included) | `EBIRD_BACKUP_LOAD_ERROR`, imported from where it lives | `groupBackup` |
| `species` ready, `locations` is `LOCATION_INDEX_FAILED` | `EBIRD_BACKUP_LOAD_ERROR` | `groupLocations` |
| `species` ready, `locations` is `null`, armed, query non-empty, no rows | `PALETTE_COPY.speciesLoading` | `groupLocations` |
| query non-empty, no rows, none of the above | `PALETTE_COPY.noMatches`, unchanged | none |
| otherwise | none | |

Exactly one sentence or none. The fifth row is the first-frame window of 4.2: the no-match sentence is never shown while location results for the current query are still to come (FR-22). A backup that loads and holds no location yields an index with no rows: no heading, no sentence of its own (FR-24).

**The group and the ids.** A third `role="group"` after Species, labeled `groupLocations`, rendered when it has rows; its options take `optionId(destinationCount + speciesCount + i)`. Ids and `aria-activedescendant` are the per-instance prefix plus the row's position in `rows`, as today, so no id holds file text (FR-19). The React key for a location row is `location:` plus its Location ID, as species rows are keyed on their name; a key is not written to the DOM, and QA-19's attribute scan is what shows that.

**A location row** is a `role="option"` `div` with no `tabindex`, no anchor and no control inside it. Its text, in this order: `displayName(row.name, row.truncated)`; `row.place` when it is not empty; `row.locationId` when `row.showId`. That order is the accessible name's order (FR-13), read from a real engine's tree, not from jsdom. All three are escaped React text.

**The two cap lines.** `speciesTruncated` and `locationsTruncated` each draw one non-option line: `speciesCapLine(SPECIES_CAP)`, unchanged, and `locationCapLine(LOCATION_CAP)`. With a third group below Species, a line placed after the whole listbox, as the species line is today, would follow the wrong rows. Each line must directly follow its own group's rows in reading order and be associated with that group (FR-12). The shipped group headings are presentational children inside their `role="group"`, which is the available precedent; the placement and the association are the Designer's, verified in both engines' accessibility trees (QA-12, QA-49). The species line's wording and its presence for each query do not change.

**The highlight (FR-18).** Location rows are the last rows, so their arrival moves no existing index. `highlightOnCodeArrival` is called as today with `destinationCount` as the first species index; its two name lists must hold the species rows only (`rows.slice(destinationCount, destinationCount + speciesCount)`), or location rows would make the lists differ and clear a highlight that should stay. With a location row highlighted and the species rows changing, it returns -1 (cleared); with them unchanged it keeps the index, which is still the same location.

`choose` gains one arm: a `location` row calls `onOpenLocation(row.locationId)` and then the one `onClose`.

---

## 5. The way into Hotspot Reports

### 5.1 `App.tsx`

```ts
const [requestedLocation, setRequestedLocation] = useState<string | undefined>(undefined)
const navigateToHotspotReport = useCallback((locationId: string) => {
  setActiveTab('hotspot-reports')
  setRequestedLocation(locationId)
}, [])
const clearRequestedLocation = useCallback(() => setRequestedLocation(undefined), [])
const openLocationFromPalette = useCallback((locationId: string) => {
  setMapFullscreen(false)
  navigateToHotspotReport(locationId)
}, [navigateToHotspotReport])
```

`openLocationFromPalette` is `openSpeciesFromPalette` with the other tab, line for line, which is what makes FR-28 hold: the Map Explorer's fullscreen is collapsed first, and for an expanded embedded map the resulting state is the one the species route produces, because it is the same sequence of state changes. `setActiveTab` adds the tab to `mountedTabs` through the existing effect, so a tab never opened mounts and loads as on a first visit (FR-26), and a tab hidden in Settings is shown without touching the hidden set (FR-27), as Species Detail is. The request is a plain string; a second choice before consumption replaces it (FR-29 b). `App.tsx` gains no static import.

`<HotspotReportsTab … requestedLocationId={requestedLocation} onRequestedLocationConsumed={clearRequestedLocation} />` and `<CommandPalette … onOpenLocation={openLocationFromPalette} />`.

### 5.2 `HotspotReportsTab.tsx`: the consume effect

Two optional props, so every existing render of the tab compiles unchanged.

- **A settled-epoch ref.** The load effect records the `filesEpoch` it ran for whenever it sets a terminal phase (`ready`, `setup-required`, `error`).
- **The effect**, on `[phase, requestedLocationId, filesEpoch]`:
  - no request: nothing;
  - the phase is `loading`, or the settled epoch is not the current `filesEpoch`: hold (a load for the current file is running or about to);
  - the phase is `setup-required` or `error`: clear the request, show nothing about it (FR-29 c);
  - the phase is `ready`: `const ord = index.ordById.get(requestedLocationId)`, the Location ID's only use (FR-29 e); then, in a microtask, as the species route does: an `ord` selects it through the tab's one `select` handler with the source `'search'`; `undefined` sets the selection to none with **no announcement and no message** (FR-31); either way the request is cleared.
- **Why the settled epoch.** A request and a file change that reach the tab in one commit would otherwise be consumed against the previous file's index, in the effect flush that also starts the reload. With it, FR-23's "never offers a location from a file that is gone" holds for the request too.
- **Consumed once.** The request is cleared in the same microtask; a later epoch finds none (FR-29 a). The effect never changes the active tab; it has no way to (FR-29 d).

**`select(next, 'search')`** is the picker's selection (FR-30): the selected ID, the announcement through the tab's existing live region, the report by the tab's own rules. Two differences, both required by FR-30:

- **The already-selected location.** The announcement is repeated once, and nothing else changes: `selectionSeq` does not advance, so the entrance does not replay and the life list keeps its page. For that, the announcement's child is keyed on its own counter, advanced on every `select`. On the picker and ranked-row paths it advances with `selectionSeq`, so their DOM behavior is what it is today.
- **The header in view.** After the commit, in a layout effect, the tab scrolls the report's header into view (`scrollIntoView({ block: 'nearest' })`, never smooth). On a hidden panel that is a no-op, and FR-29 (d) asks no more. Focus is not moved by the tab: it returns by the overlay's shipped rule (FR-26). The focus restore runs in an earlier commit than the consume, so the scroll comes last; QA-30 measures the result in both engines.

The tab's index is built once per loaded file, in its load effect, as today. A request reads it; it never builds it.

---

## 6. Copy: `lib/paletteCopy.ts` (FR-36)

The module rides the entry chunk and imports nothing; both stay true. The Designer may restyle a default but not change what it states.

| Key | Value | Note |
|---|---|---|
| `inputLabel` | `Search destinations, species, and locations` | The input's, the dialog's and the listbox's accessible name |
| `placeholder` | the same | The Designer may shorten the placeholder only, on a measured clip at 320px or 200% text |
| `groupLocations` | `Locations` | True of a personal location; never "Hotspots" |
| `groupBackup` | `Species and locations` | The heading over a backup-state sentence |
| `speciesNoBackup` | `Searching species and locations needs your eBird backup. Upload MyEBirdData.csv in Settings → Default Files → eBird Backup.` | The key keeps its name; existing delivery rows keep reading it |
| `locationCapLine(cap)` | `` `Showing the first ${cap} locations. Keep typing to narrow them.` `` | A function of the constant, as `speciesCapLine` is; the cap is a plural in every shipped configuration |

`speciesLoading`, `noMatches`, `controlLabel`, `closeLabel`, `groupDestinations`, `groupSpecies`, `speciesCapLine` and the legend words are unchanged. The unnamed placeholder and the ellipsis come from `displayName` in `lib/hotspotReportsCopy.ts`, by import, never a second copy. No string holds an em dash; spelling is American. The threshold sentence of FR-35 is not added: that form does not ship.

---

## 7. Chunking (NFR-04, NFR-16)

- **Off the entry graph:** `lib/paletteLocations.ts` and `lib/paletteLocationsLoad.ts`, reached only from `CommandPalette.tsx`, which `App.tsx` reaches only through `import()`. `entryChunk.test.ts` gains them in the overlay's negative row and in its positive row (the overlay's closure really does reach both), so the negatives cannot go vacuous.
- **What the overlay's closure now reaches from the tab,** read off the import statements on 2026-11-13: `lib/hotspotReports.ts` (for `boundText` and the two constants), `lib/lifeLists.ts`, `lib/lifeListsRegion.ts`, `lib/regionNames.ts`, `lib/hotspotReportsCopy.ts`, `lib/lifeListsCopy.ts`, and two modules already on the entry graph (`lib/speciesUtils.ts`, `lib/tabLayout.ts`). All are pure `lib/` modules. `hotspotReportsCopy.ts` imports `hotspotReportsKind.ts` as a type only, which is erased, so `hotspotSet.ts` and `transport.ts` are not reached. **The overlay's closure reaches no component of the tab, no `SnowMap`, no maplibre, no chart library, no `transport` and no `lib/tauri` service.** `entryChunk.test.ts` gains that row over `closureFrom('components/CommandPalette.tsx')`, with a positive leg naming `lib/hotspotReports.ts`.
- **The cost of that reuse, stated.** The bundler will place those modules in chunks the overlay and the tabs share, so opening Search loads the tab's index code although Search never calls it. `App.tsx` already warms the overlay's chunk at idle, off first paint. The alternative, a second copy of `boundText`, `placeOf` and four constants inside the overlay's own module, would save those bytes and add four numbers and two functions that must be held equal to the tab's forever. Single-sourcing wins; the Engineer records the lazy chunks' sizes before and after in `decisions.md`.
- **The entry chunk grows by the new strings of section 6 and by nothing else:** no module joins `App.tsx`'s static graph. FR-36 puts those strings in a module that is on the entry graph by design. The first-paint claim is the two-build sum over the entry script and every `modulepreload` in the built `index.html` (testing.md, v1.0.63), recorded by the Engineer; the built `index.html` preloads nothing new.
- **No new npm or Rust dependency.**

---

## 8. Network posture and persistence, made checkable (NFR-07, NFR-08)

- **Search makes no request.** `paletteLocations.ts`, `paletteLocationsLoad.ts` and `paletteRows.ts` import no `transport`, no `storage`, no `lib/tauri` service and no `fetch`. `CommandPalette.tsx`'s seam reads are the two it makes today, in the same effect, once per files epoch per open. The location half adds no read: it consumes the observations the species resolver already loaded.
- **No third-party request, no new endpoint or host, and no request moved between components.** The Vite proxy, the backend routes, `CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`, the Tauri content security policy and the HTTP permit are unchanged in the diff. Requests a system component makes from the app's process are in scope of this statement; the feature causes none.
- **Where a request can follow a choice:** the Hotspot Reports tab, opened by a location row, makes its existing requests exactly as it does when that location is chosen in its picker. Search adds a route to them, not a request. On web and Pi, the status read and the file read are existing calls to the user's own server.
- **Nothing is persisted.** No stored document, no setting, no `localStorage` value, no recent search, no remembered location. No `clearDerived.ts` row; `cacheInventory.test.ts` is unchanged; no privacy-policy sentence is owed.
- **Guards:** 10.5.

---

## 9. Security declaration: scans, bounds and measured costs (FR-41, NFR-09, NFR-10)

### 9.1 Reads over user-file text this feature adds

None is a regex. One is a native search, and its end bound is named.

| # | Read | Module that holds it | Input | Bound and linearity argument |
|---|---|---|---|---|
| L1 | The location pass | `lib/paletteLocations.ts` | Every observation's `submissionId`; the first row of each checklist's `locationId` | One loop over the rows. Per row one `Set.add` on the Submission ID as the parse delivered it (hashed once per distinct string). Per checklist one length read on the Location ID (rejected past 16 before it is hashed) and one `Set.add`. `O(rows)`. No loop is driven by a number read from a cell |
| L2 | The record's bounded fields | `lib/paletteLocations.ts`, through `boundText` (`lib/hotspotReports.ts`) and `placeOf` (`lib/lifeLists.ts`) | `location`, `county`, `stateProvince` of a location's first checklist | Length reads first (200, 96, 16), one `slice` of at most 200 code units with the surrogate check, `placeOf`'s hand scan of at most 16. Once per distinct location |
| L3 | The order and the namesake runs | `lib/paletteLocations.ts` | The bounded names and place labels | `L log L` `localeCompare` calls over strings of at most 200 and 114 code units, then `2(L - 1)` more for the runs. `L <= checklists <= rows`. Its linearity row derives its limit from `L log L` |
| L4 | The column | `lib/paletteLocations.ts` | The bounded names | One `toLowerCase` per location over at most 200 code units (at most 400 out), a running length with the ceiling of 2.6, one `join`. `O(L)` strings, `O(column)` code units |
| L5 | The per-keystroke match | `lib/paletteLocations.ts`, called from `lib/paletteRows.ts` | The column, against the typed query | The query is refused past 200 code units by a length read, then scanned once for the separator (at most 200 units). Then at most `LOCATION_CAP + 1` calls of `String.prototype.indexOf(q, from)`. **Its end bound is the end of the column, by design: the column is the bounded input** (every name cut to 200 before it was written, the whole capped at 2^28), and the calls partition it, because each starts at the offset where the previous hit's location ended. So a keystroke examines each code unit of the column at most once, plus at most `q.length` units of look-ahead per call: `O(column + cap x 200)` reads, and `O(column x 200)` in the worst case the engine's search can be driven to, which 0.5 measures. The absence case is one call over the whole column, and is the fastest case, not the slowest. At most `cap + 1` bisections of `log2(L) + 1` steps. At most `cap` rows out |
| L6 | The request | `components/hotspotReports/HotspotReportsTab.tsx` | A Location ID from a row | One `Map.get` on the tab's existing `ordById` |
| L7 | A row's text | `components/CommandPalette.tsx` | A row's name, place and Location ID | Escaped React text of at most 201, 114 and 16 code units; at most `LOCATION_CAP` rows. No `href`, no id, no selector built from it |

`normalizeSpeciesQuery` over the typed query is the shipped read and is unchanged. A scan added later, at a QA retry or a design re-entry, takes its row here in the change that adds it (FR-41). **If the Designer adds a tighter DISPLAY bound for a narrow row,** it is a second read over the same cell and takes its own row (ui.md, v1.0.38: a safety bound is not a layout budget; and never a CSS `text-overflow` ellipsis on such a box).

### 9.2 Bounded allocation: every file-sized structure and its two bounds

| Structure | Sized by | First bound (content-driven) | Second bound (the content cannot inflate) |
|---|---|---|---|
| The Set of Submission IDs (dropped when the pass returns) | Distinct non-empty Submission IDs | One entry each | At most `rows`, the length of an array the parse already holds |
| The Set of Location IDs (dropped when the pass returns) | Distinct usable Location IDs | One entry each, each at most 16 code units | At most `checklists <= rows` |
| `rows` | Distinct locations | One record each: three strings the parse or the pass owns, two booleans | At most `rows` records; a name at most 200 code units, a place at most 114, an ID at most 16 |
| `column` | The bounded names' text | The sum of the search texts plus one per location | `LOCATION_COLUMN_MAX_CHARS` (2^28 code units), a constant; and, inside the upload cap, `rows x 401` |
| `starts` | Distinct locations | `4 x (L + 1)` bytes | `L <= rows` |

**Rendered output, bounded independently of the file:** location rows at `LOCATION_CAP` (50) plus one line; species rows at `SPECIES_CAP` (50) plus one line, unchanged; destinations as today. The row count itself is bounded by the per-platform upload cap enforced at import (`uploadGuard.ts`); iCloud pulls are deliberately unguarded, the residual every row-sized structure in the app carries, and the reason the column has a ceiling of its own.

### 9.3 Constants, set from the measurement

| Constant | Value | Ground |
|---|---|---|
| `LOCATION_CAP` | 50 | Open Question 4's default stands. The cap bounds DOM, not the scan: a keystroke with no match reads the whole column at any cap, and the location half of the worst realistic keystroke measured 0.06 ms (0.3). Fifty rows beside fifty species rows is a fixed amount of DOM whatever the backup holds; the Engineer records the commit time with both groups full at the live look |
| `LOCATION_QUERY_MAX_CHARS` | 200, `LOCATION_NAME_MAX_CHARS` by identity | FR-10's default. See 2.5 for the one character it can change a result for |
| `LOCATION_COLUMN_MAX_CHARS` | 2^28 | 2.6 |
| `FIRST_FRAME_FALLBACK_MS` | 250 | 4.2: long enough that a visible window's first frame always wins, short enough that a hidden window has its rows when it returns |

### 9.4 Rule-file `paths` the build extends, in the same change

Checked file by file against the frontmatter read on 2026-11-13, existing modules the declarations rely on included.

| Rule file | Entry to add | Files it gates | Why |
|---|---|---|---|
| `.claude/rules/security.md` | `frontend/src/lib/paletteLocations*.ts` | `paletteLocations.ts`, `paletteLocationsLoad.ts` and their five suites | They hold L1 to L5, both Sets keyed on file text and the memo. No existing glob matches: `paletteRows.ts` is an exact entry |
| `.claude/rules/security.md` | `frontend/src/components/CommandPalette*.tsx` | The overlay and its suites | It mints ids and `aria-activedescendant` over file-derived rows and renders user-file text (L7), and from this build carries a Location ID out of a row. It is named in that rule's own IDREF paragraph as a precedent and matches none of its globs. A component's `ui.md` gate does not discharge this |
| `.claude/rules/security.md` | `frontend/src/lib/speciesIndex.ts` | One existing file, not edited | Found by the file-by-file check, and stated so nobody reads the list above as complete without it: it holds the shipped species pass over user-file text and a `Map` keyed on it, and matches no glob. No declaration here relies on it; it is added because this change edits the overlay's gate and the cost is one line |
| `.claude/rules/ui.md` | `frontend/src/lib/paletteCopy.ts` | The copy module | The `lifeListsCopy.ts` and `hotspotReportsCopy.ts` precedent; this build edits it and it matches no glob |

Already gated, checked: `lib/paletteRows.ts` (holds L5's call), `lib/speciesMatch.ts`, `lib/alphaCodes*.ts`, `lib/hotspotReports*.ts` (holds `boundText`, `displayName`, and the oracle), `lib/lifeLists*.ts` (holds `placeOf` and `COUNTY_CELL_MAX_CHARS`), `components/hotspotReports/**` (holds L6), `lib/speciesUtils.ts`, `lib/regionNames.ts`. `App.tsx` carries the Location ID as a string and holds no scan; it is gated by `ui.md`. `lib/paletteSpeciesLoad.ts` decides and holds no scan. `docs-and-website.md` already gates `docs/**`, `ACCESSIBILITY.md` and `*PublishedClaims.test.ts`; `testing.md` already gates every new suite. `security.md`'s prose gains one paragraph saying why the three entries are there, as its earlier additions have.

### 9.5 Measured costs, per draw and per re-draw

The figures are those of section 0, restated per scan as CLAUDE.md asks. V8 figures are process CPU time through `frontend/src/test/cpuTiming.ts`; JavaScriptCore figures are wall clock (0.2 says why).

**L1 to L4, the derivation. Per draw: once per loaded file, and only after Search has been opened. Per re-draw: none** (later opens, keystrokes and tab visits run zero builds; a replaced file is a new draw).

| Input | First call, V8 CPU / JSC wall | Best of, V8 / JSC | Retained, V8 / JSC |
|---|---|---|---|
| Realistic cap: 150,000 rows, 3,000 species, 2,000 locations | 18.2 to 18.9 ms / 8.1 to 8.6 ms | 5.4 to 5.7 ms / 4.3 to 4.6 ms | 0.3 MB / 0.3 MB |
| The same, two-byte text | 20.4 to 21.3 ms / 7.6 to 8.6 ms | | |
| Hostile: every row its own location, short names | 310 to 352 ms / 162 to 206 ms | 164 to 174 ms / 163 to 167 ms | 21 MB / 20 MB |
| Hostile: every row its own location, names at the bound | 685 to 717 ms / 495 to 532 ms | 605 to 620 ms / 494 to 543 ms | 46 MB / 45 MB |
| The same, two-byte text | | 636 to 641 ms / 876 to 941 ms | 75 MB / 74 MB |

**L5, the match. Per draw and per re-draw: once per keystroke with a non-empty query; an empty query runs none.**

| Input | Ordinary query | No match | Worst query measured |
|---|---|---|---|
| Realistic cap, 2,000 locations (a column of 57,294 units) | 0.001 to 0.06 ms | 0.002 to 0.07 ms | 0.07 ms |
| 2,000 locations, names at the bound | 0.001 ms | 0.009 ms / 0.013 ms | 0.17 ms / 0.013 ms |
| 150,000 locations, short names | 0.001 to 0.004 ms | 0.12 to 2.7 ms | 0.9 ms / 4.1 ms |
| 150,000 locations, names at the bound | 0.001 ms | 0.69 ms / 0.97 ms | 12.7 ms / 5.3 ms |
| The same, two-byte | | 1.4 ms / 2.2 ms | 14.6 ms / 2.2 ms |
| 150,000 locations, every name one repeated letter | | 0.70 ms / 0.97 ms | 261 ms / 15 ms |

Where two figures are given they are V8 then JavaScriptCore. The whole keystroke build at the realistic cap, destinations and species included, is at most 0.43 ms and 0.56 ms, of which the location half adds at most 0.10 ms.

**L6:** one `Map.get` per request. **L7:** at most `LOCATION_CAP` rows of bounded text per keystroke; the Engineer records the commit time with both groups at their caps at the live look.

**Expected in the app.** A real backup holds hundreds of locations to the low thousands: the first Search open after a file load pays a few milliseconds for the derivation, after the first frame or with the parse's own arrival, and a keystroke pays microseconds. An engine ten times slower than this Mac pays about 0.2 s once at the realistic cap and about 1 ms a keystroke.

---

## 10. Guards the build owes (FR-40)

Each is committed, proven able to fail against a named mutation recorded in `decisions.md`, and follows the house guard-quality rules: comments stripped before any source scan and the strip proven; a failure message that claims no more than its assertions check; never-vacuous legs; timing as same-run quotients on CPU time, absolute times never asserted; a hang guard walking a capped replica first; a deliberately expensive suite stating its own `testTimeout`; every non-ASCII probe written as a `\uXXXX` escape with a source row asserting the module's code holds no literal non-ASCII character.

### 10.1 `paletteLocations.test.ts` (FR-05 to FR-15, FR-40 d, QA-10, QA-11, QA-15)

- **The rule's rows:** a blank and an over-bound Location ID on a checklist's first row (offered nowhere); a later row with another ID (counts at the first row's); an empty Submission ID (changes nothing); two checklists at one location (one row, the first checklist's name and place).
- **The match table of QA-10,** against the literal rule: a mid-name hit, a mixed-case query, leading and trailing spaces, a county, a state code and a Location ID that appear in no name (zero rows), `unnamed` (the empty-named location), the ellipsis (no truncated name), a query at the bound and one past it.
- **Hostile names (FR-40 d):** `__proto__` and `constructor` as a name and as a Location ID (listed, matched and returned like any other, `Object.prototype` untouched); an empty name; a whitespace-only name handed in directly (listed, matched by nothing); a name at 200; a name over 200 cut at a surrogate pair (199 units, no lone surrogate, matched on the bounded text only); a name of U+0130; a multi-line name.
- **The delimiter-absent leg for the native search:** a query absent from the column makes exactly one search and returns no rows; a query holding the separator makes none.
- **The count rows (R1, QA-41):** `_columnSearches()` after one call equals `min(matches, cap) + 1`, never more than `LOCATION_CAP + 1`, and is the same number at 500 and at 5,000 locations for the same match count. This is the committed form of "the per-keystroke location work does not grow past one bounded read": it goes red on a per-location search and on the restart mutant.
- **The cap:** changing `cap` changes the slice and `truncated`; the rows are the first matches in order; a namesake keeps `showId` when the cap leaves its twin out.
- **The ceiling:** `columnMax` patched down throws; `locationSearchIndexFor` then returns `LOCATION_INDEX_FAILED`, twice, with one build.
- **Order:** two runs and a run over the same rows shuffled give the same rows in the same order (QA-11).
- **Source scans, comments stripped:** no `RegExp` constructor and no regex literal in the module; exactly two `.indexOf(` call sites (the separator check and the search), no `.includes(`, `.search(`, `.match(` or `.lastIndexOf(`; non-vacuity by asserting the two it does hold.

### 10.2 `paletteLocationsParity.test.ts` (FR-05, FR-06, FR-14, FR-40 b, QA-05, QA-06, QA-14)

A generated corpus, every file put through the REAL parser so no file has a shape the parse cannot produce, with the failure returns as its first rows: the empty file, a file with no usable Location ID, a file whose every Submission ID is empty. Cells are drawn from hostile pools (prototype member names, case variants, canonically equivalent spellings in both forms, names at and past the bound, a surrogate pair at the cut, County and State/Province cells at and past their bounds, IDs at and past 16). Asserted against `buildLocationIndex`, in both directions, each a count that must be zero and each with its own non-vacuity count:

- the set of Location IDs;
- per ID, the name, the truncation flag, the place label, and `displayName` of both;
- per ID, `showId` against the tab's;
- the order against `pickerOrder`;
- `matchLocations` against the literal oracle over a pool of queries, at the real cap and at a cap of 2.

**Non-vacuity:** the named wrong derivation, a location per ROW instead of per checklist, must differ from the tab on some files (the scratch run: 3,777 of 4,005); the corpus must hold rows with `showId` set, truncated names and unnamed locations (asserted counts above zero). This is the symmetric difference testing.md asks of a second predicate, filled from a measurement, with the seam's own failure returns as its first rows.

### 10.3 `paletteLocationsLinearity.test.ts` (R3, QA-43)

The `hotspotReportsLinearity.test.ts` procedure: `bestPerCallCpuMs`, legs interleaved, inputs built flat before any timing, a distinct input per leg, the raw quotient reported beside the asserted one, the suite stating its own `testTimeout`. **Legs at 500 and 5,000,** the house legs, where both stay cache-resident on CI's runners.

**What it asserts and what it prints (flag 8).** The gate's 2.2 per doubling is a reading with almost no headroom over linear growth: section 0's sound readings sit between 1.96 and 2.37. Asserted in CI at that number, a correct build would fail on a busy runner, which is the failure testing.md records for a limit within a small factor of its baseline. So each row ASSERTS the house limit over its tenfold span, which sits between linear growth and the defect with margin on both sides (a linear scan reads about 10, the mutants below read 40 and more), and each row also runs the three doublings between (625, 1,250, 2,500) and PRINTS every per-doubling quotient. Those printed readings are what the Engineer and QA record against 2.2, or against the limit derived from the sort, at their measurements (FR-02 b and c). If the Planner wants 2.2 asserted in CI, that is a decision to take with this paragraph in hand.

| Row | Shape | Limit at 500 / 5,000 |
|---|---|---|
| The pass | every row its own location, short names | derived from `L log L`: `2 x 10 x log2(5000) / log2(500)`, computed in the row from the locations each leg sorts |
| The pass | every row its own location, names at the bound sharing a prefix | the same derived limit |
| The pass | the realistic shape (one location per 75 rows) | 20 |
| The match | every row its own location, names at the bound; each timed call runs a fixed list of 32 queries (absent first unit, common first unit, a 100-unit near miss, a periodic near miss), so the small leg clears the 0.05 ms floor | 20 |

- **Mutants, in the test file, never in the module,** each of which must exceed its row's limit, each run over a capped replica of 1,000 rows first so a hang cannot sit behind the timeout: the pass with its Location ID Set replaced by an array search; the match with every search restarted at its own location and left to run to the column's end (the scratch run reads 4.0 per doubling for it against 2.0, section 0.5).
- **The comparison of NFR-03,** as a same-run quotient: at 5,000 distinct locations and 5,000 distinct species, the location half of a keystroke over the species half is at most 1, for a one-character query, an ordinary one and a no-match.
- **Acceptance before the build ships:** each row at or under 0.65 of its limit on this Mac, in the file, in a bare process on Node 20, and under `NODE_OPTIONS=--max-semi-space-size=1`. A row above that shrinks its legs; no limit moves. The readings go in `decisions.md`.
- **The derivation's absolute figures at the cap are the Engineer's to re-measure in the built app** (FR-02 b), never asserted in CI.

### 10.4 `paletteLocationsLifetime.test.ts` (R4, QA-44)

- **Through the real `observationsCache`,** with only `storage` mocked: load a file, take `locationSearchIndexFor(obs)`, keep a `WeakRef` to it and nothing else, call `clearEbirdObservationsCache()`, yield one macrotask, force a collection, and assert the index is gone. A second row replaces the file instead: the old index is gone and the new file's is alive and is the memo's value.
- **The collection is forced inside the test** (`v8.setFlagsFromString('--expose-gc')` and a `gc` taken from a new context, which needs no process flag; checked in scratch on Node 24.18 and on Node 20.20.2, CI's line, with a `WeakMap` memo collected and a strong slot not); the row asserts it has a `gc` function before anything else, so it fails, never skips, where it cannot collect.
- **The step that creates the `WeakRef` is a plain function that returns only the `WeakRef`,** called from the async test: a suspended async function keeps its locals alive (CLAUDE.md, v1.0.57), and an index held by a local would read as retained.
- **The control leg:** the same steps over a test-local copy of the species memo's shape (a strong slot) must find the index still alive. Without it a probe that could never see a retained index would pass.
- **The structural row,** comments stripped: at module scope `paletteLocations.ts` declares one `WeakMap` and no `Map`, `Set`, array or object that could hold file text; its top-level `let` bindings are numeric counters. So the next author cannot add a strong slot beside the memo with the suite green.
- **The count rows (R2, QA-07):** one build for sixty calls on one parse; one more after a replace.

### 10.5 `CommandPalette.locations.test.tsx` and `paletteLocationsLoad.test.ts`

- **Zero requests and zero writes (FR-40 c, QA-46, QA-47):** over open, type, arrow and choose with the overlay's real modules, a transport spy records nothing, a storage-seam spy records no write, `localStorage` is not written, and the counts of `getFilesStatus` and `readFile` per open equal those of the same cycle with `onOpenLocation` absent. A source scan with comments stripped finds no `transport`, `storage`, `fetch` or `lib/tauri` import in the two new modules, with a guard-the-guard aimed at a module that has one.
- **The laziness spy (R2, QA-07, QA-42):** zero derivations with Search never opened, across a file load and a render of the Hotspot Reports tab; zero until the first frame has been presented, even after the species answer has landed and a key has been typed (the frame is held by the test); exactly one after; zero more across ten opens and fifty keystrokes; one more after a replace.
- **The join (QA-33):** with the frame already presented, location rows for a query are in the commit in which its species rows are, from the first character, and after a file load they join in the commit in which species rows join.
- **Through the real observations cache (QA-23):** a replace removes the old file's location rows in the commit that removes its species rows; no commit after the epoch change offers a location of the old file.
- **Ids hold no file text (FR-40 e, QA-19):** with hostile names and IDs, every option id is the prefix plus an index, and every attribute of the rendered overlay other than the controlled input's `value` is scanned for the hostile strings; the input's `value` is asserted to equal what was typed (security.md, v1.0.34). Two tab stops with zero location rows and with the cap's worth.
- **The sentences** of 4.3, one row per table row, including the failed status read (FR-21), the injected throwing derivation (QA-25) and the first-frame window (QA-22).
- **The highlight** (QA-18), both directions.

### 10.6 The other suites

- **`lib/paletteRows.test.ts`,** new rows only: for a table of queries, `buildSearchRows` without locations deep-equals `buildPaletteRows`; with locations, its first `destinationCount + speciesCount` rows deep-equal `buildPaletteRows`' rows (QA-16, a structural comparison); an empty and a whitespace-only query yield no location row (QA-09).
- **`HotspotReportsTab.request.test.tsx`** (QA-29 to QA-31): consumed once after ready; not re-applied on a later epoch; the later of two requests wins; dropped in setup-required and in error, with no message; a request and an epoch bump in one commit are consumed against the new file; an unknown ID leaves the overview with no announcement, and does not show a previously selected location's report in answer; the already-selected location announces once and advances nothing else; one tab index build across five requests. The tab's existing suites pass with their assertions unmodified (QA-32).
- **App-level** (QA-26 to QA-28): from another tab, from the tab itself, and with the tab never opened; with the tab hidden (the hidden set unchanged afterward, no destination row for it); from a fullscreen Map Explorer (the tab visible, body scrolling unlocked, the Map Explorer not fullscreen on return); from an expanded embedded map, the state equal to the species route's from the same start.
- **`lib/entryChunk.test.ts`** (FR-40 f): the rows of section 7.
- **`lib/palettePublishedClaims.test.ts`:** section 11.
- **Real engines, both** (QA-13, QA-49, QA-50, QA-54): the accessibility tree with three labeled groups, one active descendant, headings and cap lines not exposed as options, the status region present while idle; the layout at 320px and 200% text with a 200-unit unbroken name, the longest place label and a 16-unit ID; the live look on a cap-sized synthetic backup. A probe on the web or Pi preview answers every eBird-backed path in the browser and counts those requests before it loops.

---

## 11. Help, the accessibility statement and held copy

- **`docs/HELP.md`, in the same change, without a stop** (FR-37, FR-38): the Search section states each property FR-37 lists (what Search reaches, the matched field, what a row shows and how namesakes are told apart, that a row opens Hotspot Reports even when that tab is hidden, the order of the three groups and of location rows, the fixed cut with its line and no number, the arrow keys across all three groups, the reworded backup messages, a replace reaching open location results). Its closing paragraph stays and gains one sentence: the report a location opens is the Hotspot Reports tab, which works as that section describes. The Default Files sentence names Search's location results beside its species results; the Hotspot Reports section gains one sentence. No threshold sentence: that form does not ship.
- **`ACCESSIBILITY.md`:** the Search paragraph is read against the built overlay statement by statement, and its sentence about the arrow keys crossing the groups is extended to name locations (Open Question 8's default). It claims nothing about a screen reader beyond what was verified.
- **`palettePublishedClaims.test.ts`:** every existing row stays; new rows hold Help to the code and each is shown red on a mutation of the prose: the location cap's value does not appear in the Search section; the hidden-tab sentence is present and `App.tsx`'s location route does not read the hidden set; the matched field is the name, held to `matchLocations`' column.
- **Not changed** (FR-39): `README.md`, `website/` other than the version stamp, `appstore/LISTING.md`, `PRIVACY_POLICY.md`, `website/privacy.html`, the F-Droid listing text. No screenshot set is regenerated: no tab is added.

**Held for the user's yes, as a patch in `pipeline/visited-hotspots-in-search/held/`, never written to a published file before it** (the App Store "What's New" and the three Fastlane changelogs). Proposed wording, for the Deployer to show in full:

> Search now finds the places in your eBird backup. Type part of a place name, choose it, and its Hotspot Reports page opens.

A `CHANGELOG.md` entry draft goes in the same folder for the Deployer. If the build extends `website/tools/verify/verify-palette.mjs`, that file joins the held patch (flag 7).

---

## 12. Release notes for the later stages (FR-42, FR-43)

- **A patch bump, the six-file set, all asserted by guards:** `frontend/package.json`; `src-tauri/tauri.conf.json` (the bundle version and `bundle.android.versionCode`, 1000072 for 1.0.72); `CHANGELOG.md`; `website/index.html` (the `version-pill` text and its `aria-label`, and the `footer-version` line; the version stamp is the only website change); the three Fastlane changelogs `fastlane/metadata/android/en-US/changelogs/10000721.txt`, `10000722.txt` and `10000724.txt` with the same text, held for the yes and present at the tag; and `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` (`CurrentVersion`, `CurrentVersionCode` 10000724, the three per-ABI `Builds` entries). The numbers assume 1.0.72; the Deployer confirms.
- **Every platform, through the `snowraven-release` skill,** with the App Store leg verified against App Store Connect and both dispositions written into `RELEASE_LEDGER.md` in the same ship.
- **The user's iPhone check of the exact uploaded build gains one step** (FR-43): open Search, type part of a place name, choose a result, and confirm the Hotspot Reports tab shows that place. No widget or native code changes, so the request lists only that step and opening the app.
- **Does not ship (FR-03) remains the outcome** if the Engineer's or QA's measurement finds a gate failing for the full form and for the two forms after it. A failure returns the run to this stage for the next form; no gate is re-stated.

---

## 13. Build order for the Engineer

1. `lib/paletteLocations.ts` with `paletteLocations.test.ts` and `paletteLocationsParity.test.ts`. The parity suite goes green before anything renders.
2. `paletteLocationsLinearity.test.ts` and `paletteLocationsLifetime.test.ts`; the mutants seen red; the acceptance readings recorded.
3. `buildSearchRows` in `lib/paletteRows.ts` with its rows.
4. `lib/paletteLocationsLoad.ts`, the overlay's location half, the copy, `CommandPalette.locations.test.tsx`. The three string pins edited and listed.
5. `App.tsx`'s request and the tab's consume effect, with their suites.
6. `entryChunk.test.ts` rows; the rule files' `paths`; Help and the accessibility statement with their published-claims rows.
7. **The second measurement (FR-02 b):** R1 to R5 in the built app in Chromium and WebKit on a cap-sized synthetic backup, recorded in `decisions.md` with fixture, engine and first call or best-of for each figure, beside the form selected and the figures of section 0.
8. `npm run build` and `eslint`, then the FULL vitest suite (text other guards pin word for word was edited).

---

## 14. Decisions recorded, each with what would reverse it

| # | Decision | Evidence | What would reverse it |
|---|---|---|---|
| D-1 | The full form ships (FR-33) | Section 0: every gate passes at the house legs, R1 by 28 times and more, R2 by more than twice | The Engineer's or QA's built-app measurement failing a gate (FR-02) |
| D-2 | A slim second pass, not `buildLocationIndex` | 0.6: the tab's build first-called at 48 to 53 ms in V8 across 14 readings, at the 50 ms line, and holds 7 MB in JavaScriptCore | The tab's build becoming cheaper than the limit by a clear margin; parity would then be free |
| D-3 | One flat column, not a search text per location | 0.6, 0.5: 2.0 per doubling against up to 14 | A measured case in which the flat column is slower at a real backup's size |
| D-3a | R3's linearity is read at the house method's cache-resident legs (0.1) | 0.5: the derivation holds its derived limit there and not at the cap-size doublings; the tab's index reads the same | The user reading the gate at the cap-size doubling. The feature then does not ship in any form (FR-03) until the derivation changes |
| D-4 | Locale compare, the tab's order (2.3) | Zero order and namesake differences over the corpus | The tab changing its comparison |
| D-5 | `LOCATION_CAP` 50, the query bound 200 | 9.3 | A layout or live-look finding from the Designer |
| D-6 | A `WeakMap` keyed on the parse's identity (2.4) | The lifetime probe in both engines, with its control | A second live parse existing at once |
| D-7 | The derivation waits for the first frame when it would otherwise precede it (4.2) | R2's paint clause; 18 ms first call | The user ranking FR-33's letter above that clause |
| D-8 | `buildSearchRows` wraps `buildPaletteRows` (section 3) | NFR-05 | None foreseen |
| D-9 | The column ceiling (2.6) | security.md v1.0.57 | None foreseen |
| D-10 | The main thread, no worker | The realistic derivation is 5 to 21 ms once per file; a hostile one is 0.16 to 0.94 s once (0.5), in the range the shipped species pass takes on a like file (0.21 to 1.05 s) | A live report of a stall on opening Search, or a real backup measured near the hostile figures. Then the pass moves behind the shared parse's worker, crossing as a string table and transferred buffers, never cloned records |
