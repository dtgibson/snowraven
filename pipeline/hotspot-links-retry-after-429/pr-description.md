## hotspot-links-retry-after-429

### What this does
When eBird answers 429 to a state's hotspot lookup (`GET /map/hotspot-region`) on every attempt the shared gate allows, that state used to be cached as an empty list for the whole session, so its public hotspots rendered as plain text on every tab until a key or file save or a restart. `hotspotSet.ts` now records that state as unanswered rather than empty and asks eBird again for only the rate-limited states, in 3 rounds spaced 1, 2 and 4 minutes apart, each through the normal transport and gate. When a round answers, the merged Set replaces the cached one and the existing change epoch notifies every mounted `useHotspotSet`, so the links appear with no key or file save.

### How to test
1. `cd frontend && npx vitest run src/lib/hotspotSet.test.ts src/lib/hotspotSetRetry.test.tsx src/lib/useHotspotSet.test.tsx`
2. `hotspotSetRetry.test.tsx` is the composed twin: real transport, gate, network cache, `hotspotSet` and `useHotspotSet`, with only `fetch` and the loaded backup faked. Its first row shows a `HotspotLink` flip from plain to a link on its own after a 429 run-out. Its second row is the request-count bound.
3. `npx vitest run src/lib/entryChunk.test.ts` stays green (no new module on the entry graph).
4. A live check needs eBird to answer 429, which cannot be arranged on demand. The tests are the demonstration (see `how-to-see.md`).

### Notes for reviewer
- **Scope is 429 only**, per the bug brief. Offline, 5xx and a missing or bad key keep today's behavior (plain until a key or file save). The widening condition and the one-line widening are in `decisions.md`.
- **Bound:** at most `1 + ACTIVITY_RATE_LIMIT_RETRIES` requests per limited state per round, over `HOTSPOT_RETRY_ROUNDS` (3) rounds. That is 9 beyond the build's own 3 per state per build, stated in the module header and asserted as a fetch count with no timer left pending.
- **Gate policy is untouched.** The schedule is the pass's own layer in `hotspotSet.ts`. The guarantee that no re-ask starts inside a cooldown is the gate's, since every re-ask goes through `transport.get`. The 60 s first spacing is merely no shorter than the longest cooldown the gate opens. A 429 is still never cached anywhere.
- **Supersession:** `invalidateHotspotSet` (Settings' eBird key or file save or delete, and both iCloud paths) and a new region list bump a generation and clear the one pending timer. A round already asking re-checks the generation after its answer lands, so a stale answer never merges into a newer build. Each guard has its own row.
- **No new arrival counter.** The re-ask bumps the same epoch invalidation bumps. The only subscriber is `useHotspotSet`, whose reload is a cache hit. `useHotspotSet.ts` changes only in its doc comment.
- Every new row was mutation-checked red first. The 11-mutation table is in `decisions.md`, including why one mutation was invisible to a request count through the real network cache and where it is pinned instead.
- No version bump, no `CHANGELOG.md` edit (the proposed line is in `changelog-line.md`), and no website, README, App Store, privacy or Help change.

🤖 Generated with [Claude Code](https://claude.com/claude-code)
