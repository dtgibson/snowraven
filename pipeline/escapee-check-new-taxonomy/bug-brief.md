# Bug Brief — Escapee check under the new taxonomy

## What is broken
The Statistics escapee check (the line under the Species figure, the only place it renders) cannot match eBird's current answer to a species named under an older taxonomy. A backup from before eBird's 2026 update names a split bird by its old name. `/taxonomy/codes` matches the scientific name first, so the old name lands on one daughter species ("Willet" becomes `willet2`, Saltmarsh Willet). eBird now answers for that observation under a sibling code or the slash code (`willet1`, now "Saltmarsh/Prairie Willet"). The merge drops that row as outside the cover, the species never gets a record, and the line reads "eBird's answers did not include N of your species" for good.
Two related gaps. Seven 2026 lumped-away names resolve to no code at all, so their escapee status is never checked and nothing says so. A second cause gives the same sentence and has nothing to do with taxonomy: an answer that really lacks the species (Eurasian Skylark, checklist `S186299363`, absent under both taxonomies). The sentence never names the species, so the user cannot tell which cause they are seeing.

## Steps to reproduce
1. Load a backup with the row `S1, Willet, Tringa semipalmata` (any download from before 2026-10-29), plus one control species on S1.
2. Resolve codes the way both transports do (`bySci`, then `byCom`, species only, bundled 2026 snapshot). The result: Willet maps to `willet2`.
3. Merge eBird's current answer for S1, `[{speciesCode: 'willet1'}, {speciesCode: <control>}]` (the answer measured at v1.0.64).
4. `willet2` classifies as `unknown`, `remainingSpecies` holds 1 species, and `statusSentence` returns exactly "eBird's answers did not include 1 of your species, so it still counts." (probe: `/private/tmp/claude-502/-Users-developer-devwork-snowraven/7c035e40-a187-4e12-b532-174b189eea45/scratchpad/probe/repro.mjs`).
5. On the August data copy (`data/`), the same model leaves 3 species open: Willet and Marsh Wren (taxonomy) and Eurasian Skylark (not taxonomy).

## Expected behavior
When the backup's name shows it predates a split or lump, an answer row under a sibling code from the same event (another daughter, or a slash) counts as the answer for the user's species. That species then resolves like any other: counting, escapee or exotic. Each lumped-away name joins its surviving species and is checked.
`unmatched` stamps written under the old join must not keep the sentence up for up to 30 days. Statistics' controller and Life Lists' completion test read the same single join rule, so every list surface agrees.
A species still open for a reason other than taxonomy is named on the line, so the user can see which bird it is.

## Blast radius
- The join itself: `buildCoverIndex`, the merge's `admissible` set and `carried` stamping (`mergeChecklist`), `carriersNeedingRefetch` and `remainingSpecies`. Statistics (`BirdingStats.tsx:457`) and Life Lists (`lifeListsProvenance.ts:61`) each build their own cover index, and both must take the join (the v1.0.63 completion rule).
- The stored `exotic-provenance-v1` document on users' devices: stamps and records are keyed by code, and the ledger holds those checklists as fresh. Re-open affected species with an optional field on the same key, or by dropping their stamps. A version bump would empty every device's store.
- The passive readers (Calendar, Multimedia coverage, Frivolous Lists, county Completeness, Species Detail's Show escapees, Life Lists' exotic list) inherit the fix through the published names. A species that moves from `unknown` to `escapee-only` or exotic changes their counts.
- The history asset (226 KB) is loaded only on demand and is kept off the entry chunk (`entryChunk.test.ts:232`). Statistics and Life Lists must load it the same way. `exoticProvenanceConvergence.test.tsx` pins today's open state and the [29, 8, 0, 0] request counts; those rows change on purpose.
- Out of scope: re-counting the life lists under the new taxonomy. All 39 old 2026 names still count; a lumped pair still counts as two and a pre-split bird as one, until the user downloads a fresh backup (v1.0.61 decision). The two transports and `/taxonomy/codes` need no change if the join lives in the frontend model.

