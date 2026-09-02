## iCloud API Key Sync (icloud-api-key-sync, 1.0.12)

### What this does
Adds a second, off-by-default "Sync API keys" switch inside the iCloud Sync section of Settings on the Mac, iPhone and iPad apps. With file sync on and the key switch turned on after its own six-part note, the app keeps the user's eBird and OpenWeather keys the same across their own Apple devices through one small `keys.record.json` in the same private iCloud container the files use: latest change wins per key with the origin-id tiebreaker, a Clear propagates through a cleared marker, turning the switch off removes the copy from iCloud (with a retry armed while iCloud is unreachable), and a separate "Remove synced keys from iCloud" control deletes the copy at any time. Each key row shows where its key came from, when it changed, and one plain-text state; a received key reaches every networked feature and the Settings rows without a relaunch through a new keys epoch. Windows, web and Pi render nothing new. The privacy policy, its website mirror, the in-app help, the README, the website and the App Store record describe the key path in the same change, and the version is bumped to 1.0.12 in both version files with a changelog entry.

### How to test
Local (build machine, not signed in to iCloud):
1. `cd frontend && npx vitest run` (the full suite; see the counts below).
2. `cd frontend && npm run build` (the pre-push gate).
3. `cd src-tauri && cargo test --lib` and `cargo check` for the host, `--target aarch64-apple-ios`, `--target x86_64-apple-darwin`.
4. `cd backend && .venv/bin/python -m pytest tests/ -q`.
5. Open the served web build: the API Keys rows are byte-identical apart from the value line wrapping at 320px / 200%, and no iCloud Sync section renders (see `how-to-see.md`, section 1).

