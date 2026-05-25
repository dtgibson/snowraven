# PRD — SnowRaven Desktop App

## Overview

Ship SnowRaven as a signed and notarized standalone desktop application for Mac and Windows using Tauri. The React frontend is preserved intact. The FastAPI Python backend is migrated capability-by-capability to native TypeScript behind two thin abstractions — transport and storage — until the backend has no required job left. The existing web/Pi deployment path continues to work unchanged throughout the migration. At every commit, the app is fully functional.

---

## Functional Requirements

### Seams (Permanent Architecture)

**FR-01 — Transport seam**
A `transport` abstraction in `frontend/src/lib/transport.ts` wraps all outbound HTTP calls. In web/Pi mode, it proxies through the FastAPI backend (current behavior). In Tauri mode, it calls external APIs directly from TypeScript. All existing fetch calls in the frontend are migrated to go through this seam as part of Phase 3.

**FR-02 — Storage seam**
A `storage` abstraction in `frontend/src/lib/storage.ts` wraps all reads and writes of persistent data (API keys, settings, file paths, cached data). In web/Pi mode, it reads/writes as today. In Tauri mode, it reads/writes via Tauri's native APIs (keychain, app data directory, IndexedDB).

**FR-03 — Platform detection**
The seam implementations detect at runtime whether the app is running inside Tauri or a standard browser, and route accordingly. No manual environment flags or build-time switches.

**FR-04 — New features written to seams**
All new features added after Phase 0 write all HTTP calls through the transport seam and all persistent data through the storage seam. Features that call platform APIs directly create porting debt and must not be accepted.

**FR-05 — Web mode unchanged through all phases**
In web/Pi mode, the transport seam proxies to the FastAPI backend exactly as today. Storage reads/writes `.env` and `data/` as today. The seam is transparent to existing users.

---

### Phase 0 — Tauri Wrapper

**FR-06 — Tauri project initialized**
A `src-tauri/` directory at the repo root contains the Tauri v2 configuration and Rust core. The Tauri build wraps the existing Vite frontend output. The frontend has no Tauri-specific code in Phase 0 — it simply runs inside the Tauri webview talking to the FastAPI backend via localhost.

**FR-07 — Backend startup in desktop mode**
In Phase 0, the desktop app starts the FastAPI backend as a sidecar process or requires it to be running. The user-facing experience in Phase 0 may still require the backend; this is resolved in Phase 3+ as capabilities migrate.

**FR-08 — Desktop app builds and runs**
`npm run tauri dev` starts the app in development. `npm run tauri build` produces a distributable. The app opens, loads SnowRaven, and all existing features work.

**FR-09 — Code signing and notarization**
Mac builds are signed with an Apple Developer certificate and notarized through Apple's notarization service. Windows builds are code-signed. Both pass Gatekeeper and SmartScreen respectively. CI produces signed artifacts on the `main` branch.

**FR-10 — Universal Mac binary**
The Mac build is a universal binary (arm64 + x86_64) distributed as a `.dmg`. The Windows build is an x64 `.exe` installer.

---

### Phase 1 — Weather Formatter Port

**FR-11 — TypeScript weather formatter**
`backend/formatters/weather.py` is ported to `frontend/src/lib/formatters/weather.ts`. The TypeScript implementation is a pure function that takes the same inputs and produces byte-identical JSON output.

**FR-12 — Golden tests**
A golden test suite diffs the TypeScript formatter output against stored Python output for a representative set of inputs. The TypeScript implementation cannot be promoted until all golden tests pass.

---

### Phase 2 — API Key Storage

**FR-13 — Keychain storage via storage seam**
In Tauri mode, the storage seam reads and writes API keys (eBird, OpenWeather) using Tauri's native keychain API (Mac Keychain / Windows Credential Manager). Keys are never written to disk in plaintext in desktop mode.

**FR-14 — Settings UI unchanged**
The Settings UI reads and writes API keys through the storage seam. The UI code does not change — the seam implementation changes beneath it.

---

### Phase 3 — Proxy Migration

**FR-15 — Taxonomy proxy migrated**
The `/taxonomy` proxy is replaced in Tauri mode by a direct TypeScript HTTP call to the eBird taxonomy API through the transport seam. The response is stored in IndexedDB, rebuilt only on first fetch or forced refresh.

**FR-16 — Nominatim proxy migrated**
The `/nominatim` proxy is replaced in Tauri mode by a direct TypeScript HTTP call to the Nominatim geocoding API through the transport seam.

**FR-17 — Stats and map proxies migrated**
The `/stats` and `/map` proxies are replaced in Tauri mode by direct TypeScript HTTP calls to the eBird API through the transport seam.

**FR-18 — Weather proxy migrated**
The `/weather` proxy is replaced in Tauri mode by a direct TypeScript HTTP call to the OpenWeather API through the transport seam, using the ported weather formatter from Phase 1.

