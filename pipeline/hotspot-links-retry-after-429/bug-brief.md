# Bug Brief: Hotspot links stay plain after eBird rate limiting

## What is broken
When eBird answers "too many requests" (429) to a state's hotspot lookup (`GET /map/hotspot-region`) on all three attempts the shared gate allows (`gatedEbirdCall`, 1 + `ACTIVITY_RATE_LIMIT_RETRIES`), `buildHotspotSet` (`frontend/src/lib/hotspotSet.ts:37-39`) treats the failure as an empty list, so the Set comes back complete-looking but without that state.
`getHotspotSet` (`hotspotSet.ts:86-93`) keeps that resolved Set for the session, keyed only on the region list, and `useHotspotSet` (`frontend/src/lib/useHotspotSet.ts:22-26`) reloads only when the invalidation epoch moves: an eBird key or file save or delete in Settings, or an iCloud arrival. Until then, or a restart, every public hotspot in that state renders as plain text on every tab.
Nothing else holds the failure: `networkCache` never caches a 429 and the gate's cooldown ends on its own. The memo is the one thing that never asks again. Same on both transports, since the stickiness sits above them.

## Steps to reproduce
1. Valid eBird key and a backup with checklists in one state (US-CA). eBird answers 429 to `/map/hotspot-region?regionCode=US-CA` three times, then 200.
2. Hotspot names on Statistics, Checklists, Species Detail, Named Birds, Map Explorer's county popup and Targets render plain. Wait out the cooldown (Retry-After is capped at 60 s), switch and revisit tabs: no further request is made and the names stay plain.
3. Save the eBird key or re-upload the file in Settings: one request, and the links appear.
Reproduced in vitest against the real transport, gate, network cache and hotspot-set modules, faking only `fetch` and the backup loader: 3 fetches and an empty Set; after the cooldown, `loadHotspotSet()` makes 0 fetches and returns an empty Set; after `invalidateHotspotSet()`, 1 fetch and both ids.

## Expected behavior
Later in the same session, with no key or file save, the app asks eBird again for only the states that ran out of 429 retries, no sooner than the shared cooldown's end, and the links appear on every mounted tab when it answers (subscribers are notified; succeeded states keep their ids and are not re-asked).
The re-attempt is bounded: a fixed number of rounds per build with widening spacing owned by `hotspotSet.ts` (the pass's controller), each request going through the normal transport and gate, so each round costs at most 1 + `ACTIVITY_RATE_LIMIT_RETRIES` requests per failed state. Gate policy is not changed and a 429 is still never cached. Once the bound is spent the state stays plain, as today.
A key or file save, an iCloud arrival or a new region list cancels a pending re-attempt, and a stale result never lands on the newer build. Decision: offline, 5xx and missing or bad key failures keep today's behaviour (a key or file save re-arms them); reversal condition is a report of links missing after a short offline spell.

## Blast radius
Every tab that reads hotspot membership through `useHotspotSet`: Statistics (top locations, its lists and the Geographic Stats county popup), Checklists, Species Detail (lists and its map's county popup), Named Birds, Map Explorer's county Completeness popup, and Targets (the Last report cell, whose links are built from each row's own validated id in a sortable table and open through the opener plugin's global listener, accepted at v1.0.47). Calendar stays plain by design; the Weather tab's backlog is not passed `isHotspot` and is unaffected.
Shared eBird gate state (`lib/ebirdGate.ts`): re-attempts take start slots and can open cooldown waves that also slow Map Explorer lookups, the hotspot activity pass (`useHotspotActivity`; its 6 h cache is untouched) and the Targets and projects sweeps, whose wave differencing will count any wave a re-attempt opens.
`hotspotSet.ts` is on `App.tsx`'s static graph (via `NamedBirdsTable`), so `entryChunk.test.ts` must stay green; `ebirdGate.ts` is already entry-safe because `transport.ts` imports it. Unchanged: `networkCache.ts`, the `transport.ts` path sets, both transports and the backend route. No new host, endpoint or moved request, so `PRIVACY_POLICY.md` is unaffected.

## What done looks like
Composed tests (real transport, gate, network cache and `hotspotSet`; `fetch` faked): 429 x3 then 200, and after the cooldown the Set gains the state's ids and subscribers are notified with no `invalidateHotspotSet` call; a jsdom `useHotspotSet` row where the name flips from plain to linked on its own.
Bound and supersession rows, each mutation-checked red first: 429 forever stops at the stated request count, asserted as a fetch count rather than elapsed time, with no timer left pending; a key or file save or region change mid-wait never merges the stale result (assert the re-attempt never ran); succeeded states are not re-asked; 502, offline and 401 do not re-attempt.
Regression: existing `hotspotSet.test.ts` (which mocks `transport` wholesale, hence the composed twin), `useHotspotSet.test.tsx`, the gate and `rateLimit` tests, `entryChunk.test.ts`, HotspotLink and Targets suites; full frontend suite, `npm run build` and eslint green.
Spin rules: no version bump, no `CHANGELOG.md` edit, no website, README, App Store or privacy edits. The Engineer writes one changelog line to `pipeline/hotspot-links-retry-after-429/changelog-line.md`.