Device (the user's own Mac and iPhone, after the ship): `how-to-see.md`, section 2, one step per line, covers QA-05, QA-07, QA-12 to QA-14, QA-18, QA-19, QA-22, QA-23, QA-26 to QA-29, QA-46 and QA-49.

### Files touched

Storage seam and signals
- `frontend/src/lib/storage.ts`: `KeySlot`, `ApiKeyMeta`, `ApiKeysDoc`, `ApiKeyEntry`, `ApiKeyEntries`, `ExpectedKeyEntry`; `normalizeApiKeysDoc` (validate on load, never default a time); `getApiKey` reads through it; `setApiKey(slot, value, origin?)` stamps `changedAt` and the origin; `deleteApiKey` drops the meta; the five chained links `getApiKeyEntries`, `clearApiKeyWithMarker`, `applySyncedKey`, `applySyncedKeyClear`, `stampApiKeyEntry` on the existing api-keys chain; `WebStorage` rejects the five.
- `frontend/src/lib/keysChanged.ts`, `frontend/src/lib/useKeysEpoch.ts` (new): the entry-safe key epoch, the `filesChanged.ts` shape.
- `frontend/src/App.tsx`: `keysVersion` now comes from `useKeysEpoch()`; the key-status effect re-runs on it; `onKeysSaved={notifyKeysChanged}`.
- `frontend/src/components/BirdingStats.tsx`: `hasEbirdKey` re-reads on the keys epoch (the mount-only gap).

Pure modules (frontend/src/lib/icloud/)
- `keyRecord.ts` (new): `KEYS_RECORD_NAME`, `KEY_SLOTS`, the value bounds (128, 0x21..0x7E), `isValidKeyValue`, `validateKeyRecord`, `sanitizeKeyEntryForWrite` (refuses a value, never truncates), `serializeKeyRecord`, `keyEntryTimeMs`, `KEY_RECORD_GOLDEN`.
- `keyReconcile.ts` (new): the ordered table, `reconcileKeySlot`.
- `icloudNativeTypes.ts`: `readKeys`, `writeKeys`, `removeKeys` and their types. `icloudNative.ts`: the three wrappers; re-exports `KEYS_RECORD_NAME`.
- `icloudState.ts`: `KeySlotState`, `KeySlotView`, the five key store fields, `setKeySlotView`, the six key actions with NOOP defaults.
- `icloudCopy.ts`: every new string from the design spec's Content Notes; the amended file-note sentence; `BUTTONS.removeKeys`.
- `icloudSync.ts`: `normalizePref` fields; the key pass inside `runCheck` after the file pass (one record read, at most one record write); `enableKeys`, `disableKeys`, `removeKeysFromICloud`, `clearKeyWithSync`, `retryKey`, `keySaved`; `disable()` cascades to `disableKeys()`; the removal retry (boot, foreground, focus, step 1 of every check); `markUnavailable` covers the key rows; `bootICloudSync` wires `networkCache` and `keysChanged`.

Native (src-tauri/src/)
- `icloud.rs`: `KEYS_RECORD_NAME`, `MAX_KEY_VALUE_LEN`, `KEY_CHAR_MIN`, `KEY_CHAR_MAX`, `MAX_TIME_UNITS`; `KeysReadMode`, `KeyRecordStatus`, `KeysRead`, `KeysWriteResult`, `KeyEntryInput` / `KeySlotsInput` (no `Debug`), `KeyEntryFile` / `KeySlotsFile` / `KeyRecordFile`; `valid_key_value`, `valid_time_text`, `sanitize_key_entry` (refuses everything but the label); `clear_staging_for`; `read_record_text` extracted from `icloud_read_record` (behavior-identical); `icloud_read_keys`, `icloud_write_keys`, `icloud_remove_keys`; five unit tests.
- `lib.rs`: the three registrations under the Apple cfg. No capability file changes (app commands are not capability-gated; the eight shipped commands appear in none).

UI
- `frontend/src/components/Settings.tsx`: the key switch row with its aria-disabled gating and associated reason; the "Turn on API key sync" note; "Remove synced keys from iCloud" beside the files control in `.sr-ics-remove-actions` with the pending line; the key Clear confirmation; `SyncLine` generalized over the view with a render prop (not forked) and `KeySyncContent`; `KeyRow` gains `sync`, `syncLine`, `onRetry`, `onDelete(trigger)`, `updateRef` (through `useImperativeHandle`) and the `.sr-key-line` value line; the keys re-read on the keys epoch; save passes `origin` and calls `keySaved`.
- `frontend/src/components/ui/ToggleSwitch.tsx`: the `ariaDisabled` mode (focusable, ignores activation, disabled look, 150 ms opacity ease-out).
- `frontend/src/globals.css`: `.sr-ics-key-label`, `.sr-ics-remove-actions`, `.sr-ics-pending`, `.sr-dlg-fine`, `.sr-key-line` (top-level, tokens only; no new phone-tier rule needed).

Tests (new)
- `frontend/src/lib/storage.keys.test.ts`, `frontend/src/lib/storageKeySerialization.test.ts`, `frontend/src/lib/icloud/keyRecord.test.ts`, `frontend/src/lib/icloud/keyReconcile.test.ts`, `frontend/src/lib/icloud/icloudSync.keys.test.ts`, `frontend/src/lib/keysChanged.test.ts`, `frontend/src/components/Settings.icloudKeys.test.tsx`, `frontend/src/lib/icloudKeysPublishedClaims.test.ts`.

Tests (extended or amended)
- `frontend/src/lib/entryChunk.test.ts` (the keys epoch and `keyRecord.ts` on the graph; `keyReconcile.ts` off it), `frontend/src/lib/icloudPaths.parity.test.ts` (name, bounds, commands, field names, no-Debug derives, the golden byte-equal to the Rust literal), `frontend/src/lib/icloudSyncCss.test.ts` (the five classes), `frontend/src/components/ui/ToggleSwitch.test.tsx` (aria-disabled mode).
- `frontend/src/lib/icloud/icloudSync.test.ts` and `frontend/src/components/Settings.icloud.test.tsx`: the fakes gained the new interface members (type-necessary; the suite is type-checked by `tsc -b`). Assertions unchanged except two: the `.sr-sync-line` count (2 to 4, since the two key rows now carry a region each; the helper now selects the file rows) and the file-note sentence regex, which follows the design spec's own amendment ("and so do your API keys unless you also turn on Sync API keys").
- `frontend/src/lib/storageWriteSerialization.test.ts`: the api-keys raw-document equality became `toMatchObject` plus meta assertions, because FR-12 grows the document by design.

Docs, published statements, versions
- `PRIVACY_POLICY.md` and `website/privacy.html` (in parity; the parity test is green): the storage bullet qualified in the same sentence; the iCloud Sync section's "never synced" sentence replaced; a new "Sync API keys" bullet (what is stored, how Apple protects it with the Advanced Data Protection qualifier, how to remove it); the turning-off bullet names both Remove controls; the page's meta description made true.
- `docs/HELP.md`: the API Keys section (switch, provenance and states, masked arrival, Clear's reach), the iCloud Sync section (the switch, its note, the "Turn on iCloud Sync first." gating, the cascade, the pending removal, Remove synced keys), the offline section.
- `README.md`, `website/index.html` (feature prose, the privacy band, the version pill and footer), `appstore/LISTING.md` (the store description sentence, the corrected bullet and the recorded "Data Not Collected" reasoning), `ACCESSIBILITY.md` (one added, accurate sentence about the aria-disabled switch and its confirmations).
- `CHANGELOG.md` (`## [1.0.12]`), `frontend/package.json` and `src-tauri/tauri.conf.json` (1.0.12). `frontend/package-lock.json` was left alone: its root version has read 0.5.90 through every release since and is not part of the bump rhythm.

Pipeline
- `pipeline/icloud-api-key-sync/PR.md` (this file), `pipeline/icloud-api-key-sync/how-to-see.md`.

### Test commands and results
- `cd frontend && npx vitest run`: 251 files passed, 4056 tests passed, 0 failed (baseline before this change: 243 files, 3824 tests).
- `cd frontend && npm run build` (`tsc -b && vite build`): exit 0. `icloudSync-*.js` emits as its own lazy chunk (24.56 kB) and is not modulepreloaded by `dist/index.html`; the entry-chunk secondary (post-build) check passed in the full run.
- `cd frontend && npx eslint <every touched file>`: exit 0, 0 problems.
- `cd src-tauri && cargo test --lib`: 10 passed, 0 failed (the five new `icloud::tests` plus the five shipped).
- `cd src-tauri && cargo check`: Finished (host). `cargo check --target aarch64-apple-ios`: Finished. `cargo check --target x86_64-apple-darwin`: Finished. No warnings.
- `cd backend && .venv/bin/python -m pytest tests/ -q`: 311 passed, 1 warning (the pre-existing Starlette deprecation), exit 0.
- `~/.weft/bin/weft-design-lint check src/`: 42 findings, all `note`, none a `warn`. The two on touched files are `reduced-motion` on `ToggleSwitch.tsx` and `BirdingStats.tsx`, both pre-existing per-file notes: every transition in the app is collapsed by the global `@media (prefers-reduced-motion: reduce)` rule in `globals.css`, which the per-file lint cannot see, and `BirdingStats.tsx` gained only an effect dependency.

### Security fix round (security-report.md: the three Lows, applied as remediated there)

Finding 1: the writers apply the reader's time plausibility window.
- `frontend/src/lib/icloud/icloudRecord.ts`: `ISO_TIME_LEN`, `ISO_TIME_RE` and `isWritableTime(v, nowMs)` beside `isPlausibleTime`: the one writers' predicate (the canonical `toISOString` shape, a real calendar instant by byte-equal round trip, and the reader's window of 2000-01-01 to now plus 24 h). The reader stays lenient on purpose.
- `frontend/src/lib/icloud/keyRecord.ts`: `sanitizeKeyEntryForWrite(entry, fallbackLabel, nowMs)` refuses (null) a `changedAt` or `clearedAt` that fails it, never rewrites it, exactly as it refuses a value.
- `frontend/src/lib/icloud/icloudSync.ts`: step 5 refuses up front (`refused[slot]` is `'key-shape'` or `'key-time'`, replacing the boolean `shapeError`), so no local effect runs for an entry that cannot be written; step 9 names the rule on the row (Could not sync, Retry). A skewed device stops writing instead of ping-ponging.
- `frontend/src/lib/icloud/icloudCopy.ts`: the fourth closed reason `'key-time'`: "The date and time on this device are too far off to sync this key." (`KeyReasonCode` and `keyReasonFor` extended).
- `src-tauri/src/icloud.rs`: `ISO_TIME_LEN`, `MIN_TIME_MS`, `MAX_FUTURE_MS` (replacing `MAX_TIME_UNITS`); `days_from_civil`, `days_in_month`, `parse_iso_time_ms`, `valid_time_text(t, now_ms)`, `unix_now_ms`; `sanitize_key_entry(input, now_ms)`; `icloud_write_keys` reads the clock once per write. No dependency added (`Cargo.toml` and `Cargo.lock` untouched).

Finding 2: every entry in the write, pushed or carried, passes the one chokepoint.
- `icloudSync.ts` step 7: `carry(slot)` runs a carried shared entry through `sanitizeKeyEntryForWrite`; a refusal OMITS that slot (logged by slot and rule word, never a value) rather than failing the whole write, and the peer whose local entry is newer than an absent slot re-pushes it at its next check.
- `frontend/src/lib/icloudPaths.parity.test.ts`: the time predicate is pinned on both sides: the constants, both signatures, both call sites (`changedAt` and `clearedAt`, and the clock read in `icloud_write_keys`), and a 19-row fixture table that is evaluated through `isWritableTime` here and asserted, row by row and by count, to be spelled identically in the Rust test, so the two tables cannot drift.

Finding 3: every unreadable record shape heals, and Remove is always a recovery path.
- `icloud.rs`: `record_text_at` is the closure extracted from `read_record_text` (the one read path for all five records): a symlink or a directory at the name, a file past the 16 KB bound and bytes that are not UTF-8 all read as the EMPTY string, which the validator rejects as `malformed-json` and treats as absent; a genuine I/O error stays `unavailable`; a vanished item is None. `remove_planted_item` removes a directory at a fixed name (as well as a symlink, as a link), so `coordinated_delete` and both Remove controls recover; `replace_item` removes a directory at the target inside the coordinated replacing write, so a directory heals by overwrite too (rename(2) would otherwise fail on it forever). The module doc's trust-boundary paragraph says so.
- TypeScript unchanged for this finding: `validateKeyRecord('')` and `validateSharedRecord('')` were already `malformed-json` (pinned in both validator suites); the controller heal over an empty text is now pinned too.

Tests added or changed in this round
- `keyRecord.test.ts`: 2 new (the time refusals on a key entry and on a marker with the one-day edge; the parseable-but-not-canonical case with a non-vacuity check that the reader accepts each row); every existing sanitizer call passes `NOW`.
- `icloudSync.keys.test.ts`: 4 new (Finding 1 for a key a day ahead and for a marker dated 1999, each asserting no `writeKeys` argument carries it and the next check writes nothing again; Finding 2 for a peer slot timed `Sep 1, 2026 (é)`, omitted while this device's own slot uploads; Finding 3 for an empty record text healed at the same check).
- `icloudPaths.parity.test.ts`: 3 new in a nested describe (constants, call sites, the fixture lockstep); the `sanitize_key_entry` signature pin updated; the `MAX_TIME_UNITS` pin replaced.
- `icloud.rs`: 4 new (`writable_times_agree_with_the_frontend_fixture`, `a_key_entry_with_an_implausible_time_is_refused_never_rewritten`, `a_directory_or_symlink_at_a_fixed_record_name_reads_as_empty_and_is_removed`, `non_utf8_record_bytes_read_as_empty_text`); the existing key tests call a `sanitize` helper bound to `NOW_MS`.
- Mutation-checked red-first, each reverted in turn and restored byte-identical: the window dropped from `isWritableTime` (4 tests red), a carried slot bypassing the chokepoint (the Finding 2 controller test red), the window dropped from `valid_time_text` (2 native tests red), a non-regular file reading `unavailable` again (1 native test red).

Results for this round
- `cd frontend && npx vitest run`: 251 files passed, 4065 tests passed, 0 failed (4056 before this round; the nine new tests above).
- `cd frontend && npm run build`: exit 0; `icloudSync-*.js` still its own lazy chunk (24.86 kB).
- `cd frontend && npx eslint` on the seven touched frontend files: exit 0, 0 problems.
- `cd src-tauri && cargo test --lib`: 14 passed, 0 failed (the four new native tests plus the ten shipped).
- `cd src-tauri && cargo check`: Finished (host), no warnings. `cargo check --target aarch64-apple-ios`: Finished, no warnings.
- `cd backend && .venv/bin/python -m pytest tests/ -q`: 311 passed, 1 warning (the pre-existing Starlette deprecation).

Docs in this round: `CHANGELOG.md` gained one sentence under 1.0.12 for Finding 3 (no version bump; still 1.0.12). `how-to-see.md`, `docs/HELP.md` and the privacy pages are unchanged: nothing there describes the record shapes this changes, and the pending-removal sentence stays true.

One stated corner: a peer slot the reader accepts but the writer refuses (a hand-edited record) is still APPLIED locally by the existing reconcile (the reader's verdict stands); only the write omits it. If this device later has to push that entry it is refused with the `'key-time'` reason until the user re-saves the key, which stamps a fresh time.

### Notes for reviewer
- Deviations from the schema, each deliberate:
  1. `reconcileKeySlot` takes `{ local, shared }` only. The schema's signature listed `deviceId`, but its own tiebreaker rule compares the two entries' origin ids, so the parameter had no reader.
  2. A key-record WRITE that times out does not fail the check: the pushed rows read "Waiting to upload" and the check completes with `lastCheckAt`, exactly as the shipped file push does. The schema's step 8 said `checkFailed = true` then "skip to step 11", but step 11 ends with the shipped `checkFailed: false` publish, so the two could not both hold; the file-pass precedent won.
  3. On a key-record READ timeout after the file pass answered, only rows holding a key read "Could not sync"; an empty row whose own marker is already pushed keeps its last view (the schema calls that marker "not news" in the settled state).
  4. `disableKeys()` calls the native removal only while `knownKeyRecord` is true, so a switch-off before any record was ever written never marks a phantom removal pending; an enable still supersedes an owed removal.
  5. `KEY_RECORD_GOLDEN` carries an obviously fixture value (`FixtureKey0001abcd`) rather than the design mockup's sample key, so no real-looking key sits in source; the Rust literal is pinned byte-equal.
- The "Waiting to upload" honesty after a relaunch and the "This clear has not reached iCloud yet." sentence are derived from `knownSharedKeys` in the preference plus the local marker, as the schema designed; there is no key-only pending memo.
- Rust never parses the record (one parser per language boundary) and never formats a key value: `KeyEntryInput` and `KeyEntryFile` derive no `Debug`, and the parity test pins that on the derive attributes themselves.
- Not done here, by design of the run: no commit, no push, no `desktop:dev`, no iOS build-number stamp. The device rows of the QA table wait on the user's own Mac and iPhone after the ship (the build machine is not signed in to iCloud and a dev binary sits in "This build cannot use iCloud"). Two schema verify-items ride with them: V1 (a peer's `keys.record.json` write wakes the check through the existing `*.record.json` query) and V2 (a placeholder key record on a fresh iOS device downloads inside the 8 s coordinated read).
