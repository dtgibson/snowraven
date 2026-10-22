# Decisions: ios27-iphone-duo

Improve lane, Stage 3 (The Engineer). The design refinement was approved as is;
the one open call (extend the 16px focus-zoom floor above 640px, iPhone only,
gated on the shortest screen side) was delegated to the orchestrator, who
adopted the Designer's recommendation conditional on the measurement in E1.

## E1. The focus-zoom measurement, and the decision to add the block

**Setup.** Xcode 27.1 (build 27A9275) at `/Applications/Xcode.app`, with
`DEVELOPER_DIR` exported per shell; iOS 27.1 simulator runtime (24A94425);
the iPhone Duo simulator `D0CBEB76-7F70-4CDC-AB71-2A1F989317B7`, a scratch
device created for this run. A probe page (`evidence/zoom-probe.html`) was
served from a scratch folder on 127.0.0.1 and opened in the simulator's Safari
with `xcrun simctl openurl`. It autofocuses one text field at a set size and
sends each reading to the server as a GET, so nothing is read off a picture;
`simctl io screenshot` recorded each run as well.

**What every reading shared** (outer display; all 40 lines are in
`evidence/zoom-probe-readings.txt`): `screen` 466x678, `devicePixelRatio` 3,
`navigator.platform` iPhone, Safari's layout viewport 382x580,
`(max-device-width: 700px)` and `(max-device-height: 700px)` true, the phone
tier `(max-width: 640px)` true, the new gate false (the page is under 641px
wide), and all four `env(safe-area-inset-*)` at 0px because Safari's own chrome
occupies them.

**The counted runs**, each with the software keyboard up (screenshot) so an
input session had started:

| Run | Start state | Field | `visualViewport.scale` | Evidence |
| --- | --- | --- | --- | --- |
| 1 | first page after boot | 13px | 1.231 | `duo-outer-13px-after-boot.png` |
| 2 | after a reboot | 16px | 1.000 | `duo-outer-16px-after-reboot.png` |
| 3 | after `simctl erase` | 13px | 1.231 | `duo-outer-13px-erased.png` |
| 4 | after `simctl erase` | 16px | 1.000 | `duo-outer-16px-erased.png` |

1.231 is 16/13: WebKit zoomed the page so the focused field reads at 16px. In
both 13px runs the layout viewport shrank to 310x471 with the zoom.

**Runs not counted, and why.** A programmatic focus from `openurl` starts an
input session only sometimes. In five runs (16px in a reused Safari, 16px and
13px after a cold Safari relaunch, 13px after a second reboot, 13px after the
outer display was powered off) the field was focused, the keyboard stayed
down, and the scale read 1.000 at both sizes; with no input session WebKit
never zooms, so those runs say nothing about the size. One more 16px load on
the erased device stalled on Safari's start page and was reissued as run 4.

**What could not be measured, recorded as a null.** The inner display (669x951
pt) and landscape could not be driven. The simulator boots folded, so only the
outer display draws; this Xcode 27.1 install has no Simulator app
(`Contents/Developer/Applications` does not exist), so there is no rotation,
no unfold and no tap. `xcrun simctl io <udid> screenConfig --display=<outer>
power off` does not unfold it either: the next page still reported a 466x678
screen and the inner display stayed black (`duo-inner-dark-after-outer-off.png`).
So the inner screen's own scale and its four insets are unmeasured.

**Decision: add the block.** The measurement shows the phone-idiom focus zoom
exists on the Duo and does not fire at 16px. With the Designer's reasoning
(WebKit allows that zoom on the phone idiom at any width and never on iPad, and
the idiom follows the device, not the width), that is the evidence for
extending the floor above 640px. Reversal conditions are design-refinement
section 3: a measured 1.000 after a real tap on a sub-16px field on the inner
screen removes the block; a future iPhone with a shortest side of 700pt or more,
or an iPad below it, moves the threshold and the pinned table together; a
WebKit that stops zooming on the phone idiom removes it with the phone tier's
guard.

**Gate check.** Lightning CSS emits the gate in range syntax, `(width>=641px) and
(device-width<=700px),(width>=641px) and (device-height<=700px)`, as it already
emits every other media query in the built stylesheet (`(width<=640px)` and so
on). In Playwright WebKit and Chromium both spellings matched at 669x951,
951x669 and 874x402 (E2).

## E2. One companion rule inside the block, and the measured cost

The spec said the phone tier's companion layout rules are phone-width repairs
and are not copied, asked for the Checklists label column to be measured at 669
and 951 with the floor on, and expected "+0 rows on every filter block". I
measured those and the Map Explorer sidebar's Date Range pair, the phone tier's
other companion of this same floor.

**Method.** The built `dist` served with a stubbed backend (a three-row
synthetic eBird CSV, no key), `.sr-ios-app` set on `<html>` after boot and
asserted at each measurement, Playwright WebKit and Chromium at 669x951 (Duo
inner, portrait), 951x669 (Duo inner, landscape) and 874x402 (iPhone 17 Pro,
landscape). Each page was measured with the block present, then with the block
deleted through the CSSOM (one rule deleted every time, and the fonts reverted
to 11.5px and 12px, so the comparison is real). Probes:
`evidence/floor-companion-probe.mjs` and `evidence/floor-rows-probe.mjs`.

**Map Explorer date pair: the companion IS needed.** Above 640px the sidebar is
`clamp(240px, 28vw, 300px)`: 240px, 266.27px and 244.72px at the three sizes,
and never more than 268px on any iPhone. Side by side the two date fields got
99.5px, 112.64px and 101.86px. At 16px the year was cut off at 240px and
244.72px in both engines (WebKit "10/21/202", Chromium "mm/dd/" before the
picker icon); at 266.27px it fit; at 12px, without the floor, it fit at every
size (`floor-companion-run1-without-stacking.txt`). So the block carries the
phone tier's two stacking rules for `.sr-map-sidebar-overlay .sr-field-row`,
verbatim, gated on `.sr-ios-app`. With them the pair stacks and each field gets
207px, 233.27px and 211.72px, and the full date reads in both engines
(`floor-companion-run2-with-stacking.txt`, `webkit-669-dates-floor-stacked.png`).

