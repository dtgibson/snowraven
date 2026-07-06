# PR — Mobile App (iOS + iPadOS), Stage 5 implementation

## Mobile App (iOS + iPadOS)

### What this does

Makes the existing SnowRaven codebase buildable as a universal iOS/iPadOS app
(Tauri v2 mobile target on the existing crate) with every platform-conditional
behavior seam-gated: the in-app updater is absent from the iOS binary AND its
UI (FR-14), the Tier B offline-maps section is hidden (FR-15/23), CSV import
presents the native document picker with the approved "Import" wording
(FR-08..13), "Use my location" works via the mobile geolocation plugin
(FR-16), map fullscreen on iOS hides the sidebar at any width with the
Filters FAB appearing (design-review decision), and the top chrome compacts
on iOS so the Map Explorer lands above the fold (preview-driven fixes,
user-confirmed on both simulators). Desktop and web behavior is
byte-equivalent except the explicit seam branches (all `isIOS()` returns false
there) plus one desktop binary delta: the `tauri-plugin-os` registration that
backs the seam.

### Change map

**Platform seam**
- `frontend/src/lib/platform.ts` — `isIOS()` via `@tauri-apps/plugin-os`
  sync `platform()` (V1 verified against the installed package: sync in v2).
  Capability branching only — layout stays window-size-driven.
- `frontend/src/lib/platformGates.ts` (new) — FOUR named gates:
  `showUpdaterFooter()` (FR-14), `showOfflineMapsSection()` (FR-15/23),
  `supportsAppRelaunch()` (QA round-1 fix, below), and `compactChrome()`
  (preview-driven composition fixes, below). NOTE: the offline-maps gate is
  `!isIOS()`, deliberately NOT the schema's literal `isTauri() && !isIOS()`,
  because web currently renders the section (disabled toggle + honest note)
  and the PRD forbids web behavior changes.

**Updater removal (FR-14, two layers)**
- `src-tauri/Cargo.toml` — `tauri-plugin-updater`/`tauri-plugin-process`
  moved to `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`.
- `src-tauri/src/lib.rs` — their registrations are `#[cfg(desktop)]`;
  `tauri_plugin_os` registered on all platforms; `#[cfg(mobile)]` registers
  geolocation + dialog.
- `frontend/src/components/UpdateFooter.tsx` (new) — the footer update
  affordance extracted VERBATIM from App.tsx (check button, install button,
  always-mounted live region, progressbar); renders `null` on iOS. App.tsx
  consumes it; the `UpdateStatus` type moved with it.

**Rebuild caches on iOS (QA round-1 fix, `supportsAppRelaunch()`)**
- Settings → Troubleshooting → "Rebuild caches & restart" previously called
  plugin-process `relaunch()` behind a bare `isTauri()` gate — on iOS the
  plugin isn't compiled in (and iOS forbids programmatic relaunch), so the
  rejection stranded the button at "Restarting…" with no recovery.
- `Settings.tsx` `RebuildCachesButton` now branches on `supportsAppRelaunch()`
  (`!isIOS()`): iOS keeps the valuable half (the taxonomy-IndexedDB delete),
  shows "Rebuild caches" / "Clearing…" copy, then a role=status "Caches
  cleared — close and reopen SnowRaven to finish." The section intro copy
  branches the same way. The desktop path additionally gained a try/catch
  around the relaunch import/call (role=alert fallback) so NO platform can
  strand the button anymore.

**File import (FR-08..13, schema §2.6)**
- Mechanism A (primary, `IOS_IMPORT_MECHANISM = 'input'` in
  `frontend/src/lib/iosImport.ts`): the existing `<input type="file">` —
  WebKit presents the native picker on iOS. Zero new import code runs.
  V2 CLOSED: the user verified the picker presents on the iPhone simulator
  (decisions.md), so `'input'` is confirmed, not provisional.
- Mechanism B (ratified fallback, one-line switch to `'dialog'`):
  plugin-dialog `open()` → plugin-fs `readTextFile` → the SAME shared tail.
  Rust registration + `dialog:allow-open` grant are already in place so the
  flip needs no further change; the grant/dep are deliberately KEPT as the
  sanctioned fallback for TestFlight device-vs-simulator divergence
  (decisions.md; the Auditor assesses the grant).
- `Settings.tsx` — `handleUpload` tail extracted into `importFileContent`
  (extension guard → `storage.writeFile` → cache invalidation → metadata
  refresh) so both mechanisms share persistence/replace/error semantics;
  `FileRow` gained `onNativePick`; button copy through
  `fileRowButtonLabel()` (`lib/fileRowCopy.ts`) — "Import file…" /
  "Import new…" / "Importing…" on iOS, "Upload…" unchanged elsewhere.

