# Decisions — escapee-check-new-taxonomy

## D-01 Orphaned punctuation after an inline bird name (QA attempt 1, 2026-11-08)

**Finding.** The Tester's real-engine look at the named status line found that, in both Chromium and WebKit, at 430px or narrower with text at 125% or larger (48 of 384 measured combinations), a comma or ", or" lands alone at the start of a line. Each comma is the first text after a `BirdName`, and both engines allow a break right after the name's trailing marks. At the user's one-open-bird case it shows only at 320px, where ", so it still counts." stands alone on the last line.

**Decision.** Punctuation that follows a bird name is attached to that name and never starts a line. The mechanism keeps the name's trailing marks and the punctuation after them in one unbreakable run while the name's own words stay free to wrap, so a long name at 320px never overflows. Typesetting rule, not a design direction: the Fix lane has no Designer, and nothing about the line's look or wording changes. Routed to The Engineer as the attempt-1 retry; The Tester re-measures the same 384 combinations in both engines.

**What would reverse it.** A measured overflow at 320px with 200% text from a name made unbreakable, or a WebKit-only result that differs from Chromium (a null result is per-engine).

## D-02 Security review dispositions (2026-11-08)

- **L-1 applied.** `frontend/src/lib/exoticTaxonomyJoin*.ts` added to the `paths` list of `.claude/rules/security.md`, as CLAUDE.md requires when a change adds a file a rule governs. Frontmatter only; no code or test changed, so the Tester's sign-off stands.
- **I-1 accepted, PR limitation 2 reworded** to state the real shape (an Escapee-tagged sibling row could read a kept-name species as escapee-only) and that no 2026 event can produce it; recheck at the next taxonomy refresh.
- **I-2 accepted.** A failed history chunk runs the check without the join and the species keeps counting, which is the pre-fix behaviour; the chunk ships inside the Tauri apps.
- **I-3 accepted, no privacy-policy change.** One paced re-ask per previously stamped species on the first Statistics load after upgrading; on the user's data, 3 requests then 0.

## D-03: The run re-enters at Stage 1 for the withheld record, and 1.0.67's App Store leg rolls into 1.0.68 (2026-11-08)

**Decision.** At the 1.0.67 iPhone check (TestFlight build 1.0.67.1, all four steps passed in the user's words: "This is good") the user asked why Eurasian Skylark was still named open. The Skylark was never renamed (`skylar` before and after the 2026 update), so the join has nothing to match; the species is open because eBird's answer for checklist `S186299363` carried no Skylark row. The user then read that checklist on ebird.org and reported that the record is a Merlin observation that eBird has not confirmed (their option 2, "Flagged or changed"), and asked why SnowRaven does not show it as settled for their personal list. A record eBird keeps out of its public output is invisible to the eBird API the app reads, so the app has no provenance answer for it and never will until eBird confirms it; the species counts (the sentence says so), but the Statistics line and Life Lists' status sentence ("has not finished for this export") read the case as unfinished. The user's direction: "Lets do the skylark fix now, and then upload both together." So the run re-enters at Stage 1 as scoped errands (CLAUDE.md, Pipeline overview, v1.0.62): the Evaluator amends the brief, each later builder amends its own artifact, and the Deployer ships 1.0.68 to every platform. **1.0.67 keeps no App Store record of its own: it rolls up into 1.0.68** (TestFlight build 1.0.67.1 stays VALID; Mac, Windows and the Android APK already shipped as 1.0.67). The ledger sentence is written at the 1.0.68 ship, naming both versions.

**Why.** The fix the user asked for was "the user always sees an up to date picture", and a record eBird withholds reading as "not finished" forever is the same symptom from a third cause. A behavior change cannot ride an iOS-only second build (every platform ships one version), so it is 1.0.68. The idea is in the inbox as `ca1c0630-a8ba-4aa2-9b5d-f52633447beb`, marked building.

**What would reverse it.** If eBird's API turns out to serve the record and the app dropped it, this is a matching gap in the app, not a withheld record, and the Evaluator's reproduction must say so before the Engineer touches the completion rule.

## D-04: Security dispositions for the re-entry (2026-11-08)

- **I-4 (Informational), accepted, comment corrected.** A refused row (species index full) for a species that already holds a stamp leaves the stamp, so the species reads settled and the line's "no answer" is untrue for it. It still counts and is native, so no number moves, and the 16,384-species cap cannot bind on a real life list. Dropping the stamp on a refused row would re-enter the v1.0.1 heal and re-ask on every load, so the behaviour stands. The `PartialReason` comment in `useExoticProvenance.ts` now states the exact case ("a refused row for a species with no earlier stamp"). Reversal condition: a species index cap that a real export can reach.
- **I-5 (Informational, pre-existing), applied.** `frontend/src/lib/useExoticProvenance.ts` is now in `.claude/rules/security.md`'s `paths`, beside `useCountyCompleteness.ts`, so a session editing only the escapee controller loads the TTL, table and allocation rules. Convention flag to the Chronicler: a controller that plans eBird requests sits inside `security.md`'s gate.
- The Tester's (a) and (b) are accepted limitations as judged in the QA report: the one 30-day re-ask shows the ordinary progress line and, if it fails, the error line on Statistics while Life Lists stays complete; neither is an "unfinished" reading. The error line's wording is in the inbox (`011c46e5`).
