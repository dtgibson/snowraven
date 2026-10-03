# PRD: Android Release
**Feature:** android-release
**Date:** 2026-10-03
**Stage:** 2 (The Planner)
**Source:** strategic-brief.md (approved; revised 2026-10-03)

Revised 2026-10-03 on a Stage 2 re-entry: F-Droid replaces Google Play as the Android store leg, the geolocation plugin leaves the Android build, and the no-Google posture is a requirement; retired IDs are kept in place and marked so downstream references stay valid.

### Feature Overview

SnowRaven built as an Android app for phones and tablets from the same Tauri project that ships to macOS, Windows, iPhone and iPad: one committed Android project that contains nothing of Google's, the capability gates re-keyed so every Apple-only surface is absent rather than broken, a release leg (CI build of the unsigned APK, signing with the user's own key on the release machine, a universal APK on the GitHub release, in-repo Fastlane metadata and an fdroiddata recipe that let F-Droid build and list the app from the tagged source) that joins the standing rhythm, and held proposals for the F-Droid listing and the published copy. The first Android ship is a full all-platforms release, not an Android-only drop.

### User Stories

> **US-01** As a birder with an Android phone, I want to install SnowRaven from F-Droid, so that I can open my own eBird backup and Macaulay export in the field without a laptop, a home server or a store account.

> **US-02** As an Android birder, I want to import my two export files through my phone's own file picker, so that the files stay on my device and nothing is uploaded anywhere.

> **US-03** As an Android birder, I want every tab to work with my own eBird and OpenWeather keys exactly as it does on an iPhone, so that the weather and tide block, Species Detail, Statistics, Map Explorer and Targets give me the same answers on either phone.

> **US-04** As an Android birder, I want to see only the settings that apply to my phone, so that I never meet an iCloud, widget, Alerts, update or location control that does nothing when pressed.

> **US-05** As an Android birder who wants the app before the F-Droid listing lands, or who does not run the F-Droid client, I want to download a signed APK from the GitHub release, so that the free public good stays reachable to me, with the trade-offs stated plainly.

> **US-06** As the solo developer, I want the Android leg to run from my Mac with the same shape as the Windows and iOS legs (CI builds, I sign the GitHub APK, F-Droid builds and signs its own from the tag), so that every future release reaches Android with no per-release upload and no second toolchain to remember.

> **US-07** As the solo developer, I want the F-Droid listing metadata, the privacy policy edits and the website and README sentences prepared as held proposals, so that nothing about Android is published until I have read and approved the exact words.

> **US-08** As an Android birder on a phone without Google services, I want a build that compiles in, links to and requests nothing of Google's, so that the app installs and works on my phone exactly as it does on any other.

### Functional Requirements

#### A. The Android project

> **FR-01** The repository shall carry a committed Android project under `src-tauri/gen/android`, generated once and then maintained by hand, that builds a release universal APK from a clean checkout with the toolchain the runbook names, on the developer Mac, on the Linux CI runner and on F-Droid's build server alike.

> **FR-02** The runbook shall document a regeneration procedure for the Android project that mirrors the iOS keep-aside-and-restore rule: which committed files a re-run of the generator would overwrite, which of them carry deliberate edits (the application id, the manifest permissions, the icon set, the splash and theme resources, the `MainActivity.kt` plumbing this run owns: the inset injection, the theme listener and, under FR-17, the location permission callback; and the removal of the gradle wrapper jar under FR-61), how each is set aside and restored, and that every touched file is checked by content rather than by the changed-file list.

> **FR-03** A guard test, runnable on the Linux CI runner without Android tooling, shall fail when the committed Android project no longer carries any of the deliberate edits named in FR-02, so that a regeneration that silently drops one goes red.

> **FR-04** The Android application id shall be `com.dtgibson.snowraven`, matching the iOS bundle id, and shall be set deliberately rather than derived from `tauri.conf.json`'s `com.snowraven`, whose value shall not change (a desktop identifier change moves the Mac data directory and breaks the shipped updater). F-Droid keys its listing, update checker and signing on this id and never lets it change. The user confirmed the choice (OQ-01, resolved).

> **FR-05** The Android version name shall be the shared version in `src-tauri/tauri.conf.json`. The Android version code shall be written at the bump as `bundle.android.versionCode` in that same file, from Tauri's own formula `major * 1000000 + minor * 1000 + patch` (1.0.48 is 1000048), so that F-Droid's update checker reads both strings from one committed file at the tagged commit. No file under `src-tauri/gen/android` shall hand-set either value. The four-file version bump (`frontend/package.json`, `src-tauri/tauri.conf.json`, `CHANGELOG.md`, `website/index.html`) shall stay four files, since `tauri.conf.json` is already one of them. Two guards police the bump and each asserts a different thing: the existing fourth-file guard (`it('the website version pill and footer follow the app version')` in `icloudKeysPublishedClaims.test.ts`) asserts that the website pill and footer carry the app version; the Android guard (FR-06) asserts that the version code in `tauri.conf.json` equals the formula applied to the version string beside it, so a bump that moved the string and forgot the code goes red.

> **FR-06** A guard test shaped like the iOS "stamped version never leads" test (pure JS, comments stripped before scanning, failing closed on a shape it does not understand, with guard-the-guard rows) shall assert three things: that `bundle.android.versionCode` in `tauri.conf.json` equals the formula applied to the `version` in the same file; that no version string in the committed Android project leads `frontend/package.json`; and that no literal version name or version code is committed under `src-tauri/gen/android`.

> **FR-07** The Android version floor shall be API 24 (Android 7.0). The target API level shall be the current stable Android API level on the day the first release build is made, recorded in one place in the project with the date it was read; F-Droid imposes no target level, so the choice rests on the permission and storage behavior the current level brings, not on a store rule (OQ-07).

> **FR-08** Rust dependency discipline shall hold: a crate real on Android joins the `any(android, ios)` block or `[dependencies]`; no Apple-vendor crate moves out of its block to make the Android target compile; the `cfg(mobile)` plugin registration in `lib.rs` is reused for the dialog plugin and the `cfg(target_os = "ios")` block stays iOS-only. `tauri-plugin-geolocation` shall leave the `any(android, ios)` dependency block for an iOS-only block, and its `.plugin(tauri_plugin_geolocation::init())` registration shall move from the `cfg(mobile)` registration to the iOS-only one, so the Android binary never compiles or links it (its Android side depends on `com.google.android.gms:play-services-location`). If the vendored tao or any locked crate does not build for an Android target, the build stops and the run flags the user; a Tauri or tao upgrade is not a remedy available to this run.

