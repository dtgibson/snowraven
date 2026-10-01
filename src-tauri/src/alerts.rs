//! iOS Alerts (ios-alerts): the Rust plumbing between the webview and the
//! native Swift alert engine in the APP target.
//!
//! Compiled for iOS, and for the host's `cargo test` so the pure helpers below
//! run on every test pass (lib.rs: `cfg(any(target_os = "ios", test))`).
//! Everything that touches the Swift symbols or Tauri is additionally
//! `cfg(target_os = "ios")`, so the Mac, Windows and Linux binaries never
//! contain it (FR-01: the feature does not exist there).
//!
//! Design (pipeline/ios-alerts/schema.md sections 1, 2 and 10):
//! - The check, the schedule, the notifications and the three alert documents
//!   are Swift, behind one actor, because a BGAppRefreshTask launch never boots
//!   the webview (tao stays in `Launching` with no scene). The webview is a
//!   client: it reaches the actor only through the five commands below, each a
//!   message carried by `snowraven_alerts_call`. It has no route to the App
//!   Group container at all (the `fs` grant is `$APPLOCALDATA/**`).
//! - Three Swift entry points in, two callbacks out, as C function pointers, so
//!   no bridging header and no new build setting (`WidgetReload.swift`'s shape).
//!   build.rs lets the iOS cdylib leave the three symbols undefined; the
//!   staticlib Xcode links resolves them from the app target's Swift objects.
//! - The call is BLOCKING on the Swift side (a semaphore over the actor, and
//!   `enable` waits on the system notification prompt), so every command runs it
//!   on Tauri's blocking pool, never on the main thread and never on an async
//!   worker.
//! - The reply is an envelope, `{"ok":true,"snapshot":...}` or
//!   `{"ok":false,"error":"..."}`. This module reads the envelope and nothing
//!   else: the snapshot is handed to the webview as it came, and an error is
//!   passed on only if it is one of the short stable strings below.
//! - The notification tap arrives through `open_link`, which runs the same
//!   filter and the same parking path as a widget tap (`widgets::park_raw_link`),
//!   so there is one validator for both. No struct here holds a document, so
//!   there is nothing to derive `Debug` on; the parity guard asserts none does.
//! - This plugin uses `setup` only and no `on_event`, so `RunEvent::SceneRequested`
//!   still reaches the no-op callback `Builder::run` installs, and the
//!   single-webview keeper in lib.rs is untouched (schema.md 2.3).
//!
//! `BG_TASK_ID` and `ALERTS_EVENT` are pinned to the plists, the Swift
//! scheduler and `frontend/src/lib/alerts/alertsState.ts` by
//! `alertsPaths.parity.test.ts`.

#![cfg_attr(not(target_os = "ios"), allow(dead_code))]

/// The poke the webview answers by re-reading its snapshot.
pub const ALERTS_EVENT: &str = "snowraven-alerts";
/// The BGAppRefreshTask identifier (declared in the three iOS plist sources).
/// Swift registers and submits it; it is declared here so the parity guard can
/// pin the Rust, TypeScript, Swift and plist declarations to one value.
#[allow(dead_code)]
pub const BG_TASK_ID: &str = "com.dtgibson.snowraven.alerts.refresh";
/// A settings patch is under 1 KB; this is a shape bound, checked BEFORE the
/// payload crosses into Swift.
pub const CALL_MAX_BYTES: usize = 65_536;
/// The ops the Swift bridge dispatches on.
pub const OPS: [&str; 6] = ["snapshot", "update", "enable", "disable", "clear", "purge"];
/// The only error strings passed through to the webview; anything else the
/// bridge might say becomes `unavailable`.
pub const ERRORS: [&str; 5] = ["invalid", "unavailable", "no-app-group", "unknown-op", "too-large"];

/// The pre-bridge check: a known op, a payload within the bound and free of
/// interior NUL (which a C string cannot carry).
fn check_call(op: &str, payload: &str) -> Result<(), &'static str> {
    if !OPS.contains(&op) {
        return Err("unknown-op");
    }
    if payload.len() > CALL_MAX_BYTES {
        return Err("too-large");
    }
    if payload.as_bytes().contains(&0) {
        return Err("invalid");
    }
    Ok(())
}

