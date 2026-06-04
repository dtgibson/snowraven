# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session.
It holds pipeline conventions, tool rules, and project-specific
decisions that all builders must follow.

## Versioning

- Version is tracked in `frontend/package.json` (semver, patch increments for small features/fixes, minor for larger features)
- `CHANGELOG.md` at the repo root must be updated with every version bump
- **Always bump the version and update the changelog when adding a feature or fix**, even if the user does not ask
- **After pushing a version bump, run `./release.sh`** to build, notarize, and publish the macOS desktop app. This script creates the GitHub release (or uploads to an existing one), signs the updater bundle, and generates `latest.json` for in-app update detection. Credentials (Apple API key, notarization) stay local — never stored in GitHub.
- **Do not use `gh release create` directly** for desktop app releases — always use `release.sh` so the signed binary and `latest.json` are included. The in-app update check depends on `latest.json` being present in the release assets.
- **Tauri v2 macOS updater mechanism:** `downloadAndInstall` performs synchronous in-place bundle replacement — no shell script, no sleep, no `open -a`. The `.app` bundle is fully replaced on disk before the Promise resolves. After `downloadAndInstall` returns, call `relaunch()` (not `exit(0)`). `relaunch()` spawns `current_exe` (now the new binary) and exits cleanly. `exit(0)` just terminates the process with no relaunch, leaving the user with no running app.
- **macOS ships a UNIVERSAL binary (v0.5.5+).** `release.sh` builds `--target universal-apple-darwin`, so one DMG (`SnowRaven_<ver>_universal.dmg`) and one updater bundle (`SnowRaven.app.tar.gz`) run on both Apple Silicon and Intel. With an explicit `--target`, Tauri nests the bundle under the target triple — `$CARGO_TARGET_DIR/universal-apple-darwin/release/bundle/...`, not `release/bundle/...`. The build needs BOTH Rust targets installed (`rustup target add aarch64-apple-darwin x86_64-apple-darwin`); `release.sh` preflights this and aborts with the install command if either is missing.
- **`release.sh` Intel arch:** `latest.json` maps BOTH `darwin-aarch64` and `darwin-x86_64` to the one universal updater bundle (same URL, same signature). The Intel key must be exactly `darwin-x86_64` — Tauri's `updater_arch()` returns `"x86_64"` on Intel, so mapping it to `"x64"` means Intel users never see any update as available.
- **`createUpdaterArtifacts: true` is required in `tauri.conf.json`** — `@tauri-apps/cli` v2.11.2+ defaults this to `false`. Without it, `tauri build` creates the `.app` and `.dmg` but skips the `.app.tar.gz` updater bundle entirely. The setting must be in `bundle.createUpdaterArtifacts`.
- **`release.sh` version guard:** After the build, `release.sh` reads `CFBundleShortVersionString` from the bundle's `Info.plist` and aborts if it doesn't match `tauri.conf.json`. This catches stale-artifact issues before anything is uploaded to GitHub.

### Windows desktop release (v0.4.0+)

- **Windows builds run in GitHub Actions** (`.github/workflows/windows-build.yml`, `windows-latest`), triggered by pushing a `v*` tag. The build uses a *throwaway* signing key (discarded) only so Tauri produces the artifacts; `release.sh` re-signs locally with the real key. The real minisign key never goes to GitHub — same keep-it-local stance as the Apple credentials.
- **`release.sh` is the single multi-platform assembler.** It builds + notarizes macOS, then `gh run download`s the CI Windows installer, signs it locally, and writes ONE `latest.json` with both `darwin-aarch64` and `windows-x86_64` entries. `SKIP_WINDOWS=1` publishes macOS-only (emergencies).
- **Release rhythm:** bump version → commit → push to main → push the `vX.Y.Z` tag (starts Windows CI) → wait for CI → run `./release.sh`. The tag must be pushed *before* `release.sh` so the CI artifacts exist to fetch.
- **The Windows updater target is the NSIS installer itself (`*-setup.exe`), NOT a `.nsis.zip`.** Tauri v2 signs the installer (`.exe.sig`) for updates on Windows; there is no separate archive. The `latest.json` `windows-x86_64.url` points to the `-setup.exe`.
- **Cross-platform Rust deps must live in `[dependencies]`, not `[target.'cfg(target_os = "macos")'.dependencies]`.** `tzf-rs` (used by the cross-platform `get_timezone` command) was mis-scoped there and broke the Windows build with "unresolved import." The macOS-only block is only for genuinely macOS-only crates (objc2*, the CoreLocation stack).
- **`tauri signer sign`: don't pass `--private-key-path` (`-f`) when `TAURI_SIGNING_PRIVATE_KEY` is already exported** — the env key and the path flag are mutually exclusive. `release.sh` exports the env key for the macOS build, so the Windows-install signing step relies on the env, no flags.
- **Windows is distributed unsigned** (no Authenticode) for now — first launch shows a SmartScreen "unknown publisher" prompt. The in-app updater is unaffected (minisign verification, not Authenticode).

