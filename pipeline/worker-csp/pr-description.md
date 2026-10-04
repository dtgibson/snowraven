## Worker scripts carry the content security policy (worker-csp)

### What this does
Tauri sends the app's content security policy only with `.html` responses, and a worker loaded by URL takes its policy from its own script response, so through 1.0.49 MapLibre's worker and the app's three module workers ran with no policy at all (security L3, ROADMAP follow-up (2)). The Mac, Windows, iPhone and iPad apps now put the same directive map as `app.security.csp` on every non-HTML file they serve, read from the parsed config, never a second copy. Tauri has no config key for this, so the one window moved from config creation to code: `app.windows[0]` gets `"create": false`, and ONE setup closure in `src-tauri/src/lib.rs`, shared by every target, builds that window first with a web-resource hook (`src-tauri/src/worker_csp.rs`), then runs the existing per-platform steps in their old order. Nothing a user sees changes.

The header the hook attaches, read from the built Mac app (directive order varies per launch, because Tauri's directive map is a `HashMap`; the content does not):

```
form-action 'none'; script-src 'self'; img-src 'self' data: blob: https://ebird.org https://is-ebird-web-static-content-prod.s3.amazonaws.com https://birdsoftheworld.org https://tiles.openfreemap.org https://server.arcgisonline.com https://basemap.nationalmap.gov https://tile.waymarkedtrails.org; object-src 'none'; frame-ancestors 'none'; style-src 'self' 'unsafe-inline'; base-uri 'self'; connect-src 'self' ipc: http://ipc.localhost https://tiles.openfreemap.org https://server.arcgisonline.com https://basemap.nationalmap.gov https://tile.waymarkedtrails.org; frame-src https://macaulaylibrary.org; default-src 'self'; worker-src 'self' blob:
```

It is the page's policy without the sha256 list Tauri adds to `script-src` for `index.html`'s inline boot script, which only the page runs. `index.html` keeps Tauri's own header, byte for byte.

### How to test
1. `cd src-tauri && cargo test` (140 pass, 7 of them the new `worker_csp::tests`).
2. `cd frontend && npx vitest run src/lib/tauriCsp.test.ts src/lib/widgetPaths.parity.test.ts src/lib/singleWebviewInvariant.test.ts src/lib/iosSceneManifest.test.ts` (81 pass).
3. Red-first, by hand: in `src-tauri/tauri.conf.json` delete `"create": false,` and re-run step 2. Two rows go red (the config/code pairing row in `tauriCsp.test.ts` and the one-window row in `singleWebviewInvariant.test.ts`). Restore the file.
4. The app still opens: `npm run desktop:dev` from the repo root opens the window as before (a dev build attaches no header, but the window is built by the same new code on every run).
5. To read the header itself you need a built app, because dev builds attach nothing. Build one under a scratch identifier so it never opens your real data: `npx tauri build --debug --no-bundle --config '{"identifier":"com.snowraven.scratch-worker-csp"}'`, run `src-tauri/target/debug/snowraven`, and from Web Inspector run `fetch('/assets/<a worker chunk>.js').then(r => r.headers.get('content-security-policy'))`. Remove `~/Library/Application Support/com.snowraven.scratch-worker-csp` and `~/Library/Caches/com.snowraven.scratch-worker-csp` afterwards.

### Notes for reviewer

**The mechanism, in one place.** `WebviewWindowBuilder::from_config(app.handle(), &window)?.on_web_resource_request(...).build()?` is exactly what Tauri's own `setup()` does for a config window (`tauri-2.11.2/src/app.rs:2516-2518`), plus the hook, which config windows cannot carry. The hook runs after Tauri has built each `tauri://` response (`protocol/tauri.rs:222-224`). It inserts `Content-Security-Policy` when, and only when, the build is not a dev build, the response declares a `Content-Type`, and that type's essence is not `text/html` (`should_attach`). The header value is `Csp`'s own `Display` over the parsed `app.security.csp` (`policy_header`), computed once in setup and cloned per response.

**Decisions made during implementation.**
- **A response with no `Content-Type` gets nothing.** Tauri sets one on every asset it serves (`builder.header(CONTENT_TYPE, &asset.mime_type)`), so the case does not arise from its protocol; were it to arise, a response with no declared type is one a browser may sniff as HTML, and the page document is the one response that must never get the worker policy (it would refuse the boot script, and the launch splash would never release). An empty or parameter-only type counts as missing. Tested both ways.
- **`is_dev` is passed in from the hook closure** (`worker_csp::attach(tauri::is_dev(), ...)`) rather than read inside the module, so the predicate and `attach` are testable under `cargo test`, where `is_dev()` is always true. `tauri ios dev` serves Vite through this same hook, so the dev gate is what keeps it from governing a dev page the config never described.
- **The window entry is read with `.first()`, not `[0]`.** A config with no window returns a setup error ("tauri.conf.json declares no window") instead of an index panic, which under `panic = "abort"` would abort with no message. Its label stays the config's (absent, so Tauri's default `main`), which is what every capability names; lib.rs types no `"main"` (guarded).
- **`application/xhtml+xml` and `image/svg+xml` get the header.** Only `text/html` is excluded, because Tauri serves `.html` as `text/html` and nothing in the bundle is XHTML; on an SVG used as an image the header is inert, and on one opened as a document it only restricts.
- **A worker policy tighter than the page's was not taken** (the brief's choice): `default-src 'none'` for the app's own three workers would need Vite's hashed chunk names in Rust and a second map to guard, and the page policy reaches no host an attacker can read (1.0.49 I1).
- **The window-geometry and launch-backdrop logic is unchanged**; their calls moved into the shared closure behind the same cfgs, in the same order after the window, and the comments that said the config window is created "strictly before this closure" (`lib.rs`, `window_geometry.rs:4-6`) now describe the new order. The plugin's restore still happens inside `build()`: `attach_window` runs the plugins' `window_created` through `run_on_main_thread`, which executes synchronously on the main thread (`tauri-runtime-wry-2.11.2/src/lib.rs:235-248`), the same as for Tauri's own config windows.
- **The keeper is untouched**: `.run(tauri::generate_context!())`, no `RunEvent::` in code, capabilities `windows: ["main"]`.

