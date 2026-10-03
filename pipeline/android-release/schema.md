# Schema: Android Release

**Feature:** android-release
**Date:** 2026-10-03
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (both approved; both revised 2026-10-03 for F-Droid)
**Extends:** `pipeline/mobile-app/schema.md` (the iOS project, the mobile cfg blocks, the Mechanism A/B import switch, the `isIOS()` probe), `pipeline/windows-desktop-app/schema.md` (the CI-builds-and-the-release-machine-signs shape), `pipeline/ios-alerts/schema.md` (the latest statement of the single-webview invariant and the capability scopes)
**Ships as:** the next patch after whatever is shipping at the deploy gate (OQ-15), as a full all-platforms release; the four-file version set stays four files

Revised 2026-10-03 on the Stage 3 re-entry: F-Droid replaces Google Play. Sections 3, 4, 6, 7, 8 and 9 are rewritten; the location path (4.6, 5.3) is decided on paper from wry's source with the emulator measurement specified; `tauri-plugin-geolocation` becomes iOS-only; the release mechanics are the unsigned CI APK, the user-signed GitHub APK and the fdroiddata recipe. Sections 1, 2, 5.1, 5.2, 5.4 and 5.5 stand as first written except where a Play word is replaced.

## Path

Frontend only, in this repository's extended sense: a build and platform feature with no data-layer change.

## Architect assessment

> **Architect assessment: Frontend Only**
>
> SnowRaven has no database; its data layer is the set of stored documents under `AppLocalData/data/`, their per-document write chains, the epoch modules, the clear registry and the pure derivation modules. Every functional requirement, the revised set included, was read against that layer (section 1): the Android app reads and writes exactly the documents the iOS app does, through the same `storage` seam, with the same names and chains, and adds no document, no key, no field and no migration. What the feature adds is a second committed mobile project, a platform predicate, a release leg, an F-Droid recipe and a set of guards. Proceeding on this assessment per the hands-off run.

Like the Windows and iOS builds before it, most of what this document decides is not TypeScript: it is a generated Gradle project and what the repository pins in it, a Rust target, two config files, a CI job, a signing recipe and a build recipe another organization runs. Every Tauri 2.11.2 fact below was read from the installed CLI (`node_modules/@tauri-apps/cli` 2.11.2, its `config.schema.json`, the Android template embedded in `cli.darwin-arm64.node`, and the `tauri-cli-v2.11.2` sources for `mobile/android/{mod,build,android_studio_script}.rs` and `mobile/mod.rs`), from the locked crates in `~/.cargo/registry` (tauri 2.11.2, tauri-utils 2.9.2, tauri-build 2.6.2, wry 0.55.1, the plugins at their locked versions), from the generated project now at `src-tauri/gen/android`, from fdroidserver's `scanner.py`, `build.py`, `common.py` and `buildserver/` provisioning on `master`, from `gradlew-fdroid`'s `gradlew.py`, from Chromium's `LocationProviderFactory.java` and `LocationProviderAndroid.java` on `main`, or from this repository, and each section says which.

## Existing data model used by this feature (unchanged)

| Existing structure | Where | How the Android app uses it |
|---|---|---|
| `data/api-keys.json`, `data/settings.json`, `data/metadata.json`, `data/ebird-backup.csv`, `data/ml-export.csv`, `data/barcharts.json` + `data/barcharts/<regionCode>.txt`, `data/county-day-obs.json`, `data/replay.json` | `TauriStorage` in `frontend/src/lib/storage.ts`, `replayStore.ts`, `countyDayObsCache.ts`, under `BaseDirectory.AppLocalData` | Read and written exactly as on iPhone and iPad. On Android `$APPLOCALDATA` resolves to the app's private data root (section 2), so the same relative paths land in private storage with no permission |
| `docChains` (settings, api-keys, metadata, bar-chart manifest), `replayStore.writeThrough`, `countyDayObsCache.writeThrough`, the three purge generations | `storage.ts`, `replayStore.ts`, `exoticProvenanceCache.ts`, `countyDayObsCache.ts` | Unchanged. Sufficient on Android because the app runs one Activity hosting one webview (section 4.5) |
| `lib/clearDerived.ts` (`TEARDOWNS`), `cacheInventory.test.ts` | the clear registry | Unchanged; no new store, no new row. The one native-owned row (the iOS Alerts inbox) is gated on `alertsSupported()`, which is false on Android |
| `lib/filesChanged.ts`, `barChartFilesChanged.ts`, `keysChanged.ts` | the epoch modules | Unchanged; the Android import path bumps `filesChanged` through the same `Settings.tsx` tail every other import uses (FR-30) |
| `lib/uploadGuard.ts` (`refuseByFilename`, `refuseByContent`), `detectExportType.ts`, `firstLine.ts` | the refusal registry | Unchanged; a picked file on Android passes through the same shared tail (FR-28) |
| `transport.ts` (`TauriTransport`, `CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`), `lib/tauri/*` services, `ebirdGate.ts`, `rateLimit.ts` | the outbound path | Unchanged; every outbound call on Android is the TypeScript service path, as on iOS. Nothing under `lib/tauri/` branches on an Apple platform (section 2) |
| `lib/platform.ts` (`isTauri`, `isIOS`, `isMacOS`, `isWindows`), `lib/platformGates.ts` | the capability seam | Gains `isAndroid()` and `isMobileApp()` (section 5), and `showLocationControls()` (section 5.3); every existing predicate keeps its value on every existing platform |
| `lib/location.ts` | the location seam | On Android, never the geolocation plugin and never the desktop command: branch B (the default) throws the existing `unavailable` code; branch A uses the WebView's own `navigator.geolocation` behind the same function (sections 4.6, 5.3) |
| `lib/importMechanism.ts` (renamed from `iosImport.ts`; `IOS_IMPORT_MECHANISM`, `ANDROID_IMPORT_MECHANISM`, `pickCsvViaDialog`) | the Mechanism A/B switch | One constant per mobile platform (section 5.4) |
| `frontend/index.html` (`#sr-launch`, `window.srLaunch`, the inline first-paint script) | the launch splash | Gains the WebView floor state (section 5.6); no entry-chunk bytes |
| `src-tauri/capabilities/{default,desktop,mobile}.json` | the grants | `mobile.json` keeps `dialog:allow-open` for both mobile platforms; the geolocation grants move to a new iOS-only `capabilities/ios.json`; `default.json` and `desktop.json` are byte-unchanged (section 4.3) |
| `src-tauri/Cargo.toml` cfg blocks, `src-tauri/src/lib.rs` plugin registration | the Rust seams | `tauri-plugin-geolocation` moves from the `any(android, ios)` block to the iOS-only block, and its registration from `cfg(mobile)` to `cfg(target_os = "ios")`; nothing else moves (section 4.1) |
| `src-tauri/icons/android/**` | the dormant icon set, regenerated at v0.5.93 | Becomes the committed launcher set, with one bucket corrected (section 3.5) |
| `.github/workflows/windows-build.yml`, `release.sh`, `.claude/skills/snowraven-release/SKILL.md` | the release leg precedents | Twinned, not changed (section 6) |

### Added

