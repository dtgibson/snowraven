## ML Export Hardening

### What this does

Four related repairs at the two places the Macaulay Library export enters and leaves storage.

**1. The import chokepoint now checks size and content, not just the filename.** `Settings.importFileContent` validated only that the name ended in `.csv`, so `MyEBirdData.csv` dropped into the ML Export slot stored happily on every platform and failed later on Multimedia, where nothing could say which file was wrong; and a file of any size was written straight to disk on desktop and iOS, which have never had a cap. Both refusals now render in the per-slot error line the row has always had, and neither touches whatever was already stored. The rules live in `frontend/src/lib/uploadGuard.ts` as a pair (`refuseByFilename`, `refuseByContent`), so an import path added later gets all of them or visibly none.

**2. `WebStorage.writeFile` and `deleteFile` check `res.ok`.** The backend has capped uploads at 50 MB all along and answers `413`, and `400` on a non-`.csv` name; `writeFile` discarded the response, so web and Pi, the only platforms that ever ran that cap, were also the only ones that could not report it. An over-cap upload read as a completed save over an unchanged slot. `deleteSetting` gained this check in v1.0.14; its two file-endpoint siblings did not, and this is where it was doing the most damage. `deleteFile` treats `404` as done, because it is: raising it would put "Delete failed. Please try again." over a row that is already empty.

**3. `parseMLExport` moved off the main thread**, at both of its call sites, under v1.0.14's full settle contract (`frontend/src/lib/parseMLExportOffThread.ts` + `mlExportWorker.ts`).

**4. `docs/HELP.md` swept.** Its ML export paragraph stated the opposite of the new behaviour in so many words ("both files end in `.csv`, so it is accepted"); the false sentence is gone and the refusal rule is stated once, in the `## Default Files` overview, with a one-line reference under the Settings section.

### How to test

`pipeline/ml-export-hardening/how-to-see.md` walks through it step by step.

### Measurements

**The silence budget was re-measured against `parseMLExport`, not inherited.** Its eBird twin's `4 s/MB` was measured off `parseEbirdObservations`, which since v1.0.13 streams one reused row array; this parser still materializes the whole `string[][]` cell grid and is measurably slower for it.

Tracked demo ML export and multiples of it, best of three after a warm-up, Node 24.18 / V8, across a 240x size range (0.13 to 30.4 Mchar), in two runs at different machine loads:

| Mchar | run 1 (load ~20) | run 2 (load ~14) |
|---|---|---|
| 0.13 | 43.0 Mchar/s | 50.9 Mchar/s |
| 0.63 | 44.8 | 59.7 |
| 2.54 | 55.4 | 57.4 |
| 7.60 | 48.7 | 52.9 |
| 15.21 | 45.2 | 52.7 |
| 30.41 | 46.5 | 52.7 |

Flat across the range in both, so the parse is linear in the input and the allowance can be too. The anchor is the slowest reading of the two, **43.0 Mchar/s = 23.3 ms per million characters**; a loaded machine reads slower, so anchoring there errs toward a wider budget.

The comparative measurement is what actually decides the constant, and it was taken **in the same run on the same machine**: at ~30 Mchar `parseEbirdObservations` ran at **82.1 Mchar/s** against this parser's **52.7**, so the streaming parser is about **1.5x faster**. Its own recorded 57.8 to 75.0 Mchar/s came from another machine; the ratio is what transfers, not the absolute rate.

**Shipped budget: `30 s + 6 ms per 1,000 characters`** (6 s per million characters). That is ~258x the anchor, and 1.5x its twin's 4 s/MB, which is the measured ratio: it carries the twin's safety factor rather than its number, which is the whole reason the measurement had to be redone. It gives ~31 s for the demo export, ~1 min for a 5 MB one, and the new 50 MB cap bounds the far end at about five and a half minutes. The 30 s floor covers worker spawn, module evaluation and the request's structured clone, none of which scale with the file.

The distinguishing assertion is in `mlExportSettle.test.ts`: over a 5 MB input, a silent worker is proved still waiting when the eBird constant's budget for the same input has elapsed, and to settle at this one. A constant copied on faith fails that row.

### Security review follow-ups (both addressed)