## Pipeline Overview

This project uses the Weft framework. Run /new-feature to start a new feature.

## Conventions

### Ports
- Backend runs on port **1620** (not 8000)
- Frontend dev server runs on port **5173** (Vite default)
- Vite proxies `/weather` and `/health` to `http://localhost:1620`

### Environment
- API keys live in `backend/.env` — never commit this file
- Required keys: `EBIRD_API_KEY`, `OPENWEATHER_API_KEY`
- OpenWeather key must be subscribed to "One Call by Call" at openweathermap.org

### Stack
- Backend: Python 3.10+, FastAPI, uvicorn, httpx, timezonefinder
- Frontend: React, Vite, TypeScript, Tailwind CSS v4, shadcn/ui
- Tests: pytest (backend, 35 tests), vitest (frontend)
- CI: GitHub Actions (`.github/workflows/pipeline.yml`)

### Running locally
```
# Backend
cd backend && uvicorn main:app --reload --port 1620

# Frontend
cd frontend && npm run dev
```

### Running tests
```
cd backend && python -m pytest tests/ -v
```

### Bird names

- **Render every user-facing bird name through `<BirdName>`** (`frontend/src/components/BirdName.tsx`) — never hand-roll a name + favicons, and don't use `SpeciesLinks` directly in new code (BirdName composes it). Props: `commonName`, `scientificName?`, `taxonCode?`, `hasEntry?`, `onOpenSpecies?`, `showSci?`, `size?` (`sm`/`md`/`lg`).
- **Link the common name only when `hasEntry`** — i.e. the species is in the user's loaded backbone (recorded). Birds the user hasn't recorded (nemesis, unseen map targets, a comparer's other-list-only column) get plain name + favicons, never a Species-Detail link. Source `hasEntry` from a normalized backbone set (`normalizeSpeciesName`); tabs whose lists are entirely from the backup pass `true`.
- **Navigation:** pass `onOpenSpecies={navigateToSpeciesDetail}` (from `App`) so clicking a name opens it on Species Detail. `App.requestedSpecies` + `SpeciesDetail`'s consume effect handle selection (single-use, pending until `phase==='ready'`, subspecies-normalized). Species Detail's own internal names use its local `selectSpecies`.
- **Favicons need a taxon code** — resolve codes for the species a tab shows (batched `/taxonomy/codes`); BirdName no-ops favicons when the code is missing. If names render without favicons, the tab isn't resolving codes for that set.
- **"Move the link to the number":** where a name previously linked somewhere (a count, a checklist, a map pan), keep that link on the count/element (or a ↗ / locate icon) and point the name at Species Detail. Exclude form controls (`<select>`, checkboxes) and the Species Detail entry header.
- Component tests use `jsdom` via a per-file `// @vitest-environment jsdom` docblock (see `BirdName.test.tsx`); the rest of the suite stays node-env.

### Colors and theming

- **All colors must use `var(--sr-*)` CSS custom properties** — no hardcoded hex or RGB values in any component file
- The full token palette lives in `frontend/src/globals.css`: `:root` (light) and `[data-theme="dark"]` (dark)
- When inline styles need rgba() with a dynamic alpha, use the RGB triplet pattern: `rgba(var(--sr-tier-4-rgb), 0.08)`
- New tokens go in both `:root` and `[data-theme="dark"]` before use
- The `data-theme` attribute on `<html>` is set by the anti-flash script in `index.html` and updated by `applyTheme()` in `src/lib/theme.ts`

### Overlays and stacking

- **Floating overlays (dropdowns, menus, popovers) that can appear over a map must use a `z-index` above Leaflet's layers.** Leaflet panes and controls reach ~1000; use `z-index: 1200` (as the responsive tab dropdown does in `TabNav.tsx`). The Map Explorer is reachable on most views, so any new overlay should assume a map may be beneath it.
- **Outline-only Leaflet polygons need a transparent fill (`fillOpacity: 0`), not `pointer-events` overrides, to make their interior clickable.** Leaflet's own `path.leaflet-interactive` CSS rule outranks a class-based `pointer-events: all` on specificity. The atlas-block overlay (`AtlasBlockLayer.tsx`) relies on this.
- **`leaflet.heat` bands faint far-spread tails into triangular artifacts when `radius` is very large AND `max` is very low.** When tuning the My Sightings heatmap, keep radius bounded (~≤80 px), blur ~0.5× radius, and floor `max` ≥ ~0.75; drive "intensity" via per-point weight (the obs-count divisor), not by crushing `max`. See `heatRadius`/`heatBlur`/`heatMax` in `MapExplorer.tsx`.
- **To texture/pattern-fill a Leaflet vector layer, inject a hidden SVG `<defs>` of `<pattern>`s once and reference them with a CSS class (`.x { fill: url(#id) }`), not an inline `fillColor`.** Leaflet writes `fill` as a DOM *attribute*, where `var(--token)` does not resolve and `url(#id)` is awkward to set per-feature; a CSS class on the path resolves both (theme tokens via `rgba(var(--sr-*-rgb), α)` inside the pattern, and the `url(#…)` reference). The atlas tier shading (`AtlasTierPatterns.tsx` + `.sr-atlas-tier-N`/`.sr-atlas-fill-N` in `globals.css`) uses this. Keep hatch spacing generous and fill alpha low (~0.12) so base-map labels stay readable under the pattern.
- **Overriding Leaflet's own CSS requires *raised specificity*, not just a later rule — `leaflet/dist/leaflet.css` is imported from the map components and bundles AFTER `globals.css`, so a tie on specificity goes to Leaflet.** To override `.leaflet-container` (e.g. the map backdrop — default `#ddd`), use a doubled class `.leaflet-container.leaflet-container { … }` (specificity 0,2,0 beats Leaflet's 0,1,0) rather than relying on cascade order or `!important`. The ocean-tone map backdrop (`.leaflet-container.leaflet-container { background: var(--sr-map-void) }`) uses this — it tints the empty area around the world so it reads as sea, not a rendering gap.
- **Map tiles come from keyless providers defined once in `frontend/src/lib/basemaps.ts`, rendered via the shared `<MapBaseLayers switcher?>` component — never hard-code a `<TileLayer url=…>` in a map component.** Default base is CARTO Positron (do NOT reintroduce `tile.openstreetmap.org` — its OSMF policy forbids app/self-hosted use). The switcher (Map/Satellite/Topo + Trails overlay) is a portal-based Leaflet control; base/overlay choice persists via the storage seam; the `--sr-map-void` backdrop is set per-active-base on the map container. Esri/USGS use `{z}/{y}/{x}` tile order, CARTO/Waymarked use `{z}/{x}/{y}`. Raster label size is effectively binary (native, or 2× via `tileSize:512 + zoomOffset:-1`) — a fractional size needs vector tiles (deferred). **Adding or changing any tile provider MUST be reflected in `PRIVACY_POLICY.md` (the "Map Tiles" section)** — tiles are fetched browser→provider, exposing IP + viewport, so the provider list is a privacy disclosure. Flag this in security reviews touching the map basemaps.
- **Map fullscreen on mobile is a CSS overlay, not the browser Fullscreen API.** The Map Explorer panel becomes `position: fixed; inset: 0; height: 100dvh; z-index: 1200` driven by `mapFullscreen` in `App.tsx` (the Fullscreen API is unreliable in iOS Safari/WKWebView). The toggle and the Filters button share a mobile-only floating cluster (`.sr-map-fab-cluster`, shown only ≤640px) so they never overlap regardless of label width — reuse this cluster for any new floating map control rather than absolutely-positioning each button. When adding state that hides app chrome, clear it on any in-component navigation that switches tabs, and lock `document.body` overflow only while the overlay is active.

