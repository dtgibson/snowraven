# Deployment record: SnowRaven 1.0.51 (Spool bundle 20261004)

The bundle's five builds ship as one release, 1.0.51, on the user's bundle
sign-off ("Ship it", version chosen by the user). That sign-off authorized the
push, the tag, `release.sh` and the TestFlight upload. No agent touched a
physical device.

Builds carried: `map-recency-dst-colors` (`a0f770c2`),
`icloud-remove-all-continues` (`67f62e33`), `http-permit-narrowed`
(`ca10c241`), `worker-csp` (`bcbd4afb`), `breeding-code-lookup-hasown`
(`9c0af214`), the bundle records commit `211c9b30`, and the merge of
origin/main `58647567` (which brought 1.0.50 in; 1.0.50 shipped from the
stats-badges-uniform worktree while the spin ran). Each build has a passing
QA report and security report in its own pipeline folder.

## 1. Version set

Commit `9e3736ce` (`chore(release): 1.0.51, ...`): `frontend/package.json`
and its lockfile, `src-tauri/tauri.conf.json`, `CHANGELOG.md` (a 1.0.51
entry: two Changed, three Fixed, one Internal), and `website/index.html`'s
version pill (text and `aria-label`) and footer line only. Nothing else in the
website changed. Guards before the commit: `icloudKeysPublishedClaims.test.ts`
and `iosSceneManifest.test.ts` (2 files, 62 tests passed), `npm run
typecheck` clean; no em dashes in the new entry.

## 2. Pre-push checks

- Parallel-ship check: `git fetch` showed origin/main still at `2f204d8a`, an
  ancestor of HEAD; no `v1.0.51` tag on the remote; GitHub's latest release
  `v1.0.50`; App Store Connect's newest build 1.0.50.1. Two other worktrees
  hold a local 1.0.51 bump that is not pushed; they were not touched.
- Cargo (`git log origin/main..main`): the five builds, the bundle records
  commit, the merge of origin/main, and the version set. All covered by the
  sign-off; no app-behavior commit from outside the bundle.

## 3. Push, tag, CI

- `main` pushed `2f204d8a..9e3736ce`. Annotated tag `v1.0.51` on `9e3736ce`,
  pushed.
- Windows Build `37205528693` on `9e3736ce`: success.
- Pipeline `37205524947` on `9e3736ce`: success (Backend and Frontend).
- Deploy website to GitHub Pages `37205524949` on `9e3736ce`: success (the
  version pill now reads v1.0.51).
- Widget extension Swift tests, before the iOS archive
  (`snowraven_widgetsTests`, iPhone 17 Pro simulator, iOS 17+, timeouts on):
  143 tests, 0 failures, `** TEST SUCCEEDED **`.

## 4. Desktop release (`release.sh`)

- No other `release.sh`, `cargo` or `tauri build` process was running.
  `zsh -lc ./release.sh` from the repo root on `9e3736ce` (tag = HEAD), with
  the untracked held drafts moved outside the repo for the clean-tree
  preflight and restored afterwards. Exit 0.
- Preflight: iCloud profile OK (`8QKC3L2FKP.com.snowraven`, container
  `iCloud.com.dtgibson.snowraven`). Universal build; bundle version verified
  1.0.51; iCloud entitlements and embedded profile verified; DMG styled,
  signed, notarized (`status: Accepted`), stapled.
- Windows: the installer came from run `37205528693` (pinned to the tag
  commit; the only Windows run on `9e3736ce`), signed locally with the real
  key.
- Published https://github.com/dtgibson/snowraven/releases/tag/v1.0.51 (not a
  draft, not a prerelease), assets: `SnowRaven_1.0.51_universal.dmg`,
  `SnowRaven-updater.app.tar.gz` and `.sig`, `SnowRaven_1.0.51_x64-setup.exe`
  and `.sig`, `latest.json`.