## What done looks like
Every 2026 shape resolves from an answer under a sibling code: a retired split name, a split whose daughter kept the old name, an old code reused for the slash, and a lumped-away name. This is shown in model rows and in a convergence row through the real `storage.ts` on both the desktop and web storage paths, with Statistics and Life Lists reporting the same completion. A current backup that holds a daughter and its slash on one checklist is not cross-joined. On the `data/` copy the open set drops from 3 to 1, and the line names Eurasian Skylark.

## Evidence
- The sentence is `exoticCopy.ts:175`, set at `useExoticProvenance.ts:499` (after a pass) and `:558` (auto-start skip).
- Codes resolve by scientific name first, species only: `tauri/taxonomyService.ts:262` and `backend/routers/taxonomy.py:358`. Answer codes fold through `reportAs`, and a slash has no `reportAs` (`tauri/checklistService.ts:225`).
- `exoticProvenanceCache.ts:539` drops a row outside `admissible`; `:562` stamps the cover code as unmatched.
- `ebird-taxonomy-history.json`, 2026: 32 events. 28 split names land on a daughter; 7 lumped names resolve to nothing; 10 slashes reuse the old code; all 39 old names still count.
- The deferred root fix: `pipeline/exotic-provenance-reuse/decisions.md` D-02 and D-06 item 2, and ROADMAP row D (v1.0.66 item 2).
- The user's iPhone showed "1" at the v1.0.64 and v1.0.66 checks. Both local backups carry retired Willet and Marsh Wren, which make 3 open, so "1" most likely means Eurasian Skylark, which is not a taxonomy cause.
- Baseline: `exoticProvenance`, `useExoticProvenance` and `exoticProvenanceConvergence` suites, 102 of 102 pass.

## Re-entry (2026-11-08): a record eBird withholds reads as settled

