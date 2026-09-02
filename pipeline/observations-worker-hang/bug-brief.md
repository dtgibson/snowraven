# Bug Brief — observations-worker-hang

## What is broken
Confirmed against the code, with one correction. `parseOffThread` (`frontend/src/lib/observationsCache.ts:36-54`) builds its promise with a **resolve-only executor**: no `reject`, no timeout, no `onmessageerror`, no termination detection, so `onmessage` and `onerror` are the only two settle paths.
Any worker death that does not dispatch `error` (an OOM kill, a crash, a reply that fails structured clone) leaves the promise pending forever, and `worker.terminate()` never runs on that path either, so the dead worker is not reclaimed.
It is worse than one tab: `loadEbirdObservations` memoizes that promise in `inflight`, whose `.finally(() => { inflight = null })` therefore never runs, so **every later caller for the rest of the session awaits the same dead promise**; only `clearEbirdObservationsCache()` (a Settings save/clear, or an iCloud file arrival) releases it.
The `onerror` fallback is exactly the reported anti-pattern: `resolve(parseEbirdObservations(text))` re-runs the identical parse **synchronously on the main thread**, retrying the allocation that just failed and blocking the UI, with `terminate()` only after it returns.
Correction: "an OOM-killed worker fires neither handler" is structurally true here (two settle paths, no third, so any silent death hangs) but the engine-level dispatch behavior on an OOM kill is not demonstrated in this repo. See flags.

## Steps to reproduce
1. Load an eBird backup large enough to exhaust the parse worker's heap. v1.0.13's streaming parser cut peak use to roughly a fifth, so the threshold moved up but was not removed.
2. Open any tab that loads observations (Statistics, Calendar, Checklists, Life List, Map Explorer, Species Detail, Breeding Codes, Named Birds).
3. The worker dies; neither handler fires. Observed: the spinner never stops, every other observation tab then shows the same permanent spinner, and only re-saving or clearing the eBird file in Settings frees the session.
4. Deterministic stand-in a Tester can run without a real OOM: make the worker die without dispatching `error` (terminate it, or fail the reply's clone) and assert the promise never settles and `inflight` is never cleared.
5. Fallback half, separately: throw inside `observationsWorker.ts` so `onerror` does fire, and observe a full synchronous main-thread parse of the same text.

## Expected behavior
`parseOffThread` settles on every path, including a worker that dies silently, and the worker is always torn down.
A dead worker takes the tab to an honest, actionable terminal state instead of an endless spinner.
The failure path does not repeat the allocation that just failed on the main thread.
Constraint found while scoping, which the fix must respect: a bare rejection is NOT sufficient. All eight tab loaders map a thrown load to `setPhase({ tag: 'setup-required' })`, i.e. "upload a backup" while a backup is loaded.
Each of those loaders already has an honest failure branch on a falsy result ("Couldn't load your eBird backup from Settings. Try re-uploading it."), so a truthful state is reachable; the Engineer picks the mechanism.

## Blast radius
Changing: `frontend/src/lib/observationsCache.ts` (settle contract + fallback), probably `frontend/src/lib/observationsWorker.ts`, a new test, and possibly the eight tab loaders' failure branch depending on how failure is surfaced.
Awaiting this promise: BirdingStats, Calendar, Checklists, LifeList (two sites), MapExplorer, SpeciesDetail, BreedingCodeList, NamedBirds, plus `lib/hotspotSet.ts` and the App.tsx weather-backlog prewarm; the last two already `.catch()` and degrade (empty Set / null rows), so they are rejection-safe today.
Two guard tests read this module's source and must stay green: `observationsCacheRetention.test.ts` bans `.slice(`, `.substring(`, `.search(`, `.match(`, `.replace(` anywhere in the file (comments stripped), and `cacheInventory.test.ts` pins the `LoadedEbird` / `headerLine` shape.
Not changing: the v1.0.13 streaming parser contract in `parseEbirdObservations.ts`, `firstLine`, the cache/`generation` invalidation semantics, `mlExportCache.ts` (parses inline, no worker, does not share this bug), and every storage/transport/platform seam.
Related, out of scope unless the Engineer needs it: `postMessage(text)` structured-clones the whole CSV, so main thread and worker each hold a copy for the duration of the parse.

## What done looks like
`parseOffThread` settles on every path including a silently dying worker, the worker is terminated in all cases, and a test proves the pending case is gone.
On failure every observation tab reaches a terminal state naming the real problem, never an endless spinner and never `setup-required` while a file is loaded.
The failure path performs no second full parse of the same text on the main thread.
A failed load does not poison the session: `inflight` is cleared once it settles, so a later mount or re-save starts a fresh attempt rather than re-joining a dead promise.
`npm run build` is clean and `observationsCacheRetention.test.ts` + `cacheInventory.test.ts` still pass.
