# Held copy: ebird-request-economy (1.0.66)

Nothing below has been written into `PRIVACY_POLICY.md`, `website/privacy.html`, `fastlane/`, App Store Connect, `website/index.html` (beyond the version pill and footer, which are not copy) or `README.md`. Each item waits for the user's explicit yes at the ship (CLAUDE.md, "Published copy needs the user's approval first"). The version is **1.0.66**: 1.0.65 shipped from another worktree on 2026-11-08 and took the number the brief planned for (decisions.md, D-13). If yet another ship takes 1.0.66 first, the ship moves the number, the file names and the date, and the text stays as approved.

`bump-1.0.66.sh held` applies the approved items exactly as they stand in this file: it reads each "After" line and the store text from the quoted (`> `) lines below, checks the stated facts, and refuses if anything here and in `held/` disagree. If the user changes a wording at the gate, edit the quoted line here (and the guard lead it names, if the lead changed) before running it.

## Privacy item 1 (required): the escapee retention sentence

Where: the Statistics sub-bullet under "Connections to Bird and Weather Services", in both `PRIVACY_POLICY.md` and `website/privacy.html` (identical wording; neither file marks up this sentence). Idea `a3b2a269`.

Why: "stored on your device for 30 days" states the reuse window as the retention. The answers stay on the device past 30 days and keep counting (`rebuildSnapshot` reads every ledger entry; species records never age out), and only Clear, or the ledger's first-in-first-out cap at 131,072 checklists, removes them (decisions.md D-04; the v1.0.42 rule that a published retention sentence describes what is on disk).

Before:

> The answer is stored on your device for 30 days, so returning to the tab does not repeat the requests.

After:

> Each answer is kept on your device until you clear your eBird backup, and is reused for 30 days before the tab may ask for it again, so returning to the tab does not repeat the requests.

The brief's wording, unchanged. Guard: new `frontend/src/lib/escapeeRetentionPublishedClaims.test.ts` (held as `held/escapeeRetentionPublishedClaims.test.ts`): the sentence exists right after "not your whole history.", "30 days" is built from `PROVENANCE_TTL_MS`, "until you clear your eBird backup" is checked against the Clear registry (`registeredTeardowns('ebird')` holds `exotic-provenance-v1`), the old sentence is gone, and the two files agree.

Three edges, none of them "returning to the tab" in the ordinary sense, all predating or bounded by this change: Check again re-asks within the 30 days; a newer export that shows a new species on an already-asked checklist re-asks it once (the v1.0.1 heal); and, new in 1.0.66, an answer stored while the device's clock ran more than a day ahead is asked for once more after the clock is corrected (D-03). "May ask for it again" promises no schedule, which is why it covers all three.

## Privacy item 2 (required): the hotspot-region retention sentence

Where: the same Statistics sub-bullet, both files.

