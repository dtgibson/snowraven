# CLAUDE.md

This file is auto-loaded by Claude Code at the start of every session.
It holds pipeline conventions, tool rules, and project-specific
decisions that all builders must follow.

## Versioning

- Version is tracked in `frontend/package.json` (semver, patch increments for small features/fixes, minor for larger features)
- **Bump BOTH `frontend/package.json` AND `src-tauri/tauri.conf.json` to the same version.** `tauri.conf.json` is the source of the desktop *bundle* version (macOS `CFBundleShortVersionString`, Windows installer version, and the in-app updater's version check) and does NOT read from `package.json`. Forgetting it ships a mislabeled bundle and breaks the updater; `release.sh`'s version guard catches the macOS side, but the Windows installer is built by CI from `tauri.conf.json` at the tagged commit, so the tag must point at a commit where both are bumped. (Patch-only by default — never minor/major unless explicitly told.)
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

- **The maps run on MapLibre GL via `react-map-gl` (entry `react-map-gl/maplibre`); Leaflet has been fully removed.** All three maps (Map Explorer, Species Detail, Statistics) render through the shared `<SnowMap>` wrapper (`components/SnowMap.tsx`), with styles/providers in `lib/mapStyle.ts`. Import react-map-gl's `Map` as `MapGL` — it shadows the global `Map` constructor otherwise (that caused a blank-screen crash). Components inside a `<Map>` get the instance via `useMap().current` (a `MapRef` proxying the MapLibre `Map`). Popups are a single state-driven `<Popup>` per map (MapLibre has no per-marker `bindPopup`).
- **Map Explorer's high-count markers are GL layers, not DOM `<Marker>`s (v0.5.16).** Sighting pins are a `circle` layer (`sr-sight-circle`) and hotspot teardrops a `symbol` layer (`sr-hotspot`) with canvas-baked sprites — the count→radius/opacity model lives in `lib/mapPins.ts` as shared stop tables (function + step-expression from one source of truth; `mapPins.test.ts` locks the parity). Do NOT add a DOM `<Marker>` per feature for anything that can reach hundreds of instances; bounded, content-rich markers (Media Target chips, the user-location dot, Species Detail / Statistics pins) stay DOM. GL paint can't use CSS vars: colors are read from `--sr-*` tokens at runtime and refreshed on a `data-theme` change (a `MutationObserver`, same contract as the atlas hatch sprites). Clicks come from `map.on('click')` + `queryRenderedFeatures`; the canvas cursor must go through `updateMapCursor` in `lib/mapPins.ts` (overlapping interactive layers strand a stale cursor if each manages it independently). `AtlasLayer` ignores clicks where a marker layer is hit, so pin clicks don't also open the block popup.
- **Sighting-pin maps use the shared `SightingsMap` (`components/SightingsMap.tsx`) — don't re-inline the Species Detail pins map (v0.5.26).** It owns the DOM `<Marker>` pins, the single state-driven `<Popup>` (its own `selectedCoord`), `MapBoundsFitter`, and the static `SP_PIN_HTML` sprite; Species Detail and the Named Birds card both consume it. Build its `markers` with the pure `lib/sightingMarkers.ts` `buildSightingMarkers` (skip null coords, group by `lat,lng`, dates newest-first) so skip-null / empty→no-map / same-coord aggregation stays one tested function. The heatmap/intensity/map-mode toggle stay LOCAL to Species Detail — the extraction is the pins path only. Callers must gate on `markers.length > 0` (the empty guard is the caller's, so no WebGL context mounts for a no-coordinate entity). **Where a list can mount per-row maps, bound concurrent WebGL contexts structurally with a single-open accordion (one live map = one context), not an instance counter/queue** — the Named Birds tab does this via a `singleOpen` prop on `NamedBirdsTable` (Species Detail's map-less list stays multi-open).
- **Floating overlays (dropdowns, menus, popovers) that can appear over a map must use a `z-index` above the map's controls.** Use `z-index: 1200` (as the responsive tab dropdown does in `TabNav.tsx`). The Map Explorer is reachable on most views, so any new overlay should assume a map may be beneath it.
- **A MapLibre `fill` layer with `fill-opacity: 0` is still hit-tested**, so a transparent fill makes a polygon's whole interior a click target. The atlas overlay (`AtlasLayer.tsx`) relies on this — unshaded blocks have `fill-opacity 0` yet still open the block popup, via a handler bound with `map.on('click', 'sr-atlas-fill', …)`.
- **The atlas overlay is viewport-capped (v0.5.16).** `AtlasLayer` generates blocks for the current view only — `blocksInBounds` + `padBounds(0.15)` from `lib/atlasBlocks.ts`, recomputed on `moveend`, cap 9000 — instead of materializing all ~17k block polygons. Over-cap views (roughly the full-state zoom-6 view) draw nothing and show a "Zoom in to see atlas blocks" hint chip. Tier fill colors read the `--sr-tier-N` tokens at render (theme-aware, matching the sidebar legend); the atlas layers insert *below* any marker layers present at mount (`beforeId`) so pins stay on top when the atlas is toggled on later.
- **Heatmaps use MapLibre's native `heatmap` layer**, driven by one shared model in `lib/heat.ts` (`heatRadiusPx` / `heatIntensityFactor` / `heatWeight`) so the 1–10 intensity slider behaves identically on the Map Explorer and Species Detail maps — tune the curve there, not per-map (default is deliberately calm: `heatIntensityFactor(5) = 0.30`). When atlas breeding-shading is on, the Map Explorer heatmap is re-ordered UNDER the atlas fill via `beforeId="sr-atlas-fill"` and dimmed, and the sighting pins fade, so the tier colors stay legible on top.
- **To texture/pattern-fill a MapLibre layer, generate a raster sprite and `map.addImage(id, imageData, { pixelRatio })`, then reference it from `fill-pattern`** (MapLibre fills can't use SVG `<pattern>` fragments). The atlas hatches (`lib/atlasTextures.ts` → canvas `ImageData` per breeding tier; added by `AtlasLayer` on load) use this. Sprite colors are read from the `--sr-tier-N-rgb` tokens at generation time, so regenerate + re-add on a `data-theme` change (a `MutationObserver` in `AtlasLayer` handles it). The sidebar legend's hatch preview is a separate inline-SVG swatch (`TierHatchSwatch` in `MapExplorer.tsx`), theme-aware via CSS vars.
- **The map backdrop (area beyond tiles / before load) comes from the MapLibre style's `background` layer**, not a CSS container override. `SnowMap` shows a `VOID_COLOR` placeholder (`lib/mapStyle.ts`) only while the vector style is fetching; once loaded, the style paints its own background. (The old Leaflet `.leaflet-container` backdrop hack is gone.)
- **Map tiles come from keyless providers defined once in `frontend/src/lib/mapStyle.ts`, rendered via `<SnowMap switcher?>` — never hard-code a tile source in a map component.** Default base is the **OpenFreeMap** vector style (positron), tuned in `fetchTunedBaseStyle` (label size, country/state borders, land tints). Do NOT reintroduce `tile.openstreetmap.org` (OSMF policy forbids app/self-hosted use). Satellite (Esri) / Topo-US (USGS) / Trails (Waymarked) are raster layers toggled by `visibility` within the ONE persistent style — never `setStyle`-swap for base changes (it drops sources and resets pan/zoom). Base/overlay choice persists via the storage seam. **Adding or changing any tile provider MUST be reflected in `PRIVACY_POLICY.md` (the "Map Tiles" section)** — tiles, and the OpenFreeMap style/glyphs/sprites, are fetched browser→provider, exposing IP + viewport, so the provider list is a privacy disclosure. Flag this in security reviews touching the map basemaps.
- **Map fullscreen is a CSS overlay, not the browser Fullscreen API.** The Map Explorer panel becomes `position: fixed; inset: 0; height: 100dvh; z-index: 1200` driven by `mapFullscreen` in `App.tsx` (the Fullscreen API is unreliable in iOS Safari/WKWebView). The fullscreen toggle shows on ALL widths (bottom-right of the map, in `.sr-map-fab-cluster`); the **Filters** button in that same cluster is mobile-only (desktop keeps the sidebar visible). When adding state that hides app chrome, clear it on any in-component navigation that switches tabs, and lock `document.body` overflow only while the overlay is active.

### Security — standing checks

- **The atlas block popup is built as escaped JSX (`AtlasLayer.tsx`), not an HTML string.** Block name/code render as React children (auto-escaped) and the eBird atlas URL is `encodeURIComponent`-wrapped, so it's injection-safe even though the data is bundled/trusted (`ca-atlas-blocks.json`). **Standing check:** keep this popup — and the other map popups — as JSX; do NOT switch atlas/marker popups to `dangerouslySetInnerHTML`. The few `dangerouslySetInnerHTML` uses on the maps are static SVG constants or run user/external text through `escHtml` first (e.g. the target-chip label in `MapExplorer.tsx`); preserve that.
- **An eBird id from CSV data is shape-validated before it becomes a link.** Gate a checklist `href` on `SUBMISSION_ID_RE` (`/^S\d+$/`, from `components/speciesDetail/ui`) — and a location id on `/^L\d+$/`, a catalog id on `/^\d+$/` — before interpolating it into an anchor; render the id as plain text when it doesn't match (don't ship a styled 404 link from a junk column value). This is recurring across the maps (popups), the Statistics busiest-day link, and the Named Birds report row (`NamedBirdRow.tsx`). Pair it with `encodeURIComponent` where the id rides in a query string.

### Documentation

- **`docs/HELP.md` is the single source of truth for all in-app help content.** When a feature is added or changed, update this file to reflect the current behavior before pushing.
- `HelpDocs.tsx` imports `docs/HELP.md` via Vite's `?raw` loader (`import helpText from '../../../docs/HELP.md?raw'`). Content is bundled at build time — no runtime fetch. Offline-available by design.
- `vite.config.ts` sets `server.fs.allow: ['..']` to allow the dev server to resolve the `?raw` import outside the `frontend/` root. This is dev-only — production resolves at compile time.
- **Also review and update `README.md`** before every push to ensure it reflects the current feature set.
- **The public showcase website lives in `website/` and ships to GitHub Pages — keep it in sync with the README and docs.** It is a static, dependency-free site (hand-written `website/index.html` + `styles.css` + `app.js`, system fonts only, **no third-party requests** so it embodies the privacy-first promise, all asset paths relative for the `/snowraven/` project-pages base). `.github/workflows/pages.yml` redeploys it on every push to `main` that touches `website/` (one-time setup: repo Settings → Pages → Source = "GitHub Actions"). **Whenever a feature is added or changed, or `README.md`/`docs/HELP.md` are updated, update `website/` in the same change** — the feature list, copy, the version pill + footer version (currently `v0.5.17`), and screenshots must reflect the current app. The site is NOT in the desktop/web app bundle, so it does **not** get a `package.json`/`tauri.conf.json` version bump and does not ship in releases.
  - **Screenshots (`website/assets/shots/*.webp`) must come from SYNTHETIC demo data, never the user's real eBird data** — the privacy-first brand means the published site must never contain personal sighting locations. Regeneration tooling is in `website/tools/` (`gen-demo-data.mjs` builds a fictional dataset, `capture.mjs` drives the running app with Playwright, `process-img.mjs` resizes to WebP); see `website/tools/README.md`.
  - **Voice:** informative, not promotional. The site exists so a birder can learn what SnowRaven does and decide for themselves; it is a personal project shared as a free public good, and it does not try to sell or push downloads. Frame SnowRaven as working *alongside* eBird and the Macaulay Library and letting you explore your own exported data in new ways. Never imply it replaces, fixes, or improves on eBird, and keep the gratitude toward those free services intact (no "finally working for you" framing, no star-begging).
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