/// Read the reply envelope: the snapshot's JSON text on success, or one of the
/// stable error strings. The snapshot is re-serialized from the parsed value,
/// so what the webview receives is well-formed JSON whatever the bridge sent.
fn unwrap_envelope(reply: &str) -> Result<String, String> {
    let v: serde_json::Value = serde_json::from_str(reply).map_err(|_| "unavailable".to_string())?;
    match v.get("ok").and_then(serde_json::Value::as_bool) {
        Some(true) => Ok(v.get("snapshot").cloned().unwrap_or(serde_json::Value::Null).to_string()),
        Some(false) => {
            let e = v.get("error").and_then(serde_json::Value::as_str).unwrap_or("unavailable");
            Err(if ERRORS.contains(&e) { e } else { "unavailable" }.to_string())
        }
        None => Err("unavailable".to_string()),
    }
}

/// A C string read up to `max` bytes and no further: `None` when no NUL occurs
/// within the bound, or the bytes are not UTF-8. Reads stop AT the NUL, so a
/// shorter string is never read past its end.
///
/// # Safety
/// `p` must be null or point to readable memory up to its NUL terminator or
/// `max + 1` bytes, whichever comes first.
unsafe fn bounded_c_str(p: *const std::ffi::c_char, max: usize) -> Option<String> {
    if p.is_null() {
        return None;
    }
    let mut len = None;
    for i in 0..=max {
        if *p.add(i) == 0 {
            len = Some(i);
            break;
        }
    }
    let bytes = std::slice::from_raw_parts(p as *const u8, len?);
    std::str::from_utf8(bytes).ok().map(str::to_owned)
}

// ── iOS only: the Swift symbols, the callbacks, the commands and the plugin ──

// `pub mod`, and lib.rs names the commands through it: `generate_handler!`
// reaches each command's generated companion items by path, which a `pub use`
// re-export does not carry.
#[cfg(target_os = "ios")]
pub mod ios {
    use super::{bounded_c_str, check_call, unwrap_envelope, ALERTS_EVENT};
    use std::ffi::{c_char, CStr, CString};
    use std::sync::OnceLock;
    use tauri::Emitter;

    extern "C" {
        /// `@_cdecl("snowraven_alerts_init")` in
        /// `gen/apple/Sources/snowraven/Alerts/AlertsBridge.swift`: stores the
        /// two callbacks, registers the background task, sets the notification
        /// delegate and the app-activation observer.
        fn snowraven_alerts_init(changed: extern "C" fn(), open_link: extern "C" fn(*const c_char));
        /// One op to the actor; returns a `strdup`'d UTF-8 JSON envelope.
        fn snowraven_alerts_call(op: *const c_char, payload: *const c_char) -> *mut c_char;
        /// `free` for the pointer `snowraven_alerts_call` returned.
        fn snowraven_alerts_free(p: *mut c_char);
    }

    static APP: OnceLock<tauri::AppHandle> = OnceLock::new();

    /// The poke: a payload-free event to the main window. Swift calls this only
    /// while the app is not in the background (schema.md 2.5).
    extern "C" fn changed_cb() {
        if let Some(app) = APP.get() {
            let _ = app.emit_to("main", ALERTS_EVENT, ());
        }
    }

    /// A notification tap: the link string from the notification's `userInfo`,
    /// read no further than the hook's own bound, then the widget hook's filter
    /// and parking path.
    extern "C" fn open_link_cb(url: *const c_char) {
        // SAFETY: Swift passes a NUL-terminated UTF-8 string it owns for the
        // duration of the call; the read stops at the NUL or the bound.
        let Some(raw) = (unsafe { bounded_c_str(url, crate::widgets::LINK_MAX_BYTES) }) else { return };
        if let Some(app) = APP.get() {
            crate::widgets::park_raw_link(app, &raw);
        }
    }

    fn call(op: &str, payload: &str) -> Result<String, String> {
        check_call(op, payload).map_err(str::to_string)?;
        let op_c = CString::new(op).map_err(|_| "invalid".to_string())?;
        let payload_c = CString::new(payload).map_err(|_| "invalid".to_string())?;
        // SAFETY: two valid C strings for the duration of the call; the
        // returned pointer is ours and is freed below with the matching free.
        let p = unsafe { snowraven_alerts_call(op_c.as_ptr(), payload_c.as_ptr()) };
        if p.is_null() {
            return Err("unavailable".to_string());
        }
        // SAFETY: a NUL-terminated string the bridge allocated with strdup.
        let reply = unsafe { CStr::from_ptr(p) }.to_str().map(str::to_owned);
        unsafe { snowraven_alerts_free(p) };
        unwrap_envelope(&reply.map_err(|_| "unavailable".to_string())?)
    }

    async fn run(op: &'static str, payload: String) -> Result<String, String> {
        tauri::async_runtime::spawn_blocking(move || call(op, &payload))
            .await
            .map_err(|_| "unavailable".to_string())?
    }

    /// The current snapshot (settings, state, inbox, live status, permissions).
    #[tauri::command]
    pub async fn alerts_snapshot() -> Result<String, String> {
        run("snapshot", String::new()).await
    }

