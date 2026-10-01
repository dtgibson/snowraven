# Schema: iOS Alerts (new lifer nearby)

**Feature:** ios-alerts
**Date:** 2026-09-30
**Stage:** 3, The Architect (hands-off: the path is declared here and proceeded on)
**Source:** strategic-brief.md, prd.md (both approved; the five Questions for The Architect are answered in sections 1, 2, 4.3, 3 and 3.7)
**Extends:** `pipeline/ios-lifer-widgets/schema.md` (the App Group hand-over, the Swift `Logic/` runtime, the deep link and its vendored cold-start delivery), `pipeline/targets-tab/schema.md` (the latest durable-store precedent), `pipeline/icloud-sync/schema.md` (the entry-safe store plus lazy controller shape)
**Ships as:** 1.0.41 (one patch, the four-file set; CLAUDE.md's patch-by-default)

## Path

Incremental (extending the existing data layer, the App Group document set and the iOS project structure).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database; its data layer is the set of stored documents (under `AppLocalData/data/` for the webview, in the App Group container for the widgets), the epoch modules and entry-safe stores that announce changes to them, the clear registry, and the pure modules that derive what the UI shows. Prior `schema.md` files document all of that, `pipeline.config.json` exists, and this feature adds three native-owned documents, two fields to an existing document, one new deep-link form and a new background process path to that structure. Nothing here is UI-only (an inbox is a bounded durable store keyed on the user's file) and nothing is greenfield, so the path is Incremental. Proceeding on this assessment per the hands-off run.

Like the widget run, most of the new structure is not TypeScript: it is Swift in the APP target, three plist keys, a Rust command module and a change to the deep-link grammar. One platform fact decided the shape of everything below and was checked in the vendored tao rather than assumed (section 1.1).

## Existing data model used by this feature (unchanged unless listed under Modified)

| Existing structure | Where | How this feature uses it |
|---|---|---|
| The App Group container `group.com.dtgibson.snowraven`, `widgets/handover.json` (version 1) | `src-tauri/src/widgets.rs` writes it (atomic temp-then-rename, regular-file discipline); `frontend/src/lib/widgets/widgetHandover.ts` builds it; `snowraven_widgets/Sources/Logic/Handover.swift` decodes and validates it | The check READS it: `ebirdKey` (precondition 2), `hasEbirdBackup` and `recorded` (precondition 3 and the subtraction), `defaultLocation` (the fixed place's default, FR-09). It gains two fields (section 3.6) |
| `widgets/cache.json` (the extension's own document) | `Logic/WidgetCache.swift`, written only by the extension | Read-only SECOND source of the "most recent known position" under My location: `cell.lat` / `cell.lng` (rounded to two decimals) and `fetchedAt` (section 4.3), admitted only when the new optional `cellSource` is `device`. The app never writes it. **One widget change, data provenance only (L7, section 4.3):** the extension now records `cellSource` in this document; its refresh logic and everything it shows are unchanged |
| `Logic/` (pure Swift: `RecentObsReducer`, `SpeciesName.fold`, `Distance.miles`, `ObsDate`, `RetryAfter.parseSeconds`, `EBirdRequest`, `EBirdBody.collect`, `BoundedFile.read`, `HandoverDecoder`, `JSNumber.toFixed`) and `Widget/EBirdClient.swift` (Foundation-only, conforms to `WidgetTransport`) | `src-tauri/gen/apple/snowraven_widgets/Sources/` | Compiled INTO the app target and reused as-is by the check (section 1.3). `EBirdRequest` gains two defaulted parameters (section 3.8) |
| The deep link: `LINK_SCHEME`, `parseWidgetLink`, `linkRequest.ts`, `linkController.ts`, the Rust `PendingLink` + `snowraven-link` poke, the vendored tao cold-start forward | `lib/links/`, `widgets.rs`, `vendor/tao/.../scene.rs` | The notification tap and the inbox row tap both travel this path; the grammar gains one anchored form (section 5) |
| `MapExplorer` link application (`linkRequest` effect, `linkFocus`, `focusLifers`, the Show all pill, `focusAbsentStatement`) | `components/MapExplorer.tsx`, `lib/links/linkFocus.ts` | Gains a point-and-radius branch and a `center` focus mode (section 5.4) |
| `isNonCountableForm`, `EBIRD_COUNTS`, `EBIRD_REJECTS`, `assets/ebird-countability.json` | `lib/speciesUtils.ts` | The two exception lists are handed over; the three-clause shape rule is twinned in Swift and pinned by a fixture (section 3.7) |
| `buildNearbyLifers`, `normalizeSpeciesName` | `lib/nearbyLifers.ts`, `lib/speciesUtils.ts` | The parity fixture asserts the check's candidate set equals the app's Nearby Lifers species set minus non-countable forms (section 8.3) |
| `lib/clearDerived.ts` (`TEARDOWNS`, `purgeDerivedOnClear`), `lib/cacheInventory.test.ts` | the clear registry and its guard | Gains one row of a THIRD class, native-owned (section 7) |
| `lib/icloud/icloudState.ts` + `icloudSync.ts`; `lib/widgets/widgetHandover.ts` + controller | the entry-safe store and lazy controller shape; the iOS boot pattern in `App.tsx` | `lib/alerts/` copies the shape exactly (section 6) |
| `getCurrentLocation()` (iOS branch through `@tauri-apps/plugin-geolocation`) | `lib/location.ts` | The only webview location read the feature makes (choosing My location, pressing Use my location); it is what prompts, and its result seeds the position (section 6.4) |
| `Settings.tsx` sections, `SectionHeader`, `ToggleSwitch`, `RadioGroup`, `ModalDialog`, `Button`; `settingsSectionOrder.test.tsx` | `components/Settings.tsx` | The Alerts section is a lazy sibling in the same register (section 6.3) |
| `components/AddressSearch.tsx` + `lib/placeSearch.ts` (off the entry chunk) | Map Explorer and Targets | The fixed place's place-name search is this component, inside the lazy section (section 6.3) |
| `lib/widgets/widgetRows.ts` (`parseObsDateStrict`, `daysBetweenRounded`, `foldName`) | off the entry chunk | The inbox's "Today / Yesterday / N days ago" rendering (section 6.3) |
| The scene manifest and its guard; `iosWidgetManifest.test.ts` (`parsePlist`, `yamlBlock` readers in `frontend/src/test/appleManifest.ts`) | `Info.ios.plist`, `gen/apple/snowraven_iOS/Info.plist`, `gen/apple/project.yml` | Two new keys join all three sources; a sibling guard pins them (section 9) |
| The single-webview keeper `.run(tauri::generate_context!())` | `src-tauri/src/lib.rs` | Byte-unchanged; section 2.3 states why the new plugin does not touch it |
| `build.rs` (`-Wl,-U,_snowraven_reload_widgets`) | `src-tauri/build.rs` | Three more undefined-symbol allowances for the three new Swift entry points (section 10.3) |

## Changes in this feature

### Added

1. **Three native-owned documents** in the App Group container under `alerts/`: `settings.json`, `state.json`, `inbox.json` (section 3). Written by one Swift actor in the app process; never by the webview, never by the extension.
2. **`AlertsEngine`**, the check, in Swift in the APP target (`gen/apple/Sources/snowraven/Alerts/` for the seams that touch UIKit, BackgroundTasks, UserNotifications and CoreLocation; `gen/apple/Sources/snowraven/AlertsLogic/` for the pure rules, documents and validators). It reuses the widget's `Logic/` runtime and `EBirdClient` (section 1).
3. **`src-tauri/src/alerts.rs`** (iOS only): five Tauri commands, one mini plugin whose setup hands Rust's two callbacks to Swift and registers the background task before `UIApplicationMain`, and the `snowraven-alerts` poke event (section 10).
4. **The alert link**, one anchored form beside the fifteen view links: `snowraven://map/lifers?window=day&lat=..&lng=..&r=..&sp=..&loc=..&show=all|one` (section 5).
5. **`lib/alerts/`**: `alertsState.ts` (entry-safe store, constants, `alertsSupported()`), `alertsController.ts` and `alertsNative.ts` (lazy), `alertsPurge.ts` (lazy, the clear-registry row's target), `alertRules.ts` (the pure TypeScript twin the parity fixture is generated from) (section 6).
6. **`components/settings/AlertsSection.tsx`** (lazy, `React.lazy`), rendered by `Settings.tsx` only when `alertsSupported()` (section 6.3).
7. **Three plist keys** in the three iOS plist sources: `UIBackgroundModes: [fetch]`, `BGTaskSchedulerPermittedIdentifiers: [com.dtgibson.snowraven.alerts.refresh]` (section 9).
8. **The clear-registry row** for `alerts/inbox.json` and the third row class in `cacheInventory.test.ts` (section 7).
9. **Guards** in section 8 and `paths` extensions in `.claude/rules/security.md` and `testing.md`.
10. **`pipeline/ios-alerts/held-copy/`** proposals (FR-45), prepared and not applied; their factual inputs are in section 12.

### Modified

- **The hand-over document (still version 1)** gains `countableExceptions` and `nonCountableExceptions` (section 3.6): `widgetHandover.ts` writes them, `widgets.rs`'s `HandoverDoc` validates them, `Logic/Handover.swift` decodes them as optional and adds the two names to `Handover.fieldNames`. The widget rows never read them; every existing widget fixture stays green.
- **`Logic/EBirdRequest.swift`**: `urlString(for:)` and `make(for:key:)` gain `distKm: Int = WidgetCache.distKm` and `backDays: Int = EBirdRequest.backDays`; every existing call site is unchanged in effect (the widget's URL fixture row pins that).
- **`Logic/DeepLink.swift`** and **`lib/links/deepLink.ts`**: `maxLength` / `LINK_MAX_LENGTH` rise from 96 to 128 (arithmetic in 5.1); the TS parser gains one step; the Swift file gains nothing else (the alert builder lives in the app target).
- **`lib/links/linkFocus.ts`**, **`MapExplorer.tsx`**: the focus gains a `mode: 'only' | 'center'`, and the link effect gains the point-and-radius branch (section 5.4).
- **`gen/apple/project.yml`**: the app target's `sources` gain the widget `Logic/` directory and `Widget/EBirdClient.swift`; its `dependencies` gain `BackgroundTasks.framework`, `UserNotifications.framework`, `CoreLocation.framework`; `info.properties` gains the two keys; `snowraven_widgetsTests.sources` gains `Sources/snowraven/AlertsLogic` and the new fixture (section 9, section 8.4).
- **`src-tauri/src/lib.rs`**: `mod alerts` and its plugin and commands under `#[cfg(target_os = "ios")]`. The keeper line is byte-unchanged.
- **`src-tauri/build.rs`**: three more `-Wl,-U` allowances.
- **`src-tauri/src/widgets.rs`**: the hook's body is extracted into `pub(crate) fn park_link(app, url)` so the notification path and the `RunEvent::Opened` path share one validator (section 5.3). Behavior-preserving.
- **`lib/clearDerived.ts`**, **`cacheInventory.test.ts`**, **`clearDerived.test.ts`**: one row, one class, one name.
- **`App.tsx`**: boots `alertsController` on iOS after first paint, the widget pattern. No new static import beyond `alertsState.ts`.
- **`Settings.tsx`**: one gated `React.lazy` section and its `settingsSectionOrder.test.tsx` entry.
- **`docs/HELP.md`** (FR-44, written in the build), **`CHANGELOG.md`**, the four-file version set, **`appstore/REVIEW_NOTES.md`** (the background-mode explanation, as the widget build wrote its own notes in-build).

### Added at the design re-entry (the inbox revision, 2026-09-30)

The live look moved the inbox out of the Settings card into its own App-root sheet with three entry points (design-spec 7.0 to 7.5). Nothing native changes shape. The webview gains ONE device-local setting:

| Key | Document | Shape | Written | Read | Synced | Native |
|---|---|---|---|---|---|---|
| `alertsInboxViewedAt` | `settings.json` (`AppLocalData/data/`, the existing shared settings document) | ISO-8601 UTC instant (`YYYY-MM-DDTHH:MM:SS[.sss]Z`), or absent | through `storage.setSetting` (the `docChains` writer, one link per write) by `useAlertsInboxHost.openInbox` (`lib/alerts/alertsInboxHost.ts`), to the snapshot's `now` once it passes `parseViewedAt` (validated once; that one result is both what is written and what the store takes on close, and a value it refuses is neither), when the sheet OPENS on iPhone or iPad | once, by `startAlertsController` (`storage.getSetting`), in parallel with the first snapshot read: if it answers within 1 s (`VIEWED_READ_BOUND_MS`) it is applied before that snapshot is stored; if not, the snapshot is stored without it (every row counts as new meanwhile) and the late value is applied when it lands, unless a sheet close has set a newer one. Validated by `parseViewedAt` (`lib/alerts/alertsInboxEntry.ts`): the exact shape, a `Date` round trip (an impossible calendar date is refused), and no more than 24 hours ahead of now (the build's `ALERT_FUTURE_SKEW_HOURS` window); anything else reads as absent | never (iCloud Sync carries the two data files and, optionally, the keys; settings stay on the device) | never (native reads only the App Group container) |

Meaning: an inbox row is NEW when its `alertedAt` is later than this instant; absent means every row is new. The store's copy (`AlertsState.inboxViewedAt`) moves forward only when the sheet CLOSES, so the marks and the badge do not change while the user looks at them, and a check that lands while the sheet is open counts as new on the next opening. Clear leaves the value alone (the rows are gone, so the count is zero). No migration: a missing key is the first-run reading. It is not a derived store keyed on the eBird backup, so it has no clear-registry row (`cacheInventory.test.ts` is unchanged). Bounded: one short string, replaced in place.

New modules: `lib/alerts/alertsInboxEntry.ts` (entry-safe: the gate `inboxEntryOpen`, the count `newSinceViewed`, `parseViewedAt`, the entry points' words, the opener registry), `lib/alerts/alertsInboxHost.ts` (entry-safe hook: open, close, the write, the focus restore), `components/AlertsInboxEntry.tsx` (entry-safe: the header bell and the sidebar item) and `components/AlertsInboxSheet.tsx` (lazy). `paletteRows.ts` gains one row kind, `'inbox'`.

### Unchanged (used, not modified)

`storage.ts` (no new document under `AppLocalData/data/`, no new chain, no new seam method: the alert documents are outside the webview's reach by design, section 2), `replayStore.ts`, `countyDayObsCache.ts`, the transport and its caches (`CACHED_GET_PATHS`, `EBIRD_GATED_PATHS`: the check is a native path with its own etiquette, section 4.6), `ebirdGate.ts`, `rateLimit.ts` (the Swift twin `RetryAfter.swift` already exists), the iCloud Sync scope (nothing new is synced), `capabilities/*.json` (section 10.4), `Cargo.toml` (section 10.5), `tauri.conf.json` (`minimumSystemVersion` stays 16.0; OQ-05: no floor), the widget extension's behavior and every file under `Widget/` except that `EBirdClient.swift` is additionally compiled into the app, `Logic/WidgetRows.swift`, `RefreshEngine.swift`, `WidgetCache.swift`, the vendored tao (the cold-start forward is reused, not changed), the macOS entitlements, `backend/`.

---

## 1. Where the check runs: Swift in the app process, never the webview

### 1.1 The platform fact that decides it

A `BGAppRefreshTask` launches or resumes the APP process (not an extension) for about 30 seconds, and when it launches the app cold it does so with no scene: UIKit calls `application:didFinishLaunching` and never `scene:willConnectToSession:`. In the vendored tao (`vendor/tao/src/platform_impl/ios/app_state.rs`, `did_finish_launching`), scene mode defers `on_app_ready()` to the first scene setup; so in a background launch tao stays in its `Launching` state, the waker never starts, the queued `UIWindow` is never made key, no `NewEvents(Init)` is delivered, and the webview, created before `UIApplicationMain` and parked in that queue, never boots the React app. That is tao's designed path for a window created before launch, not a bug, and it means two things at once: the webview cannot be the thing that runs the check, and nothing in the check may wait on tao's event loop. `UIApplicationMain`'s own run loop does run, which is what serves the BGTaskScheduler handler, `URLSession` and `UNUserNotificationCenter`.

### 1.2 Decision

**The check, the scheduling, the notifications, the documents and the foreground trigger are all native Swift in the app target, behind one actor.** The webview is a client that reads a snapshot and sends settings edits; it never checks, never writes an alert document, never schedules and never posts a notification. The foreground check (FR-21's "when the app is opened") runs on the SAME native path, triggered by `UIApplication.didBecomeActiveNotification` observed in Swift, so the two triggers share one `running` flag and one `lastCheck` and cannot double-check or double-alert (question 2 answered: one side, the native one, runs every check).

Not chosen, and why:

- **Rust (objc2) for the whole subsystem.** `BGTaskScheduler`, `UNUserNotificationCenter` and their delegate protocols have Objective-C surfaces, so objc2 could reach them, but the check's logic is already written in Swift in `Logic/` (the reducer, fold, distance, date, Retry-After parse, the bounded file read, the hand-over decoder) and reusing it from Rust would mean a second implementation of every rule. The widget schema's decision 4 (Rust for file work, Swift where Swift is where the code is) cuts the other way here: the code is in Swift.
- **Reusing the widget EXTENSION process.** WidgetKit runs the extension only for timeline refreshes and gives it no way to post notifications (`UNUserNotificationCenter` requests from an extension are refused) or to schedule background work. The extension's CODE is reused (1.3); its process is not.
- **`tauri-plugin-notification`.** Its iOS half is a Swift plugin package with its own permission set and a webview-driven API; it cannot be called from a background task with no webview, and the app would still need `BGTaskScheduler` in Swift. One mechanism, not two.

### 1.3 What is reused, exactly

The app target compiles `snowraven_widgets/Sources/Logic` (Foundation and CryptoKit only; nothing in it needs iOS 17, verified by grep for `@available`, `Regex` and `formatted(`) and `snowraven_widgets/Sources/Widget/EBirdClient.swift` (imports Foundation only; conforms to the `WidgetTransport` protocol declared in `Logic/RefreshEngine.swift`). The check uses, unchanged:

| Rule | Widget symbol | Used for |
|---|---|---|
| The hand-over read | `HandoverDecoder.read(at:)` over `BoundedFile.read(_:maxBytes:)` (regular-file check through `attributesOfItem`, size bound before the read, key-subset check, `isValid`) | preconditions, the recorded set, the key, the default location |
| The request | `EBirdRequest.make(for:key:distKm:backDays:)` (5-decimal `JSNumber.toFixed` coordinates, the key header, no `maxResults`) | FR-22's one request |
| The transport | `EBirdClient.fetch` (ephemeral session, no cookies, no redirects, 20 s, `EBirdBody.collect` 2,000,000-byte cap, 429 with its `Retry-After` header surfaced as `.status(429, retryAfter:)`) | the one request and its outcome classes |
| The reduce | `RecentObsReducer.reduce` (one record per `speciesCode|locId`, latest `obsDt`, 512-unit string caps, 20,000-record cap, strict `obsDt`) | the candidate records |
| The name fold | `SpeciesName.fold` (= `stripTrailingParenthetical` + `lowercased`) | the subtraction against `recorded` (FR-23's subspecies folding) |
| The distance | `Distance.miles` (haversine, R = 3958.8) and its one-decimal formatter | inbox `distanceMi`, nearest-first ordering |
| The date | `ObsDate.parse`, `ObsDate.daysBetween` | inbox `obsDt` validation |
| Retry-After | `RetryAfter.parseSeconds` (`^[0-9]{1,3}$`, at least 1, capped at 60) | the 429 hold (section 4.6) |
| The cache read | `WidgetCache` decode and `validate` | the position's second source (section 4.3) |

What is NEW in Swift (section 11 lists the files): the alert documents and their validators, the candidate rule's countability clause, the dedupe and eviction, quiet hours, the notification text and the alert link builder (all pure, in `AlertsLogic/`), and the seams (`BGTaskScheduler`, `UNUserNotificationCenter` with its delegate, a `CLLocationManager` one-shot that never requests authorization, the `didBecomeActive` observer, the App Group file store for `alerts/`) in `Alerts/`.

---

## 2. Process model, ownership and concurrency (question 4)

### 2.1 One owner: the `AlertsStore` actor in the app process

Every reader and writer of `alerts/settings.json`, `alerts/state.json` and `alerts/inbox.json` is in the app process and goes through one Swift `actor AlertsStore`: the five Tauri commands (called from the webview through Rust), the `BGAppRefreshTask` handler, the `didBecomeActive` trigger, the notification delegate and the clear-registry purge. iOS runs one process per app, and a background launch and a foreground session are the same process at different times, never two processes at once. So the alert documents have exactly one writer at a time by construction, and the actor's serialization is sufficient for them.

The two other parties are readers or non-parties:

- **The widget extension** never opens `alerts/` (QA-50's grep over the extension's Swift sources for the string `alerts/` and for the three file names is a guard row).
- **The webview** cannot reach the App Group container at all: the `fs` grant is `$APPLOCALDATA/**` and the container is outside it (the widget schema's section 2.5 posture, restated). Its only route is the five commands, each of which is a message to the actor.

### 2.2 Why a promise chain is not the mechanism, and why no cross-context lock is needed either

The brief's fourth question asks where the inbox lives so that "both the native check and the webview can write it". The answer is that the webview does not write it. A `docChains` link or a `writeThrough` chain protects a document from two JavaScript writers in one context; here there are zero JavaScript writers, so the JS rules (CLAUDE.md, the single-webview invariant) are not the protection and are not weakened. A native-side lock or atomic-rename protocol between two PROCESSES would be needed only if the extension or a second app process wrote these files; neither does. Each write is still temp-then-rename (`alerts/<name>.json.tmp-<pid>`, then `rename`), so a crash mid-write leaves the previous document, and every read validates the shape (section 3), so a torn or planted file reads as absent.

### 2.3 Against CLAUDE.md's reversal condition

CLAUDE.md's condition ("if a second window or webview is ever created on any platform, all three stop being sufficient and the shared documents need cross-context exclusion") is about documents the webview writes. The alert documents would survive a second webview unchanged: two webviews would be two clients of the same actor. The invariant's keeper (`.run(tauri::generate_context!())`) is untouched: the new plugin in `alerts.rs` uses `setup` only and no `on_event` at all, so `RunEvent::SceneRequested` still reaches Tauri's own no-op callback. `singleWebviewInvariant.test.ts` stays green without modification; no new `SINGLE-WEBVIEW INVARIANT` note is added because none of the new state is JS-side module state protecting a shared document.

### 2.4 In-flight supersession

The actor holds a monotone `generation`. A check captures it when it starts; `disable()`, `purgeInbox()` (the backup clear) and `clearInbox()` (the user's Clear) each bump it. Before its write the check compares, and a stale check writes nothing, posts nothing and schedules nothing (FR-42's "end any check in progress without delivering a notification or writing to the inbox"). The request itself, once sent, is allowed to complete or time out (at most 20 s); the `BGAppRefreshTask` expiration handler cancels the `URLSessionTask` and marks the check discarded. This is the `countyDayObsCache` purge-generation rule with the capture at the fetch chokepoint, in one language.

### 2.5 The background launch and the Rust callbacks

The Rust callback that pokes the webview (`snowraven-alerts`, section 10.2) is called by Swift only when `UIApplication.shared.applicationState != .background` (read on the main actor). In a background launch no webview is running and tao's loop is parked, so the poke would only queue; skipping it removes any question of an `emit` during `Launching` under the `panic = "abort"` profile (verify-item V4 measures the remaining case: a poke from a foreground check is delivered). The webview re-reads its snapshot on `visibilitychange` to visible regardless, so a background check's outcome reaches the status line on the next open without the poke.

---

## 3. The documents (question 3)

### 3.1 Container and files

- **Directory:** `<container>/alerts/` where `<container>` is the App Group container, the sibling of `widgets/` that the widget schema's section 1.1 reserved the subdirectory pattern for. Constants: `AlertsFiles.dir = "alerts"`, `settingsFile = "settings.json"`, `stateFile = "state.json"`, `inboxFile = "inbox.json"`, pinned to the TS constants in `alertsState.ts` and the Rust constants in `alerts.rs` by `alertsPaths.parity.test.ts` (section 8).
- **Why the App Group and not `AppLocalData/data/`:** three reasons, each sufficient. The webview's `fs` grant covers `$APPLOCALDATA/**`, so a document there is reachable by the webview and the single-owner claim in 2.1 would rest on discipline rather than on a grant (security.md's leading-dot rule shows how thin that line is); the container's default protection class (`CompleteUntilFirstUserAuthentication`, the widget schema 1.1) is what a background check on a locked phone needs, and it is already the class the hand-over has; and everything else the check reads (the hand-over, the widget cache) is already there, so the check opens one directory tree.
- **Backup and sync:** iOS device backups include the container (the widget schema's stated default); iCloud Sync never touches it (its scope is the two data files and the bar-chart files, unchanged). FR-12 and FR-38's "never synced" hold by location, provably: `icloudPaths.parity.test.ts`'s roster of synced paths is untouched and QA-11 greps it.
- **Regular-file discipline on every read and write** (security.md v1.0.11 / v1.0.13, the rule is every native read outside the sealed bundle): `alerts/` is checked to be a real directory (a file or symlink at that name is removed, `AppGroupStore.widgetsDir`'s pattern); each file is read through `BoundedFile.read(_:maxBytes:)` (attributes first, `.typeRegular`, size at most the bound, then `Data(contentsOf:)` with the length re-checked); each write clears a planted symlink or directory at both the temp and the target name before writing. Bounds: `settings.json` 16,384 bytes, `state.json` 262,144 bytes, `inbox.json` 2,097,152 bytes (200 rows at the per-field maxima serialize under 1.2 MB; the bound is above that and far below anything a 30 s task should decode). A file over its bound is never read and is treated as absent, which heals by the next write.
- **Validation:** every document is decoded with `JSONDecoder` after a key-subset check against the document's field-name table (the `Handover.fieldNames` pattern), then `validate()`d per field; a failing document reads as absent. For the inbox, validation is per ROW: a malformed row is dropped and the rest kept (NFR-04, QA-38), and the surviving rows are re-sorted and re-capped at read so the bound holds on load as well as on write.

### 3.2 `alerts/settings.json` (version 1)

```
interface AlertsSettingsV1 {
  version: 1
  enabled: boolean                       // default false (FR-02); the only writer of true is the Settings switch through alerts_set_enabled
  cadence: 'hourly' | 'daily'            // default 'hourly' (FR-06)
  quietHours: { on: boolean; startMin: number; endMin: number }
                                         // default { on: false, startMin: 1320, endMin: 420 } = 10:00 PM to 7:00 AM (FR-07);
                                         // minutes since local midnight, integers 0..1439; startMin === endMin means no quiet period (FR-34)
  model: 'fixed' | 'my-location'         // default 'fixed' (FR-08)
  fixedPlace: { lat: number; lng: number; name: string | null } | null
                                         // null = FOLLOW the saved Default Location (read from the hand-over's defaultLocation at check time,
                                         // FR-09's "defaults to"); an object = a hand-set place, never overwritten by a later Default Location save
                                         // (FR-09's independence holds because the two are different documents with no writer in common).
                                         // name: the place-name search's display string when the place was chosen that way (FR-29 "near <name>"),
                                         // null when entered as coordinates or set by Use my location ("nearby").
  radiusMi: number                       // integer 1..25, default 25 (FR-11); refused at entry by the section, refused again by the validator
  updatedAt: string                      // ISO-8601 UTC seconds
}
```

Bounds: `lat` in [-90, 90], `lng` in [-180, 180], both finite; `name` 1 to 120 UTF-16 code units, no control characters, no leading or trailing whitespace (the hand-over's `valid_name` rule at a shorter length: Nominatim display names run to about 100 characters). A document failing validation reads as the defaults with `enabled: false`, which is the safe direction (FR-03): a corrupted settings file cannot turn alerts on.

`fixedPlace.name` is user-chosen display text that reaches a notification title (section 4.5). It is rendered by the system as plain text; nothing interprets it.

### 3.3 `alerts/state.json` (version 1)

```
interface AlertsStateV1 {
  version: 1
  lastCheck: {
    completedAt: string                  // ISO-8601 UTC seconds; the instant the check finished (request answered or refused)
    outcome: 'nothing-new' | 'hits' | 'unreachable' | 'busy' | 'key-rejected'
                                         // unreachable = offline, timeout, any non-2xx other than 429/401/403, malformed or over-cap body
    hits: number                         // integer >= 0; the count the notification carried (0 for every outcome but 'hits')
    from: 'fixed' | 'my-location' | 'fixed-fallback'   // fixed-fallback = My location chosen, position unavailable, fixed place used (FR-16's caption)
    checkId: string                      // UUID v4, lowercase; joins the inbox rows this check wrote
  } | null                               // null = "Not checked yet" (FR-19)
  holdUntil: string | null               // ISO; set by a 429 to now + bounded Retry-After (section 4.6); no request starts before it
  position: { lat: number; lng: number; at: string; source: 'seed' | 'foreground' } | null
                                         // the APP's most recent known position: 'seed' = the webview's getCurrentLocation() result passed with
                                         // the settings edit that chose My location or pressed Use my location; 'foreground' = the check's own
                                         // one-shot read while the app was active. The widget's cell is NOT copied here; it is read live (4.3).
  pending: {                             // the deferred notification (FR-33, FR-35, FR-36); null when none is scheduled
    windowEndAt: string                  // ISO; the end of the quiet window in force when the FIRST deferred hit was found (FR-13: a later
                                         // quiet-hours edit does not move it)
    place: PlacePhrase                   // the phrase of the first deferring check (section 4.5)
    hits: PendingHit[]                   // at most 200; merged across checks in the window, one per speciesCode, nearest-first
    checkIds: string[]                   // at most 200
  } | null
  scheduledEarliest: string | null       // the earliestBeginDate last submitted to BGTaskScheduler; display and simulator evidence only
  backgroundRefresh: 'available' | 'denied' | 'restricted'
                                         // UIApplication.backgroundRefreshStatus at the last write; the section can say when the system
                                         // has Background App Refresh off for SnowRaven (Settings, General, Background App Refresh)
}

interface PendingHit { speciesCode: string; comName: string; locId: string; distanceMi: number; link: string }
type PlacePhrase = { kind: 'name'; name: string } | { kind: 'near-you' } | { kind: 'nearby' }
```

`position` and `pending` are the only fields that grow; both are bounded. A `state.json` that fails validation reads as `{ lastCheck: null, holdUntil: null, position: null, pending: null }`, the fresh-install state, and the next check rewrites it.

*Added at the security review (L3, L4).* A valid document is then read through `AlertsStateDoc.normalized(now)`: a `holdUntil` more than `RetryAfter.capSeconds` (60) ahead, a `lastCheck.completedAt` more than `AlertRules.futureSkewHours` (24) ahead, and a `position` more than 24 h ahead or older than `positionMaxAgeSeconds` read as absent, and the engine writes the result back whenever that removed anything. `scheduledEarliest` is left (it gates nothing). A `pending.windowEndAt` more than `AlertRules.summaryMaxAheadHours` (26) ahead is handled by the engine's `clearStalePending` rather than here (I8), because forgetting it must also withdraw its `alerts.deferred` request; the longest real window end, across a DST change, is about 25 h ahead. The position is also removed when the model becomes Fixed place, on disable, on the backup-clear purge, and whenever a read of the location permission finds it denied or restricted (a check, the snapshot, activation).

### 3.4 `alerts/inbox.json` (version 1)

```
interface AlertsInboxV1 {
  version: 1
  rows: InboxRow[]                       // at most 200, ordered newest alertedAt first (ties: speciesCode ascending, then id)
}

interface InboxRow {
  id: string                             // UUID v4 lowercase (36 chars); the React key and the DOM-id-free identity (NFR-07: DOM ids are index-keyed)
  checkId: string                        // the check that created the row (UUID)
  speciesCode: string                    // ^[a-z0-9-]{2,16}$ (the app's SPECIES_CODE_RE; a code outside it is not a row: the reducer already caps
                                         // it at 512 units, and a code eBird ships outside the class would be a rule change here first)
  comName: string                        // eBird's display name as returned, 1..512 units, no control characters (FR-30: the display name,
                                         // rendered in-app through <BirdName>)
  locId: string                          // ^L[0-9]{1,15}$ or '' (the reducer defaults a missing locId to ''); '' degrades the row's link (5.2)
  locName: string                        // 0..512 units (the place shown, FR-37)
  lat: number; lng: number               // the SIGHTING, finite and in range
  obsDt: string                          // eBird's shape, ObsDate.parse must accept it ("when eBird reported it")
  distanceMi: number                     // finite >= 0; from the check's point, one decimal at display
  point: { lat: number; lng: number }    // the check's point (the row's tap-through searches from HERE, FR-37)
  radiusMi: number                       // integer 1..25 (the check's radius)
  place: PlacePhrase                     // the check's phrase (FR-37's "the place")
  alertedAt: string                      // ISO; set when the row was CREATED; never changed by an update (FR-24)
  updatedAt: string                      // ISO; the last time a re-find inside seven days refreshed the sighting fields
}
```

**Dedupe is derived from the rows; there is no separate dedupe document.** FR-24 and FR-27 together say the seven-day rule is measured "from the last alert time the app still holds", and the inbox IS what the app holds: a candidate whose `speciesCode` has a row with `alertedAt` within `AlertRules.dedupeSeconds` (= 7 × 86,400, one constant, twinned as `ALERT_DEDUPE_DAYS = 7` in TS) is NOT a hit and that row's sighting fields (`locId`, `locName`, `lat`, `lng`, `obsDt`, `distanceMi`, `point`, `radiusMi`, `place`, `updatedAt`) are replaced with the newer sighting, keeping `id`, `checkId`, `alertedAt` and therefore its position in the newest-first order. A candidate with no such row is a hit and gets a new row. Clearing the inbox (FR-39) or a row aging out (FR-38) therefore re-arms the species exactly as FR-27 requires, with no second store to keep in step.

**The bound holds on every write** (`Inbox.evict(rows, now)`, a pure function): drop rows with `alertedAt` older than `AlertRules.retentionSeconds` (30 × 86,400); then, while more than `AlertRules.maxRows` (200) remain, drop the row with the oldest `alertedAt`. Applied before every write and after every load. Both constants are twinned in TS and pinned by the parity guard (testing.md: compare two declarations, never restate). *Added at the security review (L2, L4):* `evict` also drops a row whose `alertedAt` or `updatedAt` is more than `futureSkewHours` (24, twinned as `ALERT_FUTURE_SKEW_HOURS`) ahead, and a load that left anything out (`AlertsInbox.read(...).leftOut`) writes the result back: at the top of every enabled check, held, blocked and unanswered ones included (I10), at the snapshot, and at activation (alerts on or off), so the 30-day bound holds on disk as well as on screen. Leftover `*.tmp-*` files in `alerts/` are swept at activation, on Clear and on the backup-clear purge (I6, I9).

### 3.5 Write discipline

- **One writer per document per instant**: the actor. Each mutation is `read (validated) -> pure transform -> validate -> temp-then-rename`. There is no read-modify-write across an `await` boundary inside the actor except around the network request and the location read, and those two capture `generation` (2.4) so a purge or disable that landed during the await wins.
- **Write order inside a check:** `inbox.json` first, then `state.json`, then the notification request, then the next `BGAppRefreshTaskRequest`. A crash between any two leaves a coherent state: rows without a `lastCheck` update are history the next check reads correctly; a `lastCheck` without its notification means one missed banner, and the rows are in the inbox (FR-33's promise is the inbox, the banner is best-effort delivery).
- **Errors are short stable strings** (`unavailable`, `no-app-group`, `invalid`, `too-large`, the widget vocabulary); no document body ever appears in an error, a log line or a Rust `format!`. The Swift `Handover` value the check holds is the widget's redacted type; the alerts documents hold no secret, and the key is never copied out of the hand-over into any alert document (the state and inbox validators have no key field, so the absence is structural).

### 3.6 The hand-over: two fields added (version stays 1)

```
  countableExceptions: string[]          // assets/ebird-countability.json `countable`  (88 names today): eBird COUNTS these although the shape rule would reject them
  nonCountableExceptions: string[]       // assets/ebird-countability.json `nonCountable` (81 names today): eBird does NOT count these although the shape rule would admit them
```

Raw names exactly as the asset holds them (parenthetical intact; `isNonCountableForm` is called with the raw name), each under the hand-over's existing `valid_name` rule, each list at most 1,000 entries (the asset's two lists are 88 and 81; the generator fails closed on a short or overlapping list, so 1,000 is a shape bound, not a forecast). Written by `buildHandover` from the lists `speciesUtils.ts` already imports (they join the entry chunk by zero bytes: the asset is already there), validated by `HandoverDoc` in Rust as required fields, decoded by `Logic/Handover.swift` as `[String]?` with the two names added to `fieldNames` so the subset check admits them. The widget's row builder never reads them; the alerts check requires both non-nil and treats a document without them as `unreachable` for the status line with the internal reason `stale-handover` (only possible for a hand-over written by 1.0.40 that has not been regenerated, which cannot coincide with alerts being on: enabling requires the 1.0.41 app to be open, whose boot trigger regenerates the document first).

This is the PRD's "any change to the hand-over beyond what the check needs to read" exclusion applied, not breached: the check needs exactly these to apply the app's shared rule without a second copy of the asset in Swift (section 3.7). The version stays 1 because the app and the extension ship in one bundle; no mixed-version pair can exist, and the Swift decoder's optional fields keep every existing widget fixture valid.

### 3.7 The countability rule on the native side (question 6)

`isNonCountableForm(name)` in `lib/speciesUtils.ts` is: `EBIRD_REJECTS.has(name)` returns true; else `EBIRD_COUNTS.has(name)` returns false; else the shape rule `name.endsWith(' sp.') || name.includes('/') || normalizeSpeciesName(name).includes(' x ')`. The two sets are the data; the shape rule is three string operations. **Decision: the data is handed over (3.6) and the shape rule is twinned**, because a precomputed allow/deny SET over eBird's answer is impossible (the names arrive at check time) and a precomputed deny set over the whole taxonomy would be 17,891 names for a rule three lines long.

`AlertsLogic/Countability.swift`: `static func isNonCountableForm(_ name: String, rejects: Set<String>, counts: Set<String>) -> Bool` with exactly the three clauses in that order, the third using the existing `SpeciesName.stripTrailingParenthetical` (the Swift twin of `normalizeSpeciesName`, already pinned by the widget's `foldRows`). String equality and `contains` are code-unit comparisons on both sides for every name eBird ships; the fixture carries a non-ASCII name in each list (section 8.3).

**Parity guard:** `alertRules.fixture.json` carries every name in both lists with its TS verdict, plus a hand-authored shape corpus (a spuh, a slash, a hybrid with and without a parenthetical, a domestic form that is in the rejects list, a name with " x " only inside a trailing parenthetical which the app's rule ADMITS because the parenthetical is stripped before the ` x ` test, an ordinary name), and the generated single-position-edit corpus of one conforming name over the 96-character alphabet, asserting `isNonCountableForm` (TS) and `Countability.isNonCountableForm` (Swift) agree on every row (testing.md's symmetric-difference rule: the corpus test prints both directions' counts and asserts both zero, since the twin has no declared difference).

### 3.8 `EBirdRequest` parameters

`urlString(for c: Coordinate, distKm: Int = WidgetCache.distKm, backDays: Int = EBirdRequest.backDays)` and `make(for:key:distKm:backDays:)` with the same defaults. The check passes `distKm: Int((Double(radiusMi) * 1.60934).rounded())` (the `handleFindLifers` computation, pinned by a two-declaration test on both sides rather than a table of literals: 25 -> 40, 1 -> 2) and `backDays: 1` (FR-22's "last one day"). The widget's call sites pass nothing and produce the byte-identical URL the widget fixture pins.

---

## 4. The check

### 4.1 Triggers and the one-at-a-time rule (FR-21)

`AlertsEngine.runCheck(trigger: .background(BGAppRefreshTask) | .foreground)`:

1. If `running` is true, return at once (the second trigger of an overlapping pair does nothing; QA-20). Set `running`, capture `gen = generation`, mint `checkId`.
2. Read `settings`; if `!enabled`, return (belt and braces: disable cancels the task, but a task already launched still lands here).
3. Read `state`; if `holdUntil` is in the future, return WITHOUT a request and without touching `lastCheck` (QA-25: 10 s after a `Retry-After: 30` no request is made, 31 s after one is).
4. Preconditions, in FR-18's order, each ending the check without a request and without a `lastCheck` write (the status line derives the sentence live, 4.7): hand-over readable with the two countability lists; `ebirdKey != nil`; `hasEbirdBackup`; a point (4.3).
5. The request (4.4), the outcome, the rows (4.5), the notification (4.6), the write (3.5).
6. Submit the next `BGAppRefreshTaskRequest` (section 9.2); `running = false`; poke the webview (2.5); for a background trigger, `task.setTaskCompleted(success:)`.

**Due-ness** for the foreground trigger and for the first check after enable: `due(now) = lastCheck == nil || now - lastCheck.completedAt >= interval(cadence)` where `interval` is 3,600 s for hourly and 86,400 s for daily (`AlertRules.hourlySeconds`, `dailySeconds`). `didBecomeActive` runs `runCheck(.foreground)` only when `enabled && due(now)`. A cadence change (FR-13) rewrites the schedule from the SAME `lastCheck.completedAt` (9.2) and, if the app is active and now due, runs the foreground check at once (QA-12's "Daily to Hourly with the last check 3 h ago: a check is due now"). A place, model or radius change never triggers a check (FR-13); it only re-evaluates the live status (4.7).

### 4.2 Foreground: a fresh position under My location (FR-17)

When `model == 'my-location'` and the trigger is `.foreground`, the check asks `AlertsLocator` for one position: `CLLocationManager.authorizationStatus` must already be `.authorizedWhenInUse` or `.authorizedAlways` (the locator NEVER calls `requestWhenInUseAuthorization`; the only requester in the app remains the geolocation plugin behind `getCurrentLocation()`, FR-15); `desiredAccuracy = kCLLocationAccuracyHundredMeters`; a recent `manager.location` under 5 minutes old is used as-is, else `requestLocation()` bounded at 10 s (the widget's `LocationRequest` numbers, restated in the app-side locator because the widget's checks `isAuthorizedForWidgetUpdates`, which is the wrong predicate in the app). Success writes `state.position = { lat, lng, at: now, source: 'foreground' }`. Failure or timeout falls through to 4.3's stored sources. A `.background` trigger never calls the locator (FR-17's last sentence; QA-16's "no location read starts from a background check" is a row that asserts the locator seam is not invoked for the background trigger).

### 4.3 The point (questions 3 and OQ-04)

`resolvePoint(settings, handover, state, widgetCell, now) -> Resolved | Blocked` (pure; the seams supply the inputs):

- **Fixed place:** `settings.fixedPlace ?? handover.defaultLocation`; absent -> `Blocked.noPlace` ("Set a place to measure from", FR-10). Phrase: `{ kind: 'name', name }` when `fixedPlace.name` is set, else `{ kind: 'nearby' }` (FR-29: a hand-set place with no name and the followed Default Location both read "nearby").
- **My location:** the newest of (a) `state.position` (a foreground fix or a seed, 4.2 and 6.4) and (b) the widget cache's `cell` with `fetchedAt` as its time, each admitted only when `now - at <= AlertRules.positionMaxAgeSeconds` (86,400; OQ-04's default, not tightened: a fixed place is the model for a user who wants precision, and the age limit exists to stop a stale fix from measuring from a city the user left yesterday, which 24 h does). Phrase `{ kind: 'near-you' }`, `from: 'my-location'`. If neither qualifies: fall back to the fixed place if one resolves (`from: 'fixed-fallback'`, phrase as for fixed; the status caption "From your fixed place", FR-16), else `Blocked.locationOff` when location is denied or restricted, `Blocked.noPosition` otherwise (the section shows the location-off sentence with the Location Services path and the fixed-place alternative for both; the distinction only changes which help sentence the Designer picks).

**Why the widget cell is a source and what it costs.** It is the only position that updates while the app is closed (a placed widget refreshes about every 30 minutes and records the cell it searched), which is the case My location exists for. Its cost is stated rather than hidden: the cell is rounded to two decimals, so a background check under My location measures from a point up to about 0.7 mi from the true one, and the inbox distances for that check carry that error. `WidgetCache.decode` + `validate` is reused unchanged (a cache the widget itself would refuse is refused here too), read through `BoundedFile.read` at the widget's 8 MB bound; the key fingerprint is irrelevant to the read and not checked. A cache document written by a future widget version that fails today's validator simply reads as no second source. The app still never WRITES the widget's document.

*Added at the security re-review (L6, L4 residual).* Under My location the resolved point is `AlertRules.approximate(pick)` / `approximatePoint(pick)`: rounded half away from zero to two decimals, the precision the widget's cell already has, so the request, every distance, the inbox rows (`InboxRow.point`), the notification links and a waiting summary's links all carry a point within about half a mile of the device, and only `state.position` (at most 24 hours) holds the reading itself. A fixed place, followed or fallback, keeps the precision the user gave it. Both sources are also admitted only when `at - now <= futureSkewSeconds` (24 h), so a widget cell stamped while the clock ran ahead cannot win "newest". Fixture rows: `my-position-approximated`, `my-position-ties-away-from-zero`, `my-position-positive-tie`, `my-cell-25h-ahead-ignored`, `my-cell-24h-ahead-used`.

*Added at QA round 2 / the security re-review round 2 (L7): the widget cache records where its cell came from.* When the widget cannot read a location (widget location updates not authorized, the 10-second fix timing out, or Core Location failing) it searches around the hand-over's Default Location, and the cell it caches is then that place, not the device. **`widgets/cache.json` gains one optional field, `cellSource: "device" | "default-location"`** (`CellSource` in `Logic/WidgetCache.swift`), written by `RefreshEngine` on every fresh fetch from its existing `usedDefault` flag. It is data provenance only: the widget never reads it, it is not part of the freshness comparison (`c.cell == cell`), and nothing the widget does or shows changes; a `failed()` rewrite keeps whatever the cache held. Decoding stays tolerant: a cache written before this build has no such key and decodes as unmarked; an unknown value refuses the cache like any other malformed field (the widget refetches). The extension's Info.plist and entitlements are unchanged. **Alerts accepts the cell as a My location source only when it is marked `device`** (`WidgetCellReading.source`, `ResolvePoint.resolvePoint`; TS `PointInputs.widgetCell.source`, `resolvePoint`): a `default-location` cell, or an unmarked one from an older cache, is ignored, so the check falls through to the app's own position, else the fixed place ("From your fixed place", `from: fixed-fallback`), else `no-position`. Accepted cost: after an update, until the widget's next fetch writes the marker (a placed widget fetches about every 30 minutes, as iOS allows), an older, unmarked cell is not used. Fixture rows: `my-cell-device-used`, `my-cell-default-location-ignored`, `my-cell-unmarked-legacy-ignored`, `my-cell-default-location-own-position-used`, `my-cell-unmarked-no-place`; every earlier cell row is marked `device`.

### 4.4 The request (FR-22, NFR-01)

One `EBirdRequest.make(for: point, key: handover.ebirdKey, distKm: km(radiusMi), backDays: 1)` through `EBirdClient.fetch`. Outcomes map to `lastCheck.outcome`:

| `FetchResult` | outcome | inbox | notification | hold |
|---|---|---|---|---|
| `.ok(data)` decoded | `nothing-new` or `hits` | rows per 4.5 | per 4.6 | cleared |
| `.status(429, retryAfter)` | `busy` | untouched | none | `holdUntil = now + (RetryAfter.parseSeconds(retryAfter) ?? RetryAfter.cap)`, i.e. 1..60 s, 60 s when the header is absent or unparseable |
| `.status(401 | 403, _)` | `key-rejected` | untouched | none | untouched |
| any other status, `.offline`, `.timeout`, `.tooLarge`, a body that fails `RecentObsReducer` | `unreachable` | untouched | none | untouched |

No retry inside the check (`EBirdClient` has none; NFR-02). A 429 or error body is never stored (there is nowhere to store it: the inbox holds rows, not answers).

**Network behavior in the durable form** (security.md v1.0.20; CLAUDE.md's sentence for the Planner and the Architect): this feature adds no third-party request, no new endpoint and no new host. It makes the app's existing eBird `data/obs/geo/recent` request with the user's own key, from a native check on iPhone and iPad at most once per chosen cadence, and it moves that request into a context where the webview is not running. Nothing is sent to the developer. On web/Pi and desktop the feature does not exist, so the `storage` seam's HTTP on web/Pi is not touched by it.

### 4.5 Candidates, hits and rows (FR-23, FR-24, FR-27, FR-28)

Over `RecentObsReducer.reduce(body)`:

1. **Subtract:** drop records whose `SpeciesName.fold(comName)` is in `Set(handover.recorded)`. (FR-28 holds by construction: `recorded` is re-derived from the file at every hand-over regeneration and the check reads the current document each time.)
2. **Countability:** drop records where `Countability.isNonCountableForm(comName, rejects, counts)` (3.7).
3. **One record per species:** group by `speciesCode`; keep the nearest by `Distance.miles(point, record)`, ties by greater `obsDt` (string compare), then smaller `locId` (the widget's row rule).
4. **Dedupe against the inbox** (3.4): a species with a row inside seven days updates that row and is not a hit; otherwise it is a hit and a new row is built with `alertedAt = now`.
5. **Order hits nearest-first** (the notification's body order and the merge order for a deferred summary).
6. Evict (3.4), write.

QA-22's fixture is a row of the parity fixture (recorded {A, B (subspecies form)}; eBird returns A, B species-level, C, "gull sp.", "X x Y hybrid", D; candidates exactly {C, D}), generated from the TS twin and asserted by both runtimes.

### 4.6 The notification (FR-29 to FR-36)

**Content** (`AlertsLogic/NotificationText.swift`; TS twin `alertRules.ts`): title `"<n> lifer reported <phrase>"` / `"<n> lifers reported <phrase>"` with phrase `near <name>` | `near you` | `nearby`; body: the first three hit names nearest-first joined with `", "`, then `" and <n - 3> more"` when `n > 3`. Names are eBird's `comName` verbatim (FR-30: the display name, no code, no favicon, no link). `fixedPlace.name` is the only user text in the title, bounded at 3.2.

**Delivery:** `UNMutableNotificationContent { title, body, sound: .default, userInfo: ["link": <alert link>], threadIdentifier: "alerts" }`. Immediate: `UNNotificationRequest(identifier: "alerts.check.<checkId>", trigger: nil)`. The `userInfo.link` is the alert link of the FIRST-named hit with `show=all` (5.1). Exactly one request per check (FR-29).

**Quiet hours** (`QuietHours.isQuiet(minuteOfDay, startMin, endMin)`: `start == end` -> false; `start < end` -> `start <= m < end`; `start > end` -> `m >= start || m < end`; QA-33's four instants are fixture rows; `QuietHours.windowEnd(now, endMin, calendar)` = the next instant at `endMin` after `now` in the device calendar and time zone, computed with `Calendar.nextDate(after:matching:)` so a DST transition inside the window is handled by the calendar rather than by minute arithmetic): when a check with hits runs inside the window, the hits enter the inbox at once with `alertedAt = now` (FR-33) and the notification is DEFERRED:

- `state.pending` is created with `windowEndAt = windowEnd(now)` if null, else kept (FR-13, FR-35: the window in force when the first hit was deferred); its `hits` are merged with the new hits (one per `speciesCode`, the nearer sighting kept, the union re-sorted nearest-first, capped at 200) and `checkIds` appended.
- One `UNNotificationRequest(identifier: "alerts.deferred", trigger: UNCalendarNotificationTrigger(dateMatching: <year, month, day, hour, minute of windowEndAt in the local calendar>, repeats: false))` with the content rebuilt from the MERGED hits (the title's count and the body's names cover the combined set). Adding a request with an identifier that is already pending replaces it, which is the merge's delivery mechanism: several checks in one window leave exactly one pending request (QA-34).
- The calendar trigger fires whether or not the app is running (FR-36; QA-35 is the user's device check). `state.pending` is cleared when: the deferred notification's `windowEndAt` is in the past at the next check or at the next `didBecomeActive` (a `getPendingNotificationRequests` read confirms `alerts.deferred` is no longer pending before clearing); alerts are turned off (FR-42: `removePendingNotificationRequests(withIdentifiers: ["alerts.deferred"])`, then null); or the backup is cleared (section 7: the summary is derived from the file, so the teardown cancels it). The user's Clear (FR-39) does NOT cancel it: FR-39 names rows and nothing else, and the pending summary's link still opens the map at its point.

**Foreground delivery (FR-32):** the app sets `UNUserNotificationCenter.current().delegate` to `AlertsNotificationDelegate` at init; `willPresent` returns `[.banner, .list, .sound]` for requests whose identifier begins with `alerts.`, so a foreground check's notification is shown as a banner rather than silently dropped. The app schedules no other notifications; the prefix test is there so the delegate's answer is scoped by identity rather than by assumption.

**Permission (FR-14):** `alerts_set_enabled(true)` calls `requestAuthorization(options: [.alert, .sound])` only when `getNotificationSettings().authorizationStatus == .notDetermined`; the answer is not stored (it is re-read live into the snapshot). A denied status leaves `enabled` true, checks run and fill the inbox, and `postNotification` is skipped with no attempt (the immediate and deferred paths both check `authorizationStatus` before `add`). Never re-prompted.

### 4.7 The live status (FR-18, FR-19)

The snapshot the webview reads (10.1) carries `blocked` computed LIVE by `resolveBlocked(settings, handover, state, widgetCell, permissions, now)`: `null` when a check could start, else the first of `no-key`, `no-backup`, `no-place`, `location-off`, `no-position`. This is the same pure function step 4 of the check uses, so the section's sentence and the check's refusal cannot disagree, and a settings edit re-renders the sentence without a check running. The status line is: the blocked sentence if any; else `lastCheck` rendered as FR-19's sentence in local time (`hits` -> "<n> lifers" with the singular at 1; `unreachable` -> "offline"; `busy` -> "eBird busy"; `key-rejected` -> "eBird did not accept your key"), with the caption "From your fixed place" when `from == 'fixed-fallback'`; else "Not checked yet". Two sentences beside it come from `permissions`: notifications denied (with the Settings, Notifications, SnowRaven path) and, under My location, location denied. A third, from `state.backgroundRefresh`, is offered to the Designer: Background App Refresh off for SnowRaven, with its path, because a user who turned it off system-wide will otherwise see "Last checked" only when they open the app and never learn why.

**Flag for the Designer (not a blocker):** FR-19's five sentences give an HTTP 5xx, a malformed body and a timeout the word "offline". The outcome enum keeps them under one value (`unreachable`) so the sentence can be changed in one place; if the Designer wants "eBird did not answer" as a sixth sentence, the data already supports it.

---

## 5. The deep link: the alert form (question 7)

### 5.1 Grammar

One anchored form beside the fifteen exact view links, authored by exactly two builders (the Swift notification path and the TS inbox row) and parsed by one parser:

```
snowraven://map/lifers?window=day&lat=<lat>&lng=<lng>&r=<r>&sp=<speciesCode>&loc=<locId>&show=<all|one>

  lat:  -?[0-9]{1,2}(\.[0-9]{1,5})?      then Number() in [-90, 90]
  lng:  -?[0-9]{1,3}(\.[0-9]{1,5})?      then Number() in [-180, 180]
  r:    [0-9]{1,2}                       then 1..25
  sp:   [a-z0-9-]{2,16}                  SPECIES_CODE_RE (lib/speciesCode.ts), unchanged
  loc:  L[0-9]{1,15}                     LOC_ID_RE, unchanged
  show: all | one                        all = center on the sighting, every lifer shown (FR-31); one = that species alone beside Show all (FR-37)
```

`ALERT_LINK_RE` (TS) and `AlertLink.pattern` (Swift, compared as text by the parity guard) are one regex: anchored at both ends, fixed classes, bounded quantifiers, no alternation except the two-word `show`, no nesting. Longest instance: 33 (`snowraven://map/lifers?window=day`) + 14 (`&lat=-12.34567`) + 15 (`&lng=-123.45678`) + 5 (`&r=25`) + 20 (`&sp=` + 16) + 21 (`&loc=` + 16) + 9 (`&show=all`) = 117; `LINK_MAX_LENGTH` and `DeepLink.maxLength` become 128 on both sides (the existing 96 stays true of every widget link, and the Rust `LINK_MAX_BYTES = 512` is unchanged). Coordinates are printed with `JSNumber.toFixed(x, 5)` in Swift and `toFixed(5)` in TS, the app's own 5-decimal form, so the two builders produce the same bytes for the same point (a fixture row).

**Why coordinates this time, when the widget link carries ids only.** The widget re-runs its search from the user's CURRENT position, so ids suffice there. An alert's search point is the check's point, which is not where the user is now and is not stored anywhere the parser could look it up without an async read of a native document; a link that carried only a `checkId` would need the inbox to still hold that check when tapped, and a cleared inbox would degrade a fresh notification tap to a search from the wrong place. Two bounded decimals with a range check are a smaller surface than a second lookup path.

### 5.2 Parser change (`parseWidgetLink`)

Step 2 of the existing parser gains a prefix: after the length gate, `ALERT_LINK_RE.exec(raw)`; a match yields `{ view: 'lifers', window: 'day', point: { lat, lng }, radiusMi, bird: { speciesCode, locId }, show }` after the three numeric range checks (a range failure returns `null`: the alert link is whole-rejected, never degraded, because its head is not a view link and there is no correct partial landing). No match falls through to the existing steps unchanged, so every existing fixture row keeps its verdict. `WidgetLink` gains the optional `point`, `radiusMi` and `show`; `buildWidgetLink` refuses (throws) an alert link whose numbers are out of range, as it already refuses an out-of-pattern bird.

**Degradation at the BUILDERS:** a hit whose `speciesCode` fails `SPECIES_CODE_RE` or whose `locId` is `''` cannot be an alert link; the notification's `userInfo.link` is then the plain view link `snowraven://map/lifers?window=day` (the widget's rule: the view-only landing is always correct), and the inbox row's tap does the same. The Swift builder and the TS builder both refuse identically and the fixture's `links` table pins it.

### 5.3 Delivery: the notification tap

`AlertsNotificationDelegate.didReceive(response)` reads `userInfo["link"]` as a `String`, and calls the Rust callback `open_link(url)` handed over at init (10.2). Rust runs the same `park_link(app, url)` the `RunEvent::Opened` hook runs: `qualifies_as_link` (scheme, at most 512 bytes), park in `PendingLink`, emit the `snowraven-link` poke. From there the shipped path applies unchanged: `linkController` takes the parked URL (cold start: the controller arms the listener first and then takes, which covers a tap that launched the app before the webview was ready; warm: the poke), `parseWidgetLink`, `setPendingLink`, `App.tsx` switches to Map Explorer.

Not chosen: opening the app's own scheme through `UIApplication.open(url)` from the delegate. It would reach the same hook through `scene:openURLContexts:`, but it routes a tap through the system's URL machinery for no gain and is the kind of self-open App Review sometimes questions; and the vendored cold-start forward in `scene.rs` is not on this path at all (a notification launch delivers no `URLContexts`; the delegate is what fires), which is why the delegate calls Rust directly.

### 5.4 Application in Map Explorer (FR-31, FR-37)

The `linkRequest` effect's step 2 gains a branch: when `link.point` is present, skip `getCurrentLocation()`; set `lat` / `lng` from `link.point`, `setDetectedLocation(null)`, `setRadius(link.radiusMi)` (session state, `map-defaults` untouched: FR-31's "saved Default Location and saved Radius shall stay as they were"), `setLiferWindow('day')`, then `handleFindLifers(link.point.lat, link.point.lng, link.radiusMi)`, and `setLinkFocus({ speciesCode, locId, searchId, mode: link.show === 'one' ? 'only' : 'center' })`.

`linkFocus.ts` gains `mode`: `focusLifers` under `'only'` is the shipped behavior (that species alone, the Show all pill); under `'center'` it returns the FULL location list with `target` chosen exactly as today (the `locId` match, else the nearest sighting of that species) so the map pans to the sighting and every lifer stays shown, with no pill. `absent` is unchanged for both modes: every lifer shown and the existing sentence (FR-31's and FR-37's "if the species is no longer reported"). Every clear rule from the widget schema's 4.5 applies to both modes unchanged.

The inbox row tap (webview) calls `acceptLink(buildWidgetLink(alertLinkFor(row, 'one')))` from `linkController.ts` (the lazy section may import it), so a row tap and a notification tap travel one parser and one effect. A second tap on the same row is a new id and re-runs (the shipped rule).

---

## 6. The webview (question 8)

### 6.1 Modules

- **`lib/alerts/alertsState.ts`** (entry-safe; imports only `react`'s `useSyncExternalStore` and `../platform`): `alertsSupported() = isTauri() && isIOS()`; the constants `ALERTS_DIR`, the three file names, `ALERT_DEDUPE_DAYS = 7`, `ALERT_RETENTION_DAYS = 30`, `ALERT_INBOX_MAX_ROWS = 200`, `ALERT_POSITION_MAX_AGE_HOURS = 24`, `ALERT_RADIUS_MIN = 1`, `ALERT_RADIUS_MAX = 25`, `ALERT_RADIUS_DEFAULT = 25`, `ALERT_QUIET_DEFAULT = { startMin: 1320, endMin: 420 }`, `BG_TASK_ID`, `ALERTS_EVENT = 'snowraven-alerts'`; the `AlertsSnapshot` type (10.1); the store (`getAlertsState`, `subscribeAlertsState`, `setAlertsState`, `useAlertsState`) with `INITIAL = { loaded: false, snapshot: null, busy: false, error: null }`; the `AlertsActions` interface, `NOOP_ACTIONS`, the stable delegating `alertsActions` object and `installAlertsActions(actions | null)` (the `icloudState.ts` shape line for line).
- **`lib/alerts/alertsNative.ts`** (lazy; imports `@tauri-apps/api/core` and `@tauri-apps/api/event`): `snapshot()`, `updateSettings(patch)`, `setEnabled(on)`, `clearInbox()`, `purgeInbox()`, `onAlertsChanged(cb)` (= `listen(ALERTS_EVENT, cb)`).
- **`lib/alerts/alertsController.ts`** (lazy): `bootAlertsController()` memoized; on boot: install actions, arm `onAlertsChanged` FIRST, then `snapshot()`; re-snapshot on `document.visibilitychange` to visible; `dispose()` uninstalls. Actions: `setEnabled`, `updateSettings`, `chooseMyLocation()` (6.4), `useMyLocationForFixedPlace()` (6.4), `clearInbox`, `openRow(row)` (5.4). Each action sets `busy`, awaits the command, stores the returned snapshot, clears `busy`, and maps a rejection to `error` (short stable strings; the Designer chooses the sentence).
- **`lib/alerts/alertsPurge.ts`** (lazy): `export async function purgeAlertsInbox(): Promise<void>` = `if (!alertsSupported()) return; await (await import('./alertsNative')).purgeInbox()`; the clear registry's target (section 7).
- **`lib/alerts/alertRules.ts`** (pure TS, off the entry chunk, imported by tests and by the lazy section): the twins the fixture is generated from (`isCandidate`, `dedupe`, `evict`, `isQuiet`, `windowEnd`, `notificationTitle`, `notificationBody`, `alertLinkFor`, `holdUntilFrom`), each a re-statement of section 4 over plain data; it calls the app's own `isNonCountableForm`, `normalizeSpeciesName`, `distanceMiles` and `parseRetryAfterSeconds` rather than copying them, so the TS side of the fixture is the app's rule by construction and only the Swift side is a twin.

### 6.2 Boot

`App.tsx`, after first paint, beside the widget and iCloud boots: `if (alertsSupported()) setTimeout(() => void import('./lib/alerts/alertsController').then(m => m.bootAlertsController()).catch(() => {}), 0)`. On macOS, Windows, web and Pi the gate is false and the `import()` never runs (QA-01, QA-51).

### 6.3 The Settings section

`Settings.tsx` renders `{alertsSupported() && <Suspense fallback={null}><AlertsSection /></Suspense>}` with `const AlertsSection = lazy(() => import('./settings/AlertsSection'))`, placed directly after Default Location (its fixed place defaults to it; the Designer may move it, and `settingsSectionOrder.test.tsx`'s `BELOW_THE_PAIR` list gains `'Alerts'` at whatever position ships; that test mocks `isIOS` true and awaits the lazy section for the iOS case and asserts absence for the others). Gated markup, never hidden markup (FR-01).

The section reads `useAlertsState()` and calls `alertsActions`. Its data contract:

- **Controls, in FR-05's order:** switch (`alertsActions.setEnabled`), Cadence (`RadioGroup`, two values), Quiet hours (`ToggleSwitch` + two `<input type="time">` producing `startMin` / `endMin`; the "must differ" line when equal, FR-34), Measure from (`RadioGroup`; choosing My location runs 6.4), the fixed place controls (three inputs of the Default Location register for lat/lng, `AddressSearch` for the name, the Use my location `Button` running 6.4; a coordinate or Use my location save writes `fixedPlace.name = null`, a search pick writes the display string; a "Follow Default Location" reset writes `fixedPlace: null`), Radius (integer input refusing outside 1..25 at entry, QA-10), the status line (4.7, `aria-live="polite"`), the Inbox.
- **Inbox rows:** from `snapshot.inbox` (already ordered and capped by native); species through `<BirdName>`; place `locName`; `distanceMi` at one decimal; reported as "Today / Yesterday / N days ago" from `daysBetweenRounded(parseObsDateStrict(obsDt), now, tz)` (the widget twin's TS side); alerted time in local time; the empty state; the row is a `Button` whose click is `alertsActions.openRow(row)`; the Clear `Button` opens a `ModalDialog` confirmation before `alertsActions.clearInbox()`. Every DOM id is index-keyed (`sr-alerts-row-<i>`), never from species or place text.
- **Copy:** the FR-06 cadence sentences, the FR-20 network sentence in the widgets' register, the denied sentences with their paths, the FR-16 fixed-place caption. The Designer owns the words; NFR-08 governs them; `alertsCopy.ts` (inside the lazy chunk) holds them so `alertsCopy.test.ts` can scan for U+2014, British spellings and the forbidden cadence words ("every hour", "exactly", a clock time) in one place (QA-05, QA-52).

### 6.4 Permission flows (FR-14, FR-15)

- **Notification permission:** requested by NATIVE inside `alerts_set_enabled(true)` (4.6). The webview never calls a notification API; there is none in its surface.
- **Location permission:** requested only through the app's existing `getCurrentLocation()` (the geolocation plugin's `checkPermissions` then `requestPermissions`), in exactly two actions: `chooseMyLocation()` = `await getCurrentLocation()` then `updateSettings({ model: 'my-location', position: { lat, lng } })` (the seed, 3.3; on a denied or failed read the model is still set and the snapshot's `permissions.location` drives the FR-16 sentence); `useMyLocationForFixedPlace()` = `await getCurrentLocation()` then `updateSettings({ fixedPlace: { lat, lng, name: null } })`. Choosing Fixed place, editing coordinates, searching a name, changing cadence, quiet hours or radius, and every render, perform no location read (QA-07). Nothing in the feature calls `requestAlwaysAuthorization`, `allowsBackgroundLocationUpdates` or `startMonitoringSignificantLocationChanges` (a grep guard over `src-tauri/gen/apple/Sources/**` and `src-tauri/src/**`, QA-14).

### 6.5 Entry chunk (NFR-06)

`entryChunk.test.ts` gains: positive legs `lib/alerts/alertsState.ts` IS on `App.tsx`'s static graph with a closure of at most 3 files and no externals beyond `react` and `@tauri-apps/plugin-os` (through `platform.ts`); negative legs `alertsController.ts`, `alertsNative.ts`, `alertsPurge.ts`, `alertRules.ts`, `components/settings/AlertsSection.tsx`, `alertsCopy.ts`, `AddressSearch.tsx` (already) are NOT; the paired positive legs prove `App.tsx` contains `import('./lib/alerts/alertsController')`, `Settings.tsx` contains `import('./settings/AlertsSection')`, and `clearDerived.ts` contains `import('./alerts/alertsPurge')`; and `clearDerived.ts`'s closure stays exactly one file with zero externals.

---

## 7. The clear registry (question 4)

One row in `TEARDOWNS`:

```
{ slot: 'ebird', store: 'alerts/inbox.json (App Group, native-owned)', purge: async () => (await import('./alerts/alertsPurge')).purgeAlertsInbox() }
```

`purgeAlertsInbox` gates on `alertsSupported()` (a no-op row on every other platform, so `Settings.tsx handleDeleteFile` and both iCloud clear paths keep their `allSettled` loop unchanged) and invokes `alerts_purge_inbox`, which is a message to the actor: bump `generation` (2.4: a check in flight writes nothing), delete `inbox.json` (a `removeItem` with the planted-link check; a missing file is success), set `state.pending = null` and remove `alerts.deferred` (the summary is derived from the file), leave `settings.json` and `state.lastCheck` alone (FR-40: the settings are the user's; the last check's time and outcome are history that the next check overwrites), poke the webview. The row is registered on its KEY SET (CLAUDE.md, v1.0.14): every row exists only because a species was absent from the eBird backup, so the store belongs. Replacing the backup does not run the registry (the synced arrival and the upload both invalidate, never purge), so FR-28's "the row stays as history" holds without a special case.

**`cacheInventory.test.ts` gains a THIRD row class.** The guard today pairs rows by position: the first three contain `storage.deleteSetting(`, the rest contain `function writeThrough(` and `_writeChain`. A native-owned store has neither, because the webview owns no write path to it. The guard is extended, not weakened: `stores` entries gain a `kind` field (`'setting' | 'ordered-writer' | 'native'`); the existing rows keep their assertions under their kinds; the `native` kind asserts the module contains NO `deleteSetting`, NO `writeThrough`, NO `storage.` call, exactly one `invoke('alerts_purge_inbox'` (through `alertsNative.ts`), and the `alertsSupported()` gate before the `import()`; the row count assertion counts all kinds. `clearDerived.test.ts`'s sorted name list gains `purgeAlertsInbox`. The precedent row for the hand-over ("registers NO row") stays as it is: the hand-over is still regenerated, never purged.

---

## 8. Guards and the test plan (question 10)

### 8.1 Extended

| Guard | Extension |
|---|---|
| `lib/entryChunk.test.ts` | Section 6.5's legs |
| `lib/cacheInventory.test.ts`, `lib/clearDerived.test.ts` | Section 7's third class and name |
| `lib/iosWidgetManifest.test.ts` | Unchanged rows; `LINK_MAX_LENGTH` is asserted by `widgetPaths.parity.test.ts`, which is updated to 128 on both sides and gains the alert pattern's text equality |
| `lib/widgets/widgetPaths.parity.test.ts` | `maxLength` 128 in `DeepLink.swift` and `deepLink.ts`; `ALERT_LINK_RE` source text equals `AlertLink.pattern`; the hand-over's two new field names present in `widgetHandover.ts`, `widgets.rs` and `Handover.swift`'s `fieldNames` |
| `lib/links/deepLink.test.ts` | The alert form: valid rows at every bound (lat `-90`, `90`, `0.00001`; lng `-180`, `180`; r `1`, `25`; the shortest and longest instances), whole-rejection rows (r `0`, `26`, `100`; lat `91`; lng `-181`; six decimals; a leading `+`; `show=some`; parameters reordered; a trailing parameter; a fragment; a 129-character string), the round trip `parseWidgetLink(buildWidgetLink(x))` deep-equals `x` over generated points and radii, the existing 15 + bird rows unchanged, the linear-time check re-run with the new pattern against a 128-character adversarial tail |
| `MapExplorer` link tests | The point branch: no `getCurrentLocation` call, `handleFindLifers(point, radius)`, `setRadius(link.radiusMi)`, `map-defaults` not written; `mode: 'center'` pans and shows all pins with no pill; `mode: 'only'` is the shipped behavior; `absent` in both modes |
| `lib/widgets/widgetHandover.test.ts` | The two new fields: contents equal the asset's lists, sorted; the bound; a document that omits them is refused by the TS builder's own validator |
| `widgets.rs` host tests | `HandoverDoc` requires both fields; the per-name rule applies to them; the 1,000-entry bound |
| `settingsSectionOrder.test.tsx` | `'Alerts'` in the iOS order; absent elsewhere |
| `lib/singleWebviewInvariant.test.ts` | Unchanged and green (2.3) |
| `lib/tabOrderCoverage.test.ts` | The section's buttons and rows are `Button`s; the roster is not edited |

### 8.2 New (vitest, CI)

- **`lib/iosAlertsManifest.test.ts`** (pure JS over the three plist sources through `appleManifest.ts`'s readers): `UIBackgroundModes` is exactly `['fetch']` in all three (no `location`, no `remote-notification`: FR-15, and no push); `BGTaskSchedulerPermittedIdentifiers` is exactly `['com.dtgibson.snowraven.alerts.refresh']` in all three and equals `BG_TASK_ID` in `alertsState.ts`, `alerts.rs` and `AlertsScheduler.swift` (one value, four declarations, compared not restated); no `NSLocationAlwaysUsageDescription` / `NSLocationAlwaysAndWhenInUseUsageDescription` key exists in any source; `project.yml`'s app target lists `BackgroundTasks.framework`, `UserNotifications.framework`, `CoreLocation.framework` and the two widget source paths; the extension's plist and entitlements are byte-unchanged from HEAD (a snapshot row, since "no change to the widgets" is a claim); no `aps-environment` entitlement anywhere (local notifications need none; its presence would be a push claim the privacy copy does not make); each row with a one-character mutation check.
- **`lib/alerts/alertsPaths.parity.test.ts`**: the constants of 3.1 and 6.1 across `alertsState.ts`, `alerts.rs`, `AlertsFiles.swift`, `AlertRules.swift` (dedupe 7 d, retention 30 d, 200 rows, 24 h, radius 1/25/25, quiet defaults 1320/420, hourly 3600, daily 86400, the notification identifiers, the event name); the Swift sources under `Sources/snowraven/**` contain none of `requestAlwaysAuthorization`, `requestWhenInUseAuthorization`, `allowsBackgroundLocationUpdates`, `startMonitoringSignificantLocationChanges`, `startUpdatingLocation` (comments stripped first; a guard-the-guard row plants one in a comment); the extension's Swift sources contain none of `alerts/`, `settings.json`, `state.json`, `inbox.json`; `alerts.rs` structs derive no `Debug`.
- **`lib/alerts/alertRules.test.ts`** + **`alertRules.fixtureGen.test.ts`** (env-gated `SR_GEN_ALERT_FIXTURE=1`) + **`alertRules.parity.test.ts`** + **`alertRules.corpus.test.ts`** (section 8.3).
- **`lib/alerts/alertsState.test.ts`**, **`alertsController.test.ts`**: the store, the actions, listener-before-take on boot, re-snapshot on visibility, `busy` and `error`, the two location actions calling `getCurrentLocation` exactly once each and nothing else calling it (QA-07, QA-14), `openRow` producing the `show=one` link (QA-37).
- **`components/settings/AlertsSection.test.tsx`**: FR-05's order (QA-04), defaults (QA-02, QA-05 to QA-08, QA-10), the status sentences over a snapshot table (QA-17, QA-18, the caption, the denied sentences), the network sentence (QA-19), inbox rows and empty state (QA-36), Clear's confirmation (QA-39), labels and state exposure (QA-46), no `id` from content (NFR-07), and `alertsCopy.test.ts` (QA-52, QA-05).
- **`lib/alerts/alertsPurge.test.ts`**: the gate; one invoke; a rejection propagates so `purgeDerivedOnClear` reports the row.

### 8.3 The parity fixture (Swift twin discipline, the widget's pattern)

- **Generated, never hand-written outputs:** `alertRules.fixtureGen.test.ts` runs `alertRules.ts` (the app's own functions, 6.1) over hand-authored INPUTS and writes `frontend/src/lib/alerts/alertRules.fixture.json`; `alertRules.parity.test.ts` reads it back and asserts byte equality (delivery), and the XCTest `AlertRulesParityTests` asserts `AlertsLogic/` reproduces it.
- **Families:** `candidates` (QA-22's row and variants: a recorded subspecies form, a non-ASCII name, an escapee that is NOT recorded and DOES appear, since escapee exclusion is out of scope); `countability` (3.7: every name in both lists, the shape corpus, the parenthetical-` x ` admit case); `dedupe` (QA-23 at T+6d updates, T+8d re-alerts; QA-26 aged-out and cleared; QA-27 a backup now containing C); `evict` (QA-38: row 201, a 31-day row, ties); `quiet` (QA-33's instants, midnight span, equal times, a window end across a DST transition); `merge` (QA-34: 2 + 3 hits become one summary of 5, nearest-first, a species in both checks kept once at the nearer sighting); `notification` (QA-28: 1, 3 and 5 hits; the three phrases; a name over 60 characters kept whole); `links` (5.1's valid and rejected rows; the two builders' degrade rule); `retryAfter` (the `rateLimit.test.ts` table, already twinned; the absent-header 60 s case); `distKm` (1 -> 2, 25 -> 40).
- **Structural rules** (CLAUDE.md's "agreeing wrong number", derived on each runtime from its own builder): the candidate species set of a body equals the app's `buildNearbyLifers(reduced, recordedNames)` species set filtered by `!isNonCountableForm` (the in-app path with the app's own functions; this is the FR-23 claim itself); `candidates(body with a malformed record) == candidates(body without it)` for each malformed family the reducer drops; `evict(rows) == evict(evict(rows))` (idempotence); `merge(a, b) == merge(b, a)` as sets; `parse(build(link)) == link` over generated points and radii; `isQuiet(m, s, e)` for `s == e` is false for every `m` in 0..1439 (the whole domain, not a sample).
- **Corpus:** every single-position edit of one conforming name through both countability twins (both directions asserted empty); every single-position edit of one valid alert link through both parsers' accept/refuse decision (the Swift side has only a builder, so the row is: a string the TS parser accepts is one the Swift builder would produce, checked capture by capture against the patterns).
- **Seam failure rows** (testing.md's seam corollary): the locator gets a `throws` row, a `times out` row and a `returns nil` row and each wants the stored-source fallback with `from` set correctly; the transport gets `rejects`, `429 with header`, `429 without header`, `401`, `500`, `too-large`, `malformed` rows, each with its outcome, no inbox write and (for 429) the hold; the hand-over read gets `absent`, `invalid`, `missing the two lists` rows, each blocked without a request.
- **Honest CI statement:** `ubuntu-latest` cannot compile Swift; the vitest halves run on CI; the XCTest halves run on the release machine through the existing `xcodebuild test -scheme snowraven_widgetsTests` step (the test target gains `Sources/snowraven/AlertsLogic` and the new fixture as a resource, 8.4), before the archive. Every XCTest file carries the header sentence; the vitest row that asserts the header extends to the new files.

### 8.4 Swift XCTest (`snowraven_widgetsTests`, extended)

`AlertRulesParityTests`, `CountabilityTests`, `AlertDocumentsTests` (each document: a valid round trip, a planted extra key refused, each field bound refused, a malformed row dropped and the rest kept, the read-time re-cap), `QuietHoursTests`, `NotificationTextTests`, `AlertLinkTests`, `ResolvePointTests` (the sources, the 24 h limit at 23 h and 25 h, the fallback and `from`), `InboxEvictTests`. `AlertsEngine`'s seam-driven rows (the check with a recording transport, locator, store and clock: exactly one request, no request when held, no location read on the background trigger, the generation discard, the write order) live in `AlertsEngineTests` against protocol fakes, the `RefreshEngine` shape: `AlertsEngine` is an actor over injected seams (`AlertsTransport` = `WidgetTransport`, `AlertsLocator`, `AlertsStoreIO`, `AlertsScheduling`, `AlertsNotifying`, `Clock`), and the UIKit-touching implementations are the thin files in `Alerts/`.

### 8.5 Simulator evidence (NFR-10)

- **A background check:** run the app in the simulator under Xcode, background it, pause in the debugger and evaluate `e -l objc -- (void)[[BGTaskScheduler sharedScheduler] _simulateLaunchForTaskWithIdentifier:@"com.dtgibson.snowraven.alerts.refresh"]`; the handler runs, the check writes, `scheduledEarliest` advances, the status line updates on foreground. Recorded as a screenshot of the status line and a copy of `state.json` in the run record (a screenshot, never a process check, is the scene-manifest rule applied here too).
- **Notification content and tap-through:** a foreground check with a fixture-shaped eBird answer (the transport seam swapped by a debug-only environment flag is NOT added; instead the simulator run uses a real key over a place with real day-old reports, or the Engineer temporarily points `EBirdRequest.host` at a local fixture server in a scratch build that is never committed); the banner's title and body; tap; Map Explorer lands on the point with the sighting centered (QA-30) and, from an inbox row, alone beside Show all (QA-37).
- **Quiet-hour scheduling logic:** with quiet hours covering "now", a foreground check with hits leaves the rows in the inbox and `getPendingNotificationRequests` shows `alerts.deferred` with the window-end calendar trigger (QA-32); a second check merges (QA-34). Delivery at the window end without the app running, real cadence, and locked-phone delivery are the user's device checks (QA-35, QA-53 to QA-55).
- **A cold background launch** cannot be simulated (`_simulateLaunchForTaskWithIdentifier` resumes a suspended app); V1 below is the device check for it.

### 8.6 `.claude/rules/*.md` `paths` to extend in the same change (CLAUDE.md v1.0.32)

- `security.md`: `frontend/src/lib/alerts/**`, `frontend/src/components/settings/AlertsSection.tsx`, `src-tauri/src/alerts.rs`, `src-tauri/gen/apple/Sources/snowraven/**` (today only `WidgetReload.swift` is cited; the directory gains eight files that read untrusted documents, build a URL and post text to the system), `src-tauri/gen/apple/snowraven_widgets/Sources/Logic/EBirdRequest.swift` and `Handover.swift` (already covered by the `snowraven_widgets/**` glob; listed so the reader sees them). Reason: the alert documents, the countability twin over eBird names, the alert link builder and parser, the notification text and the App Group reads are things the rule's bodies govern.
- `testing.md`: `frontend/src/lib/alerts/*.fixture.json`. Reason: the twin-parity fixture rule.

---

## 9. The iOS project (question 1's registrations)

### 9.1 Plist keys (three sources, one guard)

Added, identical, to `src-tauri/Info.ios.plist` (the overlay, the only copy that survives `tauri ios init`), `src-tauri/gen/apple/snowraven_iOS/Info.plist` (what the build reads) and `src-tauri/gen/apple/project.yml` under `targets.snowraven_iOS.info.properties`:

```
UIBackgroundModes: [fetch]
BGTaskSchedulerPermittedIdentifiers: [com.dtgibson.snowraven.alerts.refresh]
```

Nothing else: no `location` background mode (FR-15), no `remote-notification` (no push), no `processing` task (the check is seconds, not minutes), no usage-description key (iOS has none for notifications). Pinned by `iosAlertsManifest.test.ts` (8.2). `iosSceneManifest.test.ts`'s deep-equality row between the overlay and the generated plist keeps holding because both gain the same keys.

### 9.2 `BGTaskScheduler` (`Alerts/AlertsScheduler.swift`)

- **Registration:** `BGTaskScheduler.shared.register(forTaskWithIdentifier: BG_TASK_ID, using: nil) { task in Task { await AlertsEngine.shared.runCheck(.background(task as! BGAppRefreshTask)) } }`, called from `snowraven_alerts_init` (10.2), which the Rust plugin's `setup` calls; plugin setup runs inside `Builder::build`, before `run()` starts `UIApplicationMain`, which is before the app finishes launching, the deadline Apple states for registration. Verify-item V2 confirms registration before `UIApplicationMain` is accepted (it is a process-local table; no `UIApplication` is involved), with the fallback of an ObjC `+load` category in `main.mm`'s translation unit if it is not.
- **The handler:** sets `task.expirationHandler` to cancel the in-flight `URLSessionTask` and mark the check discarded (2.4); runs the check; `setTaskCompleted(success: outcome != .discarded)`.
- **Submission** (`schedule(after completedAt: Date?, cadence:)`): `BGAppRefreshTaskRequest(identifier: BG_TASK_ID)` with `earliestBeginDate = (completedAt ?? now) + interval(cadence)`; `submit` errors (`.unavailable` when Background App Refresh is off, `.tooManyPendingTaskRequests`, `.notPermitted`) are recorded in `state.backgroundRefresh` / dropped, never thrown to the user; called after every completed check, on enable, and on a cadence change (which first `cancel(taskRequestWithIdentifier:)`s). The schedule is a REQUEST; iOS decides the time (FR-06's copy is written to that truth).
- **Cancel** on disable: `cancel(taskRequestWithIdentifier: BG_TASK_ID)`.

### 9.3 `project.yml`

```yaml
targets:
  snowraven_iOS:
    sources:
      # existing entries unchanged, plus:
      - path: snowraven_widgets/Sources/Logic
      - path: snowraven_widgets/Sources/Widget/EBirdClient.swift
    dependencies:
      # existing entries unchanged, plus:
      - sdk: BackgroundTasks.framework
      - sdk: UserNotifications.framework
      - sdk: CoreLocation.framework
    info:
      properties:
        # existing properties unchanged, plus:
        UIBackgroundModes: [fetch]
        BGTaskSchedulerPermittedIdentifiers: [com.dtgibson.snowraven.alerts.refresh]
  snowraven_widgetsTests:
    sources:
      # existing entries unchanged, plus:
      - path: Sources/snowraven/AlertsLogic
      - path: ../../../frontend/src/lib/alerts/alertRules.fixture.json
        buildPhase: resources
```

The app target's `- path: Sources` already sweeps `Sources/snowraven/Alerts/` and `AlertsLogic/` in. The extension target is untouched. After editing, `xcodegen generate` and commit the regenerated `.xcodeproj` (verify-item V3: Xcode accepts the same Swift files in three targets, which it already does for `Logic/` in two).

### 9.4 Entitlements

None added. The App Group entitlement is already on the app; local notifications need no entitlement; `BGTaskScheduler` needs the plist keys only. The absence of `aps-environment` is asserted (8.2) because a push entitlement would contradict the privacy copy.

---

## 10. Rust plumbing (question 9)

### 10.1 `src-tauri/src/alerts.rs` (compiled under `#[cfg(any(target_os = "ios", test))]`, registered under `#[cfg(target_os = "ios")]`)

```
const ALERTS_EVENT: &str = "snowraven-alerts";
const BG_TASK_ID: &str = "com.dtgibson.snowraven.alerts.refresh";   // pinned to the plists and to Swift by the guard
const CALL_MAX_BYTES: usize = 65_536;                                 // a settings patch is under 1 KB; the bound is a shape bound

#[tauri::command] async fn alerts_snapshot() -> Result<String, String>                   // op "snapshot"
#[tauri::command] async fn alerts_update_settings(patch: String) -> Result<String, String> // op "update"; patch is a JSON object of any subset of
                                                                                          // AlertsSettingsV1's fields plus optional `position` (the seed)
#[tauri::command] async fn alerts_set_enabled(enabled: bool) -> Result<String, String>    // op "enable" / "disable"
#[tauri::command] async fn alerts_clear_inbox() -> Result<String, String>                 // op "clear"
#[tauri::command] async fn alerts_purge_inbox() -> Result<(), String>                     // op "purge" (the clear registry)
```

Each command is `async` (so the blocking bridge below runs on Tauri's command pool, never the main thread), bounds the payload at `CALL_MAX_BYTES`, calls `snowraven_alerts_call(op, payload)` and returns the JSON the Swift side produced (`{ "ok": true, "snapshot": AlertsSnapshot }` or `{ "ok": false, "error": "<short stable string>" }`), freeing the C string through `snowraven_alerts_free`. The Rust side does no JSON interpretation beyond the envelope; the snapshot is opaque bytes to it. No struct in this module holds a document, so the no-`Debug` rule is satisfied by there being nothing to derive it on; the guard asserts it anyway.

`AlertsSnapshot` (what the webview receives; the store's `snapshot` field):

```
{ settings: AlertsSettingsV1, state: AlertsStateV1, inbox: InboxRow[],
  blocked: 'no-key' | 'no-backup' | 'no-place' | 'location-off' | 'no-position' | null,
  permissions: { notifications: 'not-determined' | 'granted' | 'denied'; location: 'not-determined' | 'granted' | 'denied' | 'restricted' },
  now: string }
```

### 10.2 The C surface (three symbols in, two callbacks out)

```
extern "C" {
    fn snowraven_alerts_init(changed: extern "C" fn(), open_link: extern "C" fn(*const c_char));
    fn snowraven_alerts_call(op: *const c_char, payload: *const c_char) -> *mut c_char;
    fn snowraven_alerts_free(p: *mut c_char);
}
#[no_mangle] extern "C" fn snowraven_alerts_changed_cb()                      // emit_to("main", ALERTS_EVENT, ()) through the OnceLock<AppHandle>; a poke with no payload
#[no_mangle] extern "C" fn snowraven_alerts_open_link_cb(url: *const c_char)  // CStr -> str; widgets::park_link(app, url) (the one validator: scheme + 512 bytes)
```

`pub fn plugin() -> TauriPlugin` named `"snowraven-alerts"` with `setup` only: store the `AppHandle` in a `OnceLock`, then `unsafe { snowraven_alerts_init(changed_cb, open_link_cb) }`. No `on_event` (2.3). Function pointers rather than a bridging header: Swift's `@_cdecl` entry points take `@convention(c)` closures, so the Swift side needs no header to call back into Rust and `project.yml` gains no `SWIFT_OBJC_BRIDGING_HEADER`.

The Swift `@_cdecl("snowraven_alerts_call")` implementation parses `op`, runs the actor through a `DispatchSemaphore` over a `Task` (legal because the caller is never the main thread; asserted with `dispatchPrecondition(condition: .notOnQueue(.main))` in debug builds), serializes the envelope with `JSONEncoder`, and returns `strdup`. `snowraven_alerts_free` is `free`.

### 10.3 `build.rs`

Three more `cargo:rustc-cdylib-link-arg=-Wl,-U,_snowraven_alerts_init` / `_snowraven_alerts_call` / `_snowraven_alerts_free` lines beside the existing one, same comment, same reason (the iOS cdylib link; the staticlib Xcode links resolves them from the app target's Swift objects).

### 10.4 Capabilities

No change to `capabilities/*.json`. App commands registered through `generate_handler!` are not permission-gated (the widget schema's 2.5); the `snowraven-alerts` event is received through `core:event:default` under `core:default`, which `main` already has; all three files stay `windows: ["main"]`. The `fs` grant stays `$APPLOCALDATA/**`, which is what keeps the alert documents out of the webview's reach (3.1).

### 10.5 Cargo

No new crate. `alerts.rs` uses `std::ffi`, `serde_json` (already a dependency) and Tauri's `Emitter`. The C symbols resolve at the Xcode link. `objc2-core-location` stays macOS-only (CLAUDE.md's cfg rule: the iOS location work is in Swift, so the crate is not real on iOS and does not move).

---

## 11. The Swift files (app target)

```
src-tauri/gen/apple/Sources/snowraven/
  WidgetReload.swift                     unchanged
  AlertsLogic/                           PURE Swift, imports Foundation only (plus Logic/ types); compiled into the test target
    AlertsFiles.swift                    dir and file names, byte bounds, temp suffix (pinned by the parity guard)
    AlertRules.swift                     the named constants (3.4, 4.1, 4.3, 5.1) and interval(cadence)
    AlertsSettings.swift                 AlertsSettingsV1 Codable + fieldNames + validate() + defaults + apply(patch:)
    AlertsState.swift                    AlertsStateV1, PendingHit, PlacePhrase; validate(); the fresh-install value
    AlertsInbox.swift                    InboxRow, AlertsInboxV1; per-row validate; evict(rows, now); sort; dedupeAndMerge(candidates, rows, now)
    Countability.swift                   isNonCountableForm (3.7)
    Candidates.swift                     candidates(reduced, handover, point) -> [Hit] (4.5 steps 1 to 3 and 5)
    QuietHours.swift                     isQuiet, windowEnd (4.6)
    NotificationText.swift               title, body, phrase (4.6)
    AlertLink.swift                      pattern (text-pinned), build(hit, point, radius, show) with the degrade rule (5.1, 5.2)
    ResolvePoint.swift                   resolvePoint / resolveBlocked (4.3, 4.7)
    AlertsEngine.swift                   actor over the seam protocols: runCheck, enable, disable, update, clear, purge, snapshot, appActivated
  Alerts/                                the seams; UIKit, BackgroundTasks, UserNotifications, CoreLocation
    AlertsBridge.swift                   the three @_cdecl entry points, the callback storage, the op dispatch, the semaphore bridge (10.2)
    AlertsStoreIO.swift                  the App Group alerts/ directory, BoundedFile reads, temp-then-rename writes, the hand-over and widget-cache reads
    AlertsScheduler.swift                BGTaskScheduler register / submit / cancel (9.2)
    AlertsNotifier.swift                 UNUserNotificationCenter: authorization status and request, add, removePending, getPending; the delegate (willPresent, didReceive)
    AlertsLocator.swift                  the one-shot CLLocationManager read that never requests authorization (4.2); authorizationStatus for the snapshot
    AlertsLifecycle.swift                the didBecomeActive observer; applicationState for the poke gate (2.5); backgroundRefreshStatus
```

The `AlertsLogic/` versus `Alerts/` split is the same boundary the widget drew between `Logic/` and `Widget/`: everything that touches untrusted bytes (the documents, the hand-over, the widget cache, eBird's body, the names that reach a notification) is pure and tested without a device.

---

## 12. Published copy inputs (FR-45; HELD, nothing lands without the user's yes)

Factual statements the held proposals must be able to make truthfully, given this design:

- **What is sent, and to whom:** with alerts on, the app sends the chosen coordinates and radius to eBird with the user's own key, the same nearby-sightings request Nearby Lifers and the widgets make, about hourly or about daily when iOS runs the check and when the app is opened after that interval; nothing is sent to the developer; there is no push server and no notification service (notifications are created on the device).
- **Location:** "the app itself uses your location only while you're using it" stays true. Under My location a background check measures from the most recent position the app read while it was open or a widget refresh recorded, never from a new read while the app is closed; the app never asks for Always authorization. Under Fixed place no position is used at all.
- **What is stored, where:** the alert settings, the last check's outcome, the most recent known position (under My location only), and the inbox (species, place, distance, times) are stored on the device in the app's shared container beside the widgets' data, are included in device backups like the rest of the app's data, are never synced through iCloud Sync, are cleared with the eBird backup, and are removed with the app.
- **Background App Refresh:** the feature relies on it; turning it off for SnowRaven stops background checks (checks still run when the app is opened).
- **App Store:** the "Data Not Collected" privacy label stays true (nothing leaves the device except the eBird request already declared); the compliance record notes the `fetch` background mode and its purpose; What's New names the feature and its opt-in nature; the review notes (written in-build) explain that the background mode fetches eBird reports for an opt-in alert and that notifications are local.
- **Purpose string (a held candidate, default unchanged):** `NSLocationWhenInUseUsageDescription` today names the map and the widgets. Alerts under My location reuse the same grant with no new prompt, so App Review does not require a change; if the user prefers the string to name alerts too, that is a one-clause proposal (f) beside the others, shown in full first.

---

## 13. Declared scans over untrusted text (security.md: declared up front, with the linearity argument)

| Scan | Input | Bound | Linearity |
|---|---|---|---|
| `parseWidgetLink` (TS), the alert step | a URL string from native (a notification tap, ultimately whatever process posted a `snowraven://` URL; or the inbox row's own build) | `length <= 128` first | one anchored regex with fixed classes, bounded quantifiers, a two-word alternation and no nesting, then three `Number()` range checks: O(n), n <= 128 |
| `AlertLink.build` (Swift) | `speciesCode` and `locId` from eBird's reduced record (512-unit caps) | the two anchored patterns | `NSRegularExpression`, anchored, fixed classes, bounded: linear; a failure degrades to the view link |
| `Countability.isNonCountableForm` (Swift) and the TS original | eBird `comName`, 512 units | two set lookups (hashing, O(n) in the name), `hasSuffix`, `contains("/")`, `stripTrailingParenthetical` (three index scans) then `contains(" x ")` | linear, no backtracking |
| The three document validators (Swift) | the alert documents (self-authored, untrusted at the file-type level: security.md v1.0.11) | file size <= the 3.1 bound before the read | one `JSONDecoder` pass, then one linear pass over rows and strings |
| `HandoverDecoder` (Swift, reused) | the hand-over | 4,000,000 bytes | unchanged; the two new arrays add one linear pass at most 1,000 entries each |
| `WidgetCache` decode (Swift, reused) | the extension's document | 8,000,000 bytes | unchanged |
| `RecentObsReducer` (Swift, reused) | eBird's body | 2,000,000 bytes | unchanged |
| `NotificationText` | `comName` (512) and `fixedPlace.name` (120) | the bounds above | string concatenation; nothing interprets the text; the system renders it as plain text |
| `alerts_update_settings` (Rust then Swift) | a JSON patch from the app's own webview | `CALL_MAX_BYTES = 65,536` before the bridge | one parse; the Swift validator applies the 3.2 bounds field by field |
| The `open_link` callback (Rust) | a C string from Swift, carrying the notification's `userInfo.link` | `qualifies_as_link`: scheme and 512 bytes | O(n) in the URL length |
| `Candidates.candidates` (Swift) and `alertCandidates` (TS) (added at the security review, I7) | eBird's reduced records: code, name and location id (512-unit caps), coordinates, date | the reducer's 20,000-record cap and the 512-unit field caps | per record: the row-shape gate (`isAlertable` / `isAlertableRecord`: two byte or regex checks with bounded classes and one code-unit pass over the name), one Set lookup of the folded name, the countability rule above, and one Dictionary/Map read and write keyed on the code; then one sort of at most one hit per species: O(n) plus O(k log k), no nested scan |
| `AlertsInbox.applyCandidates` (Swift) and `applyCandidates` (TS) (I7) | the loaded inbox (at most 200 rows) and one check's hits | 200 rows; hits bounded as above | one pass over the rows building a Dictionary/Map of each code's newest row, one pass over the hits reading it (no `indexOf`/`contains` scan per hit), then `evict`: one filter and one sort of at most 200 + k rows |
| `QuietHours.mergePending` (Swift) and `mergePending` (TS) (I7) | the deferred summary (at most 200 hits) and one check's hits | `pendingMax` = 200 hits and check ids | one pass putting the summary's hits in a Dictionary/Map keyed on the code, one pass over the new hits reading and writing it (the nearer hit wins), one sort, then caps at 200 hits and 200 check ids: O(n log n) in at most 200 + k items, no nested scan |

Nothing from a notification reaches the UI except through the parser above and the existing link effect, which sets typed state and runs the app's own search; the species and place names the map shows come from the fresh eBird result, not from the notification.

---

## 14. Migration plan (ordered steps for The Engineer)

1. **Pure Swift first, with its tests:** `AlertsLogic/` (section 11) against protocol fakes; add `Sources/snowraven/AlertsLogic` to `snowraven_widgetsTests` in `project.yml`; `xcodegen generate`; `xcodebuild test` through the shim. The fixture does not exist yet at this step; the XCTest parity file is written to read it and skipped until step 3 generates it (a skip that names the step, not a silent pass).
2. **Hand-over fields:** `speciesUtils.ts` exports the two raw lists; `widgetHandover.ts` writes them; `widgets.rs` validates them; `Handover.swift` decodes them (optional) and extends `fieldNames`; `EBirdRequest.swift` gains its two parameters. All existing widget tests and fixtures green.
3. **TS twins and the fixture:** `lib/alerts/alertRules.ts`, the generator, generate `alertRules.fixture.json`, the parity, corpus and structural tests; then the XCTest parity file runs (step 1's skip lifts).
4. **The link:** `deepLink.ts` (the alert step, 128), `DeepLink.swift` (`maxLength` 128), `AlertLink.swift`; `deepLink.test.ts` and `widgetPaths.parity.test.ts` extended; `linkFocus.ts` `mode`; the `MapExplorer` branch and its tests.
5. **Rust:** `widgets.rs` `park_link` extraction (behavior-preserving, host tests green); `alerts.rs`; `lib.rs` registrations; `build.rs`; `cargo check` for `aarch64-apple-darwin` and `aarch64-apple-ios` through the shim and (via CI) Windows.
6. **The seams:** `Alerts/` (section 11), `project.yml` app-target sources, frameworks and plist keys; `Info.ios.plist` and the generated `Info.plist` keys; `iosAlertsManifest.test.ts`; `alertsPaths.parity.test.ts`; `xcodegen generate`; a debug `tauri ios build` and a SCREENSHOT of the launched app (the scene-manifest rule: the plist sources are touched).
7. **The webview:** `lib/alerts/` modules with their tests; `entryChunk.test.ts` legs; the clear-registry row and the guard's third class; `App.tsx` boot; `Settings.tsx` lazy section; `AlertsSection.tsx` per The Designer's Stage 4 spec with `alertsCopy.ts`; `settingsSectionOrder.test.tsx`.
8. **Simulator evidence** (8.5) recorded in the run record; the debugger-triggered background check, a foreground check's banner, the two tap-throughs, the deferred request under quiet hours.
9. **Rules and prose:** `security.md` / `testing.md` `paths` (8.6); `docs/HELP.md` Alerts subsection (FR-44; the Widgets subsection byte-identical); `appstore/REVIEW_NOTES.md`; `CHANGELOG.md`; the four-file set to 1.0.41; `pipeline/ios-alerts/held-copy/` (FR-45, section 12) prepared and NOT applied.
10. **Ship** per the release skill: `xcodebuild test` before the archive; `--validate-app`; the user's device check of the exact uploaded build covers V1, QA-35, QA-53 to QA-55 before any App Store record.

`npm run build` and `npm run typecheck` before every push; the full frontend suite green; the backend suite untouched but run.

---

## 15. Design decisions

1. **Native Swift in the app target, one actor, the webview a client** (sections 1 and 2). Decided by a tao fact checked in the vendored source, not by preference: a background launch parks tao in `Launching` and never boots the webview.
2. **The alert documents live in the App Group container, outside the webview's `fs` grant, with one writer** (3.1, 2.1). The single-owner claim rests on a grant and a process model, not on discipline; the JS single-webview invariant is neither relied on nor weakened.
3. **Dedupe is the inbox, not a second store** (3.4). FR-24 and FR-27 define the seven-day rule against what the app still holds; a separate ledger would have to be kept in step with Clear, aging and the backup clear, and the inbox already is.
4. **The countability data rides the hand-over; only the three-clause shape rule is twinned** (3.6, 3.7). The alternative was 17,891 names in Swift for a rule three lines long.
5. **The position has two read-only sources and one app-owned record** (4.3): the app's own fix and the widget's cell, newest wins, 24 h limit; the widget's document is never written by the app and its rounding cost is stated.
6. **The alert link carries the point and radius as two bounded decimals with a range check** (5.1), because the check's point is not the user's current position and is not otherwise reachable by the parser; the widget's id-only rule stays for widget links.
7. **The notification tap calls Rust directly and rides the shipped link path** (5.3): one validator (`park_link`), one parser, one Map Explorer effect for widget taps, notification taps and inbox rows.
8. **Quiet hours are one replaceable calendar-triggered request** (4.6): the identifier is the merge mechanism, the window end is fixed by the first deferred hit, and delivery needs no app.
9. **The 429 hold is `Retry-After` bounded at 60 s, or 60 s when absent** (4.4), persisted in `state.holdUntil`; strictly slower than the app's gate, so contract-compliant without sharing its state; the next scheduled check is at least an hour away anyway.
10. **`unreachable` is one outcome value with one sentence** (4.4, 4.7), so FR-19's closed sentence set can grow by one word change if the Designer wants it.
11. **A third clear-registry row class, `native`, with its own assertions** (7), rather than bending the ordered-writer class around a store that has no JS write path.
12. **Function pointers over a bridging header** (10.2): no new build setting, no header file, and the Swift side stays a plain `@_cdecl` set like `WidgetReload.swift`.
13. **No new crate, no capability change, no entitlement change, no widget behavior change** (9.4, 10.4, 10.5); the one widget file that changes in meaning (`Handover.swift`) changes by two optional fields.
14. **Patch bump** (1.0.41), CLAUDE.md's default.

---

## 16. Risks, verify-items and flags

**Verify-items (the Engineer records the result; the user performs V1 on a device):**

- **V1 (user device check):** a COLD background launch by `BGTaskScheduler` runs the check and completes without the webview and without a crash under the release profile; then a normal tap launches the app with its UI intact (tao's queued window is made key by the first scene). Nothing in the simulator can produce this launch. If tao's parked `Launching` state misbehaves in a cold background launch, the fallback is to detect the background launch in `snowraven_alerts_init` (`UIApplication.shared.applicationState` is unavailable that early; the `launchOptions` are not exposed by tao) by the absence of a scene after the handler fires, which changes nothing in this design's data layer.
- **V2:** `BGTaskScheduler.register` called before `UIApplicationMain` (from plugin setup) is honored; fallback: an ObjC `+load` category compiled into the app target.
- **V3:** XcodeGen and Xcode accept `Logic/` and `EBirdClient.swift` in the app target beside the extension and the test target; no duplicate-symbol or module issue with `WidgetReload.swift`'s existing Swift.
- **V4:** a foreground check's `snowraven-alerts` poke is delivered and a background check's is skipped (2.5); `emit_to` from the command pool during an active session neither panics nor blocks.
- **V5:** `willPresent` shows a foreground check's banner (FR-32) on a device; if iOS suppresses banners for the foreground app in some Focus mode, the inbox is still written and the limit is stated in the help.
- **V6:** `UNCalendarNotificationTrigger` at the window end delivers on a locked phone with the app not running (QA-35, user check); if a device shows the trigger firing late by more than a minute, that is iOS coalescing and the help's "at the end of the quiet window" wording is softened to "when the quiet window ends" only if the user asks.
- **V7:** `--validate-app` accepts `UIBackgroundModes: [fetch]` with the existing profile (no capability change is expected; the App ID needs no new capability for background fetch).

**Risks:**

- **Background refresh is opportunistic.** A device with Background App Refresh off, Low Power Mode on, or a user who rarely opens the app will see checks mostly at app open. The copy is written to that truth (FR-06) and `state.backgroundRefresh` lets the section say when the system setting is the cause.
- **The 30 s task budget** is shared by the request (up to 20 s) and the file work (milliseconds). A slow network that times out at 20 s leaves 10 s; the expiration handler covers the rest. If measurement on a device shows expirations, the background trigger passes a 15 s `timeoutInterval` through `EBirdRequest.make` (a third defaulted parameter) rather than changing the client.
- **The widget cell as a position source** couples the check to `WidgetCache`'s version-1 shape. A future widget version that changes its cache shape leaves the alerts check with one source (the app's own fix) until this reader is updated; the failure is silent by design (no second source, not an error), and the reader's test carries a row for a cache the validator refuses.
- **App Review** may ask why an app whose policy says it uses location only while in use declares a background mode. The answer is in the review notes: the mode is `fetch`, not `location`; the check measures from a fixed place or a position the app recorded while in use; no location read happens in the background. Written in-build, held copy for the listing.

**Flags for the Orchestrator (decisions to surface, none blocking):**

1. **FR-19's sentence for an eBird server error** (4.7): the design keeps `unreachable` under "offline"; a sixth sentence is a Designer choice.
2. **The location purpose string** (12): unchanged by default; a one-clause held proposal (f) is offered.
3. **The hand-over gains two fields and `Handover.swift` gains two optional decodes** (3.6): within the PRD's "what the check needs to read"; stated so the Chronicler records it as the one widget-file change and not as a widget change.
