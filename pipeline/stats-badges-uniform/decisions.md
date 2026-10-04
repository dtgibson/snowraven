# Decisions: Stats Badges Uniform (deployment)

Improve lane, design pass. These are the ship-stage decisions, written by
the Deployer. The design decisions are in `design-refinement.md` and
`pipeline/design-system.md`; the one measured spec deviation (track minimum
7.25rem, not 7.5rem) is in `pr-description.md`.

## 1. Pre-deploy reconciliation (2026-10-03)

- Branch base `c49b0a9`. After `git fetch origin`, `origin/main` was
  `995feba` ("chore: context update after the 1.0.49 Spool bundle"), one
  commit ahead. It touches only records (`.claude/rules/*`, `CLAUDE.md`,
  `DECISIONS.md`, `PRODUCT_CONTEXT.md`, `ROADMAP.md`,
  `pipeline/spool-bundle-20261003/`) and none of this build's files.
- This build's work was committed first (`21c79fd`), then `origin/main` was
  merged INTO this branch (`a58ae97`), with no conflicts.
- Regression basics on the merged tree, run from `frontend/`:
  - `npm run typecheck`: exit 0.
  - `npx vitest run`: 9,308 passed, 7 skipped, 1 failed, of 9,316. The one
    failure is the wall-clock ratio row in `weatherStatsShared.test.ts`
    ("grows about 2x per doubling ...", 3.51 against a limit of 3), at a load
    average of 18 while other sessions were building. This build does not
    touch that file. Re-run alone: 24 of 24 passed. Judged a load reading,
    per `.claude/rules/testing.md`, not a regression.
  - `npm run build`: succeeded; the only warning is the existing chunk-size
    notice for the taxonomy and county chunks.
  - An earlier run launched from the worktree root, not `frontend/`, reported
    18 failed files. Every failure was a guard reading `src/...` relative to
    the working directory (ENOENT). That run was discarded as an instrument
    error, not counted.

## 2. Version number and the parallel-ship check

Version **1.0.50**, the next patch. Checked before taking it:

- Tags: newest `v1.0.49`; the remote has no `v1.0.5x` tag beyond the old
  `v1.0.5`.
- GitHub releases: newest `v1.0.49` (Latest, 2026-10-03).
- CI: the newest runs are on `995feba` (Pipeline, success) and the 1.0.49
  tag and stamp commits. No run on an unknown commit.
- App Store Connect (read-only GET, metadata key): record `99e3f9ff`
  (1.0.49, build 1.0.49.1) is `WAITING_FOR_REVIEW` as submission
  `f8156470`; 1.0.47 and every earlier record listed are `READY_FOR_SALE`.
  Newest TestFlight build 1.0.49.1 `VALID`; no 1.0.50 build exists.
- Other work in progress, read from committed branch refs only (no other
  worktree was entered or touched):
  - The main checkout is on a Spool branch, `weft-spool/20261004-031125`,
    with one fix committed (`a0f770c`, map-recency-dst-colors) and no version
    bump. Whichever of the two ships second takes the next number and
    reconciles `CHANGELOG.md`'s top entry.
  - `worktree-android-release` (locked, active build) carries version 1.0.48
    and a stale `[1.0.49] - unreleased` changelog section, so it renumbers
    when it lands. It has not claimed 1.0.50.
  - `worktree-species-first-of-year` (locked) sits at `995feba` with no
    commits of its own.
  No release was mid-flight for 1.0.50.

## 3. The four-file version set

`frontend/package.json` (and the two version lines in
`frontend/package-lock.json`, as the 1.0.49 bump did), `src-tauri/tauri.conf.json`,
`CHANGELOG.md`, and `website/index.html`'s version pill (visible text and
`aria-label`) and footer line. Nothing else in `website/` changed. The
parity guards `icloudKeysPublishedClaims.test.ts` and
`iosSceneManifest.test.ts` passed (61 of 61), and a grep confirms the pill,
its label and the footer each read 1.0.50 with no 1.0.49 left in those
places.

The changelog entry was written against the shipped code (the diff of the
milestones block), not the PR description: uniform size, an even grid with
the last row in the same columns, threshold then species then date, long
names wrapping with their marks, thousands separators, the "Life list
milestones" label, the check mark and leading divider removed, and a list
for screen readers.

## 4. Published surfaces

- README, website copy, App Store listing copy and the privacy policy are
  untouched. The website changes only by its version stamp.
