# Change Brief — Apple Platform Readiness

## What is changing

Four items from Apple's 2026 platform releases (iOS/iPadOS/macOS/Safari 27, all shipped 2026-09-14). One is a real defect waiting to happen: the iOS project has no `UIApplicationSceneManifest` and no scene delegate, so the next iOS build made with Xcode 27 produces an app that **traps at launch** (`___UIApplicationEvaluateRuntimeIssueForNoSceneLifecycleAdoption`). The fix is a static scene manifest added to `gen/apple/project.yml` and `gen/apple/snowraven_iOS/Info.plist`. The second item closes a stale version in the iOS generator input. The remaining two are **verification**, not fixes: Safari 27's new scroll anchoring, and per-side safe-area insets for the foldable iPhone Duo. Neither gets speculative code — each is confirmed clean in writing, or it becomes a fix.

## Why now

Apple's 2026 OSes shipped today, and Xcode 27 is the only Xcode on the build machine. Every SnowRaven release carries an iOS TestFlight leg as a standing rule, so the **next ship is the trigger**: it would upload a build that installs and then fails to open. `altool --validate-app` checks icons and entitlements, not scene adoption, so nothing in the existing release recipe would catch it — TestFlight would accept it and users would get a dead app. The shipped 1.0.30 binary is unaffected (built against an older SDK); App Store Connect does not require the iOS 27 SDK until April 2027. This bites on the build, not on the deadline.

## User-facing impact

None intended on any existing surface. One consequence must be decided rather than absorbed: on tao 0.35.3 (what Tauri 2.11.2 pins), tao only takes the scene path when `UIApplicationSupportsMultipleScenes` is **true**, and that flag also declares the app multi-window-capable on iPadOS — an iPad user could open two SnowRaven windows side by side, which they cannot today. Whether a manifest with the flag **false** still satisfies the iOS 27 validator is the open question, and it is settled by launching a build, not by reasoning. If the flag must be true, that is an accepted platform side effect, not a designed capability; actually *supporting* iPad multi-window would be a separate feature run. The app already holds its layout to 320px, so a half-width window needs no new work.

## Design pass

Not needed — no visual change. The work is a plist manifest, a version string, and verification of CSS that already exists. Even if iPad multi-window lands as a side effect, the window chrome is the OS's and the app's existing responsive contract already covers the narrow case.

## Decisions touched

None reversed. Two are **extended**:

- **v0.5.68, the iOS app icon fix** — established that `gen/apple` is a committed generated artifact and that re-running `tauri ios init` re-stamps Tauri's placeholders, so hand-edits there are the house pattern. This work applies that same reasoning to `project.yml`, which is the generator *input*.
- **v0.5.73, the iOS stamp rule** — `tauri ios build` stamps `gen/apple/snowraven_iOS/Info.plist` with the version and build number. Item 4 is the gap in it: the stamp reaches the **output** only, so `project.yml` still says `0.5.63` while the plist correctly says `1.0.30` / `1.0.30.1`. A regeneration would silently revert the shipped iOS version by five minor releases, and the four-file parity guard (`icloudKeysPublishedClaims.test.ts`) does not read `project.yml`, so nothing would go red.

Adjacent but untouched: the v1.0.13 macOS 26 `available_monitors()` entry (native macOS window enumeration, not iOS scenes).

## What done looks like

An iOS build produced with Xcode 27 installs and **launches** on an iOS 27 device or simulator, with the map, tabs and stored files working exactly as on 1.0.30, and the multi-scene flag decision written down with its reason. `project.yml` and the generated `Info.plist` agree on the shipped version, with a guard that fails when they drift rather than a convention that asks someone to remember. The two verification items are each closed in writing — confirmed clean, or turned into a named fix — with no `overflow-anchor` or inset code added speculatively.

---

## Findings behind the scope (for The Engineer)

### 1. UIScene — upstream has NOT fixed this, so the patch is ours

Verified in the repo: no `UIApplicationSceneManifest` in `src-tauri/gen/apple/snowraven_iOS/Info.plist`; no scene delegate; the only sources are `Sources/snowraven/main.mm` (a three-line `ffi::start_app()`) and `bindings/bindings.h`. `LaunchScreen.storyboard` and `UILaunchStoryboardName` are present, so the separate iOS 27 launch-screen requirement (TN3208) is already satisfied.

