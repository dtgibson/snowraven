# CSP inventory: desktop-csp-frame-protection

Companion to `change-brief.md`. What the Tauri webview actually loads, traced to the
call site, so the Engineer starts from a measured list rather than a guess. Measured
on `weft-spool/20261003-062323` at `ffff2b9`, tauri 2.11.2, tauri-utils 2.9.2,
tauri-codegen 2.6.2, maplibre-gl 6.x.

## 1. What does NOT need a CSP entry

Every API call the Tauri build makes goes through `@tauri-apps/plugin-http`
(`frontend/src/lib/tauri/http.ts` -> `tauriFetch`), which is an IPC call; Rust makes
the request. So eBird (`api.ebird.org`), OpenWeather (`api.openweathermap.org`), NOAA
(`api.tidesandcurrents.noaa.gov`), Nominatim, the Macaulay embed-status check and the
GitHub version check need nothing beyond the IPC origins. The updater, geolocation,
clipboard, fs and dialog plugins are IPC too. External links open through the opener
plugin (IPC), and CSP does not govern navigation. The `fetch` calls in `storage.ts`
(`WebStorage`) and `transport.ts:49,66` (`WebTransport`) run on web/Pi only.

Every other `https://` string in `frontend/src` and `src-tauri/src` is an `href`, a
test fixture, or text a regex matches (`raincrow.app` in `commentBlocks.ts`), not a load.

## 2. What the webview loads itself

| Directive | Source | Where | Why |
|---|---|---|---|
| `script-src 'self'` | the hashed entry module and lazy chunks | `dist/index.html`, Vite output | The built bundle has no `new Function`. Its one `eval` is MapLibre's worker-script loader (`globalThis.eval` in the worker chunk), reached only through `importScriptInWorkers` or the RTL text plugin, which the app never calls. Do NOT add `'unsafe-inline'` or `'unsafe-eval'`. |
| (Tauri adds) | the inline boot script in `index.html` (theme anti-flash + launch splash) | `frontend/index.html` | Tauri hashes inline `<script>` at build and appends the hash and its own init-script nonces to `script-src` (`tauri-2.11.2/src/manager/mod.rs:86-94`, `replace_csp_nonce` at :126-153). If the hash fails the splash never releases and `#root` stays `inert`. |
| `style-src 'self' 'unsafe-inline'` | 2 CSS files; the inline `<style>` in `index.html`; three HTML-string `style=""` attributes | `index.html`; `lib/mapExplorerFormat.ts:9` (`TEARDROP_HTML`, `style="fill:..."`, Map Explorer hotspot legend, `MapExplorer.tsx:2515`); `components/map/TargetMarkers.tsx:76` (Media Targets chip icon row) | React `style={}` props are set through CSSOM and are never blocked. The HTML-string attributes ARE blocked unless `'unsafe-inline'` is in force. Tauri adds a style nonce whenever it may modify `style-src` (`mod.rs:96-104`), and any nonce or hash makes browsers ignore `'unsafe-inline'`. So set `"dangerousDisableAssetCspModification": ["style-src"]`, leaving `script-src` modification ON. |
| `img-src 'self' data: blob:` | maplibre-gl.css control icons are `url("data:image/svg+xml...")`; MapLibre's image path can decode through `URL.createObjectURL` (`maplibre-gl-shared.mjs`, "Could not load image") | `components/SnowMap.tsx` imports `maplibre-gl/dist/maplibre-gl.css` | MapLibre's own CSP guidance lists `img-src data: blob:`. Sprites and glyphs are bundled same-origin (`mapassets/`, `lib/mapStyle.ts:120-141`). |
| `img-src` hosts | species link favicons | `components/SpeciesLinks.tsx:142,149` | `https://ebird.org/favicon.ico` answers **302** to `https://is-ebird-web-static-content-prod.s3.amazonaws.com/...`; CSP checks the redirect target, so both hosts. `https://birdsoftheworld.org/favicon.ico` answers 200. A miss here degrades gracefully: the favicon's own failure state shows the bundled glyph. |
| `img-src` hosts (hedge) | raster tile hosts below | `lib/mapStyle.ts:79-83` | MapLibre 6 fetches raster tiles as bytes (connect-src) and decodes with `createImageBitmap`; listing them in `img-src` too covers its HTMLImageElement fallback. Cheap, same hosts already disclosed. |
| `connect-src 'self' ipc: http://ipc.localhost` | Tauri IPC | all `invoke`, plugin calls, `tauriFetch` | `ipc://localhost` on macOS/iOS, `http://ipc.localhost` on Windows. Without it Tauri falls back to a slower postMessage path and logs errors. |
| `connect-src https://tiles.openfreemap.org` | vector style JSON (main thread), TileJSON and vector tiles (worker) | `lib/mapStyle.ts:12-13,177` (`VECTOR_STYLE_URL`, `fetch`) | Positron and Liberty styles, and the `planet` TileJSON, reference only this host (checked live). |
| `connect-src https://server.arcgisonline.com https://basemap.nationalmap.gov https://tile.waymarkedtrails.org` | Satellite, Topo, Trails raster tiles | `lib/mapStyle.ts:79,81,83` | Fetched by the MapLibre worker. |
| `worker-src 'self' blob:` | MapLibre worker; three app module workers | `SnowMap.tsx:17,31` (`setWorkerUrl`); `observationsCache.ts:85`, `parseMLExportOffThread.ts:120`, `statsOffThread.ts:311` | See risk R1 for `blob:`. |
| `frame-src https://macaulaylibrary.org` | ML embed iframe | `components/MediaEmbed.tsx:153` (used by Species Detail, Named Birds, recent media) | Answers 200 with no redirect. A cross-origin frame's own loads are governed by its own document, not ours, so nothing else is needed for the player. |
| `object-src 'none'`, `base-uri 'self'`, `frame-ancestors 'none'` | hardening | none | Nothing uses plugins or `<base>`; nothing frames the app (and `tauri://` cannot be framed by a web page anyway, so `frame-ancestors` is belt only). |

