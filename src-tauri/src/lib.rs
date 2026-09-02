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

#[tauri::command]
fn get_timezone(lat: f64, lng: f64) -> String {
    tz_finder().get_tz_name(lng, lat).to_string()
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
