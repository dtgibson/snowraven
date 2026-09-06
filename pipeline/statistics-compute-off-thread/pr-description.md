## Statistics compute off-thread

### What this does

The Statistics tab's derivation chain — the ~15 chained `useMemo`s over the parsed
export in `components/BirdingStats.tsx` — moves off the main thread into a Web
Worker, the third in this repo after `observationsWorker.ts` and `mlExportWorker.ts`.

`lib/birdingStats.ts` is untouched: its twelve pure functions keep their signatures
and their three callers outside this tab. What changed is where the Statistics tab
runs them. The chain itself moved out of the component into one pure function
(`lib/statsBundle.ts`) so a worker and the main thread run identical wiring;
`lib/statsWorker.ts` runs it in a worker, `lib/statsOffThread.ts` owns the promise
and the settle contract, and `lib/useStatsBundle.ts` is the component's seam.

Nothing on screen changes. Both timings this introduces were already on screen: the
existing "Computing your statistics…" spinner covers the first compute, and a toggle
already showed stale figures for a beat before updating. Verified byte-identical
against a build of HEAD, in Chromium and WebKit — see *Measurements* below.

**No version bump in this build.** It is one of six on a Spool bundle that ships as
one release; the four-file version set is stamped once for the bundle, matching the
five commits already on this branch.

### How to test

Full instructions for viewing it locally are in
`pipeline/statistics-compute-off-thread/how-to-see.md`. In short:

1. `cd frontend && npm run dev`, open http://localhost:5173, go to **Statistics**.
2. It should look exactly as it did: a shell with "Computing your statistics…", then
   the full page. Every figure, list and chart should be unchanged.
3. Tick **Count all forms**. The checkbox flips instantly; the figures update a beat
   later — and the page should no longer freeze while they do. On a fast Mac the
   freeze was short; on a phone or a Pi it was the thing this change is for.
4. Press each of **Weekly / Monthly / Yearly / Total** under the accumulation chart.
5. Tick **Count escapees**. It should still be instant and issue no recompute at all.
6. In DevTools, Application → check that a `statsWorker` chunk is fetched once on the
   first visit to Statistics and not again per toggle.

Automated:

```
cd frontend && npx vitest run && npm run build
```

### Notes for reviewer

#### The trade this takes explicitly: a second copy of the export in worker heap

The design question was whether the worker HOLDS the observations or is re-posted
them per request. Both were measured on the reference export (21,856 rows, 7.18
Mchar) before choosing.

| | cost |
|---|---|
| `structuredClone` of the observations, round trip | **34.6 ms** (~17 ms of it main-thread serialize) |
| the compute chain itself | **47.9 ms** (best of 5) |
| `structuredClone` of the reply bundle, round trip | **4.2 ms** |
| a follow-up request `{ includeSpuh, granularity, excludedNames }` | **0.003 ms** |

Re-posting per request spends ~17 ms of unbreakable main-thread serialization to move
~48 ms off it — a third of the win handed straight back, and it scales with the device
exactly as the compute does, so it is worth least on the phones this change is for.
The worker therefore takes the export once, on the first message of its life, and
every later request is three small values.

**The price, measured rather than assumed: 19.2 MB of worker heap** for the reference
export (2.67 MB per Mchar), against 19.3 MB the main thread already holds. That is
larger than the 13.2 MB of raw CSV text this repo has already decided once was not
worth retaining (the `observationsCache` change), so it is not left unbounded:
`STATS_WORKER_IDLE_MS` tears the worker down after 30 s with nothing to do, and the
next request respawns it and re-pays the ~17 ms hand-over. Statistics is not unmounted
when the user leaves it (tabs are hidden with `display:none`), so without that the copy
would be held for the rest of the session after one visit. A toggle after a long pause
is a smaller win, never a loss: ~17 ms of hand-over against ~48 ms of compute.

#### The watchdog budget, measured for this work

Neither parse budget transfers — this worker parses nothing, and its per-request cost
has a clone leg they do not. Keyed on **rows**, which is what this worker is given.
Node 24.18 / V8, quiet machine, best of three after a warm-up, over a 15x range:

| rows | compute | clone-in | reply-out | total µs/row |
|---:|---:|---:|---:|---:|
| 5,898 | 3.57 | 1.57 | 0.44 | **5.58** |
| 11,182 | 2.54 | 1.51 | 0.34 | 4.38 |
| 21,856 | 2.34 | 1.55 | 0.19 | 4.08 |
| 43,712 | 2.08 | 1.61 | 0.10 | 3.79 |
| 87,424 | 2.33 | 1.81 | 0.05 | 4.20 |

Flat across the range, so the work is linear in the row count and the allowance can be.
The anchor is the slowest reading, **5.58 µs/row**, at the smallest input where fixed
overheads dominate — anchoring there errs wide. The comparative measurement, same run
same machine: `parseEbirdObservations` ran at 88-93 Mchar/s throughout, which at the
reference export is 77.4 ms of parse against 47.9 ms of compute, so this chain is about
**1.6x faster than the parse whose budget sits beside it**. (`observationsCache.ts`
records 57-75 Mchar/s for that parser on a different machine; the ratio transfers, not
the rate.)