**Geolocation (FR-16, schema §2.7)**
- `frontend/src/lib/location.ts` — iOS branch before the desktop dev-mode
  guard: dynamic `import('@tauri-apps/plugin-geolocation')`, check →
  request → getCurrentPosition, mapped onto the existing `LocationError`
  codes; `describeLocationError` gained the iOS Settings-app wording.
  Desktop macOS/Windows native paths untouched.
- QA round fix: the plugin-failure catch arm now matches the strings the
  installed plugin (2.3.2) ACTUALLY rejects with (verified in its iOS Swift
  source) — `"Location services are not enabled."` (the global Location
  Services switch off) routes to `permission-denied` so the iOS
  Settings-app guidance fires; CLError `localizedDescription` and the
  empty-array reject honestly map to the generic `unavailable`. The dead
  `timeout` arm was dropped (the plugin ignores the timeout option on iOS).
- `src-tauri/capabilities/mobile.json` (new) — the three geolocation grants
  (+ `dialog:allow-open` for Mechanism B), `platforms: ["iOS"]`.

**Capabilities split (schema §2.8)**
- `default.json` — updater/process grants removed; `os:allow-platform`
  added; everything else unchanged.
- `desktop.json` (new) — updater/process grants, `platforms: ["macOS","windows","linux"]`.

**iOS map fullscreen (design review)**
- `frontend/src/lib/mapFullscreen.ts` (new) + `MapExplorer.tsx` — the
  `.sr-map-content` div gains `sr-map-ios-fullscreen` only when
  `isIOS() && isFullscreen`.
- `globals.css` — `.sr-map-ios-fullscreen` rules mirror the ≤640 phone-tier
  block (sidebar → overlay, Filters FAB + backdrop + close header shown).
  QA round fix: the fullscreen sidebar overlay carries
  `padding-left: env(safe-area-inset-left)` — the fullscreen panel is
  `position:fixed inset:0` (bypasses the body insets), so without it the
  overlay's header/controls sat under the sensor housing in landscape.

**Compact chrome + map above the fold (preview-driven, `compactChrome()`)**
User-requested at the live simulator preview, user-confirmed on both
simulators (decisions.md). Both ride ONE predicate deliberately — the
panel-height budget assumes the compact header — and desktop/web never carry
either class.
- `App.tsx` — the brand header collapses to a slim single-line bar on iOS:
  `.sr-header.sr-header-compact`, 20px logo + 1.125rem wordmark, tagline
  dropped (decorative; the wordmark stays the `<h1>` in the banner
  landmark). ~176 lines of App.tsx also moved out via the UpdateFooter
  extraction above.
- `App.tsx` + `globals.css` — the Map Explorer panel sizes to the visible
  viewport on iOS: `.sr-map-explorer-panel.sr-map-panel-ios`,
  `height: calc(100dvh − 112px − env(safe-area-inset-top))` (budget =
  compact header ~42px + tab nav ~66px), `min-height: 300px` for short
  landscape-phone viewports — so the map AND its FAB cluster are above the
  fold on tab open.

**Safe areas (NFR-07, gated — QA round-1 fix)**
- `globals.css` — body top/side `env(safe-area-inset-*)` padding, the
  `.sr-app-footer` home-indicator bottom inset, and the
  `.sr-map-fab-cluster` bottom/right insets all hang off an `.sr-ios-app`
  scope class.
- `frontend/src/main.tsx` — sets `sr-ios-app` on `<html>` synchronously
  before render, only when `isIOS()`. Rationale: `index.html` ships
  `viewport-fit=cover` to browsers too, so env() is NOT zero on the web
  build in iOS Safari — ungated rules (the initial pass) would have changed
  the shipped web rendering on notched phones. Gating restores byte-parity:
  desktop is env()=0 either way; web/Pi never gets the class. The footer
  padding lift into `.sr-app-footer` keeps values identical to the old
  inline style, so desktop/web render byte-identically.

**Config**
- `tauri.conf.json` — `bundle.iOS.minimumSystemVersion: "16.0"` (OQ-01).
  `developmentTeam` intentionally NOT committed — supply via
  `APPLE_DEVELOPMENT_TEAM` env at ios init/build (Deployer).
- `src-tauri/Info.ios.plist` (new) — `NSLocationWhenInUseUsageDescription`,
  `ITSAppUsesNonExemptEncryption=false`; deliberately NO Files-app exposure
  keys, NO ATS exceptions. Merged onto the generated iOS plist by Tauri.
- `frontend/vite.config.ts` — `TAURI_DEV_HOST` pattern for physical-device
  dev; simulator/web dev unchanged (`host: false` when unset).

### Tests (all green: 119 files / 1468 tests)

