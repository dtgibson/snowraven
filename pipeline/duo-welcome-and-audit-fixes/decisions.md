# Decisions: Duo Welcome and audit fixes (1.0.60)

The Engineer, 2026-10-22, Fix lane, from `bug-brief.md` at `236576c4`. Nothing
is committed; the Deployer commits the release. Evidence files are in
`evidence/` beside this file.

## A. Welcome screen safe areas

**A1. The shape: `.sr-welcome-panel`, on the `.sr-help-panel` model.**
`WelcomeScreen.tsx`'s root lost its inline `position: 'fixed', inset: 0,
zIndex: 1200` and `padding: '32px 24px'` and gained `className="sr-welcome-panel"`.
In `globals.css`, directly after the Help TOC rules:

- the ungated base rule `.sr-welcome-panel { position: fixed; inset: 0; z-index: 1200; padding: 32px 24px; }`, byte-identical in value to the old inline style, with no `env()`;
- `.sr-ios-app .sr-welcome-panel`, padding the top by `calc(32px + env(safe-area-inset-top, 0px))` and each side by `calc(24px + env(safe-area-inset-left|right, 0px))`;
- the `.sr-android-app` twin, reading `var(--sr-inset-X, 0px)` in the same places.

The padding is lifted along with the positioning, unlike the Help panel, because
here it was inline and a class cannot override an inline declaration. The
background, text color, flex column, overflow and font stay inline (ui.md, lift
the layout only). Each side is anchored to its shipped literal, so wherever an
inset is 0 the declaration reduces to the old value.

**A2. Still its own rule at the third overlay.** ui.md says to revisit a shared
inset utility at a third overlay. Revisited: the map and Help panels pad the bare
inset, and this one pads `calc(literal + inset)`, so the three share no
declaration and a utility would not remove any. Written beside the rule.

**A3. The top inset is padded (the family's shape).** Measured in WebKit
(Playwright, desktop WebKit, the built stylesheet with each `env()` replaced by
the inset value, against a replica of the 1.0.59 inline style;
`evidence/webkit-welcome-readings.txt`, `evidence/webkit-chromium-200pct-scroll.txt`):

| Case | 1.0.59 | 1.0.60 |
|---|---|---|
| iPhone 17 Pro upright (402x874, insets 62/0/34/0), 100% text | column y 168.6 to 705.4, nothing scrolls | column y 199.6 to 736.4, nothing scrolls |
| same, 200% text, scrolled to the top | column top rests at y = 32, inside the 62 pt status bar | column top rests at y = 94 |
| Duo outer (466x678, insets 0/84/34/0), 100% text | card x 24 to 442 | card x 24 to 358 |
| every inset 0 (402x874 and 1280x800, 100% and 200% text) | | identical to 1.0.59 in every reading |

At the default text size the cost is the card moving down by half the top inset
(31 pt on the iPhone 17 Pro, about 12 pt on an iPad's 24 pt status bar, half the
status bar on Android). The last button ends at 736.4, above the home indicator
band (874 - 34 = 840), and nothing starts to scroll, so this does not harm the
upright layout. The gain is at large text: WebKit lets this centered column scroll
up into its start overflow (its `scrollTop` reaches -325 at 200%), so the
column's resting place at the top is the root's top padding, and without the top
inset that is 32 px from the screen edge, inside the status bar. CHANGELOG says
the content sits a little lower on a phone or an iPad.

*Reversal:* if the user would rather the card not move on upright phones, remove
the two `padding-top` declarations (iOS and Android), the `top` entry in the
`iosChrome.test.ts` row's `base` table, and the CHANGELOG and held-copy clauses
about the status bar. The 200% case then rests inside the status bar again.

**A4. The bottom is not padded,** as in `.sr-ios-app body` and the Help panel:
nothing is pinned to the bottom edge, the root is its own scroller, and the 32px
base padding already clears the home indicator. On the Duo outer screen the last
button ends at 607.4 against a safe bottom of 644.

**A5. Decision not to act: in Chromium the top of an overflowing Welcome screen
cannot be reached (out of scope, pre-existing).** At 200% text Chromium does not
scroll into the centered column's start overflow (`scrollTop` stays at 0), so the
logo, heading and first lines are cut off above the screen. It is the same in
1.0.59 on any Chromium surface where the content overflows (Android, Windows,
desktop Chromium browsers). WebKit is not affected (A3). On a screen with a side
inset this fix makes the column narrower, so more of it overflows: on the Duo outer
screen at 200% text the hidden band grows from 259 to 398 pt in Chromium, a
layout the Duo never shows, since it is an iPhone. Not fixed here: the brief is
safe areas, and the Fix lane keeps the change minimal.
*The fix and where it goes:* in `frontend/src/components/WelcomeScreen.tsx`,
drop `justifyContent: 'center'` from the root's inline style and give the inner
column (`<div style={{ maxWidth: 540, ... }}>`) `marginTop: 'auto', marginBottom: 'auto'`.
Auto margins center the column when it fits and collapse to 0 when it does not,
in every engine. (`justify-content: safe center` needs Chromium 115, above the
app's 111 floor, so it would need a fallback.) *What would reverse this:* a Fix
or Improve run for the Welcome screen at large text, or any report of the top of
the Welcome screen being cut off. Flagged to the Orchestrator for capture as an
idea.

**A6. Guard rows (`iosChrome.test.ts`, four rows beside the Help-panel rows).**
The base rule carries the four old values; `findUngatedSafeAreaRules` finds no
`env()` on it; the iOS rule and its Android twin pad top, left and right by the
literal plus that side's own inset and leave the bottom alone; the component's
root has the class, no inline position, inset, z-index or padding, and still its
token background. The stylesheet-wide guards picked the new rule up by themselves
(`androidInsetsCss.test.ts` lists `.sr-ios-app .sr-welcome-panel` as a subject;
`safeAreaPerSide.test.ts` passes). Each row was mutation-checked once and
restored by hash: `env()` added to the base rule, the Android twin removed, the
inline padding put back, and one deny removed from `ios.json` each turned the
expected rows red.

**A7. Simulator check (iPhone Duo, iOS 27.1, outer screen).** Built as in the
ios27-iphone-duo QA recipe: `npm run build`; `cargo build --lib --target
aarch64-apple-ios-sim --features tauri/custom-protocol` with `/tmp/xcshim` first
on PATH; the library copied to `gen/apple/Externals/arm64/debug/libapp.a`
(gitignored); `xcodebuild -scheme snowraven_iOS -sdk iphonesimulator -configuration
debug CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES build` with a no-op `npm` first
on PATH. The app links the iOS 27.1 simulator SDK (`vtool`).

- `evidence/duo-outer-welcome-probe.png`: a build whose `dist/index.html` copy
  loaded the evidence-only `evidence/welcome-inset-probe.js`, from an erased Duo.
  At 25 s the app's own webview reports insets 0/84/34/0 px, viewport 466x678,
  the root padded 32/108/32/24 px, and the column and card at x = 24.0 to 358.0
  (y 70.6 to 607.4), matching the WebKit emulation to the decimal.
- `dist` was then restored and checked by SHA-256, the library and app rebuilt,
  the Duo erased again and the clean build installed:
  `evidence/duo-outer-welcome-clean.png` shows it drawn, the card ending clear of
  the camera column. `evidence/duo-inner-dark-folded.png`: the inner display is
  black (the simulator boots folded).
- The Duo was shut down afterwards, as it was found. The booted iPhone 17 Pro was
  not touched. The app bundle reads `CFBundleShortVersionString` 1.0.59 because
  the iOS plist is stamped at release time.

## B. The four monitor commands are denied on iOS

`src-tauri/capabilities/ios.json` adds `core:window:deny-current-monitor`,
`deny-available-monitors`, `deny-primary-monitor` and `deny-monitor-from-point`
after the three geolocation grants, keeping `platforms: ["iOS"]` and
`windows: ["main"]`; its `description`, and `default.json`'s sentence about what
`ios.json` holds, say so.

- A deny beats an allow in tauri 2.11.2: `resolve_access` in
  `src/ipc/authority.rs` returns `None` whenever `denied_commands` holds the
  command, before it reads `allowed_commands`.
- `tauri-build` accepted the four identifiers: the regenerated (gitignored)
  `gen/schemas/capabilities.json` lists all seven `ios` permissions. A bad
  identifier would have failed that compile.
- Guard rows: a new row in `iosMonitorLookups.test.ts` pins the four denies, in
  order, and that `ios.json` is iOS-only; `androidProjectPins.test.ts`'s row now
  pins the seven-entry list exactly.
- Runtime: the simulator builds in A7 carried the denies and launched and drew.
- Partial: the inner screen, where the abort would happen, cannot be drawn on
  this Mac (no Simulator app), so the deny is confirmed from the ACL and the
  build, not from a refused call there.

## C. `npm audit` clears: Vite 8.1.6

Control first: the pre-change lockfile, audited with network in a scratch copy,
still shows the 4 advisories (2 high, 2 moderate), the vite range named as
`8.0.0 - 8.1.5` (`evidence/npm-audit.txt`).

**Choice: vite 8.1.6, the smallest fixed release.** The vulnerable range ends at
8.1.5, and every 8.0.x is inside it, so 8.1.6 (2026-10-06) is the first release
that clears it.

| vite | rolldown | lightningcss | postcss | |
|---|---|---|---|---|
| 8.0.16 (before) | 1.0.3 | ^1.32.0 (1.32.0) | ^8.5.15 | 4 advisories |
| **8.1.6** | ~1.1.5 | ^1.32.0, so 1.32.0 stays | ^8.5.17, so 8.5.26 stays | chosen |
| 8.2.4 | ~1.2.4 | ^1.33.0 | ^8.5.26 | moves the CSS minifier |
| 8.3.5 (`npm audit fix`'s pick, published 2026-10-21) | ~1.2.14 | ^1.33.0 | ^8.5.30 | three minors, one day old |

8.1.6 keeps lightningcss, the CSS minifier, on 1.32.0, and the built stylesheet
came out byte-identical. 8.2.4 and 8.3.5 would each move lightningcss to 1.33 and
rolldown further, for no advisory 8.1.6 leaves open.

How: `npm install vite@8.1.6 vitest@4.1.12`, then `npm update source-map-js`
(1.2.2), then `package.json`'s declared ranges restored to `^8.0.10` and
`^4.1.11` and `npm install` run to re-sync the lockfile's root, so `package.json`
changes only by its version. 35 lockfile entries moved, all dev
(`evidence/lockfile-moves.txt`): vite, rolldown and its 15 bindings, vitest and
its six `@vitest/*` packages, source-map-js, and small transitive moves
(`@emnapi/*`, `@napi-rs/wasm-runtime`, `@oxc-project/types`, `@tybys/wasm-util`,
chai, picomatch, tinyrainbow). Nothing outside the dev tree moved.

After the move:

- `npm audit` reads 0 on the full tree and 0 with `--omit=dev` (with network).
- **The native bindings:** the same 38 rolldown, lightningcss and tailwind oxide
  entries as before, with no difference in `os`, `cpu`, `libc`, `optional` or
  `dev`. Every target keeps its three: macOS arm64 and x64, Windows x64 (and
  arm64), Linux x64 glibc for CI, linux-arm64 and arm-gnueabihf for the Pi, plus
  the musl, FreeBSD, Android, ppc64, s390x, OpenHarmony and wasm entries.
- **The build output:** the same source built with each toolchain in identical
  scratch mirrors (`evidence/dist-toolchain-diff.txt`): the stylesheet is
  byte-identical; the JS differs only by rolldown's output (70 of the JS files and
  `index.html` change bytes, most only by renamed import hashes), and one tiny shared chunk,
  `recentObsReduce`, is folded into `mapService`, its one other importer; both
  remain dynamically loaded by `transport`, as before. The entry chunk grows by
  6 bytes. The existing chunk-size warning (over 1,100 kB) prints on both.
- `npm ci` installs the new lockfile cleanly in a fresh copy (344 packages).
- **`server.cors: false`:** the backend's static row passes, and behaviorally a
  foreign-origin preflight carrying the app's header to a proxied route is
  forwarded to the backend, with no `Access-Control-Allow-*` headers from Vite,
  on 8.1.6 as on 8.0.16. Control: with `--cors`, Vite 8.1.6 answers the same
  preflight itself with `Access-Control-Allow-Origin: *`
  (`evidence/vite-preflight.txt`). No dev server was left running.
- `npm run build`, `eslint .` and the full vitest suite: below.

## D. The version bump to 1.0.60

Moved: `frontend/package.json` and the lockfile's two root `version` fields;
`src-tauri/tauri.conf.json` (`version` 1.0.60, `bundle.android.versionCode`
1000060); `CHANGELOG.md` (a 1.0.60 entry, Fixed and Internal); `website/index.html`
(the pill text, its `aria-label`, and the `footer-version` line, nothing else);
the F-Droid recipe (three `Builds` entries to `versionName: 1.0.60` and codes
10000601, 10000602 and 10000604, `CurrentVersion` 1.0.60, `CurrentVersionCode`
10000604).

- **The recipe's `commit:` lines still name v1.0.59's commit**
  (`a654a9b0fb63297d182d3f3da3e4c3d9cbc1d9a1`). That follows the precedent: the
  bump moves versions and codes, and a follow-up commit after the tag sets each
  `commit:` to `git rev-parse v1.0.60^{commit}` (as `4d5657c8` did at 1.0.59).
  `fdroidRecipe.test.ts` checks the shape only and passes.
- **The three Fastlane changelogs are not written.** They are published copy,
  prepared in `held-copy.md` (a). Until they are written, `fastlaneMetadata.test.ts`
  fails two rows, "has the same changelog under each per-processor code of the
  current version..." and its guard-the-guard row, each naming
  `changelogs/10000601.txt`, `10000602.txt` and `10000604.txt` as missing. The
  Tester can read those two as expected. The CHANGELOG's last Internal line names
  the three files, as every release since 1.0.53 has.
- The iOS plists are stamped by `tauri ios build` at release time, not here.

## Verification

- `npm run typecheck`: exit 0. `npm run build`: exit 0. `eslint .`: exit 0, no
  output (`evidence/gate.txt`).
- Full vitest suite, run 1, with nothing else compiling: 480 files (474 passed,
  1 failed, 5 skipped), 10,371 tests (10,363 passed, 2 failed, 6 skipped). The two
  failures are the `fastlaneMetadata.test.ts` rows in D, and nothing else failed.
  Run 2, after a comment-only edit to `globals.css`: the same two, plus the
  timing-ratio row in `weatherStatsShared.test.ts` ("grows about 2x per doubling
  on hostile input", 3.47 against a bound of 3) under a load average of 62 to 130
  from other work on this Mac (Spotlight indexing and an app in the booted iPhone
  17 Pro simulator). That file passes 24 of 24 alone, three runs out of three,
  and this change touches nothing it reads; testing.md says a timing-ratio suite
  is judged only with nothing else running, so it is load, not a regression
  (`evidence/full-suite-summary.txt`).
- Backend: `test_the_vite_dev_server_leaves_preflights_to_this_backend` and
  `test_cors_admits_no_origin` pass. No backend file changed.
- Non-ASCII: the only non-ASCII in added lines are the box-drawing rule in the new
  `iosChrome.test.ts` section header (the file's existing style), and the `§` in
  `ios.json`'s description and the `·` in the website footer, both already there.
  No em dash was added anywhere.
- `docs/HELP.md` is unchanged: it describes the Welcome screen's three buttons,
  not its layout. No App Store screenshot shows the Welcome screen.

## Partial

- The Duo's inner screen and a real Duo (standing decision; this Mac has no
  Simulator app).
- Android: the twin is stated by mechanism; no emulator ran, so a landscape
  cutout and the top shift were not measured on Android.
- iPad and upright iPhone: the top shift is measured in desktop WebKit with the
  insets substituted, not on those simulators (the booted iPhone 17 Pro belongs
  to other work and was not used).

## Gitignored files this run changed

`src-tauri/gen/apple/Externals/arm64/debug/libapp.a` (now the clean 1.0.60
simulator library), `src-tauri/target/aarch64-apple-ios-sim/`, and
`src-tauri/gen/schemas/` (regenerated by `tauri-build`). The tracked tree under
`src-tauri/gen/` is unchanged.

## C, addendum (from QA, C3)

`evidence/dist-toolchain-diff.txt` says the JavaScript differs "most only by
renamed import hashes". QA's two-toolchain rebuild found more: rolldown 1.1
drops the test-only work-stats recorders in five durable stores
(`replayStore`, `countyCompletenessCache`, `checklistProjectsCache`,
`exoticProvenanceCache`, and the `hotspotActivityCache` copy inside
MapExplorer). Each recorder starts `null` and is assigned only by a
`...ForTests` seam that both builds already tree-shake, so the dropped branches
never ran in the app; they account for the 180 to 370 byte size drops in those
chunks. The rest of the diff is boolean rewrites, each checked equivalent.

## Ship (2026-10-22)

The durable facts from the Deployer's record, which stays on disk and out of
git (`pipeline/.gitignore`). `RELEASE_LEDGER.md` holds the App Store and
Android entries; this section holds what they do not.

- **Sign-off:** the user's answer at the production gate, "Confirm: approve the
  texts and ship 1.0.60", approved `held-copy.md` (a) and (b) word for word and
  authorized the all-platforms ship. The three Fastlane changelogs were written
  from (a), 239 bytes each, SHA-256 `1ea3ae37...b76a5`.
- **Gates before the release commit:** typecheck exit 0; the full vitest suite,
  480 files, 10,371 tests, 0 failed, 6 skipped (the two `fastlaneMetadata` rows
  red at QA passed once the changelogs existed); `npm run build` exit 0.
- **Commits:** release `231a3dba` (16 files); annotated tag `v1.0.60` (tag
  object `3a214230`, the first annotated tag; `release.sh` and
  `scripts/android/preflight.sh` peel with `^{commit}`); recipe `7e20a44a`
  (the three `commit:` lines name `231a3dba`); iOS stamp `9638f827`; ledger
  `5435b907`.
- **Desktop:** `release.sh` exit 0; notarization `816cb61f` Accepted, stapled;
  release `421320280`, Latest. The downloaded DMG passes `codesign`, `stapler`,
  `spctl` and `hdiutil verify`; the published Windows installer is
  byte-identical to Windows Build `39874502503`'s artifact; `latest.json` names
  1.0.60 on all three targets.
- **CI:** Windows Build `39874502503`, Android Build `39874502456`, Pages
  `39874500224` (the site answers with pill and footer at 1.0.60). Pipeline run
  of record `39875248987` on `9638f827`: attempt 1 passed the tests and the
  build and then hit the 40-minute job limit inside `npx playwright install
  --with-deps` on a slow Ubuntu mirror; attempt 2 green, 8/8 real-engine
  harnesses. The runs on `231a3dba` and `7e20a44a` were cancelled by the next
  push (`cancel-in-progress`).
- **iOS:** widget extension Swift tests 143, 0 failures, on a local iPhone 18
  Pro simulator; archive 1.0.60 (1.0.60.1) on the iOS 27.1 SDK (`24A94232`);
  IPA SHA-256 `41aa754c...176ce`; `altool --validate-app` then
  `--upload-app`, delivery `38fe3617`, VALID. All iOS icon PNGs opaque.
- **Android:** preflight passed; signed APK SHA-256 `afabdc30...f1b3`, signer
  `42a3576e...996a`. On the API 36 emulator with the 1.0.59 sideways-cutout
  setup (tall-notch cutout, 360 by 640 dp, rotated; an 88 px cutout on the
  left) the card moved from x = 131 to 1548 (center 839.5) in 1.0.59's picture
  to x = 175 to 1592 (center 883.5), and the title from y = 70 to 107
  (`evidence/ship/`). Seen at that size and not introduced here: the column's
  top cannot be scrolled into view, and scrolled content passes under the
  see-through status bar (DECISIONS.md, v1.0.60; idea `5d386ebd`). WebView 133.
- **F-Droid**, read at 01:17 UTC on 2026-10-23: f-droid.org publishes 1.0.56,
  1.0.55 and 1.0.53; fdroiddata `master` has `CurrentVersion` 1.0.59 and no
  1.0.60 entry; 1.0.57 and 1.0.58 are superseded on F-Droid by 1.0.59; 1.0.59
  and 1.0.60 are each included and this tag not yet built. Nothing was sent.
- **App Store:** record `c8841bbd` on build 1.0.60.1; What's New (b) and the
  restored promotional text written to localization `6bd39af5`; both
  screenshot sets carried over (`1740745b`, `b1627ad1`), checksums equal to
  `appstore/screenshots/`; age rating already answered; submission `5e9ba5d3`
  `WAITING_FOR_REVIEW` at 01:16:18 UTC. Reconciliation after submitting: 28
  records, 84 TestFlight trains, no unaccounted gap from 1.0.13 to 1.0.60.