**The upstream question, answered:** tao 0.37.0 (2026-08-21, commit `a3ff3f03`) makes the app delegate *always* implement `application:configurationForConnectingSceneSession:options:`, which is the real fix. It is **not reachable from any stable Tauri**. `tauri-runtime-wry`'s latest stable is 2.11.4 and it pins `tao = "0.35.0"`; the entire Tauri 2.x line is on `^0.35`, and this repo resolves tao 0.35.3. tao 0.37 arrives only with `tauri 3.0.0-alpha.0`, published 2026-09-13 — an alpha that moves to edition 2024, Rust 1.95, and a changed default feature set. **Not shippable.** So: hand-patch the manifest now, and revisit the tao upgrade when Tauri 3 is stable.

**Why the manifest needs care.** In tao 0.35.3, `multiple_scenes_enabled()` (in `platform_impl/ios/scene.rs`) reads `UIApplicationSceneManifest` → `UIApplicationSupportsMultipleScenes` from the Info.plist. When false, `did_finish_launching()` calls `on_app_ready()` directly and the scene path is never taken. The scene delegate's registered Objective-C class name is **`TaoSceneDelegate`** — a static `UISceneDelegateClassName` must match it exactly.

**Known trap in Tauri's own docs:** tauri-apps/tauri issue **#15719** (open, `priority: 0 crash`, filed 2026-07-14) reports that Tauri's documented multi-window setup uses an **empty** `UISceneConfigurations` dict, and that this *also* traps under the iOS 27 SDK — the validator reads the static manifest and ignores tao's runtime registration. The reporter verified on hardware that a real configuration entry naming `TaoSceneDelegate`, with `UIApplicationSupportsMultipleScenes` true, launches fine. Do not copy the empty-dict form from Tauri's docs.

**Open risk to settle by building, not by reasoning:** whether `UIApplicationSupportsMultipleScenes: false` plus a real configuration entry satisfies the validator *and* leaves tao's startup coherent. With the flag false, tao takes the non-scene path while UIKit runs the app in scene mode, which may double-call `on_app_ready()` or mis-attach the window. Try false first (it preserves today's single-window behavior); fall back to true if it traps or misbehaves. Either way, record which and why.

**Environment note, corrected:** `xcode-select -p` points at `/Library/Developer/CommandLineTools`, so bare `xcodebuild` does not run — but the release skill's iOS recipe already works around exactly this with the `/tmp/xcshim` wrapper plus `DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer`, and explicitly says **not** to `sudo xcode-select`. No environment change is required of the user. Note `/tmp/xcshim` does not survive reboots and is recreated as a first step every time.

### 2. Safari 27 scroll anchoring — lower risk than it looks, and PlanChart is the least exposed

Verified: **zero** `overflow-anchor` declarations in the repo. Two facts reframe this item.

**The spec adjusts the block axis only.** Per CSS Scroll Anchoring Level 1, the adjustment is applied in the *block flow direction*. `.sr-plan-scroller` is `overflow-x: auto; overflow-y: hidden` in a horizontal writing mode, so its scrollable axis is the **inline** axis and is not anchored at all. PlanChart — flagged as the most exposed site — is structurally the least exposed. Its four scroll writes (`PlanChart.tsx` ~454 zoom-preserve, ~475 `scrollByDay`, ~514 drag, ~538 keyboard reveal) are all horizontal. **Count corrected at QA, 2026-09-14: this read "three scroll writes" and omitted `scrollByDay`, which writes `scrollBy({ left })` and is horizontal like the rest — so the conclusion is unchanged and the enumeration is now complete.**

**The app has already shipped under scroll anchoring for years.** Chromium has had it on by default since 2017, so the Windows desktop app (WebView2) and every Chrome/Edge/Firefox web user have been running with it since day one, with no reported issue. Safari 27 is the last engine to adopt it, and it reaches macOS 26 and Sequoia too, so it lands on existing users.

