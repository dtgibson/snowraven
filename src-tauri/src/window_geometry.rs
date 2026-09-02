//! Post-restore on-screen clamp for the app's window (macOS + Windows only).
//!
//! `tauri-plugin-window-state` reapplies the saved geometry in its
//! `on_window_ready` hook, which runs while the config windows are being
//! created inside tauri's `setup()` — i.e. strictly BEFORE the app's own
//! `.setup()` closure. That ordering is what makes this module possible: by the
//! time `keep_window_on_screen` runs, the restore has already happened and the
//! live window carries whatever geometry came off disk.
//!
//! The plugin's own off-screen guard is not enough on its own. It checks
//! POSITION only, and its `Monitor::intersects` passes when ANY ONE of the
//! window's four corners lands on a monitor; size, maximized and fullscreen are
//! restored unconditionally. So a window saved on a large or differently
//! arranged display can still come back with its title bar above the visible
//! desktop (unreachable on Windows) or wider than the display it lands on.
//! Without the correction below, "remember the window" is a regression waiting
//! for the first monitor change.
//!
//! ## Correct only what is broken
//!
//! The hard part is not the repair, it is knowing when NOT to repair. Two
//! perfectly ordinary arrangements must survive untouched, or this feature
//! trades one annoyance for a worse one:
//!
//! - A window deliberately **straddling two adjacent displays**. Every pixel is
//!   visible; sliding it wholly onto one monitor every launch would be a new
//!   defect, not a fix.
//! - A macOS window dragged **down over the Dock**. The Dock is excluded from
//!   `visibleFrame` (what `work_area()` reports), so a full-containment rule
//!   would shove such a window upward on every launch, on a machine whose
//!   displays never changed.
//!
//! So the window is left exactly as restored unless one of two things is true:
//!
//! 1. its **title-bar strip is not fully on visible desktop** (measured against
//!    the union of every work area, not one monitor) — the bar is what the user
//!    has to be able to grab, and it is the failure that strands a window; or
//! 2. it is **larger than the work area it mostly lands on** and is *not*
//!    rescued by its neighbours, i.e. its full rect is not covered by the union
//!    either — the "never larger than the display it opens on" case.
//!
//! When neither holds, nothing is called at all, so a normal relaunch has no
//! visible nudge. When one does, the window is fitted wholly onto the work area
//! it mostly overlaps; when it overlaps none of them (the display it was saved
//! on is gone) it is sized to the primary monitor and centered there.
//!
//! The geometry is pure and lives in `place_on_screen`, so it is tested against
//! synthetic monitor rects rather than a live display.
//!
//! Everything here is in PHYSICAL pixels and, unless a name says otherwise,
//! OUTER rects (the window frame, title bar included) — that is the rectangle
//! the user has to be able to reach, and the one a monitor work area is
//! comparable to. `set_size` takes an INNER size, so the frame delta is
//! subtracted back out at the one point that calls it.
//!
//! ## Two macOS platform facts this module exists to absorb
//!
//! Both were measured on macOS 26.6 (Darwin 25.6), in a dev binary and again in
//! a signed `.app` bundle, not inferred:
//!
//! 1. **`available_monitors()` returns an EMPTY list.** tao 0.35's macOS
//!    implementation is backed by `CGGetActiveDisplayList`, which now reports a
//!    count of zero; reproduced standalone against `core-graphics` 0.25 with no
//!    tauri in the picture, so it is a platform change rather than anything in
//!    this app. `primary_monitor()` and `current_monitor()` still work (they go
//!    through `CGDisplay::main()` and `NSWindow::screen()`), and `NSScreen` — the
//!    supported API — answers correctly, so that is what this module enumerates
//!    on macOS. Its numbers match tao's own `primary_monitor()` exactly.
//!
//!    The consequence is not cosmetic: the window-state plugin restores POSITION
//!    only from inside `for m in self.available_monitors()`, so on macOS that
//!    loop body never runs and **the saved position is never reapplied**. Size,
//!    maximized and fullscreen restore fine. So this module reapplies the
//!    position itself, reading the plugin's own state file. On Windows, where
//!    enumeration works and the plugin has already restored the position, that
//!    rewrites the same value and changes nothing.
//!
//! 2. **The plugin's `set_size`/`set_position`/`maximize` are ASYNCHRONOUS on
//!    macOS** (tao dispatches them to the main queue), so at `setup()` time the
//!    live window still reports the config defaults. Every decision here is
//!    therefore made from the SAVED state rather than from the live window, and
//!    the writes are issued after the plugin's, so they land last and win.

use serde::Deserialize;
use std::collections::HashMap;
use std::path::Path;
use tauri::{AppHandle, Manager, Monitor, PhysicalPosition, PhysicalSize, Runtime};
use tauri_plugin_window_state::StateFlags;

/// Exactly the window state SnowRaven persists, and the reason this is a named
/// constant rather than four flags typed inline at the registration site.
///
/// The plugin's own default is `StateFlags::all()`, which additionally persists
/// VISIBLE and DECORATIONS. A saved `visible: false` would relaunch the app with
/// no window and no way to get one back — an unrecoverable state written to disk
/// by a plugin whose whole job is to be remembered. SnowRaven never hides or
/// undecorates its one window, so both flags can only ever do harm here.
pub const PERSISTED_STATE: StateFlags = StateFlags::SIZE
    .union(StateFlags::POSITION)
    .union(StateFlags::MAXIMIZED)
    .union(StateFlags::FULLSCREEN);

/// The name of the plugin's state file: handed to `with_filename` at the
/// registration site and used again by `saved_state` below, so the file this
/// module reads is the file the plugin writes, by construction rather than by
/// coincidence.
///
/// It is the plugin's own `DEFAULT_FILENAME` value, spelled out rather than
/// aliased so the pinning test notices an upstream rename, and it is
/// deliberately a DOTFILE. On unix `tauri-plugin-fs` defaults
/// `require_literal_leading_dot` to true, and on macOS `app_config_dir()` and
/// `app_local_data_dir()` are the same directory, so the leading dot is the only
/// thing keeping this file out of the webview's granted `$APPLOCALDATA/**` write
/// scope. Renaming it without one hands the webview write access to a document
/// the native side parses before the first frame.
///
/// Asking the plugin for the name instead is what this replaces:
/// `AppHandleExt::filename` is `Manager::state::<PluginState>()`, which PANICS
/// when the plugin is not registered, on the startup path, under a release
/// profile that is `panic = "abort"`.
pub const STATE_FILENAME: &str = ".window-state.json";

/// A rectangle in physical pixels, half-open on both axes: it covers
/// `x..x+width` and `y..y+height`. Used for the window's outer rect and for a
/// monitor's work area, the only two things this module compares.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Rect {
    x: i32,
    y: i32,
    width: u32,
    height: u32,
}

impl Rect {
    /// i64 throughout, deliberately. `x + width` is an i32 plus a u32 and can
    /// overflow on a wide virtual desktop, and an overlap AREA is the product
    /// of two u32 extents, which never fits in i32 at all.
    fn right(&self) -> i64 {
        self.x as i64 + self.width as i64
    }

    fn bottom(&self) -> i64 {
        self.y as i64 + self.height as i64
    }

    /// Area of the overlap with `other`, in square physical pixels; 0 when the
    /// two do not overlap.
    fn overlap_area(&self, other: &Rect) -> i64 {
        let w = (self.right().min(other.right()) - self.x.max(other.x) as i64).max(0);
        let h = (self.bottom().min(other.bottom()) - self.y.max(other.y) as i64).max(0);
        w * h
    }

    fn contains_point(&self, px: i64, py: i64) -> bool {
        px >= self.x as i64 && px < self.right() && py >= self.y as i64 && py < self.bottom()
    }

    /// A degenerate rect is treated as "no monitor". A platform that leaves a
    /// work area unset reports zeros, and clamping into a 0x0 box would put the
    /// window somewhere useless.
    fn is_usable(&self) -> bool {
        self.width > 0 && self.height > 0
    }
}