**Guard rows.** `tauriCsp.test.ts` gains eight rows, read from comment-stripped Rust with `#[cfg(test)]` modules removed: config creates no window and code builds exactly one, from the config entry, labelled `main`, with every capability naming `main`; the hook is attached between `from_config` and `build()`, and nothing is gated or run before the window; lib.rs has exactly one `.setup(`, on the unconditional `builder`; the Rust reads the policy from config with no URL and no CSP directive name (the configured set plus the rest of CSP Level 3, and any `*-src`) outside tests; the hook passes `tauri::is_dev()` and `should_attach` refuses dev first, with its Rust row present; the one header write sits behind `should_attach` and the `text/html` check, with the HTML and real-config Rust rows present; no `tauri.*.conf.json` overlay sets `app.windows`; and a guard-the-guard row for the two Rust readers. `singleWebviewInvariant.test.ts` gains one row: exactly one window or webview is built in all of `src-tauri/src`, and the config builds none. `widgetPaths.parity.test.ts`'s iOS setup-shape regex is rewritten on purpose with its intent kept: the iOS `let builder` carries the two plugins and no `.setup`, and the launch backdrop runs, iOS-gated, in the shared closure after `.build()?` (read with commented-out lines dropped).

**Red-first, TypeScript.** One snapshot of the working set (lib.rs, worker_csp.rs, launch_backdrop.rs, tauri.conf.json, tauri.ios.conf.json, capabilities/default.json, tauriCsp.test.ts), each mutation asserted to match the expected number of times and to change the file, the three guard files run, every file restored and verified by sha256 against the hash taken at the top. Unmutated baseline: 0 red of 57. After restore: 0 red of 57, every file `ok`.

