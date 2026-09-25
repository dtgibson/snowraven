//! iOS home-screen widgets (ios-lifer-widgets): the app side of the App Group
//! hand-over, and the hook that receives a widget's `snowraven://` tap.
//!
//! Compiled for iOS, and for the host's `cargo test` so the pure validator
//! below is exercised on every run (lib.rs: `cfg(any(target_os = "ios",
//! test))`). Everything that touches Foundation, the App Group container or
//! Tauri is additionally `cfg(target_os = "ios")`, so the Mac, Windows and
//! Linux binaries never contain it (FR-32: no hand-over on the Mac, and App
//! Groups there are a different, team-prefixed thing this feature does not
//! implement).
//!
//! Design (pipeline/ios-lifer-widgets/schema.md sections 1 to 4):
//! - JS builds the hand-over document, this module WRITES it. The body is
//!   bounded before it is parsed, parsed into a `deny_unknown_fields` struct,
//!   checked against the same bounds the TypeScript builder and the Swift
//!   reader enforce, and only then written: temp file beside the target, then
//!   `rename` onto `widgets/handover.json` (atomic on APFS), so the widget
//!   extension never reads a torn document. A symlink or a directory planted at
//!   the fixed name is removed as such and never followed
//!   (.claude/rules/security.md, the v1.0.11 / v1.0.13 file-type rule).
//! - After a successful write the app asks WidgetKit to reload every timeline
//!   through `snowraven_reload_widgets`, a one-function Swift shim in the APP
//!   target (`gen/apple/Sources/snowraven/WidgetReload.swift`), because
//!   `WidgetCenter` has no Objective-C surface objc2 could reach. A failed
//!   write reloads nothing: one write, one reload.
//! - The eBird key crosses the IPC boundary inside the JSON, exactly as it
//!   already does for `icloud_write_keys`. The struct that carries it derives
//!   no `Debug`, and no `format!`, log line or error string in this file
//!   contains the body (pinned by `widgetPaths.parity.test.ts`). Errors are
//!   short stable strings.
//! - The deep-link hook is a plugin `on_event` on `RunEvent::Opened`. It keeps
//!   only the LAST URL whose scheme is `snowraven` and whose length is at most
//!   `LINK_MAX_BYTES`, parks it for `widgets_take_pending_link`, and emits
//!   `snowraven-link` to the main window. Every other URL is dropped without
//!   emitting anything. The URL is NOT parsed here beyond its scheme: the
//!   allowlist lives in `frontend/src/lib/links/deepLink.ts`, which accepts
//!   exactly fifteen byte strings. This hook never replaces Tauri's own run
//!   callback, so `RunEvent::SceneRequested` still reaches the no-op callback
//!   `Builder::run` installs, and the single-webview invariant is untouched.
//!
//! The App Group id, directory and file names, and every bound below are
//! pinned to the TypeScript and Swift sides by
//! `frontend/src/lib/widgetPaths.parity.test.ts`.

// On the host test build only the pure validator is exercised; the names the
// iOS-only half uses are otherwise unused there.
#![cfg_attr(not(target_os = "ios"), allow(dead_code))]

use serde::Deserialize;

/// The App Group both the app and the widget extension are entitled to.
pub const APP_GROUP_ID: &str = "group.com.dtgibson.snowraven";
/// The subdirectory of the App Group container this feature owns.
pub const WIDGETS_DIR: &str = "widgets";
/// The hand-over document the app writes whole and the extension reads.
pub const HANDOVER_FILE: &str = "handover.json";
/// The whole serialized document, checked BEFORE it is parsed.
pub const HANDOVER_MAX_BYTES: usize = 4_000_000;
/// The only document version this build writes.
pub const HANDOVER_VERSION: u32 = 1;
/// Per-set entry bound (recorded and each of the three target sets).
pub const MAX_SET_ENTRIES: usize = 20_000;
/// Per-name bound, in UTF-16 code units (the unit the validator measures on
/// all three sides).
pub const MAX_NAME_UNITS: usize = 200;
/// The eBird key bound. The class is `[A-Za-z0-9]`, which cannot express a
/// header separator, so the widget's request header cannot be steered.
pub const MAX_KEY_LEN: usize = 128;
/// `appVersion` bound; display-only in the extension.
pub const MAX_APP_VERSION_LEN: usize = 32;
/// The widget deep-link scheme, and the most the hook will park.
pub const LINK_SCHEME: &str = "snowraven";
pub const LINK_MAX_BYTES: usize = 512;
/// The event the hook emits to the main window.
pub const LINK_EVENT: &str = "snowraven-link";