New: `isIOS.test.ts` (seam, plugin mocked both ways), `platformGates.test.ts`
(all four gates, isIOS mocked both ways), `UpdateFooter.test.tsx` (iOS renders
nothing incl. the "available" state; desktop/web DOM preserved),
`fileRowCopy.test.ts` (approved wording verbatim, both platforms),
`mapIosFullscreen.test.ts` (pure class decision + parse-the-stylesheet rules +
seam wiring in MapExplorer source; the stylesheet matcher strips `@media`
blocks first so the "works at ANY width" guarantee is ENFORCED — relocating
the rules into the ≤640 tier fails the suite), `iosChrome.test.ts` (compact
header + map-panel rules in globals.css; App.tsx wiring locked structurally —
the map-panel class must appear as the `compactChrome()` ternary arm and
never unconditionally in ANY quote style, and the tagline guard is anchored
to the tagline's own copy).
Extended: `entryChunk.test.ts` (geolocation/dialog plugins must stay
dynamic-only), `location.test.ts` (iOS permission-denied wording + the iOS
plugin-error mapping exercised end-to-end with the EXACT reject strings the
installed 2.3.2 Swift plugin emits — master-switch-off → permission-denied
with Settings guidance; CLError/empty-array → honest generic unavailable),
`Settings.test.tsx` (platform mock converted to flippable vi.fn()s + an iOS
wiring suite: Import copy on the real file rows, Mechanism B dispatch to the
native picker with cancel as a clean no-op, Mechanism A never touching the
dialog, Offline-maps true absence, and the iOS Rebuild-caches flow —
close-and-reopen copy, cleared status, button never stranded, relaunch()
never called).

### Notes for reviewer

- **No version bump, no CHANGELOG entry** — nothing ships publicly this run
  (phased-announcement decision); the Deployer/Chronicler own TestFlight
  build versioning.
- **Public surfaces untouched and grep-verified silent** on mobile (QA-27):
  README, website/, docs/HELP.md, PRIVACY_POLICY.md, ACCESSIBILITY.md. The
  App Store privacy material is in `pipeline/mobile-app/privacy-labels.md`
  (package only).
- **Desktop parity:** cargo check (desktop) green; the desktop dependency
  tree still carries updater/process and does NOT carry geolocation/dialog
  (verified with `cargo tree` per target). The only desktop deltas are the
  plugin-os registration + the `os:allow-platform` grant + the UpdateFooter
  extraction (DOM-identical render) + the RebuildCaches try/catch hardening
  (identical happy path; the failure path now resets instead of stranding).
- **QA round summary:** round 1 confirmed 10 findings (2 major / 7 minor /
  1 nit) — the majors were the iOS-stranded RebuildCaches button and this
  document's staleness; all 10 are fixed (the code fixes are folded into the
  sections above; the test-guard findings hardened `mapIosFullscreen.test.ts`,
  `iosChrome.test.ts`, `Settings.test.tsx`, and `location.test.ts` as
  described under Tests).
- **`gen/apple` is generated, committed, and BUILDS**: `tauri ios init`
  succeeded (Xcode 26.6 via `DEVELOPER_DIR`, CocoaPods 1.16.2), and
  `npx tauri ios build --debug --target aarch64-sim --no-sign` produced
  `src-tauri/gen/apple/build/arm64-sim/SnowRaven.app` (arm64,
  `com.snowraven`, MinimumOSVersion 16.0, the `Info.ios.plist` merge
  verified in the built bundle). The app was installed and launched on an
  iPhone 17 Pro AND an iPad Air 11-inch simulator (iOS 26.5) — launch
  screenshots in `pipeline/mobile-app/sim-verify/`; the iPad runs on the
  native canvas (TARGETED_DEVICE_FAMILY "1,2" took effect, no letterbox).
  Committed under `gen/apple`: project.yml, pbxproj, scheme, Info.plist,
  entitlements, ExportOptions, Podfile, LaunchScreen, icons, Sources, and
  the init-dropped `.gitignore` (xcuserdata/build/Externals stay ignored);
  the repo root `.gitignore` was narrowed from `src-tauri/gen/` to
  `src-tauri/gen/schemas/`. Root `package.json` gained the `"tauri":
  "tauri"` script the generated Xcode pre-build phase requires
  (`npm run -- tauri ios xcode-script`).
- **Machine quirk for the Deployer:** `xcode-select` still points at
  CommandLineTools; `tauri ios build`/`ios dev` scrub `DEVELOPER_DIR` from
  the xcodebuild they spawn, so either run the one-time
  `sudo xcode-select -s /Applications/Xcode.app` (user action) or use the
  PATH-wrapper documented in how-to-see.md.
- V2 (input-file picker under wry-iOS) is CLOSED — verified interactively by
  the user on the iPhone simulator; `IOS_IMPORT_MECHANISM` stays `'input'`
  with the one-line flip to `'dialog'` documented (V3 moot unless flipped).
  V5 is resolved against the installed CLI: `--export-method
  app-store-connect | release-testing`, `--build-number <N>` sets
  CFBundleVersion at build time, `--no-sign` skips signing.
