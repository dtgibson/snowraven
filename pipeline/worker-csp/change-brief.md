# Change Brief: Worker scripts carry the content security policy

## What is changing
In the Mac, Windows, iPhone and iPad apps, every non-HTML file the app serves from its bundle gains a
`Content-Security-Policy` response header holding the same directive map as `app.security.csp`, read from the
parsed config at startup, never a second copy. A browser applies a response's policy only where that response
becomes a document or a worker's global scope, so the header is inert on images, CSS and the page's own module
chunks and takes effect on exactly the four URL-loaded workers. Tauri has no config key for this (Mechanism), so
the main window moves from config creation to code: `app.windows[0]` gets `"create": false`, and ONE setup closure
in `src-tauri/src/lib.rs` builds it with `WebviewWindowBuilder::from_config(...).on_web_resource_request(...)`
first, then runs the existing per-platform steps (window geometry on desktop, the launch backdrop on iOS). A dev
build attaches nothing, as today. Unchanged: the directive map, `dangerousDisableAssetCspModification`, `devCsp`
(unset), every worker's code, `capabilities/`, the `.run(tauri::generate_context!())` keeper.

## Why now
1.0.49's security review (L3) measured that Tauri sends the policy only with `.html`, so a worker loaded by URL
runs with none: a compromised dependency inside a worker chunk can load and send freely. It was saved as follow-up
(2) in ROADMAP's "Two follow-ups to the Tauri content security policy", sequenced after (1), the http permit, which
closed in this bundle (`ca10c24`, http-permit-narrowed). With (1) closed, this is the free channel left.

## User-facing impact
None intended. Web and Pi are untouched. Two risks, both Tauri-only and both invisible to vitest and `npm run dev`:
(a) a worker fetch to a host the policy lacks is refused, and the only worker that fetches is MapLibre's, so the
symptom would be a blank vector base map; (b) the launch path: a slip in pairing `create: false` with the code
creation means no window, or a duplicate `main` label that fails `setup()` and aborts launch, on every platform.
Every Tauri binary changes (config and Rust), so this rides the bundle's version bump and a CHANGELOG line. No
published copy: `PRIVACY_POLICY.md`, `website/`, `README.md` and the listing never mention the policy.

## Design pass
Not needed: no visual change.

## Decisions touched
- DECISIONS.md 1.0.49 (desktop-csp-frame-protection): the L3 bullet is superseded and the second saved follow-up
  closes. I2 (`worker-src blob:` hedge) stands with its reversal; "`devCsp` stays unset" stands (dev attaches nothing).
- `.claude/rules/security.md`, Tauri CSP rule: item (4)'s "That inheritance is the only way a worker gets this
  policy..." is rewritten, item (5) extends to worker scripts; `paths` gains any new Rust module.
- CLAUDE.md: the security bullet's "why a worker loaded by URL runs with no policy"; the single-webview invariant
  (still one window, label `main`, now created in code; keeper untouched).
- v1.0.13 window geometry and the 2026-09-26 launch splash both need the window first: ordering kept, the "config
  window is created strictly before this closure" comments (`lib.rs:195-198`, `window_geometry.rs:4-6`) reworded.
- ROADMAP.md: follow-up (2) closes.

## What done looks like
1. Built Mac app (`npx tauri build --debug --no-bundle`, scratch `--config` identifier, data dir seeded from a
   fixture export, never the real one): a worker asset fetched from inside the page carries the configured policy
   while `index.html` keeps Tauri's hashed one; a URL-loaded MODULE worker probe in a scratch build is refused an
   unlisted host (negative control) and reaches it without the header; on a visible window the map draws vector
   tiles and Statistics computes in its worker with no main-thread fallback.
2. The same surfaces in Playwright WebKit and Chromium, the header delivered by the server on every non-HTML file.
3. iOS simulator: a release-profile build launches and renders with the backdrop (screenshot, never a process check).
4. Guard rows red-first (see Files); `cargo test` on the predicate; `cargo check` for macOS and iOS; full frontend
   suite, typecheck, build. Windows compiles in CI at the tag; WebView2 itself no agent can run (Partial).

## Worker inventory
Four workers, all module workers. Built chunks scanned in `frontend/dist/assets/` (sources unchanged since).

| Worker | Created | URL or blob | Fetches | Policy it needs |
|---|---|---|---|---|
| MapLibre 6.8.0 | `components/SnowMap.tsx:17` (`?worker&url`), `:31` (`setWorkerUrl`); MapLibre `src/util/web_worker.ts:61-75` | URL when its origin equals `location.origin` (`:14-24`, `:38`), the Mac and Windows path; else a `blob:` worker importing it, which inherits | Vector tiles by `fetch` (`vector_tile_worker_source.ts:87`, `ajax.ts:173`) from the TileJSON's tile host, today `https://tiles.openfreemap.org/planet/...` (checked 2026-10-03; same host as `lib/mapStyle.ts:12-13`). Glyphs, sprites, TileJSON and raster tiles go via the main thread (`worker_tile.ts:139`; security L3). All 8 GeoJSON sources pass in-memory objects. The `importScript` handler (`worker.ts:42-67`, fetch then `eval`) has zero callers (no `setRTLTextPlugin`, no `importScriptInWorkers`) | `connect-src` with the tile host, `script-src 'self'`: both in the page policy |
| Observations parse | `lib/observationsCache.ts:85` | URL | Nothing (no fetch, XHR, import or eval in the chunk) | None; the page policy is a superset |
| ML export parse | `lib/parseMLExportOffThread.ts:120` | URL | Nothing | None |
| Stats session | `lib/statsOffThread.ts:311` | URL | Nothing | None |

