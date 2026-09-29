//! iCloud Sync native layer (macOS + iOS): the ubiquity-container side of
//! `frontend/src/lib/icloud/`. Compiled only under
//! `cfg(any(target_os = "macos", target_os = "ios"))` (see lib.rs), so the
//! Windows and Linux binaries never see it.
//!
//! Design (pipeline/icloud-sync/schema.md, "Native layer"):
//! - The CSV bytes never cross the IPC boundary. `icloud_push` reads the LOCAL
//!   csv from `app_local_data_dir()/data/<slot file>` and writes it into the
//!   container; `icloud_pull` verifies the container copy (length, then
//!   SHA-256, against the record the frontend validated) and writes it over
//!   the local csv. The metadata document stays the frontend's (it wraps the
//!   pull in its per-document write chain).
//! - Every read and write of a container file goes through NSFileCoordinator,
//!   and every write lands as write-to-temp-then-rename onto the target so a
//!   peer never observes a half-written file.
//! - The container URL is resolved OFF the main thread (Apple: non-trivial
//!   setup) and cached after the first success; a nil result is not cached so
//!   a later sign-in is picked up.
//! - Errors are short stable strings the frontend maps to copy
//!   (`icloudNative.ts`); no Apple error text reaches the UI.
//! - Change detection: an NSMetadataQuery over every tiny record file
//!   (`*.record.json`, the two slot records, the key record, and since
//!   icloud-bar-chart-sync the county and day-obs records in their
//!   subdirectories; the query is a documents SCOPE, not a directory
//!   listing), started on the main thread when sync is enabled and
//!   stopped on disable, emitting the Tauri event `icloud-changed`; a second
//!   observer on NSUbiquityIdentityDidChangeNotification emits
//!   `icloud-identity-changed`. The frontend also re-checks on foreground,
//!   focus and a five-minute visible poll, so a missed notification costs
//!   latency, never correctness.
//!
//! Trust boundary (security round): the container is another device's
//! writable space and the local data dir is a persisted runtime document, so
//! both are treated as untrusted at the FILE-TYPE level as well as at the
//! record level: every read, status and delete goes through
//! `symlink_metadata` and never opens anything that is not a regular file (a
//! record there, like one past its size bound or one that is not UTF-8, reads
//! as the empty text the validator treats as absent, so it heals by overwrite;
//! a symlink or a directory at a fixed name is deleted as such, never
//! followed), a read is bounded by the on-disk length BEFORE the bytes are
//! loaded, the record's string fields are
//! sanitized to the validator's exact bounds at the write chokepoint so a
//! self-authored record always validates on every device, and the device id
//! that names a staging file is validated at the command boundary.
//!
//! The two csv filenames and the container id below are pinned to the
//! frontend constants by `frontend/src/lib/icloudPaths.parity.test.ts`.
//!
//! icloud-api-key-sync (1.0.12): one more fixed-name record,
//! `keys.record.json`, holds the user's two API keys while the key switch is
//! on. Three commands compose the helpers above (`icloud_read_keys`,
//! `icloud_write_keys`, `icloud_remove_keys`); the eight shipped commands are
//! untouched, and `icloud_remove_all` never names the key record (FR-35).
//! A key value is used only to build the record: it appears in no `format!`,
//! no log and no error string, and the input struct carrying it derives no
//! `Debug`. The Rust writer REFUSES (never rewrites) a value, a time, a
//! device id or a platform outside the validator's bounds; only the label is
//! sanitized, as for file records.

use std::cell::RefCell;
use std::collections::BTreeSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::{mpsc, Arc, Mutex, OnceLock};
use std::time::{Duration, Instant, SystemTime, UNIX_EPOCH};

use block2::{RcBlock, StackBlock};
use objc2::runtime::{AnyObject, ProtocolObject};
use objc2::rc::Retained;
use objc2_foundation::{
    ns_string, NSArray, NSError, NSFileCoordinator, NSFileCoordinatorReadingOptions,
    NSFileCoordinatorWritingOptions, NSFileManager, NSMetadataQuery, NSNotification,
    NSNotificationCenter, NSObjectProtocol, NSOperationQueue, NSPredicate, NSString, NSURL,
};
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use tauri::{AppHandle, Emitter};

/// The one iCloud container, shared by the macOS (`com.snowraven`) and iOS
/// (`com.dtgibson.snowraven`) App IDs. Named after the iOS id because that
/// App ID already existed in the portal; the name is a convention, not a
/// binding to either bundle id.
pub const ICLOUD_CONTAINER_ID: &str = "iCloud.com.dtgibson.snowraven";

/// Size bound for a shared csv (PRD OQ-5): a corruption guard, not a product
/// limit. Enforced natively on both push and pull, and again by the
/// frontend validator.
const MAX_BYTES: u64 = 200_000_000;

/// The validator's string bounds (UTF-16 code units), mirrored here so a
/// record this device writes always passes `icloudRecord.ts` on every reader.
const MAX_LABEL_UNITS: usize = 64;
/// A record file larger than this is not read at all (the validator's
/// MAX_RECORD_TEXT is 4,096 UTF-16 units; UTF-8 bytes can only be more, so a
/// 16 KB file bound is generous and still tiny). It is handed to the frontend
/// as an empty string, which the validator rejects as malformed.
const MAX_RECORD_BYTES: u64 = 16 * 1024;
const MAX_FILENAME_UNITS: usize = 255;

/// icloud-api-key-sync: the shared key record's fixed name (never derived
/// from content, FR-17). Parity-pinned to `KEYS_RECORD_NAME` in
/// `frontend/src/lib/icloud/keyRecord.ts`.
const KEYS_RECORD_NAME: &str = "keys.record.json";
/// Key value bounds (FR-19): 1 to 128 printable ASCII bytes, 0x21..=0x7E
/// (no space, no control, no non-ASCII), parity-pinned to `MAX_KEY_VALUE`,
/// `KEY_CHAR_MIN` and `KEY_CHAR_MAX` in keyRecord.ts. ASCII, so bytes equal
/// UTF-16 code units.
const MAX_KEY_VALUE_LEN: usize = 128;
const KEY_CHAR_MIN: u8 = 0x21;
const KEY_CHAR_MAX: u8 = 0x7E;
/// A time string in a key entry as the WRITERS accept it (security fix
/// round, Findings 1 and 2): exactly the 24-byte canonical ISO shape the
/// frontend's `toISOString` emits, a real calendar instant, and inside the
/// reader's plausibility window (not before 2000-01-01T00:00:00.000Z, not
/// more than a day past this device's clock). Parity-pinned to
/// `ISO_TIME_LEN`, `MIN_TIME` and `MAX_FUTURE_MS` in icloudRecord.ts; the
/// reader's looser 64-unit `MAX_TIME_TEXT` bound stays on that side only.
const ISO_TIME_LEN: usize = 24;
const MIN_TIME_MS: i64 = 946_684_800_000;
const MAX_FUTURE_MS: i64 = 86_400_000;

/// The per-command wall-clock budget (NFR-04: a check with iCloud unreachable
/// gives up within 10 s; the frontend runs two record reads per check).
const COMMAND_TIMEOUT: Duration = Duration::from_secs(8);

/// Local csv file names under `app_local_data_dir()/data/`. Parity-pinned to
/// `FILE_PATHS` in `frontend/src/lib/storage.ts`.
const LOCAL_EBIRD_FILE: &str = "ebird-backup.csv";
const LOCAL_ML_FILE: &str = "ml-export.csv";
const LOCAL_DATA_DIR: &str = "data";

#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum Slot {
    Ebird,
    Ml,
}

impl Slot {
    fn key(self) -> &'static str {
        match self {
            Slot::Ebird => "ebird",
            Slot::Ml => "ml",
        }
    }
    /// The csv name in BOTH the local data dir and the container (same name
    /// on both sides by design, so a container listing reads like the data
    /// dir).
    fn csv_name(self) -> &'static str {
        match self {
            Slot::Ebird => LOCAL_EBIRD_FILE,
            Slot::Ml => LOCAL_ML_FILE,
        }
    }
    fn record_name(self) -> String {
        format!("{}.record.json", self.key())
    }
}

#[derive(Debug, Clone, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Origin {
    pub device_id: String,
    pub label: String,
    pub platform: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Status {
    pub state: &'static str,
    pub device_label: String,
    pub platform: &'static str,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct FileStatus {
    pub present: bool,
    pub downloaded: bool,
    pub downloading: bool,
    pub byte_length: Option<u64>,
    /// FR-05 (QA round 1): a push writes into the LOCAL ubiquity container and
    /// returns before the iCloud daemon has uploaded anything, so "the push
    /// succeeded" is not "the file is in iCloud". `uploaded` is true only once
    /// BOTH the csv and its record report NSURLUbiquitousItemIsUploadedKey;
    /// the row reads "Waiting to upload" until then. A file without ubiquity
    /// metadata (a non-ubiquitous copy) reports uploaded, never trapping a row.
    pub uploaded: bool,
    pub uploading: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RecordRead {
    pub record: Option<String>,
    pub file: FileStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PushResult {
    pub sha256: String,
    pub byte_length: u64,
    /// Whether iCloud already holds the bytes just written (almost always
    /// false straight after a push; the daemon uploads in the background).
    pub uploaded: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RemoveResult {
    pub removed: u32,
}

// ── icloud-api-key-sync: the shared key record ─────────────────────────────

/// `icloud_read_keys` mode: existence only (what FR-36 permits with the key
/// switch off), or the raw record text as well.
#[derive(Debug, Clone, Copy, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum KeysReadMode {
    Status,
    Record,
}

/// The key record's ubiquity flags, the same four a csv reports, so
/// "Waiting to upload" works the same way for keys.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyRecordStatus {
    pub present: bool,
    pub downloaded: bool,
    pub downloading: bool,
    pub uploaded: bool,
    pub uploading: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeysRead {
    pub record: Option<String>,
    pub status: KeyRecordStatus,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct KeysWriteResult {
    pub uploaded: bool,
}

/// One slot as the frontend hands it in (already through the TypeScript
/// chokepoint). Deliberately NO `Debug`: the value must never be formatted.
#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeyEntryInput {
    pub state: String,
    pub value: Option<String>,
    pub changed_at: Option<String>,
    pub cleared_at: Option<String>,
    pub origin: Origin,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct KeySlotsInput {
    pub ebird: Option<KeyEntryInput>,
    pub openweather: Option<KeyEntryInput>,
}

/// One slot as written. Field order IS the serialized order the frontend's
/// `serializeKeyRecord` mirrors (the golden test pins it): state, value,
/// changedAt | clearedAt, origin. No `Debug` (it carries the value).
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KeyEntryFile {
    state: &'static str,
    #[serde(skip_serializing_if = "Option::is_none")]
    value: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    changed_at: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cleared_at: Option<String>,
    origin: Origin,
}

#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KeySlotsFile {
    #[serde(skip_serializing_if = "Option::is_none")]
    ebird: Option<KeyEntryFile>,
    #[serde(skip_serializing_if = "Option::is_none")]
    openweather: Option<KeyEntryFile>,
}

/// The shared key record as written to `keys.record.json` (schema.md,
/// "Container: the shared key record"). `kind` binds the record to its name
/// as `slot` does for a file record; an absent slot is omitted, never null.
#[derive(Serialize)]
#[serde(rename_all = "camelCase")]
struct KeyRecordFile {
    version: u8,
    kind: &'static str,
    slots: KeySlotsFile,
}

/// The shared record as written to `<slot>.record.json` (schema.md, "Shared
/// record format"). Field set and names are the contract the frontend
/// validator (`icloudRecord.ts`) reads; unknown keys are ignored there, so
/// this struct may only GROW.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordFile<'a> {
    version: u8,
    slot: &'a str,
    /// icloud-bar-chart-sync: the county a `barchart` record binds itself to.
    /// Skipped when None, so a slot record serializes byte-identically to the
    /// shipped golden (the parity test pins both).
    #[serde(skip_serializing_if = "Option::is_none")]
    county: Option<&'a str>,
    state: &'a str,
    #[serde(skip_serializing_if = "Option::is_none")]
    filename: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    uploaded_at: Option<&'a str>,
    #[serde(skip_serializing_if = "Option::is_none")]
    cleared_at: Option<&'a str>,
    origin: &'a Origin,
    #[serde(skip_serializing_if = "Option::is_none")]
    byte_length: Option<u64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    sha256: Option<&'a str>,
}

// ── icloud-bar-chart-sync: county files and day-obs snapshots ──────────────
//
// Two more synced kinds beside the two slots, each in its own subdirectory of
// `Documents/` (schema.md section 3): one `.txt` and one `.record.json` per
// county under `barcharts/`, and one `.json` snapshot and one `.record.json`
// per device under `day-obs/`. Every name derives ONLY from a value that
// passed a byte-level predicate here (`County::parse`, `DeviceId::parse`),
// never from a filename the user chose, and the only types the item commands
// accept are the validated newtypes, whose field is private. The slot
// commands above are untouched; the item commands reuse the same helpers
// (`atomic_container_write`, `coordinated_delete`, `read_record_text`,
// `regular_file_len`, `ubiquity_flags`, `sha256_hex`), so the read posture of
// security.md (a regular file, its real size bounded before any read, the
// claimed length and digest verified) holds for every item exactly as for a
// csv.

/// Subdirectory of `Documents/` holding the county files and their records.
/// Parity-pinned to `ITEM_SUBDIRS` in `icloudNative.ts`.
const BARCHARTS_SUBDIR: &str = "barcharts";
/// Subdirectory of `Documents/` holding one day-obs snapshot per device.
const DAY_OBS_SUBDIR: &str = "day-obs";
/// The day cache's local document under `data/`; parity-pinned to
/// `COUNTY_DAY_OBS_PATH` in `storage.ts`.
const LOCAL_DAY_OBS_FILE: &str = "county-day-obs.json";
/// The local bar-chart directory under `data/`; parity-pinned to
/// `BARCHARTS_DIR` in `storage.ts`.
const LOCAL_BARCHARTS_DIR: &str = "barcharts";

/// A hostile-container bound on ONE listing, never a user quota (FR-09): the
/// real US county set is about 3,244 codes while the syntactic space the
/// predicate admits is 26 x 26 x 1,000 = 676,000, so a planted container could
/// hold more records than one 8 s command can read. Items past it are ignored
/// this listing and reported as `truncated`. Units: items per kind per listing.
/// Parity-pinned to `MAX_LISTED_ITEMS` in `icloudNativeTypes.ts`.
const MAX_LISTED_ITEMS: usize = 4096;

/// The per-file bound for a day-obs snapshot, in bytes (decimal), on disk and
/// in the record. Derived, not borrowed: a producer inside the local budget
/// writes at most about 13.8 M UTF-16 code units of JSON (10,000,000 of
/// payload, one sole oversized newest entry of up to 5,000 records, and the
/// envelope), which is at most about 41.5 MB of UTF-8; 64 MB sits above that
/// and below `MAX_BYTES`. Parity-pinned to `DAY_OBS_SHARED_MAX_BYTES` in
/// `icloudRecord.ts`, and each side has its own enforcement test.
const DAY_OBS_SHARED_MAX_BYTES: u64 = 64_000_000;

/// A US county region code: exactly `US-`, two ASCII capitals, `-`, three
/// ASCII digits, and nothing after. The Rust twin of `REGION_CODE_RE`
/// (`/^US-[A-Z]{2}-[0-9]{3}$/` in `frontend/src/lib/regionCode.ts`), written
/// as a byte check rather than a regex so the anchors and the ASCII classes
/// are explicit: a trailing newline, a lowercase state, a Unicode digit, an
/// embedded newline and a 10-byte string are all refused. The field is
/// private, so no unvalidated string can become a container path.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct County(String);

impl County {
    pub fn parse(s: &str) -> Result<County, ()> {
        let b = s.as_bytes();
        if b.len() != 9 {
            return Err(());
        }
        let ok = b[0] == b'U'
            && b[1] == b'S'
            && b[2] == b'-'
            && b[3].is_ascii_uppercase()
            && b[4].is_ascii_uppercase()
            && b[5] == b'-'
            && b[6].is_ascii_digit()
            && b[7].is_ascii_digit()
            && b[8].is_ascii_digit();
        if ok {
            Ok(County(s.to_string()))
        } else {
            Err(())
        }
    }
    fn as_str(&self) -> &str {
        &self.0
    }
}

/// A device id that passed `valid_device_id` (32 lowercase hex). It names a
/// day-obs snapshot and a staging file, so it is validated at the boundary.
#[derive(Debug, Clone, PartialEq, Eq, PartialOrd, Ord)]
pub struct DeviceId(String);

impl DeviceId {
    pub fn parse(s: &str) -> Result<DeviceId, ()> {
        if valid_device_id(s) {
            Ok(DeviceId(s.to_string()))
        } else {
            Err(())
        }
    }
    fn as_str(&self) -> &str {
        &self.0
    }
}

/// One synced item that is not a slot. Built only through `TryFrom<ItemArg>`
/// (or from a name that passed the same predicate in a listing).
#[derive(Debug, Clone)]
enum SyncItem {
    County(County),
    DayObs(DeviceId),
}

impl SyncItem {
    fn kind(&self) -> ItemKind {
        match self {
            SyncItem::County(_) => ItemKind::Barchart,
            SyncItem::DayObs(_) => ItemKind::DayObs,
        }
    }
    /// The item's file name inside its subdirectory.
    fn file_name(&self) -> String {
        match self {
            SyncItem::County(c) => format!("{}.txt", c.as_str()),
            SyncItem::DayObs(d) => format!("{}.json", d.as_str()),
        }
    }
    /// The item's record name inside its subdirectory.
    fn record_name(&self) -> String {
        match self {
            SyncItem::County(c) => format!("{}.record.json", c.as_str()),
            SyncItem::DayObs(d) => format!("{}.record.json", d.as_str()),
        }
    }
    /// The path of the item's file relative to `Documents/`.
    fn container_file(&self) -> String {
        format!("{}/{}", self.kind().subdir(), self.file_name())
    }
    /// The path of the item's record relative to `Documents/`.
    fn container_record(&self) -> String {
        format!("{}/{}", self.kind().subdir(), self.record_name())
    }
    /// The local file the item mirrors under `app_local_data_dir()/data/`.
    fn local_path(&self, data_dir: &Path) -> PathBuf {
        match self {
            SyncItem::County(c) => data_dir.join(LOCAL_BARCHARTS_DIR).join(format!("{}.txt", c.as_str())),
            SyncItem::DayObs(_) => data_dir.join(LOCAL_DAY_OBS_FILE),
        }
    }
    /// The per-file bound: the csv bound for a county file, the derived bound
    /// for a day-obs snapshot.
    fn max_bytes(&self) -> u64 {
        match self {
            SyncItem::County(_) => MAX_BYTES,
            SyncItem::DayObs(_) => DAY_OBS_SHARED_MAX_BYTES,
        }
    }
    /// The record's `slot` discriminator and its `county` binding.
    fn record_fields(&self) -> (&'static str, Option<&str>) {
        match self {
            SyncItem::County(c) => ("barchart", Some(c.as_str())),
            SyncItem::DayObs(_) => ("day-obs", None),
        }
    }
}

/// The two item kinds, as the listing and the bulk removal take them.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ItemKind {
    Barchart,
    DayObs,
}

impl ItemKind {
    fn subdir(self) -> &'static str {
        match self {
            ItemKind::Barchart => BARCHARTS_SUBDIR,
            ItemKind::DayObs => DAY_OBS_SUBDIR,
        }
    }
    /// An item of this kind from a candidate id, or None when the id fails the
    /// kind's predicate (checked before any path is built).
    fn item_from_id(self, id: &str) -> Option<SyncItem> {
        match self {
            ItemKind::Barchart => County::parse(id).ok().map(SyncItem::County),
            ItemKind::DayObs => DeviceId::parse(id).ok().map(SyncItem::DayObs),
        }
    }
}

/// The IPC shape of an item: `{ kind: "barchart", county }` or
/// `{ kind: "day-obs", deviceId }`. Converted by `TryFrom` BEFORE any
/// filesystem or container call; a value that fails its predicate is the
/// closed union's `unknown`.
#[derive(Debug, Deserialize)]
#[serde(tag = "kind", rename_all = "kebab-case")]
pub enum ItemArg {
    Barchart { county: String },
    #[serde(rename_all = "camelCase")]
    DayObs { device_id: String },
}

impl TryFrom<ItemArg> for SyncItem {
    type Error = String;
    fn try_from(arg: ItemArg) -> Result<SyncItem, String> {
        match arg {
            ItemArg::Barchart { county } => County::parse(&county).map(SyncItem::County).map_err(|_| "unknown".to_string()),
            ItemArg::DayObs { device_id } => DeviceId::parse(&device_id).map(SyncItem::DayObs).map_err(|_| "unknown".to_string()),
        }
    }
}

/// `icloud_pull_item` mode: write the verified bytes over the local file
/// (`file`, county files), or hand them back as text for the day cache's
/// merge (`text`, day-obs snapshots; no local file is touched).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PullMode {
    File,
    Text,
}

