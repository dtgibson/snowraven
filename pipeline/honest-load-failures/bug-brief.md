# Bug Brief — honest-load-failures

## What is broken
All three findings confirmed against the code, with one correction to Finding A's reach.
**A.** `loadMLExport` awaits `storage.readFile('ml')` OUTSIDE its try (`lib/mlExportCache.ts:23`; only `parseMLExport` is caught), and `MapExplorer.tsx:678` / `BirdingStats.tsx:176` / `SpeciesDetail.tsx:203` put it unguarded in the same `Promise.all` as the eBird load, so an ML read throw rejects the whole thing into the outer `catch` → `setPhase({ tag: 'setup-required' })` (`:695`, `:235`, `:223`) while a backup is plainly loaded. **Correction:** reachable on web/Pi, where `WebStorage.readFile` is a bare `fetch` that throws on network failure; on desktop the only throw is a `this.fs()` dynamic-import failure already memoized by the preceding `getFilesStatus`, so it is effectively unreachable there. `Checklists.tsx:429` is the fixed precedent, with a comment naming exactly this.
**B.** All eight loaders (plus `ListComparer.tsx:111` and `:128`) set one string that is honest but names neither the file nor where to go. `BreedingCodeList.tsx:173` already has the shape to copy, and `DECISIONS.md:2942-2948` fixes the constraint: `error` is "a terse error message with a retry/settings option", NOT the `SetupRequired` steps panel.
**C.** Exactly four: `BirdingStats.tsx:179`, `Checklists.tsx:431`, `BreedingCodeList.tsx:166`, `NamedBirds.tsx:65`, all `if (!ebird || cancelled) { setPhase({ tag: 'error', … }) }`. Real, not merely ugly: with `ebird` truthy and `cancelled` true a stale run still writes the error phase. `MapExplorer.tsx:681`, `LifeList.tsx:433` and `SpeciesDetail.tsx:207` already check `cancelled` first.

## Steps to reproduce
1. **(A)** On the web/Pi build with BOTH files stored, open Statistics, Map Explorer or Species Detail and drop the backend mid-load so `GET /settings/files/ml` throws. Observed: "eBird Backup Required" plus the upload steps, while both files are saved.
2. **(B)** Store a non-eBird CSV as the eBird backup and open any of the eight tabs. Observed: "Couldn't load your eBird backup from Settings. Try re-uploading it." Breeding Codes' second branch (a file that parses but has no Breeding Code column) shows the useful version by contrast, on the same screen shape.
3. **(C)** On Statistics, Checklists, Breeding Codes or Named Birds, re-run the effect (`filesVersion` / `filesEpoch` bump: a Settings save or an iCloud arrival) while the first `loadEbirdObservations()` is still in flight, and let the second settle first. Observed: the first run's continuation writes the error phase over a ready tab.
4. Deterministic stand-in for 3, runnable today: render, rerender with a new `filesVersion`, let the second load reach `ready`, then settle the first truthy, and assert the tab is still ready.

## Expected behavior
An ML-export read failure never changes what a tab says about the **eBird** backup: the three loaders degrade to no-media exactly as `Checklists.tsx:429` already does.
A stored-but-unloadable backup gets a message that is honest AND useful: it names `MyEBirdData.csv` and the Settings path, matching `BreedingCodeList.tsx:173`, and stays a terse error panel rather than borrowing `SetupRequired`'s steps list.
A cancelled effect run writes no state at all: `if (cancelled) return` before the `!ebird` test, in all four loaders.
No new phase, no new component, no layout change, no change to the genuinely-no-file `setup-required` path, which still carries the full `EBIRD_BACKUP_STEPS`.

## Blast radius
Changing: the ML guard at the three call sites (or inside `mlExportCache.ts`); the shared error string, ideally lifted into `components/setupCopy.tsx` beside `EBIRD_BACKUP_STEPS`; the four `!ebird || cancelled` guards; new tests. Possibly one `docs/HELP.md` sentence (see flags).
Nine sites carry that string today. Single-sourcing prevents drift but not a DROPPED copy (`DECISIONS.md`, v0.5.87), so each surface needs its own render assertion.
Not changing: everything build 1 and build 2 shipped; `observationsCache.ts`; `loadEbirdObservations`; the `setup-required` / `error` phase split; the storage, transport and platform seams; all backend files. **MapExplorer's lifers-sidebar generic hint and `LifeList.resolveMLCounties`'s secondary eBird read both STAY OUT**, as build 1 decided.
One site is neither clearly in nor out, so it is a flag rather than a silent inclusion: `LifeList.tsx:427` has Finding A's exact shape via `storage.readFile('ml')` (deliberately not `loadMLExport` — `DECISIONS.md:1395`), and its throw lands on "ML Export Required" while an ML export is saved.

## What done looks like
**A.** With `storage.readFile('ml')` forced to throw, MapExplorer, BirdingStats and SpeciesDetail each reach `ready` with `hasML === false` / empty `mlRows`, never `setup-required` — one test per component, matching Checklists' existing behavior.
**B.** The message names `MyEBirdData.csv` and the Settings path, contains no em dash (U+2014), and renders in all eight tabs' error panel plus ListComparer's error slot — one test per surface, each with an absent case, plus one asserting the panel is still the terse `role="alert"` error, with no `SetupRequired` steps list.
**C.** In each of BirdingStats, Checklists, BreedingCodeList and NamedBirds, a cancelled run resolving a truthy `ebird` leaves the phase untouched (the step-4 rerender test), and `grep -rn "!ebird || cancelled" frontend/src` returns nothing.
The new message wraps with no horizontal overflow at 320px and at 200% in-app text scale (`.claude/rules/ui.md`).
`npm run build` exits 0 and the full `vitest` suite is green on a quiet machine with nothing else compiling (`.claude/rules/testing.md`).