**FR-19 — Migration verified against backend**
Each proxy is flipped only after its TypeScript output diffs clean against the Python backend output for the same inputs. The backend is the reference oracle throughout.

---

### Phase 4 — File Storage

**FR-20 — eBird backup and ML export paths**
In Tauri mode, the storage seam reads/writes eBird backup files and ML export files to Tauri's app data directory (`AppData` on Windows, `~/Library/Application Support` on Mac) rather than the `data/` directory relative to the server.

**FR-21 — Map defaults persisted**
Map center, zoom, and display defaults are persisted to the app data directory in Tauri mode via the storage seam.

---

### Phase 5 — Operational Glue

**FR-22 — Tauri updater**
Tauri's built-in updater replaces the `update.sh` script and the `/version/check` backend endpoint. The app checks for updates on launch and presents a native update prompt when a new version is available.

---

### Phase 6 — Backend Decommission

**FR-23 — Backend no longer required**
After Phase 5 is complete, the FastAPI backend is not required to run the desktop app. All capabilities have been migrated to native TypeScript behind the transport and storage seams.

**FR-24 — Backend optionally kept as hosted proxy**
The transport seam supports a proxy URL configuration so that browser users on a self-hosted instance can continue using the backend as a proxy. The backend codebase is retained as an optional hosted deployment target.

---

### Unified Release Model

**FR-25 — All platforms ship simultaneously**
When a new feature is added or an existing feature is changed after Phase 0, it ships to web, Mac, and Windows in the same release. There are no platform-exclusive features or deferred platform releases.

**FR-26 — Platform-appropriate presentation**
Each platform may use its native OS conventions — window chrome, file pickers, system menus, native fonts, scroll behavior. The features, data, and behavior are identical. Pixel-identical UI is not required.

---

## Non-Functional Requirements

**NFR-01 — Bundle size**
The Tauri desktop app bundle must be substantially smaller than an Electron equivalent. Target: under 20MB for the distributable before assets.

**NFR-02 — Web continuity**
At every commit during the migration, both the web/Pi deployment and the Tauri desktop app must be fully functional. No commit leaves either broken.

**NFR-03 — Platform conventions**
Native OS conventions are preferred over custom implementations for system-level interactions: file pickers, notifications, menu bars, window management.

**NFR-04 — Security**
API keys are never stored in plaintext in desktop mode. The OS keychain is the only acceptable storage for secrets. The transport seam must not log or persist API keys.

**NFR-05 — CI produces signed artifacts**
The GitHub Actions pipeline produces signed Mac and Windows artifacts on every merge to `main`. Signing credentials are stored as GitHub Actions secrets and never committed.

**NFR-06 — Seam discipline enforced**
Code review and CI checks must catch any new feature code that bypasses the transport or storage seams. The seams are permanent architecture, not optional abstractions.

---

## Success Metrics

| Criterion | Measure |
|-----------|---------|
| Download and install without terminal | Manual test: download `.dmg` / `.exe`, install, open — no terminal required |
| All features work in desktop app | Manual test across all tabs: weather, breeding codes, media list, species detail, statistics, map explorer, settings |
| API keys stored in OS keychain | Verify no plaintext keys in app data directory in Tauri mode |
| Mac Gatekeeper passes | Install `.dmg` on a stock Mac without bypass |
| Windows SmartScreen passes | Install `.exe` on a stock Windows machine without bypass |
| Web deployment unchanged | Existing web/Pi users see no behavior change at any commit |
| Golden tests pass | All TypeScript formatter diffs clean against Python output |
| New features on all platforms | Post-Phase-0 features verified on web + Mac + Windows before each release |
| Taxonomy cache persisted | Second app launch does not re-fetch taxonomy from eBird |
| App update without terminal | In-app updater presents and applies updates without shell access |

---

## Open Questions

**OQ-01 — Apple Developer account**
Signing and notarization require an Apple Developer account ($99/year). Confirm this is available or needs to be created before Phase 0 completes.

**OQ-02 — Windows code signing certificate**
Windows SmartScreen suppression requires a code signing certificate (EV cert ~$300-500/year from a CA). Decide whether to acquire one before Phase 0 or ship Phase 0 with a SmartScreen warning and add signing before the public release.

**OQ-03 — Tauri v2 vs v1**
Tauri v2 is the current stable release with improved mobile support and a more capable plugin system. Confirm Tauri v2 before initializing `src-tauri/`.

**OQ-04 — Phase 0 backend startup UX**
In Phase 0, the desktop app still requires the FastAPI backend. Decide: (a) require users to start the backend separately (acceptable for Phase 0 internal use), (b) bundle the backend as a Tauri sidecar (complex but complete), or (c) ship Phase 0 only to developers until Phase 3 eliminates the backend dependency.