/// The hand-over document, version 1 (schema.md section 1.2). NO `Debug`
/// derive: this struct carries the user's eBird key.
#[derive(Deserialize)]
#[serde(deny_unknown_fields, rename_all = "camelCase")]
struct HandoverDoc {
    version: u32,
    written_at: String,
    app_version: String,
    ebird_key: Option<String>,
    has_ebird_backup: bool,
    recorded: Vec<String>,
    has_ml_export: bool,
    targets_missing_photo: Vec<String>,
    targets_missing_audio: Vec<String>,
    targets_missing_video: Vec<String>,
    default_location: Option<DefaultLocation>,
}

#[derive(Deserialize)]
#[serde(deny_unknown_fields)]
struct DefaultLocation {
    lat: f64,
    lng: f64,
}

/// JavaScript's `String.prototype.trim` set, spelled out (WhiteSpace plus
/// LineTerminator, ECMA-262). Deliberately NOT `char::is_whitespace`, which
/// differs from it on U+0085 and U+FEFF: the names this validator reads were
/// trimmed by JS, so the set a name may not start or end with is JS's set, and
/// the Swift reader spells the identical list.
fn is_js_trim_space(c: char) -> bool {
    matches!(
        c,
        '\u{0009}' | '\u{000A}' | '\u{000B}' | '\u{000C}' | '\u{000D}' | '\u{0020}' | '\u{00A0}'
            | '\u{1680}' | '\u{2000}'..='\u{200A}' | '\u{2028}' | '\u{2029}' | '\u{202F}'
            | '\u{205F}' | '\u{3000}' | '\u{FEFF}'
    )
}

/// One folded species name: 1 to 200 UTF-16 code units, no C0 control
/// character or DEL anywhere, no JS-trim whitespace at either end.
fn valid_name(s: &str) -> bool {
    let units = s.encode_utf16().count();
    if units == 0 || units > MAX_NAME_UNITS {
        return false;
    }
    if s.chars().any(|c| (c as u32) <= 0x1F || c == '\u{007F}') {
        return false;
    }
    let first = s.chars().next();
    let last = s.chars().next_back();
    !(first.is_some_and(is_js_trim_space) || last.is_some_and(is_js_trim_space))
}

fn valid_set(v: &[String]) -> bool {
    v.len() <= MAX_SET_ENTRIES && v.iter().all(|s| valid_name(s))
}

/// `^[A-Za-z0-9]{1,128}$`, byte-wise.
fn valid_key(k: &str) -> bool {
    !k.is_empty() && k.len() <= MAX_KEY_LEN && k.bytes().all(|b| b.is_ascii_alphanumeric())
}

/// `^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}Z$`, byte-wise.
fn valid_written_at(t: &str) -> bool {
    let b = t.as_bytes();
    if b.len() != 20 {
        return false;
    }
    b.iter().enumerate().all(|(i, &c)| match i {
        4 | 7 => c == b'-',
        10 => c == b'T',
        13 | 16 => c == b':',
        19 => c == b'Z',
        _ => c.is_ascii_digit(),
    })
}

/// `^[0-9A-Za-z.+-]{1,32}$`, byte-wise.
fn valid_app_version(v: &str) -> bool {
    !v.is_empty()
        && v.len() <= MAX_APP_VERSION_LEN
        && v.bytes().all(|b| b.is_ascii_alphanumeric() || b == b'.' || b == b'+' || b == b'-')
}