`default-src 'self'` covers fonts (system fonts only, no `@font-face`) and media (no
`<audio>`/`<video>`). No `.wasm` in the build, so no `'wasm-unsafe-eval'`.

## 3. Starting policy (one string, Engineer confirms on the built app)

```
default-src 'self';
script-src 'self';
style-src 'self' 'unsafe-inline';
img-src 'self' data: blob: https://ebird.org https://is-ebird-web-static-content-prod.s3.amazonaws.com https://birdsoftheworld.org https://tiles.openfreemap.org https://server.arcgisonline.com https://basemap.nationalmap.gov https://tile.waymarkedtrails.org;
connect-src 'self' ipc: http://ipc.localhost https://tiles.openfreemap.org https://server.arcgisonline.com https://basemap.nationalmap.gov https://tile.waymarkedtrails.org;
worker-src 'self' blob:;
frame-src https://macaulaylibrary.org;
object-src 'none';
base-uri 'self';
frame-ancestors 'none'
```

plus `"dangerousDisableAssetCspModification": ["style-src"]` beside `csp` in
`app.security`. Tauri accepts `csp` as a string or a directive map; the map form is
easier for the guard to read, either is fine.

## 4. Tauri facts that shape verification (read from source, not docs)

- The CSP header is attached only to `.html` assets served by Tauri's own protocol
  (`mod.rs` ~436 `is_html`; `protocol/tauri.rs:212-218`). Worker scripts loaded by URL
  get no header; a `blob:` worker inherits the page's policy.
- `devCsp` falls back to `csp` when unset or JSON `null` (`mod.rs:368-380`,
  `tauri-codegen context.rs:162-171`), so `null` is not an off switch. On desktop,
  `tauri dev` loads Vite directly (the dev proxy is `cfg(all(dev, mobile))`), so the
  dev window most likely runs with no CSP at all. Consequence: `npm run desktop:dev`
  is NOT a verification path; it only has to keep working.
- `tauri build --debug` is not `cfg(dev)`: it serves embedded assets with the real
  CSP and keeps Web Inspector available. `--no-bundle` skips the bundle, the updater
  artifacts and signing.

## 5. Risks and uncertainties

- **R1, MapLibre worker on Apple platforms.** `setWorkerUrl` hands MapLibre a
  same-origin URL, but its cross-origin test compares `new URL(url).origin` with
  `location.origin`. For `tauri://localhost/...`, `new URL(...).origin` is `"null"`
  (non-special scheme; checked in Node), so on macOS and iOS MapLibre likely takes its
  blob-worker path (`import "<url>"` inside a `blob:` module). Windows
  (`http://tauri.localhost`) takes the direct path. Hence `worker-src blob:`. Confirm
  on the built Mac app which path runs.
- **R2, eBird favicon redirect host.** The S3 host is eBird's choice and may change.
  Failure is graceful (fallback glyph), so it is not a reason to widen to `https:`.
- **R3, Windows.** Origin `http://tauri.localhost` and IPC `http://ipc.localhost`
  cannot be run on this Mac. Config-level and guard coverage only.
- **R4, iOS and iPad.** Same config and `tauri://` origin as macOS. No agent touches a
  device; the user's TestFlight install at the bundle ship is the check (the
  simulator is allowed and optional). Release-only differences are a known class here.
- **R5, what the CSP cannot cover.** `src-tauri/capabilities/default.json` grants
  `http:allow-fetch` for `https://**`, and that request is made by Rust over IPC, so a
  script that reached the webview could still send data to any https host. Narrowing
  that allowlist to the hosts the services call is a separate change to the
  capability files (out of scope here; worth a saved idea).
- **R6, an unexercised path.** A host used only on a rare path (the Liberty variant,
  an offline style revalidation, a fallback decoder) will not show a violation in one
  pass. That is why the guard derives hosts from source instead of relying on the
  console check alone.