**Checklists labels: no companion.** At 16px every label still fits its 72px
box, and no label's text reaches past it: "Contains", the widest single word,
has 4.6px to spare, "Effort" 28.8px, and "Where & when" wraps to two lines with
7.0px to spare (it is two lines without the floor too). "Media type" did not
render (the fixture has no Macaulay Library export); each of its words is
shorter than "Contains", so it wraps to two lines inside the box. That last
point is derived, not measured.

**Filter rows on every tab, the measured cost** (`floor-filter-rows-all-tabs.txt`).
No control reaches past its row on any tab, size or engine, with the floor on
or off. Rows added by the floor:

| Surface | 669x951 | 951x669 | 874x402 |
| --- | --- | --- | --- |
| Calendar strip | +1 (both engines) | +1 (both) | +2 (both) |
| Checklists | +0 WebKit, +1 Chromium | +0 | +0 |
| Species Detail | +0 | +0 | +0 |

The Calendar strip wraps the Year and View controls onto their own rows, as the
phone tier does; on a 402pt-tall landscape iPhone it is about 65px taller
(`webkit-874-calendar-floor.png` against `webkit-874-calendar-nofloor.png`). The
Checklists +1 in Chromium is the "To" date field wrapping under the label at
669px (`chromium-669-checklists-floor.png`); WebKit, the iPhone's engine, keeps
it on one line. Multimedia and Breeding Codes rendered no filter rows with this
fixture, so they were not measured. **This differs from the spec's "+0 rows on
every filter block".** I kept the floor anyway: nothing clips or overflows, the
growth is the same register the phone tier already ships, and the alternative
leaves the page zooming on every filter tap. It is flagged in the hand-back so
the live look can judge it.

## E3. The side insets on the three bottom surfaces

Implemented as design-refinement section 1 writes it, CSS byte for byte, with
the comment above them replaced by the spec's paragraph. One addition to the
spec's prose: the inbox paragraph's comment now also says why the root pads at
641px and up and the sheet resets to 0. `androidInsetsCss.test.ts` derives the
twins and excludes the inbox by itself, so it needed no change and stayed green
unweakened.

The built stylesheet was diffed rule by rule against a HEAD build made from
`git archive HEAD` in a scratch folder (HEAD built twice to the same hash, the
determinism control). The difference is exactly the five changed bottom-surface
rules, the inbox sheet's two new rules and the four rules in the iPhone block.
The Tailwind utilities layer is identical (82 rules each side), so no test-file
comment or string emitted a utility, and the MapLibre stylesheet is
byte-identical.

## E4. The monitor-lookup guard

`frontend/src/lib/iosMonitorLookups.test.ts`. It guards all four Rust spellings
(`current_monitor`, `available_monitors`, `primary_monitor`,
`monitor_from_point`) although only the first two are the measured aborts, and
the four JS functions plus their `plugin:window|...` command names. It derives
the desktop-only modules from the cfg attributes above each `mod` line in lib.rs
rather than naming them, treats lib.rs and main.rs as crate roots that compile
everywhere, and adds one Cargo row for tauri-plugin-window-state, which calls
`available_monitors()` in its restore (checked in its 2.4.1 source). Its reach
is stated in its header and in each failure message. The hazard note sits at the
real `#[cfg(desktop)]` site, which is the `mod window_geometry;` line in lib.rs,
with a matching paragraph in `window_geometry.rs`'s module doc; both are
comments, and no code in either file changed.

## E5. Red-first evidence

Every run swapped one file through a script that snapshots the intended file
once, copies the mutant in, runs vitest, restores, and verifies the restore by
sha256 against the snapshot (every run printed "restored ok").

**`bottomSurfaceSideInsets.test.ts` (44 rows).** Against HEAD's `globals.css`:
15 failed (the eight exact-declaration rows, six left-camera rows, two
guard-the-guard rows). The ZERO-inset identity rows pass at HEAD by
construction, since there is nothing to remove; their teeth are M1 below.
Mutations of the intended stylesheet, run with `androidInsetsCss`,
`safeAreaPerSide` and `navCss` alongside:

| Mutation | New guard | Siblings |
| --- | --- | --- |
| M1 bar's left pad `calc(4px + env(...left))` | 3 red (exact row, ZERO identity, left camera) | androidInsetsCss red |
| M2 sheet's right pad reads the LEFT inset | 2 red | safeAreaPerSide, androidInsetsCss red |
| M3 the 641px sheet reset removed | 3 red | all green |
| M4 bare `env()` side pad in the ungated `.sr-navbar` | 2 red | navCss, safeAreaPerSide red |
| M5 Android sheet twin loses its right pad | 2 red | androidInsetsCss red |
| M6 a later `.sr-ios-app .sr-inbox-sheet { padding: 0 }` | 2 red | all green |

M3 and M6 are caught by the new guard alone; M6 is the cascade case a
declaration-presence check would pass.

**`filterControlSizeCss.test.ts` (5 new rows, 1 changed).** Against HEAD: 5
failed. Mutations: F1 a literal `16px` floor in the block (1 red, the
byte-for-byte row); F2 the label rule dropped (2); F3 the threshold moved to
760, past the iPad mini (4, including the table row); F4 the control rule
ungated (2, one of them the existing "scopes the size to the <=640 tier" row);
F5 the companion dropped (2); F6 the device-height clause dropped (3); F7 the
companion stacking rule ungated (2, one of them the changed scope row). F3 first
ran green on the table row, because that row read the test's own copy of the
gate; it now reads the gate parsed from `globals.css`, and F3 turns it red.

**`iosMonitorLookups.test.ts` (7 rows).** R1 `app.primary_monitor()` in lib.rs's
setup (1 red); R2 a `current_monitor()` in `alerts.rs`, an iOS module (1); R3
`#[cfg(desktop)]` removed from `mod window_geometry;` (2); R4 `currentMonitor()`
in `App.tsx` (1); R5 tauri-plugin-window-state moved to `[dependencies]` (1); R6
a comment in lib.rs naming `current_monitor()` (green, as it must be).

## E6. Gates

