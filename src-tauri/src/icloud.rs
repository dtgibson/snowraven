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
//! - Change detection: an NSMetadataQuery over the two tiny record files
//!   (`*.record.json`), started on the main thread when sync is enabled and
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
//! `symlink_metadata` and refuses anything that is not a regular file (a
//! symlink is deleted as a link, never followed), a read is bounded by the
//! on-disk length BEFORE the bytes are loaded, the record's string fields are
//! sanitized to the validator's exact bounds at the write chokepoint so a
//! self-authored record always validates on every device, and the device id
//! that names a staging file is validated at the command boundary.
//!
//! The two csv filenames and the container id below are pinned to the
//! frontend constants by `frontend/src/lib/icloudPaths.parity.test.ts`.

use std::cell::RefCell;
use std::fs;
use std::path::{Path, PathBuf};
use std::ptr::NonNull;
use std::sync::{mpsc, Mutex, OnceLock};
use std::time::Duration;

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

/// The shared record as written to `<slot>.record.json` (schema.md, "Shared
/// record format"). Field set and names are the contract the frontend
/// validator (`icloudRecord.ts`) reads; unknown keys are ignored there, so
/// this struct may only GROW.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
struct RecordFile<'a> {
    version: u8,
    slot: &'a str,
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

/// Write `bytes` to a temp file beside the target inside the container, then
/// coordinated-rename it onto `target` (atomic on the same volume). The temp
/// name carries the device id so two devices staging the same slot never
/// share a temp file.
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
    let tmp = tmp_dir.join(format!("{}-{}", device_id, target_name));
    fs::write(&tmp, bytes).map_err(|_| "unavailable".to_string())?;
    let target = docs.join(target_name);
    let url = file_url(&target);
    let result = coordinated_write(&url, NSFileCoordinatorWritingOptions::ForReplacing, |dst| {
        fs::rename(&tmp, dst).map_err(|_| "unavailable".to_string())
    });
    if result.is_err() {
        let _ = fs::remove_file(&tmp);
    }
    result
}

/// Coordinated delete of a container item (the logical URL: NSFileManager
/// handles a not-yet-downloaded placeholder correctly, which fs::remove_file
/// would not). Absent items are not an error.
fn coordinated_delete(docs: &Path, name: &str) -> Result<bool, String> {
    let target = docs.join(name);
    // A symlink planted at the item's name is removed as a LINK (never
    // followed); a directory is refused outright.
    if let Ok(meta) = fs::symlink_metadata(&target) {
        if meta.file_type().is_symlink() {
            fs::remove_file(&target).map_err(|_| "unavailable".to_string())?;
            return Ok(true);
        }
        if meta.file_type().is_dir() {
            return Err("unavailable".to_string());
        }
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

#[tauri::command]
pub async fn icloud_read_record(slot: Slot) -> Result<RecordRead, String> {
    blocking(move || {
        let docs = container_documents().ok_or_else(|| "unavailable".to_string())?;
        let name = slot.record_name();
        let record = if item_present(&docs, &name) {
            let url = file_url(&docs.join(&name));
            // A coordinated read of an undownloaded record downloads it first
            // (the record is a few hundred bytes); offline that wait is what
            // the command timeout bounds.
            coordinated_read(&url, |p| {
                // Not a regular file (a symlink, a directory) -> never opened.
                // A record is a few hundred bytes; anything past the
                // validator's 4 KB text bound is not a record, and is not
                // read into memory either (it would be rejected anyway).
                match fs::symlink_metadata(p) {
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => return Ok(None),
                    Err(_) => return Err("unavailable".to_string()),
                    Ok(meta) => {
                        if !meta.file_type().is_file() {
                            return Err("unavailable".to_string());
                        }
                        if meta.len() > MAX_RECORD_BYTES {
                            return Ok(Some(String::new()));
                        }
                    }
                }
                match fs::read_to_string(p) {
                    Ok(s) => Ok(Some(s)),
                    Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
                    Err(_) => Err("unavailable".to_string()),
                }
            })?
        } else {
            None
        };
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
    // Only the two tiny record files: a peer's csv landing is not interesting
    // until its record does, and the record is the commit point.
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
}