impl HandoverDoc {
    fn is_valid(&self) -> bool {
        if self.version != HANDOVER_VERSION {
            return false;
        }
        if !valid_written_at(&self.written_at) || !valid_app_version(&self.app_version) {
            return false;
        }
        if let Some(k) = &self.ebird_key {
            if !valid_key(k) {
                return false;
            }
        }
        if !valid_set(&self.recorded)
            || !valid_set(&self.targets_missing_photo)
            || !valid_set(&self.targets_missing_audio)
            || !valid_set(&self.targets_missing_video)
        {
            return false;
        }
        // The presence flags and the sets agree: no backup means no recorded
        // set, no export means no target sets. The TypeScript builder writes
        // exactly this and the Swift reader refuses anything else.
        if !self.has_ebird_backup && !self.recorded.is_empty() {
            return false;
        }
        if !self.has_ml_export
            && (!self.targets_missing_photo.is_empty()
                || !self.targets_missing_audio.is_empty()
                || !self.targets_missing_video.is_empty())
        {
            return false;
        }
        if let Some(loc) = &self.default_location {
            let ok_lat = loc.lat.is_finite() && (-90.0..=90.0).contains(&loc.lat);
            let ok_lng = loc.lng.is_finite() && (-180.0..=180.0).contains(&loc.lng);
            if !ok_lat || !ok_lng {
                return false;
            }
        }
        true
    }
}

/// The whole write-side check, pure so the host test suite exercises it:
/// the byte bound FIRST (so nothing larger is ever parsed), then the strict
/// parse, then the field bounds. Errors are stable strings that never carry
/// the body.
fn validate_handover(document: &str) -> Result<(), &'static str> {
    if document.len() > HANDOVER_MAX_BYTES {
        return Err("too-large");
    }
    let doc: HandoverDoc = serde_json::from_str(document).map_err(|_| "invalid")?;
    if !doc.is_valid() {
        return Err("invalid");
    }
    Ok(())
}

/// The hook's filter: `snowraven` scheme, at most `LINK_MAX_BYTES`. Pure over
/// strings so the host tests exercise it without a `url::Url`.
fn qualifies_as_link(scheme: &str, serialized: &str) -> bool {
    scheme == LINK_SCHEME && serialized.len() <= LINK_MAX_BYTES
}

// ── iOS only: the container, the two commands and the hook ─────────────────

#[cfg(target_os = "ios")]
use std::path::{Path, PathBuf};
#[cfg(target_os = "ios")]
use std::sync::{Mutex, OnceLock};

#[cfg(target_os = "ios")]
extern "C" {
    /// `@_cdecl("snowraven_reload_widgets")` in
    /// `gen/apple/Sources/snowraven/WidgetReload.swift` (the APP target).
    /// Resolved when Xcode links `libapp.a` into the app; build.rs lets the
    /// iOS cdylib leave it undefined.
    fn snowraven_reload_widgets();
}

#[cfg(target_os = "ios")]
static CONTAINER: OnceLock<PathBuf> = OnceLock::new();

/// `<App Group container>/widgets`, resolved once. `Err("no-app-group")` when
/// the build carries no App Group entitlement (a nil container URL is not
/// cached, so a later build that has it resolves normally).
#[cfg(target_os = "ios")]
fn widgets_dir() -> Result<PathBuf, &'static str> {
    use objc2_foundation::{NSFileManager, NSString};
    if let Some(p) = CONTAINER.get() {
        return Ok(p.join(WIDGETS_DIR));
    }
    let fm = NSFileManager::defaultManager();
    let id = NSString::from_str(APP_GROUP_ID);
    let url = fm
        .containerURLForSecurityApplicationGroupIdentifier(&id)
        .ok_or("no-app-group")?;
    let path = url.path().ok_or("no-app-group")?;
    let root = PathBuf::from(path.to_string());
    let _ = CONTAINER.set(root.clone());
    Ok(root.join(WIDGETS_DIR))
}

