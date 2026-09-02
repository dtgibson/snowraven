## Large-File and Memory Handling

### What this does

Three contained, user-invisible changes to how a large eBird export is parsed and
what is kept in memory afterwards. Nothing about how the app looks, reads, or
behaves changes; the parse output is proved identical to the previous parser's.

1. **The eBird observation parse streams.** `parseEbirdObservations` no longer
   materializes a `string[][]` of every cell before building entries. At most one
   row array is alive at a time.
2. **The observations cache stops holding the whole CSV.** It kept
   `{ text, observations }` at module scope for the session to answer one
   first-line boolean; it now keeps `{ headerLine, observations }`.
3. **`lib/networkCache` is capped.** The one unbounded cache in the repo — a
   module-scope `Map` with expire-on-read only — gains a 64-entry FIFO cap and
   joins `cacheInventory.test.ts`.

### What was built

- **`frontend/src/lib/parseEbirdObservations.ts`** — `parseCSV` became
  `streamCsvRows`, a generator that yields ONE array, cleared and refilled per
  row. The entry loop consumes it lazily, so the source string and the growing
  entry array are the only whole-file structures alive. The column lookup and
  per-row entry build were lifted into `columnIndex` / `entryFromRow`; every
  branch inside them is character-for-character the previous code.
- **`frontend/src/lib/observationsCache.ts`** — the cached shape is now the
  exported `LoadedEbird { headerLine, observations }`. New exported `firstLine`
  finds the break with `indexOf` and copies the line character by character (see
  the measurement below for why neither of the obvious spellings works).
- **`frontend/src/components/BreedingCodeList.tsx`** — passes `ebird.headerLine`
  to `deriveBreedingData` instead of `ebird.text`. `deriveBreedingData` and
  `hasBreedingCodeColumn` are untouched: the header line is exactly what the
  latter reads out of a whole file.
- **`frontend/src/lib/networkCache.ts`** — `NETWORK_CACHE_MAX_ENTRIES = 64` and a
  `put` helper that evicts oldest-first when a NEW key arrives at capacity.
  Placed at the one chokepoint (`cachedGet`), so both entry points —
  `transport.ts`'s `CachedTransport.get` and the desktop raw path in
  `tauri/mapService.ts` — inherit the cap rather than each remembering it. Adds a
  test-only `networkCacheSize()` beside the existing test-only
  `clearNetworkCache()`.
- **Tests** — two new files plus additions to two existing ones (below).
- Sixteen component test files had their `observationsCache` mock's `text:`
  renamed to `headerLine:`. Two of them (`BreedingCodeList.test.tsx`,
  `CountClusterWrap.test.tsx`) actually render the one consumer and went red
  before the rename; the rest are consistency.

### What was measured, and what was only reasoned about

