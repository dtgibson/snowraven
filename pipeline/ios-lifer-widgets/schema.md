# Schema: iOS Lifer Widgets

**Feature:** ios-lifer-widgets
**Date:** 2026-09-23
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (both approved), decisions.md (the minimum-iOS correction: the app stays at 16.0, only the widget extension targets 17.0)
**Extends:** `pipeline/icloud-sync/schema.md` (the native layer and the epoch modules), `pipeline/mobile-app/` (the iOS plists), `pipeline/apple-platform-readiness/` (the scene manifest and its guard)
**Ships as:** 1.0.36 (one patch, the four-file set; OQ-06 default)

## Path

Incremental (extending the existing data layer and the iOS project structure).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database; its data layer is the set of stored documents under `AppLocalData/data/`, the two epoch modules that announce a change to them, the clear registry, and the pure `lib/` modules that derive what the UI shows. Prior `schema.md` files document all of that, and this feature adds a new stored document (the App Group hand-over) written from the existing ones, a second on-device store the extension owns (its cache), a new document class in the iOS project (a second target with its own plist, entitlements and profile), and the app's first addressable navigation. None of that is a UI-only change and none of it is greenfield, so the path is Incremental. Proceeding on this assessment per the hands-off run.

This is an unusual Incremental run in that most of the new structure is not TypeScript: a Swift extension target, a second vendored line in tao, and an Apple Developer portal configuration. Each is specified below precisely enough that The Engineer does not guess. Where a decision rests on something I could measure on this machine I measured it (section 6.5, section 4.3); where it rests on a device or on Apple's validator it is a numbered verify-item (section 13) rather than a claim.

## Existing data model used by this feature (unchanged)

| Existing structure | Where | How this feature uses it |
|---|---|---|
| `data/api-keys.json` (`ebird` slot, per-key `meta`) | `frontend/src/lib/storage.ts` (`API_KEYS_PATH`, the `docChains` chain) | Read through `storage.getApiKey('ebird')` to fill the hand-over; never written by this feature |
| `data/settings.json` `map-defaults` (`{ lat, lng, dist }`) | `Settings.tsx` writes it (save at line 2136, clear at line 2148); `MapExplorer.tsx` reads it | The Default Location's `lat` / `lng` go into the hand-over; `dist` is deliberately not carried (FR-18) |
| `data/metadata.json` + `data/ebird-backup.csv` + `data/ml-export.csv` | `storage.getFilesStatus()`, `loadEbirdObservations()` (`lib/observationsCache.ts`), `loadMLExport()` (`lib/mlExportCache.ts`) | The recorded set is derived from the parsed rows exactly as `MapExplorer.tsx` derives `recordedNames` (line 919); the three target sets (missing Photo, missing Audio, missing Video) are derived from the same `mediaTypes` map (line 846) that `targetSpecies` (line 935) reads, split per type; their union is `targetSpecies` (Stage 4, revised) |
| `lib/filesChanged.ts`, `lib/keysChanged.ts` (the two epoch modules) | entry-safe, bumped by Settings and by both iCloud controller paths | The hand-over writer subscribes to both; a third epoch module of the same shape is added for `map-defaults` (section 1.4) |
| `lib/clearDerived.ts` (the clear registry) | `purgeDerivedOnClear(slot)` from all three clear paths | NOT extended (section 1.6 says why: the hand-over is regenerated, never purged, and it is keyed on presence, not content) |
| `/map/recent-obs` reducer | `lib/tauri/mapService.ts` `getRecentObs` (lines 130 to 195); backend twin `backend/routers/map.py` | The Swift widget is a THIRD runtime of this reducer; the fixture pins it (section 7) |
| `buildNearbyLifers`, `isWithinWindow` | `lib/nearbyLifers.ts` | The subtraction and window rules the widget twins; the fixture asserts set-equality against them |
| `distanceMiles` | `lib/mapExplorerFormat.ts` line 44 | The distance rule the widget twins (R = 3958.8 mi, haversine) |
| `normalizeSpeciesName` / `stripTrailingParenthetical` | `lib/speciesUtils.ts` lines 43 and 217 | The name normalization the hand-over applies at write time and the widget applies to eBird's `comName` |
| `MAP_VIEW_MODE_ORDER` | `lib/mapViewModes.ts` | The two widget kinds' names are the `'lifers'` and `'targets'` labels there |
| `TAB_LABELS`, `loadTabLayout` | `lib/tabLayout.ts`, `App.tsx` line 158 | The deep link activates `'map-explorer'` through `setActiveTab`, layout untouched (OQ-03) |
| `getCurrentLocation` (iOS branch) | `lib/location.ts` line 45, `getCurrentLocationIOS` | The link's "use my location" step is this call, not a new one |
| The scene manifest and its guard | `Info.ios.plist`, `gen/apple/snowraven_iOS/Info.plist`, `gen/apple/project.yml`; `lib/iosSceneManifest.test.ts` | The URL scheme joins the same three files and the guard's plist reader is reused |
| The single-webview keeper | `src-tauri/src/lib.rs` `.run(tauri::generate_context!())`; `lib/singleWebviewInvariant.test.ts` | Unchanged; section 2.6 states why the new native code does not touch it |
| The vendored tao | `src-tauri/vendor/tao` (one line changed, `VENDORED.md`) | Gains a second, separately documented change for cold-start URL delivery (section 4.3) |

## Changes in this feature

### Added

1. **The App Group hand-over document** `widgets/handover.json` in the App Group container `group.com.dtgibson.snowraven` (section 1). Written whole by the app on iOS only; read and validated by the extension on every refresh.
2. **The widget cache document** `widgets/cache.json` in the same container (section 3). Written and read by the extension only; the app never opens it.
3. **`lib/mapDefaultsChanged.ts`**, a third epoch module of the `filesChanged.ts` shape, for the `map-defaults` setting (section 1.4).
4. **`lib/widgets/`**: the entry-safe hand-over builder and gate, the dynamic-imported controller, the native wrapper, and the pure TypeScript twin of the widget's list rules used by the parity fixture (section 2, section 7).
5. **`lib/links/`**: the entry-safe URL parser and pending-link store, and the dynamic-imported controller that receives URLs from native (section 4).
6. **`src-tauri/src/widgets.rs`** (iOS only): two Tauri commands and one mini plugin hook (section 2).
7. **`src-tauri/gen/apple/Sources/snowraven/WidgetReload.swift`**: a one-function Swift file in the APP target exposing `WidgetCenter.reloadAllTimelines()` to Rust (section 2.3).
8. **The extension target** `snowraven_widgets` and its unit-test target `snowraven_widgetsTests` in `gen/apple/project.yml`, with `gen/apple/snowraven_widgets/` (Info.plist, entitlements, Swift sources) and `gen/apple/snowraven_widgetsTests/` (section 5).
9. **The URL scheme** `snowraven` in the three iOS plist sources (section 4.2), and `NSLocationWhenInUseUsageDescription` rewritten in both app plist copies (FR-20).
10. **App Group entitlement** on both the app's and the extension's entitlement files (section 5.5).
11. **The parity fixture** `frontend/src/lib/widgets/widgetRows.fixture.json`, generated by an env-gated vitest and consumed by vitest and XCTest (section 7).
12. **A second vendored tao change** in `src-tauri/vendor/tao/src/platform_impl/ios/scene.rs` (section 4.3), recorded in `VENDORED.md`.
13. **Guards** listed in section 8, and `paths` extensions in `.claude/rules/security.md` and `.claude/rules/testing.md`.

### Modified

- `Settings.tsx`: the two `map-defaults` write sites call `notifyMapDefaultsChanged()` after the write (section 1.4). No other change.
- `App.tsx`: boots the two iOS-only controllers through `import()` (the icloud pattern), subscribes to the pending-link store, and threads one new optional prop to `MapExplorer` (section 4.5). No new static import.
- `MapExplorer.tsx`: one new optional prop and one effect that applies a link request (section 4.5). No change to any existing handler's contract.
- `src-tauri/src/lib.rs`: registers `mod widgets` and its two commands under `#[cfg(target_os = "ios")]`, and adds the mini plugin to the builder under `#[cfg(target_os = "ios")]`. The `.run(tauri::generate_context!())` keeper line is byte-unchanged.
- `src-tauri/Cargo.toml`: no new crate. `objc2-foundation`'s `NSFileManager` and `NSURL` features are already enabled in the apple block (section 2.4).
- `src-tauri/gen/apple/snowraven_iOS/snowraven_iOS.entitlements`: gains `com.apple.security.application-groups`.
- `src-tauri/gen/apple/snowraven.xcodeproj/` (committed, regenerated by `xcodegen generate`): gains the two targets.
- The release skill and `~/.tauri/snowraven-ios-export-options.plist` (section 10).
- Published statements and help per FR-42 to FR-45: the Designer and Engineer own the copy; the gate rule on `README.md` / `website/` applies.

### Unchanged (used, not modified)

Everything in the table above except the vendored tao and the three plist sources. In particular: `storage.ts` (no new document under `AppLocalData/data/`, no new chain), `clearDerived.ts` (no new row), `replayStore.ts`, the transport and its caches (`CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`: the widget is a separate process with its own etiquette, section 3.4), the iCloud Sync scope (the hand-over is never synced), `tauri.conf.json` `bundle.iOS.minimumSystemVersion` (stays 16.0), the macOS `entitlements.plist` and `entitlements.icloud.plist`, `capabilities/*.json` (section 2.5), and `backend/`.

---

## 1. The App Group hand-over document

### 1.1 Container and path

- **App Group id:** `group.com.dtgibson.snowraven`. One constant on every side: `APP_GROUP_ID` in `src-tauri/src/widgets.rs`, `APP_GROUP_ID` in `frontend/src/lib/widgets/widgetHandover.ts`, `AppGroup.id` in `gen/apple/snowraven_widgets/Sources/Logic/AppGroup.swift`, and the string in both entitlement files. The parity guard (section 8) pins all five.
- **Directory:** `<container>/widgets/` where `<container>` is `NSFileManager.defaultManager().containerURLForSecurityApplicationGroupIdentifier(APP_GROUP_ID)`. Created with `create_dir_all` by the app on first write and by the extension on first cache write. The `widgets/` subdirectory exists so a future App Group document is a sibling with its own name rather than a second root-level file.
- **File:** `<container>/widgets/handover.json`. UTF-8 JSON, written whole, never patched.
- **File protection:** the container default (`NSFileProtectionCompleteUntilFirstUserAuthentication`). Deliberately NOT `Complete`: a WidgetKit refresh runs while the device is locked after first unlock, and `Complete` would make every such refresh read the document as absent (S1) on a device whose app is fully set up. This is the same protection class the app's own `data/api-keys.json` has today, which is NFR-04's "stored the same way" clause made concrete.
- **Backup:** iOS defaults (included in device and iCloud device backups, removed with the app). FR-42's "iOS App" paragraph says so. `NSURLIsExcludedFromBackupKey` is not set, because the app's own sandbox copy of the key is backed up under the same defaults and excluding one of two copies of the same secret would be a claim the policy could not make honestly.

### 1.2 Shape (version 1)

```
interface WidgetHandoverV1 {
  version: 1
  writtenAt: string          // ISO-8601 UTC with seconds, e.g. "2026-09-23T18:04:11Z"; the app's clock
  appVersion: string         // frontend/package.json version, e.g. "1.0.36"; display-only in the extension, never compared
  ebirdKey: string | null    // the user's eBird key VERBATIM, or null = no key stored / cleared (state S2)
  hasEbirdBackup: boolean    // false = no eBird backup stored (state S3); recorded is then []
  recorded: string[]         // the recorded set: normalizeSpeciesName(commonName).toLowerCase() over EVERY observation row,
                             // distinct, sorted by code unit ascending (a plain JS sort, no locale). [] when hasEbirdBackup is false.
  hasMlExport: boolean       // false = no Macaulay export stored (state S4); all three target sets are then []
  targetsMissingPhoto: string[]   // for each distinct RAW commonName in the backup whose ML rows contain NO Photo row:
                                  // normalizeSpeciesName(name).toLowerCase(); distinct; sorted as above. [] when hasMlExport is false.
  targetsMissingAudio: string[]   // the same for Audio.
  targetsMissingVideo: string[]   // the same for Video (Stage 4, revised the same day: Video is back in).
  defaultLocation: { lat: number; lng: number } | null   // map-defaults lat/lng when stored and finite and in range; else null
}
```

