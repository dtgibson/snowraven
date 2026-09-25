# Why this crate is vendored

This is a copy of `tao` 0.35.3 from crates.io with **two separate changes**, applied
via `[patch.crates-io]` in `src-tauri/Cargo.toml`: the one-line use-after-free fix
below (tauri-apps/tao#1245), and, since ios-lifer-widgets, the cold-start URL
forward in `scene.rs` described in the second section. Each is independent of the
other; a refresh of this directory must carry both.

## Change 1: the UISceneConfiguration use-after-free

`src/platform_impl/ios/view.rs:646`, inside `configuration_for_connecting_scene_session`:

    - Retained::as_ptr(&config) as _
    + Retained::autorelease_ptr(config) as _

This is upstream https://github.com/tauri-apps/tao/pull/1245 ("fix(ios): use
autorelease_ptr to fix UISceneConfiguration crash"), merged to tao's `dev` on
2026-06-30 and first released in tao 0.36.0.

## Why it is vendored rather than upgraded

`tauri-runtime-wry` requires `tao = "0.35.0"` (i.e. `^0.35`) in every published
Tauri 2.x, up to and including 2.11.4/2.11.5. tao 0.36.0 and 0.37.0 are outside
that range, so no Tauri 2.x release can ever pull the fix in, and a
`[patch.crates-io]` must itself satisfy `^0.35`. At the fix commit the crate still
declared 0.35.3, so this copy does too.

## What it fixes

Without it, an iOS **release** build with `UIApplicationSceneManifest` enabled
crashes on launch: `config` is a local `Retained` dropped at function exit, so
UIKit receives a freed `UISceneConfiguration`. The optimizer makes it reliable in
release, which is why debug and simulator builds launch fine. Upstream issue:
tauri-apps/tao#1244. SnowRaven hit this in 1.0.31, the first build to ship the
scene manifest (b472ae8) and the first built against the iOS 27 SDK.

Only line 646 is changed for this fix. The other `Retained::as_ptr` uses in that
file (544, 555, 849) pass a pointer while the `Retained` is still alive in scope and
are deliberately left alone, matching upstream's diff exactly.

## Change 2: cold-start URL delivery (ios-lifer-widgets)

`src/platform_impl/ios/scene.rs`, inside `scene_willConnectToSession_options`, right
after the existing `app_state::connect_scene(scene, connection_options)` call:

    + let contexts: Option<Retained<NSSet<UIOpenURLContext>>> =
    +   objc2::msg_send![connection_options, URLContexts];
    + let urls: Vec<url::Url> = contexts
    +   .map(|set| set.iter().filter_map(|ctx| {
    +     ctx.URL().absoluteString().and_then(|s| s.to_string().parse().ok())
    +   }).collect())
    +   .unwrap_or_default();
    + if !urls.is_empty() {
    +   app_state::handle_nonuser_event(EventWrapper::StaticEvent(Event::Opened { urls }));
    + }

**Read `URLContexts` through the Option-typed `msg_send!`, never through the generated
`UISceneConnectionOptions::URLContexts()` binding.** That binding declares a
NON-optional return, UIKit returns nil when a scene connects with no URL (every
ordinary launch), and objc2 panics on the nil; inside an Objective-C callback the
panic cannot unwind, so the app aborts on every launch. This was built that way
first and caught on an iOS 27.0 simulator by a SCREENSHOT of the home screen where
the app should have been (a process check would have seen a launch that returned a
pid). `iosWidgetManifest.test.ts` forbids the binding call inside this function.

### Why

When a home-screen widget is tapped while SnowRaven is not running, UIKit launches
the app and hands the `snowraven://` URL to `scene:willConnectToSession:options:`
inside `connectionOptions.URLContexts`. It does NOT call `scene:openURLContexts:` for
a launching URL; that callback is only for a scene that is already connected (the warm
path, which tao already forwards as `Event::Opened`). Upstream tao's `connect_scene`
reads the options only to retain them inside a `SceneRequested` event for non-first
scenes and never reads `URLContexts()` (checked in this copy and in upstream `dev`,
2026-09-23), so in scene mode, which the app runs in by its standing manifest, a
cold-start URL was dropped before Tauri could see it. `tauri-plugin-deep-link` has the
same hole on iOS (its delivery is an `on_event` hook on `RunEvent::Opened`), which is
why SnowRaven carries a small in-repo hook (`src-tauri/src/widgets.rs`) instead.

The hunk emits `Event::Opened`, never `SceneRequested`, so the single-webview keeper in
`src-tauri/src/lib.rs` and `singleWebviewInvariant.test.ts` are untouched. On the first
scene, `connect_scene` has already run `on_app_ready()`, so the event is handled
directly; if it ever lands while tao is still `Launching` or inside a user callback,
`try_user_callback_transition` queues it rather than dropping it. The types used
(`UISceneConnectionOptions`, `UIOpenURLContext`, `NSSet`) are in the pinned objc2 /
objc2-ui-kit 0.3.2 behind the `UISceneOptions` / `UIOpenURLContext` features this
crate already enables, so no dependency or feature changes.

Guarded by `frontend/src/lib/iosWidgetManifest.test.ts`, which asserts the forward is
present inside `scene_willConnectToSession_options`, since nothing in CI can launch the
app cold. An upstream PR for this hunk is owed (flagged at the ios-lifer-widgets
build).

## When to delete this

When Tauri's published dependency range admits a tao that carries BOTH the #1245 fix
(first released in tao 0.36.0) AND cold-start URL delivery in scene mode. Admitting
0.36 alone is no longer enough: dropping this directory then would silently break the
widget tap-through from a cold start while every desktop, simulator-warm and CI check
stays green. At that point drop the `[patch.crates-io]` entry and this directory in the
same change, and confirm on a device that an iOS release build launches AND that a
widget tap with the app closed lands on Map Explorer before shipping.
