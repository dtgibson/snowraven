#[cfg(target_os = "macos")]
mod location;
#[cfg(target_os = "windows")]
mod location_windows;
// iCloud Sync native layer (macOS + iOS only): the ubiquity container side of
// frontend/src/lib/icloud/. Never compiled into Windows/Linux binaries.
#[cfg(any(target_os = "macos", target_os = "ios"))]
mod icloud;
// Post-restore on-screen clamp for the remembered window geometry (macOS +
// Windows). Same platform set as the tauri-plugin-window-state dependency,
// spelled with tauri's `desktop` cfg here because Cargo has no such cfg.
#[cfg(desktop)]
mod window_geometry;

use keyring::Entry;
use std::sync::OnceLock;
use tzf_rs::DefaultFinder;

static TZ_FINDER: OnceLock<DefaultFinder> = OnceLock::new();

fn tz_finder() -> &'static DefaultFinder {
    TZ_FINDER.get_or_init(DefaultFinder::new)
}

#[tauri::command]
fn get_api_key(service: &str) -> Result<Option<String>, String> {
    let entry = Entry::new("SnowRaven", service).map_err(|e| e.to_string())?;
    match entry.get_password() {
        Ok(pw) => Ok(Some(pw)),
        Err(keyring::Error::NoEntry) => Ok(None),
        Err(e) => Err(e.to_string()),
    }
}

#[tauri::command]
fn set_api_key(service: &str, value: &str) -> Result<(), String> {
    let entry = Entry::new("SnowRaven", service).map_err(|e| e.to_string())?;
    entry.set_password(value).map_err(|e| e.to_string())
}