| Mutation | Red of 57 |
|---|---|
| conf: `"create": false` removed | 2 (pairing row, one-window row) |
| conf: `"create": true` | 2 (same) |
| lib.rs: a second window built from the same config | 2 (same) |
| lib.rs: window built with `::new` and a typed `"main"` | 3 (pairing, hook-order, one-window) |
| lib.rs: window build commented out, text left in a comment | 5 (pairing, hook-order, dev, one-window, iOS backdrop) |
| lib.rs: window build gated `#[cfg(desktop)]` | 1 (hook-order) |
| lib.rs: hook removed | 2 (hook-order, dev) |
| lib.rs: launch backdrop moved before the window | 2 (hook-order, iOS backdrop) |
| lib.rs: launch backdrop call commented out | 1 (iOS backdrop) |
| lib.rs: a second `.setup` on the iOS builder | 2 (one-setup, iOS backdrop) |
| lib.rs: the shared setup moved under a `#[cfg(desktop)] let` | 1 (one-setup) |
| lib.rs: `policy_header(None)` | 1 (policy-from-config) |
| lib.rs: hook passes `false` for `is_dev` | 1 (dev) |
| lib.rs: the whole file back to HEAD | 7 |
| worker_csp.rs: policy typed in Rust | 1 (policy-from-config) |
| worker_csp.rs: a tile host typed in Rust | 1 (same) |
| worker_csp.rs: an unconfigured directive (`font-src`) typed in Rust | 1 (same) |
| worker_csp.rs: dev gate removed | 1 (dev) |
| worker_csp.rs: `text/html` check dropped | 1 (HTML) |
| worker_csp.rs: insert made unconditional | 1 (HTML) |
| worker_csp.rs: a second header write | 1 (HTML) |
| worker_csp.rs: the Rust HTML test renamed away | 1 (HTML) |
| worker_csp.rs: the Rust dev test commented out | 1 (dev) |
| overlay: `tauri.ios.conf.json` sets `app.windows` | 1 (overlay) |
| capabilities: `default.json` names a second window | 1 (pairing) |
| launch_backdrop.rs: builds a second webview window | 1 (one-window) |
| analyser: `rustCode` strips nothing | 4 (pairing, one-setup, policy-from-config, readers) |
| analyser: `withoutTestModules` removes nothing | 3 (policy-from-config, HTML, readers) |

Every new row went red at least once. The `widgetPaths.parity.test.ts` row is an existing `it` whose regex was replaced; it went red in four mutations above.

**Red-first, Rust** (`cargo test --lib worker_csp`, each mutation matched exactly once, restored by sha256; unmutated 7 of 7 pass):

| Mutation | Red of 7 |
|---|---|
| dev gate removed | 2 (`a_dev_build_attaches_nothing`, `attach_...`) |
| `text/html` check dropped | 2 (`an_html_response_is_never_touched`, `attach_...`) |
| a missing type attaches | 2 (`no_declared_type_gets_nothing`, `attach_...`) |
| parameters not stripped (`text/html; charset=utf-8` passes) | 2 (`no_declared_type_...`, `an_html_...`) |
| the policy loses a directive | 1 (`the_header_carries_exactly_the_configured_directive_map`) |
| `attach` ignores the predicate | 1 (`attach_...`) |