Shipped: **30 s floor + 1.5 ms per row** — about 269x the anchor, a hair wider than the
~250x both parse budgets carry, which is right because this one covers a clone leg they
do not. That is ~63 s for the reference export against the eBird parse's ~59 s for the
same file.

#### The failure signal is the opposite of its precedent's, and that was checked

v1.0.14 refuses to re-run a failed parse on the main thread because that re-runs the
identical multi-megabyte allocation that just failed, on the thread that paints, and
there is no other way to get the answer. **Neither half of that reasoning survives
here**, and I checked rather than assumed:

- The input array is already resident on this thread — it is the array we cloned
  *from* — so the fallback allocates nothing the worker allocated. Measured, the whole
  bundle retains **1.3 MB** against the 19.3 MB of observations already in this heap.
- The fallback is not a novel risk being taken. It is the **shipped behaviour**: 1.0.19
  runs this exact chain on this exact thread on every render. Refusing it would replace
  a working tab with a blank one.

So every failure path resolves to the correct bundle, computed here. Proven at the
promise (`lib/statsOffThreadSettle.test.ts`) and, separately, on the rendered tab
(`components/statsWorkerFallback.test.tsx`), because a promise that resolves correctly
is worthless if the component commits it into a branch still gated on the spinner.

#### Settle contract, third instance — and the first that is not one-shot

The structural difference from both precedents: a worker outlives a request, so
**teardown and settle are not the same event**. Each request owns an idempotent settle
(clear its watchdog, drop from `pending`, resolve or reject once); the worker's teardown
is separate and is triggered by the fatal paths, the idle timer and `dispose`. The five
exits are in the module doc. Two consequences worth reviewing:

- A `{ ok: false }` reply — the chain threw *inside* the worker — rejects that request
  but does **not** kill the worker, because a compute that threw says nothing about the
  worker's health and the alternative is discarding a 19 MB hand-over over one answer.
  The `mlExportWorker.ts` distinction, adapted.
- `onmessageerror` and a reply with no usable id are fatal for **all** outstanding
  requests, because neither can be attributed to one.

The termination assertions in the settle test are two-sided — **zero** on the happy path
(the whole design) and exactly one on each fatal path — where the one-shot precedent
could assert one everywhere.

#### `projectChecklists` deliberately did NOT move

It is `computeChecklists` over the raw observations and it feeds `useChecklistProjects`,
which **cancels a running sweep when its checklist identity changes**. A bundle field is
a fresh array on every reply, so shipping it back with the others would cancel an
eight-minute pass on every toggle — the exact defect the projects-denominator fix was
about, reintroduced by the transport rather than by the memo. It stays a component memo
over `effectiveObs`, stable for the life of the export, costing one 5.8 ms pass per
loaded file rather than one per request. `BirdingStatsProjectsDenominator.test.tsx`'s
source-level guard is unchanged and still green.

The filtered observation array also stays off the wire: 21k rows are not worth cloning
back for the county overlay, which most sessions never open, so the bundle carries only
`filteredCount` and `countyAggregates` re-derives the array from `b.includeSpuh` — the
value the bundle beside it was computed with, never the live control state.

#### `useDeferredValue` is gone, and that is a correctness improvement

The chart branch and its tick formatters read `b.granularity` — the value the data was
actually computed with — instead of a separately-deferred copy of the control. The
deferred value was a *proxy* for "the value the memo consumed"; the bundle carries that
value exactly. Keeping `useDeferredValue` alongside an async bundle would have
reintroduced the one-frame data/branch mismatch its comment warns about.

#### The escapee set is read by content, not identity

`buildProvenanceLookup` rebuilds that `Set` on every provenance snapshot bump, so its
identity churns during a pass whether or not a species was added — and the memo this
replaces, keyed on that identity, re-ran the accumulation on every bump for nothing.
The request now keys on a sorted join, and the list is derived back **out of** that
signature so its identity is stable exactly when the content is. A re-published
identical set therefore costs no request at all, which is also what keeps the rest of
the bundle's identity stable through a sweep.

#### Measurements: before and after, real engines

Two production builds — HEAD and this branch — served side by side against the
reference export through the real storage seam, Workers enabled in both. Worst long
task per interaction, `PerformanceObserver` `longtask`, quiet machine, n=3-4 per cell.
CPU throttling stands in for the phone and the Pi.

| CPU | build | first visit (incl. the map) | "Count all forms" | granularity press |
|---|---|---:|---:|---:|
| 1x | HEAD | 325-389 ms | none | none |
| 1x | **branch** | 313-330 ms | none | none |
| 4x | HEAD | 622-674 ms | 178-200 ms | 80-91 ms |
| 4x | **branch** | **381-432 ms** | **86-91 ms** | 81-92 ms |
| 6x | HEAD | 974-1007 ms | 253-277 ms | 127-133 ms |
| 6x | **branch** | **576-588 ms** | **139-143 ms** | 133-136 ms |