#[derive(Debug, Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct ListedFile {
    pub present: bool,
    pub downloaded: bool,
    pub downloading: bool,
    pub byte_length: Option<u64>,
    /// Both the file and its record report iCloud holds them (the csv rule).
    pub uploaded: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListedItem {
    /// The validated county code or device id the item's names derive from.
    pub id: String,
    /// A record exists at the item's record name (downloaded or not).
    pub present: bool,
    /// The record text; None when absent, or when a record that was not
    /// `Current` could not be brought down and read inside the listing's
    /// budget (its download has been requested; a later check reads it).
    pub record: Option<String>,
    pub file: ListedFile,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResult {
    pub items: Vec<ListedItem>,
    pub truncated: bool,
    /// The kind's directory is in iCloud but not on this device yet (only its
    /// placeholder is here; its download has been requested). Nothing was
    /// read, and nothing may be decided from this listing: the frontend
    /// re-reads shortly rather than treating the kind as empty.
    pub pending: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ItemPushResult {
    pub sha256: String,
    pub byte_length: u64,
    pub uploaded: bool,
    /// The digest equalled `unless_sha256` (or differed from `repair_sha256`),
    /// so nothing was written.
    pub skipped: bool,
    /// Repair mode only: the county's record in the container no longer names
    /// this device's current copy (another device's newer version is arriving),
    /// so nothing was written and the normal pass handles the county.
    pub superseded: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ClearedResult {
    pub failed: Vec<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PullItemResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub text: Option<String>,
}

// ── Timeout plumbing ────────────────────────────────────────────────────────

/// Run `f` on a helper thread and wait at most `COMMAND_TIMEOUT` for it.
/// A timed-out helper keeps running to completion on its own thread (the
/// system calls it makes are not cancellable); its result is discarded.
fn with_timeout<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    let (tx, rx) = mpsc::channel();
    std::thread::spawn(move || {
        let _ = tx.send(f());
    });
    match rx.recv_timeout(COMMAND_TIMEOUT) {
        Ok(r) => r,
        Err(_) => Err("timeout".to_string()),
    }
}

/// Every command body runs blocking work through here so the async runtime's
/// worker is never held: spawn_blocking for the wait, a helper thread for
/// the work, and the timeout in between.
async fn blocking<T: Send + 'static>(f: impl FnOnce() -> Result<T, String> + Send + 'static) -> Result<T, String> {
    tauri::async_runtime::spawn_blocking(move || with_timeout(f))
        .await
        .map_err(|_| "unknown".to_string())?
}

// ── Container resolution ────────────────────────────────────────────────────

static CONTAINER: OnceLock<Mutex<Option<PathBuf>>> = OnceLock::new();

/// The container's `Documents/` directory, resolved once per process on a
/// helper thread and cached after the first non-nil answer. Nil (not signed
/// in, iCloud Drive off for the app, or an unauthorized build) is NOT cached,
/// so a later sign-in resolves on the next call.
fn container_documents() -> Option<PathBuf> {
    let cell = CONTAINER.get_or_init(|| Mutex::new(None));
    if let Ok(guard) = cell.lock() {
        if let Some(p) = guard.as_ref() {
            return Some(p.clone());
        }
    }
    let resolved = std::thread::spawn(|| {
        let fm = NSFileManager::defaultManager();
        let id = NSString::from_str(ICLOUD_CONTAINER_ID);
        let url = fm.URLForUbiquityContainerIdentifier(Some(&id))?;
        let path = url.path()?;
        Some(PathBuf::from(path.to_string()).join("Documents"))
    })
    .join()
    .ok()
    .flatten();
    if let Some(p) = &resolved {
        if let Ok(mut guard) = cell.lock() {
            *guard = Some(p.clone());
        }
    }
    resolved
}

fn file_url(path: &Path) -> Retained<NSURL> {
    NSURL::fileURLWithPath(&NSString::from_str(&path.to_string_lossy()))
}

/// The `.name.icloud` placeholder Foundation leaves for an item that exists
/// in the container but has not been downloaded to this device.
fn placeholder_path(dir: &Path, name: &str) -> PathBuf {
    dir.join(format!(".{}.icloud", name))
}

fn item_present(dir: &Path, name: &str) -> bool {
    is_regular_file(&dir.join(name)) || is_regular_file(&placeholder_path(dir, name))
}

// ── Availability probe ──────────────────────────────────────────────────────

#[cfg(target_os = "macos")]
mod sectask {
    use std::ffi::c_void;
    // Public macOS Security.framework API: read this process's own signed
    // entitlements. Linked here rather than through a binding crate because
    // three symbols do not earn a dependency.
    #[link(name = "Security", kind = "framework")]
    extern "C" {
        pub fn SecTaskCreateFromSelf(allocator: *const c_void) -> *mut c_void;
        pub fn SecTaskCopyValueForEntitlement(
            task: *mut c_void,
            entitlement: *const c_void,
            error: *mut *const c_void,
        ) -> *const c_void;
    }
    #[link(name = "CoreFoundation", kind = "framework")]
    extern "C" {
        pub fn CFRelease(cf: *const c_void);
    }
}

/// macOS: does the running binary carry the ubiquity entitlement at all?
/// NSString is toll-free bridged to CFString, so its pointer is the CFStringRef
/// the API wants. Verify-item V5: if this ever misbehaves under the hardened
/// runtime, `build_can_use_icloud` still has the profile-file check.
#[cfg(target_os = "macos")]
fn has_ubiquity_entitlement() -> bool {
    use std::ffi::c_void;
    unsafe {
        let task = sectask::SecTaskCreateFromSelf(std::ptr::null());
        if task.is_null() {
            return false;
        }
        let key = NSString::from_str("com.apple.developer.ubiquity-container-identifiers");
        let key_ptr: *const NSString = &*key;
        let value = sectask::SecTaskCopyValueForEntitlement(task, key_ptr as *const c_void, std::ptr::null_mut());
        let present = !value.is_null();
        if present {
            sectask::CFRelease(value);
        }
        sectask::CFRelease(task as *const c_void);
        present
    }
}

/// macOS: the restricted iCloud entitlements are only honored when the bundle
/// embeds a Developer ID provisioning profile at
/// `Contents/embedded.provisionprofile` (release.sh supplies it through the
/// tauri.icloud.conf.json overlay). A `tauri dev` binary has no bundle, so it
/// lands in the "build cannot use iCloud" state by design.
#[cfg(target_os = "macos")]
fn embedded_profile_present() -> bool {
    std::env::current_exe()
        .ok()
        .and_then(|exe| exe.parent().and_then(|p| p.parent()).map(|c| c.join("embedded.provisionprofile")))
        .map(|p| p.is_file())
        .unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn build_can_use_icloud() -> bool {
    has_ubiquity_entitlement() && embedded_profile_present()
}

/// iOS: the SecTask probe is private API there, and a build whose entitlement
/// the profile does not authorize does not install at all, so the state is
/// decided by the identity token and the container alone (schema.md).
#[cfg(target_os = "ios")]
fn build_can_use_icloud() -> bool {
    true
}

fn availability_state() -> &'static str {
    if !build_can_use_icloud() {
        return "build-cannot-use-icloud";
    }
    let fm = NSFileManager::defaultManager();
    if fm.ubiquityIdentityToken().is_none() {
        return "not-signed-in";
    }
    if container_documents().is_none() {
        return "drive-off-or-unauthorized";
    }
    "available"
}

// ── Device identity (FR-13) ─────────────────────────────────────────────────

/// C0 controls, DEL and the C1 range: what the validator rejects in a label
/// or a filename.
fn is_control(c: char) -> bool {
    let u = c as u32;
    u < 0x20 || (0x7F..=0x9F).contains(&u)
}

/// Truncate to at most `max` UTF-16 code units without splitting a surrogate
/// pair (a pair cut in half would decode as U+FFFD and could push the count
/// over the bound on re-encoding; dropping it keeps the count exact).
fn truncate_units(s: &str, max: usize) -> String {
    let mut out = String::new();
    let mut units = 0usize;
    for c in s.chars() {
        let w = c.len_utf16();
        if units + w > max {
            break;
        }
        units += w;
        out.push(c);
    }
    out
}

/// A device label as the validator accepts it: no control characters, at
/// most 64 UTF-16 code units, never empty (the platform word stands in).
fn sanitize_label(label: &str, fallback: &str) -> String {
    let cleaned: String = label.chars().filter(|c| !is_control(*c)).collect();
    let bounded = truncate_units(cleaned.trim(), MAX_LABEL_UNITS);
    if bounded.is_empty() {
        fallback.to_string()
    } else {
        bounded
    }
}

/// A display filename as the validator accepts it: no control characters, no
/// path separators, at most 255 UTF-16 code units, never empty.
fn sanitize_filename(name: &str) -> String {
    let cleaned: String = name.chars().filter(|c| !is_control(*c) && *c != '/' && *c != '\\').collect();
    let bounded = truncate_units(cleaned.trim(), MAX_FILENAME_UNITS);
    if bounded.is_empty() {
        "export.csv".to_string()
    } else {
        bounded
    }
}

/// The device id names a staging file, so it is validated at the command
/// boundary against the same shape the validator pins: 32 lowercase hex.
fn valid_device_id(id: &str) -> bool {
    id.len() == 32 && id.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

/// A key value inside the record's bounds: 1..=128 bytes, every byte printable
/// ASCII 0x21..=0x7E. Refused (never rewritten) when outside them.
fn valid_key_value(v: &str) -> bool {
    let n = v.len();
    n >= 1 && n <= MAX_KEY_VALUE_LEN && v.bytes().all(|b| (KEY_CHAR_MIN..=KEY_CHAR_MAX).contains(&b))
}

/// Days since 1970-01-01 of a proleptic Gregorian civil date (Howard
/// Hinnant's days_from_civil); month and day are range-checked by the caller.
fn days_from_civil(y: i64, m: u32, d: u32) -> i64 {
    let y = if m <= 2 { y - 1 } else { y };
    let era = if y >= 0 { y } else { y - 399 } / 400;
    let yoe = y - era * 400;
    let mp = (i64::from(m) + 9) % 12;
    let doy = (153 * mp + 2) / 5 + i64::from(d) - 1;
    let doe = yoe * 365 + yoe / 4 - yoe / 100 + doy;
    era * 146_097 + doe - 719_468
}

fn days_in_month(y: i64, m: u32) -> u32 {
    match m {
        1 | 3 | 5 | 7 | 8 | 10 | 12 => 31,
        4 | 6 | 9 | 11 => 30,
        _ => {
            if (y % 4 == 0 && y % 100 != 0) || y % 400 == 0 {
                29
            } else {
                28
            }
        }
    }
}

/// Parse the writers' exact time shape, `YYYY-MM-DDTHH:MM:SS.mmmZ` (what the
/// frontend's `toISOString` emits), into UTC epoch milliseconds. None for any
/// other byte layout or a field outside its calendar range, which is exactly
/// what the TypeScript twin's byte-equal round trip refuses (`isWritableTime`
/// in icloudRecord.ts; the parity test runs one fixture through both).
fn parse_iso_time_ms(t: &str) -> Option<i64> {
    let b = t.as_bytes();
    if b.len() != ISO_TIME_LEN {
        return None;
    }
    const DIGITS: [usize; 17] = [0, 1, 2, 3, 5, 6, 8, 9, 11, 12, 14, 15, 17, 18, 20, 21, 22];
    if !DIGITS.iter().all(|&i| b[i].is_ascii_digit()) {
        return None;
    }
    if b[4] != b'-' || b[7] != b'-' || b[10] != b'T' || b[13] != b':' || b[16] != b':' || b[19] != b'.' || b[23] != b'Z' {
        return None;
    }
    let num = |from: usize, to: usize| -> i64 { b[from..to].iter().fold(0i64, |acc, d| acc * 10 + i64::from(d - b'0')) };
    let (y, mo, d) = (num(0, 4), num(5, 7), num(8, 10));
    let (h, mi, s, ms) = (num(11, 13), num(14, 16), num(17, 19), num(20, 23));
    if !(1..=12).contains(&mo) {
        return None;
    }
    if d < 1 || d > i64::from(days_in_month(y, mo as u32)) {
        return None;
    }
    if h > 23 || mi > 59 || s > 59 {
        return None;
    }
    let days = days_from_civil(y, mo as u32, d as u32);
    Some(days * 86_400_000 + h * 3_600_000 + mi * 60_000 + s * 1000 + ms)
}

/// A change or clear time as the writers accept it, and both writers accept
/// exactly the same set (icloudPaths.parity.test.ts pins the fixture): the
/// canonical ISO shape, a real calendar instant, not before 2000-01-01 and
/// not more than a day past `now_ms`, which is the reader's own plausibility
/// window (security fix round, Findings 1 and 2). Refused, never rewritten.
fn valid_time_text(t: &str, now_ms: i64) -> bool {
    parse_iso_time_ms(t).map_or(false, |ms| ms >= MIN_TIME_MS && ms <= now_ms + MAX_FUTURE_MS)
}

/// This device's clock as UTC epoch milliseconds; a clock before 1970 reads
/// as 0, which fails every window check closed.
fn unix_now_ms() -> i64 {
    SystemTime::now().duration_since(UNIX_EPOCH).map(|d| d.as_millis() as i64).unwrap_or(0)
}

fn platform_fallback(platform: &str) -> &'static str {
    if platform == "ipad" {
        "iPad"
    } else if platform == "iphone" {
        "iPhone"
    } else {
        "Mac"
    }
}

/// The Rust write chokepoint for one key entry (icloud-api-key-sync FR-19).
/// The TypeScript chokepoint has already produced a valid entry, so anything
/// outside the bounds here is a programming error to fail closed on: the
/// state, value, time (its shape AND its window against `now_ms`, the same
/// predicate as `isWritableTime`), device id and platform are REFUSED rather
/// than rewritten; only the label is sanitized, exactly as for a file record.
/// Every `Err` is a member of the closed frontend union and carries no value.
fn sanitize_key_entry(input: KeyEntryInput, now_ms: i64) -> Result<KeyEntryFile, String> {
    if !valid_device_id(&input.origin.device_id) {
        return Err("unknown".to_string());
    }
    let platform = input.origin.platform;
    if platform != "mac" && platform != "iphone" && platform != "ipad" {
        return Err("unknown".to_string());
    }
    let origin = Origin {
        device_id: input.origin.device_id,
        label: sanitize_label(&input.origin.label, platform_fallback(&platform)),
        platform,
    };
    match input.state.as_str() {
        "key" => {
            let value = input.value.ok_or_else(|| "unknown".to_string())?;
            if !valid_key_value(&value) {
                return Err("unknown".to_string());
            }
            let changed_at = input.changed_at.ok_or_else(|| "unknown".to_string())?;
            if !valid_time_text(&changed_at, now_ms) {
                return Err("unknown".to_string());
            }
            Ok(KeyEntryFile { state: "key", value: Some(value), changed_at: Some(changed_at), cleared_at: None, origin })
        }
        "cleared" => {
            let cleared_at = input.cleared_at.ok_or_else(|| "unknown".to_string())?;
            if !valid_time_text(&cleared_at, now_ms) {
                return Err("unknown".to_string());
            }
            Ok(KeyEntryFile { state: "cleared", value: None, changed_at: None, cleared_at: Some(cleared_at), origin })
        }
        _ => Err("unknown".to_string()),
    }
}

/// `symlink_metadata`-based: the path is a regular file (not a symlink, not a
/// directory, not a device) and this is its on-disk length. Anything else is
/// `unavailable` and is never opened.
fn regular_file_len(path: &Path) -> Result<u64, String> {
    let meta = fs::symlink_metadata(path).map_err(|_| "unavailable".to_string())?;
    if !meta.file_type().is_file() {
        return Err("unavailable".to_string());
    }
    Ok(meta.len())
}

/// True when the path names a regular file (never a symlink or a directory).
fn is_regular_file(path: &Path) -> bool {
    fs::symlink_metadata(path).map(|m| m.file_type().is_file()).unwrap_or(false)
}

#[cfg(target_os = "macos")]
fn device_identity(_app: &AppHandle) -> (String, &'static str) {
    #[allow(deprecated)]
    let name = NSHostLabel::current().unwrap_or_default();
    (sanitize_label(&name, "Mac"), "mac")
}

#[cfg(target_os = "macos")]
struct NSHostLabel;

#[cfg(target_os = "macos")]
impl NSHostLabel {
    #[allow(deprecated)]
    fn current() -> Option<String> {
        // NSHost is deprecated in favor of the Network framework, but it is the
        // one API that returns the user's own Mac name ("Dave's Mac"), which
        // is exactly what FR-13 asks for as the device label.
        objc2_foundation::NSHost::currentHost().localizedName().map(|s| s.to_string())
    }
}

#[cfg(target_os = "ios")]
fn device_identity(app: &AppHandle) -> (String, &'static str) {
    use objc2::MainThreadMarker;
    use objc2_ui_kit::{UIDevice, UIUserInterfaceIdiom};
    // UIDevice is main-thread only; hop there and wait briefly. A timeout or
    // a failed hop falls back to the generic name, which FR-13 allows.
    let (tx, rx) = mpsc::channel::<(String, &'static str)>();
    let hop = app.run_on_main_thread(move || {
        let mtm = match MainThreadMarker::new() {
            Some(m) => m,
            None => return,
        };
        let device = UIDevice::currentDevice(mtm);
        let platform = if device.userInterfaceIdiom() == UIUserInterfaceIdiom::Pad { "ipad" } else { "iphone" };
        let name = device.name().to_string();
        let _ = tx.send((name, platform));
    });
    if hop.is_ok() {
        if let Ok((name, platform)) = rx.recv_timeout(Duration::from_secs(2)) {
            let fallback = if platform == "ipad" { "iPad" } else { "iPhone" };
            return (sanitize_label(&name, fallback), platform);
        }
    }
    ("iPhone".to_string(), "iphone")
}

// ── Coordinated file access ─────────────────────────────────────────────────

/// Coordinated read: `f` runs inside the coordinator's accessor with the
/// URL the coordinator hands back (which may differ from `url` in edge
/// cases; we honor it). Returns `f`'s result, or "unavailable" when the
/// coordinator itself reports an error.
fn coordinated_read<T>(url: &NSURL, f: impl Fn(&Path) -> Result<T, String>) -> Result<T, String> {
    let out: RefCell<Option<Result<T, String>>> = RefCell::new(None);
    let block = StackBlock::new(|new_url: NonNull<NSURL>| {
        let ns = unsafe { new_url.as_ref() };
        let path = ns.path().map(|p| PathBuf::from(p.to_string()));
        let r = match path {
            Some(p) => f(&p),
            None => Err("unavailable".to_string()),
        };
        *out.borrow_mut() = Some(r);
    });
    let coordinator = NSFileCoordinator::new();
    let mut err: Option<Retained<NSError>> = None;
    coordinator.coordinateReadingItemAtURL_options_error_byAccessor(
        url,
        NSFileCoordinatorReadingOptions::empty(),
        Some(&mut err),
        &block,
    );
    if err.is_some() {
        return Err("unavailable".to_string());
    }
    out.into_inner().unwrap_or_else(|| Err("unavailable".to_string()))
}

/// Coordinated write with the given options (ForReplacing for a temp-then-
/// rename, ForDeleting for a delete).
fn coordinated_write<T>(
    url: &NSURL,
    options: NSFileCoordinatorWritingOptions,
    f: impl Fn(&Path) -> Result<T, String>,
) -> Result<T, String> {
    let out: RefCell<Option<Result<T, String>>> = RefCell::new(None);
    let block = StackBlock::new(|new_url: NonNull<NSURL>| {
        let ns = unsafe { new_url.as_ref() };
        let path = ns.path().map(|p| PathBuf::from(p.to_string()));
        let r = match path {
            Some(p) => f(&p),
            None => Err("unavailable".to_string()),
        };
        *out.borrow_mut() = Some(r);
    });
    let coordinator = NSFileCoordinator::new();
    let mut err: Option<Retained<NSError>> = None;
    coordinator.coordinateWritingItemAtURL_options_error_byAccessor(url, options, Some(&mut err), &block);
    if err.is_some() {
        return Err("unavailable".to_string());
    }
    out.into_inner().unwrap_or_else(|| Err("unavailable".to_string()))
}

/// Remove staging entries in `Documents/.tmp/`: every entry when `device_id`
/// is None, else only this device's (`<deviceId>-*`). Regular files and
/// symlinks are removed as such; nothing is followed. Returns the count.
fn clear_staging(tmp_dir: &Path, device_id: Option<&str>) -> u32 {
    let mut removed = 0u32;
    let entries = match fs::read_dir(tmp_dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if let Some(id) = device_id {
            if !name.starts_with(&format!("{}-", id)) {
                continue;
            }
        }
        let path = entry.path();
        let is_dir = fs::symlink_metadata(&path).map(|m| m.file_type().is_dir()).unwrap_or(false);
        let ok = if is_dir { fs::remove_dir_all(&path).is_ok() } else { fs::remove_file(&path).is_ok() };
        if ok {
            removed += 1;
        }
    }
    removed
}

/// Remove every staging entry for ONE target name (`<anyDeviceId>-<target>`)
/// in `Documents/.tmp/`, from any device: a crash between staging and rename
/// would leave a complete key record in the container, and "the copy is
/// gone" must be exact (icloud-api-key-sync FR-32). Never touches a csv or a
/// file-record staging entry. Regular files and symlinks are removed as such.
fn clear_staging_for(tmp_dir: &Path, target_name: &str) -> u32 {
    let mut removed = 0u32;
    let entries = match fs::read_dir(tmp_dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    let suffix = format!("-{}", target_name);
    for entry in entries.flatten() {
        let name = entry.file_name();
        let name = name.to_string_lossy();
        if !name.ends_with(&suffix) {
            continue;
        }
        let path = entry.path();
        let is_dir = fs::symlink_metadata(&path).map(|m| m.file_type().is_dir()).unwrap_or(false);
        let ok = if is_dir { fs::remove_dir_all(&path).is_ok() } else { fs::remove_file(&path).is_ok() };
        if ok {
            removed += 1;
        }
    }
    removed
}

/// Rename the staged file onto its target. A directory planted at a fixed
/// name would make that rename fail on every check (rename(2) never replaces
/// a directory with a file), so it is removed first, inside the coordinated
/// replacing write, and the record heals by overwrite like every other
/// unreadable shape (security fix round, Finding 3). A symlink there is
/// replaced by the rename itself, as a link, never followed.
fn replace_item(tmp: &Path, dst: &Path) -> Result<(), String> {
    if fs::symlink_metadata(dst).map(|m| m.file_type().is_dir()).unwrap_or(false) {
        fs::remove_dir_all(dst).map_err(|_| "unavailable".to_string())?;
    }
    fs::rename(tmp, dst).map_err(|_| "unavailable".to_string())
}

/// Write `bytes` to a temp file beside the target inside the container, then
/// coordinated-rename it onto `target` (atomic on the same volume). The temp
/// name carries the device id so two devices staging the same slot never
/// share a temp file.
///
/// icloud-bar-chart-sync: a target inside a kind's subdirectory
/// (`barcharts/US-CA-001.txt`) stages FLAT in the one `.tmp/` directory, its
/// `/` replaced by `-` (`<deviceId>-barcharts-US-CA-001.txt`), so
/// `clear_staging` and Remove keep working over one directory; the target's
/// subdirectory is created on first write. A slot name has no `/`, so its
/// staging name and its target are byte-identical to before.
fn staging_name(target_name: &str) -> String {
    target_name.replace('/', "-")
}

fn atomic_container_write(docs: &Path, target_name: &str, device_id: &str, bytes: &[u8]) -> Result<(), String> {
    if !valid_device_id(device_id) {
        return Err("unknown".to_string());
    }
    let tmp_dir = docs.join(".tmp");
    fs::create_dir_all(&tmp_dir).map_err(|_| "unavailable".to_string())?;
    // A crash between a previous write and its rename leaves a complete copy
    // in the staging dir, inside the container; clear this device's stale
    // entries before staging a new one.
    clear_staging(&tmp_dir, Some(device_id));
    let tmp = tmp_dir.join(format!("{}-{}", device_id, staging_name(target_name)));
    fs::write(&tmp, bytes).map_err(|_| "unavailable".to_string())?;
    let target = docs.join(target_name);
    if target_name.contains('/') {
        if let Some(parent) = target.parent() {
            if fs::create_dir_all(parent).is_err() {
                let _ = fs::remove_file(&tmp);
                return Err("unavailable".to_string());
            }
        }
    }
    let url = file_url(&target);
    let result = coordinated_write(&url, NSFileCoordinatorWritingOptions::ForReplacing, |dst| replace_item(&tmp, dst));
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// How many times `clear_way` deletes before it gives up: a name can be held by
/// a regular file and a placeholder at once (two deletes), plus one spare.
const CLEAR_WAY_ATTEMPTS: usize = 3;

/// Make sure the name a write is about to take is held by nothing, or by a
/// copy of that name's item that Foundation reports `Current` (decisions.md
/// entry 19). The rename that lands every write replaces a regular file at the
/// name, and that is how the two-file sync has always updated its items: over
/// a copy this device holds current, because it downloads every newer version
/// a peer writes before it could ever push over one. It does not reach an
/// item held only as a PLACEHOLDER (`.<name>.icloud`), which the county file
/// on a second device typically is: the first device's version, never
/// downloaded here because this device's own copy was the newer one. The
/// rename then creates a second item of the same name beside the placeholder,
/// which iCloud does not upload under that name (the row stays on "Waiting to
/// upload"), while the peer, reading this device's newer record, finds its own
/// old file or none under the name ("Could not sync"). The same is true of a
/// local copy iCloud reports out of date. So such an item is deleted first,
/// through the coordinated delete on its LOGICAL URL, which NSFileManager
/// carries out as the deletion of the iCloud item a placeholder stands for,
/// and the write then creates its item at a free name: the replacement the
/// rename already means for a current copy, made explicit where the rename
/// cannot make it. A current copy, or nothing, is left to the rename exactly
/// as before, so the two-file sync's own case is unchanged. Bounded: at most
/// `CLEAR_WAY_ATTEMPTS` deletes, then `unavailable`, and the write is refused
/// rather than leaving two items under one name.
fn clear_way<I: ContainerIo>(io: &I, dir: &Path, name: &str) -> Result<(), String> {
    for _ in 0..CLEAR_WAY_ATTEMPTS {
        let path = dir.join(name);
        let placeholder = is_regular_file(&placeholder_path(dir, name));
        let on_disk = is_regular_file(&path);
        if !placeholder && (!on_disk || io.flags(&path).downloaded) {
            return Ok(());
        }
        io.delete(dir, name)?;
    }
    Err("unavailable".to_string())
}

/// The COUNTY kind's write (a county file, its record, a cleared marker):
/// the shipped staging and coordinated rename of `atomic_container_write`,
/// with `clear_way` before the rename and no directory creation of its own.
/// Scoped to the county kind at review (decisions.md entry 19, follow-up 1):
/// the data files, the key record and the day-obs snapshots keep the shipped
/// helper, byte for byte, because their flows never write over a name this
/// device does not hold current and they work on every device.
fn county_container_write<I: ContainerIo>(io: &I, docs: &Path, target_name: &str, device_id: &str, bytes: &[u8]) -> Result<(), String> {
    if !valid_device_id(device_id) {
        return Err("unknown".to_string());
    }
    let target = docs.join(target_name);
    let (dir, name) = match (target.parent(), target.file_name().and_then(|n| n.to_str())) {
        (Some(d), Some(n)) => (d.to_path_buf(), n.to_string()),
        _ => return Err("unknown".to_string()),
    };
    // Never create the target's directory here: an uncoordinated mkdir of a
    // kind's subdirectory is how a second, same-named directory is made while
    // iCloud's is still on its way (`ensure_subdir_with` owns that).
    if !fs::symlink_metadata(&dir).map(|m| m.file_type().is_dir()).unwrap_or(false) {
        return Err("unavailable".to_string());
    }
    let tmp_dir = docs.join(".tmp");
    fs::create_dir_all(&tmp_dir).map_err(|_| "unavailable".to_string())?;
    // A crash between a previous write and its rename leaves a complete copy
    // in the staging dir, inside the container; clear this device's stale
    // entries before staging a new one.
    clear_staging(&tmp_dir, Some(device_id));
    let tmp = tmp_dir.join(format!("{}-{}", device_id, staging_name(target_name)));
    fs::write(&tmp, bytes).map_err(|_| "unavailable".to_string())?;
    if let Err(e) = clear_way(io, &dir, &name) {
        let _ = fs::remove_file(&tmp);
        return Err(e);
    }
    let url = file_url(&target);
    let result = coordinated_write(&url, NSFileCoordinatorWritingOptions::ForReplacing, |dst| replace_item(&tmp, dst));
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// A symlink or a directory planted at an item's fixed name (a csv, a file
/// record or the key record; `coordinated_delete` is called with nothing
/// else) is removed as such, never followed and never handed to the
/// coordinator, since it is not an item this app wrote. `None` when the path
/// holds neither, so the coordinated delete proceeds. A directory was
/// refused until the security fix round (Finding 3), which left a key
/// removal pending indefinitely; Remove is now always a recovery path.
fn remove_planted_item(target: &Path) -> Result<Option<bool>, String> {
    if let Ok(meta) = fs::symlink_metadata(target) {
        if meta.file_type().is_symlink() {
            fs::remove_file(target).map_err(|_| "unavailable".to_string())?;
            return Ok(Some(true));
        }
        if meta.file_type().is_dir() {
            fs::remove_dir_all(target).map_err(|_| "unavailable".to_string())?;
            return Ok(Some(true));
        }
    }
    Ok(None)
}

/// Coordinated delete of a container item (the logical URL: NSFileManager
/// handles a not-yet-downloaded placeholder correctly, which fs::remove_file
/// would not). Absent items are not an error.
fn coordinated_delete(docs: &Path, name: &str) -> Result<bool, String> {
    let target = docs.join(name);
    if let Some(done) = remove_planted_item(&target)? {
        return Ok(done);
    }
    if !item_present(docs, name) {
        return Ok(false);
    }
    let url = file_url(&target);
    coordinated_write(&url, NSFileCoordinatorWritingOptions::ForDeleting, |p| {
        if fs::symlink_metadata(p).map(|m| m.file_type().is_dir()).unwrap_or(false) {
            return Err("unavailable".to_string());
        }
        let fm = NSFileManager::defaultManager();
        match fm.removeItemAtURL_error(&file_url(p)) {
            Ok(()) => Ok(true),
            Err(_) => {
                // A placeholder-only item may still be reported as absent by
                // the time we get here; treat "gone" as success.
                if item_present(docs, name) {
                    Err("unavailable".to_string())
                } else {
                    Ok(true)
                }
            }
        }
    })
}

// ── File status ─────────────────────────────────────────────────────────────

/// The four ubiquity flags of one container item, read through
/// resourceValuesForKeys on its logical URL (Foundation answers for a
/// not-yet-downloaded placeholder too). Absent values fall back to what the
/// bytes on disk say, so a non-ubiquitous copy reads as downloaded and
/// uploaded rather than trapping a row in a transfer state.
struct UbiquityFlags {
    downloaded: bool,
    downloading: bool,
    uploaded: bool,
    uploading: bool,
}

fn ubiquity_flags(path: &Path) -> UbiquityFlags {
    let on_disk = is_regular_file(path);
    let url = file_url(path);
    let keys = unsafe {
        NSArray::from_slice(&[
            objc2_foundation::NSURLUbiquitousItemDownloadingStatusKey,
            objc2_foundation::NSURLUbiquitousItemIsDownloadingKey,
            objc2_foundation::NSURLUbiquitousItemIsUploadedKey,
            objc2_foundation::NSURLUbiquitousItemIsUploadingKey,
        ])
    };
    let values = match url.resourceValuesForKeys_error(&keys) {
        Ok(v) => v,
        Err(_) => {
            return UbiquityFlags { downloaded: on_disk, downloading: false, uploaded: on_disk, uploading: false };
        }
    };
    let bool_for = |key: &objc2_foundation::NSURLResourceKey| -> Option<bool> {
        values
            .objectForKey(key)
            .and_then(|v| v.downcast_ref::<objc2_foundation::NSNumber>().map(|n| n.boolValue()))
    };
    let status = values
        .objectForKey(unsafe { objc2_foundation::NSURLUbiquitousItemDownloadingStatusKey })
        .and_then(|v| v.downcast_ref::<NSString>().map(|s| s.to_string()));
    let current = unsafe { objc2_foundation::NSURLUbiquitousItemDownloadingStatusCurrent }.to_string();
    let downloaded = match status {
        Some(s) => s == current,
        None => on_disk,
    };
    UbiquityFlags {
        downloaded,
        downloading: bool_for(unsafe { objc2_foundation::NSURLUbiquitousItemIsDownloadingKey }).unwrap_or(false),
        uploaded: bool_for(unsafe { objc2_foundation::NSURLUbiquitousItemIsUploadedKey }).unwrap_or(on_disk),
        uploading: bool_for(unsafe { objc2_foundation::NSURLUbiquitousItemIsUploadingKey }).unwrap_or(false),
    }
}

/// The slot's csv status, with `uploaded` meaning BOTH the csv and its record
/// are in iCloud (the record is the commit point a peer reads, so a csv that
/// is up while its record is not is still "waiting").
fn csv_status(docs: &Path, slot: Slot) -> FileStatus {
    let name = slot.csv_name();
    let real = docs.join(name);
    if !item_present(docs, name) {
        return FileStatus {
            present: false,
            downloaded: false,
            downloading: false,
            byte_length: None,
            uploaded: false,
            uploading: false,
        };
    }
    let csv = ubiquity_flags(&real);
    let record_name = slot.record_name();
    let record = if item_present(docs, &record_name) {
        ubiquity_flags(&docs.join(&record_name))
    } else {
        UbiquityFlags { downloaded: true, downloading: false, uploaded: true, uploading: false }
    };
    let byte_length = regular_file_len(&real).ok();
    FileStatus {
        present: true,
        downloaded: csv.downloaded,
        downloading: csv.downloading,
        byte_length,
        uploaded: csv.uploaded && record.uploaded,
        uploading: csv.uploading || record.uploading,
    }
}

fn local_csv_path(app: &AppHandle, slot: Slot) -> Result<PathBuf, String> {
    use tauri::Manager;
    let base = app.path().app_local_data_dir().map_err(|_| "unavailable".to_string())?;
    Ok(base.join(LOCAL_DATA_DIR).join(slot.csv_name()))
}

fn sha256_hex(bytes: &[u8]) -> String {
    let digest = Sha256::digest(bytes);
    let mut s = String::with_capacity(64);
    for b in digest {
        s.push_str(&format!("{:02x}", b));
    }
    s
}

// ── Commands ────────────────────────────────────────────────────────────────

#[tauri::command]
pub async fn icloud_status(app: AppHandle) -> Result<Status, String> {
    let (device_label, platform) = device_identity(&app);
    let state = blocking(move || Ok(availability_state())).await?;
    Ok(Status { state, device_label, platform })
}

/// The bytes at a record's path, as the frontend validator will see them
/// (security fix round, Finding 3, closing the 1.0.11 review's Finding 9
/// for every record at this one site). A regular file inside the size bound
/// reads as its text. Every shape the validator must treat as ABSENT, so
/// the next check overwrites it and Remove clears it, reads as the EMPTY
/// string, which the validator rejects as malformed-json: a symlink or a
/// directory planted at the name (never opened), a file past the 16 KB
/// bound (never loaded), and bytes that are not UTF-8. Only a genuine I/O
/// error is `unavailable`, and an item that vanished is None.
fn record_text_at(p: &Path) -> Result<Option<String>, String> {
    match fs::symlink_metadata(p) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
        Err(_) => return Err("unavailable".to_string()),
        Ok(meta) => {
            if !meta.file_type().is_file() || meta.len() > MAX_RECORD_BYTES {
                return Ok(Some(String::new()));
            }
        }
    }
    match fs::read(p) {
        Ok(bytes) => Ok(Some(String::from_utf8(bytes).unwrap_or_default())),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(_) => Err("unavailable".to_string()),
    }
}

/// The one read path for every record in the container (a file record or
/// the key record): the raw text, or None when absent. A coordinated read of
/// an undownloaded record downloads it first (a record is a few hundred
/// bytes); offline that wait is what the command timeout bounds.
fn read_record_text(docs: &Path, name: &str) -> Result<Option<String>, String> {
    if !item_present(docs, name) {
        return Ok(None);
    }
    let url = file_url(&docs.join(name));
    coordinated_read(&url, record_text_at)
}

#[tauri::command]
pub async fn icloud_read_record(slot: Slot) -> Result<RecordRead, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let record = read_record_text(&docs, &slot.record_name())?;
        Ok(RecordRead { record, file: csv_status(&docs, slot) })
    })
    .await
}

#[tauri::command]
pub async fn icloud_push(
    app: AppHandle,
    slot: Slot,
    filename: String,
    uploaded_at: String,
    origin: Origin,
) -> Result<PushResult, String> {
    let local = local_csv_path(&app, slot)?;
    if !valid_device_id(&origin.device_id) {
        return Err("unknown".to_string());
    }
    // Sanitize ONCE, at the write chokepoint, to the validator's exact bounds
    // (a record this device writes must validate on every reader, itself
    // included, or the file would be re-pushed on every check).
    let fallback = if origin.platform == "ipad" { "iPad" } else if origin.platform == "iphone" { "iPhone" } else { "Mac" };
    let origin = Origin {
        device_id: origin.device_id,
        label: sanitize_label(&origin.label, fallback),
        platform: origin.platform,
    };
    let filename = sanitize_filename(&filename);
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        // Bound the local file by its on-disk length BEFORE it is loaded, and
        // refuse anything that is not a regular file.
        let len = match regular_file_len(&local) {
            Ok(n) => n,
            Err(_) => return Err("local-missing".to_string()),
        };
        if len > MAX_BYTES {
            return Err("too-large".to_string());
        }
        let bytes = fs::read(&local).map_err(|_| "local-missing".to_string())?;
        if bytes.len() as u64 > MAX_BYTES {
            return Err("too-large".to_string());
        }
        let sha256 = sha256_hex(&bytes);
        let byte_length = bytes.len() as u64;
        fs::create_dir_all(&docs).map_err(|_| "unavailable".to_string())?;
        atomic_container_write(&docs, slot.csv_name(), &origin.device_id, &bytes)?;
        let record = RecordFile {
            version: 1,
            slot: slot.key(),
            county: None,
            state: "file",
            filename: Some(&filename),
            uploaded_at: Some(&uploaded_at),
            cleared_at: None,
            origin: &origin,
            byte_length: Some(byte_length),
            sha256: Some(&sha256),
        };
        let json = serde_json::to_vec(&record).map_err(|_| "unknown".to_string())?;
        atomic_container_write(&docs, &slot.record_name(), &origin.device_id, &json)?;
        let uploaded = csv_status(&docs, slot).uploaded;
        Ok(PushResult { sha256, byte_length, uploaded })
    })
    .await
}

