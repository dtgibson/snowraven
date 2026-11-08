## eBird request economy (1.0.66)

### What this does

The Statistics tab's escapee check and the List Comparer's two checklist lookups now go through the shared eBird gate, so they keep the app's one 150 ms start spacing, honor the one key-wide 429 cooldown, and retry a rate-limited checklist up to twice instead of failing it; a call still waiting when Stop is pressed or the eBird backup is cleared is never sent. A successful eBird checklist answer with no observation list is now a failed answer on both transports (it used to stamp every carried species "not in eBird's answer" for 30 days), and a saved answer or mark dated more than 24 hours ahead of the clock reads as due in the escapee, hotspot-region and county-completeness stores. The privacy-policy retention corrections, their guards, What's New and the F-Droid text are held for the user's yes.

### How to test

1. From `frontend/`: `npx vitest run`. Expect 10,740 passed, 6 skipped, and exactly two red rows, both in `src/lib/fastlaneMetadata.test.ts`, each naming the three not-yet-written `10000661/2/4.txt` changelogs (held published copy). Nothing else is red.
2. The rows this change adds, on their own: `npx vitest run src/lib/ttlWindow.test.ts src/lib/useExoticProvenance.test.tsx src/components/ChecklistComparer.test.tsx src/lib/exoticProvenanceCache.test.ts src/lib/checklistProvenance.parity.test.ts src/lib/hotspotRegionCache.test.ts src/lib/countyCompletenessCache.test.ts src/lib/useCountyCompleteness.test.ts src/components/targets/Targets.test.tsx src/lib/exoticProvenanceConvergence.test.tsx src/lib/entryChunk.test.ts`
3. `npm run typecheck` and `npm run build` from `frontend/` (the build's "chunks larger than 1100 kB" note is the usual counties and taxonomy one).
4. From `backend/`: `.venv/bin/python -m pytest tests/ -v` (2,079 passed), including `tests/test_checklist_provenance_parity.py`'s whole-body rows through the shipped route.
5. `bash pipeline/ebird-request-economy/bump-1.0.66.sh` (check mode, writes nothing): the stamped set reads 1.0.66 and every held item reads "not applied".
6. Optional, by hand with your own key (agents sent nothing to eBird): open Statistics with a cold escapee check and watch its progress line count up a little more evenly than before; on List Comparer, compare two checklists as usual.

### Notes for reviewer

- **One enforcement point per request.** `/checklists/` stays out of `EBIRD_GATED_PATHS`; its three callers (Projects sweep, escapee check, List Comparer) each wrap their own call in `gatedEbirdCall`. `transport.ts` and `ebirdGate.ts` now say so. No pass-scale layer for the escapee pass (D-01, with its reversal condition).
- **Stop and Clear while waiting (D-07 to D-09).** Stop is a per-pass token, checked inside the gated call on every attempt; Stop also ends a wait at once, and a request already on the wire is let finish and its answer kept, but the pass never waits out a cooldown or retry after it: a 429 on that request ends the call as not sent (D-18). A Clear stops the pass through the store's purge counter (`provenancePurgeGeneration()`). The chokepoint takes a loader that resolves `null` for "not sent": nothing is merged or stamped, and the pass counts it as neither done nor failed. Cost: a start slot taken by a call that then sends nothing.
- **D-02's reachability correction holds**: web/Pi could produce the shape too. The refusal is a type test on both sides, runs before the location-name request, and uses each transport's existing 502 clause and wording; `fields=projects` and `obs: []` are unchanged. Not changed, for the Auditor: an `obs` list holding a non-object element (`[null]`) still fails differently on the two transports (D-10).
- **D-03 scope (D-12).** Every TTL read in the three stores, plus the two completeness readers that check freshness themselves (`useCountyCompleteness`, `useTargetsPool`). Classification and the offline "Showing the check from" date are not windowed (D-11). `checklist-projects-v1` and `hotspot-activity-v1` are the same class and deliberately not in this bundle.
- **Version 1.0.66, not 1.0.65 (D-13)**: 1.0.65 shipped today from another worktree. Five files of the six-file set are written; the three F-Droid changelogs are held. The recipe's `commit:` lines stay on 1.0.65's `d7444330` until the v1.0.66 tag exists.
- **Held privacy item 2 is reworded from the brief (D-14)**: its "only" list needed the future-dated member this release adds, and "a region with no stored answer" is what the code tests. Item 1 is the brief's wording; item 3 is offered.
- **`docs/HELP.md`**: one sentence corrected (the same retention over-claim as privacy item 1, D-15). No in-app string changed.
- `exoticProvenanceConvergence.test.tsx` now zeroes the spacing seam per module graph (33 s to 3.3 s; still 29, 8, 0, 0).

## Seeing it locally (a record)

This run was hands-off, so this is a record of what was checked, not a walkthrough to follow.

- **What was verified, and how:** every behavior above by automated tests on a fake clock or through the shipped transport code with the network faked (the full frontend suite, the backend suite, typecheck, build). No request was sent to eBird from this Mac, by rule.
- **What the app looks like after it:** no screen changes. To look anyway: `cd backend && uvicorn main:app --reload --port 1620` and `cd frontend && npm run dev`, then http://localhost:5173 (or `npm run desktop:dev` for the Mac app).
  - **Statistics:** the escapee line under the Species figure behaves as before, and a cold check on a large export takes about a second longer (at least 11 s for 73 checklists). Stop during the check ends it promptly, and nothing more is sent.
  - **List Comparer:** comparing two checklists behaves as before. If eBird is rate limiting the key, the press waits and retries before showing "eBird is limiting requests right now. Try again in a moment."
- **Not checkable locally:** the 429 path and the "no observation list" body need eBird to send them. The tests stand in for both.

## Convention Flags

- A caller of an eBird-backed path that is not in `EBIRD_GATED_PATHS` (any `/checklists/{id}` caller) wraps its own call in `gatedEbirdCall`, the Projects sweep's shape. A new caller of that path does the same, or it sends outside the shared spacing and cooldown.
- A TTL read of a durable eBird-answer store goes through `isWithinTtl` (`lib/ttlWindow.ts`), never `now - storedAt < ttl`, so a stored time more than 24 hours ahead reads as due. That includes a reader outside the store that checks freshness itself.
- A pass whose calls can wait at the gate owns a per-pass stop token checked inside the gated call, never a shared flag the next pass resets. "Not sent" is its own outcome at the store's chokepoint (the loader resolves `null`), neither an answer nor a failure.
- A suite that drives an eBird pass in a fresh module graph (`vi.resetModules`) zeroes the spacing seam in that graph, or it runs the real 150 ms floor and drifts toward its timeout.

## Known limitations

- An `obs` list holding a non-object element still fails differently on the two transports (desktop: a status-less TypeError; web/Pi: a 502). Pre-existing, outside D-02's boundary (D-10).
- `checklist-projects-v1` (365 days) and `hotspot-activity-v1` (6 hours) carry the same future-dated-time class and are not windowed here (D-03).
- The Weather and tide lookups by checklist stay ungated, and an eBird 429 there still reads as a 502 (brief row C, deferred).
- On web/Pi the gate is browser state, so two open tabs pace separately against one key (brief row I).
- Offline, the escapee check's "Showing the check from" date can show a future date after a clock fault until the next online pass (D-11).
