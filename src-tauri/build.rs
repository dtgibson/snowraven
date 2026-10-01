fn main() {
    // iOS: `snowraven_reload_widgets` (src/widgets.rs) is defined by the Swift
    // shim in the APP target and resolved when Xcode links libapp.a into the
    // app. Cargo also links an iOS cdylib from this crate (crate-type lists it
    // for Android), and that link would fail on the undefined symbol, so tell
    // ld64 it may stay undefined THERE. The staticlib Xcode actually links is
    // unaffected, and a missing shim still fails the Xcode link loudly.
    if std::env::var("CARGO_CFG_TARGET_OS").as_deref() == Ok("ios") {
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_snowraven_reload_widgets");
        // ios-alerts: the alert engine's three entry points (src/alerts.rs),
        // defined by `gen/apple/Sources/snowraven/Alerts/AlertsBridge.swift`
        // in the APP target. Same reason, same scope as the line above.
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_snowraven_alerts_init");
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_snowraven_alerts_call");
        println!("cargo:rustc-cdylib-link-arg=-Wl,-U,_snowraven_alerts_free");
    }
    tauri_build::build()
}