#[tauri::command]
pub async fn icloud_push_cleared(slot: Slot, cleared_at: String, origin: Origin) -> Result<(), String> {
    if !valid_device_id(&origin.device_id) {
        return Err("unknown".to_string());
    }
    let fallback = if origin.platform == "ipad" { "iPad" } else if origin.platform == "iphone" { "iPhone" } else { "Mac" };
    let origin = Origin {
        device_id: origin.device_id,
        label: sanitize_label(&origin.label, fallback),
        platform: origin.platform,
    };
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        fs::create_dir_all(&docs).map_err(|_| "unavailable".to_string())?;
        coordinated_delete(&docs, slot.csv_name())?;
        let record = RecordFile {
            version: 1,
            slot: slot.key(),
            county: None,
            state: "cleared",
            filename: None,
            uploaded_at: None,
            cleared_at: Some(&cleared_at),
            origin: &origin,
            byte_length: None,
            sha256: None,
        };
        let json = serde_json::to_vec(&record).map_err(|_| "unknown".to_string())?;
        atomic_container_write(&docs, &slot.record_name(), &origin.device_id, &json)?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn icloud_pull(
    app: AppHandle,
    slot: Slot,
    expected_sha256: String,
    expected_byte_length: u64,
) -> Result<(), String> {
    let local = local_csv_path(&app, slot)?;
    blocking(move || {
        if expected_byte_length > MAX_BYTES {
            return Err("too-large".to_string());
        }
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let status = csv_status(&docs, slot);
        if !status.present {
            return Err("absent".to_string());
        }
        if !status.downloaded {
            return Err("not-downloaded".to_string());
        }
        let url = file_url(&docs.join(slot.csv_name()));
        let bytes = coordinated_read(&url, |p| {
            // Security round, Finding 1: the on-disk length is checked BEFORE
            // the bytes are loaded (a multi-gigabyte container file is never
            // read into memory), and only a regular file is opened at all.
            let len = regular_file_len(p)?;
            if len > MAX_BYTES {
                return Err("too-large".to_string());
            }
            if len != expected_byte_length {
                return Err("mismatch".to_string());
            }
            fs::read(p).map_err(|_| "unavailable".to_string())
        })?;
        // FR-29: the local copy is never touched unless the bytes verified in
        // full. Length again on what was actually read, then the digest.
        if bytes.len() as u64 != expected_byte_length {
            return Err("mismatch".to_string());
        }
        if sha256_hex(&bytes) != expected_sha256 {
            return Err("mismatch".to_string());
        }
        if let Some(parent) = local.parent() {
            fs::create_dir_all(parent).map_err(|_| "unavailable".to_string())?;
        }
        let tmp = local.with_extension("csv.tmp");
        fs::write(&tmp, &bytes).map_err(|_| "unavailable".to_string())?;
        fs::rename(&tmp, &local).map_err(|_| {
            let _ = fs::remove_file(&tmp);
            "unavailable".to_string()
        })?;
        Ok(())
    })
    .await
}

#[tauri::command]
pub async fn icloud_start_download(slot: Slot) -> Result<(), String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        if !item_present(&docs, slot.csv_name()) {
            return Err("absent".to_string());
        }
        let url = file_url(&docs.join(slot.csv_name()));
        NSFileManager::defaultManager()
            .startDownloadingUbiquitousItemAtURL_error(&url)
            .map_err(|_| "unavailable".to_string())
    })
    .await
}

#[tauri::command]
pub async fn icloud_remove_all() -> Result<RemoveResult, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let mut removed = 0u32;
        for slot in [Slot::Ebird, Slot::Ml] {
            if coordinated_delete(&docs, slot.csv_name())? {
                removed += 1;
            }
            if coordinated_delete(&docs, &slot.record_name())? {
                removed += 1;
            }
        }
        // icloud-bar-chart-sync (FR-13, FR-27): every county file and record,
        // then every device's day-obs snapshot and record. Still never the key
        // record (FR-35 of icloud-api-key-sync).
        removed += remove_items_in(&docs, ItemKind::Barchart)?;
        removed += remove_items_in(&docs, ItemKind::DayObs)?;
        // Security round, Finding 5: a crash between a staging write and its
        // rename leaves a complete copy under .tmp/; Remove clears every
        // entry there too, so "the copies in your iCloud account" is exact.
        let tmp_dir = docs.join(".tmp");
        removed += clear_staging(&tmp_dir, None);
        let _ = fs::remove_dir(&tmp_dir);
        Ok(RemoveResult { removed })
    })
    .await
}

// ── icloud-api-key-sync: the key record commands ────────────────────────────

fn key_record_status(docs: &Path) -> KeyRecordStatus {
    if !item_present(docs, KEYS_RECORD_NAME) {
        return KeyRecordStatus { present: false, downloaded: false, downloading: false, uploaded: false, uploading: false };
    }
    let f = ubiquity_flags(&docs.join(KEYS_RECORD_NAME));
    KeyRecordStatus { present: true, downloaded: f.downloaded, downloading: f.downloading, uploaded: f.uploaded, uploading: f.uploading }
}

/// The key record's status, and in `record` mode its raw text (the frontend
/// validates it; Rust never parses a record). Inside `blocking`, so the 8 s
/// timeout bounds an on-demand download of a placeholder record.
#[tauri::command]
pub async fn icloud_read_keys(mode: KeysReadMode) -> Result<KeysRead, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let record = match mode {
            KeysReadMode::Record => read_record_text(&docs, KEYS_RECORD_NAME)?,
            KeysReadMode::Status => None,
        };
        Ok(KeysRead { record, status: key_record_status(&docs) })
    })
    .await
}

/// Write the whole key record atomically (staging under
/// `.tmp/<deviceId>-keys.record.json`, coordinated replace). Every entry is
/// refused-or-passed by `sanitize_key_entry` BEFORE anything touches the
/// container; the key value is used only to build the record.
#[tauri::command]
pub async fn icloud_write_keys(device_id: String, slots: KeySlotsInput) -> Result<KeysWriteResult, String> {
    if !valid_device_id(&device_id) {
        return Err("unknown".to_string());
    }
    let now_ms = unix_now_ms();
    let ebird = slots.ebird.map(|e| sanitize_key_entry(e, now_ms)).transpose()?;
    let openweather = slots.openweather.map(|e| sanitize_key_entry(e, now_ms)).transpose()?;
    let record = KeyRecordFile { version: 1, kind: "keys", slots: KeySlotsFile { ebird, openweather } };
    let json = serde_json::to_vec(&record).map_err(|_| "unknown".to_string())?;
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        fs::create_dir_all(&docs).map_err(|_| "unavailable".to_string())?;
        atomic_container_write(&docs, KEYS_RECORD_NAME, &device_id, &json)?;
        Ok(KeysWriteResult { uploaded: key_record_status(&docs).uploaded })
    })
    .await
}

/// Delete the key record and every key staging entry from any device; never
/// a csv or a file record (FR-35). Absent items are not an error.
#[tauri::command]
pub async fn icloud_remove_keys() -> Result<RemoveResult, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let mut removed = 0u32;
        if coordinated_delete(&docs, KEYS_RECORD_NAME)? {
            removed += 1;
        }
        removed += clear_staging_for(&docs.join(".tmp"), KEYS_RECORD_NAME);
        Ok(RemoveResult { removed })
    })
    .await
}

// ── Change detection (NSMetadataQuery) ──────────────────────────────────────

struct Watch {
    query: Retained<NSMetadataQuery>,
    tokens: Vec<Retained<ProtocolObject<dyn NSObjectProtocol>>>,
}

thread_local! {
    // Main thread only: the query needs the main run loop, and every
    // start/stop runs through app.run_on_main_thread.
    static WATCH: RefCell<Option<Watch>> = const { RefCell::new(None) };
}

fn stop_watch_on_main() {
    WATCH.with(|w| {
        if let Some(watch) = w.borrow_mut().take() {
            watch.query.stopQuery();
            let center = NSNotificationCenter::defaultCenter();
            for token in &watch.tokens {
                let observer: &AnyObject = (**token).as_ref();
                unsafe { center.removeObserver(observer) };
            }
        }
    });
}

fn start_watch_on_main(app: AppHandle) {
    stop_watch_on_main();
    let query = NSMetadataQuery::new();
    let scope: &AnyObject = unsafe { objc2_foundation::NSMetadataQueryUbiquitousDocumentsScope };
    let scopes: Retained<NSArray<AnyObject>> = NSArray::from_slice(&[scope]);
    unsafe { query.setSearchScopes(&scopes) };
    // Only the tiny record files (every `*.record.json` in the documents
    // scope, subdirectories included): a peer's csv, county file or snapshot
    // landing is not interesting until its record does, and the record is the
    // commit point.
    let key: &AnyObject = unsafe { objc2_foundation::NSMetadataItemFSNameKey };
    let args: Retained<NSArray<AnyObject>> = NSArray::from_slice(&[key]);
    let predicate = unsafe { NSPredicate::predicateWithFormat_argumentArray(ns_string!("%K LIKE '*.record.json'"), Some(&args)) };
    query.setPredicate(Some(&predicate));
    query.setNotificationBatchingInterval(1.0);

    let center = NSNotificationCenter::defaultCenter();
    let queue = NSOperationQueue::mainQueue();
    let query_obj: &AnyObject = &query;
    let mut tokens = Vec::with_capacity(3);

    let changed = {
        let app = app.clone();
        RcBlock::new(move |_n: NonNull<NSNotification>| {
            let _ = app.emit("icloud-changed", ());
        })
    };
    let names = unsafe {
        [
            objc2_foundation::NSMetadataQueryDidFinishGatheringNotification,
            objc2_foundation::NSMetadataQueryDidUpdateNotification,
        ]
    };
    for name in names {
        let token = unsafe { center.addObserverForName_object_queue_usingBlock(Some(name), Some(query_obj), Some(&queue), &changed) };
        tokens.push(token);
    }

    let identity = {
        let app = app.clone();
        RcBlock::new(move |_n: NonNull<NSNotification>| {
            let _ = app.emit("icloud-identity-changed", ());
        })
    };
    let identity_name = unsafe { objc2_foundation::NSUbiquityIdentityDidChangeNotification };
    let token = unsafe { center.addObserverForName_object_queue_usingBlock(Some(identity_name), None, Some(&queue), &identity) };
    tokens.push(token);

    query.startQuery();
    WATCH.with(|w| {
        *w.borrow_mut() = Some(Watch { query, tokens });
    });
}

#[tauri::command]
pub async fn icloud_watch(app: AppHandle, enabled: bool) -> Result<(), String> {
    // The query needs the container initialized first; resolve (and cache)
    // it off the main thread before hopping over to start.
    if enabled {
        let _ = blocking(move || Ok(container_documents().is_some())).await;
    }
    let handle = app.clone();
    app.run_on_main_thread(move || {
        if enabled {
            start_watch_on_main(handle);
        } else {
            stop_watch_on_main();
        }
    })
    .map_err(|e| e.to_string())
}

// ── icloud-bar-chart-sync: the item commands ────────────────────────────────
//
// Seven commands over the two item kinds (schema.md section 9.3). Each command
// converts its IPC argument to a validated `SyncItem` (or `ItemKind`) FIRST,
// then runs a `*_at` core that takes the container's `Documents/` directory as
// a parameter, so the read posture is unit-tested against a temporary
// directory with no iCloud account (this Mac is not signed in; the real
// container is exercised by the user after TestFlight). Every error is a
// member of the closed frontend union.

fn local_data_dir(app: &AppHandle) -> Result<PathBuf, String> {
    use tauri::Manager;
    let base = app.path().app_local_data_dir().map_err(|_| "unavailable".to_string())?;
    Ok(base.join(LOCAL_DATA_DIR))
}

/// An origin as an item record may carry it: the device id and platform
/// REFUSED when outside the validator's set, the label sanitized (the slot
/// writer's rule, plus the platform check the validator also applies).
fn item_origin(origin: Origin) -> Result<Origin, String> {
    if !valid_device_id(&origin.device_id) {
        return Err("unknown".to_string());
    }
    let platform = origin.platform;
    if platform != "mac" && platform != "iphone" && platform != "ipad" {
        return Err("unknown".to_string());
    }
    Ok(Origin {
        device_id: origin.device_id,
        label: sanitize_label(&origin.label, platform_fallback(&platform)),
        platform,
    })
}

/// The kind's subdirectory, only when it is a REAL directory (never followed
/// through a symlink planted at its name). Read paths use this; a planted
/// link or file there reads as "nothing in iCloud".
fn real_subdir(docs: &Path, kind: ItemKind) -> Option<PathBuf> {
    let sub = docs.join(kind.subdir());
    if fs::symlink_metadata(&sub).map(|m| m.file_type().is_dir()).unwrap_or(false) {
        Some(sub)
    } else {
        None
    }
}

