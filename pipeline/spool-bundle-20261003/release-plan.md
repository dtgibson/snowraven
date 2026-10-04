# Release record: 1.0.49 (Spool bundle 20261003)

Shipped 2026-10-03 from `main` by The Deployer, on the user's "Ship it" at the
bundle's production sign-off gate.

**Status: shipped on every leg.** Mac, Windows, website and TestFlight
shipped first. Then the user checked build 1.0.49.1 on their own devices and
chose at the gate to roll 1.0.48 into 1.0.49. Record
`99e3f9ff-4e90-4df0-88c4-a9fe13827b01` was submitted on build 1.0.49.1 as
`f8156470-27cf-4865-9d55-c50e7495f4e6` and is `WAITING_FOR_REVIEW` (section
"App Store: the 1.0.49 record", below). The sections between were written
before that decision and are kept as written.

## What shipped

Five builds rode the bundle; three change what a user gets and carry a
CHANGELOG line, copied word for word from each run's `changelog-line.md`:

| Build | Lane | CHANGELOG | Reaches |
|---|---|---|---|
| desktop-csp-frame-protection | Improve | Changed | Mac, Windows, iPhone, iPad |
| hotspot-links-retry-after-429 | Fix | Fixed | every target |
| sortable-list-links-own-dispatch | Improve | Changed | Mac, Windows, iPhone, iPad |
| targets-focus-scroll-room | Improve | none: declined, no code | nothing |
| weather-capture-test-height | Fix | none: dev-only (`website/tools`) | nothing |

Pre-ship confirmation (the QA and security reports are gitignored, so on disk
only): all four built runs have a `qa-report.md` reading PASSED and a
`security-report.md` reading PASSED or PASSED WITH NOTES, with no Critical or
High finding (CSP: three Lows resolved in-build, three Informational; hotspot
retry: three Informational; link dispatch: two Informational, resolved;
weather capture: none). targets-focus-scroll-room has no reports because it
was declined with no code.

## Commits, tag and CI

- Release commit `448fe51` ("chore(release): 1.0.49, ..."): the four-file bump
  (`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`,
  `website/index.html` pill text, pill `aria-label` and footer) plus
  `frontend/package-lock.json`'s two version lines, as 1.0.48's did.
- Tag `v1.0.49` points at `448fe51`.
- iOS stamp commit `c49b0a9` (`snowraven_iOS/Info.plist` and
  `snowraven_widgets/Info.plist` only).
- Before the commit: `icloudKeysPublishedClaims.test.ts`,
  `iosSceneManifest.test.ts` and `tauriCsp.test.ts` 80 of 80 green;
  `npm run build` rc 0. Each of the website's three version sites was checked
  separately, because the parity guard's substring check cannot see the
  `aria-label`.
- **Windows CI `37149384514`** on the tag commit `448fe51`: success.
- **Pipeline:** the runs on `c82f16b` (`37149174644`) and `448fe51`
  (`37149382968`) were each cancelled by the next push to `main`, as the
  runbook expects. The run of record is `37149850123` on `c49b0a9`, which
  contains everything shipped: **success**. The backend job passed (pytest
  2,060 passed, 1 skipped). The frontend job passed lint, typecheck, the vitest
  suite on Node 20.20.2 (436 files passed, 5 skipped; 9,289 tests passed, 26
  skipped) and the build. The real-engine verification gate ran 7 of 7
  harnesses green.

## Mac and Windows (`release.sh`)

`zsh -lc ./release.sh` from the repo root, rc 0, with nothing else using the
shared `~/.snowraven-build` and no dev watcher running.

- Preflight passed (Developer ID profile OK for `8QKC3L2FKP.com.snowraven`,
  container present; login keychain unlocked; Node 24 per `.nvmrc`).
- Bundle version verified 1.0.49; iCloud entitlements and the embedded profile
  verified in the universal `.app`.
- DMG styled, then signed. **Notarization submission
  `a4171f81-0f4d-4a3f-b8a1-ac3c71405484`: Accepted**, stapled.
