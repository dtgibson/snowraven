# Change Brief — Statistics Compute Off-Thread

## What is changing

The Statistics tab's derivation chain moves off the main thread. `BirdingStats.tsx`
runs roughly fifteen `useMemo`s over the parsed export synchronously — `computeChecklists`,
`computeLifeList`, `computeTopSpecies`, `computeTotals`, `computeAccumulation`,
`computeTemporal`, `computeDurationBins`, `computeGeo`, `computeEffort`, `computeQuality`,
`computeBreedingStats`, `computeFunStats`, all in `lib/birdingStats.ts` — measured at ~93 ms
of paint-blocking work on the reference export (21,369 rows, 3,252 checklists, 6.93 Mchar).
Those functions stay put, keep their signatures and keep their three callers outside this
tab (`MapExplorer.tsx`, `SpeciesDetail.tsx`, `lib/checklistsTab.ts`). What changes is where
the Statistics tab runs them: in a worker, behind a promise with a settle contract,
alongside the two off-thread parses this repo already ships.

## Why now

The parse is already off-thread (`parseOffThread`, ~105 ms) and the compute that
follows it is not, so the tab still blocks paint at the point the user is looking at
it — plausibly 400-700 ms on an iPhone or a Pi, and paid again on every "Count all
forms" toggle, not just first visit. The worker shape is established and twice
proven here (`lib/observationsWorker.ts`, and `lib/mlExportWorker.ts` +
`lib/parseMLExportOffThread.ts` with its own measured budget), so this applies a
pattern rather than inventing one. The idea weighed and rejected the alternative:
caching derived results to disk saves only ~90 ms and needs one blob per
escapee/spuh/granularity combination.

## User-facing impact

None visible, and that is a design constraint rather than a hope. Statistics already
paints a shell and a "Computing your statistics…" spinner before the heavy memos
(the `computed` double-rAF gate), so first visit reuses that state unchanged. Both
recompute-triggering controls already run through `useDeferredValue`, so a toggle
already flips its checkbox instantly and updates the figures a beat later; the
worker reproduces that sequence without the freeze. **The constraint that keeps it
invisible: one reply, one commit.** Every result lands in a single state update. A
per-section streaming shape would give the page a partial-update state it has never
had, and is out of scope.

## Design pass

**Not needed — no visual change.** The two timings this introduces are both already
on screen today: the existing spinner covers the first compute, and the existing
deferred-value stale-then-update covers a toggle. Worker failure degrades to the
synchronous compute that ships today, so it needs no surface of its own. If the
Engineer finds that one-reply-one-commit cannot hold, or that failure needs its own
affordance, that reopens this decision and gets raised rather than improvised.

## Scope

Changing: a new stats worker plus its promise module shaped like
`lib/parseMLExportOffThread.ts`; `components/BirdingStats.tsx` (the memo cascade
becomes an awaited result with a synchronous fallback); a new settle test modelled on
`lib/observationsCacheSettle.test.ts`'s `FakeWorker`;
and timing updates across the ten test files that render BirdingStats.

**No version bump in this build.** It is one of six on a Spool bundle that ships as a
single release, so the four-file version set (`frontend/package.json`,
`src-tauri/tauri.conf.json`, `CHANGELOG.md`, `website/index.html`) is stamped once for
the bundle at release, not per build - matching the five commits already on the branch.

Explicitly NOT changing: `lib/birdingStats.ts`'s pure functions or their signatures
(three other callers and `birdingStats.test.ts` depend on them); the shared parse
seam in `lib/observationsCache.ts`, its watchdog constants or its cache semantics;
the escapee precompute-both-select-at-read shape; the ML, provenance and county
memos; any stored document, so no docs or privacy surface moves.

## Risks named at scoping

- **The clone cost is the whole design question.** Measured here: `structuredClone`
  of a full 21,369-row observations array is 32-42 ms round trip, so re-posting
  `filteredObs` on every toggle spends ~15-20 ms of unbreakable main-thread work to
  save ~93 ms, and scales with the device exactly as the compute does. The shape
  that wins is a worker that **holds its own copy** of the observations and
  thereafter receives only `{ includeSpuh, granularity, excludedNames }` (0.04 ms)
  and replies with the small result objects (0.04 ms). Leaning: a separate stats
  worker fed once during the existing spinner, so the shared parse seam is untouched.
  Its cost is a second copy of the parsed array in worker heap — against a standing
  large-export memory concern that already drove the retained CSV text out of
  `observationsCache`. Take that trade explicitly, do not let it happen silently.
- **Settle contract, third instance.** One idempotent settle over all five exits, a
  size-scaled watchdog **measured for this work rather than inherited** (the rule
  `parseMLExportOffThread.ts` states), handlers detached, worker terminated once.
- **The failure signal is not its precedent's.** A failed parse resolves `null`
  because loaders branch on falsy, and v1.0.14 deliberately refused a main-thread
  retry. Neither transfers: a failed compute has an honest fallback its precedent
  lacked — run it synchronously, which is what 1.0.19 does every time — and the
  reason for refusing the retry (re-running an allocation that had just failed) does
  not obviously apply to arrays already resident on both threads. Confirm that before
  relying on it.
- **Serializability checked, one exception.** Every compute input and output is plain
  data plus `Set<string>`, all clone-safe. `buildCoverIndex` takes a function
  argument and is therefore not movable as written; it is out of scope.
- **Some results must return regardless.** `ChecklistEntry[]` (~3,252 rows, ~2 ms)
  feeds `useChecklistProjects` and `buildCountyAggregates` on the main thread.
- **Test timing is the largest blast radius.** Ten files render BirdingStats, and
  `renderAndLoad()` waits on a stubbed rAF queue precondition that exists because of
  a documented flake (`.claude/rules/testing.md`). A new await boundary moves it for
  all of them.
- **Bundle duplication.** A worker gets its own graph, so `birdingStats.ts`,
  `speciesUtils`, `breedingCodes`, `commentBlocks` and the 6.8 KB
  `assets/ebird-countability.json` emit into the worker chunk as well. Off the entry
  chunk, so `entryChunk.test.ts` is unaffected, but re-read it before assuming so.

## Decisions touched

- **v1.0.14 — "A promise with no reject path hangs the session… a failure signal must
  match the branch its consumers already take."** Directly extended: a third worker-backed
  promise inherits the settle contract whole, and its failure-signal half needs the
  re-reading noted above rather than a copy.
- **v1.0.16 — the `return await` entry.** It names this exact change class ("the
  observations parse went off-thread for the same class of reason"), so every new async
  boundary here owes `return await` and a bounded totality claim at its definition site.
- **The escapee toggle's precompute-both-select-at-read rule (NFR-02)** constrains rather
  than changes: the toggle must still invalidate nothing.
- Not touched: the durable-cache rules (v0.5.87, v1.0.5) and shared-document write
  serialization (v1.0.9) — this change stores nothing.

## What done looks like

- On the reference export, the Statistics compute chain contributes no long task over
  ~50 ms, measured client-side on a settled main thread with nothing else compiling
  (the timing-measurement rule in `.claude/rules/testing.md`).
- Every figure, list and chart is identical to 1.0.19 for the same export across both
  count rules and all four accumulation granularities.
- Worker death, an unclonable reply, and silence past the budget each leave the tab
  showing correct statistics through the synchronous fallback, proven by a
  `FakeWorker` settle test; full suite green and `npm run build` clean.
