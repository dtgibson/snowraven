# Design Spec: Android Release

**Feature:** android-release
**Date:** 2026-10-03
**Stage:** 4 (The Designer)
**Source:** prd.md (FR-11, FR-14, FR-19, FR-20, FR-31 to FR-33, FR-15, FR-16, FR-18, FR-51, NFR-04), schema.md (sections 3.5, 5.2, 5.5, 5.6), strategic-brief.md
**Design system:** `pipeline/design-system.md`, unchanged. Designed within it; the one lint-adjacent note is logged in `decisions.md`.
**Mockup:** `pipeline/android-release/design.html` (self-contained; theme and navigation-mode toggles at the top; the launch sequence, the keyboard case and the two location states are stepped)

## Visual Direction

Nothing about SnowRaven's look changes for Android. The Android app is the shipped responsive frontend in the established system: quiet utility, one accent, restrained color, the house registers. What this stage designs is the Android-specific surface a user meets before and around that app: the launch, the system bars the app now draws under, the Settings page with the Apple sections gone, the location prompt, and the tablet. Every decision below is the smallest one that makes Android read as the same product as the iPhone app.

On a device the type stack resolves to Roboto (the app's `--font-sans` falls through `'Inter', system-ui` to the system face, as it falls to SF on iOS). No font is bundled for Android.

## Screens / Views

### 1. Launch (FR-31, FR-32, QA-31, QA-32)

Four paints of the same green with the mark in the same place, then the app.

1. **Icon.** The adaptive launcher icon: the raven foreground over `#2D8653` (`@color/ic_launcher_background`), the launcher's own mask. The committed set under `src-tauri/icons/android` with the hdpi bucket regenerated (schema 3.5).
2. **System splash, API 31 and later.** `values-v31/themes.xml`: `android:windowSplashScreenBackground` = the green; `android:windowSplashScreenAnimatedIcon` = `@mipmap/ic_launcher_foreground` (the adaptive foreground, so the plate and the field are both the green and the result is the mark on green); no `windowSplashScreenIconBackgroundColor`; no branding image. No `core-splashscreen` library and no fixed wait: the splash yields when the Activity first draws.
3. **API 24 to 30.** There is no system splash, so `android:windowBackground` is a layer-list drawable: the green, with the launcher foreground centered at 108dp. It reads as the same frame as step 2.
4. **Window background, both themes.** `values/themes.xml` and `values-night/themes.xml` both set `android:windowBackground` to the green (a plain color on API 31+, the layer-list on 24 to 30). The green is the launch color on every platform and is not a light color, so dark mode cannot flash (FR-32). wry then paints the webview itself in `tauri.conf.json`'s `backgroundColor` (`#2D8653`) before the first document.
5. **Launch frame.** The existing `index.html` frame: `#2D8653` with the 88px white raven and the visually hidden "Opening SnowRaven" status. It removes itself the instant React paints, exactly as today; nothing animates between it and the first frame.
6. **First frame.** The app in its own theme, under transparent system bars (section 2).

Status bar during launch: light glyphs over the green. The splash theme sets `android:windowLightStatusBar` false in both `values` and `values-night`; after the first frame `enableEdgeToEdge()` picks the glyph color from the system theme (section 2).

**Below the WebView floor (FR-33).** The launch frame stays, in the same green with the same mark, and its status line reads:

> SnowRaven needs a newer Android System WebView: update it through your phone's app store or system update, then open SnowRaven again.

It names no store, because the user may have none of Google's (an F-Droid or sideloaded install), and the System WebView updates through whatever store the device has or through the ROM's own update. No Reload button (reloading cannot change the WebView). The sentence is `#sr-launch-status` text, so a screen reader hears it as the frame's status.

### 2. Edge to edge: the main view under the system bars (FR-20, OQ-13, QA-20)

**Mechanism: injected insets, the Architect's option (b).** `MainActivity.kt` overrides `onWebViewCreate(webView)` and installs one `ViewCompat.setOnApplyWindowInsetsListener` on the webview. On every change it sets four CSS custom properties on `document.documentElement` through `evaluateJavascript`, in CSS px (the inset divided by `resources.displayMetrics.density`):

- `--sr-inset-top`, `--sr-inset-right`, `--sr-inset-bottom`, `--sr-inset-left`: the union of `systemBars()` and `displayCutout()`.

The keyboard is handled differently (section 4). The app keeps drawing under the bars in its own theme, so the strip under the status bar is `--sr-bg` in light and in dark and follows the in-app theme toggle, as it does on iPhone.

**Root marker.** `main.tsx` adds `sr-android-app` to `<html>` when `isAndroid()`, synchronously before render, beside the existing iOS line. `sr-ios-app` is never added on Android. Every Android inset rule is gated on `.sr-android-app` and reads only the four variables, never `env()`, so a WebView that later starts reporting `env()` (Chromium 140 and up) cannot double-pad. The variables default to `0px` through `var(--sr-inset-top, 0px)`, so the first paint before the first listener callback is the un-inset layout for at most one frame.

**Which rules, exactly.** One Android twin for each shipped `.sr-ios-app` rule in `globals.css`, same selector list, `env(safe-area-inset-X, 0px)` replaced by `var(--sr-inset-X, 0px)`:

| Surface | iOS rule today | Android twin |
|---|---|---|
| In-flow page | `.sr-ios-app body` top/left/right padding | `.sr-android-app body` top/left/right padding from the three variables |
| App footer | `.sr-app-footer` bottom | bottom = `calc(20px + var(--sr-inset-bottom, 0px))` |
| Phone bar | `.sr-navbar` bottom padding | `calc(6px + var(--sr-inset-bottom, 0px))` |
| More sheet | `.sr-nav-sheet` bottom padding | `calc(14px + var(--sr-inset-bottom, 0px))` |
| Nav column (wide) | `.sr-nav-col` top and height | `top: var(--sr-inset-top, 0px); height: calc(100dvh - var(--sr-inset-top, 0px))` |
| Map Explorer fullscreen panel | `.sr-map-fullscreen-panel` top/left/right padding | the same three from the variables |
| Embedded-map fullscreen panel | `.sr-map-fs-panel` and its corner row | the same |
| Map FAB cluster | `.sr-map-fab-cluster` bottom and sides | the same |
| Help panel and TOC | `.sr-help-panel`, `.sr-help-toc` | the same, the TOC's height calc subtracting `--sr-inset-top` |
| Dialog root | `.sr-dlg-root` top padding | `calc(16px + var(--sr-inset-top, 0px))` |
| Palette and Alerts-inbox roots and feet | `.sr-palette-root`, `.sr-palette-foot` | palette only; the inbox never renders on Android (FR-15), so no twin is written for it |
| Pinned table bands | `.sr-bc-matrix--pinned thead th`, `.sr-ll-table--pinned thead th` | `top: var(--sr-inset-top, 0px)` (an offset is re-pointed, not padded) |
| Skip link | `.sr-skip-link:focus` top and left | `calc(16px + var(--sr-inset-top, 0px))`, `calc(16px + var(--sr-inset-left, 0px))`, on the focused state only |

The Map Explorer's `.sr-map-panel-ios` class keeps its name and is applied under `compactChrome()` as today; its fallback calc's `env()` term resolves to 0 on Android and the measured `--sr-map-chrome` governs after the first measurement, which already contains the injected body padding. The Engineer may rename the class to `sr-map-panel-compact` in the same change if the iOS guard tests make that cheap; the name is not load-bearing for this design.

**Status and navigation bar glyph color follows the PAINTED theme.** Dark glyphs over the light in-app theme, light glyphs over the dark in-app theme, decided by the page and applied by native, so the strip under the status bar and the band behind the gesture pill always carry glyphs that contrast with what the app has painted there. The Appearance setting makes a forced theme a normal path, not an edge case, which is why this is a decision and not a gap (decisions.md).

- **Channel, the same hook the insets use.** In the same `onWebViewCreate(webView)` override that installs the insets listener, `MainActivity.kt` registers `WebViewCompat.addWebMessageListener(webView, "srAndroid", setOf("http://tauri.localhost"), listener)` (androidx.webkit, already a template dependency), guarded by `WebViewFeature.isFeatureSupported(WEB_MESSAGE_LISTENER)`. One override, two registrations, no second bridge and no new plugin. The listener accepts exactly the strings `light` and `dark` and ignores anything else, and runs on the UI thread, where it sets `WindowInsetsControllerCompat(window, window.decorView).isAppearanceLightStatusBars = (theme == "light")` and `isAppearanceLightNavigationBars = (theme == "light")`. The origin allowlist is the whole trust argument: only the app's own document can post to it.
- **Who sends, and when.** The page is the single source of the painted theme. `lib/theme.ts` gains `reportPaintedTheme(effective)`, called at the end of `applyTheme()`, and `main.tsx` calls it once with the current `data-theme` right after adding the root marker, so the first paint and the splash-to-app handoff already carry the right glyphs. It is a no-op unless `isAndroid()` and `window.srAndroid` exist, so no other platform changes. Three triggers, all through `applyTheme`: first paint; every Appearance change (Light, Dark, System); and, in the System setting, a system theme flip while the app is open, for which `App.tsx` adds one `matchMedia('(prefers-color-scheme: dark)')` change listener that re-runs `applyTheme('system')` when the preference is System. The app has no such listener today on any platform, so this also makes System follow a live flip on macOS and iOS; the Engineer may scope it to all platforms since it is a correction, not an Android behavior.
- **Before the first report, and below the WebView floor.** The resource default stands: `enableEdgeToEdge()` reads the system theme through `values-night`, which agrees with the page's default and with the green launch frame's light glyphs. Below the floor no report is ever sent and the default is what shows.
- **API 24 to 30.** Status bar icon appearance is API 23 and later, so it follows the painted theme on every supported version. Navigation bar icon appearance is API 26 and later: on API 24 and 25 the compat setter is a no-op and `enableEdgeToEdge()` draws its dark translucent scrim behind the three-button bar with light glyphs, so the bottom band is dark with light glyphs whatever the in-app theme, and the app's own bar sits above that scrim. Accepted as the platform's behavior; recorded and screenshotted (measurement 6).

**Navigation modes.** Gesture navigation reports a small bottom inset (about 24dp); three-button navigation reports about 48dp. The variable carries whichever the device uses; nothing in the app distinguishes them. The mockup's Navigation toggle shows both.

**Landscape and cutouts.** A punch-hole arrives as a taller `--sr-inset-top`; a landscape sensor housing arrives as `--sr-inset-left` or `--sr-inset-right`. Because the body and the two fullscreen panels pad the sides from the variables and the FAB cluster reads them, the fullscreen map's pills, its Filters overlay and its corner buttons clear a cutout in both orientations (FR-19, QA-19). On API 24 to 28 `enableEdgeToEdge()` draws a translucent scrim behind the three-button bar; that is the platform's behavior and is accepted.

### 3. Compact chrome (FR-14, QA-14)

**Yes, on Android, on the same predicate as iOS: `compactChrome()` becomes `isMobileApp()`.** The compact header is the slim single-line bar (raven 20px, wordmark 1.125rem, `8px 16px 6px` padding), under `--sr-inset-top`. The reason is the same as on iPhone: on a phone the tagline and the 48px top padding cost a third of the first screen for a sentence the user has read once. The header exists at phone density only; at tablet width the nav column carries the brand and there is no header to compact. The Map Explorer panel sizes to the visible viewport under the compact chrome so the map and its FAB cluster are above the fold on tab open; the measured `--sr-map-chrome` is what governs, as on iOS.

### 4. Keyboard over an input (FR-20, measurement owed)

**The keyboard is an occluder, not decoration, so it is handled natively, not as a CSS variable.** In the same insets listener, the `ime()` inset is applied as bottom padding on the webview view itself (and only the IME inset; the system bars stay injected variables). The viewport then shrinks exactly as it does under `windowSoftInputMode="adjustResize"` on a non-edge-to-edge app, and Chromium scrolls the focused input into view on its own, which it cannot do when the window does not change. `100dvh` surfaces (the fullscreen map, the More sheet, the dialog shell) shrink with the viewport, so a field in a sheet is never under the keys.

While the keyboard is up, `MainActivity` also toggles a root class `sr-ime-open` (set in the same `evaluateJavascript` call, from `insets.isVisible(ime())`). The phone bar takes `transform: translateY(100%)` under it, 160ms ease-out with the global reduced-motion rule collapsing it, so the bar does not sit on top of the keyboard spending a quarter of the remaining height. The body's bottom padding for the bar is unchanged (the bar is hidden, not removed, and the keyboard covers that band anyway). When the keyboard closes the padding and the bar return. Nothing else moves.

Fields this reaches on a phone: the Species Detail search, the Weather checklist field, the two API key fields and the Default Location coordinates in Settings, the Map Explorer filters' address search, the Search palette. The mockup's "Keyboard over an input" toggle shows the Statistics page's find-a-species field.

### 5. Map fullscreen rule (FR-19, QA-19)

**Same as iOS, on `isMobileApp() && isFullscreen`.** Entering fullscreen hides the sidebar at any width and the map owns the canvas; the Filters FAB opens the same overlay the phone tier uses (`position: absolute`, containment through `.sr-map-content`'s `position: relative`, backdrop shown, close control shown); exiting restores the in-flow sidebar beside the map at tablet width. `MapExplorer.tsx`'s `iosFullscreen` is renamed `mobileFullscreen` and the class stays `sr-map-ios-fullscreen` unless the rename is free. The Android fullscreen panel pads top, left and right from the variables; the FAB cluster pads the bottom from `--sr-inset-bottom`; the map canvas bleeds to the bottom edge under the gesture bar, as it bleeds to the home indicator on iPhone.

### 6. Settings on Android (FR-15, FR-16, FR-13, QA-15, QA-16, QA-13)

Section order, top to bottom, with no gap where an Apple section was:

1. **API Keys** (eBird, OpenWeather; Show / Update), with the existing note under it.
2. **Default Files** (eBird backup, ML export). The row buttons read **Import file…**, **Import new…** and **Importing…**, the approved iOS strings; `Upload` appears nowhere on the tab. `fileRowButtonLabel`'s third argument becomes `isMobileApp()`.
3. **Help & Documentation.**
4. **Appearance** (Theme, Text size, Embedded media).
5. **Sharing.**
6. **Default Location** (Use my location goes through the geolocation plugin, section 7).
7. **Tab Layout.**
8. **eBird bar-chart files** (every platform).
9. **Troubleshooting** (`isTauri()`, so present): the paragraph and **Rebuild caches**, which clears, skips the relaunch, and reports **Caches cleared. Close and reopen SnowRaven to finish.** in the iOS words.
10. **Acknowledgments.**

Absent, as whole blocks with their own headers, so nothing is orphaned: iCloud Sync (`showICloudSync()` is false by construction), Alerts (`alertsSupported()` false), the widgets material (`widgetsSupported()` false), the updater footer (`showUpdaterFooter()` false), the header bell, the sidebar inbox item, the Search inbox destination and the Alerts-only Help entry. No placeholder names any of them. Checked against the rendered tree in the mockup: every `SectionHeader` on Android heads a card with content.

### 7. Location, two branches (FR-17, FR-18, FR-55, FR-56, QA-17, QA-18, QA-62, QA-63)

Location on Android is one of two surfaces, switched by `ANDROID_LOCATION_BRANCH` after the Engineer's emulator measurement (schema 4.6). Branch B is the default until a passing recording lifts it. Both are designed here; the mockup's section D shows them side by side.

**Branch A: the default surface stands, sourced from the WebView itself.** Every location control renders as it does on iPhone and gets its position from the Android System WebView's own `navigator.geolocation`, served by wry's chrome client and the platform location service; no plugin and nothing of Google's. Nothing visible changes from the first draft:

- **No pre-prompt.** The first press of any location control (the map's locate button, Use my location in the map filters and in Settings, My location on Targets, the Current weather and tide lookup, Plan with no place chosen) raises Android's own permission dialog directly, as on iPhone. The control the birder just pressed is the rationale; a sheet before the dialog would be a modal the house style avoids, and Android's dialog carries the app name and the Precise / Approximate choice itself. The dialog's words and buttons are the OS's and are drawn in the mockup only to show the moment.
- **The denied sentence,** approved and unchanged, the only platform sentence shown on Android, in the iOS and Windows register with their arrow path:

  > Allow location for SnowRaven in Settings → Apps → SnowRaven → Permissions → Location, and make sure Location is turned on, then try again.

  It names the app's own permission and the phone's master switch in one line because the WebView reports both refusals as the same denied code (schema 5.3). The route words Settings, Apps, SnowRaven, Permissions, Location are what QA-18 pins. It renders in the existing red note above the map's buttons (`role="alert"`, `--sr-error` text on `--sr-error-bg`), in the Settings Default Location card's error line, and wherever `describeLocationError` is shown today.
- **By state:** allow returns the position and the map centers; a refusal or "don't ask again" shows the note with no second dialog; the phone-level Location switch off shows the note, or the generic unavailable sentence where Chromium reports position-unavailable at once (schema 4.6, step 7, either is a pass); no fix within ten seconds shows the existing timeout sentence, never the denied one.
- **Approximate-only reading.** With coarse and fine both declared the dialog offers Approximate. The app always asks for high accuracy on Android and the WebView downgrades it itself when only Approximate is granted (schema 4.6). What the birder then gets is what the measurement's step 4 records: either a position good to a few kilometers, which still orders nearby lifers sensibly and centers the map near them, or the generic unavailable sentence. The surface is the same in both cases; the measurement decides one Help sentence, in Content Notes.
- **A phone without a network location provider** (a de-Googled ROM) may take longer to fix or need GPS, which is the phone's provider set, not the app; if the AOSP-image reading shows it, Help gets one sentence (Content Notes), and nothing in the app says "unavailable" ahead of time.

**Branch B: every location control absent, nothing else moves.** Under B the five controls do not render, `getCurrentLocation()` throws the existing `unavailable` code, no text names location as unavailable on Android, and the honest state is typed coordinates and place search. Surface by surface:

- **Map Explorer, the FAB cluster.** The cluster keeps its bottom-right anchor and its row: the share corner button first, then the Filters pill, then the fullscreen disc, with the locate disc simply not in the row. Flex closes the gap, so the remaining controls sit flush right exactly where they sit on web/Pi with no slot reserved and no spacer. The full-width message row and the Search this area row are unchanged. The map still centers on the Default Location on open and on a place the birder searches for.
- **Map Explorer, the filters sidebar.** The Use my location row is absent. The place search (`AddressSearch`, submit-only) is the way to move the map to a place and keeps its position in the filter block; where the two shared a row, the search takes the full row. The county select, the date range, the view and radius controls and the species picker are untouched.
- **Settings, Default Location.** The card keeps its one-line description ("Set a home location for the Map Explorer. These coordinates load automatically every time you open the map tab."), then the Latitude, Longitude and Radius fields, then Save. The Use my location button and its error line are not rendered, so the field grid follows the description at the card's existing 12px rhythm; there is no blank band where the button was and no sentence about location. The description is not reworded: it already describes a typed location.
- **Targets, Measure distances from.** The anchor chooser's My location item is absent; the list opens on the Default Location item and the place search. The status line reads "Distances are measured from Arrowhead Marsh" as before.
- **Weather, Current weather and tide.** The Current lookup control is absent from the Weather tab; the checklist lookup and the Planner stay. Plan with no place chosen takes its existing no-place state and does not request a position.

Under B the Help location passage names Android only in the route-free form (Content Notes): it does not tell an Android user to allow a permission the app never asks for.

### 8. Tablet (NFR-03, NFR-04, QA-19, QA-55)

**A 10-inch tablet gets the wide layout, as iPad does; no tablet-specific reading.** At 1280 CSS px the nav picks the sidebar density (13.5rem) from measured width against the 640px content floor; `<main>` starts at the top of the window under `--sr-inset-top`. In portrait at 800 px the same rule picks the icon rail. The body pads top from the variable; the sticky nav column re-points its `top` and shortens its height by the same value; nothing pads the bottom but the surfaces that reach it. Landscape with a side cutout arrives as a left or right variable on the body.

**Text scale.** The in-app Text Size is the designed scale and applies on Android as everywhere. Android's own font scale reaches the WebView as its default text zoom and multiplies on top of it; the app does not disable it, because respecting the system setting is the accessible default. At a large font the measured-width rule moves the nav down a density (sidebar, rail, phone bar) rather than clipping, and the rows wrap rather than clip: the Settings description column already carries `overflow-wrap: anywhere`, the quiet buttons keep their 30px minimum and drop under the text at the phone tier, and the phone bar's labels drop out by its container query. QA-55's screenshot at the largest system font is the measurement.

## Component Usage

No new component. The surfaces are the shipped ones: the compact `.sr-header`, `.sr-navbar` and the More sheet, `SectionHeader` plus the icon-tile row cards and the quiet-section register in Settings, the Map Explorer FAB cluster and its Filters overlay, the shared load-failure and location-error notes, `RavenGlyph` in the header and nav column, the `index.html` launch frame. The Android system permission dialog is the OS's. Lucide at nav scale (15 to 20px) and in-content scale (11 to 15px), as the design system states.

## Design Tokens Applied

- Launch green: `#2D8653`, the brand green, in three native resources (`ic_launcher_background`, `windowBackground`, `windowSplashScreenBackground`) and the existing `index.html` frame. It is the one hex outside `globals.css` and it is already the one the iOS storyboard and `tauri.conf.json` carry.
- Everything after the first frame: the shipped tokens, both themes, unchanged. The strip under the status bar is `--sr-bg`; the phone bar and the More sheet are `--sr-surface` with `--sr-border` and `--sr-nav-bar-shadow`; the location note is `--sr-error` on `--sr-error-bg`; active nav state is `--sr-accent-bg` plus `--sr-accent` plus weight plus the leading bar.
- No new token. The four `--sr-inset-*` properties and `--sr-ime-open`'s class are layout plumbing set by native code, not design tokens, and are documented at the body rule in `globals.css`.

## Interaction Notes

- Launch: no fixed wait at any step; the splash yields on first draw, the launch frame on React's first paint.
- Keyboard: the webview shrinks natively; Chromium scrolls the focused field into view; the phone bar slides out while the keyboard is up and returns when it closes.
- Back button (OQ-10): the platform default. With nothing in webview history, back backgrounds the app from every screen; Search, Help, the More sheet and popups do not close on back. Recorded as a follow-up idea, not built here.
- Theme: the in-app toggle changes the app's paint under the bars at once, and the page reports the painted theme to native in the same `applyTheme` call, so the status and navigation bar glyphs flip with it (section 2).
- Import: the row button presents the system document picker; cancel changes nothing; a refused file leaves the slot as it was with the existing refusal line.

## Motion Spec

- Phone bar hide under the keyboard: `transform` 160ms, `ease-out`, origin bottom edge; reduced motion: instant (the global block). CSS.
- More sheet rise: unchanged, 220ms ease-out; reduced motion instant. CSS.
- Tab-bar active state: the shipped 120ms / 140ms color and glyph-background eases. CSS.
- Launch handoff: no motion. Splash to window to frame to app are static paints; the frame removes itself instantly, as today. Reduced motion: identical.
- Location note appearance: instant (an alert, never an entrance).
- Android's permission dialog animates by the OS's rule; not ours.
- No new Motion-library use; nothing in this feature needs a spring or a stagger.

## Content Notes

American spelling, no em dashes, the house register. Copy that ships in this feature:

- Import buttons: `Import file…`, `Import new…`, `Importing…` (unchanged iOS strings).
- Rebuild caches result: `Caches cleared. Close and reopen SnowRaven to finish.` (unchanged iOS string).
- Denied location: `Allow location for SnowRaven in Settings → Apps → SnowRaven → Permissions → Location, and make sure Location is turned on, then try again.`
- WebView floor: `SnowRaven needs a newer Android System WebView: update it through your phone's app store or system update, then open SnowRaven again.`
- Help (written without a stop, in the platform passages FR-51 names; no store named anywhere but F-Droid):
  - Where Help names the Apple-only features: `On Android there is no iCloud Sync, no home-screen widget and no Alerts; those are Mac, iPhone and iPad features. Everything else on this page works the same way.`
  - Installing, the two install kinds: `Installs from F-Droid and from the GitHub APK are signed by different keys and do not update each other; switching between them means uninstalling one and installing the other, and your files and keys do not carry over unless you import them again.`
  - Updating: `On Android, updates arrive through the F-Droid client or by installing a newer APK from the GitHub release over the old one, never from inside the app.`
  - Location permission, branch A: add `or Settings → Apps → SnowRaven → Permissions → Location on Android` to the existing route sentence. Then one of two sentences the measurement decides: if step 4 delivers a position, `If you allow only an approximate location, SnowRaven measures from a point that may be a few kilometers off.`; if it does not, `On Android, choose Precise when asked; an approximate location is not enough for a position.` And only if the AOSP-image reading shows it: `On a phone without a network location service, a position can take longer or need a clear view of the sky.`
  - Location, branch B: the route sentence does not name Android; the Map Explorer passage says `On Android, move the map by searching for a place or by setting a Default Location in Settings.` and nothing says location is unavailable.
  - Default Files: `On iPhone, iPad and Android the Settings rows read Import file… and Import new… and open the system file picker.`
  - Every `Mac, Windows, iPhone and iPad apps` list that names where files and keys are stored gains `Android`.
- Not this stage's: the F-Droid listing text (Fastlane), the fdroiddata recipe, the website, README and privacy policy stay held proposals. Nothing in the app, Help or this spec names Google Play.

## Android decisions for The Engineer

One line each, in the order the brief asked.

- **System splash:** API 31+ platform splash, background `#2D8653`, icon `@mipmap/ic_launcher_foreground`, no icon-background color, no branding image, no library, no fixed wait.
- **API 24 to 30:** `windowBackground` is a layer-list of the green with the launcher foreground centered at 108dp.
- **Window background:** the green in `values` and `values-night` alike; dark mode is deliberately not a different launch color.
- **Launch status bar:** `windowLightStatusBar=false` in both splash themes (light glyphs over green).
- **WebView floor message:** the sentence in Content Notes, in `#sr-launch-status`, Reload hidden.
- **Adaptive icon:** foreground raven mark over `@color/ic_launcher_background`; hdpi bucket regenerated per schema 3.5; store icon from the opaque 512 source.
- **Inset mechanism:** option (b): `onWebViewCreate` listener, `--sr-inset-top/right/bottom/left` in CSS px from `systemBars() | displayCutout()`, set on `documentElement`.
- **Root marker:** `sr-android-app` on `<html>` from `main.tsx` when `isAndroid()`; `sr-ios-app` never on Android.
- **Inset rules:** one `.sr-android-app` twin per `.sr-ios-app` rule, same selectors, `var(--sr-inset-X, 0px)` for `env()`, never `env()`; the inbox rules get no twin.
- **Status and navigation bar glyphs:** the webview reports the painted theme (`light` or `dark`) through `WebViewCompat.addWebMessageListener(webView, "srAndroid", setOf("http://tauri.localhost"), ...)`, registered in the same `onWebViewCreate` override as the insets listener; the listener sets `isAppearanceLightStatusBars` and `isAppearanceLightNavigationBars` to `theme == "light"`. Sent from `applyTheme()` on first paint, on every Appearance change, and on a system flip while open in the System setting (one new `prefers-color-scheme` change listener in `App.tsx`). Status bar follows on every supported API (23+); navigation bar follows on API 26+, and on 24 and 25 keeps `enableEdgeToEdge()`'s dark scrim with light glyphs. Before the first report, the `values-night` resource default stands.
- **Keyboard:** `ime()` applied natively as bottom padding on the webview; `sr-ime-open` root class toggled in the same callback; the phone bar slides out under that class.
- **Compact chrome:** yes; `compactChrome()` is `isMobileApp()`; same breakpoints, phone density only; the map panel class stays.
- **Map fullscreen:** the iOS reading on `isMobileApp() && isFullscreen`; the panel pads top/left/right from the variables, the FAB cluster pads bottom.
- **Location, branch A:** no pre-prompt; the system dialog on first press from the WebView's own `navigator.geolocation` (no plugin, nothing of Google's); the denied sentence in Content Notes; `enableHighAccuracy: true` on Android; Chromium's own ten-second timeout.
- **Location, branch B (the default until the measurement lifts it):** the five controls absent through `showLocationControls()`; the FAB row closes up (share, Filters, fullscreen); the sidebar place search takes the full row; the Default Location card is description, fields, Save; the Targets chooser opens on Default Location and place search; no sentence names location on Android.
- **Settings:** API Keys, Default Files (Import wording), Help, Appearance, Sharing, Default Location, Tab Layout, eBird bar-chart files, Troubleshooting (Rebuild caches, close-and-reopen sentence), Acknowledgments; nothing else and no placeholder.
- **Help sentences:** as in Content Notes, written without a stop.
- **Tablet:** the wide layout by the existing measured-width rule; no tablet-specific reading; insets on body and nav column.
- **System font scale:** honored through the WebView's default text zoom on top of the in-app Text Size; not disabled.
- **Back button:** platform default; follow-up idea recorded.

## Measurements the Engineer owes on an emulator

Everything above that came from reasoning rather than a measurement, with the number to replace it:

1. **Inset values.** The actual `--sr-inset-top` (status bar, and with a cutout emulated), `--sr-inset-bottom` under gesture and under three-button navigation, and the side insets in landscape with a cutout, on the API 36 image. The mockup assumes 24 / 24 / 48 dp; the design holds whatever the device reports.
2. **First-frame timing of the insets.** Whether the first listener callback lands before the first paint of `#root`. If the un-inset frame is visible for more than one frame, the Engineer sets the four variables from `activity.window.decorView.rootWindowInsets` synchronously in `onWebViewCreate` before the page loads, so the launch frame already carries them.
3. **Splash to launch-frame handoff.** A frame sequence from the icon tap: no white or light frame anywhere (QA-31, QA-32, light and dark); and how far the splash icon's plate differs in size from the 88px frame mark, so the two feel like one raven. If the jump is visible, the frame's mark size on Android may be set to match the splash plate's inner size; the Engineer reports the two measured sizes before changing anything.
4. **API 24 to 30 layer-list.** That the centered foreground renders at the intended size on the API 24 image and does not stretch.
5. **Keyboard.** With the webview padded by the IME inset: the focused Species Detail search and the Settings key field scroll into view with no field under the keys; the phone bar is off screen; `100dvh` surfaces (More sheet open, then focus the palette's field; the fullscreen map's filters address search) shrink rather than hide the field; the bar returns on close. Measured on a phone-size emulator in both orientations.
6. **Bar glyph contrast follows the painted theme.** On the API 24, API 30 and current-API emulators, with the system theme set opposite to the in-app theme (system dark with in-app Light, then system light with in-app Dark): a screenshot of each showing both bars, confirming status-bar glyphs match the in-app theme on all three, navigation-bar glyphs match it on 30 and current and stay light over the dark scrim on 24; plus one screenshot taken after flipping the system theme with the app open in the System setting, showing the page and both bars changed together; and one taken during the launch frame, showing light glyphs over the green before the first report.
7. **Map fullscreen under a cutout.** Both orientations with the cutout developer option on: pills, Filters overlay, corner buttons and the FAB cluster all clear (QA-19).
8. **Largest system font.** The Settings tab end to end at the emulator's largest font scale, with the in-app Text Size at 100% and again at 200%, no clipped label and no horizontal overflow (QA-55); and what the WebView's text zoom actually does to rem-sized boxes, since the design assumes rems follow it.
9. **Three-button nav on API 24 to 28.** That the translucent scrim `enableEdgeToEdge()` draws there reads acceptably over the phone bar.
10. **The location branch.** The schema 4.6 nine-step table on the `google_apis` API 36 image decides A or B and is recorded before the location path is touched; its step 4 (Approximate) decides which Help sentence ships, and the AOSP `default` image run decides whether the no-network-provider sentence ships. Under B, one screenshot each of the Map Explorer (FAB row with no locate disc, flush right), the filters sidebar, the Settings Default Location card and the Targets anchor chooser, confirming nothing says location is unavailable and no blank band remains where a control was.
11. **The floor message on a store-less image.** The FR-33 sentence screenshotted on the API 24 image, read once by someone who does not know which store the device has, confirming it tells them where to look without naming one.
