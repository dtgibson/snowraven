# Decisions: ebird-request-economy (Improve lane, Stage 1)

The Evaluator's scoping record. The brief is `change-brief.md`. Every figure here was read from the code or from a recorded measurement (named where it is used); nothing was sent to eBird to scope this.

## D-01 How the escapee pass and the List Comparer join the gate

- **Wrap the loader, the Projects-sweep shape** (`useChecklistProjects.ts:430`, `() => gatedEbirdCall(() => fetchProjects(id))`). In the pass that is the loader handed to `dedupedFetchChecklist`, so an in-flight join never takes a second start slot and a saved answer never waits. `/checklists/` does NOT join `EBIRD_GATED_PATHS`: the sets match with an exact `Set.has`, which an id path cannot satisfy, and the Projects sweep already enforces on that path, so a transport gate would double-space it.
- **Both transports already surface a 429 as a 429 on this route** (`tauri/checklistService.ts` via `ebirdRateLimitError`; `backend/routers/checklists.py` via `ebird_rate_limit_exception`), so the gate's retry and cooldown work with no seam change.
- **The pool of four stays, as a latency ceiling; the gate's spacing is the governor** (the v0.5.92 activity precedent). Cold cost on the reference export: 73 requests, measured 9.7 s four-wide (v0.5.87), floor 73 x 150 ms = 11.0 s gated. The pass now shares spacing with the tab's own `/map/hotspot-region` lookups, which is the point.
- **A call waiting in the gate is checked again before it is sent.** Today Stop only stops new picks and the in-flight window is one request long; behind a cooldown a picked call can wait up to 60 s. So inside the gated call, before the request: if Stop was pressed, or a Clear has moved the store's purge generation since the call was picked, send nothing, and count the call as neither done nor failed. The generation capture itself stays where it is, at the fetch chokepoint before the wait (v1.0.40). Sending a checklist ID the user has just cleared is the case this closes. The Engineer picks the mechanism (an exported generation read, or the store's chokepoint accepting a pre-start check).
- **No pass-scale layer** (`sweepSpacingMs`, the three-wave pause, v1.0.8). That layer exists for a sweep of thousands of requests that re-trips the limiter about once a minute. A real escapee pass is about 73 requests (about 11 s), a settled load sends none since 1.0.64, and the 500-request cap is a pathological bound. **Reversal:** a measured real pass over about a minute, or more than one 429 wave within one pass on real data; the layer then rides in the controller over `waveCount`, exactly as the sweep's does.
- After retries a 429 is still a failed checklist and keeps today's `failures` partial and Check again. Suites that drive the pass reset the gate and zero the spacing seam as the Projects suites do; the convergence row stays `[29, 8, 0, 0]`.
- **List Comparer:** the same wrap on its two calls (`ChecklistComparer.tsx:251-252`). After retries its existing error display shows the shared rate-limit sentence.

## D-02 The "answer with no observation list" shape is reachable on web/Pi too

The idea (`fad789d8`) and the 1.0.64 audit's I1 say the self-hosted version always gets a list, so only the apps can produce it. Read end to end, both transports deliver the same thing:
- **web/Pi:** `fetch_checklist_species` iterates `(data.get("obs") or [])` (`backend/services/ebird.py`), so a 200 with no `obs` yields no rows, and the route always returns a `species` list, here an empty one (`routers/checklists.py`).
- **apps:** `getChecklist` iterates `(data.obs ?? [])` (`tauri/checklistService.ts:197`) and returns an empty `species`.
- **both:** the controller reads `Array.isArray(res?.species) ? res.species : []` (`useExoticProvenance.ts:157`), the merge sees an answer with no rows, and every carried cover code is stamped for 30 days.

"Always gets a list" is exactly the problem, not the protection. So the fix is twinned:
- **In the species-reading modes (no `fields`, and `provenance`), an `obs` that is absent, null or not a list is a failed answer:** a 502 through each transport's existing generic clause and wording. No ledger entry is written and no stamp.
- **`fields=projects` is untouched.** It skips the species and must keep working on such a body.
- **`obs: []` is still an answer and still stamps**, per the v1.0.64 rule that an answer lacking what was asked for is an answer.
- The controller also treats a non-array `species` as failed (one line, defense in depth).
- Rows go in the shared `checklistProvenance.fixture.json` for absent, null, an object and an empty list, asserted with the same verdict in both parity suites.
- Consequence outside Statistics: the List Comparer tab shows its existing fetch-failure state for such a body instead of an empty checklist. That is more honest, and no such body has ever been observed.

