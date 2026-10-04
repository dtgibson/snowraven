# Decisions: hotspot-links-retry-after-429 (Fix lane, Stage 2, The Engineer)

## What changed

- `frontend/src/lib/hotspotSet.ts`. A region lookup now answers in one of three ways: ids, nothing (any non-429 failure, as before), or **unanswered because eBird was limiting requests** (a 429 that outlasted the gate's retries). `askRegions` returns the union of ids plus the list of rate-limited regions. `getHotspotSet` arms a re-ask schedule for those regions only. A round that adds ids replaces the cached promise with the merged Set and bumps the existing change epoch, so every mounted `useHotspotSet` reloads (a cache hit, no request).
- `frontend/src/lib/useHotspotSet.ts`. Doc comment only. The hook already reloads on the epoch, and that epoch now also moves on a re-ask arrival.
- Nothing else changed: no change to `ebirdGate.ts`, `rateLimit.ts`, `networkCache.ts`, `transport.ts`'s path sets, either transport, or the backend route. The one new import, `isRateLimitError` from `rateLimit.ts`, was already on the entry graph through `transport.ts`, and `entryChunk.test.ts` stays green.

## Values chosen

| Constant | Value | Why (one line) |
|---|---|---|
| `HOTSPOT_RETRY_ROUNDS` | 3 | Three rounds reach about 7 minutes after the build. A limit still refusing after that is a long-lived one (the projects sweep's paused copy suggests about an hour), where more asking only slows the user's other eBird lookups. |
| `HOTSPOT_RETRY_BASE_MS` | 60 s | This is no shorter than the longest cooldown the gate can open (Retry-After capped at `RETRY_AFTER_CAP_SEC` = 60 s, the gate's own ladder at `ACTIVITY_COOLDOWN_MAX_MS` = 30 s), so round 1's timer does not normally fire into a cooldown. It is also short enough that a limiter that clears within a minute or two shows the links soon after. |
| Spacing growth | doubling: 1, 2, 4 min (`hotspotRetryDelayMs(k) = BASE * 2^(k-1)`), measured from the end of the previous attempt | The brief asks for growing spacing. Doubling matches the gate's own ladder shape and keeps three rounds under 10 minutes. |
| Requests per round | one `transport.get` per still-limited region | The gate turns each into at most `1 + ACTIVITY_RATE_LIMIT_RETRIES` (3) requests. Gate policy is unchanged. |

**Bound, stated in the module header:** at most 9 requests per limited region per build beyond the build's own 3. That is 12 in all, and the request-count test in `hotspotSetRetry.test.tsx` asserts it. Once the rounds are spent the region stays plain, as before this fix, until a key or file save (or a relaunch).

**The cooldown guarantee belongs to the gate, not to this schedule.** Every re-ask goes through `transport.get`, so through `gatedEbirdCall`, which holds a request's start until any open cooldown has ended. The composed test checks the property: the round's request time is at or after the `cooldownUntil` recorded at build end. I considered adding `max(spacing, cooldown remaining)` to the timer and left it out. At these values the term is never active when the timer is armed, because arming happens as the cooldown opened by the build's last 429 begins, and that cooldown is at most 60 s. It would be a guard with no measured job. **Reversal:** if `HOTSPOT_RETRY_BASE_MS` is ever set below the Retry-After cap, a round's timer could fire into an open cooldown. Its request would then wait in the gate's start queue. That is correct behavior, just untidy, and at that point the `max` is worth adding.

**Pass-scale layer, per the CLAUDE.md pacing bullet.** The schedule lives in the pass's controller (`hotspotSet.ts`), not in gate policy. It reads no gate state. It sleeps its full interval, during which the gate's floor elapses, so the two never add. A refused round adds waves to the gate's monotonic `waveCount`: each gate attempt refused after a cooldown has ended opens one. The Targets and projects sweeps count those waves by differencing. That cost is accepted in the brief's blast radius and is bounded by the three rounds.

## Scope: 429 only, and the widening condition

Only a 429 that outlasted the gate's retries is re-asked. Offline, a 5xx, and a missing or bad key keep today's behavior: the region contributes nothing and stays plain until a key or file save or delete, or an iCloud arrival, calls `invalidateHotspotSet`. This is the Evaluator's decision from the bug brief, kept as written.

- **Why only 429:** a 429 is the one failure that ends on its own on a known clock (the gate's cooldown). A bad key needs the user to act, and a key save already re-arms the lookup. A 5xx or offline failure has no clock to wait on.
- **Widening condition:** a report of hotspot links missing after a short offline spell. The widening is one predicate in `askRegions`, adding `isOfflineError(err)` (from `lib/offlineDetect.ts`) beside `isRateLimitError(err)`, with the non-429 test row for offline moving to the re-asked side. A 5xx widening has the same shape. A 401 or missing key never widens, because the key save is its re-arm.

## Supersession

- One generation counter (`_buildGen`) and at most one pending timer. Rounds run one after another, and a superseded build never arms one.
- `invalidateHotspotSet` and a new region list both go through `supersedeRetries`, which bumps the generation and clears the pending timer, so a pending round never asks. `invalidateHotspotSet` is called from Settings' four eBird file and key save or delete points and from `icloudSync.ts`'s `invalidate` (synced file arrival or clear) and `invalidateKey` (synced key). A new region list arrives through `getHotspotSet`'s key check.
- A round that is already asking re-checks the generation after its answer lands, so a late answer from an older build never merges into a newer one.
- These are two guards with two different jobs, each pinned by its own row (mutations M1 and M3 below): the cleared timer stops a pending round from asking, and the post-await check stops an in-flight answer from landing. Neither one is redundant.
- The build itself re-checks the generation before arming (M2): a build superseded while it was still asking never arms a round.

## Arrival: the existing epoch, not a second counter

The only subscriber is `useHotspotSet`, and its reload is a cache hit on the merged Set. So the re-ask bumps the same epoch invalidation bumps, and the docs now call it a change epoch. A second counter would mean a second `useSyncExternalStore` in the hook for no difference in behavior. The merged Set is always a new `Set` instance, never mutated in place, so `isHotspot`'s identity changes and the consumers re-render.

## Security and privacy

- No new host, endpoint or route, and no request moved between components. The re-ask is the same `GET /map/hotspot-region` through the same transport. `PRIVACY_POLICY.md` describes this lookup without a count ("asks eBird which locations in the regions you have birded are public hotspots") and stays true.
- No new scan over user-file text. The region list is computed as before, and the merge is a `Set` union, linear in the ids returned.
- Auditor F1 (Informational, `security-report.md`), resolved by comment only, with no code change and no new test: the discarded `void retryRound(...)` in `armRetry` now carries the "cannot reject" claim at its definition site, under CLAUDE.md's Promise boundaries rule. The comment says why it cannot reject (askRegions absorbs every request failure, the synchronous transport path cannot throw on a REGION_RE code, both transports resolve an array or reject, and the one subscriber only schedules a render). It also says that a rejection or a request that never settles stops the schedule and can never loop.
- Both transports surface the 429 as `status: 429` (WebTransport `TransportError`; desktop `throwEbirdHttpError` through `ebirdRateLimitError`), so `isRateLimitError` classifies it the same way on all six targets. A desktop eBird 401 surfaces as 502, so it is not re-asked, which is correct.

## Tests (red first, by mutation)

New rows, eleven in `hotspotSet.test.ts` (mocked transport; three of them were added after QA, see below) and two in the new composed twin `hotspotSetRetry.test.tsx` (real transport, gate, network cache, `hotspotSet` and `useHotspotSet`; only `fetch` and the loaded backup faked; fake timers; assertions are request counts and rendered state, never elapsed time):

- `hotspotSet.test.ts`: a 5xx, a 401 and an offline failure are not re-asked (3 rows); only the rate-limited region is re-asked and the answered one keeps its ids; a key or file save during the wait, a new region list during the wait, and a save while the build is still asking each cancel the re-ask with no timer left (3 rows); a re-ask answer that started under an older build never lands on the newer one.
- `hotspotSetRetry.test.tsx`: 429 three times then 200, with a second region that answers. The build makes 3 requests for the limited region and 1 for the other. Round 1 makes 1 request no earlier than the recorded cooldown end, subscribers are notified once, and a mounted `HotspotLink` flips from plain to a link with no key or file save. The second row is the bound: 429 forever stops at 3 + 3x3 requests, with no timer left and the region plain.

Mutation table. The harness snapshotted the two source files once, applied each mutation from the snapshot after asserting exactly one match and a real difference, ran both suites, restored, and verified sha256 against the snapshot. The unmutated baseline is green (22 of 22).

| # | Mutation | Red rows |
|---|---|---|
| M0 | never arm a re-ask (the pre-fix behavior) | 4 (arrival, bound, limited-only, stale) |
| M1 | supersede does not clear the pending timer | 2 (both mid-wait supersession rows) |
| M2 | a superseded build still arms | 1 (save while the build is asking) |
| M3 | no generation check after a round asks | 1 (stale answer) |
| M4 | every failure is retry eligible | 3 (5xx, 401, offline) |
| M5 | re-ask every region, not only the limited | 1 (limited-only) |
| M6 | one round too many | 1 (bound) |
| M7 | merge announces but keeps the old cached Set | 2 (arrival, limited-only) |
| M8 | merge replaces the Set but does not announce | 1 (arrival) |
| M9 | a still-limited region is not re-armed | 1 (bound) |
| M10 | the hook ignores the change epoch | 1 (arrival) |

**Added after QA (`qa-report.md`, mutations T5, T6 and T9 green against the shipped rows).** The shipped rows pinned only regions that answered at BUILD time, and none answered 200 with an empty list. Three rows were added to `hotspotSet.test.ts`, test-only, with `hotspotSet.ts` byte-identical (sha256 checked before and after):
- **T9:** a genuine empty answer (200 with no hotspots) is an answer, so it is never re-asked.
- **T5:** a region that answers in a re-ask round is not asked again in a later round.
- **T6:** ids one re-ask round added are still there after a later round adds more.

T5 and T6 share one setup (two regions answering in rounds 1 and 2) but are separate rows, so each arm has its own row. Run from the same source snapshot, each mutation turned exactly its own row red: T9 (`limited: list.length === 0` on success), T5 (re-arm with `limited` instead of `still`), and T6 (re-arm with `base` instead of `merged`). The shipped code is green, 25 of 25 across both files.

M5 was GREEN on the first run, and the reason is recorded rather than dropped. In the composed suite, the answered region's reply sits in the 90 s network cache, and round 1 fires about 60 s after the build, so re-asking it inside round 1 costs no request and a request count cannot see the choice. Which regions a round asks is this module's own decision, so the row that pins it lives in the mocked suite, which sees the choice directly. It went red there, and the composed row's comment points to it.

Gates run: the new and extended files, `entryChunk.test.ts` (with and without `dist/`), `vitest related` over both changed modules (46 files, 864 tests), the gate, rate-limit, transport, path-set, HotspotLink and Targets suites, the full frontend suite (433 files and 9,271 tests passed, 6 skipped, all skips pre-existing), `npm run typecheck`, `npm run lint`, and `npm run build`. The built CSS gains no rule from the new comment or test words: every added word that names a selector in `dist/assets/index-*.css` was already in the HEAD corpus under `frontend/src`.
