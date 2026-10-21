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
