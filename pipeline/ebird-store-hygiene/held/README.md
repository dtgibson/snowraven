# Held published copy, 1.0.69 (ebird-store-hygiene)

**Status: HELD. Nothing here is applied to the live tree.** Every piece below is published copy, so each waits for the user's explicit yes at the deploy gate (CLAUDE.md, "Published copy needs the user's approval first"). The run's own code, tests, Help and the version stamp are already in the working tree; only these surfaces are held.

**Apply on a yes, from the repo root:**

```
git apply --check pipeline/ebird-store-hygiene/held/held.patch   # must print nothing
git apply pipeline/ebird-store-hygiene/held/held.patch
```

`held.patch` is one all-or-nothing patch over six files: the three F-Droid changelogs (new files), `PRIVACY_POLICY.md`, `website/privacy.html`, and the guard that pins the privacy sentence, `frontend/src/lib/projectsPublishedClaims.test.ts` (a suite this run does not otherwise edit, per `.claude/rules/docs-and-website.md`). If the user approves the F-Droid and store text but not the privacy rewording, the privacy hunks are not separable by `git apply`; say so and the Deployer writes the three changelog files alone (the text is below, byte for byte).

---

## 1. F-Droid "What's new": three new files

`fastlane/metadata/android/en-US/changelogs/10000691.txt`, `10000692.txt`, `10000694.txt` (versionCode 1000069 times 10, plus 1, 2 and 4).

**Before:** the files do not exist.

**After:** each file holds exactly this line and a trailing newline (370 bytes; 369 characters without the newline, under F-Droid's 500; SHA-256 of the file `ec1f42d51076b1a4c890c1fe88b57897795ba3e83318966c76f3c5ed4feb7e6a`):

> Life Lists now lists naturalized and provisional exotics by default, as eBird and the Statistics tab count them; turn off Include Exotics to leave them out. A saved Projects or Recent activity answer dated more than a day ahead of your device's clock is now asked for again, and a checklist answer from eBird that cannot be read now shows SnowRaven's own error message.

They must exist AT the v1.0.69 tag, because F-Droid reads the folder there (CLAUDE.md, Versioning).

## 2. App Store "What's New" for 1.0.69

**Before:** 1.0.68's record carries "When eBird's public data has no answer for one of your species, such as a sighting eBird has not yet confirmed, the escapee check now reads as finished on both Statistics and Life Lists, and the species still counts." (`pipeline/escapee-check-new-taxonomy/held/whats-new-1.0.68.txt`).

**After (1.0.69's own note):** the same text as the F-Droid line above, without the newline.

Whether 1.0.69 gets its own record or 1.0.68 rolls up into it is the Deployer's call at the ship, read from App Store Connect (the ledger shows 1.0.68 submitted). If it rolls up, What's New takes the house rollup form: 1.0.68's note, then this one.

## 3. Privacy policy: the Projects sentence, in both files

`PRIVACY_POLICY.md` (the eBird bullet's Statistics sub-bullet) and `website/privacy.html` (its mirror `<li>`), kept identical.

**Why it must change:** the Projects store now reads its stored time through the plausibility window, so an answer dated more than a day ahead of the device's clock is asked for again. The sentence's closed list of exceptions ("unless you press Check again") would be false the day 1.0.69 ships (`.claude/rules/docs-and-website.md`, v1.0.66: a release that adds a re-ask cause names it or drops the "only").

**Before:**

> The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have not been answered yet, and an answer already given is not re-checked for a year unless you press Check again, which re-asks about all of them.

**After:**

> The answers are stored on your device, so stopping, quitting, or loading a newer export asks only about checklists that have not been answered yet, and an answer already given is not re-checked for a year unless it is dated more than a day ahead of your device's clock or you press Check again, which re-asks about all of them.

The added words are "it is dated more than a day ahead of your device's clock or", in the region sentence's own phrasing (approved at 1.0.66). The opening clause is kept word for word because four source comments quote it as the reason a Clear, never a replace, purges the stores (`lib/clearDerived.ts`, `lib/icloud/icloudSync.ts`, `lib/icloud/icloudSync.test.ts` and `components/Settings.clear.test.tsx`).

**An alternative, if the user wants the first clause literally closed too:** "...asks only about checklists that have no current answer: an answer already given is not re-checked for a year unless it is dated more than a day ahead of your device's clock or you press Check again, which re-asks about all of them." It reads stricter but changes the clause those four comments quote, so they would move with it. Not prepared as a patch; say the word and it is a five-minute change.

**The guard moves with it** (inside `held.patch`): `projectsPublishedClaims.test.ts`'s sentence pin becomes the new sentence, and a new row checks that "more than a day ahead" is the Projects window itself (`STORED_TIME_MAX_FUTURE_MS` is exactly 24 hours, and `isWithinTtl` with `PROJECTS_TTL_MS` honours exactly a day ahead and refuses one millisecond past).

**Checked and left alone:** the same bullet's Recent activity clause, "bounded and cached on your device for six hours". The window gives that store an earlier re-ask, not a different cache length, so the clause is no less true than before; its retention wording was item 3 at 1.0.66, which the user declined. No other published sentence names either store's reuse period (README.md and website/index.html say nothing about either).

## 4. Not held here, recorded

- `website/assets/shots/life-lists.webp` shows both switches off beside the old status sentence. Recapturing it is a held decision of its own (the brief), not part of this build.
- The website version pill, its `aria-label` and the footer moved to 1.0.69 in the working tree, the version-stamp step the published-copy rule allows. Nothing else under `website/` changed.

## How it was proved, before the yes

- `git apply --check` against the live working tree: clean. The live tree was not patched.
- In a scratch copy of the repo (no `.git`, `node_modules` linked) with `held.patch` applied: `fastlaneMetadata`, `projectsPublishedClaims`, `privacyPageParity`, `fdroidRecipe`, `androidVersionSource`, `icloudKeysPublishedClaims`, `lifeListsPublishedClaims` and `hotspotSharePublishedClaims` all pass (8 files, 139 tests). The full frontend suite there: 10,784 passed, and its 2 failures are artifacts of the copy that pass in the live tree (details in `../pr-description.md`).
- In the live tree without the patch, the only red guard is `fastlaneMetadata.test.ts` (two rows: the current version has no changelog files yet). `projectsPublishedClaims.test.ts` stays green there because it still pins the unpatched sentence.
