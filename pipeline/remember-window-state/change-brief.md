# Change Brief — Remember Window State

## What is changing

The desktop app reopens at the size and window state it was last closed at, instead of always opening at the configured 1100x720. Today `src-tauri/tauri.conf.json` `app.windows[0]` is a fixed `width: 1100, height: 720, minWidth: 800, minHeight: 600` and nothing persists geometry; `Cargo.toml` has no window-state crate and `src/lib.rs` registers no such plugin (verified in all three files).

"State" here means: **inner size, outer position, maximized, and fullscreen**. It explicitly does **not** include `visible` or `decorated`. The official plugin's default is `StateFlags::all()`, which includes both — SnowRaven never hides or undecorates its one window, and a persisted `visible: false` would relaunch the app with no window and no way to get it back. The Engineer sets `StateFlags::SIZE | POSITION | MAXIMIZED | FULLSCREEN` rather than taking the default.

**Mechanism: the official `tauri-plugin-window-state` (v2), not the app's `storage` seam.** Geometry must be applied by the native layer before the first frame; the webview seam is read after boot, so a seam-based version would open at 1100x720 and then visibly jump, and would need a new JS window-management grant to do it at all. The plugin writes `.window-state.json` into `app_config_dir()` via `std::fs` on the Rust side. **This is not a violation of the CLAUDE.md storage-seam rule.** That rule governs the *webview's* data (`AppLocalData/data/*.json` through `tauri-plugin-fs`) and exists because `localStorage` is wiped on every WKWebView relaunch. A native-side file written by native code is a different mechanism and a different trust boundary: it never passes through `TauriStorage`, never joins the `docChains` serialization (v1.0.9), and adds nothing to `settings.json`.

**Off-screen guard — this is the part that turns the improvement into a regression if skipped.** The plugin already guards position: on restore it walks `available_monitors()` and only reapplies the saved position if one intersects, otherwise it lets the OS place the window. Two gaps remain, both read from the plugin source: `intersects` passes when *any one* of the four corners is on a monitor, and SIZE/MAXIMIZED/FULLSCREEN restore unconditionally. So a window saved on a large or differently-arranged display can still open with its title bar above the visible desktop (unreachable on Windows), or wider than the display it lands on. The Engineer adds a post-restore clamp in `setup`: bound the window's outer rect to the work area of the monitor it lands on, shrinking to fit but never below the existing 800x600 minimums, then nudge the position so the full title bar is on-screen; if no monitor matches, `center()`. Skip the clamp when the window restores maximized or fullscreen.

**Platform scope: macOS and Windows only. iOS is untouched.** iOS has no resizable window, and the crate is `#![cfg(not(any(target_os = "android", target_os = "ios")))]` at crate level, so it does not exist on mobile. The dependency goes in the existing `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` block beside `tauri-plugin-updater` and `tauri-plugin-process`, and registration goes in the existing `#[cfg(desktop)]` builder branch in `lib.rs`. **Do not put it in `[dependencies]`.** CLAUDE.md's rule from the `tzf-rs` post-mortem cuts the other way here: the cfg says where a crate is *real*, and this one is real only on desktop. Mis-scoping is the mistake that broke the Windows build once already.

Version bump and changelog are handled centrally for this release — not part of this change.

## Why now

The user asked for it directly. The app is a long-session desktop tool (Statistics sweeps, Map Explorer work) that people resize to their display and then lose to 1100x720 on every relaunch — and relaunches are frequent, because the in-app updater restarts the app and Settings has a "Rebuild caches & restart" control.

## User-facing impact

Yes, and it is the point: on macOS and Windows the app reopens where and how you left it. First run after the update is unchanged — with no saved state the configured 1100x720 still applies. The 800x600 minimums still hold, so no restored size can strand the window too small. Nothing changes on iOS/iPadOS or on the web/Pi build. No new setting, control, or screen.

## Design pass

**Not needed — no visual change.** Nothing about any surface's layout, hierarchy, spacing, type, color, or motion changes. The app's own responsive rules already handle every width this can restore, and the 800x600 floor is unchanged, so no new width is reachable that was not reachable by dragging the window before.

## Decisions touched

- **Desktop tab layout reset on every relaunch (post-mortem, 2026-05-28, v0.3.30)** — *touched, not reversed.* Its rule ("persisted UI settings go through the `storage` seam, never `localStorage`") stands untouched; nothing moves to `localStorage`, and window geometry is native-side state that the seam structurally cannot apply pre-paint. The Chronicler should record why this case sits outside that rule rather than leaving a future reader to assume it was overlooked.
- **Tab layout stored in localStorage, not server-side (2026-05-24)** — *precedent, unmodified.* Establishes that a device-local, non-portable UI preference is the right shape here. Window geometry is per-device by nature.
- **iCloud Sync scope (v1.0.11/v1.0.12)** — *boundary reaffirmed.* "App settings, map preferences and cached lookups stay on each device and are never synced" (also stated in `PRIVACY_POLICY.md`). Window geometry joins that device-local class; nothing is added to the sync record, and `PRIVACY_POLICY.md` needs no change — the file stays on the device and is already covered by the existing "stored only on your device" statement.
- **Shared-document write serialization (v1.0.9)** — *deliberately not touched.* Window state does not go through the settings document, so it neither needs nor gets a `docChains` link.
- **The standing "no JS `window` resize / `innerWidth` listener" rules** (Map Explorer 2026-05-22, Calendar `useIsPhone`) — *untouched.* This change adds no JavaScript resize listener; it is entirely native-side.

## Not changing

`tauri.conf.json`'s 1100x720 default and 800x600 minimums (they stay as the first-run size and the floor), `zoomHotkeysEnabled`, the `storage` seam and every `AppLocalData/data/*.json` document, tab-layout persistence, the iCloud sync record, the web/Pi build, the iOS build (must stay byte-identical in behavior), and every existing frontend component. No new frontend dependency unless the relaunch flag below forces one.

## What done looks like

Resize and move the window, quit, relaunch: it comes back at that size and position on both macOS and Windows. Maximize, quit, relaunch: it comes back maximized. Save a position on a second display, detach it, relaunch: the window opens fully on-screen with its title bar reachable, never off the visible desktop, and never larger than the display it opens on. First launch with no saved state opens at 1100x720. The iOS build compiles and behaves unchanged, and `cargo build` succeeds on Windows CI.

**One thing The Engineer must verify, because it is not answerable from the plugin source alone:** the plugin writes to disk on `RunEvent::Exit`, and SnowRaven has two programmatic restart paths that may not fire it — the updater (`frontend/src/lib/tauri/updateManager.ts`, called from `App.tsx` ~665) and "Rebuild caches & restart" (`frontend/src/components/Settings.tsx` ~1667), both ending in `relaunch()`. If geometry is lost across either, save it explicitly before the relaunch: either a `window-state:allow-save-window-state` grant in `capabilities/desktop.json` (desktop-only, never `default.json`) plus a `saveWindowState()` call, or a small Rust command. Prefer whichever avoids adding a new package to the frontend entry graph.