- Independent check of the downloaded GitHub assets:
  - DMG: `codesign --verify --verbose=2` valid on disk and satisfies its
    Designated Requirement; `xcrun stapler validate` worked; `spctl -a -t open
    --context context:primary-signature -vv` accepted, `source=Notarized
    Developer ID`, origin Developer ID Application: DAVID THOMAS GIBSON
    (8QKC3L2FKP).
  - `latest.json`: version 1.0.51; `darwin-aarch64` and `darwin-x86_64` both
    point at `SnowRaven-updater.app.tar.gz` with the same signature;
    `windows-x86_64` points at `SnowRaven_1.0.51_x64-setup.exe`.

## 5. iOS TestFlight build 1.0.51 build 1

- All three `/tmp/xcshim` shims (`xcodebuild`, `xcrun`, `swift`) recreated
  unconditionally first; `swift` resolved to the shim during the build.
- The previous archive was in place, as every ship has found:
  `snowraven_iOS.xcarchive` was 1.0.49.1 (1.0.50 was archived in its own
  worktree). Moved aside to
  `snowraven_iOS.xcarchive.stale-1.0.49.1-20261004065448`.
- `tauri ios build --export-method app-store-connect --build-number 1`,
  outside the sandbox, through a login-shell launcher that maps Tauri's three
  signing names from the login-shell ids, so no id was on a command line.
  `** BUILD SUCCEEDED **`; Tauri's own export refused with "No Account for
  Team" / "No profiles for 'com.dtgibson.snowraven' (and '.widgets') were
  found", the expected refusal.
- Fresh archive confirmed by its stamp, not its presence: archive, app and
  widget all `CFBundleShortVersionString` 1.0.51, `CFBundleVersion`
  1.0.51.1. `vtool -show-build` on the app binary: `platform IOS`, `minos
  16.0`. All 9 swift-rs libraries under
  `src-tauri/target/aarch64-apple-ios/release/build/` report platform 2 (iOS)
  on every object, and nothing else.
- The archived `snowraven_widgets.appex` was "not signed at all"; signed ad
  hoc with `snowraven_widgets.entitlements`, after which it listed
  `com.apple.security.application-groups` = `group.com.dtgibson.snowraven`.
- Manual export with `~/.tauri/snowraven-ios-export-options.plist`:
  `** EXPORT SUCCEEDED **` (`src-tauri/gen/apple/build/export-1.0.51.1/`).
  `DistributionSummary.plist`: the app on "SnowRaven iOS App Store iCloud
  AppGroup 20260924" (`870fe004`) with the App Group and the iCloud keys
  (container identifiers, CloudDocuments, ubiquity container, environment
  Production); the extension on "SnowRaven Widgets App Store" (`50691228`)
  with the App Group only; both 1.0.51 / 1.0.51.1, Apple Distribution
  certificate `1861F7A4...` (expires 2027-07-05).
- `altool --validate-app`: VERIFY SUCCEEDED with no errors.
- `altool --upload-app`: UPLOAD SUCCEEDED, **Delivery UUID
  `38d5d395-ee08-48f3-a6fc-4fae696edde3`**.
- **TestFlight: build 1.0.51.1 is `VALID`** (uploaded 07:02:02 Pacific,
  `usesNonExemptEncryption` false), read back from `GET /v1/builds`.
- Stamp committed as `209fd30a` (`chore(ios): stamp iOS 1.0.51 build 1`, the
  two Info.plists only; the build's `PRODUCT_NAME` requoting in
  `project.pbxproj` was restored, not committed, as at earlier ships) and
  pushed to main, a fast-forward from `9e3736ce`. The plist guards
  (`iosSceneManifest`, `iosWidgetManifest`) passed, 55 of 55.

## 6. CI after the stamp, and a parallel ship

- Pipeline `37207710417` on the stamp commit `209fd30a`: **cancelled**, by
  the `cancel-in-progress` group, when the next push to main landed. That push
  was another session's: **1.0.52** (species-first-of-year) shipped on top of
  this release while it finished, release commit `87794871`, iOS stamp
  `44cea40f`, GitHub release `v1.0.52` (now Latest), TestFlight build
  1.0.52.1 (`b3410c78`, VALID). Both 1.0.51 commits are ancestors of its
  release commit, and its deploy plan records rebasing onto them.
- The run of record for the tree this ship left on main is therefore Pipeline
  `37209741284` on `44cea40f`, which contains `209fd30a`: success. The 1.0.51
  code itself passed Pipeline `37205524947` on the tag commit.