/// The kind's subdirectory for a WRITE (decisions.md entry 19). A real
/// directory is used as it is. A symlink or a file planted at its name is
/// removed as such (never followed, so no write can land outside the
/// container). When only iCloud's PLACEHOLDER for it is here, the directory
/// exists in iCloud and has not come down to this device: its download is
/// requested and the write is refused (`unavailable`), because creating one
/// here would make a second, same-named directory that iCloud keeps apart
/// from the first (`barcharts 2`), and every write into it would be invisible
/// to the other devices. Otherwise the directory is created inside a
/// coordinated write, as every other change to the container is made, so
/// iCloud is told about the new item rather than finding it later. The
/// residual: a first write racing a peer's directory that has not reached
/// this device at all (not even as a placeholder) can still make a duplicate;
/// the listing reads only the canonical name, every item in a duplicate is a
/// copy of a local file its device pushes again to the canonical directory,
/// and Remove synced files takes duplicates too (`remove_items_in`).
fn ensure_subdir_with<I: ContainerIo>(io: &I, docs: &Path, kind: ItemKind) -> Result<PathBuf, String> {
    let sub = docs.join(kind.subdir());
    match fs::symlink_metadata(&sub) {
        Ok(meta) if meta.file_type().is_dir() => return Ok(sub),
        Ok(_) => fs::remove_file(&sub).map_err(|_| "unavailable".to_string())?,
        Err(_) => {}
    }
    if is_regular_file(&placeholder_path(docs, kind.subdir())) {
        io.start_download(&sub);
        return Err("unavailable".to_string());
    }
    io.create_dir(&sub)?;
    if fs::symlink_metadata(&sub).map(|m| m.file_type().is_dir()).unwrap_or(false) {
        Ok(sub)
    } else {
        Err("unavailable".to_string())
    }
}

/// Whether the item's record reports iCloud holds it (absent reads false).
fn record_uploaded(sub: &Path, item: &SyncItem) -> bool {
    let name = item.record_name();
    item_present(sub, &name) && ubiquity_flags(&sub.join(&name)).uploaded
}

/// The item's companion file as the listing reports it: flags only, the file
/// itself is never read here.
///
/// A name held by a regular file AND by iCloud's placeholder at once is
/// CONTESTED (decisions.md entry 19): the placeholder is the item iCloud holds
/// under that name, and the file on disk is a second item this device made
/// beside it (a write by a 1.0.40.1 to 1.0.40.3 build onto a name whose item was never
/// downloaded here), which iCloud cannot upload under the same name. It is
/// never reported downloaded, so the writer repairs it and a reader never
/// pulls the wrong bytes from it.
fn item_file_status(sub: &Path, item: &SyncItem, record_up: bool) -> ListedFile {
    let name = item.file_name();
    if !item_present(sub, &name) {
        return ListedFile { present: false, downloaded: false, downloading: false, byte_length: None, uploaded: false };
    }
    let path = sub.join(&name);
    let f = ubiquity_flags(&path);
    let contested = is_regular_file(&path) && is_regular_file(&placeholder_path(sub, &name));
    ListedFile {
        present: true,
        downloaded: f.downloaded && !contested,
        downloading: f.downloading,
        byte_length: regular_file_len(&path).ok(),
        uploaded: f.uploaded && record_up,
    }
}

/// The id a directory entry names as a RECORD of this kind: `<id>.record.json`
/// or its undownloaded placeholder `.<id>.record.json.icloud`, where `<id>`
/// passes the kind's predicate. Anything else is None and is never read.
fn record_id_from_name(name: &str, kind: ItemKind) -> Option<String> {
    let base = match name.strip_prefix('.').and_then(|r| r.strip_suffix(".icloud")) {
        Some(inner) => inner,
        None => name,
    };
    let id = base.strip_suffix(".record.json")?;
    kind.item_from_id(id).map(|_| id.to_string())
}

/// The id a directory entry names as ANY item of this kind (a record, the
/// companion file, or either one's placeholder). Used by the bulk removal.
fn item_id_from_any_name(name: &str, kind: ItemKind) -> Option<String> {
    let base = match name.strip_prefix('.').and_then(|r| r.strip_suffix(".icloud")) {
        Some(inner) => inner,
        None => name,
    };
    let file_ext = match kind {
        ItemKind::Barchart => ".txt",
        ItemKind::DayObs => ".json",
    };
    let id = base.strip_suffix(".record.json").or_else(|| base.strip_suffix(file_ext))?;
    kind.item_from_id(id).map(|_| id.to_string())
}

/// One listing of a kind, at most `max` items (the command passes
/// `MAX_LISTED_ITEMS`; a test passes a small bound). Work: one name check per
/// directory entry, each O(1), and one bounded record read per valid item.
///
/// A record that is not `Current` here (a placeholder, or a local copy another
/// device has since replaced) has its download requested and is then READ THE
/// WAY THE TWO-FILE SYNC READS ITS RECORDS, through a coordinated read, which
/// brings the newer version down before the read proceeds (device pass on
/// 1.0.40.2, decisions.md entry 18). Until then the listing only requested
/// the download and skipped the record, and nothing in the county path ever
/// read a record that was not `Current`: since iOS 18.4 a replaced local copy
/// can stay in the `Downloaded` (out-of-date) state indefinitely (FB17662379),
/// so the device that wrote a county's record never read the marker another
/// device wrote over it. Those reads share `LISTING_READ_BUDGET`; a record not
/// read in time, or still not `Current` after its read, is reported with
/// `present: true, record: None`, so the frontend skips that item this check
/// rather than treating it as absent (it must never push over a peer's newer
/// file it has not read). A non-regular, oversized or non-UTF-8 record reads
/// as the empty text the validator treats as absent, exactly as a slot record
/// does.
fn list_items_bounded(docs: &Path, kind: ItemKind, max: usize) -> ListResult {
    list_items_with(docs, kind, max, &Foundation, fetch_gate())
}

/// How long one listing waits for the records it had to fetch (below). Units:
/// wall-clock time inside ONE listing command. It sits inside the 8 s
/// `COMMAND_TIMEOUT` and the frontend's 10 s check budget.
const LISTING_READ_BUDGET: Duration = Duration::from_secs(2);

/// How long ALL listings together may wait for fetched records inside one
/// `READ_WAIT_WINDOW` (security report, 1.0.40.3, I8). A check lists more than
/// twice: the county listing, the day-obs listing, and the county download
/// wait (`awaitCountiesDownloaded`), which re-lists up to five times, while
/// Download now re-lists up to ninety. Without this, each of those listings
/// could wait its own `LISTING_READ_BUDGET` (about 14 s for one check, about
/// 269 s for one Download now). Two listings' worth, the figure the per-listing
/// budget was sized on. Units: wall-clock time per window, process-wide.
const CHECK_READ_BUDGET: Duration = Duration::from_secs(4);

/// The window `CHECK_READ_BUDGET` is spent over: the frontend's 10 s check
/// budget (`CHECK_DEADLINE_MS` in icloudSync.ts), so one check's listings
/// share one allowance. The re-read comes 15 s after a check, in a new window.
const READ_WAIT_WINDOW: Duration = Duration::from_secs(10);

/// The process-wide limits on waiting for fetched records (I8): at most ONE
/// helper thread reading at a time (a listing that finds one still running
/// does not start another and reports its records unread, which the tri-state
/// already handles), and a total wait per `READ_WAIT_WINDOW`.
struct FetchGate {
    in_flight: Arc<AtomicBool>,
    /// The current window's start and what listings have waited in it.
    spent: Mutex<(Option<Instant>, Duration)>,
    per_listing: Duration,
    per_window: Duration,
    window: Duration,
}

impl FetchGate {
    fn new(per_listing: Duration, per_window: Duration, window: Duration) -> FetchGate {
        FetchGate { in_flight: Arc::new(AtomicBool::new(false)), spent: Mutex::new((None, Duration::ZERO)), per_listing, per_window, window }
    }
    /// What one listing may wait now: its own budget, capped by what is left
    /// of the window's (a new window starts when the last one has run out).
    fn allowance(&self) -> Duration {
        let mut g = match self.spent.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        let now = Instant::now();
        let current = matches!(g.0, Some(start) if now.duration_since(start) < self.window);
        if !current {
            *g = (Some(now), Duration::ZERO);
        }
        self.per_listing.min(self.per_window.saturating_sub(g.1))
    }
    fn charge(&self, waited: Duration) {
        let mut g = match self.spent.lock() {
            Ok(g) => g,
            Err(poisoned) => poisoned.into_inner(),
        };
        g.1 += waited;
    }
}

/// Clears the in-flight flag when the helper that set it is done, or when a
/// helper that could not be spawned is dropped with its closure.
struct InFlight(Arc<AtomicBool>);

impl Drop for InFlight {
    fn drop(&mut self) {
        self.0.store(false, Ordering::Release);
    }
}

fn fetch_gate() -> &'static FetchGate {
    static GATE: OnceLock<FetchGate> = OnceLock::new();
    GATE.get_or_init(|| FetchGate::new(LISTING_READ_BUDGET, CHECK_READ_BUDGET, READ_WAIT_WINDOW))
}

/// The container operations the listing and the writers perform through
/// Foundation, behind a trait so their rules are unit-tested without an iCloud
/// account (this Mac is not signed in, and a temporary directory is not a
/// container, so Foundation cannot remove a planted placeholder there).
/// `Foundation` is the only production value.
trait ContainerIo: Clone + Send + 'static {
    /// An item's ubiquity flags (`downloaded` means Foundation reports it
    /// `Current`: a local copy that is the newest version this device knows).
    fn flags(&self, path: &Path) -> UbiquityFlags;
    /// Ask iCloud to bring the item down (a placeholder) or up to date (an
    /// out-of-date local copy).
    fn start_download(&self, path: &Path);
    /// The two-file read: the raw text through a COORDINATED read, which
    /// downloads a missing or out-of-date record before handing it over.
    fn read(&self, dir: &Path, name: &str) -> Result<Option<String>, String>;
    /// The coordinated delete of the item at `dir/name`, through its LOGICAL
    /// URL, so a placeholder is deleted as the iCloud item it stands for.
    fn delete(&self, dir: &Path, name: &str) -> Result<bool, String>;
    /// Create one directory inside a coordinated write (an item iCloud must be
    /// told about, like any other change to the container).
    fn create_dir(&self, path: &Path) -> Result<(), String>;
}

#[derive(Clone, Copy)]
struct Foundation;

impl ContainerIo for Foundation {
    fn flags(&self, path: &Path) -> UbiquityFlags {
        ubiquity_flags(path)
    }
    fn start_download(&self, path: &Path) {
        let _ = NSFileManager::defaultManager().startDownloadingUbiquitousItemAtURL_error(&file_url(path));
    }
    fn read(&self, dir: &Path, name: &str) -> Result<Option<String>, String> {
        read_record_text(dir, name)
    }
    fn delete(&self, dir: &Path, name: &str) -> Result<bool, String> {
        coordinated_delete(dir, name)
    }
    fn create_dir(&self, path: &Path) -> Result<(), String> {
        coordinated_write(&file_url(path), NSFileCoordinatorWritingOptions::empty(), |p| match fs::create_dir(p) {
            Ok(()) => Ok(()),
            Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
            Err(_) => Err("unavailable".to_string()),
        })
    }
}

fn list_items_with<I: ContainerIo>(docs: &Path, kind: ItemKind, max: usize, io: &I, gate: &FetchGate) -> ListResult {
    let empty = ListResult { items: Vec::new(), truncated: false, pending: false };
    let sub = match real_subdir(docs, kind) {
        Some(s) => s,
        None => {
            // The kind's directory is in iCloud but not on this device yet: ask
            // for it and report the listing as not read. Reading it as empty
            // would make every local county "local only", and their pushes
            // would create a SECOND directory of the same name beside it.
            if is_regular_file(&placeholder_path(docs, kind.subdir())) {
                io.start_download(&docs.join(kind.subdir()));
                return ListResult { items: Vec::new(), truncated: false, pending: true };
            }
            return empty;
        }
    };
    let entries = match fs::read_dir(&sub) {
        Ok(e) => e,
        Err(_) => return empty,
    };
    let mut ids: BTreeSet<String> = BTreeSet::new();
    let mut truncated = false;
    for entry in entries.flatten() {
        let raw = entry.file_name();
        let name = match raw.to_str() {
            Some(n) => n,
            None => continue,
        };
        let id = match record_id_from_name(name, kind) {
            Some(id) => id,
            None => continue,
        };
        if ids.contains(&id) {
            continue;
        }
        if ids.len() >= max {
            truncated = true;
            continue;
        }
        ids.insert(id);
    }
    let mut items = Vec::with_capacity(ids.len());
    // Records present but not `Current`: every download is requested here, in
    // one pass, so they come down together; the reads follow below.
    let mut fetch: Vec<(usize, String, PathBuf)> = Vec::new();
    for id in ids {
        let item = match kind.item_from_id(&id) {
            Some(i) => i,
            None => continue,
        };
        let record_name = item.record_name();
        let record_path = sub.join(&record_name);
        let present = item_present(&sub, &record_name);
        let mut record = None;
        let mut record_up = false;
        if present {
            let flags = io.flags(&record_path);
            record_up = flags.uploaded;
            if flags.downloaded {
                record = io.read(&sub, &record_name).ok().flatten();
            } else {
                io.start_download(&record_path);
                fetch.push((items.len(), record_name, record_path));
            }
        }
        let file = item_file_status(&sub, &item, record_up);
        items.push(ListedItem { id, present, record, file });
    }
    read_fetched_records(&sub, &mut items, fetch, io, gate);
    ListResult { items, truncated, pending: false }
}

/// Read the records a listing had to fetch, through the coordinated read,
/// on ONE helper thread in id order. A coordinated read of a record that has
/// not come down waits for it and cannot be cancelled (offline it waits until
/// the download fails), so the listing stops waiting at its allowance and the
/// helper's later answers are dropped, as `with_timeout` does for a whole
/// command. The `FetchGate` bounds both halves (I8): no second helper while
/// one is still reading (at most one lingering thread, and a listing that
/// finds one waits for nothing), and the wait comes out of the window's
/// allowance, so the listings of one check share `CHECK_READ_BUDGET`. A record
/// left unread either way is `present: true, record: None`, the tri-state. A
/// text is used only when the record reports `Current` AFTER its read has
/// returned (Apple: never read the status inside the coordinated read), so a
/// device still never decides from a copy it knows is out of date.
fn read_fetched_records<I: ContainerIo>(
    sub: &Path,
    items: &mut [ListedItem],
    fetch: Vec<(usize, String, PathBuf)>,
    io: &I,
    gate: &FetchGate,
) {
    if fetch.is_empty() {
        return;
    }
    let allowance = gate.allowance();
    if allowance.is_zero() {
        return; // this window's waiting is spent: a later check reads them
    }
    if gate.in_flight.compare_exchange(false, true, Ordering::AcqRel, Ordering::Acquire).is_err() {
        return; // a helper is still reading: never a second one
    }
    let flag = InFlight(gate.in_flight.clone());
    let (tx, rx) = mpsc::channel::<(usize, Option<String>)>();
    let io = io.clone();
    let dir = sub.to_path_buf();
    // Builder, not thread::spawn: a thread the OS refuses is "not read", never
    // a panic (which `panic = "abort"` would make an abort). The closure owns
    // `flag`, so the flag clears when the helper ends or when a closure that
    // never ran is dropped.
    let spawned = std::thread::Builder::new().spawn(move || {
        let _flag = flag;
        for (i, name, path) in fetch {
            let text = io.read(&dir, &name).ok().flatten();
            let text = if io.flags(&path).downloaded { text } else { None };
            if tx.send((i, text)).is_err() {
                return;
            }
        }
    });
    if spawned.is_err() {
        return;
    }
    let mut take = |(i, text): (usize, Option<String>)| {
        if let Some(it) = items.get_mut(i) {
            it.record = text;
        }
    };
    let started = Instant::now();
    let deadline = started + allowance;
    loop {
        match rx.recv_timeout(deadline.saturating_duration_since(Instant::now())) {
            Ok(answer) => take(answer),
            Err(_) => break,
        }
    }
    gate.charge(started.elapsed().min(allowance));
    // An answer that landed on the deadline itself is still used.
    while let Ok(answer) = rx.try_recv() {
        take(answer);
    }
}

/// Push one item's local file and then its record (the record is the commit
/// point a peer reads). `unless_sha256` equal to the digest of the local
/// bytes writes nothing (the day-obs snapshot's "unchanged since my last
/// push" case). The local file is bounded by its on-disk length BEFORE it is
/// loaded and must be a regular file. The command calls `push_item_with`
/// (which adds the repair mode); this is its Foundation form for the tests.
#[cfg(test)]
fn push_item_at(
    docs: &Path,
    local: &Path,
    item: &SyncItem,
    filename: &str,
    uploaded_at: &str,
    origin: &Origin,
    unless_sha256: Option<&str>,
) -> Result<ItemPushResult, String> {
    push_item_with(&Foundation, docs, local, item, filename, uploaded_at, origin, unless_sha256, None)
}

/// `push_item_at` over any `ContainerIo`, plus the REPAIR mode (decisions.md
/// entry 19): with `repair_sha256` set, this device's own record is already in
/// iCloud and names that digest, but the county file under its name is
/// missing, is not the file the record describes, or is contested (a pre-fix
/// write left it beside a placeholder). The local bytes are written as the
/// county FILE ONLY, and only when their digest equals the record's; anything
/// else writes nothing and reports `skipped`. The record is never rewritten
/// here: the file can go missing because another device is clearing the
/// county (its coordinated delete of the file lands before its marker), and
/// rewriting this device's older record could then land over that marker and
/// bring the county back on the device that removed it. A file written beside
/// a marker is harmless, and the next push or Remove replaces it.
#[allow(clippy::too_many_arguments)]
fn push_item_with<I: ContainerIo>(
    io: &I,
    docs: &Path,
    local: &Path,
    item: &SyncItem,
    filename: &str,
    uploaded_at: &str,
    origin: &Origin,
    unless_sha256: Option<&str>,
    repair_sha256: Option<&str>,
) -> Result<ItemPushResult, String> {
    let max = item.max_bytes();
    let len = regular_file_len(local).map_err(|_| "local-missing".to_string())?;
    if len > max {
        return Err("too-large".to_string());
    }
    let bytes = fs::read(local).map_err(|_| "local-missing".to_string())?;
    if bytes.len() as u64 > max {
        return Err("too-large".to_string());
    }
    let sha256 = sha256_hex(&bytes);
    let byte_length = bytes.len() as u64;
    let skip = unless_sha256 == Some(sha256.as_str()) || repair_sha256.is_some_and(|r| r != sha256);
    if skip {
        let uploaded = match real_subdir(docs, item.kind()) {
            Some(sub) => item_file_status(&sub, item, record_uploaded(&sub, item)).uploaded,
            None => false,
        };
        return Ok(ItemPushResult { sha256, byte_length, uploaded, skipped: true, superseded: false });
    }
    fs::create_dir_all(docs).map_err(|_| "unavailable".to_string())?;
    let sub = ensure_subdir_with(io, docs, item.kind())?;
    // Only a county's names are cleared before a write; a day-obs snapshot is
    // this device's own name and keeps the shipped helper (follow-up 1).
    let write = |target: &str, bytes: &[u8]| match item {
        SyncItem::County(_) => county_container_write(io, docs, target, &origin.device_id, bytes),
        SyncItem::DayObs(_) => atomic_container_write(docs, target, &origin.device_id, bytes),
    };
    if let Some(expected) = repair_sha256 {
        if !record_still_names_this_copy(io, &sub, item, &origin.device_id, expected) {
            return Ok(ItemPushResult { sha256, byte_length, uploaded: false, skipped: false, superseded: true });
        }
    }
    write(&item.container_file(), &bytes)?;
    if repair_sha256.is_none() {
        let (slot, county) = item.record_fields();
        let record = RecordFile {
            version: 1,
            slot,
            county,
            state: "file",
            filename: Some(filename),
            uploaded_at: Some(uploaded_at),
            cleared_at: None,
            origin,
            byte_length: Some(byte_length),
            sha256: Some(&sha256),
        };
        let json = serde_json::to_vec(&record).map_err(|_| "unknown".to_string())?;
        write(&item.container_record(), &json)?;
    }
    let uploaded = item_file_status(&sub, item, record_uploaded(&sub, item)).uploaded;
    Ok(ItemPushResult { sha256, byte_length, uploaded, skipped: false, superseded: false })
}

/// The fields of a record the repair re-read compares, and nothing else.
#[derive(Deserialize)]
struct RecordHead {
    slot: String,
    county: Option<String>,
    state: String,
    sha256: Option<String>,
    origin: RecordHeadOrigin,
}

#[derive(Deserialize)]
struct RecordHeadOrigin {
    #[serde(rename = "deviceId")]
    device_id: String,
}

/// The repair's re-read (decisions.md entry 19, follow-up 2; security report
/// L4). Immediately before a repair deletes or writes anything, the county's
/// record in the container must still name THIS device's current copy: this
/// device's id, a `file` state for this county, and the digest the local bytes
/// have. A peer writes its file first and its record second, so a peer's newer
/// file can reach this device while the listing still reads this device's own
/// record, and the listing's file state alone cannot tell that from a pre-fix
/// orphan. The record is read the two-file way, through the coordinated read,
/// but only when Foundation reports it `Current` both before and after the
/// read: a record that is not current means a newer version is on its way,
/// which is reason enough to skip, and it keeps the wait bounded (a
/// coordinated read of a current record downloads nothing). Any other answer,
/// an unreadable or malformed record included, is "not this copy", and the
/// repair writes nothing. Stated residual: a peer's file that reaches this
/// device before iCloud has told it anything about the peer's record is still
/// indistinguishable here.
fn record_still_names_this_copy<I: ContainerIo>(io: &I, sub: &Path, item: &SyncItem, device_id: &str, sha256: &str) -> bool {
    let county = match item {
        SyncItem::County(c) => c.as_str(),
        SyncItem::DayObs(_) => return false,
    };
    let name = item.record_name();
    let path = sub.join(&name);
    if !is_regular_file(&path) || !io.flags(&path).downloaded {
        return false;
    }
    let text = match io.read(sub, &name) {
        Ok(Some(t)) => t,
        _ => return false,
    };
    if !io.flags(&path).downloaded {
        return false;
    }
    match serde_json::from_str::<RecordHead>(&text) {
        Ok(r) => {
            r.slot == "barchart"
                && r.county.as_deref() == Some(county)
                && r.state == "file"
                && r.sha256.as_deref() == Some(sha256)
                && r.origin.device_id == device_id
        }
        Err(_) => false,
    }
}

/// Delete every representation of the item at `dir/name` (a regular file, a
/// placeholder, or both at once), through the coordinated delete, so the name
/// is free. Bounded by `CLEAR_WAY_ATTEMPTS`.
fn free_name<I: ContainerIo>(io: &I, dir: &Path, name: &str) -> Result<(), String> {
    for _ in 0..CLEAR_WAY_ATTEMPTS {
        if !item_present(dir, name) {
            return Ok(());
        }
        io.delete(dir, name)?;
    }
    if item_present(dir, name) {
        Err("unavailable".to_string())
    } else {
        Ok(())
    }
}

/// Write the cleared marker for each county: the county file's coordinated
/// delete (absent ignored), then the cleared record written atomically. A
/// string that fails `County::parse` is reported failed and nothing happens
/// for it; a per-county failure is collected, never raised.
fn push_items_cleared_at(docs: &Path, counties: Vec<String>, cleared_at: &str, origin: &Origin) -> Result<ClearedResult, String> {
    push_items_cleared_with(&Foundation, docs, counties, cleared_at, origin)
}

fn push_items_cleared_with<I: ContainerIo>(
    io: &I,
    docs: &Path,
    counties: Vec<String>,
    cleared_at: &str,
    origin: &Origin,
) -> Result<ClearedResult, String> {
    let mut failed = Vec::new();
    let mut valid = Vec::new();
    for raw in counties {
        match County::parse(&raw) {
            Ok(c) => valid.push(c),
            Err(()) => failed.push(raw),
        }
    }
    if valid.is_empty() {
        return Ok(ClearedResult { failed });
    }
    fs::create_dir_all(docs).map_err(|_| "unavailable".to_string())?;
    let sub = ensure_subdir_with(io, docs, ItemKind::Barchart)?;
    for county in valid {
        let item = SyncItem::County(county);
        let one = || -> Result<(), String> {
            free_name(io, &sub, &item.file_name())?;
            let (slot, c) = item.record_fields();
            let record = RecordFile {
                version: 1,
                slot,
                county: c,
                state: "cleared",
                filename: None,
                uploaded_at: None,
                cleared_at: Some(cleared_at),
                origin,
                byte_length: None,
                sha256: None,
            };
            let json = serde_json::to_vec(&record).map_err(|_| "unknown".to_string())?;
            county_container_write(io, docs, &item.container_record(), &origin.device_id, &json)
        };
        if one().is_err() {
            if let SyncItem::County(c) = &item {
                failed.push(c.as_str().to_string());
            }
        }
    }
    Ok(ClearedResult { failed })
}

