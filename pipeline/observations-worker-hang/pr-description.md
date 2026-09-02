## observations-worker-hang

### What this does

Every observations tab could spin forever, permanently, if the eBird parse worker
died quietly.

`parseOffThread` in `frontend/src/lib/observationsCache.ts` built its promise with a
**resolve-only executor**: no `reject`, no timeout, no `onmessageerror`, no death
detection. `onmessage` and `onerror` were its only two settle paths, so any worker
death that does not dispatch `error` — an OOM kill, a crash, a reply that fails
structured clone — left the promise pending forever and left the dead worker
un-terminated. Because `loadEbirdObservations` memoizes that promise in `inflight`,
whose `.finally(() => { inflight = null })` therefore never ran, **every later caller
for the rest of the session awaited the same dead promise**. All eight observations
tabs showed a permanent spinner until the user re-saved or cleared the eBird file in
Settings. The `onerror` fallback was its own problem: it re-ran the identical parse
synchronously on the main thread, retrying the allocation that had just failed and
blocking the UI while it did.

Three changes:

1. **A settle contract.** `parseOffThread` now settles on every path and always tears
   the worker down: a reply (resolve); `onerror` (reject); `onmessageerror`, for a
   reply that cannot be cloned back (reject); a `postMessage` that throws on the way
   out (reject); and silence past a size-scaled budget (reject). One idempotent
   `settle` clears the watchdog, detaches the handlers, terminates the worker and
   settles exactly once, so a late event after the watchdog cannot re-settle or
   double-terminate.
2. **No second main-thread parse on the failure path.** The `onerror` branch no
   longer calls `parseEbirdObservations(text)`. The synchronous parse survives in one
   place only — where `new Worker` throws because Workers do not exist (an older
   browser, jsdom under vitest). That is the *only* parse on that path, not a retry
   of a failed one.
3. **Failure is reported as `null`, not as a throw.** `loadFresh` catches a failed
   parse and returns `null`; nothing is cached, and `inflight` clears, so the next
   mount, re-save or iCloud file arrival starts a fresh attempt rather than
   re-joining a dead promise.

### Why `null` and not a rejection

A bare rejection would have been the smaller diff and the wrong answer. All eight tab
loaders wrap their load in `try/catch` and map a **thrown** load to
`setPhase({ tag: 'setup-required' })` — "upload an eBird backup" while a backup is
plainly loaded. Each of them already has an honest failure branch on a **falsy**
result, so resolving `null` routes the failure to a terminal state that names the
real problem, in six of the eight with no edit at all.

The two that did not reach it were fixed so the result is not mixed:

- **MapExplorer** sent `!ebird` to `setup-required`. `MapPhase` gains an
  `{ tag: 'error'; message }` variant and the sightings view now renders the same
  error panel the other tabs render, in the same place `<SetupRequired>` would have
  gone. The Hotspots / Media Targets / Lifers views keep working, exactly as they do
  today without a backup.
- **LifeList** treated a falsy backup as "no backup", silently rendering the ML-only
  list — which omits every species seen but not photographed. A backup that *is*
  stored but did not load now reaches LifeList's existing `error` phase. A backup
  that was never stored still degrades to the ML-only list, unchanged.

All eight tabs now show the identical string, once each:
`"Couldn't load your eBird backup from Settings. Try re-uploading it."`

`lib/hotspotSet.ts` (empty Set) and the App.tsx weather-backlog prewarm (null rows)
already degraded on a falsy result and are unchanged; they were rejection-safe before
and are falsy-safe now.

### The timeout, and why it is this number

Silence is the only evidence a silently-dead worker leaves, so it has to be bounded
by a clock — and the brief is right that a timeout firing on a slow-but-healthy parse
would be a worse bug than the hang. So the budget scales with the input rather than
being a fixed guess:

```
budget = 30 s  +  4 s per megabyte of CSV
```

Measured first. `parseEbirdObservations` over the tracked demo export and multiples of
it (Node 24 / V8, quiet machine, nothing else compiling):