    /// A settings edit: a JSON object of any subset of the settings fields,
    /// plus an optional `position` seed. Swift validates field by field.
    #[tauri::command]
    pub async fn alerts_update_settings(patch: String) -> Result<String, String> {
        run("update", patch).await
    }

    /// The switch. On, native asks for the notification permission only if it
    /// has not been decided; off cancels every schedule and pending alert.
    #[tauri::command]
    pub async fn alerts_set_enabled(enabled: bool) -> Result<String, String> {
        run(if enabled { "enable" } else { "disable" }, String::new()).await
    }

    /// The inbox's Clear (FR-39): the rows only.
    #[tauri::command]
    pub async fn alerts_clear_inbox() -> Result<String, String> {
        run("clear", String::new()).await
    }

    /// The clear registry's row (FR-40): the eBird backup was cleared, so the
    /// rows derived from it and any pending summary go.
    #[tauri::command]
    pub async fn alerts_purge_inbox() -> Result<(), String> {
        run("purge", String::new()).await.map(|_| ())
    }

    /// `setup` only: keep the handle for the callbacks, then hand Swift the
    /// two callbacks. Plugin setup runs inside `Builder::build`, before
    /// `UIApplicationMain`, which is where the background task must register.
    pub fn plugin() -> tauri::plugin::TauriPlugin<tauri::Wry> {
        tauri::plugin::Builder::new("snowraven-alerts")
            .setup(|app, _api| {
                let _ = APP.set(app.clone());
                // SAFETY: two `extern "C"` functions with the signatures the
                // Swift side declares; Swift stores them and calls them later.
                unsafe { snowraven_alerts_init(changed_cb, open_link_cb) };
                Ok(())
            })
            .build()
    }
}

#[cfg(target_os = "ios")]
pub use ios::plugin;

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn only_known_ops_pass_and_the_bound_is_checked_first() {
        for op in OPS {
            assert_eq!(check_call(op, ""), Ok(()), "{op}");
        }
        for op in ["", "Snapshot", "snapshot ", "delete", "purge\0"] {
            assert_eq!(check_call(op, ""), Err("unknown-op"), "{op:?}");
        }
        assert_eq!(check_call("update", &"x".repeat(CALL_MAX_BYTES)), Ok(()));
        assert_eq!(check_call("update", &"x".repeat(CALL_MAX_BYTES + 1)), Err("too-large"));
        assert_eq!(check_call("update", "{\"a\":\"\0\"}"), Err("invalid"));
    }

    #[test]
    fn the_envelope_passes_the_snapshot_and_only_stable_errors() {
        assert_eq!(unwrap_envelope(r#"{"ok":true,"snapshot":{"a":1}}"#), Ok(r#"{"a":1}"#.to_string()));
        assert_eq!(unwrap_envelope(r#"{"ok":true}"#), Ok("null".to_string()));
        for e in ERRORS {
            assert_eq!(unwrap_envelope(&format!(r#"{{"ok":false,"error":"{e}"}}"#)), Err(e.to_string()));
        }
        // Anything the bridge might say beyond the stable set becomes
        // `unavailable`, so no document text can reach the webview in an error.
        for reply in [
            r#"{"ok":false,"error":"SENTINELKEY42 in /private/var/containers"}"#,
            r#"{"ok":false}"#,
            r#"{"ok":"true","snapshot":{}}"#,
            r#"{"snapshot":{}}"#,
            "not json",
            "",
        ] {
            assert_eq!(unwrap_envelope(reply), Err("unavailable".to_string()), "{reply}");
        }
    }

    #[test]
    fn a_c_string_is_read_to_its_nul_and_never_past_the_bound() {
        let ok = std::ffi::CString::new("snowraven://map/lifers?window=day").unwrap();
        assert_eq!(unsafe { bounded_c_str(ok.as_ptr(), 512) }, Some("snowraven://map/lifers?window=day".to_string()));
        let at = std::ffi::CString::new("a".repeat(512)).unwrap();
        assert_eq!(unsafe { bounded_c_str(at.as_ptr(), 512) }.map(|s| s.len()), Some(512));
        let over = std::ffi::CString::new("a".repeat(513)).unwrap();
        assert_eq!(unsafe { bounded_c_str(over.as_ptr(), 512) }, None);
        assert_eq!(unsafe { bounded_c_str(std::ptr::null(), 512) }, None);
        let bad = std::ffi::CString::new(vec![0xff_u8, 0xfe]).unwrap();
        assert_eq!(unsafe { bounded_c_str(bad.as_ptr(), 512) }, None);
    }
}