Policy choice: the configured map itself, one source, so `tauriCsp.test.ts`'s existing rows already hold the
worker's hosts to their call sites. A tighter app-worker policy (`default-src 'none'`) would need Vite's hashed chunk
names matched in Rust and a second map to guard; not taken, since the page policy reaches no host an attacker can
read (1.0.49 I1). Reversal: such a host joins `connect-src`. New stated limit: the vector tile host comes from
OpenFreeMap's TileJSON at runtime, not from source (like eBird's S3 favicon redirect), so a tile-host move would
blank the vector base in the Tauri apps only.

## Mechanism
- **Where the page policy comes from:** `tauri-2.11.2/src/manager/mod.rs:436-452` builds a CSP only when the served
  path ends in `.html`, and `src/protocol/tauri.rs:212-219` sends it as a header from that value alone. No `<meta>`
  is injected for bundled pages (the one `inject_csp` call, `manager/webview.rs:483-497`, is for `data:` URLs), so
  the page policy is header-delivered, which 1.0.49's built-Mac negative control showed WKWebView enforces from the
  custom scheme. The premise holds.
- **Why a URL-loaded worker has none:** under CSP3 it takes its policy from its own script response, and only a
  `blob:` worker inherits. Measured by 1.0.49's review in Playwright WebKit and Chromium, with the positive control
  (the same header on the worker script refused the worker's fetch in both). The page's `worker-src` governs which
  scripts may START a worker, and is in force today; nothing governs what a started worker does.
- **Not config-only:** `app.security.headers` reaches every response (`protocol/tauri.rs:103`), but `HeaderConfig`
  (`tauri-utils-2.9.2/src/config.rs:2770`, `deny_unknown_fields` at `:2769`) has no CSP field ("defined
  separately", `:2750`), and `Tauri-Custom-Header` is a fixed name.
- **Rust, through the documented hook:** `WebviewWindowBuilder::on_web_resource_request` (`webview_window.rs:235`)
  is wired to the `tauri` scheme (`manager/webview.rs:268-272`) and runs after every response is built, on every
  platform (`protocol/tauri.rs:222-224`). Config windows are built without one (`app.rs:2516-2518`), hence
  `create: false` and the pattern its own doc gives (`config.rs:1921-1936`). Tauri's path is the same
  `from_config(...).build()` in the same `setup()`; the only step now before it, `assets.setup`, is a no-op
  (`tauri lib.rs:315-317`). Rejected: registering our own `tauri` protocol, which re-implements Tauri's.
- **Two traps:** `Builder::setup` REPLACES an earlier closure (`app.rs:1765-1771`), so the window goes first in ONE
  setup used on every target, Android included once it lands. And `tauri ios dev` proxies Vite through this same
  handler with no page policy (`protocol/tauri.rs:113-211`, then `:222`), so the hook is off when `tauri::is_dev()`
  (`tauri lib.rs:308`) and never touches a `text/html` response.
- **Reach:** one code path serves WKWebView (Mac, iPhone, iPad) and WebView2 (Windows). Enforcement inside a worker
  is measured in Playwright WebKit and Chromium; WKWebView from the custom scheme is measured by done item 1;
  WebView2 itself is unreachable by any agent.
- **Rejected alternative:** blob-bootstrapping each worker so it inherits. Frontend-only, but it puts the guarantee
  on every call site rather than on the server, makes `blob:` a measured need (closing I2's reversal), and changes
  web and Pi as well.

## Files
Change: `src-tauri/tauri.conf.json` (`app.windows[0].create: false` only); `src-tauri/src/lib.rs` (one setup
closure, the window and hook first; `:195-202` and `:217-221` merge). **The `android-release` worktree also edits
`lib.rs` near line 201 in `run()`: that merge conflicts textually and must keep window creation unconditional, or
Android launches with no window.** Optionally a small module for the header predicate with Rust tests (then
`security.md` `paths` gains it). Comment-only: `window_geometry.rs:4-6`. Guards: `tauriCsp.test.ts` (config creates
no window and code creates exactly one, label `main`; Rust reads the policy from config with no directive or
`https://` literal; HTML untouched; dev gate present; no overlay sets `app.windows`); `widgetPaths.parity.test.ts:151`
(the iOS setup-shape regex, updated on purpose with its intent kept); optionally a one-window row in
`singleWebviewInvariant.test.ts`. Records: `security.md`, CLAUDE.md, ROADMAP, DECISIONS at closeout, CHANGELOG.
Unchanged: `app.security`, every worker and `SnowMap.tsx`, `capabilities/`, `window_geometry.rs` and
`launch_backdrop.rs` logic, the keeper, published copy, `docs/HELP.md`.
