# Decisions: Android Release

Running log for the feature. Each entry names the stage, what was decided, why, and what would reverse it.

## Stage 4, The Designer (2026-10-03)

### Design system: unchanged, designed within

No new token, pattern, type or motion. The Android app is the shipped frontend in the established system; the stage designed the native surface around it (launch, insets, Settings composition, location copy, tablet reading). `pipeline/design-system.md` is not edited.

### Lint note, justified rather than fixed: the display face

The Weft doctrine's mechanical lint flags Inter and `system-ui` as display faces. The mockup renders in the app's own `--font-sans` (`'Inter', system-ui, 'Segoe UI', Roboto, sans-serif`) on purpose: the doctrine states that `design-system.md` wins on specifics, and the design system records this stack. `weft-design-lint check` reported the file clean (the stack sits in a custom property), so no warn was suppressed; this note exists so a reader of the doctrine's font rule sees the choice was deliberate. On an Android device the stack resolves to Roboto; no font is bundled, and introducing a face for Android alone would be the drift the design system exists to prevent.

### Status and navigation bar glyph color follows the PAINTED in-app theme (decided at the Stage 4 review, 2026-10-03)

- **Decision:** the webview reports the painted theme to native and a listener in the generated `MainActivity.kt` sets the status and navigation bar icon appearance to match: light icons on a dark in-app theme, dark icons on a light one, on first paint, on every Appearance change, and on a system flip while the app is open in the System setting. The channel is `WebViewCompat.addWebMessageListener` on the `srAndroid` name with the origin allowlist `http://tauri.localhost`, registered in the same `onWebViewCreate` override that installs the insets listener; the page sends `light` or `dark` from `applyTheme()`.
- **Why:** the first draft recorded this as an accepted gap on the reading that a page-to-native channel was Kotlin feature work the brief rules out. The user decided otherwise at the review, and the reading is corrected here explicitly: the Appearance setting makes a forced theme a normal path that any user can take in two taps, so mismatched glyphs over the app's own strip would be a shipped defect on an ordinary path, not an edge case; and `MainActivity.kt` is already edited in this run for the inset injection, so one more registration in the same override is plumbing in a file the project already owns, and the no-Kotlin-feature-work line is not crossed in spirit (no new screen, flow or capability; one message, two setter calls).
- **Platform floors:** status bar icon appearance is API 23 and later, so it follows the theme on every supported version (minSdk 24). Navigation bar icon appearance is API 26 and later; on API 24 and 25 the compat setter is a no-op and `enableEdgeToEdge()` keeps its dark scrim with light glyphs behind the three-button bar, which is accepted and screenshotted (design-spec measurement 6).
- **Fallback:** before the first report, and on a WebView below the floor where no report is sent, the `values-night` resource default stands, which matches the page's own default of following the system theme.
- **Side effect worth naming:** the app today has no `prefers-color-scheme` change listener on any platform, so System does not follow a live flip until the next `applyTheme`. The listener this decision adds in `App.tsx` corrects that everywhere; the Engineer may keep it platform-wide.
- **Reversal:** a WebView floor at which Chromium itself paints the bars from the page's `color-scheme` would make the listener redundant; that is not a property of any current WebView.

### Keyboard inset handled natively, system bars handled as CSS variables

- **Decision:** `ime()` pads the webview view itself; `systemBars() | displayCutout()` are injected as `--sr-inset-*`.
- **Why:** the bars are decoration the app should paint under in its own theme (the iOS look); the keyboard is an occluder the app must never paint under, and Chromium only scrolls a focused field into view when its viewport actually changes. Treating both the same way (all variables) would leave a focused field under the keys with no auto-scroll; treating both natively (all padding) would paint the bar bands in a fixed theme color that cannot follow the in-app toggle.
- **Reversal:** a WebView floor at or above Chromium 140, where `env()` and the virtual keyboard API are reported in all views; at that point the iOS rules could be re-gated instead of twinned. The floor is 111, so not in this run.

### Launch is theme-identical green

- **Decision:** the splash, the window background and the launch frame are `#2D8653` in light and dark alike.
- **Why:** it is the launch color on every other platform, it is not a light color (FR-32 is satisfied without a night variant), and a dark-only variant would make the first frame the one place the brand green is not the brand green.
- **Reversal:** a user request for a dark launch; the change is one `values-night` color and a second layer-list.

### No pre-prompt before the location dialog

- **Decision:** the system dialog on the first press; no in-app sheet before it.
- **Why:** the control the birder pressed is the rationale, the house avoids modals outside the stage gates and destructive confirmations, and Android's dialog already names the app and offers Precise / Approximate. iPhone behaves the same way.
- **Reversal:** F-Droid's inclusion policy requiring an in-app disclosure before the prompt for this permission class; it does not today. (This entry applies to location branch A only; see the Stage 4 revision below.)

### Tablet gets the wide layout, no tablet-specific reading

- **Decision:** the existing measured-width nav rule decides density; insets are the body and nav-column variables.
- **Why:** this is what iPad gets and what the 640px content floor was designed for; a tablet-specific layout would be a second thing to keep in step with no measured need.
- **Reversal:** a measurement at 800px portrait showing the icon rail plus a 740px content column failing a specific tab.

### System font scale honored, not disabled

- **Decision:** the WebView's default text zoom (the system font scale) stays on, multiplying the in-app Text Size.
- **Why:** it is the platform's accessibility setting; disabling it to keep one scale would be the app overriding the user. NFR-04's largest-font screenshot is the measurement that this composes acceptably.
- **Reversal:** that screenshot showing rem-sized boxes not following the zoom in a way the in-app scale does not already handle; the Engineer reports before changing `textZoom`.

## Stage 5, The Engineer (2026-10-03)

### Direction change received mid-stage: Google Play out, F-Droid in