- Screenshots: all five published Statistics shots
  (`appstore/screenshots/ipad-13/02-statistics.png`,
  `appstore/screenshots/iphone-6.9/02-statistics.png`,
  `website/assets/shots/statistics.webp`, `statistics-dark.webp`,
  `statistics-mobile.webp`) were opened and checked: each stops at Life List
  Totals or the top of Top Species, so none shows a milestone badge and none
  needs recapturing.
- `docs/HELP.md`'s Firsts and Milestones paragraph stays true (QA checked; it
  never named the check mark), so it is unchanged.

## 5. The App Store leg is a separate decision

The production confirm covers the desktop release and the TestFlight upload
only. The App Store submission waits for the user's own device check of
TestFlight build 1.0.50.1, and then needs its own choice, because 1.0.49's
record `99e3f9ff` is `WAITING_FOR_REVIEW`: defer 1.0.50 behind it (its own
record once 1.0.49 is `READY_FOR_SALE`), or withdraw 1.0.49 and roll it into
1.0.50. Either way a 1.0.50 What's New line needs the user's yes before it is
written to App Store Connect. Whatever is chosen is recorded in CLAUDE.md's
App Store list in the same ship.

## 6. Deployment record (2026-10-03, Pacific; UTC in brackets)

The user answered the production sign-off gate: "ship, but remember no
changes to readme or website without my okay". Nothing in `README.md` or
`website/` changed beyond the version pill and footer they had already seen.

- **Main.** `git push origin HEAD:main`, a fast-forward `995feba..a1fdcd5`
  (21:33 [04:33]), from this worktree; the main checkout was not touched.
  Main had not moved since Phase A, so no second merge was needed.
- **Commit trailers.** The coordinator asked for the trailers to be
  rewritten to `Claude Fable 5.1` before the push. Not done: these commits
  were authored by Claude Opus 5.5, which is the attribution line the session
  specifies and the one the repo's earlier release commits carry, and the
  instruction did not come from the user's own settings. The brief allowed
  pushing as-is; the commits shipped with `Claude Opus 5.5`.
- **Tag.** `v1.0.50` (lightweight, like `v1.0.49`) on `a1fdcd5`.
- **Windows CI.** `windows-build.yml` run `37177343538`, success, `headSha`
  `a1fdcd5de180942b764f3482d7193afd0ac32761`, equal to the tag's commit, and
  the only successful Windows run on it. `release.sh` pins its lookup to the
  tag's commit.
- **Desktop release.** `CI=true zsh -lc ./release.sh`, exit 0, with no other
  release or dev watcher using `~/.snowraven-build`.
  - Preflight passed, including the Developer ID profile
    (`<team>.com.snowraven`, container present, expires 2044-08-27).
  - Bundle version verified 1.0.50, with the iCloud entitlements and the
    embedded profile.
  - DMG styled and signed. Notarization `1f3c3f89-2cf9-45fa-ac70-76a2a147a640`
    Accepted, then stapled. Windows installer signed locally.
  - Published https://github.com/dtgibson/snowraven/releases/tag/v1.0.50
    at 04:49:39Z (not a draft, not a prerelease):
    `SnowRaven_1.0.50_universal.dmg`, `SnowRaven-updater.app.tar.gz` and
    `.sig`, `SnowRaven_1.0.50_x64-setup.exe` and `.sig`, `latest.json`.
  - The DMG was downloaded back from the release and checked on its own:
    `codesign --verify` valid and satisfies its Designated Requirement;
    `stapler validate` worked; `spctl ... primary-signature` accepted,
    `source=Notarized Developer ID`.
  - `latest.json` (HTTP 200 from `releases/latest/download`): version 1.0.50;
    `darwin-aarch64` and `darwin-x86_64` point at the one universal updater
    bundle with the same signature; `windows-x86_64` points at
    `SnowRaven_1.0.50_x64-setup.exe`.
