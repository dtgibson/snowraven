# Held copy: Splits and lumps back to 2019 (1.0.58)

**Status: HELD. Nothing below has been written to a published surface.**
Prepared by The Deployer, 2026-10-21. It needs the user's express yes at the
production sign-off (CLAUDE.md, published copy). On a yes, (b) is written in
the version-bump commit, before the tag, and (a) goes to App Store Connect
when the 1.0.58 record is created, after the user's own check of TestFlight
build 1.0.58.1.

## Which record carries it

Live query at preparation (2026-10-21, read only): 1.0.57's record `d5b968b4`
is `READY_FOR_SALE` on build 1.0.57.1, as are 1.0.56 (`f0e1fb0f`), 1.0.55
(`e4affc7f`), 1.0.53 (`ecbac251`), 1.0.51 (`c98d6dc5`), 1.0.50 (`99e3f9ff`),
1.0.47 (`0d823282`) and 1.0.45 (`73b6e8ac`). Nothing is in review. TestFlight's
newest build is 1.0.57.1 (VALID), and no 1.0.58 build exists.

So **1.0.58 gets its own new record, and its What's New is (a) alone.**
Neither a deferral nor a rollup is available: 1.0.57 is released. Re-query
before creating the record; do not reuse this paragraph's state.

## (a) App Store "What's New", 1.0.58

```text
Splits and lumps on Species Detail now covers eBird's taxonomy updates from 2019 to 2025, adding the 2019, 2021, and 2022 updates. Species eBird split or lumped in those years now appear in the list, with what each was, what it became, and how many of your reports eBird reassigned.
```

- 282 characters, ASCII only: no em dash, American spelling, serial commas in
  "2019, 2021, and 2022" and "what each was, what it became, and how many".
- It names the feature first, in the 1.0.41 line's words ("what it was, what
  it became, and how many of your reports eBird reassigned"), and says what a
  birder gets. It does not count events or species, and it does not mention
  2020, when eBird released no update.
- It names no other platform (App Review Guideline 2.3.10) and makes no
  offline or network claim.

## (b) F-Droid changelog: `fastlane/metadata/android/en-US/changelogs/10000581.txt`, `10000582.txt` and `10000584.txt`

Three files with the same text, one per processor-type build (`10 * 1000058 + 1`,
`+ 2` and `+ 4`), and none under the unsplit code `1000058`.
`fastlaneMetadata.test.ts` allows 1 to 500 characters (the final newline not
counted) and no em dash.

```text
Splits and lumps on Species Detail now covers eBird's taxonomy updates from 2019 to 2025, adding the 2019, 2021, and 2022 updates. Species eBird split or lumped in those years now appear in the list, with what each was, what it became, and how many of your reports eBird reassigned.
```

This is (a) word for word. The change behaves the same on Android, so there
is no Apple-only line to drop. Each file's whole content is this text and one
newline: 283 bytes, SHA-256
`d579aaaef2487c537c697d1e3f9671e28c24c032b416119d006dd90155d11548`.

## (c) No other published surface changes

- **README.md, website/index.html, the F-Droid full description**: the Species
  Detail paragraph says "any splits or lumps along the way" and names no year.
  The website changes only by the version pill and footer, the version-stamp
  step, which is already in the tree.
- **docs/HELP.md**: its two Splits and lumps passages say the list and the
  section "state which updates it covers" and name no year, so nothing
  changes. `taxonomyHistoryPublishedClaims.test.ts` forbids a year in the
  README, website and HELP passages.
- **appstore/LISTING.md, appstore/REVIEW_NOTES.md, PRIVACY_POLICY.md,
  website/privacy.html**: they do not mention splits or lumps. The build adds no
  request, host or stored document, so the privacy policy is unaffected.
- **The website's `species.webp`** (Wood Thrush, alt frame) starts below the
  control row and ends inside the First of Year card. It shows neither the
  "Splits and lumps N species" control nor the section, so it is unchanged.

## Screenshots: both 05 shots recaptured (in the tree, uncommitted)

Recaptured from the synthetic demo dataset (backend `SR_DATA_DIR` on a scratch
copy of `website/tools/demo-data`, demo-dataset guard passed: 368 synthetic
checklists) with a scratch copy of `website/tools/capture-appstore.mjs` that
adds only a species parameter, a single-shot filter and scratch output, the
1.0.52 method. Each has the same species and frame as the shot it replaces.

| Shot | Species | Size | sha256 | md5 (ASC `sourceFileChecksum`) |
|---|---|---|---|---|
| `appstore/screenshots/ipad-13/05-species-detail.png` | Wood Thrush | 2064x2752, 310,577 bytes | `b9bb428be8bfffc55c3d2fceaf81fd415b043248247ac5333314103c0fe8679b` | `1862eb4a7a4f3abc13fa57d4022fde1b` |
| `appstore/screenshots/iphone-6.9/05-species-detail.png` | Northern Cardinal | 1320x2868, 233,427 bytes | `8bc23f6c33aa78b5b64aeab5e52b22b1611f6cb1754e6e13ea072dc078222193` | `32caacde2c65697ece27a85cbc9f08b3` |

- **What changed, measured by a pixel diff against the committed shots.** On
  the iPad, two bands differ: the control's count ("Splits and lumps 6
  species" now reads "10 species", y 280 to 347) and the coverage line ("Covers
  eBird's 2019 to 2025 taxonomy updates. A change made before 2019 is not
  recorded here.", y 2616 to 2638). On the iPhone, only the control's count
  differs (y 992 to 1037). Every other pixel matches the committed shots,
  including the eBird and Birds of the World marks.
- **The other ten shots are unchanged.** 01 Map Explorer, 02 Statistics, 03
  Weather, 04 Calendar and 06 Breeding Codes in each set were checked by eye on
  a contact sheet. None is on Species Detail, and none shows the control or the
  section.
- **At the App Store leg, replace each set whole and in order** (release skill:
  replacement is order-sensitive), because 05 changes in both. Expect all
  twelve md5s to match `appstore/screenshots/` in order afterward.