> **FR-09** The app shall ship an adaptive launcher icon built from the committed set under `src-tauri/icons/android`, and a listing icon that is 512 by 512, fully opaque, full-bleed, with the mark inside the adaptive icon's safe zone, placed at `images/icon.png` in the Fastlane metadata folder (FR-57). A guard shall check the committed launcher assets' dimensions, the listing icon's opacity and that the adaptive icon resource names the committed foreground and background.

#### B. Capability gates, re-keyed per call site

> **FR-10** The app shall gain an `isAndroid()` predicate on the same synchronous `platform()` probe as `isIOS()` and `isMacOS()`, with the same false-when-not-Tauri and false-on-throw posture, used only for capability branching and never for layout. No user-agent sniffing shall be added; `isWindows()`'s pattern is not copied. `isIOS()` itself shall keep returning false on Android.

> **FR-11** Each existing `isIOS()` call site shall be classified as Apple-specific, mobile, or no-updater, and shall take the Android reading below. A test shall pin every reading with the platform probe mocked to `android`.

| Site | Today | Classification | Android reading |
|---|---|---|---|
| `lib/platformGates.ts` `showUpdaterFooter` | `!isIOS()` | no-updater | false: no footer, no update control, no update request (FR-12) |
| `lib/platformGates.ts` `supportsAppRelaunch` | `!isIOS()` | no-updater (process plugin absent on mobile) | false: Rebuild caches still clears, then says to close and reopen the app (FR-13) |
| `lib/platformGates.ts` `compactChrome` | `isIOS()` | mobile | true, as The Designer recorded (FR-14) |
| `lib/platformGates.ts` `showICloudSync` | `isTauri() && (isIOS() \|\| isMacOS())` | Apple-specific | false by construction; unchanged (FR-15) |
| `lib/alerts/alertsState.ts` `alertsSupported` | `isTauri() && isIOS()` | Apple-specific | false; unchanged (FR-15) |
| `lib/widgets/widgetHandover.ts` `widgetsSupported` | `isTauri() && isIOS()` | Apple-specific | false; unchanged (FR-15) |
| `components/Settings.tsx` file-row button label | `fileRowButtonLabel(..., isIOS())` | mobile | "Import" wording on Android (FR-16) |
| `components/Settings.tsx` pick handler | `isIOS() && IOS_IMPORT_MECHANISM === 'dialog'` | mobile, measured per platform | the import mechanism measured on an Android emulator; a per-platform constant, never one shared literal (FR-26) |
| `lib/location.ts` `getCurrentLocation` | `isIOS()` routes to the geolocation plugin | mobile, measured (FR-55) | Android never invokes the geolocation plugin or the desktop `get_location` command: under branch A it uses the WebView's own `navigator.geolocation` (FR-17); under branch B it throws the existing `unavailable` code (FR-56) |
| `lib/location.ts` `describeLocationError` | iOS sentence, else Windows, else macOS | Apple-specific copy | under branch A, an Android sentence naming where Android keeps the permission; the macOS sentence is never shown on Android (FR-18); under branch B no location error can arise on Android because no control requests a position |
| `components/MapExplorer.tsx` `iosFullscreen` | `isIOS() && isFullscreen` | mobile | the same overlay treatment in fullscreen on Android, as The Designer recorded (FR-19) |
| `main.tsx` `sr-ios-app` root marker | `isIOS()` | mobile insets, platform-named | The Designer's Android inset rules (the `--sr-inset-*` variables) apply; `sr-ios-app` is never applied on Android (FR-20) |
| `lib/paletteHint.ts` `resolveChordHint` | `isIOS() \|\| coarsePrimaryPointer()` returns none | Apple-specific, correct by order | no change: a touchscreen already resolves to no hint and a hardware keyboard on Android resolves to Ctrl K (FR-21) |

> **FR-12** On Android the app shall show no in-app update affordance and shall make no request to GitHub for release information or update assets, on launch or at any later time.

> **FR-13** On Android the Troubleshooting Rebuild caches control shall remain present, perform its cache clear, skip the relaunch, and tell the user to close and reopen the app, in the same words iOS uses.

> **FR-14** On Android the app's top chrome shall take the compact form used on iPhone and iPad unless The Designer records a reason to differ, and the Map Explorer panel shall size to the visible viewport under that chrome so the map and its controls are above the fold on tab open.

> **FR-15** On Android no iCloud Sync section, no Copy iCloud details control, no widgets settings, no Alerts section, no inbox entry point (header bell, sidebar item, Search result) and no Alerts-only Help entry shall render. Each is absent, not disabled, with no placeholder saying it is unavailable.

> **FR-16** On Android the two Default Files rows shall label their action "Import" (and its uploading and replace variants) exactly as iOS does, never "Upload".

> **FR-17** (Branch A: FR-55's measurement shows the plugin-free route works.) On Android, every location control (the map's location button, Use my location in the map filters and in Settings, My location on Targets, the Current weather and tide lookup, and Plan with no place chosen) shall obtain a position through the Android System WebView's own `navigator.geolocation`, served by the WebView geolocation permission callback and the runtime location permission request in `MainActivity.kt`, never through the geolocation plugin and never through the desktop command. The first request shall raise the Android system permission dialog once; a later request shall not re-prompt unless the system's rationale state asks for it. A refusal, including the state in which Android stops asking, shall produce the permission-denied message; a position that does not arrive within the existing ten-second timeout shall produce the timeout message, not the denied one. The Designer's location surface stands under this branch.

> **FR-18** (Branch A only.) On Android the permission-denied message shall name the Android route to the setting (Settings, Apps, SnowRaven, Permissions, Location) in the same register as the iOS and Windows sentences, and shall be the only platform sentence shown on Android.

> **FR-19** On Android, with an embedded map or Map Explorer in fullscreen, the filters sidebar shall behave as it does on iOS at the same width (an overlay with containment when the tier is modal, an in-flow column otherwise), and the fullscreen controls shall clear the status bar, the navigation bar and any display cutout in both orientations.

> **FR-20** On Android no app content shall sit under the status bar, the navigation bar or a display cutout, in portrait or landscape, at the target API level's default window behavior. The Designer owns whether that is achieved with an Android root marker and inset rules of its own; the iOS marker and its rules are not reused by name.

