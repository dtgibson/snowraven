// The one bridge from Rust to WidgetKit (ios-lifer-widgets, schema.md section
// 2.3). `WidgetCenter` has no Objective-C surface, so objc2 cannot reach it; a
// `@_cdecl` function in the APP target is the smallest bridge that exists.
// src-tauri/src/widgets.rs declares `extern "C" { fn snowraven_reload_widgets(); }`
// and calls it once after every successful hand-over write (FR-23), so a new
// file, key or Default Location reaches placed widgets without waiting for the
// next scheduled refresh. The symbol resolves when Xcode links libapp.a into
// the app, which is where this object lives.

import WidgetKit

@_cdecl("snowraven_reload_widgets")
public func snowravenReloadWidgets() {
    WidgetCenter.shared.reloadAllTimelines()
}