Unthrottled, with the tasks separated: the app's own Statistics render task drops from
**152-160 ms to 90-93 ms** (n=4 each). That ~62 ms is the compute chain. The two tasks
either side of it are unchanged — the page's own render, and MapLibre's idle-deferred
mount (313-397 ms at 1x), neither of which this change touches. **WebKit produced no
long tasks at all in any configuration** — it does not implement the long-task API, so
that is silence rather than a result, and it is why the throttled numbers above are
Chromium-only.

Three honest qualifications:

- **At 1x the toggle already produced no long task on HEAD**, because
  `useDeferredValue` let React split the work on this hardware. The toggle win only
  becomes visible under throttling, which is the case the change exists for.
- **The granularity press is unchanged.** In HEAD it invalidated only `accumulationPair`
  (~9-18 ms), not the whole chain; here the whole bundle recomputes but off-thread. Net
  main-thread work is the same. More total work, none of it on the thread that paints.
- **The page still has long tasks.** The chain no longer contributes one, but the
  Statistics render (~90 ms at 1x, ~580 ms at 6x) and MapLibre's mount remain. Calling
  the tab "no long task over 50 ms" would be false; what is true is that the compute
  chain no longer contributes one.

Page text byte-identical, HEAD vs this branch, in **Chromium and WebKit**, on first
visit and after the toggle, at 1x/4x/6x. And `computeStatsBundle` was asserted equal to
the transcribed 1.0.19 cascade over the real reference export across **16 combinations**
(2 escapee sets × 2 count rules × 4 granularities), field by field.

The verification harness is a scratchpad script rather than a committed one: it needs
the gitignored reference export, so it cannot run in CI. A demo-export version belongs
in `website/tools/verify/` — noted as a follow-up rather than smuggled in here.

#### Bundle

The worker gets its own graph, so `birdingStats.ts`, `speciesUtils`, `breedingCodes`,
`commentBlocks` and `ebird-countability.json` emit into it as well: a new
**22.7 kB (8.6 kB gzip)** `statsWorker` chunk, off the entry chunk and requested only
when Statistics first computes. The `BirdingStats` chunk grows 123,895 → 126,252 bytes
(29,303 → 30,251 gzip). `entryChunk.test.ts` was re-read before assuming it was
unaffected: its walker follows static `from '...'` specifiers only, and
`new Worker(new URL(...))` is neither — confirmed against the built
`dist/index.html`, whose modulepreload list carries no `statsWorker`.

#### Tests

- `lib/statsBundleParity.test.ts` — 21 tests. The 1.0.19 cascade transcribed verbatim
  and asserted equal field by field across both count rules × all four granularities ×
  two escapee sets, plus non-vacuity, plus the empty-bundle shell pass, plus a
  structured-clone round trip (serializability is a *requirement* of that module).
- `lib/statsOffThreadSettle.test.ts` — 19 tests. The settle contract, the two-sided
  termination assertions, the hand-over-once protocol, two requests in flight, the idle
  teardown and respawn, `dispose`, the budget scaling, and both no-Worker shapes.
- `components/statsWorkerFallback.test.tsx` — 4 tests. A worker that dies, one that
  replies unreadably, and one that goes quiet each render a page **byte-identical** to
  the no-Worker baseline, asserted on the DOM.

The seven existing files that render `BirdingStats` needed **no changes**. That is a
design outcome rather than luck: the no-Worker path computes synchronously inside the
effect, in the same commit, so the stubbed-rAF timing every one of them depends on did
not move. An `await` there would have bought nothing on a platform with no worker to
wait for and moved the commit for all seven.

Full suite: 292 files, 4,934 tests green. `npm run build` clean.
`weft-design-lint`: zero warnings (the three notes on these files are a `duration: 45`
in an observation fixture read as UI motion, and the app-wide global reduced-motion
block).

## Convention Flags

- A worker that is handed a large input once and then answers many small requests needs
  a memory bound of its own — an idle teardown — because the tab holding it is never
  unmounted. State the held size as a measurement.
- A settle contract over a long-lived worker separates per-request settle from
  per-worker teardown, and its termination assertions become two-sided: zero on the
  happy path, exactly one per fatal path.
- A derived array whose *identity* is a signal to a consumer must not become a worker
  reply field. A reply is a fresh array every time, so the signal fires on every request.
- Key a request on the CONTENT of a set that churns identity, and derive the set back
  out of the signature so its identity is stable exactly when the content is.
- When a component's derived state moves behind an async boundary, the value the data
  was computed with travels back with it, and render branches read that rather than the
  live control state.
- A worker-vs-no-worker A/B by deleting `window.Worker` is not a valid baseline in this
  app: MapLibre uses workers too. Compare two builds.