- **Website.** Pages run `37177333867` on `a1fdcd5`: success. The live site
  (https://snowraven.dtgibson.com/) reads `aria-label="Version 1.0.50"`,
  `v1.0.50` in the pill and `SnowRaven v1.0.50` in the footer, each checked
  on its own.
- **iOS (TestFlight).**
  - Widget extension Swift tests on the local iPhone 17 simulator (iOS
    26.4): 143 of 143 passed, before the archive.
  - No earlier archive existed in this worktree (first iOS build here, from
    a cold `src-tauri/target`). All three `/tmp/xcshim` shims recreated
    first.
  - `tauri ios build --export-method app-store-connect --build-number 1`,
    outside the sandbox, with Tauri's three signing names mapped from the
    login shell by a launcher so the issuer id stayed off the command line.
    Archive succeeded; Tauri's own export refused with "No Account for Team"
    / "No profiles found", the expected refusal.
  - Fresh archive confirmed by its stamp: app and widget
    `CFBundleShortVersionString` 1.0.50, `CFBundleVersion` 1.0.50.1;
    `vtool` reports `platform IOS`, `minos 16.0`; all 9 swift-rs libraries
    report platform 2 (iOS) on every object, and nothing else.
  - The archived `snowraven_widgets.appex` was "not signed at all"; it was
    signed ad hoc with `snowraven_widgets.entitlements` and then listed the
    App Group.
  - Manual export with `~/.tauri/snowraven-ios-export-options.plist`:
    EXPORT SUCCEEDED. `DistributionSummary.plist`: the app on "SnowRaven iOS
    App Store iCloud AppGroup 20260924" with the App Group and the iCloud
    keys (container identifiers, services, ubiquity, environment Production);
    the extension on "SnowRaven Widgets App Store" with
    `com.apple.security.application-groups` = `group.com.dtgibson.snowraven`
    only. Both at 1.0.50 / 1.0.50.1.
  - `altool --validate-app`: VERIFY SUCCEEDED with no errors.
  - `altool --upload-app`: UPLOAD SUCCEEDED, **Delivery UUID
    `2cac6344-8762-4d25-9edb-96c817bc8abb`** (21:59:57).
  - **TestFlight: build 1.0.50.1 is `VALID`** (read back from `GET /v1/builds`
    at 22:01).
  - Stamp committed as `5f0f0cb` (the two Info.plists only; the build's
    `PRODUCT_NAME` requoting in `project.pbxproj` was restored, not
    committed, as at earlier ships) and pushed to main, a fast-forward. The
    plist guards (`iosSceneManifest`, `iosWidgetManifest`) passed, 55 of 55.
- **CI after the ship.** Pipeline `37177333888` on `a1fdcd5` (the shipped
  code): success. Pipeline `37178571372` on the stamp commit `5f0f0cb` (the
  run of record for the shipped tree): the first attempt's Frontend job
  failed one test of 9,316, `AlertsInboxSheet.test.tsx` > "Clear ... asks
  first; Escape closes only the confirmation ..." (the confirmation dialog
  was still present after Escape). The stamp commit changes only the two
  iOS Info.plists, the identical frontend tree passed that job on
  `a1fdcd5`, and the file passed 5 of 5 runs locally at a load average of
  15, so it was judged a scheduling failure in a pre-existing test, not this
  build. The failed job was re-run once: attempt 2, Frontend and Backend
  both success. The shape matches CLAUDE.md's v1.0.25 rule (a key pressed
  into a `ModalDialog` waits for focus inside the dialog); whether this row
  waits for that is worth a look, and it is noted for the roadmap rather
  than fixed here.
- **App Store leg: deliberately pending at this point** (resolved in
  section 7, below). No 1.0.50 version record was created and no What's New
  was written. Live query after the upload: record
  `99e3f9ff` (1.0.49) is still `WAITING_FOR_REVIEW` as submission
  `f8156470`; 1.0.47 and earlier are `READY_FOR_SALE`. The next step is the
  user's own device check of TestFlight build 1.0.50.1, then their choice
  between deferring 1.0.50 behind 1.0.49 and rolling 1.0.49 into 1.0.50,
  with a 1.0.50 What's New line shown to them for approval first. Until that
  choice is made and written into CLAUDE.md's App Store list, 1.0.50 is a
  VALID build with no record of its own pending a decision, not a skip.

## 7. App Store: 1.0.49 rolled into 1.0.50 (2026-10-03, Pacific)

**The user's decisions**, relayed by the orchestrator: they checked
TestFlight build 1.0.50.1 on their own device ("app looks good"), chose to
roll 1.0.49 into 1.0.50, and approved the What's New word for word ("looks
good"). The approved text and the route are in `whats-new.md` beside this
file. No agent touched a physical device.

All App Store Connect calls used the metadata key, from one script, one step
per run. Every write came only after the read-only check before it.

