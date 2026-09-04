# Bug Brief — storage-read-throw-containment

## Decision: the queued fix is the wrong direction, and both of its own objections fail

Do **not** move `await this.fs()` inside `TauriStorage.readFile`'s try (`frontend/src/lib/storage.ts:645-653`). The move is
provably behaviour-neutral, not a fix — and it would permanently seal the one failure that *is* live here. The queued item's
own objections are both false as stated: the fs() failure is not "loud" anywhere today, and Multimedia's throw/null
distinction is desktop-unreachable by construction. The real defect is at the other end of the same line: `readFile` already
resolves `null` for a stored-but-unreadable file, and **Multimedia** renders that as a successful list with no media.

## What is broken

On the **Multimedia** tab, a stored Macaulay Library export that cannot be turned into rows is rendered as a *successful*
load with no media: every photo and recording silently vanishes, with no error and no hint anything failed.
`LifeList.tsx:436-444` reports the failure only when `storage.readFile('ml')` **rejects**; a falsy or unusable result falls
through to `setPhase({tag:'ready'})` (`LifeList.tsx:464-481`). Its sibling `if (status.ebird && !ebird)` three lines below
already does the honest thing for the eBird slot. A parse throw is worse still: it reaches the outer catch and renders
"Macaulay Library Export Required" over an export that is plainly stored — the exact 1.0.14 lie.

## Why the throw branch never fires on the desktop

`readFile`'s only statement outside its try is `await this.fs()`. `fsModule` is assigned once with `??=` and never reset
(`storage.ts:444-448` are its sole occurrences; the adapter is a module singleton, `storage.ts:787`). Reaching
`LifeList.tsx:438` requires `status.ml` truthy, which requires `readMeta` → `readJson` → `await this.fs()` to have already
**fulfilled** — and a fulfilled promise fulfils for every later await. So on the desktop that line cannot reject, and
`mlReadFailed` is dead. `LifeList.tsx:435` says as much already: "Reachable on web/Pi, where WebStorage.readFile is a bare
fetch." On web/Pi it catches the rejection subset only — a 500 from `/settings/files/ml` returns `null` and is equally silent.

## Steps to reproduce

1. Settings → Default Files: upload a valid `MyEBirdData.csv` and a valid ML export. Open **Multimedia**; media appears.
2. Quit the app. Truncate the stored export to zero bytes, leaving `metadata.json` untouched — exactly what an interrupted
   write leaves behind, since `writeFile` is a direct `writeTextFile` with no temp-and-rename (`storage.ts:680`):
   `: > ~/Library/Application\ Support/com.snowraven/data/ml-export.csv`
3. Relaunch, open **Multimedia**. It renders ready, with the eBird backbone and zero media.
   Variant, no file surgery needed: upload `MyEBirdData.csv` into the **ML Export** slot. `importFileContent` validates only
   the `.csv` extension (`Settings.tsx:1898-1901`), so it stores, and Multimedia again renders ready with zero media.

## Expected behavior

One property, on the Multimedia tab: **a Macaulay Library export that is stored but cannot be turned into rows is reported
as a load failure — never as "no export saved", and never as a rendered list with no media.** Every way it can fail to
become rows lands on the one existing message, `ML_EXPORT_LOAD_ERROR` (`setupCopy.tsx:50`): a read that rejects, a read that
resolves falsy (`null` or `''`), a file that fails the `detectFileType` gate, and a `parseMLExport` that throws
`INVALID_ML_EXPORT`. The absent case is untouched: `!status.ml` still shows the SetupRequired guidance panel.

## Why the 1.0.15 precedent does not transfer

The 1.0.15 cache fix (`cd8a3a9`) contained a **transient, per-call** failure inside a memoizing layer that clears its memo on
failure — `inflight` resets, so the next mount retries, and the resulting `null` is then reported honestly by each tab. The
failure the queued move would contain is **permanent and memoized with no clearing path**: once `fs()` rejects it rejects for
the session. Containing that into `null` is precisely the "report a failure as no data" the 1.0.14 family forbids. Transient
and permanent want opposite treatments, so the shapes are not the same. The line stays; add a comment recording why.

## Blast radius

Five non-test `readFile` call sites, three surfaces. **Multimedia** (`LifeList.tsx:438`) is the only one that distinguishes a
throw from a null, and it is the only one changing. **List Comparer** collapses them deliberately and is the precedent for
this fix — `ListComparer.tsx:126-134` gives one message for both branches, asserted in `honestLoadFailures.test.tsx:323-356`
including the wrong-file-type row; `ChecklistComparer.tsx:217` swallows both (unlinked names, cosmetic). The two shared parse
caches (`observationsCache.ts:203`, `mlExportCache.ts:30`) already catch both inside their own try since 1.0.15, unchanged.

## Out of scope, flagged rather than fixed

`TauriStorage.readMeta`'s blanket catch (`storage.ts:632-639`) turns *any* failure to read `metadata.json` — a truncated
document, or a permanently rejecting `fs()` — into `{ebird: null, ml: null}`, and every stored-file surface gates on it, so
all of them show SetupRequired while both CSVs sit intact on disk. That is the same family one layer down at the chokepoint
they all pass through, and it needs a distinguishable "could not determine" signal plus a branch in every loader: its own
build, not this one. Unrelated to build 4 (Weather Backlog), which reaches neither `getFilesStatus` nor `readFile`.

## What done looks like

The four failure modes above each render `ML_EXPORT_LOAD_ERROR` on Multimedia, and none renders "Macaulay Library Export
Required" or a ready-with-no-media list; `!status.ml` still shows the guidance panel; a healthy export still renders media.
Guarded by rows added to `honestLoadFailures.test.tsx` alongside the existing Multimedia rows (:434-457), each row asserting
the step-list marker is ABSENT, matching the house pattern. `storage.ts:645` gains a comment and no behaviour change.
`npm run build` green (not vitest alone), plus a `### Fixed` entry under the existing `## [1.0.16]` — no new version bump.