- `npm run typecheck`: pass. `npm run lint`: pass. `npm run build`: pass.
- Full vitest: 475 files passed, 5 skipped; 10,331 tests passed, 7 skipped, 0
  failed (`npx vitest run --maxWorkers=2`). The first full run, at default
  parallelism while two Vite builds ran beside it and the load average was near
  47 from other sessions, had one failure: the wall-clock ratio row in
  `weatherStatsShared.test.ts` ("grows about 2x per doubling", 3.54 against 3),
  a file this change does not touch. It passed in isolation (24 of 24), and the
  reduced-parallelism full run above is the testing rules' answer to load that
  is not this session's to stop.
- `weft-design-lint check frontend/src`: 0 warns, 47 notes, none in a file this
  change touched; all pre-existing.
- No literal non-ASCII character or em dash in any added line or new file.

## E7. Left for the Tester (Xcode 27.1)

- A simulator build of the iOS app installed and launched on the iPhone Duo
  simulator, judged by screenshots of the outer display (the inner display
  needs the Simulator app; see E1).
- The widget extension's Swift tests under Xcode 27.1 (release skill, iOS
  widgets section).
- The real-device Duo check is the user's, and stays Partial until they have one.

# Deployer (Improve lane, Stage 6)

## D1. Prerequisites and the three security dispositions

**The Tester passed.** `qa-report.md`: PASSED at Tier 2 (escalated from the
classified Tier 1 because `globals.css` is read by guard suites the import graph
cannot see). The full suite ran 10,331 passed, 7 skipped, 0 failed, with a
baseline check of new=0. Four criteria are Partial by the device boundary and
this Mac's tools, not by a failure: the inner display (cold launch, fold and
unfold while running), the outer-landscape and inner insets, the focus-zoom
reading on the inner screen, and the real-Duo check. The simulator boots folded
and this Xcode 27.1 install has no Simulator app, so nothing can unfold or rotate
it; the real-Duo check is the user's.

**The Auditor passed.** `security-report.md`: PASSED WITH NOTES, no Critical,
High or Medium. The three notes are disposed of as follows.

