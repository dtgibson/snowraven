// The iOS alert documents' names and bounds (ios-alerts, schema.md 3.1). Three
// documents under `<App Group>/alerts/`, written by ONE actor in the app
// process (`AlertsEngine`) and never by the webview (whose `fs` grant does not
// reach the container) or the widget extension (which never opens `alerts/`).
// Pinned to `ALERTS_DIR` and the file names in
// frontend/src/lib/alerts/alertsState.ts and the Rust constants in
// src-tauri/src/alerts.rs by frontend/src/lib/alerts/alertsPaths.parity.test.ts.
//
// AlertsLogic/ imports Foundation only (plus the widget Logic/ types it is
// compiled beside), so the XCTest target compiles it without a host app. CI on
// ubuntu-latest cannot compile Swift; these files are tested on the release
// machine.

import Foundation

enum AlertsFiles {
    static let dir = "alerts"
    static let settingsFile = "settings.json"
    static let stateFile = "state.json"
    static let inboxFile = "inbox.json"
    /// Each checked from the file's attributes BEFORE it is read; a file over
    /// its bound is never read and reads as absent, which the next write heals.
    static let settingsMaxBytes = 16_384
    static let stateMaxBytes = 262_144
    static let inboxMaxBytes = 2_097_152
    /// Temp files are `<name>.tmp-<pid>` beside the target, then renamed.
    static let tempInfix = ".tmp-"
}

/// The three documents, for the store seam.
enum AlertsFile: String, CaseIterable, Sendable {
    case settings, state, inbox

    var name: String {
        switch self {
        case .settings: return AlertsFiles.settingsFile
        case .state: return AlertsFiles.stateFile
        case .inbox: return AlertsFiles.inboxFile
        }
    }

    var maxBytes: Int {
        switch self {
        case .settings: return AlertsFiles.settingsMaxBytes
        case .state: return AlertsFiles.stateMaxBytes
        case .inbox: return AlertsFiles.inboxMaxBytes
        }
    }
}
