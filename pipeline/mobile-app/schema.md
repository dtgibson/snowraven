# Schema — Mobile App (iOS + iPadOS)
**Feature:** mobile-app
**Date:** 2026-07-04
**Stage:** 3 — The Architect
**Source:** prd.md (approved), strategic-brief.md

---

## Architect assessment — Frontend Only (platform target)

No new data is created, read, updated, or deleted by this feature. The data
layer is byte-identical to desktop: two user-imported CSVs plus JSON settings
files under the storage seam, the IndexedDB taxonomy cache, and the session
caches. Everything below the seam already works on iOS because the seam was
built for exactly this (`tauri-plugin-fs` + `BaseDirectory.AppLocalData`).
This document therefore has two halves:

1. **Data layer: no changes** — with the proof that the existing storage
   semantics satisfy FR-10/11/19/20/21 on iOS unchanged.
2. **The architectural design this feature actually needs** — the iOS/iPadOS
   build path, platform seams, capabilities, and toolchain, which the
   Engineer builds from in Stage 5.

---

## Part 1 — Data layer: no changes

### The existing data model (unchanged, for the record)

All persistent app data lives under `AppLocalData/data/` via `TauriStorage`
(`frontend/src/lib/storage.ts`):

| File | Contents | iOS behavior |
|---|---|---|
| `data/api-keys.json` | eBird + OpenWeather keys | identical — plugin-fs `AppLocalData` resolves inside the app sandbox (`Library/Application Support/<bundle-id>`), persists across relaunch and device restart (FR-19, FR-21) |
| `data/settings.json` | theme, text size, date format, tab layout, map defaults, etc. | identical (FR-20) |
| `data/metadata.json` | uploaded-file metadata (name, size, rows, date) | identical (FR-12's post-import confirmation display is already fed from this) |
| `data/ebird-backup.csv` | eBird export | identical (FR-10) |
| `data/ml-export.csv` | ML export | identical (FR-10) |

Plus: the IndexedDB taxonomy cache (`taxonomy-v2027`, 7-day TTL, with the
bundled snapshot as offline floor — FR-22), and the storage-seam long-TTL
caches (`countyCompletenessCache`, replayStore). WKWebView's default data
store on iOS is persistent; even in a worst-case eviction the taxonomy
bundled floor and live-fetch supersede semantics make the degradation
harmless by design.

### Why FR-10/11/13 come free

`Settings.tsx → handleUpload(slot, file)` reads a JS `File` to text, writes
through `storage.writeFile(slot, content, filename)`, and invalidates the
observation/ML caches (`clearEbirdObservationsCache`, `invalidateHotspotSet`,
`clearMLExportCache`). Any iOS import mechanism that ends in a `File` object
(or a text string) hands the bytes to this exact path — replace-on-reimport
(FR-11), persistence (FR-10), the `.csv` extension guard and error states
(FR-13), and the metadata confirmation (FR-12 second half) are all the
existing code. **No new tables, no migrations, no storage-format changes.**

### iCloud backup

App sandbox `Library/Application Support` is included in iOS device/iCloud
backups by default. The PRD's out-of-scope note ("OS default, no custom
backup/restore") is satisfied by doing nothing.

---

## Part 2 — iOS/iPadOS build architecture

### 2.1 Build path: Tauri v2 mobile target on the existing crate

**Ratified: `tauri ios init` on the existing `src-tauri` crate.** No new
crate, no separate app project. Facts verified against the repo:

- `src-tauri/Cargo.toml` is **already mobile-ready**: `[lib] crate-type =
  ["staticlib", "cdylib", "rlib"]` and `lib.rs` already carries
  `#[cfg_attr(mobile, tauri::mobile_entry_point)] pub fn run()`. No crate
  restructuring needed.
- The macOS-only native stack (`objc2*`, CoreLocation, tokio) is correctly
  scoped `[target.'cfg(target_os = "macos")'.dependencies]` and is NOT pulled
  into an iOS build (iOS is `target_os = "ios"`, not `"macos"`). Same for the
  Windows block. `tzf-rs` (pure Rust, needed by `get_timezone` on iOS for the
  weather feature) and `serde*` compile for iOS as-is.
- `src-tauri/gen/` currently holds only `schemas/`. `tauri ios init`
  generates `src-tauri/gen/apple/` — the Xcode project (`.xcodeproj`,
  `Sources`, `Assets.xcassets`, the iOS `Info.plist`, `ExportOptions.plist`,
  Podfile).

**Committed vs generated:** commit `src-tauri/gen/apple/` (it holds
hand-edited state: Info.plist keys, icons, orientation/device-family
settings, signing config). Tauri's init drops its own `.gitignore` inside for
build products (`build/`, `Pods/` if applicable); respect it and add
`src-tauri/gen/apple/DerivedData` style entries if the init's ignore misses
any. Never hand-edit generated Xcode build phases that `tauri ios` regenerates.

**`tauri.conf.json` changes (design; Engineer applies in Stage 5):**

```jsonc
"bundle": {
  // existing keys unchanged, plus:
  "iOS": {
    "minimumSystemVersion": "16.0",
    "developmentTeam": "<TEAM_ID>"   // or via APPLE_DEVELOPMENT_TEAM env —
                                     // prefer the env/gen-apple signing config if the
                                     // team id shouldn't live in the committed file
  }
}
```

Desktop keys (`updater` plugin config, `createUpdaterArtifacts`, macOS
entitlements, windows/window sizes) stay untouched — mobile ignores the
`app.windows` sizing and the updater plugin is not registered on iOS (2.8).

**Vite dev-server change for physical-device dev** (`frontend/vite.config.ts`):
the standard Tauri v2 mobile pattern — honor `TAURI_DEV_HOST`:

```ts
const host = process.env.TAURI_DEV_HOST;
server: {
  host: host || false,
  hmr: host ? { protocol: 'ws', host, port: 5183 } : undefined,
  // existing proxy block unchanged
}
```

Simulator dev works against plain `localhost:5173` (simulator shares the
host network); `--host` is only for on-device dev. The existing backend
proxy block is dev-web-only and unaffected.

### 2.2 OS floor — OQ-01 ratified: **iOS/iPadOS 16.0**

Driven by the web-platform features the shipped CSS actually uses, checked
against WebKit availability (WKWebView tracks the OS version):

| Feature in use | Where | WebKit floor |
|---|---|---|
| CSS container queries (`container-type`, `@container`) | `.sr-cal-minimonth` day-number gate (v0.5.60) | **16.0** |
| `dvh` units | `.sr-map-explorer-panel`, `.sr-map-popup-body`, fullscreen map | 15.4 |
| `overscroll-behavior` | map popup body, overlays | **16.0** |
| `inert` attribute | collapsed panels, decorative charts | 15.5 |
| `matchMedia` + `useSyncExternalStore` | `useIsPhone` | ancient |

Container queries and `overscroll-behavior` set the floor at 16.0. Tauri v2's
iOS support (default `minimumSystemVersion` 13.0) is comfortably below it, so
the app's own CSS is the binding constraint — set `minimumSystemVersion:
"16.0"`. iOS 16 also covers every iPhone from the 8/X up and iPads back to
2015-era hardware; it is not a meaningful audience restriction for a 2026
TestFlight-first app. If device verification surfaces a WebKit 16.0-specific
defect, bumping to 16.4 is a logged decision, not a redesign.

### 2.3 Device families and orientations — OQ-06 ratified

- `TARGETED_DEVICE_FAMILY = 1,2` (iPhone + iPad) in the gen/apple project —
  one universal target (FR-01). Never "iPad = scaled iPhone" (FR-04): with
  device family 2 declared and the responsive tiers keying off real window
  size, iPad renders natively, including Split View / Slide Over resizes
  (FR-03 comes from the existing CSS-tier + `useIsPhone` matchMedia system by
  construction).
- Orientations: iPad — all four (Split View support effectively requires
  it). iPhone — portrait + landscape-left/right, no upside-down (**OQ-06:
  landscape allowed**, per the PRD default; lock to portrait only if
  verification finds a real defect, logged as a decision).
- `UILaunchScreen` (storyboard-less launch screen dict) comes with the
  generated project; keep it a plain background-colored launch screen — it
  should read as the app background token, not a white flash (the anti-flash
  theme script runs at WebView start, so match the launch screen background
  to the neutral surface).

### 2.4 Bundle identity — OQ-02 ratified: **`com.snowraven`, display name "SnowRaven"**

`tauri.conf.json` already declares `identifier: "com.snowraven"` — the same
id the notarized (Developer-ID, non-App-Store) Mac app uses. Reusing it for
iOS is correct: nothing else occupies it in App Store Connect (the Mac app
has never been submitted there), the id is well-formed reverse-DNS, and
sharing it keeps the door open for universal-purchase later.

**User-account step (flag for the Deployer):** registering the explicit App
ID `com.snowraven` in the developer portal and creating the App Store
Connect app record are actions on the user's Apple account, outside the
Engineer's stage. If App Store Connect rejects the id (edge case: name/id
collision), the fallback is `com.snowraven.ios` — a config-only change.

### 2.5 Platform-detection seam: `isIOS()` in `platform.ts`

**Ratified: extend the existing seam file — `frontend/src/lib/platform.ts`
gains `isIOS()`; every platform-conditional surface branches through it.**
No ad-hoc user-agent sniffing anywhere (explicitly ruled out: iPadOS
WKWebView reports a desktop-Safari "Macintosh" UA by default, so UA checks
are unreliable on exactly the device family we care about).

**Mechanism:** `@tauri-apps/plugin-os` (`tauri-plugin-os` crate), registered
on all platforms (one `.plugin(tauri_plugin_os::init())` line — inert on
desktop, and this feature ships a version bump anyway), with the
`os:allow-platform` permission granted in the shared capability.
`platform()` from `@tauri-apps/plugin-os` is synchronous in v2 (reads
injected internals), giving a clean sync predicate:

```ts
export function isIOS(): boolean {
  if (!isTauri()) return false;
  try { return platform() === 'ios'; } catch { return false; }
}
```

`platform()` returns `'ios'` on both iPhone and iPadOS — one predicate covers
FR-14/15's "iOS/iPadOS". Device-family styling never uses it: layout stays
window-size-driven (`useIsPhone`, CSS tiers), per the brief's key decision.
`isIOS()` exists only for *capability* branching. (⚠ Engineer verify-item V1:
confirm sync `platform()` against the installed plugin version; if async in
practice, resolve once at module init into a constant before first render —
the seam's public signature stays sync either way.)

**The complete conditional-surfaces list** (every `isIOS()` call site — keep
it this short):

| # | Surface | File | Rule on iOS |
|---|---|---|---|
| 1 | Updater footer block: "Check For Updates", install button, update live region | `App.tsx` (footer, ~line 1280–1360) | entire block absent (FR-14); no `updateManager` dynamic import ever runs |
| 2 | Offline-maps region manager | `Settings.tsx` (~line 1448 `isTauri()` gate) + `OfflineMapsSection.tsx` | gate becomes `isTauri() && !isIOS()` (FR-15, FR-23); `regionDownload.ts` untouched (unreachable) |
| 3 | File import surface | `Settings.tsx` `FileRow` | native document picker path (2.6) (FR-12) |
| 4 | "Use my location" | `lib/location.ts` | iOS branch before the desktop `invoke('get_location')` path (2.7) (FR-16); `describeLocationError` gains the iOS Settings-app wording for `permission-denied` |
| 5 | Location dev-mode guard | `lib/location.ts` | the `import.meta.env.DEV → 'dev-mode'` throw stays desktop-only; iOS dev uses the real plugin |

Not conditional (verified they need no branch): `clipboard.ts` (the
clipboard-manager plugin supports iOS; the existing
`clipboard-manager:allow-write-text` grant carries — FR-17 comes free,
including copy-after-await, which is the whole reason the seam exists),
`transport.ts` (TauriTransport routes to the TS services identically —
FR-18), Settings copy strings ("stored in this app's local data directory"
is true on iOS), theme/text-size/tab-layout (storage seam, FR-20).

### 2.6 File import — the one new mobile UX (FR-08/09/12/13)

**Design: two mechanisms, verify-ordered. The bytes always end in the
existing `handleUpload` → `storage.writeFile` path, so persistence, replace,
cache-invalidation, error, and metadata semantics are inherited, not
rebuilt.**

**Mechanism A — verify first (zero new code):** the existing
`<input type="file" accept=".csv">` in `FileRow`. On iOS, WebKit itself
presents the native document picker for file inputs (`UIDocumentPicker` via
the Files sheet) — no `WKUIDelegate` implementation required, unlike the
macOS gap recorded in DECISIONS.md (that delegate hole was macOS-specific;
wry-iOS rides WebKit's built-in file-chooser handling). If the simulator
smoke shows the picker presenting and `file.text()` returning content, this
IS the ship path: FR-12's "native document picker, no inert web input" is
satisfied because the presented UI is the native picker; cancel = no change
event = clean no-op (FR-13); everything downstream is untouched code.
(⚠ Engineer verify-item V2 — first thing to check in the simulator.)

**Mechanism B — ratified fallback if A fails under wry-iOS:**
`@tauri-apps/plugin-dialog` (`tauri-plugin-dialog` crate, mobile
registration), whose iOS `open()` presents `UIDocumentPickerViewController`.
Flow: `open({ filters: [{ extensions: ['csv'] }] })` → picked path → read
text via `@tauri-apps/plugin-fs` `readTextFile` → hand the string to a
thin adapter that calls the same `storage.writeFile(slot, content, name)` +
cache invalidations `handleUpload` performs (extract that tail into a shared
helper rather than duplicating). `open()` resolving `null` = cancel = no-op.
Capability grants: `dialog:allow-open` plus the fs read scope for the picked
path. (⚠ Engineer verify-item V3: confirm on the installed Tauri version
that a dialog-picked iOS path is readable via plugin-fs — the desktop
behavior of auto-extending fs scope to picked files needs confirming on the
mobile path; if it isn't, `readFile` through the dialog plugin's own return
or a `fs:scope` addition is the adjustment.)

Either way `FileRow`'s platform branch is chosen through `isIOS()` (surface
#3), and QA-08/09/10/11/12 exercise the result.

### 2.7 Geolocation — OQ-04 ratified: mobile plugin, iOS-only, desktop untouched

The v0.5.55 removal note priced re-adding at ~3 lines "if the mobile app is
Tauri-based" — it is, so:

- **Cargo:** `tauri-plugin-geolocation = "2"` under
  `[target.'cfg(any(target_os = "android", target_os = "ios"))'.dependencies]`
  — the desktop binary's dependency graph is untouched (the 2026-05-26
  decision stands: this plugin is a no-op stub on desktop; the native
  `get_location` commands stay the desktop path, byte-identical).
- **lib.rs:** `#[cfg(mobile)] { builder = builder.plugin(tauri_plugin_geolocation::init()); }`.
- **JS:** `lib/location.ts` gains the iOS branch (surface #4): dynamic
  `import('@tauri-apps/plugin-geolocation')` (keeps it off the entry chunk
  and out of desktop/web bundles' execution path), then
  `checkPermissions()` → `requestPermissions(['location'])` if needed →
  `getCurrentPosition()`; map the plugin's denial/failure shapes onto the
  existing `LocationError` codes so `describeLocationError` and every caller
  (Map Explorer, Settings default-location) work unchanged. Denial degrades
  exactly as FR-16 requires because the callers already handle
  `permission-denied` (add the iOS wording: "Allow location for SnowRaven in
  Settings → Privacy & Security → Location Services").
- **Capabilities (mobile-only file, see 2.8):** the three grants removed in
  v0.5.55 come back, mobile-scoped: `geolocation:allow-check-permissions`,
  `geolocation:allow-request-permissions`,
  `geolocation:allow-get-current-position`.
- **Info.plist (gen/apple):** `NSLocationWhenInUseUsageDescription` — reuse
  the existing string from `src-tauri/Info.plist` ("SnowRaven uses your
  location to center the map on your current position."). Note the existing
  `src-tauri/Info.plist` feeds the macOS bundle; the iOS one lives in
  `gen/apple` and needs its own entry. When-in-use only; no background
  location, no Always key.

### 2.8 Capabilities and native-plugin partitioning

**Capability files** (`src-tauri/capabilities/`) — split by platform using
the `platforms` field; the current single `default.json` has no `platforms`
key (= all platforms), which is wrong once iOS exists:

| File | `platforms` | Permissions |
|---|---|---|
| `default.json` (existing, trimmed) | *(omit — all platforms)* | `core:default`, window/webview basics, `opener:default`, `http:default` + `http:allow-fetch https://**`, `clipboard-manager:allow-write-text`, all nine `fs:*` `$APPLOCALDATA/**` grants, **add `os:allow-platform`** |
| `desktop.json` (new) | `["macOS","windows","linux"]` | `updater:default`, `process:allow-restart`, `process:allow-exit` |
| `mobile.json` (new) | `["iOS"]` | the three `geolocation:*` grants; `dialog:allow-open` **only if Mechanism B is needed** |

**Rust plugin registration (lib.rs):** `tauri_plugin_updater` and
`tauri_plugin_process` become `#[cfg(desktop)]` registrations, and their
Cargo entries move to
`[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]`
— the updater is desktop-only in Tauri v2 and must not ship in the iOS
binary (FR-14's "no self-update capability" holds at the binary level, which
is also the App Review posture). (⚠ V4: `keyring` is a dead dependency on
every platform — the commands are registered but never invoked; CLAUDE.md
bans Keychain use. keyring v3 nominally supports iOS, so it should compile;
if the iOS build fights it, cfg-gating the keyring commands to desktop is
the sanctioned fix — desktop binary unchanged by a `#[cfg(desktop)]` gate.)

**Info.plist keys (gen/apple) — the complete set:**

- `NSLocationWhenInUseUsageDescription` — per 2.7. The ONLY usage-description
  key: no camera, mic, photos, contacts, Bluetooth, tracking.
- `ITSAppUsesNonExemptEncryption = false` — standard HTTPS only; skips the
  export-compliance question on every TestFlight upload.
- **`UIFileSharingEnabled` and `LSSupportsOpeningDocumentsInPlace`: ratified
  OMIT (both absent).** Justification: (a) the PRD's out-of-scope list
  explicitly excludes open-in-place and acting as a Files location; (b) the
  app's data dir contains `data/api-keys.json` in plaintext — exposing the
  sandbox in the Files app would expose the user's API keys to casual
  browsing and third-party file apps. Import is picker-only, by design and
  by privacy posture.
- **ATS: default — no exceptions.** Every provider in PRIVACY_POLICY.md is
  HTTPS (eBird, OpenWeather, Nominatim, NOAA, OpenFreeMap style/glyphs/
  tiles, Esri, USGS, Waymarked Trails), verified against `mapStyle.ts` and
  the service layer — no `http:` URLs in the outbound set, and the
  capability layer already pins `http:allow-fetch` to `https://**`. No
  `NSAppTransportSecurity` dict at all.

### 2.9 Updater gating — FR-14

Two layers, both required:

1. **Binary:** updater/process plugins absent from the iOS build (2.8) — the
   capability isn't just hidden, it doesn't exist. QA-13's "no self-update
   capability" is structurally true.
2. **UI:** the App.tsx footer updater block (surface #1) renders `null` on
   `isIOS()` — no "Check For Updates" affordance, no live region, no dynamic
   import of `updateManager.ts`. The web branch (`./update.sh` instructions)
   and desktop branch are untouched. Optional copy pointing at the App Store
   is allowed by FR-14 but not required; recommend omitting for v1
   (TestFlight manages its own update prompts).

`updateManager.ts` itself is untouched — it's already a lazy import, so it
never enters the iOS execution path (and NFR-06's chunk discipline keeps it
off first paint everywhere).

### 2.10 WKWebView posture (already paid for, carry it)

- The iOS-specific web quirks are pre-solved: clipboard seam (WKWebView
  user-activation, FR-17), `.sr-input-16` (focus-zoom, NFR-03, made binding
  app-wide in v0.5.61), `viewport-fit=cover` already in `index.html`
  (NFR-07), 44px touch targets (NFR-02), 320px/200% invariant (NFR-09).
- **Safe areas (NFR-07):** `viewport-fit=cover` is set, but the app has
  never actually rendered under a notch — the Engineer should expect to add
  `env(safe-area-inset-*)` padding to the fixed chrome (TabNav, `.sr-map-fab-cluster`,
  the fullscreen map overlay's `inset: 0`, map popups near edges) as a
  globals.css pass. This is styling within existing conventions, not new
  design.
- **Memory (NFR-08):** WKWebView on iPad gets jetsam-limited; the protections
  are the existing disciplines — single-map-context structure (single-open
  accordion), lazy maplibre vendor chunk, viewport-capped overlays. No new
  mechanism; QA-35 (Split View resize with Map Explorer + overlays) is the
  gate. If it fails, the fix conversation starts at overlay caps, not
  architecture.
- **Chunk discipline (NFR-06):** `entryChunk.test.ts` runs unchanged — the
  iOS bundle is the same `frontend/dist`. Nothing in this design adds a
  static import to the entry graph (geolocation and any dialog usage are
  dynamic imports behind `isIOS()`).

### 2.11 What does NOT change

- **Desktop (macOS/Windows) and web/Pi builds:** byte-equivalent except the
  explicit platform branches above (`isIOS()` returns false everywhere it
  runs today; plugin-os registration is the only desktop binary delta, plus
  the desktop-cfg moves which are compile-time no-ops for desktop).
- **`release.sh`:** untouched. iOS distribution is a NEW, separate path
  (Xcode/`tauri ios build` → App Store Connect upload → TestFlight). Desktop
  releases, the Windows CI workflow, `latest.json`, minisign — all exactly
  as they are.
- **Python backend:** untouched; iOS runs the TauriTransport TS services,
  no Python on device, same as desktop.
- **Data model, storage formats, caches:** untouched (Part 1).
- **Versioning:** iOS shares `tauri.conf.json`'s `version` (it becomes
  `CFBundleShortVersionString` for the iOS bundle too) — the existing
  bump-both rule already covers it; iOS adds a build number
  (`CFBundleVersion`) managed at upload time via `tauri ios build` /
  ExportOptions, not a third file to bump in lockstep.

---

## Migration / Setup (ordered — Engineer Stage 5 preamble)

1. **Toolchain (Hephaestus, one-time; Deployer preflights the same list):**
   full Xcode (not just CLT) with the iOS SDK + at least one iOS simulator
   runtime installed; `xcode-select -p` → Xcode.app; accept license.
   `rustup target add aarch64-apple-ios aarch64-apple-ios-sim`
   (add `x86_64-apple-ios` only if an Intel simulator is ever needed —
   Hephaestus is Apple Silicon). CocoaPods installed (`brew install
   cocoapods`) — Tauri's iOS template uses it. Apple Development signing
   cert present for on-device dev (the account already holds Developer ID
   for notarization; iOS dev/distribution certs are a separate type).
2. `npx tauri ios init` → generates `src-tauri/gen/apple/`; commit it
   (respecting its internal .gitignore).
3. Apply config: `bundle.iOS.minimumSystemVersion "16.0"` (+ team id
   decision) in `tauri.conf.json`; `TAURI_DEV_HOST` pattern in
   `frontend/vite.config.ts`; gen/apple project: device family 1,2,
   orientations per 2.3, Info.plist keys per 2.8.
4. Cargo/lib.rs: move updater/process deps to the not-mobile target section
   + `#[cfg(desktop)]` registrations; add mobile-target
   `tauri-plugin-geolocation`; add `tauri-plugin-os` (all platforms);
   `#[cfg(mobile)]` geolocation registration.
5. Capabilities: split per the 2.8 table (after `tauri ios init`, the
   mobile schema exists under `gen/schemas` for `$schema` references).
6. Frontend: `isIOS()` in `platform.ts` (+ unit tests alongside
   `platform.test.ts`); the five conditional surfaces (2.5 table);
   `@tauri-apps/plugin-os` + `@tauri-apps/plugin-geolocation` npm deps
   (dynamic import for geolocation).
7. First verification pass: `cargo check --target aarch64-apple-ios` (headless
   compile gate), then `npx tauri ios dev` (simulator) — run verify-items
   V1–V3 before building any dependent UI.
8. Records (with the feature, per FR-28/29/30): PRIVACY_POLICY.md (iOS
   location permission, TestFlight/App Store distribution), README, HELP,
   website, product-brief distribution line.

## Dev / verify loop

| Layer | How | Needs |
|---|---|---|
| Unit/lint/typecheck/build + entry-chunk guard | unchanged commands; `isIOS()` mocked in vitest like `isTauri()` | headless, any machine |
| iOS compile gate | `cargo check --target aarch64-apple-ios` | rust target + Xcode SDK, headless |
| Full-app iOS smoke | `npx tauri ios dev` (simulator); Files-app picker, clipboard, Split View, rotation, safe areas, simulated location all work in-simulator | Xcode + simulator, GUI session |
| On-device | `npx tauri ios dev --host` (dev) / TestFlight build (`npx tauri ios build --export-method app-store-connect` → upload) | device + dev cert; TestFlight = distribution cert + ASC app record |
| Device-only verifications | NFR-01 cold-launch timing, QA-24 TestFlight milestone, realistic VoiceOver pass | physical iPhone + iPad |

Desktop loop (`npm run desktop:dev` / `desktop:build`) unchanged.

## Risks

1. **Apple review — 4.2 minimum functionality ("web wrapper").** Mitigation
   is factual: Tauri packages `frontend/dist` into the app bundle and serves
   it from a local custom protocol — no remote code, fully functional
   offline (Tier A), real native integration (document picker, CoreLocation
   permission flow, native clipboard), and a genuine local-data analytics
   tool. Reviewer notes must include the synthetic demo CSVs + import steps
   (OQ-05 path) or the reviewer sees an empty app — this is the single
   biggest rejection risk for a bring-your-own-data app.
2. **2.5.2 / remote code:** satisfied by construction — all JS is bundled at
   build time; network fetches are data (JSON/tiles), never executable code.
3. **Privacy nutrition label nuance (NFR-05):** location and checklist
   coordinates go device-to-provider (OpenWeather, eBird) with the user's
   own keys, never to the developer. Apple's taxonomy ("Data Not Collected"
   = not transmitted off device in a way accessible to the developer or
   their partners) supports a not-collected posture, but the wording of the
   label + reviewer notes must be prepared carefully at the packaging stage
   — an honest-but-clumsy label invites rejection or a liability. Owner:
   the submission-package stage, not the Engineer.
4. **Simulator vs device signing:** simulator needs no signing; device dev
   needs an Apple Development cert + the device registered; TestFlight needs
   Apple Distribution + an ASC app record for `com.snowraven` (user-account
   steps). Budget a first-time provisioning fight into the schedule.
5. **CocoaPods reality:** Tauri v2's iOS path still rides CocoaPods, which
   is in maintenance mode; it works but is sensitive to ruby environment
   drift on the machine. Preflight `pod --version` alongside the Xcode
   checks; pin fixes in DECISIONS.md if Hephaestus needs any.
6. **WKWebView memory under Split View (NFR-08):** jetsam kills are silent
   (blank WebView). Existing lazy/caps discipline is the defense; QA-35 is
   the gate; no pre-emptive architecture change.
7. **Xcode/Tauri version coupling:** `gen/apple` regeneration across Tauri
   CLI upgrades can churn the committed project; treat CLI upgrades during
   this feature as their own commit with a re-diff of gen/apple.

## Ratified open questions

- **OQ-01:** iOS/iPadOS **16.0** floor (container queries + overscroll-behavior bind it; Tauri supports lower).
- **OQ-02:** **`com.snowraven`**, display name **SnowRaven** — reuse the existing identifier; ASC registration is a user/Deployer account step; `com.snowraven.ios` is the collision fallback.
- **OQ-04:** `tauri-plugin-geolocation`, **mobile-target-only** dep + `#[cfg(mobile)]` registration + mobile-capability grants; desktop native `get_location` path byte-untouched; when-in-use only.
- **OQ-06:** iPhone **landscape allowed** (portrait + both landscapes; no upside-down); iPad all four orientations.

## Engineer verify-items (flagged, not guessed)

- **V1:** `@tauri-apps/plugin-os` `platform()` sync signature on the installed version (2.5).
- **V2:** WKWebView-native `<input type="file">` picker under wry-iOS — first simulator check; decides Mechanism A vs B (2.6).
- **V3:** plugin-fs readability of a dialog-picked iOS path (only if Mechanism B) (2.6).
- **V4:** `keyring` v3 compiles for `aarch64-apple-ios`; if not, `#[cfg(desktop)]`-gate the three dead key commands (2.8).
- **V5:** exact `tauri ios build` flags / ExportOptions for the App-Store-Connect export method on the installed CLI version, and where `CFBundleVersion` (build number) is set — confirm against the installed Tauri CLI docs rather than this document.