/// How much of a window's top edge must stay on visible desktop for it to be
/// draggable, in logical points.
///
/// 32 is the height of a standard macOS title bar, measured on macOS 26.6 with
/// `NSWindow::frameRectForContentRect` and the style mask tauri gives its
/// windows (titled + closable + miniaturizable + resizable): a 1100x720 content
/// rect becomes a 1100x752 frame. A Windows caption is about the same at 100%
/// DPI, so it serves as the floor on both.
///
/// This is a FLOOR rather than the measurement itself because `outer - inner`
/// cannot supply the number on macOS: tauri answers `inner_size` there with the
/// webview NSView's frame, and that view spans the whole window frame, so the
/// difference is structurally zero. Believing it would shrink this guard to a
/// single pixel and let a window come back with only its top row on screen.
const MIN_GRAB_STRIP_POINTS: f64 = 32.0;

/// The window's own measurements, in physical pixels.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct Frame {
    /// Minimum OUTER width the window manager will honor (the configured
    /// minimum inner width plus the border).
    min_width: u32,
    /// Minimum OUTER height, likewise.
    min_height: u32,
    /// What the decoration adds to the content box horizontally (`outer - inner`),
    /// used to turn a saved INNER size into an OUTER rect. Zero on macOS.
    border_width: u32,
    /// The same vertically.
    border_height: u32,
    /// The strip along the window's top edge that must stay on visible desktop:
    /// the measured border, or `MIN_GRAB_STRIP_POINTS` scaled, whichever is
    /// larger.
    grab_strip: u32,
}

/// What the live window looks like right now, as read from the OS.
#[derive(Clone, Copy, Debug, PartialEq, Eq)]
struct LiveWindow {
    /// The window's current OUTER rect.
    outer: Rect,
    maximized: bool,
    fullscreen: bool,
}

/// The whole decision, made from the saved record and the live window: the OUTER
/// rect to write, or `None` to leave the window exactly as it is.
///
/// Pure, because the three judgements that actually bite are all here and none
/// of them is observable from a geometry assertion alone:
///
/// 1. **Maximized and fullscreen are read from the SAVED record**, never from
///    the live window. On macOS the plugin's `maximize()` has not landed yet at
///    this point, so the live window still answers "not maximized" and writing a
///    size here would un-maximize it a moment later.
/// 2. **The rect to judge is the SAVED one**, not the live one, for the same
///    async reason: the live window still reports the config defaults.
/// 3. **A restore writes even when no correction is needed**, because on macOS
///    nothing else will reapply the position; but with no saved record an
///    uncorrected window must be left completely alone, or every first run gets
///    a pointless nudge.
fn decide(
    saved: Option<SavedState>,
    live: LiveWindow,
    frame: Frame,
    work_areas: &[Rect],
    primary: Option<Rect>,
) -> Option<Rect> {
    let saved = saved.filter(SavedState::is_restorable);

    let (maximized, fullscreen) = match saved {
        Some(state) => (state.maximized, state.fullscreen),
        None => (live.maximized, live.fullscreen),
    };
    if maximized || fullscreen {
        // Already exactly the shape of the screen it is on.
        return None;
    }

    // The saved size is an INNER size, so the border is added back to make it
    // comparable with a work area.
    let desired = match saved {
        Some(state) => Rect {
            x: state.x,
            y: state.y,
            width: state.width.saturating_add(frame.border_width),
            height: state.height.saturating_add(frame.border_height),
        },
        None => live.outer,
    };

    // The configured minimum is a hard floor the window manager enforces
    // anyway, so it is applied HERE, on every path that ends up setting a size,
    // rather than only inside `fit_within`. Without it a hand-edited or corrupt
    // record of, say, 1x1 at an on-screen position needs no correction, is
    // written back verbatim, and the window manager then grows the window to the
    // minimum around a position computed for a 1x1 rect. Benign in outcome, but
    // it is a file-supplied value skipping a floor the rest of the module
    // applies, and the floor is cheaper than the reasoning about why that is
    // survivable.
    let desired = Rect {
        width: desired.width.max(frame.min_width),
        height: desired.height.max(frame.min_height),
        ..desired
    };

    let corrected = place_on_screen(desired, work_areas, primary, frame);
    if saved.is_none() && corrected.is_none() {
        return None;
    }
    Some(corrected.unwrap_or(desired))
}

/// Decide where the window belongs after the plugin has restored it.
///
/// `window` is the window's current outer rect, `work_areas` every monitor's
/// work area (menu bar / taskbar already excluded by the platform), and
/// `primary` the primary monitor's work area, used only as the fallback when
/// the saved rect overlaps nothing at all.
///
/// Returns `None` when the window needs no correction, or when there is no
/// usable monitor to place it against — in both cases the caller leaves the
/// window exactly as it is. Distinguishing the two would buy nothing: with
/// nothing to measure against, any move is a guess.
fn place_on_screen(
    window: Rect,
    work_areas: &[Rect],
    primary: Option<Rect>,
    frame: Frame,
) -> Option<Rect> {
    if let Some(area) = best_overlap(window, work_areas) {
        if !needs_correction(window, work_areas, area, frame) {
            return None;
        }
        let fitted = fit_within(window, area, frame);
        return (fitted != window).then_some(fitted);
    }

    // Nothing overlaps: the display this geometry was saved on is gone
    // (undocked laptop, unplugged external, rearranged desktop). Fall back to
    // the primary monitor, or failing that the first usable one, and center
    // there at a size that fits it.
    let area = primary
        .filter(Rect::is_usable)
        .or_else(|| work_areas.iter().copied().find(Rect::is_usable))?;
    let centered = center_within(fit_within(window, area, frame), area);
    (centered != window).then_some(centered)
}

/// Is the restored window broken in one of the two ways that matter? See the
/// module docs: an unreachable title bar, or oversize with no neighbour to
/// rescue it.
fn needs_correction(window: Rect, work_areas: &[Rect], area: Rect, frame: Frame) -> bool {
    if !is_covered(title_bar_strip(window, frame.grab_strip), work_areas) {
        return true;
    }
    let oversized = window.width > area.width || window.height > area.height;
    oversized && !is_covered(window, work_areas)
}

/// The strip along the window's top edge that has to stay grabbable. At least
/// one pixel tall even for an undecorated window, and never taller than the
/// window itself.
fn title_bar_strip(window: Rect, title_bar_height: u32) -> Rect {
    Rect {
        height: title_bar_height.max(1).min(window.height.max(1)),
        ..window
    }
}

/// Is every pixel of `rect` inside at least one of `areas`?
///
/// Exact, and it has to be: a "mostly covered" fudge factor is what turns a
/// guard like this into a threshold nobody can reason about. Decomposing `rect`
/// on the areas' own edges gives cells that are each wholly inside some area or
/// wholly outside every one, so with half-open rectangles the cell's lower-left
/// corner settles the whole cell. O(n^3) for n monitors, which is a handful.
fn is_covered(rect: Rect, areas: &[Rect]) -> bool {
    if !rect.is_usable() {
        return true;
    }
    let usable: Vec<&Rect> = areas.iter().filter(|a| a.is_usable()).collect();
    if usable.is_empty() {
        return false;
    }

    let cuts = |low: i64, high: i64, edges: &[i64]| -> Vec<i64> {
        let mut v: Vec<i64> = edges
            .iter()
            .copied()
            .filter(|e| *e > low && *e < high)
            .collect();
        v.push(low);
        v.sort_unstable();
        v.dedup();
        v
    };

    let x_edges: Vec<i64> = usable
        .iter()
        .flat_map(|a| [a.x as i64, a.right()])
        .collect();
    let y_edges: Vec<i64> = usable
        .iter()
        .flat_map(|a| [a.y as i64, a.bottom()])
        .collect();

    let xs = cuts(rect.x as i64, rect.right(), &x_edges);
    let ys = cuts(rect.y as i64, rect.bottom(), &y_edges);

    xs.iter().all(|&px| {
        ys.iter()
            .all(|&py| usable.iter().any(|a| a.contains_point(px, py)))
    })
}