| input | chars | parse |
|---|---|---|
| demo ×1 | 1,362,039 | 24 ms (57.8 Mchar/s) |
| demo ×5 | 6,808,955 | 95 ms (71.6 Mchar/s) |
| demo ×20 | 27,234,890 | 363 ms (75.0 Mchar/s) |

Flat throughput across a 20x size range, so the parse is linear in the input and the
allowance can be too. **4 s/MB is ~250x slower than measured**, which clears the
slowest device this app ships to (a Pi's browser, an older iPhone's WKWebView) by a
wide margin even with the heap under GC pressure. In practice: ~34 s for the demo
export, ~56 s for the 6.6 MB reference export in CHANGELOG 1.0.13, ~10 min for a
148 MB / 500k-row one. The 30 s floor covers worker spawn, module evaluation and the
structured clone of the request on a busy device, none of which scale with the file.

A parse that legitimately needs longer than that has already lost — but it now loses
in bounded time, with an honest message, instead of hanging the whole session.

### How to test

1. `cd frontend && npm run build` — clean.
2. `cd frontend && npx vitest run src/lib/observationsCacheSettle.test.ts` — the new
   guard, 11 tests.
3. `cd frontend && npx vitest run src/lib/observationsCacheRetention.test.ts src/lib/cacheInventory.test.ts`
   — the two guards named in the brief's blast radius, still green.
4. `cd frontend && npx vitest run` — full suite, 254 files / 4108 tests.
5. Manually, in the running app: see `pipeline/observations-worker-hang/how-to-see.md`
   for the one-line source edit that reproduces a silently dying worker.

### Notes for reviewer

- **The new guard test never forces a real OOM.** The stand-in is a fake `Worker`
  installed on `globalThis` that reproduces each way a worker can go quiet: never
  replying, `onerror`, `onmessageerror`, and a `postMessage` that throws. Timers are
  faked, and every test drives its promise to settlement before asserting, so no
  watchdog outlives the file.
- **"No second main-thread parse" is proved by counting.** `./parseEbirdObservations`
  is mocked with a pass-through that increments a counter; the failure-path tests
  assert the count is **0**, and the no-Worker fallback test asserts it is exactly
  **1**.
- **The retention drift guard was respected.** `observationsCacheRetention.test.ts`
  bans `.slice(`, `.substring(`, `.search(`, `.match(`, `.replace(` anywhere in
  `observationsCache.ts` (v1.0.13). None of the new code, in source or in comments,
  uses those spellings.
- **A behavior change that falls out of `null`-not-throw, and is an improvement:** an
  eBird CSV missing required columns makes the parser throw `INVALID_EBIRD`. That used
  to reach the tabs as `setup-required`; it now reaches them as
  "Couldn't load your eBird backup..." — a truthful message where the old one was not.
  BreedingCodeList's separate "doesn't look like an eBird backup" branch (a file that
  parses but has no Breeding Code column) is untouched.
- **Not changed, deliberately:** the v1.0.13 streaming parser contract in
  `parseEbirdObservations.ts`, `firstLine`, the cache/`generation` invalidation
  semantics, `mlExportCache.ts`, `observationsWorker.ts` (an uncaught throw there
  already surfaces as `onerror`, which is now a real settle path, so it needed no
  change), and every storage / transport / platform seam.
- **Left alone as out of scope:** `postMessage(text)` still structured-clones the
  whole CSV, so main thread and worker each hold a copy for the duration of the parse
  (the brief lists this as related-but-out-of-scope). And LifeList's *secondary*
  eBird read inside `resolveMLCounties` still degrades silently to the Nominatim pass
  — it is county enrichment, not a tab load, and it cannot be reached in the failing
  case because the tab has already gone to `error` by then.
- Per the Spool bundle convention (precedent: `cb79fb1` vs `08a3e0d` for 1.0.13),
  **no version bump, no CHANGELOG entry, no doc/website update** in this build — those
  happen once at the bundle's release prep.
