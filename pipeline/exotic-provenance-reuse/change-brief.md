# Change Brief — Exotic provenance reuse

## What is changing
The Statistics escapee check already saves its answers for 30 days (`exotic-provenance-v1`: a checklist ledger, a species index, the two published lists). The repeat traffic comes from something else: the pass never settles. When a species in the export is missing from every eBird answer the app has, the v1.0.1 repair (`carriersNeedingRefetch`) reopens its checklists that are already saved, and it does this on every pass, up to 1 + 25 requests per species. On the real export that comes to 29 requests per load: Willet 26, Marsh Wren 2, Eurasian Skylark 1 (D-01, D-02). The fix keeps one more fact in the same document: "eBird answered this checklist and the species was not in the answer", with a 30-day timestamp. That repair then reopens a species at most once per 30 days. Unconsulted carriers stay askable, so the pass settles and later loads ask nothing (D-03). The status line stops claiming "checked" while species are still open (D-04).

## Scope (files)
Changes: `frontend/src/lib/exoticProvenanceCache.ts` (new optional field: validate, merge, purge, snapshot), `exoticProvenance.ts` (`carriersNeedingRefetch` honours the stamp), `useExoticProvenance.ts` (stamp intent, auto-start skip, status), `exoticCopy.ts` (one in-app sentence), their tests, `settingsRouteBudget.test.ts`. Also the patch version bump (six-file set, D-08) and `docs/HELP.md` only if the new status needs a word.
Unchanged: the backend, `lib/tauri/checklistService.ts`, `transport.ts` (`/checklists/` stays out of `CACHED_GET_PATHS`), `clearDerived.ts` (no new row), the passive readers (`useProvenanceLookup.ts`, `lifeListsProvenance.ts`), classification (`classifySpecies`, `isExoticOnly`, `remainingSpecies`), `PRIVACY_POLICY.md`, `website/`, `README.md`, the Tauri CSP and http permit.

## Why now
Saved idea `ee37343c` from the 1.0.62 run. The Tester's browser probes sent 733 checklist requests through the preview's key and got 231 rate-limit refusals (429), and an A/B test measured "the same 29 per load". The idea assumed the answers were never kept. They are kept. The pass keeps reopening its own saved answers (measured offline, D-01). The same export is on the user's desktop app, so every launch re-asks too. It also makes two published sentences false: the privacy policy says "returning to the tab does not repeat the requests", and Help says "a later visit re-checks only checklists it has not seen before". This is closer to a fix than routine upkeep.

## User-facing impact
Statistics headline numbers, both published lists, Life Lists, Species Detail and the Calendar: unchanged. The three species are still unresolved, and unresolved species still count. The status line: today every load ends with "Stopped following up on 3 species after 25 checklists each." Once the check settles, a load runs no pass. It then shows one new partial sentence in the existing style saying eBird's answers did not include those species, so they still count, with Check again kept as the only way to re-ask (D-04). The progress bar no longer runs on every visit.

## Design pass
Not needed: nothing visual changes. Same line, same button, same layout. The one new status sentence is in-app copy in the existing partial-state voice, which this repo writes without a review stop.

## Decisions touched
- v1.0.1 "a ledger entry never stands for a recordless species": MODIFIED. Its premise ("that shape can only mean ... a cover that could not admit the species"; "one refetch heals ... permanently") is measured false for a post-split export and for an answer that lacks the species. The repair stays, limited to once per species per 30 days (D-02).
- v0.5.87 escapee document: EXTENDED with one optional field. The ledger's first-in-first-out eviction, the species index's fill-then-stop admission, "unresolved counts", Statistics as the only initiator and the OQ-04 30-day TTL all stand.
- v1.0.14 Clear registry: APPLIED. The store is already registered, so no new row and no held privacy sentence (D-05). v1.0.57 route cap: APPLIED, worst case re-proven. v1.0.63 Life Lists completion: relied on; Statistics' status must agree with it (D-04).
- v0.5.92 pacing contract: not changed. Finding: `/checklists/` sits outside the eBird gate, a separate follow-up (D-06).

## What done looks like
- On a fixture of the measured shape (export names resolving to a code eBird's answers never carry), consecutive loads with a persisted document issue 29, at most 8, then 0, then 0 checklist requests. Today it is 29 every load. Any load whose open species are all settled within the TTL sends no `/checklists/` request, under both the Tauri and web/Pi storage seams.
- After Clear, the pass asks again. A failed, 429 or offline answer writes no stamp. A stamp past its TTL reopens a species once. The v1.0.1 domestic-form repair rows stay green.
- The full vitest suite and `npm run build` pass. Shipped as patch 1.0.64; What's New and the F-Droid text are held for the user's yes.