- **Precheck (read-only).**
  - Record `99e3f9ff-4e90-4df0-88c4-a9fe13827b01` was 1.0.49,
    `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, on build 1.0.49.1, as submission
    `f8156470-27cf-4865-9d55-c50e7495f4e6` (`WAITING_FOR_REVIEW`).
  - Build 1.0.50.1 (`2cac6344-8762-4d25-9edb-96c817bc8abb`) was `VALID`,
    `usesNonExemptEncryption` false.
  - The record's one localization is en-US. Its live What's New was
    byte-identical to the first three approved paragraphs, which confirms
    those are 1.0.49's approved text unchanged.
  - A baseline read-back matched every listing field except What's New, which
    proves the comparison can tell a difference.
- **Withdrawn.** `DELETE /v1/appStoreVersionSubmissions/99e3f9ff...`: HTTP
  204. The record read `DEVELOPER_REJECTED`, and submission `f8156470` went
  `CANCELING`, then `COMPLETE`.
- **Retargeted and repointed.** `versionString` 1.0.49 to 1.0.50 (HTTP 200),
  build relationship to 1.0.50.1 (`2cac6344`, HTTP 204). The record read 1.0.50,
  `PREPARE_FOR_SUBMISSION`, on build 1.0.50.1.
- **What's New.** Written by script from `whats-new.md`, never retyped: four
  paragraphs separated by single blank lines, 963 characters (HTTP 200).
  Read back byte-identical.
- **Read back against `appstore/LISTING.md` and `appstore/REVIEW_NOTES.md`,
  after the writes and again after submitting.** Everything matched, and
  nothing was restored or changed:
  - copyright (16);
  - description (3,233), keywords (97) and promotional text (137, which
    carried over on this retargeted record);
  - marketing and support URLs;
  - on both app-info records (the live `READY_FOR_SALE` one and the editable
    one): name, subtitle, privacy policy URL, and categories Reference
    (primary) and Weather (secondary);
  - the App Review notes: byte-identical to the "Notes for the reviewer"
    block of `REVIEW_NOTES.md` as committed, 3,898 characters, with the
    contact details present;
  - `releaseType` `AFTER_APPROVAL`, no earliest release date, no phased
    release.
- **Screenshots unchanged.** Both sets (`APP_IPHONE_67`,
  `APP_IPAD_PRO_3GEN_129`, six each) match `appstore/screenshots/iphone-6.9/`
  and `ipad-13/` by md5: 12 of 12, in order, all `COMPLETE`. No published
  screenshot shows the milestone badges (section 4).
- **Submitted.** `POST /v1/reviewSubmissions`, then
  `POST /v1/reviewSubmissionItems`, then `PATCH submitted: true`: review
  submission **`7118f6a7-5518-4e9c-8092-fab447bbdcc3`**, submitted
  2026-10-04T05:53:58Z (22:53 Pacific on 2026-10-03), `WAITING_FOR_REVIEW`.
  The record reads 1.0.50, `WAITING_FOR_REVIEW`, on build 1.0.50.1,
  `AFTER_APPROVAL`, no phased release.

**So 1.0.49 holds VALID build 1.0.49.1 (delivery `3eddc6b9`) and no version
record of its own, by rollup, not by skip.** Record `99e3f9ff` was withdrawn
from submission `f8156470` while `WAITING_FOR_REVIEW`, retargeted, repointed
at build 1.0.50.1 and resubmitted as `7118f6a7`. It carries 1.0.48 and
1.0.49 by rollup, and 1.0.50.

**Reconciliation (live query after submitting).**
- There are 21 version records. 1.0.50 (`99e3f9ff`) is `WAITING_FOR_REVIEW`;
  every other record is `READY_FOR_SALE`.
- Of the 38 TestFlight trains from 1.0.13 to 1.0.50, 18 have no record of
  their own:
  - 1.0.15, 1.0.16, 1.0.18 (skips);
  - 1.0.20, 1.0.22, 1.0.26, 1.0.29, 1.0.33, 1.0.39, 1.0.41, 1.0.42, 1.0.43,
    1.0.44, 1.0.46, 1.0.48 (rollups);
  - 1.0.25 (deferral) and 1.0.37 (TestFlight-only);
  - 1.0.49, now by rollup into 1.0.50.
- Each of the first 17 is already in CLAUDE.md's App Store list, and 1.0.49
  is the entry this ship adds. The live query leaves no unaccounted gap
  between 1.0.13 and 1.0.50.

**For the Chronicler (CLAUDE.md's App Store list).** Two entries are owed,
not written here:
- add 1.0.49 into 1.0.50 to the inline rollup list;
- add an "ENTRY FROM THE 1.0.50 SHIP" at the end of the bullet, from this
  section.