Every number below was produced on this machine during this build. Node 24.18 /
V8 on an M1 Pro, ASCII input, against a deterministic synthetic export whose
column set and field widths follow a real MyEBirdData file (311 bytes/row against
the real export's 330). Heap figures are one engine's accounting and are evidence,
not bounds — nothing in the suite asserts a byte product or an elapsed time.

**1. The OOM claim reproduces.** A 500,000-row / 148.4 MB export, parsed through
each parser bundled from its real module:

| `--max-old-space-size` | pre-change parser | streaming parser |
|---|---|---|
| 700 MB | JS heap out of memory | completed |
| 1024 MB | JS heap out of memory | completed |
| 1536 MB | JS heap out of memory | completed |

Sweeping for each parser's actual floor on that file: the pre-change parser first
completes between **2,560 MB and 3,072 MB**; the streaming parser first completes
between **540 MB and 560 MB**. Roughly a 5x reduction in the heap ceiling
required, and it straddles every ceiling the brief named.

**2. The cause is transient allocation, not retention.** Heap allocated during
the parse and not yet collected when it returns, versus what survives a forced GC:

| export | uncollected at return (before → after) | retained after GC (before → after) |
|---|---|---|
| 21,369 rows / 6.3 MB | 136.0 MB → 23.5 MB | 29.9 MB → 27.3 MB |
| 100,000 rows / 29.7 MB | 590.3 MB → 103.9 MB | 125.9 MB → 111.9 MB |
| 500,000 rows / 148.4 MB | 2,853.4 MB → 394.9 MB | 614.1 MB → 541.8 MB |

Retention barely moves, which is the point: the output is identical, so the whole
win is the transient peak — which is exactly where the OOM lives. The 136 MB at
21,369 rows lines up with the brief's independently measured 126 MB on the real
6.6 MB export. (The streaming parser also ran about 1.5–2x faster on every file.
Observed, not claimed, and asserted nowhere.)

**3. The header-line change had a second trap in it, and the first draft shipped
into it.** Holding one 309-character "header line" from the 148.4 MB export, the
source dropped and GC forced three times:

| how the header line was taken | chars kept | heap retained |
|---|---|---|
| the whole text (what this replaces) | 155,562,807 | 152.2 MB |
| `content.search(/\r?\n/)` then `.slice` | 309 | **152.2 MB** |
| `content.indexOf` then `.slice` | 309 | **152.2 MB** |
| `content.search(/\r?\n/)` then a character copy | 309 | **152.2 MB** |
| `content.indexOf` then a character copy (shipped) | 309 | 3.8 MB |

Two independent mechanisms, neither visible in a diff. A `.slice()` of a long
parent is a SlicedString that references the parent. And a regex METHOD leaves its
subject in the engine's last-match state (what the legacy `RegExp.$_` accessors
read), so merely *asking* a regex where the line ends retains the file however the
answer is then used. My first implementation used the character copy and was
clean; I then "tidied" it to find the break with `search` first, and the
measurement came back at 152.2 MB. That is why the drift guard bans both
spellings, and why the equivalence tests alone would not have caught it — the
slice form IS the oracle they check against.

**Reasoned about, not measured:** that these V8 behaviours have JavaScriptCore
analogues. They may not; JSC is the real desktop/iOS runtime and its string and
regex accounting differ. The claims that hold on every engine are the structural
ones the suite asserts — at most one row array live, the cache holds a line and
not a file, the network cache holds at most 64 entries — and those are what this
change actually rests on. The heap figures are corroboration on the engine the
web/Windows path ships.

### Tests

- **`parseEbirdObservationsStreaming.test.ts` (new, 9 cases).** Carries the entire
  pre-change parser verbatim (only its two top-level names prefixed `old`) as a
  differential oracle, per DECISIONS.md v0.5.85 — relocation is proved, not
  reasoned about. Swept over: the tracked demo export (7,869 rows, with a
  non-vacuity check that it really parses and really contains quoted comma-bearing
  fields); the real export on this machine when one is stored (it ran here — and
  is `it.skip`ped rather than failing on a fresh clone, since `data/` is
  gitignored); 24 hand-written malformed probes (quoted commas, quoted newline,
  quoted CRLF, escaped quotes, unterminated quote, CRLF throughout, lone CR,
  trailing field with no newline, empty, header-only, ragged short and long, blank
  interior line, BOM, header aliases); and every string over the CSV control
  alphabet `a , " \r \n` up to length 5 — 3,905 probes, each checked twice (as a
  whole file and as a body under a valid header). Zero divergences.
  The streaming property is asserted **structurally**: over the demo export the
  generator hands out ONE array identity for 7,869 rows, and the same measurement
  run against the pre-change parser returns one array per row. The contrast is in
  the test, so the assertion is non-vacuous by construction rather than by a
  mutation someone must remember to re-run.