**Finding 1 — `firstLine` was linear in the first LINE, not in a header.** The
character-by-character copy is what makes the retention analysis work, and its cost
is `O(first line)`. That is free where the function was written (`observationsCache`
hands it a 309-character header) and not free at all once `detectExportType` hands it
arbitrary user content, where the first line can be the whole file. It was reachable
through the guarded path: a single line that *begins* with a real ML header is under
the 50 MB cap, so it was classified `ml`, accepted and stored, after which every
Multimedia and Statistics load paid the cost again, in front of the parse this build
had just moved off the main thread. On the stored-file path it was not bounded at all
(an iCloud pull is not an upload; `src-tauri/src/icloud.rs` caps at 200 MB).

`firstLine` now bounds the line it will read at **`MAX_HEADER_CHARS = 8192`**
characters and returns `null` when the content's first line runs past that. The scan
window is deliberately two characters wider than the bound, and the bound is enforced
on the resulting line's LENGTH rather than on an index -- see the CRLF correction
below for why that distinction is load-bearing rather than pedantic.

*The bound was measured, the way the silence budget was.* The widest header either
service emits is the **ML export's at 583 characters** (46 columns); the eBird
backup's is **309** (23 columns), both read off the tracked demo exports. 8,192 is
**14x** the wider of the two, room for roughly 650 columns at the ML export's ~12.7
characters per column. Copy cost at candidate bounds (Node 24.18 / V8, best of three
after a warm-up): 340 chars 0.008 ms, 4,096 0.028 ms, **8,192 0.039 ms**, 16,384
0.078 ms, 65,536 0.302 ms. 8,192 buys an order of magnitude of format headroom for
four hundredths of a millisecond.

*Before and after, same conditions.* `detectExportType` on a file that is one
enormous line:

