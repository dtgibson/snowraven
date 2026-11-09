# Change Brief — ebird-store-hygiene

## What is changing
Four small pieces in one run. (1) The last two durable eBird stores, Projects (`checklist-projects-v1`, 365 days) and Recent activity (`hotspot-activity-v1`, 6 hours), read their TTL through `isWithinTtl`, so a stored time more than 24 hours ahead reads as due, at every reader that checks freshness, the store's own chokepoint and the two outside it. (2) The Statistics escapee pass reads the Clear counter before its first wait and releases a finished pass's stop token (idea 132ee3ce; 1.0.66 security I1, I3). (3) A malformed eBird checklist reply (an `obs` list holding a non-object item, or a 200 that is not JSON) fails with one verdict and fixed wording on both transports (idea 7908928e; 1.0.66 I2, D-10). (4) Life Lists' **Include Exotics** switch starts ON.

## Why now
Pieces 1 to 3 are the hygiene the 1.0.66 build (`ebird-request-economy`) recorded as open: CLAUDE.md and `security.md` name the two unwindowed stores, and I1, I2 and I3 were deferred as two saved ideas. Piece 4 is the user's own request, made at the same time. It is the reversal condition DECISIONS.md v1.0.63 recorded: "the default flips to on, one constant, if the user wants parity with eBird and Statistics."

## Scope
**1. TTL windows** (no Python twin: both stores live in the frontend on every transport, and `/map/hotspot-activity` is a pass-through route).
- `frontend/src/lib/checklistProjectsCache.ts` (~375, the chokepoint) and `frontend/src/lib/checklistProjects.ts` `buildTargetIds` (~204, the pending-mode skip that `useChecklistProjects.ts` calls).
- `frontend/src/lib/hotspotActivityCache.ts` (~233, the chokepoint) and `frontend/src/lib/useHotspotActivity.ts` (~369, the controller's own fresh/remainder split).
- Each read gets rows at exactly 24 h ahead (honoured) and 24 h plus 1 ms (due). Follow 1.0.66 D-12: call `isWithinTtl` with the store's constant where a suite mocks the store module. Display and the offline stale-serve stay as they are (D-11, D-12: the window decides only when to ask).
**2. Escapee pass** in `frontend/src/lib/useExoticProvenance.ts` (`runPass`, `gatedProvenance`; inside `security.md`'s gate). Read `provenancePurgeGeneration()` before `await loadSnapshot()` and check once right after `subscribe`. Settle the token in `finally` (`pass.stop()`) without changing the status already reported. Add a row that parks the load across a purge and asserts zero requests, reading first and parking after (`testing.md`, v1.0.62).
**3. Malformed reply parity** in `frontend/src/lib/tauri/checklistService.ts` and `backend/services/ebird.py` `fetch_checklist_species` (route `backend/routers/checklists.py` keeps its clauses). Each `obs` element must be a non-null object, and the decode joins the failed-answer path: desktop `{ status: 502 }`, web/Pi `ChecklistAnswerError`, with fixed text that is true for the shape. Rows for `[null]`, `[1]`, `["x"]` and a non-JSON body go in `frontend/src/lib/checklistProvenance.fixture.json`, with one verdict in `checklistProvenance.parity.test.ts` and `backend/tests/test_checklist_provenance_parity.py`. Before writing rows, measure which further shapes diverge (`obsAux`/`mediaCounts` elements; a non-object body under `fields=projects`). Bring each one in or record it (`security.md`, v1.0.29).
**4. Include Exotics on** in `frontend/src/components/lifeLists/LifeListsTab.tsx:89` (`useState(false)` to `true`). The switch is session-only, and `LifeListsTab.test.tsx` asserts no `setSetting`. Nothing is persisted, so the v1.0.19 migration rule does not apply. Every launch opens with Exotics on. Turning it off lasts the session and resets to on at relaunch. Include Escapees stays off. Update `LifeListsTab.test.tsx` ("start off..."), the Help passage (`docs/HELP.md` ~679, "both off by default" and "With both off...") with its guard `lifeListsPublishedClaims.test.ts:102`, and decide whether `STATUS_RESOLVED` in `lib/lifeListsCopy.ts` (pinned in `lifeListsCopy.test.ts`) still serves now that the default no longer reads lower than Statistics.
**Not changing:** store shapes, TTL lengths, the Clear registry, `EBIRD_GATED_PATHS`/`CACHED_GET_PATHS`, hosts and permits, the escapee join, any persisted setting.

## User-facing impact
- Projects and Recent activity re-ask an answer dated more than a day ahead of the device clock.
- The List Comparer shows the fixed "Could not fetch checklist" wording, never engine text, for these replies. The desktop app no longer reads a non-JSON reply as offline, and web/Pi's 400 for it becomes 502.
- Life Lists lists naturalized and provisional exotics by default.
- Held published copy (needs the user's yes): the privacy sentence "an answer already given is not re-checked for a year unless you press Check again" (`PRIVACY_POLICY.md` and `website/privacy.html`, pinned at `projectsPublishedClaims.test.ts:178`) gains a new re-ask cause. Rewording or dropping it is a held patch (`docs-and-website.md`, v1.0.66). HELP ~223 and ~387 are swept freely.
- `website/assets/shots/life-lists.webp` shows both switches off, beside the old status sentence: a recapture is a held decision, not part of this build.

## Design pass
Not needed: no visual change. The switch already draws both states. The Life Lists status sentence and the List Comparer error text are copy only.

## Decisions touched
- **v1.0.63 Life Lists, "Include Exotics is off by default":** REVERSED through its own recorded reversal condition. Sweep the matching sentence in `.claude/rules/bird-names.md` ("at its defaults it reads LOWER than the Statistics headline").
- **v1.0.66 D-03/D-12 (`isWithinTtl`):** EXTENDED to the last two stores. The "not yet windowed" sentences in CLAUDE.md (caching layers) and `security.md` go stale and must be updated.
- **v1.0.66 D-10 and security I1, I2, I3:** CLOSED. Mark ideas 132ee3ce and 7908928e done.
- **v1.0.66 D-11/D-12 (show and serve a due entry):** APPLIED unchanged. **v1.0.19 shipped-default migration:** NOT APPLICABLE (session-only switch). **v1.0.29 twinned-builder malformed-figure rule:** APPLIED. v1.0.67 and v1.0.68: none.

## What done looks like
- Both stores and both outside readers honour exactly 24 h ahead and treat one ms past it as due. A Clear parked across the pass's first load sends nothing, and a finished pass holds no ids. Every shared-fixture malformed shape gives one 502 verdict with fixed text on both transports. Life Lists opens with Include Exotics on.
- Gates: `npm run build` and eslint, plus the FULL vitest suite (word-pinned text moves). The backend parity suite runs in CI.
- Patch bump to 1.0.69 across the six-file set, with a `CHANGELOG.md` entry. The three Fastlane changelogs, What's New and the privacy rewording are prepared as HELD copy for the user's yes.
