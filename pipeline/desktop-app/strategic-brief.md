# Strategic Brief -- SnowRaven Desktop App

## What We're Building

A signed and notarized standalone desktop application for Mac and Windows, built with Tauri, that packages SnowRaven's full feature set without requiring a running server, terminal setup, or Raspberry Pi. The existing React frontend is preserved intact; the FastAPI Python backend is migrated capability-by-capability to native TypeScript behind two thin abstractions -- transport and storage -- until the backend has no required job left.

## Why Now

SnowRaven has grown from a single-tool web app into a full birding analytics suite, but its distribution model still requires users to run a Python server. That ceiling limits who can use it. A desktop app lowers it to zero: download, install, open. It also eliminates the Raspberry Pi dependency for users who want to run it on their laptop, and the transport and storage seams introduced here become the foundation for the Capacitor mobile port -- and for every future feature, which will now be written once and work on all platforms automatically.

## The User Problem

The user has to maintain a running Python backend to use SnowRaven at all. On a Raspberry Pi that means SSH access, systemd management, and updates via a shell script. On a Mac it means keeping a terminal tab open. When something breaks -- a Python version mismatch, a missing `.env` key, a port conflict -- the entire app is dead. A native desktop app has none of these failure modes.

## Success Criteria

- A user can download a `.dmg` or `.exe`, install it normally, and open SnowRaven without touching a terminal
- All existing features work identically in the desktop app: weather lookup, breeding codes, media list, species detail, statistics, map explorer, settings
- API keys are stored in the OS keychain rather than a plaintext `.env` file
- The app passes Mac Gatekeeper (signed + notarized) and Windows SmartScreen (code-signed)
- The existing web/Pi deployment path continues to work unchanged throughout the migration
- At every commit during the migration, the app is fully functional
- New features added after the desktop app ships are available on web, Mac, and Windows simultaneously with no additional porting work

## Scope

- Phase 0: Tauri wrapper around the existing Vite build, talking to the FastAPI backend, distributed as a desktop app
- Phase 1: Port `backend/formatters/weather.py` to TypeScript with golden-test parity against Python output
- Phase 2: API key storage moved to OS keychain via Tauri's native keychain API
- Phase 3: Port all backend proxies to native TypeScript HTTP calls behind the transport seam, one by one (taxonomy → Nominatim → stats/map → weather last)
- Phase 4: Port file storage (eBird backup, ML export, map defaults) to Tauri's app data directory
- Phase 5: Replace operational glue (update.sh, /version/check, CORS, static serving, start.sh) with Tauri's built-in updater
- Phase 6: Backend decommissioned as a requirement (optionally kept as a hosted proxy for browser users)
- Mac (arm64 + x86_64 universal) and Windows (x64) as distribution targets
- Signing and notarization for both platforms

## Out of Scope

- Mobile app (follows from the seams introduced here, handled as a separate feature)
- Linux distribution (Pi users continue using the web deployment)
- Mac App Store distribution (direct download `.dmg` only; sandboxing constraints complicate keychain + file access)
- Any new user-facing features during the migration -- distribution and architecture change only
- Cloud hosting or multi-user mode

## Key Decisions

- **Tauri, not Electron** -- system webview, Rust core, dramatically smaller bundle
- **Transport and storage seams are permanent architecture** -- not migration scaffolding. Every new feature is written against these abstractions so it works on web, Mac, Windows, and eventually mobile without additional porting. New features that call platform-specific APIs directly will create a porting debt -- this must not happen.
- **Functionally equivalent, not pixel-identical** -- each platform may use its own native conventions (OS window chrome, native file pickers, system menus, native fonts and scroll behavior). The features, data, and behavior are the same everywhere; the presentation adapts to the platform.
- **Unified release model** -- when a new feature ships, it ships to all versions simultaneously. There are no "web only" or "desktop only" features. The update cadence for all platforms is the same release cycle.
- **Web mode unchanged** -- in web/Pi mode, transport calls the backend and storage reads/writes `.env` and `data/` as now; the seam is invisible to existing users
- **Backend as reference oracle** -- migration flips a capability only once its TypeScript implementation diffs clean against Python output; the backend is never broken during the process
- **vite.config.ts proxy list is the migration checklist** -- weather, taxonomy, settings, nominatim, stats, map, version
- **API keys go to the OS keychain** -- moved before proxy porting so native API calls have somewhere to read keys from
- **Taxonomy cache persisted to IndexedDB** -- large payload; rebuild on first fetch only
- **Backend optionally kept as hosted proxy** -- transport seam supports a proxy URL, so browser users on a self-hosted instance keep working after Phase 6
- **Direct download distribution** -- `.dmg` for Mac (signed + notarized), `.exe` installer for Windows (code-signed); no app stores in v1
- **Capacitor mobile port comes next** -- the seams make it a seam-reimplementation, not a rewrite; React build is shared
