## ebird-store-hygiene

### What this does

Four small pieces, as the approved change brief scoped them, shipping as 1.0.69.

1. **The last two eBird answer stores read their reuse period through the plausibility window.** Projects (`checklist-projects-v1`, a year) and Recent activity (`hotspot-activity-v1`, six hours) now treat an answer dated more than 24 hours ahead of the device's clock as due, at each store's fetch chokepoint and at the one reader outside each that checks freshness itself (`buildTargetIds`, and the Recent activity controller's fresh/remainder split). Display and the offline stale-serve are unchanged.
2. **The Statistics escapee pass reads the Clear counter before its first wait, and releases a finished pass's stop token** (1.0.66 security I1 and I3).
3. **A malformed eBird checklist reply fails with one verdict and fixed wording on both transports** (1.0.66 security I2, D-10). A body that is not JSON or not a JSON object fails in every mode; in the species modes, so does an observation that is not an object or whose species code is not text. Desktop: `{ status: 502 }` "Could not fetch checklist (HTTP 502)."; web/Pi: `ChecklistAnswerError`, a 502 with "Could not fetch checklist: eBird's answer could not be read". The breeding code and media counts are normalized the same way on both. The List Comparer shows the fixed wording.
4. **Life Lists' Include Exotics switch starts on** (the user's request, the reversal DECISIONS.md v1.0.63 recorded). Include Escapees stays off. Session-only, as before.

### How to test

1. `cd frontend && npx vitest run`: everything passes except the two `fastlaneMetadata.test.ts` rows that wait for the held F-Droid changelogs (see below).
2. `cd frontend && npm run build` and `npx eslint .`: clean.
3. `cd backend && .venv/bin/python -m pytest tests/ -q` and `.venv/bin/ruff check .`: clean.
4. The focused rows: `checklistProjectsCache.test.ts`, `checklistProjects.test.ts`, `hotspotActivityCache.test.ts`, `useHotspotActivity.test.ts` (the 24 h window), `useExoticProvenance.test.tsx` (the parked-load Clear and the token release), `checklistProvenance.parity.test.ts` with `backend/tests/test_checklist_provenance_parity.py` and `checklistProvenance.composedSeam.test.tsx` (malformed replies), `LifeListsTab.test.tsx` and `lifeListsPublishedClaims.test.ts` (the default).
5. Manually: open Life Lists and see Include Exotics on (the guide below).

### Notes for reviewer

**Guards red until the held patch applies.** Live tree, unpatched: 10,803 frontend tests pass and exactly two rows fail, both in `fastlaneMetadata.test.ts` ("has the same changelog under each per-processor code of the current version..." and its guard-the-guard), because the 1.0.69 changelog files are held published copy. In a scratch copy with `pipeline/ebird-store-hygiene/held/held.patch` applied, those two pass, along with `projectsPublishedClaims`, `privacyPageParity`, `fdroidRecipe`, `androidVersionSource`, `icloudKeysPublishedClaims`, `lifeListsPublishedClaims` and `hotspotSharePublishedClaims` (8 files, 139 tests). The full frontend suite in that patched copy: 10,784 passed and 2 failed, both artifacts of the copy, not the change: `BirdingStatsTaxonomyBatch.test.tsx` because Vite refuses to serve the copy's symlinked `node_modules` from outside its root, and `AlertsInboxSheet.test.tsx`'s Clear row, which passes when run alone (load-sensitive); both pass in the live tree. The copy skips 20 more rows than the live tree because it has no `frontend/dist`, so the post-build suites skip. `projectsPublishedClaims.test.ts` is green in the live tree because it still pins the unpatched privacy sentence; the patch moves the pin with the sentence.

**Piece 3, the divergence measurement** (security.md, v1.0.29: measure before writing rows). A 243-shape corpus was driven through both shipped paths: the desktop `getChecklist` under vitest with a real `Response` over each row's bytes, and the web/Pi route through `TestClient` with real `httpx.Response` objects.

| | HEAD | this change |
|---|---|---|
| shapes where the verdicts differ | 110 | 14 |
| of those, by status | 77 | 3 |
| desktop status-less errors (read as offline) | 38 | 0 |
| web/Pi 400 carrying decoder or `int()` text | 19 | 0 |
| web/Pi 500 | 2 | 0 |

Brought in beyond the brief's four rows, each measured divergent: a non-object body under `fields=projects` (desktop threw a status-less TypeError for `null`, which stops the Projects sweep as "offline", and answered a list body as "no projects", kept for a year); a `speciesCode` that is not text (web/Pi 500 for a list); `obsAux` and `mediaCounts` of the wrong container or value type (desktop TypeErrors, web/Pi 502s and a 400 from `int("x")`); and the decode itself (`NaN`/`Infinity`, UTF-16, invalid UTF-8). Recorded, not brought in, all outside the piece: `howManyStr: null`, a falsy non-string `comments`, an object `locName` (an empty one differs between the twins; a non-empty one passes through both and would throw as a React child, an availability edge on a hostile reply, security report I2, inboxed), a JSON integer longer than 4,300 digits (refused on web/Pi only, the safe direction, I1), and `projectIds: [1050.0]` (the Projects normalizer pair; desktop keeps 1050, web/Pi drops it). The 3 remaining status differences are one shape, two leading byte-order marks, where Node's undici (the test runner) strips both and the Fetch spec, and so every WebView, strips one, as Python now does. Detail in `decisions.md` D-01.