## D-03 The plausibility window, and where it applies

- **Direction:** a time more than 24 hours ahead of the reader's clock reads as absent. That is option (b) of the 1.0.64 audit's L1, the window the iCloud records use (`MAX_FUTURE_MS`, v1.0.12). The value is shared through a small module outside `lib/icloud/`, so no iCloud code joins the Statistics or Map graphs. It fails toward one bounded re-ask, whose answer rewrites the time at the corrected clock. Nothing is written back on read. A negative or ancient time already reads as expired, and a row says so.
- **Applied at every TTL read:** in the escapee store, `consultedSet`, `isFreshFor`, `staleOrUnconsulted` and `unmatchedSet` (ledger entries and stamps alike, since both honour a future time today); in `hotspotRegionCache.ts`, `isRegionEntryDue`; in `countyCompletenessCache.ts`, its TTL read. Each store gets rows at exactly now + 24 h (honoured) and just past it (absent or due).
- **Not applied to classification.** `rebuildSnapshot` puts every ledger entry in `snapshot.checklists` whatever its age, so an answer's content counts however it is dated, as today. The offline label (`lastConsultedAt`) would show a future date; whether to clamp it is the Engineer's call.
- **`ea73086e` is folded in by default,** because the v1.0.64 record says one change should close all three stores. If the user drops it at the gate, the two stores' rows leave and the shared predicate stays.
- **The same class, not in this bundle:** `checklist-projects-v1` (365 days) and `hotspot-activity-v1` (6 hours). Recorded for the Chronicler.

## D-04 The facts behind the held sentences

**What is on disk:**
- **Escapee answers are kept, and used, past 30 days.** `rebuildSnapshot` builds `snapshot.checklists` from all of `order`. Species records are fill-then-stop and never age out. The ledger is first-in-first-out at 131,072 entries. The 30 days governs only when a checklist may be asked again, which makes "stored on your device for 30 days" a statement of the reuse window, not the retention (v1.0.42 rule).
- **Region answers past the TTL stay and are still served** (`hotspotRegionCache.ts` header and `isRegionEntryDue`). They are evicted only by the 512-region cap or the payload budget, oldest first.
- **Hotspot-activity answers are not on the Clear path** (`clearDerived.ts` excludes `hotspot-activity-v1`). So held item 3 says "kept on your device" with no "until you clear".

**Two edges for the Auditor to weigh on held item 1.** Neither is "returning to the tab", and both predate this wording:
- Check again re-asks within 30 days.
- A newer export that names a new species on an already-asked checklist re-asks that checklist once (the v1.0.1 heal).

"May ask for it again" is chosen so the sentence promises no re-ask schedule.

**Guards:**
- No guard pins the escapee sentence today (grep over `frontend/src`, `website`, `docs`).
- `hotspotSharePublishedClaims.test.ts` pins the region sentence's opening words and builds "30 days" from `HOTSPOT_REGION_TTL_MS`. The held patch moves both pins and adds an escapee row built from `PROVENANCE_TTL_MS`.

## D-05 The iCloud question is New Feature work, deferred

Syncing any of these stores puts new data in the ubiquity container. It needs a new item kind (`ITEM_SUBDIRS` and its Rust twin) and a document of its own, because the native push reads a whole local file and four of the stores live inside `settings.json`. It also needs merge semantics a schema should own, a Remove path, a Copy iCloud details line, privacy sentences, and checks only the user can run on signed-in devices. By the branch rules that is new persistence needing schema discipline, so it is not this run.

**Ranked for a later run:**
1. **Projects answers.** About 3,300 requests per extra device per sweep year on the reference export, a clean raw-field merge, but a user-visible change: a second device shows answers it never asked for.
2. **Escapee answers.** Small saving and the riskiest merge.
3. **Hotspot regions and county species lists.** Public eBird data, tens of requests a month; v1.0.62's "not synced" stands.

ROADMAP's existing item carries this ranking.

## D-06 Release

A shipped behaviour change, so a **patch bump to 1.0.65** (unless a parallel ship takes it first), with the six-file set and the all-platforms rhythm. At the last ledger read, 1.0.64's App Store record `ab6360bc` was `WAITING_FOR_REVIEW` as `740963c6`. So the Deployer reads App Store Connect at the ship and writes 1.0.65's disposition in `RELEASE_LEDGER.md` (its own record, a deferral behind 1.0.64, or a rollup). What's New, the F-Droid text and the privacy patch are held for the user's yes. The website change outside the privacy page is the version pill and footer only.

