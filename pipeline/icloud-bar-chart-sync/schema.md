# Schema: iCloud Bar-Chart Sync

**Feature:** icloud-bar-chart-sync
**Date:** 2026-09-28
**Stage:** 3, The Architect (hands-off Spool spin, build 1 of 5 on `weft-spool/20260928-060600`: the path is declared here and proceeded on)
**Source:** prd.md (39 FRs, 6 NFRs, 37 QA rows, 7 open questions), strategic-brief.md
**Extends:** `pipeline/targets-tab/schema.md` (the bar-chart file family, the day cache, `regionCode.ts`, `barChartFilesChanged.ts`), `pipeline/icloud-api-key-sync/schema.md` (the cumulative iCloud container and `icloud-sync` preference), `pipeline/icloud-sync/schema.md` (the record format, the reconciliation table, the native posture)
**Ships as:** one patch bump across the four-file set; `main` is at 1.0.39, so this is **1.0.40** unless another bundle build lands first. The Engineer reads the number off `main` at rebase time.

Nothing in this document proposes wording for any user-facing string. Copy is named by purpose only; The Designer drafts it and the user approves it before The Engineer writes it (CLAUDE.md, user direction 2026-09-27; PRD FR-34).

## Path

Incremental (extending the existing data layer: the iCloud container's item set, the shared record format, the `icloud-sync` preference, the bar-chart manifest, the storage seam, the native command surface, and the day cache module).

## Architect assessment

> **Architect assessment: Incremental**
>
> SnowRaven has no database. Its data layer is the set of documents under `AppLocalData/data/`, the iCloud container's records and files, the `icloud-sync` preference, the epoch modules and the pure `lib/` modules that reconcile them; three prior `schema.md` files document all of it, and this feature adds a synced kind to the container, extends the manifest and the preference, adds native commands and generalizes the record validator. Nothing is greenfield and nothing is UI-only. Proceeding on this assessment per the hands-off run.

**Five findings from reading the code change what the PRD assumed, each settled below rather than deferred:**

1. **The PRD's one-merged-copy day cache does not converge.** FR-24/FR-25 have every device merge the shared copy into its own, apply its local budget, and upload when the checksum changed. Once the union of two devices' answers exceeds one device's budget (measured: ~10 busy counties, `DAY_OBS_MAX_BYTES`), device A's upload drops entries B holds, B's merge restores them and re-uploads, and the two exchange a ~10 MB write every check forever. The day cache therefore syncs as **per-device snapshots merged on read**: each device writes only its own snapshot, nothing writes a merged copy back, and the fixed point is reached in at most two checks per device (section 8). FR-24, FR-25, QA-21 and QA-22 are read against that shape; flagged in the hand-back.
2. **"Replaced" is not a slot state.** The eighth `SlotState` in `icloudState.ts:22-30` is `'off'`; the replaced line is the `replacedAt` field on `SlotView`. FR-15's list is read as the eight shipped states plus `replacedAt` (section 5.6).
3. **File records get no write-side time check today.** `isWritableTime` / `valid_time_text` run only on key entries (`icloudSync.ts:781`, `icloud.rs:661`). FR-04's "the writer's time check" is applied to the county push in this feature (section 5.4); the two data-file pushes are left as they are (out of scope, stated).
4. **The 200 MB sync bound and the 50 MiB add-time cap are unrelated in code.** `MAX_BYTES = 200_000_000` (`icloudRecord.ts`, `icloud.rs:85`, decimal) and `MAX_UPLOAD_BYTES = 50 * 1024 * 1024 = 52,428,800` (`uploadGuard.ts:39`, binary). FR-30 is satisfied by importing both and asserting `MAX_BYTES >= MAX_UPLOAD_BYTES` (section 10); no constant moves.
5. **The container has no listing today, and a county set needs one.** The two slots are read by fixed name; a device learns of a county it has never seen only by enumerating the container, so one native listing command per kind replaces per-county record reads (NFR-02's "one record read per county" becomes one IPC call that performs N bounded reads, section 9.2).

---

## Existing data model used by this feature (unchanged unless a section below says so)

| Existing structure | Where | How this feature uses it |
|---|---|---|
| iCloud container `iCloud.com.dtgibson.snowraven`, `Documents/` | `icloud.rs:80`, `container_documents()` `:360-383` | Gains two subdirectories (section 3). The four slot names, `keys.record.json` and `.tmp/` are untouched |
| `SharedFileRecord` / `SharedClearedRecord`, `validateSharedRecord`, `serializeRecord`, the bounds (`MAX_RECORD_TEXT = 4096`, `MAX_BYTES = 200_000_000`, `MAX_LABEL = 64`, `MAX_FILENAME = 255`, `MIN_TIME`, `MAX_FUTURE_MS`, `DEVICE_ID_RE`, `SHA256_RE`) | `icloudRecord.ts:14-56, 177-247` | Generalized by one optional discriminator field (section 4.2); every bound reused unchanged |
| `reconcileSlot(input): SlotDecision` | `icloudReconcile.ts:59-94` | **Reused verbatim per county** (section 5.1). It reads only `local.uploadedAt`, `local.originId`, `shared.state`, `shared.uploadedAt` / `clearedAt`, `shared.origin.deviceId`, `file.downloaded`, `deviceId` |
| `Slot = 'ebird' \| 'ml'`, `SLOTS` | `icloudRecord.ts:14, 44`; Rust `enum Slot { Ebird, Ml }` `icloud.rs:129-134` | **Unchanged.** The bar-chart family is not a third slot (targets-tab schema §1.1 still holds); a `RecordKind` and a native `SyncItem` wrap the slot instead (sections 4.2, 9.1) |
| `ICloudSyncPref` (`icloud-sync` in `settings.json`), `normalizePref`, `savePref` | `icloudSync.ts:59-107, 159-210` | Gains three optional fields, `version` stays 1 (section 7) |
| `icloud_status`, `icloud_read_record`, `icloud_push`, `icloud_push_cleared`, `icloud_pull`, `icloud_start_download`, `icloud_remove_all`, `icloud_watch`, the three key commands | `icloud.rs:1046-1448`, `icloudNative.ts:43-59` | The seven slot commands keep their signatures and behaviour; `icloud_remove_all` widens (section 9.4); seven new item commands beside them (section 9.3) |
| `record_text_at` / `read_record_text` (regular-file check, `MAX_RECORD_BYTES = 16 * 1024`, empty string for an unreadable shape), `atomic_container_write`, `coordinated_delete`, `remove_planted_item`, `ubiquity_flags`, `sha256_hex`, `sanitize_label`, `sanitize_filename`, `valid_device_id`, `blocking` / `COMMAND_TIMEOUT = 8 s` | `icloud.rs` | Reused as-is by every new command (FR-31) |
| The change watcher: `NSMetadataQueryUbiquitousDocumentsScope`, predicate `%K LIKE '*.record.json'` | `icloud.rs:1380-1430` | Already matches any record name anywhere in the documents scope (it matches `keys.record.json` today, though two comments still say "the two tiny record files"). County and day-obs records match it by construction; verify-item V1 confirms the scope reaches a subdirectory |
| `runCheck` (one in-flight check, one queued follow-up, `CHECK_DEADLINE_MS = 10_000`, `CHECK_DOWNLOAD_WAIT_MS = 5_000`, `DOWNLOAD_NOW_WAIT_MS = 90_000`), `requestCheck`, `startWatching`, the `selfNotifying` guard, `pendingClears` handling at `:1046-1063`, `clearWithSync` `:1311-1333`, `removeFromICloud` `:1293-1305`, `disable` `:1245-1265` | `icloudSync.ts` | The county pass and the day-obs pass are added inside the same check, after the file pass and before the key pass (section 5.3); the pending-clear shape is copied per county (section 5.5) |
| `ICloudState`, `SlotView`, `SlotState` (eight states), `icloudActions` / `installICloudActions` | `icloudState.ts` | Gains `barCharts`, `sharedCountyCodes`, and five actions (section 5.6) |
| `data/barcharts.json` (`BarChartFilesStatus { version: 1; counties }`, `BarChartFileMeta { filename; uploadedAt }`), `normalizeBarChartManifest`, `BARCHARTS_META_PATH`, `BARCHARTS_DIR`, `barChartFilePath`, the four seam methods, the `BARCHARTS_META_PATH` chain key | `storage.ts:102-153, 240-247, 574-576, 1105-1179` | Manifest entries gain two optional fields; four seam methods are added and one gains an optional argument (section 6) |
| `backend/routers/barcharts.py` (`GET/POST/DELETE /settings/barcharts/{regionCode}`, `_META_LOCK`, `_write_manifest` atomic) | web/Pi | One bulk route added (section 6.4); nothing else changes there |
| `lib/regionCode.ts` `REGION_CODE_RE = /^US-[A-Z]{2}-[0-9]{3}$/`, `isRegionCode` | dependency-free, entry-safe | The one predicate; gains a Rust twin and a shared fixture (section 4.4) |
| `lib/barChartFilesChanged.ts`, `useBarChartFilesEpoch` | entry-safe | Bumped by every synced arrival, replacement and removal (FR-06); the controller subscribes to it (section 5.7). Its header comment ("it is never synced") is corrected |
| `lib/barChart/barChartImport.ts` (`importBarChartFile`, `removeBarChartFile`) | lazy | `importBarChartFile` passes an origin; `clearAllBarChartFiles` is added beside them (section 6.3) |
| `lib/countyDayObsCache.ts` (`DayObsStore v2`, `DayObsEntry`, `DayRecord`, `validEntry`, `isValidDayRecord`, `putEntry`, `evict`, `_writeChain` / `writeThrough`, `_purgeGeneration`, `DAY_OBS_MAX_ENTRIES = 3_000`, `DAY_OBS_MAX_BYTES = 10_000_000`), `COUNTY_DAY_OBS_PATH = 'data/county-day-obs.json'` | own document, own writer | Gains one merge entry point and one drain helper (section 8.3); the document format is unchanged |
| `lib/clearDerived.ts` `TEARDOWNS` | the clear registry | **No row added** for the bar-chart family (FR-14, section 6.6); the day cache's row is unchanged |
| `lib/uploadGuard.ts` `MAX_UPLOAD_BYTES` | the add-time cap | Imported by the FR-30 guard only |
| `docChains` (`API_KEYS_PATH`, `SETTINGS_PATH`, `META_PATH`, `BARCHARTS_META_PATH`) | `storage.ts:750-757` | The new manifest links join the existing `BARCHARTS_META_PATH` key. No new key. ROADMAP's "re-home `docChains` on a `Map`" note is still owed and still deferred: the key set stays closed |
| `components/ui/ModalDialog.tsx` | the shared modal shell | Both new confirmations (NFR-03) |

---

## Changes in this feature

### Added

1. **Two container subdirectories**: `Documents/barcharts/` (one `.txt` and one `.record.json` per county) and `Documents/day-obs/` (one `.json` and one `.record.json` per device), section 3.
2. **`RecordKind`** and the optional `county` discriminator on the shared record; `validateCountyRecord` and `validateDayObsRecord` beside `validateSharedRecord`, section 4.2.
3. **The Rust region-code twin** `County::parse` and the shared fixture `lib/regionCode.fixture.json`, section 4.4.
4. **Native**: `enum SyncItem`, seven item commands, the listing bound `MAX_LISTED_ITEMS`, the day-obs per-file bound `DAY_OBS_SHARED_MAX_BYTES`, section 9.
5. **Storage seam**: `applySyncedBarChartFile`, `applySyncedBarChartClear`, `stampBarChartOrigin`, `deleteAllBarChartFiles`, and an optional `origin` on `writeBarChartFile`, section 6.
6. **Web/Pi**: `DELETE /settings/barcharts` (bulk), section 6.4.
7. **`icloud-sync` preference fields** `knownSharedCounties`, `pendingCountyClears`, `dayObs`, section 7.
8. **Controller**: the county pass, the day-obs pass, five actions, the bar-chart epoch subscription; `lib/icloud/countySync.ts` and `lib/icloud/dayObsSync.ts` as pure helpers the controller calls, section 5 and 8.
9. **State**: `ICloudState.barCharts`, `sharedCountyCodes`, section 5.6.
10. **`clearAllBarChartFiles`** in `barChartImport.ts`, section 6.3.
11. **Day cache**: `mergeSharedSnapshot`, `awaitDayObsWrites`, section 8.3.
12. **Guards** (section 11) and the rule-file `paths` extensions (section 11.4).

### Modified

- `icloudRecord.ts`: `SharedFileRecord.slot` / `SharedClearedRecord.slot` typed `RecordKind`; optional `county`; `serializeRecord` emits `county` after `slot` when present. `SLOTS`, every bound and every existing validator branch unchanged.
- `icloud.rs`: `RecordFile` gains `county: Option<&str>` (`skip_serializing_if`) after `slot`, so the slot golden is byte-unchanged; the seven slot commands construct `SyncItem::Slot` internally (a refactor proven by the existing tests); `icloud_remove_all` widens; the watcher comments corrected.
- `storage.ts`: `BarChartFileMeta` gains `origin?` and `replacedBySyncAt?`; the normalizer's drop rules for them; the four new methods on both adapters; `writeBarChartFile(regionCode, content, filename, origin?)`.
- `backend/routers/barcharts.py`: the bulk delete route.
- `icloudSync.ts`, `icloudState.ts`, `icloudNative.ts`, `icloudNativeTypes.ts`: as in sections 5, 8, 9.
- `countyDayObsCache.ts`: two exports; the header's "never synced" paragraph replaced by the snapshot statement (section 8.3).
- `barChartImport.ts`: `importBarChartFile` takes `origin`; `clearAllBarChartFiles` added.
- `barChartFilesChanged.ts`: header comment corrected (the file IS synced on macOS and iOS; the reason for a dedicated epoch is unchanged: `filesChanged`'s widget and tab readers have no interest in it).
- `components/targets/TargetsBarChartFile.tsx`, `components/Settings.tsx`: per The Designer's spec; the data contract is in sections 5.6 and 6.5.
- `lib.rs`: seven command registrations under the apple `cfg`.
- Copy modules, published surfaces, version set and `CHANGELOG.md`: section 12.

### Unchanged (used, not modified)

`reconcileSlot` and its table; `Slot`, `SLOTS`, `FileSlot`, `readMeta` (`{ ebird, ml }`), `FILE_PATHS`, `META_PATH` and its links; the three key commands, `keyRecord.ts`, `keyReconcile.ts`, the key pass; `clearDerived.ts`; the day-cache document format, caps, eviction and purge; `useCountyDaySweep.ts`; the `/map/county-day-obs` route; `uploadGuard.ts`; `regionCode.ts` (the TS predicate is not touched; only a fixture joins it); `vite.config.ts` (`/settings` is proxied); the entitlements, the container id, `release.sh`; Windows, web and Pi storage of bar-chart files beyond the bulk delete.

---

## Current schema state (cumulative, after this feature)

```
AppLocalData/data/                                  (TauriStorage)
  api-keys.json          ApiKeysDoc                                  unchanged (v1.0.12); never synced as a file
  settings.json          "icloud-sync": ICloudSyncPref (section 7)   never synced
                         "targetsCounty", "county-completeness-v1", map defaults, tab layout ...   unchanged, never synced
  metadata.json          { ebird: FileMetadata | null, ml: FileMetadata | null }                  unchanged
  ebird-backup.csv, ml-export.csv                                                                 unchanged
  barcharts.json         BarChartFilesStatus { version: 1, counties: Record<regionCode, BarChartFileMeta> }
                         BarChartFileMeta { filename, uploadedAt, origin?: FileOrigin, replacedBySyncAt?: string }   (+2 optional fields, section 6.1)
  barcharts/<code>.txt   one file per county                                                       unchanged
  county-day-obs.json    DayObsStore v2                                                            unchanged format; now the SOURCE of this device's snapshot (section 8)
  replay.json, map-style/, derived caches                                                          unchanged, never synced

iCloud container iCloud.com.dtgibson.snowraven, Documents/    (user's own account, both App IDs)
  ebird.record.json, ebird-backup.csv, ml.record.json, ml-export.csv      unchanged (v1.0.11)
  keys.record.json                                                        unchanged (v1.0.12)
  barcharts/<code>.record.json     SharedRecord with slot 'barchart' and county <code> (file or cleared)   NEW
  barcharts/<code>.txt             bytes the record describes                                              NEW
  day-obs/<deviceId>.record.json   SharedRecord with slot 'day-obs', origin.deviceId === <deviceId>       NEW (Open Question 1)
  day-obs/<deviceId>.json          that device's DayObsStore v2 snapshot                                   NEW (Open Question 1)
  .tmp/<deviceId>-<flattenedTargetName>    staging, never read by a peer                                   unchanged mechanism; new names flatten the subdirectory (section 9.1)
```

The prior schema's `DayRecord.speciesCode` bound is corrected here to what shipped: `SPECIES_CODE_RE = /^[a-z0-9-]{2,16}$/` (`lib/speciesCode.ts:17`), not `^[a-z0-9]{1,16}$`.

---

## 3. Container layout and names (FR-29)

| Item | Container name | Local path (Tauri) | Name derivation |
|---|---|---|---|
| county file | `barcharts/<code>.txt` | `data/barcharts/<code>.txt` | `<code>` is a region code that passed `County::parse` (Rust) / `isRegionCode` (TS) before any path is built |
| county record | `barcharts/<code>.record.json` | none | same |
| day-obs snapshot | `day-obs/<deviceId>.json` | `data/county-day-obs.json` | `<deviceId>` passed `valid_device_id` / `DEVICE_ID_RE` (32 lowercase hex) |
| day-obs record | `day-obs/<deviceId>.record.json` | none | same |
| staging | `.tmp/<deviceId>-barcharts-<code>.txt`, `.tmp/<deviceId>-barcharts-<code>.record.json`, `.tmp/<deviceId>-day-obs-<deviceId>.json`, ... | | the target's path with `/` replaced by `-`, so the existing flat `.tmp/` and `clear_staging` keep working |

Every name is a deterministic function of a validated code or id; the user's filename appears only inside the record's `filename` field (display only, sanitized to `MAX_FILENAME`, never a path), exactly as for the two data files. The two subdirectories cannot collide with `ebird.record.json`, `ml.record.json`, `keys.record.json` or the two CSV names, and a county code cannot spell any of them (QA-25). `Documents/barcharts/` and `Documents/day-obs/` are created with `create_dir_all` on first write.

**Why subdirectories.** The container is the user's own account and can be browsed in Finder if `NSUbiquitousContainers` is ever added; hundreds of county files beside the four data-file names would be noise, and one directory per kind is what the listing command enumerates. **Verify-item V1:** `NSMetadataQueryUbiquitousDocumentsScope` with `NSMetadataItemFSNameKey LIKE '*.record.json'` matches items in a subdirectory of `Documents/` (it is a scope, not a directory listing; expected yes). Fallback if not: flat names `barchart-<code>.record.json` / `barchart-<code>.txt` / `dayobs-<deviceId>...` in `Documents/`; only `SyncItem`'s name functions and the listing filter change. Correctness does not depend on it either way: the five-minute poll and the foreground/focus triggers still run every check.

---

## 4. The shared record, generalized

### 4.1 Kinds

```
RecordKind = 'ebird' | 'ml' | 'barchart' | 'day-obs'        // icloudRecord.ts; Slot stays 'ebird' | 'ml'
```

A record binds itself to its name by a discriminator, as today: a slot record by `slot`, the key record by `kind: 'keys'`, a county record by `slot: 'barchart'` plus `county`, a day-obs record by `slot: 'day-obs'` plus `origin.deviceId`. A record read at one name that claims another is rejected (`'wrong-slot'`, `'wrong-county'`, `'wrong-device'`) and reads as absent, so a file copied to the wrong name cannot act as a record for it.

### 4.2 Shapes

```
county file record      { version: 1, slot: 'barchart', county: 'US-CA-001', state: 'file',
                          filename, uploadedAt, origin, byteLength, sha256 }
county cleared marker   { version: 1, slot: 'barchart', county: 'US-CA-001', state: 'cleared', clearedAt, origin }
day-obs record          { version: 1, slot: 'day-obs', state: 'file', filename: 'county-day-obs.json',
                          uploadedAt, origin, byteLength, sha256 }              // no 'cleared' arm: removal is deletion (section 8.4)
```

Serialized key order on both writers: `version, slot, county?, state, filename?, uploadedAt?, clearedAt?, byteLength?, sha256?, origin` (the shipped `RecordFile` order with `county` inserted after `slot`; absent fields omitted). Golden strings for one county file record, one county marker and one day-obs record are pinned byte-equal in both languages (QA-02), and the shipped slot golden stays byte-identical because `county` is skipped when `None`.

**Validators** (`icloudRecord.ts`, pure, never throw), sharing every envelope step and bound with `validateSharedRecord`:

| Function | Extra rule beyond the shipped file-record rules | Reason word |
|---|---|---|
| `validateCountyRecord(text, county, nowMs)` | `slot === 'barchart'`; `isRegionCode(record.county) && record.county === county` | `'slot'`, `'wrong-county'` |
| `validateDayObsRecord(text, deviceId, nowMs)` | `slot === 'day-obs'`; `state === 'file'` only; `origin.deviceId === deviceId`; `byteLength <= DAY_OBS_SHARED_MAX_BYTES` (the kind-specific bound, section 10) | `'slot'`, `'state'`, `'wrong-device'`, `'byteLength'` |

`validateSharedRecord` itself keeps rejecting `slot` values outside `SLOTS` for the two fixed names (`'slot'`), so a county record copied to `ebird.record.json` is refused there. A reason word never contains a value (the v1.0.12 rule).

### 4.3 Bounds (unchanged, restated with units and anchors per the numeric-bound rule)

| Bound | Value | Unit | Anchor / range |
|---|---|---|---|
| `MAX_RECORD_TEXT` | 4,096 | UTF-16 code units of the record text | a county record is ~330 units; the 16 KB on-disk bound below is what makes an oversized file never reach this check |
| `MAX_RECORD_BYTES` (Rust) | 16 × 1024 = 16,384 | bytes on disk, from `symlink_metadata` before any read | applies to every `.record.json` at any name |
| `MAX_BYTES` | 200,000,000 | bytes; `byteLength` integer in `[1, MAX_BYTES]` | the per-file corruption guard for slots and counties; `>= MAX_UPLOAD_BYTES` (52,428,800) asserted by import (FR-30) |
| `DAY_OBS_SHARED_MAX_BYTES` | 64,000,000 | bytes | day-obs snapshots only; section 10 states the derivation |
| `isPlausibleTime` window | `[2000-01-01T00:00:00Z, now + 24 h]` | ms since epoch; text ≤ 64 units | reader side, every record |
| `isWritableTime` | exact 24-unit ISO shape, byte-equal `toISOString` round trip, inside the same window | | write side: key entries (shipped) and, from this feature, the county push (section 5.4) |
| `MAX_LABEL`, `MAX_FILENAME` | 64, 255 | UTF-16 code units | unchanged |

### 4.4 The region-code twin (FR-29, FR-37, NFR-01)

`REGION_CODE_RE = /^US-[A-Z]{2}-[0-9]{3}$/` stays the one TypeScript definition. Its Rust twin is a hand-written byte check, not a regex crate: `County::parse(s: &str) -> Result<County, ()>` accepts exactly 9 bytes, `b"US-"`, two bytes in `b'A'..=b'Z'`, `b'-'`, three bytes in `b'0'..=b'9'`, and nothing after (so a trailing newline, a lowercase state, a Unicode digit, an embedded newline and a 10-byte string are all refused; `County` is the only type the item commands accept, and its field is private, so no unvalidated string can become a path). Explicit ASCII ranges are the byte-level form of "`[0-9]`, never `\d`".

**Enforcement on each side, independently testable (the v1.0.20 twinned-limit rule):**

- TS: `assertRegionCode` (the existing `storage.ts:157-159` thrower) runs in `icloudNative.ts`'s item wrappers before any `invoke`; deleting it turns `icloudNative.regionCode.test.ts` red and nothing on the Rust side.
- Rust: `SyncItem::try_from(ItemArg)` calls `County::parse` before any filesystem or container call; deleting it turns `icloud.rs`'s `#[test] county_parse_refuses_fixture_rows` red and nothing on the TS side.
- Shared fixture `frontend/src/lib/regionCode.fixture.json`: `[{ "input": string, "ok": boolean }]` with at least: a conforming code; trailing newline; leading newline; embedded newline; `US-CA-٠١٢`; lowercase state; 8 and 10 characters; a dot, a slash and a percent sign in a position of each class. Read by vitest, and by Rust through `include_str!("../../frontend/src/lib/regionCode.fixture.json")`, with the row count asserted equal on both sides (the v1.0.12 "neither table can grow alone" shape). `testing.md`'s `paths` gains the fixture.

---

## 5. Sync for the county family

### 5.1 Reconciliation (FR-01, FR-03)

Per county, `reconcileSlot({ local, shared, file, deviceId })` is called with `local = { uploadedAt: Date.parse(meta.uploadedAt), originId: meta.origin?.deviceId ?? null } | null` from the manifest, `shared` = the validated county record or null, `file` from the listing's flags. The table, the null-record guarantee (no row deletes local when `shared` is null) and the equal-time origin-id tiebreak apply unchanged. No county's inputs include another county's or a slot's state, so FR-03 holds by construction (QA-01 asserts it structurally: the same `ReconcileInput` yields the same `SlotDecision` whichever kind it describes).

### 5.2 The listing (NFR-02)

`native.listItems('barchart')` (section 9.3) returns, in one IPC round trip, every container county whose record name passed `County::parse`:

```
ListedItem { county: string; present: boolean; record: string | null;        // record text, or null when the record file is present but not yet downloaded
             file: { present, downloaded, downloading, byteLength: number | null } }
ListResult { items: ListedItem[]; truncated: boolean }                       // truncated when MAX_LISTED_ITEMS was hit (section 10)
```

**Tri-state record, stated because the two slots never needed it:** `present: false` means no record exists (the "shared null" column, so a local file is pushed); `present: true, record: null` means the record is an undownloaded placeholder (the native side has called `startDownloadingUbiquitousItemAtURL` on it) and the county is **skipped this check** with view `'downloading'`, never treated as absent, or a device would push over a peer's newer file it has not read yet; `record` non-null is validated. The next check (the metadata query fires when the record lands, and the poll backs it) resolves it.

### 5.3 The county pass inside `runCheck`

Order within one check: file pass (shipped), **county pass**, **day-obs pass** (section 8), key pass (shipped). One `CHECK_DEADLINE_MS` budget covers the status probe, the record reads and the listing; pushes and pulls are not raced against it, as today.

1. `manifest = await storage.getBarChartFiles()`; a rejection (UNKNOWN) skips the pass, keeps every county view, logs one warn.
2. `listing = await native.listItems('barchart')`; `'timeout'` / `'unavailable'` mark every county with an unpushed local change (`meta.origin?.deviceId === deviceId` or no origin, and not in `knownSharedCounties`) `'waiting-to-upload'`, every other locally present county `'error'` with the mapped reason and Retry, and set `checkFailed` (the file pass's own rule).
3. **Pending county clears** (section 5.5) are finished first.
4. For each `code` in `union(Object.keys(manifest.counties), listing.items.map(i => i.county))`, sorted (deterministic order for the tests): build `local`, `shared`, `file`; decide; apply (5.4). A manifest time `Date.parse` cannot read gets an `'up-to-date'` view and is skipped, as a slot does (`icloudSync.ts:1068-1074`).
5. Publish `state.barCharts` (only counties with a view), `knownSharedCounties` (every county whose shared record is `state: 'file'`, with its filename), `sharedCountyCodes`; `savePref()` once with the file pass.

### 5.4 Applying a decision

| Action | Effect |
|---|---|
| `none` | view only |
| `push` | `uploadedAt = isWritableTime(meta.uploadedAt) ? meta.uploadedAt : isoNow` (FR-04); `native.pushItem({ kind: 'barchart', county }, sanitizeFilename(meta.filename), uploadedAt, recordOrigin())`; then `storage.stampBarChartOrigin(code, origin, uploadedAt, expect: meta.uploadedAt)`, which writes `origin` when absent AND rewrites `uploadedAt` when the fallback time was used, so local equals shared and the next check is `none` rather than a pull of the device's own file. The file is never skipped (QA-03). View `'up-to-date'` if the native `uploaded` flag is true, else `'waiting-to-upload'`. No epoch bump (nothing local changed that a reader shows). On Tauri every manifest time is `toISOString()` output, so the fallback is reachable only through a hand-edited manifest; it is specified so the rule has no gap |
| `pull` | `storage.applySyncedBarChartFile(code, { filename: shared.filename, uploadedAt: shared.uploadedAt, origin: shared.origin, replacedBySyncAt: isoNow only when a local entry existed }, expect, () => native.pullItem(item, shared.sha256, shared.byteLength, 'file'))`; on `true`: `notifyBarCharts()` (the self-notifying guard set), view `'up-to-date'` with `replacedAt` when a local file was replaced (FR-17). **Not** `deps.invalidate`, **not** `purgeDerived`, **not** `notifyFiles` (FR-06). Note the deliberate difference from `pullShared` at `icloudSync.ts:458-494`, which stamps `replacedBySyncAt` even with no local copy: for counties it is stamped only on a real replacement, so the Targets section's replaced line (FR-17) is never shown for a first arrival |
| `download` | `native.startDownloadItem(item)`; all counties needing a download share ONE `awaitDownloaded` wait of `min(CHECK_DOWNLOAD_WAIT_MS, remaining)`, polling `listItems` at `DOWNLOAD_POLL_MS`; those that land are pulled, the rest show `'in-icloud-not-downloaded'` (FR-08) with the Download now action, which waits `DOWNLOAD_NOW_WAIT_MS` for that one county (FR-16). A `.txt` landing does not fire the metadata query (it watches records), which is why the wait exists, as for the CSVs |
| `delete-local` | `storage.applySyncedBarChartClear(code, expect)`; on `true`: `notifyBarCharts()`; view removed (FR-12). No derived purge: nothing derived from a bar-chart file is registered (FR-14) |

`recordOrigin()` is the shipped sanitizer (`icloudSync.ts:278-284`). The native push reads the local `.txt` itself and the native pull writes it itself; file content never crosses IPC for the county family (the design decision 3 of the icloud-sync schema, kept).

### 5.5 Pending county clears (FR-11)

`pref.pendingCountyClears: Record<code, clearedAtIso>`. At step 3 of the pass, for each memo: if the listing has no record for that county, or its record's time is `<=` the memo, call `native.pushItemsCleared([code], clearedAt, origin)` and substitute a synthetic cleared record; if a newer shared file exists the memo simply yields to it. The memo is deleted in both cases; a `'timeout'` / `'unavailable'` on the push leaves it for the next check (the shipped slot behaviour at `icloudSync.ts:1046-1063`, applied per county). Bound: keys pass `REGION_CODE_RE`, values pass `isPlausibleTime`, count bounded by the county space (section 10); the normalizer drops anything else.

### 5.6 State and actions (`icloudState.ts`)

```
ICloudState gains
  barCharts: Record<string /* regionCode */, SlotView>     // only counties with a view; SlotView unchanged (eight states + replacedAt)
  sharedCountyCodes: readonly string[]                      // sorted; from the last check or knownSharedCounties offline
  sharedExists: boolean                                     // now true when any slot OR any county is shared
  fileOrigin(): FileOrigin | null                           // exposed for the Targets import: the origin Settings already passes to writeFile, null with sync off
ICloudActions gains
  downloadBarChartNow(code)     retryBarChart(code)     barChartSaved(code)
  barChartsCleared(codes: string[], clearedAt: string)   // after a LOCAL removal already happened (Remove with sync on; clear-all)
  removeFromICloud()            unchanged name; now also removes county and day-obs items (section 9.4)
```

The Targets section reads `useICloudState().barCharts[regionCode]` (undefined = no sync state; FR-15's sync-off and non-Apple cases are the same `undefined`, since the controller never boots there). FR-15's list is the shipped eight states; `replacedAt` carries FR-17.

`barChartsCleared(codes, clearedAt)`: `native.pushItemsCleared(codes, clearedAt, recordOrigin())` returning `{ failed: string[] }`; every failed code goes to `pendingCountyClears[code] = clearedAt`; one `savePref()`; views `'error'` for the failed ones; `requestCheck` afterwards is not needed (the markers are the shared state now). The local removal is performed by the caller BEFORE this action (Targets Remove through `removeBarChartFile`, Settings clear-all through `clearAllBarChartFiles`), so `targetsPublishedClaims`' import roster stays exact (section 11.1).

### 5.7 The epoch and the triggers (FR-06)

The controller subscribes to `subscribeBarChartFilesChanged` with its own `selfNotifyingBarCharts` guard and calls `requestCheck('bar-chart files changed')` for a bump it did not make (a user add, replace or remove on Targets). Its own bumps (a synced arrival, replacement or removal) set the guard first, so no additional check is triggered by a sync (QA-05). `filesChanged` is never notified by anything in this feature; the widget hand-over and the eight tabs keyed on it never re-run (QA-05's control leg shows a data-file arrival still bumps it).

`barChartSaved(code)` (called by `importBarChartFile` after a successful write when it was handed an origin) sets the view `'uploading'` at once, exactly as `fileSaved` does; the epoch subscription is what runs the check.

---

## 6. The manifest, the seam and the clear-all path

### 6.1 `data/barcharts.json` (FR-07)

```
BarChartFileMeta { filename: string; uploadedAt: string; origin?: FileOrigin; replacedBySyncAt?: string }
```

`normalizeBarChartManifest` keeps its drop rules and adds: `origin` through the same origin guard `normalizeMetaEntry` uses (32-hex id, string label ≤ 64 units, platform in set; a malformed origin is dropped and the entry kept); `replacedBySyncAt` a string ≤ `BARCHART_UPLOADED_AT_MAX` else dropped. A pre-feature entry has neither field and reads as "from this device" (`originId: null`, which the tiebreak treats as identical at equal time, the v1.0.11 migration rule). Nothing is written at read time. `byteLength` and `sha256` are NOT stored locally: the native push computes both from the bytes it reads, as for the CSVs, and the reconciliation needs neither (the brief's "computed at add time" is superseded by the PRD's FR-07, which names only the origin). The web/Pi manifest format is untouched (its seconds-precision times never reach a record, because sync does not exist there; NFR-04).

### 6.2 Seam methods (`StorageAdapter`; `WebStorage` rejects the three sync links with `'not supported'`, unreachable behind the gate, exactly as the slot sync links do)

```
writeBarChartFile(regionCode, content, filename, origin?: FileOrigin): Promise<void>
   // writes origin when given, never replacedBySyncAt (a user action replaces the entry whole, clearing FR-17's line); web ignores origin
applySyncedBarChartFile(regionCode, entry: BarChartFileMeta, expectLocalUploadedAt: string | null, materialize: () => Promise<void>): Promise<boolean>
   // one BARCHARTS_META_PATH link: read manifest; if (counties[code]?.uploadedAt ?? null) !== expect return false (a user add landed, FR-39 of icloud-sync); await materialize(); counties[code] = entry; write manifest; true
applySyncedBarChartClear(regionCode, expectLocalUploadedAt: string): Promise<boolean>
   // same guard, then the deleteBarChartFile link body (file best-effort, entry always dropped)
stampBarChartOrigin(regionCode, origin: FileOrigin, uploadedAt: string, expectUploadedAt: string): Promise<boolean>
   // same guard on expectUploadedAt; sets origin when absent and uploadedAt when it differs; false when the entry moved
deleteAllBarChartFiles(): Promise<{ removed: string[]; failed: string[] }>
   // one link: read manifest; for each code try remove the file; a code whose remove threw AND whose file still exists is a survivor;
   // write the manifest with exactly the survivors (FR-22 by construction); resolve with both lists; never rejects on a per-file failure
```

All four Tauri links follow `applySyncedFile` / `applySyncedClear` / `stampFileOrigin` (`storage.ts:998-1038`) line for line on the `BARCHARTS_META_PATH` chain: `materialize` is a native invoke, not a chained op (rule 1 holds); a failed link rejects only its caller (rule 2). `readBarChartManifestForWrite`'s heal-to-empty residual (a corrupt manifest inside a write link loses other counties' entries) is inherited and unchanged. `cacheInventory.test.ts`'s adapter row (no `Map<`/`Set<`/`shift(`/`splice(`/`MAX_`) stays green: the survivor set is an array filter.

### 6.3 `lib/barChart/barChartImport.ts` (lazy)

```
importBarChartFile(regionCode, countyLabel, filename, getContent, origin?: FileOrigin)   // passes origin to writeBarChartFile; after the bump, calls icloudActions.barChartSaved(code) when origin was given
removeBarChartFile(regionCode)                                                             // unchanged
clearAllBarChartFiles(): Promise<{ removed: string[]; failed: string[] }>                 // storage.deleteAllBarChartFiles(); notifyBarChartFilesChanged() exactly once when removed.length > 0; returns the result
```

`clearAllBarChartFiles` performs the local removal only. The Settings handler, after it resolves, calls `icloudActions.barChartsCleared(removed, isoNow)` when sync is on (the action is a no-op before the controller boots and on non-Apple platforms, so the handler has one shape everywhere). Settings reaches the module through `import()` (it is on the entry graph; `barChartImport.ts` is not, `entryChunk.test.ts`).

### 6.4 Web/Pi: `DELETE /settings/barcharts` (bulk)

Under `_META_LOCK`: read the manifest, unlink each county file (a missing file is done), rewrite the manifest to exactly the survivors (a file whose unlink raised and which still exists), return `{ "removed": [...], "failed": [...] }` with 200. `WebStorage.deleteAllBarChartFiles` maps onto it and throws on `!res.ok`. A `DELETE` needs a CORS preflight, so the ROADMAP's cross-site simple-request finding does not widen. `backend/tests/test_barcharts_router.py` gains: bulk delete removes every file and empties the manifest; a survivor is reported and kept in the manifest (patch `os.unlink` for one code); idempotent on an empty store. `main.py` and `settingskv.py` are unchanged (the router and the reserved key already exist).

### 6.5 The clear-all control's data contract (FR-19 to FR-23, Open Question 2)

- **Count for the confirmation**: `Object.keys(manifest.counties).length` from `getBarChartFiles()` read when the control mounts and re-read on the bar-chart epoch; a rejected read shows the control in its cannot-activate state with the unknown reason (UNKNOWN, never EMPTY). Zero counties is the cannot-activate state (FR-21).
- **Confirmation**: always, on every platform, per the Q2 default; the sync-on variant is chosen by `syncEnabled && availability === 'available'` from `useICloudState()` (false on every non-Apple platform by construction).
- **On confirm**: `clearAllBarChartFiles()` → if `failed.length > 0` the partial-failure state (FR-22) → if sync on, `barChartsCleared(removed, isoNow)`.
- **Scope**: the control touches `barcharts.json` and `barcharts/*.txt` only; QA-20's byte-identity of every other document holds because no other seam method is called (the day cache is untouched per the Q1 default for FR-23).
- **Placement and gating** are The Designer's; the data contract is platform-independent.

**If Q2 reverses** (no confirmation with sync off): only the handler's branch changes (skip the dialog when `!syncOn`); no data-layer change.

### 6.6 Why the family stays out of `clearDerived.ts` (FR-14)

Unchanged from targets-tab §1.6: the registry holds derivations keyed on user-file content, argued on where the KEYS come from. A bar-chart file's key is a county the user chose to add a file for, not something derived from the backup, and its content is the user's own import; it is a user file like the two data files. Clearing the backup, with or without sync, leaves it alone on every device (QA-12), and `cacheInventory.test.ts`'s `not.toMatch(/barchart/i)` row stays.

---

## 7. The `icloud-sync` preference (device-local, never synced)

```
ICloudSyncPref {
  version: 1                                        // unchanged: every addition is optional and a 1.0.39 reader ignores unknown keys
  enabled, deviceId, lastCheckAt, knownShared, pendingClears, keysEnabled, keysEverEnabled, keyRemovalPending, knownKeyRecord, knownSharedKeys   // unchanged
  knownSharedCounties?: Record<string, { filename: string }>   // NEW: every county whose shared record was state 'file' at the last successful listing
  pendingCountyClears?: Record<string, string>                 // NEW: regionCode -> clearedAt ISO (section 5.5)
  dayObs?: { lastPushedSha256: string | null; peers: Record<string /* deviceId */, string /* sha256 last merged */> }   // NEW (Open Question 1, section 8)
}
```

`normalizePref` gains one shape check per field: `knownSharedCounties` keys through `REGION_CODE_RE` and values `{ filename: string ≤ MAX_FILENAME }`, else that entry dropped; `pendingCountyClears` keys likewise and values through `isPlausibleTime`, else dropped; `dayObs.lastPushedSha256` `SHA256_RE` or null; `dayObs.peers` keys `DEVICE_ID_RE`, values `SHA256_RE`. `savePref` writes the whole object as one `setSetting` link, as today. Size: at most `county space × ~60 bytes` (~200 KB at every US county, ~1 KB in practice) rewritten with every settings save; stated, accepted, and the same residual class targets-tab §3.2 already records for `settings.json`.

Why `knownSharedCounties` is a record and not a count: the Remove synced files confirmation must account for county files (FR-13), the Targets section must be honest offline for a county it knows to be in iCloud, and both need the code, not a number. The Designer decides whether the confirmation lists, counts, or does both; the state exposes `sharedCountyCodes` for either.

---

## 8. The day cache as a synced kind (Open Question 1; FR-24 to FR-28; separable)

### 8.1 Decision: per-device snapshots merged on read, not one merged copy

Stated in the assessment (finding 1) and repeated here with the mechanism. Each device uploads its OWN local document, `day-obs/<deviceId>.json`, as a whole-file snapshot, and merges every OTHER device's snapshot into its own local store on pull. No device ever writes a document another device writes, so there is no merge conflict, no compare-and-swap and no write-back loop. Convergence: a device's snapshot changes only when its own store changes; merging a peer's snapshot changes the store only by entries the device lacked; the second round adds nothing new; fixed point in at most two checks per device (QA-22, asserted under the fake with two simulated devices). The merge is a union with a deterministic per-key preference, so it is order-independent by construction (QA-21).

**What this costs against the PRD's shape.** The container holds one snapshot per device (~10 MB each; three devices, ~30 MB) instead of one; a stale device's snapshot lingers until Remove synced files from iCloud. A device downloads and re-merges a peer's whole snapshot whenever that peer's store changes (every Targets visit on the peer that fetched anything new), skipped entirely while the peer's digest is unchanged (section 8.2). Both are stated, accepted, and cheaper than a non-terminating exchange.

### 8.2 The day-obs pass inside `runCheck` (after the county pass; requires `pref.enabled`, availability `'available'`)

0. `gen = dayObsPurgeGeneration()` (section 8.3), read FIRST, before the listing, the backup check and every download (the fetch-chokepoint rule, CLAUDE.md v1.0.14; security L1). A Clear anywhere in the pass moves it, so no peer text downloaded across it is merged (step 4) and nothing is pushed or removed (step 6).

**Pull half** (steps 2 to 5 are skipped, with no snapshot read, when `getFilesStatus().ebird === null` after the file pass: the day cache is keyed on counties in the backup, so a device with no backup, including one whose backup a synced clear has just removed and whose cache that clear purged, never re-populates from peers; this is what keeps the published "clearing your eBird backup also removes the day-by-day reports" sentence true on the device that cleared. The listing in step 1 is made in every case, because the push half reads this device's own record from it):

1. `listing = native.listItems('day-obs')` (records at `day-obs/<deviceId>.record.json` whose device id passed `valid_device_id`; the same tri-state as counties).
2. For each item whose `deviceId !== pref.deviceId`: `rec = validateDayObsRecord(text, deviceId, now)`; skip if invalid or undownloaded record; skip if `pref.dayObs.peers[deviceId] === rec.sha256` (already merged, no download); skip with `'download'` started if the file is not downloaded (a snapshot arriving later is merged on a later check; there is no per-device view for it, FR-28, so the wait is not spent here).
3. Otherwise `text = await native.pullItem({ kind: 'day-obs', deviceId }, rec.sha256, rec.byteLength, 'text')` (length and digest verified natively before the text is returned; a mismatch is `'mismatch'` and the peer is left for the next check).
4. `const { changed } = await mergeSharedSnapshot(text, gen)` (section 8.3), with the `gen` read in step 0, never one read after the download (corrected at the security review, I6: this step used to show no generation argument); `pref.dayObs.peers[deviceId] = rec.sha256` whether or not it changed anything (the digest names what was read, and an unparseable snapshot is "treated as absent" for merging AND recorded so it is not re-downloaded until the peer writes a new one, FR-26).
5. Peers absent from the listing are dropped from `pref.dayObs.peers`.

**Push half** (after the pull half, so this device's snapshot includes what it just merged):

6. `await awaitDayObsWrites()` (section 8.3), so the local file holds the mirror's last flush. Then, if `dayObsPurgeGeneration() !== gen`, a Clear landed during the pass: steps 7 and 8 are skipped entirely, nothing is pushed and nothing is removed, and the pass returns without failure. The Clear owns the iCloud half (it removes every device's snapshot and resets `pref.dayObs` by REPLACING the object, so whatever the pass keeps writing into the old one is discarded); a snapshot the Clear could not remove goes at the next check, whose step 8 finds no local document (security L1, the push skip taken with the fix).
7. `res = native.pushItem({ kind: 'day-obs', deviceId }, 'county-day-obs.json', isoNow, origin, unlessSha256)`, where `unlessSha256` is this device's own record digest from the step 1 listing when that digest equals `pref.dayObs.lastPushedSha256`, and `null` otherwise, so a snapshot another device removed or replaced goes up again. The native side reads the local document, computes the digest first and, when it equals `unlessSha256`, writes nothing and returns `{ sha256, byteLength, uploaded: true, skipped: true }`; else it writes file then record. `pref.dayObs.lastPushedSha256 = res.sha256`. The document pushed is the WHOLE local store, so it carries every peer entry step 4 took alongside this device's own fetches, with no mark of where each came from and each keeping the `fetchedAt` of the device that fetched it (security L3; the held privacy text, item 38, states this).
8. If the push reports `'local-missing'` (never populated, or purged) and iCloud holds this device's snapshot (its record is in the listing, or `lastPushedSha256 !== null`): `native.removeItem({ kind: 'day-obs', deviceId })`; `lastPushedSha256 = null`.
9. `savePref()` rides the check's single save.

Step 0 and steps 4, 6, 7 and 8 were corrected at the security review (I6) to match the code after the M1/L1 fixes: the list used to show the merge with no generation argument, no push skip after a Clear, `lastPushedSha256` itself as the skip digest, and the removal gated on `lastPushedSha256` alone.

The pass has no row and no state text (FR-28); `'timeout'` / `'unavailable'` inside it set `checkFailed` and leave `pref.dayObs` as it was.

A snapshot that was half-written by a flush racing the native read is bounded by the drain in step 6 and by the 1,000 ms debounce; a peer that receives such a snapshot fails `JSON.parse` and treats it as absent (FR-26), and the next flush plus the next check replace it. Stated residual.

### 8.3 Additions to `lib/countyDayObsCache.ts`

```
export async function mergeSharedSnapshot(text: string, gen: number): Promise<{ admitted: number; changed: boolean }>
export function dayObsPurgeGeneration(): number          // read by the caller BEFORE the download (security L1)
export function awaitDayObsWrites(): Promise<void>       // resolves when _writeChain's current tail has settled; never rejects
```

`mergeSharedSnapshot`: `gen` is the generation the day-obs pass read from `dayObsPurgeGeneration()` at the start of the pass, before its listing and every download, and hands in as a REQUIRED argument (corrected at the security review, L1: a generation read inside the merge is read after the download has landed and cannot see a purge during it; the `replayStore.purgeGeneration()` shape, since the fetch chokepoint is outside the module); if `gen !== _purgeGeneration` before `await ensureLoaded()`, or after it, or the mirror it returned is no longer `_store`, return `{ 0, false }` (a purge landed: nothing from the peer may enter the fresh store, the fetch-chokepoint rule), and the pass skips its push half when the generation moved (section 8.2, step 6); `JSON.parse` inside `try`, any throw → `{ 0, false }`; a non-object, `version !== 2`, or a non-object `entries` → `{ 0, false }`; walk `order` (an array; else `Object.keys(entries)`) admitting at most `DAY_OBS_MAX_ENTRIES` keys that pass `KEY_RE` and whose entry passes `validEntry(e, dateOf(key))` (the existing per-entry validator, FR-26: a bad entry is dropped, the rest kept), recording each key in `seen` at FIRST sight, before its verdict, so a key repeated in `order` is walked once whether it was admitted or rejected (security M1; section 10.2); for each admitted `[key, peer]`: `local = store.entries[key]`; take the peer when `local === undefined`, or `peer.complete && !local.complete`, or (`peer.complete === local.complete` and `peer.fetchedAt > local.fetchedAt`); otherwise keep local; a taken peer entry goes through `insertEntry(store, key, peer)`, NOT `putEntry`: it replaces or adds the entry with no eviction, moves `_totalBytes`, and appends a new key to `order` (a replaced key keeps its place, `order` being enumeration only). It is not validated a second time: `validEntry` has just passed it, and no `await` separates the generation check from the inserts, so no purge can land among them. After the walk, when anything was taken, ONE `evict(store, null, now)` pass applies this device's own entry cap and payload budget, unchanged, and `scheduleWrite(store)` runs once; the flush that follows writes the whole mirror, taken entries with this device's own, into the one local document the push half uploads. (Corrected at the security review, I6: this sentence used to route each taken entry through `putEntry(_store, key, peer, gen)` with a second validation and an eviction per put, which is the per-put path the single eviction pass replaced; section 10.2 already stated the shipped shape.) Ties (equal completeness and `fetchedAt`) keep local, which is what makes the operation idempotent; two devices may then hold different but equally-ranked entries for one key, which is harmless and stated. Order independence of the KEPT KEY SET is exact (union), which is what QA-21 asserts.

Why this does not break §3.6's no-`docChains` argument: the module remains the document's only writing module; the merge writes through the same mirror, the same `scheduleWrite`, the same `_writeChain`; no read of the local FILE feeds a write (the peer text arrives over IPC from the container). The header paragraph is rewritten to say so and to name the snapshot push as the one READER of the file outside the module (native, read-only, after `awaitDayObsWrites`).

**Hostile-document cost, and a recommendation.** ROADMAP (v1.0.39, Targets security Informational (3)) measured ~0.8 s of main-thread eviction on a crafted 2,996-entry near-empty document, reachable today only by a hand-edited file or the web/Pi plant. A peer snapshot arrives from the same trust boundary as the local file (the user's own iCloud account), so the merge makes the same shape reachable through the container, once per crafted snapshot per device. The declared bound is unchanged (load admission at 3,000; O(cap) per victim scan). **Recommendation:** take the ROADMAP fix in this build (build the per-county recency map once per eviction pass, recompute only the victim's county), which makes both the merge and the first load O(n log n). If the Engineer declines, it is a written non-action in `decisions.md` with the measured number and this reversal condition, not a silence.

**Main-thread cost, measured before believed.** `JSON.parse` plus `validEntry` over a realistic ~10 MB snapshot (~59,000 records) runs on the main thread during a check, which may fire while the user is on any tab. This deviates from NFR-02's "never blocks the main thread on file contents" for the day cache specifically (the county family keeps it: `.txt` bytes never cross IPC). The Engineer measures the merge of a 10 MB snapshot once in the live look and records it in `decisions.md`; the escalation, if it exceeds ~50 ms, is the `parseOffThread` shape (a worker with the settle contract of CLAUDE.md v1.0.14) as a follow-on, not a reason to drop the sync.

### 8.4 Removal paths (FR-27, Open Question 5)

- **Clearing the eBird backup with sync on** (`clearWithSync('ebird')`, which already purges this device's cache through `purgeDerived`): additionally `native.removeItems('day-obs')` (every device's snapshot, best-effort; a failure is corrected by each device's own step 8 at its next check once the synced clear reaches it) and `pref.dayObs = { lastPushedSha256: null, peers: {} }`. With sync off: the local purge only, as today.
- **Remove synced files from iCloud**: `icloud_remove_all` now removes `day-obs/*` too (section 9.4); `pref.dayObs` reset.
- **Turning sync off**: nothing removed, as for the files (FR-13); the snapshot lingers until one of the two paths above.
- Nothing in the pass notifies `filesChanged` or `barChartFilesChanged`; the Targets tab sees merged days through `loadAll()` on its next sweep seed (FR-28's "days already checked without a fetch").

### 8.5 What reverses if Q1 flips to "no"

Delete, with nothing else touched: the day-obs pass (section 8.2), `lib/icloud/dayObsSync.ts`, the `pref.dayObs` field and its normalizer arm, `mergeSharedSnapshot` / `awaitDayObsWrites`, the `SyncItem::DayObs` arm and `DAY_OBS_SHARED_MAX_BYTES` (the seven item commands stay, taking only the `barchart` kind), the `day-obs/` line in `icloud_remove_all`, `validateDayObsRecord`, the `'day-obs'` member of `RecordKind`, and the day-obs rows in the parity and controller tests. `icloudPaths.parity.test.ts`'s `COUNTY_DAY_OBS_PATH` exclusion block is then KEPT rather than inverted (FR-37's "according to Open Question 1"), and every copy surface names the files only (FR-28). The migration plan builds the day cache LAST (steps 12-14) for exactly this reason: a "no" at the copy review costs nothing already built.

---

## 9. Native layer (`icloud.rs`, macOS + iOS)

### 9.1 `SyncItem`

```rust
enum SyncItem { Slot(Slot), County(County), DayObs(DeviceId) }
// local_path(&self, data_dir)  -> data/<csv> | data/barcharts/<code>.txt | data/county-day-obs.json
// container_file(&self)        -> <csv> | barcharts/<code>.txt | day-obs/<id>.json
// container_record(&self)      -> <slot>.record.json | barcharts/<code>.record.json | day-obs/<id>.record.json
// staging_name(&self, target)  -> <deviceId>-<target with '/' -> '-'>
// max_bytes(&self)             -> MAX_BYTES | MAX_BYTES | DAY_OBS_SHARED_MAX_BYTES
// record_fields(&self)         -> slot text ("ebird"|"ml"|"barchart"|"day-obs") and county: Option<&str>
```

`County` (section 4.4) and `DeviceId` (a newtype over a string that passed `valid_device_id`) have private fields; the only constructors validate. The IPC argument is `#[derive(Deserialize)] #[serde(tag = "kind", rename_all = "kebab-case")] enum ItemArg { Barchart { county: String }, DayObs { device_id: String } }`, converted by `TryFrom<ItemArg> for SyncItem` which returns `Err("unknown")` before any filesystem call (FR-29; the closed error union of `icloudNativeTypes.ts` gains no member). The seven shipped slot commands are refactored to build `SyncItem::Slot(slot)` and call the same shared bodies; their signatures, names and behaviour are unchanged, which the existing `icloudSync.test.ts`, `icloudSync.keys.test.ts` and the parity pins prove (the v0.5.77 "prove a relocation byte-identical" rule: the record golden, the csv names and the command list are pinned before and after).

`icloud_pull`'s temp name `local.with_extension("csv.tmp")` becomes `<local file name>.tmp` beside the target (`US-CA-001.txt.tmp`, `county-day-obs.json.tmp`, and, unchanged in effect, `ebird-backup.csv.tmp`).

### 9.2 Read posture (FR-31, NFR-01), reused for every item

`regular_file_len` (`symlink_metadata`, `is_file()`), the real on-disk size against `item.max_bytes()` BEFORE `fs::read`, the length re-checked after the read, then the digest; a record through `record_text_at` (regular file, `MAX_RECORD_BYTES`, non-UTF-8 → `""` → absent); a symlink at any item name removed as a link by `remove_planted_item` and never followed; a directory at an item name refused (and removed by `replace_item` on write). The listing reads records only for names that passed the shape check and never reads a snapshot or a `.txt` (flags only). QA-27 runs each of these against a county name and a day-obs name.

### 9.3 The seven item commands (all `blocking` under `COMMAND_TIMEOUT`; every error a member of the shipped closed union)

| Command | Args | Returns | Body |
|---|---|---|---|
| `icloud_list_items` | `kind: 'barchart' \| 'day-obs'` | `{ items: ListedItem[], truncated }` | `read_dir` of the kind's subdirectory (absent dir → empty); for each entry named `<x>.record.json` (or its `.icloud` placeholder) whose `<x>` passes `County::parse` / `valid_device_id`: `ubiquity_flags` on the record; if not downloaded, start its download and emit `record: null, present: true`; else `read_record_text`; plus the companion file's flags and `byteLength`; stop at `MAX_LISTED_ITEMS` with `truncated: true`. Unknown names are ignored, never read. Work O(directory entries) plus one bounded record read per valid item |
| `icloud_push_item` | `item, filename, uploadedAt, origin, unlessSha256: Option<String>` | `{ sha256, byteLength, uploaded, skipped }` | `regular_file_len(local)` → `'local-missing'`; `> item.max_bytes()` → `'too-large'`; read; length re-check; `sha256_hex`; if `Some(u) == unlessSha256` → `skipped: true`, no write; else `atomic_container_write` file then record (the record is the commit point), `create_dir_all` on the subdirectory first. `sanitize_filename`, `sanitize_label`, `valid_device_id` as `icloud_push`. **`uploadedAt` is not time-checked natively** (the TS chokepoint is where FR-04's check lives; Rust writes what it is given, as it does for slots today) |
| `icloud_push_items_cleared` | `counties: String[], clearedAt, origin` | `{ failed: String[] }` | for each county that passes `County::parse` (a failing string is in `failed`, nothing else happens for it): coordinated delete of the `.txt` (absent ignored), then the cleared record written atomically; a per-county failure is collected, not raised. `barchart` only; a day-obs item has no marker |
| `icloud_pull_item` | `item, expectedSha256, expectedByteLength, mode: 'file' \| 'text'` | `{}` or `{ text }` | `expectedByteLength > item.max_bytes()` → `'too-large'`; the shipped pull body (present, downloaded, coordinated read, length, digest); `'file'` writes `<local>.tmp` and renames into place; `'text'` returns the verified bytes as a UTF-8 string (non-UTF-8 → `'mismatch'`) and touches no local file. `'text'` is accepted only for `DayObs`; `'file'` only for `Slot` and `County` (a wrong pairing is `'unknown'`) |
| `icloud_start_download_item` | `item` | `{}` | the shipped body on the item's file |
| `icloud_remove_item` | `item` | `{ removed }` | coordinated delete of the item's file and record, plus this device's staging entries for them |
| `icloud_remove_items` | `kind` | `{ removed }` | every valid-named file and record in the kind's subdirectory, plus staging entries for that kind from any device; unknown names left alone (stated) |

### 9.4 `icloud_remove_all` (Remove synced files from iCloud, FR-13)

Widened to: the two slots (as shipped), then `remove_items('barchart')`, then `remove_items('day-obs')`, then `clear_staging(&tmp_dir, None)` (as shipped). Still never `keys.record.json` (the parity row at `icloudPaths.parity.test.ts:212` stays). The controller then clears `shared`, `knownSharedCounties`, `pref.dayObs`, publishes, and, with sync on, requests a check that re-pushes the local copies of everything (as today).

### 9.5 Registration and dependencies

Seven `#[cfg(any(target_os = "macos", target_os = "ios"))] icloud::…` lines in `lib.rs`. `Cargo.toml` unchanged: `sha2` and the objc2 crates are already in the apple block; no regex crate is added (section 4.4). The Windows build is byte-equivalent apart from the version (the module does not compile there).

---

## 10. Bounds (with units and anchors) and declared scans

### 10.1 Bounds introduced or relied on

| Name | Value | Unit | Anchor range and reason |
|---|---|---|---|
| `MAX_LISTED_ITEMS` | 4,096 | items per kind per listing | not a user quota (FR-09): the real US county set is ~3,244 codes, while the SYNTACTIC space `REGION_CODE_RE` admits is 26² × 1,000 = 676,000, so a hostile container could plant more records than any device could read inside one 8 s command. Items past the bound are ignored this check and `truncated: true` is logged once; no user-facing message names a count. The user-visible bound on county files is the county space and nothing else |
| `DAY_OBS_SHARED_MAX_BYTES` | 64,000,000 | bytes (decimal), on disk and in the record | derived, not borrowed: a producer inside the local budget can write at most `DAY_OBS_MAX_BYTES` (10,000,000 code units of `species` payload) + one sole oversized newest entry (≤ 5,000 records × ~690 code units ≈ 3.45 M) + the envelope (≤ 3,000 entries × ~120 ≈ 0.36 M) ≈ 13.8 M UTF-16 code units, at most 3 UTF-8 bytes each (BMP non-ASCII in `locName` only) ≈ 41.5 MB adversarial; realistic snapshots are 10-11 MB. 64 MB sits above that maximum and below `MAX_BYTES` (200 MB), so the day-obs text is bounded before `JSON.parse` by the byte count already verified (UTF-16 code units ≤ UTF-8 bytes). Enforced in Rust (`SyncItem::DayObs.max_bytes()`) and in TS (`validateDayObsRecord`), each with its own enforcement test |
| `pendingCountyClears`, `knownSharedCounties` | ≤ county space | entries | keys must pass `REGION_CODE_RE`; ~60 bytes each; rewritten with every settings save |
| the check's wait for county downloads | `min(CHECK_DOWNLOAD_WAIT_MS = 5,000, remaining budget)` | ms, shared across all counties needing a download in one check | the shipped per-slot wait, not multiplied by N |
| `MAX_BYTES >= MAX_UPLOAD_BYTES` | 200,000,000 ≥ 52,428,800 | bytes | FR-30; asserted by comparing the two imported constants (QA-26) |

### 10.2 Declared scans over untrusted or shared-location content (security.md v1.0.23)

| Scan | Input | Bound | Linearity |
|---|---|---|---|
| `icloud_list_items` name filter | directory entry names in the container (any writer to the user's iCloud) | each name checked by a fixed-length byte predicate (9 bytes + `.record.json`, or 32 hex + `.record.json`); at most `MAX_LISTED_ITEMS` records read | O(entries) name checks, each O(1); O(items) bounded record reads |
| `validateCountyRecord`, `validateDayObsRecord` | record text ≤ 4,096 units (the 16 KB on-disk bound keeps larger text out) | as the shipped validator | one `JSON.parse` over ≤ 4,096 units, constant field checks |
| `County::parse` / `isRegionCode` | a 9-byte candidate | fixed length | O(1) |
| `mergeSharedSnapshot` | a peer snapshot ≤ `DAY_OBS_SHARED_MAX_BYTES` (64 MB) | one `JSON.parse`; ≤ `DAY_OBS_MAX_ENTRIES` (3,000) keys admitted; ≤ 5,000 records per entry through `validEntry`; each string ≤ 512 units | parse O(bytes). Validation O(bytes), NOT O(admitted records): rejected keys are validated too, so what bounds it is the dedupe, which records a key at FIRST sight, before its verdict, so each distinct key's entry is walked at most once however often `order` repeats it; the `order` walk itself is one `KEY_RE` test and one `Set` probe per element, O(bytes). (Corrected at the security review, M1: the dedupe first recorded a key only once admitted, so a repeated rejected key re-paid its whole validation per repetition, quadratic, measured 2.8 s at 565 KB and 11 s at 1.1 MB; after, 2.5 ms and 4.8 ms. The load path's `sanitizeStore` had the same shape and takes the same fix.) Taken entries are inserted without eviction and then ONE eviction pass runs, O(n log n) (D9 took the recommended fix). No `includes` / `indexOf` / `find` inside a loop: the store is a `Record` read by key |
| `normalizePref` over the three new fields | the app's own settings document | keys through the two fixed patterns; values through `isPlausibleTime` / `SHA256_RE` | one pass |
| `normalizeBarChartManifest` (two new fields) | the app's own manifest | the origin guard, a string ≤ 40 units | one pass, unchanged cost |
| the county pass's `union` of manifest keys and listing counties | ≤ county space + `MAX_LISTED_ITEMS` | | built with a `Set`, then sorted once: O(N log N) |

Nothing from a record, a filename, a county code or a snapshot reaches a URL, an `id`, an IDREF or a format string: codes reach paths only after the predicate on both sides; filenames and labels render as React children; reason words are rule names.

---

## 11. Guards

### 11.1 Extended

| Guard | Extension |
|---|---|
| `lib/icloudPaths.parity.test.ts` | **The "provably never synced" bar-chart block (`:253-288`) is inverted into a parity block (FR-37, QA-31):** the seven item command names in `icloud.rs` equal `icloudNative.ts`'s; `County::parse`'s presence and `assertRegionCode` in the item wrappers are each pinned by their own enforcement tests (section 4.4), and this file asserts the shared fixture's row count is equal on both sides; the subdirectory names, the record `slot` texts `'barchart'` / `'day-obs'`, `MAX_LISTED_ITEMS`, `DAY_OBS_SHARED_MAX_BYTES` and the county/day-obs goldens are pinned equal in both languages; `SLOTS` is still exactly `['ebird', 'ml']` and the Rust `Slot` enum text is unchanged (the family is still not a slot). **The day-cache block (`:289-311`) is inverted or kept per Q1** (section 8.5). The `MAX_BYTES >= MAX_UPLOAD_BYTES` row (FR-30) lives here |
| `lib/icloud/icloudSync.test.ts:205`, `icloudSync.keys.test.ts:1034` | the excluded-strings list over native call arguments drops `'county'` (a county code and the day-obs filename now legitimately appear) and keeps `'settings.json'`, `'replay'`, `'api-keys'`, `'map-style'`; a new row asserts no native argument ever equals `SETTINGS_PATH`, `API_KEYS_PATH` or `COMPLETENESS_STORE_KEY` |
| `lib/targetsPublishedClaims.test.ts` | the sentence rows at `:149-152, 270-275, 343-349` flip to the approved replacements with a non-vacuity leg per file (FR-38); the code-truth `SLOTS` rows stay (they back "two data files", which remains true of the SLOTS); the import roster (`:374-381`) keeps `importBarChartFile` and `removeBarChartFile` at exactly `TargetsBarChartFile.tsx` and gains a third row: `clearAllBarChartFiles` is reached by a DYNAMIC import from exactly the clear-all control's module (a `import\(\s*['"][^'"]*barChartImport['"]\s*\)` scan beside the static one), named deliberately |
| `lib/cacheInventory.test.ts` | unchanged rows stay true: the registry still does not match `/barchart/i`; the day cache's row and its `writeThrough` / `_writeChain` checks stay; a new row pins that `countyDayObsCache.ts`'s only reader-of-the-file outside the module is named in its header (`icloud_push_item`, native) |
| `lib/entryChunk.test.ts` | negative legs: `lib/icloud/countySync.ts`, `lib/icloud/dayObsSync.ts`, `icloudSync.ts`, `icloudNative.ts`, `lib/barChart/**`, `lib/countyDayObsCache.ts` are NOT in App's closure; positive legs: `icloudState.ts`, `barChartFilesChanged.ts`, `regionCode.ts` still are and still have closure size 1 |
| `lib/storage.barcharts.test.ts` | the four new links on `BARCHARTS_META_PATH` (chain membership; the `expect` guard returning false and touching nothing; a rejecting `materialize` leaving the manifest byte-identical; `deleteAllBarChartFiles`' survivor rule with one `remove` rejecting); the normalizer's two new drop rules; the web adapter's bulk-delete mapping |
| `lib/storageWriteSerialization.test.ts` (or its bar-chart sibling) | `applySyncedBarChartFile` interleaved with `writeBarChartFile` for another county in one tick: both entries persist |
| `lib/icloud/icloudRecord.test.ts` | the two new validators: every shipped hostile row plus `'wrong-county'`, `'wrong-device'`, a `'cleared'` day-obs record (`'state'`), a day-obs `byteLength` over `DAY_OBS_SHARED_MAX_BYTES`; the goldens round-trip byte-identical (QA-02) |
| `lib/icloud/icloudReconcile.test.ts` | QA-01: every table row driven with a county-shaped `shared` yields the same action as the slot-shaped one; a two-county fixture yields each county's own action |
| `backend/tests/test_barcharts_router.py` | section 6.4 rows |
| `lib/singleWebviewInvariant.test.ts` | no new site: the new state is the controller's, already in the `storage.ts` and `countyDayObsCache.ts` notes' scope; the merge writes through the existing chain |
| the published-claims suites | every retired sentence gone, every replacement present with a non-vacuity leg per file, `PRIVACY_POLICY.md` and `website/privacy.html` mirrored, the effective date moved (QA-30) |

### 11.2 New

- **`lib/icloud/countySync.test.ts`** (under the native fake, which gains the seven item commands and per-kind containers): QA-03 (push and adoption, the writable-time fallback with a mutation dropping it going red, and `stampBarChartOrigin` rewriting the time so the next check is `none`), QA-04 (pull, download, replace whole), QA-05 (both epoch counters, the control leg), QA-07 (every code of one state plus a generated multi-state set; no refusal, no eviction, no count-shaped state; a source scan of the controller and manifest for `MAX_` / `slice(0,` / `length >` over the county collection finds nothing), QA-09 (pending clear: refused write remembered, finished next check, dropped for a newer file), QA-10 (marker on a peer with sync on and off), QA-11 (turning off writes nothing; `removeAll` is asked for every county and snapshot and never the key record), QA-12 (backup clear leaves counties alone under both sync states), QA-33 (call counts at N = 1, 50, 500: exactly one `listItems` per check, at most N transfers), the tri-state skip (an undownloaded record never yields a push over it).
- **`lib/icloud/dayObsSync.test.ts`** (Q1): QA-21 over a generated corpus (union; complete beats incomplete; later fetch wins; commutative and idempotent kept-key set; local caps applied after; the pinned caps unchanged), QA-22 (a two-device simulation reaches a fixed point within two checks per device; an unchanged peer digest is skipped without a pull), QA-23 (one malformed entry dropped, the rest merged; unparseable → absent and recorded; every `DayRecord` guard with a hostile row), QA-24 (backup clear with sync on removes every snapshot; Remove synced files removes them; no `filesChanged` bump), the no-backup gate (no listing and no merge when `ebird === null`), the purge race (a merge that started before a purge writes nothing).
- **`lib/icloudNative.regionCode.test.ts`** and the Rust `#[test]`s in `icloud.rs`: section 4.4 (each side's deletion turns only its own test red).
- **`lib/regionCode.fixture.json`**: the shared rows.
- **Rust tests** (QA-27): a directory, a symlink, an oversized file, a record over `MAX_RECORD_BYTES` and a non-UTF-8 record at a county name and a day-obs name; pull and push verify length and digest for a county file exactly as for a CSV; `pull_item('text')` refuses a `County`; a listing with 4,097 planted valid names returns 4,096 and `truncated`; a listing ignores `../x.record.json`, `US-CA-001\n.record.json` and a lowercase code.
- **`components/targets/TargetsBarChartFile.test.tsx`**, **`components/Settings.barcharts.test.tsx`**: QA-08, QA-13 to QA-19, QA-34 against the approved copy table (The Tester's, after The Designer).

### 11.3 QA-28 (an older peer)

Driven with the pre-feature record reader: `git show v1.0.39:frontend/src/lib/icloud/icloudRecord.ts` is not importable, so the row is structural: the pre-feature reader read exactly two fixed names and never enumerated; the shipped `validateSharedRecord` still rejects a county record at a slot name (`'slot'`); the native listing is a new command the old binary never calls; the old `icloud_remove_all` removed four fixed names and `.tmp/*`. Stated consequences: an older peer ignores both subdirectories, its Remove synced files leaves them in place (Remove on a current device clears them), and its watcher fires an extra harmless check on every county record change.

### 11.4 `.claude/rules/*.md` `paths` to extend in the same change (CLAUDE.md v1.0.32)

- `security.md`: already gates `frontend/src/lib/icloud/**`, `src-tauri/src/icloud.rs`, `src-tauri/src/lib.rs`, `frontend/src/lib/storage.ts`, `frontend/src/lib/barChart/**`, `frontend/src/lib/countyDayObs*.ts`, `frontend/src/lib/regionCode.ts`, `backend/routers/**`; the new modules land inside those globs. No change owed, verified by name.
- `testing.md`: gains `frontend/src/lib/regionCode.fixture.json` (a committed fixture two suites read).
- `docs-and-website.md`: path-gated on `docs/**`, `README.md`, `website/**`; the HELP, privacy, README and website edits load it.

---

## 12. Copy surfaces (by purpose; The Designer drafts, the user approves, then The Engineer writes; FR-34 to FR-36)

In-app: `icloudCopy.ts` (the section description; the turn-on note's what-goes-up item, which must name bar-chart files and, per Q1, the day answers, and must no longer say nothing else goes; the Remove synced files listed contents and outro, accounting for county files; the Targets Remove confirmation title, body and confirm button; the clear-all label, its confirmation in both variants, its cannot-activate reason, its partial-failure text; the `'too-large'` reason, which quotes a number and should state the property); `targetsCopy.ts` (`ADD_FILE_DETAIL_TAIL` retired or rewritten; origin, state, not-yet-downloaded and replaced text for the section); screen-reader text for the new control and dialogs.

Published: `docs/HELP.md` (`:424`, the iCloud section `:739-751`, `:820` if Q1, a sentence for the control), `PRIVACY_POLICY.md` (`:13, 16, 32, 65, 67, 70`) mirrored in `website/privacy.html` with the effective date, `README.md:59` and `website/index.html:128-129` (one proposed sentence, shown as rendered tailnet pages, written only on an explicit yes), `appstore/LISTING.md:73, 192-202`, `appstore/REVIEW_NOTES.md`, the release notes, `ACCESSIBILITY.md:15` (Q7), `CHANGELOG.md`. Every code comment that says the file or the cache "is never synced" (`barChartFilesChanged.ts:7-16`, `countyDayObsCache.ts` header, `storage.ts:91-100`'s reasoning stays true and is left, `icloud.rs:21-22, 1386` "two tiny record files") is swept from the SOURCE, per the paragraph-scope rule.

---

## 13. Migration plan (ordered steps for The Engineer)

1. `lib/regionCode.fixture.json`; Rust `County`, `DeviceId`, `SyncItem`, `ItemArg` and the two Rust tests; TS `assertRegionCode` in the item wrappers and its test. `cargo check` for both mac targets and `aarch64-apple-ios`; confirm the Windows target still resolves.
2. `icloudRecord.ts`: `RecordKind`, `county`, the two validators, `serializeRecord`; `icloud.rs` `RecordFile.county`; goldens pinned both sides; `icloudRecord.test.ts` rows.
3. `icloud.rs`: refactor the seven slot commands onto `SyncItem` (existing tests green, parity pins unchanged); the seven item commands; `icloud_remove_all` widened; `lib.rs` registrations; `icloudNative.ts` / `icloudNativeTypes.ts` wrappers and types; the native fake in the test harness.
4. `storage.ts`: `BarChartFileMeta` fields and normalizer rules; `writeBarChartFile` origin; the four links; `storage.barcharts.test.ts` and the interleaving row. `backend/routers/barcharts.py` bulk delete and its tests.
5. `icloudSync.ts` pref fields and `normalizePref`; `icloudState.ts` additions; the county pass in `lib/icloud/countySync.ts` wired into `runCheck`; the epoch subscription; the five actions; `countySync.test.ts`; the excluded-strings rows re-scoped.
6. `barChartImport.ts` (`origin`, `barChartSaved`, `clearAllBarChartFiles`); `barChartFilesChanged.ts` header.
7. `icloudPaths.parity.test.ts` inversion (bar-chart block); `targetsPublishedClaims.test.ts` roster row; `entryChunk.test.ts` legs.
8. Components per The Designer's spec: `TargetsBarChartFile.tsx` (origin, states, Remove confirmation with sync on, Download now), `Settings.tsx` (the clear-all control, the Remove synced files contents); their tests.
9. `npm run build`, `npm run typecheck`, the backend suite; the faked-Mac tailnet preview for the platform-gated UI (the Mac is not signed into iCloud, so the container is exercised only through the fakes).
10. Copy: The Designer's approved table written; HELP, privacy (mirrored, date moved), listing, README/website proposal pages; the source comment sweep; the published-claims rows.
11. Version four-file set, `CHANGELOG.md`.
12. **(Q1, only after the copy review confirms it)** `countyDayObsCache.ts` `mergeSharedSnapshot` / `awaitDayObsWrites` and the header rewrite; the recommended eviction fix or its written non-action.
13. **(Q1)** `lib/icloud/dayObsSync.ts`, the day-obs pass, `pref.dayObs`, `clearWithSync('ebird')`'s snapshot removal; `dayObsSync.test.ts`; the day-cache parity block inverted; the merge cost measured and recorded.
14. **(Q1)** the day-answers copy on every surface; otherwise the surfaces name the files only and the block in step 7 is kept for the day cache.

---

## 14. Design decisions

1. **Per-county records, not one manifest record, for the files**: the shipped reconciliation table, tombstones and pending-clear bookkeeping apply verbatim per county (section 5); a file set needs no merge.
2. **A `RecordKind` and a native `SyncItem`, never a third `Slot`**: `SLOTS`, `FileSlot`, `readMeta`, the Rust enum, the key structs and every `{ ebird, ml }` literal stay untouched; the seven slot commands keep their signatures (sections 4.2, 9.1).
3. **One listing command per kind** in place of per-item record reads, with a hostile-container bound that is not a user quota (sections 5.2, 10.1).
4. **The tri-state record** (absent / present-undownloaded / read) so a device never pushes over a record it has not read (section 5.2).
5. **`isWritableTime` on the county push with the adopting-check fallback, and the manifest time rewritten to match** (section 5.4), so an adopted file is pushed once and never pulled back.
6. **Names in the container from the validated code only**, subdirectories per kind, staging flattened; the region-code predicate twinned as a byte check with a shared fixture and per-side enforcement tests (sections 3, 4.4).
7. **The day cache as per-device snapshots merged on read**, replacing the PRD's one merged copy, which cannot converge under a per-device budget (section 8.1); the merge gated on a present backup so a synced clear holds; digests remembered per peer so an unchanged snapshot is never re-downloaded.
8. **Content of the county files never crosses IPC; the day-obs snapshot does** (`pull_item` `'text'` mode), because the merge must happen in the module that owns the store (section 9.3).
9. **`DAY_OBS_SHARED_MAX_BYTES` derived from the local budget's adversarial maximum**, not borrowed from `MAX_BYTES` (section 10.1).
10. **No `clearDerived.ts` row for the family; no `filesChanged` bump anywhere in the feature** (sections 5.7, 6.6).
11. **The clear-all removes locally first and reports survivors from the manifest it wrote**, the markers following as a separate best-effort step with a pending memo (sections 6.2, 6.5).

---

## 15. Open questions: what each default costs to reverse

| Q | Default taken here | If reversed |
|---|---|---|
| 1 day cache sync | yes, as per-device snapshots (section 8) | section 8.5: steps 12-14 are not built; the exclusion block is kept; copy names files only |
| 2 clear-all confirms with sync off | yes | one branch in the Settings handler (section 6.5); no data change |
| 3 privacy "delete your stored files" sentence | revisited at the copy review | copy only |
| 4 adoption time fallback | check time, file still pushed, manifest time rewritten | drop the `stampBarChartOrigin` time rewrite and the fallback; the push then refuses an unwritable time and the county shows `'error'` (not recommended: it strands a file) |
| 5 backup clear removes every snapshot | yes | remove the `removeItems('day-obs')` call from `clearWithSync`; each device still removes its own at its next check |
| 6 older peer | no shim | none needed either way |
| 7 `ACCESSIBILITY.md` | copy review | copy only |

---

## 16. Risks and Engineer verify-items

- **V1 (section 3):** the metadata query matches records in a subdirectory of `Documents/`. Verify on the signed build with one county record; fallback flat names.
- **V2:** `read_dir` over the ubiquity container lists undownloaded items as `.<name>.icloud` placeholders (the shipped `placeholder_path` assumption, now load-bearing for the listing); confirm on iOS that a never-downloaded county record appears and downloads when asked.
- **V3:** the listing's cost at N ≈ 100 coordinated record reads inside `COMMAND_TIMEOUT`; if it approaches the budget, read records uncoordinated (they are whole-file atomic replaces) and record the decision.
- **V4 (section 8.3):** the merge's main-thread cost for a 10 MB snapshot, measured once and written down; the worker escalation named.
- **V5:** `awaitDayObsWrites` before push closes the drain but not a flush that starts during the native read; the peer's parse failure covers it. Confirm the fake exercises a snapshot written mid-flush.
- **V6:** with the merge, a device's day-cache key set can include counties from a peer's backup that this device's backup lacks (the two backups differ only until the file sync converges); the Targets tab offers only counties in the local backup, so the extra entries are dead weight until eviction. Stated, accepted.
- **V7:** the FR-30 assertion imports `MAX_UPLOAD_BYTES` from `uploadGuard.ts` (entry graph) into a test only; no production import crosses that line.
- **V8:** the real cross-device behaviour (QA-36, QA-37) is the user's, after TestFlight; every row here is proven under the fakes and recorded as Partial until then.
- **Risk, stated and accepted:** a stale device's snapshot lingers in the container until Remove synced files from iCloud; a device that was removed from the account never cleans up after itself, exactly as its data-file records do not today.
