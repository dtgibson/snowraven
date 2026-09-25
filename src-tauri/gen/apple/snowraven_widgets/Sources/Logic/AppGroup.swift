// The App Group the app and the widget extension share (ios-lifer-widgets,
// schema.md section 1.1). Pinned to `APP_GROUP_ID` in src-tauri/src/widgets.rs,
// `APP_GROUP_ID` in frontend/src/lib/widgets/widgetHandover.ts and both
// entitlement files by frontend/src/lib/widgetPaths.parity.test.ts.
//
// Logic/ imports Foundation (and CryptoKit for one digest) only, so the
// XCTest target compiles these files without a host app. CI on ubuntu-latest
// cannot compile Swift; these files are tested on the release machine.

import Foundation

enum AppGroup {
    static let id = "group.com.dtgibson.snowraven"
    static let widgetsDir = "widgets"
    static let handoverFile = "handover.json"
    static let cacheFile = "cache.json"
    /// The hand-over, in bytes, checked from the file's attributes BEFORE it is read.
    static let handoverMaxBytes = 4_000_000
    /// The extension's own cache document, likewise.
    static let cacheMaxBytes = 8_000_000
}
