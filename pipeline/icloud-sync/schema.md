# Schema: iCloud Sync

**Feature:** icloud-sync
**Date:** 2026-09-01
**Stage:** 3, The Architect
**Source:** prd.md (approved), strategic-brief.md, the Orchestrator's research note

## Path

**Incremental.** Prior `schema.md` files exist (the cumulative data model in `pipeline/mobile-app/schema.md` Part 1), the persisted documents under `AppLocalData/data/` are live, and this feature adds a shared record format, extends `metadata.json`, adds one settings key, and adds native code on two platforms. It is not frontend-only.

## Architect assessment

No blocker on the distribution path. Apple's macOS capability table lists "iCloud: iCloud documents" as available to Developer ID signed apps; the price is a restricted entitlement that must be authorized by an embedded Developer ID provisioning profile, and Tauri can embed one through `bundle.macOS.files` (verified on the installed `tauri-utils` 2.9.3: `MacConfig.files: HashMap<PathBuf, PathBuf>`, "relative to the Contents directory", and its own doc cites `embedded.provisionprofile` in `macOS > files` as the way to ship a profile). The objc2 bindings the native layer needs all exist in the installed `objc2-foundation` 0.3.2 (`URLForUbiquityContainerIdentifier`, `ubiquityIdentityToken`, `startDownloadingUbiquitousItemAtURL_error`, `NSFileCoordinator`, `NSMetadataQuery`, `NSHost`) and `block2` 0.6.2 is already in `Cargo.lock`.

Two facts the earlier schemas get wrong, corrected here:

