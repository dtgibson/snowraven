# What's New: four-letter codes in Search and the species pickers (1.0.55)

**Status: ALL THREE APPROVED, word for word.** (a) and (c) were approved at the production sign-off, 2026-10-11 06:21 UTC (`decisions.md`, entry 22); (c) was written in the 1.0.55 version-bump commit (`1cad7995`) as `10000551/2/4.txt`. (b), the rollup text, was approved at the App Store step, 2026-10-11 23:13 UTC, when the user chose to roll 1.0.54 into 1.0.55 after their own iPhone check of build 1.0.55.1 and answered "Send it" (`decisions.md`, entry 24). (b) is the text on record `e4affc7f`, written by script and read back byte for byte after the write and again after submitting; (a) on its own was not used, because the rollup carries it. The status line originally read "HELD. Not approved, not written anywhere" (The Deployer, preparation, 2026-10-10).

## Which record carries it

Live query at preparation (2026-10-10, read only, metadata key): 1.0.54's record `e4affc7f` is `WAITING_FOR_REVIEW` on build 1.0.54.1 (submission `5f4aabb3`, submitted 2026-10-10 04:33 UTC, `AFTER_APPROVAL`). Every other record is `READY_FOR_SALE`, and no 1.0.55 build or record exists. The question of which record carries 1.0.55 comes AFTER the user's own iPhone check of TestFlight build 1.0.55.1, and the records are re-queried then; do not reuse this paragraph's state. The routes at that point:

- **1.0.54 already `READY_FOR_SALE`:** 1.0.55 gets its own new record, and its What's New is (a) alone. No choice to make.
- **1.0.54 still `WAITING_FOR_REVIEW`**, two options for the user:
  - **Defer 1.0.55 behind it.** Leave `e4affc7f` undisturbed; 1.0.55 holds VALID build 1.0.55.1 and no record of its own by deferral (written into CLAUDE.md's reconciliation list at that ship), and gets its own record with (a) once 1.0.54 is `READY_FOR_SALE`.
  - **Roll 1.0.54 into 1.0.55.** Withdraw `e4affc7f` from `5f4aabb3` (it goes to `DEVELOPER_REJECTED`), retarget its `versionString` to 1.0.55, repoint it at build 1.0.55.1, write (b), and resubmit. 1.0.54 then holds VALID build 1.0.54.1 and no record of its own by rollup, written into the list in the same ship.
- **1.0.54 `IN_REVIEW`:** withdrawing now interrupts a review in progress, so deferring is the usual choice (the 1.0.25 precedent); the rollup is still possible.

Screenshots: none changes. Nothing on screen moves in this build (no badge, no label, no new row), so no App Store, F-Droid or website shot needs recapturing.

## (a) App Store "What's New", 1.0.55 alone

```text
Four-letter codes in Search. Typing a bird's four-letter code, such as YRWA or AMRO, in Search or any species picker now finds that bird. When a code names several of your birds, all of them are listed first, ahead of the name matches.
```

- No em dash, American spelling, no list needing a serial comma.
- It names no other platform (App Review Guideline 2.3.10), and makes no offline or network claim.
- The codes are written in capitals, as birders write them; typing is not case-sensitive.

## (b) App Store "What's New", the rollup alternative (1.0.54 rolled into 1.0.55)

1.0.54's approved paragraph word for word (`pipeline/ml-media-links/whats-new.md`, text (a); read back from record `e4affc7f` on 2026-10-10 and byte-identical), one blank line, then (a):

```text
Media links on Named Birds. Each named bird's media section now opens with a numbered list of links to every photo, recording, and video of that bird, grouped by type and newest first, and each number opens that item on the Macaulay Library, even while the players inside the app cannot load.

Four-letter codes in Search. Typing a bird's four-letter code, such as YRWA or AMRO, in Search or any species picker now finds that bird. When a code names several of your birds, all of them are listed first, ahead of the name matches.
```

## (c) F-Droid changelog: `fastlane/metadata/android/en-US/changelogs/10000551.txt`, `10000552.txt` and `10000554.txt`

Three files with the same text, one per processor-type build, and none under the unsplit code `1000055`. At most 500 characters.

```text
Four-letter codes in Search. Typing a bird's four-letter code, such as YRWA or AMRO, in Search or any species picker now finds that bird. When a code names several of your birds, all of them are listed first, ahead of the name matches.
```

It is (a) word for word: the feature behaves the same on Android, so nothing Apple-only needs dropping. 235 characters, plus the one final newline the earlier files end with. 1.0.54's F-Droid text never reached F-Droid on its own (the merge request still carries 1.0.53, and F-Droid keeps only the latest version before inclusion), but the 1.0.54 files stay in the folder as they are; this release adds only its own three.

## Notes for whoever writes it

- Write (a) or (b), by the route the user picks, to the record byte for byte, and read it back.
- Write (c) as each of the three files' whole content followed by one newline, as the 1.0.54 files are, in the version-bump commit. `fastlaneMetadata.test.ts` is red until all three exist with identical text.
- No website, README, privacy policy, listing description or App Review notes change is proposed for this release (strategic brief, Out of Scope: none of those surfaces has a Search passage, and nothing here changes what the app sends anywhere). The website changes only by the version pill and footer, the version-stamp step.