/// A symlink or a directory at a fixed name is removed as such and never
/// followed; a regular file is left for the rename to replace.
#[cfg(target_os = "ios")]
fn clear_planted(target: &Path) -> Result<(), &'static str> {
    if let Ok(meta) = std::fs::symlink_metadata(target) {
        let ft = meta.file_type();
        if ft.is_symlink() {
            std::fs::remove_file(target).map_err(|_| "unavailable")?;
        } else if ft.is_dir() {
            std::fs::remove_dir_all(target).map_err(|_| "unavailable")?;
        }
    }
    Ok(())
}

/// `widgets/` itself is a real directory, never a followed link (security
/// review I1): anything else planted there (a symlink or a file) is removed as
/// such, so the fixed names below always resolve inside the App Group.
fn unplant_dir(dir: &std::path::Path) -> Result<(), &'static str> {
    match std::fs::symlink_metadata(dir) {
        Ok(meta) if !meta.is_dir() => std::fs::remove_file(dir).map_err(|_| "unavailable"),
        _ => Ok(()),
    }
}

/// Remove the file at a fixed name as whatever it is (a symlink as the link,
/// never its target; a directory whole). An absent file is already removed.
fn remove_fixed(target: &std::path::Path) -> Result<(), &'static str> {
    match std::fs::symlink_metadata(target) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(_) => Err("unavailable"),
        Ok(meta) if meta.is_dir() => std::fs::remove_dir_all(target).map_err(|_| "unavailable"),
        Ok(_) => std::fs::remove_file(target).map_err(|_| "unavailable"),
    }
}

/// Temp file beside the target, then `rename` onto it (atomic on APFS).
#[cfg(target_os = "ios")]
fn write_atomic(dir: &Path, bytes: &[u8]) -> Result<(), &'static str> {
    unplant_dir(dir)?;
    std::fs::create_dir_all(dir).map_err(|_| "unavailable")?;
    let target = dir.join(HANDOVER_FILE);
    let tmp = dir.join(format!("{}.tmp-{}", HANDOVER_FILE, std::process::id()));
    clear_planted(&tmp)?;
    std::fs::write(&tmp, bytes).map_err(|_| "unavailable")?;
    let done = clear_planted(&target)
        .and_then(|_| std::fs::rename(&tmp, &target).map_err(|_| "unavailable"));
    if done.is_err() {
        let _ = std::fs::remove_file(&tmp);
    }
    done
}

/// Validate, write whole, then reload every widget timeline.
#[cfg(target_os = "ios")]
#[tauri::command]
pub fn widgets_write_handover(document: String) -> Result<(), String> {
    validate_handover(&document).map_err(str::to_string)?;
    let dir = widgets_dir().map_err(str::to_string)?;
    write_atomic(&dir, document.as_bytes()).map_err(str::to_string)?;
    // SAFETY: a no-argument C function defined by the Swift shim; it only
    // calls WidgetCenter.shared.reloadAllTimelines().
    unsafe { snowraven_reload_widgets() };
    Ok(())
}

/// Remove the hand-over, then reload every widget timeline (security review
/// M1). The controller calls this only when a key or a file was removed or
/// replaced and even the no-key document could not be written; the widget
/// then reads no document and shows S1. `Err` means the file is still there,
/// and the controller keeps the revocation pending rather than drop it.
#[cfg(target_os = "ios")]
#[tauri::command]
pub fn widgets_remove_handover() -> Result<(), String> {
    let dir = widgets_dir().map_err(str::to_string)?;
    unplant_dir(&dir).map_err(str::to_string)?;
    remove_fixed(&dir.join(HANDOVER_FILE)).map_err(str::to_string)?;
    // SAFETY: as in `widgets_write_handover`.
    unsafe { snowraven_reload_widgets() };
    Ok(())
}

/// The last qualifying URL the hook received and nobody has taken yet.
#[cfg(target_os = "ios")]
pub struct PendingLink(Mutex<Option<String>>);

