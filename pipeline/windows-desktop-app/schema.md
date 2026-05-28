# Schema — Windows Desktop App

## Path
Frontend Only — No data layer changes required.

## Confirmation
Assessed against the PRD: no database/schema/migration work. Keys, settings, and data files keep using the existing `storage` seam (`AppLocalData/data/*`) unchanged on Windows. The substance of this feature is build/release and platform architecture, documented below for The Engineer.

## Existing Data/State Used (unchanged)
- `storage` seam (`frontend/src/lib/storage.ts`) → `TauriStorage` writes to `AppLocalData/data/` on every desktop OS, including Windows. No change.
- `transport` seam → `TauriTransport` routes to the TS services on all desktop OSes. No change.

---

## Build & Release Architecture (Option A)

### Principle
CI builds Windows (no secrets). `release.sh` stays the single, local assembler that signs and publishes. The minisign key never leaves the maintainer's Mac.

### A. CI — new Windows build workflow
New workflow `.github/workflows/windows-build.yml` (separate from `pipeline.yml`):
- **Trigger:** `push` of a version tag (`v*`) and `workflow_dispatch` (manual). Not on every main push — Windows builds are for releases.
- **Runner:** `windows-latest` (WebView2 is preinstalled).
- **Steps:** checkout → `setup-node@v4` (node 20) → Rust toolchain (`dtolnay/rust-toolchain@stable`) → `npm ci` in `frontend/` → `npm ci` at root → build.
- **Updater artifact problem & fix:** Tauri only emits the NSIS updater archive (`*-setup.nsis.zip`) when `createUpdaterArtifacts: true` AND a signing key is present at build time. Since CI must NOT have the real key, the workflow **generates an ephemeral throwaway minisign key in the run** (`tauri signer generate`), sets it as `TAURI_SIGNING_PRIVATE_KEY` only for the build, and discards it. This makes Tauri produce a correctly-formatted `.nsis.zip`; its CI-made `.sig` is thrown away. The archive *bytes* don't depend on the key — only the signature does — so re-signing the same bytes locally with the real key produces a valid signature against the public key already in `tauri.conf.json`.
- **Outputs:** upload `*-setup.exe` (installer) and `*-setup.nsis.zip` (updater archive) as **workflow artifacts** (retrieved later via `gh run download`). CI does not publish the public release.

### B. `release.sh` — becomes the multi-platform assembler
Extend the existing script (keep all current macOS logic intact — NFR-04):
1. Build + notarize + staple macOS as today; read the macOS updater `.sig`.
2. **Fetch Windows artifacts:** `gh run download` for the latest successful `windows-build` run on the current commit/tag → `*-setup.exe` and `*-setup.nsis.zip`.
3. **Sign the Windows updater locally:** `npx tauri signer sign` (or `npm run tauri -- signer sign`) on the `.nsis.zip` using the local key (`$TAURI_SIGNING_PRIVATE_KEY` from `~/.tauri/snowraven-signing.key`) → produces the real `.sig`. Read it.
4. **Rename to stable names** (mirrors the existing `SnowRaven-updater.app.tar.gz` pattern) so `latest.json` URLs are stable per tag: e.g. `SnowRaven-updater-x64-setup.nsis.zip` and the installer `SnowRaven_${VERSION}_x64-setup.exe`.
5. **Write ONE `latest.json`** with both platform entries (schema below).
6. **Publish** all artifacts (mac DMG + mac updater + sig, win setup.exe + win nsis.zip + sig, latest.json) to the single release via the existing `gh release create/upload --clobber` block.

### C. `latest.json` — two-platform schema
```json
{
  "version": "X.Y.Z",
  "notes": "See CHANGELOG.md for details.",
  "pub_date": "…Z",
  "platforms": {
    "darwin-aarch64": { "signature": "<mac sig>", "url": ".../SnowRaven-updater.app.tar.gz" },
    "windows-x86_64": { "signature": "<win sig>", "url": ".../SnowRaven-updater-x64-setup.nsis.zip" }
  }
}
```
The Tauri updater key for Windows is `windows-x86_64` (matches `updater_arch()` on x64 Windows — same convention as the `darwin-x86_64` fix recorded in DECISIONS.md). The updater `url` for Windows points to the `.nsis.zip`; the installer `.exe` is for first-time download by users (linked from the release / README), not the updater target.

### D. Release rhythm (to document in CLAUDE.md)
Bump version → commit → push tag `vX.Y.Z` → CI builds Windows (~few min) → run `./release.sh` locally (builds mac, fetches CI Windows artifacts, signs, assembles, publishes). `release.sh` should fail clearly if the CI Windows artifacts aren't found yet (i.e., run it after CI finishes).

---

## Platform Architecture — Geolocation Degradation

### Detection
Add `isWindows()` to `frontend/src/lib/platform.ts`. In a Tauri WebView2 the `navigator.userAgent` contains `"Windows"`; detect via `/windows/i.test(navigator.userAgent)`. Zero new dependencies, works in WebView2. (`isTauri()` stays the single Tauri check; `isWindows()` is OS-within-platform.)

### UI
In `MapExplorer.tsx`'s `CenterPointControl`: when `isTauri() && isWindows()`, render a short note using `var(--sr-*)` tokens — "Location detection isn't available on Windows yet — use address search or enter coordinates below." — instead of the "Use my location" button. Address search, manual lat/lng, and saved default location remain (FR-11).

### Safety net
In `frontend/src/lib/location.ts`, add a guard at the top of the Tauri branch: if `isWindows()`, throw `LocationError { code: 'unsupported-platform', platform: 'tauri' }` (add the code to the union). Belt-and-suspenders in case the button is ever shown; the primary fix is hiding it.

### Rust side — no changes needed
`src-tauri/src/location.rs` and the `get_location` handler are already `#[cfg(target_os = "macos")]`; the macOS-only crates are under `[target.'cfg(target_os = "macos")'.dependencies]`, so the Windows build won't pull them. `entitlements.plist` / `Info.plist` are macOS bundle config and ignored on Windows. The Engineer must verify the Windows build compiles clean (no macOS-only symbols referenced unconditionally).

---

## What The Engineer Builds (summary)
1. `.github/workflows/windows-build.yml` — windows-latest build with ephemeral-key updater artifact, uploads installer + nsis.zip.
2. `release.sh` — fetch/sign/assemble/publish Windows alongside macOS; two-platform `latest.json`.
3. `frontend/src/lib/platform.ts` — `isWindows()`.
4. `frontend/src/components/MapExplorer.tsx` — Windows geolocation note in place of the button.
5. `frontend/src/lib/location.ts` — `unsupported-platform` guard + error code.
6. Docs: README/HELP Windows install + SmartScreen note; CLAUDE.md release rhythm (Stage 9).

## No Data Layer Work Required
No migrations. The Engineer proceeds to UI + build/release implementation.