- **L1 (Low), the window plugin's monitor commands stay granted to the iOS
  webview: DEFERRED as a follow-up, by the orchestrator, and saved to the idea
  inbox.** Reasons the report gives: the finding is pre-existing and this diff
  neither introduced nor widened it; its effect is availability only (a crash on
  the Duo's inner screen), and anything that can run script in the app's origin
  under the CSP's `script-src 'self'` already holds broader grants; today nothing
  reaches the commands (the built bundle contains none of the four command
  strings, and tauri-runtime-wry 2.11.2's own lookups are desktop-only); and the
  fix is a capability change, which is outside this brief. The follow-up is the
  report's remediation: deny the four `core:window:*-monitor` commands in
  `src-tauri/capabilities/ios.json`, pin them with a row in
  `iosMonitorLookups.test.ts`, and confirm by screenshot that the Duo simulator
  build still launches.
- **I1 (Informational), five narrow shapes the monitor-lookup guard's Rust scan
  cannot see: ACCEPTED.** Reasons: each needs unusual or deliberate code (a call
  on a line opened or closed by a block comment, a function-pointer reference
  with no call, one module declared twice under different cfgs, a `#[path]`
  redirection), none exists today, the derivation fails closed on every unknown
  cfg spelling, and the common route a lookup would take to iOS (removing or
  changing the cfg on `mod window_geometry;`) is caught. The remediation is
  optional hardening.
- **I2 (Informational), three regexes in the new guards are quadratic on shapes
  their inputs never take: ACCEPTED, no change.** Reasons: nothing backtracks
  exponentially; the scans that walk large inputs are linear; the three regexes
  read repository source a few lines or tokens long, in tests that are never
  bundled; and `security.md`'s linearity rule governs scans over untrusted text,
  which these are not, since anyone who can lengthen the inputs can already
  change the code that reads them. The report names the change to make if either
  file is ever pointed at generated or user-supplied text.

## D2. This build ships as 1.0.59, after 1.0.58

Another session is shipping 1.0.58 (taxonomy-history-2019) from its own
worktree. Its tag is pushed, and its desktop release, TestFlight upload and App
Store leg are still ahead. Two desktop releases must never overlap, since
`release.sh` builds into the shared `~/.snowraven-build`, and a version number
or App Store record another build is using is never taken. So this build takes
1.0.59, no release step runs until 1.0.58's legs are clear, and the execution
invocation re-reads the parallel-ship state before touching anything. The
reconcile merge brings 1.0.58's version set into this branch, so the bump
starts there. The App Store record logic for 1.0.59 and the version set are in
`pre-deploy-check.md` and `held-copy.md`.

## D3. Deployment record: 1.0.59 (2026-10-21)

Run by The Deployer on the user's production sign-off: "Confirm, ship 1.0.59"
to every platform, with the held App Store and F-Droid copy exactly as written
in `held-copy.md` (b) and (c), the Android device check emulator only as at
every ship since 1.0.53, and "Roll 1.0.58 into 1.0.59" for the App Store: no
1.0.58 version record exists, so 1.0.59's record carries 1.0.58 by rollup,
decided before any 1.0.58 record existed (the 1.0.39 into 1.0.40 shape), its
What's New being 1.0.58's approved paragraph followed by (b). The 1.0.58
session confirmed the rollup on its side (`pipeline/taxonomy-history-2019/decisions.md`,
entry 19) and creates no 1.0.58 record.

- **Parallel-ship check (15:50 PDT):** after `git fetch origin --tags`,
  `origin/main` was `2a176e72` (1.0.58's records), the newest tag `v1.0.58`, no
  `v1.0.59`; the v1.0.58 GitHub release was published (22:35 UTC) and marked
  Latest; no `release.sh`, `notarytool`, `altool` upload, `exportArchive` or
  `tauri build` process was running. App Store Connect (read only, key
  `QJA25M7XHM`): 26 version records, 1.0.57 (`d5b968b4`) and every other
  `READY_FOR_SALE`, no 1.0.58 record, the three newest review submissions
  `COMPLETE`; newest builds 1.0.58.1 (`ba21125d`) and 1.0.57.1 VALID. The login
  keychain read `no-timeout`; `xcrun --sdk iphoneos --show-sdk-version` 27.1
  (SDK build `24A94232`) with `DEVELOPER_DIR` exported.
- **Order, adjusted by the coordinator:** the 1.0.58 session has one closeout
  push to `main` still to make, so the bump is committed on this branch, only
  the tag `v1.0.59` is pushed at first (starting Windows and Android CI), and
  the branch goes to `main` as a fast-forward after that closeout lands and a
  second reconcile merges it.
- **Reconcile:** `weft-worktree reconcile`: `RECONCILED clean`, merge
  `229904d7` (1.0.58's three record commits, `d264199b`, `e4c46846`,
  `2a176e72`; record files and evidence only).
- **The six-file version set**, from `held-copy.md` (d): `frontend/package.json`
  and the two root entries in `package-lock.json`; `src-tauri/tauri.conf.json`
  `version` 1.0.59 and `bundle.android.versionCode` 1000059; CHANGELOG.md
  `## [1.0.59] - 2026-10-21` with (a) verbatim; `website/index.html` the
  version pill's text and `aria-label` and the `footer-version` line, nothing
  else; the three Fastlane changelogs `10000591.txt`, `10000592.txt` and
  `10000594.txt`, (c) as approved, 204 bytes each, SHA-256
  `b9b0a93b51bcac9272b36897b6777497204f0c6f8123117a0fcc025c687097fc` each,
  equal to the held figure, nothing under `1000059`; and the in-repo F-Droid
  recipe's three `versionName` 1.0.59, codes `10000591`, `10000592`,
  `10000594`, `CurrentVersion` 1.0.59 and `CurrentVersionCode` 10000594 (the
  three `commit:` lines move after the tag). The version-set guards
  (`androidVersionSource`, `fdroidRecipe`, `fastlaneMetadata`,
  `icloudKeysPublishedClaims`, `iosSceneManifest`): 5 files, 118 tests passed.
- **Gates on the bumped tree, before the bump commit** (from `frontend/`):
  `npm run typecheck`, `npm run lint` and `npm run build` exit 0 (the build's
  one chunk-size notice predates this run); the full vitest suite
  (`--maxWorkers=2`) exit 0, 480 files (475 passed, 5 skipped), 10,364 tests
  (10,357 passed, 7 skipped, 0 failed).
- **Bump commit** `a654a9b0` (`chore(release): 1.0.59, iPhone Duo screens and
  side cameras`), the six-file set only. **Tag `v1.0.59`** (lightweight, like
  `v1.0.58`) on `a654a9b0fb63297d182d3f3da3e4c3d9cbc1d9a1`, pushed alone at
  15:57 PDT, which started Windows Build `39690152423` and Android Build
  `39690152534`.
- **Recipe hash** `4d5657c8` (`fix(fdroid): the recipe names v1.0.59's
  commit`): the three `commit:` lines name
  `a654a9b0fb63297d182d3f3da3e4c3d9cbc1d9a1`; the recipe, Fastlane and
  version-source guards, 57 of 57, green before the commit. The tag stays on the
  bump commit.
- **Widget extension Swift tests** on the local iPhone 18 Pro (iOS 27.0)
  simulator, addressed by udid and shut down after: 143 tests, 0 failures,
  `TEST SUCCEEDED`. The one simulator that was already booted (another
  session's) was not touched.
- **Second reconcile and the main push:** on the coordinator's "closeout
  pushed", `weft-worktree reconcile` merged the 1.0.58 closeout `eb21e85a`
  (CLAUDE.md, DECISIONS.md, ROADMAP.md, PRODUCT_CONTEXT.md,
  `.claude/rules/bird-names.md`) as `e769e623`, `RECONCILED clean`. On that
  merged tree the version-set guards (118 of 118), the full vitest suite (10,357
  passed, 7 skipped, 0 failed), typecheck, lint and build all exit 0. `origin/main`
  was an ancestor of HEAD and the tag an ancestor too, so `git push origin
  HEAD:main` fast-forwarded `eb21e85a..e769e623` at 16:03 PDT. Every commit it
  carried is this build's own or a merge of `main`, so it carried no cargo the
  gate did not name. Pages deployed the version pill from it (run `39690954609`,
  success).
- **iOS (built during the CI wait):** no archive existed under this worktree's
  `src-tauri/gen/apple/build/`, so nothing was moved aside; the three
  `/tmp/xcshim` shims recreated; the root `npm ci` (tauri-cli 2.11.2). `tauri ios
  build --export-method app-store-connect --build-number 1`, outside the Bash
  sandbox with the three Tauri key names mapped from the login shell, with
  `xcrun --sdk iphoneos --show-sdk-version` 27.1 (SDK build `24A94232`) and the
  shims first on `PATH`: `BUILD SUCCEEDED` in about three minutes; Tauri's own
  export refused with "No Account for Team" and "No profiles" (expected). The
  fresh archive (created 16:07:50) reads 1.0.59 (1.0.59.1) in its
  `ApplicationProperties`, the app's and the appex's Info.plist; the app's
  `DTSDKName` is `iphoneos27.1`, `DTSDKBuild` `24A94232`, `DTPlatformVersion`
  27.1, `DTXcodeBuild` `27A9275`, `MinimumOSVersion` 16.0; `vtool -show-build`
  on the executable reports `platform IOS`, minos 16.0, sdk 27.1; and all nine
  swift-rs libraries under `src-tauri/target/aarch64-apple-ios/release/build/`
  report `LC_BUILD_VERSION` platform 2 (sdk 27.1), from a target that had never
  built iOS release before. Tauri re-quoted `PRODUCT_NAME` in `project.pbxproj`
  (a no-op), and that file was restored. The archived `snowraven_widgets.appex`
  (`not signed at all`) was ad-hoc signed with its entitlements and then lists
  the App Group. The manual export (`~/.tauri/snowraven-ios-export-options.plist`):
  `EXPORT SUCCEEDED`; `DistributionSummary.plist` lists the appex with the App
  Group alone (profile "SnowRaven Widgets App Store") and the app with the App
  Group, the three iCloud keys and `Production` (profile "SnowRaven iOS App
  Store iCloud AppGroup 20260924"), both 1.0.59 (1.0.59.1), certificate SHA1
  `1861F7A4...7697B`. IPA SHA-256
  `9e62b3e04eadc9e21f930e6b2de0afffab1446d5931e62b3ada44543482ef629`.
  `altool --validate-app`: VERIFY SUCCEEDED with no errors; `--upload-app`:
  UPLOAD SUCCEEDED, **Delivery UUID `cff347b8-7c01-44e8-9eb5-ba9fed6cea8d`**.
- **Stamp commit** `22ab8f26` (`chore(ios): stamp iOS 1.0.59 build 1`, the two
  Info.plist files only; `iosSceneManifest` and `iosWidgetManifest`, 55 of 55,
  green before the commit), pushed to `main` as a fast-forward
  (`e769e623..22ab8f26`).
- **TestFlight:** App Store Connect lists build 1.0.59.1 (`cff347b8`) `VALID`,
  uploaded 16:11:59 local, on train 1.0.59, `minOsVersion` 16.0; its APP build
  bundle (`com.dtgibson.snowraven`) reports `sdkBuild` and `platformBuild`
  `24A94232`, the iOS 27.1 SDK.
- **CI on the tag:** Windows Build `39690152423` and Android Build `39690152534`
  both succeeded on `a654a9b0`, and the Windows lookup pinned to the tag
  (`gh run list --workflow windows-build.yml --status success --commit
  a654a9b0...`) returns exactly `39690152423`. The Pipeline runs on `eb21e85a`
  (`39690298690`) and `e769e623` (`39690954471`) were cancelled by the next push
  (`cancel-in-progress`); the run of record is the one on `22ab8f26`, the
  shipped tree, below.
- **Desktop:** `CI=true zsh -lc ./release.sh` from this worktree, alone on the
  machine (only other sessions' `xcodebuildmcp` tool servers were running, none
  a release step), exit 0 on a clean tree: `Releasing v1.0.59: tag=a654a9b0
  HEAD=22ab8f26`; bundle version verified 1.0.59; iCloud entitlements and
  embedded profile verified; DMG styled, signed and verified; notarization
  submission `cad33b04-134e-48c8-a8eb-974e5d0a7878` `Accepted`, stapled; Windows
  installer fetched from the tag's run and signed locally; release published
  2026-10-21 23:17:15 UTC, not a draft or pre-release:
  https://github.com/dtgibson/snowraven/releases/tag/v1.0.59. The DMG downloaded
  back from the release (SHA-256
  `76307c215e709084a08ed382a5816ba00557bc8bd473eade9c00139a81b38f6e`) passes
  `codesign --verify` (valid on disk, satisfies its Designated Requirement),
  `stapler validate`, `spctl -a -t open --context context:primary-signature`
  (accepted, Notarized Developer ID, `DAVID THOMAS GIBSON (8QKC3L2FKP)`) and
  `hdiutil verify` (checksum VALID), and mounts read-only to SnowRaven.app
  1.0.59 (x86_64 and arm64). `latest.json` (resolved through
  `releases/latest/download`): version 1.0.59; `darwin-aarch64` and
  `darwin-x86_64` identical, both on `SnowRaven-updater.app.tar.gz`;
  `windows-x86_64` on `SnowRaven_1.0.59_x64-setup.exe`; both URLs answer HTTP
  200. The published installer is byte-identical to run `39690152423`'s
  artifact (SHA-256
  `1f640759169a0e6d47860decfab1ef5da1eda3a98e488ee64622002909addb41`).
- **Android:** `preflight.sh` passed every check (JDK 17.0.20.1, build-tools
  36.0.0, Gradle 8.14.3, cargo-tauri 2.11.2, the keystore opens, the version
  pair, the tag pushed at `a654a9b0`, the three changelogs at the tag, run
  `39690152534`'s artifact `com.dtgibson.snowraven` 1.0.59 / 1000059, not
  debuggable); its one warning, HEAD is not the tag's commit, is the recipe-hash
  and stamp commits after the tag, as at every ship. `sign.sh` with the recorded
  digest pinned: v2 and v3, signer `CN=SnowRaven, O=Dave Gibson`, SHA-256
  `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`, equal to
  the keystore's certificate and to the recorded digest; signed APK SHA-256
  `38c90ebd9cc6f76d3358e11f6d9b9790de9d3063536e0f714c907dde56749688`. Emulator
  evidence on the local API 36 Google APIs image only (`sr-api36-phone`, a Pixel
  7 shape, 1080x2400 at 420 dpi, started on port 5554 so it is `emulator-5554`,
  headless, `-gpu host`, no snapshot saved; every `adb` call addressed to it by
  serial, and no device listing was taken): those exact bytes installed fresh
  (`pm list packages` showed no SnowRaven before; `versionName` 1.0.59,
  `versionCode` 1000059), a cold start in 215 ms to the Welcome screen with the
  app's one window focused and an empty crash buffer
  (`evidence/ship/api36-1.0.59-first-launch.png`). **The landscape bar, beyond
  the launch check:** with the image's tall-notch cutout emulation turned on
  (`cmd overlay enable com.android.internal.display.cutout.emulation.tall`), a
  small-phone logical size (`wm size 945x1680`, 360 by 640 dp) and the screen
  turned sideways (`user_rotation 1`), the window reported `w640dp`, landscape,
  and a `DisplayCutout` inset of 88 px on the left. After "Explore the app
  first", the bottom bar showed sideways
  (`evidence/ship/api36-1.0.59-landscape-cutout-bar.png`) with its five cell
  centers at x = 247, 565, 884, 1202 and 1521 of 1680 px: five equal cells
  across 1680 - 88 px starting at x = 88, where an unpadded bar would center them
  at 168, 504, 840, 1176 and 1512. The More sheet
  (`evidence/ship/api36-1.0.59-landscape-cutout-more-sheet.png`) opened with its
  content starting 115 px from the left edge and ending 27 px from the right,
  its background still reaching both edges. So the bar and the More sheet clear
  a side cutout on Android as `held-copy.md` (c) states; the cutout is
  emulated, not a real phone's. The overlay, the size override and the rotation
  were reverted before the emulator was stopped; the app ran as one process
  (pid 4457) from launch through the rotation, and the crash buffer stayed
  empty. WebView 133.0.6943.137: **WebView 133, unchanged since the last
  measurement.** `attach.sh` with `ANDROID_DEVICE_CHECK=partial` (the user's
  emulator-only decision at the production gate, as at every ship since
  1.0.53): byte-identical to the checked file, uploaded to v1.0.59 as
  `SnowRaven_1.0.59_android_universal.apk` and downloaded back, asset SHA-256
  `38c90ebd9cc6f76d3358e11f6d9b9790de9d3063536e0f714c907dde56749688`.
- **F-Droid, read at the ship and again after the attach (public reads):**
  f-droid.org publishes 1.0.55 (10000551, 10000552, 10000554) and 1.0.53.
  fdroiddata `master` has 1.0.56's and 1.0.57's three entries each and
  `CurrentVersion` 1.0.57, nothing for 1.0.58 or 1.0.59 yet. State: 1.0.58
  **included and this tag not yet built**; 1.0.59 **included and this tag not
  yet built**. Since v1.0.58 nothing under `scripts/android/` or
  `src-tauri/gen/android/` changed, and the recipe differs only in versions,
  codes and the commit, so nothing goes to fdroiddata. The update bot adds the
  newest tag it finds, so if it runs after this tag it may add 1.0.59 alone and
  never build 1.0.58, as it did with 1.0.54, which costs F-Droid users nothing.
- **Pipeline, the run of record:** `39691782979` on `22ab8f26`, the shipped
  tree: success (Frontend lint, test, build; Backend lint, test). The commit
  carrying this record follows it to `main` and starts its own run.

### The stop for the user's iPhone check of TestFlight 1.0.59.1 (resolved: the check passed and the App Store leg below followed)

Live now: the v1.0.59 GitHub release (Mac, Windows, `latest.json` and the
signed Android APK), the website's version pill, and TestFlight build 1.0.59.1
(`cff347b8`). Not yet done, by design: the App Store record. It waits for the
user's own check of the exact uploaded build (CLAUDE.md, device boundary, and
the v1.0.31 precondition), asked for in these words: install build 1.0.59.1
from TestFlight on your iPhone, open it, and confirm it launches; if you can,
tap a filter field with the phone held upright and again turned sideways, and
confirm the page does not zoom and the bar's five labels show. Only the
user's reported result is recorded. The real iPhone Duo check stays Partial
until they have one (on sale from 2026-10-23).

**The App Store leg, for the re-invocation, on the user's reported pass:**

- A NEW record for 1.0.59 on build 1.0.59.1, carrying 1.0.58 by rollup,
  decided before any 1.0.58 record existed, so nothing is withdrawn (1.0.58
  holds VALID build 1.0.58.1, delivery `ba21125d`, and no record of its own by
  rollup, not by skip). Live query first: the newest record, 1.0.57
  `d5b968b4`, must still be `READY_FOR_SALE` with nothing in review.
- What's New, written by script and read back byte for byte after the write
  and again after submitting: 1.0.58's approved paragraph
  (`pipeline/taxonomy-history-2019/held-copy.md` (a), confirmed word for word
  against the coordinator's copy), a blank line, then `held-copy.md` (b):

```text
Splits and lumps on Species Detail now covers eBird's taxonomy updates from 2019 to 2025, adding the 2019, 2021, and 2022 updates. Species eBird split or lumped in those years now appear in the list, with what each was, what it became, and how many of your reports eBird reassigned.

SnowRaven now fills the iPhone Duo's inner screen. On the Duo's outer screen, the bottom bar, the More sheet, and the Alerts inbox keep their buttons clear of the camera, and on a wide iPhone screen, such as the Duo's inner screen or an iPhone turned sideways, tapping a filter field no longer zooms the page.
```

- The promotional text is expected to arrive empty on a new record (it has
  nine times) and is restored from `appstore/LISTING.md`; the copyright is set
  from it at creation; the description, keywords, both URLs, name, subtitle,
  privacy policy URL and both categories are read back against
  `appstore/LISTING.md` after the writes and again after submitting; the App
  Review notes compared byte for byte with `appstore/REVIEW_NOTES.md`; the
  age-rating declaration checked.
- **Both screenshot sets are replaced whole and in order**, not left to carry
  over: a new record inherits 1.0.57's images, and 1.0.58 recaptured both 05
  Species Detail shots (`507eb48e`, already in this tree). All twelve md5s are
  then checked in order against `appstore/screenshots/` at this tree, and every
  asset polled to `COMPLETE` before submitting. None shows the Duo or a side
  cutout, so nothing new is captured for 1.0.59.
- Then the submission (`reviewSubmissions`, `reviewSubmissionItems`, PATCH
  `submitted`), release after approval, no phased release; the live query over
  all version records and every TestFlight train afterwards.
- **CLAUDE.md is the Chronicler's**, after the App Store leg: the 1.0.59 entry
  in the App Store list (record id, submission id, state; the "1.0.58 into
  1.0.59" rollup line is already there, written by the 1.0.58 closeout
  `eb21e85a`, and is not restated), and the Android record line for 1.0.59 (APK attached, signer
  `42a3576e...996a`, asset SHA-256 `38c90ebd...9688`, device check Partial by
  the user's decision, F-Droid included and this tag not yet built, WebView 133
  unchanged).

### The App Store leg: 1.0.59 submitted on its own record, carrying 1.0.58 (2026-10-21, from 17:30 local)

Run by The Deployer through the App Store Connect API with the metadata key
`QJA25M7XHM`, from scripts in the session scratchpad. Every listing value
compared or written was extracted by script from the committed files as they
stand; none of them was edited.

- **The user's device check:** the user checked TestFlight build 1.0.59.1 on
  their own iPhone and answered **"Works, submit it"** (2026-10-21, relayed by
  the coordinator before this leg began). It is the device check CLAUDE.md
  requires and, with the production sign-off's "Roll 1.0.58 into 1.0.59", the
  authorization to create the 1.0.59 record on build 1.0.59.1 and submit it.
- **The extraction, checked first:** the values extracted from
  `appstore/LISTING.md` and `appstore/REVIEW_NOTES.md` reproduced the live
  1.0.57 record field for field (description 3,234 characters, keywords 97,
  promotional text 137, both URLs, copyright, review notes 3,898, and on the
  app info name, subtitle, privacy policy URL, Reference and Weather). Its
  screenshots matched `appstore/screenshots/` in order except the two 05
  Species Detail shots, which 1.0.58 recaptured (iPhone live `407737c9...`
  against `32caacde...` in the tree, iPad live `db15c9e3...` against
  `1862eb4a...`), so both sets had to be replaced.
- **Live state immediately before writing:** 26 version records, every one
  `READY_FOR_SALE`, newest 1.0.57 `d5b968b4`; no 1.0.58 or 1.0.59 record; no
  review submission open; build 1.0.59.1 (`cff347b8`) `VALID`, not expired,
  `usesNonExemptEncryption` false.
- **The record:** `POST /v1/appStoreVersions` (201):
  **`a0511485-1fc2-4f35-acf3-d4d4f5846a4c`**, 1.0.59 on build 1.0.59.1,
  `AFTER_APPROVAL`, copyright `2026 Dave Gibson` from `LISTING.md`, created
  17:30:49 local. A new editable app info, `4a0a90ec`, appeared beside the live
  `0cacb9c4`. The record arrived with the description, keywords, both URLs and
  the review notes carried over and matching, with both screenshot sets carried
  over from 1.0.57, and with the promotional text and What's New EMPTY (the
  tenth new record to arrive without its promotional text).
- **Writes:** What's New and the promotional text from `LISTING.md`, in one
  PATCH to the en-US localization `b5de9c41` (200); both read back
  byte-identical (593 and 137 characters). What's New as written:

```text
Splits and lumps on Species Detail now covers eBird's taxonomy updates from 2019 to 2025, adding the 2019, 2021, and 2022 updates. Species eBird split or lumped in those years now appear in the list, with what each was, what it became, and how many of your reports eBird reassigned.

SnowRaven now fills the iPhone Duo's inner screen. On the Duo's outer screen, the bottom bar, the More sheet, and the Alerts inbox keep their buttons clear of the camera, and on a wide iPhone screen, such as the Duo's inner screen or an iPhone turned sideways, tapping a filter field no longer zooms the page.
```

- **Screenshots, both sets replaced whole and in order:** on the new
  localization only (the script refused any set that was not on `b5de9c41` or
  that carried the live 1.0.57 set ids), `APP_IPHONE_67` (`abfba0b1`) and
  `APP_IPAD_PRO_3GEN_129` (`4f0c674e`) each had its six carried-over images
  deleted (204 each) and checked empty, then 01 to 06 reserved, uploaded,
  committed with their md5 and polled to `COMPLETE`. The final order and
  checksums, equal to `appstore/screenshots/` at this tree:

| Set | File | Bytes | md5 |
|---|---|---|---|
| iPhone 6.9 | 01-map-explorer.png | 766,145 | `bb0c1578db1e27f821a0fde964e29e9b` |
| iPhone 6.9 | 02-statistics.png | 234,869 | `d642ba3f255badcaaa4a820a37953203` |
| iPhone 6.9 | 03-weather-tide.png | 266,691 | `a4d53cca9af02e9b7ebf180c76f41234` |
| iPhone 6.9 | 04-calendar.png | 137,183 | `b1375fa29d44d9b965bcba25b274c8d8` |
| iPhone 6.9 | 05-species-detail.png | 233,427 | `32caacde2c65697ece27a85cbc9f08b3` |
| iPhone 6.9 | 06-breeding-codes.png | 283,419 | `bb2719be5cc12cacbc0d34df8e73c3ce` |
| iPad 13 | 01-map-explorer.png | 1,423,707 | `03456c9f88108d6ddc02100efec5c7a6` |
| iPad 13 | 02-statistics.png | 410,809 | `911b119415cf388a868c52a84f4a2bb4` |
| iPad 13 | 03-weather-tide.png | 379,004 | `1db06c6025c2db3ec57d069da0a0d25c` |
| iPad 13 | 04-calendar.png | 399,878 | `68c3b33b2b7483f569a74448c1447770` |
| iPad 13 | 05-species-detail.png | 310,577 | `1862eb4a7a4f3abc13fa57d4022fde1b` |
| iPad 13 | 06-breeding-codes.png | 441,657 | `00f8b67d5fc0e849133388367833de14` |

  The iPhone 05 was viewed before the upload and shows Species Detail with
  "Splits and lumps 10 species". The live 1.0.57 record's sets (`ff2a7972`,
  `5df58f37`) were read afterwards and still hold their own images, 05s
  included: nothing outside the new record was touched.
- **Read-back against the committed files, before submitting and again after,
  every field identical:** 1.0.59 on build 1.0.59.1, `AFTER_APPROVAL`, no phased
  release; one localization, en-US; What's New equal to the text above;
  description, keywords, promotional text, marketing and support URLs, and
  copyright equal to `LISTING.md`; on both app infos, name `SnowRaven`, subtitle
  `Your birding data, explored`, privacy policy URL, and categories Reference
  and Weather; App Review notes byte-identical to `REVIEW_NOTES.md`'s "Notes for
  the reviewer" section, 3,898 characters, contact details present, no demo
  account; all twelve screenshots as in the table, all `COMPLETE`.
- **Age rating** on `4a0a90ec`: already answered, all 30 fields `NONE` or false
  except three that read null (`gracRatingClassificationNumber`, the Korean
  game-rating number, and `kidsAgeBand` and `developerAgeRatingInfoUrl`, which
  are null on a non-Kids app). Nothing was changed. The privacy label ("Data Not
  Collected") can be checked only in the App Store Connect UI and was not
  touched.
- **Submit:** a new review submission (`POST /v1/reviewSubmissions`, 201,
  `READY_FOR_REVIEW`), the record added as its item (`POST
  /v1/reviewSubmissionItems`, 201), and `submitted: true` (200):
  **`a1defa32-0889-43ed-8068-be2f2db37d4d`, `WAITING_FOR_REVIEW`, submitted
  2026-10-22 00:33:58 UTC (17:33 local, 2026-10-21)**. The record reads 1.0.59
  `WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release, and app info
  `4a0a90ec` `WAITING_FOR_REVIEW`.
- **Reconciliation** (read only, after submitting): 27 version records, 83
  TestFlight trains, 91 builds, every build `VALID`; 1.0.59 in review and the
  other 26 records `READY_FOR_SALE`. Of the 47 versions from 1.0.13 to 1.0.59
  that hold a train or a record, the 21 with no record of their own each have a
  written disposition in CLAUDE.md: the genuine skips 1.0.15, 1.0.16 and
  1.0.18; 1.0.25 deferred; 1.0.37 TestFlight-only; and the rollups 1.0.20,
  1.0.22, 1.0.26, 1.0.29, 1.0.33, 1.0.39, 1.0.41, 1.0.42, 1.0.43, 1.0.44,
  1.0.46, 1.0.48, 1.0.49, 1.0.52, 1.0.54 and 1.0.58. No unaccounted gap between
  1.0.13 and 1.0.59.
- **F-Droid, read again after submitting (17:34 local):** unchanged.
  f-droid.org publishes 1.0.55 and 1.0.53; fdroiddata `master` has
  `CurrentVersion` 1.0.57. 1.0.58 and 1.0.59 are each included and this tag not
  yet built.

### For CLAUDE.md: the two entries the Chronicler adds verbatim

The 1.0.58 closeout (`eb21e85a`) already wrote "1.0.58 into 1.0.59" into the
rollup list and an entry recording 1.0.57 as resolved and 1.0.58's rollup, so
neither is restated. The App Store entry goes after the 1.0.58 ship's entry, at
the end of the App Store list and before "The full runbook lives in the
`snowraven-release` skill (below)."; the Android entry goes at the end of the
Android record line, after the 1.0.58 ship's entry.

App Store list:

```markdown
**ENTRY FROM THE 1.0.59 SHIP (2026-10-21).** **1.0.59 is on its own record `a0511485-1fc2-4f35-acf3-d4d4f5846a4c`, submitted on build 1.0.59.1 (delivery `cff347b8`, linked against the iOS 27.1 SDK) as `a1defa32-0889-43ed-8068-be2f2db37d4d` (`WAITING_FOR_REVIEW`, `AFTER_APPROVAL`, no phased release)**, after the user's own iPhone check of that build ("Works, submit it", `pipeline/ios27-iphone-duo/decisions.md`, D3), so it carries 1.0.58 by rollup and 1.0.59. Its What's New is 1.0.58's approved paragraph (`pipeline/taxonomy-history-2019/held-copy.md`, text (a)) followed by the approved 1.0.59 paragraph (`pipeline/ios27-iphone-duo/held-copy.md`, text (b)), written by script and read back byte for byte, after the write and again after submitting. The new record's promotional text arrived EMPTY a tenth time (after 1.0.35, 1.0.42, 1.0.46, 1.0.49, 1.0.51, 1.0.53, 1.0.54, 1.0.56 and 1.0.57) and was restored from `appstore/LISTING.md`; the copyright was set from `appstore/LISTING.md` when the record was created; the description, keywords, both URLs, name, subtitle, privacy policy URL and both categories carried over and were read back against `appstore/LISTING.md`, after the writes and again after submitting; the App Review notes carried over byte-identical to `appstore/REVIEW_NOTES.md` at 3,898 characters; **both screenshot sets were replaced whole and in order**, because they had carried over 1.0.57's images and both 05 Species Detail shots were recaptured at `507eb48e`, and all twelve are `COMPLETE` with checksums matching `appstore/screenshots/` in order, while the live 1.0.57 record's sets were left untouched; and the age-rating declaration was already answered (its empty fields are the Korean game-rating number and `kidsAgeBand` and `developerAgeRatingInfoUrl`, which read null on a non-Kids app), so nothing was changed. The live query at this ship, over all 27 version records and every TestFlight train (1.0.59 in review, every other record `READY_FOR_SALE`, builds through 1.0.59.1 VALID), leaves no unaccounted gap between 1.0.13 and 1.0.59.
```

Android record line:

```markdown
**ENTRY FROM THE 1.0.59 SHIP (2026-10-21): APK attached; F-Droid included and this tag not yet built.** `SnowRaven_1.0.59_android_universal.apk` is on the v1.0.59 GitHub release (SHA-256 `38c90ebd9cc6f76d3358e11f6d9b9790de9d3063536e0f714c907dde56749688`), signed from the CI artifact of the tag's run `39690152534`; its signer certificate SHA-256 is `42a3576e445bda4a994793f2ffa056663113275c9805eb2f6cffdc252375996a`, the same as 1.0.53 to 1.0.58. **Its device check is Partial, by the user's decision at the production gate (`pipeline/ios27-iphone-duo/decisions.md`, D3): emulator only, as at 1.0.53 to 1.0.58.** The exact attached bytes installed fresh on the local API 36 emulator and opened to the Welcome screen with one window and no crash, and with the emulator's tall-notch cutout turned on, a 360 by 640 dp logical size and the screen turned sideways, the bottom bar and the More sheet showed padded clear of the 88 px cutout (`pipeline/ios27-iphone-duo/evidence/ship/`). F-Droid: **included and this tag not yet built**, read at the ship and again after the App Store submission: f-droid.org publishes 1.0.55 and 1.0.53, and fdroiddata `master` has 1.0.56's and 1.0.57's three entries each and none for 1.0.58 or 1.0.59 yet, so 1.0.58 and 1.0.59 are each included and this tag not yet built. This tag changes no toolchain pin and no recipe build step, so nothing was sent to fdroiddata and the update bot is expected to add the entries on its own; the in-repo recipe names 1.0.59 (codes 10000591, 10000592 and 10000594) and the tag's full commit `a654a9b0fb63297d182d3f3da3e4c3d9cbc1d9a1`, and the three per-processor changelogs are in the tag. WebView 133, unchanged since the last measurement.
```