/// Take (return and clear) the parked URL. The controller calls this on
/// start, which is what delivers a COLD-start tap, and again on every
/// `snowraven-link` event, so the parked slot is the single source and a URL
/// is applied once however the two paths interleave.
#[cfg(target_os = "ios")]
#[tauri::command]
pub fn widgets_take_pending_link(state: tauri::State<'_, PendingLink>) -> Option<String> {
    state.0.lock().ok().and_then(|mut g| g.take())
}

/// The deep-link hook (schema.md section 4.3): a plugin `on_event`, so Tauri's
/// own run callback, and with it the single-webview keeper, is untouched.
#[cfg(target_os = "ios")]
pub fn plugin<R: tauri::Runtime>() -> tauri::plugin::TauriPlugin<R> {
    use tauri::{Emitter, Manager, RunEvent};
    tauri::plugin::Builder::new("snowraven-links")
        .setup(|app, _api| {
            app.manage(PendingLink(Mutex::new(None)));
            Ok(())
        })
        .on_event(|app, event| {
            if let RunEvent::Opened { urls } = event {
                let last = urls
                    .iter()
                    .filter(|u| qualifies_as_link(u.scheme(), u.as_str()))
                    .next_back()
                    .map(|u| u.as_str().to_string());
                if let Some(url) = last {
                    if let Some(state) = app.try_state::<PendingLink>() {
                        if let Ok(mut g) = state.0.lock() {
                            *g = Some(url);
                        }
                    }
                    // A poke, not the payload the JS applies: the controller
                    // answers it by taking the parked URL.
                    let _ = app.emit_to("main", LINK_EVENT, ());
                }
            }
        })
        .build()
}

#[cfg(test)]
mod tests {
    use super::*;

    fn doc(overrides: &[(&str, serde_json::Value)]) -> String {
        let mut v = serde_json::json!({
            "version": 1,
            "writtenAt": "2026-09-23T18:04:11Z",
            "appVersion": "1.0.36",
            "ebirdKey": "abc123DEF456",
            "hasEbirdBackup": true,
            "recorded": ["mallard", "northern shrike"],
            "hasMlExport": true,
            "targetsMissingPhoto": ["mallard"],
            "targetsMissingAudio": [],
            "targetsMissingVideo": ["northern shrike"],
            "defaultLocation": { "lat": 37.5, "lng": -122.25 }
        });
        for (k, val) in overrides {
            v[*k] = val.clone();
        }
        v.to_string()
    }

    #[test]
    fn a_well_formed_document_passes() {
        assert_eq!(validate_handover(&doc(&[])), Ok(()));
        // null key, no default location, no export and no backup are all legal.
        assert_eq!(
            validate_handover(&doc(&[
                ("ebirdKey", serde_json::Value::Null),
                ("defaultLocation", serde_json::Value::Null),
                ("hasMlExport", false.into()),
                ("targetsMissingPhoto", serde_json::json!([])),
                ("targetsMissingVideo", serde_json::json!([])),
                ("hasEbirdBackup", false.into()),
                ("recorded", serde_json::json!([])),
            ])),
            Ok(())
        );
    }

    #[test]
    fn the_byte_bound_is_checked_before_the_parse() {
        // Over the bound by one byte, and not even JSON: the answer must be
        // too-large, which proves the bound runs first.
        let body = "x".repeat(HANDOVER_MAX_BYTES + 1);
        assert_eq!(validate_handover(&body), Err("too-large"));
        assert_eq!(validate_handover("x"), Err("invalid"));
    }

    #[test]
    fn unknown_fields_and_wrong_versions_are_refused() {
        let mut v: serde_json::Value = serde_json::from_str(&doc(&[])).unwrap();
        v["observations"] = serde_json::json!([]);
        assert_eq!(validate_handover(&v.to_string()), Err("invalid"));
        assert_eq!(validate_handover(&doc(&[("version", 2.into())])), Err("invalid"));
    }

    #[test]
    fn the_key_class_cannot_express_a_header_separator() {
        for bad in ["", "abc def", "abc\r\nX-Evil: 1", "abc:1", "é", &"a".repeat(129)] {
            assert_eq!(validate_handover(&doc(&[("ebirdKey", bad.into())])), Err("invalid"), "{:?}", bad.len());
        }
        assert_eq!(validate_handover(&doc(&[("ebirdKey", "a".repeat(128).into())])), Ok(()));
    }