- **True bundle identities.** macOS is `com.snowraven` (`src-tauri/tauri.conf.json`). iOS is `com.dtgibson.snowraven` (`src-tauri/tauri.ios.conf.json`, the Tauri per-platform overlay, plus `gen/apple/project.yml`; decision 2026-07-05 in `pipeline/mobile-app/decisions.md`: the user's App Store Connect record was created under that id). `pipeline/mobile-app/schema.md` §2.4 still says `com.snowraven` for iOS; it is superseded. `appstore/LISTING.md` does not name the id.
- **`release.sh` does not re-lipo or re-codesign.** Tauri builds and signs the universal bundle itself (`APPLE_SIGNING_IDENTITY` in the environment); the script only verifies, styles the DMG, notarizes, staples, and publishes. So the profile and entitlements must go in at Tauri build time, and the script's job is to supply them and verify the result.

## Existing data model used by this feature (unchanged)

Desktop and iOS, all under `AppLocalData/data/` through `TauriStorage` (`frontend/src/lib/storage.ts`):

| Document | Read by this feature | Written by this feature |
|---|---|---|
| `metadata.json` (`{ ebird: FileMetadata \| null, ml: FileMetadata \| null }`) | yes | yes, extended (below) |
| `ebird-backup.csv`, `ml-export.csv` | yes (pushed to iCloud) | yes (replaced whole by a pull, removed by a synced clear) |
| `settings.json` (generic key store via `getSetting`/`setSetting`) | yes | yes, one new key (below); never synced (FR-12) |
| `api-keys.json`, `map-style/*.json`, `replay.json`, every derived cache document | no | never (FR-12, QA-11) |

The per-document write chain (`docChains`, keyed by `API_KEYS_PATH`, `SETTINGS_PATH`, `META_PATH`) is the concurrency mechanism this feature rides. Rule 1 (a link never awaits another chained op) and rule 2 (a failed link rejects only its caller) hold for every new link below. `cacheInventory.test.ts` forbids `Map<`/`Set<`/`shift(`/`splice(` in `storage.ts`; nothing below needs them.

## Changes in this feature

### Added

- **iCloud container** `iCloud.com.dtgibson.snowraven`, `Documents/` holding four files: `ebird.record.json`, `ebird-backup.csv`, `ml.record.json`, `ml-export.csv` (shared record format below).
- **`settings.json` key `icloud-sync`** (one object, one link per save): `{ version: 1, enabled: boolean, deviceId: string | null, lastCheckAt: string | null }`. `deviceId` is minted on first enable (32 lowercase hex chars from `crypto.getRandomValues`, FR-13) and never regenerated. Chosen over a new document because `setSetting` already rides the settings chain: zero new chain keys, zero `docChains` changes, and FR-10 (device-local, never synced) holds because `settings.json` is never pushed.
- **`metadata.json` entry fields** (optional, backward compatible): `origin?: { deviceId, label, platform }` and `replacedBySyncAt?: string`.
- **Native module** `src-tauri/src/icloud.rs` (macOS + iOS), commands below.
- **Frontend modules** under `frontend/src/lib/icloud/` plus `lib/filesChanged.ts`, `lib/useFilesEpoch.ts`, `platform.ts#isMacOS`, `platformGates.ts#showICloudSync`.
- **Storage seam methods** `applySyncedFile`, `applySyncedClear`, `stampFileOrigin`, and an optional `origin` argument on `writeFile`.
- **Entitlements** `src-tauri/entitlements.icloud.plist` (macOS, release only) and the three iCloud keys in `gen/apple/snowraven_iOS/snowraven_iOS.entitlements`.
- **Release preflight and post-build check** in `release.sh`; a new section in the `snowraven-release` skill.

### Modified

- `FileMetadata` type; `TauriStorage.writeFile` (writes `origin` when given); `Settings.tsx` Default Files rows and a new section below them; `App.tsx` (`filesVersion` derived from the shared epoch; controller boot behind the gate); `BirdingStats.tsx`, `MapExplorer.tsx`, `ListComparer.tsx` (subscribe to the epoch, FR-35); `lib.rs` and `Cargo.toml` (target block move, command registration); `platform.ts`, `platformGates.ts`; `entryChunk.test.ts`; docs and policy files per NFR-08; versions 1.0.11 and CHANGELOG.

### Unchanged

`WebStorage` behavior, the Python backend, Windows and Linux binaries (the apple-only target block and `cfg` gates keep them byte-equivalent apart from the version), `.github/workflows/windows-build.yml` (verified: no entitlement, profile, or codesign reference), `tauri.conf.json`'s committed `bundle.macOS.entitlements` (still `./entitlements.plist`; the iCloud file is overlaid only by `release.sh`), `Info.plist` and `Info.ios.plist` (`NSUbiquitousContainers` omitted, OQ-7), the fs capability scope (`$APPLOCALDATA/**` only; the container is reached only through the custom commands).

## Current schema state (cumulative, after this feature)

```
AppLocalData/data/
  api-keys.json        unchanged, never synced
  settings.json        + "icloud-sync": { version: 1, enabled, deviceId, lastCheckAt }
  metadata.json        { ebird: FileMetadata | null, ml: FileMetadata | null }
                       FileMetadata { filename, uploadedAt (ISO 8601 UTC, ms),
                                      origin?: { deviceId, label, platform },
                                      replacedBySyncAt?: string }
  ebird-backup.csv     the only thing the app reads for the ebird slot
  ml-export.csv        the only thing the app reads for the ml slot
  map-style/, replay.json, and the derived cache documents   unchanged, never synced

iCloud container iCloud.com.dtgibson.snowraven (user's own account, both App IDs)
  Documents/ebird.record.json   SharedRecord (below)
  Documents/ebird-backup.csv    bytes the record describes
  Documents/ml.record.json
  Documents/ml-export.csv
  Documents/.tmp/               staging for atomic writes (never read by a peer)
```

Migration rule for `metadata.json` entries written before 1.0.11: they have no `origin`. They are "local, no origin" (FR-17): equal upload time with a shared record means identical; the first push stamps `origin` = this device without touching `uploadedAt`. `uploadedAt` already carries milliseconds (`toISOString()`), so no rewrite is needed.

## Native layer (macOS + iOS)

**Placement.** `src-tauri/src/icloud.rs`, `#[cfg(any(target_os = "macos", target_os = "ios"))] mod icloud;` in `lib.rs`, commands registered with the same per-command `#[cfg]` the location commands use. `Cargo.toml`: move `objc2 = "0.6"` and `objc2-foundation = "0.3"` (add features `NSFileManager`, `NSFileCoordinator`, `NSMetadata`, `NSNotification`, `NSHost`, `NSURL`, `NSString`, `NSArray`, `NSDictionary`, `NSError`, `NSData`, `NSOperation`) plus `block2 = "0.6"` and `sha2 = "0.10"` into a new `[target.'cfg(any(target_os = "macos", target_os = "ios"))'.dependencies]` block; `objc2-core-location` and `tokio` stay in the macOS-only block (CLAUDE.md rule); add `objc2-ui-kit = { version = "0.3", features = ["UIDevice"] }` to the iOS branch of the mobile block (it is already in `Cargo.lock` via wry). `sha2` is apple-only by use, so it belongs in the apple block, not `[dependencies]`.

**Container resolution.** `URLForUbiquityContainerIdentifier` runs on a `std::thread::spawn` (Apple: non-trivial setup, never on the main thread) and the resulting `Documents/` URL is cached in a `OnceLock<Mutex<Option<PathBuf>>>` after the first success; a nil result is not cached, so a later sign-in is picked up. The `Documents` directory is created on first write.

**Commands** (all `async`, all errors are short stable strings the frontend maps to copy; no Apple error text reaches the UI):

| Command | Args | Returns | Notes |
|---|---|---|---|
| `icloud_status` | none | `{ state: 'available' \| 'not-signed-in' \| 'drive-off-or-unauthorized' \| 'build-cannot-use-icloud', deviceLabel: string, platform: 'mac' \| 'iphone' \| 'ipad' }` | Order: (macOS only) `SecTaskCopyValueForEntitlement(com.apple.developer.ubiquity-container-identifiers)` nil, or `Contents/embedded.provisionprofile` absent → `build-cannot-use-icloud`. Then `ubiquityIdentityToken` nil → `not-signed-in`. Then container nil → `drive-off-or-unauthorized`. Else `available`. On iOS the SecTask probe is skipped (private API there; an iOS build with an unauthorized entitlement does not install at all), so container nil with a token present is worded as "iCloud Drive off for SnowRaven". FR-03's fourth state is therefore exact on macOS for the missing-entitlement and missing-profile cases; the "entitlement present but profile does not authorize it" case is indistinguishable from iCloud Drive off from inside the app and the `drive-off-or-unauthorized` copy says both. |
| `icloud_read_record` | `slot` | `{ record: string \| null, file: { present: boolean, downloaded: boolean, downloading: boolean, byteLength: number \| null } }` | Coordinated read (`NSFileCoordinator`, `coordinateReadingItemAtURL`) of `<slot>.record.json` as raw text (validation is in TypeScript). File status from `resourceValuesForKeys` with `NSURLUbiquitousItemDownloadingStatusKey` and `NSURLUbiquitousItemIsDownloadingKey`; `downloaded` = status is `Current`. Record file absent → `record: null`. Times out at 8 s with `'timeout'` (NFR-04). |
| `icloud_push` | `slot, filename, uploadedAt, origin` | `{ sha256, byteLength }` | Reads the LOCAL csv from `app_local_data_dir()/data/<slot file>` (the two filenames are constants in Rust; a parity test pins them to `storage.ts`), computes SHA-256 + length, writes bytes to `Documents/.tmp/<slot>-<deviceId>.csv`, coordinated move onto `Documents/<slot csv>` (`NSFileCoordinatorWritingForReplacing`), then writes the record the same way (temp + coordinated replace). A peer that reads the record before the csv lands sees a digest mismatch and treats the file as not downloaded, so a partial upload is never taken as complete. Local file missing → `'local-missing'`. |
| `icloud_push_cleared` | `slot, clearedAt, origin` | `{}` | Coordinated delete of the csv (ignore absent), then the cleared record. |
| `icloud_pull` | `slot, expectedSha256, expectedByteLength` | `{}` | Coordinated read of `Documents/<slot csv>`; if not downloaded → `'not-downloaded'`; verifies length then SHA-256 against the record (`'mismatch'` on either); writes to `app_local_data_dir()/data/<slot file>.tmp` then renames over the local csv. The local copy is never touched unless the bytes verified in full (FR-29). Enforces `byteLength <= 200 MB` again natively. |
| `icloud_start_download` | `slot` | `{}` | `startDownloadingUbiquitousItemAtURL_error`; absent file → `'absent'`. |
| `icloud_remove_all` | none | `{ removed: number }` | Coordinated delete of all four files (FR-33); writes no cleared marker. |
| `icloud_watch` | `enabled: boolean` | `{}` | Starts or stops the `NSMetadataQuery` (below) on the main thread via `app.run_on_main_thread`. |

**Change detection: `NSMetadataQuery`, primary.** Scope `NSMetadataQueryUbiquitousDocumentsScope`, predicate `NSMetadataItemFSNameKey LIKE '*.record.json'`, started when sync is enabled and the container resolves, stopped on disable. `NSMetadataQueryDidFinishGathering` and `NSMetadataQueryDidUpdate` observers (block-based `addObserverForName:object:queue:usingBlock:`) emit the Tauri event `icloud-changed` (payload `{}`); the frontend debounces 500 ms and requests a check. A second observer on `NSUbiquityIdentityDidChangeNotification` emits `icloud-identity-changed` (FR-04: the next check runs without user action when iCloud returns). Why this over a poll: it is the API Apple gives for exactly this, it fires within seconds of a peer's upload, and it carries no cost while idle. **Fallback, also implemented:** the controller re-checks on foreground and focus (required, FR-20) and every 5 minutes while the window is visible (OQ-8), so a missed notification costs at most five minutes and never correctness. Both watch only the two tiny record files.

**Device label** (FR-13): macOS `NSHost::currentHost().localizedName()` (the user's Mac name); iOS `UIDevice::currentDevice(mtm).name()` on the main thread, which on iOS 16+ returns the generic "iPhone"/"iPad" without the extra entitlement, exactly the fallback FR-13 allows. Platform: `mac`, or `iphone`/`ipad` from `UIDevice.userInterfaceIdiom`. Truncated to 64 chars natively as well as in the validator.

**Not used:** `@tauri-apps/plugin-fs` against the container. The fs capability stays `$APPLOCALDATA/**`; widening it to `~/Library/Mobile Documents/**` would expose every iCloud app's files to the webview scope for no gain. Commands only.

## Shared record format and validator

`Documents/<slot>.record.json`, UTF-8 JSON, written whole, at most 4 KB:

```
{
  "version": 1,
  "slot": "ebird" | "ml",
  "state": "file" | "cleared",
  "filename": string,            // state=file only; display only, never a path (FR-38)
  "uploadedAt": string,          // state=file; ISO 8601 UTC with milliseconds
  "clearedAt": string,           // state=cleared; same form
  "origin": { "deviceId": string, "label": string, "platform": "mac"|"iphone"|"ipad" },
  "byteLength": number,          // state=file
  "sha256": string               // state=file; 64 lowercase hex
}
```

**Digest choice: SHA-256.** It is computed natively where the bytes already are, costs milliseconds for a typical 6 MB export and well under a second at the 200 MB bound, and it is definitive: a reader can tell "the old csv is still here, the new one has not arrived" from "the new one is here" without trusting timestamps, which is what makes the two-file layout atomic in practice and makes FR-40 idempotence a byte fact rather than a clock fact. A cheaper CRC would save nothing measurable and would leave the corruption guard (FR-29) weaker.

**Validator** (`icloudRecord.ts#parseSharedRecord(text): SharedRecord | null`, pure, exhaustive, never throws): JSON parse failure → null. `version === 1`. `slot` in the closed set and equal to the slot being read. `state` in `{file, cleared}`. `origin.deviceId` matches `/^[0-9a-f]{32}$/`; `origin.label` is a string of 1 to 64 UTF-16 code units with no control characters; `origin.platform` in `{mac, iphone, ipad}`. Times: `uploadedAt` (state=file) or `clearedAt` (state=cleared) parses with `Date.parse`, is not before `2000-01-01T00:00:00Z`, and is not more than 24 h after the reader's clock. `filename`: 1 to 255 code units, no `/`, no `\`, no NUL, no control characters. `byteLength`: integer, `1 <= n <= 200_000_000`. `sha256`: `/^[0-9a-f]{64}$/`. Unknown keys ignored. Any failure returns null, and the controller logs one `console.warn` with the slot and the failing rule and treats the slot as having no shared record; a null record can never produce `delete-local` (the table below has no such row), which is the FR-37 guarantee. Display strings pass through React children only (auto-escaped) and are never interpolated into a path or href.

## Reconciliation rules

`icloudReconcile.ts#reconcileSlot(input): SlotDecision`, pure, fully tabulated. Inputs: `local: { uploadedAt: number, originId: string | null } | null` (ms epoch from the metadata entry), `shared: SharedRecord | null`, `file: { downloaded: boolean, downloading: boolean }`, `deviceId`. Output `action` plus the display `state` (FR-24 label) the row should show right away.

| local | shared | Rule | action | row state |
|---|---|---|---|---|
| null | null | FR-18 | `none` | today's "No file saved" |
| present | null | FR-14 | `push` | Up to date, from this device (after push) |
| null | file | FR-15 | `pull` if downloaded, else `download` | Syncing, downloading; then In iCloud, not downloaded here if the check ends first |
| null | cleared | FR-31 | `none` | No file saved |
| present | cleared, `local.uploadedAt > clearedAt` | FR-31 | `push` | Up to date, from this device |
| present | cleared, `local.uploadedAt <= clearedAt` | FR-31 | `delete-local` | No file saved |
| present | file, `shared.uploadedAt > local.uploadedAt` | FR-16 | `pull` / `download` as above | Replaced by the file from X, uploaded T (FR-25) once applied; In iCloud, not downloaded here meanwhile (FR-27, FR-28) |
| present | file, `shared.uploadedAt < local.uploadedAt` | FR-16 | `push` | Up to date, from this device |
| present | file, equal, same origin or `local.originId === null` | FR-17 | `none` | Up to date |
| present | file, equal, different origins | FR-21 + OQ-3 tiebreaker | `push` if `deviceId > shared.origin.deviceId` (code-unit order), else `pull` | as the winner |

The tiebreaker is the OQ-3 option taken: with plain "keep local" on both sides two devices tied to the millisecond never converge (FR-22); ordering by origin id costs one string comparison and makes every device pick the same winner. QA-20's "equal time, different origin" case asserts determinism by origin id, not "local kept"; the Evaluator should read FR-21 with this refinement.

Times are compared as numbers from `Date.parse` (ms, UTC) (FR-21). A `pull` is applied only if the local entry is unchanged since the decision (`applySyncedFile` guards on `expectLocalUploadedAt`), so a user upload that lands during a download wins and is pushed on the next check (FR-39). `pull` and `delete-local` run the invalidations below and notify the file epoch; `push` changes nothing local except stamping `origin` when absent.

## Frontend modules and seams

All under `frontend/src/lib/icloud/` unless noted. Entry-chunk rule: `App.tsx` and `Settings.tsx` are on the entry graph, so nothing that imports `@tauri-apps/api/core` or `@tauri-apps/api/event` may be statically reachable from them; `entryChunk.test.ts` gains `expect(has('lib/icloud/icloudSync.ts')).toBe(false)` and `expect(has('lib/icloud/icloudNative.ts')).toBe(false)`, plus a positive assertion that `lib/icloud/icloudState.ts` and `lib/filesChanged.ts` ARE on the graph (so the negatives mean something, the pattern the file already uses).

- **`icloudRecord.ts`** (pure): `SharedRecord` type, `parseSharedRecord`, `serializeRecord`, the bounds as named constants (`MAX_LABEL = 64`, `MAX_FILENAME = 255`, `MAX_BYTES = 200_000_000`, `MIN_TIME`, `MAX_FUTURE_MS`).
- **`icloudReconcile.ts`** (pure): the table above.
- **`icloudState.ts`** (pure store, entry-safe): `ICloudState { availability, syncEnabled, deviceLabel, platform, lastCheckAt, checking, slots: Record<Slot, SlotView>, sharedExists: boolean }`, `SlotView { state: 'up-to-date' | 'uploading' | 'downloading' | 'in-icloud-not-downloaded' | 'waiting-to-upload' | 'unavailable' | 'off' | 'error', fromThisDevice: boolean, origin?: {label, platform}, uploadedAt?: string, replacedAt?: string, reason?: string }`, `getState`, `subscribe`, `useICloudState()` (`useSyncExternalStore`), and an `actions` slot the controller fills: `enable, disable, checkNow, downloadNow(slot), retry(slot), removeFromICloud, clearWithSync(slot)`. Before the controller loads, `actions` are no-ops and `availability` is `'unknown'` (rows render today's copy).
- **`icloudNative.ts`**: typed wrappers over the seven commands and two events, static `@tauri-apps/api` imports (this file is never on the entry graph). Error strings mapped to a closed `ICloudError` union.
- **`icloudSync.ts`** (controller, dynamic-imported): `bootICloudSync()` called from `App.tsx` after first paint (`setTimeout(0)` after mount, only when `showICloudSync()`), which loads the preference, probes availability, starts the query if enabled, and schedules the first check. Single in-flight check with one queued follow-up (a boolean, FR-20); triggers: boot, `visibilitychange` → visible, `window` `focus`, the two Tauri events (debounced), a 5-minute interval while visible, `checkNow`, `downloadNow`, `retry`. A check: read `icloud-sync`, `getFilesStatus`, both records, decide per slot, apply, write `lastCheckAt` on success. Offline or `'timeout'` → keep the last state, rows show the last check time (FR-05); nothing awaits it on the launch path (FR-06). On `pull` it calls `storage.applySyncedFile`, then the same invalidations `Settings.tsx` runs today (`clearEbirdObservationsCache(); invalidateHotspotSet()` for ebird, `clearMLExportCache()` for ml), then `notifyFilesChanged()`. On `delete-local` the same. **PRD note:** FR-34 says clear also runs "the network cache"; today's `handleDeleteFile` does not touch `networkCache` (its module comment says file changes must not), so sync runs exactly the set Settings runs, and the PRD wording is corrected here rather than followed.
- **`lib/filesChanged.ts`** (new, entry-safe, dependency-free) and **`lib/useFilesEpoch.ts`**: the FR-35 mechanism. Today the only signal is `App.tsx`'s `filesVersion` state, bumped by `handleFilesSaved`, which Settings calls after an upload, threaded as a prop to LifeList (Multimedia), BreedingCodeList, NamedBirds, Checklists, Calendar, SpeciesDetail, and the Weather backlog effect. BirdingStats (Statistics), MapExplorer and ListComparer load on mount only (a pre-existing gap FR-35 now closes). Design: `filesChanged.ts` mirrors `hotspotSet.ts`'s epoch + subscribers (`getFilesEpoch`, `subscribeFilesChanged`, `notifyFilesChanged`); `App.tsx` replaces `useState(0)` with `const filesVersion = useFilesEpoch()` and `handleFilesSaved = notifyFilesChanged`, so every prop-threaded tab keeps working unchanged; BirdingStats, MapExplorer and ListComparer add `useFilesEpoch()` to the deps of the effect that calls `getFilesStatus`/`loadEbirdObservations`/`loadMLExport`. That is the complete subscriber list for FR-35.
- **`platform.ts`**: `isMacOS()` (same sync `platform() === 'macos'` probe as `isIOS`, try/catch). **`platformGates.ts`**: `showICloudSync = () => isTauri() && (isIOS() || isMacOS())`. Windows desktop, web and Pi are false by construction (FR-01, FR-02).
- **Storage seam** (`StorageAdapter`; `WebStorage` implements the three new methods as `Promise.reject(new Error('not supported'))`, unreachable behind the gate):
  - `writeFile(name, content, filename, origin?: FileOrigin)`: unchanged link; writes `origin` when given, never `replacedBySyncAt` (a user action clears the FR-25 notice by replacing the entry). Settings passes `origin` from `icloudState` when sync is enabled.
  - `applySyncedFile(name, entry: FileMetadata, expectLocalUploadedAt: string | null, materialize: () => Promise<void>): Promise<boolean>`: one `META_PATH` link: `readMeta`; if the current entry's `uploadedAt` differs from `expectLocalUploadedAt` return false (user upload won, FR-39); `await materialize()` (the controller passes the `icloud_pull` call; a native invoke is not a chained op, so rule 1 holds); write `meta[name] = entry`; return true. If `materialize` throws, the link rejects and metadata is untouched (FR-29).
  - `applySyncedClear(name, expectLocalUploadedAt): Promise<boolean>`: same guard, then the `deleteFile` body.
  - `stampFileOrigin(name, origin, expectUploadedAt): Promise<boolean>`: sets `origin` only when the entry is still the one pushed and has none.
  - The csv itself is never passed through IPC in either direction: `icloud_push` reads the local file natively and `icloud_pull` writes it natively, both from the path Rust derives from `app_local_data_dir()` (verify-item V4).

## Settings UI contract (for The Designer)

Section **"iCloud Sync"**, rendered directly below Default Files, only when `showICloudSync()`; gated markup, not hidden markup (QA-01). Everything reads `useICloudState()` and calls `actions`.

- **Toggle**: a real switch, accessible name "iCloud Sync", checked = `syncEnabled`, operable only when `availability === 'available'`; when not operable it stays visible with one note: `not-signed-in` → "Sign in to iCloud in System Settings (or Settings on iPhone and iPad) to use sync."; `drive-off-or-unauthorized` → "Allow SnowRaven under iCloud Drive in the system settings. If it is already allowed, this build cannot use iCloud."; `build-cannot-use-icloud` → "This build cannot use iCloud." (FR-03). Turning on opens the **enable note** (focus-trapped dialog, Escape cancels) with the four required elements (what goes up: both files and filename, upload time, device name; whose account: the user's own iCloud on Apple's servers, never a SnowRaven server, the developer cannot see it; what happens now: newer copy in iCloud replaces this device's, newer local copy goes up; how to turn it off: the toggle, plus "Remove synced files from iCloud"), actions **Turn on** and **Cancel** (FR-08). Turning off needs no confirmation (FR-32).
- **Status line**: "Last checked <time>" from `lastCheckAt` in the existing `formatUploadDate` form, "Never" before the first success; **Check now** button when enabled and available; the line is a live region (`aria-live="polite"`).
- **Remove synced files from iCloud** button when `availability === 'available' && sharedExists` regardless of the toggle; its confirmation names the files present in iCloud (from the records' `filename`) and states that no device's local copy is touched (FR-33).
- **Per-row additions to the Default Files rows** (macOS and iOS with `syncEnabled`): a provenance line "From this device" or "From <label> (<Mac | iPhone | iPad>)" plus the upload time in the row's existing `formatUploadDate` form (FR-23); one state label as text from the eight: Up to date; Syncing, uploading; Syncing, downloading; In iCloud, not downloaded here; Waiting to upload; iCloud unavailable; Sync off; Could not sync (with `reason` and a **Retry** button) (FR-24); the FR-25 line "Replaced by the file from <label>, uploaded <time>" while `replacedAt` is set; **Download now** in the not-downloaded state (FR-27). Props: `FileRow` gains `sync?: SlotView` and `onDownloadNow`, `onRetry`.
- **Clear** with sync on routes through `actions.clearWithSync(slot)` and its confirmation says the file is removed from this device and from iCloud on all synced devices; with sync off the existing local-only path and copy are unchanged (FR-30). Note: today's Clear has no confirmation at all; the Designer adds one only for the sync-on case unless they choose to add a local one too.
- NFR-01/02/03 apply as stated in the PRD; iOS keeps the "Import" wording in the row (`fileRowCopy.ts`).

## Entitlements, provisioning and the Apple Developer portal prerequisites

**Mechanism decision: iCloud Drive ubiquity container (CloudDocuments), not CloudKit.** Two CSVs and two small JSON records are files; the container gives coordinated, atomic file replacement, offline queuing by the system daemon, and a change query, with no server-side schema. CloudKit was rejected because it needs a record type and CKAsset plumbing for the same two files, its change notifications need push subscriptions (APNs entitlement and a delegate path Tauri does not expose), its objc2 bindings are async-callback heavy, and it needs the same restricted entitlement and profile anyway. Nothing about CloudKit reduces the portal or signing work; it only adds a schema.

**Container:** `iCloud.com.dtgibson.snowraven`, one container, associated with both App IDs. Named after the iOS id because that App ID already exists in the portal; the naming is a convention, not a binding.

**macOS entitlements**, new file `src-tauri/entitlements.icloud.plist` (the committed `entitlements.plist` stays as is and remains the default): the existing location key, plus

```
com.apple.developer.icloud-container-identifiers   [ iCloud.com.dtgibson.snowraven ]
com.apple.developer.ubiquity-container-identifiers [ iCloud.com.dtgibson.snowraven ]
com.apple.developer.icloud-services                [ CloudDocuments ]
com.apple.application-identifier                   <TEAMID>.com.snowraven
com.apple.developer.team-identifier                <TEAMID>
```

The last two are what Xcode injects for a profile-backed macOS app and Tauri's codesign does not; without them the profile does not authorize the restricted keys. `<TEAMID>` is the parenthesized suffix of `APPLE_SIGNING_IDENTITY` (public, present in every signed bundle; commit it literally). Never an empty array (it breaks signing). **No App Sandbox**: not required for Developer ID and more restrictive for `~/Library/Mobile Documents`.

**Why a second file and an overlay.** Restricted entitlements without a profile are the failure mode to design out. Keeping the iCloud keys out of the committed config means a plain `npm run desktop:build` (or a dev bundle on another machine) produces today's bundle and lands in the FR-03 "build cannot use iCloud" state instead of a bundle whose signature claims what its profile does not back. `release.sh` supplies both halves together through one `--config` overlay (below), so they are always paired.

**Profile:** a "Developer ID Application" provisioning profile for App ID `com.snowraven` with iCloud, stored at `$HOME/.tauri/snowraven-developerid.provisionprofile` (never in the repo), embedded at `Contents/embedded.provisionprofile` through `bundle.macOS.files`. Absolute paths in `files` (verify-item V1); fallback is a gitignored `src-tauri/embedded.provisionprofile` that `release.sh` copies in and removes.

**iOS:** `gen/apple/snowraven_iOS/snowraven_iOS.entitlements` (already wired by `project.yml` `entitlements.path`) gets the same three iCloud keys (no application-identifier keys; Xcode injects them). `tauri.ios.conf.json` and `project.yml` are unchanged. Signing continues through `--export-method app-store-connect` with the `APPLE_API_KEY`/`APPLE_API_ISSUER`/`APPLE_API_KEY_PATH` mapping from the skill; the App Store profile must be regenerated after the App ID gains the capability (verify-item V2: whether Tauri's `xcodebuild` passes `-allowProvisioningUpdates` so it regenerates itself, or the profile must be regenerated in the portal first).

**Info.plist:** `NSUbiquitousContainers` omitted on both platforms (OQ-7). Adding Finder/Files visibility later means adding that dict (`NSUbiquitousContainerIsDocumentScopePublic` true, `NSUbiquitousContainerName` "SnowRaven", `NSUbiquitousContainerSupportedFolderLevels` "One") to `Info.plist` and `Info.ios.plist`, bumping the build number, and accepting that the system reads it only on a fresh build install (QA1893).

**Portal prerequisites (human, before the Engineer can verify on a device):**

1. Register the explicit macOS App ID `com.snowraven` (platform macOS). API: `POST /v1/bundleIds` `{ identifier, platform: MAC_OS, name }`. If the portal rejects it as taken by another team, stop: a macOS bundle-id change is out of scope (it would move the app data directory and break the shipped updater) and needs a decision.
2. Create the iCloud container `iCloud.com.dtgibson.snowraven`. **Portal UI only**: the public App Store Connect API has no endpoint that creates a container.
3. Enable iCloud on both App IDs and assign the container to each. API: `POST /v1/bundleIdCapabilities` `{ capabilityType: ICLOUD, settings: [{ key: ICLOUD_VERSION, options: [{ key: XCODE_6 }] }] }` enables the capability; **container assignment is portal UI** (not expressible through the public API; verify-item V3, fall back to the UI without hesitation).
4. Create the Developer ID Application profile for `com.snowraven`. API: `POST /v1/profiles` `{ profileType: MAC_APP_DIRECT, bundleId, certificates: [Developer ID Application cert id] }`, then download `profileContent` (base64) to the path above. Also possible in the UI.
5. Regenerate the iOS App Store profile (UI, or automatic per V2).
6. The API key on this machine: the metadata-capable key `QJA25M7XHM` (skill) needs the Admin or App Manager role with "Access to Certificates, Identifiers & Profiles" for steps 1, 3, 4; the upload-only key cannot. If it 403s, do the four steps in the UI; they take minutes.

## Release recipe changes

`release.sh` (macOS leg; the Windows leg is untouched):

1. **Config:** `ICLOUD_PROFILE="$HOME/.tauri/snowraven-developerid.provisionprofile"`, `ICLOUD_CONTAINER="iCloud.com.dtgibson.snowraven"`, `ICLOUD_ENTITLEMENTS="./entitlements.icloud.plist"`.
2. **Preflight** (with the other Apple checks, skipped under `CHECK_ONLY`): the profile file exists; `security cms -D -i "$ICLOUD_PROFILE"` decodes and its `Entitlements` carry `com.apple.application-identifier` ending in `.com.snowraven` and the container id, and `ExpirationDate` is in the future; die with the portal step to repeat otherwise.
3. **Build:** `npm run desktop:build -- --target "$MAC_TARGET" --config "$OVERLAY"` where `OVERLAY='{"bundle":{"macOS":{"entitlements":"'$ICLOUD_ENTITLEMENTS'","files":{"embedded.provisionprofile":"'$ICLOUD_PROFILE'"}}}}'`.
4. **Post-build check, before the DMG styling** (NFR-06, QA-42): `APP="$BUNDLE_DIR/macos/SnowRaven.app"`; `[[ -f "$APP/Contents/embedded.provisionprofile" ]]`; `codesign -d --entitlements - --xml "$APP"` contains all three iCloud keys and the container id; `codesign --verify --deep --strict "$APP"` passes (also proves the profile was inside the seal, i.e. copied before signing); die naming the missing item. The updater `.app.tar.gz` is packed from this same `.app`, so one check covers both artifacts.
5. Usage comment at the top gains the profile path and the portal prerequisite.

`snowraven-release` skill: a new "iCloud entitlements and profile" subsection stating the profile path, the overlay, the two checks, the renewal rule (the profile expires with the Developer ID certificate; the preflight catches it), and the iOS note (entitlements file carries the keys; regenerate the App Store profile after a capability change). The iOS recipe itself is unchanged.

Windows CI: `windows-build.yml` verified free of entitlement or signing references; `bundle.macOS.*` is ignored on Windows; `icloud.rs` and the apple dependency block do not compile there.

Versioning: `frontend/package.json` and `src-tauri/tauri.conf.json` to **1.0.11**; `CHANGELOG.md` `## [1.0.11]` "Added: iCloud Sync (macOS, iPhone, iPad), opt-in and off by default" in the changelog's plain-language register; iOS build 1.0.11 build 1 after `release.sh`.

## Migration plan (ordered steps for The Engineer)

1. Portal prerequisites 1 to 4 (human; the Engineer can drive the API calls but must stop on a `com.snowraven` rejection). Nothing below depends on them until step 9.
2. `Cargo.toml` target-block move and additions; `lib.rs` module and command registration; `icloud.rs` with the seven commands, the query, the two events. `cargo check` for `aarch64-apple-darwin`, `x86_64-apple-darwin`, `aarch64-apple-ios`, and confirm `x86_64-pc-windows-msvc` still resolves (`cargo check --target` needs the target installed; otherwise rely on CI).
3. `storage.ts`: `FileMetadata` fields, `writeFile` origin, the three new methods; `storageWriteSerialization.test.ts` sibling for FR-39.
4. `icloudRecord.ts` + tests; `icloudReconcile.ts` + the table test; `filesChanged.ts` + `useFilesEpoch.ts`; `platform.ts#isMacOS`; `platformGates.ts#showICloudSync` + tests.
5. `icloudState.ts`, `icloudNative.ts`, `icloudSync.ts`; `App.tsx` epoch wiring and gated boot; the three tabs subscribe.
6. `Settings.tsx` per the UI contract (after The Designer, Stage 4).
7. `entryChunk.test.ts` additions; `npm run build`; `npm run typecheck`.
8. `entitlements.icloud.plist`, iOS entitlements file, `release.sh`, skill, docs, policy pages (parity test), `appstore/LISTING.md` note, versions, CHANGELOG.
9. **Signed verification build** (not `tauri dev`; a dev binary has no bundle and no profile, so iCloud is nil there by design): `CI=true npm run desktop:build -- --debug --config "$OVERLAY"` with `APPLE_SIGNING_IDENTITY` set, run the `.app`, walk QA-02, QA-03 (build without the overlay), QA-13 to QA-19 across the Mac and one iOS device. The pure modules and the UI can be exercised under `tauri dev` with `icloudState` driven by tests or a mocked native layer; only the container needs the signed bundle.

## Tests

| File | Asserts |
|---|---|
| `lib/platformGates.test.ts` (extend) | `showICloudSync` true on macOS and iOS, false on Windows desktop, web and Pi with `isTauri`/`isIOS`/`isMacOS` mocked both ways (QA-01). |
| `components/Settings.icloud.test.tsx` | With the gate false, no iCloud markup, toggle, or copy renders; with it true, the section renders each of the eight state labels as text and the enable note carries its four elements (QA-01, QA-08, QA-23). |
| `lib/icloud/icloudReconcile.test.ts` | Every row of the table, millisecond UTC comparison, the origin-id tiebreaker, and the FR-31 marker cases (QA-20, QA-29). |
| `lib/icloud/icloudRecord.test.ts` | Malformed, oversized, out-of-range, path-bearing, control-character and future-dated records each return null and never throw; a valid record round-trips; `../x.csv` is rejected as a filename with separators while a plain long name displays verbatim (QA-34, QA-35). |
| `lib/storageSyncSerialization.test.ts` | Shaped like `storageWriteSerialization.test.ts` with the same fs harness: `applySyncedFile` interleaved with `writeFile` in one tick both persist; a user upload during a pull leaves the user's entry and returns false; a rejecting `materialize` leaves metadata byte-identical (QA-36, QA-27). |
| `lib/icloud/icloudSync.test.ts` | Ten rapid triggers produce at most two checks; two consecutive checks with no change transfer nothing; a `'timeout'` leaves the last state; the excluded paths (`api-keys.json`, `settings.json`, map style, replay, caches) are never passed to any native command (QA-19, QA-37, QA-11). |
| `lib/filesChanged.test.ts` | Epoch increments and subscribers fire; `useFilesEpoch` re-renders. |
| `lib/entryChunk.test.ts` (extend) | The controller and native wrapper are off the entry graph; the state store and epoch module are on it (QA-44). |
| `lib/icloudPaths.parity.test.ts` | The two csv filenames and the container id in `icloud.rs` equal the constants in `storage.ts` and `icloudNative.ts` (source-grep, the `cacheInventory` style). |
| `lib/privacyPageParity.test.ts` (existing) | Still passes after the policy gains its sync section on both sides (QA-43). |

## Design decisions

1. **Ubiquity container over CloudKit.** File-shaped data, atomic coordinated replacement, system-queued offline uploads, no schema. Recorded above with the rejection reasons.
2. **Two files per slot (record + csv) with the digest in the record.** The record is the commit point; the digest lets a reader know whether the csv it can see is the one the record describes. One file per slot (csv with an embedded header) was rejected because it would make the csv non-standard and force reading 200 MB to learn the metadata.
3. **The csv never crosses the IPC boundary for sync.** Push reads and pull writes the local file natively; the chain link still owns metadata consistency by wrapping the native call. Parity with the existing upload path's text-through-IPC was not worth carrying into a background process.
4. **`settings.json` key, not a new document.** Existing chain, no new keys, no `docChains` change.
5. **`NSMetadataQuery` primary, five-minute visible poll as the implemented fallback.** Both are cheap; the poll bounds the damage of a missed notification.
6. **Entitlements and profile paired by a release-time overlay.** A default build cannot claim an entitlement it cannot back; the release cannot ship without both.
7. **Commands only, no fs-scope widening.**
8. **Origin-id tiebreaker on equal times** (OQ-3): guarantees FR-22 at zero cost; QA-20 wording adjusted.
9. **FR-34 network cache**: not cleared on a synced clear, matching today's Settings; the PRD sentence is corrected, not implemented.
10. **Availability wording** merges "iCloud Drive off" with "profile does not authorize" on the container-nil path because the app cannot tell them apart; the missing-entitlement and missing-profile cases are detected exactly on macOS.

## Risks and Engineer verify-items

Each is verify, do not assume; the fallback is stated.

- **V1: `bundle.macOS.files` accepts an absolute source path and copies it before codesign.** Check on the first overlay build with the post-build `codesign --verify --deep --strict`. Fallback: gitignored `src-tauri/embedded.provisionprofile` copied in by `release.sh`, removed after.
- **V2: the iOS App Store profile picks up the capability.** Build after the portal change; if export fails with a profile mismatch, regenerate the profile in the portal and retry. Automatic regeneration by `xcodebuild -allowProvisioningUpdates` is a convenience, not a dependency.
- **V3: the ASC API can enable ICLOUD on a bundle id and create a `MAC_APP_DIRECT` profile with the key on this machine.** Try once; on any 403 or validation error do the step in the portal UI. Container creation and assignment are UI-only; do not spend time looking for an endpoint.
- **V4: container URL non-nil on a Developer ID build with the overlay, nil without it, and the app launches in both cases** (QA-03). If a build with the entitlements but no profile fails to launch on macOS, the overlay design already keeps such a bundle from being produced by default; add a `release.sh` die if the profile is absent (already in the preflight) and record the finding.
- **V5: `SecTaskCopyValueForEntitlement` self-probe on macOS.** Public API on macOS; link `Security.framework`. If it misbehaves under hardened runtime, fall back to the profile-file existence check alone and word the state as `drive-off-or-unauthorized`.
- **V6: `NSMetadataQuery` delivers updates in a Tauri process** (the query needs the main run loop; `run_on_main_thread` gives it one). If updates never arrive on a device, the five-minute poll and the foreground/focus triggers still satisfy FR-20 at OQ-8's accepted latency; log it as a known limitation.
- **V7: eviction and download behavior.** On iOS the container file may report `NotDownloaded` until `icloud_start_download` is called; on macOS "Optimize Mac Storage" can evict. Exercise QA-25 by evicting with `evictUbiquitousItemAtURL` from a throwaway command or Finder's "Remove Download".
- **V8: `UIDevice.name` returns the generic name on iOS 16+ without the extra entitlement.** Expected and allowed by FR-13; do not request the entitlement.
- **V9: `com.snowraven` registrable as an explicit App ID in this team.** If not, stop and escalate; do not change the macOS identifier.
- **V10: the 200 MB bound and SHA-256 cost on the iPad** during a pull: measure once with the largest real export; if the hash exceeds a second, it is still within a check's budget because a download is not the "nothing to transfer" case NFR-04 times.
- **Risk: two-file races.** A peer can read a new record while the old csv is still local; the digest check makes that "not downloaded" rather than "apply the old bytes". Covered by the reconcile and pull tests.
- **Risk: clock skew** (OQ-4): accepted; the future-time bound in the validator (24 h) limits the damage of a badly set clock to that device's own record being ignored by peers.
