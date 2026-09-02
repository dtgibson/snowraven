## Remember Window State

### What this does

The Mac and Windows desktop apps now reopen at the size, position and
maximized/fullscreen state they were last closed at, instead of always opening at
the configured 1100x720. It uses the official `tauri-plugin-window-state` (v2),
registered in the existing `#[cfg(desktop)]` builder branch, plus a new
`src-tauri/src/window_geometry.rs` that corrects a restored window that no longer
fits the displays actually attached. First launch with no saved state is
unchanged, the 800x600 minimums still hold, and nothing changes on iOS/iPadOS or
in the web/Pi build.

Two things turned up during verification that the change brief could not have
known, and both had to be handled or the feature would have been half delivered
on macOS. They are written up under "Notes for reviewer" and are the reason this
is larger than "register a plugin and set four flags".

### How to test

1. Open a terminal in the project folder.
2. Run `npm run desktop:dev` and wait for the app window to appear.
3. Drag the window somewhere distinctive and resize it. Quit with Cmd+Q.
4. Run `npm run desktop:dev` again. The window should come back at the same size
   AND the same position.
5. Quit, relaunch, maximize the window (green button, or double-click the title
   bar), quit again, relaunch. It should come back maximized.
6. Open Settings, scroll to Troubleshooting, and click "Rebuild caches & restart".
   The app restarts; the window should come back where it was.

To exercise the on-screen correction without a second monitor, quit the app and
edit `~/Library/Application Support/com.snowraven/.window-state.json`, setting
`"x": 9000, "y": 9000`. Relaunch: the window should open centered and fully
visible rather than off the desktop. Setting an absurd `"width": 5000,
"height": 3000` should open it fitted to the screen instead.

### Notes for reviewer

**Two macOS platform facts, both measured rather than inferred** (macOS 26.6, in
a dev binary and again in a signed `.app` bundle):

1. **`available_monitors()` returns an empty list on macOS 26.** tao 0.35's
   implementation is backed by `CGGetActiveDisplayList`, which now reports a count
   of zero. Reproduced standalone against `core-graphics` 0.25 with no tauri
   involved, so it is a platform change, not something in this app.
   `primary_monitor()` and `current_monitor()` still work.

   This is not cosmetic. The window-state plugin reapplies POSITION only from
   inside `for m in self.available_monitors()`, so on macOS that loop body never
   runs and the saved position is never restored. Size, maximized and fullscreen
   restore fine. Shipping the plugin alone would have delivered "comes back the
   same size" while silently dropping "comes back where you left it", which is
   most of the point. So `window_geometry` reapplies the position itself from the
   plugin's own state file, and enumerates screens through `NSScreen`, the
   supported API. On Windows, where enumeration works and the plugin has already
   restored the position, that rewrites the same value and changes nothing.

   The `NSScreen` conversion (Cocoa bottom-left points to top-left physical
   pixels) is validated against tao's own `primary_monitor()`: NSScreen's
   `visibleFrame` (73,0) 1439x949 on a 982pt-tall primary at scale 2 converts to
   `146,66 2878x1898`, exactly what tao reported for the same work area. That
   measurement is kept as a unit test.

2. **The plugin's `set_size`/`set_position`/`maximize` are asynchronous on
   macOS.** At `setup()` time the live window still reports the config defaults,
   so every decision is made from the SAVED record rather than from the live
   window. Trusting `is_maximized()` here would have written a size to a window
   that was about to be maximized, silently un-maximizing it. Both traps are
   pinned by tests in the extracted `decide()`.

**Design point worth review: the correction only fires when something is
actually broken.** Two ordinary arrangements must survive untouched or this
feature trades one annoyance for a worse one: a window deliberately straddling
two adjacent displays, and a macOS window dragged down over the Dock (the Dock is
excluded from `visibleFrame`, so a full-containment rule would shove such a window
upward on every launch). The rule is: correct only if the title-bar strip is not
fully on visible desktop, or the window is larger than the work area it mostly
lands on AND is not rescued by a neighbouring display. Coverage is computed
exactly by decomposing the rect on the monitors' own edges, with no "mostly
covered" threshold.