    #[test]
    fn names_are_bounded_in_utf16_units_and_refuse_controls_and_edge_whitespace() {
        let at_bound = "a".repeat(MAX_NAME_UNITS);
        assert_eq!(validate_handover(&doc(&[("recorded", serde_json::json!([at_bound]))])), Ok(()));
        let over = "a".repeat(MAX_NAME_UNITS + 1);
        // 100 astral characters are 200 UTF-16 units (pass); 101 are 202 (fail).
        let astral_ok = "\u{1F426}".repeat(100);
        let astral_over = "\u{1F426}".repeat(101);
        assert_eq!(validate_handover(&doc(&[("recorded", serde_json::json!([astral_ok]))])), Ok(()));
        for bad in [
            over.as_str(), astral_over.as_str(), "", " mallard", "mallard ", "\u{FEFF}mallard",
            "mal\u{0000}lard", "mal\u{001F}lard", "mal\u{007F}lard", "mallard\u{3000}",
        ] {
            assert_eq!(
                validate_handover(&doc(&[("recorded", serde_json::json!([bad]))])),
                Err("invalid"),
                "{:?}",
                bad.encode_utf16().count()
            );
        }
        // U+0085 is NOT in JS's trim set, so a name ending in it is legal here
        // exactly as it is in the TypeScript builder and the Swift reader.
        assert_eq!(validate_handover(&doc(&[("recorded", serde_json::json!(["mallard\u{0085}"]))])), Ok(()));
    }

    #[test]
    fn the_set_size_bound_holds_on_every_set() {
        let many: Vec<String> = (0..=MAX_SET_ENTRIES).map(|i| format!("n{i}")).collect();
        for field in ["recorded", "targetsMissingPhoto", "targetsMissingAudio", "targetsMissingVideo"] {
            assert_eq!(validate_handover(&doc(&[(field, serde_json::json!(many))])), Err("invalid"), "{field}");
        }
    }

    #[test]
    fn presence_flags_agree_with_the_sets() {
        assert_eq!(validate_handover(&doc(&[("hasEbirdBackup", false.into())])), Err("invalid"));
        assert_eq!(validate_handover(&doc(&[("hasMlExport", false.into())])), Err("invalid"));
    }

    #[test]
    fn default_location_is_range_checked() {
        for (lat, lng) in [(90.5, 0.0), (-90.5, 0.0), (0.0, 180.5), (0.0, -180.5)] {
            assert_eq!(
                validate_handover(&doc(&[("defaultLocation", serde_json::json!({ "lat": lat, "lng": lng }))])),
                Err("invalid")
            );
        }
        assert_eq!(
            validate_handover(&doc(&[("defaultLocation", serde_json::json!({ "lat": 90.0, "lng": -180.0 }))])),
            Ok(())
        );
    }

    #[test]
    fn written_at_and_app_version_shapes() {
        for bad in ["2026-09-23 18:04:11Z", "2026-09-23T18:04:11", "2026-09-23T18:04:11.000Z", "٢٠٢٦-09-23T18:04:11Z"] {
            assert_eq!(validate_handover(&doc(&[("writtenAt", bad.into())])), Err("invalid"), "{bad}");
        }
        for bad in ["", "1.0.36 beta", &"1".repeat(33)] {
            assert_eq!(validate_handover(&doc(&[("appVersion", bad.into())])), Err("invalid"));
        }
    }

    #[test]
    fn the_error_strings_never_carry_the_body() {
        // A sentinel key through every refusal path: no error mentions it.
        let sentinel = "SENTINELKEY42";
        let bodies = [
            doc(&[("ebirdKey", sentinel.into()), ("version", 9.into())]),
            doc(&[("ebirdKey", sentinel.into()), ("hasEbirdBackup", false.into())]),
            format!("{{\"ebirdKey\":\"{sentinel}\""),
        ];
        for b in bodies {
            let err = validate_handover(&b).unwrap_err();
            assert!(!err.contains(sentinel));
            assert!(["too-large", "invalid"].contains(&err));
        }
    }