### What is broken
The one species still open on the user's data after 1.0.67 is Eurasian Skylark. It is not a taxonomy case: its code is `skylar` both before and after 2026. Its only record is `S186299363` (`data/ebird-backup.csv` line 12294: Savoie, 2024-07-10, casual, count X, the checklist's only row). That record is a Merlin record eBird has not confirmed. eBird shows it to its owner and keeps it out of public output, and public output is all `/product/checklist/view` serves. eBird answers, the answer has no row for the species, and that will not change until eBird confirms the record.
The model cannot say that. A cover species with no record classifies as `unknown` whether or not anyone asked about it (`classifySpecies`). So `remainingSpecies` and `buildProvenanceLookup`'s `unknown` count (the controller's `openSpecies`, `useExoticProvenance.ts:497`) keep it open for good. The one fact that tells "eBird answered without it" apart from "never asked" is the `unmatched` stamp, and only the heal reads it. `unmatchedSet` is TTL-gated, and the stamps stay out of `ProvenanceSnapshot` (v1.0.64 D-03), so no completion reader sees them. As a result Statistics ends on `partial`/`unmatched` and Life Lists on `STATUS_UNRESOLVED` ("has not finished for this export").
Withheld, not dropped (D-03's reversal condition did not trigger). The stored document's last answer for `S186299363` is dated 2026-09-07 15:40 UTC. It is the document's newest ledger entry: the heal's lone re-ask, under the pre-2026 taxonomy, where the code was also `skylar`. That answer wrote or refreshed no species record (no record carries that merge's time), so it had no row under any of the 268 cover codes. The marker drop in 1.0.67 re-asked the checklist live on the iPhone, through the Tauri path, and the line still names the Skylark. Both transports keep every row that has a `speciesCode` (`tauri/checklistService.ts:223`, `services/ebird.py` `fetch_checklist_species`), and `skylar` has no `reportAs`, so a Skylark row that eBird served would have been admitted. The raw body was never kept, so `obs: []` cannot be told apart from a row under some non-cover code. The user's reading on ebird.org (on their own list, unconfirmed) makes the second unlikely.

### Steps to reproduce
1. Set up one checklist `S1` carrying Eurasian Skylark (`skylar`) and Mallard (`mallar3`). Merge eBird's answer `[{ speciesCode: 'mallar3' }]` through the real `mergeChecklist`, with `carried = index.byChecklist.get('S1')`.
2. The result:
   - `skylar` is `unknown`: it counts and is not exotic. The stamp is written, and `remainingSpecies` is `['skylar']`. The lookup counts read `unknown: 1`.
   - `carriersNeedingRefetch` plans nothing within the TTL, and re-opens `S1` once the TTL has passed. The snapshot has no stamp field.
   - `statusSentence` returns "eBird's answers did not include Eurasian Skylark, so it still counts." and `checkCompleteFor` returns false.
   - Scratch probe (real modules, storage mocked): `/private/tmp/claude-502/-Users-developer-devwork-snowraven/7c035e40-a187-4e12-b532-174b189eea45/scratchpad/reentry/withheld.test.ts`, with its output in `out.json` beside it.
3. The `S186299363` shape: an answer `[]` on a checklist that carries only the Skylark reads the same. The store also holds no record, so the `snapshot.species.size === 0` guards (in `checkCompleteFor`, and the auto-start's `not-checked` branch) read it as unchecked as well.
4. The harness is `exoticProvenanceConvergence.test.tsx`, which runs through the real `storage.ts` on both seams. The rows "consecutive loads send 3, 0, 0, 0" and "stamps written under the old join" (`SKYLARK = ['S2000000']`, answered `[{ speciesCode: 'mallar3' }]`) read `reason: 'unmatched'` and Life Lists `open` on every load, with `remainingSpecies` equal to `['skylar']`.
5. On the `data/` copy, the earlier data-copy run (`scratchpad/datacopy/result.json`) settles after 3, 0, 0 requests with Eurasian Skylark as the only open species. Life Lists shows `STATUS_UNRESOLVED` (the PR's manual step 3).

### Expected behavior
A cover species reads as settled when all three hold: it has no record, it holds an `unmatched` stamp, and none of its carriers is outside the ledger, so the pass has nothing left to ask. "Settled" means Statistics asked and the answers it consulted had no row for it. Such a species counts and is native, as it does today, and no completion reader holds it open. The rule is stated over what Statistics consulted, never over "every checklist".
Statistics' line says, in plain words, that eBird's public data has no answer for the species and that it counts. The Engineer words it. It must stay true whatever caused the missing row, it uses no em dash, and it names species through `BirdName` with the same parts, marks and `trailing` as today. The line reads as finished, not unfinished. Check again stays on it, with its D-13 meaning: it re-asks and ignores the stamps.
Life Lists' `checkComplete` becomes true when the only species open under today's rule are settled ones, so `STATUS_RESOLVED` shows. Both tabs read one predicate with the same stamp input (the v1.0.63 rule).
"Settled" reads whether a stamp is present, never how old it is. That matches the snapshot, which serves ledger entries and records at any age. The 30-day TTL still governs only the re-ask, which stays the stamp's one TTL read, through `isWithinTtl`. Once the TTL has passed, the heal re-asks the checklist once, paced as today. If the answer still has no row, the stamp is rewritten, and the line never flips back to unfinished in between. If a later answer does carry the row (eBird confirms the record), a record is admitted and the stamp dropped (`record()` calls `dropStamp`), and the species classifies from its token as usual.
Unchanged:
- A recordless species with no stamp (the v1.0.1 domestic heal) stays open.
- A stamped species that still has a carrier outside the ledger stays open, and the pass asks that carrier.
- Species parked at the budget keep the species-budget sentence.

### Blast radius
- Model and store. `remainingSpecies`, or a sibling that every completion reader shares, takes the stamp set as an input, and `buildProvenanceLookup`'s open count agrees with it. Passive readers need the stamp codes that are held, so either `ProvenanceSnapshot` carries them or a sibling exposes them on the same subscription. The controller's planning keeps the TTL-gated `unmatchedSet`, so the re-ask still happens. The two `species.size === 0` guards must not read a store holding only stamps as unchecked. The `unmatched` partial reason may become unreachable; the Engineer decides whether it stays or is folded in.
- Readers. On Statistics: the controller's end-of-pass report and auto-start skip, `exoticCopy` (`statusSentence`, `unmatchedSentence`), and `ExoticProvenanceAccount`, whose Check again renders only on `partial` today. On Life Lists: `checkCompleteFor`; the wording of `STATUS_RESOLVED` and `STATUS_UNRESOLVED` stays the same. Species Detail's Show escapees, Calendar, Map Explorer, the headline and every count read only the escapee list and `classCounts`, which this does not change.
- Tests that change on purpose:
  - The convergence rows that pin `unmatched`, Life Lists `open` and the Skylark sentence.
  - The House Swift row. Its "Life Lists without the join reads complete" discriminator stops discriminating once a stamped lumped-away name is settled, so it needs a shape that still does, for example an unconsulted carrier.
  - The unmatched rows in `ExoticProvenanceAccount.test.tsx`, along with its copy-hygiene sweep.
  - The D-04 rows in `useExoticProvenance.test.tsx`, plus `lifeListsProvenance.test.ts` and `exoticProvenance.test.ts`.
  - `lifeListsCopy.test.ts:54` and `escapeeRetentionPublishedClaims.test.ts` pin words. Run the full vitest suite after the copy change.
- Docs and security:
  - `docs/HELP.md:185` (the line's states) and `:679` ("until the check has finished") get re-read against the new state, and are updated in the same change if either becomes untrue.
  - `ACCESSIBILITY.md:91` (the live region, and Check again announcing twice) and `PRIVACY_POLICY.md:33` (the 30-day reuse) stay true and are not edited.
  - Security I-1 is unchanged. A settled species has no record, and a joined code is never stamped (`mergeChecklist`), so this never touches a species the join gave sibling rows. It only stops reading a counting species as unfinished, which is the safe direction.
- Out of scope:
  - The taxonomy join and `UNMATCHED_JOIN_VERSION`.
  - The stamp's write path, cap and TTL.
  - Any classification or count.
  - Any new request, endpoint or host. No request moves, and the 30-day re-ask is unchanged.
  - Published copy, apart from one proposed App Store What's New sentence held for the user's yes.
  - Accepted: the stamp cannot tell a withheld record from an older-taxonomy name the join does not cover (PR limitation 1). Both count and both will read as settled, so the copy must be true for both.

### What done looks like
Model rows on the `S1` repro cover four things:
- With a fresh stamp and with a 31-day-old one, Statistics reads it settled: no open species, the new sentence names Eurasian Skylark, and Check again re-asks. Life Lists reads complete.
- Once the TTL passes, the pass re-asks once and re-stamps, and the reading never passes through unfinished.
- A later answer that carries the row records it and drops the stamp.
- An unstamped species, and a stamped one with a carrier outside the ledger, both stay open.
The convergence suite, on both seams, has four checks:
- The measured shape still sends 3, 0, 0, 0 requests.
- Every load reads settled on Statistics and complete on Life Lists.
- The replacement House Swift row still fails without the shared join.
- On the `data/` copy, Statistics settles on Eurasian Skylark and Life Lists shows `STATUS_RESOLVED`.
The full vitest suite and `npm run build` are green.

### Decisions touched
- **v1.0.63 completion rule** ("the check is complete" means Statistics' own `remainingSpecies` test; CLAUDE.md bird-names bullet, `.claude/rules/bird-names.md`): REFINED, not reversed. Completion still means the shared open set is empty, and both tabs read it. What changes is what the set counts as open. The rule file's sentence names `remainingSpecies` as "the predicate the controller ends a pass on". Amend it to mention the stamp input.
- **v1.0.64 D-03** (only the heal reads stamps, and they stay out of `ProvenanceSnapshot`, so "a stamp cannot reach a count, a published list or a passive reader"): MODIFIED. A stamp now reaches passive readers' completion reading, but still no count and no published list.
- **v1.0.64 D-04** ("never `complete` while species are open") and **"a successful answer that lacks what was asked for is still an answer"** (CLAUDE.md, caching layers): APPLIED. The recorded absence now counts as an answer for completion, not only for the heal.
- **v0.5.87 "an unresolved species counts"**, **this run's D-03** (its reversal condition is checked above and did not trigger) and **security I-1**: unchanged.