**The new scans and their cost** (security.md): the `obs` item check reads each item once with constant work; the `obsAux` search reads each entry of one observation once; so the pass is linear in the body's size and dominated by the platform decode that precedes it, which is pre-existing and already linear. No regex runs over the body. Nothing caps the body's size or read time on either transport (pre-existing): the desktop `tauriFetch` clears its 10 s timer once the headers arrive, and httpx's `timeout=10.0` limits each connect and each socket read, not the whole body, so the bound is the decode's own (security report L1). The Python decode (`_decode_answer`) mirrors the WebView's `Response.json()`: `decode("utf-8-sig", errors="replace")` matched the WHATWG decoder on 7,695 byte sequences, and with `NaN`/`Infinity` refused through `parse_constant`, `json.loads` accepted exactly what `JSON.parse` accepted on 48 grammar cases. Error text is fixed on both sides; nothing from the body, URL or key reaches it.

**Wording change on web/Pi.** The 1.0.66 detail "eBird's answer had no observation list" becomes "eBird's answer could not be read" for every refused body (one wording, true for each shape). A body that is not JSON is now a 502 where it was a 400. The route's clauses are unchanged; only its comment moved.

**Behavior change on web/Pi for malformed media counts only:** `"3"` was 3 and is 0, `1.5` was 1 and is 0, `True` was 1 and is 0; on desktop, a breeding entry whose `value` is empty now falls back to its `auxCode`, as web/Pi always did.

**Test fakes.** The three backend checklist suites now fake the checklist body with real JSON bytes (`resp.content`), because the service decodes the bytes itself rather than calling `resp.json()`.

**Mutation checks.** Each TTL reader reverted alone turns only its own rows red, across all four readers' suites (the activity chokepoint's two rows, one row for each other reader); the Recent activity controller's row reads the controller's split through a no-key pass, which never reaches the store's chokepoint, so the chokepoint's reversion does not redden it; each half of the I1 fix reverted alone turns the parked-load row red; the I3 release deleted or commented out turns its source row red; 13 mutants over the twinned refusal, decode and normalizers each turn only their own side's parity suite red; the Include Exotics default reverted turns the tab row red.

**Convention text.** `.claude/rules/security.md` (the "not yet windowed" sentence, and its path gate now covers `checklistProjects.ts`, `useChecklistProjects.ts`, `useHotspotActivity.ts`) and `.claude/rules/bird-names.md` (the Life Lists defaults) are updated. CLAUDE.md's caching-layers paragraph still ends "(v1.0.66; `checklist-projects-v1` and `hotspot-activity-v1` are not yet windowed)", which is false once this lands; this stage did not edit CLAUDE.md, and hands the replacement to the Chronicler: "(v1.0.66; the last two, `checklist-projects-v1` and `hotspot-activity-v1`, since v1.0.69)".

**Left to the Deployer.** The recipe's three `commit:` lines stay on 1.0.68's `93c10733` until the v1.0.69 tag exists. The iOS plist stamp is written by `tauri ios build` during the iOS leg (as `ae9260d8` did for 1.0.68). The held patch applies only on the user's yes.

**Known limitations.** The four recorded divergences above. I1 is not reachable from any shipped path (a pass only starts with the store loaded), so its row reaches the state through the store's test seam. The Life Lists website screenshot still shows both switches off; recapturing it is its own held decision.

## Seeing ebird-store-hygiene locally

Most of this change is checked by the tests above. The one thing you can see is the Life Lists default.

1. Open a terminal in your project folder.

2. Start the backend:
   `cd backend && .venv/bin/uvicorn main:app --reload --port 1620`

3. Open a second terminal in the project folder and start the app:
   `cd frontend && npm run dev`

4. Open your browser and go to:
   http://localhost:5173

5. Click **Life Lists** in the sidebar (on a narrow window, open **More** and choose Life Lists).

6. What to look for: in the controls at the top of the tab, **Include Exotics** is switched on and **Include Escapees** is off. Birds eBird marks naturalized or provisional on your checklists are in the list. Switch Include Exotics off and they leave the list; reload the page and it is on again.

7. If the Statistics tab's escapee check has finished for your backup, the line under the switches reads "Escapee and exotic status comes from the exotic status check on Statistics, so with Include Exotics off this list can be shorter than the Statistics species figure."

## Convention Flags

- A twinned decoder of an upstream body is measured against the platform's own decode, not a stand-in: the desktop half drives a real `Response` over the body's bytes and the web/Pi half a real `httpx.Response`, and the Python side decodes the bytes the way the Fetch spec does (UTF-8 with replacement after one BOM, NaN and Infinity refused), so "is this JSON" has one answer on both transports.
- A parity fixture row whose body is not JSON carries it as `text` (sent as UTF-8) or `hex` (exact bytes), never as a literal invisible character in the fixture file.
- An upstream sub-field that only feeds display (breeding code, media counts) is normalized to absent on both twins when its shape is wrong; a structural shape (the body, the observation list, an observation, its species code) fails the answer.