- **`observationsCacheRetention.test.ts` (new, 11 cases).** The result is exactly
  `{ headerLine, observations }` with no `text`; a 20 MB+ file yields a header
  line whose length is the header's, stated as character counts; no string
  reachable from the result is longer than 2,000 characters; memoization and
  invalidation still hold. `deriveBreedingData(observations, firstLine(csv))`
  deep-equals `deriveBreedingData(observations, csv)` on the demo export (with and
  without a Breeding Code column) — the differential oracle for change 2. And
  `firstLine` equals `content.slice(0, content.search(/\r?\n/))` on 14 hand
  probes, on 340 enumerated strings over the line-break alphabet, and on the demo
  export.
- **`networkCache.test.ts` (+9 cases).** Measured at **capacity+1 and asserted as
  work done**, per `.claude/rules/testing.md` v0.5.85. The store holds at most 64
  entries however much it is offered; the oldest is evicted first and the eviction
  is one entry deep, not a flush; at capacity+1 a straight traversal does
  **exactly** the loader calls a no-cache implementation would (`5 × 65`, so never
  worse than not caching) and a rotating start order stays under that bound; at
  capacity the same traversal does exactly one load per key however many rounds;
  a TTL refresh of a key already held evicts nothing; 65 concurrent loads all
  resolve with the cap intact.
- **`cacheInventory.test.ts` (+2 cases).** `networkCache` is enumerated with its
  cap and its FIFO eviction, plus assertions that both entry points route through
  `cachedGet` and that the desktop path keeps no second store of its own — it was
  the only cache missing from this file, which is how it drifted. `observationsCache`
  is enumerated for its `LoadedEbird` shape.

**Mutation-checked, red-first, with a green unmutated baseline before each run.**
Nine mutations of the parser: dropped row clear, dropped CRLF pairing, dropped
trailing-field flush, no BOM skip, escaped quote losing its quote, blank common
name no longer skipped, `allObsReported` inverted, yielding a fresh copy per row
(a reshape rather than a stream), and re-materializing the grid — all red. Four
of the header line: back to `search`+`slice`, CR left in the line, whole text
cached again, lone CR ending the line — all red. Five of the cap: cap removed,
LIFO, evict-on-refresh, off-by-one, flush-on-overflow — all red.

**One stated limit, found by measurement rather than assumed.** Three ways to put
the grid back were tried. An annotated `string[][]` accumulator is caught by the
drift guard. A naive `[...streamCsvRows(text)]` is caught 47 times over, because
the stream reuses its array — an *accidental* grid cannot be silently correct. A
**deliberate** re-materialization that copies every row and lets TypeScript infer
the type is **not** caught: it is correct, only wasteful, and no deterministic
unit assertion can see the difference. That limit is written into the test file so
the next reader inherits it rather than the headline.

### Verification run

- `npm run build` (`tsc -b && vite build`) — clean. This is the pre-push gate;
  `npx tsc -b` and `eslint src --max-warnings=0` are also clean.
- `npm run test` — **253 files, 4,096 tests, all passing.** No timing-ratio suite
  tripped, so none needed an isolated re-run.
- `backend`: 311 passed (nothing backend changed; run as insurance).
- **Tailwind auto-source-detection check.** This change touches 20 files under
  `frontend/`, comments included, so it owes the bundle check. Built HEAD twice
  (determinism control: identical), built this change twice (reproducibility
  control: identical), then compared: `dist/assets/index-*.css` is **byte-identical
  at 74,020 bytes with the same content hash** (`index-DC84MsUD.css`). No comment
  in this change emitted a rule.

### Notes for reviewer

- **The reused row array is a real contract.** `streamCsvRows` yields the same
  array every time; a consumer must copy out what it needs during its own
  iteration. That is stated at the definition, and it is what makes the structural
  guarantee provable rather than a claim. It also fails loudly rather than quietly
  if ignored, which is the reason to prefer it to yielding fresh arrays.
- **Why FIFO and why 64.** DECISIONS.md v0.5.86 governs: capacity+1 is a
  measurement rule, not one policy, and the policy follows what an eviction costs.
  Here it costs one redundant eBird request, so FIFO is right; admission control
  would fill on the first 64 keys of a session and then serve nothing new. 64 is
  stated as an entry count, never a byte product — entries are whole eBird
  payloads whose size is not ours to predict. It is roughly ten distinct search
  centers, since one center populates several keys, against a 90-second TTL.