**Checks run, in order.**
- `cargo test`: 140 passed. `cargo check` (host): clean apart from warnings in the vendored tao. `cargo check --target aarch64-apple-ios` (target installed): clean, same tao warnings only.
- The four guard files: 81 passed. Full suite `npx vitest run`: 437 files passed, 5 skipped; 9,374 tests passed, 6 skipped. `npm run typecheck`, `npm run lint`, `npm run build`: clean. The test files are Tailwind sources, so the built CSS was checked: `index-kngkoBkd.css` and `vendor-maplibre-CKRTiAqP.css`, the same content-hashed names the http-permit build recorded, so the new test text added no rule.
- **Built Mac app (done item 1).** `npx tauri build --debug --no-bundle --config <file>` with `{"identifier":"com.snowraven.scratch-worker-csp","build":{"frontendDist":"<scratch copy of frontend/dist plus a probe>","beforeBuildCommand":"true"}}`; the binary was checked to embed only the scratch identifier before it ran. Data seeded from `website/tools/demo-data` (backup, ML export, metadata) plus `{"welcomeSeen":true}`. The probe was a same-origin module script placed before the app's own, which read headers with `fetch` from inside the page, started a URL-loaded MODULE worker that fetched `https://example.com/` and `https://tiles.openfreemap.org/planet` with `mode: 'no-cors'` (so a CORS refusal cannot stand in for a policy refusal), and wrote its readings into the scratch data folder over IPC.

  | Response | Hook build | Hook disabled (`attach(true, ...)`, same scratch build) |
  |---|---|---|
  | `/index.html`, `/` (`text/html`) | Tauri's page policy with its sha256 list | identical |
  | the four worker chunks (`text/javascript`) | the configured map, above | none |
  | `index-*.css`, `favicon.svg`, the probe worker | the configured map | none |
  | probe worker, `example.com` (unlisted) | refused (`TypeError: Load failed`) | reached (opaque) |
  | probe worker, the tile host (listed) | reached (opaque) | reached (opaque) |

  WKWebView dispatched no `securitypolicyviolation` event inside the worker in either build, so the refusal is attributed by the hook-disabled control, not by an event. **The visible-window half of done item 1 did not run:** the Mac's screen was locked for the whole session (`CGSSessionScreenIsLocked` true), a full-screen capture was solid black, `screencapture -l` could not image the window, and the probe's later stages (clicking Map Explorer and Statistics) never wrote, which is WebKit suspending the page on a locked Mac as `.claude/rules/security.md` records. Map drawing and Statistics were measured in Playwright instead (next item). Scratch data and cache folders removed; no other `~/Library` entry carried the scratch identifier; the scratch-identifier binary at `src-tauri/target/debug/snowraven` was deleted.
- **Playwright WebKit and Chromium (done item 2)**, `website/tools`' Playwright 1.62.1, a scratch loopback server over the built `frontend/dist` delivering the headers the Mac app sent (Tauri's hashed page policy, copied from the Mac build, on HTML; the configured map on every other file), with the demo backup and ML export behind stub `/settings/files` routes. Three legs per engine: `config` (what ships), `none` (1.0.49), and `tight` (the configured map with the tile host removed from `connect-src` on non-HTML files only, the positive control that MapLibre's worker obeys its own response's policy).

  | Engine, leg | Vector tile requests (ok) | Workers (errors) | Stats worker replies `ok` |
  |---|---|---|---|
  | WebKit, config | 12 (12) | observations, ML export, 3 MapLibre, stats (0) | 1 |
  | WebKit, none | 12 (12) | same (0) | 1 |
  | WebKit, tight | 0, with 15 `connect-src` refusals logged | same (0) | 1 |
  | Chromium, config | 12 (12) | observations, ML export, 1 MapLibre, stats (0) | 1 |
  | Chromium, none | 12 (12) | same (0) | 1 |
  | Chromium, tight | 0 (Chromium logs a worker's refusals in the worker's console, which the page listener does not see) | same (0) | 1 |

  Screenshots: WebKit `config` shows the vector base map under the demo pins and Statistics computed (149 species, the demo dataset's known count); `tight` shows the pins on an empty base. Every leg logged one `Setting save failed (404)` page error, which is the stub backend refusing settings writes, identical across legs.
- **iOS simulator (done item 3), debug profile; the release profile is deferred.** `tauri ios build` (release and `--debug --no-sign` alike) stopped at the CLI's signing precheck (`APPLE_API_KEY, APPLE_API_ISSUER and APPLE_API_KEY_PATH must be provided`) before compiling, and each attempt rewrote `project.pbxproj` (a quoting change), restored from a snapshot of all 116 tracked `src-tauri/gen` files and verified by hash. The release skill's other route was used: `cargo build --target aarch64-apple-ios-sim --lib --features tauri/custom-protocol` (the bundled-assets build, so the hook is live), copied to `Externals/arm64/debug/libapp.a`, then `xcodebuild -scheme snowraven_iOS -sdk iphonesimulator -configuration debug ... CODE_SIGN_IDENTITY=- CODE_SIGNING_ALLOWED=YES` with a no-op `npm` first on `PATH`: BUILD SUCCEEDED. Installed on the iOS 27.0 iPhone 18 Pro simulator and launched: the screenshots show the launch storyboard at 0.4 s, the app's own #2D8653 green with the raven at 1.2 s (the launch backdrop, or the HTML launch frame over it, which share that colour), and the rendered app at 13 s. That rules out the blank-window trap for a window built in code on iOS. It does NOT cover the release-only class (1.0.31's crash was invisible to every debug and simulator check): a release simulator library was not cached and the CLI path needs the signing keys, so the release-profile launch is left to the deploy stage's TestFlight archive and the user's device check. Simulator shut down afterwards; the tree was content-checked against a pre-probe snapshot and matched.
- **Windows**: compiles in CI at the tag; WebView2 itself no agent can run (Partial, per the brief).