**Corrected by measurement at QA, 2026-09-14: the paragraph above is true and does not transfer.** Of the four block-axis sites named below, **three were driven and the fourth was not**: the `lib/scroll.ts:29` wrapper was left undriven, and `pr-description.md` records it as an unverified region — what its four call sites are, that they all scroll the page, and why shipping it unmeasured was judged acceptable — rather than counting it as clean. Of the three that were driven, one — `SpeciesCombobox.tsx:94`, on the `.sr-combobox-list` scrollport — reads differently in WebKit after a filter-driven rebuild (`scrollTop` 47 as shipped against 162 with anchoring off, five readings each, zero variance), and it is precisely a site **Chromium does not adjust at all** (162 in every configuration). So Chromium's long exposure could never have covered this one: long exposure to one engine is evidence about that engine. The difference was judged not to meet this brief's "a real jump" bar — nothing is lost, hidden or unreachable, and no keyboard or ARIA path reads the offset — so no `overflow-anchor` was added. The full measurement and the reasoning for that decision are in `pr-description.md`.

**What to actually check** — the block-axis scrollers, and only these: `HelpDocs.tsx:368` (`body.scrollTop += …`, the one direct `scrollTop` write — not "the one programmatic vertical scroll", since the wrapper at the end of this same list is one too), `SpeciesCombobox.tsx:94` and `CommandPalette.tsx:190` (`scrollIntoView({block:'nearest'})` into vertical lists), and the `lib/scroll.ts:29` wrapper. Verify in Safari 27 or the built app. Add `overflow-anchor: none` **only** where a real jump is observed, and record the null result if there is none.

### 3. Asymmetric safe-area insets — already correct; make it stay correct

Verified in `frontend/src/globals.css`: 34 `safe-area-inset` uses in total, of which **ten** are horizontal declarations (lines 949/950, 1631/1632, 1686/1687, 1728/1729 as matched per-side pairs; 1958 `calc(16px + env(safe-area-inset-right))`; 3100 `calc(16px + env(safe-area-inset-left))`). An eleventh match at line 4999 is inside a comment. Every one is per-side — no doubling, no left value reused for right. `frontend/index.html` already carries `viewport-fit=cover`. Twelve guard test files already assert safe-area CSS.

So this passes as-is. The only candidate work is a guard that pins the per-side property so a future edit cannot introduce a doubling assumption. WebKit has no Device Posture or Viewport Segments API, so the app cannot detect a fold at all — there is nothing to build for the iPhone Duo beyond not assuming opposite insets are equal, which the stylesheet already doesn't.

### 4. Stale version in the iOS generator input

`src-tauri/gen/apple/project.yml` declares `CFBundleShortVersionString: 0.5.63` and `CFBundleVersion: "0.5.63"`. The generated `snowraven_iOS/Info.plist` correctly carries `1.0.30` / `1.0.30.1`. `xcodegen` is installed at `/opt/homebrew/bin/xcodegen`, so a regeneration is a real possibility, and it would silently revert the iOS version. No test reads `project.yml`.

Two shapes are available and the choice is The Engineer's: stamp `project.yml` alongside the plist (making it a fifth file in the version set), or **remove the version keys from `project.yml` entirely** so the generator stops carrying a value that the build immediately overwrites — which removes the drift rather than policing it. The second is probably cleaner. Whichever lands, note that CLAUDE.md already records the parity guard's known weakness: it is a `toContain` substring check over the whole file, so it goes green as soon as one correct version string exists anywhere. A new leg added naively inherits that weakness.

### Explicitly out of scope

- **Liquid Glass visuals.** The CSS property is private; using it risks rejection. `prefers-reduced-transparency` is unimplemented in WebKit.
- **An arm64-only Mac build.** The universal DMG stays.
- **The App Store Connect age-rating social-media questionnaire.** No code, but it is a **ship-blocker**: the user must answer it in ASC before the next iOS submission. Named here so it is not forgotten at the deploy gate.

### Release shape

The scene manifest changes the shipped iOS bundle, so it is not covered by CLAUDE.md's dev-only exemption. Two routes are legitimate and the Deployer should pick one deliberately: a normal patch bump across the four version files, or — following the v0.5.68 icon-fix precedent for an iOS-config-only change — an iOS build-number increment against 1.0.30 with no tag, no `release.sh` and no `latest.json`. The `project.yml` fix alone would be exempt; it is not shipping alone.
