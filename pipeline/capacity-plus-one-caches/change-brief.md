# Change Brief — Capacity Plus One Caches

## What is changing
Measure the five named cache sites through their real callers at capacity+1, then change only a cache whose evidence shows a harmful bound or unbounded retained growth. `countyCompletenessCache.ts` (250 entries/4,000,000 serialized payload code units) and `replayStore.ts` (300 entries/3,000,000 serialized payload code units) are bounded FIFO stores; each length budget excludes keys/metadata and deliberately permits one sole oversized newest entry. `storage.ts` only persists them and owns no eviction. `persistedStyle.ts` is unbounded structurally, while the shipped call graph currently requests only `positron` (with `liberty` the only typed future variant). `nominatimService.ts` has an unbounded coordinate cache mirrored by `backend/routers/nominatim.py`; both are reachable from Life List's ML county-resolution path and belong in the root-cause sweep.

## Why now
The v0.5.85 memo-cache review established that fixed-size caches must be measured at capacity+1 and that the comparison must express work, not noisy elapsed time. Its wider sweep named these sites but incorrectly counted `storage.ts` as a third evicting cache and left all five unmeasured. This build closes that evidence gap without assuming FIFO is harmful when each miss is already dominated by network/storage I/O.

## User-facing impact
None intended. UI, copy, provider contracts, route/response shapes, persisted schemas, TTLs, offline replay/stale fallback, Nominatim results and rate etiquette remain behaviorally identical. Nominatim repeats beyond the new admission ceiling deliberately refetch rather than extending process-lifetime retention; admitted hits remain hits.

## Design pass
Not needed — no visual change.

## Decisions touched
`DECISIONS.md` v0.5.85 memo bound: capacity+1 evidence and work-based assertions. Offline support (v0.5.45): replay remains opt-in with 300-entry/3,000,000-payload-code-unit oldest-loaded eviction. County Completeness (v0.5.54): 30-day persistent cache stays the route's single cache. Tab Filters (2026-05-20): the backend and Tauri Nominatim caches remain dual-transport twins and preserve the shared one-request-per-second policy.

## What done looks like
- An inventory test/report states the actual bounds, key domains, shipped call paths and storage/network cost for all five named files; it explicitly proves `storage.ts` has no independent cache and records the currently finite shipped caller graph for `persistedStyle.ts` without claiming its string-accepting helper API is bounded.
- The two FIFO stores are exercised through real exported APIs at both count-cap+1 and serialized-payload-length-budget+1 (including seeded persisted state), with deterministic work counters separating array-shift/bookkeeping and whole-document persistence from the unavoidable loader call; strict count caps, oldest-out, newest-survives (including the sole-oversized-entry exception), payload-code-unit accounting, TTL/replay behavior and each debounced snapshot's flush-time contents stay correct.
- Both Tauri and FastAPI Nominatim twins are exercised with distinct rounded coordinates and repeats; tests prove admitted cache hits and concurrent same-key calls avoid duplicate outbound work, the chosen bound/admission policy prevents unbounded retention without thrash, results stay in input order, and <=1 request/second behavior holds across overlapping public calls. Overflow repeats deliberately refetch. Any production edit is justified by this evidence; otherwise the build closes measurement-only with source behavior unchanged.

The durable stores' debounced persistence remains best-effort: the in-memory mirror is current, but overlapping slow writes are not serialized and an older completion can overwrite a newer durable snapshot. This pre-existing residual is recorded rather than described as a newest-write ordering guarantee.

## Scope boundaries
Likely code/tests: the four cache owners (`countyCompletenessCache.ts`, `replayStore.ts`, `persistedStyle.ts`, `tauri/nominatimService.ts`), the backend Nominatim twin, and focused tests/probes. `storage.ts` may receive coverage or corrected comments only, not invented eviction logic. Do not change `transport.ts` routing, callers/UI, provider contracts, persisted document shapes, cache TTL/cap values merely for uniformity, `networkCache.ts`, or unrelated module caches.

## Risks and open questions
FIFO bookkeeping can look expensive in isolation yet remain invisible beside an external fetch; compare total added cache work and persistence volume, not a synthetic Map loop. Nominatim's one-second throttle masks CPU timing and makes live capacity tests impractical, so use mocked outbound calls and deterministic retention/work seams while keeping a small end-to-end parity check. If bounding Nominatim would make one ML import re-fetch an evicted coordinate within the same batch, prefer admission control or a bound large enough for that batch and prove the no-thrash property.