**MERGE HAZARD: the `android-release` worktree edits the same lines.** Its branch (`worktree-android-release`, read with `git diff` from this checkout only, never opened) rewrites `run()` at about lines 201 to 221: it narrows the `#[cfg(mobile)]` plugins to dialog and moves geolocation onto the iOS builder line, which in its version still ends in `.setup(|app| { launch_backdrop::install(app); Ok(()) });`. Merging the two conflicts textually there. **The resolution must keep window creation unconditional on every platform:** the iOS `let builder` carries the three plugins (`tauri_plugin_geolocation::init()`, `widgets::plugin()`, `alerts::plugin()`) and NO `.setup`, and the one shared closure stays as it is here. `Builder::setup` keeps only its last closure, so the last `.setup` wins: a second one chained AFTER the shared closure replaces it and that platform opens with no window, and one placed BEFORE it is silently ignored and its step never runs. A `.setup` left on the iOS line sits before the shared closure, so it is the ignored kind: dead code, while the shared closure still builds the iOS window and installs the backdrop. **A launch that opens a window therefore does not prove the resolution.** With `create: false` no platform has another window creator, so an Android-only `.setup` chained after the shared closure, a shared closure moved behind a cfg, or that branch's side of `lib.rs` taken whole while `"create": false` merges in opens the affected platforms with no window; an Android-only `.setup` placed before the shared closure opens a window and never runs its step. Any Android-only setup step joins the shared closure behind `#[cfg(target_os = "android")]`. The guards refuse both shapes: `tauriCsp.test.ts` (exactly one `.setup`, on the unconditional builder; and the config/code pairing row), `singleWebviewInvariant.test.ts` (the one-window row) and `widgetPaths.parity.test.ts` (no `.setup` on the iOS line). Keep this side of the `widgetPaths.parity.test.ts` regex, since that branch's side of it requires the `.setup` on the iOS line, and run the four guard files rather than taking a window opening as proof. That branch's `tauri.android.conf.json` sets no `app.windows`, which the new overlay row requires.

**Stated limits.**
- MapLibre's worker fetches vector tiles from whatever host OpenFreeMap's TileJSON names at runtime (`tiles.openfreemap.org` today), which no source line holds, so `tauriCsp.test.ts` cannot derive it; a tile-host move would blank the vector base in the Tauri apps only, until that host joins `connect-src`. Written into `security.md` and ROADMAP.
- The header is set on non-HTML responses only; an `.html` file is left to Tauri. An HTML file served under another type would get the worker policy; nothing in the bundle is.
- The policy governs requests a worker makes itself; requests made over IPC are the http permit's business, as for the page.

**Docs.** `.claude/rules/security.md`: the CSP rule's item (4) rewritten for workers now carrying the policy (with the window-in-code and one-setup reasons and the tile-host limit), item (5) extended to worker scripts and `tauri ios dev`, the verify sentence names reading a worker chunk's header, and `paths` gains `src-tauri/src/worker_csp.rs`. CLAUDE.md: only the security bullet's worker clause. ROADMAP: follow-up (2) marked FIXED, with what remains. DECISIONS.md (1.0.49's L3 bullet superseded) is the Chronicler's at closeout. Every Tauri binary changes (config and Rust), so this rides the bundle's version bump and wants a CHANGELOG line at the deploy stage. No published copy changes.