- **Security posture.** The cap is the security-positive direction: an unbounded
  module-scope store keyed by a value the user (or a hostile dataset) chooses is a
  memory-exhaustion path, and it is now bounded. `networkCache` keys a `Map`, not
  an object literal, so the `Object.hasOwn` prototype-chain rule in
  `.claude/rules/security.md` does not apply. No regex changed anywhere; no route,
  href, outbound request or third-party destination is touched, so
  `PRIVACY_POLICY.md` is unaffected under the v0.5.76 rule.
- **One behavior at the edge, deliberately unchanged.** For a stored file with no
  line break at all, `firstLine` returns the same string it was given — so the
  cache would hold that whole file. That file has no data rows and the app already
  reports it as not an eBird backup, and the previous code passed the whole text
  along in exactly the same case. Bounding it would change what
  `hasBreedingCodeColumn` sees, which is a behavior change the brief forbids.
- **No version bump, no CHANGELOG entry**, per the brief: this is one of two builds
  in a bundled release handled centrally. For the same reason none of the new
  comments carries a `vX.Y.Z` stamp, which departs from house style — the release
  version is not this run's to assert. If a stamp is wanted, it can be added when
  the bundled version is known.
- **Documentation: nothing needed, and here is why.** `docs/HELP.md`, `README.md`
  and `website/` describe user-visible behavior, and there is none to describe:
  no surface, copy, control, count or output changes. Their cache paragraphs
  describe the *durable* stores (county completeness at 30 days, hotspot activity
  at six hours), not the 90-second in-memory store capped here, which is never
  surfaced to the user and whose answers within its window are unchanged.
  `PRIVACY_POLICY.md` and `ACCESSIBILITY.md` remain true as written.

### Deliberately not done

Everything the brief's exclusions list names is untouched: the never-unmount tab
architecture, any new UI (import progress, oversized-file warning), converging
`parseEbird` with `parseEbirdObservations`, slice-based field extraction, the
Worker structured-clone doubling, the unvirtualized "Show all N checklists"
render, the worker's missing timeout and reject path, `speciesCodeMap`,
`useHotspotActivity.answers`, and the Weather backlog's second row array.

Two of those were genuinely tempting while in the code and were left alone.
**Slice-based field extraction** would have removed the rope construction itself
rather than only its retention, and the measurements above make its size visible —
but it works by sharing the parent buffer, which is exactly the accounting the
header-line measurement just showed is engine-specific, and the app ships on three
engines. The exclusion is correct and the trap I hit is evidence for it.
**The worker's missing timeout and reject path** sits four lines from code I
edited in `observationsCache.ts` and is a real bug; fixing it there would have
merged a memory change and a control-flow repair into one verification, which is
precisely why the brief excludes it.

## Convention Flags

- A function that must not retain a large string finds its offsets with `indexOf`
  and copies with a character loop — never `.slice()` (which references its
  parent) and never a regex method (whose subject stays in the engine's last-match
  state). Both were measured retaining a 148 MB file behind a 309-character
  result. Guard it in the module's own test with a comment-stripped scan banning
  both spellings, because an equivalence test cannot catch it: the slice form is
  the oracle.
- A row-at-a-time reader proves "at most one row live" by REUSING one array and
  asserting a single array identity across the file, with the same measurement run
  against the previous implementation in the same test as the non-vacuity control.
  Reuse is what makes an accidental re-materialization fail loudly instead of
  silently costing memory.
- A source-inspection drift guard strips comments before scanning, or the module's
  own explanation of the thing it removed matches and fails a correct file. Second
  instance of the `entryChunk.test.ts` rule, in the opposite direction: there a
  comment invented an import edge, here it invented a regression.
