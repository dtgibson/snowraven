# Why this crate is vendored

This is an unmodified copy of `tao` 0.35.3 from crates.io with **one line changed**,
applied via `[patch.crates-io]` in `src-tauri/Cargo.toml`.

## The change

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

## When to delete this

When Tauri's published dependency range admits tao >= 0.36. At that point drop the
`[patch.crates-io]` entry and this directory in the same change, and confirm an iOS
release build still launches on a device before shipping.

Only line 646 is changed. The other `Retained::as_ptr` uses in this file
(544, 555, 849) pass a pointer while the `Retained` is still alive in scope and are
deliberately left alone, matching upstream's diff exactly.