- Windows: the tag existed locally, so `release.sh` pinned its CI query to the
  tag's commit; the only successful `windows-build.yml` run on `448fe51` is
  `37149384514`. The installer was signed locally.
- Published https://github.com/dtgibson/snowraven/releases/tag/v1.0.49 (not a
  draft, not a prerelease): `SnowRaven_1.0.49_universal.dmg`,
  `SnowRaven-updater.app.tar.gz` and `.sig`,
  `SnowRaven_1.0.49_x64-setup.exe` and `.sig`, `latest.json`.
- Downloaded back from the release and checked independently:
  - `codesign --verify --verbose=2`: valid on disk, satisfies its Designated
    Requirement;
  - `xcrun stapler validate`: worked;
  - `spctl -a -t open --context context:primary-signature -vv`: accepted,
    `source=Notarized Developer ID`.
- `latest.json`: version 1.0.49; `darwin-aarch64` and `darwin-x86_64` both
  point at the one universal `SnowRaven-updater.app.tar.gz` with the same
  signature; `windows-x86_64` points at `SnowRaven_1.0.49_x64-setup.exe`.

## Website

Pages run `37149382971` (on `448fe51`): success. The live site
(https://snowraven.dtgibson.com/, where the Pages URL redirects) reads
`aria-label="Version 1.0.49"`, `v1.0.49` in the pill and
`SnowRaven v1.0.49` in the footer, each checked on its own. No other change to
`website/`, `README.md`, `appstore/LISTING.md`, `PRIVACY_POLICY.md` or
`docs/HELP.md`.

## iOS (TestFlight)

- Widget extension Swift tests on the local iPhone 17 simulator: 143 of 143
  passed (`snowraven_widgetsTests`, timeouts enabled), before the archive.
- The previous archive was present, as at every ship that has looked: a 1.0.48.1
  `snowraven_iOS.xcarchive`, moved aside to
  `snowraven_iOS-1.0.48.1-stale-before-1.0.49.xcarchive` before the build. All
  three `/tmp/xcshim` shims were recreated first.
- `tauri ios build --export-method app-store-connect --build-number 1`, run
  outside the sandbox with the mapped signing variables. The archive succeeded;
  Tauri's own export refused with "No Account for Team" / "No profiles found",
  the third wording of the expected cloud-signing refusal.
- The fresh archive was confirmed by its stamp, not its presence:
  `CFBundleVersion` 1.0.49.1, `CFBundleShortVersionString` 1.0.49 (the widget
  extension the same); `vtool` reports `platform IOS`, `minos 16.0`; all 9
  `out/swift-rs/**/lib*.a` report platform 2 (iOS).
- The build also re-quoted `PRODUCT_NAME` in `project.pbxproj` (an equivalent
  spelling). The 1.0.48 stamp commit carried only the two plists, so it was
  restored rather than committed.
- The archived `snowraven_widgets.appex` was "not signed at all", as the
  runbook warns; it was signed ad hoc with
  `snowraven_widgets.entitlements` and then listed the App Group.
- Manual export with `~/.tauri/snowraven-ios-export-options.plist` succeeded.
  `DistributionSummary.plist`: the extension
  (`com.dtgibson.snowraven.widgets`, profile "SnowRaven Widgets App Store")
  carries `group.com.dtgibson.snowraven` and nothing else; the app
  (`com.dtgibson.snowraven`, profile "SnowRaven iOS App Store iCloud AppGroup
  20260924") carries the group plus the three iCloud keys and
  `icloud-container-environment` Production. Both at build 1.0.49.1.
- `altool --validate-app`: VERIFY SUCCEEDED with no errors.
- `altool --upload-app`: UPLOAD SUCCEEDED, **Delivery UUID
  `3eddc6b9-0017-48cc-9f0c-82580d98ee33`**.
- **TestFlight: build 1.0.49.1 is `VALID`** (uploaded 2026-10-03, build id
  `3eddc6b9`), read back from `GET /v1/builds`.
- **The device check is the user's:** they installed build 1.0.49.1 from
  TestFlight on their own devices and reported "app launches and looks good".
  No agent touched a physical device.

## App Store: the live query (read-only, 2026-10-03)

Version records, the eight newest of the twelve returned
(`GET /v1/apps/6787719977/appStoreVersions`, metadata key `QJA25M7XHM`, GET
only; the other four, 1.0.31, 1.0.30, 1.0.28 and 1.0.27, are also
`READY_FOR_SALE`):

| Version | State | Record | Build |
|---|---|---|---|
| 1.0.47 | READY_FOR_SALE | `0d823282` | 1.0.47.1 |
| 1.0.45 | READY_FOR_SALE | `73b6e8ac` | 1.0.45.1 |
| 1.0.40 | READY_FOR_SALE | `203ea1fd` | 1.0.40.6 |
| 1.0.38 | READY_FOR_SALE | `63dc73df` | 1.0.38.1 |
| 1.0.36 | READY_FOR_SALE | `773cd204` | 1.0.36.3 |
| 1.0.35 | READY_FOR_SALE | `cfa11d7b` | 1.0.35.1 |
| 1.0.34 | READY_FOR_SALE | `f380012a` | 1.0.34.1 |
| 1.0.32 | READY_FOR_SALE | `34a97cc3` | 1.0.32.1 |

Review submissions: `503d3481` (1.0.47) COMPLETE, `c3fbb8c7` (1.0.46,
withdrawn into 1.0.47) COMPLETE, and every earlier one COMPLETE. No record is
in preparation or in review.

TestFlight trains, newest upload first: 1.0.49.1 VALID (this ship), 1.0.48.1 VALID
(`c0484168`), 1.0.47.1 VALID, 1.0.46.1 VALID, 1.0.45.1 VALID, 1.0.44.1 VALID,
1.0.43.1 VALID, 1.0.42.1 VALID, 1.0.41.1 VALID, 1.0.40.1 to 1.0.40.6 VALID.

Re-derived over the whole account (all 20 version records, every one
`READY_FOR_SALE`, and every TestFlight train through 1.0.49): the trains from
1.0.13 to 1.0.47 with no record of their own are 1.0.15, 1.0.16 and 1.0.18
(the three recorded skips), 1.0.20, 1.0.22, 1.0.25, 1.0.26, 1.0.29, 1.0.33,
1.0.37, 1.0.39, 1.0.41 to 1.0.44, and 1.0.46. Each has its sentence in
CLAUDE.md's App Store list (rollup, deferral resolved, or TestFlight-only by
decision), so there is no unaccounted gap between 1.0.13 and 1.0.47. **1.0.48** has VALID build 1.0.48.1 and no record, deferred behind
1.0.47 in writing at its own gate; the condition that deferral named
("once `0d823282` is `READY_FOR_SALE`") **is now met**. **1.0.49** has build
1.0.49.1 and no record yet, pending the user's device check.

## The App Store disposition (as offered; shape 2 was chosen)

After the user's own device check of build 1.0.49.1, one of:

1. **1.0.48 on its own record first** (build 1.0.48.1, its approved text in
   `pipeline/upload-origin-table-wrap-copy/whats-new.md`), with 1.0.49 deferred
   behind it, or rolled into it later while it is still `WAITING_FOR_REVIEW`.
2. **1.0.48 rolled into 1.0.49:** one record on build 1.0.49.1 carrying both;
   nothing to withdraw, since 1.0.48 never had a record (precedent: 1.0.39 into
   1.0.40, 1.0.41 into 1.0.42).

The What's New for each shape is a HELD proposal in `whats-new.md` beside this
file, not written to App Store Connect. Whichever shape is chosen, CLAUDE.md's
App Store list gets its sentence for 1.0.48 and 1.0.49 in the same ship, and
every listing field is read back on any new record (promotional text has
arrived empty three times). No screenshot change under either shape.

## App Store: the 1.0.49 record (2026-10-03)

**The user's decision.** The user checked TestFlight build 1.0.49.1 on their
own devices ("app launches and looks good") and chose at the gate to roll
1.0.48 into 1.0.49, approving text (b) in `whats-new.md` word for word. Nothing
was withdrawn: 1.0.48 never had a record, and `0d823282` was already
`READY_FOR_SALE`.

**The record.**

- Created `99e3f9ff-4e90-4df0-88c4-a9fe13827b01`: version 1.0.49, platform
  IOS, `AFTER_APPROVAL`, no earliest release date, copyright "2026 Dave Gibson"
  from `appstore/LISTING.md`.
- Build 1.0.49.1 (`3eddc6b9-0017-48cc-9f0c-82580d98ee33`): `VALID`,
  `usesNonExemptEncryption` false.
- No phased release: `appStoreVersionPhasedRelease` reads none.

**Read back against `appstore/LISTING.md` on the new record, before and after
the write.**

- **Promotional text arrived EMPTY**, the fourth time (after 1.0.35, 1.0.42
  and 1.0.46). It was restored from `LISTING.md` (137 characters) and reads
  back MATCH.
- **What's New** (it arrives empty on a new record) was written as text (b),
  705 characters: 1.0.48's approved paragraph followed by the two approved
  1.0.49 paragraphs. It was taken from `whats-new.md` by script, not retyped,
  and reads back byte for byte.
- These carried over and read back MATCH:
  - description (3,233), keywords (97), marketing URL and support URL;
  - copyright;
  - on the app info: name, subtitle and privacy policy URL; primary category
    Reference, secondary Weather.
- **App Review notes** carried over, and are byte-identical to the "Notes for
  the reviewer" block of `appstore/REVIEW_NOTES.md` at 3,898 characters. The
  contact name, phone and email are present.
- **Age rating:** the only empty field is `gracRatingClassificationNumber`
  (Korea's game rating number). It is empty on the live `READY_FOR_SALE` app
  info too, and was not a blocker.
- **Screenshots were left unchanged.** Both sets (`APP_IPHONE_67`,
  `APP_IPAD_PRO_3GEN_129`, six each) match `appstore/screenshots/iphone-6.9/`
  and `ipad-13/` by md5: 12 of 12, in order, all `COMPLETE`. Neither set shows
  Targets or Settings, and the content security policy changes nothing on
  screen.

**Submission.**

- `POST /v1/reviewSubmissions`, then `POST /v1/reviewSubmissionItems`, then
  `PATCH submitted: true`: review submission
  **`f8156470-27cf-4865-9d55-c50e7495f4e6`**, submitted 2026-10-04T02:39:55Z
  (2026-10-03, Pacific).
- `WAITING_FOR_REVIEW`. The record reads `WAITING_FOR_REVIEW` too, and every
  field read back again MATCH after submitting.

**Reconciliation (live query after submitting).** There are 21 version
records: 1.0.49 is `WAITING_FOR_REVIEW` and every other one is
`READY_FOR_SALE`. The TestFlight versions from 1.0.13 to 1.0.49 with no record
of their own are the 17 that CLAUDE.md's App Store list accounts for:

- 1.0.15, 1.0.16, 1.0.18;
- 1.0.20, 1.0.22, 1.0.25, 1.0.26, 1.0.29, 1.0.33, 1.0.37, 1.0.39;
- 1.0.41 to 1.0.44, 1.0.46;
- 1.0.48, now by rollup into 1.0.49.

So the live query leaves no unaccounted gap between 1.0.13 and 1.0.49.

**CLAUDE.md** gained two entries, uncommitted here because the Chronicler
commits the records:

- 1.0.48 into 1.0.49 in the inline rollup list;
- the "ENTRIES FROM THE 1.0.49 SHIP" entry at the end of the App Store bullet.

## Not done, and why

- **Nothing is committed** from this stage's records (this file,
  `whats-new.md`, `CLAUDE.md`). The Chronicler commits the records.
- **Commit attribution.** The two commits carry
  `Co-Authored-By: Claude Opus 5.5`, the attribution this session's harness
  specified, rather than the `Claude Fable 5.1` line in the hand-off; 1.0.48's
  release commit used the same Opus 5.5 line.
