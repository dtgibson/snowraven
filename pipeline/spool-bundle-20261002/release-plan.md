# Release plan: 1.0.46 (Spool bundle 20261002)

Drafted 2026-10-02 in phase 1 against `main` at `03980ee`. The Help refresh then landed on `origin/main` as `8934f19`; see (a).

**Status (2026-10-02): shipped on every leg.** The plan below is kept as drafted, and this section records what was done with it.

**(a) and (b): the release and the iOS stamp.**

- Release commit `7c939a0` is tagged `v1.0.46`. The iOS stamp commit is `9a9f478`.
- Windows CI run `37068533837`, on the tag commit, passed.
- `release.sh` published https://github.com/dtgibson/snowraven/releases/tag/v1.0.46. The DMG was downloaded back from the release:
  - its signature checks as valid;
  - its staple validates;
  - Gatekeeper accepts it as Notarized Developer ID.
- `latest.json` is at 1.0.46 for `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64`.
- The website shows v1.0.46.
- TestFlight build 1.0.46.1 (delivery `45148a5b`) is VALID:
  - `--validate-app` passed before the upload;
  - the widget Swift tests passed 143 of 143 on the iPhone 17 simulator first.

**(c): the App Store leg.**

- The user checked build 1.0.46.1 on their own device and approved the What's New word for word, with the optional Help sentence.
- Record `0d823282-fa3d-4276-87c7-209a0cf6cea8` was submitted as `c3fbb8c7-5b7b-4cca-9043-f26c828ed1f8` and reads `WAITING_FOR_REVIEW`.
- `whats-new.md`, beside this file, holds every read-back.

**CI.** Pipeline run `37071637395`, on `30a2554`, is the run of record. It contains everything shipped, and it was green:

- The backend job passed.
- The frontend job passed lint, typecheck and the vitest suite (431 files passed, 5 skipped) on Node 20.20.2. `parseBarChart.test.ts` was 55 of 55 (build 3).
- The real-engine gate was 7 of 7 harnesses green in Chromium and WebKit on Ubuntu, `verify-plan-daylabels.mjs` PASS (build 5).
- Run `37066670579`, on `8934f19` (the bundle plus the Help refresh), was green on the same points.
- The runs on `03980ee`, `7c939a0`, `9a9f478` and `446c18e` were each cancelled by the next push to `main`. Their backend jobs had passed.

**Not in 1.0.46.** After the tag, `de6df5e` changed one paragraph of `docs/HELP.md`, the Statistics escapee paragraph. `docs/HELP.md` is built into the app, so that edit rides the next release. Its privacy-page changes went live with the website on push.

The bundle carries five builds. Two of them change what a user gets:

- Build 1, widget-refresh-take-turns (iPhone and iPad widgets).
- Build 4, icloud-remove-synced-failure (Settings on Mac, iPhone and iPad).

Builds 2 (dev-dependency-advisories), 3 (barchart-speed-check-ci) and 5 (planner-check-ci-race) are dev- and test-only. They get no CHANGELOG line, under CLAUDE.md's Versioning rule and their own briefs.

## (a) CHANGELOG entry

**Update, during phase 1:** the Help refresh has landed. `origin/main` is now `8934f19`, a fast-forward over `03980ee` that adds `f1006c1`, `c3a2a1d`, `6bb4243` and the merge.

- Commit `6bb4243` records the user's approval of the privacy-policy, privacy-page and accessibility wording: "Approved by the user on 2026-10-02 from the held patch".
- So the entry to use is **"With the Help refresh"**, directly below.
- Local `main` in this checkout is still at `03980ee`. Fast-forward it before the bump.

### With the Help refresh (USE THIS ONE)

The `### Changed` bullets are copied word for word from `pipeline/help-docs-refresh/changelog-line.md` on `origin/main`. That copy is byte-identical to the one in the Help worktree. Set the date to the day it ships.

```markdown
## [1.0.46] - 2026-10-02

### Changed
- **The in-app Help is brought up to date.** Its tab sections now run in the same order as the app's own tabs, and it covers what has shipped since it was last read whole: the iPhone and iPad apps wherever it lists where SnowRaven runs or where your files and keys are kept, the welcome screen and where Help itself opens, Settings' Help & Documentation section, Show non-bird on Multimedia, the Target Species picker and Filter by Type chips on Media Targets, the Alerts inbox in Search, and Plan filling in your location. It corrects several labels and descriptions that had drifted: the Find Hotspots button, Multimedia's Show subspecies switch (off by default), Install update and restart (the app restarts by itself), Rebuild caches on iPhone and iPad, the Targets tab's default sort, and where a bar-chart file is kept on a web or Raspberry Pi install. The same text is the online documentation linked from the website.
- The privacy policy and its web page now mention Copy iCloud details and the Weather tab's Plan form reading your location, and say that, with iCloud Sync on, the Targets tab's day-by-day answers are copied to your own iCloud account; the accessibility statement names the iPhone and iPad apps in its opening, updates its Calendar example, and no longer counts the tabs that announce a load failure.

### Fixed
- On iPhone and iPad, home-screen widgets on the same Measure from choice that refresh at the same moment, as they do after you save your eBird key or Default Location, now make one eBird request between them instead of one each, and each shows what that request brought back. Widgets on one choice now make at most one eBird request in 15 minutes even when they refresh together, as Help says, and a Home Screen that mixes My location and Default Location widgets makes at most one for each.
- In Settings' iCloud Sync section (Mac, iPhone and iPad), **Remove synced files from iCloud** now says when it cannot finish. A line under the button reads "Some synced files may still be in iCloud. Try again.", screen readers announce it, and the button stays so you can try again. Until now, a removal that iCloud refused or that timed out showed nothing. Help describes it.
```