**The grab strip is a floor, not a measurement.** `outer_size - inner_size` is
structurally zero on macOS (tauri answers `inner_size` with the webview NSView's
frame, which spans the whole window frame), so it cannot supply the title bar
height. The floor is 32 logical points, measured with
`NSWindow::frameRectForContentRect` under tauri's own style mask. Without it the
guard shrinks to one pixel and a window restored with only its top row on screen
reads as fine; that case was reproduced live and now fails the guard correctly.

**Scoping.** `tauri-plugin-window-state` goes in the existing
`cfg(not(any(android, ios)))` block, not `[dependencies]` -- the crate is
`#![cfg(not(any(target_os = "android", target_os = "ios")))]` at crate level.
`cargo tree` confirms it is absent from the iOS graph and present on macOS and
Windows, and `cargo check --target aarch64-apple-ios` passes. `objc2-app-kit` is
macOS-only by API (iOS has UIScreen) and was already in the macOS graph via tao,
so naming it directly adds no crate to the build.

**Deliberately not done.** No capability grant was added: the plugin's three JS
commands stay ungranted, since nothing in the frontend calls them. No frontend
file is touched, so the JS bundle is byte-identical. `StateFlags` is set
explicitly to SIZE | POSITION | MAXIMIZED | FULLSCREEN rather than taking the
plugin's `all()` default, because a persisted `visible: false` would relaunch the
app with no window and no way to get one back; a test pins that.

**The brief's open question is answered empirically: no.** Geometry does survive
both programmatic restart paths. `relaunch()` goes through `request_restart()` to
`request_exit()`, which reaches `RunEvent::Exit` and therefore the plugin's save,
before the restart branch is consulted. Verified by driving `request_restart()`
in a live app and confirming the pre-restart geometry both landed on disk and came
back on the relaunched process. No explicit `saveWindowState()` call, no new
capability, no new frontend package.

**Version and changelog** are handled centrally for this bundled release and are
deliberately not part of this change.

**Docs:** no change. `docs/HELP.md`, `README.md` and `website/` describe tabs,
controls and settings; none of them documents the app window's startup geometry,
so nothing goes stale and there is no new control to explain. This is native
window behavior with no setting and nothing for the user to do.

### Verification

Gates: `npm run build` (pass), `cargo build` (pass), `cargo test --lib` (58 pass),
`cargo check --target aarch64-apple-ios` (pass), `cargo clippy` (4 warning lines,
identical to the HEAD baseline; all three are pre-existing, in `location.rs` and
`icloud.rs`).

Every new guard was mutation-checked red-first (23 mutations, plus a must-stay-
GREEN group of equivalent rewrites and an unmutated baseline; source restored and
checked byte-identical against the intended content afterwards). Two mutations
initially stayed green and both were findings about the tests rather than clean
bills: one exposed that no fixture distinguished a real title bar from a
one-pixel strip, the other that the grab-strip floor was computed at an
untestable call site. Both were fixed and now go red.

Verified live on one Mac (macOS 26.6, single built-in Retina display): first run,
move+resize round trip, maximize round trip, a far off-screen saved position, an
oversized saved size, a title bar hanging just off the bottom edge, a window with
one row visible, and survival across `request_restart()`.

**Not verified live, and stated plainly:** anything needing a second physical
display or Windows. The straddling-displays and detached-display behaviors are
covered by unit tests over synthetic monitor rects, and the multi-display screen
enumeration follows the documented Cocoa formula validated against tao for the
primary, but neither has run against real hardware here. The Windows path is the
generic one (`available_monitors()` plus physical coordinates) and was not run at
all; it compiles, and CI builds it.