Why: the paragraph-scope sweep. Same defect as item 1 (a region's answer past 30 days stays on disk and is still shown, until a Clear removes it or the 512-region cap or payload budget evicts it), and its list of what a later launch asks about is a closed list ("only about") that this release adds a member to.

Before:

> Each region's answer is stored on your device for 30 days, so a later launch asks again only about a region your export newly names or whose stored answer is older than that.

After:

> Each region's answer is kept on your device until you clear your eBird backup, and a later launch asks again only about a region with no stored answer, or one whose stored answer is older than 30 days or is dated more than a day ahead of your device's clock.

**This differs from the brief's proposal**, which read "Each region's answer is kept on your device until you clear your eBird backup, and a later launch asks again only about a region your export newly names or whose stored answer is older than 30 days." Two corrections, both about the closed list (decisions.md D-14): (1) this release's plausibility window makes a stored answer dated more than a day ahead due, so "only" would be false without that member; (2) a launch also asks about a region the export already named whose earlier lookup failed or was evicted, which "newly names" never covered (pre-existing; "with no stored answer" is what `hotspotSet.ts` actually tests). If the user prefers the brief's shorter wording, the guard's `FUTURE_CLAUSE` row is the one to drop, and the sentence's "only" then over-claims in those two rare cases.

Guard: `frontend/src/lib/hotspotSharePublishedClaims.test.ts` is replaced by `held/hotspotSharePublishedClaims.test.ts`: the new lead, "30 days" still built from `HOTSPOT_REGION_TTL_MS`, the window's clause checked against `STORED_TIME_MAX_FUTURE_MS`, "until you clear" checked against the Clear registry (`hotspot-regions-v1`), and the 1.0.62 lead asserted gone. The script refuses unless the live guard is byte-identical to HEAD's (git blob `bdf64151bf3655c5158ce6c9be302b129e2a44e5`).

## Privacy item 3 (offered, not required): the Recent activity clause

Where: the parent eBird bullet under "Connections to Bird and Weather Services", outside the repaired paragraph, both files. Applied only with `bump-1.0.66.sh held --offered`.

Why: same class. Six hours is the reuse window; the answers stay on the device past it, and this store is not on the Clear path (`clearDerived.ts` excludes `hotspot-activity-v1`, whose keys are public hotspot ids), so the clause says "kept" with no "until you clear".

Before:

> one request per hotspot, bounded and cached on your device for six hours

After:

> one request per hotspot, bounded, with each answer kept on your device and reused for six hours

The brief's wording, unchanged. Guard, installed only with item 3: new `frontend/src/lib/hotspotActivityRetentionPublishedClaims.test.ts` (held as `held/hotspotActivityRetentionPublishedClaims.test.ts`): "six hours" built from `HOTSPOT_ACTIVITY_TTL_MS`, the store asserted absent from the Clear registry, the old clause gone. No guard pins this clause today.

## Proposed F-Droid changelog (the three files, identical)

Files: `fastlane/metadata/android/en-US/changelogs/10000661.txt`, `10000662.txt` and `10000664.txt` (versionCode 1000066, times ten, plus 1, 2 and 4; none under the unsplit `1000066.txt`). Each file holds exactly this one line followed by a single newline, byte-identical to `held/whats-new.txt`:

> The Statistics tab's escapee check and the List Comparer now pace their eBird requests with the rest of the app, and wait and try again when eBird asks the app to slow down. An eBird checklist answer with no list of observations now counts as a failed lookup instead of an empty checklist.

- 289 characters, under the 500 that `fastlaneMetadata.test.ts` allows.
- 290 bytes per file: the 289 characters plus one line feed (0x0A). ASCII only (every byte below 0x80), no em dash, no curly quote, no carriage return, no trailing space.
- SHA-256 of each file's exact bytes: `b7b34859e94b063ea95e19139ca0074ba9b2492563a508b7ceffa8f24d74509e`. The three files are byte-identical, so all three hash to this value.

They must exist at the `v1.0.66` tag, because F-Droid reads the folder there. Until they are written, `fastlaneMetadata.test.ts` is red on two rows (each naming the three missing files); that is by design.

## Proposed App Store "What's New"

The same text, so the two stores say the same thing (written without the trailing newline, 289 characters):

> The Statistics tab's escapee check and the List Comparer now pace their eBird requests with the rest of the app, and wait and try again when eBird asks the app to slow down. An eBird checklist answer with no list of observations now counts as a failed lookup instead of an empty checklist.

A shorter form, if the user wants one sentence: the first sentence alone. Left out on purpose: the clock fix (an answer dated more than a day ahead is asked for again), which is in `CHANGELOG.md` and matters only after a device clock fault.

## README.md and website/index.html

No sentence is proposed for either. Nothing here is a new capability, and the register is one or two sentences per tab saying what the tab does.

## In-app text and docs/HELP.md (written, no stop needed)

`docs/HELP.md`'s escapee paragraph said "The answer is cached for 30 days, so a later visit re-checks only checklists it has not seen before.", the same retention over-claim as item 1 (and "only" missed the 30-day re-ask). It now reads "Each answer is kept on your device and reused for 30 days, so returning to the tab does not repeat the requests." In-app help is written without a review stop (CLAUDE.md); it is listed here so the user sees it beside item 1. No other in-app string changed.