/// Pull one item: the length and digest the frontend validated from the
/// record are verified on the bytes actually read (the on-disk length checked
/// BEFORE the read, against the item's bound and the claim), then `File`
/// writes them over the local file through a temp-then-rename and `Text`
/// returns them as UTF-8 (non-UTF-8 is `mismatch`). `Text` is accepted only
/// for a day-obs snapshot and `File` only for a county file.
fn pull_item_at(
    docs: &Path,
    local: &Path,
    item: &SyncItem,
    expected_sha256: &str,
    expected_byte_length: u64,
    mode: PullMode,
) -> Result<PullItemResult, String> {
    match (item, mode) {
        (SyncItem::County(_), PullMode::File) | (SyncItem::DayObs(_), PullMode::Text) => {}
        _ => return Err("unknown".to_string()),
    }
    let max = item.max_bytes();
    if expected_byte_length > max {
        return Err("too-large".to_string());
    }
    let sub = real_subdir(docs, item.kind()).ok_or_else(|| "absent".to_string())?;
    let name = item.file_name();
    if !item_present(&sub, &name) {
        return Err("absent".to_string());
    }
    let path = sub.join(&name);
    if !ubiquity_flags(&path).downloaded {
        return Err("not-downloaded".to_string());
    }
    let bytes = coordinated_read(&file_url(&path), |p| {
        let len = regular_file_len(p)?;
        if len > max {
            return Err("too-large".to_string());
        }
        if len != expected_byte_length {
            return Err("mismatch".to_string());
        }
        fs::read(p).map_err(|_| "unavailable".to_string())
    })?;
    if bytes.len() as u64 != expected_byte_length || sha256_hex(&bytes) != expected_sha256 {
        return Err("mismatch".to_string());
    }
    match mode {
        PullMode::Text => {
            let text = String::from_utf8(bytes).map_err(|_| "mismatch".to_string())?;
            Ok(PullItemResult { text: Some(text) })
        }
        PullMode::File => {
            if let Some(parent) = local.parent() {
                fs::create_dir_all(parent).map_err(|_| "unavailable".to_string())?;
            }
            let file_name = local.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
            let tmp = local.with_file_name(format!("{}.tmp", file_name));
            fs::write(&tmp, &bytes).map_err(|_| "unavailable".to_string())?;
            fs::rename(&tmp, local).map_err(|_| {
                let _ = fs::remove_file(&tmp);
                "unavailable".to_string()
            })?;
            Ok(PullItemResult { text: None })
        }
    }
}

/// Remove one item: its record first (so a peer never reads a record whose
/// file is already gone), then its file, then its staging entries from any
/// device. Absent items are not an error.
fn remove_item_at(docs: &Path, item: &SyncItem) -> Result<u32, String> {
    let mut removed = 0u32;
    if let Some(sub) = real_subdir(docs, item.kind()) {
        if coordinated_delete(&sub, &item.record_name())? {
            removed += 1;
        }
        if coordinated_delete(&sub, &item.file_name())? {
            removed += 1;
        }
    }
    let tmp = docs.join(".tmp");
    removed += clear_staging_for(&tmp, &staging_name(&item.container_file()));
    removed += clear_staging_for(&tmp, &staging_name(&item.container_record()));
    Ok(removed)
}

/// Staging entries of one kind, from any device: `<32 hex>-<subdir>-...`.
/// Regular files and symlinks are removed as such; nothing is followed.
fn clear_staging_kind(tmp_dir: &Path, kind: ItemKind) -> u32 {
    let mut removed = 0u32;
    let entries = match fs::read_dir(tmp_dir) {
        Ok(e) => e,
        Err(_) => return 0,
    };
    let marker = format!("{}-", kind.subdir());
    for entry in entries.flatten() {
        let raw = entry.file_name();
        let name = match raw.to_str() {
            Some(n) => n,
            None => continue,
        };
        let b = name.as_bytes();
        if b.len() <= 33 || b[32] != b'-' || !name.is_char_boundary(32) || !valid_device_id(&name[..32]) {
            continue;
        }
        if !name[33..].starts_with(&marker) {
            continue;
        }
        let path = entry.path();
        let is_dir = fs::symlink_metadata(&path).map(|m| m.file_type().is_dir()).unwrap_or(false);
        let ok = if is_dir { fs::remove_dir_all(&path).is_ok() } else { fs::remove_file(&path).is_ok() };
        if ok {
            removed += 1;
        }
    }
    removed
}

/// The remainder of `s` after `" <1 to 4 ASCII digits>"`, or None: the copy
/// number iCloud inserts when it sets a same-named item aside.
fn after_copy_number(s: &str) -> Option<&str> {
    let b = s.as_bytes();
    if b.first() != Some(&b' ') {
        return None;
    }
    let digits = b[1..].iter().take_while(|c| c.is_ascii_digit()).count();
    if digits == 0 || digits > 4 {
        return None;
    }
    Some(&s[1 + digits..])
}

/// The LOGICAL name of an iCloud conflict twin of one of this kind's items
/// (decisions.md entry 19): the name iCloud gives an item it set aside because
/// another item already held the name, a copy number inserted before the
/// extension (`US-CA-001 2.txt`, `US-CA-001 2.record.json`,
/// `US-CA-001.record 2.json`), or that name's placeholder. The id must pass the
/// kind's predicate and the rest is one of those three fixed shapes, so the
/// name is a single path component this app's own writes produced; anything
/// else is None and is left alone.
fn twin_name(name: &str, kind: ItemKind) -> Option<String> {
    let base = match name.strip_prefix('.').and_then(|r| r.strip_suffix(".icloud")) {
        Some(inner) => inner,
        None => name,
    };
    let id_len = match kind {
        ItemKind::Barchart => 9,
        ItemKind::DayObs => 32,
    };
    if base.len() <= id_len || !base.is_char_boundary(id_len) {
        return None;
    }
    let (id, rest) = base.split_at(id_len);
    kind.item_from_id(id)?;
    let file_ext = match kind {
        ItemKind::Barchart => ".txt",
        ItemKind::DayObs => ".json",
    };
    let ok = match after_copy_number(rest) {
        Some(after) => after == file_ext || after == ".record.json",
        None => rest.strip_prefix(".record").and_then(after_copy_number) == Some(".json"),
    };
    if ok {
        Some(base.to_string())
    } else {
        None
    }
}

/// A duplicate of the kind's own directory: `barcharts 2` (iCloud's name for a
/// second, same-named directory it kept apart from the first).
fn is_duplicate_subdir(name: &str, kind: ItemKind) -> bool {
    name.strip_prefix(kind.subdir()).and_then(after_copy_number) == Some("")
}

/// A coordinated delete of a whole directory through its logical URL (a
/// duplicate kind directory). A link or a file at the name is removed as such.
fn coordinated_delete_dir(docs: &Path, name: &str) -> Result<bool, String> {
    let target = docs.join(name);
    match fs::symlink_metadata(&target) {
        Err(_) => return Ok(false),
        Ok(meta) if !meta.file_type().is_dir() => {
            fs::remove_file(&target).map_err(|_| "unavailable".to_string())?;
            return Ok(true);
        }
        Ok(_) => {}
    }
    coordinated_write(&file_url(&target), NSFileCoordinatorWritingOptions::ForDeleting, |p| {
        NSFileManager::defaultManager().removeItemAtURL_error(&file_url(p)).map_err(|_| "unavailable".to_string())?;
        Ok(true)
    })
}

/// Every valid-named item of a kind (records, companion files, and their
/// placeholders), every iCloud conflict twin of one (`twin_name`), and every
/// duplicate of the kind's directory with all it holds, plus that kind's
/// staging entries from any device. Other unknown names are left alone,
/// stated: a name this app would never write is not a copy it made. A link or
/// file planted at the subdirectory's own name is removed as such, never
/// followed.
fn remove_items_in(docs: &Path, kind: ItemKind) -> Result<u32, String> {
    remove_items_in_with(&Foundation, docs, kind)
}

/// Delete a directory this device holds only as iCloud's placeholder
/// (`.barcharts.icloud`, `.barcharts 2.icloud`) through the coordinated delete
/// on its logical URL (decisions.md entry 19, follow-up 3; security report
/// L5): the directory and everything in it leave iCloud, as the privacy
/// policy's Remove promises. If the placeholder is still there afterwards the
/// removal is `unavailable` (the closed union's fixed reason), never a success
/// that left the copies in iCloud. Bounded: one delete.
fn remove_placeholder_dir<I: ContainerIo>(io: &I, docs: &Path, logical: &str) -> Result<u32, String> {
    if !is_regular_file(&placeholder_path(docs, logical)) {
        return Ok(0);
    }
    let _ = io.delete(docs, logical)?;
    if is_regular_file(&placeholder_path(docs, logical)) {
        return Err("unavailable".to_string());
    }
    Ok(1)
}

fn remove_items_in_with<I: ContainerIo>(io: &I, docs: &Path, kind: ItemKind) -> Result<u32, String> {
    let mut removed = 0u32;
    let sub = docs.join(kind.subdir());
    match fs::symlink_metadata(&sub) {
        // Not here as a directory: iCloud may still hold it (only its
        // placeholder is on this device), and Remove must take it too.
        Err(_) => removed += remove_placeholder_dir(io, docs, kind.subdir())?,
        Ok(meta) if !meta.file_type().is_dir() => {
            fs::remove_file(&sub).map_err(|_| "unavailable".to_string())?;
            removed += 1;
        }
        Ok(_) => {
            let mut ids: BTreeSet<String> = BTreeSet::new();
            let mut twins: BTreeSet<String> = BTreeSet::new();
            if let Ok(entries) = fs::read_dir(&sub) {
                for entry in entries.flatten() {
                    let raw = entry.file_name();
                    if let Some(name) = raw.to_str() {
                        if let Some(id) = item_id_from_any_name(name, kind) {
                            ids.insert(id);
                        } else if let Some(twin) = twin_name(name, kind) {
                            twins.insert(twin);
                        }
                    }
                }
            }
            for id in ids {
                if let Some(item) = kind.item_from_id(&id) {
                    if coordinated_delete(&sub, &item.record_name())? {
                        removed += 1;
                    }
                    if coordinated_delete(&sub, &item.file_name())? {
                        removed += 1;
                    }
                }
            }
            for twin in twins {
                if coordinated_delete(&sub, &twin)? {
                    removed += 1;
                }
            }
        }
    }
    let mut duplicates: Vec<String> = Vec::new();
    let mut duplicate_placeholders: Vec<String> = Vec::new();
    if let Ok(entries) = fs::read_dir(docs) {
        for entry in entries.flatten() {
            if let Some(name) = entry.file_name().to_str() {
                if is_duplicate_subdir(name, kind) {
                    duplicates.push(name.to_string());
                } else if let Some(logical) = name.strip_prefix('.').and_then(|r| r.strip_suffix(".icloud")) {
                    if is_duplicate_subdir(logical, kind) {
                        duplicate_placeholders.push(logical.to_string());
                    }
                }
            }
        }
    }
    for name in duplicates {
        if coordinated_delete_dir(docs, &name)? {
            removed += 1;
        }
    }
    for logical in duplicate_placeholders {
        removed += remove_placeholder_dir(io, docs, &logical)?;
    }
    removed += clear_staging_kind(&docs.join(".tmp"), kind);
    Ok(removed)
}

#[tauri::command]
pub async fn icloud_list_items(kind: ItemKind) -> Result<ListResult, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        Ok(list_items_bounded(&docs, kind, MAX_LISTED_ITEMS))
    })
    .await
}

#[tauri::command]
pub async fn icloud_push_item(
    app: AppHandle,
    item: ItemArg,
    filename: String,
    uploaded_at: String,
    origin: Origin,
    unless_sha256: Option<String>,
    repair_sha256: Option<String>,
) -> Result<ItemPushResult, String> {
    let item = SyncItem::try_from(item)?;
    let origin = item_origin(origin)?;
    // A day-obs record binds itself to its name by its origin: this device
    // may write only its own snapshot.
    if let SyncItem::DayObs(d) = &item {
        if d.as_str() != origin.device_id {
            return Err("unknown".to_string());
        }
    }
    // The repair mode is for a county file only, and its digest is a digest
    // (64 lowercase hex), checked before anything is read or written.
    if let Some(r) = &repair_sha256 {
        if !matches!(item, SyncItem::County(_)) || !valid_sha256(r) {
            return Err("unknown".to_string());
        }
    }
    let local = item.local_path(&local_data_dir(&app)?);
    let filename = sanitize_filename(&filename);
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        push_item_with(&Foundation, &docs, &local, &item, &filename, &uploaded_at, &origin, unless_sha256.as_deref(), repair_sha256.as_deref())
    })
    .await
}

/// A SHA-256 digest as the records carry it: exactly 64 lowercase hex bytes.
fn valid_sha256(s: &str) -> bool {
    s.len() == 64 && s.bytes().all(|b| b.is_ascii_digit() || (b'a'..=b'f').contains(&b))
}

#[tauri::command]
pub async fn icloud_push_items_cleared(counties: Vec<String>, cleared_at: String, origin: Origin) -> Result<ClearedResult, String> {
    let origin = item_origin(origin)?;
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        push_items_cleared_at(&docs, counties, &cleared_at, &origin)
    })
    .await
}

#[tauri::command]
pub async fn icloud_pull_item(
    app: AppHandle,
    item: ItemArg,
    expected_sha256: String,
    expected_byte_length: u64,
    mode: PullMode,
) -> Result<PullItemResult, String> {
    let item = SyncItem::try_from(item)?;
    let local = item.local_path(&local_data_dir(&app)?);
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        pull_item_at(&docs, &local, &item, &expected_sha256, expected_byte_length, mode)
    })
    .await
}

#[tauri::command]
pub async fn icloud_start_download_item(item: ItemArg) -> Result<(), String> {
    let item = SyncItem::try_from(item)?;
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let sub = real_subdir(&docs, item.kind()).ok_or_else(|| "absent".to_string())?;
        let name = item.file_name();
        if !item_present(&sub, &name) {
            return Err("absent".to_string());
        }
        NSFileManager::defaultManager()
            .startDownloadingUbiquitousItemAtURL_error(&file_url(&sub.join(&name)))
            .map_err(|_| "unavailable".to_string())
    })
    .await
}

#[tauri::command]
pub async fn icloud_remove_item(item: ItemArg) -> Result<RemoveResult, String> {
    let item = SyncItem::try_from(item)?;
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        Ok(RemoveResult { removed: remove_item_at(&docs, &item)? })
    })
    .await
}