/// The work area the window mostly lands on.
///
/// Ties break toward the EARLIER entry, which is the platform's own enumeration
/// order (primary first), so a window split exactly down the middle lands
/// somewhere stable rather than somewhere that depends on enumeration order
/// changing between launches. Written as an explicit fold rather than
/// `max_by_key`, which returns the LAST maximum and would give the opposite
/// tie-break to the one this comment claims.
fn best_overlap(window: Rect, work_areas: &[Rect]) -> Option<Rect> {
    let mut best: Option<(i64, Rect)> = None;
    for area in work_areas.iter().filter(|a| a.is_usable()) {
        let overlap = window.overlap_area(area);
        if overlap > 0 && best.map_or(true, |(seen, _)| overlap > seen) {
            best = Some((overlap, *area));
        }
    }
    best.map(|(_, area)| area)
}

/// Shrink `window` to fit `area` and slide it fully inside.
fn fit_within(window: Rect, area: Rect, frame: Frame) -> Rect {
    // Shrink to fit, but never below the configured minimums: those are a hard
    // floor the window manager enforces anyway, so a smaller request would just
    // be bounced back and leave the position computed against a width the
    // window never actually takes.
    let width = window.width.min(area.width).max(frame.min_width);
    let height = window.height.min(area.height).max(frame.min_height);

    // Then slide fully inside. The lower bound is applied LAST so that a window
    // still larger than the work area (because the minimum won above) pins to
    // the work area's ORIGIN: on macOS just under the menu bar, on Windows just
    // inside the taskbar, title bar grabbable either way. Pinning to the far
    // edge instead would push the title bar off the top, which is precisely the
    // regression this module exists to prevent.
    Rect {
        x: clamp_axis(window.x, area.x, area.width, width),
        y: clamp_axis(window.y, area.y, area.height, height),
        width,
        height,
    }
}

/// Center `rect` within `area`, then slide it inside (a rect wider or taller
/// than the area still pins to the origin rather than straddling both edges).
fn center_within(rect: Rect, area: Rect) -> Rect {
    let x = area.x as i64 + (area.width as i64 - rect.width as i64) / 2;
    let y = area.y as i64 + (area.height as i64 - rect.height as i64) / 2;
    Rect {
        x: clamp_axis(saturating_i32(x), area.x, area.width, rect.width),
        y: clamp_axis(saturating_i32(y), area.y, area.height, rect.height),
        ..rect
    }
}

/// One axis of the slide: keep `origin <= value <= origin + extent - size`,
/// with `origin` winning when the window is larger than the area.
fn clamp_axis(value: i32, origin: i32, extent: u32, size: u32) -> i32 {
    let min = origin as i64;
    let max = origin as i64 + extent as i64 - size as i64;
    saturating_i32((value as i64).min(max).max(min))
}

fn saturating_i32(v: i64) -> i32 {
    v.clamp(i32::MIN as i64, i32::MAX as i64) as i32
}

// ---------------------------------------------------------------------------
// Live-window glue
// ---------------------------------------------------------------------------

/// Correct the app's window back onto visible desktop after the window-state
/// plugin has restored it. Called from the app's `.setup()` closure.
///
/// Best effort by construction: a window that cannot be measured or moved is
/// left exactly where the plugin (or the OS) put it. Nothing in here may keep
/// the app from starting, so every error is swallowed rather than surfaced.
///
/// `let _ = ...` swallows `Err`, though, not a panic — and this crate's release
/// profile is `panic = "abort"`, so a panic here is no unwinding, no recovery
/// and no window ever shown. The claim above is therefore a claim about panics
/// too, and what holds it up is not the `let _`:
///
/// - **No `Manager::state` call that a registration could leave unmanaged.**
///   `state::<T>()` panics when `T` is not managed. This module makes exactly one
///   such lookup, for tauri's own always-registered `PathResolver`, and makes it
///   through `try_state`. It notably does NOT ask the window-state plugin for its
///   filename (`AppHandleExt::filename` is `state::<PluginState>()`);
///   `STATE_FILENAME` carries that instead, which is why dropping the plugin
///   while leaving this hook registered now degrades to "no saved record"
///   rather than aborting during `setup()`.
/// - **No indexing, `unwrap`, `expect`, slicing or division** on any path from
///   here.
/// - **No arithmetic that can panic, in debug builds either**: every comparison
///   is lifted to `i64` and every narrowing goes through `saturating_i32`,
///   `saturating_add`/`saturating_sub` or a `clamp`.
///
/// What that does not cover, so the next reader does not over-read it: the
/// plugin's own restore runs earlier and none of this applies to it, and an
/// allocation failure aborts anywhere. `state_text_at` bounds the one allocation
/// this module makes from a file.
pub fn keep_window_on_screen<R: Runtime>(app: &AppHandle<R>) {
    let _ = try_keep_on_screen(app);
}

fn try_keep_on_screen<R: Runtime>(app: &AppHandle<R>) -> tauri::Result<()> {
    // The app ships exactly one window. Its label and its minimum size are read
    // from the parsed tauri.conf.json rather than spelled again here, so this
    // cannot drift from the config it is enforcing.
    let config = app.config().clone();
    let Some(window_config) = config.app.windows.first() else {
        return Ok(());
    };
    let Some(window) = app.get_webview_window(&window_config.label) else {
        return Ok(());
    };

    let outer_position = window.outer_position()?;
    let outer_size = window.outer_size()?;
    let inner_size = window.inner_size()?;

    let scale = window.scale_factor()?;
    let scale = if scale.is_finite() && scale > 0.0 {
        scale
    } else {
        1.0
    };
    // The config minimums are INNER (content) sizes, while everything compared
    // against a work area is an OUTER rect, so the minimum carries the border.
    let border_width = outer_size.width.saturating_sub(inner_size.width);
    let border_height = outer_size.height.saturating_sub(inner_size.height);
    let frame = Frame {
        min_width: to_physical(window_config.min_width, scale).saturating_add(border_width),
        min_height: to_physical(window_config.min_height, scale).saturating_add(border_height),
        border_width,
        border_height,
        grab_strip: grab_strip(border_height, scale),
    };

    let live = LiveWindow {
        outer: Rect {
            x: outer_position.x,
            y: outer_position.y,
            width: outer_size.width,
            height: outer_size.height,
        },
        maximized: window.is_maximized()?,
        fullscreen: window.is_fullscreen()?,
    };

    let (work_areas, primary) = visible_work_areas(&window);
    let saved = saved_state(app, &window_config.label);
    let Some(target) = decide(saved, live, frame, &work_areas, primary) else {
        return Ok(());
    };

    // Size before position: on macOS setting the content size anchors the
    // window's TOP-left corner, so the Cocoa frame origin (its bottom-left)
    // moves as the height changes. Either way the write shifts the window, so
    // the position write has to come second to be authoritative. (This is the
    // opposite of the plugin's own order.) `set_size` takes the INNER size, so
    // the border comes back off here.
    window.set_size(PhysicalSize {
        width: target.width.saturating_sub(border_width),
        height: target.height.saturating_sub(border_height),
    })?;
    window.set_position(PhysicalPosition {
        x: target.x,
        y: target.y,
    })?;

    Ok(())
}

/// Every work area we can see, plus the primary one to center on as a fallback.
///
/// `available_monitors()` is the whole answer wherever it works. On macOS it
/// comes back empty (see the module docs), so NSScreen answers instead; and on
/// every platform the primary and current monitors are folded in afterwards, so
/// a future enumeration failure degrades to "the displays this window is
/// actually near" rather than to nothing at all.
fn visible_work_areas<R: Runtime>(
    window: &tauri::WebviewWindow<R>,
) -> (Vec<Rect>, Option<Rect>) {
    let mut areas: Vec<Rect> = window
        .available_monitors()
        .map(|monitors| monitors.iter().map(work_area_rect).collect())
        .unwrap_or_default();

    #[cfg(target_os = "macos")]
    if areas.is_empty() {
        areas = appkit_screens::work_areas();
    }

    let primary = window
        .primary_monitor()
        .ok()
        .flatten()
        .as_ref()
        .map(work_area_rect)
        .filter(Rect::is_usable);
    let current = window
        .current_monitor()
        .ok()
        .flatten()
        .as_ref()
        .map(work_area_rect)
        .filter(Rect::is_usable);
    for extra in [primary, current].into_iter().flatten() {
        if !areas.contains(&extra) {
            areas.push(extra);
        }
    }

    let fallback = primary.or_else(|| areas.iter().copied().find(Rect::is_usable));
    (areas, fallback)
}