## Security errand (2026-10-04): F1 and F2

From `security-report.md` F1 and F2, both Low. No shipped logic changed: `lib.rs` changed in a comment only, and the rest is a guard row, its comment and records.

**F1, the setup-closure wording.** `Builder::setup` keeps only its last closure (`self.setup = Box::new(setup)`, `tauri-2.11.2/src/app.rs:1765-1771`), so the last `.setup` wins. The records said a second `.setup` on any platform drops the window, which is true only of one chained AFTER the shared closure; one placed BEFORE it, on a platform `let builder` line, is silently ignored and its step never runs. Reworded in four places, each now stating both directions and that the guards refuse both shapes: `src-tauri/src/lib.rs` (the comment above the shared closure), `.claude/rules/security.md` (Tauri CSP rule, item (4)), `frontend/src/lib/tauriCsp.test.ts` (the one-setup row's comment), and the merge-hazard paragraph above, which now also says that a `.setup` left on the iOS line is the ignored kind, so a launch that opens a window does not prove the resolution, and that the `widgetPaths.parity.test.ts` regex must be taken from this side.

**F2, the one-window row's reach.** `frontend/src/lib/singleWebviewInvariant.test.ts`: the pattern now also matches `WebviewWindow::builder(`, `Window::builder(` and `Webview::builder(` beside the three `::new(` builders and `.add_child(`; the failure message names exactly those spellings; the count message names `WebviewWindowBuilder::from_config`; and the comment states the scan's reach (top-level `src-tauri/src/*.rs` only, commented-out lines dropped, `#[cfg(test)]` modules kept, and a turbofish, a renamed import, a macro or a subdirectory file outside it).

**Red-first.** Run on a scratch mirror (`src-tauri/src/*.rs`, `tauri.conf.json`, the five marker-site `.ts` files and the test, with `node_modules` linked), one call inserted after the window's `.build()?;` in the mirror's `lib.rs`, each insertion asserted to match once and to change the file. The real `lib.rs` hashed `04decb3785994170014bbabaf76159b907861a97d1b423158a485dbdf98e0363` before and after the red-first (the hash after this errand's comment edit; it was `ac643193428d5a14c72b8661c8a005c4048e2b4d174aad1304b8966359172878` before that edit).

| Inserted call | Previous pattern (red of 12) | New pattern (red of 12) |
|---|---|---|
| none | 0 | 0 |
| `tauri::Window::builder(` | 0 | 1 (one-window row) |
| `tauri::WebviewWindow::builder(` | 0 | 1 (one-window row) |
| `tauri::Webview::builder(` | 0 | 1 (one-window row) |
| `tauri::WebviewWindowBuilder::new(` (control) | 1 | 1 |

**Checks.** The four guard files (`tauriCsp`, `singleWebviewInvariant`, `widgetPaths.parity`, `iosSceneManifest`): 81 passed. `cargo check` in `src-tauri`: clean (warnings in the vendored tao only). The test files are Tailwind sources, so the frontend was built into a scratch directory: `index-kngkoBkd.css` and `vendor-maplibre-CKRTiAqP.css`, the names recorded above, so the new test text added no rule.

## Convention Flags
- A header or policy the Rust side derives from `tauri.conf.json` is built from Tauri's own parsed types (here `Csp`'s `Display`), never retyped in Rust, and a source guard refuses a host or directive literal outside tests.
- The app builds its one window in the one setup closure every target shares; a platform-specific setup step joins that closure behind a cfg rather than adding a `.setup`, because `Builder::setup` replaces an earlier closure.
- A vitest guard that scans Rust strips whole-line comments AND `#[cfg(test)]` modules before scanning, with a guard-the-guard row for each reader (`rustCode` / `withoutTestModules` in `tauriCsp.test.ts`).