### Security — standing checks

- **Leaflet popup HTML is built from a template string (`AtlasBlockLayer.tsx` `bindPopup`).** This is safe ONLY because the interpolated block name/code come from the bundled, converter-generated `ca-atlas-blocks.json` (trusted static data, no user input), and the code is `encodeURIComponent`-wrapped. **Re-check this on any change to the atlas-block feature or its data source:** if block data ever becomes dynamic or user-supplied, the popup must switch to DOM construction or escape interpolated values to avoid HTML injection. Flag this in every security review that touches the Map Explorer atlas overlay.

### Documentation

- **`docs/HELP.md` is the single source of truth for all in-app help content.** When a feature is added or changed, update this file to reflect the current behavior before pushing.
- `HelpDocs.tsx` imports `docs/HELP.md` via Vite's `?raw` loader (`import helpText from '../../../docs/HELP.md?raw'`). Content is bundled at build time — no runtime fetch. Offline-available by design.
- `vite.config.ts` sets `server.fs.allow: ['..']` to allow the dev server to resolve the `?raw` import outside the `frontend/` root. This is dev-only — production resolves at compile time.
- **Also review and update `README.md`** before every push to ensure it reflects the current feature set.
- **`PRIVACY_POLICY.md` and `ACCESSIBILITY.md` (repo root) are published, user-facing statements — keep them true.** The privacy policy asserts SnowRaven collects nothing and runs no server: if any feature ever adds analytics, telemetry, crash reporting, an account, or a new third-party service, update `PRIVACY_POLICY.md` in the same change (a stale privacy policy is a liability, not just a doc bug). Update `ACCESSIBILITY.md` when accessibility behavior changes. Neither is bundled into the app, so they don't require a version bump on their own.