#[tauri::command]
pub async fn icloud_remove_items(kind: ItemKind) -> Result<RemoveResult, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        Ok(RemoveResult { removed: remove_items_in(&docs, kind)? })
    })
    .await
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn labels_lose_controls_and_stay_within_64_units() {
        assert_eq!(sanitize_label("Dave\u{7}s Mac", "Mac"), "Daves Mac");
        assert_eq!(sanitize_label("Dave\nMac\u{85}", "Mac"), "DaveMac");
        assert_eq!(sanitize_label("\u{1}\u{2}", "iPhone"), "iPhone");
        assert_eq!(sanitize_label("   ", "iPad"), "iPad");
        let long = "x".repeat(100);
        let out = sanitize_label(&long, "Mac");
        assert_eq!(out.encode_utf16().count(), 64);
        // A surrogate pair is never split: 63 BMP chars + one astral char (2 units)
        // would make 65, so the astral char is dropped rather than halved.
        let edge = format!("{}\u{1F426}", "y".repeat(63));
        let out = sanitize_label(&edge, "Mac");
        assert_eq!(out.encode_utf16().count(), 63);
        assert!(!out.contains('\u{FFFD}'));
    }

    #[test]
    fn filenames_lose_controls_and_separators_and_stay_within_255_units() {
        assert_eq!(sanitize_filename("../x.csv"), "..x.csv");
        assert_eq!(sanitize_filename("..\\x.csv"), "..x.csv");
        assert_eq!(sanitize_filename("a\u{0}.csv"), "a.csv");
        assert_eq!(sanitize_filename("\u{7f}"), "export.csv");
        let long = format!("{}.csv", "n".repeat(300));
        assert_eq!(sanitize_filename(&long).encode_utf16().count(), 255);
    }

    #[test]
    fn device_ids_are_32_lowercase_hex() {
        assert!(valid_device_id(&"a".repeat(32)));
        assert!(valid_device_id("0123456789abcdef0123456789abcdef"));
        assert!(!valid_device_id(&"A".repeat(32)));
        assert!(!valid_device_id(&"a".repeat(31)));
        assert!(!valid_device_id("../../../../../../../../../../etc/x"));
        assert!(!valid_device_id(&format!("{}/", "a".repeat(31))));
    }

    #[test]
    fn regular_file_len_refuses_symlinks_and_directories() {
        let dir = std::env::temp_dir().join(format!("sr-icloud-test-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let file = dir.join("f.csv");
        fs::write(&file, b"abc").unwrap();
        assert_eq!(regular_file_len(&file).unwrap(), 3);
        assert!(regular_file_len(&dir).is_err());
        let link = dir.join("link.csv");
        std::os::unix::fs::symlink(&file, &link).unwrap();
        assert!(regular_file_len(&link).is_err());
        assert!(!is_regular_file(&link));
        assert!(is_regular_file(&file));
        // A symlink at an item's name is deleted as a LINK, never followed.
        let removed = clear_staging(&dir, None);
        assert!(removed >= 2);
        assert!(!link.exists() && !file.exists());
        let _ = fs::remove_dir_all(&dir);
    }

    // ── icloud-api-key-sync ──

    /// 2026-09-01T16:00:00.000Z as V8's Date.parse reads it (the clock every
    /// key chokepoint test runs against; NOW in the frontend parity test).
    const NOW_MS: i64 = 1_788_278_400_000;

    fn sanitize(input: KeyEntryInput) -> Result<KeyEntryFile, String> {
        sanitize_key_entry(input, NOW_MS)
    }

    /// Pinned byte-equal to `KEY_RECORD_GOLDEN` in keyRecord.ts by the parity test.
    const KEY_RECORD_GOLDEN: &str = r#"{"version":1,"kind":"keys","slots":{"ebird":{"state":"key","value":"FixtureKey0001abcd","changedAt":"2026-08-31T01:48:00.000Z","origin":{"deviceId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","label":"Dave's MacBook Pro","platform":"mac"}},"openweather":{"state":"cleared","clearedAt":"2026-09-01T15:40:00.000Z","origin":{"deviceId":"ffffffffffffffffffffffffffffffff","label":"iPhone","platform":"iphone"}}}}"#;

    fn key_input(state: &str, value: Option<&str>, time: &str, label: &str, platform: &str, id: &str) -> KeyEntryInput {
        KeyEntryInput {
            state: state.to_string(),
            value: value.map(|v| v.to_string()),
            changed_at: if state == "key" { Some(time.to_string()) } else { None },
            cleared_at: if state == "cleared" { Some(time.to_string()) } else { None },
            origin: Origin { device_id: id.to_string(), label: label.to_string(), platform: platform.to_string() },
        }
    }

    #[test]
    fn key_values_are_1_to_128_printable_ascii() {
        assert!(valid_key_value("FixtureKey0001abcd"));
        assert!(valid_key_value(&"0123456789abcdef".repeat(2))); // a 32-hex shape
        assert!(valid_key_value(&"x".repeat(128)));
        assert!(!valid_key_value(""));
        assert!(!valid_key_value(&"x".repeat(129)));
        assert!(!valid_key_value("has space"));
        assert!(!valid_key_value("tab\there"));
        assert!(!valid_key_value("ctrl\u{1}"));
        assert!(!valid_key_value("del\u{7f}"));
        assert!(!valid_key_value("non-ascii-\u{e9}"));
    }

    #[test]
    fn key_entries_are_refused_never_rewritten_except_the_label() {
        let me = "a".repeat(32);
        // A good key entry passes, with its label cleaned.
        let ok = sanitize(key_input("key", Some("FixtureKey0001abcd"), "2026-08-31T01:48:00.000Z", "Dave\u{7}s Mac", "mac", &me)).unwrap();
        assert_eq!(ok.origin.label, "Daves Mac");
        assert_eq!(ok.value.as_deref(), Some("FixtureKey0001abcd"));
        // Each bad shape is refused with the closed-union code, never rewritten.
        for bad in ["", "has space", "non-ascii-\u{e9}", "ctrl\u{1}"] {
            assert_eq!(sanitize(key_input("key", Some(bad), "2026-08-31T01:48:00.000Z", "Mac", "mac", &me)).err().as_deref(), Some("unknown"));
        }
        let long = "x".repeat(129);
        assert!(sanitize(key_input("key", Some(&long), "2026-08-31T01:48:00.000Z", "Mac", "mac", &me)).is_err());
        assert!(sanitize(key_input("key", None, "2026-08-31T01:48:00.000Z", "Mac", "mac", &me)).is_err());
        assert!(sanitize(key_input("key", Some("ok"), "", "Mac", "mac", &me)).is_err());
        assert!(sanitize(key_input("key", Some("ok"), &"9".repeat(65), "Mac", "mac", &me)).is_err());
        assert!(sanitize(key_input("key", Some("ok"), "2026-08-31T01:48:00.000Z", "Mac", "windows", &me)).is_err());
        assert!(sanitize(key_input("key", Some("ok"), "2026-08-31T01:48:00.000Z", "Mac", "mac", "../../etc")).is_err());
        assert!(sanitize(key_input("file", Some("ok"), "2026-08-31T01:48:00.000Z", "Mac", "mac", &me)).is_err());
        // A cleared marker needs its time and no value.
        let cleared = sanitize(key_input("cleared", None, "2026-09-01T15:40:00.000Z", "iPhone", "iphone", &"f".repeat(32))).unwrap();
        assert!(cleared.value.is_none());
        assert_eq!(cleared.cleared_at.as_deref(), Some("2026-09-01T15:40:00.000Z"));
        assert!(sanitize(key_input("cleared", None, "", "iPhone", "iphone", &"f".repeat(32))).is_err());
    }

    #[test]
    fn sanitizing_a_sanitized_key_entry_is_idempotent() {
        let me = "a".repeat(32);
        let once = sanitize(key_input("key", Some("FixtureKey0001abcd"), "2026-08-31T01:48:00.000Z", "  Dave\u{7}s Mac  ", "mac", &me)).unwrap();
        let again = sanitize(KeyEntryInput {
            state: once.state.to_string(),
            value: once.value.clone(),
            changed_at: once.changed_at.clone(),
            cleared_at: once.cleared_at.clone(),
            origin: once.origin.clone(),
        })
        .unwrap();
        assert_eq!(serde_json::to_string(&once).unwrap(), serde_json::to_string(&again).unwrap());
    }

    #[test]
    fn key_record_golden_matches_the_frontend_literal() {
        let record = KeyRecordFile {
            version: 1,
            kind: "keys",
            slots: KeySlotsFile {
                ebird: Some(sanitize(key_input("key", Some("FixtureKey0001abcd"), "2026-08-31T01:48:00.000Z", "Dave's MacBook Pro", "mac", &"a".repeat(32))).unwrap()),
                openweather: Some(sanitize(key_input("cleared", None, "2026-09-01T15:40:00.000Z", "iPhone", "iphone", &"f".repeat(32))).unwrap()),
            },
        };
        assert_eq!(serde_json::to_string(&record).unwrap(), KEY_RECORD_GOLDEN);
        // An absent slot is omitted, never null.
        let one = KeyRecordFile { version: 1, kind: "keys", slots: KeySlotsFile { ebird: None, openweather: None } };
        assert_eq!(serde_json::to_string(&one).unwrap(), r#"{"version":1,"kind":"keys","slots":{}}"#);
    }

    #[test]
    fn key_staging_clear_removes_only_key_staging_entries_from_any_device() {
        let dir = std::env::temp_dir().join(format!("sr-icloud-keystaging-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let me = "a".repeat(32);
        let peer = "f".repeat(32);
        fs::write(dir.join(format!("{}-{}", me, KEYS_RECORD_NAME)), b"x").unwrap();
        fs::write(dir.join(format!("{}-{}", peer, KEYS_RECORD_NAME)), b"y").unwrap();
        fs::write(dir.join(format!("{}-ebird-backup.csv", me)), b"csv").unwrap();
        fs::write(dir.join(format!("{}-ebird.record.json", me)), b"rec").unwrap();
        assert_eq!(clear_staging_for(&dir, KEYS_RECORD_NAME), 2);
        assert!(dir.join(format!("{}-ebird-backup.csv", me)).exists());
        assert!(dir.join(format!("{}-ebird.record.json", me)).exists());
        assert!(!dir.join(format!("{}-{}", peer, KEYS_RECORD_NAME)).exists());
        assert_eq!(clear_staging_for(&dir, KEYS_RECORD_NAME), 0);
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn staging_clear_is_scoped_by_device_id() {
        let dir = std::env::temp_dir().join(format!("sr-icloud-staging-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let me = "a".repeat(32);
        let peer = "f".repeat(32);
        fs::write(dir.join(format!("{}-ebird-backup.csv", me)), b"x").unwrap();
        fs::write(dir.join(format!("{}-ebird-backup.csv", peer)), b"y").unwrap();
        assert_eq!(clear_staging(&dir, Some(&me)), 1);
        assert!(dir.join(format!("{}-ebird-backup.csv", peer)).exists());
        assert_eq!(clear_staging(&dir, None), 1);
        let _ = fs::remove_dir_all(&dir);
    }

    // ── Security fix round (security-report.md Findings 1 to 3) ──

    #[test]
    fn writable_times_agree_with_the_frontend_fixture() {
        // The SAME rows, in the same order, that icloudPaths.parity.test.ts
        // runs through isWritableTime; that test asserts every row is spelled
        // here and counts them, so the two tables cannot drift apart.
        let rows: [(&str, bool); 19] = [
            ("2026-09-01T16:00:00.000Z", true),
            ("2000-01-01T00:00:00.000Z", true),
            ("2024-02-29T12:34:56.789Z", true),
            ("2026-09-02T16:00:00.000Z", true),
            ("2026-09-02T16:00:00.001Z", false),
            ("1999-12-31T23:59:59.999Z", false),
            ("2026-09-01T16:00:00Z", false),
            ("2026-09-01T16:00:00.000+00:00", false),
            ("2026-09-01T16:00:00.000z", false),
            ("2026-09-01T16:00:00.0000Z", false),
            ("2026-09-01T16:00:00.000Z\n", false),
            (" 2026-09-01T16:00:00.000Z", false),
            ("2026-02-30T00:00:00.000Z", false),
            ("2100-02-29T00:00:00.000Z", false),
            ("2026-09-01T24:00:00.000Z", false),
            ("2026-13-01T00:00:00.000Z", false),
            ("2026-09-01T16:00:60.000Z", false),
            ("Sep 1, 2026 (é)", false),
            ("", false),
        ];
        for (t, ok) in rows {
            assert_eq!(valid_time_text(t, NOW_MS), ok, "{:?}", t);
        }
        // The parser lands on the epoch values V8's Date.parse reads (numbers
        // pinned from Node, never derived from this parser).
        assert_eq!(parse_iso_time_ms("2026-09-01T16:00:00.000Z"), Some(NOW_MS));
        assert_eq!(parse_iso_time_ms("2000-01-01T00:00:00.000Z"), Some(MIN_TIME_MS));
        assert_eq!(parse_iso_time_ms("1970-01-01T00:00:00.000Z"), Some(0));
        assert_eq!(parse_iso_time_ms("2024-02-29T12:34:56.789Z"), Some(1_709_210_096_789));
        assert_eq!(parse_iso_time_ms("2026-09-02T16:00:00.000Z"), Some(NOW_MS + MAX_FUTURE_MS));
        assert_eq!(parse_iso_time_ms("1999-12-31T23:59:59.999Z"), Some(MIN_TIME_MS - 1));
    }

    #[test]
    fn a_key_entry_with_an_implausible_time_is_refused_never_rewritten() {
        let me = "a".repeat(32);
        let peer = "f".repeat(32);
        // Exactly one day ahead passes; a millisecond past it, 25 hours ahead,
        // before 2000, and a parseable-but-not-canonical time (which the
        // frontend READER accepts) are each refused with the closed code.
        assert!(sanitize(key_input("key", Some("ok"), "2026-09-02T16:00:00.000Z", "Mac", "mac", &me)).is_ok());
        assert!(sanitize(key_input("cleared", None, "2026-09-02T16:00:00.000Z", "iPhone", "iphone", &peer)).is_ok());
        for bad in ["2026-09-02T16:00:00.001Z", "2026-09-02T17:00:00.000Z", "1999-12-31T23:59:59.999Z", "Sep 1, 2026 (é)", "2026-09-01T16:00:00Z"] {
            assert_eq!(sanitize(key_input("key", Some("ok"), bad, "Mac", "mac", &me)).err().as_deref(), Some("unknown"), "{:?}", bad);
            assert_eq!(sanitize(key_input("cleared", None, bad, "iPhone", "iphone", &peer)).err().as_deref(), Some("unknown"), "{:?}", bad);
        }
        // The window follows the clock handed in: the 25-hours-ahead entry passes a clock a day later.
        assert!(sanitize_key_entry(key_input("key", Some("ok"), "2026-09-02T17:00:00.000Z", "Mac", "mac", &me), NOW_MS + MAX_FUTURE_MS).is_ok());
    }

    #[test]
    fn a_directory_or_symlink_at_a_fixed_record_name_reads_as_empty_and_is_removed() {
        let dir = std::env::temp_dir().join(format!("sr-icloud-planted-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let planted = dir.join(KEYS_RECORD_NAME);
        fs::create_dir_all(&planted).unwrap();
        fs::write(planted.join("inner.txt"), b"x").unwrap();
        // Reads as the EMPTY text (the validator rejects it as malformed-json
        // and treats the record as absent), never as `unavailable`.
        assert_eq!(record_text_at(&planted).unwrap().as_deref(), Some(""));
        // A symlink at a record's name likewise, and it is never followed.
        let real = dir.join("real.json");
        fs::write(&real, b"{}").unwrap();
        let link = dir.join(Slot::Ebird.record_name());
        std::os::unix::fs::symlink(&real, &link).unwrap();
        assert_eq!(record_text_at(&link).unwrap().as_deref(), Some(""));
        // Remove is always a recovery path: the directory goes, the symlink
        // goes as a link, and the file it pointed at stays.
        assert_eq!(remove_planted_item(&planted).unwrap(), Some(true));
        assert!(fs::symlink_metadata(&planted).is_err());
        assert_eq!(remove_planted_item(&link).unwrap(), Some(true));
        assert!(fs::symlink_metadata(&link).is_err());
        assert!(real.exists());
        // Nothing planted (a regular file, or nothing at all): None, so the
        // coordinated delete proceeds, and the regular file is untouched here.
        assert_eq!(remove_planted_item(&real).unwrap(), None);
        assert_eq!(remove_planted_item(&dir.join("absent")).unwrap(), None);
        assert!(real.exists());
        // And a replacing write heals a directory at the target by overwrite.
        fs::create_dir_all(&planted).unwrap();
        fs::write(planted.join("inner.txt"), b"x").unwrap();
        let tmp = dir.join("staged");
        fs::write(&tmp, KEY_RECORD_GOLDEN.as_bytes()).unwrap();
        replace_item(&tmp, &planted).unwrap();
        assert_eq!(record_text_at(&planted).unwrap().as_deref(), Some(KEY_RECORD_GOLDEN));
        assert!(!tmp.exists());
        let _ = fs::remove_dir_all(&dir);
    }

    #[test]
    fn non_utf8_record_bytes_read_as_empty_text() {
        let dir = std::env::temp_dir().join(format!("sr-icloud-utf8-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let p = dir.join(KEYS_RECORD_NAME);
        fs::write(&p, [0xff, 0xfe, b'{', b'}']).unwrap();
        assert_eq!(record_text_at(&p).unwrap().as_deref(), Some(""));
        // A real record reads as its text; one past the size bound is not
        // loaded; one that vanished is None.
        fs::write(&p, KEY_RECORD_GOLDEN.as_bytes()).unwrap();
        assert_eq!(record_text_at(&p).unwrap().as_deref(), Some(KEY_RECORD_GOLDEN));
        fs::write(&p, vec![b' '; (MAX_RECORD_BYTES + 1) as usize]).unwrap();
        assert_eq!(record_text_at(&p).unwrap().as_deref(), Some(""));
        fs::remove_file(&p).unwrap();
        assert!(record_text_at(&p).unwrap().is_none());
        let _ = fs::remove_dir_all(&dir);
    }

    // ── icloud-bar-chart-sync (schema.md sections 3, 4, 9, 10; QA-02, QA-25, QA-27, QA-31) ──

    /// Pinned byte-equal to `COUNTY_RECORD_GOLDEN`, `COUNTY_CLEARED_GOLDEN`
    /// and `DAY_OBS_RECORD_GOLDEN` in icloudRecord.ts by the parity test.
    const COUNTY_RECORD_GOLDEN: &str = r#"{"version":1,"slot":"barchart","county":"US-CA-001","state":"file","filename":"ebird_US-CA-001__1900_2026_1_12_barchart.txt","uploadedAt":"2026-09-20T12:05:00.000Z","origin":{"deviceId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","label":"Dave's MacBook Pro","platform":"mac"},"byteLength":48213,"sha256":"3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea"}"#;
    const COUNTY_CLEARED_GOLDEN: &str = r#"{"version":1,"slot":"barchart","county":"US-CA-001","state":"cleared","clearedAt":"2026-09-21T08:00:00.000Z","origin":{"deviceId":"ffffffffffffffffffffffffffffffff","label":"iPhone","platform":"iphone"}}"#;
    const DAY_OBS_RECORD_GOLDEN: &str = r#"{"version":1,"slot":"day-obs","state":"file","filename":"county-day-obs.json","uploadedAt":"2026-09-21T08:00:00.000Z","origin":{"deviceId":"ffffffffffffffffffffffffffffffff","label":"iPhone","platform":"iphone"},"byteLength":10485760,"sha256":"3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea"}"#;
    /// A slot record still serializes with no `county` key at all.
    const SLOT_RECORD_GOLDEN: &str = r#"{"version":1,"slot":"ebird","state":"file","filename":"MyEBirdData.csv","uploadedAt":"2026-08-24T22:12:00.000Z","origin":{"deviceId":"aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa","label":"Dave's MacBook Pro","platform":"mac"},"byteLength":1000,"sha256":"3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea"}"#;
    const GOLDEN_SHA: &str = "3f79bb7b435b05321651daefd374cdc681dc06faa65e374e38337b88ca046dea";

    fn mac_origin() -> Origin {
        Origin { device_id: "a".repeat(32), label: "Dave's MacBook Pro".to_string(), platform: "mac".to_string() }
    }
    fn phone_origin() -> Origin {
        Origin { device_id: "f".repeat(32), label: "iPhone".to_string(), platform: "iphone".to_string() }
    }
    fn county(code: &str) -> SyncItem {
        SyncItem::County(County::parse(code).unwrap())
    }
    fn tmp_dir(tag: &str) -> PathBuf {
        let dir = std::env::temp_dir().join(format!("sr-icloud-{}-{}", tag, std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[derive(Deserialize)]
    struct RegionRow {
        input: String,
        ok: bool,
    }

    /// THE RUST HALF OF THE TWINNED REGION-CODE PREDICATE (FR-29, QA-31).
    /// Deleting `County::parse`'s checks turns this test red and nothing on the
    /// TypeScript side; `icloudNative.regionCode.test.ts` is the other half.
    #[test]
    fn county_parse_refuses_fixture_rows() {
        let rows: Vec<RegionRow> = serde_json::from_str(include_str!("../../frontend/src/lib/regionCode.fixture.json")).unwrap();
        // The same count the TypeScript parity test asserts, so neither side can grow alone.
        assert_eq!(rows.len(), 24);
        assert!(rows.iter().any(|r| r.ok) && rows.iter().any(|r| !r.ok));
        for r in &rows {
            assert_eq!(County::parse(&r.input).is_ok(), r.ok, "{:?}", r.input);
        }
        // And the IPC conversion refuses before any path is built.
        let bad = SyncItem::try_from(ItemArg::Barchart { county: "US-CA-001\n".to_string() });
        assert_eq!(bad.err().as_deref(), Some("unknown"));
        let bad_dev = SyncItem::try_from(ItemArg::DayObs { device_id: "../../x".to_string() });
        assert_eq!(bad_dev.err().as_deref(), Some("unknown"));
    }

    #[test]
    fn item_names_derive_from_the_validated_code_only() {
        let c = county("US-CA-001");
        assert_eq!(c.container_file(), "barcharts/US-CA-001.txt");
        assert_eq!(c.container_record(), "barcharts/US-CA-001.record.json");
        assert_eq!(c.local_path(Path::new("/d")), PathBuf::from("/d/barcharts/US-CA-001.txt"));
        let d = SyncItem::DayObs(DeviceId::parse(&"f".repeat(32)).unwrap());
        assert_eq!(d.container_file(), format!("day-obs/{}.json", "f".repeat(32)));
        assert_eq!(d.container_record(), format!("day-obs/{}.record.json", "f".repeat(32)));
        assert_eq!(d.local_path(Path::new("/d")), PathBuf::from("/d/county-day-obs.json"));
        // Staging is flat in the one .tmp/ directory, and a slot name is unchanged.
        assert_eq!(staging_name("barcharts/US-CA-001.txt"), "barcharts-US-CA-001.txt");
        assert_eq!(staging_name("ebird-backup.csv"), "ebird-backup.csv");
        // No item name can spell a slot name, a slot record or the key record.
        for n in [c.container_file(), c.container_record(), d.container_file(), d.container_record()] {
            for fixed in ["ebird-backup.csv", "ml-export.csv", "ebird.record.json", "ml.record.json", KEYS_RECORD_NAME] {
                assert_ne!(n, fixed);
            }
        }
        // The IPC shape deserializes as the frontend sends it.
        let arg: ItemArg = serde_json::from_str(r#"{"kind":"day-obs","deviceId":"ffffffffffffffffffffffffffffffff"}"#).unwrap();
        assert!(matches!(SyncItem::try_from(arg), Ok(SyncItem::DayObs(_))));
        let arg: ItemArg = serde_json::from_str(r#"{"kind":"barchart","county":"US-CA-001"}"#).unwrap();
        assert!(matches!(SyncItem::try_from(arg), Ok(SyncItem::County(_))));
    }

    #[test]
    fn item_record_goldens_match_the_frontend_literals() {
        let o = mac_origin();
        let ca = county("US-CA-001");
        let (slot, c) = ca.record_fields();
        let file = RecordFile {
            version: 1, slot, county: c, state: "file",
            filename: Some("ebird_US-CA-001__1900_2026_1_12_barchart.txt"),
            uploaded_at: Some("2026-09-20T12:05:00.000Z"), cleared_at: None, origin: &o,
            byte_length: Some(48213), sha256: Some(GOLDEN_SHA),
        };
        assert_eq!(serde_json::to_string(&file).unwrap(), COUNTY_RECORD_GOLDEN);
        let p = phone_origin();
        let cleared = RecordFile {
            version: 1, slot, county: c, state: "cleared", filename: None, uploaded_at: None,
            cleared_at: Some("2026-09-21T08:00:00.000Z"), origin: &p, byte_length: None, sha256: None,
        };
        assert_eq!(serde_json::to_string(&cleared).unwrap(), COUNTY_CLEARED_GOLDEN);
        let d = SyncItem::DayObs(DeviceId::parse(&"f".repeat(32)).unwrap());
        let (dslot, dc) = d.record_fields();
        assert!(dc.is_none());
        let snap = RecordFile {
            version: 1, slot: dslot, county: dc, state: "file", filename: Some("county-day-obs.json"),
            uploaded_at: Some("2026-09-21T08:00:00.000Z"), cleared_at: None, origin: &p,
            byte_length: Some(10_485_760), sha256: Some(GOLDEN_SHA),
        };
        assert_eq!(serde_json::to_string(&snap).unwrap(), DAY_OBS_RECORD_GOLDEN);
        let slot_rec = RecordFile {
            version: 1, slot: Slot::Ebird.key(), county: None, state: "file", filename: Some("MyEBirdData.csv"),
            uploaded_at: Some("2026-08-24T22:12:00.000Z"), cleared_at: None, origin: &o,
            byte_length: Some(1000), sha256: Some(GOLDEN_SHA),
        };
        assert_eq!(serde_json::to_string(&slot_rec).unwrap(), SLOT_RECORD_GOLDEN);
    }

    #[test]
    fn the_day_obs_bound_sits_between_its_producer_and_the_csv_bound() {
        // 41.5 MB is the adversarial producer maximum (schema.md 10.1).
        const _: () = assert!(DAY_OBS_SHARED_MAX_BYTES > 41_500_000);
        const _: () = assert!(DAY_OBS_SHARED_MAX_BYTES < MAX_BYTES);
        assert_eq!(county("US-CA-001").max_bytes(), MAX_BYTES);
        assert_eq!(SyncItem::DayObs(DeviceId::parse(&"a".repeat(32)).unwrap()).max_bytes(), DAY_OBS_SHARED_MAX_BYTES);
    }

    #[test]
    fn a_push_then_a_pull_round_trips_and_verifies_length_and_digest() {
        let docs = tmp_dir("items-rt");
        let local_dir = docs.join("local");
        fs::create_dir_all(local_dir.join("barcharts")).unwrap();
        let item = county("US-CA-001");
        let local = item.local_path(&local_dir);
        fs::write(&local, b"Sample Size:\t1.0\n").unwrap();
        let o = mac_origin();
        let r = push_item_at(&docs, &local, &item, "ebird.txt", "2026-09-20T12:05:00.000Z", &o, None).unwrap();
        assert!(!r.skipped);
        assert_eq!(r.byte_length, 17);
        assert!(docs.join("barcharts/US-CA-001.txt").is_file());
        let rec = record_text_at(&docs.join("barcharts/US-CA-001.record.json")).unwrap().unwrap();
        assert!(rec.contains(r#""slot":"barchart","county":"US-CA-001","state":"file""#));
        assert!(rec.contains(&r.sha256));
        // No staging entry is left behind.
        assert_eq!(fs::read_dir(docs.join(".tmp")).unwrap().count(), 0);
        // The same bytes again, told the digest: nothing is written.
        let again = push_item_at(&docs, &local, &item, "ebird.txt", "2026-09-20T12:06:00.000Z", &o, Some(&r.sha256)).unwrap();
        assert!(again.skipped);
        assert!(!record_text_at(&docs.join("barcharts/US-CA-001.record.json")).unwrap().unwrap().contains("12:06"));
        // Pull onto a second device's data dir.
        let other = docs.join("other");
        let dst = item.local_path(&other);
        pull_item_at(&docs, &dst, &item, &r.sha256, r.byte_length, PullMode::File).unwrap();
        assert_eq!(fs::read(&dst).unwrap(), b"Sample Size:\t1.0\n");
        // A wrong length, a wrong digest and an over-bound claim are refused and touch nothing.
        fs::write(&dst, b"keep").unwrap();
        assert_eq!(pull_item_at(&docs, &dst, &item, &r.sha256, 16, PullMode::File).err().as_deref(), Some("mismatch"));
        assert_eq!(pull_item_at(&docs, &dst, &item, &"0".repeat(64), 17, PullMode::File).err().as_deref(), Some("mismatch"));
        assert_eq!(pull_item_at(&docs, &dst, &item, &r.sha256, MAX_BYTES + 1, PullMode::File).err().as_deref(), Some("too-large"));
        assert_eq!(fs::read(&dst).unwrap(), b"keep");
        // The modes pair with the kinds: a county file is never handed back as text.
        assert_eq!(pull_item_at(&docs, &dst, &item, &r.sha256, 17, PullMode::Text).err().as_deref(), Some("unknown"));
        // An absent county is absent.
        assert_eq!(pull_item_at(&docs, &dst, &county("US-NY-001"), &r.sha256, 17, PullMode::File).err().as_deref(), Some("absent"));
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn a_day_obs_snapshot_pulls_as_text_and_non_utf8_is_a_mismatch() {
        let docs = tmp_dir("items-text");
        let local = docs.join("local/county-day-obs.json");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, br#"{"version":2,"entries":{},"order":[]}"#).unwrap();
        let o = phone_origin();
        let item = SyncItem::DayObs(DeviceId::parse(&o.device_id).unwrap());
        let r = push_item_at(&docs, &local, &item, "county-day-obs.json", "2026-09-21T08:00:00.000Z", &o, None).unwrap();
        let got = pull_item_at(&docs, Path::new("/nonexistent/never-written"), &item, &r.sha256, r.byte_length, PullMode::Text).unwrap();
        assert_eq!(got.text.as_deref(), Some(r#"{"version":2,"entries":{},"order":[]}"#));
        assert_eq!(pull_item_at(&docs, Path::new("/x"), &item, &r.sha256, r.byte_length, PullMode::File).err().as_deref(), Some("unknown"));
        // Bytes that verify but are not UTF-8 never reach the merge.
        let bad = [0xff_u8, 0xfe, b'{', b'}'];
        fs::write(docs.join(format!("day-obs/{}.json", o.device_id)), bad).unwrap();
        let sha = sha256_hex(&bad);
        assert_eq!(pull_item_at(&docs, Path::new("/x"), &item, &sha, 4, PullMode::Text).err().as_deref(), Some("mismatch"));
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn a_local_file_is_bounded_before_it_is_read() {
        let docs = tmp_dir("items-local");
        let o = phone_origin();
        let item = SyncItem::DayObs(DeviceId::parse(&o.device_id).unwrap());
        let local = docs.join("county-day-obs.json");
        // Missing, then a directory, then a symlink at the local name: all local-missing.
        assert_eq!(push_item_at(&docs, &local, &item, "f", "t", &o, None).err().as_deref(), Some("local-missing"));
        fs::create_dir_all(&local).unwrap();
        assert_eq!(push_item_at(&docs, &local, &item, "f", "t", &o, None).err().as_deref(), Some("local-missing"));
        fs::remove_dir_all(&local).unwrap();
        let real = docs.join("real.json");
        fs::write(&real, b"{}").unwrap();
        std::os::unix::fs::symlink(&real, &local).unwrap();
        assert_eq!(push_item_at(&docs, &local, &item, "f", "t", &o, None).err().as_deref(), Some("local-missing"));
        fs::remove_file(&local).unwrap();
        // One byte over the kind's bound is refused from its length alone (a
        // sparse file: nothing is read into memory).
        let f = fs::File::create(&local).unwrap();
        f.set_len(DAY_OBS_SHARED_MAX_BYTES + 1).unwrap();
        assert_eq!(push_item_at(&docs, &local, &item, "f", "t", &o, None).err().as_deref(), Some("too-large"));
        assert!(!docs.join("day-obs").exists());
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn container_shapes_at_an_item_name_are_refused_or_read_as_absent() {
        let docs = tmp_dir("items-planted");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let item = county("US-CA-001");
        let dst = docs.join("local/barcharts/US-CA-001.txt");
        // A directory at the county file's name: never read.
        fs::create_dir_all(sub.join("US-CA-001.txt")).unwrap();
        assert!(pull_item_at(&docs, &dst, &item, GOLDEN_SHA, 3, PullMode::File).is_err());
        fs::remove_dir_all(sub.join("US-CA-001.txt")).unwrap();
        // A symlink at the county file's name: not an item this app wrote, never followed.
        let outside = docs.join("outside.txt");
        fs::write(&outside, b"abc").unwrap();
        std::os::unix::fs::symlink(&outside, sub.join("US-CA-001.txt")).unwrap();
        assert_eq!(pull_item_at(&docs, &dst, &item, &sha256_hex(b"abc"), 3, PullMode::File).err().as_deref(), Some("absent"));
        assert!(!dst.exists());
        // A symlink planted at the SUBDIRECTORY's own name: reads see nothing,
        // and a write removes it as a link and never writes through it.
        fs::remove_dir_all(&sub).unwrap();
        let elsewhere = docs.join("elsewhere");
        fs::create_dir_all(&elsewhere).unwrap();
        std::os::unix::fs::symlink(&elsewhere, &sub).unwrap();
        assert!(list_items_bounded(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS).items.is_empty());
        let local = docs.join("local/barcharts/US-CA-001.txt");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, b"abc").unwrap();
        push_item_at(&docs, &local, &item, "e.txt", "2026-09-20T12:05:00.000Z", &mac_origin(), None).unwrap();
        assert!(fs::symlink_metadata(&sub).unwrap().file_type().is_dir());
        assert_eq!(fs::read_dir(&elsewhere).unwrap().count(), 0);
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn a_listing_reads_only_valid_record_names_and_is_bounded() {
        let docs = tmp_dir("items-list");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("US-CA-001.record.json"), COUNTY_RECORD_GOLDEN).unwrap();
        fs::write(sub.join("US-CA-001.txt"), b"abc").unwrap();
        fs::write(sub.join("US-NY-005.record.json"), COUNTY_CLEARED_GOLDEN).unwrap();
        // Names that are not a county record: ignored, never read. (A
        // lowercase spelling of a code already present would OPEN that file on
        // a case-insensitive volume, the macOS default, so this one names a
        // county with no other entry.)
        fs::write(sub.join("us-tx-999.record.json"), b"x").unwrap();
        fs::write(sub.join("US-CA-001\n.record.json"), b"x").unwrap();
        fs::write(sub.join("US-CA-0012.record.json"), b"x").unwrap();
        fs::write(sub.join("notes.txt"), b"x").unwrap();
        // A directory at a record name reads as the empty text (absent to the validator).
        fs::create_dir_all(sub.join("US-TX-201.record.json")).unwrap();
        // A record past the 16 KB bound is not loaded, and non-UTF-8 reads empty.
        fs::write(sub.join("US-WA-033.record.json"), vec![b' '; (MAX_RECORD_BYTES + 1) as usize]).unwrap();
        fs::write(sub.join("US-OR-051.record.json"), [0xff_u8, 0xfe]).unwrap();
        let listed = list_items_bounded(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS);
        assert!(!listed.truncated);
        let ids: Vec<&str> = listed.items.iter().map(|i| i.id.as_str()).collect();
        assert_eq!(ids, vec!["US-CA-001", "US-NY-005", "US-OR-051", "US-TX-201", "US-WA-033"]);
        let ca = &listed.items[0];
        assert!(ca.present);
        assert_eq!(ca.record.as_deref(), Some(COUNTY_RECORD_GOLDEN));
        assert!(ca.file.present && ca.file.downloaded);
        assert_eq!(ca.file.byte_length, Some(3));
        let ny = &listed.items[1];
        assert_eq!(ny.record.as_deref(), Some(COUNTY_CLEARED_GOLDEN));
        assert!(!ny.file.present);
        // Non-UTF-8 and oversized records read as the empty text; a directory
        // at the record name is not a record at all (absent, so the next push
        // replaces it), exactly as for a slot record.
        let by_id = |id: &str| listed.items.iter().find(|i| i.id == id).unwrap();
        assert_eq!(by_id("US-OR-051").record.as_deref(), Some(""));
        assert_eq!(by_id("US-WA-033").record.as_deref(), Some(""));
        assert!(!by_id("US-TX-201").present);
        assert!(by_id("US-TX-201").record.is_none());
        // The bound: one item past it is reported as truncated, not read.
        let bounded = list_items_bounded(&docs, ItemKind::Barchart, 4);
        assert_eq!(bounded.items.len(), 4);
        assert!(bounded.truncated);
        // A day-obs listing does not see county names, and the reverse.
        assert!(list_items_bounded(&docs, ItemKind::DayObs, MAX_LISTED_ITEMS).items.is_empty());
        fs::create_dir_all(docs.join("day-obs")).unwrap();
        fs::write(docs.join(format!("day-obs/{}.record.json", "f".repeat(32))), DAY_OBS_RECORD_GOLDEN).unwrap();
        fs::write(docs.join("day-obs/US-CA-001.record.json"), b"x").unwrap();
        let days = list_items_bounded(&docs, ItemKind::DayObs, MAX_LISTED_ITEMS);
        assert_eq!(days.items.len(), 1);
        assert_eq!(days.items[0].id, "f".repeat(32));
        // The placeholder name of an undownloaded record names the same id.
        assert_eq!(record_id_from_name(".US-CA-001.record.json.icloud", ItemKind::Barchart).as_deref(), Some("US-CA-001"));
        assert_eq!(record_id_from_name(".US-CA-001.record.json", ItemKind::Barchart), None);
        let _ = fs::remove_dir_all(&docs);
    }

    // ── device pass on 1.0.40.2 (decisions.md entry 18): the receiving device ──
    //
    // A fake of the three record operations, so the listing's READ RULE runs
    // against the states iOS gives a record another device wrote, with no
    // iCloud account: `Stale` is a local copy that is no longer the newest
    // version (Foundation's `Downloaded` status, which iOS 18.4 and later
    // leaves in place indefinitely, FB17662379), `NotDownloaded` a placeholder.
    // A download request changes nothing on its own; a coordinated read of a
    // record the fake can refresh first brings the newer version down (Apple:
    // a coordinated read downloads the file before the accessor runs), which
    // is the read the two-file sync does on every check.

    #[derive(Clone, Copy, PartialEq, Debug)]
    enum FakeStatus {
        Current,
        Stale,
        NotDownloaded,
    }

    struct FakeRecord {
        status: FakeStatus,
        /// The newer version iCloud holds, written over the local copy by a
        /// coordinated read when `refreshes` is set.
        newer: Option<String>,
        refreshes: bool,
    }

    #[derive(Clone)]
    struct FakeIo {
        records: std::sync::Arc<Mutex<std::collections::HashMap<PathBuf, FakeRecord>>>,
        downloads: std::sync::Arc<Mutex<Vec<PathBuf>>>,
        reads: std::sync::Arc<Mutex<Vec<PathBuf>>>,
        /// Every coordinated delete, by logical path, in order.
        deletes: std::sync::Arc<Mutex<Vec<PathBuf>>>,
        /// Every coordinated directory creation.
        dirs: std::sync::Arc<Mutex<Vec<PathBuf>>>,
        read_delay: Duration,
    }

    impl FakeIo {
        fn new(read_delay: Duration) -> FakeIo {
            FakeIo {
                records: Default::default(),
                downloads: Default::default(),
                reads: Default::default(),
                deletes: Default::default(),
                dirs: Default::default(),
                read_delay,
            }
        }
        fn set(&self, path: PathBuf, status: FakeStatus, newer: Option<&str>, refreshes: bool) {
            self.records.lock().unwrap().insert(path, FakeRecord { status, newer: newer.map(str::to_string), refreshes });
        }
    }

    impl ContainerIo for FakeIo {
        fn flags(&self, path: &Path) -> UbiquityFlags {
            match self.records.lock().unwrap().get(path) {
                Some(r) => UbiquityFlags { downloaded: r.status == FakeStatus::Current, downloading: false, uploaded: true, uploading: false },
                None => ubiquity_flags(path),
            }
        }
        fn start_download(&self, path: &Path) {
            self.downloads.lock().unwrap().push(path.to_path_buf());
        }
        fn read(&self, dir: &Path, name: &str) -> Result<Option<String>, String> {
            let path = dir.join(name);
            self.reads.lock().unwrap().push(path.clone());
            std::thread::sleep(self.read_delay);
            if let Some(r) = self.records.lock().unwrap().get_mut(&path) {
                if r.refreshes {
                    if let Some(text) = r.newer.take() {
                        // Not unwrapped: a read the listing gave up on may land
                        // after the test has removed its directory.
                        let _ = fs::write(&path, text);
                        let _ = fs::remove_file(placeholder_path(dir, name));
                    }
                    r.status = FakeStatus::Current;
                }
            }
            // The real read posture (a regular file, bounded, UTF-8) on what is
            // on disk now; a placeholder that was never brought down reads None.
            read_record_text(dir, name)
        }
        /// NSFileManager's delete through the LOGICAL URL, as it behaves in a
        /// container: the regular file at the name when there is one, else the
        /// iCloud item its placeholder stands for (the placeholder goes).
        fn delete(&self, dir: &Path, name: &str) -> Result<bool, String> {
            let path = dir.join(name);
            self.deletes.lock().unwrap().push(path.clone());
            self.records.lock().unwrap().remove(&path);
            if is_regular_file(&path) {
                fs::remove_file(&path).map_err(|_| "unavailable".to_string())?;
                return Ok(true);
            }
            let placeholder = placeholder_path(dir, name);
            if is_regular_file(&placeholder) {
                fs::remove_file(&placeholder).map_err(|_| "unavailable".to_string())?;
                return Ok(true);
            }
            Ok(false)
        }
        fn create_dir(&self, path: &Path) -> Result<(), String> {
            self.dirs.lock().unwrap().push(path.to_path_buf());
            match fs::create_dir(path) {
                Ok(()) => Ok(()),
                Err(e) if e.kind() == std::io::ErrorKind::AlreadyExists => Ok(()),
                Err(_) => Err("unavailable".to_string()),
            }
        }
    }

    /// A gate of its own per test (tests run in parallel), with the given
    /// per-listing wait and a window allowance that never runs out.
    fn test_gate(per_listing: Duration) -> FetchGate {
        FetchGate::new(per_listing, Duration::from_secs(3600), Duration::from_secs(3600))
    }

    /// The phone's case: the county was added HERE (this device wrote its
    /// file record), and the other device's cleared marker has since replaced
    /// it in iCloud, so the record here is a local copy that is out of date.
    /// The listing must read the marker in this check, as the two-file sync
    /// reads its record, instead of skipping the county on every check.
    #[test]
    fn a_record_another_device_replaced_is_read_in_the_same_listing() {
        let docs = tmp_dir("items-stale");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let path = sub.join("US-CA-001.record.json");
        fs::write(&path, COUNTY_RECORD_GOLDEN).unwrap();
        let io = FakeIo::new(Duration::ZERO);
        io.set(path.clone(), FakeStatus::Stale, Some(COUNTY_CLEARED_GOLDEN), true);
        let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &test_gate(LISTING_READ_BUDGET));
        assert_eq!(listed.items.len(), 1);
        assert!(listed.items[0].present);
        assert_eq!(listed.items[0].record.as_deref(), Some(COUNTY_CLEARED_GOLDEN));
        // The download was asked for too, before the read.
        assert_eq!(*io.downloads.lock().unwrap(), vec![path.clone()]);
        let _ = fs::remove_dir_all(&docs);
    }

    /// A record another device wrote that this device holds only as a
    /// placeholder is brought down and read in the same listing too.
    #[test]
    fn an_undownloaded_record_is_brought_down_and_read_in_the_same_listing() {
        let docs = tmp_dir("items-placeholder");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join(".US-CA-001.record.json.icloud"), b"bplist-stub").unwrap();
        let io = FakeIo::new(Duration::ZERO);
        io.set(sub.join("US-CA-001.record.json"), FakeStatus::NotDownloaded, Some(COUNTY_RECORD_GOLDEN), true);
        let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &test_gate(LISTING_READ_BUDGET));
        assert_eq!(listed.items.len(), 1);
        assert_eq!(listed.items[0].record.as_deref(), Some(COUNTY_RECORD_GOLDEN));
        let _ = fs::remove_dir_all(&docs);
    }

    /// The tri-state is kept: a read that leaves the record still out of date
    /// is NOT used (the device would otherwise decide from a copy it knows is
    /// old, and could push over a newer file it has not read), and a record
    /// that is Current is read once, exactly as before.
    #[test]
    fn a_read_that_leaves_the_record_out_of_date_is_not_used() {
        let docs = tmp_dir("items-still-stale");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let stale = sub.join("US-CA-001.record.json");
        fs::write(&stale, COUNTY_RECORD_GOLDEN).unwrap();
        let current = sub.join("US-NY-005.record.json");
        fs::write(&current, COUNTY_CLEARED_GOLDEN).unwrap();
        let io = FakeIo::new(Duration::ZERO);
        io.set(stale.clone(), FakeStatus::Stale, Some(COUNTY_CLEARED_GOLDEN), false);
        io.set(current.clone(), FakeStatus::Current, None, false);
        let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &test_gate(LISTING_READ_BUDGET));
        let by_id = |id: &str| listed.items.iter().find(|i| i.id == id).unwrap();
        assert!(by_id("US-CA-001").present);
        assert!(by_id("US-CA-001").record.is_none());
        assert_eq!(by_id("US-NY-005").record.as_deref(), Some(COUNTY_CLEARED_GOLDEN));
        assert_eq!(io.reads.lock().unwrap().iter().filter(|p| **p == current).count(), 1);
        assert!(io.downloads.lock().unwrap().iter().all(|p| *p != current));
        let _ = fs::remove_dir_all(&docs);
    }

    /// The bound: reads that do not finish inside the budget leave their
    /// records unread (the next check has them), and the listing itself
    /// returns at the budget rather than waiting on them, so an offline device
    /// holding a placeholder never spends the command's whole timeout here.
    #[test]
    fn reads_that_outlast_the_budget_are_left_unread_and_the_listing_returns() {
        let docs = tmp_dir("items-budget");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let io = FakeIo::new(Duration::from_millis(400));
        for code in ["US-CA-001", "US-NY-005", "US-TX-201"] {
            let path = sub.join(format!("{}.record.json", code));
            fs::write(&path, COUNTY_RECORD_GOLDEN.replace("US-CA-001", code)).unwrap();
            io.set(path, FakeStatus::Stale, Some(&COUNTY_CLEARED_GOLDEN.replace("US-CA-001", code)), true);
        }
        let started = std::time::Instant::now();
        let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &test_gate(Duration::from_millis(100)));
        let took = started.elapsed();
        assert_eq!(listed.items.len(), 3);
        assert!(listed.items.iter().all(|i| i.present && i.record.is_none()), "{:?}", listed.items.iter().map(|i| &i.record).collect::<Vec<_>>());
        // Every download was asked for up front, whatever the budget.
        assert_eq!(io.downloads.lock().unwrap().len(), 3);
        assert!(took < Duration::from_millis(350), "the listing waited {:?}", took);
        let _ = fs::remove_dir_all(&docs);
    }

    /// I8, the guard: a listing that starts while an earlier listing's read is
    /// still in flight (offline, a coordinated read waits until iCloud gives
    /// up) starts no second helper and does not wait; its record reads as not
    /// read yet. The first read, once it returns, is not wasted.
    #[test]
    fn a_listing_while_a_read_is_in_flight_starts_no_second_wait() {
        let docs = tmp_dir("items-inflight");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let path = sub.join("US-CA-001.record.json");
        fs::write(&path, COUNTY_RECORD_GOLDEN).unwrap();
        let io = FakeIo::new(Duration::from_millis(600));
        io.set(path.clone(), FakeStatus::Stale, Some(COUNTY_CLEARED_GOLDEN), true);
        let gate = std::sync::Arc::new(test_gate(Duration::from_millis(300)));
        let (io_a, gate_a, docs_a) = (io.clone(), gate.clone(), docs.clone());
        let first = std::thread::spawn(move || list_items_with(&docs_a, ItemKind::Barchart, MAX_LISTED_ITEMS, &io_a, &gate_a));
        std::thread::sleep(Duration::from_millis(50));
        // Concurrent with the first listing, whose read is under way.
        let started = std::time::Instant::now();
        let second = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &gate);
        let took = started.elapsed();
        assert!(second.items[0].present && second.items[0].record.is_none());
        assert_eq!(io.reads.lock().unwrap().len(), 1, "a second helper was started");
        assert!(took < Duration::from_millis(150), "the second listing waited {:?}", took);
        let first = first.join().unwrap();
        assert!(first.items[0].record.is_none()); // it gave up at its 300 ms
        // Again, after the first listing gave up but while its read still runs.
        let third = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &gate);
        assert!(third.items[0].record.is_none());
        assert_eq!(io.reads.lock().unwrap().len(), 1, "a second helper was started");
        // Once that read returns, the flag is clear and the record it brought
        // down is read as Current, with no fetch.
        std::thread::sleep(Duration::from_millis(500));
        let fourth = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &gate);
        assert_eq!(fourth.items[0].record.as_deref(), Some(COUNTY_CLEARED_GOLDEN));
        assert!(!gate.in_flight.load(Ordering::Acquire));
        let _ = fs::remove_dir_all(&docs);
    }

    /// I8, the per-check bound: the listings one check makes (the county
    /// download wait re-lists a poll apart) share ONE allowance per window, so
    /// a record whose reads always outlast a listing's wait (but return before
    /// the next listing) cannot make every listing wait its full budget.
    #[test]
    fn waiting_for_fetched_records_is_bounded_across_the_listings_of_one_check() {
        let docs = tmp_dir("items-window");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let path = sub.join("US-CA-001.record.json");
        fs::write(&path, COUNTY_RECORD_GOLDEN).unwrap();
        // Out of date every time: the read never brings it current.
        let io = FakeIo::new(Duration::from_millis(200));
        io.set(path, FakeStatus::Stale, None, false);
        // 150 ms per listing, 300 ms per window: two listings' worth.
        let gate = FetchGate::new(Duration::from_millis(150), Duration::from_millis(300), Duration::from_secs(3600));
        let mut inside = Duration::ZERO;
        for _ in 0..5 {
            let started = std::time::Instant::now();
            let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &gate);
            inside += started.elapsed();
            assert!(listed.items[0].present && listed.items[0].record.is_none());
            // The poll between the wait's listings, long enough for each read to return.
            std::thread::sleep(Duration::from_millis(150));
        }
        // Unbounded: five reads and 750 ms of waiting. Bounded: two and 300 ms.
        assert!(io.reads.lock().unwrap().len() <= 2, "{} reads", io.reads.lock().unwrap().len());
        assert!(inside < Duration::from_millis(550), "the listings waited {:?}", inside);
        // A new window restores the allowance.
        let fresh = FetchGate::new(Duration::from_millis(150), Duration::from_millis(300), Duration::from_millis(1));
        std::thread::sleep(Duration::from_millis(250));
        let before = io.reads.lock().unwrap().len();
        let _ = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &fresh);
        assert_eq!(io.reads.lock().unwrap().len(), before + 1);
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn cleared_markers_replace_the_file_and_refuse_a_bad_code() {
        let docs = tmp_dir("items-cleared");
        let local = docs.join("local/barcharts/US-CA-001.txt");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, b"abc").unwrap();
        let item = county("US-CA-001");
        push_item_at(&docs, &local, &item, "e.txt", "2026-09-20T12:05:00.000Z", &mac_origin(), None).unwrap();
        let r = push_items_cleared_at(&docs, vec!["US-CA-001".to_string(), "US-CA-001\n".to_string()], "2026-09-21T08:00:00.000Z", &phone_origin()).unwrap();
        assert_eq!(r.failed, vec!["US-CA-001\n".to_string()]);
        assert!(!docs.join("barcharts/US-CA-001.txt").exists());
        assert_eq!(record_text_at(&docs.join("barcharts/US-CA-001.record.json")).unwrap().as_deref(), Some(COUNTY_CLEARED_GOLDEN));
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn a_bulk_removal_takes_every_valid_item_and_its_staging_and_nothing_else() {
        let docs = tmp_dir("items-remove");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        for n in ["US-CA-001.txt", "US-CA-001.record.json", "US-NY-005.record.json"] {
            fs::write(sub.join(n), b"x").unwrap();
        }
        // An undownloaded item's placeholder names the same id (the logical
        // delete of a REAL placeholder is Foundation's, not testable here).
        assert_eq!(item_id_from_any_name(".US-TX-201.txt.icloud", ItemKind::Barchart).as_deref(), Some("US-TX-201"));
        assert_eq!(item_id_from_any_name(".US-TX-201.record.json.icloud", ItemKind::Barchart).as_deref(), Some("US-TX-201"));
        assert_eq!(item_id_from_any_name("US-TX-201.json", ItemKind::Barchart), None);
        fs::write(sub.join("notes.txt"), b"keep").unwrap();
        let tmp = docs.join(".tmp");
        fs::create_dir_all(&tmp).unwrap();
        let me = "a".repeat(32);
        fs::write(tmp.join(format!("{}-barcharts-US-CA-001.txt", me)), b"s").unwrap();
        fs::write(tmp.join(format!("{}-day-obs-{}.json", me, me)), b"s").unwrap();
        fs::write(tmp.join(format!("{}-ebird-backup.csv", me)), b"s").unwrap();
        // Slots and the key record beside the subdirectory are never touched.
        fs::write(docs.join("ebird.record.json"), b"r").unwrap();
        fs::write(docs.join(KEYS_RECORD_NAME), b"k").unwrap();
        let removed = remove_items_in(&docs, ItemKind::Barchart).unwrap();
        assert_eq!(removed, 4);
        assert!(sub.join("notes.txt").exists());
        assert!(!sub.join("US-CA-001.txt").exists() && !sub.join("US-NY-005.record.json").exists());
        assert!(tmp.join(format!("{}-day-obs-{}.json", me, me)).exists());
        assert!(tmp.join(format!("{}-ebird-backup.csv", me)).exists());
        assert!(docs.join("ebird.record.json").exists() && docs.join(KEYS_RECORD_NAME).exists());
        assert_eq!(remove_items_in(&docs, ItemKind::DayObs).unwrap(), 1);
        // One item's removal: its record and file, and its own staging only.
        fs::write(sub.join("US-CA-003.txt"), b"x").unwrap();
        fs::write(sub.join("US-CA-003.record.json"), b"x").unwrap();
        fs::write(tmp.join(format!("{}-barcharts-US-CA-003.record.json", "f".repeat(32))), b"s").unwrap();
        assert_eq!(remove_item_at(&docs, &county("US-CA-003")).unwrap(), 3);
        assert!(sub.join("notes.txt").exists());
        let _ = fs::remove_dir_all(&docs);
    }

    // ── device pass on 1.0.40.3 (decisions.md entry 19): the WRITING device ──
    //
    // The county record is always brought current before a push (the listing
    // reads it through a coordinated read, and a record it cannot read skips
    // the county), but the county FILE was written over whatever its name held
    // on this device. On the second device that is typically the first
    // device's version held only as a placeholder (`.US-CA-001.txt.icloud`,
    // never downloaded here because this device's own copy was newer), and a
    // rename onto the name then puts a SECOND item beside it. These rows run
    // against the real Foundation calls in a temporary directory (which is not
    // an iCloud container, so a planted placeholder cannot be removed there):
    // the fixed write refuses rather than leave a twin. The success path runs
    // over the fake below.

    /// Both representations of one name at once: a real file AND iCloud's
    /// placeholder for an item of the same name.
    fn twin_at(dir: &Path, name: &str) -> bool {
        is_regular_file(&dir.join(name)) && is_regular_file(&placeholder_path(dir, name))
    }

    #[test]
    fn a_county_push_never_leaves_a_twin_beside_a_placeholder() {
        let docs = tmp_dir("w-twin-file");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        // The first device's file, held here only as a placeholder.
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let local = docs.join("local/barcharts/US-CA-001.txt");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, b"Sample Size:\t2.0\n").unwrap();
        let _ = push_item_at(&docs, &local, &county("US-CA-001"), "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None);
        assert!(!twin_at(&sub, "US-CA-001.txt"), "the push left a second item beside the placeholder");
        let _ = fs::remove_dir_all(&docs);
    }

    #[test]
    fn a_cleared_marker_never_leaves_a_twin_beside_a_placeholder_record() {
        let docs = tmp_dir("w-twin-marker");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join(".US-CA-001.record.json.icloud"), b"bplist-stub").unwrap();
        let _ = push_items_cleared_at(&docs, vec!["US-CA-001".to_string()], "2026-09-29T12:00:00.000Z", &mac_origin());
        assert!(!twin_at(&sub, "US-CA-001.record.json"), "the marker left a second record beside the placeholder");
        let _ = fs::remove_dir_all(&docs);
    }

    /// Follow-up 1 (the Tester): the delete-before-write is the COUNTY kind's
    /// only. The long-shipped data-file and key writes, and the day-obs
    /// snapshot, keep the shipped helper byte for byte and never delete: over
    /// a name held only by a placeholder they still write beside it, exactly
    /// as before this fix (their flows never reach that state).
    #[test]
    fn data_file_key_and_day_obs_writes_keep_the_shipped_helper_and_never_delete() {
        let docs = tmp_dir("w-shipped-writes");
        let me = "a".repeat(32);
        for name in ["ebird-backup.csv", "ebird.record.json", KEYS_RECORD_NAME] {
            fs::write(placeholder_path(&docs, name), b"bplist-stub").unwrap();
            atomic_container_write(&docs, name, &me, b"new").unwrap();
            assert!(is_regular_file(&placeholder_path(&docs, name)), "{} lost its placeholder", name);
            assert_eq!(fs::read(docs.join(name)).unwrap(), b"new");
        }
        // The day-obs snapshot and its record: no delete through any io.
        let o = phone_origin();
        let item = SyncItem::DayObs(DeviceId::parse(&o.device_id).unwrap());
        let local = docs.join("local/county-day-obs.json");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, b"{}").unwrap();
        fs::create_dir_all(docs.join("day-obs")).unwrap();
        fs::write(placeholder_path(&docs.join("day-obs"), &item.file_name()), b"bplist-stub").unwrap();
        let io = FakeIo::new(Duration::ZERO);
        push_item_with(&io, &docs, &local, &item, "county-day-obs.json", "2026-09-29T12:00:00.000Z", &o, None, None).unwrap();
        assert!(io.deletes.lock().unwrap().is_empty());
        // And in source: the shipped helper names no delete, and the slot and
        // key commands call it, never the county writer.
        let src = include_str!("icloud.rs");
        let helper = &src[src.find("fn atomic_container_write(docs").unwrap()..];
        let helper = &helper[..helper.find("\n}\n").unwrap()];
        for forbidden in ["clear_way", "free_name", "delete"] {
            assert!(!helper.contains(forbidden), "the shipped helper now names {}", forbidden);
        }
        for cmd in ["pub async fn icloud_push(", "pub async fn icloud_push_cleared(", "pub async fn icloud_write_keys("] {
            let body = &src[src.find(cmd).unwrap()..];
            let body = &body[..body.find("\n}\n").unwrap()];
            assert!(body.contains("atomic_container_write(&docs") && !body.contains("county_container_write"), "{}", cmd);
        }
        let _ = fs::remove_dir_all(&docs);
    }

    /// The kind's directory is in iCloud but not on this device yet (its
    /// placeholder is here): a write must never create a second directory of
    /// the same name, which iCloud would keep apart from the first.
    #[test]
    fn a_push_never_creates_a_second_kind_directory_beside_its_placeholder() {
        let docs = tmp_dir("w-dir-placeholder");
        fs::write(docs.join(".barcharts.icloud"), b"bplist-stub").unwrap();
        let local = docs.join("local/barcharts/US-CA-001.txt");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, b"abc").unwrap();
        let r = push_item_at(&docs, &local, &county("US-CA-001"), "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None);
        assert_eq!(r.err().as_deref(), Some("unavailable"));
        assert!(!docs.join("barcharts").exists());
        let _ = fs::remove_dir_all(&docs);
    }

    /// A name held by a real file AND a placeholder is contested: the copy on
    /// disk is not iCloud's item of that name, so the listing never reports
    /// it downloaded (the writer then repairs it; a reader waits for it).
    #[test]
    fn a_listing_never_reports_a_contested_name_as_downloaded() {
        let docs = tmp_dir("w-contested");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        fs::write(sub.join("US-CA-001.record.json"), COUNTY_RECORD_GOLDEN).unwrap();
        fs::write(sub.join("US-CA-001.txt"), b"mine").unwrap();
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let listed = list_items_bounded(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS);
        assert!(listed.items[0].file.present);
        assert!(!listed.items[0].file.downloaded);
        let _ = fs::remove_dir_all(&docs);
    }

    /// Remove synced files takes the copies iCloud set aside under a changed
    /// name (a bounced twin, `US-CA-001 2.txt`) and a duplicate directory
    /// (`barcharts 2`), so "the copies in your iCloud account" stays exact.
    #[test]
    fn remove_all_takes_conflict_twins_and_duplicate_directories() {
        let docs = tmp_dir("w-remove-twins");
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        for n in ["US-CA-001 2.txt", "US-CA-001 2.record.json", "US-CA-001.record 2.json", "notes 2.txt", "US-CA-001 x.txt"] {
            fs::write(sub.join(n), b"x").unwrap();
        }
        let dup = docs.join("barcharts 2");
        fs::create_dir_all(&dup).unwrap();
        fs::write(dup.join("US-NY-005.txt"), b"x").unwrap();
        fs::write(dup.join("US-NY-005.record.json"), b"x").unwrap();
        // Not a duplicate of the kind's directory: left alone.
        fs::create_dir_all(docs.join("barcharts2")).unwrap();
        fs::create_dir_all(docs.join("barcharts x")).unwrap();
        remove_items_in(&docs, ItemKind::Barchart).unwrap();
        for n in ["US-CA-001 2.txt", "US-CA-001 2.record.json", "US-CA-001.record 2.json"] {
            assert!(!sub.join(n).exists(), "{} left behind", n);
        }
        assert!(sub.join("notes 2.txt").exists() && sub.join("US-CA-001 x.txt").exists());
        assert!(!dup.exists());
        assert!(docs.join("barcharts2").exists() && docs.join("barcharts x").exists());
        let _ = fs::remove_dir_all(&docs);
    }

    /// A container with the kind's directory present and the local county file
    /// ready: (docs, sub, local).
    fn writer_fixture(tag: &str, bytes: &[u8]) -> (PathBuf, PathBuf, PathBuf) {
        let docs = tmp_dir(tag);
        let sub = docs.join("barcharts");
        fs::create_dir_all(&sub).unwrap();
        let local = docs.join("local/barcharts/US-CA-001.txt");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, bytes).unwrap();
        (docs, sub, local)
    }

    /// The success path the real container gives: the placeholder of the first
    /// device's file is deleted as the iCloud item it stands for, and THEN this
    /// device's file takes the free name; the record follows as before.
    #[test]
    fn a_push_over_a_placeholder_deletes_that_item_then_takes_its_name() {
        let (docs, sub, local) = writer_fixture("w-fake-placeholder", b"Sample Size:\t2.0\n");
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let io = FakeIo::new(Duration::ZERO);
        let r = push_item_with(&io, &docs, &local, &county("US-CA-001"), "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, None).unwrap();
        assert!(!r.skipped);
        assert_eq!(*io.deletes.lock().unwrap(), vec![sub.join("US-CA-001.txt")]);
        assert!(!is_regular_file(&placeholder_path(&sub, "US-CA-001.txt")));
        assert_eq!(fs::read(sub.join("US-CA-001.txt")).unwrap(), b"Sample Size:\t2.0\n");
        let rec = record_text_at(&sub.join("US-CA-001.record.json")).unwrap().unwrap();
        assert!(rec.contains(&r.sha256) && rec.contains(r#""byteLength":17"#));
        let _ = fs::remove_dir_all(&docs);
    }

    /// An out-of-date local copy is deleted first too; a contested name (a
    /// file AND a placeholder) takes two deletes; a CURRENT copy is left to the
    /// rename with no delete at all, which is the two-file sync's own case.
    #[test]
    fn only_a_copy_that_is_not_current_is_deleted_before_a_write() {
        let (docs, sub, local) = writer_fixture("w-fake-states", b"new");
        let io = FakeIo::new(Duration::ZERO);
        let item = county("US-CA-001");
        let path = sub.join("US-CA-001.txt");
        fs::write(&path, b"old").unwrap();
        io.set(path.clone(), FakeStatus::Stale, None, false);
        push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, None).unwrap();
        assert_eq!(io.deletes.lock().unwrap().len(), 1);
        assert_eq!(fs::read(&path).unwrap(), b"new");
        // Current now (written here): the next push deletes nothing.
        io.deletes.lock().unwrap().clear();
        push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:01:00.000Z", &mac_origin(), None, None).unwrap();
        assert!(io.deletes.lock().unwrap().is_empty(), "a current copy was deleted: {:?}", io.deletes.lock().unwrap());
        // Contested: both representations go, the file first, then the item.
        fs::write(placeholder_path(&sub, "US-CA-001.txt"), b"bplist-stub").unwrap();
        push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:02:00.000Z", &mac_origin(), None, None).unwrap();
        assert_eq!(*io.deletes.lock().unwrap(), vec![path.clone(), path.clone()]);
        assert!(!twin_at(&sub, "US-CA-001.txt"));
        assert_eq!(fs::read(&path).unwrap(), b"new");
        let _ = fs::remove_dir_all(&docs);
    }

    /// A name that cannot be freed refuses the write (bounded), never a twin.
    #[test]
    fn a_name_that_cannot_be_freed_refuses_the_write() {
        #[derive(Clone)]
        struct Stuck(FakeIo);
        impl ContainerIo for Stuck {
            fn flags(&self, p: &Path) -> UbiquityFlags { self.0.flags(p) }
            fn start_download(&self, p: &Path) { self.0.start_download(p) }
            fn read(&self, d: &Path, n: &str) -> Result<Option<String>, String> { self.0.read(d, n) }
            fn delete(&self, d: &Path, n: &str) -> Result<bool, String> {
                self.0.deletes.lock().unwrap().push(d.join(n));
                Ok(false)
            }
            fn create_dir(&self, p: &Path) -> Result<(), String> { self.0.create_dir(p) }
        }
        let (docs, sub, local) = writer_fixture("w-fake-stuck", b"new");
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let io = Stuck(FakeIo::new(Duration::ZERO));
        let r = push_item_with(&io, &docs, &local, &county("US-CA-001"), "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, None);
        assert_eq!(r.err().as_deref(), Some("unavailable"));
        assert_eq!(io.0.deletes.lock().unwrap().len(), CLEAR_WAY_ATTEMPTS);
        assert!(!sub.join("US-CA-001.txt").exists());
        assert!(!sub.join("US-CA-001.record.json").exists(), "the record was published without its file");
        assert_eq!(fs::read_dir(docs.join(".tmp")).unwrap().count(), 0, "a staged copy was left behind");
        let _ = fs::remove_dir_all(&docs);
    }

    /// The kind's directory: created through the coordinator on first write,
    /// never again once it exists, and never beside its own placeholder (the
    /// download of the directory is asked for instead, and the listing says
    /// it has not been read rather than reporting an empty kind).
    #[test]
    fn the_kind_directory_is_created_coordinated_and_never_beside_its_placeholder() {
        let docs = tmp_dir("w-fake-dir");
        let local = docs.join("local/barcharts/US-CA-001.txt");
        fs::create_dir_all(local.parent().unwrap()).unwrap();
        fs::write(&local, b"abc").unwrap();
        let io = FakeIo::new(Duration::ZERO);
        let item = county("US-CA-001");
        fs::write(docs.join(".barcharts.icloud"), b"bplist-stub").unwrap();
        let r = push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, None);
        assert_eq!(r.err().as_deref(), Some("unavailable"));
        assert!(io.dirs.lock().unwrap().is_empty());
        assert_eq!(*io.downloads.lock().unwrap(), vec![docs.join("barcharts")]);
        assert!(push_items_cleared_with(&io, &docs, vec!["US-CA-001".to_string()], "2026-09-29T12:00:00.000Z", &mac_origin()).is_err());
        assert!(!docs.join("barcharts").exists());
        let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &test_gate(LISTING_READ_BUDGET));
        assert!(listed.pending && listed.items.is_empty());
        // No placeholder: the listing is an honest empty, and the first write
        // creates the directory through the coordinator, once.
        fs::remove_file(docs.join(".barcharts.icloud")).unwrap();
        let listed = list_items_with(&docs, ItemKind::Barchart, MAX_LISTED_ITEMS, &io, &test_gate(LISTING_READ_BUDGET));
        assert!(!listed.pending && listed.items.is_empty());
        push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, None).unwrap();
        push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:01:00.000Z", &mac_origin(), None, None).unwrap();
        assert_eq!(*io.dirs.lock().unwrap(), vec![docs.join("barcharts")]);
        // The county writer never creates a missing parent on its own.
        fs::remove_dir_all(docs.join("barcharts")).unwrap();
        assert_eq!(county_container_write(&io, &docs, "barcharts/US-CA-001.txt", &"a".repeat(32), b"x").err().as_deref(), Some("unavailable"));
        assert!(!docs.join("barcharts").exists());
        let _ = fs::remove_dir_all(&docs);
    }

    /// The repair mode writes the county FILE only, over whatever holds the
    /// name, and only when the local bytes are the ones the record names; the
    /// record in iCloud is never rewritten (it may already be another device's
    /// newer marker), and a digest that does not match writes nothing.
    #[test]
    fn a_repair_writes_only_the_file_and_only_for_the_digest_the_record_names() {
        let (docs, sub, local) = writer_fixture("w-fake-repair", b"Sample Size:\t2.0\n");
        let io = FakeIo::new(Duration::ZERO);
        let item = county("US-CA-001");
        let sha = sha256_hex(b"Sample Size:\t2.0\n");
        // This device's own record, naming these bytes, and the first
        // device's old file held here only as a placeholder.
        let ours = COUNTY_RECORD_GOLDEN.replace(GOLDEN_SHA, &sha);
        fs::write(sub.join("US-CA-001.record.json"), &ours).unwrap();
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let wrong = push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, Some(&"0".repeat(64))).unwrap();
        assert!(wrong.skipped);
        assert!(io.deletes.lock().unwrap().is_empty());
        assert!(!sub.join("US-CA-001.txt").exists());
        let r = push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, Some(&sha)).unwrap();
        assert!(!r.skipped);
        assert_eq!(fs::read(sub.join("US-CA-001.txt")).unwrap(), b"Sample Size:\t2.0\n");
        assert!(!r.superseded);
        assert!(!is_regular_file(&placeholder_path(&sub, "US-CA-001.txt")));
        assert_eq!(fs::read_to_string(sub.join("US-CA-001.record.json")).unwrap(), ours);
        assert!(valid_sha256(&sha));
        for bad in ["", "A".repeat(64).as_str(), &"0".repeat(63), &"0".repeat(65), &format!("{}\n", &"0".repeat(63)), &"g".repeat(64)] {
            assert!(!valid_sha256(bad), "{:?}", bad);
        }
        let _ = fs::remove_dir_all(&docs);
    }

    /// A marker over a record held only as a placeholder, and over a county
    /// file held both ways: every representation of the file goes, and the
    /// marker takes a free name.
    #[test]
    fn a_marker_frees_both_names_before_it_lands() {
        let (docs, sub, _local) = writer_fixture("w-fake-marker", b"x");
        let io = FakeIo::new(Duration::ZERO);
        fs::write(sub.join(".US-CA-001.record.json.icloud"), b"bplist-stub").unwrap();
        fs::write(sub.join("US-CA-001.txt"), b"mine").unwrap();
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let r = push_items_cleared_with(&io, &docs, vec!["US-CA-001".to_string()], "2026-09-21T08:00:00.000Z", &phone_origin()).unwrap();
        assert!(r.failed.is_empty());
        assert!(!item_present(&sub, "US-CA-001.txt"));
        assert!(!is_regular_file(&placeholder_path(&sub, "US-CA-001.record.json")));
        assert_eq!(record_text_at(&sub.join("US-CA-001.record.json")).unwrap().as_deref(), Some(COUNTY_CLEARED_GOLDEN));
        let _ = fs::remove_dir_all(&docs);
    }

    /// Follow-up 2 (security report L4): the peer writes its file first and
    /// its record second, so its NEWER file can reach this device while the
    /// listing still reads this device's own record. The repair re-reads the
    /// record immediately before it touches anything: a record iCloud reports
    /// out of date (the peer's is on its way), or one that now names another
    /// device or other bytes, and the repair writes nothing and deletes
    /// nothing (`superseded`), so the normal pull takes the peer's version.
    #[test]
    fn a_repair_never_touches_a_county_whose_record_no_longer_names_this_copy() {
        let bytes = b"Sample Size:\t2.0\n";
        let sha = sha256_hex(bytes);
        let ours = COUNTY_RECORD_GOLDEN.replace(GOLDEN_SHA, &sha);
        let theirs = COUNTY_RECORD_GOLDEN.replace(GOLDEN_SHA, &"c".repeat(64)).replace(&"a".repeat(32), &"f".repeat(32));
        let item = county("US-CA-001");
        // (a) The race itself: the peer's newer file is here (a placeholder),
        // its record is known to be newer (ours reads out of date).
        let (docs, sub, local) = writer_fixture("w-race-file-first", bytes);
        let rec = sub.join("US-CA-001.record.json");
        fs::write(&rec, &ours).unwrap();
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let io = FakeIo::new(Duration::ZERO);
        io.set(rec.clone(), FakeStatus::Stale, Some(&theirs), true);
        let r = push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, Some(&sha)).unwrap();
        assert!(r.superseded && !r.skipped);
        assert!(io.deletes.lock().unwrap().is_empty(), "the peer's newer file was deleted");
        assert!(is_regular_file(&placeholder_path(&sub, "US-CA-001.txt")));
        assert!(!sub.join("US-CA-001.txt").exists());
        let _ = fs::remove_dir_all(&docs);
        // (b) The peer's record already here and current; (c) a peer's marker;
        // (d) our record naming other bytes; (e) unreadable text.
        let other_sha = COUNTY_RECORD_GOLDEN.replace(GOLDEN_SHA, &"d".repeat(64));
        for (tag, text) in [("w-race-b", theirs.as_str()), ("w-race-c", COUNTY_CLEARED_GOLDEN), ("w-race-d", other_sha.as_str()), ("w-race-e", "{")] {
            let (docs, sub, local) = writer_fixture(tag, bytes);
            fs::write(sub.join("US-CA-001.record.json"), text).unwrap();
            fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
            let io = FakeIo::new(Duration::ZERO);
            let r = push_item_with(&io, &docs, &local, &item, "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, Some(&sha)).unwrap();
            assert!(r.superseded, "{}", tag);
            assert!(io.deletes.lock().unwrap().is_empty(), "{}", tag);
            assert!(!sub.join("US-CA-001.txt").exists(), "{}", tag);
            let _ = fs::remove_dir_all(&docs);
        }
    }

    /// The re-read's second half: a record that goes out of date DURING the
    /// read (the peer's arrived meanwhile) is not taken as this copy either.
    #[test]
    fn a_record_that_goes_out_of_date_during_the_re_read_supersedes_the_repair() {
        #[derive(Clone)]
        struct FlipOnRead(FakeIo);
        impl ContainerIo for FlipOnRead {
            fn flags(&self, p: &Path) -> UbiquityFlags { self.0.flags(p) }
            fn start_download(&self, p: &Path) { self.0.start_download(p) }
            fn read(&self, d: &Path, n: &str) -> Result<Option<String>, String> {
                let text = read_record_text(d, n);
                self.0.set(d.join(n), FakeStatus::Stale, None, false);
                text
            }
            fn delete(&self, d: &Path, n: &str) -> Result<bool, String> { self.0.delete(d, n) }
            fn create_dir(&self, p: &Path) -> Result<(), String> { self.0.create_dir(p) }
        }
        let bytes = b"Sample Size:\t2.0\n";
        let sha = sha256_hex(bytes);
        let (docs, sub, local) = writer_fixture("w-race-flip", bytes);
        fs::write(sub.join("US-CA-001.record.json"), COUNTY_RECORD_GOLDEN.replace(GOLDEN_SHA, &sha)).unwrap();
        fs::write(sub.join(".US-CA-001.txt.icloud"), b"bplist-stub").unwrap();
        let io = FlipOnRead(FakeIo::new(Duration::ZERO));
        let r = push_item_with(&io, &docs, &local, &county("US-CA-001"), "e.txt", "2026-09-29T12:00:00.000Z", &mac_origin(), None, Some(&sha)).unwrap();
        assert!(r.superseded);
        assert!(io.0.deletes.lock().unwrap().is_empty());
        let _ = fs::remove_dir_all(&docs);
    }

    /// Follow-up 3 (security report L5): Remove takes a kind's directory, and
    /// a duplicate of it, that this device holds only as iCloud's placeholder,
    /// through the coordinated delete of its logical URL; the other kind's is
    /// left alone.
    #[test]
    fn remove_takes_a_kind_directory_held_only_as_a_placeholder() {
        let docs = tmp_dir("w-remove-placeholder-dir");
        for name in [".barcharts.icloud", ".barcharts 2.icloud", ".day-obs.icloud", ".barcharts2.icloud"] {
            fs::write(docs.join(name), b"bplist-stub").unwrap();
        }
        let io = FakeIo::new(Duration::ZERO);
        let removed = remove_items_in_with(&io, &docs, ItemKind::Barchart).unwrap();
        assert_eq!(removed, 2);
        assert_eq!(*io.deletes.lock().unwrap(), vec![docs.join("barcharts"), docs.join("barcharts 2")]);
        assert!(!docs.join(".barcharts.icloud").exists() && !docs.join(".barcharts 2.icloud").exists());
        assert!(docs.join(".day-obs.icloud").exists() && docs.join(".barcharts2.icloud").exists());
        let _ = fs::remove_dir_all(&docs);
    }

    /// ...and when the placeholder cannot be deleted (here: a temporary
    /// directory, where Foundation cannot delete a planted placeholder through
    /// its logical URL), Remove reports the fixed `unavailable`, never success.
    #[test]
    fn remove_that_cannot_take_a_placeholder_directory_reports_unavailable() {
        for name in [".barcharts.icloud", ".barcharts 2.icloud"] {
            let docs = tmp_dir("w-remove-placeholder-refused");
            fs::write(docs.join(name), b"bplist-stub").unwrap();
            assert_eq!(remove_items_in(&docs, ItemKind::Barchart).err().as_deref(), Some("unavailable"), "{}", name);
            assert!(docs.join(name).exists());
            let _ = fs::remove_dir_all(&docs);
        }
    }

    /// The still-there check, on its own: a delete that REPORTS success but
    /// leaves the placeholder (iCloud answered, the item did not go) is the
    /// fixed `unavailable`, never a success over copies left in iCloud. The
    /// temporary-directory row above cannot show this, because there the
    /// delete itself fails first.
    #[test]
    fn remove_whose_delete_reports_success_but_leaves_the_placeholder_is_unavailable() {
        #[derive(Clone)]
        struct ClaimsGone(FakeIo);
        impl ContainerIo for ClaimsGone {
            fn flags(&self, p: &Path) -> UbiquityFlags { self.0.flags(p) }
            fn start_download(&self, p: &Path) { self.0.start_download(p) }
            fn read(&self, d: &Path, n: &str) -> Result<Option<String>, String> { self.0.read(d, n) }
            fn delete(&self, d: &Path, n: &str) -> Result<bool, String> {
                self.0.deletes.lock().unwrap().push(d.join(n));
                Ok(true)
            }
            fn create_dir(&self, p: &Path) -> Result<(), String> { self.0.create_dir(p) }
        }
        for name in [".barcharts.icloud", ".barcharts 2.icloud"] {
            let docs = tmp_dir("w-remove-claims-gone");
            fs::write(docs.join(name), b"bplist-stub").unwrap();
            let io = ClaimsGone(FakeIo::new(Duration::ZERO));
            assert_eq!(remove_items_in_with(&io, &docs, ItemKind::Barchart).err().as_deref(), Some("unavailable"), "{}", name);
            assert_eq!(io.0.deletes.lock().unwrap().len(), 1, "{}", name);
            assert!(docs.join(name).exists());
            let _ = fs::remove_dir_all(&docs);
        }
    }

    /// The twin and duplicate-directory predicates accept only iCloud's own
    /// set-aside shapes of a valid id, never a path, never a near miss.
    #[test]
    fn twin_and_duplicate_names_are_exact() {
        let yes = [
            ("US-CA-001 2.txt", "US-CA-001 2.txt"),
            ("US-CA-001 12.record.json", "US-CA-001 12.record.json"),
            ("US-CA-001.record 3.json", "US-CA-001.record 3.json"),
            (".US-CA-001 2.txt.icloud", "US-CA-001 2.txt"),
        ];
        for (name, logical) in yes {
            assert_eq!(twin_name(name, ItemKind::Barchart).as_deref(), Some(logical), "{:?}", name);
        }
        for name in [
            "US-CA-001.txt", "US-CA-001.record.json", "US-CA-001 2.json", "US-CA-001 12345.txt", "US-CA-001  2.txt",
            "US-CA-001 2.txt\n", "US-CA-001 2.txt.icloud", "us-ca-001 2.txt", "US-CA-0012 2.txt", "US-CA-001 ٢.txt",
            "US-CA-001 2.txt/x", "notes 2.txt", "US-CA-001 2", ".US-CA-001 2.txt",
        ] {
            assert_eq!(twin_name(name, ItemKind::Barchart), None, "{:?}", name);
        }
        let dev = "f".repeat(32);
        assert_eq!(twin_name(&format!("{} 2.json", dev), ItemKind::DayObs), Some(format!("{} 2.json", dev)));
        assert_eq!(twin_name(&format!("{} 2.txt", dev), ItemKind::DayObs), None);
        assert!(is_duplicate_subdir("barcharts 2", ItemKind::Barchart));
        assert!(is_duplicate_subdir("day-obs 13", ItemKind::DayObs));
        for name in ["barcharts", "barcharts2", "barcharts 2x", "barcharts  2", "barcharts 12345", "barcharts 2/..", "day-obs 2"] {
            assert!(!is_duplicate_subdir(name, ItemKind::Barchart), "{:?}", name);
        }
    }
}
