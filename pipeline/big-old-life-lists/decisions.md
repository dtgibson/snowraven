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
| 600,000 | 477 (833) | 465 | — | 518 (906) |
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
Every tab's output on the reference export is identical (the per-tab outputs
serialized and compared, `measure-tabs-node.mjs ... check`: all ten true), the
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
the parse budget (`parseBudgetMs`, unchanged and now exported from
`observationsCache.ts`) at this platform's upload cap. Characters never exceed
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