### Bundle only (superseded: use this only if the Help refresh were reverted off `main`)

Set the date to the day it ships.

```markdown
## [1.0.46] - 2026-10-02

### Fixed
- On iPhone and iPad, home-screen widgets on the same Measure from choice that refresh at the same moment, as they do after you save your eBird key or Default Location, now make one eBird request between them instead of one each, and each shows what that request brought back. Widgets on one choice now make at most one eBird request in 15 minutes even when they refresh together, as Help says, and a Home Screen that mixes My location and Default Location widgets makes at most one for each.
- In Settings' iCloud Sync section (Mac, iPhone and iPad), **Remove synced files from iCloud** now says when it cannot finish. A line under the button reads "Some synced files may still be in iCloud. Try again.", screen readers announce it, and the button stays so you can try again. Until now, a removal that iCloud refused or that timed out showed nothing. Help describes it.
```

### How the Help refresh fits

- Its Help keeps build 4's clause, "stays after a removal that cannot finish". Checked on `origin/main`.
- `### Changed` goes above `### Fixed`, following the repo's order: Added, Changed, Fixed, Internal.
- At bump time, read `pipeline/help-docs-refresh/changelog-line.md` from the fast-forwarded `main` again and diff it against the two bullets above, in case it has changed.

## (b) Version bump and iOS stamp

### The release commit

Message: `chore(release): 1.0.46, <summary>`, following the precedent of `7c20c17` at 1.0.45. It touches five files:

| File | Change |
|---|---|
| `frontend/package.json` | `"version": "1.0.45"` to `"1.0.46"` |
| `frontend/package-lock.json` | the root `version` and `packages[""].version`, to 1.0.46. The 1.0.45 release commit changed this file too. |
| `src-tauri/tauri.conf.json` | `"version": "1.0.45"` to `"1.0.46"`. This is the desktop bundle version and the updater's version check. |
| `CHANGELOG.md` | the entry in (a), at the top |
| `website/index.html` | line 48: the `version-pill` text `v1.0.46` AND `aria-label="Version 1.0.46"`. Line 518: the `footer-version` text `SnowRaven v1.0.46 · Free &amp; open source`. This is a version stamp only, so it needs no copy approval. |

### Checks before the commit

- Run `cd frontend && npx vitest run src/lib/icloudKeysPublishedClaims.test.ts -t "website version pill"`. Its guard is a substring check, so also read lines 48 and 518 yourself and confirm all three strings say 1.0.46.
- Run `npx vitest run src/lib/iosSceneManifest.test.ts`. The iOS plist sits at 1.0.45, behind, until the stamp, and the guard allows that because it checks only that the plist never leads.
- Run `npm run typecheck`.
- Grep the five files for a leftover `1.0.45`.

### Rhythm

1. Commit and push `main`.
2. Push the tag `v1.0.46` to start Windows CI. Watch that run with `gh run list --workflow windows-build.yml --commit <tag sha>`.
3. Build iOS during the CI wait, following the skill's iOS section:
   - Move the old `src-tauri/gen/apple/build/snowraven_iOS.xcarchive` aside.
   - Recreate all three `/tmp/xcshim` shims, `swift` included.
   - Map `APPLE_API_KEY`, `APPLE_API_ISSUER` and `APPLE_API_KEY_PATH`.
   - Run `tauri ios build --export-method app-store-connect --build-number 1`, outside the sandbox.
   - Confirm the archive's `CFBundleVersion` is `1.0.46.1`.
   - Run the widget Swift tests first. Build 1 changed `RefreshEngine.swift`.
   - Ad-hoc sign the archived `.appex` with its entitlements.
   - Do the manual export with `~/.tauri/snowraven-ios-export-options.plist`.
   - Check `DistributionSummary.plist`: both bundle ids, the App Group, and the three iCloud keys.
   - Run `altool --validate-app`, then `--upload-app`.
4. **Commit the iOS stamp:** `chore(ios): stamp iOS 1.0.46 build 1`, following the precedent of `63e5c3b`.
   - `src-tauri/gen/apple/snowraven_iOS/Info.plist`: `CFBundleShortVersionString` to 1.0.46 and `CFBundleVersion` to 1.0.46.1.
   - `src-tauri/gen/apple/snowraven_widgets/Info.plist`: `CFBundleVersion` to 1.0.46.1.
   - Commit before `release.sh`, whose clean-tree preflight requires it.
   - Pushing the stamp cancels the tag commit's Pipeline run. The stamp commit's run is the one of record.
