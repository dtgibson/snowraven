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
- **`release.sh` Intel arch:** The platform key in `latest.json` for Intel Macs must be `darwin-x86_64`. Tauri's `updater_arch()` returns `"x86_64"` on Intel — if `release.sh` maps this to `"x64"`, Intel users never see any update as available.
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

### Colors and theming

- **All colors must use `var(--sr-*)` CSS custom properties** — no hardcoded hex or RGB values in any component file
- The full token palette lives in `frontend/src/globals.css`: `:root` (light) and `[data-theme="dark"]` (dark)
- When inline styles need rgba() with a dynamic alpha, use the RGB triplet pattern: `rgba(var(--sr-tier-4-rgb), 0.08)`
- New tokens go in both `:root` and `[data-theme="dark"]` before use
- The `data-theme` attribute on `<html>` is set by the anti-flash script in `index.html` and updated by `applyTheme()` in `src/lib/theme.ts`

### Overlays and stacking

- **Floating overlays (dropdowns, menus, popovers) that can appear over a map must use a `z-index` above Leaflet's layers.** Leaflet panes and controls reach ~1000; use `z-index: 1200` (as the responsive tab dropdown does in `TabNav.tsx`). The Map Explorer is reachable on most views, so any new overlay should assume a map may be beneath it.

### Documentation

- **`docs/HELP.md` is the single source of truth for all in-app help content.** When a feature is added or changed, update this file to reflect the current behavior before pushing.
- `HelpDocs.tsx` imports `docs/HELP.md` via Vite's `?raw` loader (`import helpText from '../../../docs/HELP.md?raw'`). Content is bundled at build time — no runtime fetch. Offline-available by design.
- `vite.config.ts` sets `server.fs.allow: ['..']` to allow the dev server to resolve the `?raw` import outside the `frontend/` root. This is dev-only — production resolves at compile time.
- **Also review and update `README.md`** before every push to ensure it reflects the current feature set.

### Production build
```
./start.sh
```
Builds frontend into `frontend/dist/`, starts uvicorn on port 1620.
FastAPI serves the built frontend as static files automatically.

### Desktop app seams

Two permanent architectural seams route all platform-sensitive operations. Use them in new code — do not bypass them.

- **Transport:** `transport.get()` / `transport.post()` from `frontend/src/lib/transport.ts` — for all outbound HTTP calls. In Tauri mode, `TauriTransport` routes each API path directly to a TypeScript service (weather, map, taxonomy, nominatim, stats, version). In web/Pi mode, `WebTransport` delegates to the Python backend.
- **Storage:** `storage.getApiKey()` / `storage.getSetting()` / etc. from `frontend/src/lib/storage.ts` — for all key, setting, and file access. Do not call `/settings/*` endpoints directly from new components.
- **Platform detection:** `isTauri()` from `frontend/src/lib/platform.ts` — single source of truth for branching on Tauri vs. web. Do not check `window.__TAURI_INTERNALS__` elsewhere.

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
