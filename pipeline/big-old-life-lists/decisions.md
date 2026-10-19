# big-old-life-lists: Engineer decisions

Improve lane, stage 2 (The Engineer). Every entry is dated 2026-10-19. The
measurement came first, and entries 1 to 3 were written from it before items 2
and 3 were built. The harness that produced every number is in
`evidence/harness/` and its raw output in `evidence/measurements/`; each table
names the script that re-runs it.

## 1. The measurement (2026-10-19)

**Inputs.** `evidence/harness/gen-big-export.mjs` writes a seeded synthetic
export with the demo generator's 23 columns and cell shapes, scaled to a
decades-long world list: species from the bundled eBird taxonomy, 60 regions of
120 to 280 hotspots, 3 to 14 species per checklist, a checklist comment on 30% of
checklists repeated on each of their rows (85% of them weather blocks with
emoji, as the app writes them, which makes the whole text a two-byte string), 9%
species comments, 5% catalog ids, and 2.2% of checklists before 1970 (0.2% before
1900). Files: 21,856 rows (5.9 MB), 300k (83 MB), 600k (166 MB), 1M (278 MB),
about 277 characters a row. The reference export (21,369 rows, 6.9 M chars, the
user's own file on this Mac, read in place and never copied into the repo) ran
beside them. Its per-row figures match the synthetic 21,856 within 12%, so the
synthetic is a fair stand-in.

**Engines and method.** No physical device was touched.
- V8: Node 24.18 (V8 13.6), `measure-node.mjs`, `measure-p4-node.mjs`:
  `process.memoryUsage().heapUsed` (+ `arrayBuffers` for the packed form) after
  three forced GCs, as a delta with the source text alive in both readings.
  Node runs without pointer compression, so its bytes per row run high; the
  Chromium column is the shipped V8 configuration.
- JavaScriptCore: the macOS `jsc` shell (`measure-jsc.js`, `measure-p4-jsc.js`):
  `gcHeapSize()` after `fullGC()`, same delta method. The engine of the Mac,
  iPhone and iPad apps.
- Chromium (Playwright 1.62, headless Chromium 151) and WebKit (Playwright
  WebKit 26.5), `drive-browsers.mjs` over `page.html`: the real worker pipeline in
  a page. Heap per copy from `performance.memory` with
  `--enable-precise-memory-info` and `--js-flags=--expose-gc`; peak memory as the
  content process's resident size sampled every 100 ms with `ps`.
- Pi stand-in: the same Chromium with CDP `Emulation.setCPUThrottlingRate` 4 and
  6 (the v1.0.20 method). **CDP throttles the main thread only**: the worker's
  own parse and stats times came back unchanged at 4x and 6x, so the throttled
  rows are main-thread figures, and a Pi's worker legs are the 1x figures scaled
  by inference, not measured.
- iOS: Mobile Safari in the iOS 27.0 simulator (iPhone 17e), `run-ios-sim.sh`,
  the same WebKit as the iPhone app's WKWebView; peak as the simulator's
  WebContent process resident size (a host process, read with `ps`). The
  simulator enforces no jetsam limit, so these are memory readings, not survival.
- Android: Chrome 133 on the API 36 emulator (`sr-api36-phone`, 4 GB),
  `run-android.sh`, the same Chromium as the System WebView 133 the release
  records measure; peak as the renderer's resident size via `adb shell ps`.
- **Not driven: the built Mac, iPhone and Android apps themselves.** Loading a
  300 MB file into them needs the native picker or writing into an app data
  folder, and on this Mac the Mac app's data folder is the user's real one. The
  engines above are the apps' engines; the apps add an IPC read of the file that
  these pages replace with `fetch`, so the apps' own peaks are somewhat higher.
  This is a stated partial.

**Heap per held copy, the shipped parse** (`engines-v8-jsc.jsonl`,
`chromium-heap-per-copy.jsonl`). A copy is the parsed array; the main thread's
copy is a structured-clone deserialization of the worker's reply and the stats
worker's is another, so the clone column is the figure for both.

| rows | V8 copy | V8 clone | Chromium | JSC |
|---|---|---|---|---|
| reference 21,369 | 19.0 MB (931 B/row) | 18.3 MB | 14 MB (697) | 20.3 MB (998) |
| 21,856 | 17.3 (832) | 16.7 | 13 (603) | 18.8 (902) |
| 300,000 | 238 (832) | 232 | 175 (611) | 260 (908) |
| 600,000 | 477 (833) | 465 | not run | 518 (906) |
| 1,000,000 | 793 (831) | 776 | 584 (612) | 868 (910) |

Linear, so the brief's guess of about 0.9 GB a copy at 1M rows was right for
JavaScriptCore and a little high for Chromium. Two copies are held (main thread
and the Statistics worker), plus the text during the parse.

**Time** (1x, this M1 Pro). Shipped parse at 1M rows: V8 3.8 s, JSC 5.0 s. The
main-thread legs, which the user feels: deserializing the parse reply 1.2 s and
posting the stats hand-over 1.3 s (Chromium, 1M rows); at 300k rows under the 6x
Pi throttle, 2.05 s and 1.94 s. Statistics bundle in its worker at 1M rows: 5.9 s
(Chromium), 5.1 s (WebKit).

**Per tab, the mount-time derivations** (`measure-tabs-*.js`, ms, shipped
shape; the packed shape's figures are in the same file). At the reference export
every tab is under 120 ms in both engines. At 1M rows in JSC: Statistics bundle
8,064 (worker), Statistics main-thread part 1,380, Calendar 780, Map Explorer
3,280, Breeding Codes 251, Named Birds 45, Checklists 1,628, Species Detail
4,243, Targets 507, Search index 172. Multimedia's main cost is private to
`LifeList.tsx` and was not timed. These are linear in rows; the long tasks they
make on a million-row export are recorded, not fixed (outside the brief).

**Peak memory in the content process**, the number that decides whether a page
survives (`browsers-chromium-webkit.jsonl`, `ios27-sim-safari.jsonl`), shipped
parse: 300k rows 1.19 GB Chromium, 2.07 GB WebKit, 1.54 GB iOS simulator; 1M rows
2.71, 3.75 and 2.61 GB. **Most of a peak is the TEXT, not the parsed copies:** a
two-byte string of 277 M characters is 554 MB, held once by the parse worker and,
in the shipped code, once more by the main thread for the whole parse.

## 2. The shape: a packed form across every thread boundary, ordinary objects on each side (2026-10-19)

**Chosen: P4.** The parse worker builds a packed form (`observationsPacked.ts`):
one table of distinct strings, string and number slots in flat typed arrays,
per-row optional-key bits, and a catalog-id pool. The reply sends the table
(cloned once per DISTINCT string) and TRANSFERS the buffers; the main thread
materializes plain `ObservationEntry` objects from it, every one of them pointing
at the table's single instance of each string. The Statistics hand-over packs the
main thread's entries and transfers that; the stats worker materializes its own.
Nothing is persisted in this shape.

**Measured, per held copy** (the same files; JSC and Node read objects plus the
string table, Chromium's split is from `probe-chrome`, 151 B/row objects plus the
table):

| | shipped | packed | factor |
|---|---|---|---|
| JSC, reference | 998 B/row | 240 + ~45 | 3.5x |
| JSC, 1M rows | 910 | 235 + 37 = 272 | 3.3x |
| Chromium, 300k and 1M | 611 | ~151 + ~30 = ~180 | 3.4x |
| V8 Node (no pointer compression), 1M | 831 | 271 + 34 = 305 | 2.7x |

At 1M rows a held copy falls from 868 MB to about 272 MB in JavaScriptCore.
At the small end the factor depends on how many rows share a checklist: the
reference export (6.6 rows a checklist, long weather blocks) is 3.5x in JSC and
about 3.9x in Chromium, the synthetic 21,856 (comments unique per checklist) 2.6x
in JSC; Node's no-pointer-compression V8 reads 2.3x to 2.9x.

Every tab's output on the reference export is identical, checked twice: the
per-tab derivations serialized and compared (`measure-tabs-node.mjs ... check`,
all ten true), and every tab's PAGE TEXT in the built app, the base commit's
build against this one over one copy of the reference data, in Chromium and
WebKit at 1440px with the clock pinned (`compare-builds.mjs`,
`identical-output-reference.json`: 11 of 11 tabs identical in both engines;
the file records hashes only, never the user's text). The
1M-row packed parse equals the shipped parse slice by slice, and the parser
oracle (`parseEbirdObservationsStreaming.test.ts`, which carries the pre-change
parser verbatim) passes over the demo export, the real export on this Mac, the
malformed probes and the 3,905-string control alphabet with the round trip in
the path.

**Time.** The pack interns through a Map, so the worker's parse is slower: 1M
rows 5.0 s V8, 7.5 s JSC, against 3.8 and 5.0. The main thread gets faster,
which is what the user feels: the reply costs 18 ms to receive plus 204 ms to
materialize (Chromium, 1M) against 1.2 s, the hand-over 620 ms of packing plus a
15 ms post against 1.3 s, and at 300k under the 6x throttle the main-thread total
is 1.30 s against 3.99 s. The Statistics compute itself is faster on shared
strings (JSC 1M: 5.0 s against 8.5 s in the engine run). The parse budget
formula is unchanged: 0.004 ms per character is still about 150x the slowest
engine's measured 0.027 us per character.

**Why not the alternatives.**
- **P1, interning in the parse alone** (measured: V8 315 B/row, JSC 247): a V8
  structured clone does not keep string sharing, so the main thread's copy came
  back at 782 B/row, and the stats worker's would too. JavaScriptCore keeps it
  (its clone serializer has a string pool), Chromium does not. The sharing has
  to be in the data, not in what an engine's clone happens to keep.
- **P3, no per-row objects (typed-array columns behind getter views):** 41 B/row
  of V8 heap plus the arrays, about 160 B/row in all, roughly twice P4's saving.
  Not taken: 42 files read `ObservationEntry`, and views change what spread,
  `Object.keys`, `in`, `JSON.stringify` and a structured clone see, so "every
  tab's output is identical" would rest on auditing every consumer rather than
  holding by construction. Recorded as the next step if a 1M-row export must fit
  a phone: it is the only shape that takes the per-row object cost off.
- **Keeping the packed form beside the entries on the main thread** would make
  the hand-over a clone of buffers instead of a pack, but costs ~112 B/row for
  the export's life (112 MB at 1M rows). Packing per hand-over costs 7 ms on the
  reference export and 0.5 to 0.95 s at 1M rows, still under the clone it
  replaces, and the hand-over happens once per 30-second idle cycle at most.

**Retention rules kept.** The parse still builds every field by `+=` from
single characters and `.trim()`s it, so no stored string is a slice of the
source; `firstLine`'s indexOf-plus-copy rule and its drift guard are untouched;
the row-capacity count added to the parse uses `indexOf` and no regex or slice.
The `speciesIndex` WeakRef memo keys on array identity, which is unchanged (one
array per load). The packed form is in-memory only, so no `clearDerived` row.

**Two engine facts that shaped the code, both measured.** (1) A suspended async
function keeps a block-scoped local alive across later awaits: the harness page
held the packed reply's buffers for the length of the run until the materialize
moved into a plain handler. So `parseOffThread` materializes inside `onmessage`,
and `loadFresh` became a promise chain. (2) Chromium's `usedJSHeapSize` counts
typed-array backing stores, Node's `heapUsed` does not (`arrayBuffers` does).

## 3. The upload cap, per platform, memory-neutral against the old 50 MB (2026-10-19)

**Rule.** A platform's cap is a round size at which the packed parse's measured
peak is no more than the shipped parse's peak at 50 MB on the same engine, read
over three or four runs each (`run-caps.sh`, `run-caps-confirm.sh`;
`caps-*.jsonl`). So no device is asked for more memory than 50 MB already asked
of it. The peak is mostly text, which the packed shape does not shrink, so the
raise is modest. A cap that would let a 1M-row export in on a phone needs the
text held once as bytes, not twice as a two-byte string; that is recorded below
as the next step, not taken.

| platform (engine) | shipped at 50 MB | packed at the candidate | cap |
|---|---|---|---|
| iPhone, iPad (iOS 27 simulator, WebKit) | 1,043 / 1,083 / 1,189 MB | 64 MB: 948 / 1,268 | **64 MB** |
| Mac (Playwright WebKit) | 1,289 / 1,141 / 1,226 / 1,211 | 64 MB: 1,271 / 1,475 / 1,386 (+13%) | **64 MB**, the iPhone's |
| Android (Chrome 133, API 36 emulator) | 913 / 862 / 891 | 100 MB: 947 / 971 / 972 (+8%) | **80 MB** (slope puts it at ~830) |
| Windows, web/Pi (Chromium) | 777 / 817 / 765 | 100 MB: 783 / 740 / 809 | **100 MB** |

- **The Mac takes the iPhone's cap**, although desktop memory would allow more,
  because iCloud Sync carries the backup between them and the pull path is
  deliberately not guarded by the upload refusal (a synced arrival is not an
  upload). A Mac cap above the iPhone's would let a file reach an iPhone that
  could not hold it. The Mac's own WebKit read 13% (about 160 MB) above its 50 MB
  figure at 64 MB, which a desktop absorbs. A test pins mac == ios.
- **Windows** reads the Chromium row (WebView2). Not separately measured.
- **web/Pi** stays twinned with the backend: `EBIRD_MAX_BYTES` in
  `backend/routers/settings.py` is 100 MB, and `uploadGuard.test.ts` reads it
  and `MAX_BYTES` from the Python. A Pi opened in a phone's browser is the iPhone or
  Android case at 100 MB, which is over those engines' neutral point; stated, not
  guarded (web/Pi has no platform probe for the browser it runs in).
- **iCloud's 200 MB per-file bound is unchanged**, and both Apple caps sit under
  it (`icloudPaths.parity.test.ts`).
- **The raise is the eBird backup's alone.** The ML export and a bar-chart file
  keep 50 MB on every platform (`MAX_UPLOAD_BYTES`, twinned with the backend's
  unchanged `MAX_BYTES`), because neither parse was made compact: the ML parse
  still retains its cell grid, and `parseMLExportOffThread.ts` names the 50 MB cap
  as what keeps that safe. The measurement licenses the backup's raise and says
  nothing about them. The backend gained `EBIRD_MAX_BYTES` (100 MB) for the
  backup slot; `_upload` reads the slot's cap at call time, and a backend row
  proves each slot reads only its own. Found by sweeping the source for "50 MB"
  after the first cut had raised one shared cap: the ML budget's comment was the
  claim that would have gone false.
- What a raise buys in rows, at the reference export's ~330 bytes a row: 64 MB is
  about 200k rows, 80 MB 250k, 100 MB 320k (50 MB was about 160k).

## 4. The size refusal reads the picker's size, before any read (2026-10-19)

`refuseBySize(byteLength)` in `uploadGuard.ts` refuses on `File.size` before a
byte is read, on both upload paths: Settings' `importFileContent` (via
`handleUpload`, which passes `file.size`) and the Targets bar-chart import
(`importBarChartFile`, the same). The message is `tooLargeMessage(cap)`, formatted
from the platform's constant (the v1.0.24 rule), so each platform's line names
its own limit. `refuseByContent`'s UTF-8 count stays as the backstop.

**The dialog fallback states its own answer in writing**
(`importMechanism.ts`): `open()` returns a path only, and a pre-read size needs
plugin-fs `stat`, which no capability grants. So on that path the size is
checked after `readTextFile`, by the backstop. It is acceptable while no platform
uses the fallback (both constants are `'input'`); flipping either owes
`fs:allow-stat` for the picked path and a `stat()` before the read, named there.

**Declined, with the reason: the List Comparer's file read.** It reads a picked
CSV with `FileReader` to compare species lists, stores nothing, and never passes
through the refusal registry. A size check there would be a new sentence on a
screen the brief says does not change, and its parse (`parseEbirdCSV`, a species
set) holds far less than the observations parse. Flagged for the user rather
than added.

## 5. The stats budget's ceiling is derived from the parse budget at each platform's cap (2026-10-19)

`STATS_BUDGET_CEILING_MS` (the literal 240 s) is now `statsBudgetCeilingMs()`,
the parse budget (`parseBudgetMs`, unchanged and moved into its own module,
`parseBudget.ts`, so suites that mock `observationsCache` wholesale keep it) at
this platform's upload cap. Characters never exceed
UTF-8 bytes, so no accepted export's parse budget passes it, and "anything that
survived its parse has at least as long to compute" holds by construction. At
the old 50 MiB cap the derivation gives 239.7 s, the shipped 240 s within a
third of a second (pinned in `statsOffThreadSettle.test.ts`). Ceilings now: 64 MB
298 s, 80 MB 366 s, 100 MB 449 s. The per-row allowance (1.5 ms) and the floor
are unchanged; the stats worker's idle bound (30 s) is re-argued in place and
kept: the held copy is a third of what it was, not nothing.

## 6. The main thread lets go of the text once it is posted (2026-10-19)

The shipped `loadFresh` held the whole export on the main thread for the length
of the parse (an async function's `read` local, and `parseOffThread`'s parameter
captured by the reply handlers' scope), so a parse held two copies of the text,
one per thread. Now `loadFresh` is a promise chain whose `startParse` takes the
header line and posts the text and returns, and the reply handlers are made in
`awaitParseReply`, which never sees the text. The header is now read BEFORE the
parse (the same null answer, without parsing a file that would be refused after).
In the harness page the same release (`release=1`) is part of every "packed" peak
above; it is half of why the packed peaks fall at all, since the copies are the
smaller part of a peak.

## 7. Caps a 1M-row export reaches: two raised, the rest examined and kept (2026-10-19)

A 1M-row export holds 118,809 checklists at the synthetic export's 8.4 rows a
checklist and about 152,000 at the reference export's 6.6. So a cap keyed on
CHECKLISTS is reached; a cap keyed on something export size does not drive is
not.

| cap | was | now | why |
|---|---|---|---|
| `PROJECTS_MAX_CHECKLISTS` (fill-and-stop) | 65,536 | **262,144** | one entry per swept checklist |
| `PROVENANCE_MAX_CHECKLISTS` (FIFO ledger) | 32,768 | **262,144** | one entry per consulted checklist |
| `PROVENANCE_MAX_SPECIES` (admission) | 16,384 | 16,384 | above the world list (11,167); cannot bind |
| `COMPLETENESS_MAX_ENTRIES` / `_BYTES` (FIFO) | 250 / 4 M | unchanged | keyed on birded counties in view, which a map pan drives, not export size; an eviction costs one re-fetch |
| `DAY_OBS_MAX_ENTRIES` / `_BYTES` | 3,000 / 10 M | unchanged | keyed on the counties opened in Targets; so the main-thread peer merge (DECISIONS ~442) keeps its standing |
| replay (300), hotspot activity (2,000), name memo (32,768) | | unchanged | keyed on responses, hotspots in view and published names (17,891), none of them export-sized |

**Superseded for both raised caps by entry 12:** the security review (L1) found
that neither 262,144 fits under the web/Pi settings route, and they shipped as
65,536 (projects, back to OQ-02's value) and 131,072 (ledger). The rest of this
entry is the record of what was measured at 262,144.

Both raised caps keep their policy and are now `*_DEFAULT` constants the test
seams reset to, so a reset can no longer restate a stale literal. Each is
measured at the SHIPPED cap plus one as work done (`checklistProjectsCache.test.ts`,
`exoticProvenanceCache.test.ts`): a full projects document refuses the next key
with zero evictions; a full ledger evicts exactly one and shifts exactly the cap.

**The measured costs** (`measure-settings-docs.js`, `measure-snapshot-rebuild.js`):
- Both stores live inside the shared settings document, which every preference
  save parses and rewrites whole. At 262,144 the projects store is 18.8 M
  characters typical (46 M worst admitted) and the ledger 10.5 M: one save's
  parse plus stringify is about 250 ms (V8) and 140 ms (JSC) for the projects
  store, 220 and 70 ms for the ledger, against about 55 and 30 ms at the old caps.
  A store grows only as its sweep or passes admit checklists, so only an account
  past the old cap pays any of this.
- Each admitted answer rebuilds the store's snapshot over every key: 47 ms (V8)
  and 46 ms (JSC) per answer at 262,144 for the projects Map, 16 ms for the
  ledger Set, against 5 ms at the old projects cap. Filling 262,144 entries
  through the merge path in a test is therefore quadratic (it did not finish in
  five minutes), which is why the capacity rows load a full document instead.
  In the app the sweep is paced at 150 ms or more per request, so late in a
  sweep of that size about a third of the main thread goes to rebuilds.
- Both are recorded as follow-ups rather than fixed here: the projects store
  belongs in its own document with its own writer (the day-obs store's v1.0.39
  move), and both snapshots could update in place. Neither is in the brief, and
  each changes a shipped store's shape or contract.

## 8. Milestones run to 10,000, and the five-digit label fits the grid (2026-10-19)

`MILESTONE_THRESHOLDS` gains every 500 from 3,500 to 10,000 (eBird's taxonomy
holds about 11,000 species), rendered in the existing tier 4. No token, class,
tier or grid rule changed. `birdingStats.test.ts` proves a 10,050-species list
reaches each new threshold on the species that reached it.

**Re-measured in the BUILT app** (`measure-milestone-grid.mjs` over the backend
serving `gen-milestone-export.mjs`'s 10,050 species; `evidence/milestone-grid/`):

| engine, text | columns | badge | `10,000` slack | any overflow or wrap | page scroll |
|---|---|---|---|---|---|
| Chromium 100% | 2 | 117 px | 26 px | none | 0 |
| Chromium 200% | 1 | 242 px | 61 px | none | 0 |
| WebKit 100% | 2 | 117 px | 25 px | none | 0 |
| WebKit 200% | 1 | 242 px | 60 px | none | 0 |

The grid is the v1.0.50 shape exactly (two 117 px columns at 100%, one at 200%),
and the widest label keeps 25 px. So the v1.0.50 reversal condition is not met
and nothing routes to The Designer. The screenshots are the last eight badges at
320 px in each engine and scale. One pre-existing behavior shows in them and is
not this change's: a long single-word name ("Laughingthrush") breaks mid-word
under the grid's `overflow-wrap: anywhere`.

## 9. Pre-1970 and pre-1900 dates: driven through every tab, no defect found (2026-10-19)

`gen-eras-export.mjs` writes 44 checklists from 1850 to 2026, including the
boundary days where date code goes wrong: 1883-11-17 to 19 (US time zones
replaced local mean time on the 18th), 1899-12-31 and 1900-01-01, 1969-12-31 and
1970-01-01, and 2000-02-29. `sweep-eras.mjs` drove every tab of the built app
over it in Chromium and WebKit with the zone pinned to America/New_York
(`evidence/eras/sweep-eras.json`): every tab reached, no page error, no console
error, no "Invalid Date", "NaN", "undefined" or "Infinity" in any tab's text, and
Statistics' per-year rows printed all fourteen boundary years in both engines.
Under the same zone in Node, `buildDayCells` puts each boundary checklist on its
own day (1883-11-17, 18 and 19 in their own cells). The two places that count
days between dates (the streak, the weekly period key) anchor at local noon and
round or floor with twelve hours of margin, which the 1883 offset change
(3 min 58 s) cannot cross. The 10,050-species milestone fixture runs 1890 to 1917
and renders its dates ("May 19, 1917") in both engines.

## 10. Splits and lumps back to 2019: the generator is ready, the inputs are owed (2026-10-19)

Fixed from what the derive core and its tests show; the asset is NOT
regenerated, because Cornell's files are not on this Mac (the input folder
holds only its README; birds.cornell.edu refuses scripts) and the run fetches
nothing.
- **The 2022 Pink Pigeon shape.** A candidate lump whose whole before side is
  ONE species that is the survivor's own previous identity lost no species: a
  re-code, a rename, or a subspecies moved in under a "lump" annotation. It is
  now excluded like any other rename. It is not a guess, because:
- **eBird's announced tally is now REQUIRED for every covered year.** A real lump
  excluded by the rule above leaves the derived "lost" short, and the run fails
  closed naming what it excluded. 2023 to 2025 carry their tallies; 2019, 2021
  and 2022 need theirs added (the user, from eBird's announcements).
- The rule cannot change the committed 2023 to 2025 asset: under the old code
  any such candidate failed closed, and that asset was generated, so none exists
  in those years.
- **Failure messages name what was wanted:** a missing column lists the header
  the file has; an unused input names, for every uncovered year, the exact file
  or column that year lacks; a year whose change cells use another vocabulary
  (the 2021 and 2022 files' "colon-style" vocabulary the v1.0.41 schema
  recorded) shows the cells it saw, beside the tally failure it causes; and
  integrated headers written with underscores are read.
- **No 2020 row, deliberately.** eBird released no 2020 update, which
  `YEARS_WITHOUT_UPDATE` already records, so 2021's previous update is 2019.
  Reversal: a v2020 file on Cornell's download page means adding the row and
  taking 2020 out of that list.
- `taxonomyHistoryGenerator.test.ts` holds each of these on the in-memory
  fixture, and the README lists the fourteen files and three tallies the
  follow-up needs.

## 11. Verification record (2026-10-19)

Run after the last code change (`7ea28392`), on this Mac with the emulator and
simulator shut down and nothing else of mine compiling:
- `cd frontend && npx vitest run`: **472 files passed, 5 skipped; 10,256 tests
  passed, 6 skipped, 0 failed** (95 s). The first full run had 8 failures: 7 in
  `statsWorkerFallback.test.tsx` (its wholesale `observationsCache` mock had no
  `parseBudgetMs`, fixed by entry 5's module move, and its fake worker took the
  old hand-over) and 1 timing quotient in `alphaCodes.test.ts` (3.26 against a
  3.2 ceiling, a file this run does not touch; 15 of 15 green alone and in the
  second full run).
- `npm run typecheck` (tsc -b): clean. `npm run lint` (eslint): clean.
- `npm run build`: built; the one warning (a chunk over 1,100 kB) is the base
  commit's too.
- `cd backend && .venv/bin/python -m pytest tests/ -q`: **2,063 passed**
  (2,066 with the three I6 rows, added after the re-checks).
- Literal non-ASCII in the change: none added to source. The em dashes in
  `parseBudget.ts` and `observationsCache.ts` are comment text that moved with
  its block. The harness's weather-block emoji, written as `\u` escapes, had
  been turned into literal characters by an edit; they are escapes again and the
  generator's output is byte-identical (`cmp`).
- The settle contracts: a reply that does not materialize settles the parse as a
  failed load (new row in `observationsCacheSettle.test.ts`); the stats
  hand-over materializes in the worker inside its `try`, so a bad one answers
  `{ ok: false }` and the caller falls back.

**What is Partial, and why.**
- The built Mac, iPhone and Android apps were not loaded with a large export
  (entry 1): the engines were measured in pages instead. The apps read the file
  over IPC, which adds a copy these pages do not have.
- Physical devices were not used (CLAUDE.md). The iPhone and Android caps rest on
  the simulator's and emulator's memory readings against the shipped 50 MB
  peak, not on a device's kill limit.
- The CPU-throttled Pi stand-in throttles the main thread only (entry 1).
- Splits and lumps coverage before 2023 waits for the user's files and tallies
  (entry 10).

## 12. Three security review findings fixed before the ship (2026-10-19)

The Auditor passed the build with notes (`security-report.md`). Three findings
are defects this build introduced or left, and are fixed here, one commit each.
Not touched, by direction: L3 (iCloud version skew, for the user at the deploy
gate), L4 (the List Comparer's read, the user's call) and I1 to I4.

### L1. The checklist-keyed caps are bounded by the web/Pi settings route (`ea1d0c07`)

**The finding.** On web/Pi each store is posted whole to `/settings/{key}`,
which refuses a body over `_MAX_BYTES` (16 MiB, `backend/routers/settingskv.py`)
with 413, and both stores' writes are best-effort and swallow it. At entry 7's
262,144 the projects document outgrew the limit somewhere between about 89,000
and 227,000 entries; past that it stopped being saved, every session re-asked
eBird for each checklist beyond it, and each refused flush uploaded 16 to 50 MB.

**Chosen: the bounded cap, not the store's own document.** The move needs a new
Tauri file with its own ordered writer, a new web/Pi route with a limit made for
it, a migration out of `settings.json`, and the clear-path registration redone:
not small. And the raise bought a typical account nothing: a typical export at
the largest upload cap (100 MB) holds 38,000 to 57,000 checklists, under 65,536.
The move stays the recorded follow-up for anyone who needs a larger cap.

**The rule: each cap is the largest power of two whose WORST-CASE document fits
under the route's limit.** Worst case means every dimension at the store's load
validator's bound, measured as the UTF-8 size of `JSON.stringify` of the
document, which is what `WebStorage.setSetting` posts.

| store | worst case per entry | worst document at the cap | at twice the cap |
|---|---|---|---|
| projects, **65,536** | 201 B (16-char key, 32-char `proj`, eight 9-digit ids, a 25-char number, its order slot) | 13,172,771 B | about 26.3 MB |
| ledger, **131,072** | 64 B (16-char key, a 25-char number, its order slot), plus 7,057,493 B for the species index (16,384 records at their bounds) and the published names (4,096 of 128 six-byte units) | 15,446,101 B | about 23.8 MB |
| route limit | | 16,777,216 B | |

**The ledger has the same exposure, and is treated the same way.** With real
10-digit ids and epochs its 262,144-entry ledger is about 11 M characters, which
fits, as the Auditor measured; but the document the validator admits does not
(about 23.8 MB). It is now 131,072, still four times the 32,768 it was before
this build. Its policy (FIFO) is unchanged, so its cap binding costs one
redundant request per eviction and loses no answer.

**The guard, `frontend/src/lib/settingsRouteBudget.test.ts` (7 rows), compares
the two declarations and restates neither.** It reads `_MAX_BYTES` from the
Python (exactly one assignment, a product of integer literals, tied to its
enforcement line `if len(raw) > _MAX_BYTES:`). It measures the two JSON facts the
worst cases rest on rather than asserting them: the longest JSON of a finite
double is 25 characters (`-0.0000012345678901234567`: a sign, `0.`, five zeros,
17 digits); my first draft said 24, and the row's sample of 200,000 random bit
patterns found a 25 at once. And no UTF-16 code unit costs more than 6 bytes in a
JSON string (all 65,536 swept). For each store, each dimension of the worst entry
is shown to be the validator's largest admitted value (admitted, and one past it
refused), except the published names, whose length and count the guard finds by
asking the load path. Then the document is built at the cap THROUGH
`sanitizeStore` (the projects load path's own cap clamp included, fed one entry
over) and its size compared with the Python constant.

Mutations (each restored by hash, suite re-run green):

| mutation | result |
|---|---|
| projects cap back to 262,144 | red |
| ledger cap back to 262,144 | red |
| `proj` bound widened to 33 | red (the one-past row) |
| species cap doubled to 32,768 | red (the document no longer fits) |
| `_MAX_BYTES` lowered to 12 MiB | red, both stores |
| published-name length bound 129 | GREEN, and correctly: the guard finds that bound by asking, so the measured document grows by 4,096 six-byte units and still fits |

**Scope, stated.** The bounds are the LOAD validators'. Each store's write path
writes values inside them: keys are refused before any request by
`fetchProjects` and `fetchProvenance`, times are `Date.now()`, project answers
pass `isValidEntry` at the write chokepoint, provenance tokens come from the
seam's bounded normalizer, and published names are names that resolved to a
species code through the taxonomy (eBird's longest is 63 characters, DECISIONS
v0.5.85). The provenance load path does not clamp its ledger or species COUNTS;
its merge path does (FIFO, admission), so a document hand-grown past the caps is
outside this bound, as before this build.

**At the new caps, capacity+1 still holds, counted as work done:** at
65,536 + 1 the projects store refuses the new checklist and drops nothing
(`checklistProjectsCache.test.ts`), and at 131,072 + 1 the escapee ledger drops
exactly one entry, the oldest (`exoticProvenanceCache.test.ts`).

**The Python half is pinned too (security re-check I6).** The guard above pins
the constant, not its enforcement: with the 413 check made unreachable and its
text intact, all 30 settingskv tests and the 7 guard rows stayed green. Three rows in
`backend/tests/test_settingskv_router.py` lower `_MAX_BYTES` by monkeypatch and
expect 413 (nothing written) at the limit plus one, 200 at exactly the limit, and
200 again in a canary after them. Red-first in a scratch copy of `backend/`: the
check indented under `if False:` turns the over-limit row red and leaves the
other two green.

Also in the commit: the two capacity+1 rows no longer assert the raise's old
reason (`>= 152,000`) and point at the guard; `settingskv.py`'s comment names
its twins. No in-app text or `docs/HELP.md` names either cap, so no copy
changed. Residual, as before this build: an account with more than 65,536 swept
checklists reaches the at-capacity state.

### L2. The pack's capacity hint is bounded by the file's length (`8b443359`)

**The finding.** `rowCapacity` counted every line feed, and the builder
reserved 122 bytes of typed array per counted line, so an eBird header followed
by line feeds (blank lines, line feeds in a quoted field and rows with no common
name behave the same) reserved 8.2 GB at 64 MB and 12.8 GB at 100 MB. macOS
reserved it without filling it; a device with a tighter allocation limit would
show "couldn't load your backup" where the shipped parse loaded an empty backup.

**The fix.** `rowCapacity` also stops at `ceil(content.length /
PACKED_BYTES_PER_ROW)`. `PACKED_BYTES_PER_ROW` (122) is derived in
`observationsPacked.ts` from the typed arrays' element sizes, so a slot added
there moves the bound with it. The file cannot inflate this bound: the
reservation stays under one byte per character of the text it was counted from,
plus at most 381 bytes of fixed overhead, and that text is already held as a
string at least that large. Real rows are longer than 122 characters (173 on the
demo export, 277 on the synthetic one, 323 on the reference), so for a real
export the line-feed count is the smaller bound and the arrays are sized once,
exactly as when entry 3's peaks were measured; those caps stand. A file of
shorter rows starts short and the builder doubles as rows arrive, so its
capacity stays under twice the rows it makes.

**Declaration of the scan (`.claude/rules/security.md`, v1.0.47).**
- The read: one forward pass of `indexOf('\n')` over the export's text. Each
  search begins one past the previous line feed and ends at the next one or at
  the end of the string; a -1 ends the loop, so the delimiter-absent case is a
  single search. The loop also ends once the count reaches the length bound.
  Each character is visited at most once by the native searches: O(n). No regex
  and no slice, so the retention rule is unchanged.
- The number it produces drives one allocation, now bounded by the file's
  length; growth past it is driven by rows actually added, one per
  `entryFromRow` result.
- Measured through `packEbirdObservations` (Node 24, best of 3, load average 6
  to 9 on this Mac; `evidence/harness/run-pack-reservation.sh`,
  `evidence/measurements/pack-reservation-after-l2.jsonl`; no user data read):

| shape | size | rows | reserved | time |
|---|---|---|---|---|
| line-feed flood | 8 MB | 0 | 1.000 B/char | 556 ms |
| | 16 MB | 0 | 1.000 | 1,129 |
| | 32 MB | 0 | 1.000 | 2,230 |
| | 64 MB | 0 | 1.000 (67 MB; was 8.2 GB) | 4,623 |
| | 100 MB | 0 | 1.000 (105 MB; was 12.8 GB) | 7,037 |
| demo export repeated | 9.5 M chars | 55,083 | capacity = line feeds + 1 | 135 |
| | 17.7 M | 102,297 | same | 249 |
| | 34.0 M | 196,725 | same | 504 |
| | 68.1 M | 393,450 | same | 1,061 |

  About 2x per doubling on both shapes. The flood's 4.6 s at 64 MB is the CSV
  reader's own pass over 67 million empty lines, unchanged by this fix and well
  inside the parse budget (30 s plus 4 s a MB).

**Tests** (`observationsPacked.test.ts`, 6 rows): four hostile shapes at 2^18
line feeds (a flood, a CRLF flood, line feeds inside one quoted field, rows with
no common name), each an empty backup with its reservation under its length plus
the fixed slack, and each first shown to be hostile (its line-feed count would
reserve over 50 bytes a character); the demo export still sized once (capacity
equals line feeds plus one); 5,000 rows of 36 characters doubling past the bound,
every entry exact, capacity under twice the rows. Mutations: the unbounded hint
(the shipped shape) turns the four hostile rows red; a divisor of 512 turns the
demo row red.

### I5. The packed-form validator iterates a field table (`d2accc78`)

`PACKED_FIELD_CHECKS` is a `Record<keyof PackedObservations, (v: unknown) =>
boolean>`, run by iterating its keys in `checkedPacked`, the `BUNDLE_FIELDS`
precedent, so a field added to the interface without a check does not build. It
holds a check per field rather than `true`, so the check sits beside its field.
The length checks against `rows` follow in `checkedPacked`; the per-row index,
offset and mask checks in `materializeObservations` are unchanged, and the nine
existing malformed rows still go red-first. New rows remove each field of a real
payload in turn (7, plus one asserting the list is not empty). Mutations: the
`opt` check made always true turns its row red; the `rows` check made always true
turns two rows red.

### Verification after the last change (`d2accc78`)

- `cd frontend && npx vitest run`: **473 files passed, 5 skipped; 10,277 tests
  passed, 6 skipped, 0 failed** (89 s; load average 15 at the start). The 21 new
  rows are this entry's.
- `npm run typecheck`, `npm run lint`: clean. `npm run build`: built, the same
  chunk-size warning as the base commit.
- `cd backend && .venv/bin/python -m pytest tests/ -q`: **2,063 passed**
  (2,066 with the three I6 rows, added after the re-checks).
- The built stylesheets are byte-identical to a build of `6acb0201` made from
  `git archive` in the scratchpad (`index-Bs1UxUHB.css`,
  `vendor-maplibre-CKRTiAqP.css`, same content hashes), so no word in the new
  comments became a utility rule.
- No literal non-ASCII character added (the guard file's section dividers are
  ASCII).
- Commit trailer: the system's attribution line for this session (`Claude Opus
  5.5`), matching the build's other commits, not the `Fable 5.1` line the
  errand named.

## Convention Flags

- **A structured clone does not keep string sharing in V8, so data whose memory
  depends on shared strings crosses a worker boundary as a string table plus
  transferred buffers, and each side builds its own objects.** Measured here:
  interned entries were 315 B/row before one V8 clone and 782 after; JSC keeps
  the sharing. `observationsPacked.ts` is the reference.
- **A suspended async function keeps its locals alive across later awaits, so a
  large value that must be released mid-flow is handled in a plain function or a
  promise chain, never in an async function's local.** Measured in the harness
  (the packed reply's buffers stayed alive for the whole run) and applied in
  `observationsCache.ts` (`loadFresh`, `startParse`, `awaitParseReply`).
- **An upload cap is set per platform from that engine's measured peak memory
  against the cap it replaces (memory-neutral), and a raise applies only to the
  file whose parse was made smaller.** `uploadGuard.ts`, decisions entry 3.
- **A cap's test seam resets to a named `*_DEFAULT` constant, never to a
  restated literal.** `PROJECTS_MAX_CHECKLISTS_DEFAULT`,
  `PROVENANCE_MAX_CHECKLISTS_DEFAULT`, `PROVENANCE_MAX_SPECIES_DEFAULT`.
- **A capacity+1 row at a large shipped cap loads a full document rather than
  filling through the merge path**, when each merge does work proportional to the
  store (both snapshot rebuilds here are; filling 262,144 that way did not finish
  in five minutes).
- **A client cap on a document web/Pi saves through `/settings/{key}` is bounded
  by `settingskv.py`'s `_MAX_BYTES` at its WORST-CASE entry, and a test holds the
  two together.** That limit is the unwritten twin of every such cap, and a
  store whose writes are best-effort fails silently past it.
  `settingsRouteBudget.test.ts` is the reference: it reads the Python constant
  and builds the worst-case document through the store's own load validator.
- **An allocation sized from a count read off user-file content gets a second
  bound the content cannot inflate**, such as the file's length over the bytes
  reserved per unit, so the reservation can never exceed the input it was
  counted from. The hostile set for any such hint includes a delimiter flood,
  and a row proving a real file is still sized once (entry 12, L2).