/// The subset of the window-state plugin's on-disk record this module needs.
/// Unknown fields (`visible`, `decorated`) are ignored by serde, and a value out
/// of range for its type fails the whole parse — a corrupt file reads as "no
/// saved state", which is the safe answer.
#[derive(Clone, Copy, Debug, Deserialize, PartialEq, Eq)]
struct SavedState {
    #[serde(default)]
    width: u32,
    #[serde(default)]
    height: u32,
    #[serde(default)]
    x: i32,
    #[serde(default)]
    y: i32,
    #[serde(default)]
    maximized: bool,
    #[serde(default)]
    fullscreen: bool,
}

impl SavedState {
    /// The plugin restores only a non-default record; a zero size means it never
    /// captured a real geometry, and reapplying it would collapse the window.
    fn is_restorable(&self) -> bool {
        self.width > 0 && self.height > 0
    }
}

/// The plugin's saved record for `label`, or `None` if there is no readable one.
///
/// `try_state` rather than `app.path()`: `Manager::path` is
/// `state::<PathResolver>()`, which panics when unmanaged. Tauri registers its
/// own path plugin unconditionally, so the `None` arm is unreachable in a real
/// app — but this runs on the startup path under `panic = "abort"`, where the
/// cost of "unreachable today" is an app that never opens, and the `?` is one
/// character.
fn saved_state<R: Runtime>(app: &AppHandle<R>, label: &str) -> Option<SavedState> {
    let dir = app
        .try_state::<tauri::path::PathResolver<R>>()?
        .app_config_dir()
        .ok()?;
    let text = state_text_at(&dir.join(STATE_FILENAME))?;
    let states: HashMap<String, SavedState> = serde_json::from_str(&text).ok()?;
    states.get(label).copied()
}

/// The largest state document this module will load into memory.
///
/// The plugin writes one small object per window — six numeric and boolean
/// fields plus `prev_x`/`prev_y`, `visible` and `decorated`, about 150 bytes —
/// keyed by window label, and SnowRaven ships exactly one window. 16 KB is
/// therefore around a hundred windows' worth of headroom over anything real,
/// while still refusing a file whose size alone says the plugin did not write
/// it. It is deliberately the same number as `MAX_RECORD_BYTES` in `icloud.rs`:
/// one bound to remember for every native read of a document outside the app's
/// own sealed bundle.
const MAX_STATE_BYTES: u64 = 16 * 1024;

/// The text of the state file, or `None` for every shape this module refuses to
/// act on.
///
/// Deliberately the same read as `record_text_at` in `icloud.rs`, guard for
/// guard, because it is the same job: a native read of a document outside the
/// sealed bundle. `symlink_metadata` rather than `metadata`, so a symlink
/// planted at the name is SEEN instead of followed; `is_file()`, so a directory
/// or a device node is refused rather than opened; the real on-disk size bounded
/// before any allocation, because an unbounded read here allocates on the main
/// thread before the first frame and an allocation failure under
/// `panic = "abort"` is an app that will not open; and `from_utf8` rather than
/// `read_to_string`, so the byte-level check is explicit instead of incidental.
///
/// The two differ in exactly one way, and only because their callers do:
/// `record_text_at` maps a refused shape to the EMPTY string, because its caller
/// has to tell "planted" apart from "absent" in order to overwrite it. Here every
/// refusal collapses into `None`, which the caller already treats as "no saved
/// state" — the app opens at its configured default, the fail-closed answer for
/// all of them.
///
/// Two limits, stated rather than implied:
///
/// - This bounds what THIS module acts on. `tauri-plugin-window-state` reads the
///   same file first, in its own `setup`, with `serde_json::from_reader` over an
///   unbounded `File`, following symlinks and with no regular-file check. That
///   read cannot be fixed from here without forking or upstreaming it, so the
///   guarantee below is "we never act on a hostile record", not "the file is
///   safe to plant".
/// - The size is checked on the metadata rather than through a `Read::take`, so
///   a swap between the check and the read is not closed. That is the same
///   window `record_text_at` leaves open, and reaching it needs write access to
///   this directory, which already confers equivalent power.
fn state_text_at(path: &Path) -> Option<String> {
    let meta = std::fs::symlink_metadata(path).ok()?;
    if !meta.file_type().is_file() || meta.len() > MAX_STATE_BYTES {
        return None;
    }
    String::from_utf8(std::fs::read(path).ok()?).ok()
}

/// macOS screen enumeration through AppKit, because tao's is broken here.
#[cfg(target_os = "macos")]
mod appkit_screens {
    use super::Rect;
    use objc2_app_kit::NSScreen;
    use objc2_foundation::MainThreadMarker;

    /// Every screen's visible frame (menu bar and Dock already excluded), in the
    /// top-left physical-pixel space tauri reports window geometry in.
    pub(super) fn work_areas() -> Vec<Rect> {
        // Only callable from the main thread; `keep_window_on_screen` runs in
        // `setup()`, which is on it. Anywhere else this yields no screens and
        // the caller falls back to the primary/current monitors.
        let Some(mtm) = MainThreadMarker::new() else {
            return Vec::new();
        };
        let screens = NSScreen::screens(mtm);
        // AppKit guarantees index 0 is the screen carrying the menu bar, whose
        // frame origin is (0, 0). Its height is the origin of the Cocoa
        // coordinate system and therefore the pivot for the flip below.
        let Some(first) = screens.iter().next() else {
            return Vec::new();
        };
        let pivot = first.frame().size.height;
        screens
            .iter()
            .filter_map(|screen| {
                let visible = screen.visibleFrame();
                to_top_left(
                    (
                        visible.origin.x,
                        visible.origin.y,
                        visible.size.width,
                        visible.size.height,
                    ),
                    pivot,
                    screen.backingScaleFactor(),
                )
            })
            .collect()
    }

    /// Convert one Cocoa rect (bottom-left origin, points) into a top-left
    /// physical-pixel `Rect`.
    ///
    /// Validated against tao's own `primary_monitor()` on macOS 26.6: NSScreen
    /// reported a primary frame 982pt tall with `visibleFrame` (73, 0) 1439x949
    /// at scale 2, and this converts it to `x=146 y=66 2878x1898`, which is
    /// exactly what tao reported for the same work area. Anything non-finite or
    /// empty yields `None` rather than a nonsense rect.
    pub(super) fn to_top_left(
        rect: (f64, f64, f64, f64),
        pivot: f64,
        scale: f64,
    ) -> Option<Rect> {
        let (x, y, width, height) = rect;
        if ![x, y, width, height, pivot].iter().all(|v| v.is_finite()) {
            return None;
        }
        let scale = if scale.is_finite() && scale > 0.0 {
            scale
        } else {
            1.0
        };
        let top = pivot - (y + height);
        let (width, height) = ((width * scale).round(), (height * scale).round());
        if width <= 0.0 || height <= 0.0 {
            return None;
        }
        Some(Rect {
            x: (x * scale).round().clamp(i32::MIN as f64, i32::MAX as f64) as i32,
            y: (top * scale).round().clamp(i32::MIN as f64, i32::MAX as f64) as i32,
            width: width.min(u32::MAX as f64) as u32,
            height: height.min(u32::MAX as f64) as u32,
        })
    }
}

/// A monitor's work area, falling back to its full rect when the platform
/// leaves the work area unset. The full rect can only be larger, never smaller,
/// so the fallback errs toward leaving the window alone.
fn work_area_rect(monitor: &Monitor) -> Rect {
    let area = monitor.work_area();
    if area.size.width > 0 && area.size.height > 0 {
        return Rect {
            x: area.position.x,
            y: area.position.y,
            width: area.size.width,
            height: area.size.height,
        };
    }
    let position = monitor.position();
    let size = monitor.size();
    Rect {
        x: position.x,
        y: position.y,
        width: size.width,
        height: size.height,
    }
}