| input | before | after |
|---|---|---|
| 1 MB first line | 6.8 ms | 0.077 ms |
| 5 MB first line | 140.3 ms | 0.076 ms |
| 20 MB first line | 666.6 ms | 0.017 ms |
| 50 MB first line | 2,279.2 ms | 0.016 ms |
| 200 MB first line (the iCloud path) | ~10.6 s (review's figure) | 0.016 ms |
| 50 MB, NO newline at all | 10.2 ms | 0.016 ms |
| the real demo ML export | 0.008 ms | 0.0048 ms |

Flat after the change, as it must be: the work no longer depends on the input size.
(The "after" column was taken at a load average of ~26; every figure is sub-millisecond
and flat, so a quieter machine moves the numbers, not the conclusion.)

The last row of that table is one the review's own analysis missed and is worth
naming: it called the no-newline shape *cheap*, because `firstLine` returned the
string uncopied. It is cheap **in `firstLine`** — and `detectExportType` then called
`.toLowerCase()` on the whole file (a 50 MB allocation), while `observationsCache`
parked the entire string at module scope as `headerLine` for the session, which is
precisely the retention defect that cache was rewritten to remove (QA measured the old
path returning 52,428,822 characters as `headerLine`). The bound closes both, and QA
confirms this resolves one of the six Known Limitations it had recorded ("a
no-line-break CSV is lowercased whole"); five carry forward. `firstLine`'s retention claim is now **total**: it previously had one documented
exception (hand the whole string back when there is no line break, since "a copy would
retain exactly as much"), and that reasoning only holds while the string is unbounded.

*`null` is the honest answer, and each caller decides what it means.* A truncated
prefix would be worse than useless: `detectExportType` decides by substring, so a
silently cut header would answer a question about a file it had only partly read, and
`hasBreedingCodeColumn` would report "no Breeding Code column" about a header nobody
looked at, which is a claim about the FILE rather than about our reading of it.
`detectExportType` returns `'unknown'`, so the file is refused at upload with a stated
reason and a stored one gets Multimedia's honest load-failure message.
`observationsCache.loadFresh` returns `null`, which is its existing failure signal and
which every tab already reads as "couldn't load your backup".

*The classification oracle was re-run after the change*, not inherited from the move
that introduced it: the shipped `detectFileType` spelling is still kept in
`detectExportType.test.ts` and compared over the demo exports, hand-written probes,
every string on a six-character alphabet up to length 3, and **20,000 randomized
headers** with per-branch non-vacuity (each of `ml` / `ebird` / `unknown` seen more
than 100 times). Zero mismatches. The one deliberate divergence is an over-bound first
line, which is asserted as its own case in both directions (the old spelling returns
`ml-export`, this returns `unknown`), and a row pins the two real header lengths so a
format that ever widened past a tenth of the bound goes red.

*Mutation-verified.* Removing the bound (scan the whole input, drop both `null`
returns) turns **9 tests red** across three suites: the divergence-set row, the three
classification-divergence rows, the three work-done bounds, and two guard rows. Eight
of those nine predate the CRLF correction below, which is the figure to compare
against any earlier measurement of this mutation; an earlier count of nine in this
document was eight real failures plus one unrelated timeout under memory pressure,
and it is corrected here. The work-done bounds count reads of the input through a
counting `Proxy` rather than elapsed time, so no machine's load can move them.

**Finding 1, follow-up — the first version of the bound had a CRLF edge, and both the
comment and the test that should have caught it were wrong too.**

A first line of *exactly* `MAX_HEADER_CHARS` returned its header under `LF` and `null`
under `CRLF`:

```
8191 -> LF=8191  CRLF=8191
8192 -> LF=8192  CRLF=null   <-- same line, same length, different answer
8193 -> LF=null  CRLF=null
```

The scan looked for `\n` and stopped at `MAX_HEADER_CHARS + 1`. What the bound is
about is the LINE's length, and under CRLF the `\n` terminating an 8,192-character
line sits at `MAX_HEADER_CHARS + 1`, one position outside that window. It failed safe
(a refusal, never a misclassification) and is unreachable with real files, so this is
correctness and honesty rather than risk.

The repair is two lines: the window widens to `MAX_HEADER_CHARS + 2` so the terminator
is in view under both endings, and an explicit `end > MAX_HEADER_CHARS` check enforces
the bound on the line's length. The window is now deliberately wider than the bound it
enforces, which is the point: **the window's only job is to bring the terminator into
view, and the length check is what decides.** The scan was not restructured.

Two things rode with the defect and both mattered as much as the code:

- **The comment at that line was false.** It said "a line break sitting exactly AT the
  bound still counts", which is true for LF and false for CRLF -- CLAUDE.md's v1.0.16
  shape, a totality claim with an unnamed exception at the definition site. It is now
  true for both endings rather than narrowed to name an exception, and it says why the
  window and the bound are different numbers.
- **The test row named "the edge holds" did not test the edge.** It checked LF at the
  bound and CRLF at bound-minus-one, so it never touched the one combination that
  failed. It is now a spelled-out table over both endings at bound-minus-one, the
  bound, and bound-plus-one, plus a pairing assertion that the two endings give the
  same answer at each length -- which is the property the defect broke, stated
  directly. It was confirmed RED against the code before the code was fixed.

*Mutation-verified separately.* Putting the CRLF window bug back turns exactly the two
rows red that are meant to see it: the edge table, and the divergence-set row below.

*The divergence set, stated rather than left as a pass.* "No divergences" was never the
claim -- there is exactly one and it is deliberate, so naming it is what lets a second
one read as a defect instead of as noise. A new row sweeps three header shapes (one per
verdict) across ten first-line lengths around the bound under LF, CRLF and no
terminator, and asserts of every divergence that it is over-bound, that it answers
`unknown` rather than a different classification, and that **the two line endings
diverge on exactly the same inputs**. After this fix the only divergence from the
shipped spelling is the deliberate over-bound one. That matches QA's independent
differential over 511,396 inputs, which found 44 divergences: 40 deliberate over-bound
(all `unknown`, none misclassified) and 4 this bug.

**Finding 3 — the backend's 413 had no route-level test.** The parity test added
earlier pins the **constant**; nothing pinned the **enforcement**. Deleting the two
`if len(content) > MAX_BYTES` lines left the backend suite at 311 passed and
`uploadGuard.test.ts` at 31 passed. That is this repo's own rule in
`.claude/rules/security.md`: single-sourcing prevents the copies drifting, not one
being dropped.

`backend/tests/test_settings_router.py` gains four rows beside the existing
`test_upload_non_csv_rejected`: `test_upload_over_cap_rejected` (both slots) asserting
the 413, its exact detail, that no file was written and that no metadata entry claims
one; `test_upload_exactly_at_cap_accepted` (both slots) so the refusal rows cannot
pass by refusing everything; and `test_upload_over_cap_does_not_replace_a_stored_file`,
because a refused upload must not be a partial write over what was already there.
`MAX_BYTES` is `monkeypatch`ed down to 16 rather than posting 50 MB, which also forces
the router to read the module attribute at call time.

*Verified by the mutation the review used.* With the two lines deleted: **3 failed,
313 passed** (was 311 passed, all green), while `uploadGuard.test.ts` stayed at 33
passed — which is the split working, the frontend pinning the constant and the backend
pinning the enforcement. Restored; `git diff` over `settings.py` is the comment only,
and the suite is green at 316.

### Notes for reviewer

**There are two ML parse call sites and they stay separate.** `mlExportCache.loadFresh` is the obvious one; `LifeList.tsx` reads and parses the file itself, which v0.5.52 deliberately excluded from `loadMLExport` as not output-identical (the cache swallows a bad parse to `null` and has no type gate, and Multimedia needs both distinctions). That exclusion holds. Converting only the cache would have left the freeze on the tab most likely to be holding a large export, so `components/mlParseCallSites.test.tsx` is a two-row roster asserting, per site, that a worker was constructed and the main-thread parser was never called, with a no-Worker row as the counter's non-vacuity control.

**`loadMLExport` still resolves `null` and structurally cannot reject** (v1.0.15). All five consumers branch on falsy today, and a thrown load lands in each tab's outer catch, which maps to `setup-required` over an export that is plainly stored. Five failure rows assert `resolves.toBeNull()` rather than catching, plus a healthy row so the null rows are not vacuous.

**An invalid export is a REPLY, not a worker death.** `parseMLExport` throws, and an uncaught throw inside a worker arrives on the main thread as the same `error` event a dead worker sends. The worker catches it and answers `{ ok: false }`, and the off-thread twin rejects with the same `INVALID_ML_EXPORT` message the synchronous parser throws, asserted against the real parser in the same test. That is what let each call site convert by moving one expression inside the `try` it already had, output-identical.

**v1.0.13 is knowingly not converged, and that is accepted rather than a defect.** `parseCSVRecords` still materializes the whole `string[][]` grid, so moving off-thread relocates the ~19x peak into worker heap rather than removing it. The size cap and the watchdog are what make keeping it safe for now; converging it is separate work.

**`detectFileType` moved out of `LifeList.tsx` to `lib/detectExportType.ts`**, because it now has two readers that must agree (Settings refusing an upload, Multimedia refusing a stored file) and two header sniffers would drift. The classification is byte-identical: the shipped spelling is kept in the test as an oracle and the two are compared over the demo exports, hand-written probes, and every string over a six-character alphabet up to length 3. Only the returned words changed (`'ml-export'` became `'ml'`, so a caller compares directly against its slot). It is deliberately looser than both parsers, proved by running the real parsers, which is what makes a refusal safe: it can never turn away a file the app could have used.

**`firstLine` moved to `lib/firstLine.ts`, re-exported from `observationsCache.ts`, and gained a bound.** The old sniffer read the header with `text.split(/\r?\n/)[0]`, which builds an array of every line in the export and leaves the file in the regex engine's last-match state; both are cheap on a header and neither is cheap on the 50 MB the upload guard has to classify before writing it. Rather than write a second header extractor from memory, `detectExportType` imports the one that already carries v1.0.13's measurements. Its signature is now `string | null` (see Finding 1 above), which is the one API change outside this build's own modules; `observationsCacheRetention.test.ts`'s drift guard sweeps both files with a non-vacuity check on each, and its equivalence oracle is now explicitly scoped to a first line within the bound, with both edges asserted.

**`exceedsUtf8ByteLimit` counts rather than encodes, and stops at the limit.** `new TextEncoder().encode(text).byteLength` and `new Blob([text]).size` each allocate a second copy of a file that may be 50 MB; this is the same shape as the backend's `upload.read(MAX_BYTES + 1)`. It is proved equal to `TextEncoder` over probes including a lone surrogate at each end, and the early-out is asserted as work done (`charCodeAt` calls) rather than elapsed time, with a guard-the-guard confirming every character is read when the limit is not passed.

**The cap literal is read out of the Python.** `uploadGuard.test.ts` parses `MAX_BYTES` from `backend/routers/settings.py` and asserts equality, with the parsed value pinned so a bad regex cannot pass. Two literals that must be equal are exactly the pair that drifts, and web/Pi would otherwise get a refusal message quoting a limit that is not the one being enforced.

**Accepted cost, unchanged from today:** the size check runs on the decoded content, so a very large file is still read into memory before being refused. One predicate at the chokepoint beats a second, slightly different one at the caller; `file.size` is bytes on disk and is not identical to the re-encoded UTF-8 length of the decoded string, and two predicates for one rule is the drift this build exists to remove.

**Two existing test fixtures were updated, and they are not collateral.** `Settings.clear.test.tsx` uploaded `'a,b\n1,2\n'` and `Settings.icloud.test.tsx` uploaded `'a,b'` into the eBird slot; both are now refused by the guard, which is the change working. Both carry a real eBird header now, and the icloud row asserts the same content it uploads.

### Found and NOT fixed, deliberately

**The `role="alert"` line these messages render in is created carrying its text.** `FileRow` renders `{error && <div role="alert">…}`, which is the v1.0.15 insertion-with-first-message trap: the region is not in the accessibility tree before its message arrives, so the sentence is not announced. This is pre-existing and affects the shipped "Only .csv files are accepted." identically, but this build makes that line carry more messages more often, so it is worth naming rather than leaving to be rediscovered.

The repair is the shape already in the repo (`ui/TabLoadErrorAlert.tsx`): mount the region always, apply the inline styling only when there is a message so it computes to zero height idle. Its blast radius is `FileRow` plus three assertions in `Settings.test.tsx` that would then see two more alert regions (`getByRole('alert')` at :161 and :190 become ambiguous, `queryByRole('alert')).toBeNull()` at :227 must become "no alert carries text", per v1.0.15's own rule 4). A second, smaller residual rides with it: repeating the same refusal sets the same string, which React reconciles to no DOM mutation, so a repeat is silent even once the region is always mounted (v0.5.80's sequence-keyed child is the answer).

It is left out because the brief scopes this build to "two refusal sentences in the per-slot error line Settings' `FileRow` already renders. No new state, control or screen", and this is a different defect on a different axis with its own blast radius into an unrelated test file. It should be queued, not re-filed as a defect of this build.

### What was checked and left alone

- **`README.md` and `website/`** state no claim that this change makes false; neither enumerates upload validation. Per v1.0.15's rule that app-internal content should have fewer restatements, `docs/HELP.md` owns this behaviour alone.
- **The iCloud pull paths** are out of scope by the brief: a synced arrival is not a user upload and is not guarded. Multimedia's comment now names that route explicitly as one of the ways an unusable export can still be on disk.
- **`ListComparer`'s own file input** is not a Default Files slot and does not store what it reads; untouched.
- **No version bump, no `CHANGELOG.md` entry, no website version pill.** This is one build of a bundled Spool release; the bundle owns the version.
- **Security review findings 2, 4, 5 and 6** are accepted or deferred by the coordinator and untouched: the backend still validating upload type by extension only (the router serves web/Pi only, content is consumed solely by the app's CSV parsers through escaped React, and the size half is genuinely server-enforced); Starlette spooling a file part unbounded before the handler reads it (pre-existing); `FileRow`'s `role="alert"` announcement trap (already queued, and described above); and `csp: null` in `tauri.conf.json` (the second worker is same-origin from a static build-time URL, so this build owes no CSP change).

### Verification

| Gate | Result |
|---|---|
| `cd frontend && npm run build` | clean (`tsc -b && vite build`) |
| `npx vitest run` (full frontend suite) | 287 files, 4860 tests, all passing |
| `npx eslint .` | clean |
| `cd backend && .venv/bin/python -m pytest tests/ -v` | 316 passed |
| `.venv/bin/python -m ruff check .` | clean |
| Tailwind corpus byte-check | `dist/assets/index-*.css` byte- and hash-identical with and without the five new test files (`c2d103bf…`, 87,853 bytes both ways), so no comment word in them minted a utility rule. Re-checked after the security fixes: same hash, same size |
| Mutation checks | removing the header bound turns 9 tests red across three suites (8 of them predating the CRLF row); restoring the CRLF window bug turns exactly 2 red; removing the backend's `len(content) > MAX_BYTES` turns 3 red where the whole suite was previously green. All restored and re-verified |
| Full-suite flake | one run failed `MapExplorerSearchThisArea.test.tsx > keeps focus on the control after an Enter press` -- an untouched file last changed in the v1.0.15 bundle, 3/3 green in isolation and green on a clean full re-run at load average 5.5. The documented full-suite scheduling profile (`.claude/rules/testing.md`), not this change |
| Worker chunk emitted | `dist/assets/mlExportWorker-*.js`, beside the existing `observationsWorker-*.js` |

`npm run build` caught one error `vitest` and `eslint` both passed: a TypeScript parameter property in a new test file's `FakeWorker` (TS1294, `erasableSyntaxOnly`). The pre-push gate is the build, as CLAUDE.md says.
