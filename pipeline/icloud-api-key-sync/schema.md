# Schema: iCloud API Key Sync

**Feature:** icloud-api-key-sync
**Date:** 2026-09-01
**Stage:** 3, The Architect
**Source:** prd.md (approved), strategic-brief.md, `pipeline/icloud-sync/schema.md` (v1.0.11, the cumulative schema this one extends)
**Ships as:** 1.0.12

## Path

**Incremental.** `pipeline.config.json` exists (React + Vite + Tailwind + shadcn/ui, python-fastapi for web/Pi, Tauri v2 desktop with a Rust native half, vitest). There is no database: the schema is the set of device-local JSON documents under `AppLocalData/data/` plus the records in the app's private iCloud ubiquity container, documented cumulatively in `pipeline/icloud-sync/schema.md`. This feature adds fields to one existing document (`api-keys.json`), fields to one existing settings object (`icloud-sync` in `settings.json`), one new fixed-name record in the container, three native commands, and one entry-safe signal module. Nothing is rewritten. Every modification to a shipped structure is optional, backward compatible, and called out with its risk and migration story below.

## Architect assessment

Three facts from the code, each load-bearing:

- **A received key reaches every networked feature with no mirror and no relaunch, because every Tauri service reads the key per request.** `weatherService.ts`, `mapService.ts`, `checklistService.ts`, `tideService.ts`, `taxonomyService.ts` and `regionInfo.ts` each call `storage.getApiKey(...)` at the start of a request (verified by grep; there is no cached key anywhere in the transport). So FR-23's "next request uses it" is satisfied by landing the key in `api-keys.json` through the seam. What does NOT re-read on its own is the per-mount readers: `App.tsx`'s missing-key notices (`fetchKeyStatus`), `MapExplorer.tsx` (`hasEbirdKey`, keyed on a `keysVersion` prop), `BirdingStats.tsx` (`hasEbirdKey`, mount only) and `Settings.tsx`'s own `keys` state (mount only). Those need a signal, and the app already has half of one: `App.tsx` holds `keysVersion` state bumped by `fetchKeyStatus`, which Settings triggers through `onKeysSaved`. That is exactly the pre-1.0.11 `filesVersion` shape, and it gets the same fix: an entry-safe epoch module.
- **The native record-read path already downloads an undownloaded record inside the coordinated read.** `icloud_read_record` in `icloud.rs` comments it: "A coordinated read of an undownloaded record downloads it first (the record is a few hundred bytes); offline that wait is what the command timeout bounds." So the answer to OQ-2 is: yes, the key record can be a `.keys.record.json.icloud` placeholder on a device (any container item can be evicted on macOS with Optimize Mac Storage, and a fresh iOS device sees placeholders), and no, the controller never sees "present but not downloaded" as a text-less success. It sees either the text (downloaded on demand within the 8 s command timeout) or `'timeout'`. The row reads "Syncing" during the read and "Could not sync" with Retry after a timeout, which is OQ-2's default exactly.
- **No existing native command can write a record without a csv, and none deletes one item.** `icloud_push` builds its record from the local csv it reads; `icloud_push_cleared` deletes the csv first; `icloud_remove_all` deletes the fixed four. So "no new command" is not achievable. The design adds three small commands that compose the existing helpers (`container_documents`, the record-read closure, `atomic_container_write`, `coordinated_delete`, `ubiquity_flags`, `sanitize_label`, `valid_device_id`, `blocking`) and leaves every shipped command byte-identical. No capability change: app commands are not capability-gated in Tauri v2 (evidence: none of the eight shipped `icloud_*` commands appears in any file under `src-tauri/capabilities/`, and they work in 1.0.11).

## Current Schema State

The complete cumulative state after this feature. This section is the source of truth for the next Architect.

```
AppLocalData/data/                               (TauriStorage, macOS / iOS / Windows)
  api-keys.json        ApiKeysDoc (below)          never synced as a file; its two values ride
                                                   the shared key record only while the key switch is on
  settings.json        generic key store; "icloud-sync": ICloudSyncPref (below); never synced
  metadata.json        { ebird: FileMetadata | null, ml: FileMetadata | null }   unchanged (v1.0.11)
  ebird-backup.csv     the ebird file slot                                       unchanged
  ml-export.csv        the ml file slot                                          unchanged
  map-style/*.json, replay.json, derived caches                                  unchanged, never synced

iCloud container iCloud.com.dtgibson.snowraven, Documents/   (user's own account, both App IDs)
  ebird.record.json    SharedRecord (file or cleared)         unchanged (v1.0.11)
  ebird-backup.csv     bytes the record describes             unchanged
  ml.record.json       SharedRecord                           unchanged
  ml-export.csv                                               unchanged
  keys.record.json     SharedKeyRecord (NEW, this feature)    present only while at least one device
                                                              has the key switch on, or until removed
  .tmp/                staging for atomic writes (<deviceId>-<targetName>); never read by a peer
```

### `api-keys.json` (device-local, `API_KEYS_PATH`, chained on its own `docChains` key)

```
ApiKeysDoc {
  ebird?:       string          // the key value, exactly as saved; absent = no key   (shipped shape)
  openweather?: string          //                                                     (shipped shape)
  meta?: {                      // NEW, optional, per key slot
    ebird?:       ApiKeyMeta
    openweather?: ApiKeyMeta
  }
}

ApiKeyMeta =
  | { state: 'key';     changedAt: string; origin?: FileOrigin; replacedBySyncAt?: string }
  | { state: 'cleared'; clearedAt: string; origin: FileOrigin }
```

- Times are ISO 8601 UTC with milliseconds (`new Date().toISOString()`), the same form as `FileMetadata.uploadedAt`; compared as numbers from `Date.parse`.
- `FileOrigin` is the shipped `{ deviceId: 32 lowercase hex, label: string, platform: 'mac' | 'iphone' | 'ipad' }`.
- A value with no `meta` entry is an **untimed key** (every key saved before 1.0.12). A value with `meta.state === 'key'` and no `origin` is a **timed key with no origin** (saved on a device that had not yet minted a device id; the first push stamps it).
- `meta.state === 'cleared'` with no value is a **local cleared marker** (FR-12, FR-28, OQ-8): it persists until the slot changes again. Its `origin` is this device for a Clear made here, or the peer for a marker applied from iCloud (which is what lets the row say "Cleared from <device>").
- `replacedBySyncAt` is set only by a synced apply that replaced a different local key (FR-41); any user save writes a fresh `meta` without it, exactly as `writeFile` does for files.

**Validator on load** (`normalizeApiKeysDoc`, in `storage.ts`, applied by every reader of the document; no `Map`/`Set`/`shift`/`splice`, `cacheInventory.test.ts`):