Nothing else is written. FR-30's exclusions hold by construction: the builder reads observation rows and ML rows only to compute four name sets, and QA-30's key scan (`Object.keys` at every depth) finds exactly the ten keys above plus `lat` / `lng`.

**Why three per-type sets rather than one set with a bitmask (Stage 4 revision; still version 1, nothing has shipped).** The widget's four media settings are each a set operation over the three: Photo = `targetsMissingPhoto`, Audio = `targetsMissingAudio`, Video = `targetsMissingVideo`, Any = their union, which is exactly the in-app Media Targets definition (`targetSpecies` in `MapExplorer.tsx`: a species missing any of the three), and a row's glyphs under Any are its membership in each. Three sorted string arrays validate with the same per-string rule as `recorded` and need no per-entry object shape. A map of name to bitmask would carry the same information in a shape the Swift validator would have to read as a dictionary of small integers, for no gain. **State S5 is setting-dependent:** with `hasMlExport` true, Photo shows S5 when `targetsMissingPhoto` is empty, Audio when `targetsMissingAudio` is empty, Video when `targetsMissingVideo` is empty, Any when all three are empty (which is the in-app "you already have media for every species" sentence).

**Why names are written already lowercased (a change from the PRD's "sorted normalized names", stated as a decision).** The app's comparison in `buildNearbyLifers` is `normalizeSpeciesName(x).toLowerCase()` on BOTH sides. Case-folding the hand-over at write time leaves the extension exactly one operation on each eBird `comName`: strip the trailing parenthetical, then `lowercased()`. JavaScript's `toLowerCase` and Swift's `lowercased()` both apply the Unicode default (locale-independent) case mapping, so they agree on every name eBird ships; the fixture carries a non-ASCII name (section 7.2) so that claim is asserted rather than remembered.

**Bounds** (the write refuses, never truncates: a set that does not fit is a document that is not written, and the previous document stays; the app logs nothing and the widget keeps showing the previous state):

| Field | Bound | Reason |
|---|---|---|
| `ebirdKey` | 1 to 128 chars, matches `^[A-Za-z0-9]{1,128}$` | `MAX_KEY_VALUE = 128` in `lib/icloud/keyRecord.ts` is the app's own bound; eBird keys are 12 alphanumerics; the class cannot express a header injection |
| `recorded`, `targetsMissingPhoto`, `targetsMissingAudio`, `targetsMissingVideo` | each at most 20,000 entries; each entry 1 to 200 UTF-16 code units, no control characters (`[\u0000-\u001F\u007F]`), no leading or trailing whitespace | The world list is about 11,000 species; 20,000 leaves room for forms and spuhs in a large backup. 200 is above the longest eBird common name (about 60) by a margin that costs nothing. All three target sets are subsets of `recorded` by construction (each is derived over the backup's names), which the TS builder test asserts |
| whole document | at most 4,000,000 bytes serialized | Four arrays of realistic size (a 12,000-name backup at about 30 bytes a name, each target set a subset of it, so at most four copies of that list) serialize under 1.5 MB. The byte cap is the binding bound: four full 20,000-entry arrays at the per-entry maximum would exceed it, and in that case the write is refused, which is the stated refusal rule rather than a contradiction between the two bounds |
| `defaultLocation` | `lat` in [-90, 90], `lng` in [-180, 180], both finite | Out-of-range is written as null (absent), which the widget reads as "no default" |

The same bounds are enforced in three places, and each side has a test that goes red when that side's enforcement is deleted (the v1.0.20 two-language limit rule): the TypeScript builder refuses to produce an over-bound document; the Rust command refuses an over-bound body before writing; the Swift reader treats an over-bound document as absent (S1).

### 1.3 Who writes it, and from where

- **JS builds, Rust writes.** `lib/widgets/widgetHandoverController.ts` builds the document string; the Tauri command `widgets_write_handover(document: String)` in `src-tauri/src/widgets.rs` validates the body's length and JSON shape (a `serde` struct with `deny_unknown_fields`), writes it, and asks WidgetKit to reload. The key crosses the IPC boundary as part of the JSON, exactly as it already crosses it for `icloud_write_keys`; the Rust struct that carries it derives no `Debug`, and no `format!`, log line or error string contains the body (the icloud.rs rule, pinned by the parity guard's derive check).
- **Atomic write:** `fs::write` to `<container>/widgets/handover.json.tmp-<pid>`, then `fs::rename` onto `handover.json`. `rename` on the same volume is atomic on APFS, so the extension never observes a half-written document; the extension's own read validates the shape anyway (FR-33).
- **Regular-file discipline (security.md v1.0.11 / v1.0.13):** before every write the command checks `symlink_metadata` of the target path: a symlink or directory at `handover.json` is removed as such and never followed. The App Group container is user-writable space from the app's point of view (a jailbroken device, a backup restore), so the write side gets the same treatment as `icloud.rs` gives its records.
- **Reload:** after a successful rename the command calls the Swift shim (section 2.3), which calls `WidgetCenter.shared.reloadAllTimelines()`. On a failed write nothing is reloaded. One write, one reload (QA-23).

### 1.4 When it is written (the triggers)

The controller regenerates the whole document, debounced 300 ms (so an upload that fires `notifyFilesChanged` and then a key save that fires `notifyKeysChanged` within the same gesture produce one write), on each of:

1. **App launch**, once the controller has booted and `storage.getFilesStatus()` has answered (FR-31 "once the stored files have loaded"). The controller boots from `App.tsx` on iOS only, after first paint, through `import()`.
2. **Every `filesChanged` epoch** (`subscribeFilesChanged`): a Settings upload, a Settings clear, an iCloud arrival, an iCloud synced clear. All four already bump it (CLAUDE.md, v1.0.14: no exception for the handler that did it).
3. **Every `keysChanged` epoch** (`subscribeKeysChanged`): a Settings key save, replace or clear, and both iCloud key paths.
4. **Every Default Location save or clear**: a NEW epoch module `lib/mapDefaultsChanged.ts` (`getMapDefaultsEpoch`, `subscribeMapDefaultsChanged`, `notifyMapDefaultsChanged`, entry-safe and dependency-free, the exact `keysChanged.ts` shape), called at the two write sites in `Settings.tsx` (line 2136 after `setSetting('map-defaults', ...)` resolves; line 2148 after `deleteSetting('map-defaults')` settles). This is the house rule from CLAUDE.md applied: the `map-defaults` document gains an off-tab reader, so it gets its own signal rather than a direct call from the Settings handler into the widget module. `MapExplorer.tsx` keeps reading it on mount only; that is unchanged by this feature.

Each regeneration reads its inputs fresh through the seams (`storage.getFilesStatus`, `loadEbirdObservations`, `loadMLExport`, `storage.getApiKey('ebird')`, `storage.getSetting('map-defaults')`); it holds no copy of any of them between writes. The observations and ML parses are memoized by their caches already, so a regeneration after an upload costs one hand-over build over rows a tab has already parsed.

**Ordering with the clear paths.** `Settings.tsx handleDeleteFile` runs `storage.deleteFile`, the cache drops, `purgeDerivedOnClear`, and THEN `notifyFilesChanged` (the CommandPalette comment at line 131 records the same order for the palette path); the iCloud controller likewise notifies after its purge. So by the time the writer runs, `getFilesStatus()` already reports the slot absent and `loadEbirdObservations()` resolves null, and the document written carries `hasEbirdBackup: false` (S3) or `hasMlExport: false` (S4). A cleared key reaches the writer the same way through the keys epoch, producing `ebirdKey: null` (S2). This is why the hand-over needs no row in `clearDerived.ts` (section 1.6).

### 1.5 The eBird key: App Group file, not a keychain access group

**Decision: the key rides the hand-over file.** Reasons, in order of weight:

1. **The app has no working keychain path.** CLAUDE.md records that the `keyring` crate route fails silently in this app because the entitlements are not configured, and `TauriStorage` deliberately keeps the key in `data/api-keys.json` in plaintext under the app sandbox's default protection. A shared keychain access group would need a `keychain-access-groups` entitlement on BOTH targets, a SecItem binding in Rust (objc2 has no `Security` framework crate in this dependency graph) or a second Swift shim in the app, and a migration of where the app itself stores the key so that the two copies do not drift. That is a change to the app's key storage, which is out of this feature's scope and would need its own decision about the existing plaintext copy.
2. **It is not weaker than today.** The key already sits in plaintext at `AppLocalData/data/api-keys.json` under the same protection class the container gets; the hand-over adds a second copy in a second sandbox with identical protection, readable by exactly two signed processes of the same team. NFR-04 asks for parity with the sandbox, and this is parity.
3. **A key change is visible without a keychain.** FR-25's cache invalidation is done by the extension comparing a fingerprint of the key it last fetched with (section 3.2); the hand-over is the only thing it has to read.

Reversal condition: if the app ever moves its own key into the keychain, the hand-over's `ebirdKey` field becomes a keychain access-group reference in a `version: 2` document, and the extension reads SecItem instead. Nothing else in this schema changes.

### 1.6 Why the hand-over is NOT in the clear registry

`clearDerived.ts` registers durable stores KEYED ON the content of a user file, and each row ends in a `storage.deleteSetting` that `cacheInventory.test.ts` pairs to an exported purge. The hand-over fails both halves of that test on purpose: it is keyed on presence (one fixed name, one document), and it is REGENERATED on clear rather than deleted, because a deleted document would read as S1 ("open SnowRaven once") on a device whose app is open and set up minus one file. Its teardown is the epoch subscription in section 1.4, and the guard that pairs the three signals to the writer is `widgetHandover.triggers.test.ts` (section 8). Stated so the next reader does not add a row and turn `cacheInventory.test.ts` red for a store that deletes nothing.

### 1.7 Platform gating and entry safety

- `lib/widgets/widgetHandover.ts` (entry-safe; no imports beyond `platform.ts`): exports `APP_GROUP_ID`, `HANDOVER_VERSION`, the `WidgetHandoverV1` type, `buildHandover(inputs): WidgetHandoverV1 | null` (pure; null when a bound is exceeded), `serializeHandover`, and `widgetsSupported(): boolean` = `isTauri() && isIOS()`.
- `lib/widgets/widgetHandoverController.ts` (dynamic-imported only): the subscriptions, the debounce, the reads through the seams, the call into `widgetNative.ts`.
- `lib/widgets/widgetNative.ts` (dynamic-imported only, imports `@tauri-apps/api/core`): `writeHandover(document: string): Promise<void>` invoking `widgets_write_handover`; `takePendingLink(): Promise<string | null>` invoking `widgets_take_pending_link`.
- `App.tsx` boots it after first paint: `if (widgetsSupported()) void import('./lib/widgets/widgetHandoverController').then(m => m.startWidgetHandover()).catch(() => {})`. On macOS, Windows, web and Pi the gate is false and the `import()` never runs (QA-32). `entryChunk.test.ts` asserts `widgetHandover.ts` is on the entry graph and `widgetHandoverController.ts` / `widgetNative.ts` are not (section 8).

---

## 2. How JS reaches the App Group: a Rust command plus one Swift shim

### 2.1 Decision

Rust commands via objc2 for the file work (the icloud.rs precedent), and one `@_cdecl` Swift function in the app target for the single call that has no ObjC surface (`WidgetCenter`). Not a Tauri iOS Swift plugin package: that is the heavier mechanism (a Swift package, `tauri::ios_plugin_binding!`, a plugin permission set) for two commands whose file side is already idiomatic in this repo.

### 2.2 `src-tauri/src/widgets.rs` (compiled only under `#[cfg(target_os = "ios")]`)

```
const APP_GROUP_ID: &str = "group.com.dtgibson.snowraven";
const WIDGETS_DIR: &str = "widgets";
const HANDOVER_FILE: &str = "handover.json";
const HANDOVER_MAX_BYTES: usize = 4_000_000;
const LINK_MAX_BYTES: usize = 512;
const LINK_SCHEME: &str = "snowraven";

fn container_dir() -> Result<PathBuf, &'static str>   // containerURLForSecurityApplicationGroupIdentifier; Err("no-app-group") when nil
                                                       // (a build without the entitlement); cached in a OnceLock after the first success

#[tauri::command] fn widgets_write_handover(document: String) -> Result<(), String>
   // 1. document.len() <= HANDOVER_MAX_BYTES else Err("too-large")
   // 2. serde_json::from_str::<HandoverDoc>(&document) with deny_unknown_fields, version == 1, the field bounds of section 1.2, else Err("invalid")
   // 3. container_dir()?; create_dir_all(widgets); symlink_metadata guard on the target; write .tmp-<pid>; rename
   // 4. unsafe { snowraven_reload_widgets() }   // the Swift shim, section 2.3
   // Errors are short stable strings; the body never appears in any of them.

#[tauri::command] fn widgets_take_pending_link(app: tauri::AppHandle) -> Option<String>
   // Takes (returns and clears) the URL stored by the plugin hook below. Cold-start path (section 4.4).

pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R>
   // tauri::plugin::Builder::new("snowraven-links")
   //   .setup(|app, _| { app.manage(PendingLink(Mutex::new(None))); Ok(()) })
   //   .on_event(|app, event| if let tauri::RunEvent::Opened { urls } = event { ... })
   //   .build()
   // The hook keeps ONLY the last URL whose scheme is LINK_SCHEME and whose serialized length is <= LINK_MAX_BYTES,
   // stores it in PendingLink, and emits `snowraven-link` (payload: the URL string) to the "main" window.
   // Every other URL is dropped without emitting anything.
```

`HandoverDoc` is a `serde::Deserialize` struct with `#[serde(deny_unknown_fields)]` and NO `Debug` derive (the parity guard pins the absence, as `icloudPaths.parity.test.ts` does for `icloud.rs`'s key structs).

### 2.3 The Swift shim in the APP target

`src-tauri/gen/apple/Sources/snowraven/WidgetReload.swift`:

```swift
import WidgetKit

@_cdecl("snowraven_reload_widgets")
public func snowravenReloadWidgets() {
    if #available(iOS 14.0, *) { WidgetCenter.shared.reloadAllTimelines() }
}
```

Rust declares `extern "C" { fn snowraven_reload_widgets(); }` under `cfg(target_os = "ios")`. The symbol is resolved when Xcode links `libapp.a` into the app, which is where the Swift object lives. `project.yml` already lists `Sources` as the app target's source path and already sets `ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES: true`; the app target additionally gains `SWIFT_VERSION: "5.0"` in its settings and `- sdk: WidgetKit.framework` in its dependencies (verify-item V1: that XcodeGen picks the Swift file up under the existing `sources: Sources` entry and that `cargo check --target aarch64-apple-ios` passes, since an `extern` block is not resolved until link).

Why a shim rather than a Swift plugin: `WidgetCenter` has no ObjC interface, so objc2 cannot reach it; a `@_cdecl` function is the smallest bridge that exists and it adds no second mechanism for the file work.

### 2.4 Cargo cfg scoping

No new crate. `objc2-foundation` with `NSFileManager`, `NSURL` and `NSString` is already in the `cfg(any(target_os = "macos", target_os = "ios"))` block; `widgets.rs` uses only those. The module itself is `#[cfg(target_os = "ios")]` in `lib.rs`, with the two commands registered under the same cfg in `generate_handler!` and the plugin added under `#[cfg(target_os = "ios")]`, because App Groups have a macOS meaning (team-prefixed) that this feature does not implement and the hand-over must not exist on the Mac (FR-32). Windows and Linux binaries never see the file (the CLAUDE.md rule cuts the same way as for `tauri-plugin-window-state`: the cfg says where the code is real).

### 2.5 Capabilities

No change to `capabilities/*.json`. App-defined commands registered through `generate_handler!` are not gated by plugin permissions (the existing `get_timezone` and `icloud_*` commands appear in no capability file), and the `snowraven-link` event is received through `core:event:default`, which `core:default` already grants to the `main` window. The `fs` grant stays `$APPLOCALDATA/**`: the App Group container is outside it, so the webview cannot read or write the hand-over or the cache directly, and the only route is the command (the icloud "Not used: plugin-fs against the container" posture, restated).

### 2.6 The single-webview invariant: unaffected, and why

- The keeper `.run(tauri::generate_context!())` in `lib.rs` is byte-unchanged; the URL hook is a plugin `on_event`, which receives run events without replacing Tauri's own no-op run callback, and it handles only `RunEvent::Opened`. `RunEvent::SceneRequested` still reaches the no-op callback and is dropped there. `singleWebviewInvariant.test.ts` stays green without modification.
- The extension is a separate process that never opens `AppLocalData/data/` (FR-33; QA-33 greps the Swift sources for `api-keys.json`, `settings.json`, `metadata.json`, `replay.json` and `AppLocalData`). It reads one document the app writes whole and writes one document the app never reads, so no promise chain, purge generation or `docChains` link is shared across the process boundary. The invariant's reversal condition (a second webview) is not approached.

---

## 3. The widget-side cache document

### 3.1 Path and ownership

`<container>/widgets/cache.json`, written by the extension only, through the same temp-then-rename pattern. The app never reads or writes it, including on clears (FR-25's second sentence: a cleared backup does not discard the cache, the list is just recomputed). Both widget kinds and every placed instance share this one file; the extension serializes access with a process-wide actor (`CacheStore`), and since WidgetKit runs one extension process per app the file has one writer at a time.

### 3.2 Shape (version 1)

```
interface WidgetCacheV1 {
  version: 1
  keyFingerprint: string       // first 16 hex chars of SHA-256(ebirdKey) at fetch time; a hand-over whose key fingerprint
                               // differs makes the cache INVALID (FR-25, QA-25). The key itself is never written here.
  cell: { lat: number; lng: number; distKm: 40 }   // the reference point ROUNDED to 2 decimals (OQ-04 default; section 3.3) plus the fixed radius
  fetchedAt: string            // ISO-8601 UTC seconds; the time the 200 response was received
  records: WidgetRecord[]      // the reduced records (section 6.1), at most 20,000
  backoff: { until: string; reason: '429' } | null   // set on a 429; cleared by the next 200
  lastFailure: { at: string; kind: 'offline' | 'timeout' | 'http' | 'too-large' | 'malformed' | '429' } | null
                               // the most recent failed attempt AFTER fetchedAt, for the S9 reason line; cleared by the next 200
}

interface WidgetRecord { speciesCode: string; comName: string; locId: string; locName: string; lat: number; lng: number; obsDt: string; subId: string }
```

Distances are NOT stored: they are recomputed from the current refresh's reference point every time (FR-24), and a cache hit at a point 0.2 mi away therefore yields different distances from the same records (QA-24). Recency labels and window membership are likewise recomputed against the refresh's "now" (FR-28). **The media setting (Stage 4) is applied locally in exactly the same way as the window:** the cache holds the reduced records for the cell, and Photo / Audio / Video / Any is a filter over them against the hand-over's three sets, so changing a placed widget's media setting produces a new entry with zero requests when the cache is fresh, and two Media Targets widgets with different media settings still share one request. Nothing in this section changes for the media setting.

### 3.3 Key and lifetimes

- **Cache key** = `(round2(lat), round2(lng), 40)`. `round2(x)` is "round half away from zero to two decimals" implemented as `(x * 100).rounded() / 100` in Swift (`FloatingPointRoundingRule.toNearestOrAwayFromZero`); the app's transport rounds to 5 decimals for its own 90 s cache and there is no cross-runtime twin of THIS rounding, so no parity claim is made about it. Two decimals is about 0.7 mi in latitude; a fresh entry is served when the rounded cell matches. OQ-04's tightening to three decimals is declined: the 15 minute TTL already bounds how far a walking user moves before a real refresh (a brisk walk covers about 0.75 mi in 15 minutes, the size of one cell), and the per-cell coalescing is what keeps two placed widgets at one request (NFR-03). Distances are recomputed from the true point regardless, so the cell only decides whether a request is made, never what a row says.
- **Fresh:** `now - fetchedAt < 15 min` AND the cell matches AND `keyFingerprint` matches the current hand-over's key. Fresh means zero requests in that refresh (FR-22, FR-24, QA-12, QA-24).
- **Usable but stale:** `15 min <= now - fetchedAt < 24 h` with matching key: a request is attempted; on failure the records are shown with the fetch time and the failure reason (S9); on 429 likewise, and `backoff` is written.
- **Expired:** `now - fetchedAt >= 24 h`: the records are never shown; a failed refresh shows S8 with `fetchedAt`.
- **Cell mismatch with a fresh entry:** a request is made for the new cell; on failure the OLD entry's records are still the "last good list" (S9) but their distances are recomputed from the new reference point, and the S9 line carries the old fetch time. This keeps FR-27's "keep the last good list" true when the user moves; the alternative (S8 on every move while offline) would show nothing to a user who walked across a cell edge in a tunnel.
- **429:** `backoff.until = max(now + 30 min, now + retryAfterSeconds)` where `retryAfterSeconds` is parsed as `lib/rateLimit.ts` parses it: matches `^[0-9]{1,3}$`, capped at 60 (`RETRY_AFTER_CAP_SEC`); anything else reads as absent. Since the cap (60 s) is always below the cadence (30 min), the effective next attempt is the next scheduled refresh, which is what FR-26 asks for; the parse exists so the contract is the app's, and the fixture pins the parser to the same 6-row table `rateLimit.test.ts` uses (section 7.4). A 429 body is never stored; `records` and `fetchedAt` are untouched.
- **Bounds on read:** `version == 1`, `records.count <= 20,000`, every string field <= 512 UTF-16 code units, `lat` / `lng` finite and in range, dates matching the eBird shape (section 6.2). A document failing any check is treated as absent (no last good list), never partially used. A file over 8 MB is not read at all (`FileManager` attributes first, the icloud.rs bounded-read rule).

### 3.4 Etiquette, stated against the app's gate

The app's `lib/ebirdGate.ts` cooldown and `EBIRD_GATED_PATHS` live in the webview process and cannot be shared with the extension. The widget's contract is the FR-22 / FR-24 / FR-26 one: at most one request per refresh, none when fresh, one shared cache per device for both kinds and all windows, 429 honored by backing off to the next refresh with the app's `Retry-After` parse. That is strictly slower than the app's 150 ms spacing floor and its ladder, so it is contract-compliant without sharing state; it is stated here so nobody wires the widget into `EBIRD_GATED_PATHS` (impossible) or copies the ladder (unnecessary at one request per 15 minutes).

---

## 4. The deep link: grammar, registration, delivery, application

### 4.1 Grammar and allowlist

Exactly fifteen URLs are valid (three lifers, twelve targets), and the parser is a table over them rather than a grammar. Nearby Lifers carries the window only; Media Targets carries the window and then the media setting (Stage 4, revised), in that fixed order:

```
snowraven://map/lifers?window=day
snowraven://map/lifers?window=week
snowraven://map/lifers?window=all
snowraven://map/targets?window=<day|week|all>&media=<photo|audio|video|any>     (twelve strings, all combinations; the window token `all` is the 30 days value and is unrelated to the media value)
```

`lib/links/deepLink.ts` (entry-safe, dependency-free):

```
export const LINK_SCHEME = 'snowraven'
export const LINK_MAX_LENGTH = 64            // the longest valid URL is 46 characters (targets, week, photo / audio / video); 64 leaves nothing useful for a payload
export type WidgetLink =
  | { view: 'lifers'; window: 'day' | 'week' | 'all' }
  | { view: 'targets'; window: 'day' | 'week' | 'all'; media: 'photo' | 'audio' | 'video' | 'any' }
export function parseWidgetLink(raw: unknown): WidgetLink | null
export function buildWidgetLink(link: WidgetLink): string   // the inverse, used by the fixture and by QA-34's vitest half
```

`parseWidgetLink` rules, in order, each a whole rejection (returns null, sets nothing, renders nothing, logs nothing):

1. `typeof raw === 'string'` and `raw.length <= LINK_MAX_LENGTH` (checked BEFORE any other operation, so every later step runs over at most 64 code units: the linearity argument in section 9).
2. `raw` is byte-equal to one of the fifteen strings above, looked up through `Object.hasOwn(TABLE, raw)` on a null-prototype table (security.md v0.5.81). No `URL` constructor, no query parsing, no case folding, no trailing-slash tolerance, no percent-decoding, no parameter reordering: a URL the widget did not build is not a URL the app applies. `snowraven://map/lifers/?window=day`, `SNOWRAVEN://...`, `?window=day&x=1`, `map/lifers?window=day&media=photo` (media on the lifers path), `map/targets?window=day` (media missing), `map/targets?media=photo&window=day` (reordered), `media=both` and `media=all` (the two superseded values), `#fragment`, a `javascript:` payload and a 65-character string are all rejected by rule 1 or rule 2 (QA-35's table).

Because the widget is the only author of these URLs, exact-match is not a limitation; it is the smallest parser that can be correct.

### 4.2 Registration (three plist sources, one guard)

`CFBundleURLTypes` is added to all three, identical:

```
CFBundleURLTypes: [ { CFBundleTypeRole: Viewer, CFBundleURLName: com.dtgibson.snowraven, CFBundleURLSchemes: [ snowraven ] } ]
```

- `src-tauri/Info.ios.plist` (the overlay; the only copy that survives `tauri ios init`),
- `src-tauri/gen/apple/snowraven_iOS/Info.plist` (what the build reads),
- `src-tauri/gen/apple/project.yml` under `targets.snowraven_iOS.info.properties` (the xcodegen input).

Pinned by extending `iosSceneManifest.test.ts`'s sibling (section 8: a new `iosWidgetManifest.test.ts` that imports `parsePlist` and the yaml block reader from the scene-manifest guard rather than copying them). Not registered on macOS: `tauri.conf.json` gains no `bundle.macOS` URL type and no `plugins.deep-link` entry, so the desktop bundle's Info.plist carries no scheme (QA-39's "absent from the macOS bundle configuration" is asserted over `tauri.conf.json` and `src-tauri/Info.plist`).

### 4.3 Delivery to the webview: `RunEvent::Opened` via an in-repo hook, plus one vendored tao line for cold start

**What was checked, and the finding that decides the mechanism.**

- Warm start (the app is running or suspended): UIKit calls `scene:openURLContexts:` on the scene delegate. tao 0.35.3's `TaoSceneDelegate` (`vendor/tao/src/platform_impl/ios/scene.rs` line 109) implements it and emits `Event::Opened { urls }`; `tauri-runtime-wry` 2.11.4 maps that to `RunEvent::Opened` (its `lib.rs` line 4387) and tauri 2.11.2 exposes it (`app.rs` line 263, mapped at 2622). This path works today with no change.
- Cold start (the app is not running; the widget tap launches it): UIKit hands the URL to `scene:willConnectToSession:options:` inside `connectionOptions.urlContexts` and does NOT call `scene:openURLContexts:`. tao's delegate forwards those options to `app_state::connect_scene`, which reads them only to retain them inside a `SceneRequested` event for non-first scenes, and never reads `URLContexts()`. Confirmed in the vendored copy and in upstream `tauri-apps/tao` `dev` (fetched 2026-09-23): the string `URLContexts` does not occur in `app_state.rs` on either. **So a cold-start URL is dropped by tao in scene mode, and the app runs in scene mode by the standing manifest.**
- `tauri-plugin-deep-link` 2.4.10 (fetched into the scratchpad and read): it ships an `android/` directory and NO iOS Swift side; on iOS its whole delivery is an `on_event` hook on `RunEvent::Opened` (its `lib.rs` line 542) that emits `deep-link://new-url` and stores `current`. It therefore has exactly the same cold-start hole, and adds a dependency, a capability (`deep-link:default`), and a `build.rs` that rewrites plists and entitlements for app links this feature does not use.

**Decision:** an in-repo plugin hook (section 2.2) rather than `tauri-plugin-deep-link`, since the plugin buys nothing the hook does not, and a second vendored tao change so that the cold-start URL is emitted at all.

**The tao change** (`vendor/tao/src/platform_impl/ios/scene.rs`, `scene_willConnectToSession_options`), after the existing `app_state::connect_scene(scene, connection_options)` call:

```rust
// SnowRaven (ios-lifer-widgets): UIKit delivers a LAUNCHING URL in the connection
// options and does not call scene:openURLContexts: for it. Upstream drops it here.
let urls: Vec<url::Url> = connection_options.URLContexts().iter()
  .filter_map(|ctx| ctx.URL().absoluteString().and_then(|s| s.to_string().parse().ok()))
  .collect();
if !urls.is_empty() {
  app_state::handle_nonuser_event(EventWrapper::StaticEvent(Event::Opened { urls }));
}
```

- `objc2-ui-kit`'s `UISceneConnectionOptions::URLContexts()` exists in the pinned 0.3.2 (`generated/UISceneOptions.rs` line 39) and tao's `Cargo.toml` already enables the `UISceneOptions` and `UIOpenURLContext` features, so no dependency or feature change.
- Timing: `connect_scene` on the first scene calls `on_app_ready()`, which moves tao out of `Launching`; if the emit lands while still `Launching` or inside a user callback, `try_user_callback_transition` (`app_state.rs` line 316) queues it rather than dropping it, and the queue drains when the loop runs. Either way the hook's `PendingLink` state is managed at plugin setup, before the loop, so the URL is held until JS asks for it.
- The keeper: this emits `Opened`, never `SceneRequested`; the no-op run callback and `singleWebviewInvariant.test.ts` are untouched.
- `VENDORED.md` gains a second section with the diff, the reason, and a changed removal condition: the crate is now removable when Tauri admits a tao that carries BOTH the #1245 fix and cold-start URL delivery, so the Engineer opens an upstream PR for this hunk in the same change (flag for the user in the hand-back). Until then a dependency refresh must not drop the patch; the existing rule already says so.

**Guard for the vendored change:** `iosWidgetManifest.test.ts` asserts `vendor/tao/src/platform_impl/ios/scene.rs` contains `URLContexts()` inside `scene_willConnectToSession_options` (a source-text row with a guard-the-guard mutation), since nothing in CI can launch the app cold.

### 4.4 Receiving in JS

- `lib/links/linkRequest.ts` (entry-safe store): `setPendingLink(link: WidgetLink)`, `getPendingLink(): PendingLink | null` where `PendingLink = WidgetLink & { id: number }` (a monotone id so a consumer can tell a new request from the one it already applied), `subscribePendingLink`, `clearPendingLink(id)`. Last one wins: `setPendingLink` replaces.
- `lib/links/linkController.ts` (dynamic-imported, imports `@tauri-apps/api/event` and `widgetNative.ts`): on start, `listen('snowraven-link', e => accept(e.payload))` FIRST, then `takePendingLink()` and `accept` its result if non-null (the order closes the window between a cold-start URL held in native state and the listener being armed: a URL that arrives in between is delivered by the event, and one held earlier is delivered by the take). `accept(raw)` is `const link = parseWidgetLink(raw); if (link) setPendingLink(link)`.
- `App.tsx`: boots the controller on iOS only, after first paint, alongside the hand-over controller; subscribes to the store with `useSyncExternalStore`; on a pending link calls `setActiveTab('map-explorer')` (through the existing wrapper that also clears `mapFullscreen`, App.tsx line 331, so fullscreen state stays coherent) whether or not `'map-explorer'` is in the layout's hidden set (OQ-03; the layout document is not written), and passes `linkRequest={pending}` to `MapExplorer`.

### 4.5 Applying in Map Explorer (FR-36 to FR-38)

`MapExplorer` gains `linkRequest?: PendingLink` and one effect keyed on `[linkRequest?.id, phase.tag, hasEbirdKey]` that, for an id it has not applied yet:

1. `setViewMode(linkRequest.view)`; `setLiferWindow` or `setTargetViewMode` to `linkRequest.window`; `setRadius(25)` (session state, the same setter the sidebar's Radius control uses; the saved `map-defaults.dist` is not written). These three run immediately on the first render that sees the id, whatever `phase` is (FR-38: the view and window are applied even when the search cannot run).
2. If `phase.tag === 'setup-required'` or `phase.tag === 'error'` or `hasEbirdKey === false`: mark the id applied and stop; the view's existing setup message or key notice shows (FR-38). If `phase.tag` is still loading: do nothing yet; the effect re-runs when it settles (FR-37 cold start).
3. If `phase.tag === 'ready'`: mark the id applied, then run the location step: `setIsLocating(true)`, `getCurrentLocation()`, on success `setLat/setLng/setDetectedLocation/setPanTarget` exactly as `handleUseMyLocation` does, then `handleFindLifers(loc.lat, loc.lng, 25)` or `handleFindSightings(loc.lat, loc.lng, 25)` UNCONDITIONALLY (unlike `handleUseMyLocation`, which only searches when the center was empty: FR-36 says the search runs whether or not a center was set). On failure `setGeoError(describeLocationError(err))` and no search (FR-38).
   **Media (targets only, Stage 4, revised):** immediately AFTER the `handleFindSightings(...)` call returns its promise (not awaited), set `targetTypeFilter` from the link's media: `photo` to `new Set(['Photo'])`, `audio` to `new Set(['Audio'])`, `video` to `new Set(['Video'])`, `any` to `new Set()` (the in-app All, no chip selected; the in-app chip row keeps its label All, only the widget's word is Any). The order is load-bearing: `handleFindSightings`'s first statement is `setTargetTypeFilter(new Set())` (MapExplorer.tsx line 1459), so a filter set before the call would be cleared; set after it, React batches the two updates and the link's filter wins, and nothing later in the handler touches the filter. Each single type is the matching single chip and Any is the cleared chip row, so the tap-through is an exact match in every setting: the widget's Any (missing any of the three) is the in-app `targetSpecies` definition, and each single-type widget list is the in-app list with that one chip selected. The filter is set even on the degraded branch in step 2 when the phase is `ready` for the key-missing case, so the view is left as the link described it.
4. `clearPendingLink(id)` after the branch that marks it applied, so a second tap with the same values is a new id and re-runs (FR-37 "re-runs").

The "applied id" lives in a ref, so the effect's re-runs on `phase.tag` cannot double-apply. `handleFindLifers` / `handleFindSightings` are existing callbacks whose optional `overrideRadius` argument already exists for "Search this area"; no signature changes.

Media Targets note: `handleFindSightings` reads `targetSpecies` or `manualTargets`; with no ML export it uses the manual list, which is empty after a cold start, so it sets the existing "No target species to search for" validation error. That is FR-38's degraded outcome for the S4 case and needs no new copy. The media filter from the link is still applied in that case (it is a display filter over an empty result).

### 4.6 Entry safety

`deepLink.ts` and `linkRequest.ts` are dependency-free and on the entry graph by design (App.tsx imports both statically); `linkController.ts` and `widgetNative.ts` are reached only through `import()`. Neither imports `MapExplorer`; `MapExplorer` imports `linkRequest.ts` for the type only (`import type`, erased). `entryChunk.test.ts` gets both legs (section 8).

---

## 5. The Swift extension target

### 5.1 Names and identifiers

| Item | Value |
|---|---|
| Target name | `snowraven_widgets` |
| Product / display name | `SnowRaven Widgets` |
| Bundle id | `com.dtgibson.snowraven.widgets` (must be prefixed by the app's id; WidgetKit requires the extension to be a child bundle id of its host) |
| Deployment target | `17.0` (the app stays `16.0`: `project.yml` `options.deploymentTarget.iOS: 16.0` and `tauri.conf.json` `bundle.iOS.minimumSystemVersion: "16.0"` are both unchanged) |
| Test target | `snowraven_widgetsTests`, `type: bundle.unit-test`, `platform: iOS`, deployment target `17.0`, no host application (it compiles the `Logic/` sources directly) |
| Widget kinds (WidgetKit `kind` strings) | `"NearbyLifers"`, `"MediaTargets"`; display names from `MAP_VIEW_MODE_ORDER`: "Nearby Lifers", "Media Targets". Media Targets carries two configuration parameters (Time range, Media); Nearby Lifers carries one |
| App Intents | Two intents, one per kind, because the kinds no longer share a parameter set (Stage 4). `NearbyLifersIntent: WidgetConfigurationIntent` with one `@Parameter(title: "Time range") var range: TimeRange`. `MediaTargetsIntent: WidgetConfigurationIntent` with `range: TimeRange` and `@Parameter(title: "Media") var media: MediaNeed`. `TimeRange: AppEnum` has cases `day` ("Day"), `week` ("Week"), `all` ("30 days"), default `.week`; `MediaNeed: AppEnum` has cases `photo` ("Photo"), `audio` ("Audio"), `video` ("Video"), `any` ("Any"), default `.any` |

### 5.2 Files

```
src-tauri/gen/apple/snowraven_widgets/
  Info.plist                       NSExtension { NSExtensionPointIdentifier: com.apple.widgetkit-extension }, NSWidgetUsesLocation: true,
                                   CFBundleDisplayName "SnowRaven Widgets", CFBundleShortVersionString / CFBundleVersion $(MARKETING_VERSION) / $(CURRENT_PROJECT_VERSION)
                                   (see 5.4 for how the version is stamped), no usage-description keys (the app's grant is what is used)
  snowraven_widgets.entitlements   com.apple.security.application-groups: [ group.com.dtgibson.snowraven ]  (nothing else)
  Sources/
    Logic/                         PURE Swift, imports Foundation only. No WidgetKit, SwiftUI, CoreLocation or URLSession import,
                                   so the unit-test target compiles these files without a host app.
      AppGroup.swift               AppGroup.id, the directory and file names (pinned to Rust and TS by the parity guard)
      Handover.swift               WidgetHandoverV1 Decodable + validate() with the section 1.2 bounds; a failure is .absent (S1)
      WidgetCache.swift            WidgetCacheV1 Decodable/Encodable + validate() with the section 3.3 bounds; the TTL / 24 h / key-fingerprint rules as pure functions of (cache, handover, now, cell)
      SpeciesName.swift            stripTrailingParenthetical + fold (section 6.3)
      ObsDate.swift                the strict obsDt parse and the calendar-day difference (section 6.2)
      Distance.swift               distanceMiles (section 6.4) and the one-decimal formatter
      RecentObsReducer.swift       eBird body -> [WidgetRecord] (section 6.1)
      WidgetRows.swift             buildWidgetRows(records, handover, kind, window, media, reference, now, tz) -> [WidgetRow] (section 6.6)
      WidgetState.swift            the S1..S12 enum and resolveState(...) with the FR-29 precedence
      RetryAfter.swift             parseRetryAfterSeconds (the rateLimit.ts twin)
      DeepLink.swift               widgetURL(kind:window:) -> URL, the six-string builder (QA-34)
      AccessibilityLabel.swift     the label composer for NFR-05 / QA-53
    Widget/                        imports WidgetKit, SwiftUI, CoreLocation, AppIntents
      SnowRavenWidgets.swift       @main WidgetBundle { NearbyLifersWidget(); MediaTargetsWidget() }
      Intents.swift                TimeRange and MediaNeed AppEnums; NearbyLifersIntent and MediaTargetsIntent (5.1)
      LiferTimelineProvider.swift  AppIntentTimelineProvider; placeholder/snapshot (S12, no location, no request); timeline(for:in:)
      WidgetLocation.swift         CLLocationManager wrapper: isAuthorizedForWidgetUpdates, requestLocation, a 10 s bounded wait (OQ-07)
      EBirdClient.swift            one URLSession request builder + the body-size cap (section 6.5); the only file that imports URLSession
      CacheStore.swift             the actor that owns cache.json reads and writes
      Views/                       the SwiftUI views The Designer specifies (small, medium, large; state views); system text styles
src-tauri/gen/apple/snowraven_widgetsTests/
  Info.plist
  Fixture/                         a RESOURCE reference to ../../../frontend/src/lib/widgets/widgetRows.fixture.json (not a copy)
  *.swift                          the XCTest files (section 7.3), each with the CI-limit header sentence
```

The `Logic/` versus `Widget/` split is the boundary the tests rely on and the boundary the security review reads: everything that touches untrusted bytes (the eBird body, the hand-over, the cache) is in `Logic/`, pure and testable.

### 5.3 `project.yml` additions

```yaml
targets:
  snowraven_iOS:
    # existing entries unchanged, plus:
    dependencies:
      # existing framework/sdk entries unchanged, plus:
      - sdk: WidgetKit.framework
      - target: snowraven_widgets
        embed: true                      # XcodeGen adds the "Embed Foundation Extensions" phase into PlugIns/
    settings:
      base:
        # existing settings unchanged, plus:
        SWIFT_VERSION: "5.0"
    info:
      properties:
        # existing properties unchanged, plus:
        CFBundleURLTypes:
          - CFBundleTypeRole: Viewer
            CFBundleURLName: com.dtgibson.snowraven
            CFBundleURLSchemes: [snowraven]
        NSLocationWhenInUseUsageDescription: <the FR-20 string, identical in Info.ios.plist and the generated plist>

  snowraven_widgets:
    type: app-extension
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - path: snowraven_widgets/Sources
    info:
      path: snowraven_widgets/Info.plist
      properties:
        CFBundleDisplayName: SnowRaven Widgets
        NSExtension:
          NSExtensionPointIdentifier: com.apple.widgetkit-extension
        NSWidgetUsesLocation: true
    entitlements:
      path: snowraven_widgets/snowraven_widgets.entitlements
    settings:
      base:
        PRODUCT_NAME: SnowRaven Widgets
        PRODUCT_BUNDLE_IDENTIFIER: com.dtgibson.snowraven.widgets
        SWIFT_VERSION: "5.0"
        ARCHS: [arm64]
        EXCLUDED_ARCHS[sdk=iphoneos*]: x86_64
        ENABLE_BITCODE: false
        SKIP_INSTALL: true
        CODE_SIGN_ENTITLEMENTS: snowraven_widgets/snowraven_widgets.entitlements
    dependencies:
      - sdk: WidgetKit.framework
      - sdk: SwiftUI.framework
      - sdk: CoreLocation.framework
      - sdk: AppIntents.framework

  snowraven_widgetsTests:
    type: bundle.unit-test
    platform: iOS
    deploymentTarget: "17.0"
    sources:
      - path: snowraven_widgets/Sources/Logic
      - path: snowraven_widgetsTests
      - path: ../../../frontend/src/lib/widgets/widgetRows.fixture.json
        buildPhase: resources
    settings:
      base:
        PRODUCT_BUNDLE_IDENTIFIER: com.dtgibson.snowraven.widgetsTests
        SWIFT_VERSION: "5.0"
    scheme:
      testTargets: [snowraven_widgetsTests]
```

The extension target must NOT take `groups: [app]` (that group sets `PRODUCT_NAME: SnowRaven` and the app bundle id). The `Build Rust Code` pre-build script stays on the app target only. The `snowraven_iOS` scheme is what `tauri ios build` archives; the embedded extension builds as its dependency, and the test target has its own scheme.

`gen/apple` is committed generated output and `tauri ios init` re-stamps it (DECISIONS.md v0.5.68); the target block lives in `project.yml`, so a re-run would drop it. The guard in section 8 pins the target's presence, so the loss is loud rather than silent. After editing `project.yml` the Engineer runs `xcodegen generate` in `gen/apple` and commits the regenerated `snowraven.xcodeproj` (verify-item V2: the generated pbxproj embeds the appex under `PlugIns/` and the archive contains `SnowRaven.app/PlugIns/SnowRaven Widgets.appex`).

### 5.4 Version stamping

`tauri ios build` stamps `CFBundleShortVersionString` and `CFBundleVersion` into `snowraven_iOS/Info.plist` only. App Store validation requires the extension's `CFBundleShortVersionString` and `CFBundleVersion` to EQUAL the app's. Two options were weighed; the second is chosen:

- Stamp a second plist file in the release recipe: a second source of truth that goes stale exactly as `project.yml`'s version keys did at 0.5.63 (the reason `iosSceneManifest.test.ts` forbids them there).
- **Make the extension's plist read build settings**: `CFBundleShortVersionString: $(MARKETING_VERSION)` and `CFBundleVersion: $(CURRENT_PROJECT_VERSION)` in the extension's Info.plist, with the release recipe passing `MARKETING_VERSION=<ver> CURRENT_PROJECT_VERSION=<ver>.<n>` to `tauri ios build` through `xcodebuild`'s environment? Tauri does not forward arbitrary xcodebuild settings, so instead the recipe sets them on the ARCHIVE by exporting them before the build: XcodeGen supports `settings: base: MARKETING_VERSION: ...` but that too is a committed value. **The working form:** the extension's Info.plist uses `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)`, and the extension target's settings declare `MARKETING_VERSION: $(SNOWRAVEN_MARKETING_VERSION)` and `CURRENT_PROJECT_VERSION: $(SNOWRAVEN_BUILD_VERSION)`, which the release recipe supplies as ENVIRONMENT variables to `tauri ios build` (xcodebuild reads unresolved `$(...)` settings from the environment). The `snowraven-release` skill records the two exports beside the existing `APPLE_API_*` mapping, and the ship's `--validate-app` is what catches a mismatch (ITMS-90xxx "CFBundleShortVersionString of an app extension must match its containing app"). Verify-item V3: run one archive and confirm both plists carry the same version before the recipe is written as standing. If V3 fails, the fallback is the stamp-a-second-file route with a guard asserting equality between the two committed plists at the tag commit.

The `iosSceneManifest.test.ts` "never leads" rule extends: the extension's stamped version, where it is a literal, never leads `frontend/package.json` either (it is not a literal under the chosen form, so the row asserts the `$(...)` form instead).

### 5.5 Entitlements

- `gen/apple/snowraven_iOS/snowraven_iOS.entitlements`: add `com.apple.security.application-groups` = `[group.com.dtgibson.snowraven]` beside the three iCloud keys. Xcode still injects application-identifier / team-identifier.
- `gen/apple/snowraven_widgets/snowraven_widgets.entitlements`: `com.apple.security.application-groups` = `[group.com.dtgibson.snowraven]` and nothing else (no iCloud, no location entitlement: iOS location needs none).
- The macOS entitlement files are untouched.

### 5.6 The split deployment target, validated where it can be

An iOS app extension may declare a deployment target newer than its containing app; below that version the system does not load it and the app is unaffected (decisions.md, Apple forums thread 650651). App Store validation accepts the split (the 2020 iOS 14 widget wave shipped this way inside iOS 13 apps). Two consequences are recorded rather than assumed:

- **Debug install on a device below 17.0 fails** with `Failed to get descriptors for extensionBundleID` (decisions.md). The release skill states it; the standing device pass (FR-48) uses an iOS 17+ iPhone.
- **`--validate-app` is the gate** for the extension's plist, entitlement and profile (verify-item V4: the first validate of a build carrying the appex passes with no error naming the extension).

### 5.7 Location in the extension

`NSWidgetUsesLocation: true` in the extension's Info.plist; `CLLocationManager.isAuthorizedForWidgetUpdates` checked first (false means S6/S7 with no attempt); `requestLocation()` with a delegate bridged to an async continuation and a 10 s `Task` race (OQ-07; the timeout is a constant `locationWaitSeconds = 10` in `WidgetLocation.swift` with the measurement note the Engineer fills on device). `desiredAccuracy = kCLLocationAccuracyHundredMeters` (the app's own iOS branch passes `enableHighAccuracy: false`). Reduced accuracy is used as given (FR-17). The widget never calls `requestWhenInUseAuthorization` (FR-20).

---

## 6. The widget's list derivation (the third runtime of one rule)

### 6.1 The eBird request and the reduce (twin of `getRecentObs`)

- URL: `https://api.ebird.org/v2/data/obs/geo/recent?lat=<lat>&lng=<lng>&dist=40&back=30&fmt=json`, header `X-eBirdApiToken: <key>`. `lat` / `lng` are the reference point formatted with `String(format: "%.5f")` (the app formats through `String(latNum)` from a 5-decimal string; both are plain decimal numbers, and the URL builder's only interpolated values are two numbers and one header from a `^[A-Za-z0-9]{1,128}$` key, which cannot express a separator, host or scheme: the security.md outbound rule). `dist` is `Int((25 * 1.60934).rounded())` = 40, computed the same way `handleFindLifers` computes it and pinned by a test on both sides rather than restated as a literal (testing.md's "compare two declarations" rule). `maxResults` is deliberately NOT sent, so the request is the app's request (FR-21, NFR-07); the body cap in 6.5 is where the bound lives.
- Timeout: 20 s request timeout; `URLSession` with `allowsCellularAccess` true, no redirects followed (`URLSessionTaskDelegate` returns nil for the redirect request), `httpShouldSetCookies` false.
- Status: 200 decode; 401 or 403 = S11; 429 = back off (section 3.3); anything else = failure kind `http`.
- Reduce, exactly `getRecentObs` with no `codes`: for each object in the array, skip when `speciesCode` is not a non-empty string, or `lat` / `lng` are not finite numbers; key `speciesCode|locId` (`locId` defaults to `""`); keep the entry with the greatest `obsDt` by plain string comparison (`>` on the UTF-8 bytes, which for the eBird shape is chronological), carrying that entry's `subId`. Field defaults `""` where the app defaults `""`. Records whose reduced `obsDt` fails the strict parse in 6.2 are dropped at THIS stage (FR-13 "unparseable date... skipped"); the app drops them later in `isWithinWindow`, and the fixture asserts the two orders produce the same species set (they must: a dropped record can only fail to appear).

### 6.2 The date rule (strict twin of `isWithinWindow`, with the declared difference)

`ObsDate.parse(_ s: String) -> DateComponents?` accepts exactly `^[0-9]{4}-[0-9]{2}-[0-9]{2}( [0-9]{2}:[0-9]{2})?$` (anchored; explicit `[0-9]`, never `\d`, the v0.5.54 rule in Swift's `NSRegularExpression` where `\d` is likewise Unicode), then requires the calendar to accept the date as a real day (`Calendar.date(from:)` with `isValidDate`), and takes the date part only.

`ObsDate.daysBetween(obs, now, tz)`: both instants floored to local midnight in `tz`; the difference in days is `((nowMidnight - obsMidnight) / 86_400).rounded()` (round, not floor).

Window: `0 <= days && days <= windowDays` with `windowDays` 1 / 7 / 30 for Day / Week / 30 days, where 30 days means NO filter (every reduced record qualifies, FR-11): the `all` branch does not call the predicate at all.

Recency label: `days == 0` "Today", `1` "Yesterday", else "\(days) days ago".

**The declared symmetric difference against the app's `isWithinWindow`** (testing.md v1.0.20 / v1.0.32: both directions, each argued):

| Direction | Shape | App (`isWithinWindow`) | Widget (strict) | Argument |
|---|---|---|---|---|
| App admits, widget refuses | `+2026-09-01`, ` 2026-09-01`, `2026-9-1`, `2026-09-01T00:00` (anything `Number()` coerces that the anchored class does not) | admitted | refused | None of these can leave eBird: `obsDt` is documented and observed as `YYYY-MM-DD HH:mm` (or `YYYY-MM-DD`); the widget refusing them costs a row that the app would show only for a body eBird does not send. Enumerated by the generated-corpus test in 7.3, which runs every single-position edit of one conforming string over a 96-character alphabet through BOTH predicates and asserts the widget-admits-and-app-refuses set is EMPTY |
| Widget admits, app refuses | none | | | The strict class is a subset of what `Number()` coerces on every position, so this set is empty by construction; the corpus test asserts it rather than trusting the argument |
| Both admit, different answer | a rollover date (`2026-02-30`) | JS `new Date(2026, 1, 30)` rolls to March 2 and may be within the window | refused (not a valid calendar day) | An impossible date is not a report date; the corpus test carries the row and expects the widget to refuse and the app to admit, with the difference stated as "app row, no widget row", never the reverse |
| Both admit, different answer | the local spring-forward day, for a report exactly `windowDays` days old (and the recency label for a report from yesterday) | `floor((23 h) / 24 h)` = one day SHORT: on the day after a spring-forward transition the app counts yesterday as 0 days and a report 8 days old as 7, so a Week list on that one day admits an 8-day-old report | `.rounded()` counts calendar days correctly | This is CLAUDE.md's "agreeing wrong number" rule: twinning the floor would make both runtimes wrong on the same day and the parity fixture blind to it. The widget is correct; the app's off-by-one on one day a year is a separate Map Explorer fix (proposed for ROADMAP, not made here, since FR-14's "the widget matches the app" was written about the species rule and not about a latent DST defect). The fixture carries a "now" on the day after a spring-forward transition with a report exactly 7 and exactly 8 days old (7.2), and the TS twin in `widgetRows.ts` uses the ROUNDED count so vitest and XCTest agree on it |

### 6.3 The name rule (twin of `normalizeSpeciesName` + `toLowerCase`)

`SpeciesName.fold(_ s: String) -> String` = `stripTrailingParenthetical(s).lowercased()`, where `stripTrailingParenthetical` is the `lib/speciesUtils.ts` line 43 algorithm exactly: trim (Unicode whitespace on both sides, as JS `trim` does; Swift `trimmingCharacters(in: .whitespacesAndNewlines)` covers the same set for every character eBird ships, and the fixture's whitespace rows pin it); if the trimmed string does not end with `)` return it; find the last `)` BEFORE the final one (`prevClose`), then the first `(` AFTER `prevClose`; if none, return trimmed; else return the prefix before that `(`, trimmed. Operates on UTF-16 code units in JS and on `Character`s in Swift; the two agree because `(` and `)` are single code units in both and everything else is copied through. The hand-over's names are already folded, so the extension folds only the eBird `comName`.

### 6.4 The distance rule (twin of `distanceMiles`)

`Distance.miles(lat1, lng1, lat2, lng2)`: R = 3958.8, haversine with `atan2(sqrt(a), sqrt(1 - a))`, radians via `* .pi / 180`, in `Double`. JavaScript and Swift both use IEEE 754 binary64 and platform `libm` (`sin`, `cos`, `atan2`, `sqrt`); the results agree to well within 0.01 mi (QA-06's tolerance) and the fixture asserts each row's distance to 1e-6 mi, tighter than the display. Display: `String(format: "%.1f mi", d)`; the JS side's `toFixed(1)` and `%.1f` both round half away from zero on the decimal representation of the double, and the fixture includes a value at `x.x5` to pin it. Below 0.05 the format yields `0.0 mi` on both sides with no special case (FR-06).

**Tie safety:** the fixture's equal-distance pair is placed symmetrically (same latitude as the reference point, longitudes reference ± d), so the haversine inputs differ only in the sign of `dLng`, which enters squared; the two distances are bit-identical in both runtimes, and the tie-break (most recent, then name A to Z case-insensitive) is what the row order asserts.

### 6.5 The memory bound, measured

Measured on this machine (Swift 6.4, `-O`, a macOS process, resident-size delta around the load, decode and reduce of a synthetic body in eBird's documented record shape with 363 bytes per record):

| Records | Body | Growth: load + decode + reduce | Time |
|---|---|---|---|
| 5,000 | 1.8 MB | 1.9 + 6.0 + 1.9 = **9.9 MB** | 33 ms |
| 20,000 | 7.3 MB | 7.1 + 19.6 + 5.4 = **32.1 MB** | 72 ms |

WidgetKit's extension memory limit is 30 MB, and a SwiftUI extension process starts around 10 to 15 MB. So the 5,000-record dense fixture (NFR-02) fits with margin, and an unbounded body does not. **The bound is a body-size cap, not a `maxResults` parameter:** `EBirdClient` refuses a response whose `Content-Length` exceeds, or whose received bytes reach, `bodyCapBytes = 2_000_000` (about 5,500 records at the synthetic size; eBird's `geo/recent` returns one record per species, so a real 40 km / 30 day body is a few hundred records and a few hundred KB, and the cap is far above any real region). Over the cap: failure kind `too-large`, last good list kept (S9), no partial decode. Decoded once into `[WidgetRecord]` and the `Data` released before the rows are built, so one payload is held at a time (QA-50). The measurement is of a macOS process rather than the extension; QA-50 re-measures in the extension with the dense fixture using the allocation counter, and the cap is adjusted downward only if that measurement says so.

### 6.6 Rows, dedupe, order and states (the Swift contract; TS twin identical)

`buildWidgetRows(records, handover, kind, window, media, reference, now, tz) -> [WidgetRow]` (`media` is ignored for `lifers`; the TS twin has the same signature):

1. Filter by kind: `lifers` keeps records whose `fold(comName)` is NOT in `handover.recorded`. `targets` keeps records by the media setting (Stage 4, revised): `photo` keeps those whose folded name is in `targetsMissingPhoto`; `audio` those in `targetsMissingAudio`; `video` those in `targetsMissingVideo`; `any` those in any of the three (the union, which is the in-app Media Targets definition). Each kept targets record carries `missingMedia`: under `any`, the subset of `{photo, audio, video}` whose set contains the name (never empty for a kept row); under a single type, that one value, carried for uniformity but rendered without a glyph. A species in none of the three sets has all its media and is never listed under any setting. Sets are `Set<String>` built once per refresh.
2. Filter by window (6.2), except `all`.
3. Group by `speciesCode`; within a species pick the record with the smallest distance, ties by greatest `obsDt` (string compare), then smallest `locId` (string compare) (FR-08).
4. Sort rows by distance ascending; ties by greatest `obsDt`, then `fold(comName)` ascending by Unicode scalar value (FR-09's "A to Z, case-insensitive"; `fold` already lowercases, and a plain scalar comparison is what JS `<` on the lowercased strings does, so both sides sort identically without a locale).
5. A row is `{ comName (as eBird returned it), speciesCode, locId, locName, lat, lng, distanceMi, daysAgo, obsDt, subId, missingMedia: Set<photo | audio | video> }` (`missingMedia` empty for lifers); the family shows the first N (1 / 3 / 8). Ordering (step 4) does not consult `missingMedia`. The accessibility label under `any` appends "needs photo", "needs audio", "needs video" or the combination in the fixed order photo, audio, video ("needs photo and audio", "needs photo, audio and video") to the row (decisions.md); under a single type the title already names the setting and the row carries no phrase.

`resolveState(handover, hasLocation, usedDefault, fetch, rows, media)` implements the FR-29 table in the stated precedence: S1 (absent or invalid), S2 (`ebirdKey == nil`), S3 (`!hasEbirdBackup`), S4 (targets kind and `!hasMlExport`), S5 (targets kind and the set for the setting is empty: the matching per-type set for Photo, Audio or Video; all three empty for Any), S6 (no location and no default), then the fetch outcome (S11 on 401/403; S8 when the attempt failed and no usable last good; S9 when it failed and there is), then S10 (zero rows), else the list; S7's caption composes with the list, S9 and S10. QA-29's table test drives every row.

---

## 7. The parity fixture

### 7.1 Files and roles

- **`frontend/src/lib/widgets/widgetRows.ts`** (pure TS, entry-irrelevant): `reduceRecentObs(body)` (a re-export of the reducer extracted from `lib/tauri/mapService.ts` so both the transport and the twin call ONE function; the extraction is behavior-preserving and pinned by `mapService.recentObs.test.ts` staying green), `parseObsDateStrict`, `daysBetweenRounded`, `foldName`, `buildWidgetRows(...)`. This is the TypeScript twin of `Logic/`, and it is what the fixture generator drives.
- **`frontend/src/lib/widgets/widgetRows.fixtureGen.test.ts`**: env-gated (`SR_GEN_WIDGET_FIXTURE=1`), writes `widgetRows.fixture.json` from the shipped TS twin over hand-authored INPUTS (testing.md v1.0.29: outputs are generated, never hand-written). Canonical JSON, integral floats normalized (JSON carries no int/float distinction).
- **`frontend/src/lib/widgets/widgetRows.fixture.json`** (tracked): `{ tz, nowIso, reference, handover, mlRows, body, expected: { lifers: { day, week, all }, targets: { photo: { day, week, all }, audio: { ... }, video: { ... }, any: { ... } } }, expectedReduced, distanceRows, dateRows, retryAfterRows, foldRows, links }`. `mlRows` are the hand-authored Macaulay rows the hand-over's three target sets are generated FROM (the generator runs the shipped `buildHandover` over them), so the fixture pins the writer as well as the reader.
- **`frontend/src/lib/widgets/widgetRows.parity.test.ts`**: reads the fixture and asserts the TS twin reproduces `expected` byte for byte (the delivery check), AND the parity claim against Map Explorer: for every window, `Set(rows.map(speciesCode))` equals `Set(buildNearbyLifers(records.filter(isWithinWindow), recordedNames, ...).flatMap(l => l.lifers.map(s => s.speciesCode)))` (the in-app path, with the app's own predicate and builder). For targets the claim is equality in every setting, as the revised decisions.md states it: `photo` rows equal the in-app `targetSpecies` narrowed by `targetTypeFilter = {Photo}` (species missing Photo); `audio` likewise with `{Audio}`; `video` with `{Video}`; `any` rows equal the in-app `targetSpecies` with no chip selected (the in-app All). No superset or subset language remains. The fixture's `now` is not on a spring-forward day for THIS assertion (the DST row is a separate family where the difference is expected and asserted as such).
- **`snowraven_widgetsTests/*.swift`**: read the same file from the test bundle and assert `Logic/` reproduces `expected` byte for byte (QA-11, QA-13, QA-14) plus every side table.

### 7.2 What the fixture carries (FR-16's list, and the additions from this schema)

The eBird-shaped `body` includes: a species whose `comName` has a trailing parenthetical form and whose parent is recorded ("Mallard (Domestic type)" reported, "mallard" recorded); a mixed-case name against a lowercased recorded entry ("NORTHERN SHRIKE"); a non-ASCII name ("Rüppell's Griffon"); a same-day report; a report exactly 7 days old; one 8 days old; one 29 days old; a record with no coordinates; one with a non-numeric `lat`; one with no `speciesCode`; a species reported at two locations (nearer one wins); two species at bit-identical distance (the symmetric pair, 6.4) with different `obsDt`; two at identical distance and `obsDt` with names differing only in case; a record with `obsDt` `2026-02-30`; a non-countable form and an escapee that are NOT recorded (both appear, on both sides: FR-14's "no countability filter"); 12 qualifying species so the 1 / 3 / 8 family cut is asserted (QA-03). **Media rows (Stage 4, revised):** eight recorded species that are also in the body, one per subset of the three media types their `mlRows` GIVE them, so their missing sets cover every case: none held (missing all three: listed under all four settings, `missingMedia = {photo, audio, video}` under Any), Photo only held (missing audio and video), Audio only held, Video only held, Photo and Audio held (missing only Video: listed under Video and Any, `{video}`), Photo and Video held, Audio and Video held, and all three held (listed under no setting). The expected rows under each of the four settings follow from the missing set, and the generator derives them rather than the author. `handover` carries the recorded set and the three target sets, with the no-export variant and each single-set-empty variant plus the all-empty variant as sibling families for the S4 / S5 rows. Side tables: `distanceRows` (including an `x.x5` display case and a 0.04 mi case), `dateRows` (the strict-parse corpus seeds and the DST family with its own `nowIso`), `retryAfterRows` (the `rateLimit.test.ts` table), `foldRows` (whitespace, nested parentheses, an unbalanced `(`, an empty string), `links` (the fifteen URLs with their kind, window and, for targets, media).

### 7.3 The corpus and the structural rules

- **Generated corpus (testing.md v1.0.32):** `widgetRows.corpus.test.ts` takes one conforming `obsDt`, applies every single-position substitution over a 96-character alphabet plus every single deletion and insertion, and runs each through `isWithinWindow` (the app) and `parseObsDateStrict` (the widget), asserting the widget-admits-and-app-refuses set is empty and printing the reverse set's size in the assertion message. Runs in milliseconds; states its own `testTimeout`.
- **Structural equality (CLAUDE.md, "agreeing wrong number"):** `buildWidgetRows(body with a malformed record)` equals `buildWidgetRows(body without it)` for every malformed family (no coordinates, non-numeric coordinate, missing code, bad date), on both runtimes, each deriving its own expectation from its own builder. No oracle needed and it cannot go stale. **Three more, for the media setting (Stage 4, revised):** (a) on both runtimes, for every window, the species set of `any` equals the union of the species sets of `photo`, `audio` and `video` (Any = Photo ∪ Audio ∪ Video), and for every row under `any` its `missingMedia` equals exactly the set of single-type settings under which that species is listed (so the glyphs are derived from the same membership the single-type lists are, not from a second computation); (b) `buildHandover(mlRows)` equals `buildHandover(mlRows with a row for a type the species already holds added again)`, the duplicate-row identity, so the writer's sets depend on which types a species has and never on how many rows say so; (c) `buildWidgetRows(handover with species X in none of the three target sets)` equals `buildWidgetRows(handover with X removed from recorded too)` for the targets kind, so a species holding all three types is invisible to the widget by construction rather than by fixture row.
- **Two-sided bounds (security.md v1.0.20):** each side has a test that deletes that side's own enforcement (the TS builder's bound, the Rust command's bound, the Swift reader's bound) and goes red; the parity guard pins the constants to one value.
- **Seam failure rows (testing.md's seam corollary):** the location seam gets both a `throws` row and a `returns nil` row and they want DIFFERENT answers (S6 / S7 fallback either way, but the caption is only for the fallback, and the wait bound is asserted for the hang case); the eBird transport gets a `rejects` row and a `resolves with an unusable body` row, and the state resolution distinguishes them (`offline` / `timeout` versus `malformed` / `too-large` in `lastFailure.kind`).

### 7.4 The honest CI statement

`ubuntu-latest` cannot compile Swift. The vitest halves run on CI; the XCTest halves run on the release machine with `xcodebuild test -project src-tauri/gen/apple/snowraven.xcodeproj -scheme snowraven_widgetsTests -destination 'platform=iOS Simulator,name=<an iOS 17+ device>'` through the `/tmp/xcshim` wrapper with `DEVELOPER_DIR` exported (the skill's standing shim: this shell's `xcodebuild` fails exactly that way, because `DEVELOPER_DIR` points at the command-line tools). Every XCTest file's header states this in one sentence; the release skill lists the command as a step BEFORE the archive; the QA table marks each Swift row `[Swift]`. A vitest row asserts each XCTest file carries the header sentence, so the statement cannot silently disappear.

---

## 8. Guards

### Extended

| Guard | Extension |
|---|---|
| `lib/iosSceneManifest.test.ts` | Exports `parsePlist`, `yamlBlock`, `yamlWithoutComments` (already `export`ed / made so) for reuse; gains no rows itself so its 1.0.30 purpose stays one purpose |
| `lib/entryChunk.test.ts` | Positive legs: `lib/widgets/widgetHandover.ts`, `lib/links/deepLink.ts`, `lib/links/linkRequest.ts`, `lib/mapDefaultsChanged.ts` ARE on App.tsx's static graph. Negative legs: `widgetHandoverController.ts`, `widgetNative.ts`, `linkController.ts`, `widgetRows.ts` are NOT; no statically reachable file imports `@tauri-apps/api/event` or `MapExplorer` through the new modules |
| `lib/cacheInventory.test.ts` | One row: `clearDerived.ts` registers NO row for the hand-over (a `not.toContain('handover')` over the registry) with the section 1.6 reason in the message, so the next reader learns the decision from the guard |
| `lib/icloudPaths.parity.test.ts` pattern (new sibling `widgetPaths.parity.test.ts`) | `APP_GROUP_ID`, `WIDGETS_DIR`, `HANDOVER_FILE`, `HANDOVER_MAX_BYTES`, `LINK_SCHEME`, `LINK_MAX_BYTES` / `LINK_MAX_LENGTH` pinned across `widgets.rs`, `widgetHandover.ts`, `deepLink.ts`, `AppGroup.swift`, `DeepLink.swift`, both entitlement files; the Rust `HandoverDoc` derives no `Debug` |
| `lib/singleWebviewInvariant.test.ts` | Unchanged and must stay green (section 2.6) |
| `lib/tabOrderCoverage.test.ts` | Unchanged: this feature adds no button or link to the app's `.tsx` |

### New

- **`lib/iosWidgetManifest.test.ts`** (QA-20, QA-34, QA-40, QA-49): `CFBundleURLTypes` identical across the three plist sources with exactly one scheme `snowraven`; `NSLocationWhenInUseUsageDescription` identical across the two app plist copies and containing "widget"; the extension's plist declares `NSWidgetUsesLocation` true and the WidgetKit extension point; `project.yml` names target `snowraven_widgets` of type `app-extension` with `deploymentTarget: "17.0"`, `options.deploymentTarget.iOS` stays `16.0`, and `tauri.conf.json` `minimumSystemVersion` stays `"16.0"`; `com.apple.security.application-groups` equals `[group.com.dtgibson.snowraven]` in both entitlement files; the vendored `scene.rs` carries the `URLContexts()` forward; each row with a one-character mutation check (QA-49). Pure JS, like its sibling.
- **`lib/widgets/widgetHandover.test.ts`** (QA-30, QA-32): field set, sorting, folding, bounds refusal, the no-write gates.
- **`lib/widgets/widgetHandover.triggers.test.ts`** (QA-23, QA-31): the writer runs once per epoch of each of the three signals and on boot; each write is one native call and one document; clear shapes.
- **`lib/links/deepLink.test.ts`** (QA-35, QA-52): the six valid URLs, the hostile table, and a linear-time check over 10,000 generated inputs with the length gate mutated out to prove it is the gate.
- **`lib/links/linkRequest.test.ts`** + an `App` / `MapExplorer` link test (QA-36 to QA-38): last-one-wins before mount, the tab switch, view / window / radius / one search call, the degraded outcomes.
- **`widgetRows.parity.test.ts`**, **`widgetRows.corpus.test.ts`**, **`widgetRows.fixtureGen.test.ts`** (section 7).
- **`lib/widgets/widgetCopy.test.ts`** (QA-55): a scan of the Swift string table (`Widget/Strings.swift`) and the changed prose files for U+2014 and the house British-spelling list.
- **Swift XCTest files** (section 7.4): `WidgetRowsParityTests`, `RecentObsReducerTests`, `ObsDateTests`, `DistanceTests`, `WidgetStateTests` (QA-29 table), `WidgetCacheTests` (QA-12, QA-24 to QA-28), `HandoverDecodingTests` (QA-33), `DeepLinkTests` (QA-34), `AccessibilityLabelTests` (QA-53), `EtiquetteTests` (QA-51 over a simulated hour with a recording transport).

### `.claude/rules/*.md` `paths` to extend in the same change (CLAUDE.md v1.0.32 obligation)

- `security.md`: `frontend/src/lib/widgets/**`, `frontend/src/lib/links/**`, `frontend/src/lib/mapDefaultsChanged.ts`, `src-tauri/src/widgets.rs`, `src-tauri/gen/apple/snowraven_widgets/**`, `src-tauri/gen/apple/Sources/snowraven/WidgetReload.swift`, `src-tauri/vendor/tao/src/platform_impl/ios/scene.rs`, `src-tauri/gen/apple/**/*.entitlements`, `src-tauri/Info.ios.plist`, `src-tauri/gen/apple/snowraven_iOS/Info.plist`, `src-tauri/gen/apple/project.yml`. Reason: the deep-link parser, the hand-over writer and reader, the eBird decode, the URL builder, the entitlements and the scheme registration are all things this rule's bodies govern.
- `testing.md`: `src-tauri/gen/apple/snowraven_widgetsTests/**` and `frontend/src/lib/widgets/*.fixture.json`. Reason: the twin-parity fixture rule and the symmetric-difference rule govern those files.
- `.claude/skills/snowraven-release/SKILL.md` is not path-gated; it is edited (section 10).

---

## 9. Declared scans over untrusted text (security.md: declared up front, with the linearity argument)

| Scan | Input | Bound | Linearity |
|---|---|---|---|
| `parseWidgetLink` (TS) | a URL string from native, ultimately from whatever process opened the scheme (any app can open `snowraven://...`) | `length <= 64` checked first | one length check and one `Object.hasOwn` on a fifteen-entry null-prototype table: O(1) after the gate; no regex, no `URL`, no decoding |
| The Rust `on_event` hook | tao's parsed `url::Url` list | scheme equality then `as_str().len() <= 512` | O(n) in the URL length with n <= 512; only the last qualifying URL is kept |
| `widgets_write_handover` (Rust) | a JSON body from the app's own webview (trusted author, untrusted at the file-type level) | `len <= 4,000,000` before parse | one `serde_json` parse, linear; field bounds checked per element in one pass |
| `Handover.validate()` (Swift) | the hand-over file, another process's document | file size <= 4,000,000 before read (`FileManager` attributes) | one `JSONDecoder` pass, then one linear pass over the arrays for the per-string bounds; set construction is O(n) with hashing |
| `RecentObsReducer` (Swift) | the eBird body (a third party's bytes over TLS) | `bodyCapBytes = 2,000,000` before decode | one decode, one linear pass, a dictionary keyed on `speciesCode|locId` (O(1) expected per record); the key string is bounded by the two fields' 512-code-unit caps |
| `SpeciesName.fold` (Swift, and `foldName` TS) | eBird `comName`, bounded 512 | three `index` scans from the end (`lastIndex(of:)`, `firstIndex(of:)`), each linear, no backtracking | |
| `ObsDate.parse` (Swift) | eBird `obsDt`, bounded 512 | one anchored regex with fixed-width classes and no nested quantifier: linear, no catastrophic backtracking; the TS strict twin uses the same anchored class | |
| `WidgetCache.validate()` (Swift) | the extension's own document (self-authored, untrusted at the file-type level: security.md v1.0.11) | file size <= 8,000,000 before read | one decode, one linear pass |
| `parseRetryAfterSeconds` (Swift) | an eBird response header | `^[0-9]{1,3}$` | constant |
| eBird `locName` and `comName` in the UI | rendered as SwiftUI `Text` (no markup interpretation), truncated with `.lineLimit(1)` and `.truncationMode(.tail)`; the accessibility label is the full string | 512 | display only; nothing from the body reaches a URL, a log or a format string |

Nothing from the deep link is reflected into the UI (NFR-04); the only things it changes are three enum-typed state values, one set-valued filter chosen from three fixed sets, and one radius literal.

---

## 10. Portal prerequisites and release recipe changes

**Portal (human, one-time; the ASC API can do steps 1 and 4 to 5, and the two marked UI cannot be done by API):**

1. Register the bundle id `com.dtgibson.snowraven.widgets` (API: `POST /v1/bundleIds` `{ identifier, platform: IOS, name: "SnowRaven Widgets" }`, with the metadata key `QJA25M7XHM`).
2. **UI:** register the App Group `group.com.dtgibson.snowraven` (Certificates, Identifiers & Profiles, Identifiers, App Groups). The public API has no App Group resource.
3. **UI:** enable App Groups on BOTH App IDs (`com.dtgibson.snowraven` and the new one) and assign the group to each (`POST /v1/bundleIdCapabilities` with `capabilityType: APP_GROUPS` can enable the capability; the group ASSIGNMENT is UI only, exactly as the iCloud container assignment was).
4. Create the extension's `IOS_APP_STORE` profile (API: `POST /v1/profiles`, bundle id from step 1, certificate `TLXMPPT4QY`, name "SnowRaven Widgets App Store 2026MMDD"); decode to `~/.tauri/snowraven-ios-widgets-appstore.mobileprovision` and install under both profile directories as the skill describes.
5. **Regenerate the app's App Store profile** (the App ID gained a capability, so the 2026-09-01 iCloud profile no longer authorizes the entitlement set): same API call as the skill's "iCloud-era export" bullet, new name, replace the file, install; the old profile is left in place until the new one has shipped once.
6. Development profiles for device debugging are Xcode automatic signing's job and are unaffected by the cloud-managed DISTRIBUTION certificate refusal; if `tauri ios dev` refuses the appex on a device, the fallback is a manual development profile for each bundle id (verify-item V5).

**Release recipe (`snowraven-release` skill, new "iOS widgets" subsection; `release.sh` and the Windows CI are untouched):**

- Before the archive: `xcodebuild test` for `snowraven_widgetsTests` (7.4).
- The two version exports for the extension's plist (5.4), beside the `APPLE_API_*` mapping.
- `~/.tauri/snowraven-ios-export-options.plist` gains a second `provisioningProfiles` entry mapping `com.dtgibson.snowraven.widgets` to the widget profile NAME; everything else in that plist is unchanged (`iCloudContainerEnvironment` Production stays).
- After export: confirm `DistributionSummary.plist` lists BOTH bundle ids, each with `com.apple.security.application-groups`, and the app's three iCloud keys as before.
- `--validate-app` before `--upload-app`, as always; the first ship expects it to be the step that names any missing entitlement on the appex.
- The device pass (FR-48) is extended: add one widget of each kind, wait for a refresh with real rows and distances, tap through, confirm view / window / location. Recorded in the ship record before the submission time.
- The debug-install caveat below iOS 17 (5.6).
- The App Store privacy label is re-confirmed "Data Not Collected" in the ASC UI and written into the ship record (FR-44).

---

## 11. Migration plan (ordered steps for The Engineer)

1. **Portal steps 1 to 3** (section 10; the user does 2 and 3 in the UI). Nothing below depends on them until step 12; step 9 needs them for a device build.
2. **tao:** the `scene.rs` hunk (4.3); `VENDORED.md` second section; `cargo check --target aarch64-apple-ios` through the shim.
3. **Rust:** `src-tauri/src/widgets.rs`, the `lib.rs` registrations under `cfg(target_os = "ios")`, `cargo check` for `aarch64-apple-darwin`, `aarch64-apple-ios` and (via CI) Windows. The `extern "C"` shim symbol resolves only at the Xcode link.
4. **TS entry-safe modules:** `lib/mapDefaultsChanged.ts`, `lib/widgets/widgetHandover.ts`, `lib/links/deepLink.ts`, `lib/links/linkRequest.ts`, with their tests; `entryChunk.test.ts` legs.
5. **TS controllers:** `lib/widgets/widgetNative.ts`, `widgetHandoverController.ts`, `lib/links/linkController.ts`; `App.tsx` boot and subscription; `Settings.tsx` two `notifyMapDefaultsChanged` calls; the triggers test.
6. **TS twin:** extract the reducer from `mapService.ts` into `lib/widgets/widgetRows.ts` (behavior-preserving; existing tests green), the strict date, fold, distance re-export, `buildWidgetRows`; the fixture generator; generate the fixture; the parity, corpus and structural tests.
7. **`MapExplorer.tsx`:** the `linkRequest` prop and effect (4.5); the link tests.
8. **Plists and entitlements:** `CFBundleURLTypes` and the usage string in the three sources; App Group key in the app entitlements; `iosWidgetManifest.test.ts`; `widgetPaths.parity.test.ts`.
9. **The extension:** `project.yml` (5.3), the `snowraven_widgets/` tree (5.2) with `Logic/` first and its XCTest target, then `Widget/` per The Designer's Stage 4 spec; `WidgetReload.swift` in the app target; `xcodegen generate`; commit the regenerated `.xcodeproj`; `xcodebuild test` on a simulator; `tauri ios build` (debug) to confirm the appex embeds and the app still launches (a SCREENSHOT, per the scene-manifest rule, since the manifest files are touched).
10. **Rules and skill:** `security.md` / `testing.md` `paths` (section 8); the release skill subsection (section 10).
11. **Prose:** `PRIVACY_POLICY.md`, `product-brief.md`, `ACCESSIBILITY.md`, `docs/HELP.md`, `appstore/REVIEW_NOTES.md` (FR-42 to FR-44); the `README.md` / `website/` proposal through the approval gate (FR-45); `CHANGELOG.md`; the four-file version set to 1.0.36.
12. **Ship** per section 10, device pass before submission.

`npm run build` and `npm run typecheck` before every push (testing.md); the full frontend suite green; the backend suite untouched but run.

---

## 12. Design decisions

1. **Hand-over is a file, written whole, regenerated on every trigger, never patched and never purged.** A patch would need a read-modify-write across two processes; a whole rewrite from fresh reads is idempotent and the extension's validation makes a torn read impossible to act on.
2. **The key rides the hand-over, not a keychain access group** (1.5). Parity with the app's own storage, no new entitlement class, no migration of the app's key.
3. **Names are folded (normalized and lowercased) at write time**, so the extension performs one operation on eBird's names and the case-folding rule has one home.
4. **Rust command + one `@_cdecl` Swift function** rather than a Tauri Swift plugin (2.1).
5. **In-repo `on_event` hook, not `tauri-plugin-deep-link`** (4.3): same delivery event, no dependency, no capability, no plist-rewriting build script; and the cold-start gap needs the vendored tao line either way.
6. **A second vendored tao line** for cold-start URL delivery, with an upstream PR owed (4.3). The alternative (interactive widgets carrying an App Intent that writes a pending link before opening the app) is out of scope and would still not cover a `widgetURL` tap.
7. **Exact-match six-string parser** (4.1): the widget is the only author, so a grammar is surface without benefit.
8. **The widget's date arithmetic is correct rather than a copy of the app's floor** (6.2), with the app's DST off-by-one declared and proposed for ROADMAP. The parity fixture is blind to an agreeing wrong number by construction, so the decision had to be written here.
9. **Body cap, not `maxResults`** (6.5): the request stays the app's request, and the bound lives where the memory is spent.
10. **Cache invalidation by key fingerprint inside the widget's own document** (3.2), so the app never touches the extension's file and FR-25 is a property of the reader.
11. **Extension version stamped from build settings supplied by the release recipe** (5.4), with the second-committed-plist route as the fallback if V3 fails.
12. **`map-defaults` gets its own epoch module** (1.4), the CLAUDE.md shape for a document that gains an off-tab reader.
13. **Patch bump** (OQ-06), a new extension notwithstanding; CLAUDE.md's default stands unless the user says otherwise.
14. **The media setting (Stage 4, revised the same day) is three folded per-type name sets in the hand-over, a second intent parameter with four cases, a media query value on the targets link, and a local filter over the shared cache.** The cache, the request and the etiquette are unchanged; Any is the union of the three sets, which is the in-app Media Targets definition, and each single type maps to the matching in-app chip (Any to the cleared chip row the app labels All), so parity is equality in every setting. The widget's fourth value is named Any and its token is `media=any`; the in-app chip label All and the Time range window token `'all'` (30 days) are unrelated and unchanged. The earlier same-day shapes (Photo / Audio / Both with Video ignored, then All) are superseded and nothing of them remains in this document.

## 13. Risks and Engineer verify-items

- **V1** XcodeGen picks up `WidgetReload.swift` under the existing `sources: Sources` entry and the Rust `extern "C"` symbol links; if Swift in the app target causes a mixed-language linking issue with `main.mm`, the fallback is an ObjC file exposing the same C symbol that calls into a Swift class through `@objc`.
- **V2** The generated pbxproj embeds the appex under `PlugIns/` and `tauri ios build` archives it as a dependency of the `snowraven_iOS` scheme without cargo-mobile2 objecting to a second target.
- **V3** The `$(MARKETING_VERSION)` / `$(CURRENT_PROJECT_VERSION)` environment route stamps the extension's plist equal to the app's; fallback in 5.4.
- **V4** `--validate-app` accepts the split deployment target and the appex's entitlement set on the first widgets build.
- **V5** `tauri ios dev` on a device signs the appex with automatic development signing; fallback in section 10 step 6.
- **V6** `isAuthorizedForWidgetUpdates` reads true after the user grants When In Use in the app, without a second prompt (QA-17); if iOS requires the app to have called `requestWhenInUseAuthorization` in the SAME app version, the app already does on "Use my location" and nothing changes.
- **V7** The cold-start `Opened` event reaches the plugin hook with the URL intact on a real device (QA-37 cold start); if tao's `handle_nonuser_event` inside `willConnectToSession` proves too early in practice, the fallback is to store the URL contexts in a tao-side static inside the same hunk and emit on the first `sceneDidBecomeActive`, still one vendored file.
- **Risk:** WidgetKit's refresh budget is the system's; a 30 minute policy is a request. The update time on the tile is the honesty mechanism (FR-28), not the cadence.
- **Risk:** the App Group container's protection class is inherited from the device's default; if a future iOS changes the default for App Group containers to `Complete`, refreshes while locked will read S1. The extension's S1 copy ("open SnowRaven once") is then wrong for that case; a `version: 2` document could carry a `protection` field. Noted, not built.
- **Risk:** the app's `isWithinWindow` DST off-by-one (6.2) is now written down; leaving it unfixed in the app is a decision with a reversal condition (fix `isWithinWindow` to round, re-generate the fixture's DST family to expect agreement), proposed for ROADMAP by the Chronicler.
