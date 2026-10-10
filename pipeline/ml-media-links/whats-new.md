# What's New: Macaulay Library links on Named Birds (1.0.54)

**Status: APPROVED by the user on 2026-10-09, both texts verbatim (`decisions.md`, D4).** (b) was written at the 1.0.54 version bump (`50984f65`, as `10000541/2/4.txt`); (a) was written to the 1.0.54 App Store record `e4affc7f` on 2026-10-09, after the user's own device check of TestFlight build 1.0.54.1 (D5), and read back byte for byte. The status line originally read "HELD. Not approved, not written anywhere." (Phase A, 2026-10-08).

## Which record carries it

Live query at Phase A (2026-10-08): 1.0.53's record `ecbac251` is `READY_FOR_SALE` on build 1.0.53.1 (submission `b62a9121` COMPLETE), and it already carries 1.0.52 by rollup. Nothing is in review and no release is deferred, so **1.0.54 gets its own new record and its What's New is this text alone.** No rollup or deferral text needs combining. If the state changes before Phase B's App Store step (for example a 1.0.55 ships first), re-query and re-decide; do not reuse this paragraph's conclusion.

## (a) App Store "What's New"

```text
Media links on Named Birds. Each named bird's media section now opens with a numbered list of links to every photo, recording, and video of that bird, grouped by type and newest first, and each number opens that item on the Macaulay Library, even while the players inside the app cannot load.
```

- No em dash, American spelling, serial commas.
- It does not name any other mobile platform (App Review Guideline 2.3.10).
- "even while the players inside the app cannot load" is the reason the list matters today: Cornell's bot check currently blocks every embedded player. If the user prefers the sentence without that clause, it ends at "on the Macaulay Library."

## (b) F-Droid changelog: `fastlane/metadata/android/en-US/changelogs/10000541.txt`, `10000542.txt` and `10000544.txt`

Three files with the same text, one per processor-type build, and none under the unsplit code `1000054` (`b682bc4c`, 2026-10-09: F-Droid looks each build's "What's new" up by that build's own code). This file first named the single `1000054.txt`; the approved text is unchanged.

Published listing copy (CLAUDE.md, published copy), so it waits for the same yes. It must be in the version-bump commit, because F-Droid reads the folder at the tagged commit and `fastlaneMetadata.test.ts` goes red without it. At most 500 characters.

```text
Media links on Named Birds. Each named bird's media section now opens with a numbered list of links to every photo, recording, and video of that bird, grouped by type and newest first, and each number opens that item on the Macaulay Library in your browser.
```

It is (a) with the players clause replaced by "in your browser": the Android app never mounts an inline player (1.0.53), so on Android the list's value is having every item in one place, each opening in the browser. 257 characters, plus the final newline the 1.0.53 file ends with.

## Notes for whoever writes it

- Write (a) to the new 1.0.54 record byte for byte and read it back. Write (b) as each of the three files' whole content followed by one newline, as the 1.0.53 files are.
- No website, README, privacy policy or listing-description change is proposed for this release (strategic brief, Out of Scope: links are operating detail the website and README register leaves out; the privacy policy's "direct Macaulay Library links remain available and contact the site only when you choose to open one" stays true).