| Field | Rule | On failure |
|---|---|---|
| `ebird` / `openweather` | string, length >= 1 (today's `value && value.length > 0`) | absent |
| `meta` | object | whole `meta` dropped (every key reads untimed) |
| `meta[slot]` | object with `state` in `{'key','cleared'}` | that entry dropped |
| `state:'key'` `changedAt` | string, `Number.isFinite(Date.parse(v))` | entry dropped (key reads untimed) |
| `state:'key'` `origin` | the `normalizeMetaEntry` origin guard (32 hex id, string label, platform in set) | `origin` dropped (timed, no origin) |
| `state:'key'` `replacedBySyncAt` | string | field dropped |
| `state:'cleared'` `clearedAt` | string, parseable | entry dropped |
| `state:'cleared'` `origin` | same origin guard, required | entry dropped |
| consistency | `state:'key'` with no value | entry dropped |
| consistency | `state:'cleared'` with a value present | entry dropped (the value wins; it reads untimed) |

A change time is **never defaulted to now on read** (FR-12). The value is not bounds-checked on load: a local key outside the FR-19 bounds keeps working locally; only the upload refuses it (below).

### `settings.json` key `icloud-sync` (device-local, `SETTINGS_PATH`, one `setSetting` link per save, never synced)

```
ICloudSyncPref {
  version: 1
  enabled: boolean                          // the file switch                                  (v1.0.11)
  deviceId: string | null                   // 32 lowercase hex, minted on first file-sync enable (v1.0.11)
  lastCheckAt: string | null                                                                    (v1.0.11)
  knownShared?: { ebird: { filename } | null, ml: { filename } | null }                          (v1.0.11)
  pendingClears?: Partial<Record<'ebird' | 'ml', string>>                                       (v1.0.11)
  keysEnabled?: boolean                     // NEW the key switch; default false; READ AS FALSE when enabled is false (FR-06)
  keysEverEnabled?: boolean                 // NEW default false; set true on the first key enable, never cleared (FR-40)
  keyRemovalPending?: boolean               // NEW default false; a switch-off or Remove that could not reach iCloud (FR-33)
  knownKeyRecord?: boolean                  // NEW default false; iCloud is known to hold keys.record.json (FR-34, FR-36)
  knownSharedKeys?: {                       // NEW default absent; per-slot state of the record at the last CONTENT read
    ebird:       KnownKeySlot | null
    openweather: KnownKeySlot | null
  }
}
KnownKeySlot = { state: 'key' | 'cleared'; at: string; originId: string }   // never a value
```

`normalizePref` gains one shape check per field (boolean else default; `KnownKeySlot` needs `state` in set, parseable `at`, `originId` matching `DEVICE_ID_RE`, else that slot is null). `version` stays 1: every addition is optional and a 1.0.11 reader ignores unknown keys. `knownSharedKeys` exists so the rows can be honest offline: `clearPending` (FR-30) and "Waiting to upload" (FR-27) after a relaunch are derived by comparing the local entry with the last-known shared slot, without a key-only memo document.

### `metadata.json`, the two csv files, `map-style/`, `replay.json`, derived caches

Unchanged from v1.0.11 (see that schema). `FileMetadata { filename, uploadedAt, origin?, replacedBySyncAt? }`.

### Container: file records (unchanged)

`Documents/<slot>.record.json`, `slot` in `{ebird, ml}`, `SharedRecord` exactly as v1.0.11 (`version: 1`, `slot`, `state: 'file' | 'cleared'`, `filename`, `uploadedAt` / `clearedAt`, `origin`, `byteLength`, `sha256`), validated by `icloudRecord.ts#validateSharedRecord`, written only by `icloud_push` / `icloud_push_cleared`.

### Container: the shared key record (NEW)

`Documents/keys.record.json`, UTF-8 JSON, written whole, at most 4,096 UTF-16 code units of text (the native read refuses a file over 16 KB on disk before reading it, as for file records). Fixed name, a constant on both sides (`KEYS_RECORD_NAME`), never derived from content (FR-17).

```
SharedKeyRecord {
  version: 1
  kind: 'keys'                              // binds the record to its name, as `slot` does for file records
  slots: {
    ebird?:       SharedKeyEntry            // absent = nothing held for that slot
    openweather?: SharedKeyEntry
  }
}
SharedKeyEntry =
  | { state: 'key';     value: string; changedAt: string; origin: RecordOrigin }
  | { state: 'cleared'; clearedAt: string; origin: RecordOrigin }
RecordOrigin = { deviceId: string; label: string; platform: 'mac' | 'iphone' | 'ipad' }   // the shipped shape
```

What it mirrors from the file records, field for field: `version` (same value 1), a name-binding discriminator (`kind: 'keys'` where a file record has `slot`), `state` per entry with the `'cleared'` arm identical in shape (`clearedAt` + `origin`), `origin` in the shipped `RecordOrigin` form, and the same time form. It carries no `filename`, `byteLength` or `sha256` because there is no companion file: the record IS the payload, so a whole-file atomic replace is the commit point and no digest is needed.

**Bounds** (FR-19; named constants in `keyRecord.ts` and `icloud.rs`, pinned equal by the parity test):

| Field | Bound |
|---|---|
| record text | <= 4,096 UTF-16 code units (`MAX_RECORD_TEXT`, shared with file records); on-disk file <= 16 KB (`MAX_RECORD_BYTES`) |
| `version` | exactly 1 |
| `kind` | exactly `'keys'` |
| slot names | exactly `ebird`, `openweather` (`KEY_SLOTS`); unknown keys under `slots` ignored |
| `state` | `'key'` or `'cleared'` |
| `value` | string of 1 to 128 UTF-16 code units (`MAX_KEY_VALUE = 128`), every code unit in `0x21..0x7E` (`KEY_CHAR_MIN`, `KEY_CHAR_MAX`): printable ASCII, no space, no control, no non-ASCII. eBird keys are short alphanumeric tokens and OpenWeather keys are 32 hex characters; 128 is generous headroom (OQ-9). |
| `changedAt` / `clearedAt` | `isPlausibleTime`: string of 1 to 64 code units, `Date.parse` finite, not before 2000-01-01, not more than 24 h after the reader's clock |
| `origin.deviceId` | `DEVICE_ID_RE` (32 lowercase hex) |
| `origin.label` | `isValidLabel`: 1 to 64 code units, no control characters |
| `origin.platform` | in `PLATFORMS` |

**Validator, TypeScript** (`keyRecord.ts#validateKeyRecord(text, nowMs): KeyRecordVerdict`, pure, exhaustive, never throws):

```
KeyRecordVerdict =
  | { ok: true;  slots: Record<KeySlot, SharedKeyEntry | null>; rejected: Partial<Record<KeySlot, string>> }
  | { ok: false; reason: string }         // envelope failure: BOTH slots read as absent (FR-20)
```

Envelope, in order: `null`/`undefined` text -> `'absent'`; non-string -> `'not-text'`; length > 4,096 -> `'oversized'`; JSON parse failure -> `'malformed-json'`; not a plain object -> `'not-an-object'`; `version !== 1` -> `'version'`; `kind !== 'keys'` -> `'kind'`; `slots` not a plain object -> `'slots'`. Per slot: absent -> `null` (a valid nothing); not a plain object -> rejected `'entry'`; `state === 'key'`: `value` fails `isValidKeyValue` -> `'value'`, `changedAt` fails `isPlausibleTime` -> `'changedAt'`, `origin` fails `validOrigin` -> `'origin'`; `state === 'cleared'`: `'clearedAt'`, `'origin'` likewise; any other state -> `'state'`. A rejected slot is `null` in `slots` and named in `rejected` by its rule word only. **A reason string is a rule name and never contains a value** (FR-21). The controller logs at most one `console.warn` per slot naming the slot and the rule.

`isValidKeyValue(v)`: `typeof v === 'string' && v.length >= 1 && v.length <= 128` and every `charCodeAt` in `[0x21, 0x7e]`.

**Sanitize-on-write, TypeScript chokepoint** (`keyRecord.ts#sanitizeKeyEntryForWrite(entry, fallbackLabel): SharedKeyEntry | null`, called by the controller for every entry it hands to the native layer): `origin.label` through `sanitizeLabel`, `origin.platform` outside the set -> `'mac'` (the shipped `recordOrigin` rule), times passed through unchanged (they are this app's `toISOString()` output or a validated shared time), and a `value` that fails `isValidKeyValue` returns **null**: a key is a secret and cannot be "cleaned" into a different key, so it is refused, never truncated. The controller treats a null as "this slot cannot sync" (row: Could not sync, reason `'key-shape'`, no upload of that slot, no log of the value). `serializeKeyRecord(slots)` emits the exact key order the Rust writer emits (below), for the round-trip and golden tests.

**Validator and sanitizer, Rust** (`icloud.rs`, the write chokepoint `icloud_write_keys`): the same bounds as constants (`KEYS_RECORD_NAME`, `MAX_KEY_VALUE_LEN: usize = 128`, `KEY_CHAR_MIN: u8 = 0x21`, `KEY_CHAR_MAX: u8 = 0x7E`, `MAX_TIME_UNITS: usize = 64`, `MAX_LABEL_UNITS` shared). Per entry: `state` in the set else `Err("unknown")`; `value` present, 1..=128 bytes, every byte in `0x21..=0x7E` (ASCII, so bytes equal code units) else `Err("unknown")`; time present, 1..=64 units, ASCII printable else `Err("unknown")`; `origin.device_id` through `valid_device_id` else `Err("unknown")`; `origin.label` through `sanitize_label` (the only transformative step); `origin.platform` in the set else `Err("unknown")`. Rust **refuses** rather than rewrites anything but the label, because the TypeScript chokepoint has already produced a valid entry and a disagreement is a programming error to fail closed on. On read, Rust does what it does for file records and no more: regular-file check, size bound, raw text to the frontend; it never parses the record (one parser per language boundary, no second opinion to drift). No new error code is introduced; every `Err` is a member of the closed union in `icloudNativeTypes.ts`.

**Serialized field order** (both writers, for the golden test): `{"version":1,"kind":"keys","slots":{"ebird":{"state":"key","value":…,"changedAt":…,"origin":{"deviceId":…,"label":…,"platform":…}},"openweather":{"state":"cleared","clearedAt":…,"origin":{…}}}}`; an absent slot is omitted, never `null`.

## Changes in This Feature

### Added

- **`api-keys.json` `meta` object** (optional, per slot; shape and validator above).
- **`settings.json` `icloud-sync` fields** `keysEnabled`, `keysEverEnabled`, `keyRemovalPending`, `knownKeyRecord`, `knownSharedKeys` (all optional, defaults above). Chosen over a new document for the reason the file feature chose it: one existing chain, zero `docChains` change, never synced.
- **Container record** `Documents/keys.record.json` (`SharedKeyRecord`).
- **Storage seam methods** on `StorageAdapter`: `getApiKeyEntries`, `clearApiKeyWithMarker`, `applySyncedKey`, `applySyncedKeyClear`, `stampApiKeyEntry` (contracts below). `WebStorage` implements each as `Promise.reject(new Error('not supported'))`, unreachable behind the gate, exactly as the three file-sync methods do.
- **Frontend modules**: `lib/icloud/keyRecord.ts` (pure: types, bounds, validator, sanitizer, serializer), `lib/icloud/keyReconcile.ts` (pure: the table), `lib/keysChanged.ts` + `lib/useKeysEpoch.ts` (entry-safe signal, the `filesChanged.ts` shape), key strings in `lib/icloud/icloudCopy.ts`, the key pass and key actions in `lib/icloud/icloudSync.ts`, three wrappers in `lib/icloud/icloudNative.ts`, types in `icloudNativeTypes.ts`, state and actions in `icloudState.ts`.
- **Native commands** `icloud_read_keys`, `icloud_write_keys`, `icloud_remove_keys` in `icloud.rs`, registered in `lib.rs` under the same Apple `cfg` as the eight shipped ones.
- **Tests** listed under *Tests*.

### Modified

| Structure | Original | New | Reason | Risk and migration |
|---|---|---|---|---|
| `TauriStorage.setApiKey(service, value)` | writes `doc[service] = value` | `setApiKey(service, value, origin?)`: also writes `doc.meta[service] = { state: 'key', changedAt: now, origin? }` (no `replacedBySyncAt`) | FR-12: every save stamps a change time and, when the device has an id, this device's origin | Additive optional argument; the value write is unchanged. Runs on every Tauri build (the seam has no platform branch; on Windows the field is inert). Web ignores the argument. Existing untimed keys are untouched until their next save. |
| `TauriStorage.deleteApiKey(service)` | `delete doc[service]` | also `delete doc.meta?.[service]` | FR-31: a key-switch-off Clear removes the entry entirely, marker included | Additive; a document with no `meta` behaves as before. |
| `TauriStorage.getApiKey` | reads `doc[service]` | reads `normalizeApiKeysDoc(doc)[service]` | one normalizer for every reader of the document | Byte-equivalent for every shipped document (values are still `string` at the top level; `meta` is a sibling key the getter never reads). |
| `ICloudSyncPref` (`icloud-sync`) | five fields | plus the five optional fields above | FR-06, FR-33, FR-36, FR-40 | Optional; `normalizePref` defaults each; a 1.0.11 document reads as key switch off, never on, nothing pending. |
| `ICloudState` / `ICloudActions` (`icloudState.ts`) | file-only | plus the key fields and six key actions (below); `NOOP_ACTIONS` grows to match | the store is the only thing Settings reads | In-memory only. |
| `ICloudNativeLayer` (`icloudNativeTypes.ts`) | eight commands | plus `readKeys`, `writeKeys`, `removeKeys` | the controller's seam over native | The fake layer in tests grows three methods. |
| `icloudSync.ts` `runCheck` | file pass | file pass, then the key pass (at most one record read and one record write, NFR-07); `disable()` cascades to `disableKeys()` first (FR-07); `boot()` installs the pending-removal retry | FR-43: one check, both passes, one `lastCheckAt` | Every 1.0.11 controller test passes unchanged (NFR-10); the key pass is skipped entirely when `keysEnabled` is false except for the status-only existence read (FR-36) and the removal retry (FR-33). |
| `icloud.rs` `icloud_read_record` | inline record-read closure | the closure body extracted to `read_record_text(docs, name)`; the command calls it | one read path for every record | Behavior-identical extraction; the file suites are the proof. |
| `App.tsx` `keysVersion` | `useState(0)` bumped inside `fetchKeyStatus` | `const keysVersion = useKeysEpoch()`; the key-status effect depends on it; `onKeysSaved={notifyKeysChanged}` | FR-23 / FR-24 without a relaunch, through one signal | Every prop-threaded consumer (`MapExplorer`) keeps working unchanged, exactly as `filesVersion` did in 1.0.11. |
| `Settings.tsx` | `keys` loaded on mount; key rows have no sync line; Clear is instant | keys re-read on the keys epoch; `KeyRow` gains `sync?: KeySlotView \| null` and `onRetry`; a second switch in the iCloud section; Clear with the key switch on confirms and routes through `clearKeyWithSync` | FR-01, FR-28, FR-38 to FR-42 | The Designer owns the layout (Stage 4); the contract is below. |
| `BirdingStats.tsx` | `hasEbirdKey` read on mount | adds `useKeysEpoch()` to that effect's deps | FR-24: missing-key behavior without a relaunch (a pre-existing gap, like FR-35 was) | One dependency. |
| `entryChunk.test.ts`, `icloudPaths.parity.test.ts`, `icloudSync.test.ts` | | extended (see *Tests*) | | |
| Docs and published statements | | `PRIVACY_POLICY.md`, `website/privacy.html`, `docs/HELP.md`, `README.md`, `website/`, `appstore/LISTING.md`, `ACCESSIBILITY.md` re-read | FR-48 to FR-52 | Parity tests stay green; no em dash. |
| Versions | 1.0.11 | 1.0.12 in `frontend/package.json` and `src-tauri/tauri.conf.json`; `CHANGELOG.md` `## [1.0.12]` | FR-53 | |

### Unchanged

`metadata.json` and the three file-sync seam links; `WebStorage` behavior for keys (web/Pi keep `/settings/keys`); `backend/.env` and the Python backend; Windows, web and Pi (the Apple `cfg` and `showICloudSync()` keep them byte-equivalent apart from the version); the eight shipped native commands and their signatures; `icloud_remove_all` (deletes the fixed four and sweeps `.tmp/`; it never names `keys.record.json`, which is FR-35); the `NSMetadataQuery` predicate `*.record.json` (it already matches `keys.record.json`, so change detection for the key record costs no native change); the fs capability scope (`$APPLOCALDATA/**`; the container is reached only through commands); the container id, entitlements, profile and release overlay; the `docChains` key set (three documents, no fourth); the legacy keyring commands `get_api_key` / `set_api_key` / `delete_api_key` in `lib.rs` (dead since the fs-plugin storage landed, not called by any frontend code, left alone); the file reconciliation table and every 1.0.11 test.

## Storage seam contract (`storage.ts`, `TauriStorage`)

All key methods are links on the `API_KEYS_PATH` chain; rule 1 (a link never awaits another chained op) and rule 2 (a failed link rejects only its caller) hold. Inside a link only `readJson` / `writeJson` are used.

```
type KeySlot = 'ebird' | 'openweather'

ApiKeyEntry =
  | { state: 'key';     value: string; changedAt: string | null; origin: FileOrigin | null; replacedBySyncAt: string | null }
  | { state: 'cleared'; clearedAt: string; origin: FileOrigin }
ApiKeyEntries = Record<KeySlot, ApiKeyEntry | null>

// The guard every sync-originated link takes: the local entry the controller decided against.
ExpectedKeyEntry =
  | { state: 'key'; value: string; changedAt: string | null }
  | { state: 'cleared'; clearedAt: string }
  | null
```

| Method | Link body | Returns |
|---|---|---|
| `getApiKeyEntries()` | `normalizeApiKeysDoc(readJson)` -> entries for both slots (untimed keys read `changedAt: null, origin: null`) | `ApiKeyEntries` |
| `setApiKey(slot, value, origin?)` | `doc[slot] = value; doc.meta[slot] = { state: 'key', changedAt: now, ...(origin && { origin }) }` | void |
| `deleteApiKey(slot)` | `delete doc[slot]; delete doc.meta?.[slot]` | void |
| `clearApiKeyWithMarker(slot, { clearedAt, origin })` | `delete doc[slot]; doc.meta[slot] = { state: 'cleared', clearedAt, origin }` | void |
| `applySyncedKey(slot, { value, changedAt, origin }, expect, replaced)` | if `sameLocalEntry(current, expect)` is false return false (a user action landed, FR-26); else `doc[slot] = value; doc.meta[slot] = { state: 'key', changedAt, origin, ...(replaced && { replacedBySyncAt: now }) }`; return true | boolean |
| `applySyncedKeyClear(slot, { clearedAt, origin }, expect)` | same guard; then the `clearApiKeyWithMarker` body with the PEER's marker | boolean |
| `stampApiKeyEntry(slot, { changedAt, origin }, expectValue)` | if the current entry is not a key with `value === expectValue` return false; else `doc.meta[slot] = { state: 'key', changedAt, origin, ...(keep replacedBySyncAt) }`; the value is never touched | boolean |

`sameLocalEntry(a, b)`: both null, or same `state` and, for keys, same `value` and same `changedAt` (null equal to null only), or, for markers, same `clearedAt`. The comparison happens in memory inside the seam; nothing is logged.

`stampApiKeyEntry` serves three cases with one method: the seed stamp (now + this device, FR-13), the adopt stamp (the shared entry's time and origin, OQ-3), and the origin stamp after a push of a timed key that had no origin (the `stampFileOrigin` analogue).

**Settings passes `origin` to `setApiKey`** whenever the store has a device id: `ics.deviceId ? { deviceId: ics.deviceId, label: ics.deviceLabel, platform: ics.platform ?? 'mac' } : undefined`. Label sanitization happens at the push chokepoint, not here (the local document may hold the raw device name, as `metadata.json` does).

## In-memory store and actions (`icloudState.ts`, entry-safe)

```
ICloudState gains:
  keySyncEnabled: boolean                 // the effective key switch (persisted keysEnabled && enabled)
  keySyncEverOn: boolean                  // FR-40
  keyRecordExists: boolean                // FR-34: show "Remove synced keys from iCloud"
  keyRemovalPending: boolean              // FR-33: the control stays visible; the retry is armed
  keySlots: Record<KeySlot, KeySlotView | null>   // null = no sync line on that row

KeySlotState = 'up-to-date' | 'syncing' | 'waiting-to-upload' | 'unavailable' | 'off' | 'error'
KeySlotView {
  state: KeySlotState
  fromThisDevice: boolean
  origin?: { label: string; platform: OriginPlatform }
  changedAt?: string        // FR-38 provenance time, from the local meta
  replacedAt?: string       // FR-41: "Replaced by the key from <origin>, changed <replacedAt>" while set
  clearedAt?: string        // FR-42: the row holds no key; "Cleared from <origin>, <clearedAt>" while set
  clearPending?: boolean    // FR-30: "This clear has not reached iCloud yet."
  reason?: string           // one sentence for 'error'; from the closed reason table, never a value
}

ICloudActions gains (NOOP defaults before the controller loads):
  enableKeys(): Promise<void>                 // FR-04 (after the note's Turn on)
  disableKeys(): Promise<void>                // FR-32
  removeKeysFromICloud(): Promise<void>       // FR-34
  clearKeyWithSync(slot: KeySlot): Promise<void>   // FR-28 (after the confirmation)
  retryKey(slot: KeySlot): Promise<void>      // the Retry button
  keySaved(slot: KeySlot): void               // Settings saved a key locally with the key switch on: row "Syncing", check
```

The five row states are the FR-39 subset; `'in-icloud-not-downloaded'` and Download now do not exist for keys (OQ-2). Every string the row renders is built in `icloudCopy.ts` from the closed label set plus the origin label, the platform word and the formatted time, never from a value (FR-44). New copy: the switch label "Sync API keys" (OQ-6), the "turn on iCloud Sync first" reason, the six-element enable note (FR-04), the Clear confirmation, the Remove confirmation, the FR-41 and FR-42 lines, the FR-30 sentence, and one reason each for `'key-shape'` ("This key has characters iCloud sync cannot carry.") and the existing native codes.

## Native layer additions (`icloud.rs`, macOS + iOS)

The fixed-name allowlist grows by one: `const KEYS_RECORD_NAME: &str = "keys.record.json";` beside the `Slot::record_name()` names. The `Slot` enum is untouched, so no shipped command can be pointed at the key record by argument.

| Command | Args | Returns | Body |
|---|---|---|---|
| `icloud_read_keys` | `mode: 'status' \| 'record'` | `{ record: string \| null, status: { present, downloaded, downloading, uploaded, uploading } }` | `container_documents()` or `'unavailable'`; `status` from `item_present` + `ubiquity_flags(docs/keys.record.json)` (the same four flags as a csv, so "Waiting to upload" works the same way); `record` is `read_record_text(docs, KEYS_RECORD_NAME)` only when `mode === 'record'`, else null. The `'status'` mode is what FR-36 permits with the key switch off: existence, never content. Inside `blocking`, so the 8 s timeout bounds an on-demand download. |
| `icloud_write_keys` | `deviceId: string, slots: { ebird?: KeyEntryInput, openweather?: KeyEntryInput }` | `{ uploaded: boolean }` | `valid_device_id(deviceId)` else `'unknown'` (it names the staging file); sanitize/refuse each entry as specified above; build `KeyRecordFile { version: 1, kind: "keys", slots }` (serde camelCase, `skip_serializing_if` on absent slots and on the arm-specific fields); `atomic_container_write(docs, KEYS_RECORD_NAME, deviceId, json)`; `uploaded` from `ubiquity_flags`. The key value is used only to build the record; it appears in no `format!`, no log, no error. |
| `icloud_remove_keys` | none | `{ removed: u32 }` | `coordinated_delete(docs, KEYS_RECORD_NAME)`, then remove every `.tmp/*-keys.record.json` staging entry from any device (a crash between staging and rename would leave key values in the container; "the copy is gone" must be exact), never touching the csv or file-record names. |

Reused as-is: `blocking`, `container_documents`, `coordinated_read` via the extracted `read_record_text` (regular-file check, `MAX_RECORD_BYTES`, empty string for an oversized file so the validator rejects it), `atomic_container_write` (staging under `.tmp/<deviceId>-keys.record.json`, coordinated replace), `coordinated_delete` (symlink removed as a link, directory refused), `ubiquity_flags`, `sanitize_label`, `valid_device_id`, `is_control`, `truncate_units`. `icloud_watch` is unchanged and already covers the key record. Registration: three `#[cfg(any(target_os = "macos", target_os = "ios"))] icloud::…` lines in `lib.rs`. `Cargo.toml` unchanged.

Undownloaded record, stated plainly for the Engineer: `item_present` sees the `.keys.record.json.icloud` placeholder; the coordinated read triggers the download and returns the text, or the command times out. The controller never branches on `status.downloaded` for keys; it is returned for logs and for the `uploaded` flag's sibling symmetry only.

## Reconciliation (`keyReconcile.ts`, pure)

```
LocalKeyEntry =
  | { state: 'key';     value: string; changedAt: number | null; originId: string | null }   // null changedAt = untimed
  | { state: 'cleared'; clearedAt: number; originId: string | null }
SharedKeyEntry   // validated, from keyRecord.ts (times as strings; the function parses them once)
KeyDecision = { action: 'none' | 'seed' | 'push' | 'apply' | 'adopt' | 'clear-local'; replaced?: boolean; rule: string }

reconcileKeySlot({ local, shared, deviceId }): KeyDecision
```

Actions: `seed` = stamp the local key with now + this device, then upload it (FR-13); `push` = upload the local entry (key or marker) as it is; `apply` = write the shared key locally with its time and origin (`replaced` true when a different local key existed, FR-41); `adopt` = keep the local value, take the shared entry's time and origin (OQ-3), upload nothing; `clear-local` = remove the local key and store the shared marker locally (FR-24, FR-42).

| local | shared | Rule | action |
|---|---|---|---|
| null | null | FR-14 neither | `none` |
| key, untimed | null | FR-13 | `seed` |
| key, timed | null | FR-14 local only | `push` |
| cleared marker | null | FR-30 | `push` (the marker goes up with its original clear time) |
| null | key | FR-14 shared only | `apply`, `replaced: false` |
| null | cleared | FR-14 | `none` (today's empty state; the marker is not copied down) |
| key, untimed | key, same value | FR-14 same value, OQ-3 | `adopt` |
| key, untimed | key, different value | FR-13 untimed is older | `apply`, `replaced: true` |
| key, untimed | cleared | FR-29 untimed removes | `clear-local` |
| key, timed | key, shared newer, same value | FR-14 same value | `adopt` |
| key, timed | key, shared newer, different value | FR-10 | `apply`, `replaced: true` |
| key, timed | key, local newer | FR-10 | `push` (same value too: the shared entry takes the local time and origin, so the record says who changed it last) |
| key, timed | key, equal time, same origin or `local.originId === null` | FR-14 identical | `none` |
| key, timed | key, equal time, different origins | FR-11 tiebreaker | `local.originId > shared.origin.deviceId` (code-unit order) -> `push`; else same value -> `adopt`, different value -> `apply`, `replaced: true` |
| key, timed | cleared, marker newer or equal | FR-29 | `clear-local` |
| key, timed | cleared, local newer | FR-29 | `push` |
| cleared marker | key, shared newer or equal-with-tiebreaker-loss | FR-14 marker vs key | `apply`, `replaced: false` |
| cleared marker | key, local newer or tiebreaker win | FR-14 | `push` |
| cleared marker | cleared, local newer | FR-10 | `push` |
| cleared marker | cleared, otherwise | FR-10 | `none` |

Times compare as numbers (ms, UTC, FR-10). An untimed local key is older than every shared entry (FR-13). The tiebreaker compares the two ENTRIES' origin ids (the local entry's recorded origin, which may be a peer's after an adopt or apply, against the shared entry's), so every device computes the same winner from the same two ids; a local entry with no origin at an equal time reads as identical, as files do. Malformed input never reaches this function: a rejected shared slot arrives as `null`, which is the "shared absent" column, so a malformed slot is overwritten by this device's entry when it has one (FR-20 healing) and is left alone when it does not.

### One key check, ordered (the key pass inside `runCheck`, after the file pass)

Preconditions: `pref.enabled` is true (otherwise no check runs at all), availability probed `'available'`, the file pass has decided at least its first slot (so a timeout here is the "iCloud answered, then ran past the budget" branch, never a silent whole-check failure). Budget: the check's existing `deadline`; every native call here is raced against `remaining()`.

1. **Pending removal first** (FR-33). If `pref.keyRemovalPending`: `native.removeKeys()`; on success `keyRemovalPending = false`, `knownKeyRecord = false`, `knownSharedKeys = undefined`; on `'timeout'` / `'unavailable'` leave it pending and skip to step 11 (the record is not read while a removal is owed). A removal is only ever retried while `knownKeyRecord` is true (OQ-1).
2. **Key switch off** (`!pref.keysEnabled`): `native.readKeys('status')` -> `knownKeyRecord = status.present`; rows: `'off'` when `keySyncEverOn || knownKeyRecord` and the row has a key or a marker, else null (FR-40); go to step 11. No content read, no write (FR-03, QA-03).
3. **Read**: `entries = storage.getApiKeyEntries()` (one chained read); `read = native.readKeys('record')` (the one record read of this check). On `'timeout'` / `'unavailable'`: for each slot with an unpushed local change (`entry.originId === deviceId` and, for a key, `changedAt` newer than `knownSharedKeys[slot]?.at` or no known slot; for a marker, `clearedAt` newer likewise) set `'waiting-to-upload'` (with `clearPending: true` for a marker); for every other slot with a key or marker set `'error'` with the timeout reason and Retry; `checkFailed = true`; return the failed outcome without touching `lastCheckAt` (the file pass's own rule).
4. **Validate**: `verdict = validateKeyRecord(read.record, now)`. Log one line per rejected slot or envelope, naming the slot and the rule word. `shared = verdict.ok ? verdict.slots : { ebird: null, openweather: null }`. `knownKeyRecord = read.status.present`.
5. **Decide** per slot: `decision[slot] = reconcileKeySlot({ local: toLocal(entries[slot]), shared: shared[slot], deviceId })`. A local key whose value fails `isValidKeyValue` and whose decision is `seed` or `push` becomes `'error'` with reason `'key-shape'` for this check and contributes no entry to the write (it is neither uploaded nor replaced; the shared slot is left as read).
6. **Apply local effects**, each one guarded link on the api-keys chain, each guard failure meaning a user action landed and the next check will push it (FR-26):
   - `seed`: `stampApiKeyEntry(slot, { changedAt: now, origin: thisDevice() }, entry.value)`; the entry to upload is the stamped one (`changedAt: now`, this device).
   - `push` of a timed key with no origin: after the write in step 8 succeeds, `stampApiKeyEntry(slot, { changedAt: entry.changedAt, origin: thisDevice() }, entry.value)` (the `stampFileOrigin` analogue).
   - `apply`: `applySyncedKey(slot, { value, changedAt, origin }, expect, replaced)`; on true, for `ebird` run `clearNetworkCache(); invalidateHotspotSet()` (exactly what `handleSaveKey` runs), then `notifyKeysChanged()`.
   - `adopt`: `stampApiKeyEntry(slot, { changedAt: shared.changedAt, origin: shared.origin }, entry.value)`.
   - `clear-local`: `applySyncedKeyClear(slot, { clearedAt, origin: shared.origin }, expect)`; on true, the same `ebird` invalidations, then `notifyKeysChanged()`.
7. **Assemble the record to write**: for each slot, `toWrite[slot]` = the local entry (as stamped) when the decision is `seed` or `push` and the guard held; otherwise `shared[slot]` as validated (or absent). Pass each through `sanitizeKeyEntryForWrite`; a null refusal marks that slot `'error'` / `'key-shape'` and keeps `shared[slot]` in its place.
8. **Write at most once**: only if at least one slot is `seed`/`push` with a held guard, and only if `pref.keysEnabled` is still true at this instant (FR-08: an upload must never land after a switch-off): `result = native.writeKeys(deviceId, toWrite)`. On `'timeout'` / `'unavailable'`: the pushed slots read `'waiting-to-upload'` (`clearPending` for a marker); `checkFailed = true`; skip to step 11. Other errors: `'error'` with the mapped reason and Retry.
9. **Publish rows**: `seed`/`push` -> `'up-to-date'` if `result.uploaded`, else `'waiting-to-upload'`; `apply` -> `'up-to-date'` with `replacedAt` when replaced; `adopt` / `none` with a key -> `'up-to-date'` (`'waiting-to-upload'` when the record's `uploaded` flag is false and the entry is this device's, the file rule); `clear-local` -> `'up-to-date'` with `clearedAt` and the peer origin, on a row that now holds no key; a slot with no key and no shared entry -> null (FR-39). Provenance (`fromThisDevice`, `origin`, `changedAt`) comes from the local meta after the effects above; `fromThisDevice` is `origin?.deviceId === deviceId` or no origin.
10. **Record the known state**: `knownSharedKeys[slot] = { state, at, originId }` from `toWrite[slot]` (the record as it now stands), `knownKeyRecord = true` when the record was written or was present.
11. **Finish** with the file pass: `lastCheckAt` written once, `savePref()` once (the key fields ride the same object, one link), `publishShared()` and the key store fields published together.

Invariants the Tester can assert on the fake native layer: per check, `readKeys` is called at most once and `writeKeys` at most once; `writeKeys` is never called with `keysEnabled` false; `readKeys('record')` is never called with `keysEnabled` false; no call argument other than `writeKeys.slots[*].value` ever equals the sentinel value.

### Actions

- **`enableKeys()`** (after Turn on, FR-04): requires `pref.enabled && availability === 'available'`, else no-op. `keysEnabled = true; keysEverEnabled = true; keyRemovalPending = false` (an enable supersedes an owed removal); `savePref()`; publish; `requestCheck('keys enabled')`. Nothing is written to iCloud before this call (QA-04).
- **`disableKeys()`** (FR-32): `keysEnabled = false`; `savePref()`; publish `keySyncEnabled: false` at once; `await inFlight` if a check is running (so a write that began under "on" has settled, FR-08); `native.removeKeys()`: success -> `knownKeyRecord = false`, `knownSharedKeys = undefined`, `keyRemovalPending = false`; `'timeout'` / `'unavailable'` -> `keyRemovalPending = true` and arm the retry; `savePref()`; rows `'off'` per FR-40. No confirmation (OQ-5). Local keys and their meta are untouched.
- **`disable()`** (the file switch, FR-07): calls `disableKeys()` first when `keysEnabled`, then the shipped body. The file records are untouched (FR-37).
- **Removal retry** (FR-33, OQ-1): armed by `boot()` when `keyRemovalPending`, and by `disableKeys()` on failure. Triggers: boot (after the probe), `visibilitychange` to visible, `window` focus, and step 1 of every check. It runs only while `keyRemovalPending && knownKeyRecord`; listeners are installed once and removed when the flag clears; they are independent of `startWatching` because the file switch may be off (the cascade case) and then no checks run. "Remove synced keys from iCloud" stays visible while `keyRecordExists || keyRemovalPending`.
- **`removeKeysFromICloud()`** (FR-34, FR-35): `native.removeKeys()`; `knownKeyRecord = false`, `knownSharedKeys = undefined`, `keyRemovalPending = false`; `savePref()`; if `keysEnabled` -> `requestCheck('remove keys')` (the confirmation says a sharing device uploads again), else rows per FR-40. Never calls `removeAll`; `removeFromICloud()` (files) never calls `removeKeys`.
- **`clearKeyWithSync(slot)`** (FR-28, FR-30): `clearedAt = now`; `storage.clearApiKeyWithMarker(slot, { clearedAt, origin: thisDevice() })` (the local key is gone at once); `ebird` invalidations; `notifyKeysChanged()`; row `'syncing'`; `requestCheck('key cleared')`. The check's table pushes the marker (local marker newer than the shared entry) or, if a peer's key is newer, applies it (latest event wins, FR-14). If iCloud is unreachable the check's step 3 leaves the row `'waiting-to-upload'` with `clearPending: true`, and the marker, which persists in `api-keys.json` (OQ-8), goes up at the next reachable check with its original time. No key-only `pendingClears` memo is needed: the local marker is the memo.
- **`keySaved(slot)`**: if `keySyncEnabled`, row `'syncing'` (`fromThisDevice: true`) and `requestCheck('key saved')`. The local save has already completed through `setApiKey` before this is called (FR-27: the upload never delays the local result).
- **`retryKey(slot)`**: row `'syncing'`, `requestCheck('retry key')`.
- The controller also subscribes to `subscribeKeysChanged` (not self-notifying) to request a check, as it does for files.

## The keys-changed signal (`lib/keysChanged.ts`, `lib/useKeysEpoch.ts`)

Entry-safe, dependency-free, the `filesChanged.ts` shape: `getKeysEpoch`, `subscribeKeysChanged`, `notifyKeysChanged`, and the `useSyncExternalStore` hook. Subscribers: `App.tsx` (`keysVersion = useKeysEpoch()`, the key-status effect depends on it, `onKeysSaved={notifyKeysChanged}`; `MapExplorer` keeps its `keysVersion` prop unchanged), `Settings.tsx` (the `keys` read moves into its own effect keyed on the epoch), `BirdingStats.tsx` (`hasEbirdKey` effect). Producers: Settings' save and clear (through `onKeysSaved`), and the controller after `apply` and `clear-local`. A key epoch never triggers a file reload and a file epoch never triggers a key re-read.

## Settings contract (for The Designer, Stage 4)

- **Key switch** inside the iCloud Sync section, directly below the file switch: a real switch, accessible name "Sync API keys", checked = `keySyncEnabled`, operable only when `syncEnabled && availability === 'available'`; otherwise visible, off, `aria-disabled`, with a reason associated by `aria-describedby`: the file switch's availability note for a non-available state, or "Turn on iCloud Sync first." when available but the file switch is off (FR-02). Turning on opens the six-element enable note (FR-04; focus-trapped `ModalDialog`, Escape cancels, focus returns to the switch), actions Turn on and Cancel. Off needs no confirmation.
- **"Remove synced keys from iCloud"** button, separate from the files' button, visible while `keyRecordExists || keyRemovalPending` regardless of the key switch; its confirmation names "your eBird key and your OpenWeather key", says no device's local keys are touched and that a device with key sync on uploads again at its next check (FR-34).
- **Key rows** (`KeyRow` gains `sync?: KeySlotView | null`, `onRetry`): with the key switch on and a key present, a provenance line "From this device, changed <time>" or "From <label> (<Mac | iPhone | iPad>), changed <time>" in `formatUploadDate` form (FR-38), one state label as text from the five (FR-39), the FR-41 line replacing the provenance fragment while `replacedAt` is set, the FR-42 line on an empty row while `clearedAt` is set, the FR-30 sentence while `clearPending`, and Retry on `'error'`. `'off'` renders "Sync off" only under FR-40. The longest string for the 320px / 200% measurement (NFR-04) is the FR-41 line with a 64-unit label and the platform word.
- **Clear** with the key switch on routes through a confirmation naming the service, this device, iCloud and the other sharing devices, never the value (FR-28), then `icloudActions.clearKeyWithSync(slot)`; with it off, `handleDeleteKey` is unchanged (FR-31). **Save** passes `origin` to `setApiKey` and then calls `icloudActions.keySaved(slot)` when the key switch is on.
- The live status region that announces file states announces key states too and never contains a value (NFR-03): every string comes from `icloudCopy.ts` builders.

## Migration Plan

Ordered steps for The Engineer. Steps 1 to 5 are testable under `vitest` with the fake native layer; only step 10 needs the signed bundle.

1. **`storage.ts`**: `ApiKeysDoc`, `ApiKeyMeta`, `ApiKeyEntry`, `ExpectedKeyEntry`, `KeySlot` types; `normalizeApiKeysDoc`; `getApiKey` reads through the normalizer; `setApiKey` gains the optional `origin` and the meta stamp; `deleteApiKey` drops the meta; the five new methods as chained links; `WebStorage` rejects the five. **No rewrite of any existing `api-keys.json` on upgrade**: the document is read through the normalizer and written only by the next save, clear or synced apply; a key with no change time reads as untimed and stays untimed until its first save (which stamps now + origin when known) or its first upload as the seed (which stamps the seed time + this device inside `stampApiKeyEntry`). `storage.keys.test.ts` (QA-11) and `storageKeySerialization.test.ts` (QA-21).
2. **`keyRecord.ts`** (types, constants, `isValidKeyValue`, `validateKeyRecord`, `sanitizeKeyEntryForWrite`, `serializeKeyRecord`, `KEY_RECORD_GOLDEN` fixture) + tests; **`keyReconcile.ts`** + the table test; **`keysChanged.ts`** + `useKeysEpoch.ts` + test.
3. **`icloudNativeTypes.ts`** (`readKeys`, `writeKeys`, `removeKeys`, the input and status types), **`icloudNative.ts`** (three wrappers; `KEYS_RECORD_NAME` re-exported from `keyRecord.ts`), **`icloudState.ts`** (fields, `INITIAL`, actions, NOOPs), **`icloudCopy.ts`** (every new string; no em dash).
4. **`icloudSync.ts`**: `normalizePref` fields; the key pass; the actions; the removal retry; `disable()` cascade; `bootICloudSync` adds `import('../networkCache')` and `import('../keysChanged')` to its dynamic imports. `icloudSync.keys.test.ts` with the fake layer (QA-03, QA-04, QA-06 to QA-10, QA-12 to QA-16, QA-18 to QA-29, QA-33).
5. **Signal wiring**: `App.tsx`, `Settings.tsx` (key read effect), `BirdingStats.tsx`.
6. **`icloud.rs`**: extract `read_record_text`; add `KEYS_RECORD_NAME`, the key bounds, `KeyEntryInput` / `KeyRecordFile` / `KeyRecordStatus`, `sanitize_key_entry`, the three commands, unit tests (bounds, refusal, idempotence, golden). **`lib.rs`**: three registrations under the Apple `cfg`. `cargo check` for `aarch64-apple-darwin`, `x86_64-apple-darwin`, `aarch64-apple-ios`, and confirm the Windows target still resolves (or rely on CI at the tag).
7. **`Settings.tsx`** per the Designer's spec (Stage 4): the switch, the note, the Remove control, the row sync line, the Clear confirmation, `origin` on save, `keySaved`.
8. **Guard tests**: `entryChunk.test.ts`, `icloudPaths.parity.test.ts`, the `icloudSync.test.ts` amendment, `Settings.icloud.test.tsx` extension, the published-claims greps. `npm run build`, `npm run typecheck`.
9. **Docs and policy**: FR-48 to FR-52; parity tests; versions 1.0.12; CHANGELOG.
10. **Signed verification** (the v1.0.11 recipe: the overlay build, not `tauri dev`): QA-05, QA-07, QA-12 to QA-14, QA-18, QA-19, QA-22, QA-23, QA-26 to QA-29, QA-35, QA-41, QA-46, QA-49 on the user's Mac and one iOS device after ship.

## Tests

| File | Asserts |
|---|---|
| `lib/storage.keys.test.ts` (plugin-fs harness) | QA-11: a save stamps `changedAt` and, when given, `origin`, switch on or off; a pre-1.0.12 document (`{"ebird":"k"}`) reads `changedAt: null`, never now; `deleteApiKey` removes value and meta; `clearApiKeyWithMarker` leaves a marker; the normalizer drops each malformed meta shape and both inconsistencies; `getApiKey` output is byte-identical to 1.0.11 for a shipped document. |
| `lib/storageKeySerialization.test.ts` (same harness, the read-first adversarial scheduler, sentinel-asserted mock) | QA-21 / FR-26: `applySyncedKey` interleaved with `setApiKey` in one tick both persist; a user save landing during an apply wins (guard returns false, value and meta untouched); `stampApiKeyEntry` on a changed value returns false; `applySyncedKeyClear` against a changed entry returns false; a rejecting write leaves the document byte-identical. |
| `lib/icloud/keyRecord.test.ts` | QA-15: each bound's edge; whitespace, a control character, non-ASCII, a 129-character value, a 0-length value, an out-of-range and a future time, a path-bearing and a 65-unit label, an unknown platform, `version: 2`, `kind: 'ebird'`, a file record at the key name, an unparseable envelope, a non-object slot: each rejected per slot or whole, none throws, reasons contain no value; a 12-character alphanumeric eBird key and a 32-hex OpenWeather key pass; `sanitizeKeyEntryForWrite` -> `serializeKeyRecord` -> `validateKeyRecord` round-trips and is idempotent (NFR-01); the golden string validates. |
| `lib/icloud/keyReconcile.test.ts` | QA-10, QA-12, QA-20, QA-24: every row of the table, millisecond UTC comparison, untimed older than everything, the entry-origin tiebreaker converging from both sides, same-value adopt vs different-value apply, every marker case. |
| `lib/icloud/icloudSync.keys.test.ts` (fake native + real pure modules) | QA-03 (`readKeys('record')` and `writeKeys` never called with the switch off, `readKeys('status')` only); QA-04 (nothing written before `enableKeys`); QA-06 (preference persists; `keysEnabled` with `enabled` false reads off; the preference never appears in a write); QA-07 (cascade); QA-08 (ten toggles: at most one check in flight and one queued, a write that began under on is followed by a remove, no record left); QA-09 (the fake container holds exactly `ebird.record.json`, `ml.record.json`, the two csvs, and `keys.record.json` only while on; the string-level exclusion list of the 1.0.11 test is UNCHANGED, `'api-keys'` included, because the native layer never receives that path); QA-13 (two controllers over one fake container converge on set-vs-clear and set-vs-set within a minute); QA-16 (a sentinel value never appears in `JSON.stringify(getICloudState())`, any log line, any thrown message, any copy builder output, or any native call argument other than `writeKeys.slots[*].value`, across upload, receive, replace, clear, error and remove); QA-18 / QA-19 (`applySyncedKey` / `applySyncedKeyClear` called with the shared time and origin; `notifyKeysChanged` fired; the ebird invalidations run); QA-20; QA-25 (Clear while unreachable: local gone at once, `clearPending`, marker uploaded at the next reachable check with the original time); QA-27 to QA-29; QA-33 (one `lastCheckAt` write per Check now); NFR-07 (`readKeys` <= 1 and `writeKeys` <= 1 per check; a check with nothing to transfer writes nothing). |
| `lib/keysChanged.test.ts` | epoch increments, subscribers fire, `useKeysEpoch` re-renders. |
| `components/Settings.icloud.test.tsx` (extend) | QA-01, QA-02, QA-04, QA-30 to QA-32, QA-43: gate false renders no key switch, note, control or key-row sync markup; each of the five labels renders as text; "In iCloud, not downloaded here" and "Download now" never render on a key row; the note carries six elements and no sentinel; the disabled reason is associated with the switch. |
| `lib/entryChunk.test.ts` (extend) | NFR-08 / QA-47: `lib/keysChanged.ts` and `lib/icloud/keyRecord.ts` (types reach the store) ARE on the entry graph; `lib/icloud/keyReconcile.ts` is NOT (controller-only; proves the logic did not leak into Settings); the controller and wrapper stay off. |
| `lib/icloudPaths.parity.test.ts` (extend) | `KEYS_RECORD_NAME` equal on both sides; `MAX_KEY_VALUE_LEN`/`MAX_KEY_VALUE` = 128 and the `0x21`/`0x7E` bounds equal; the three commands exist in `icloud.rs`, `icloudNative.ts` and `lib.rs` under the Apple cfg; the `KeyRecordFile` field names are the ones `validateKeyRecord` reads; the Rust golden literal equals the TS `KEY_RECORD_GOLDEN`; every error literal in the three commands is in the closed union. |
| `icloud.rs` unit tests | `sanitize_key_entry` refuses each bad value shape and platform, cleans a label, is idempotent; the serialized golden matches the literal; `clear_staging` for `*-keys.record.json` removes only key staging entries. |
| Published-claims greps (new or extended) | QA-36, QA-37, QA-42, QA-45: "end-to-end" only beside the Advanced Data Protection qualifier; no unqualified "never synced" / "stay on your own device" for keys; the HELP sentence gone; no U+2014 in the diff's copy, docs and policy files. |

## Design Decisions

1. **One record, two slots, not two records (OQ-4, finalized).** NFR-07's "one read and one write per check" is only achievable with one record. Cost: a lost-update window between two devices that write different slots in the same second (whole-file replace; the coordinator serializes but does not merge). It heals at the loser's next check because its local entry is then newer than what it reads (latest wins), so the damage is one transient stale slot, never a lost key.
2. **`meta` sibling in `api-keys.json`, not a value-shape change.** The values stay top-level strings, so `getApiKey`, every service and every shipped document are byte-compatible; the meta rides beside them and is validated on load. A `{ value, changedAt }` object per slot was rejected as a modification with no upside.
3. **A cleared marker lives in the local key store (OQ-8), and it is the pending-clear memo.** The file feature needed `pendingClears` in the preference because a deleted file leaves nothing behind; a key slot keeps its marker, so an offline Clear is never lost and no second memo can disagree with it.
4. **Clear-with-sync goes through the check, not a direct write.** A direct write would merge against a stale in-memory copy of the other slot; the check reads fresh and writes once, and the table already contains the marker-vs-key rows. One write path, one lost-update story.
5. **`stampApiKeyEntry` covers seed, adopt and origin-stamp.** Three cases, one guarded link ("set this key's time and origin if the value is unchanged"), fewer chain links to reason about.
6. **The tiebreaker compares the entries' origins.** FR-11 literally; deterministic from the same two ids on every device. The shipped file reconcile compares this device's id with the shared origin, which differs only when the local file came from a peer; it is not changed (NFR-10).
7. **Rust refuses, never rewrites, a key value.** A secret cannot be sanitized into a different secret; the TypeScript chokepoint refuses first and shows "Could not sync", so a Rust refusal is a fail-closed programming-error guard.
8. **Three new commands, zero modified commands.** No shipped command can write a record without a csv or delete one item; growing `Slot` would have spread a refusal across five commands. The read closure is extracted, not duplicated.
9. **Status-only read with the key switch off.** FR-36's existence answer without FR-03's content read, one command with a mode, asserted by the call log.
10. **The keys epoch mirrors the files epoch.** `App.tsx` already had the prop-threaded half; the entry-safe module makes it one signal with three subscribers instead of a prop that reaches one tab.
11. **No new document, no new chain key, no capability change, no Cargo change, no native watch change.** The predicate already matches the fifth record.

## Risks, verify-items and flags

- **FR-12 "this device's origin" needs a device id, and one exists only after the file switch has been turned on once.** Until then a save stamps `changedAt` with no origin; the first push stamps this device (the timed-no-origin case above). The row shows "From this device" for an origin-less key. The Evaluator should read FR-12 with this refinement.
- **The timed stamp runs on every Tauri build, Windows included**, because `storage.ts` carries no platform branch; the field is inert there. QA-11's "Apple path" is satisfied; say so in the test.
- **Key values cross IPC to Rust in `icloud_write_keys`.** They already cross IPC today through `plugin-fs` on every save; Tauri's IPC is in-process. A dev build's devtools can echo invoke arguments, and a dev build cannot use iCloud, so the path never runs there. Rust must never `format!`, `dbg!` or log the entry.
- **V1: `NSMetadataQuery` update for `keys.record.json`.** The predicate matches; verify on device that a peer's key write wakes the check within seconds, else the five-minute poll and foreground triggers bound it (the v1.0.11 V6 posture).
- **V2: a placeholder key record on a fresh iOS device downloads inside the coordinated read within 8 s.** If a first read ever times out on a slow link, Retry re-runs the read; document the observation. No state exists for "present, not downloaded" on a key row by design.
- **V3: staging sweep overlap.** `icloud_remove_all` sweeps every `.tmp/` entry, which may include a crashed key staging file; that is a crash artifact, not the key record, and its removal is harmless (the device re-pushes). FR-35 holds for the record itself. Stated so no one "fixes" the sweep.
- **The key-shape refusal is reachable only by a key outside 1..128 printable ASCII**, which neither provider issues; the row copy exists for honesty, not for an expected path. Never narrow the bound (OQ-9).
- **`BirdingStats`' `hasEbirdKey` was mount-only** (a pre-existing gap FR-24 now closes, like FR-35 did for files); `MapExplorer` already re-read on `keysVersion`.
- **The 1.0.11 exclusion-list test stays exactly as it is.** The carve-out the PRD describes (QA-11 amended) is realized as the QA-09 sentinel-and-container test, because the native layer never receives the path `api-keys.json` in either version; what changes is that key VALUES reach `writeKeys` while the switch is on.