1. `src-tauri/tauri.android.conf.json` (section 3.2) and `bundle.android.versionCode` in `src-tauri/tauri.conf.json` (section 3.3).
2. `src-tauri/gen/android/**`, the committed Android project, with the `gradlew` shim and no wrapper jar (section 3.1).
3. `src-tauri/capabilities/ios.json`, the iOS-only capability carrying the geolocation grants (section 4.3).
4. `frontend/src/lib/platform.ts`: `isAndroid()`, `isMobileApp()` (section 5.1); `frontend/src/lib/platformGates.ts`: `showLocationControls()` (section 5.3).
5. `frontend/src/lib/androidLocation.ts`: `ANDROID_LOCATION_BRANCH`, the one switch between FR-56 and FR-17 (section 5.3).
6. `frontend/src/lib/importMechanism.ts` (renamed from `iosImport.ts`) with `ANDROID_IMPORT_MECHANISM` (section 5.4).
7. `frontend/index.html`: the WebView floor probe and its message state; `frontend/src/lib/webviewFloor.ts` (section 5.6).
8. `.github/workflows/android-build.yml` (section 6.1).
9. `scripts/android/`: `toolchain.env` (the single source of the toolchain pins), `build-apk.sh` (the one build script CI and the F-Droid recipe both run), `sign.sh`, `preflight.sh`, `attach.sh` (section 6.2). No Play upload script.
10. Guards: `frontend/src/lib/androidProjectPins.test.ts`, `androidVersionSource.test.ts`, `androidIcons.test.ts`, `androidReachableCalls.test.ts`, `androidLicense.test.ts`, `fdroidRecipe.test.ts`, `fastlaneMetadata.test.ts` (after the yes), the Android rows in `platform.test.ts` and `platformGates.test.ts`, `importMechanism.test.ts`, `location.android.test.ts` (section 6.4).
11. `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` (the fdroiddata recipe, section 6.5), `pipeline/android-release/fdroid/merge-request.md` (the branch, commit and request text, FR-59), `pipeline/android-release/fdroid/fastlane-proposal/en-US/**` (the exact content of the Fastlane folder, held until the yes), `pipeline/android-release/held-copy.md` (the website and README sentences, the privacy policy patch, the What's New; FR-46 to FR-50).
12. `fastlane/metadata/android/en-US/**` at the repository root, written only on the user's express yes, before the tag (section 6.5).

### Modified

- `frontend/src/lib/platformGates.ts`, `components/Settings.tsx`, `components/MapExplorer.tsx`, `lib/location.ts`, `main.tsx` per the FR-11 table (section 5.2), plus the five location-control call sites under branch B (section 5.3).
- `src-tauri/Cargo.toml` (the geolocation line moves blocks, section 4.1), `src-tauri/src/lib.rs` (the registration moves, section 4.1; the keeper line is untouched), `src-tauri/capabilities/mobile.json` (dialog only, both platforms, section 4.3), `src-tauri/tauri.conf.json` (gains `bundle.android.versionCode`; `identifier` and `version` unchanged).
- `.claude/rules/security.md` `paths`: the Android manifest, `app/build.gradle.kts`, `MainActivity.kt`, `BuildTask.kt`, `tauri.android.conf.json`, `capabilities/*.json`, the new workflow, `scripts/android/**` and `pipeline/android-release/fdroid/**` (CLAUDE.md's extend-the-paths obligation; the capability files are gated by no rule today, which this build corrects).
- `.claude/skills/snowraven-release/SKILL.md` (the Android section, FR-39), `CLAUDE.md` (the release rhythm and the version-record list, FR-39, FR-40), `docs/HELP.md` (FR-51), `CHANGELOG.md` and the four-file version set.

### Unchanged (used, not modified)

`storage.ts`, every document under `AppLocalData/data/`, every chain and purge, `transport.ts`, every `lib/tauri/*` service, `openExternal.ts` (the opener plugin's `open_url` on Android), `clipboard.ts` (the clipboard-manager plugin on Android), `tauri.ios.conf.json`, `Cargo.lock` (every Android-only crate is already resolved in it: `jni` 0.21.1 and 0.22.4, `ndk` 0.9.0, `ndk-context`, `tao-macros` 0.1.3; removing geolocation from the Android target removes no lock entry, since the crate stays an iOS dependency), the vendored tao, `capabilities/default.json` and `desktop.json`, `windows-build.yml`, `release.sh`, `backend/`, the three license fields (`src-tauri/Cargo.toml`, `frontend/package.json`, `package.json` all already read `AGPL-3.0-only`; FR-62's guard pins them, section 6.4).

---

## 1. Path and confirmation

Every FR was read for data created, read, updated or deleted beyond the existing schema. The result, grouped:

| FRs | What they touch | Data-layer reading |
|---|---|---|
| FR-01 to FR-09 | the Android project, its pins, its guards, its icons | Build tree only; nothing the app reads at runtime |
| FR-10, FR-11, FR-21, FR-22 | predicates and gates | Pure functions over the compile-time `platform()` probe; no stored state |
| FR-12, FR-13 | updater absence, Rebuild caches | FR-13 CLEARS existing derived caches through the existing `purgeDerivedOnClear` path; nothing new stored |
| FR-14, FR-19, FR-20, FR-31, FR-32 | chrome, insets, launch state | Presentation; owned by The Designer |
| FR-15, FR-16, FR-18 | absent Apple surfaces, import wording, denied copy | Rendering and copy |
| FR-17, FR-55, FR-56 | the location path, its measurement, its absence | A position is returned to the caller or nothing is requested; nothing is persisted that was not persisted before (Settings' default location is an existing `settings.json` key written by the existing handler) |
| FR-23, FR-24, FR-25 | grants, manifest permissions, private storage | FR-25 is the confirmation that the EXISTING documents land in private storage (section 2); no new document |
| FR-26 to FR-30 | file import | The existing import tail: refusal registry, `storage.writeFile`, metadata chain link, `filesChanged` bump |
| FR-33 | the WebView floor message | No stored state; the probe runs on every launch |
| FR-34 to FR-36, FR-38 to FR-45, FR-53, FR-54, FR-58 to FR-63 | the release leg, the F-Droid recipe, the license fields, verification | Repository, CI, release-machine and fdroiddata files; no app data |
| FR-46, FR-49 to FR-52, FR-57, NFR-01 to NFR-09 | held proposals, the Fastlane folder, posture | No app data |
| FR-37, FR-47, FR-48 | retired (Google Play) | Nothing |

No FR introduces a settings key, a document, a field or a migration. The one candidate that was checked twice is FR-33: a "do not show this again" memory for the WebView message would have been a settings key, and the PRD asks for no such thing (the message is the whole screen below the floor, and it never appears at or above it). Path confirmed: Frontend Only. No reclassification.

## 2. Existing data used

### 2.1 Where the documents land on Android

`TauriStorage` writes every document under `BaseDirectory.AppLocalData` at `data/...`. On Android, Tauri's path resolver maps `app_local_data_dir()` to the Kotlin `PathPlugin.getDataDir`, which returns `activity.dataDir` (tauri 2.11.2 `src/path/android.rs:144` and `mobile/android/src/main/java/app/tauri/PathPlugin.kt:64`). So on Android the documents are at `/data/user/0/com.dtgibson.snowraven/data/<name>`: the app's private data root, readable by no other app, needing no storage permission, removed on uninstall (FR-25, NFR-08, QA-25, QA-59). Two facts worth recording beside that:

- `app_config_dir()`, `app_data_dir()` and `app_local_data_dir()` all resolve to the SAME directory on Android (the three Kotlin commands return `dataDir`), as `app_config_dir()` and `app_local_data_dir()` do on macOS. Nothing native writes a non-dotted file there on Android (the window-state plugin is desktop-only), so the `security.md` leading-dot rule has no instance yet; a future native Android document under that root inherits the rule as written.
- The directory is the Auto Backup root domain (section 7.4), which is what OQ-09 is about.

### 2.2 Every write goes through the existing seam and chains

The Android app has no write path of its own. The import tail in `Settings.tsx` (refusal registry, then `storage.writeFile`, then the metadata link on `docChains`, then `filesChanged.bump()`) is the same code on every Tauri target; a position on Android (branch A) reaches Settings' default-location handler through the same `getCurrentLocation()` return the macOS command feeds today; the clear path is `purgeDerivedOnClear` unchanged. QA-25 verifies the document names in the emulator's private storage against the iOS sandbox list in CLAUDE.md.

### 2.3 Nothing Apple-specific in `storage.ts` or `lib/tauri/`

Read for Apple branches: `storage.ts` imports `isTauri` only (its `isIOS`/macOS mentions are comments on the iCloud sections, whose controller never boots on Android because `showICloudSync()` is false). Under `lib/tauri/`, the one Apple string is `mediaService.ts`'s `BROWSER_UA`, a fixed desktop-Safari User-Agent sent on the Macaulay embed probe through the HTTP plugin on every Tauri target; it is a probe header, not a platform branch, and is sent unchanged on Android as it is on iOS and Windows. `updateManager.ts` and `versionService.ts` (the only GitHub-reaching modules) are reached solely from `UpdateFooter.tsx` and `App.tsx`'s footer handler, both behind `showUpdaterFooter()`, so on Android neither chunk is ever imported (FR-12, QA-12). The webview's `invoke` calls outside the Apple-only modules are exactly two: `get_timezone` (the cross-platform tzf-rs command) and `plugin:opener|open_url`; the three `*_api_key` keyring commands are invoked from nowhere in `src/` (CLAUDE.md: keys live in `api-keys.json`, never the keychain), which matters for section 4.1.

---

## 3. The Android project

### 3.1 What `tauri android init` generated, and what is committed

Generated once from the repository root (`npx tauri android init --ci --skip-targets-install`, with `src-tauri/tauri.android.conf.json` already in place so the identifier baked in correctly; The Engineer's keep-aside hash procedure, section 3.7, ran around it and reported no change outside `gen/android`). It wrote `src-tauri/gen/android/`:

| Path | Role | Committed |
|---|---|---|
| `build.gradle.kts`, `settings.gradle`, `gradle.properties`, `.editorconfig` | the Gradle project; the root build pins AGP 8.11.0 and Kotlin 1.9.25; `settings.gradle` applies the generated `tauri.settings.gradle` | yes |
| `gradle/wrapper/gradle-wrapper.properties` | the Gradle pin: `distributionUrl=https\://services.gradle.org/distributions/gradle-8.14.3-bin.zip` | yes; it is the ONE place the Gradle version lives, read by `gradlew-fdroid` on F-Droid's server, by CI's `setup-gradle` step through `toolchain.env`, and by the release machine's preflight |
| `gradle/wrapper/gradle-wrapper.jar` (59,203 bytes), `gradlew.bat` | the wrapper's prebuilt jar and its Windows entry | **no** (FR-61, OQ-17; section 3.8). Both deleted from the tree and listed in `src-tauri/gen/android/.gitignore` |
| `gradlew` | the wrapper's POSIX entry | **replaced** by a four-line shim that `exec`s the `gradle` on `PATH` (section 3.8); committed |
| `buildSrc/` (`build.gradle.kts`, `src/main/java/com/dtgibson/snowraven/kotlin/{BuildTask,RustPlugin}.kt`) | the `rust` Gradle plugin whose `BuildTask` invokes the Tauri CLI's `android-studio-script` to build the Rust library per ABI | yes, with ONE deliberate edit: `BuildTask.kt`'s executable becomes `cargo` with args `("tauri", "android", "android-studio-script")` in place of the generated `npm` + `("run", "--", "tauri", "android", "android-studio-script")` (section 6.5 says why: on F-Droid's server the only Tauri CLI that may take part is one built from source) |
| `app/build.gradle.kts` | the app module: `namespace`, `applicationId`, `minSdk`, `targetSdk`, `compileSdk`, version keys, build types, the signing block, dependencies | yes (sections 3.3, 6.2) |
| `app/src/main/AndroidManifest.xml` | permissions, the one Activity, the file provider | yes (section 3.4) |
| `app/src/main/java/com/dtgibson/snowraven/MainActivity.kt` | `class MainActivity : TauriActivity()`: `enableEdgeToEdge()`, the inset injection and the theme listener in `onWebViewCreate` | yes (section 5.5; The Designer's record) |
| `app/src/main/res/values/{colors,strings,themes}.xml`, `values-night/themes.xml`, `values-v31/themes.xml`, `xml/file_paths.xml` | resources | yes (sections 3.5 and 5.5) |
| `app/src/main/res/mipmap-*/ic_launcher*.png`, `mipmap-anydpi-v26/ic_launcher.xml`, `values/ic_launcher_background.xml` | the launcher set | the committed set from `src-tauri/icons/android`, the template's two drawable placeholders deleted (section 3.5) |
| `app/proguard-rules.pro` | empty template | yes |
| `.gitignore`, `app/.gitignore` | written by init | yes, with the jar and `gradlew.bat` added to the root one |
| `app/tauri.properties`, `app/tauri.build.gradle.kts`, `app/proguard-tauri.pro`, `app/src/main/assets/tauri.conf.json`, `app/src/main/jniLibs/**/*.so`, `app/src/main/java/**/generated/` (`TauriActivity.kt`, wry's `RustWebView`, `RustWebChromeClient`, `RustWebViewClient`, `WryActivity`, `PermissionHelper`, and the plugin registry), `/.tauri`, `/tauri.settings.gradle`, `local.properties`, `key.properties`, `keystore.properties`, `/build`, `/.gradle` | regenerated on every build | no; all are in the two `.gitignore` files init writes |

Two generated files deserve a sentence because they decide the build method everywhere (section 6.5): `tauri.settings.gradle` and `app/tauri.build.gradle.kts` are written by `tauri-build` (`tauri-build-2.6.2/src/mobile.rs:148`, `generate_gradle_files`) during a `cargo build` of the app crate for an Android target, from each plugin's `DEP_*_ANDROID_LIBRARY_PATH` metadata, and they hold ABSOLUTE paths into that machine's cargo registry (`~/.cargo/registry/src/index.crates.io-1949cf8c6b5b557f/tauri-2.11.2/mobile/android` and the plugins' `android/` dirs). So Gradle cannot configure the project until a Tauri-driven cargo build has run once on that machine, which the CLI does itself ("run an initial build to initialize plugins", `tauri-cli` `mobile/android/build.rs`) before it calls Gradle.

`frontend/vite.config.ts` already handles mobile dev (`TAURI_DEV_HOST`), per the mobile-app schema; nothing there changes.

### 3.2 The application id, set without touching the desktop identifier

`src-tauri/tauri.android.conf.json` (as committed by The Engineer):

```json
{
  "$schema": "https://schema.tauri.app/config/2",
  "identifier": "com.dtgibson.snowraven",
  "bundle": { "android": { "minSdkVersion": 24 } }
}
```

Verified against the installed CLI's `config.schema.json`: the platform-specific file list is `tauri.linux.conf.json`, `tauri.windows.conf.json`, `tauri.macos.conf.json`, `tauri.android.conf.json`, `tauri.ios.conf.json`, merged over `tauri.conf.json` for that target (objects deep-merge, so `bundle.android.minSdkVersion` here and `bundle.android.versionCode` in the base file, section 3.3, land in one object); `AndroidConfig` has exactly four keys, `minSdkVersion` (default 24), `versionCode`, `autoIncrementVersionCode` (default false), `debugApplicationIdSuffix`. This is the same mechanism `tauri.ios.conf.json` already uses for the iOS bundle id, so `tauri.conf.json`'s `identifier` stays `com.snowraven` and the Mac data directory and the shipped updater are untouched (FR-04). The id must change nowhere else: the Android template reads `{{app.identifier}}` for `namespace`, `applicationId` and the `MainActivity` package, and the `generate_context!` macro picks the Android overlay at compile time for the Android target, so the Rust side sees the same id. A grep of the repository finds `com.snowraven` only in the desktop config, the macOS entitlements, `icloud.rs` comments and `release.sh`'s profile checks, none of which the Android build reads. `minSdkVersion` is written explicitly rather than left to the default so the floor is a committed decision (FR-07) and the guard pins the file rather than a default.

Not set here: `versionCode` (it lives in the base file, section 3.3, so F-Droid reads one file), `autoIncrementVersionCode` (would move the version source into a committed `tauri.properties`, which FR-05 forbids), `debugApplicationIdSuffix` (nothing installs a debug build beside a release one on the same device under the device boundary).

### 3.3 Version name and version code (FR-05, FR-06)

From the generated `app/build.gradle.kts`: `versionCode = tauriProperties.getProperty("tauri.android.versionCode", "1").toInt()` and `versionName = tauriProperties.getProperty("tauri.android.versionName", "1.0")`, where `app/tauri.properties` is written by the CLI on every `tauri android build` from the merged config and is gitignored (today it reads `1.0.48` and `1000048`). The CLI derives the code as `major * 1000000 + minor * 1000 + patch` when `bundle.android.versionCode` is absent, and takes `bundle.android.versionCode` when present (the schema text: "By default we use your configured version and perform the following math").

F-Droid's update checker reads the version name and the version code from a committed file at each tag, and the derivation above leaves nothing committed to read. So the bump writes the code explicitly, in the base config beside the string it is derived from:

```json
"version": "1.0.49",
"bundle": {
  "android": { "versionCode": 1000049 },
  ...
}
```

`src-tauri/tauri.conf.json` is already one of the four version files, so the four-file bump stays four files, and the bump step becomes "move the string and the code together". The guard (`androidVersionSource.test.ts`, section 6.4) asserts that `bundle.android.versionCode` equals the formula applied to `version` in the same file, that `version` equals `frontend/package.json`'s, and that the two literals appear nowhere under `src-tauri/gen/android`. The fdroiddata recipe's `UpdateCheckData` (section 6.5) reads both from this file with two regexes the same guard runs against the committed file, asserting exactly one match each.

Two consequences for the runbook:

- **Android has no build number.** F-Droid keys a release on the version code; a rebuilt APK with a code it has already published is not picked up, and a GitHub APK with the same code does not install over the earlier one (Android refuses a downgrade and treats an equal code as no update). So an Android-only rebuild of a shipped version has exactly the two routes the closed iOS train has (CLAUDE.md, v1.0.30): a full version bump, or letting the fix ride the next version.
- The CLI refuses to build when the version is `0.0.0`; not a concern here, recorded because the error text names `tauri.conf.json`.

### 3.4 The manifest (FR-24, NFR-05)

The template manifest declares `android.permission.INTERNET`, one `MainActivity` (`singleTask`, `exported="true"`, the MAIN/LAUNCHER filter), the AndroidX `FileProvider` (`${applicationId}.fileprovider`, `exported="false"`, used by the dialog and opener plugins) and `android:usesCleartextTraffic="${usesCleartextTraffic}"`, a placeholder that `app/build.gradle.kts` sets to `"false"` in `defaultConfig` and `"true"` only in the `debug` build type. So a release build already forbids cleartext (QA-24, QA-56); the guard pins the placeholder and the two Gradle lines rather than assuming it. The generated manifest for this project carries no leanback lines (the 2.11.2 template has dropped them), so nothing is removed.

The permission set follows the location branch (section 4.6), and the committed manifest is where the branch is visible:

| Branch | `uses-permission` set | Who declares the location pair |
|---|---|---|
| B (default, as of this revision) | `INTERNET` only | nobody: with the geolocation plugin gone from the Android build, no plugin manifest merges a location permission in, and the merged release manifest carries exactly one permission |
| A (after a passing FR-55 measurement) | `INTERNET`, `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | the app manifest, explicitly. wry's `RustWebChromeClient` requests both at runtime through `ActivityResultContracts.RequestMultiplePermissions`, and Android grants a runtime request only for a permission the manifest declares, so without these two lines the WebView's prompt is refused silently |

The committed manifest today carries the pair (The Engineer's hold state, written while the plugin was still linked); under branch B The Engineer removes them, and `androidProjectPins.test.ts` pins the set from `ANDROID_LOCATION_BRANCH` (section 5.3) so the manifest and the frontend cannot disagree. In either branch: no background location, no storage, no camera, no notifications, no `<queries>` (an implicit `ACTION_VIEW` from the opener needs none). QA-24 reads the MERGED manifest from the release build with `aapt2 dump permissions`, which is the ground truth; the committed file is the pinned intent.

Backup attributes (`android:allowBackup`, `fullBackupContent`, `dataExtractionRules`) are NOT added under OQ-09's default; section 7.4 gives the exact edit if the user chooses to exclude the keys file.

The webview origin on Android is `http://tauri.localhost` (Tauri's default with `useHttpsScheme` false); it is served by `shouldInterceptRequest`, never a socket, so the cleartext flag does not touch it, and `*.localhost` is a potentially trustworthy origin for `isSecureContext`, which section 4.6's measurement confirms first. The `index.html` iPad splash hack is gated on `location.protocol === 'tauri:'` and so is inert on Android.

### 3.5 Icons (FR-09)

The dormant set under `src-tauri/icons/android/` is Tauri's own `tauri icon` output shape (`mipmap-{m,h,x,xx,xxx}hdpi/ic_launcher{,_round,_foreground}.png`, `mipmap-anydpi-v26/ic_launcher.xml` naming `@mipmap/ic_launcher_foreground` over `@color/ic_launcher_background`, `values/ic_launcher_background.xml` = `#2D8653`). Measured today:

| Bucket | `ic_launcher` / `_round` | `ic_launcher_foreground` | Android spec |
|---|---|---|---|
| mdpi | 48 | 108 | 48 / 108 |
| hdpi | **49** | 162 | **72** / 162 |
| xhdpi | 96 | 216 | 96 / 216 |
| xxhdpi | 144 | 324 | 144 / 324 |
| xxxhdpi | 192 | 432 | 192 / 432 |

The hdpi launcher and round launcher are 49 by 49 where the bucket is 72 by 72; the generator wrote them that way at v0.5.93 and nothing has read them since. The Engineer regenerates that one bucket from `pipeline/ebird-cooldown-and-app-icon/icon-source/SnowRaven_SR_AppIcon_FullBleed_2048.png` (72 px, and the round variant with the same mask the other buckets carry), and the guard pins the whole table so this cannot recur. The xxxhdpi foreground's mark occupies x 145 to 296, y 160 to 275 of 432, inside the 66 dp safe zone (84 to 348); the guard asserts that bounding box per bucket. The legacy `ic_launcher.png` files carry anti-aliased alpha at the corners (1,186 of 36,864 pixels at xxxhdpi), which is correct for pre-API-26 launchers and is not the listing icon.

Listing icon (F-Droid reads `images/icon.png` from the Fastlane folder): `src-tauri/icons/icon.png` (512) has fully transparent pixels and is NOT usable. `icon-source/SnowRaven_SR_AppIcon_FullBleed_512.png` is 512 by 512 RGB with no alpha channel (PNG color type 2) and is the listing icon; it is staged at `pipeline/android-release/fdroid/fastlane-proposal/en-US/images/icon.png` and lands at `fastlane/metadata/android/en-US/images/icon.png` on the yes; the guard asserts its dimensions and that it has no alpha channel or no pixel below 255.

In `gen/android/app/src/main/res/`: the committed set is copied over the template's placeholders byte for byte (the guard asserts the two trees are equal), and the template's `drawable/ic_launcher_background.xml` (Android's green grid) and `drawable-v24/ic_launcher_foreground.xml` are deleted so the adaptive icon resolves to the mipmap and color the committed XML names. No monochrome layer (out of scope).

### 3.6 Target API level (FR-07, OQ-07)

F-Droid imposes no target level. The tauri-cli 2.11.2 template writes `compileSdk = 36` and `targetSdk = 36`, and 36 (Android 16) is the current stable level read 2026-10-03, so no edit is needed; the value and the date it was read are recorded in one place, the comment on the `targetSdk` line in `app/build.gradle.kts`, and the guard pins 36. The committed comment currently cites Google Play's requirement; The Engineer rewords it to the F-Droid reading (the level is chosen for the permission and storage behavior it brings, and re-read at the next major Android release, not at a store submission). The choice rests on Android 15 and 16 behavior at this level, which section 5.5 relies on: edge-to-edge enforced, predictive back available, the photo-picker and document-picker paths unchanged.

### 3.7 Regeneration: keep aside and restore (FR-02)

A re-run of `tauri android init` rewrites every template file in 3.1 from the template and the current config. The procedure, which mirrors the xcodegen rule in CLAUDE.md, and which The Engineer's `android-init.sh` already implements for the hash step:

1. Never run `tauri android init` against the repository's `gen/android` in place. Move the whole directory aside first: `mv src-tauri/gen/android <scratch>/android-kept`.
2. Hash every tracked and untracked file outside `gen/android` (the Engineer's `hashtree`), run init (`--ci --skip-targets-install`, with `tauri.android.conf.json` present or the id regenerates as `com.snowraven`), hash again, and read the diff: init must change nothing outside `gen/android`, and `gen/apple` must be byte-identical to its kept copy.
3. Restore, by file and by CONTENT, each deliberate edit from the kept copy: `app/build.gradle.kts` (the `targetSdk` comment and the signing block of section 6.2, nothing else), `app/src/main/AndroidManifest.xml` (the permission set of the current branch, section 3.4), `MainActivity.kt` (the inset injection and the theme listener, section 5.5), `res/values/themes.xml`, `values-night/themes.xml`, `values-v31/themes.xml` (the launch state, section 5.5), the icon tree (copy `src-tauri/icons/android/**` over `res/`, delete the two drawable placeholders), `buildSrc/src/main/java/com/dtgibson/snowraven/kotlin/BuildTask.kt` (the `cargo` executable and args, section 3.1), `gradlew` (the shim, section 3.8), the deletion of `gradlew.bat` and `gradle/wrapper/gradle-wrapper.jar`, and the two lines added to `.gitignore`.
4. Diff every file under `gen/android` against the kept copy and read the diff; "the changed-file list is unchanged" is not a check (CLAUDE.md, v1.0.42).
5. Run the Android guards. Red is the expected first result after a regeneration that dropped an edit; green is the exit condition.

The guards in 6.4 are what make step 5 mean something; a probe that wants to see what a fresh init produces runs in scratch against a copy of the repository, never here.

### 3.8 The Gradle wrapper jar (FR-61, OQ-17)

What fdroidserver does with it, read from `scanner.py` on `master`: a file named `gradle-wrapper.jar`, `gradlew`, `gradlew.bat` or `gradle-daemon-jvm.properties` is passed to `removeproblem`, which deletes it, logs "Removing ... at ...", and does NOT count toward the scanner's problem count (unlike every other binary, which `handleproblem` counts as an error unless `scanignore`d or `scandelete`d). There is no checksum allowlist for the jar anywhere in the scanner. Separately, `build.py` deletes `gradlew` and `gradlew.bat` from every directory holding a Gradle build file after `prebuild` and before the scan, and runs Gradle through `config['gradle']`, which on the buildserver is `gradlew-fdroid` (symlinked to `/usr/local/bin/gradle` and `/usr/local/bin/gradlew-fdroid` by `buildserver/provision-gradle`), a Python script that reads the Gradle version from `gradle/wrapper/gradle-wrapper.properties` in the working directory or its two parents (or from `-p`), downloads that version against its own table of SHA-256 sums (8.14.3 is in the table) and runs it.

So the PRD's exception ("accepts an official wrapper jar by checksum") is not met: the scanner accepts the jar by deleting it, not by verifying it. The default stands: the jar is removed from the commit. Three facts make the removal cheap:

- **F-Droid never runs our `gradlew`.** It is deleted before `build:` runs, so the recipe's `build:` step writes the shim back (section 6.5) and `gradle` resolves to `gradlew-fdroid`, which reads 8.14.3 from the properties file we keep.
- **CI and the release machine put Gradle 8.14.3 on `PATH` themselves** (`gradle/actions/setup-gradle@v4` with `gradle-version` from `toolchain.env`; Homebrew `gradle@8` or the official `gradle-8.14.3-bin.zip` under `~/.tauri/gradle-8.14.3` on the Mac, whichever reports 8.14.x; the preflight asserts `gradle --version` reports the version in the properties file).
- **The Tauri CLI only needs a file named `gradlew` to exist and be executable** (cargo-mobile2 runs `<project>/gradlew`, and the CLI normalizes its line endings and marks it executable before each build). It does not need it to be Gradle's wrapper script.

The committed `src-tauri/gen/android/gradlew` is therefore:

```sh
#!/bin/sh
# Not Gradle's wrapper. SnowRaven commits no wrapper jar (android-release schema 3.8, FR-61):
# Gradle 8.14.3 is pinned in gradle/wrapper/gradle-wrapper.properties, and CI, the release
# machine and F-Droid's build server each put that Gradle on PATH as `gradle`.
cd "$(dirname "$0")" && exec gradle "$@"
```

`androidProjectPins.test.ts` pins the shim's content, the absence of the jar and of `gradlew.bat` from `git ls-files`, and the `8.14.3` in the properties file equal to `GRADLE_VERSION` in `scripts/android/toolchain.env`. AGP 8.11.0 requires Gradle 8.13 or later and is not supported on Gradle 9, which is why the version is pinned rather than "latest".

---

## 4. Rust and plugins

### 4.1 What compiles for the Android target (FR-08)

From `Cargo.toml`'s cfg blocks after this revision, the Android binary (`libsnowraven_lib.so`, from the `cdylib` crate type already declared) links:

| Block | Crates | On Android |
|---|---|---|
| `[dependencies]` | tauri, tauri-plugin-opener, -http, -fs, -clipboard-manager, -os, serde, serde_json, tzf-rs, keyring | all compile. tzf-rs 0.4.13 is pure Rust (prost data). `keyring` 3.6.3 selects its `mock` store on any target that is not linux, freebsd, openbsd, macos, ios or windows (`keyring-3.6.3/src/lib.rs:302`), so the three `*_api_key` commands compile against an in-memory store; they are invoked from nowhere (section 2.3), so the mock is dead code, not a behavior |
| `cfg(not(any(android, ios)))` | tauri-plugin-updater, -process, -window-state | absent (FR-12, FR-13) |
| `cfg(any(android, ios))` | tauri-plugin-dialog 2.7.1 | present; declares `minSdk = 24`, `compileSdk = 36` in its Gradle module |
| `cfg(any(macos, ios))` | objc2, objc2-foundation, block2, sha2 | absent; `mod icloud` is behind the same cfg in `lib.rs` |
| `cfg(target_os = "ios")` | objc2-ui-kit, **tauri-plugin-geolocation 2.3.2** (moved here) | absent |
| `cfg(macos)`, `cfg(windows)` | core-location, app-kit, tokio, windows | absent |

The exact `Cargo.toml` move: the line `tauri-plugin-geolocation = "2"` leaves the `[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]` block (whose comment is rewritten to name dialog alone, and to say the geolocation plugin is iOS-only because its Android side depends on `com.google.android.gms:play-services-location`, which the Android build may not carry) and joins `[target.'cfg(target_os = "ios")'.dependencies]` beside `objc2-ui-kit`, with a comment of its own. `Cargo.lock` does not change: the crate and its dependency subtree stay resolved for the iOS target.

The exact `lib.rs` move: the `#[cfg(mobile)]` chain becomes `let builder = builder.plugin(tauri_plugin_dialog::init());` with its comment reduced to dialog, and `.plugin(tauri_plugin_geolocation::init())` joins the existing `#[cfg(target_os = "ios")]` chain, which becomes `builder.plugin(tauri_plugin_geolocation::init()).plugin(widgets::plugin()).plugin(alerts::plugin()).setup(...)`. Nothing else in `lib.rs` moves: `cfg(desktop)` leaves out `window_geometry` and the three desktop plugins, `cfg(target_os = "ios")` leaves out widgets, alerts and `launch_backdrop`, the `generate_handler!` list reduces on Android to `get_api_key`, `set_api_key`, `delete_api_key`, `get_timezone`, and the keeper line `.run(tauri::generate_context!())` is untouched (section 4.5). `singleWebviewInvariant.test.ts` keeps its six marker sites. `build.rs` emits its `-Wl,-U` arguments only when `CARGO_CFG_TARGET_OS` is `ios`, so the Android link sees none of them.

QA-08's check: `cargo tree --target aarch64-linux-android -e normal -p snowraven` shows the dialog plugin and no geolocation, updater, process, window-state or Apple-vendor crate; `cargo tree --target aarch64-apple-ios` still shows `tauri-plugin-geolocation`. The frontend keeps `@tauri-apps/plugin-geolocation` in `frontend/package.json`: the iOS path imports it dynamically behind `isIOS()`, and `androidReachableCalls.test.ts` lists its three commands as kept off Android by that gate (section 6.4).

### 4.2 The vendored tao

`src-tauri/vendor/tao` is tao 0.35.3 with two changes, both under `src/platform_impl/ios/` (`view.rs` line 646, `scene.rs`'s cold-start hunk). Measured: `diff -rq` against the registry copy of tao 0.35.3 reports exactly those two files; `src/platform_impl/android/` is byte-identical to upstream, and tao's Android dependencies (`jni`, `ndk`, `ndk-sys`, `tao-macros`, `percent-encoding`) are all resolved in `Cargo.lock`. The Engineer's first `aarch64-linux-android` release build has since succeeded (`src-tauri/target/aarch64-linux-android/` and `app/src/main/jniLibs/arm64-v8a/libsnowraven_lib.so` exist in the tree), so OQ-11 is answered for that target; `armv7-linux-androideabi` and `x86_64-linux-android` are proved by the first three-target build. **Stop condition unchanged:** if any locked crate fails for one of the three targets, the run stops and the failure goes to the user as a flag with the crate and the error; a Tauri, tao or wry upgrade is not a remedy available to this run (FR-08, OQ-11).

### 4.3 Capabilities (FR-23)

How tauri 2.11.2 scopes a capability to one mobile platform, verified in the locked sources: `Capability.platforms` is `Option<Vec<Target>>` where `Target` is the closed enum `macOS | windows | linux | android | iOS` (`tauri-utils-2.9.2/src/acl/capability.rs:196` and the generated `gen/schemas/mobile-schema.json`, which lists exactly those five strings). `Capability::is_active(target)` is `platforms.contains(target)` or true when the list is absent. Both consumers filter on it BEFORE touching the permissions: `tauri-build-2.6.2/src/acl.rs:337` (`validate_capabilities`) `continue`s past an inactive capability without checking that its permissions exist, and `tauri-utils-2.9.2/src/acl/resolved.rs:98` resolves commands only for `capabilities.values_mut().filter(|c| c.is_active(&target))`. So a capability with `platforms: ["iOS"]` that names `geolocation:*` permissions does not fail an Android build in which the geolocation plugin does not exist, and grants nothing there.

| File | Today | Change |
|---|---|---|
| `capabilities/default.json` | no `platforms` key, so it applies everywhere; `windows: ["main"]`; `fs:*` scoped to `$APPLOCALDATA/**`; `http:allow-fetch` on `https://**`; `os:allow-platform`; `opener:default`; `clipboard-manager:allow-write-text` | byte-unchanged (QA-23 asserts the five `fs` entries byte-equal) |
| `capabilities/desktop.json` | `platforms: ["macOS", "windows", "linux"]`; updater and process grants | byte-unchanged; Android is not in its list |
| `capabilities/mobile.json` | `platforms: ["iOS", "android"]` (The Engineer's hold state), the three geolocation grants and `dialog:allow-open` | keeps `platforms: ["iOS", "android"]`, `windows: ["main"]`, and exactly one permission, `dialog:allow-open`; the description names dialog's Mechanism B role alone |
| `capabilities/ios.json` (new) | | `"$schema": "../gen/schemas/mobile-schema.json"`, `"identifier": "ios"`, `"platforms": ["iOS"]`, `"windows": ["main"]`, `"permissions": ["geolocation:allow-check-permissions", "geolocation:allow-request-permissions", "geolocation:allow-get-current-position"]`, with a description saying the plugin is iOS-only because its Android side links Play Services |

Two platform files rather than one file with a split: a reader of `mobile.json` should see only what both mobile binaries carry, and a reader of `ios.json` should see the one plugin whose absence on Android is a product decision. All four files keep `windows: ["main"]` (NFR-05). The plugin JS packages (`@tauri-apps/plugin-geolocation`, `plugin-dialog`, `plugin-fs`) are already dependencies; nothing is added to `frontend/package.json`.

### 4.4 Gradle modules, manifest permissions and the Google question (FR-54, NFR-02)

Read from each locked crate's `android/build.gradle.kts` and manifest, and from the generated project. With geolocation out of the Android dependency graph, `tauri.settings.gradle` includes six Gradle projects: `tauri-android`, `tauri-plugin-clipboard-manager`, `tauri-plugin-dialog`, `tauri-plugin-fs`, `tauri-plugin-opener`, and the app (the generated file today still lists `tauri-plugin-geolocation`; it is regenerated by the first build after the Cargo move and the guard in 6.4 reads it when present).

| Module | Manifest permissions it declares | Gradle dependencies it adds |
|---|---|---|
| tauri-android (tauri 2.11.2 `mobile/android`) | none | androidx core-ktx 1.7.0, appcompat 1.6.0, material 1.7.0, jackson-databind 2.15.3 |
| the app template | `INTERNET` | androidx webkit 1.14.0, appcompat 1.7.1, activity-ktx 1.10.1, lifecycle-process 2.10.0, material 1.12.0 |
| wry 0.55.1 | none; it has no Gradle module (its Kotlin is generated into `app/src/main/java/.../generated/`) and adds no dependency | none |
| dialog 2.7.1 | none (the picker is `ACTION_OPEN_DOCUMENT`, which needs no storage permission) | core-ktx 1.9.0, appcompat 1.6.0, material 1.7.0 |
| fs 2.5.1 | none | core-ktx, appcompat, material |
| opener 2.5.4 | none | core-ktx, jackson-databind, androidx browser 1.8.0 (Custom Tabs) |
| clipboard-manager 2.3.2 | none | core-ktx, appcompat, material, jackson-databind |
| os 2.3.2, http 2.5.9 | none (no Android module; `http` is the Rust `reqwest` client) | none |
| geolocation 2.3.2 | (not in the Android build) | would have added `com.google.android.gms:play-services-location:21.3.0` |

So the Google-authored artifacts the Android build is expected to contain are exactly: `com.google.android.material:material` (requested at 1.7.0 and 1.12.0, resolved to 1.12.0; Material Components, Apache-2.0, published on Google's Maven) and, at build time only, the Android Gradle Plugin 8.11.0. Transitive AndroidX dependencies may pull small Apache-2.0 Google utility artifacts (`com.google.guava:listenablefuture`, `com.google.errorprone:error_prone_annotations`, `com.google.code.findbugs:jsr305` is not Google); the Engineer records the exact merged tree from `./gradlew :app:dependencies --configuration universalReleaseRuntimeClasspath` in the run record (QA-53, QA-61), and the acceptance rule is: no `com.google.android.gms`, no `com.google.firebase`, no `com.google.android.play`, no `com.google.ads`, no `com.google.mlkit`, no `com.android.billingclient`, no `com.android.installreferrer` (the families fdroidserver's `scanner.py` flags as non-free, read from its embedded `SUSS_DEFAULT`); any other `com.google.*` coordinate must be a free library on Maven with its license recorded beside it. `fdroid scanner` applies the same patterns to every Gradle file in the tree, including the plugin modules it reaches through `tauri.settings.gradle` only at build time, which is why the local `fdroid build` run in 6.5 is the complete check and `fdroid scanner` alone is not.

The runtime consequence that used to be flagged here (a de-Googled phone getting no location because the plugin asked `GoogleApiAvailability`) is gone with the plugin. What a de-Googled phone gets is section 4.6's second reading.

### 4.5 The single-webview invariant on Android

The generated project declares one Activity (`MainActivity`, `launchMode="singleTask"`), and `TauriActivity` (wry's `WryActivity`) hosts one `RustWebView`. Tauri's Android runtime has no scene or multi-window path; the keeper line in `lib.rs` is untouched, `singleWebviewInvariant.test.ts` keeps its six marker sites, and all four capability files keep `windows: ["main"]`. So `docChains`, the two ordered writers and the three purge generations stay sufficient (NFR-05, QA-56). Reversal condition unchanged: CLAUDE.md, Desktop storage (Tauri), v1.0.9.

### 4.6 Location on Android: the mechanism on paper, and the measurement that switches the branch (FR-55, OQ-18)

**What wry already does, read from `wry-0.55.1/src/android/kotlin/`.** The question the PRD asked was whether the WebView's own geolocation can be served "given the WebView geolocation permission callback granted and the runtime location permission requested from `MainActivity.kt`". Both halves already exist inside wry's generated Kotlin, so `MainActivity.kt` needs no location code at all:

- `RustWebView.kt:23` calls `settings.setGeolocationEnabled(true)` in the view's `init`, so `navigator.geolocation` is live in the page.
- `RustWebChromeClient.kt:238` overrides `onGeolocationPermissionsShowPrompt(origin, callback)`. If `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` are already granted it calls `callback.invoke(origin, true, false)` at once. Otherwise it launches `permissionLauncher` (an `ActivityResultContracts.RequestMultiplePermissions` registered in the client's `init` on the `WryActivity`) for both, and on the result: both granted, `callback.invoke(origin, true, false)`; fine refused but coarse granted on API 31 or later (the user picked Approximate), `callback.invoke(origin, true, false)`; otherwise `callback.invoke(origin, false, false)`. The third argument is `retain = false`, so the WebView asks the client again on every `getCurrentPosition`, which is correct: a granted app permission answers silently, a "do not ask again" state answers denied with no dialog because Android resolves the launcher immediately.
- `WryActivity.setWebView` installs this client on the one webview (`main_pipe.rs:288`, `setWebChromeClient`), and the client is the same object that already serves `onShowFileChooser` for the import path, so its launcher registration is known to work in this Activity's lifecycle.

The one thing wry cannot supply is the manifest declaration: a runtime request for an undeclared permission is refused by the system without a dialog, which is why branch A declares the pair (section 3.4) and branch B declares nothing.

**Where the position comes from, read from Chromium `main`.** Android WebView's geolocation is `services/device/geolocation/android/.../LocationProviderFactory.create()`, which returns `LocationProviderGmsCore` only when `useGmsCoreLocationProvider()` has been called, which Chrome's browser process does and the WebView never does; every other embedder gets `LocationProviderAndroid`, a thin client of the platform `android.location.LocationManager` (`requestLocationUpdates(0, 0, criteria, listener, uiLooper)`). So a fix delivered to the page is the phone's own location service answering a system API: on a phone with Google Play services the network provider behind that API is Google's, as a system component; on a phone without, it is whatever providers the ROM supplies (GPS at least). Nothing of Google's compiles into, links into or is requested by SnowRaven for this (FR-54), and QA-52's capture confirms no request from the app to a Google host during a fix.

Two details of the current `LocationProviderAndroid` shape the frontend call. (1) When the app holds `ACCESS_FINE_LOCATION` and the page asks for low accuracy, the provider reports "Cannot generate approximate location" as an error under the `APPROXIMATE_GEOLOCATION_PERMISSION` feature, to avoid leaking a precise fix on a coarse request. (2) When the app holds only coarse (the user chose Approximate), `mEffectiveHighAccuracy` is forced false whatever the page asked. So the Android call passes `enableHighAccuracy: true` unconditionally: with Precise granted that is required on a WebView carrying the feature, and with Approximate granted the provider downgrades it itself. The web/Pi path keeps its existing default and is not touched.

**The measurement The Engineer runs (QA-62), on paper here so the result is a recording rather than an exploration.** Build: a release-profile build signed with the throwaway keystore (the signer is recorded; the user's key is required for the publication check, not for this), with the branch-A plumbing applied on a scratch branch: the two manifest lines, `ANDROID_LOCATION_BRANCH = 'A'`, and the `getCurrentLocationAndroid()` of section 5.3. Images: first `system-images;android-36;google_apis;arm64-v8a` (the matrix's current-API image; this run is the switch), then `system-images;android-36;default;arm64-v8a` (AOSP, no Google APIs, the AOSP WebView; this run is the de-Googled reading and is recorded, not a switch condition). Before anything else, record the WebView package and version (`adb shell dumpsys package com.google.android.webview | grep versionName`, or `com.android.webview` on the default image) and the APK's signer (`apksigner verify --print-certs`). Set the emulator's location to a fixed point through Extended Controls, Location (for example 42.4440, -76.5019), and confirm the point is being sent.

| Step | Action | Pass reading | Recorded |
|---|---|---|---|
| 0 | In the app, evaluate `window.isSecureContext` and `'geolocation' in navigator` (through the theme channel's debug hook or `chrome://inspect`) | both true for `http://tauri.localhost` | the two values. If `isSecureContext` is false, the measurement stops at branch B and the reversal is a window `useHttpsScheme` reading, flagged, never attempted in this run |
| 1 | Fresh install; open Map Explorer; press the locate control | Android's own permission dialog, naming SnowRaven, with Precise and Approximate and the While-using choice; no sheet of ours before it | screenshot |
| 2 | Choose Precise, While using the app | the map centers on the fixed point within ten seconds; no error note | screenshot; the elapsed time from press to center |
| 3 | Press again | no dialog; the position arrives again | the elapsed time |
| 4 | Clear the app's data; press; choose Approximate | a position arrives (good to a few kilometers) OR the generic unavailable sentence; never a hang past ten seconds | which, and the accuracy reported by `pos.coords.accuracy` |
| 5 | Clear data; press; Deny | the denied sentence (section 5.3's Android route) with no second dialog | screenshot |
| 6 | Press again twice (Android 11 and later stops asking after repeated denials) | the denied sentence each time; on the press where Android has stopped asking, no dialog at all | screenshot |
| 7 | Grant Precise; in Extended Controls stop sending the location (or turn the emulator's Location off in quick settings); press | the timeout sentence at about ten seconds, never the denied one. With the master switch off, Chromium may instead report position-unavailable at once; the generic sentence then is also a pass, recorded as which | the sentence and the elapsed time |
| 8 | Leave the permission dialog open for more than ten seconds, then grant | a position, not a timeout (the Geolocation timer starts after permission is granted) | the elapsed time |
| 9 | QA-52's capture during steps 2 and 4 | no request from the app to any Google host | the host list |

**Pass condition for branch A:** on the `google_apis` image, steps 0, 1, 2, 3, 5, 6, 7 and 9 pass as written and step 8 passes. Step 4's result does not decide the branch; it decides one Help sentence (whether Approximate gives a usable position). The `default` image run is then performed with the same table and recorded; if it fails at step 2 while the `google_apis` image passed, that is a flag for the user and one Help sentence about phones without a network location provider, not a return to branch B, because the failing component is the phone's provider set and not anything in the app. If the `google_apis` run fails any deciding step, branch B stands, and the recording names the step and the WebView version.

**Default and ordering.** Branch B is in force until the recording exists (FR-55: "the default is branch B; only a successful measurement lifts it"). The Engineer records the result in `decisions.md` under "FR-55 measurement" with the image, the WebView version, the signer, the step table filled in, and the branch, dated before the first location-path commit on the feature branch; then flips `ANDROID_LOCATION_BRANCH` (or leaves it) and applies that branch's edits from section 5.3. The Designer's location surface stands under A and is absent under B, exactly as the PRD states.

---

## 5. The platform seam

### 5.1 `lib/platform.ts`

```ts
// Android check, the same synchronous platform() probe as isIOS() and
// isMacOS(): false when not Tauri, false when the os plugin internals are
// absent (a throw). Capability branching only, never layout. No user-agent
// read: isWindows()'s UA sniff is the one exception in this file and is not
// the pattern (android-release schema 5.1).
export function isAndroid(): boolean {
  if (!isTauri()) return false;
  try {
    return platform() === 'android';
  } catch {
    return false;
  }
}

// The two mobile apps. Exists so a gate whose argument is "mobile" (no
// updater, no self-relaunch, compact chrome, native import wording) says so
// once, and a gate whose argument is Apple-specific (iCloud, widgets, Alerts)
// keeps naming isIOS() / isMacOS() and is false here by construction.
export function isMobileApp(): boolean {
  return isIOS() || isAndroid();
}
```

`platform()` returns `'android'` from `__TAURI_OS_PLUGIN_INTERNALS__.platform` (plugin-os 2.3.2 `dist-js/index.js:35`), injected before any page script. `isIOS()` is byte-unchanged and returns false on Android (FR-10, QA-10). `isWindows()` is not touched and not copied. `platform.ts` is on the entry chunk; the two functions add a few dozen bytes to a module already there, and `entryChunk.test.ts` bounds the chunk rather than freezing it, so NFR-06 holds with the budget re-read by the Engineer; the WebView floor check adds zero entry-chunk bytes (5.6).

### 5.2 The FR-11 table as the per-site plan

| Site | Today | Classification | Change | Designer-confirmed |
|---|---|---|---|---|
| `platformGates.ts` `showUpdaterFooter` | `!isIOS()` | no-updater | `!isMobileApp()` (done by The Engineer) | |
| `platformGates.ts` `supportsAppRelaunch` | `!isIOS()` | no-updater | `!isMobileApp()`; the iOS close-and-reopen sentence in `Settings.tsx` is reached unchanged (FR-13) | |
| `platformGates.ts` `compactChrome` | `isIOS()` | mobile | `isMobileApp()`; the `sr-header-compact` and map-panel classes follow it as today | **yes** (FR-14) |
| `platformGates.ts` `showICloudSync` | `isTauri() && (isIOS() \|\| isMacOS())` | Apple-specific | none | |
| `alertsState.ts` `alertsSupported`, `widgetHandover.ts` `widgetsSupported` | `isTauri() && isIOS()` | Apple-specific | none; the controllers never boot, the sections, bell, sidebar item, Search rows and Help entry never render (FR-15) | |
| `Settings.tsx` file-row label | `fileRowButtonLabel(uploading, !!info, isIOS())` | mobile | third argument `isMobileApp()` (FR-16) | |
| `Settings.tsx` pick handler | `isIOS() && IOS_IMPORT_MECHANISM === 'dialog' && onNativePick` | mobile, per platform | `activeImportMechanism() === 'dialog' && onNativePick` (5.4) | |
| `location.ts` `getCurrentLocation` | `if (isIOS()) return getCurrentLocationIOS()` | mobile, measured per platform | an `isAndroid()` arm BEFORE the iOS arm and before the dev-mode guard, per the branch (5.3); the iOS arm and the desktop `get_location` invoke are unchanged and unreachable on Android | |
| `location.ts` `describeLocationError` | iOS, else Windows, else macOS | Apple-specific copy | branch A: an `isAndroid()` arm inserted before the Windows arm with the Android sentence (5.3); branch B: no change, since no Android caller can reach it | |
| `MapExplorer.tsx` `iosFullscreen` | `isIOS() && !!isFullscreen` | mobile | `isMobileApp() && !!isFullscreen`, renamed `mobileFullscreen` (FR-19) | **yes** |
| `main.tsx` `sr-ios-app` marker | `if (isIOS()) classList.add('sr-ios-app')` | mobile insets, platform-named | `applyPlatformRootMarkers` in `lib/rootMarkers.ts` adds `sr-android-app` beside it; `sr-ios-app` is never applied on Android (5.5; done by The Engineer) | **yes** (FR-20) |
| `paletteHint.ts` `resolveChordHint` | `isIOS() \|\| coarsePrimaryPointer()` | Apple-specific, correct by order | none (FR-21) | |

QA-11's test mocks `platform()` to `'android'` and pins one row per line above; each row is written so reverting its gate to the `isIOS()` form turns only that row red.

### 5.3 The location path on Android, per branch (FR-17, FR-18, FR-56)

One switch, read by the frontend and by the manifest guard:

```ts
// frontend/src/lib/androidLocation.ts
// The FR-55 switch. 'B' until the measurement recorded in
// pipeline/android-release/decisions.md lifts it (android-release schema 4.6).
// Read by platformGates.showLocationControls(), by location.ts, and by
// androidProjectPins.test.ts, which pins the manifest's permission set to it.
export const ANDROID_LOCATION_BRANCH: 'A' | 'B' = 'B'
```

```ts
// frontend/src/lib/platformGates.ts
// FR-56: under branch B every location control is ABSENT on Android, not
// disabled and not explained. Everywhere else the controls render as today.
export function showLocationControls(): boolean {
  return !(isAndroid() && ANDROID_LOCATION_BRANCH === 'B')
}
```

**Branch B (the default).** `getCurrentLocation()` keeps The Engineer's Android arm: `if (isAndroid()) throw { code: 'unavailable', platform: 'tauri' }`, placed before the iOS arm and before the dev-mode guard, so neither the geolocation plugin nor the `get_location` command (registered only on macOS and Windows) is ever named on Android (FR-22). The five control sites consume `showLocationControls()` and render nothing when it is false: the Map Explorer locate control and the Use my location control in its filters, the Default Location card's Use my location in Settings, My location on Targets, and the Current lookup on Weather; Plan with no place chosen takes its existing no-place state and does not call `getCurrentLocation()`. No text names location as unavailable (QA-63). `describeLocationError` is unchanged.

**Branch A (after a passing measurement).** `getCurrentLocation()`'s Android arm becomes `if (isAndroid()) return getCurrentLocationAndroid()`, and the function is:

```ts
// Android: the Android System WebView's own geolocation, served by wry's
// RustWebChromeClient (onGeolocationPermissionsShowPrompt requests the two
// manifest permissions and grants the callback) and answered by the platform
// LocationManager through Chromium's LocationProviderAndroid (schema 4.6).
// No plugin, no native command, nothing of Google's. enableHighAccuracy is
// true on purpose: a WebView carrying Chromium's approximate-geolocation
// feature refuses a low-accuracy request from an app that holds the precise
// permission, and with only the approximate permission the provider forces
// low accuracy itself. The ten-second timeout is Chromium's own and starts
// after permission is granted.
async function getCurrentLocationAndroid(): Promise<Location> {
  if (!('geolocation' in navigator)) {
    const err: LocationError = { code: 'unavailable', platform: 'tauri' }
    throw err
  }
  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      pos => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      err => {
        const locErr: LocationError =
          err.code === 1 ? { code: 'permission-denied', platform: 'tauri' }
          : err.code === 3 ? { code: 'timeout' }
          : { code: 'unavailable', platform: 'tauri' }
        reject(locErr)
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 },
    )
  })
}
```

`platform: 'tauri'` on the denied error is what routes `describeLocationError` to a platform sentence rather than the browser one, and the new `isAndroid()` arm there, before the Windows arm, returns The Designer's sentence: "Allow location for SnowRaven in Settings → Apps → SnowRaven → Permissions → Location, and make sure Location is turned on, then try again." The route words Settings, Apps, SnowRaven, Permissions, Location are what QA-18 pins; the macOS and Windows sentences are never shown on Android. `showLocationControls()` returns true, so every control renders and The Designer's surface stands. No dynamic import is added (there is no plugin to load), so the entry chunk is unaffected either way (NFR-06). `location.android.test.ts` pins both branches with `ANDROID_LOCATION_BRANCH` mocked each way: the `unavailable` rejection and the absent controls under B; the four error mappings, the `enableHighAccuracy: true` option and the Android sentence under A.

The two iOS questions from the first revision are closed by the plugin's move: the iOS path is byte-unchanged (its no-race behavior included), and the "disabled" regex widening was only ever for the plugin's Android strings.

### 5.4 File import (FR-26 to FR-30, OQ-12)

Mechanism A (the hidden `<input type="file" accept=".csv">`) is backed on Android by wry's `RustWebChromeClient.onShowFileChooser` (`wry-0.55.1/src/android/kotlin/RustWebChromeClient.kt:272`), which presents the system document picker for a non-capture accept type and calls back `null` on cancel (a no-op `change`, FR-27). So the expectation is that Mechanism A works on Android as it does on iOS, and the measurement on the emulator decides (QA-26). `lib/importMechanism.ts` (already in place):

```ts
export const IOS_IMPORT_MECHANISM: 'input' | 'dialog' = 'input';
export const ANDROID_IMPORT_MECHANISM: 'input' | 'dialog' = 'input'; // measured, OQ-12
export function activeImportMechanism(): 'input' | 'dialog' {
  if (isIOS()) return IOS_IMPORT_MECHANISM;
  if (isAndroid()) return ANDROID_IMPORT_MECHANISM;
  return 'input';
}
```

`pickCsvViaDialog` is unchanged. Two Android facts for the measurement: a `content://` URI from a cloud provider whose download fails surfaces to the page as a `File` whose read rejects, which lands in the row's existing load-error state (FR-29) through the same tail; and one `accept=".csv"` on Android filters by extension through the picker's MIME mapping, so the Engineer checks that a `text/comma-separated-values` export from a cloud drive is selectable (if not, `accept` gains `text/csv,text/comma-separated-values`, a web-neutral change). No rule file gates `importMechanism.ts`, so the rename extends no `paths`.

### 5.5 Insets, chrome and the launch state: the facts The Designer decided on (FR-14, FR-19, FR-20, FR-31, FR-32, OQ-13)

- **Edge-to-edge is on from the template.** `MainActivity.onCreate` calls `enableEdgeToEdge()` before `super.onCreate`, and with `targetSdk = 36` Android 15 and 16 enforce edge-to-edge regardless (the opt-out attribute is disabled for API 36 targets). So OQ-13 is answered before measurement: the webview sits under the status bar, the navigation bar and any cutout at every API level, and the keyboard no longer resizes the window on Android 11 and later unless insets are applied.
- **CSS `env(safe-area-inset-*)` cannot be the mechanism at this app's floor.** Android WebView reports 0 px for those variables until Chromium 136 (fullscreen views) and 140 to 144 (all views); the floor in 5.6 is 111. Sources: [Make WebViews edge-to-edge (Android Developers)](https://medium.com/androiddevelopers/make-webviews-edge-to-edge-a6ef319adfac), [Capacitor edge-to-edge and safe areas guide](https://capawesome.io/blog/capacitor-edge-to-edge-and-safe-areas-guide/), [Chrome on Android edge-to-edge migration guide](https://developer.chrome.com/docs/css-ui/edge-to-edge). So the `.sr-ios-app` rules, which read `env()`, cannot simply be re-gated.
- **The Designer chose option (b), injected insets, and the theme listener, both inside the generated `MainActivity.kt`** (design-spec sections 2 and 3; `decisions.md`, Stage 4): `onWebViewCreate(webView)` (an `open fun` on `wry-0.55.1`'s `WryActivity.kt:54`) installs one `ViewCompat.setOnApplyWindowInsetsListener` that sets `--sr-inset-top/right/bottom/left` from `systemBars() | displayCutout()` on `document.documentElement` in CSS px, toggles `sr-ime-open` from `ime()`, and registers `WebViewCompat.addWebMessageListener(webView, "srAndroid", setOf("http://tauri.localhost"), ...)` for the painted theme. The `sr-android-app` root marker gates rules that read ONLY those variables (never `env()`). The Engineer's `MainActivity.kt` already carries both. Nothing about location is added there (section 4.6).
- **The window background and the system splash are resources, not code.** wry applies `tauri.conf.json`'s `backgroundColor` (`#2D8653`) to the WebView itself (`wry-0.55.1/src/android/main_pipe.rs:267`), so the webview is green before first paint; the frame between the system splash and the webview attach shows the Activity theme's `windowBackground`. FR-31 and FR-32 are met with `android:windowBackground` set to the green (a layer-list with the centered mark for API 24 to 30) in `values/themes.xml` and `values-night/themes.xml`, and for API 31 and later `values-v31/themes.xml` setting `android:windowSplashScreenBackground` and `android:windowSplashScreenAnimatedIcon` (the platform SplashScreen attributes; no `core-splashscreen` library, no fixed wait). The Designer decided the green is the same in both themes.
- **Back button (OQ-10), measured in code:** wry's `WryActivity.setWebView` registers an `OnBackPressedCallback` that calls `webView.goBack()` when `canGoBack()` and otherwise the Activity's default. The app never pushes history (no `pushState`, `replaceState` or `popstate` in `src/`), so `canGoBack()` is always false and back takes the app to the background from any screen; Search, Help, the More sheet and open popups do NOT close on back. That is the platform default the PRD accepts; custom handling is a follow-up idea (section 9).

### 5.6 The WebView floor (FR-33, OQ-06, NFR-03)

The floor is **Chromium 111**, not 105. The audit of the shipped frontend:

| Requirement | Chromium | Where |
|---|---|---|
| `@container` (11 uses), `:has()` (1 in the built CSS) | 105 | `globals.css` |
| `dvh` units (11 in the built CSS) | 108 | `globals.css` |
| Tailwind CSS v4 (`tailwindcss` 4.2.4): `@property` (40 registrations), `color-mix()` behind its `@supports` gate, `@layer` | 111 by Tailwind's stated support floor; `color-mix()` is 111 | the built `index-*.css` |
| Vite 8.0.16's default `build.target` `baseline-widely-available` | esbuild `chrome111` | `frontend/vite.config.ts` sets no target, measured in `node_modules/vite/dist/node/chunks/logger.js:175` |
| `Object.hasOwn` (78 uses), `WeakRef`, `requestIdleCallback`, `ResizeObserver` | 93, 84, 47, 64 | `src/` |

Nothing newer was found: no `@scope` (only in the test-side CSS parser), no `popover` attribute (only two CSS variable names), no `toSorted`, `groupBy`, `Set.prototype.union`, `Promise.withResolvers`, `URL.canParse` or `structuredClone` in shipped `src/`. So the gate is **the Tailwind and Vite toolchain floor, 111**, and the probe that maps to it one to one is Tailwind's own: `CSS.supports('color', 'color-mix(in lab, red, red)')`. Every API 24 device can reach it: Chrome 119 was the last release for Android 7, and 119 is above 111.

Mechanism (The Engineer's `frontend/src/lib/webviewFloor.ts` carries `ANDROID_WEBVIEW_FLOOR = 111`, `WEBVIEW_FLOOR_PROBE` and `WEBVIEW_FLOOR_MESSAGE`): the existing inline script in `frontend/index.html` already owns the first paint and a `fail()` state with `window.srLaunch`. It gains, gated on `window.__TAURI_OS_PLUGIN_INTERNALS__ && window.__TAURI_OS_PLUGIN_INTERNALS__.platform === 'android'` (the same injected object `platform()` reads, present before any page script), a probe that on a failed `CSS.supports` sets `data-state="webview"` on `#sr-launch`, writes the message into `#sr-launch-status`, hides the Reload control and sets `window.__SR_WEBVIEW_BELOW_FLOOR__ = true`; `main.tsx` returns before `createRoot` when that flag is set (one conditional). At or above the floor the probe is one `CSS.supports` call and nothing else happens (zero visible cost). The constant lives once, exported for the guard that asserts the `index.html` probe string and the Help sentence agree with it; nothing imports it on the entry path. `launchSplash.test.ts` gains rows for the three states (web: inert; Android above floor: inert; Android below floor: message, no React mount).

**The message names no store (FR-33 as revised).** The design-spec's current sentence ("Update it from Google Play, then open SnowRaven again") predates the revision and must be re-worded by The Designer at the location revision; the substance is "SnowRaven needs a newer Android System WebView. Your phone's software updates or its app store supply it. Then open SnowRaven again." The guard asserts the committed message contains "Android System WebView" and contains neither "Google" nor "Play".

---

## 6. Build and release mechanics

The release leg has three machines and one shape: CI builds the unsigned release universal APK from the tag; the release Mac signs that artifact with the user's key and attaches it to the GitHub release; F-Droid's build server builds its own APK from the same tag with the same commands and signs it with F-Droid's key. The commands are one script, `scripts/android/build-apk.sh`, and one pin file, `scripts/android/toolchain.env`, so that FR-34's "mirror" is a diff of two short lists (QA-34).

### 6.0 Why the build is driven by the Tauri CLI everywhere, and why that CLI is `cargo tauri`

Read from `tauri-cli-v2.11.2`: Gradle's `rustBuild<Arch>Release` tasks run `BuildTask.runTauriCli`, which executes the Tauri CLI's `android-studio-script`. That subcommand (`mobile/android/android_studio_script.rs:50`) calls `read_options`, which connects to a WebSocket server the PARENT `tauri android build` or `dev` process hosts and whose address it wrote to `$TMPDIR/com.dtgibson.snowraven-server-addr`; with no parent running, `read_options` panics ("failed to read missing addr file"). So a bare Gradle invocation (`gradle assembleUniversalRelease`, or F-Droid's `gradle:` build method, which is exactly that) cannot build this app. Every build, on every machine, is `cargo tauri android build`, and Gradle is its child.

The generated `BuildTask.kt` names `npm` as that CLI (`executable = """npm"""`, args `"run", "--", "tauri", "android", "android-studio-script"`), because init was run through npm. On F-Droid's server that would make the build depend on `node_modules/@tauri-apps/cli-linux-x64-gnu/cli.linux-x64-gnu.node`, a prebuilt binary fetched from npm, and would keep `node_modules` in the tree past the scan, where `esbuild`'s extensionless binary is an error. So the committed `BuildTask.kt` names `cargo` with args `"tauri", "android", "android-studio-script"`, and every machine installs the same CLI from source: `cargo install tauri-cli --version 2.11.2 --locked` (crates.io; the version equals `@tauri-apps/cli`'s in `package-lock.json`, asserted by the guard). The npm CLI stays for desktop and iOS work; for Android the parent command is `cargo tauri android build` on all three machines so one path is exercised. The `rootDirRel` of `../../../` from `app/` resolves to `src-tauri`, from which `cargo tauri` finds the config.

`scripts/android/toolchain.env` (sourced by the workflow and the Mac scripts; mirrored as literals in the recipe, which cannot read the repository before the clone):

```sh
RUST_TOOLCHAIN=1.96.1          # rustc on the release machine at the first ship; the recipe and CI pin the same
RUST_TARGETS="aarch64-linux-android armv7-linux-androideabi x86_64-linux-android"
TAURI_CLI_VERSION=2.11.2       # equals @tauri-apps/cli in package-lock.json (guarded)
GRADLE_VERSION=8.14.3          # equals gradle/wrapper/gradle-wrapper.properties (guarded)
NDK_VERSION=27.2.12479018      # r27c; F-Droid's `ndk: r27c`
JAVA_VERSION=17                # AGP 8.11.0 needs 17 or later
NODE_MAJOR=20                  # frontend engines >=20.19.0; Debian trixie ships 20.19.2
SDK_PLATFORM=36
BUILD_TOOLS=36.0.0
```

`scripts/android/build-apk.sh` (the shared body; the frontend build is a separate line everywhere because F-Droid runs it in `prebuild`, before the scan, and deletes `node_modules` afterward):

```sh
#!/bin/sh
set -eu
cd "$(dirname "$0")/../.."
# The gradlew shim (schema 3.8). F-Droid deletes gradlew before the scan; CI and the Mac have it from git.
test -x src-tauri/gen/android/gradlew || printf '#!/bin/sh\ncd "$(dirname "$0")" && exec gradle "$@"\n' > src-tauri/gen/android/gradlew
chmod +x src-tauri/gen/android/gradlew
# frontend/dist was built by the caller; the beforeBuildCommand is removed (RFC 7396 merge: null deletes the key)
cargo tauri android build --ci --apk --target aarch64 armv7 x86_64 \
  --config '{"build":{"beforeBuildCommand":null}}'
OUT=src-tauri/gen/android/app/build/outputs/apk/universal/release
test "$(ls "$OUT"/*.apk | wc -l)" -eq 1   # exactly one APK, or stop (the Windows artifact-selection lesson)
```

The caller on every machine runs `npm --prefix frontend ci && npm --prefix frontend run build` first. No AAB is built (FR-34): neither consumer takes one. The `--config` removal of `beforeBuildCommand` is a measurement The Engineer makes once on the Mac (the CLI's `-v` log shows no "Running beforeBuildCommand"); if `null` does not delete the key under the CLI's merge, the fallback is `""`, which the CLI treats as no command.

### 6.1 CI: `.github/workflows/android-build.yml` (FR-34)

Shape, copied from `windows-build.yml`: `on: push: tags: ['v*']` plus `workflow_dispatch`; `permissions: contents: read`; one job `android` on `ubuntu-24.04` (pinned, as the Windows job pins its image). Steps:

1. `actions/checkout@v6`; `actions/setup-node@v6` (`node-version: '20'`, npm cache on `frontend/package-lock.json`).
2. `actions/setup-java@v5` with `distribution: temurin`, `java-version: '17'`.
3. `android-actions/setup-android@v3`, then `sdkmanager "platforms;android-36" "build-tools;36.0.0" "platform-tools" "ndk;27.2.12479018"`; `echo "NDK_HOME=$ANDROID_HOME/ndk/27.2.12479018" >> $GITHUB_ENV`. (The CLI's `ensure_ndk` picks the highest NDK under `$ANDROID_HOME/ndk` itself; with one installed, that is the pin.)
4. `dtolnay/rust-toolchain@master` with `toolchain: 1.96.1` and `targets: aarch64-linux-android,armv7-linux-androideabi,x86_64-linux-android`; `Swatinem/rust-cache@v2` on `src-tauri`; `taiki-e/cache-cargo-install-action@v2` with `tool: tauri-cli@2.11.2` (a cached `cargo install --locked`, built from source on a cache miss).
5. `gradle/actions/setup-gradle@v4` with `gradle-version: 8.14.3`.
6. `npm --prefix frontend ci && npm --prefix frontend run build`, then `sh scripts/android/build-apk.sh`.
7. Collect: the one `app-universal-release-unsigned.apk` from `src-tauri/gen/android/app/build/outputs/apk/universal/release/`, copied to `dist-android/SnowRaven_<version>_android_universal_unsigned.apk` where `<version>` is read from `src-tauri/tauri.conf.json`; `actions/upload-artifact@v7` as `android-build` with `if-no-files-found: error`.

No secret is referenced and no signing happens (QA-34, NFR-07). The workflow's pins are read from `toolchain.env` where an action takes a value (steps 3, 4, 5) and `fdroidRecipe.test.ts` asserts the recipe's literals equal them.

### 6.2 The release machine (FR-35, FR-36, FR-38, NFR-07)

Credentials, mirroring the Apple mapping in the release skill (never in GitHub, never in the repository):

| What | Path | Env name read by the scripts |
|---|---|---|
| Signing keystore (PKCS12) | `~/.tauri/snowraven-android.p12` | `SNOWRAVEN_ANDROID_KEYSTORE` |
| Keystore and key passwords, alias | `~/.tauri/snowraven-android-keystore.properties` (`storeFile`, `storePassword`, `keyAlias`, `keyPassword`), mode 0600 | `SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES` |

The committed `app/build.gradle.kts` (The Engineer's block, read today) builds the `release` signing config from the properties file named by `SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES`, falling back to the gitignored `gen/android/keystore.properties`, and assigns it ONLY when `storeFile` is present; otherwise the release build is unsigned. This is how a local `cargo tauri android build` on the Mac produces a signed APK for an emulator check while CI, which has no file, produces an unsigned one. The committed block contains no literal password (the guard forbids `storePassword = "`).

`scripts/android/sign.sh <unsigned.apk> <out.apk>`: `zipalign -p 4` into a temp file, then `apksigner sign --ks "$SNOWRAVEN_ANDROID_KEYSTORE" --ks-pass file:<pass> --ks-key-alias <alias>` with apksigner's default scheme set (v1 to v3; v2 is what Android 7 verifies, so minSdk 24 needs nothing older), then `apksigner verify --print-certs`, printing the certificate SHA-256 so QA-38's constant-signer check is a diff against the previous release's recorded value in the run record. It never generates a keystore; a missing keystore or properties file stops with the user-performed step named.

`scripts/android/preflight.sh`: JDK 17 on `PATH`, `apksigner`/`zipalign`/`aapt2` from build-tools 36.0.0, `gradle --version` equal to the properties pin, `cargo tauri --version` equal to `TAURI_CLI_VERSION`, the keystore opens with its password (`keytool -list -storetype PKCS12`), the `gh run download` of `android-build` for the tag succeeded with exactly one APK, and the artifact version: `aapt2 dump badging <apk>` must report `versionName` equal to `tauri.conf.json`'s `version` and `versionCode` equal to `bundle.android.versionCode`, and `package: name='com.dtgibson.snowraven'`. Any failure stops before signing; nothing is attached (FR-36, QA-36, QA-58).

`scripts/android/attach.sh`: after the user's device check (section 8.3) and only then, `gh release upload v<version> SnowRaven_<version>_android_universal.apk` beside the macOS and Windows assets, as a separate step after `release.sh` rather than a change inside its preflight-build-notarize flow. The skill names the order: Windows CI green, Android CI green, `release.sh`, the Android sign and the device check, the Android attach, iOS. Until the attach, the signed APK is handed to the user from a GitHub release DRAFT asset or over the tailnet, never from a published asset (FR-44's "before the signed APK is published").

User-performed, one time, with exact steps in the runbook (OQ-03): `keytool -genkeypair -v -storetype PKCS12 -keystore ~/.tauri/snowraven-android.p12 -alias snowraven -keyalg RSA -keysize 4096 -validity 10000 -dname "CN=SnowRaven, O=Dave Gibson"`; the properties file beside it; `chmod 600` on both; a backup the user keeps, since losing the key closes the install-over path for every future GitHub APK. The run stops before signing until the user reports it in place.

F-Droid signs its own build with F-Droid's key. The two APKs are not interchangeable on one phone (an install over the other is refused as a signature mismatch); Help and the held policy edit say so, and reproducible builds, which would let F-Droid publish the user-signed APK, are the recorded reversal and out of scope (OQ-08).

### 6.3 The developer Mac (OQ-05), measured 2026-10-03 and being installed by The Engineer

| Tool | State at the measurement | Installed by the run |
|---|---|---|
| JDK | none | Temurin 17 (`brew install --cask temurin@17`) |
| Android SDK, `sdkmanager`, `adb`, `emulator`, NDK | none | the command-line tools, then `sdkmanager "platform-tools" "platforms;android-36" "build-tools;36.0.0" "ndk;27.2.12479018" "emulator" "system-images;android-24;google_apis;arm64-v8a" "system-images;android-36;google_apis;arm64-v8a" "system-images;android-36;default;arm64-v8a"` (the third image is section 4.6's de-Googled reading) |
| Rust Android targets | none; rustc 1.96.1 | `rustup target add` the three |
| `cargo-tauri` | none | `cargo install tauri-cli --version 2.11.2 --locked` (section 6.0) |
| Gradle | none on `PATH` | Gradle 8.14.3 on `PATH` (section 3.8) |
| `fdroidserver` | none (`fdroid` not found; no Python module) | `python3 -m venv ~/.fdroid-venv && ~/.fdroid-venv/bin/pip install fdroidserver` (PyPI; the Homebrew formula is the alternative if the venv route fails on macOS), with `~/.fdroid-venv/bin` on `PATH` for the tooling run in 6.5 |
| Leftovers | `~/.gradle` (dated 2026-08-12) and `~/.android/debug.keystore`: a Gradle run happened on this machine in August with no SDK present now; irrelevant to a release build | |

The three env exports in `~/.zprofile` (`JAVA_HOME`, `ANDROID_HOME`, `NDK_HOME`). On Apple silicon the emulator runs arm64 system images, so QA-54's "x86_64 emulator" reads as "the emulator's architecture, arm64 on this Mac" and the universal APK's x86_64 slice is exercised by CI's existence rather than an install; recorded as such.

### 6.4 Guards (FR-03, FR-06, FR-09, FR-10, FR-11, FR-22, FR-45, FR-57, FR-60, FR-62)

All pure JS, Linux-runnable, comments stripped before scanning, failing closed on an unrecognized shape, with guard-the-guard rows (the `iosSceneManifest.test.ts` shape; its `appleManifest.ts` readers get an `androidProject.ts` sibling under `frontend/src/test/` with a Kotlin-script comment stripper, a tiny XML tag reader, a PNG IHDR/IDAT reader and a flat YAML reader for the recipe). A guard that reads a gitignored per-run file (`app/tauri.properties`, `tauri.settings.gradle`) reads it only where it exists (CLAUDE.md, v1.0.12).

| File | Pins |
|---|---|
| `frontend/src/lib/androidProjectPins.test.ts` | `tauri.android.conf.json`: identifier `com.dtgibson.snowraven`, `minSdkVersion` 24, no `versionCode`, no `autoIncrementVersionCode: true`. `app/build.gradle.kts`: `namespace` and `applicationId` equal the identifier, `minSdk = 24`, `targetSdk = 36`, `compileSdk = 36`, the `usesCleartextTraffic` placeholder `"false"` in `defaultConfig` and `"true"` only inside the `debug` block, the signing block reads a properties file and carries no password literal, the `targetSdk` comment names neither Google nor Play. `AndroidManifest.xml`: the `uses-permission` set is exactly `{INTERNET}` when `ANDROID_LOCATION_BRANCH` is `'B'` and exactly `{INTERNET, ACCESS_COARSE_LOCATION, ACCESS_FINE_LOCATION}` when `'A'`, exactly one `<activity>`, no `leanback`, the cleartext placeholder present. `MainActivity.kt`: `package com.dtgibson.snowraven`, the `onWebViewCreate` override, the `srAndroid` listener name and its `http://tauri.localhost` allowlist. `BuildTask.kt`: `executable = """cargo"""` and args `"tauri", "android", "android-studio-script"`. `gradlew` equals the shim of 3.8; `gradlew.bat` and `gradle/wrapper/gradle-wrapper.jar` are absent from `git ls-files` and present in `.gitignore`; `gradle-wrapper.properties` names `gradle-8.14.3-bin.zip` and `toolchain.env`'s `GRADLE_VERSION` equals it. `capabilities/mobile.json`: `platforms` is `["iOS", "android"]` and `permissions` is exactly `["dialog:allow-open"]`; `capabilities/ios.json`: `platforms` is `["iOS"]` and its permissions are the three geolocation grants; `desktop.json` names no mobile platform; `default.json`'s five `fs` entries byte-equal a pinned literal; all four read `windows: ["main"]`. `tauri.conf.json` `identifier` is still `com.snowraven`. `Cargo.toml`: `tauri-plugin-geolocation` appears only inside the `cfg(target_os = "ios")` block; `lib.rs`: `tauri_plugin_geolocation::init()` appears only under `#[cfg(target_os = "ios")]`. Guard-the-guard: a scratch gradle string with `minSdk = 23` goes red; a commented-out permission is not counted; a manifest with two activities goes red; a `mobile.json` carrying a geolocation grant goes red |
| `frontend/src/lib/androidVersionSource.test.ts` | `bundle.android.versionCode` in `tauri.conf.json` equals `major * 1000000 + minor * 1000 + patch` of `version` in the same file; `version` equals `frontend/package.json`'s; `versionCode` and `versionName` in `app/build.gradle.kts` are the two `tauriProperties.getProperty(` reads and nothing else assigns them; neither the version string nor the version code literal appears in any committed file under `gen/android`; where the gitignored `app/tauri.properties` exists, its two values never lead `frontend/package.json` (the iOS "never leads" shape; it is absent in CI and the row is skipped there); the recipe's two `UpdateCheckData` regexes applied to the committed `tauri.conf.json` each match exactly once and yield the same two values; the recipe's tag regex matches `v1.0.49` and rejects `v1.0.49-rc1`. Guard-the-guard: a scratch config one patch ahead in `version` with the old code goes red; a code one off the formula goes red; a hand-set `versionCode = 1000049` in the gradle string goes red; an unrecognized `defaultConfig` shape fails closed |
| `frontend/src/lib/androidIcons.test.ts` | the dimension table of 3.5 for all fifteen PNGs under `src-tauri/icons/android/`, byte-equality with the fifteen under `gen/android/app/src/main/res/`, the adaptive XML names `@mipmap/ic_launcher_foreground` and `@color/ic_launcher_background`, the color is `#2D8653`, the two template drawable placeholders are absent, the foreground mark's opaque bounding box lies inside the 66/108 safe zone per bucket, and the staged (later the committed) `images/icon.png` is 512 by 512 with no alpha channel or no pixel below 255. Guard-the-guard: a scratch RGBA PNG with one transparent pixel goes red; a 49 by 49 hdpi goes red |
| `platform.test.ts`, `platformGates.test.ts` | QA-10 and QA-11 rows with `platform()` mocked to `'android'`, `'ios'`, `'macos'`, throwing, and not-Tauri; `showLocationControls()` false only for Android under `'B'`; no `navigator.userAgent` read in `platform.ts` outside `isWindows` |
| `frontend/src/lib/androidReachableCalls.test.ts` | an allowlist table of every `invoke('...')` and `plugin:*|*` literal in shipped `src/` (count per literal per module) with each row's Android reading: reachable (`get_timezone`, `plugin:opener|open_url`, the dialog, fs, os, clipboard and http plugin commands) or kept off Android by a named gate (`showICloudSync`, `alertsSupported`, `widgetsSupported`, `showUpdaterFooter`, `supportsAppRelaunch`, the `isIOS()` arm that owns the three geolocation commands, the desktop branch of `getCurrentLocation`); the test re-derives the literal set from source and fails on any literal or module not in the table, and asserts each named gate is false under the Android mock. The Rust half reads `lib.rs`'s `generate_handler!` and plugin registrations with their `cfg` attributes and asserts every "reachable" command is registered without an excluding cfg and that no geolocation registration lacks the iOS cfg. QA-22's mutation (a `get_location` call, or a `plugin:geolocation|...` call, in an Android-visible module) adds an unlisted row and goes red |
| `frontend/src/lib/androidLicense.test.ts` | `src-tauri/Cargo.toml` `license`, `frontend/package.json` `license`, `package.json` `license` and the recipe's `License` all read `AGPL-3.0-only`, and the root `LICENSE` file's title line reads `GNU AFFERO GENERAL PUBLIC LICENSE` with `Version 3`. Guard-the-guard: a scratch field reading `AGPL-3.0-or-later` goes red |
| `frontend/src/lib/fdroidRecipe.test.ts` | `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml` parses; `License`, `SourceCode`, `IssueTracker`, `Changelog`, `WebSite`, `Repo`, `RepoType: git`, `UpdateCheckMode: Tags ^v[0-9.]+$`, `AutoUpdateMode: Version`, `UpdateCheckData` as written in 6.5, `CurrentVersion` and `CurrentVersionCode` equal to `tauri.conf.json`'s pair; the first `Builds` entry's `versionName`, `versionCode` and `commit` agree with each other and the formula; its `sudo` literals (the Rust toolchain, the three targets, `tauri-cli --version`), its `ndk`, and its `prebuild`/`build` lines equal `toolchain.env` and the workflow's `run` lines (QA-34's diff); `scandelete` names `node_modules`, `frontend/node_modules` and `src-tauri/dmg/dmg-DS_Store`; `output` names the universal release unsigned APK path. Guard-the-guard: a recipe line with a different Rust version goes red |
| `frontend/src/lib/fastlaneMetadata.test.ts` (added in the same change that writes the folder, after the yes) | `fastlane/metadata/android/en-US/short_description.txt` is at most 80 characters, every `changelogs/*.txt` is at most 500, `changelogs/<current versionCode>.txt` exists, `title.txt` reads `SnowRaven`, `images/icon.png` passes the icon rows, and no file contains an em dash. Guard-the-guard: removing the current changelog in a scratch copy goes red |
| `importMechanism.test.ts`, `location.android.test.ts`, `launchSplash.test.ts` rows | the per-platform constant; both location branches (5.3); the three floor states and the no-store message |

The existing suites run unchanged with no Android exemption (QA-44); `entryChunk.test.ts` is re-read, not relaxed.

### 6.5 F-Droid: the recipe, the Fastlane folder, the local tooling run and the merge request (FR-53, FR-57 to FR-61, FR-63, OQ-16, OQ-17, OQ-19)

**What F-Droid's server does, read from fdroidserver `master`,** in the order `build.py` runs it: `sudo:` as root (`bash -e -u -o pipefail -x -c`, the lines joined with `; `, network available, then `sudo` is purged); the clone of `Repo` at `commit`; `init:`; `prebuild:` (joined with `; `, run in `subdir`, placeholders `$$SDK$$`, `$$NDK$$`, `$$VERSION$$`, `$$VERCODE$$`, `$$COMMIT$$` substituted); the deletion of `.gradle`, `build/{intermediates,outputs,...}`, `buildSrc/build`, `gradlew` and `gradlew.bat` in every directory holding a Gradle build file; the scanner over the WHOLE checkout, with `scandelete` paths removed and every other binary an error (an extensionless binary, a `.jar`, `.zip`, `.a`, `.so`, `.wasm` or `.aar`; a `package.json` or `Cargo.toml` with no lockfile in the same or a parent directory; a non-allowlisted `maven { url }`; a Gradle dependency matching the non-free patterns); the source tarball; `build:` (joined with `; `); then the build method (none here; `output:` names the APK); the debuggable check and a `versionCode` check of the APK against the entry. The environment for every step carries `ANDROID_HOME`, `ANDROID_SDK`, `ANDROID_SDK_ROOT`, `ANDROID_NDK`, `NDK`, `ANDROID_NDK_HOME` (not `NDK_HOME`; the Tauri CLI finds the NDK under `$ANDROID_HOME/ndk` itself), `PATH` with the NDK first, `JAVA<n>_HOME`, `SOURCE_DATE_EPOCH`. The buildserver is Debian trixie (`buildserver/Vagrantfile`, `makebuildserver`: `debian/trixie64`), whose archive carries `rustup` 1.27.1, `nodejs` 20.19.2 and `npm`, and `gradle` on its `PATH` is `gradlew-fdroid`.

What the scanner would find in this repository today, from `git ls-files`: no `.jar`, `.zip`, `.a`, `.so`, `.exe`, `.wasm` or `.aar`; every `package.json` and `Cargo.toml` has its lockfile beside it (the vendored tao's `Cargo.toml` has its own `Cargo.lock`); one extensionless binary, `src-tauri/dmg/dmg-DS_Store` (the macOS DMG layout file), which is `scandelete`d; `frontend/dist` after the Vite build holds `.js`, `.css`, `.pbf`, `.svg`, `.png`, `.json` and `.html`, none of which the scanner flags; `node_modules` after `npm ci` holds extensionless native binaries (`esbuild`) and is `scandelete`d after the frontend build. The scanner's "dependency file without lock" row and its Gradle-pattern rows are what make `fdroid scanner` worth running locally even though the plugin modules are reached only at build time.

**The recipe, `pipeline/android-release/fdroid/com.dtgibson.snowraven.yml`, as The Engineer commits it** (and as it is pasted into `fdroiddata/metadata/com.dtgibson.snowraven.yml` for the merge request; the first `Builds` entry names the first Android version, 1.0.49 if nothing ships before the deploy gate, and the Deployer substitutes the real one at the bump):

```yaml
Categories:
  - Science & Education
License: AGPL-3.0-only
AuthorName: Dave Gibson
WebSite: https://snowraven.dtgibson.com/
SourceCode: https://github.com/dtgibson/snowraven
IssueTracker: https://github.com/dtgibson/snowraven/issues
Changelog: https://github.com/dtgibson/snowraven/blob/main/CHANGELOG.md

AntiFeatures:
  NonFreeNet:
    en-US: Bird records, weather and tide data come from eBird, OpenWeather and NOAA, which are not free services; the app is unusable without an eBird key.

RepoType: git
Repo: https://github.com/dtgibson/snowraven.git

Builds:
  - versionName: 1.0.49
    versionCode: 1000049
    commit: v1.0.49
    timeout: 10800
    sudo:
      - apt-get update
      - apt-get install -y nodejs npm rustup build-essential pkg-config libssl-dev cmake
      - export RUSTUP_HOME=/opt/rustup CARGO_HOME=/opt/cargo
      - rustup toolchain install 1.96.1 --profile minimal --target aarch64-linux-android --target armv7-linux-androideabi --target x86_64-linux-android
      - cargo +1.96.1 install tauri-cli --version 2.11.2 --locked --root /opt/cargo
      - ln -s /opt/rustup/toolchains/1.96.1-x86_64-unknown-linux-gnu/bin/* /usr/local/bin/
      - ln -s /opt/cargo/bin/cargo-tauri /usr/local/bin/cargo-tauri
      - chmod -R a+rX /opt/rustup /opt/cargo
    ndk: r27c
    prebuild:
      - npm --prefix frontend ci
      - npm --prefix frontend run build
    scandelete:
      - node_modules
      - frontend/node_modules
      - src-tauri/dmg/dmg-DS_Store
    build:
      - sh scripts/android/build-apk.sh
    output: src-tauri/gen/android/app/build/outputs/apk/universal/release/app-universal-release-unsigned.apk

AutoUpdateMode: Version
UpdateCheckMode: Tags ^v[0-9.]+$
UpdateCheckData: src-tauri/tauri.conf.json|"versionCode":\s*(\d+)|.|"version":\s*"([\d.]+)"
CurrentVersion: 1.0.49
CurrentVersionCode: 1000049
```

Line by line, what each decision rests on:

- `Categories`: fdroiddata's `config/categories.yml` list; `Science & Education` for a citizen-science companion. `Navigation` is a defensible second; the user chooses (section 9).
- `License: AGPL-3.0-only`: the SPDX id all three repository fields already carry; `androidLicense.test.ts` holds them equal (FR-62).
- `AntiFeatures: NonFreeNet`: self-declared with the reason F-Droid asks for ("Reasons should be mentioned in the description"), rather than waiting for the reviewer to add it; the sentence is held copy (section 9) and also goes into `full_description.txt`.
- No `Name`, `Summary` or `Description` in the YAML: F-Droid reads them from the Fastlane folder at the tagged commit, and `fdroid lint` warns when both exist.
- `sudo:`: toolchain provisioning only, from Debian packages and the two registries the project already depends on: Debian's `rustup` fetches the pinned toolchain and the three Android targets from static.rust-lang.org (rustup's own channel, not a URL in the recipe), and `cargo install` builds the Tauri CLI from crates.io source. The toolchain and the CLI are installed under `/opt` and the REAL binaries (not rustup's proxies, which would look for a per-user `RUSTUP_HOME`) are linked into `/usr/local/bin`, so the unprivileged build user's `cargo`, `rustc` and `cargo-tauri` work with no environment. `build-essential pkg-config libssl-dev cmake` cover the Tauri CLI's native build dependencies conservatively; the merge-request pipeline trims the list if any is unused. No step downloads by its own URL (FR-53).
- `ndk: r27c`: installed by F-Droid if absent and exported as `ANDROID_NDK_HOME`. Known caveat, recorded: the Tauri CLI's `ensure_ndk` ignores that variable and picks the HIGHEST NDK under `$ANDROID_HOME/ndk` (`mobile/android/mod.rs:594-606`), so on a buildserver image that carries a newer NDK the build uses it; CI and the Mac have one NDK installed and so use the pin. If a newer NDK ever breaks the build on F-Droid, the fix is upstream (an `NDK_HOME` precedence in the CLI), not a recipe trick.
- `prebuild:`: the frontend only, so that `frontend/dist` exists for `generate_context!` at compile time; nothing of the app is compiled before the scan.
- `scandelete:`: the two `node_modules` (the Vite toolchain's native binaries, no longer needed once `dist` exists) and the one extensionless binary in the tree. Each path must exist at scan time or the scanner errors, which `node_modules` do after `prebuild`.
- `build:`: the shared script (6.0), which writes the `gradlew` shim F-Droid deleted and runs `cargo tauri android build`; `gradle` resolves to `gradlew-fdroid`, which reads 8.14.3 from the properties file.
- `output:`: the unsigned universal APK the CLI leaves in place; F-Droid checks its `versionCode` against the entry and that it is not debuggable, then signs it with F-Droid's key.
- `UpdateCheckMode: Tags ^v[0-9.]+$` and `AutoUpdateMode: Version`: every `vX.Y.Z` tag is examined, the version code read from `tauri.conf.json` at that tag, and a new `Builds` entry copied from the last one is committed by F-Droid's bot with `commit:` set to the tag. `UpdateCheckData`'s field order is code location, code regex, name location, name regex (the F-Droid reference), and `.` reuses the code location for the name; neither regex may contain `|`.
- `timeout: 10800`: three hours for the from-source Tauri CLI plus the LTO release build of three ABIs; honored in server mode only.

**The Fastlane layout (OQ-19): `fastlane/metadata/android/en-US/`** at the repository root, F-Droid's documented default and the one its `update` reads first, so that a future tool (or a human) looking for app-store metadata finds it where every Android project keeps it; `metadata/en-US/` is not used. Contents: `title.txt` (`SnowRaven`), `short_description.txt` (at most 80 characters), `full_description.txt` (plain text or the HTML subset F-Droid renders; derived from the website register and the privacy policy's words; carries the no-Google sentence only after FR-54 is verified, and the `NonFreeNet` reason), `changelogs/1000049.txt` (at most 500 characters; the approved sentences with Apple-only lines dropped; one file per release from this one on, named by the version code), `images/icon.png` (section 3.5), `images/phoneScreenshots/01.png ...` and `images/sevenInchScreenshots/` or `images/tenInchScreenshots/` (captured from the synthetic demo data on the API 36 phone and tablet emulators). The exact content is staged under `pipeline/android-release/fdroid/fastlane-proposal/en-US/` and shown rendered; on the user's yes the folder is moved to its root location in the same commit that adds `fastlaneMetadata.test.ts`. The yes must land before the tag, because F-Droid reads the folder at the tagged commit; a listing with no folder at the tag shows no description until the next tag.

**The local tooling run (FR-63, QA-65, QA-67, QA-70),** on the Mac, in a scratch clone of fdroiddata with the recipe at `metadata/com.dtgibson.snowraven.yml` and a `config.yml` naming `sdk_path`, `ndk_paths: {r27c: <ANDROID_HOME>/ndk/27.2.12479018}` and `java_paths`:

1. `fdroid lint com.dtgibson.snowraven`: no finding (QA-65).
2. `fdroid checkupdates --allow-dirty --auto com.dtgibson.snowraven`, against the repository once the first tag exists (before the tag, against a scratch tag on the local clone with `Repo` pointed at the worktree path): it must report the tag's version and code (QA-67).
3. `fdroid build -v -l com.dtgibson.snowraven` (local mode, no VM): it clones `Repo` at `commit` (before the tag: a copy of the YAML with `Repo` set to the local worktree path and `commit` to the branch head), runs `prebuild`, the scanner with `scandelete`, `build`, and names the output. In local mode `sudo:` is SKIPPED (`build.py` runs it only `onserver`), so this run proves `prebuild`, the scanner and `build` on the Mac's own toolchain, not the Debian provisioning. The APK it produces is installed on the API 36 emulator and opened to the first usable screen (screenshot, QA-70).
4. `fdroid scanner com.dtgibson.snowraven` on the same clone, which is step 3's scan run on its own (QA-70), kept because its output is the artifact the run record keeps.

**The honest limits, written as FR-63 asks.** `fdroid build --server` (the real buildserver VM) is not feasible on this Mac: the box is `debian/trixie64` for VirtualBox or libvirt on x86_64, and this is an Apple-silicon host. So the `sudo:` block (Debian package names, the `rustup` and `cargo install` lines, the symlinks) is verified ONLY by the fdroiddata merge request's own GitLab CI, which runs `fdroid build` in the buildserver image for every new or changed recipe. The written checklist that stands in for the local server run is the step list above with step 3's "sudo skipped" named; if the MR pipeline fails on a `sudo:` line, the fix is a recipe edit in the MR, not a repository change, and does not block the GitHub APK.

**The merge request (FR-59, OQ-16).** `pipeline/android-release/fdroid/merge-request.md` carries, for the user to perform under their own GitLab account: fork `fdroid/fdroiddata`, branch `com.dtgibson.snowraven`, add `metadata/com.dtgibson.snowraven.yml` byte-identical to the committed recipe, commit `New app: SnowRaven (com.dtgibson.snowraven)`, open the MR with the standard new-app checklist filled in and the three points a reviewer will ask about stated up front (the Rust toolchain installed under `/opt` because the Tauri Gradle plugin re-enters the CLI from Gradle; the `scandelete` of `node_modules` after the frontend build; `NonFreeNet` self-declared). The run prepares the branch and the text; the user pushes and opens it. Whether it is opened at the first ship or deliberately deferred is written in the CLAUDE.md Android line and in `decisions.md`, with the reason (FR-40, QA-66). Review takes weeks and is outside the run's control; the first release's Android availability on the day of the ship is the GitHub APK.

---

## 7. Network and privacy declarations (the section 7 pattern)

### 7.1 Requests

The Android app makes the same device-to-provider requests as the iOS app and no others: eBird, OpenWeather, Nominatim, NOAA, the four tile hosts and the Cornell Lab sites, each at the user's request, through the same `transport.ts` chokepoint, the same `CACHED_GET_PATHS` and `EBIRD_GATED_PATHS`, the same `ebirdGate` state. No update check and no `github.com` request (section 2.3). No request to any Google host: no Google library is linked (section 4.4), and the build is verified by the merged dependency tree and `fdroid scanner` (FR-54), a property that holds whatever the store. No new host, no new endpoint, no request moved between components (the durable form, `security.md` v1.0.20). `http:allow-fetch` stays `https://**`; the release build forbids cleartext.

Location, per branch: under B the app never asks for a position on Android. Under A the request is to the Android System WebView's geolocation, which asks the phone's own location service through `LocationManager` (section 4.6); whatever that service does to produce a fix (a GPS fix, or on a phone with Google Play services a network fix from Google's system component) is the operating system's, as CoreLocation's is on iOS, and the held policy edit says so in those terms. QA-52's capture during a fix is the evidence that the app itself sent nothing to a Google host.

### 7.2 Permissions

| Permission | Why | Declared by | Branch |
|---|---|---|---|
| `INTERNET` | the provider requests above | the template manifest | both |
| `ACCESS_COARSE_LOCATION`, `ACCESS_FINE_LOCATION` | the WebView's geolocation prompt, which wry's chrome client serves by requesting both at runtime; when-in-use only, requested on first use, never in the background | the app manifest, explicitly (no plugin manifest merges them in any longer) | A only |

Nothing else: no background location, storage, media, camera or notification permission, and the merged manifest is checked for exactly the branch's set (QA-24). The document picker is Storage Access Framework and needs none.

### 7.3 Scans over user content

None added. The import path reads a picked file through the same `refuseByFilename` / `refuseByContent` / `firstLine` registry with the same bounds; the WebView floor probe reads no user data; the inset injection reads no user data; the theme channel accepts exactly two fixed strings. No new regex, no new loop over a column.

### 7.4 Device backup (OQ-09, NFR-08), facts for the held proposal

Android's default full-backup agent includes the app's private data directory minus `cache/`, `code_cache/`, `no_backup/` and `lib/` (AOSP `BackupAgent.onFullBackup`); SnowRaven's `data/` subtree, keys file included, sits inside that default, as the iOS device backup includes the iOS keys file. Two facts shape the policy sentence: cloud Auto Backup, where the phone has a backup account at all (a phone without Google services typically has none, and an F-Droid user may well have turned it off), is subject to a documented per-app quota of 25 MB, and an app whose data exceeds it is skipped whole, so a birder with a real eBird export (tens of megabytes) typically has NOTHING of SnowRaven's in a cloud backup, while a device-to-device transfer (Android 12 and later) has no such quota. If the user chooses to exclude the keys file at the Designer gate, the edit is: `res/xml/backup_rules.xml` (`<full-backup-content><exclude domain="root" path="data/api-keys.json"/></full-backup-content>`, referenced by `android:fullBackupContent`) for API 24 to 30, and `res/xml/data_extraction_rules.xml` with the same exclusion under both `<cloud-backup>` and `<device-transfer>`, referenced by `android:dataExtractionRules`, for API 31 and later; the guard then pins both. Default per the PRD: platform default, no edit, stated plainly. QA-25 and QA-59 verify the private-storage and uninstall facts on the emulator; the backup behavior is stated from the platform's documentation, not measured, and the proposal says so.

### 7.5 Privacy facts for the held policy edits and the listing (facts, not copy)

For `pipeline/android-release/held-copy.md`, derived line by line from `PRIVACY_POLICY.md` by the Engineer and Deployer, each verified before it is written:

- **No Google services.** The Android build contains no Google Play services, no Firebase, no Play Integrity, no Google analytics, advertising or crash-reporting library (the merged tree of section 4.4; the only Google-authored artifact is the Material Components UI library, Apache-2.0). Stated as a property of the build, verified by the dependency tree and `fdroid scanner`, and true of the GitHub APK and the F-Droid build alike because they are built from the same commit with the same recipe.
- **Where its data lives.** The app's private storage under `/data/user/0/com.dtgibson.snowraven/`, readable by no other app, needing no permission, removed on uninstall; Android's own device backup includes it under the platform default (7.4) unless the user chose the exclusion.
- **Updates.** An F-Droid install updates through the F-Droid client; a GitHub APK install updates by downloading the next release's APK and installing it over the old one; the Android app makes no update check of its own and never contacts GitHub. The two are signed by different keys and do not install over each other; switching means uninstalling first, which deletes the stored files and keys (Help carries the keep-the-exports sentence).
- **Location.** Under B: the Android app never requests your location. Under A: the app asks Android for your location through the Android System WebView, which uses the phone's own location service; SnowRaven contains no location library, and a position is used only for the lookup you asked for (the existing paragraph's uses).
- **Signing.** F-Droid builds the app from the published source on its own servers and signs it with F-Droid's key; the GitHub APK is signed by the developer's key.
- **The `NonFreeNet` reading.** The listing may carry F-Droid's `NonFreeNet` anti-feature because the app's data comes from eBird, OpenWeather and NOAA, which are not free services; this is accepted and stated in the listing's description, not argued.

---

## 8. Verification plan handed to The Tester

### 8.1 Automated (every build, CI)

The guards in 6.4; the full frontend and backend suites with no Android exemption; `entryChunk.test.ts`; the Help TOC parity test after FR-51; the copy scan of every held proposal for em dashes and British spellings (QA-51). The Android CI job itself is exercised by pushing the tag; before that, `workflow_dispatch` on the branch proves the job builds (the Windows job has the same manual trigger), and that dispatch's APK is the one the local `fdroid build` output is compared against for the same inputs (not byte-identical, which is out of scope, but the same version name, code, package and ABI set).

### 8.2 Emulator matrix (release-profile build, never debug)

| Image | Purpose | What is recorded |
|---|---|---|
| `system-images;android-24;google_apis;arm64-v8a` (API 24, the floor), as shipped | FR-43 first half: the image's WebView is Chromium 51-era, below 111 | the WebView version from `adb shell dumpsys package com.google.android.webview`, a screenshot of the FR-33 message (QA-33, QA-42) |
| the same image with Android System WebView updated to the floor or above | FR-43 second half: the last WebView for Android 7 is 119 | the installed version and a screenshot of the first usable screen. The update path is `adb install` of a Google-signed WebView APK (the image's preinstalled provider is Google-signed, so a release-signed update installs over it); where that APK comes from is a trust question for the user (section 9), and if no acceptable source exists this half is recorded **Partial**, not passed |
| `system-images;android-36;google_apis;arm64-v8a` (current API) | every functional check; the FR-55 switch run (4.6); the exact bytes later attached | QA-41's checksum equality between the installed APK and the GitHub asset; QA-14, 15, 16, 17 (branch A only; the step table of 4.6), 19 and 20 (both orientations, a cutout emulated with the developer option), 25, 26 to 30 (import, cancel, the two refusals, an unreadable pick, the change signal), 31 and 32 (a frame sequence from icon tap, light and dark), 52 (a network capture across launch and the five surfaces, plus a location fix under A: hosts a subset of the iOS set, no `github.com`, no Google host), 55 (largest system font), 59 (uninstall and reinstall), 63 (branch B only: no location control on six tabs) |
| `system-images;android-36;default;arm64-v8a` (current API, AOSP, no Google APIs, the AOSP WebView) | the de-Googled reading of the FR-55 table (4.6), and one open-and-load pass of the first usable screen | the WebView package and version; the step table; a screenshot of the first usable screen |
| the API 36 image at 10-inch tablet size | QA-19 tablet width, the tablet screenshot set for the Fastlane folder | screenshots |

Every check is a screenshot or a captured value, never a process check (the 1.0.31 rule). The release-signed build for the emulator comes from a local `cargo tauri android build` with the signing block active (the user's key once it exists; the throwaway key for the FR-55 measurement, recorded as such); the attached bytes are CI's unsigned artifact signed by `sign.sh`, and QA-41 compares the APK checksum of what the current-API emulator opened against the asset, which means the current-API opening check is repeated on the signed CI artifact before the attach.

### 8.3 The user-performed device check (FR-44), as the Deployer hands it over

Agents never touch the device (CLAUDE.md, the device boundary). The signed APK is handed over as a GitHub release DRAFT asset or a tailnet link, never from a published asset. The list, verbatim for the user:

1. On your Android phone, open the link we send and download `SnowRaven_<version>_android_universal.apk`. When you open the downloaded file, Android will say the phone is not allowed to install unknown apps from this source and offer Settings; allow it for your browser or Files app (a one-time switch), come back, and press Install. Tell us if you saw anything other than that prompt and an Install button.
2. Open SnowRaven. Tell us what you see first: green with the raven mark, then the app; or a message about Android System WebView; or anything else, in your words.
3. Go to Settings, Default Files. Press Import on the eBird row and pick your eBird backup CSV; then Import on the ML row and pick your Macaulay export. Tell us whether each row now shows the filename and date.
4. Enter your eBird and OpenWeather keys in Settings.
5. Open Weather, pick a recent checklist, and tell us whether the weather and tide text appears.
6. Open Species Detail, search for a species, and tell us whether the page fills in.
7. Open Statistics and tell us whether the totals appear.
8. Open Map Explorer and tell us whether the map and hotspots appear. (Branch A only, added by the Deployer when it applies: press the location button, allow location when asked, and tell us whether the map moves to you.)
9. Open Targets and tell us whether a county and its list appear.
10. Reply with the result of each step in one line. If anything looked wrong, a screenshot helps, but your sentence is enough.

Recorded as the user's reported result per surface, timed before the APK is attached to the published release; with no device, Partial and the publication decision in writing (OQ-04).

### 8.4 F-Droid readiness checklist (FR-58 to FR-63, before the tag)

1. `androidLicense.test.ts`, `fdroidRecipe.test.ts` and (after the yes) `fastlaneMetadata.test.ts` green.
2. `git ls-files src-tauri/gen/android` lists no `.jar`, `.so`, `.aar` or other compiled artifact (QA-60, QA-68).
3. The local `fdroid lint` and `fdroid scanner` outputs with no finding, and the local `fdroid build -l` APK's launch screenshot on the API 36 emulator, in the run record (QA-65, QA-70); the "sudo skipped locally" sentence beside them.
4. The merged release dependency tree in the run record with every `com.google.*` coordinate listed and justified (QA-53, QA-61).
5. The Fastlane folder written at the root on the user's yes, before the tag, with `changelogs/<versionCode>.txt` for the shipping version.
6. `bundle.android.versionCode` moved with `version` at the bump (the guard goes red otherwise).
7. After the tag: `fdroid checkupdates` against the real repository reports the tag (QA-67).
8. The merge request opened, or its deferral written, in the CLAUDE.md Android line and `decisions.md` (QA-66).

---

## 9. Open questions carried forward

| # | Question | Default from the PRD | New from this stage |
|---|---|---|---|
| OQ-01 | `com.dtgibson.snowraven` permanent? | yes, resolved | Set in `tauri.android.conf.json` (3.2) |
| OQ-03 | Signing keystore exists? | no; user-performed generation | Exact command, PKCS12, in 6.2; the properties file and env names are fixed there; the run stops before signing until it exists |
| OQ-04 | Android device for FR-44? | none assumed; Partial | The step list is 8.3, with the unknown-sources prompt as step 1 |
| OQ-05 | SDK, NDK, JDK, emulator, fdroidserver on this Mac? | not assumed | Measured: none at the start; the install list is 6.3 (the AOSP image and `cargo-tauri` added); The Engineer is installing |
| OQ-06 | WebView floor | 111 | Confirmed 111 (5.6); the message names no store |
| OQ-07 | Target API | read on the day | 36, read 2026-10-03; F-Droid imposes none; the committed comment is reworded away from Play |
| OQ-08 | Which key signs the APK; the install boundary | the user's key; F-Droid's own; Help and policy say so | Confirmed as a fact of the two signers (6.2) |
| OQ-09 | Default backup behavior? | platform default, stated plainly | The 25 MB quota fact, the no-backup-account fact and the exact exclusion edit are in 7.4 for the user's choice |
| OQ-10 | Back button | platform default | Measured in code: background from every screen; nothing in the webview closes on back (5.5). Follow-up idea: a `plugin:app|back-button` listener closing Search, Help, the More sheet and popups |
| OQ-11 | Do all crates build for Android? | build first, report | The arm64 release build has succeeded in the tree (4.2); the three-target build is the remaining proof, with the stop condition |
| OQ-12 | Import mechanism | measured, input first | wry implements `onShowFileChooser`, so `input` is the expectation (5.4) |
| OQ-13 | Edge-to-edge puts content under the bars? | decided by The Designer | Yes by construction; option (b) chosen and implemented in `MainActivity.kt` (5.5) |
| OQ-15 | Version number | next patch at the deploy gate | 1.0.49 if nothing ships first; Android version code 1000049, written in `tauri.conf.json` at the bump |
| OQ-16 | Who submits the fdroiddata MR? | prepared by the build, submitted by the user | `merge-request.md` carries the branch, the commit and the text (6.5); the `sudo:` block is verifiable only by that MR's pipeline, which is written down as the limit |
| OQ-17 | Wrapper jar committed? | dropped unless accepted by checksum | **Dropped.** The scanner deletes it without a checksum and F-Droid deletes `gradlew` itself; `gradlew` is a shim and 8.14.3 is pinned in the properties file (3.8) |
| OQ-18 | Does the WebView's own geolocation work without Google code? | branch B until measured | On paper, yes: wry's chrome client already requests the permission and grants the prompt, and Chromium's WebView provider is the platform `LocationManager` (4.6). The measurement table, its pass condition and the Android call (`enableHighAccuracy: true`) are fixed; branch B stands until the recording exists |
| OQ-19 | Fastlane layout | `fastlane/metadata/android/en-US/` | Confirmed; the staging folder and the yes-before-the-tag rule are in 6.5 |
| new | **Categories for the F-Droid listing** | `Science & Education` | Published listing data; the user may add `Navigation` (the Map Explorer) or replace it; flagged with the held copy |
| new | **`NonFreeNet` self-declared, with its one-sentence reason** | expect it, do not argue it | The reason sentence in the recipe and in `full_description.txt` is held copy for the user's yes; declaring it ourselves is the honest default and the user may prefer to leave it to the reviewer |
| new | **The FR-33 message in the design-spec names Google Play** | the message names no store | One sentence for The Designer's revision; the guard will refuse "Google" and "Play" in it |
| new | **The Tauri CLI chooses the newest NDK under `$ANDROID_HOME/ndk`** | pin r27c | Holds on CI and the Mac (one NDK); advisory on F-Droid's image; recorded, not fixable in this run |
| new | **`fdroid build --server` is not feasible on an Apple-silicon Mac** | checklist stands in | The `sudo:` block is proved only by the fdroiddata MR pipeline; a failure there is a recipe edit, not a release blocker |
| new | **The `--config '{"build":{"beforeBuildCommand":null}}'` removal** | one measurement | If `null` does not delete the key under the CLI's merge, `""` is the fallback; measured once on the Mac |
| new | **Approximate location under branch A** | one Help sentence | Step 4 of the measurement decides whether Approximate yields a usable position or the generic sentence |
| new | **A phone with no network location provider under branch A** | one Help sentence, or nothing | The AOSP-image run decides; a failure there is a flag, not a return to branch B |
| new | Where does a Google-signed WebView APK for the API 24 at-floor half come from? | Partial if no acceptable source | The user decides whether a mirror download is acceptable for an emulator check |
| new | The hdpi launcher icons are 49 px | regenerate that bucket | Done by the Engineer; the guard pins it |
| new | **Rust pinned at 1.96.1 in the recipe and the Android CI job** | the release machine's rustc at the first ship | The Windows job builds on `stable`; the Android job pins so the recipe and CI run the same compiler. A `rust-toolchain.toml` would pin desktop builds too and is not added in this run |