---

# Engineer's decisions (Stage 2)

The Engineer's implementation record, numbered on from the Evaluator's. Every D-number cited in this run's code resolves here or above. Nothing was sent to eBird: every check is a test, a build or a read of the code.

## D-07 Stop is a per-pass token, not a shared flag

The old `cancelRef` was one boolean the next pass reset to false. Behind the gate a call from a stopped pass can still be waiting for its start slot when Check again starts a new pass, and a reset shared flag would let that call send. So each pass owns a `PassStop` (`stopped`, a `signal` promise that settles on stop, `stop()`), created when the pass starts and held in `passRef`; the Stop button stops only the current pass's token. A finished pass's token stays spent, and a press before any pass ran has nothing to stop, as before.

## D-08 A Clear supersedes the whole pass

D-01 left the mechanism to the Engineer: "an exported generation read, or the store's chokepoint accepting a pre-start check". Chosen: the generation read. `exoticProvenanceCache.ts` exports `provenancePurgeGeneration()` (read-only; the controller is its only reader). The pass captures it once `loadSnapshot()` has resolved and subscribes to the store; the purge rebuilds the snapshot, which notifies subscribers synchronously, so the pass's token is stopped before any waiting call can reach its start slot, and nothing more is picked. The capture at the fetch chokepoint (`dedupedFetchChecklist`'s `gen`, before the wait, v1.0.40) is unchanged and still refuses a merge that a Clear overtook. Why the pass and not the call: the cover was planned from the export being deleted, so after a Clear none of its remaining picks is wanted. The other option, a pre-start hook on the chokepoint, would have put controller policy into the store.

## D-09 What "checked again when its start slot comes up" means, exactly