> **FR-21** The Search entry control's key-chord hint shall show nothing on an Android touchscreen and "Ctrl K" when a hardware keyboard is the primary pointer's companion, with no change to the hint module.

> **FR-22** No control rendered on Android shall invoke a plugin, native command or capability the Android binary does not carry, the geolocation plugin included. A test shall enumerate the commands and plugin calls reachable from the Android render tree against the mobile registration and the Android capability grants.

#### C. Plugins, grants and manifest permissions

> **FR-23** The geolocation grants (check, request and get-current-position) shall live in a capability whose `platforms` list names iOS only. Android shall be granted `dialog:allow-open` for the `main` window only, beside the shared default capability, and nothing else; The Architect names whether that is one mobile capability file with the geolocation grants split out or two platform files. The desktop capability file shall stay desktop-only; the default capability file shall keep the `$APPLOCALDATA/**` file scope unchanged.

> **FR-24** The Android manifest shall declare Internet access and, under branch A only, coarse and fine location, and nothing else: under branch B no location permission at all; in either branch no background location, no storage or media permission, no camera, no notifications. Cleartext network traffic shall not be permitted.

> **FR-25** The Android app shall persist its API keys, settings, metadata, data files, bar-chart files and derived caches through the existing `storage` seam into the app's private storage, with the same document names and chains as the other Tauri targets, and shall need no storage permission to do so.

#### D. File import

> **FR-26** On Android each Default Files row shall present the system document picker when its Import action is pressed. Whether the file input or the dialog plugin is what presents it shall be measured on an emulator (the iOS Mechanism A/B switch becomes a per-platform reading), and the chosen mechanism shall be recorded with the measurement.

> **FR-27** Cancelling the picker shall change nothing: no error line, no announcement, the slot's existing file untouched.

> **FR-28** A picked file shall pass through the same refusal registry as every other import path: a file that is not the export for its slot is refused with the line naming the slot it belongs in, a file over 50 MB is refused with the size limit, and in both cases whatever was saved in that slot before is left exactly as it was.