    #[test]
    fn the_link_filter_keeps_the_scheme_and_the_length_bound() {
        assert!(qualifies_as_link("snowraven", "snowraven://map/lifers?window=day"));
        assert!(!qualifies_as_link("https", "https://example.com"));
        assert!(!qualifies_as_link("SNOWRAVEN", "SNOWRAVEN://map"));
        let long = format!("snowraven://{}", "a".repeat(LINK_MAX_BYTES));
        assert!(!qualifies_as_link("snowraven", &long));
        let at = format!("snowraven://{}", "a".repeat(LINK_MAX_BYTES - "snowraven://".len()));
        assert!(qualifies_as_link("snowraven", &at));
    }

    /// A fresh scratch directory under the host's temp dir, removed on drop.
    struct Scratch(std::path::PathBuf);
    impl Scratch {
        fn new(tag: &str) -> Self {
            let p = std::env::temp_dir().join(format!("snowraven-widgets-{tag}-{}", std::process::id()));
            let _ = std::fs::remove_dir_all(&p);
            std::fs::create_dir_all(&p).unwrap();
            Scratch(p)
        }
    }
    impl Drop for Scratch {
        fn drop(&mut self) { let _ = std::fs::remove_dir_all(&self.0); }
    }

    #[test]
    fn removal_takes_whatever_is_at_the_fixed_name_and_an_absent_file_is_done() {
        let s = Scratch::new("remove");
        let file = s.0.join(HANDOVER_FILE);
        assert_eq!(remove_fixed(&file), Ok(()), "absent is already removed");
        std::fs::write(&file, b"{}").unwrap();
        assert_eq!(remove_fixed(&file), Ok(()));
        assert!(std::fs::symlink_metadata(&file).is_err());
        std::fs::create_dir_all(file.join("inner")).unwrap();
        assert_eq!(remove_fixed(&file), Ok(()));
        assert!(std::fs::symlink_metadata(&file).is_err());
    }

    #[cfg(unix)]
    #[test]
    fn removal_takes_a_planted_link_and_never_its_target() {
        let s = Scratch::new("link");
        let outside = s.0.join("outside.json");
        std::fs::write(&outside, b"keep").unwrap();
        let file = s.0.join(HANDOVER_FILE);
        std::os::unix::fs::symlink(&outside, &file).unwrap();
        assert_eq!(remove_fixed(&file), Ok(()));
        assert!(std::fs::symlink_metadata(&file).is_err());
        assert_eq!(std::fs::read(&outside).unwrap(), b"keep");
    }

    #[cfg(unix)]
    #[test]
    fn a_planted_widgets_link_is_removed_as_a_link_and_a_real_directory_is_kept() {
        let s = Scratch::new("dir");
        let elsewhere = s.0.join("elsewhere");
        std::fs::create_dir_all(&elsewhere).unwrap();
        std::fs::write(elsewhere.join(HANDOVER_FILE), b"keep").unwrap();
        let dir = s.0.join(WIDGETS_DIR);
        std::os::unix::fs::symlink(&elsewhere, &dir).unwrap();
        assert_eq!(unplant_dir(&dir), Ok(()));
        assert!(std::fs::symlink_metadata(&dir).is_err(), "the link is gone");
        assert_eq!(std::fs::read(elsewhere.join(HANDOVER_FILE)).unwrap(), b"keep", "its target is untouched");
        std::fs::create_dir_all(&dir).unwrap();
        std::fs::write(dir.join(HANDOVER_FILE), b"mine").unwrap();
        assert_eq!(unplant_dir(&dir), Ok(()));
        assert_eq!(std::fs::read(dir.join(HANDOVER_FILE)).unwrap(), b"mine", "a real directory is left alone");
        assert_eq!(unplant_dir(&s.0.join("absent")), Ok(()));
    }
}