`gatedProvenance` (in `useExoticProvenance.ts`) is the loader handed to `dedupedFetchChecklist`, so a saved answer never waits and a joiner never takes a second slot (D-01). Inside `gatedEbirdCall`, the call checks `pass.stopped` first, on every attempt, retries included; if stopped it sends nothing and throws a private sentinel the gate passes through unchanged (it is not a 429). The loader resolves `null` for that, and the chokepoint reports `{ fromNetwork: false, notSent: true }`, to a joiner as well, writing no ledger entry and no stamp. The pass counts a not-sent call as neither done nor failed. Stop also ends a wait at once (the loader races the token's signal), so the pass reports itself stopped without sitting out a cooldown of up to 60 s, while a request already on the wire is let finish and its answer kept (it was paid for). Only that attempt is waited for, never a cooldown or a retry after it (D-18). Stated cost: the start slot a waiting call takes and then does not use is 150 ms of spacing spent on no request, at most once per waiting call, once per Stop or Clear.

## D-10 How the "no observation list" refusal is built on each transport (D-02)

- **A type test, never truthiness, on both sides:** the body is an object (a dict) and its `obs` is an array (a list). `hasObservationList` in `lib/tauri/checklistService.ts`, `_has_observation_list` in `backend/services/ebird.py`. Python's `data.get("obs") or []` had turned `{}`, `""`, `0` and `False` into an empty answer; the fixture carries a row for each (the security rule that a twinned presence check is a type test).
- **Before either follow-up request:** the check runs right after the body is parsed, so a refused body costs one request and never reaches the location-name lookup or the taxonomy (both parity suites assert it).
- **Through each transport's existing generic clause and wording:** desktop throws `{ status: 502 }` "Could not fetch checklist (HTTP 502)." (the `!res.ok` shape); web/Pi raises `ChecklistAnswerError`, deliberately not a `ValueError` or `LookupError` (which the route maps to 400 and 404), so it falls to the route's generic `except Exception` and becomes 502 "Could not fetch checklist: eBird's answer had no observation list". The List Comparer shows that detail. Neither message carries a URL or the key.
- **`fields=projects` is untouched** (two fixture rows: absent and non-list `obs` both still answer, `species: []`), and `obs: []` still answers and still stamps.
- **The controller's own guard** (a 200 whose `species` is not an array) throws with `status: 502`, so `isOfflineError` never reads it as no connection.
- **D-02's reachability correction stands as the Evaluator wrote it.** Read from the code, and confirmed by the answer-body rows going red with the refusal removed: before the change, an `obs` that was absent, null, an empty object, an empty string, zero or false produced an empty 200 answer through the shipped web/Pi route (`or []`), and an absent or null `obs` did through the shipped desktop service (`?? []`), where the other non-list shapes, and a null body, threw a status-less TypeError instead (a third verdict, which `isOfflineError` can read as no connection). All of them are now the same 502 on both.
- **Not changed, flagged for the Auditor:** an `obs` LIST holding a non-object element (`[null]`) still throws differently on the two transports (desktop: a status-less TypeError from `.filter(o => o.speciesCode)`; web/Pi: a 502 through the generic clause). Pre-existing and outside D-02's boundary, which is about `obs` itself. On desktop a status-less error is one the escapee pass counts as a failed checklist, but `isOfflineError` may read it as offline where the List Comparer classifies it. A one-line element guard on each side would close it; it is its own change.

## D-11 The offline label is not clamped

D-03 left the offline label's future date to the Engineer. `lastConsultedAt()` reports the newest ledger time as stored, unclamped: offline, no re-ask can correct the time, and "Showing the check from {date}" states the date the stored check carries rather than one the app made up. The case needs a clock that ran more than a day ahead when the answer was stored and the device offline after it was corrected; the label then shows the future date until the next online pass rewrites it.

## D-12 Where the window is read, and how the completeness readers call it (D-03)

- **One predicate, `isWithinTtl(storedAtMs, nowMs, ttlMs)`, in `lib/ttlWindow.ts`:** honoured exactly when `now - ttl < storedAt <= now + 24 h`, so exactly 24 h ahead is honoured, one millisecond past is not, the TTL edge is unchanged, and a non-finite time is never honoured. Its suite measures the replacement's symmetric difference over a generated corpus in both directions: newly absent is exactly "more than 24 h ahead", newly honoured is empty (testing.md, v1.0.32). The 24 h is declared again rather than imported from `lib/icloud/icloudRecord.ts`, so no iCloud code joins the Statistics or Map graphs, and the suite compares the two declarations. It imports nothing (a source row says so) because `hotspotRegionCache.ts` rides the entry chunk; `entryChunk.test.ts` stays green.
- **Every TTL read in the three stores, and two readers outside the completeness store:** the five readers in `exoticProvenanceCache.ts` (`isFreshFor`, `staleOrUnconsulted`, `consultedSet`, `unmatchedSet`, and the chokepoint's short-circuit); `isRegionEntryDue` in `hotspotRegionCache.ts` (which `hotspotSet.ts`'s due-region selection calls); the chokepoint in `countyCompletenessCache.ts`; and the two places that skip a request on a fresh completeness entry by reading the TTL themselves, `useCountyCompleteness.ts`'s eager pass and `targets/useTargetsPool.ts`. The brief named only the store, but a reader that kept the old test would leave a future-dated entry standing on that surface, so the window is read there too (each has its own row).
- **The completeness readers call `isWithinTtl` with the store's constant, not a new store export,** because `useCountyCompleteness.test.ts` mocks the store module and supplies its own TTL: a new export would be missing from the mock, and calling the shared predicate keeps the mock's TTL seam meaningful while the real window runs.
- **A due or future-dated entry is still shown and still served** (regions, completeness offline). The window decides only when to ask. The region store's header said it keeps an answer "for 30 days"; it now says the answer is reused for 30 days and kept until evicted or cleared (the claim swept from the source, docs rule).

## D-13 The release is 1.0.66

D-06 planned 1.0.65 "unless a parallel ship takes it first". 1.0.65 shipped from the life-list-filter-toggle-state worktree on 2026-11-08 and local `main` was fast-forwarded to it (HEAD `481b9ee3`), so this run is **1.0.66**: versionCode 1000066, F-Droid changelog codes 10000661, 10000662 and 10000664, recipe `CurrentVersionCode` 10000664. Written now: `frontend/package.json` and the lockfile's two "frontend" version lines, `src-tauri/tauri.conf.json` (version and `bundle.android.versionCode`), the `CHANGELOG.md` entry (dated 2026-11-08; `RELEASE_DATE` re-dates it at the ship), `website/index.html`'s pill, aria-label and footer, and the recipe (three Builds entries and the two Current fields). The recipe's three `commit:` lines stay on 1.0.65's `d7444330` until the v1.0.66 tag exists, as the 1.0.65 ship did. Held: the three F-Droid changelog files (published copy), so `fastlaneMetadata.test.ts` is red on two rows until they land. `bump-1.0.66.sh` makes the ship's held writes one re-runnable step. 1.0.65's App Store disposition is in `RELEASE_LEDGER.md`; the Deployer reads App Store Connect at this ship and writes 1.0.66's.

## D-14 Held privacy item 2 is reworded from the brief's proposal

The brief's item 2 kept a closed list: "a later launch asks again only about a region your export newly names or whose stored answer is older than 30 days". Two members are missing. (1) This release's own window: a stored answer dated more than a day ahead is due (`isRegionEntryDue`), so "only" becomes false the moment D-03 ships. (2) Pre-existing: `hotspotSet.ts` asks about every region with no stored entry, which includes a region the export already named whose lookup failed or was evicted, not only one it "newly names". The proposed text says "only about a region with no stored answer, or one whose stored answer is older than 30 days or is dated more than a day ahead of your device's clock", and the revised guard checks the clause against `STORED_TIME_MAX_FUTURE_MS`. Item 1 is left as the brief wrote it: it carries no "only", and "may ask for it again" already covers the future-dated re-ask alongside D-04's two edges. The brief's wording is recorded in `held-copy.md` as the alternative, with what it would over-claim.

## D-15 The Help escapee sentence is corrected, no new Help sentence

`docs/HELP.md` said "The answer is cached for 30 days, so a later visit re-checks only checklists it has not seen before.", the same retention over-claim as privacy item 1, and its "only" missed the 30-day re-ask. It now reads "Each answer is kept on your device and reused for 30 days, so returning to the tab does not repeat the requests." (the paragraph-scope sweep, comparing the files with each other). In-app help needs no review stop. No sentence about the new pacing was added: Help's Map Explorer paragraph already says the app's eBird lookups share one pace, and the brief expected no new in-app copy. No in-app string changed.

## D-16 How the suites drive the gate

- The controller and List Comparer gate rows run on a fake clock with the real 150 ms spacing and observe request starts at the client (the v0.5.92 posture); every other row zeroes the spacing seam and resets the gate per test (the Projects suites' posture). The List Comparer rows extend `ChecklistComparer.test.tsx` rather than adding a file. Red first: unwrapping the two calls turns all three List Comparer gate rows red.
- `exoticProvenanceConvergence.test.tsx` builds a fresh module graph per seam, so the gate state is fresh too, but it ran the real spacing: green, and 33 s for four rows against a 30 s per-row timeout under load. It now zeroes the spacing seam in each graph: 3.3 s, still 29, 8, 0, 0.
- The parity rows were mutation-checked: with the refusal removed on either side, that side's answer-body rows go red (desktop 3 of 9, web/Pi 2 of 8) and the other side stays green.

## D-17 How the held copy is packaged

- **Two groups, each all-or-nothing:** REQUIRED (privacy items 1 and 2 in both files, the revised `hotspotSharePublishedClaims.test.ts`, the new `escapeeRetentionPublishedClaims.test.ts`, the three F-Droid files) and OFFERED (item 3 and `hotspotActivityRetentionPublishedClaims.test.ts`). So item 3 can be approved after the required group lands, and a half-applied group is refused.
- **The guard rows sit in files the run does not otherwise edit** (the docs rule for a held patch): the revised hotspot guard is a full replacement whose live file must be byte-identical to HEAD's blob, and the two new guards are new files.
- **`held-copy.md` is the one source of the text:** the script reads the quoted Before and After lines and the store text from it, checks the stated length and SHA-256, and refuses on any disagreement with `held/whats-new.txt`. The `.patch` files are review artifacts generated from the same text and compared byte for byte with the script's output.
- **Proved in a scratch copy only** (`held/README.md` has the figures). The live tree carries none of it.

## D-18 Stop no longer waits out a cooldown after a 429 on the wire (QA L1)

- **The defect:** `gatedProvenance` raced `gated` against `pass.signal.then(() => (onWire ? gated : null))`. When Stop landed while a request was on the wire, the race followed the whole gated call, and if that request answered 429 it waited out the gate's cooldown and retry, though the retry then found the pass stopped and sent nothing. QA measured the pass still in progress 6 s after Stop and stopped only at 36 s (Retry-After 30 s; up to 60 s at the cap). Nothing extra was sent, but it contradicted D-09 and the PR's "Stop ends it promptly".
- **The fix, in the wrapper only** (`ebirdGate.ts` and `rateLimit.ts` untouched): the gated call records the attempt on the wire, and on Stop the loader waits for that attempt alone. An answer is returned and kept. A rejection gives the gate one macrotask to settle `gated` first, because `gatedEbirdCall` rethrows a non-429 error or its final 429 with no timer in between; so that failure still counts as failed, exactly as before. A 429 the gate would retry ends the stopped call as `null` (not sent) at once. The 429 still reaches the gate, so the key-wide cooldown opens as before. Departure from QA's suggested shape ("`null` if it failed"): every non-429 outcome keeps the accounting it had before the fix, and only the wait is removed.
- **The test:** "Stop while a request is on the wire that then answers 429 ends the pass without waiting out the cooldown" in `useExoticProvenance.test.tsx`, from QA's row, widened to three checklists on the wire: S0 answers 429, S1 a 502, S2 an answer. 1,010 ms after Stop the pass is `partial`/`cancelled` with one failure (S1), S2 is saved, the gate counted the wave, and no start follows in the next 60 s. Red before the fix (`in-progress`), green after; dropping the macrotask turns it red on the failure count ("0" for "1").
- **The List Comparer needs nothing:** it calls `gatedEbirdCall` directly, with no Stop and no wrapper.
- **QA L2 closed:** QA's composed-seam scratch row is now `frontend/src/lib/checklistProvenance.composedSeam.test.tsx`, beside the parity suite, with its debug output removed, a bounded wait on the terminal status, and an assertion that each checklist reached the faked outer seam once. Neutering the desktop refusal turns its desktop row red and leaves the web/Pi row green.

## D-19 The Auditor's five Informational notes, dispositions (Studio Style, the orchestrator's call)

- **I4 fixed here, a comment only:** `ttlWindow.ts` said every stored time is an integer below 2^53; the stores' load validators admit any finite number. The header now says the comparison is between finite doubles, that magnitudes stay far below 2^53 so the subtraction cannot overflow, and that a non-integer time is compared as written. No behaviour changed and no test moved.
- **I1 and I3 deferred as one idea (`132ee3ce`):** the pass reads the purge counter after `await loadSnapshot()` (unreachable today, because a pass starts only once the store is loaded), and a finished pass's stop token holds its cover's ids until the next pass (nothing sent, written or shown). Both are small and belong together.
- **I2 deferred as an idea (`7908928e`), per D-10:** an `obs` list holding a non-object item, or a non-JSON reply, fails differently per transport; every shape fails the lookup on both, so nothing stamps.
- **I5 already tracked:** the 12 dev-only npm advisories are ROADMAP line 33; `npm audit --omit=dev` reads 0.
- **Held copy truth check (the Auditor):** items 1 and 2 are true of the code as changed; item 3 is true in normal use (its store is outside the new window, so after a clock fault an answer can be reused past six hours, an edge today's wording shares). Carried to the deploy gate.

## D-20 The production sign-off (2026-11-08, the user's answers at the gate)

- **Deploy confirmed** for every platform, with the house rollup plan for the App Store: at the ASC step 1.0.65's state is re-read; if still `WAITING_FOR_REVIEW`, its record `ab6360bc` is withdrawn, retargeted to 1.0.66 on build 1.0.66.1 and resubmitted with What's New as 1.0.64's note, 1.0.65's note, then 1.0.66's (882 characters); if 1.0.65 has entered review, 1.0.66 waits on TestFlight and gets its own record with its 289-character note.
- **Privacy copy: items 1 and 2 approved as written in `held-copy.md`** (item 2 in the Engineer's rewording, D-14). **Item 3 declined** for this release; its held piece stays in `held/` and is not applied, and `bump-1.0.66.sh held` runs without `--offered`.
- **What's New and the F-Droid line approved, both sentences as written** (289 characters, SHA-256 `b7b34859…4d74509e`).
- **Xcode 27.2 first launch:** the user ran it before the iOS leg (the Deployer re-checks `xcodebuild -checkFirstLaunchStatus` before building).
- CI's two timing-ratio failures on `main` are the same ones 1.0.64 and 1.0.65 shipped under and measure nothing this release changes; the build and the real-engine browser check run locally.

## D-21 The user's iPhone check of TestFlight 1.0.66 (1) (2026-11-08)

- The user's words: "It seems to work, but the escapee check on this version still says "eBird's answers did not include 1 of your species, so it still counts."" They then confirmed the build passes and said to go ahead with the App Store step.
- The sentence is expected and unchanged by this release: that species is one eBird's checklist answers never list under the export's name (the pre-split name joining the nominate daughter, v1.0.64 D-06 item 2; the brief's audit row D deferred it to the taxonomy-history work). The 1.0.64 ledger recorded the same sentence on the same device with 1 species against 3 on the desktop export, a per-device store difference. What 1.0.66 changes is the pacing of those requests and that Stop ends the check at once.