### Production build
```
./start.sh
```
Builds frontend into `frontend/dist/`, starts uvicorn on port 1620.
FastAPI serves the built frontend as static files automatically.

### Desktop app seams

Permanent architectural seams route all platform-sensitive operations. Use them in new code — do not bypass them.

- **Transport:** `transport.get()` / `transport.post()` from `frontend/src/lib/transport.ts` — for all outbound HTTP calls. In Tauri mode, `TauriTransport` routes each API path directly to a TypeScript service (weather, map, taxonomy, nominatim, stats, version). In web/Pi mode, `WebTransport` delegates to the Python backend.
- **Storage:** `storage.getApiKey()` / `storage.getSetting()` / etc. from `frontend/src/lib/storage.ts` — for all key, setting, and file access. Do not call `/settings/*` endpoints directly from new components.
- **Platform detection:** `isTauri()` from `frontend/src/lib/platform.ts` — single source of truth for branching on Tauri vs. web. Do not check `window.__TAURI_INTERNALS__` elsewhere.
- **Clipboard:** `copyText()` from `frontend/src/lib/clipboard.ts` — for all clipboard writes. In Tauri mode it uses the native `@tauri-apps/plugin-clipboard-manager` (no user-gesture requirement, so auto-copy after an `await` works); on web it uses `navigator.clipboard` with an `execCommand` fallback. **Do not call `navigator.clipboard` directly** — an async clipboard write that runs after an `await` (outside a click) throws `NotAllowedError` in WKWebView/WebView2 and is silently lost on desktop. The capability grants `clipboard-manager:allow-write-text` only (write, not read).

### Desktop storage (Tauri)

`TauriStorage` in `storage.ts` uses **`tauri-plugin-fs` with `BaseDirectory.AppLocalData` for everything** — API keys, settings, file metadata, and CSV files. All data lives under `AppLocalData/data/`:

| File | Contents |
|---|---|
| `data/api-keys.json` | API keys (`ebird`, `openweather`) |
| `data/settings.json` | App settings (map center, zoom, etc.) |
| `data/metadata.json` | Uploaded file metadata |
| `data/ebird-backup.csv` | eBird data file |
| `data/ml-export.csv` | ML data file |

Every write calls `mkdir(DATA_DIR, { recursive: true })` before writing to ensure the directory exists.

**Do not use `localStorage`** — it is ephemeral in Tauri's WKWebView and cleared on every relaunch.  
**Do not use the system Keychain** (`keyring` crate / `invoke('get_api_key', ...)`) — it requires entitlements not configured in this app and fails silently.

**Persist all UI settings through the `storage` seam, never `localStorage` directly.** Anything that must survive a desktop relaunch (e.g. the tab layout) goes through `storage.getSetting`/`setSetting`. The web/Pi path may still read `localStorage` synchronously inside the seam for a flash-free first paint, but the seam — not `localStorage` — is the source of truth on desktop. (See the tab-layout post-mortem in DECISIONS.md.)

Desktop development (requires Rust + `@tauri-apps/cli`):
```
npm run desktop:dev    # Tauri dev mode
npm run desktop:build  # production .app / .exe bundle
```