/// How much of the window's top edge must stay visible, in physical pixels.
///
/// The measured decoration when that is bigger (Windows), and otherwise the
/// `MIN_GRAB_STRIP_POINTS` floor scaled — which is what actually applies on
/// macOS, where the measured border is structurally zero. Without the floor this
/// guard shrinks to a single pixel and a window restored with only its top row
/// on screen reads as perfectly fine.
fn grab_strip(border_height: u32, scale: f64) -> u32 {
    border_height.max(to_physical(Some(MIN_GRAB_STRIP_POINTS), scale))
}

/// A configured logical dimension in physical pixels; 0 when unset or absurd
/// (which means "no floor on this axis" to the fit).
fn to_physical(logical: Option<f64>, scale: f64) -> u32 {
    logical
        .filter(|v| v.is_finite() && *v > 0.0)
        .map(|v| (v * scale).round().clamp(0.0, u32::MAX as f64) as u32)
        .unwrap_or(0)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// A plain 1920x1080 display with a 40px reserved strip along the top,
    /// standing in for a macOS menu bar or a Windows taskbar.
    const MAIN: Rect = Rect {
        x: 0,
        y: 40,
        width: 1920,
        height: 1040,
    };
    /// A large external display sitting to the right of MAIN, tops aligned at 0.
    const EXTERNAL: Rect = Rect {
        x: 1920,
        y: 0,
        width: 3840,
        height: 2160,
    };

    /// 800x600 logical minimums at 1x, plus a 22px border and the 32pt grab
    /// strip. Border and strip differ on purpose: on macOS the border really is
    /// smaller than the bar (zero, in fact), and a fixture that conflated them
    /// could not tell the two apart.
    const FRAME: Frame = Frame {
        min_width: 800,
        min_height: 622,
        border_width: 0,
        border_height: 22,
        grab_strip: 32,
    };

    #[test]
    fn visible_and_decorations_are_never_persisted() {
        // The unrecoverable case: a persisted `visible: false` relaunches the
        // app with no window. This guard is the reason the flag set is a named
        // constant instead of four flags typed at the registration site.
        assert!(!PERSISTED_STATE.contains(StateFlags::VISIBLE));
        assert!(!PERSISTED_STATE.contains(StateFlags::DECORATIONS));
        assert!(PERSISTED_STATE.contains(StateFlags::SIZE));
        assert!(PERSISTED_STATE.contains(StateFlags::POSITION));
        assert!(PERSISTED_STATE.contains(StateFlags::MAXIMIZED));
        assert!(PERSISTED_STATE.contains(StateFlags::FULLSCREEN));
        // And the plugin's default must never silently become ours: a future
        // version adding a flag to `all()` would otherwise arrive unnoticed.
        assert_ne!(PERSISTED_STATE.bits(), StateFlags::all().bits());
    }

    fn rect(x: i32, y: i32, width: u32, height: u32) -> Rect {
        Rect {
            x,
            y,
            width,
            height,
        }
    }

    /// Place against `areas`, treating the first as primary.
    fn place(window: Rect, areas: &[Rect]) -> Option<Rect> {
        place_on_screen(window, areas, areas.first().copied(), FRAME)
    }

    // -- the leave-it-alone cases -------------------------------------------
    // These matter more than the repairs: an over-eager correction moves a
    // window the user positioned on purpose, on a machine whose displays never
    // changed, on every single launch.

    #[test]
    fn a_window_already_on_screen_is_left_alone() {
        assert_eq!(place(rect(200, 140, 1100, 720), &[MAIN]), None);
    }

    #[test]
    fn a_window_flush_against_the_work_area_edges_is_left_alone() {
        let window = rect(1920 - 1100, 40 + 1040 - 720, 1100, 720);
        assert_eq!(place(window, &[MAIN]), None);
    }

    #[test]
    fn a_window_hanging_over_the_dock_is_left_alone() {
        // macOS: work_area is visibleFrame, which excludes the Dock, but a
        // window may legitimately be dragged down over it. A full-containment
        // rule would shove this window upward on every relaunch; the title bar
        // is on screen, so nothing here is broken.
        let window = rect(300, 700, 1100, 720);
        assert!(window.bottom() > MAIN.bottom());
        assert_eq!(place(window, &[MAIN]), None);
    }

    #[test]
    fn a_window_straddling_two_displays_is_left_alone() {
        // Every pixel is visible across the pair. Sliding it wholly onto one
        // monitor would be a new defect, not a fix.
        assert_eq!(place(rect(1800, 300, 1100, 720), &[MAIN, EXTERNAL]), None);
        assert_eq!(place(rect(900, 300, 1100, 720), &[MAIN, EXTERNAL]), None);
    }

    #[test]
    fn a_window_wider_than_its_own_monitor_but_covered_by_the_pair_is_left_alone() {
        // 2500px wide, mostly on the 1920px MAIN, with the remainder on
        // EXTERNAL. Oversized for its own monitor, rescued by its neighbour.
        let window = rect(1000, 300, 2500, 720);
        assert!(window.width > MAIN.width);
        assert_eq!(place(window, &[MAIN, EXTERNAL]), None);
    }

    // -- the repairs --------------------------------------------------------

    #[test]
    fn a_title_bar_above_the_desktop_is_pushed_down_into_the_work_area() {
        // The Windows-fatal case: above the work area top means the bar is
        // under the taskbar or off the desktop entirely and cannot be grabbed.
        let placed = place(rect(300, -260, 1100, 720), &[MAIN]).unwrap();
        assert_eq!(placed, rect(300, MAIN.y, 1100, 720));
    }

    #[test]
    fn a_title_bar_only_partly_on_screen_is_pushed_fully_on() {
        // Dragged off the right edge until only a sliver of the bar is left.
        // The window overlaps MAIN, so this is the repair path, not the
        // centering fallback.
        let placed = place(rect(1850, 300, 1100, 720), &[MAIN]).unwrap();
        assert_eq!(placed, rect(1920 - 1100, 300, 1100, 720));
    }

    #[test]
    fn a_title_bar_below_the_work_area_takes_the_centering_fallback() {
        // Worth pinning as its own property: because a window extends DOWNWARD
        // from its title bar, a bar below the work area's bottom means the whole
        // window is below it, so there is no monitor to slide back into and the
        // fallback is the only correct answer. A window merely hanging off the
        // bottom keeps its bar on screen and is covered by the Dock case above.
        let window = rect(300, 1100, 1100, 720);
        assert_eq!(best_overlap(window, &[MAIN]), None);
        assert_eq!(
            place(window, &[MAIN]),
            Some(rect((1920 - 1100) / 2, 40 + (1040 - 720) / 2, 1100, 720))
        );
    }

    #[test]
    fn a_title_bar_hanging_off_the_bottom_by_less_than_its_own_height_is_still_corrected() {
        // The case that gives the title bar's HEIGHT its meaning. At y=1070 the
        // window's top row is on the work area (which ends at 1080) but the rest
        // of the bar is not, leaving a 10px sliver to grab. A one-pixel probe
        // reads this as fine; the real bar height reads it as stranded.
        let window = rect(300, 1070, 1100, 720);
        assert!(is_covered(title_bar_strip(window, 1), &[MAIN]));
        assert!(!is_covered(
            title_bar_strip(window, FRAME.grab_strip),
            &[MAIN]
        ));
        assert_eq!(place(window, &[MAIN]), Some(rect(300, 40 + 1040 - 720, 1100, 720)));
    }

    #[test]
    fn a_window_larger_than_the_only_display_shrinks_to_its_work_area() {
        // Saved on the 4K external, restored with only the laptop present.
        let placed = place(rect(0, 0, 3400, 2000), &[MAIN]).unwrap();
        assert_eq!(placed, rect(MAIN.x, MAIN.y, MAIN.width, MAIN.height));
    }

    #[test]
    fn a_window_taller_than_its_monitor_with_a_visible_title_bar_still_shrinks() {
        // The title bar is fine, so only the size rule can catch this: 2000px
        // tall on a 1040px-tall work area, with no neighbour covering the rest.
        let placed = place(rect(200, 100, 1100, 2000), &[MAIN]).unwrap();
        assert_eq!(placed, rect(200, MAIN.y, 1100, MAIN.height));
    }

    #[test]
    fn shrinking_never_goes_below_the_configured_minimums() {
        // A work area smaller than the minimum window: the minimum wins and the
        // window pins to the ORIGIN, so the title bar stays reachable even
        // though the window overhangs the bottom right.
        let tiny = rect(0, 0, 640, 480);
        let placed = place_on_screen(rect(100, 100, 1100, 720), &[tiny], Some(tiny), FRAME).unwrap();
        assert_eq!(placed, rect(0, 0, FRAME.min_width, FRAME.min_height));
    }

    // -- the detached-display fallback --------------------------------------

    #[test]
    fn a_window_on_a_detached_display_is_centered_on_the_primary() {
        let placed = place(rect(2400, 500, 1100, 720), &[MAIN]).unwrap();
        assert_eq!(
            placed,
            rect((1920 - 1100) / 2, 40 + (1040 - 720) / 2, 1100, 720)
        );
    }

    #[test]
    fn the_detached_display_fallback_also_shrinks_to_fit() {
        // Centering alone would leave the window larger than the display it
        // opens on, which is the other half of "what done looks like".
        let placed = place(rect(2400, 2400, 3400, 2000), &[MAIN]).unwrap();
        assert_eq!(placed, rect(MAIN.x, MAIN.y, MAIN.width, MAIN.height));
    }

    #[test]
    fn the_fallback_prefers_the_primary_over_enumeration_order() {
        let placed = place_on_screen(
            rect(-5000, -5000, 1100, 720),
            &[MAIN, EXTERNAL],
            Some(EXTERNAL),
            FRAME,
        )
        .unwrap();
        assert_eq!(
            placed,
            rect(1920 + (3840 - 1100) / 2, (2160 - 720) / 2, 1100, 720)
        );
    }

    // -- degenerate and hostile input ---------------------------------------

    #[test]
    fn a_degenerate_work_area_is_not_a_monitor() {
        // A platform that leaves work_area unset reports zeros. Clamping into a
        // 0x0 box would park the window at a corner with no size.
        let empty = rect(0, 0, 0, 0);
        assert_eq!(
            place_on_screen(rect(200, 140, 1100, 720), &[empty, MAIN], Some(empty), FRAME),
            None
        );
        // ...and it must not be mistaken for coverage either: a window that is
        // genuinely off-screen still gets repaired when a real monitor exists.
        assert!(
            place_on_screen(rect(300, -260, 1100, 720), &[empty, MAIN], Some(empty), FRAME)
                .is_some()
        );
    }

    #[test]
    fn no_usable_monitor_means_leave_the_window_alone() {
        assert_eq!(place_on_screen(rect(0, 0, 1100, 720), &[], None, FRAME), None);
        let empty = rect(0, 0, 0, 0);
        assert_eq!(
            place_on_screen(rect(0, 0, 1100, 720), &[empty], Some(empty), FRAME),
            None
        );
    }

    #[test]
    fn extreme_coordinates_do_not_overflow() {
        // A corrupt or hostile .window-state.json is untrusted input, and a
        // panic in setup would take the app down before it ever painted.
        let far = rect(i32::MAX - 10, i32::MIN + 10, u32::MAX, u32::MAX);
        let placed = place_on_screen(far, &[MAIN, EXTERNAL], Some(MAIN), FRAME).unwrap();
        assert_eq!(placed, rect(MAIN.x, MAIN.y, MAIN.width, MAIN.height));

        let wide = rect(i32::MIN, i32::MIN, u32::MAX, u32::MAX);
        assert!(place_on_screen(wide, &[MAIN], Some(MAIN), FRAME).is_some());
    }

    #[test]
    fn a_zero_sized_window_is_grown_to_the_minimum_rather_than_left_at_nothing() {
        let placed = place_on_screen(rect(0, 40, 0, 0), &[MAIN], Some(MAIN), FRAME);
        // A 0x0 rect overlaps nothing, so it takes the centering fallback.
        let placed = placed.unwrap();
        assert_eq!((placed.width, placed.height), (FRAME.min_width, FRAME.min_height));
    }

    // -- the primitives -----------------------------------------------------

    #[test]
    fn overlap_area_is_symmetric_and_zero_when_disjoint() {
        let a = rect(0, 0, 100, 100);
        let b = rect(50, 50, 100, 100);
        assert_eq!(a.overlap_area(&b), 50 * 50);
        assert_eq!(b.overlap_area(&a), 50 * 50);
        // Touching edges are not an overlap: a window whose right edge is
        // exactly the monitor's left edge has no pixel on it.
        assert_eq!(a.overlap_area(&rect(100, 0, 100, 100)), 0);
    }

    #[test]
    fn overlap_is_measured_by_area_not_by_a_corner() {
        // The exact gap the plugin's own guard leaves: one corner on a monitor
        // is enough for it. Here a single pixel column of the window touches
        // MAIN while the body sits on EXTERNAL.
        let window = rect(1919, 300, 1100, 720);
        assert_eq!(best_overlap(window, &[MAIN, EXTERNAL]), Some(EXTERNAL));
        assert!(window.overlap_area(&MAIN) > 0);
    }

    #[test]
    fn an_exact_overlap_tie_breaks_toward_the_earlier_monitor() {
        // Two same-size work areas side by side, window split exactly down the
        // seam. Either answer is defensible; what is not defensible is the
        // answer changing between launches because enumeration order did.
        let left = rect(0, 0, 1000, 1000);
        let right = rect(1000, 0, 1000, 1000);
        let window = rect(500, 100, 1000, 500);
        assert_eq!(window.overlap_area(&left), window.overlap_area(&right));
        assert_eq!(best_overlap(window, &[left, right]), Some(left));
        assert_eq!(best_overlap(window, &[right, left]), Some(right));
    }

    #[test]
    fn coverage_spans_the_seam_between_two_monitors() {
        // The property the straddle cases rest on. Guard it directly too, so a
        // regression localizes here rather than in a placement assertion.
        assert!(is_covered(rect(1800, 300, 1100, 720), &[MAIN, EXTERNAL]));
        assert!(is_covered(rect(1919, 40, 2, 2), &[MAIN, EXTERNAL]));
    }

    #[test]
    fn coverage_sees_a_gap_between_two_monitors() {
        // Same seam, but the neighbour has been moved away: the strip between
        // them is dead space and must not read as covered.
        let far_right = Rect { x: 2400, ..EXTERNAL };
        assert!(!is_covered(rect(1800, 300, 1100, 720), &[MAIN, far_right]));
        // And a window that only reaches the gap's near side is still fine.
        assert!(is_covered(rect(800, 300, 1100, 720), &[MAIN, far_right]));
    }

    #[test]
    fn coverage_sees_dead_space_where_two_monitors_do_not_align_vertically() {
        // MAIN's work area starts at y=40, EXTERNAL's at y=0. A window in the
        // top 40px straddling the seam has pixels over nothing on the left.
        assert!(!is_covered(rect(1900, 0, 100, 100), &[MAIN, EXTERNAL]));
        assert!(is_covered(rect(1920, 0, 100, 100), &[MAIN, EXTERNAL]));
    }

    #[test]
    fn coverage_of_a_rect_wholly_outside_every_area_is_false() {
        assert!(!is_covered(rect(-5000, -5000, 100, 100), &[MAIN, EXTERNAL]));
        assert!(!is_covered(rect(0, 0, 100, 100), &[]));
    }

    #[test]
    fn a_title_bar_strip_is_at_least_one_pixel_and_never_taller_than_its_window() {
        let window = rect(10, 20, 100, 8);
        assert_eq!(title_bar_strip(window, 22).height, 8);
        assert_eq!(title_bar_strip(window, 0).height, 1);
        assert_eq!(title_bar_strip(rect(10, 20, 100, 720), 22).height, 22);
        // The strip keeps the window's own x/y/width: it is the top edge, full
        // width, which is what has to be grabbable.
        let strip = title_bar_strip(rect(10, 20, 100, 720), 22);
        assert_eq!((strip.x, strip.y, strip.width), (10, 20, 100));
    }

    // -- the decision: saved record + live window -> what to write ------------
    // These cover the judgements a geometry assertion cannot see. Each of the
    // first two encodes a trap that produced a real defect during development.

    fn saved(x: i32, y: i32, width: u32, height: u32) -> SavedState {
        SavedState {
            width,
            height,
            x,
            y,
            maximized: false,
            fullscreen: false,
        }
    }

    fn live(rect: Rect) -> LiveWindow {
        LiveWindow {
            outer: rect,
            maximized: false,
            fullscreen: false,
        }
    }

    /// The window as the OS placed it on a fresh launch, before any restore.
    const DEFAULT_PLACEMENT: Rect = Rect {
        x: 484,
        y: 182,
        width: 1100,
        height: 720,
    };

    fn decide_on_main(saved: Option<SavedState>, live: LiveWindow) -> Option<Rect> {
        decide(saved, live, FRAME, &[MAIN], Some(MAIN))
    }

    #[test]
    fn a_saved_maximized_record_is_honoured_even_though_the_live_window_denies_it() {
        // The trap: on macOS the plugin's maximize() has not landed yet, so the
        // live window still answers `maximized: false`. Believing it and writing
        // a size here un-maximizes the window a moment later, which is exactly
        // the bug this reads the saved record to avoid.
        let record = SavedState {
            maximized: true,
            ..saved(300, 200, 1100, 720)
        };
        assert!(!live(DEFAULT_PLACEMENT).maximized);
        assert_eq!(decide_on_main(Some(record), live(DEFAULT_PLACEMENT)), None);

        let record = SavedState {
            fullscreen: true,
            ..saved(300, 200, 1100, 720)
        };
        assert_eq!(decide_on_main(Some(record), live(DEFAULT_PLACEMENT)), None);
    }

    #[test]
    fn a_saved_on_screen_rect_is_written_even_though_no_correction_is_needed() {
        // The other half of the same trap. The live window still reports the
        // config default, so "nothing to correct" must NOT mean "nothing to do":
        // on macOS this write is the only thing that reapplies the position.
        let record = saved(300, 200, 1100, 720);
        // The saved size is INNER, so the outer rect carries FRAME's 22px border.
        let outer = rect(300, 200, 1100, 720 + FRAME.border_height);
        assert_eq!(place(outer, &[MAIN]), None);
        assert_eq!(decide_on_main(Some(record), live(DEFAULT_PLACEMENT)), Some(outer));
    }

    #[test]
    fn the_saved_rect_is_judged_rather_than_the_stale_live_one() {
        // The live window is perfectly placed; the saved record is off-screen.
        // Judging the live rect would return None and restore the window to
        // somewhere unreachable.
        let record = saved(9000, 9000, 1100, 720);
        let outer = rect(9000, 9000, 1100, 720 + FRAME.border_height);
        assert_eq!(place(DEFAULT_PLACEMENT, &[MAIN]), None);
        let target = decide_on_main(Some(record), live(DEFAULT_PLACEMENT)).unwrap();
        assert_eq!(target, place(outer, &[MAIN]).unwrap());
    }

    #[test]
    fn a_saved_inner_size_becomes_an_outer_rect_through_the_border() {
        let frame = Frame {
            border_width: 16,
            border_height: 38,
            ..FRAME
        };
        let target = decide(
            Some(saved(300, 200, 1000, 700)),
            live(DEFAULT_PLACEMENT),
            frame,
            &[MAIN],
            Some(MAIN),
        )
        .unwrap();
        assert_eq!(target, rect(300, 200, 1016, 738));
    }

    #[test]
    fn a_saved_size_below_the_configured_minimum_is_floored() {
        // A 1x1 record at an on-screen position needs no correction, so before
        // the floor moved into `decide` it was written back verbatim and the
        // window manager grew the window to the minimum around a position
        // computed for a 1x1 rect. The minimum now holds on every path that
        // sets a size, not only the clamping one.
        let target = decide_on_main(Some(saved(300, 200, 1, 1)), live(DEFAULT_PLACEMENT)).unwrap();
        assert_eq!(target, rect(300, 200, FRAME.min_width, FRAME.min_height));
        // One axis at a time, so a floor applied to only one is not silently
        // passed by a fixture that is small on both.
        let target = decide_on_main(Some(saved(300, 200, 40, 720)), live(DEFAULT_PLACEMENT)).unwrap();
        assert_eq!(target, rect(300, 200, FRAME.min_width, 720 + FRAME.border_height));
        let target = decide_on_main(Some(saved(300, 200, 1100, 40)), live(DEFAULT_PLACEMENT)).unwrap();
        assert_eq!(target, rect(300, 200, 1100, FRAME.min_height));
        // And it is a floor, not a resize: an ordinary record is untouched.
        assert_eq!(
            decide_on_main(Some(saved(300, 200, 1100, 720)), live(DEFAULT_PLACEMENT)),
            Some(rect(300, 200, 1100, 720 + FRAME.border_height))
        );
    }

    #[test]
    fn a_first_run_with_no_saved_record_is_left_completely_alone() {
        // Nothing to reapply and nothing wrong: any write here would be a
        // pointless nudge on every first launch.
        assert_eq!(decide_on_main(None, live(DEFAULT_PLACEMENT)), None);
    }

    #[test]
    fn with_no_saved_record_a_broken_live_window_is_still_corrected() {
        let stranded = rect(300, -260, 1100, 720);
        assert_eq!(
            decide_on_main(None, live(stranded)),
            place(stranded, &[MAIN])
        );
    }

    #[test]
    fn with_no_saved_record_the_live_maximized_flag_is_what_there_is_to_go_on() {
        let maximized = LiveWindow {
            maximized: true,
            ..live(rect(300, -260, 1100, 720))
        };
        assert_eq!(decide_on_main(None, maximized), None);
    }

    #[test]
    fn an_unrestorable_saved_record_is_treated_as_no_record_at_all() {
        // A zero-size record must not collapse the window, and must not suppress
        // the live-window correction either.
        let empty = saved(300, 200, 0, 0);
        assert_eq!(decide_on_main(Some(empty), live(DEFAULT_PLACEMENT)), None);
        let stranded = rect(300, -260, 1100, 720);
        assert_eq!(
            decide_on_main(Some(empty), live(stranded)),
            place(stranded, &[MAIN])
        );
        // ...including its maximized flag, which cannot be trusted either.
        let empty_max = SavedState {
            maximized: true,
            ..empty
        };
        assert_eq!(
            decide_on_main(Some(empty_max), live(stranded)),
            place(stranded, &[MAIN])
        );
    }

    // -- the plugin's on-disk record -----------------------------------------

    fn parse(json: &str) -> Option<SavedState> {
        serde_json::from_str::<HashMap<String, SavedState>>(json)
            .ok()?
            .get("main")
            .copied()
    }

    #[test]
    fn a_real_plugin_record_parses_and_ignores_the_fields_we_do_not_use() {
        // Verbatim shape written by tauri-plugin-window-state 2.4.1.
        let state = parse(
            r#"{"main":{"width":2000,"height":1500,"x":300,"y":200,"prev_x":484,
               "prev_y":296,"maximized":false,"visible":true,"decorated":true,
               "fullscreen":false}}"#,
        )
        .unwrap();
        assert_eq!(
            state,
            SavedState {
                width: 2000,
                height: 1500,
                x: 300,
                y: 200,
                maximized: false,
                fullscreen: false
            }
        );
        assert!(state.is_restorable());
    }

    #[test]
    fn a_zero_sized_or_missing_record_is_not_restorable() {
        // The plugin writes an all-default record for a window it is tracking
        // but has never seen a real geometry for; reapplying it would collapse
        // the window to nothing.
        let state = parse(r#"{"main":{"width":0,"height":0,"x":0,"y":0}}"#).unwrap();
        assert!(!state.is_restorable());
        assert_eq!(parse(r#"{"other":{"width":10,"height":10}}"#), None);
    }

    #[test]
    fn a_corrupt_record_reads_as_no_saved_state_rather_than_a_wrong_one() {
        // Fails closed in every direction: truncated JSON, a value out of range
        // for its type, and a wrong-typed field all yield None, so the app
        // starts at its configured default instead of somewhere invented.
        assert_eq!(parse("{\"main\":{\"width\":200"), None);
        assert_eq!(parse(r#"{"main":{"width":99999999999999,"height":10}}"#), None);
        assert_eq!(parse(r#"{"main":{"width":-5,"height":10}}"#), None);
        assert_eq!(parse(r#"{"main":{"width":"wide","height":10}}"#), None);
        assert_eq!(parse("not json at all"), None);
        // A partial record still reads, with the missing fields defaulted.
        assert_eq!(
            parse(r#"{"main":{"width":1200,"height":800}}"#),
            Some(SavedState {
                width: 1200,
                height: 800,
                x: 0,
                y: 0,
                maximized: false,
                fullscreen: false
            })
        );
    }

    #[test]
    fn the_state_filename_is_the_plugins_own_and_stays_a_dotfile() {
        // Both ends of the coupling: this constant is what lib.rs hands
        // `with_filename`, and what `saved_state` reads back. Pinned against the
        // plugin's own default so an upstream rename arrives as a failing test
        // rather than as an app that silently stops remembering its window.
        assert_eq!(STATE_FILENAME, tauri_plugin_window_state::DEFAULT_FILENAME);
        // The leading dot is load-bearing, not cosmetic. On unix
        // tauri-plugin-fs defaults `require_literal_leading_dot` to true, and on
        // macOS `app_config_dir()` IS `app_local_data_dir()`, so the dot is the
        // only thing keeping this file out of the webview's granted
        // `$APPLOCALDATA/**` write scope.
        assert!(STATE_FILENAME.starts_with('.'));
    }

    #[test]
    fn the_state_file_read_refuses_every_shape_it_must_not_act_on() {
        use std::fs;
        let dir = std::env::temp_dir().join(format!("sr-window-state-{}", std::process::id()));
        let _ = fs::remove_dir_all(&dir);
        fs::create_dir_all(&dir).unwrap();
        let path = dir.join(STATE_FILENAME);
        let record = r#"{"main":{"width":1100,"height":720,"x":300,"y":200}}"#;

        // Nothing at the path at all: absent, which is "no saved state".
        assert_eq!(state_text_at(&path), None);

        // A real record reads as its text and still parses.
        fs::write(&path, record).unwrap();
        assert_eq!(state_text_at(&path).as_deref(), Some(record));
        assert!(parse(&state_text_at(&path).unwrap()).unwrap().is_restorable());

        // A directory planted at the name is refused rather than opened.
        fs::remove_file(&path).unwrap();
        fs::create_dir_all(&path).unwrap();
        fs::write(path.join("inner.json"), record).unwrap();
        assert_eq!(state_text_at(&path), None);
        fs::remove_dir_all(&path).unwrap();

        // A symlink is SEEN, not followed: the target's contents never reach the
        // parser, even though the target is a perfectly good record.
        #[cfg(unix)]
        {
            let real = dir.join("real.json");
            fs::write(&real, record).unwrap();
            std::os::unix::fs::symlink(&real, &path).unwrap();
            assert_eq!(state_text_at(&path), None);
            assert_eq!(state_text_at(&real).as_deref(), Some(record));
            // Refusing it is not deleting it: the link and its target survive.
            assert!(fs::symlink_metadata(&path).is_ok());
            assert!(real.exists());
            fs::remove_file(&path).unwrap();
        }

        // Past the size bound: refused on the metadata, never loaded. Exactly at
        // the bound still reads, so this is the bound and not an off-by-one.
        fs::write(&path, vec![b' '; (MAX_STATE_BYTES + 1) as usize]).unwrap();
        assert_eq!(state_text_at(&path), None);
        fs::write(&path, vec![b' '; MAX_STATE_BYTES as usize]).unwrap();
        assert_eq!(
            state_text_at(&path).map(|t| t.len() as u64),
            Some(MAX_STATE_BYTES)
        );

        // Non-UTF-8 bytes read as absent rather than as lossy nonsense.
        fs::write(&path, [0xff, 0xfe, b'{', b'}']).unwrap();
        assert_eq!(state_text_at(&path), None);

        let _ = fs::remove_dir_all(&dir);
    }

    // -- the macOS Cocoa flip -------------------------------------------------

    #[cfg(target_os = "macos")]
    #[test]
    fn the_cocoa_flip_reproduces_taos_own_primary_work_area() {
        // The measurement this conversion was validated against, kept as a test
        // so a future edit cannot quietly change the formula: NSScreen reported
        // a 982pt-tall primary with visibleFrame (73,0) 1439x949 at scale 2, and
        // tao's primary_monitor() reported work=146,66 2878x1898 for it.
        assert_eq!(
            appkit_screens::to_top_left((73.0, 0.0, 1439.0, 949.0), 982.0, 2.0),
            Some(rect(146, 66, 2878, 1898))
        );
        // At 1x the same screen converts without scaling.
        assert_eq!(
            appkit_screens::to_top_left((73.0, 0.0, 1439.0, 949.0), 982.0, 1.0),
            Some(rect(73, 33, 1439, 949))
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn the_cocoa_flip_places_a_screen_above_and_below_the_primary() {
        // Cocoa y grows upward, so a screen ABOVE the primary has a positive
        // origin and must come back with a NEGATIVE top-left y. Getting this
        // backwards is the classic flip bug and is invisible on one display.
        assert_eq!(
            appkit_screens::to_top_left((0.0, 982.0, 1920.0, 1080.0), 982.0, 1.0),
            Some(rect(0, -1080, 1920, 1080))
        );
        // ...and one below it has a negative origin and a positive y.
        assert_eq!(
            appkit_screens::to_top_left((0.0, -1080.0, 1920.0, 1080.0), 982.0, 1.0),
            Some(rect(0, 982, 1920, 1080))
        );
    }

    #[cfg(target_os = "macos")]
    #[test]
    fn the_cocoa_flip_refuses_nonsense_rather_than_inventing_a_rect() {
        assert_eq!(
            appkit_screens::to_top_left((0.0, 0.0, 0.0, 100.0), 982.0, 2.0),
            None
        );
        assert_eq!(
            appkit_screens::to_top_left((0.0, 0.0, 100.0, f64::NAN), 982.0, 2.0),
            None
        );
        assert_eq!(
            appkit_screens::to_top_left((f64::INFINITY, 0.0, 100.0, 100.0), 982.0, 2.0),
            None
        );
        // A nonsense scale falls back to 1x rather than producing a zero rect.
        assert_eq!(
            appkit_screens::to_top_left((0.0, 0.0, 100.0, 100.0), 100.0, 0.0),
            Some(rect(0, 0, 100, 100))
        );
    }

    #[test]
    fn the_grab_strip_is_a_floor_not_the_measured_border() {
        // macOS: the measured border is zero, so the floor is the whole guard.
        assert_eq!(grab_strip(0, 2.0), 64);
        assert_eq!(grab_strip(0, 1.0), 32);
        assert_eq!(grab_strip(0, 1.5), 48);
        // Windows: a caption taller than the floor wins, because it is real.
        assert_eq!(grab_strip(80, 1.0), 80);
        // ...but one shorter than the floor does not shrink the guard.
        assert_eq!(grab_strip(8, 1.0), 32);
    }

    #[test]
    fn a_logical_minimum_scales_to_physical_pixels() {
        assert_eq!(to_physical(Some(800.0), 2.0), 1600);
        assert_eq!(to_physical(Some(800.0), 1.0), 800);
        assert_eq!(to_physical(Some(800.0), 1.5), 1200);
        // Unset or nonsensical means "no floor", never a panic or a wrap.
        assert_eq!(to_physical(None, 2.0), 0);
        assert_eq!(to_physical(Some(-1.0), 2.0), 0);
        assert_eq!(to_physical(Some(f64::NAN), 2.0), 0);
        assert_eq!(to_physical(Some(f64::INFINITY), 2.0), 0);
        assert_eq!(to_physical(Some(f64::MAX), 2.0), u32::MAX);
    }
}