> **FR-29** A picked file whose contents cannot be read (a cloud provider's placeholder that fails to download, a document the provider revoked) shall land in the row's existing load-error state with a message naming the file, never in the "no file saved" state.

> **FR-30** A successfully imported file shall bump the data-file change signal so every mounted tab reloads without a relaunch, exactly as on iOS.

#### E. Launch state (owned by The Designer)

> **FR-31** The first thing an Android user sees after tapping the icon shall be SnowRaven green with the raven mark, in the same spirit as the iOS launch splash: the window background shall be the app's green so no white frame appears between the system splash and the first paint, and the system splash shall use the app's mark on that green on API 31 and later and an equivalent drawable on API 24 to 30. There shall be no fixed wait; the splash gives way when the first usable screen is ready.

> **FR-32** The launch state shall respect the system dark mode where the system splash allows it, and the window background shall not flash a light color under a dark theme.

> **FR-33** When the device's Android System WebView is older than the version the shipped frontend needs (Chromium 111 per the Stage 4 record; OQ-06), the app shall show a plain full-screen message in the app's own words saying that SnowRaven needs a newer Android System WebView and that the phone's own software update or app store supplies it, naming no store, instead of a broken or blank screen. On a WebView at or above the floor the message shall never appear and shall cost nothing visible.

#### F. The release leg

> **FR-34** A GitHub Actions job triggered by the `v*` tag shall build the unsigned release universal APK the way `windows-build.yml` builds the installer, with read-only repository permissions, and shall publish it as a workflow artifact. No Android App Bundle shall be built: neither F-Droid nor the GitHub release consumes one, and building it would add an artifact no one signs or checks. The job's build steps (toolchain pins, frontend build, Tauri Android build, output path) shall mirror what the fdroiddata recipe (FR-58) runs, so that a green CI build is evidence the recipe builds. No signing key, keystore password or store credential shall exist in GitHub.

> **FR-35** The release machine shall sign the APK with the user's own keystore, kept outside the repository in the same posture as the Apple credentials and used unchanged from release to release. The release tooling shall refuse to proceed when the keystore or its password is missing, naming the user-performed step that creates it, and shall never generate a keystore itself. The keystore's backup is the user's: losing it means a future GitHub APK cannot install over an earlier one.

> **FR-36** The release tooling shall preflight the Android toolchain, the keystore, and the artifact's version name and version code against `tauri.conf.json` before the APK is attached to the GitHub release, and shall stop with no asset partially published on any failure.

> **FR-37** retired: Google Play out of scope (Play App Signing and the testing tracks).

> **FR-38** The GitHub release shall carry the universal APK beside the macOS and Windows assets, signed with the user's one key kept constant from release to release, carrying no self-update mechanism and making no update check. The Help and the held privacy policy edit shall say that a GitHub APK install is updated by downloading the next release's APK and installing it over the old one, and that an F-Droid install and a GitHub APK install are signed by different keys and cannot be installed over each other (OQ-08).

> **FR-39** The `snowraven-release` skill shall gain an Android section stating the CI build, the sign and attach steps, the credential location and name, the per-release Fastlane changelog file, the F-Droid state check and where it is recorded, the local `fdroid lint`, `fdroid scanner` and `fdroid build` checks, the emulator checks and the device check, and the regeneration procedure (FR-02). CLAUDE.md's release rhythm shall name the Android leg beside the Windows and iOS legs.

> **FR-40** CLAUDE.md's version-record list shall gain an Android line kept in the App Store style: at every ship it records, per version, whether the signed GitHub APK was published after the device check or deferred in writing, and the F-Droid listing's state in one of five words (not yet submitted, merge request open, included and this tag picked up, included and this tag not yet built, or deferred with the reason). A version with no APK sentence and no F-Droid sentence is a skip, because a listing that has not appeared and a release F-Droid has not yet built leave the same evidence from the outside.

> **FR-41** The first Android ship shall be a full-rhythm release that bumps the version with every other platform; from then on a release is not done until the Android leg has shipped (the signed GitHub APK published after the device check, the Fastlane changelog file committed, the F-Droid state recorded) or been deferred in writing.

> **FR-53** The Android build shall need no network beyond the Gradle plugin and dependency repositories, the npm registry and crates.io, and no prebuilt binary in the source tree, so that F-Droid's build server can build it from the tagged commit: no build step shall download anything by its own URL, and no checked-in jar, `.so`, `.aar` or other compiled artifact shall be required by the build.

> **FR-54** No Google proprietary library or service shall compile into, link into or be requested by the Android build: no `com.google.android.gms`, no `com.google.firebase`, no Play Integrity, no Google analytics, advertising or crash-reporting artifact, in any configuration. AndroidX and the Android Gradle Plugin are free software published by Google and are not in this prohibition; The Architect lists every Google-authored artifact in the merged release runtime dependency tree so the list is explicit. The posture is verified by the merged release dependency tree and by `fdroid scanner`, and holds whatever the store. A `NonFreeNet` anti-feature on the F-Droid listing, for the eBird, OpenWeather, NOAA and tile services the app talks to, is expected and accepted, not argued.

> **FR-55** The switch between FR-17 (branch A) and FR-56 (branch B) shall be The Architect's measurement, on a release-signed emulator build, of whether `navigator.geolocation.getCurrentPosition` in the Android System WebView delivers a position with no Google code, given the WebView geolocation permission callback granted and the runtime location permission requested from `MainActivity.kt`. The measurement, the WebView version it ran on and the resulting branch shall be recorded in the run's decisions before The Engineer touches the location path. The default is branch B; only a successful measurement lifts it (OQ-18).

> **FR-56** (Branch B: the default, or FR-55's measurement fails.) On Android every location control named in FR-17 shall be absent, not disabled, with no placeholder saying location is unavailable on Android: the map's location button, Use my location in the map filters and in Settings, My location on Targets and the Current lookup do not render; Plan with no place chosen shall use its existing no-place state and shall not request a position. `getCurrentLocation` on Android shall throw the existing `unavailable` code, never a new one. The honest state is typed coordinates and place search.

> **FR-57** The repository shall carry the F-Droid listing as Fastlane metadata, in the layout The Architect names (`fastlane/metadata/android/en-US/` by default; OQ-19): `title.txt`, `short_description.txt` (at most 80 characters), `full_description.txt`, `changelogs/<versionCode>.txt` (at most 500 characters, one per release from the first Android release on, named by the FR-05 version code), `images/icon.png` (FR-09), and phone and tablet screenshots. The folder is published copy and is written only on the user's express yes (FR-46); the same change that writes it shall add a guard asserting the two character limits and that a changelog file exists for the current version code, so a bump that forgot the changelog goes red.

> **FR-58** The run shall prepare, in `pipeline/android-release/`, the fdroiddata recipe YAML for `com.dtgibson.snowraven`: the SPDX license matching FR-62, the source and issue URLs, `UpdateCheckMode: Tags` against `^v[0-9.]+$`, `UpdateCheckData` reading the version name and the version code from `src-tauri/tauri.conf.json`, `AutoUpdateMode: Version`, and a first `Builds` entry whose steps install the pinned Rust toolchain and Android targets, the pinned Node, use the NDK F-Droid provides, run the frontend build and the Tauri Android build, and name the output APK. The recipe shall pass `fdroid lint`.

> **FR-59** The one-time merge request to fdroiddata carrying FR-58's recipe shall be either submitted under the user's own GitLab account, with the build preparing the exact branch, commit and request text, or deliberately deferred in writing with the reason, in the CLAUDE.md Android line (FR-40) and the run's decisions, at the first Android ship (OQ-16). The first release's Android availability on the day of the ship is the GitHub APK; the gap until the F-Droid listing appears is recorded, not implied away.

> **FR-60** After inclusion, every `vX.Y.Z` tag shall be picked up by F-Droid's update checker with no per-release upload from this repository. A guard shall read the prepared recipe's `UpdateCheckData` expressions and apply them to the committed `src-tauri/tauri.conf.json`, asserting they extract the current version name and version code, and that the tag pattern matches `v1.0.49` and rejects `v1.0.49-rc1`; `fdroid checkupdates` is run locally against the prepared entry where the host tooling allows.

> **FR-61** The gradle wrapper jar that `tauri android init` commits shall be removed from the Android project commit, with CI, the release machine and F-Droid each supplying their own gradle, unless The Architect confirms in writing that F-Droid's scanner accepts an official wrapper jar by checksum, in which case the jar, its version and its checksum are recorded (OQ-17). No other prebuilt binary shall be committed under `src-tauri/gen/android`.

> **FR-62** The license shall be machine-readable and aligned: `src-tauri/Cargo.toml`'s `license`, `frontend/package.json`'s `license` and the root `package.json`'s `license` shall each carry the SPDX id that matches the LICENSE file and any "or later" statement the repo makes (`AGPL-3.0-only` as the fields read today), and the fdroiddata recipe's `License` shall be the same id. A guard shall assert all three fields equal each other, equal the recipe's id, and name the license the LICENSE file's title line states.

#### G. Verification

> **FR-42** A release-profile build signed with the user's own key (never a debug build, never a debug keystore) shall be installed on an emulator at API 24 and on an emulator at a current API, opened, and verified by a screenshot of the first usable screen. The exact bytes later attached to the GitHub release shall be what the current-API check opens.

> **FR-43** On the API 24 emulator, the check shall record which WebView version the image carries: with a WebView below the floor the FR-33 message is the expected screenshot; with the WebView updated to or above the floor the first usable screen is. If no API 24 image with a WebView at the floor can be reached on the emulator, the second half is recorded as Partial, not as passed.

> **FR-44** Before the signed APK is published on the GitHub release, the user shall install that exact APK on their own Android device, open it, import both export files through the picker, and report whether the weather lookup, Species Detail, Statistics, Map Explorer and Targets work with their keys. Agents give exact steps and record only the reported result. With no device available the criterion is recorded Partial and the publication decision is the user's, in writing. The F-Droid-built APK is not device-checked by this run before F-Droid publishes it; a failure found only there is a fix that rides the next tag.

> **FR-45** The existing automated suites (frontend, backend, guard tests, accessibility coverage, entry-chunk bounds) shall run unchanged with no Android-only exemption, and the new guards (FR-03, FR-06, FR-09, FR-11, FR-22, FR-57, FR-60, FR-62) shall join them. No broad manual platform, device or accessibility sweep is added.

> **FR-63** The run shall exercise F-Droid's own tooling locally against the prepared fdroiddata entry: `fdroid lint` and `fdroid scanner` shall pass, and `fdroid build` shall be run on the Mac if the host toolchain allows and produce a launching APK on the current-API emulator. Where a step cannot run locally, a written checklist against F-Droid's inclusion policy stands in and says which step it replaces and why.

#### H. Published surfaces and store records (held proposals)

> **FR-46** The run shall prepare, in `pipeline/android-release/`, a held F-Droid listing proposal that is the exact content of the Fastlane metadata folder (FR-57): the title, the short description within 80 characters, the full description derived from the fixed website register and the privacy policy's words (making no claim the policy does not, and carrying the no-Google sentence only after FR-54 has been verified), the first release's changelog within 500 characters with Apple-only lines dropped, the listing icon, and phone and tablet screenshots captured from the synthetic demo data. Nothing is written into the metadata folder before the user's express yes.

> **FR-47** retired: Google Play out of scope (the Data safety form).

> **FR-48** retired: Google Play out of scope (the content rating questionnaire).

> **FR-49** The run shall prepare one Android sentence for the website and one for the README, each in the fixed register (one or two sentences, no operating detail, no reassurance, "weather" lowercase), as held proposals shown rendered as pages. Neither file is written before the yes.

> **FR-50** The run shall prepare the privacy policy edits as a held patch: the Overview's platform list; an Android App paragraph beside the iOS App section saying the build contains no Google services, no Play, no Firebase and no analytics, where its data lives (private storage), what Android's own device backup includes under the manifest's setting, and removal on uninstall; the Software Updates section saying Android updates arrive through the F-Droid client, or by downloading a newer APK from the GitHub release and installing it over the old one, and that the Android app makes no update check of its own; and the Your Location paragraph per the FR-55 branch (the system's own location service under branch A; no location request on Android under branch B). `PRIVACY_POLICY.md` and `website/privacy.html` stay identical. Nothing is written before the yes.

> **FR-51** `docs/HELP.md` shall be updated where it names platforms (installing, updating, location per the branch, the import wording, which features are Mac, iPhone and iPad only), written without a stop, in `DEFAULT_TAB_ORDER` position, with the Help table-of-contents parity test green. It shall carry the two facts no store tells an Android birder: that an APK from GitHub and a build from F-Droid are signed by different keys, so switching from one to the other means uninstalling first, which deletes the files and keys stored on the phone (keep the export files and re-import); and that installing the GitHub APK requires allowing installs from the browser or file manager, once, in Android's settings.

> **FR-52** All listing copy and all held copy shall use American spelling, contain no em dash, and follow the website register; the Fastlane short description shall fit 80 characters and each changelog file 500.

### Non-Functional Requirements

> **NFR-01 Privacy, network:** The Android app shall issue the same device-to-provider requests as the iOS app and no others: eBird, OpenWeather, Nominatim, NOAA, the four tile hosts and the Cornell Lab sites, each only when the user asks; no GitHub request, no request to any Google host, no new host, no new endpoint, no request moved between components. Under branch A, requests the operating system's own location service makes when the app asks for a position are the system's, as on iOS, and are stated as such in the held policy edit.

> **NFR-02 Privacy, posture:** The Android binary shall carry no analytics, crash-reporting, Play Integrity, Firebase, Play Services or advertising library (FR-54). The Architect shall list every Google-authored artifact in the merged release runtime dependency tree so the held listing and policy proposals rest on a verified fact.

> **NFR-03 Compatibility:** The app shall run on API 24 and later on arm64 and 32-bit ARM devices, with the universal APK also carrying the emulator's architecture, and shall need a System WebView at or above the floor the Architect states (Chromium 111 per the Stage 4 record; container queries at minimum).

> **NFR-04 Accessibility:** The WCAG 2.1 AA posture, the 320px width tier, the 200% in-app text scale rule and every accessibility guard suite carry over unchanged. At the largest system font size the layout shall hold as it does at 200% in-app scale, verified by one emulator screenshot.

> **NFR-05 Security:** The capability files stay scoped to `windows: ["main"]`, the file scope stays `$APPLOCALDATA/**`, cleartext traffic is not permitted, and the single-webview invariant holds: one Activity, one webview, no second window, so the per-context write chains remain sufficient.

> **NFR-06 Performance:** The entry chunk shall not grow for the Android predicate or the WebView floor check; `entryChunk.test.ts` stays green. The launch state has no fixed wait.

> **NFR-07 Release integrity:** The signing keystore and its password live only on the release machine; CI builds from the tag with read-only permissions and signs nothing; the signed APK's version name and version code are checked against `tauri.conf.json` before it is attached; F-Droid signs its own build with its own key, and the two are never presented as interchangeable.

> **NFR-08 Storage:** All app data lives in the app's private storage and is removed on uninstall; Android's own backup behavior is the platform default and is stated in the held policy edit (OQ-09).

> **NFR-09 Buildability from source:** The tagged commit shall build the Android app on a machine that has only the pinned toolchain and access to the registries named in FR-53, with no credential, no prebuilt binary and no step specific to the developer Mac; byte-reproducibility between F-Droid's build and the GitHub APK is out of scope and is not claimed anywhere.

### Out of Scope

- Google Play in every form: no Play Console, no Play App Signing, no Data safety form, no content rating questionnaire, no Play upload, no internal testing track; nothing in this run creates a Google account or pays Google.
- iCloud Sync on Android in any form, and any Android cross-device sync in its place; no "not on Android" placeholder.
- Home-screen widgets and the Alerts background check on Android; hidden, not stubbed.
- The window-geometry plugin and the in-app updater, already excluded from mobile binaries; no Android self-update path of any kind, including an in-app "newer version on GitHub" notice.
- Reproducible builds: F-Droid signs with its own key, and proving byte-reproducibility for a Rust, Node and gradle chain is a project of its own; v1 accepts F-Droid's signature and says so in Help and the privacy policy.
- A Google-free location plugin backed by `android.location.LocationManager`, upstream or vendored; that is the v2 route if branch B ships.
- Android Auto, Wear OS, Chromebook-specific work, foldable-specific layouts, a monochrome themed icon, App Links or deep links, notifications.
- Native Android code beyond what Tauri and its plugins generate and the `MainActivity.kt` plumbing this run already owns (insets, the theme listener, and the location permission callback if FR-55 admits it); no Kotlin feature work, no new screen, flow or capability.
- A Tauri or tao upgrade; a vendored tao that will not build for Android is a flag, not a license.
- Any other store or repository: no Accrescent, no IzzyOnDroid, no self-hosted F-Droid repository; the GitHub-release APK is the only non-F-Droid path.
- Custom handling of the system back button beyond the platform default (OQ-10 records the default and the follow-up).
- Any change to the privacy posture: no analytics, crash reporting, Firebase or Google library of any kind, in any build.
- Localization, and paid or in-app products.

### Open Questions

> **OQ-01** Is `com.dtgibson.snowraven` the permanent Android application id? Resolved: yes, confirmed by the user. The Architect sets it deliberately in the Android project and the desktop identifier stays `com.snowraven`.

> **OQ-02** moot: Google Play out of scope (the developer account and its testing requirement).

> **OQ-03** Does a signing keystore exist on the release machine? Default: no; the run writes the exact user-performed generation steps (key size, validity, where it lives, that the backup is theirs and that losing it closes the install-over path for future GitHub APKs) and stops before signing until the user reports it in place.

> **OQ-04** Does the user have an Android device for the pre-publication check? Default: none assumed; FR-44 is recorded Partial and the publication decision is the user's in writing.

> **OQ-05** Are the Android SDK, NDK, a JDK, the emulator and the `fdroidserver` tooling installed on Hephaestus? Default: not assumed; the Architect lists the exact versions, the run installs them under the user's account on the developer Mac (the device boundary covers devices, not this machine), and the runbook pins them.

> **OQ-06** What System WebView version is the floor? Default: Chromium 111, as the Stage 4 record states; the Architect confirms the number in the schema from the shipped frontend's audit, and the FR-33 message appears below it.

> **OQ-07** What target API level is used? Default: the current stable Android API level on the day the first release build is made, recorded with the date; F-Droid imposes none.

> **OQ-08** Which key signs the GitHub APK, and how is the F-Droid-versus-APK install boundary explained? Default: the user's own keystore signs the GitHub APK, F-Droid signs its own build, and Help plus the held policy edit state that the two installs are signed by different keys and do not install over each other; reproducible builds, which would let F-Droid publish the user-signed APK, are the recorded reversal and out of scope.

> **OQ-09** Does the Android app keep the platform's default device backup behavior (which would include the keys file, as the iOS device backup does)? Default: yes, platform default, stated plainly in the held Android policy paragraph; excluding the keys file is a decision the user can make at the Designer gate.

> **OQ-10** What does the system back button do when nothing is open to close? Default: the platform default (the app goes to the background), with Search, Help, the More sheet and open popups closing on back only if the Architect finds that is what the WebView already provides; custom handling is recorded as a follow-up idea, not built here.

> **OQ-11** Do every locked crate and the vendored tao build for the Android targets? Default: the Architect builds first and reports; a failure is a flag for the user, never an upgrade.

> **OQ-12** Which import mechanism presents the Android document picker? Default: measured on an emulator, file input first; the measurement, not the iOS result, decides the Android constant.

> **OQ-13** Does the target API level's edge-to-edge window behavior put content under the system bars in the Android WebView? Default: measured on the current-API emulator against The Designer's inset rules; FR-20 holds whichever way it measures.

> **OQ-14** retired: Google Play out of scope (the Data safety form's definitions).

> **OQ-15** Which version number carries the first Android release? Default: the next patch after whatever version is shipping when this run reaches the deploy gate, checked against parallel ships from the worktree before the bump.

> **OQ-16** Who authors and submits the fdroiddata merge request? Default: prepared by the build (the recipe, the branch, the commit and the request text, with exact steps), submitted by the user under their own GitLab account; if it is not submitted at the first ship, the deferral and its reason are written in the CLAUDE.md Android line.

> **OQ-17** Is the gradle wrapper jar committed? Default: dropped from the commit, with CI, the release machine and F-Droid each supplying their own gradle, unless the Architect confirms F-Droid's scanner accepts an official wrapper jar by checksum, in which case the jar version and checksum are recorded.

> **OQ-18** Does the Android System WebView's own `navigator.geolocation` deliver a position on a release-signed emulator build with the `MainActivity.kt` permission plumbing and no Google code? Default: branch B (FR-56), every location control absent on Android; only the Architect's recorded measurement (FR-55) lifts it to branch A (FR-17).

> **OQ-19** Which Fastlane metadata layout does the repository use? Default: `fastlane/metadata/android/en-US/`, F-Droid's documented layout; the Architect may name `metadata/en-US/` at the repo root instead, and the recipe and the FR-57 guard follow the choice.

### Success Metrics

| ID | What's Being Verified | Pass Condition |
|---|---|---|
| QA-01 | FR-01: committed project builds | From a clean checkout with the runbook's toolchain, the Android release build produces a universal APK with no manual edit, on the Mac and on the Linux CI runner. |
| QA-02 | FR-02, FR-39: regeneration procedure documented | The `snowraven-release` skill's Android section names every file a regeneration overwrites (the `MainActivity.kt` plumbing and the wrapper jar removal included), the keep-aside and restore steps, and the check-by-content rule. |
| QA-03 | FR-03: regeneration guard | Removing the application id edit, a manifest permission, the icon resource or the `MainActivity.kt` inset listener from a scratch copy of the Android project turns the guard red; the committed project is green; the guard runs on Linux CI. |
| QA-04 | FR-04: application id | The built APK's package name is `com.dtgibson.snowraven`; `tauri.conf.json`'s identifier is still `com.snowraven`. |
| QA-05 | FR-05: version name and code | The built APK's version name equals `tauri.conf.json`'s `version` and its version code equals `bundle.android.versionCode` in the same file, which equals the formula; no file under `src-tauri/gen/android` contains a literal version name or code. |
| QA-06 | FR-06: version guard | In a scratch copy, bumping `version` without `bundle.android.versionCode` turns the guard red; a version code one off the formula turns it red; a version in the Android project one patch ahead of `frontend/package.json` turns it red; an unrecognized file shape turns it red; the committed tree is green. |
| QA-07 | FR-07: API levels | The project's minimum API level reads 24; the target API level equals the current stable level with the date it was read recorded beside it. |
| QA-08 | FR-08: Rust cfg discipline | The `cargo tree` for an Android target shows the dialog plugin and no geolocation, updater, process, window-state or Apple-vendor crate; the `cargo tree` for the iOS target still shows the geolocation plugin; the iOS-only `lib.rs` block compiles out of the Android binary; or a flag naming the crate that will not build. |
| QA-09 | FR-09: icons | The adaptive icon resolves to the committed foreground and background; `images/icon.png` in the metadata folder is 512 by 512 with no transparent pixel; the guard goes red on a transparent listing icon in a scratch copy. |
| QA-10 | FR-10: `isAndroid()` | With the platform probe mocked to `android`, `isAndroid()` is true and `isIOS()` and `isMacOS()` are false; with the probe throwing, all three are false; no new `navigator.userAgent` read exists in `lib/platform.ts`. |
| QA-11 | FR-11: every reading pinned | One test row per table row in FR-11 passes with the probe mocked to `android`, and each row goes red when its gate is reverted to the `isIOS()` form. |
| QA-12 | FR-12: no updater, no GitHub | With the probe mocked to `android`, no updater footer renders and no request to any `github.com` host is observed during launch and a visit to every tab; the emulator run's network capture shows the same. |
| QA-13 | FR-13: Rebuild caches | On Android the control renders, clears the caches, does not call relaunch, and shows the close-and-reopen sentence. |
| QA-14 | FR-14: compact chrome | On the current-API emulator in portrait the header is the compact bar and the Map Explorer's map and controls are visible on tab open without scrolling, matching The Designer's recorded decision. |
| QA-15 | FR-15: Apple-only surfaces absent | With the probe mocked to `android`, the rendered Settings tree, header, sidebar and Search results contain no iCloud, widgets or Alerts markup and no placeholder naming them; the same holds in an emulator screenshot of Settings scrolled end to end. |
| QA-16 | FR-16: import wording | On Android both Default Files rows read "Import" in the empty state and the approved variants when uploading or replacing; "Upload" appears nowhere on the tab. |
| QA-17 | FR-17: location path, branch A | Run only when FR-55 records branch A, else recorded "not applicable, branch B": on the emulator, the first press of Use my location shows the Android system dialog; granting returns the emulator's set coordinates; denying shows the denied message; after Android stops asking, pressing again shows the denied message with no dialog; a position withheld for over ten seconds shows the timeout message; the geolocation plugin is invoked nowhere. |
| QA-18 | FR-18: denied copy, branch A | Run only under branch A: with the probe mocked to `android` and a denied error, the message names Settings, Apps, SnowRaven, Permissions, Location, and contains neither the macOS nor the Windows sentence. |
| QA-19 | FR-19: fullscreen rule | On the emulator at tablet width the fullscreen map's sidebar behaves as the iOS reading records, and a screenshot in each orientation shows the fullscreen controls clear of the status bar, navigation bar and cutout. |
| QA-20 | FR-20: insets | Screenshots of Weather, Map Explorer and Settings in both orientations on the current-API emulator show no app content under a system bar or cutout; the `sr-ios-app` class is absent from the Android document. |
| QA-21 | FR-21: chord hint | With the probe mocked to `android` and a coarse pointer, the hint is none; with a fine pointer, "Ctrl K"; the hint module's diff is empty. |
| QA-22 | FR-22: no unreachable call | The enumeration test passes with the probe mocked to `android`; adding a call to a desktop-only command, or to a geolocation plugin command, inside an Android-visible branch in a scratch copy turns it red. |
| QA-23 | FR-23: grants | The capability carrying the geolocation grants lists iOS as its only platform; the capability granting Android lists `dialog:allow-open` for `main` and nothing else; the desktop capability names no mobile platform; the default capability's file scope is byte-unchanged. |
| QA-24 | FR-24: manifest permissions | The merged manifest of the release build declares Internet and, under branch A only, coarse and fine location; under branch B it declares no location permission; in either branch no other permission appears and cleartext traffic is not permitted. |
| QA-25 | FR-25: storage | On the emulator, after importing both files and saving a key, the app's private storage holds the same document names as the iOS sandbox and no file exists outside it. |
| QA-26 | FR-26: picker presents | On the emulator pressing Import opens the system document picker; the chosen mechanism and the measurement are recorded in the run's decisions. |
| QA-27 | FR-27: cancel | Opening the picker and backing out leaves the row's state, file and alert region unchanged, with nothing announced. |
| QA-28 | FR-28: refusals | Picking the eBird backup into the ML Export slot shows the slot line; picking a file over 50 MB shows the size line; in both cases the slot's previous file remains saved. |
| QA-29 | FR-29: unreadable pick | A pick whose read is made to fail lands in the row's load-error state naming the file, not in the setup guidance. |
| QA-30 | FR-30: change signal | After an import on the emulator, switching to Statistics shows the new file's figures without relaunching. |
| QA-31 | FR-31: launch state | A screen recording or frame sequence on the current-API emulator shows green with the raven mark from the icon tap to the first usable screen with no white frame; on the API 24 emulator the equivalent drawable shows. |
| QA-32 | FR-32: dark mode launch | With the emulator in dark mode the launch frames contain no light flash. |
| QA-33 | FR-33: WebView floor | On an emulator whose WebView is below the floor the plain message appears, names the Android System WebView and names no store; on one at or above it the message never renders and the first usable screen appears. |
| QA-34 | FR-34: CI job | The tagged workflow run publishes an artifact containing the unsigned universal APK and no App Bundle; the workflow file declares `contents: read` and references no secret; its toolchain pins and build commands match the recipe's `Builds` entry step for step (a diff of the two command lists, or one shared script both call). |
| QA-35 | FR-35: signing on the release machine | With the keystore present, `apksigner verify --print-certs` on the attached APK shows the user's certificate; with the keystore or password removed, the tooling stops before signing with a message naming the user-performed step; no code path creates a keystore. |
| QA-36 | FR-36: preflight | With an APK whose version name or version code does not match `tauri.conf.json`, the tooling stops before any asset is attached and the GitHub release shows no Android asset; with the toolchain or keystore missing, the same. |
| QA-37 | retired: Google Play out of scope (Play App Signing and tracks). | retired |
| QA-38 | FR-38: GitHub APK | The GitHub release lists the universal APK beside the macOS and Windows assets, its signing certificate matches the previous release's (or is recorded as the first), and Help and the held policy edit carry the no-update-check, install-over-from-GitHub and different-keys sentences. |
| QA-39 | FR-40: version-record line | CLAUDE.md's Versioning section carries an Android entry naming, for the version, the GitHub APK's publication or written deferral and the F-Droid state in one of the five words, and the rule that a version with no APK sentence and no F-Droid sentence is a skip. |
| QA-40 | FR-41: full-rhythm release | The release that carries the first Android build bumps all four version files and ships or defers every leg in writing, the Android leg's three parts included. |
| QA-41 | FR-42: emulator checks | Two screenshots of the first usable screen, one per emulator, each from a release-profile build signed with the user's key, with the APK's checksum recorded, and the current-API checksum equal to the attached asset's. |
| QA-42 | FR-43: API 24 WebView halves | The run record states the API 24 image's WebView version and shows either the floor message (below) or the first usable screen (at or above); a half that could not be reached is marked Partial. |
| QA-43 | FR-44: user's device check | The run record holds the exact steps given and the user's reported result for each of the five surfaces, timed before the APK is attached to the GitHub release; or the criterion marked Partial with the user's written decision. |
| QA-44 | FR-45: suites unchanged | The full frontend and backend suites pass with no Android exemption added, and each new guard appears in the suite listing. |
| QA-45 | FR-46: F-Droid listing proposal | `pipeline/android-release/` holds the listing proposal with every FR-46 item and the icon and screenshot files, shown rendered; the Fastlane metadata folder is absent from the tree until the recorded yes. |
| QA-46 | retired: Google Play out of scope (Data safety). | retired |
| QA-47 | retired: Google Play out of scope (content rating). | retired |
| QA-48 | FR-49: website and README sentences | Each is one or two sentences in the register, shown as a rendered page over the tailnet; `git diff` of `website/` and `README.md` is empty until the yes. |
| QA-49 | FR-50: privacy policy patch | The held patch covers the four named passages with the F-Droid and GitHub update sentences and the branch's location paragraph; `PRIVACY_POLICY.md` and `website/privacy.html` are identical after it; `git diff` of both is empty until the yes. |
| QA-50 | FR-51: Help | `docs/HELP.md` names Android where it names platforms, carries the different-keys uninstall fact and the one-time allow-installs fact, the TOC parity test passes, and no Help passage claims an Apple-only feature or an absent location control exists on Android. |
| QA-51 | FR-52: copy register | A scan of every held proposal and of the Help diff finds no em dash and no British spelling; each website and README sentence is at most two sentences; the short description is at most 80 characters and each changelog file at most 500. |
| QA-52 | NFR-01: same requests | A network capture on the emulator across launch, a weather lookup, Species Detail, Statistics, Map Explorer and Targets shows hosts that are a subset of the iOS app's disclosed set, no `github.com` host and no Google host. |
| QA-53 | NFR-02: no telemetry library | The merged release runtime dependency tree contains no analytics, crash-reporting, Play Integrity, Firebase, Play Services or advertising artifact, and the Architect's list of Google-authored artifacts is in the run record. |
| QA-54 | NFR-03: architectures | The universal APK carries arm64, 32-bit ARM and x86_64 native libraries and installs on the x86_64 emulator. |
| QA-55 | NFR-04: largest font | A Settings screenshot at the emulator's largest system font size shows no clipped control label and no horizontal overflow. |
| QA-56 | NFR-05: single webview and scopes | The Android project declares one Activity hosting one webview; every capability file still reads `windows: ["main"]`; the merged manifest does not permit cleartext. |
| QA-57 | NFR-06: entry chunk | `entryChunk.test.ts` passes with the Android predicate and the WebView floor check in place. |
| QA-58 | NFR-07: release integrity | The workflow file and the repository contain no keystore or password; the preflight's version check fails on a mismatched APK in a dry run; no document presents the F-Droid build and the GitHub APK as interchangeable. |
| QA-59 | NFR-08: uninstall | After uninstalling from the emulator and reinstalling, the app opens in its first-run state with no file or key present. |
| QA-60 | FR-53: registries only, no prebuilt binary | The build log of a clean build shows downloads only from the Gradle plugin and dependency repositories, the npm registry and crates.io; the build scripts contain no download of their own; `git ls-files src-tauri/gen/android` lists no `.jar`, `.so`, `.aar` or other compiled artifact (the wrapper jar only under OQ-17's exception). |
| QA-61 | FR-54: no Google services | The merged release runtime dependency tree contains no `com.google.android.gms`, `com.google.firebase` or other Google proprietary artifact; `fdroid scanner` reports clean; the merged manifest carries no Play Services metadata; the Architect's list of Google-authored artifacts names only free ones. |
| QA-62 | FR-55: the location measurement | The run's decisions record the emulator build's signature, the WebView version, the `MainActivity.kt` plumbing used, the observed result and the branch chosen, dated before the first location-path commit. |
| QA-63 | FR-56: location absent, branch B | Run only under branch B: with the probe mocked to `android`, no location control renders on Map Explorer, the map filters, Settings, Targets, Weather or Plan, and no text names location as unavailable; `getCurrentLocation` rejects with code `unavailable`; the emulator screenshots of those tabs show the same; the merged manifest declares no location permission. |
| QA-64 | FR-57: Fastlane metadata | After the yes, the folder holds every named file, the guard asserts the 80 and 500 character limits and the presence of `changelogs/<current versionCode>.txt`, and removing that changelog file in a scratch copy turns the guard red. |
| QA-65 | FR-58: fdroiddata recipe | The prepared YAML carries every named field, `fdroid lint` passes on it, and its `License` equals FR-62's id. |
| QA-66 | FR-59: merge request | The run record and the CLAUDE.md Android line state either the merge request's URL and date or the written deferral with its reason; neither is silent. |
| QA-67 | FR-60: tag-based updates | The guard extracts the current version name and version code from `tauri.conf.json` with the recipe's `UpdateCheckData` expressions, and the tag pattern matches `v1.0.49` and rejects `v1.0.49-rc1`; `fdroid checkupdates` output is recorded where it could run. |
| QA-68 | FR-61: wrapper jar | `git ls-files` shows no `gradle-wrapper.jar` under the Android project, or OQ-17 is resolved yes with the jar version and checksum recorded and `fdroid scanner` clean with it present. |
| QA-69 | FR-62: license alignment | The three license fields and the recipe's `License` all read the same SPDX id, the LICENSE file's title line names that license, and changing any one field in a scratch copy turns the guard red. |
| QA-70 | FR-63: F-Droid tooling | The run record holds `fdroid lint` and `fdroid scanner` output with no finding, and either the `fdroid build` APK's launch screenshot on the current-API emulator or the written checklist naming the step it replaces. |
| QA-71 | NFR-09: builds from source | The CI job (FR-34), which has no credential and no developer-Mac path, builds the APK from the tag; no document claims byte-reproducibility. |