5. Run `zsh -lc ./release.sh`. Then check the published DMG for its signature, staple and Gatekeeper acceptance, and check `latest.json` at 1.0.46 for `darwin-aarch64`, `darwin-x86_64` and `windows-x86_64`.
6. Ask the user to check build 1.0.46.1 on their own device (below). Then take the App Store leg as set out in (c).
7. At closeout:
   - Add a 1.0.46 ship entry to CLAUDE.md's version-record list. It should include "1.0.45 is RESOLVED", because that list still records 1.0.45 as WAITING_FOR_REVIEW.
   - Add the DECISIONS.md entry.
   - Restate the records build 1 names: CLAUDE.md's pacing bullet ("refreshes that overlap can each ask"), DECISIONS v1.0.44's accepted gap, ROADMAP's Widget Measure-from residual (1), and `.claude/rules/testing.md` v1.0.44 (2).
   - Mark ROADMAP's bar-chart speed-check item fixed (build 3) and the daylabels Escape item fixed (build 5).

### Device check for the user (exact steps; agents never touch a device)

Install TestFlight build 1.0.46.1 and open SnowRaven once. Then:

1. On the Home Screen, wait for a Nearby Lifers or Media Targets widget to show a list, and tap it. It should open Map Explorer.
2. In Settings, the iCloud Sync section should look as it did before, and Help should open.

Report "looks good" or what you saw.

## (c) App Store

### Draft What's New for 1.0.46

This is published copy. The user must approve it word for word before it is written to App Store Connect.

> Home-screen widgets that refresh at the same time now make one eBird request between them. In Settings, Remove synced files from iCloud now tells you when it could not finish.

The Help refresh now rides this release, so one optional sentence can follow: "Help is brought up to date."

### Disposition: the expected choice no longer exists

App Store Connect, read on 2026-10-02 (read-only, metadata key):

- **1.0.45 is `READY_FOR_SALE`.** Its record is `73b6e8ac`, on build 1.0.45.1 (`b17f8828`). Submission `e79c0e48` is `COMPLETE`. Apple approved it, and it released on approval (`AFTER_APPROVAL`).
- No record is waiting for review or being prepared.

That rules out both choices the deploy brief expected:

- **Defer 1.0.46 behind 1.0.45's record in review:** not possible. Nothing is in review to defer behind.
- **Withdraw 1.0.45 and roll it into 1.0.46:** not possible. A `READY_FOR_SALE` record cannot be withdrawn, and Apple has closed the 1.0.45 train to new builds.

The real choice:

1. **Submit 1.0.46 on its own new record** (recommended; this is the standing rhythm). Create the record on build 1.0.46.1 after the user's device check, with the approved What's New. Then read back every listing field against `appstore/LISTING.md`. Promotional text arrived empty on new records at 1.0.35 and at 1.0.42.
   - **Age rating.** A new record opens an editable app-info record. Check the age-rating declaration's unanswered fields, then submit. That declaration can be edited only at this point.
   - **Screenshots.** No screenshot needs recapturing. Both sets (iPhone 6.9 and iPad 13) show Map Explorer, Statistics, Weather, Calendar, Species Detail and Breeding Codes. None shows a widget, Settings or Help.
   - **App Review notes.** These should need no change. Check that they still match `appstore/REVIEW_NOTES.md` byte for byte.
   - `AFTER_APPROVAL`, no phased release.
2. **Ship 1.0.46 to TestFlight only, and defer the store leg.** Allowed only as a written deferral with a reason, entered in CLAUDE.md's version-record list in the same ship. Nothing in this bundle argues for it.

### Version-record reconciliation (CLAUDE.md rule; live query, 2026-10-02)

- **Version records:** 1.0.4, 1.0.13, 1.0.14, 1.0.17, 1.0.19, 1.0.21, 1.0.23, 1.0.24, 1.0.27, 1.0.28, 1.0.30, 1.0.31, 1.0.32, 1.0.34, 1.0.35, 1.0.36, 1.0.38, 1.0.40 and 1.0.45. All 19 are `READY_FOR_SALE`.
- **TestFlight trains:** every one from 1.0.13 through 1.0.45 is present. Recent builds are all VALID.
- **Trains with no record of their own:**

| Versions | Why | Where it is recorded |
|---|---|---|
| 1.0.15, 1.0.16, 1.0.18 | skips | CLAUDE.md |
| 1.0.25 | deferral | CLAUDE.md |
| 1.0.37 | TestFlight-only, by the user's direction | CLAUDE.md |
| 1.0.20, 1.0.22, 1.0.26, 1.0.29, 1.0.33, 1.0.39, 1.0.41, 1.0.42, 1.0.43, 1.0.44 | rollups | CLAUDE.md and `pipeline/settings-tab-hidden-iphone/whats-new.md` |

Every gap has a written reason. There is no unaccounted gap between 1.0.13 and 1.0.45.
