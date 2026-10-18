# What's New: codes in Media Targets, the Named Birds card, and the tier-3 badge (1.0.56)

**Status: APPROVED by the user at the production sign-off (S1, 2026-10-18), word for word: (a) for the new 1.0.56 App Store record and (c) for the three F-Droid changelog files.** Prepared by The Deployer, 2026-10-18. (c) was written to `fastlane/metadata/android/en-US/changelogs/10000561.txt`, `10000562.txt` and `10000564.txt` in the 1.0.56 release commit (456 characters plus one newline, SHA-256 `84324509be68ed6fdb9931b3b4589fc92c820d6fcd657a5f7c1dcaff52806e5c` for each). (a) is written to App Store Connect only when the 1.0.56 record is created, after the user's own check of TestFlight build 1.0.56.1. (b) was asked for and is kept below, marked as unusable.

## Which record carries it

Live query at preparation (2026-10-18, read only, metadata key `QJA25M7XHM`): 1.0.55's record `e4affc7f` is `READY_FOR_SALE` on build 1.0.55.1, as are 1.0.53 (`ecbac251`), 1.0.51 (`c98d6dc5`), 1.0.50 (`99e3f9ff`), 1.0.47 (`0d823282`), 1.0.45 (`73b6e8ac`), 1.0.40 (`203ea1fd`) and 1.0.38 (`63dc73df`). Nothing is in review. TestFlight's newest build is 1.0.55.1 (`e5187c8d`, VALID), and no 1.0.56 pre-release train exists.

So **1.0.56 gets its own new record, and its What's New is (a) alone.** Neither a deferral nor a rollup is available: 1.0.55 is released, and a released version cannot be withdrawn or retargeted. Re-query before creating the record, in case anything changes between now and the device check; do not reuse this paragraph's state.

Screenshots: none changes. Checked against every committed shot:
- `appstore/screenshots/*/01-map-explorer.png` shows the My Sightings view with a popup, not Media Targets.
- `*/02-statistics.png` shows the top of Statistics (Life List Totals and, on iPad, Top Species). No milestone badge is in frame, and the change is a hover and focus color, which no capture shows.
- `*/05-species-detail.png` shows Northern Cardinal (iPhone) and Wood Thrush (iPad): the header, Sightings, Media counts, First of Year, and the form and split cards. No Named Individuals card and no media tile is in frame.
- The other three (Weather, Calendar, Breeding Codes) show no changed surface.
- The website's `named-birds.webp` is captured at 1600px and 100% text. The card's new rules are all `max-width` queries, and QA measured 0 pixels of difference on the desktop card from 641 to 1280px, so it is unchanged. `statistics-mobile.webp` shows no hover state.

## (a) App Store "What's New", 1.0.56 alone

```text
Four-letter codes in Media Targets. With no Macaulay Library export loaded, the Target Species search on Map Explorer's Media Targets view now finds a bird by its four-letter code, such as YRWA, or by its scientific name. Named Birds cards no longer cut off names, places, or links on narrow screens or at large text sizes. In light mode, the bird name on a 500 to 999 milestone badge is easier to read when you hover over it or reach it with the keyboard.
```

- 456 characters, ASCII only: no em dash, American spelling, and the serial comma in "names, places, or links".
- It leads with the one new ability, in the same shape as 1.0.55's "Four-letter codes in Search." line, and the code is written in capitals as 1.0.55's was (typing is not case-sensitive).
- It names no other platform (App Review Guideline 2.3.10) and makes no offline or network claim.
- "Named Birds cards" covers Species Detail's Named Individuals cards too, which use the same rows; the text does not name them separately.

## (b) App Store "What's New", the rollup alternative: NOT USABLE TODAY

Asked for in case 1.0.55 were still in review. It is not: record `e4affc7f` is `READY_FOR_SALE`, so there is nothing to withdraw and nothing to roll up. Kept for the record only. It would have been 1.0.55's approved rollup text (b) from `pipeline/species-code-search/whats-new.md` word for word (which itself carries 1.0.54), one blank line, then (a):

```text
Media links on Named Birds. Each named bird's media section now opens with a numbered list of links to every photo, recording, and video of that bird, grouped by type and newest first, and each number opens that item on the Macaulay Library, even while the players inside the app cannot load.

Four-letter codes in Search. Typing a bird's four-letter code, such as YRWA or AMRO, in Search or any species picker now finds that bird. When a code names several of your birds, all of them are listed first, ahead of the name matches.

Four-letter codes in Media Targets. With no Macaulay Library export loaded, the Target Species search on Map Explorer's Media Targets view now finds a bird by its four-letter code, such as YRWA, or by its scientific name. Named Birds cards no longer cut off names, places, or links on narrow screens or at large text sizes. In light mode, the bird name on a 500 to 999 milestone badge is easier to read when you hover over it or reach it with the keyboard.
```

## (c) F-Droid changelog: `fastlane/metadata/android/en-US/changelogs/10000561.txt`, `10000562.txt` and `10000564.txt`

Three files with the same text, one per processor-type build (`10 * 1000056 + 1`, `+ 2` and `+ 4`), and none under the unsplit code `1000056`. `fastlaneMetadata.test.ts` allows 1 to 500 characters (the final newline not counted) and no em dash.

```text
Four-letter codes in Media Targets. With no Macaulay Library export loaded, the Target Species search on Map Explorer's Media Targets view now finds a bird by its four-letter code, such as YRWA, or by its scientific name. Named Birds cards no longer cut off names, places, or links on narrow screens or at large text sizes. In light mode, the bird name on a 500 to 999 milestone badge is easier to read when you hover over it or reach it with the keyboard.
```

It is (a) word for word, at 456 characters: all three changes behave the same on Android, so nothing Apple-only needs dropping. On Android a named bird's media shows as link cards rather than players, but the card's header, sighting rows and tile links are the same markup, so the sentence holds there too.

## Notes for whoever writes it

- On a yes, write (c) as each of the three files' whole content followed by one newline, as the 1.0.55 files are, in the version-bump commit, before the tag. F-Droid reads the folder at the tagged commit, so a file added after the tag never shows for 1.0.56. `fastlaneMetadata.test.ts` is red until all three exist with identical text, and it is the only red in the suite today.
- Write (a) to the new 1.0.56 record byte for byte and read it back, after the write and again after submitting.
- No website, README, privacy policy, listing description, App Review notes or F-Droid listing change is proposed for this release (change brief: no sentence on those surfaces goes stale). The website changes only by the version pill and footer, the version-stamp step.