#[tauri::command]
fn delete_api_key(service: &str) -> Result<(), String> {
    let entry = Entry::new("SnowRaven", service).map_err(|e| e.to_string())?;
    match entry.delete_credential() {
        Ok(()) => Ok(()),
        Err(keyring::Error::NoEntry) => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// The zone every date derivation falls back to. Twin of `FALLBACK_ZONE` in
/// `backend/formatters/weather.py` and `frontend/src/lib/wallClock.ts`.
const FALLBACK_ZONE: &str = "UTC";

/// Pure so the mapping is testable without loading the polygon data — the
/// command below is the only thing that needs the finder.
fn zone_or_fallback(name: &str) -> String {
    if name.is_empty() {
        FALLBACK_ZONE.to_string()
    } else {
        name.to_string()
    }
}

/// The IANA zone name for a coordinate, or `UTC` when no polygon covers it.
///
/// `DefaultFinder::get_tz_name` returns the EMPTY STRING for an uncovered
/// point — tzf-rs's own source calls that a limitation of the simplified
/// polygon data rather than a bug, and it returns `""` only after its internal
/// neighbourhood sweep has also failed. The JS side hands this straight to
/// `Intl.DateTimeFormat({ timeZone })`, which throws a status-less `RangeError`
/// on `""`; `isOfflineError` reads a throw with no `status` as connection-level,
/// so the panel told the user they were offline on an online device whose
/// request had never left the machine.
///
/// The fallback is HERE because this command is the twin of
/// `backend/formatters/weather.py`'s `get_timezone`, which has always read
/// `_tf.timezone_at(...) or "UTC"`. That default IS the seam's contract, and its
/// absence on this side was a twin divergence rather than a missing guard.
/// Tide is a coastal and on-water feature, so the coordinates most likely to be
/// uncovered are disproportionately the ones it is used at.
///
/// THE TWO ZONE GUARDS ARE NOT SYMMETRIC, AND AN EARLIER VERSION OF THIS
/// COMMENT SAID THEY WERE. Measured in both directions (QA round 2, and
/// re-derived as mutations M11 and M13):
///
/// * `zoneOrUtc` in `frontend/src/lib/wallClock.ts` is LOAD-BEARING. Neutering
///   it turns 14 frontend rows red. A zone name this finder knows and the
///   webview's ICU does not is non-empty, reaches `Intl` unchanged, and throws
///   status-less; `is_empty()` structurally cannot see it.
/// * THIS guard is SUBSUMED on every reachable path. `zoneOrUtc("")` already
///   returns `UTC`, and `locationZone` is this command's only consumer, so
///   reverting this function turns NOTHING red on either runtime.
///
/// It is kept on PARITY grounds, which is the first paragraph above and is a
/// legitimate reason: the command's contract should match its Python twin's
/// long-standing `or "UTC"`, and a future non-`locationZone` caller should get
/// a sane answer. It is not kept because it closes a case nothing else closes.
///
/// One structural fact makes the distinction worth writing down rather than
/// leaving as a wording nit: **the frontend suite mocks `invoke`, so it cannot
/// exercise this guard at all.** The empty-string row in the `zoneNames`
/// fixture drives `zoneOrUtc`, never this function. This guard's only coverage
/// is the four unit tests below. A reader who believed the symmetry could delete
/// `zoneOrUtc` thinking the seam covered `""`, and would be deleting the half
/// that is actually doing the work.
#[tauri::command]
fn get_timezone(lat: f64, lng: f64) -> String {
    zone_or_fallback(tz_finder().get_tz_name(lng, lat))
}

#[cfg(test)]
mod timezone_tests {
    use super::{zone_or_fallback, FALLBACK_ZONE};

    #[test]
    fn an_empty_name_becomes_the_fallback_zone() {
        // The case tzf-rs documents itself as returning for an uncovered point.
        assert_eq!(zone_or_fallback(""), FALLBACK_ZONE);
    }

    #[test]
    fn a_real_zone_passes_through_unchanged() {
        // Non-vacuity: a mapping that answered UTC for every coordinate on earth
        // would satisfy the row above on its own.
        assert_eq!(zone_or_fallback("America/Los_Angeles"), "America/Los_Angeles");
        assert_eq!(zone_or_fallback("Pacific/Kiritimati"), "Pacific/Kiritimati");
    }

    #[test]
    fn the_fallback_matches_the_twins() {
        // One literal, three languages. The Python twin reads
        // `_tf.timezone_at(...) or FALLBACK_ZONE`; the TS twin's `zoneOrUtc`
        // returns `FALLBACK_ZONE`. A drift here is a twin divergence, which is
        // the class this whole build exists to close.
        assert_eq!(FALLBACK_ZONE, "UTC");
    }

    #[test]
    fn a_name_this_seam_cannot_check_still_passes_through() {
        // STATED LIMIT, so the next reader does not assume this closes the whole
        // class: a well-formed name the webview's ICU does not know is NOT empty,
        // so it passes through here and throws in `Intl`. That case is closed on
        // the JS side by `zoneOrUtc` in frontend/src/lib/wallClock.ts, which is
        // the load-bearing half of the pair -- see the doc comment on
        // `get_timezone` for the measurement in both directions.
        assert_eq!(zone_or_fallback("Ocean/Nowhere"), "Ocean/Nowhere");
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let builder = tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_http::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_os::init())
        .plugin(tauri_plugin_clipboard_manager::init());

    // Desktop-only: the in-app updater + process restart. Absent from mobile
    // binaries entirely (FR-14 — updates flow through TestFlight/App Store).
    // Window state joins them: the app reopens at the size, position and
    // maximized/fullscreen state it was last closed at, on macOS and Windows.
    #[cfg(desktop)]
    let builder = builder
        .plugin(tauri_plugin_updater::Builder::new().build())
        .plugin(tauri_plugin_process::init())
        .plugin(
            tauri_plugin_window_state::Builder::default()
                // Spelled out rather than taking the plugin's StateFlags::all()
                // default; window_geometry::PERSISTED_STATE carries the reason
                // and a test that pins it.
                .with_state_flags(window_geometry::PERSISTED_STATE)
                // Spelled out too, though it is the plugin's own default: the
                // same constant names the file window_geometry::saved_state
                // reads back, so the write and the read cannot drift, and that
                // module never has to ask the plugin for the name through a
                // call that panics when the plugin is absent.
                .with_filename(window_geometry::STATE_FILENAME)
                .build(),
        )
        // Runs after the plugin's own restore (which happens while the config
        // window is created, strictly before this closure), so it corrects a
        // restored rect that no longer fits the displays actually attached.
        // See src/window_geometry.rs for why the plugin's guard is not enough.
        .setup(|app| {
            window_geometry::keep_window_on_screen(app.handle());
            Ok(())
        });

    // Mobile-only: geolocation ("Use my location", schema §2.7) and dialog
    // (the Mechanism B document-picker fallback, schema §2.6). Grants live in
    // capabilities/mobile.json; desktop binaries are byte-unaffected.
    #[cfg(mobile)]
    let builder = builder
        .plugin(tauri_plugin_geolocation::init())
        .plugin(tauri_plugin_dialog::init());

    builder
        .invoke_handler(tauri::generate_handler![
            get_api_key,
            set_api_key,
            delete_api_key,
            get_timezone,
            #[cfg(target_os = "macos")]
            location::get_location,
            #[cfg(target_os = "windows")]
            location_windows::get_location,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_status,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_read_record,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_push,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_push_cleared,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_pull,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_start_download,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_remove_all,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_watch,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_read_keys,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_write_keys,
            #[cfg(any(target_os = "macos", target_os = "ios"))]
            icloud::icloud_remove_keys,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application")
}