- **What happened:** the coordinator relayed the user's decision that SnowRaven will not be distributed through Google Play; the store leg becomes F-Droid, which builds from source, forbids non-free dependencies and reads Fastlane-style metadata from the repository. The brief, PRD and schema are being revised.
- **What this stage did about it:** no Play-specific work had been written when the direction arrived, so nothing was moved to `superseded/`. Not started, by direction: `play-upload.mjs`, Play Console and Play App Signing steps, the internal-track recipe, the Play listing, the Data safety form, the content rating, and the whole of `held-copy.md` (every held surface named a store or depended on one). Held: the Android location path. Continued: everything store-independent.
- **The Android location path is on hold, with an interim guard.** `tauri-plugin-geolocation` 2.3.2's Android module depends on `com.google.android.gms:play-services-location:21.3.0` (its `android/build.gradle.kts`), which F-Droid will not accept. Left alone, Android would have fallen through `getCurrentLocation()` to `invoke('get_location')`, a command registered only on macOS and Windows (FR-22). So `lib/location.ts` returns `{ code: 'unavailable', platform: 'tauri' }` on `isAndroid()` before either the desktop branch or the plugin, and every location control on Android shows the existing generic sentence. The plugin's registration (`cfg(mobile)`), its capability grants and its two manifest permissions are unchanged, as directed. Not written: the Android denied sentence (FR-18), the ten-second race, the `disabled` error-string mapping, and the Help location sentences. **Reversal:** the revised schema's decision (a Google-free mechanism, or hiding location on Android in v1); with the plugin dropped, the manifest pin, `capabilities/mobile.json` and the reachable-calls table change with it.
- **The license is declared.** The repository carries the AGPL v3 text in `LICENSE`, which satisfies F-Droid's licence requirement, but `src-tauri/Cargo.toml` said `license = ""` and neither `package.json` named one. All three now say `AGPL-3.0-only` (and both lockfile roots). "only" rather than "or-later" because nothing in the repository grants a later-version option; it is one word if the owner wants "or-later".
- **Findings for the F-Droid revision, measured here:** (1) the Gradle build is not Gradle alone: `settings.gradle` applies a CLI-generated `tauri.settings.gradle` that points at the plugins' Android modules inside the Cargo registry (`~/.cargo/registry/src/.../tauri-plugin-*/android`), and Gradle's Rust task runs `npm run -- tauri android android-studio-script`, so a from-source recipe needs cargo (with crates fetched), Node and the Tauri CLI; (2) the merged release manifest carries Google Play services' `com.google.android.gms.common.api.GoogleApiActivity` (from the geolocation plugin's dependency) as a second activity; (3) the committed project contains `gradle/wrapper/gradle-wrapper.jar`, the standard wrapper binary F-Droid's scanner checks against known checksums; (4) Material Components (`com.google.android.material`, Apache-2.0, not a Play service) is linked by the Tauri template and every plugin; (5) the merged manifest also declares androidx.core's signature-level `DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, a library-defined permission no user is asked for.

### BLOCKER: the locked Tauri 2.11.2 Android runtime does not launch on API 24 or 25

- **Measured:** the release-signed APK installs on the API 24 emulator and crashes at launch, every time: `java.lang.NoClassDefFoundError: Failed resolution of: Ljava/lang/BootstrapMethodError;` from `com.fasterxml.jackson.databind.util.ExceptionUtil.isFatal`, reached from `JacksonAnnotationIntrospector.<clinit>`, reached from `app.tauri.plugin.PluginManager.<clinit>` in `TauriActivity.onCreate` (frames de-obfuscated with the build's R8 mapping). The API 30 and API 36 emulators launch the identical APK.
- **Cause, read from the bytecode:** Tauri 2.11.2's Android library (`tauri-2.11.2/mobile/android/build.gradle.kts`) pins `com.fasterxml.jackson.core:jackson-databind:2.15.3`. Its `ExceptionUtil.isFatal` does `instanceof java.lang.BootstrapMethodError` (read with `javap`), a class Android only has from API 26, and `JacksonAnnotationIntrospector`'s static initializer reaches it on every Android device, because its Java 7 helper always fails to load there and the catch calls `rethrowIfFatal`. R8 is not the cause: it outlined the reference, and the unminified bytecode carries the same `instanceof`.
- **Not done, by the stage's rules:** no change to the approved floor (FR-07, minSdk 24) and no override of a locked dependency. Both remedies are the user's: (A) raise minSdk to 26 (Android 8.0), the smallest change, which the API 30 and 36 runs support; or (B) force an older `jackson-databind` through a Gradle dependency constraint, which changes a dependency Tauri chose and would need its own build and API 24 launch check. The `minSdk 24` pins (overlay, Gradle, the guards) stay until the decision.
- **Consequence for FR-43:** the API 24 half cannot show the WebView floor message, because the native runtime crashes before the WebView exists. The FR-33 message itself is verified on the API 30 image, whose stock WebView is Chromium 91 (below the 111 floor).
- **Decided: minSdk 26, by the user, 2026-10-03 (remedy A).** Tauri's Jackson is not overridden. The measured cause above is the reason, and it is recorded here so The Chronicler can carry it to CLAUDE.md: Tauri 2.11.2's Android runtime cannot launch below API 26 because jackson-databind 2.15.3's `ExceptionUtil.isFatal` references `java.lang.BootstrapMethodError`, which a static initializer reaches on every Android device; Tauri's documented minimum of 24 does not hold for this locked stack. Applied in `tauri.android.conf.json`, `app/build.gradle.kts` (with the reason as a comment), the guards that pin both, the launch-state resource comments (the layer-list window background now spans API 26 to 30), `MainActivity.kt`'s comment (navigation bar glyph appearance now applies on every supported version, so the API 24 and 25 scrim exception is gone), `webviewFloor.ts`'s audit note, toolchain.md (the API 26 image replaces API 24 as the floor image), the CHANGELOG, Help, the release skill, the recipe and the held copy. The WebView floor stays Chromium 111; its below-floor emulator half moves to the API 26 image.

### Implementation decisions that sharpen the spec

- **The vendored tao builds for Android unchanged (schema 4.2's named first step).** `cargo build --release --target aarch64-linux-android --lib` with NDK 27.2.12479018: tao 0.35.3 (vendored), wry 0.55.1 and every plugin compiled in 1m 12s; one upstream dead-code warning in tao's `window.rs`. Stop condition not met. The full Gradle build later compiled the same for arm64; CI builds all four targets.
- **`tauri android init` changed nothing outside `gen/android`.** 2,531 tracked and untracked files hashed before and after (content, not the changed-file list), and `gen/apple` diffed against a kept copy: identical. The procedure is in the release skill's Android section.
- **Mechanism A measured (OQ-12): the file input presents the system document picker** on the API 36 emulator (DocumentsUI's "Recent", with Drive under "Browse files in other apps"), and backing out changes nothing on the row (no error line, no announcement). `ANDROID_IMPORT_MECHANISM = 'input'`. A full import, the two refusals and an unreadable pick were not driven on the emulator in this stage; they stay on the Tester's matrix.
- **The keyboard pads the webview's HOST, not the webview.** A `WebView` does not shrink its viewport for its own padding, so `MainActivity.kt` pads the webview's parent (the content `FrameLayout`) by the `ime()` inset, and sets `--sr-inset-bottom` to 0 while the keyboard is up (the webview then ends at the keyboard's top edge, so nothing of the navigation bar lies under it). Measured: the focused Latitude field and the checklist field scroll into view above the keys, the phone bar slides out, and it returns when the keyboard closes.
- **The inset script is re-sent when the page announces itself.** A script evaluated before the document exists is lost, and the inset listener's first callback can precede the first document. The page's first theme report (sent by `main.tsx` before React mounts) makes `MainActivity` re-evaluate the last inset script, so the insets follow the first React render immediately, under the launch frame. Measurement 2 therefore needs no synchronous `rootWindowInsets` read.
- **Launch resources take four theme files, not two.** Night mode outranks the API level in Android's resource selection, so `values-night` alone would hide the API 31+ splash attributes under a dark system theme; `values-night-v31` repeats `values-v31`. The guard pins all four.
- **The hdpi launcher pair was regenerated by resampling the xxxhdpi pair to 72 px** (macOS `sips`), which carries exactly the mask the other buckets have, rather than re-deriving a mask from the 2048 source. The guard pins all fifteen sizes and the foreground safe zone.
- **The version guard pins version ASSIGNMENTS, not every semver-shaped literal.** Schema 6.4 asked that every semver literal under `gen/android` never lead `package.json`; the Gradle files carry dependency coordinates (AGP 8.11.0, Gradle 8.14.3) that always would. `androidVersionSource.test.ts` instead pins the exact `defaultConfig` shape (fails closed on anything added), that only the two `tauri.properties` reads assign the version, and that no committed Android file sets `android:version*` or a literal code. Measured on the build: versionName 1.0.48, versionCode 1000048.
- **The FR-11 rows live in one file against the real platform module.** `androidReadings.test.ts` mocks only the os plugin's `platform()` to `'android'` and pins every table row, with comment-stripped wiring checks for the component call sites. To make two rows pure, the map fullscreen gate moved to `lib/mapFullscreen.ts` (`mobileMapFullscreen`) and the root markers to `lib/rootMarkers.ts`; `fileRowButtonLabel`'s third parameter is now named `mobile`.
- **The reachable-calls guard derives commands from `lib.rs` and finds call sites through the TypeScript AST,** including string literals equal to a registered command name, because the iCloud layer calls through a `call('icloud_...')` wrapper rather than `invoke`. A text grep had counted two comment-only mentions of the http plugin as imports; the AST does not.
- **The release signing block is inert without a properties file outside the repository,** so CI (and F-Droid's build) produces unsigned output, and a local build pointed at `SNOWRAVEN_ANDROID_KEYSTORE_PROPERTIES` produces a v2-signed APK directly; that is how the emulator checks were signed with the throwaway key. Schema 6.2's `sign.sh`, `preflight.sh` and `attach.sh` (the release Mac's signing of the CI artifact) are not written in this stage; the release skill describes them as planned.
- **CI (superseded by the F-Droid revision, same day):** the first workflow built an AAB and an APK for four Rust targets. The committed workflow now follows schema 6.1 as revised: the frontend build, then `scripts/android/build-apk.sh` (the unsigned universal APK for arm64, armv7 and x86_64, no AAB), Rust 1.96.1, `tauri-cli` 2.11.2 from crates.io and Gradle 8.14.3 from `toolchain.env`, the pinned SDK packages through the runner's own `sdkmanager`, and a refusal to run if a keystore properties file is present.
- **`ACCESSIBILITY.md`'s platform list names Android.** Its published-claims guard ties the opening sentence to the capability files, so adding Android to `capabilities/mobile.json` made the old sentence fail the guard. `ACCESSIBILITY.md` is not one of CLAUDE.md's approval surfaces (website, README, store listing, privacy policy); the one-sentence edit is flagged in the hand-back in case the user treats it as one.
- **Every guard was mutation-checked:** 17 mutations across the new guards (gates reverted to `isIOS()`, the location early return removed, an extra `get_location` call, a twin deleted or reading `env()` or the wrong side, the floor clocks or the probe ungated, minSdk 23, a hand-set versionName, an extra permission, a misnamed inset property, a dropped night splash attribute, a widened channel origin, a 48 px hdpi icon), all red, with an unmutated green baseline and every file restored and verified by sha256.

### Measurements (design-spec "Measurements the Engineer owes")

1. **Insets (API 36, Pixel 7 profile, density 2.625):** status bar 136 px = 51.81 CSS px top; gesture navigation 63 px = 24 CSS px bottom. Landscape: the side cutout reaches the body as a left inset and the wide layout's sidebar clears it. Three-button navigation on API 36 and an emulated cutout were not measured.
2. **First-frame timing:** handled structurally (the re-send above); no un-inset frame was visible in any screenshot.
3. **Splash to launch frame:** no white or light frame in the captures. **The mark changes at the handoff:** the platform splash draws the adaptive icon's foreground, which is the SR monogram, and the web launch frame draws the raven glyph. Reported to The Designer; nothing changed.
4. **API 26 to 30 layer-list (the floor moved from 24 to 26):** not observable on API 24 (the runtime crashes first); the API 26 and API 30 launches show the green frame with no white or light frame.
5. **Keyboard:** see above. **Emulator artifact found and attributed:** under the emulator's SwiftShader software GPU, after the keyboard closed, a band of the webview's own green background (and later stale duplicated tiles) persisted in Settings and scrolled with the page. The identical sequence under the host GPU rendered cleanly, so it is a software-rasterizer artifact, recorded so the Tester runs the emulator with `-gpu host`.
6. **Bar glyphs follow the painted theme:** with the app open in System, flipping the system to dark repainted the page and turned both bars' glyphs light; with the system light and in-app Dark, both bars' glyphs are light, which only the page's report can produce (`enableEdgeToEdge()` alone draws dark glyphs under a light system theme). Below the floor (API 30, WebView 91) no report is sent and the status glyphs stay dark over the green, the resource default the design accepted. API 24 and 25 could not be measured (blocker); on API 26, also below the WebView floor (Chromium 58), the status glyphs are dark over the green, as on API 30.
7. to 10. (map fullscreen under a cutout, largest system font, three-button nav on API 24 to 28, Approximate location) were not measured in this stage; 10 waits on the location decision.

### FR-55 measurement (2026-10-03, before any location-path commit): branch B stands

- **Image, WebView, signer:** `system-images;android-36;google_apis;arm64-v8a`; `com.google.android.webview` 133.0.6943.137; a release-profile build through `scripts/android/build-apk.sh` with the branch-A plumbing applied in the working tree only, signed with the throwaway key (certificate SHA-256 `e953b8ed...45a4`).
- **Step table:** 0 inferred pass; 1 pass (Android's own dialog, Precise and Approximate, no sheet of ours); 2 pass (centered on the fixed point in under 7 s); 3 pass (no dialog, about 3 s); **9 fail**: during a fix the app's own UID holds a TLS connection to a Google LLC address (`172.217.118.4:443`) for the whole 30-second sampling window, while two controls with no location request (an idle cold start, and Map Explorer open without pressing locate) show no connection at all; 4 to 8 not run, the branch being already decided. The full recording, screenshots and logs are in `pipeline/android-release/measurements/`.
- **Branch:** B. `ANDROID_LOCATION_BRANCH` stays `'B'`, the manifest declares INTERNET only, the five controls are absent. The AOSP-image reading was not run (it cannot lift the branch); it is where the connection could be attributed. **Reversal:** a re-run in which step 9 shows no Google connection during a fix.
- **Observation for the user:** the request is not attributed to a component (no reverse DNS name); what is established is that it runs under SnowRaven's UID and only when a position is asked for.

### The API 26 floor launch, and a launch-frame defect only the floor image could show (2026-10-03)

- **Measured:** the branch-B release APK (throwaway-signed) on `sr-api26-phone` (Android 8.0, `-gpu host`), whose stock WebView is `com.google.android.webview` 58.0.3029.125. It installs and launches (`minSdk=26 targetSdk=36`, no crash). **The first launch showed a bare green screen for over four minutes, with no mark and no message.**
- **Cause:** the launch frame's own rule was `position: fixed; inset: 0`. Chromium supports the `inset` shorthand from 87, so WebView 58 dropped it, the fixed frame had no offsets and shrank to a zero box under its own `overflow: hidden`, and everything in it (the mark and the floor message) was clipped. The page itself loaded: the green was the `html.sr-launching` background, and the os plugin's internals were present (its init script is ES5 and wry injects each init script as its own `<script>` when `addDocumentStartJavaScript` is missing), so the probe ran and set the below-floor state. The API 30 check could not see this, because Chromium 91 has `inset`. So the floor message had never been visible on any WebView from 58 to 86, which are exactly the stock WebViews of Android 8 to 10, the phones the message exists for.
- **Fix:** `frontend/index.html` now writes the four offsets (`top: 0; right: 0; bottom: 0; left: 0`) and puts a plain `bottom: 12px` before the copy block's `bottom: max(12px, env(safe-area-inset-bottom))` (`max()` is Chromium 79, `env()` 69; an old engine drops the whole declaration). Nothing changes in an engine that supports both, iOS and macOS included. A comment in the style block says why.
- **Guard:** `launchSplash.test.ts` gains a row: no `inset` shorthand anywhere in the launch `<style>`, the `.sr-launch` rule carries all four offsets, and every `max()`, `min()`, `clamp()` or `env()` declaration has a plain declaration of the same property before it in the same rule (comments stripped, with a non-vacuity count). Mutation-checked: `inset: 0` back, the fallback dropped, the fallback moved after the `max()`, and a dropped `left` each went red; the unmutated file green; the file restored and verified by sha256.
- **After the fix,** the same image shows the raven mark and "SnowRaven needs a newer Android System WebView: update it through your phone’s app store or system update, then open SnowRaven again." on the green frame, with no Reload, and the app never mounts (`screenshots/api26-phone-floor-message.png`). The status glyphs are dark over the green, as designed below the floor. A location icon in that screenshot's status bar is Google Play services' own GPS request (`dumpsys location`: `com.google.android.gms`, uid 10012); SnowRaven requests INTERNET only and holds no location request.

### The F-Droid recipe as committed is the form F-Droid's own tools accept, not schema 6.5's text (2026-10-03)

- **What the local fdroidserver 2.4.5 run found** (`fdroid-verification.md`): the recipe exactly as schema 6.5 wrote it stops at F-Droid's scan, on every machine: `scandelete: node_modules` matches nothing (no root `node_modules` is ever created), and `frontend/node_modules` removes nothing (Vite 8 builds with rolldown, whose `.node` addons the scanner only warns about), and fdroidserver counts both as errors. `fdroid lint` also refuses the `Changelog` URL on `/blob/main/`, and fdroiddata's CI fails any recipe not in `rewritemeta`'s layout.
- **Decided:** the committed recipe is "variant C" in canonical form: the prebuild ends with `rm -rf frontend/node_modules` (the APK build needs nothing from it, since `build-apk.sh` removes the `beforeBuildCommand`), `scandelete` names only `src-tauri/dmg/dmg-DS_Store`, `Changelog` is on `/blob/HEAD/`, and the layout is rewritemeta's. With that build entry, `fdroid scanner -e` found 0 problems and `fdroid build -v -l` built the app from source (`Successfully built version 1.0.48`, an unsigned APK with minSdk 26, the three ABIs and INTERNET only). On a byte copy of the committed file, `fdroid lint -f --force-yamllint` reports nothing and `fdroid rewritemeta -l` lists nothing. Removing the toolchain is preferred over listing nothing in `scandelete`: both scan clean today, but only the removal keeps the scan clean the day a frontend dependency ships an extensionless binary.
- **Why this departs from the schema:** the schema's stated purpose for those lines was a clean scan, which its text cannot produce; the departure is two lines and a reformat, each verified by F-Droid's own tools. `fdroidRecipe.test.ts`'s prebuild, scandelete and Changelog rows follow the committed text, and each was seen red against the schema's form.
- **Not verified, and only verifiable there:** the recipe's `sudo:` block (local mode skips it, and the buildserver image does not run on Apple silicon). The fdroiddata merge request's own build job is its first run.

### Nothing from Google's proprietary families is in the Android build (2026-10-03)

- **Read from the committed project** with Gradle 8.14.3 (`:app:dependencies`, `universalReleaseRuntimeClasspath` and `...CompileClasspath`, kept under `measurements/dependency-tree/`): the build's Gradle projects are `:app`, `:tauri-android` and the clipboard-manager, dialog, fs and opener plugins, with no geolocation module; no coordinate in `com.google.android.gms`, `com.google.firebase`, `com.google.android.play`, `com.android.billingclient`, `com.google.android.ads`, `com.google.mlkit` or `com.google.android.libraries`. The three `com.google.*` coordinates present are Apache-2.0 open-source libraries, not services: Material Components 1.12.0, error_prone_annotations 2.15.0 and guava's `listenablefuture` 1.0 stub. The merged manifest declares INTERNET and androidx.core's signature-level receiver permission, and one activity.

### Branch-B surfaces on the API 36 phone (2026-10-03)

- The branch-B APK on `sr-api36-phone`: the Weather tab's "Now, or any time ahead" card shows Plan alone, with no Current (`screenshots/b-1-weather-no-current.png`); the Map Explorer's Hotspots view shows the share, fullscreen and Filters discs with no locate disc (`b-3-hotspots-no-locate.png`); Settings' Default Location card has Latitude, Longitude, Radius, Save and Clear with no Use my location (`b-8-settings-scroll2.png`). The Targets chooser and the Map Explorer sidebar's center-point control need a loaded backup to appear and were not reached on the emulator; `location.android.test.ts` and `platformGates.test.ts` hold them.
- **Observation, not attributed to this build:** on the Map Explorer's My Sightings view with no backup saved, the floating disc cluster (fullscreen, Filters) overlaps the setup card's "Go to Settings" button at this phone width (`b-2-map-explorer.png`). The cluster and the setup card are shared with the iPhone app, which was not checked here.

### Observations for The Designer (no change made)

- Under branch B the Weather tab's introductory sentence still reads "get weather and tide for where you are, or for a place and time you choose" while its Current control is absent on Android; the spec says nothing else moves, so it is unchanged and flagged here. **Resolved in the release-leg errand (2026-10-03):** the sentence now follows `showLocationControls()`, so Android under branch B reads "Skip the checklist: get weather and tide for a place and time you choose." and iOS, desktop and web keep the original; `WeatherForecastPanel.test.tsx` renders both readings.

- Scrolled content passes under the translucent status bar, as on iPhone with `viewport-fit=cover` (the body's top padding scrolls away with the page).
- Below the WebView floor the status glyphs are dark over the green launch frame (no theme report is sent there by design); posting `dark` from the floor branch would give light glyphs if wanted.

## Stage re-entry: F-Droid replaces Google Play (2026-10-03, during Stage 5)

- **What changed:** the user does not want to pay Google to distribute SnowRaven, so the Android store leg is F-Droid, not Google Play. Said after The Engineer had started; The Engineer was told to stop every Play-specific piece and hold the Android location path, and to continue the store-independent platform work.
- **Why it reaches Stage 1:** the strategic brief named Play as the store leg and F-Droid as out of scope, the PRD's release leg, held copy and Data safety requirements are Play-shaped, and the schema's release mechanics (Play App Signing, internal track, play-upload.mjs) are Play-shaped. F-Droid builds from source on its own servers and refuses non-free dependencies, which also changes one code decision: tauri-plugin-geolocation's Android side depends on com.google.android.gms:play-services-location, so it cannot ship in an F-Droid build.
- **What survives untouched:** the parity cut, minSdk 24, the application id, the launch state, the insets and listeners, the Settings layout, the tablet reading, the guards, the GitHub-release universal APK, the emulator-and-user-device verification posture.
- **Facts established before the re-entry:** the repo is AGPL-3.0 (LICENSE at the root), which satisfies F-Droid's license requirement; src-tauri/Cargo.toml carries `license = ""` and should be aligned.
- **Cascade:** The Strategist revises the brief (hands-off), The Planner and The Architect revise as scoped errands, The Designer revises the location surface with the user, then The Engineer resumes the release leg.

## Stage 3 revision (F-Droid), The Architect (2026-10-03, hands-off)

Each entry is a decision the revised PRD left to this stage. The schema section that carries the mechanics is named in each.

### The location mechanism needs no `MainActivity.kt` code; wry already serves the WebView prompt (schema 4.6)

- **Decision:** branch A, if the measurement lifts it, is the Android System WebView's own `navigator.geolocation`, served by wry 0.55.1's generated `RustWebChromeClient.onGeolocationPermissionsShowPrompt` (which requests `ACCESS_COARSE_LOCATION` and `ACCESS_FINE_LOCATION` through `ActivityResultContracts.RequestMultiplePermissions` and grants the callback, including the Approximate-only case on API 31 and later) and by `RustWebView`'s `setGeolocationEnabled(true)`. The app contributes the two manifest lines and a `getCurrentLocationAndroid()` in `location.ts`; nothing is added to `MainActivity.kt` for location.
- **Why:** the PRD framed the callback and the runtime request as plumbing the Activity would own; reading wry's Kotlin shows both already exist on the one chrome client the webview carries, the same client that serves the import path's `onShowFileChooser`. Adding a second handler in the Activity would duplicate it or race it.
- **Reversal:** a wry release that drops or changes `onGeolocationPermissionsShowPrompt`; the guard pins the generated file's presence of that override only where the generated tree exists, and the measurement is re-run at any wry bump.

### Where the fix comes from, and `enableHighAccuracy: true` on Android (schema 4.6, 5.3)

- **Decision:** the Android call always asks for high accuracy; the web and Pi path keeps its default.
- **Why:** Chromium's WebView provider is `LocationProviderAndroid` (the platform `LocationManager`; the GMS provider is selected only when the embedder calls `useGmsCoreLocationProvider()`, which only Chrome does). The current provider refuses a low-accuracy request from an app that holds the precise permission ("Cannot generate approximate location") and forces low accuracy itself when the app holds only the approximate one, so `true` is the only value that works in both permission states.
- **Reversal:** a Chromium change to that feature; the measurement's steps 2 and 4 are what would show it.

### The measurement is specified in full before it is run, and its default is branch B (schema 4.6)

- **Decision:** a nine-step table with a pass condition on the `google_apis` API 36 image decides the branch; the AOSP `default` image is a second, recorded reading that can only add a Help sentence or a flag. Step 4 (Approximate) decides a Help sentence, not the branch.
- **Why:** FR-55 says the default is B and only a successful measurement lifts it; writing the pass condition first keeps the Engineer's run a recording rather than an exploration, and separating the de-Googled reading keeps a provider-set difference on the phone from being read as an app defect (the v1.0.40 lesson in a new domain).
- **Reversal:** none needed; if the switch run fails, B stands and the record names the step.

### One constant switches the branch: `ANDROID_LOCATION_BRANCH` (schema 5.3)

- **Decision:** `frontend/src/lib/androidLocation.ts` exports `'A' | 'B'`, read by `showLocationControls()`, by `location.ts` and by the manifest guard, which pins the permission set to it.
- **Why:** the branch touches the frontend in six places and the manifest in two lines; one switch makes the flip one commit and makes a frontend-manifest disagreement a red test rather than a merged-manifest surprise.
- **Reversal:** when branch A has shipped and B is no longer a live possibility, the constant and the B arms can be removed in a follow-up.

### Capabilities: two platform files, not one with a split (schema 4.3)

- **Decision:** `mobile.json` keeps `platforms: ["iOS", "android"]` and only `dialog:allow-open`; a new `ios.json` with `platforms: ["iOS"]` carries the three geolocation grants.
- **Why:** verified in tauri-utils 2.9.2 (`resolved.rs:98`) and tauri-build 2.6.2 (`acl.rs:337`) that an inactive capability is skipped before its permissions are validated or resolved, so the iOS file cannot break the Android build. Two files read as two statements: what both mobile binaries carry, and the one plugin kept off Android on purpose.
- **Reversal:** a Google-free geolocation plugin flavor (the v2 route in the brief) would move the grants back into `mobile.json`.

### The geolocation plugin's Cargo and `lib.rs` moves are exact (schema 4.1)

- **Decision:** `tauri-plugin-geolocation = "2"` moves from the `any(android, ios)` block to the `cfg(target_os = "ios")` block beside `objc2-ui-kit`; `.plugin(tauri_plugin_geolocation::init())` moves from the `cfg(mobile)` chain to the `cfg(target_os = "ios")` chain. `Cargo.lock` is unchanged.
- **Why:** FR-08 and the brief's cfg discipline: the cfg says where a crate is real.
- **Reversal:** the same v2 route.

### The wrapper jar is dropped; `gradlew` becomes a four-line shim; Gradle 8.14.3 is pinned in `gradle-wrapper.properties` (schema 3.8)

- **Decision:** the jar and `gradlew.bat` leave the commit; `gradlew` execs the `gradle` on `PATH`; the properties file stays as the one pin; CI uses `setup-gradle` with that version, the Mac installs it, F-Droid's `gradlew-fdroid` reads it.
- **Why:** fdroidserver's scanner deletes `gradle-wrapper.jar` by name with no checksum check, so the PRD's exception (acceptance "by checksum") is not met and the default applies; `build.py` deletes `gradlew` before the scan anyway, so F-Droid never runs ours; and the Tauri CLI only needs an executable named `gradlew` to exist. One shim in three environments is fewer moving parts than a regenerated jar in two of them.
- **Reversal:** a Tauri CLI that invokes Gradle directly rather than through `gradlew`, at which point the shim is dead and can go.

### F-Droid builds through `cargo tauri android build` in a raw `build:` step, never through F-Droid's `gradle:` method (schema 6.0, 6.5)

- **Decision:** `build: sh scripts/android/build-apk.sh` with `output:` naming the unsigned universal APK; no `gradle:` field.
- **Why:** Gradle's rust tasks call the Tauri CLI's `android-studio-script`, which reads its options from a WebSocket server hosted by the parent `tauri android build` process and panics without it (`tauri-cli` `mobile/mod.rs:372`), so a bare Gradle run cannot build this app on any machine. The same script runs on CI, which is what makes FR-34's "mirror" a diff of identical lines.
- **Reversal:** a Tauri CLI whose `android-studio-script` works standalone; then `gradle: [universal]` becomes the simpler recipe.

### The committed `BuildTask.kt` names `cargo tauri`, and every machine installs `tauri-cli` 2.11.2 from source (schema 6.0)

- **Decision:** the generated `npm run -- tauri android android-studio-script` becomes `cargo tauri android android-studio-script`; CI, the Mac and the F-Droid recipe each `cargo install tauri-cli --version 2.11.2 --locked`.
- **Why:** on F-Droid's server the npm form would make the build depend on `@tauri-apps/cli-linux-x64-gnu`'s prebuilt `.node` binary and keep `node_modules` past the scan, where `esbuild`'s extensionless binary is an error. A CLI compiled from crates.io is the only Tauri CLI that can take part in a from-source build, and using it everywhere keeps one path.
- **Reversal:** none foreseen; the npm CLI stays for desktop and iOS work.

### Toolchain provisioning in `sudo:` comes from Debian trixie packages plus rustup's own channel and crates.io (schema 6.5)

- **Decision:** `apt-get install nodejs npm rustup ...`, `rustup toolchain install 1.96.1` with the three Android targets under `RUSTUP_HOME=/opt/rustup`, `cargo install tauri-cli` under `/opt/cargo`, the real toolchain binaries symlinked into `/usr/local/bin`.
- **Why:** the buildserver is Debian trixie (`makebuildserver`, `Vagrantfile`), whose archive carries `rustup` 1.27.1 and `nodejs` 20.19.2 (the frontend needs 20.19 or later); Debian's `rustc` ships no Android standard library, so rustup is needed regardless. FR-53's "no download by its own URL" is kept: the recipe names no URL; rustup fetches from its channel and cargo from crates.io, the two registries the project already builds from. Symlinking real binaries rather than rustup's proxies is what lets the unprivileged build user run `cargo` with no environment variable.
- **Reversal:** a buildserver that preinstalls rustup for the build user, or a Debian `rust-std` for Android targets; either shortens the block.

### The Rust compiler is pinned (1.96.1) in the recipe and the Android CI job, through `scripts/android/toolchain.env` (schema 6.0)

- **Decision:** the pin is the release machine's rustc at the first ship; the Windows job stays on `stable`; no `rust-toolchain.toml` is added.
- **Why:** the recipe cannot say `stable` meaningfully (F-Droid builds a tag months later), so the recipe pins; CI pins the same so a green CI build is evidence the recipe compiles; a `rust-toolchain.toml` would also pin the desktop builds `release.sh` makes, which is a separate decision.
- **Reversal:** adopting `rust-toolchain.toml` for every target in a later run; the env file then reads it.

### `NonFreeNet` is self-declared in the recipe, with its reason (schema 6.5, 9)

- **Decision:** `AntiFeatures: NonFreeNet` with a one-sentence reason, also carried in `full_description.txt`.
- **Why:** the brief says expect it and do not argue it; F-Droid asks that the reason be in the description; declaring it is the honest default and saves a review round. The sentence is held copy.
- **Reversal:** the user's preference at the copy approval to leave the tag to the reviewer.

### `Categories: [Science & Education]` (schema 6.5)

- **Decision:** one category by default.
- **Why:** fdroiddata's list has no birding category; the app is a citizen-science companion first and a map second. Published listing data, so flagged for the user with `Navigation` as the candidate second.
- **Reversal:** the user's word at the copy approval.

### Fastlane layout `fastlane/metadata/android/en-US/`, staged in the pipeline folder, written on the yes before the tag (schema 6.5)

- **Decision:** F-Droid's documented default location; the exact content lives under `pipeline/android-release/fdroid/fastlane-proposal/en-US/` until the user's yes; the folder must exist at the tagged commit.
- **Why:** OQ-19's default, and the one place every Android tool looks; the before-the-tag rule exists because F-Droid reads metadata at the tag, so a late yes would leave the first listing without a description until the next release.
- **Reversal:** none.

### The version code lives in `src-tauri/tauri.conf.json`, written at the bump, with a formula guard (schema 3.3)

- **Decision:** `bundle.android.versionCode` beside `version` in the base config; `androidVersionSource.test.ts` asserts the formula, the package.json match, the absence of both literals under `gen/android`, and that the recipe's `UpdateCheckData` regexes extract exactly those two values.
- **Why:** FR-05: F-Droid reads from a committed file at the tag, and the CLI's derivation leaves nothing committed. The base file rather than the Android overlay so the recipe reads one file with two regexes.
- **Reversal:** none; the overlay stays for the identifier and the floor.

### No AAB; the universal APK carries arm64, 32-bit ARM and x86_64 in every environment (schema 6.0)

- **Decision:** `--apk --target aarch64 armv7 x86_64`, the same on CI, the Mac and F-Droid.
- **Why:** FR-34: nothing consumes an App Bundle; the same ABI set everywhere is what lets the local `fdroid build` output be compared with CI's for package, version and ABI set.
- **Reversal:** a store that takes AABs.

### Signing on the release Mac with `apksigner`, PKCS12 keystore, no Play (schema 6.2)

- **Decision:** `zipalign -p 4` then `apksigner sign` with the default scheme set; the keystore at `~/.tauri/snowraven-android.p12` with a 0600 properties file; `attach.sh` uploads only after the device check; the release draft asset or a tailnet link is the hand-over path before publication.
- **Why:** FR-35, FR-36, FR-38, FR-44's "before the signed APK is published"; v2 is what Android 7 verifies, so minSdk 24 needs nothing older.
- **Reversal:** reproducible builds (out of scope), which would let F-Droid publish the user-signed APK.

### The F-Droid tooling run and its honest limit (schema 6.5)

- **Decision:** `fdroid lint`, `fdroid scanner`, `fdroid checkupdates` and `fdroid build -l` run locally in a venv-installed fdroidserver against a scratch fdroiddata clone; `fdroid build --server` is not attempted; the `sudo:` block is verified by the fdroiddata merge request's own pipeline, and the checklist says so.
- **Why:** local mode skips `sudo:` by design (`build.py` runs it only on-server), and the buildserver box is an x86_64 `debian/trixie64` for VirtualBox or libvirt, not runnable on an Apple-silicon host. A failure in the MR pipeline is a recipe edit and does not block the GitHub APK, which is the first-day path.
- **Reversal:** an arm64 buildserver box, or a Linux machine on the tailnet.

### `scandelete` carries the two `node_modules` and `src-tauri/dmg/dmg-DS_Store` (schema 6.5)

- **Decision:** those three paths, nothing else; no `scanignore`.
- **Why:** the scanner errors on extensionless binaries, and the tracked tree has exactly one (the macOS DMG layout file); `node_modules` holds the Vite toolchain's native binaries, which are not needed once `frontend/dist` exists. `scanignore` needs a "very good reason" in the MR and nothing here needs one.
- **Reversal:** renaming the DMG layout file with an extension in a later run removes one line.

### The FR-33 message names no store (schema 5.6)

- **Decision:** the committed message must contain "Android System WebView" and neither "Google" nor "Play"; the design-spec's current sentence is handed to The Designer's revision.
- **Why:** FR-33 as revised; a de-Googled phone has no Play, and the message must be true on it.
- **Reversal:** none.

### The CLI's NDK auto-selection is recorded as a caveat, not worked around (schema 6.5)

- **Decision:** `ndk: r27c` in the recipe; no attempt to force `NDK_HOME` on F-Droid.
- **Why:** `ensure_ndk` picks the highest NDK under `$ANDROID_HOME/ndk` regardless of `NDK_HOME`; CI and the Mac install one NDK, so the pin holds there; on F-Droid's image it is advisory, and the honest answer is to say so rather than to hide other NDKs from an unprivileged build user.
- **Reversal:** a Tauri CLI that honors a preset `NDK_HOME`.

## Stage 4 revision (F-Droid), The Designer (2026-10-03)

The user's direction that SnowRaven will not be on Google Play reached the design after the direction had been approved. Three things in the design named Play or rested on it; each is revised below. Everything else in the Stage 4 entries above stands as approved: the brand-green launch in both themes, the injected insets and the native keyboard padding, the painted-theme bar glyphs, the tab bar sliding out under the keyboard, the denied-location sentence, the Settings composition, the tablet reading and the platform-default backup.

### The WebView floor message names no store

- **What changed:** the FR-33 sentence was "SnowRaven needs a newer Android System WebView. Update it from Google Play, then open SnowRaven again." It is now one sentence: "SnowRaven needs a newer Android System WebView: update it through your phone's app store or system update, then open SnowRaven again."
- **Why:** an F-Droid or sideloaded install may be on a phone with none of Google's software, and the System WebView updates through whatever store the device has or through the ROM's own update; naming one store would send some users to a thing they do not have. The sentence tells them where to look without naming it, in the house register.
- **Reversal:** none; Play never returns. A future store leg would add no store name to this sentence either.

### Location is two branches, and the surface for each is designed

- **What changed:** the first draft designed one location surface served by the geolocation plugin. The plugin's Android side depends on `play-services-location`, which cannot ship in an F-Droid build, so the Architect's revision replaced it with the WebView's own `navigator.geolocation` under branch A and the absence of every location control under branch B, switched by an emulator measurement with B as the default. The spec now designs both: under A the approved surface stands unchanged (system dialog on first press, the approved denied sentence, now with the Approximate-only reading and the no-network-provider case tied to the measurement's step 4 and the AOSP image run); under B the five controls are absent and nothing else moves, specified surface by surface (the FAB row closes up with no reserved slot; the sidebar place search takes the full row; the Default Location card is description, fields, Save; the Targets chooser opens on Default Location and place search; Weather loses the Current lookup; Plan keeps its no-place state), with no sentence naming location as unavailable. `design.html` section D gained a third state showing branch B beside branch A.
- **Why:** FR-55 and FR-56 make the branch a recorded measurement rather than a design choice, and a surface that is absent needs as much design as one that is present: the FR-56 requirement is "absent, not disabled, no placeholder, nothing else moves", and each site had to be looked at to say what its neighbors do when it goes. The denied sentence survives unchanged because the WebView reports the app permission and the master switch as the same denied code, which is the same reason it was one sentence before.
- **Reversal:** when branch A has shipped on a measured WebView and B is no longer live, the B surface and the switch can be removed in a follow-up, per the Architect's entry above. Play never returns, so the plugin route does not either.

### Help and in-app copy name F-Droid and the APK, never Play

- **What changed:** the Help install sentence that named Google Play is replaced by the two sentences the revised brief requires: "Installs from F-Droid and from the GitHub APK are signed by different keys and do not update each other; switching between them means uninstalling one and installing the other, and your files and keys do not carry over unless you import them again." and "On Android, updates arrive through the F-Droid client or by installing a newer APK from the GitHub release over the old one, never from inside the app." The mockup's Settings note about the absent update footer says F-Droid or a newer APK; the home-screen frame no longer shows a Play Store icon. Settings itself is unchanged: no updater footer, no store control.
- **Why:** two signers mean two install lineages Android will not merge, and a birder who switches loses the app's private storage with the uninstall; Help is the one place the app explains that, and it must do so without naming a store the user may not have. In-app text and Help are written without a stop; the Fastlane listing, the recipe, the website, README and privacy policy stay held proposals.
- **Reversal:** none; Play never returns. If a second free store were ever added, the first sentence generalizes to "installs from different sources are signed by different keys".

## Android floor raised to 8.0 (API 26), decided by the user 2026-10-03

- **Decision:** minSdk 26, replacing the brief's minSdk 24. Remedy (A) of The Engineer's BLOCKER entry above; Tauri's pinned jackson-databind is not overridden.
- **Why:** the release-signed APK crashed at launch on the API 24 and API 25 emulators every time, inside Tauri's Android library (jackson-databind 2.15.3's ExceptionUtil.isFatal references java.lang.BootstrapMethodError, a class Android ships only from API 26), and launched on API 30 and 36. The crash is in a dependency Tauri chose, not in this build.
- **Reversal:** a Tauri release that moves off that Jackson version, or a measured API 24 launch with a Gradle constraint on an older jackson-databind; either is its own build with its own API 24 launch check.

## Release-leg errand, The Engineer (2026-10-03, hands-off)

The main pass handed back four release-leg pieces not yet written. Each is recorded here as it lands.

### The release Mac's preflight, sign and attach scripts

- **Written:** `scripts/android/preflight.sh`, `sign.sh` and `attach.sh`, with `scripts/android/release-lib.sh` holding what all three share (the keystore resolution, the password handover, the `aapt2` and `apksigner` reads). One shared file rather than three copies because the password handling is the part that must not drift between scripts. The skill's Android section now reads as the runbook, step by step.
- **Departure from schema 6.2 and the old skill text: `zipalign -P 16`, not `-p 4`.** `-p` page-aligns stored native libraries to 4 KB; the CI-shaped APK AGP produces is already 16 KB aligned (measured: `zipalign -c -P 16 4` passes on it), which Android 15 and later need on 16 KB-page devices, and build-tools 36's `apksigner` page-aligns native libraries to 16 KB by default (`--lib-page-alignment` 16384), so `-P 16` keeps the two steps agreeing where `-p` would undo the alignment before apksigner restored it.
- **Decisions that sharpen the spec:** the properties file must be mode 0600 and both files must sit outside the repository, or preflight and sign stop; the signed file is written to a scratch path and moved into place only after every verification passes, so a refused signer leaves no signed APK behind; `SNOWRAVEN_ANDROID_SIGNER_SHA256` turns the "same digest every release" rule into a stop rather than a reading; `attach.sh` requires `ANDROID_DEVICE_CHECK=passed` (or `partial`, the written-decision case), compares `ANDROID_CHECKED_SHA256` with the file before the upload and the downloaded-back asset after it, refuses an existing asset of the same name rather than passing `--clobber`, and refuses any APK signed by the Android debug key or by a certificate whose subject says `THROWAWAY` or `not for release`, so the emulator key cannot reach a release by accident.
- **Dry run, THROWAWAY key only** (`THROWAWAY-snowraven-emulator-only.jks`, alias `throwaway-emulator`, certificate SHA-256 `e953b8edd83734f0e9a9ba988d212087f6f9ad46990860e38eef6e2d43e645a4`), on a local CI-shaped unsigned build of 1.0.48 (`scripts/android/build-apk.sh` with no properties file): preflight passed with `ANDROID_APK` and `SKIP_TAG_CHECK=1`, and failed as designed with no properties file (the user step printed), with the properties file at 0644, and on the real tag check (`v1.0.48` predates `bundle.android.versionCode`, so its `tauri.conf.json` reads `1.0.48 undefined`). Sign produced `SnowRaven_1.0.48_android_universal.apk` (SHA-256 `01a10ab03dcbb33f9f3b956afb80221d1f35dcc42eead855d56a1c13084553c1`, the same bytes on two runs), verified with the v2 and v3 schemes, refused a wrong recorded signer leaving no file, and left no secrets directory behind. Attach ran against a `gh` stand-in on `PATH` that refuses every write: it refused without the device check, refused a renamed file and refused the throwaway signer; the stand-in recorded no call. **Nothing signed with the throwaway key was attached or distributed.** Not exercised: `gh run download` of a real artifact (no tag yet carries the Android build) and the upload and download-back, which need a release-key-signed APK and a published release.
- **Guard:** `androidProjectPins.test.ts` gains six rows over the four files with shell comments and the printed user step stripped: no code path creates a keystore and the printed `keytool` command equals the skill's, passwords go by file, nothing runs `gh release create` or `--clobber`, the device-check gate comes before the upload, the CI run is pinned to the tag's commit, and the asset names match the workflow's; plus a guard-the-guard row. Mutation-checked: an executed `keytool -genkeypair` line in `sign.sh`, and a `--ks-pass pass:` plus `gh release create` in `attach.sh`, each went red; both files restored and verified by SHA-256.

### The fdroiddata merge request text

- **Written:** `pipeline/android-release/fdroid/merge-request.md`: what must be true in the repository before the request (the bumped recipe, the approved `NonFreeNet` sentence and category, the Fastlane folder at the tag, the green tag CI, the local F-Droid checks), the web route and the command-line route one step per line (fork `fdroid/fdroiddata`, branch `com.dtgibson.snowraven`, `metadata/com.dtgibson.snowraven.yml` byte-identical to the committed recipe at the tag, commit and title `New app: SnowRaven (com.dtgibson.snowraven)`), the description text with the three reviewer points stated up front, the pipeline to watch and what to do when its build job (the first run of the `sudo:` block) fails, the Request For Packaging alternative with its text, and the three record forms the Deployer writes, the deferral in exactly the skill's form.
- **Not claimed:** the exact wording of fdroiddata's new-app template and GitLab's account-verification rules were not read this run; the steps say "if GitLab offers a template" and "GitLab may ask you to verify your account" rather than quoting either.

### The F-Droid listing screenshots

- **Captured and staged** under `pipeline/android-release/fdroid/fastlane-proposal/en-US/images/`: six phone shots (`phoneScreenshots/1.png` to `6.png`, API 36 Pixel 7, portrait, 1080 by 2400) and six ten-inch tablet shots (`tenInchScreenshots/1.png` to `6.png`, API 36 Pixel Tablet, landscape, 2560 by 1600), in the App Store set's order where the screens exist: Map Explorer, Statistics, Calendar, Species Detail, Breeding Codes, then Multimedia. Listed with a caption each in `held-copy.md` section (b). Nothing is published; they move with the folder on the user's yes.
- **Data and build:** the website's synthetic demo dataset (`website/tools/gen-demo-data.mjs`), every submission id checked to be in the `S9` range first, seeded into the app's private storage with root on the emulator (a release build has no `run-as`), files given the data directory's own SELinux context and mode 0600; the APK is this branch's CI-shaped unsigned build signed by `sign.sh` with the throwaway key; status-bar demo mode; `-gpu host`. No API key was entered.
- **Gap, named:** no Weather shot. The checklist lookup needs eBird (which answers nothing for the synthetic ids) and the Planner stand-in needs an OpenWeather key in the app; this capture handled no secrets, so Multimedia, which reads only the demo export, takes the slot. The tablet Statistics shot also shows the keyless "No eBird key, so exotic status cannot be checked" line.
- **Observation, not changed:** after a tab switch on the phone, the page keeps part of the previous tab's scroll offset, so the new tab opens with its header partly under the status bar and blank space below the footer until it is scrolled to the top (seen on Map Explorer and Species Detail). Shared web layout, not investigated here; flagged for the Tester.