- This checkout's local `main` stayed at `209fd30a` until the store leg,
  then was fast-forwarded to `origin/main` (`eca0be1f`, which adds the 1.0.52
  session's records and its iPad Species Detail shot) before the records
  commit. No other worktree was touched.

## 7. App Store Connect before the store leg (read-only)

Version records, live query at about 16:20 Pacific on 2026-10-04 (key
`QJA25M7XHM`, `GET /v1/apps/6787719977/appStoreVersions`):

| Version | Record | State | Build |
|---|---|---|---|
| 1.0.50 | `99e3f9ff` | `READY_FOR_SALE` | 1.0.50.1 |
| 1.0.47 | `0d823282` | `READY_FOR_SALE` | 1.0.47.1 |
| 1.0.45 | `73b6e8ac` | `READY_FOR_SALE` | 1.0.45.1 |
| 1.0.40 | `203ea1fd` | `READY_FOR_SALE` | 1.0.40.6 |
| 1.0.38 | `63dc73df` | `READY_FOR_SALE` | 1.0.38.1 |
| 1.0.36 | `773cd204` | `READY_FOR_SALE` | 1.0.36.3 |
| 1.0.35, 1.0.34, 1.0.32, 1.0.31 | as CLAUDE.md lists | `READY_FOR_SALE` | |

- At the start of this ship (about 06:30 Pacific) 1.0.50 was
  `WAITING_FOR_REVIEW` as review submission `7118f6a7` (submitted
  2026-10-04T05:53:58Z). It has since been approved and released.
- Against CLAUDE.md's list, 1.0.45 to 1.0.50 are all accounted for: 1.0.46
  rolled into 1.0.47; 1.0.48 rolled into 1.0.49 and 1.0.49 into 1.0.50 (one
  record, `99e3f9ff`, now `READY_FOR_SALE`). **1.0.50 is RESOLVED.**
- TestFlight builds through 1.0.52.1 are `VALID`. **1.0.51 and 1.0.52 each
  hold a VALID build and no version record**, pending the user's decision;
  until it is made and written into CLAUDE.md's App Store list, neither is a
  skip. The two shapes are in `whats-new.md` beside this file.
- Screenshots: nothing in this bundle appears in either published set
  (01 Map Explorer shows My Sightings; 06 is the Breeding Codes tab, not the
  List Comparer; no shot shows Settings).

## 8. App Store: 1.0.51 on its own record (2026-10-04, Pacific)

**The user's decisions**, relayed by the coordinator: 1.0.51 goes to the App
Store on its own record on build 1.0.51.1 (1.0.52 follows on its own record,
in its own session's store leg); their own device check of TestFlight build
1.0.51.1 passed (it opens; Map Explorer and Statistics work); text (a) of
`whats-new.md` is approved word for word. No agent touched a physical device.

All calls used the metadata key `QJA25M7XHM`, one step per run, each write
only after the read before it.

- **Precheck (read-only).** No version record for 1.0.51; the newest record
  `99e3f9ff` (1.0.50) is `READY_FOR_SALE`; no review submission in
  `READY_FOR_REVIEW`, `WAITING_FOR_REVIEW`, `IN_REVIEW`, `UNRESOLVED_ISSUES`
  or `CANCELING`; build 1.0.51.1 (`38d5d395`) `VALID`, not expired,
  `usesNonExemptEncryption` false. 1.0.50's live App Review notes were
  byte-identical to the "Notes for the reviewer" block of
  `appstore/REVIEW_NOTES.md` as committed (3,898 characters, hard-wrapped
  lines), which fixed the comparison form.
- **Created.** `POST /v1/appStoreVersions`: platform IOS, `versionString`
  1.0.51, `releaseType` `AFTER_APPROVAL`, `copyright` "2026 Dave Gibson"
  (from `appstore/LISTING.md`), build relationship 1.0.51.1. HTTP 201,
  record **`c98d6dc5-274f-412c-851f-15359fd06f43`**,
  `PREPARE_FOR_SUBMISSION`. No phased release exists on it.
- **First read of the new en-US localization** (`8f41b433`): description,
  keywords, marketing and support URLs present; **promotional text EMPTY**
  (null), the fifth new record to arrive that way; What's New empty, as
  expected.
- **Written** (one PATCH, HTTP 200): What's New = text (a), extracted by
  script from `whats-new.md`, three paragraphs separated by single blank
  lines, 674 characters; promotional text restored from
  `appstore/LISTING.md` (137 characters).
- **Read back against `appstore/LISTING.md`, after the writes and again after
  submitting** (fresh GETs, exact string equality, all MATCH):
  - version: copyright (16); `releaseType` `AFTER_APPROVAL`, no earliest
    release date, no phased release; build 1.0.51.1;
  - en-US version localization (the only one): description (3,233),
    keywords (97), promotional text (137), marketing URL (30), support URL
    (37), What's New (674, byte-identical to text (a));
  - both app-info records (`c4c12b5b`, the live `READY_FOR_SALE` one, and
    `d0fcd6d1`, the editable one): name (9), subtitle (27), privacy policy
    URL (43), primary category REFERENCE, secondary category WEATHER.
- **App Review notes:** carried over to the new record's review detail
  (`a4d592c5`), byte-identical to `appstore/REVIEW_NOTES.md` at 3,898
  characters, contact details present, no demo account required. Checked
  again after submitting: identical. Nothing was written.
- **Screenshots:** both sets carried over (`APP_IPHONE_67` and
  `APP_IPAD_PRO_3GEN_129`, six each, all `COMPLETE`). All twelve checksums
  match `appstore/screenshots/iphone-6.9/` and `ipad-13/` at this ship's
  tree (`209fd30a`) by md5, in order 01 to 06. Nothing was uploaded. Note:
  `origin/main` gained `eca0be1f` from the 1.0.52 session while this leg
  ran, which replaces the committed iPad `05-species-detail.png` with a shot
  of 1.0.52's First of Year card (md5 `db15c9e3...`). That shot is correct to
  leave off this record (build 1.0.51.1 has no such card) and goes up with
  the record that carries 1.0.52, so against the current tree the iPad 05
  checksum differs by design; the other eleven match.
- **Age-rating declaration** (editable app info `d0fcd6d1`): every
  questionnaire field answered, all consistent with `appstore/LISTING.md`
  (every content field NONE; gambling, unrestricted web access,
  user-generated content, social media, social media age-restricted,
  messaging, advertising, loot boxes, parental controls, age assurance and
  health topics all false; overrides NONE). Null only: `kidsAgeBand` and
  `developerAgeRatingInfoUrl` (not blockers on a non-Kids app, per the
  runbook) and `gracRatingClassificationNumber` (Korea's GRAC number, not
  applicable). Nothing was changed.
- **Submitted.** `POST /v1/reviewSubmissions` (IOS, app 6787719977): HTTP
  201, `ba562487-985f-4aaf-8cbe-b455101692ba`, `READY_FOR_REVIEW`; `POST
  /v1/reviewSubmissionItems` with the version: HTTP 201; `PATCH submitted:
  true`: HTTP 200. Review submission
  **`ba562487-985f-4aaf-8cbe-b455101692ba`**, submitted
  2026-10-05T03:36:31Z (20:36 Pacific on 2026-10-04), `WAITING_FOR_REVIEW`.
  The record reads 1.0.51, `WAITING_FOR_REVIEW`, on build 1.0.51.1,
  `AFTER_APPROVAL`, no phased release.
- **Reconciliation.** All 22 version records listed (1.0.51 in review, every
  other `READY_FOR_SALE`) against every TestFlight train from 1.0.13 to
  1.0.52: every version from 1.0.13 to 1.0.51 without a record of its own is
  accounted for in CLAUDE.md's App Store list (the three skips, the rollups,
  1.0.25's deferral, 1.0.37's TestFlight-only release). 1.0.52 holds VALID
  build 1.0.52.1 (`b3410c78`) and no record, pending its own session's store
  leg (`pipeline/species-first-of-year/decisions.md`, D2), not a skip. The
  1.0.51 entry is written into CLAUDE.md's App Store list in this commit.
