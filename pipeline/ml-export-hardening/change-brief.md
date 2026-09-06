# Change Brief — ML Export Hardening

## What is changing

Four related repairs at the two places the Macaulay Library export enters and leaves storage. (1) `Settings.importFileContent` gains a **size cap** and a **content check** alongside its existing `.csv` extension guard, so an oversized file or a non-ML CSV is refused at upload on every platform instead of being stored and failing later. (2) `WebStorage.writeFile` starts checking `res.ok` and throwing, because today it does not — so the backend's existing HTTP 413 is swallowed and web/Pi reports an over-cap upload as a **success**. (3) `parseMLExport` moves off the main thread behind a `parseOffThread` twin carrying v1.0.14's full settle contract. `mlExportCache.ts` is the primary consumer; `LifeList.tsx:472` is a second, deliberately separate parse call site (v0.5.52) and is converted too, or the tab most likely to hold a large export keeps the freeze this build exists to remove.

Explicitly NOT changing: `parseCSVRecords`' full-grid materialization (see Decisions touched); `loadMLExport`'s null-on-failure contract; the LifeList/`loadMLExport` split; iCloud pull paths, which are not user uploads; the eBird slot's own parse, already off-thread since v1.0.14.

## Why now

The saved idea, and ROADMAP items 56 and 57, which have named all of this as open residue since v1.0.13/v1.0.14. The eBird sibling already ships every mechanism this needs, so the design work is done and recorded. Two findings raise the priority above "tidy the twin": the 50 MB cap is **not actually enforced end-to-end on web/Pi** (finding 2 above, unnamed anywhere until now), and `parseMLExport` still builds the whole `string[][]` cell grid that v1.0.13 measured at ~19x file size on the eBird side before replacing it with a streaming reader.

## User-facing impact

Two new refusal sentences in the per-slot error line that Settings' `FileRow` already renders — the same line that has always shown "Only .csv files are accepted." One for a file over the cap, one for a file that is not the export for that slot. Nothing else changes on screen; a valid upload behaves exactly as today, and both parses produce byte-identical output.

`docs/HELP.md:110` currently states the opposite of the new behavior in so many words ("Uploading `MyEBirdData.csv` into the ML Export slot does that: both files end in `.csv`, so it is accepted"). That claim, its paragraph, and the matching source comment at `LifeList.tsx:457` must be swept together — published-prose rule, paragraph scope, swept from the source.

## Design pass

**Not needed.** The only visual change is copy in an error affordance that already exists, already renders on this exact surface, and already carries a refusal string. No new state, control, or screen is designed.

## Decisions touched

- **v1.0.14** (settle contract; failure signal matches the consumers' branch) — **extended, not reversed.** A second worker owes all five exits and an idempotent settle. Its silence budget must be **re-measured against `parseMLExport`**, never inherited: the eBird constant came from `parseEbirdObservations`, a different function with a different memory shape.
- **v1.0.13** (streaming parse; the full grid peaked at ~19x file size) — **knowingly not converged.** `parseMLExport` keeps the grid. Off-thread relocates that peak into worker heap rather than removing it, which is why the watchdog and the size cap are what make this safe. Naming it so the next run does not read it as done.
- **v0.5.52** (routing LifeList's ML load through `loadMLExport()` was excluded as not output-identical) — **must stay excluded.** Two ML parse call sites go off-thread; they do not merge.
- **v1.0.15** (cache-read-throw-containment) — `loadMLExport` must still structurally not reject. Verified: its consumers already branch on falsy, so a failed parse resolves `null`, matching the eBird rule for the same reason.
- **v1.0.14** (`WebStorage.deleteSetting` gained a `res.ok` check) — its untouched siblings `writeFile` and `deleteFile` get the same treatment.
- **ROADMAP item 57** calls an oversized-file warning "a new user-facing affordance rather than an optimization." Recorded here because this brief **rejects that as a lane classification**: the refusal path and its error line already ship, nothing becomes reachable that was not, and that sentence was written to justify deferring the work inside a Fix brief, not to route it. This is Improve territory.

## What done looks like

An over-cap or wrong-slot file is refused at upload with a stated reason on desktop, iOS, and web/Pi alike, and a backend 413 is no longer reported as a save. A large ML export parses without freezing Multimedia or Statistics, and a worker that dies fails within a measured budget instead of hanging the session. Both parses are proved output-identical to today's on the tracked demo export, and `docs/HELP.md`'s now-false paragraph is swept with the source comment it came from.
